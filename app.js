/* STEELCAST — Phase 1
 * Structural steel installation forecaster.
 * Takes project scope + a daily journal of installed m², fits a least-squares
 * fixing rate, and projects completion against the contract deadline.
 */
"use strict";

const STORE_KEY = "steelcast.v4";
const DAY = 86400000;

/* ───────────────────────── state ───────────────────────── */
const state = load() || {
  name: "",
  area: null,
  start: "",
  deadline: "",
  entries: [], // { date: "yyyy-mm-dd", amount: number }
};

function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)); }
  catch { return null; }
}
function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

/* ───────────────────────── date helpers ───────────────────────── */
function parseDate(s) {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function toISO(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function daysBetween(a, b) { return Math.round((b - a) / DAY); }
function addDays(d, n) { return new Date(d.getTime() + n * DAY); }
function fmtDate(d) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtShort(d) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
function fmtNum(n) {
  return Math.round(n).toLocaleString("en-US");
}

/* ───────────────────────── forecast core ───────────────────────── */
/* Least-squares regression of cumulative installed area over elapsed days.
 * Returns slope (m²/day), its standard error, and the latest cumulative point. */
function regress(points) {
  const n = points.length;
  if (n < 2) return null;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0, sxy = 0;
  for (const p of points) { sxx += (p.x - mx) ** 2; sxy += (p.x - mx) * (p.y - my); }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  // standard error of the slope (residual based)
  let sse = 0;
  for (const p of points) { const fit = slope * p.x + intercept; sse += (p.y - fit) ** 2; }
  const slopeSE = n > 2 ? Math.sqrt((sse / (n - 2)) / sxx) : 0;
  return { slope, intercept, slopeSE };
}

function computeForecast() {
  const start = parseDate(state.start);
  const deadline = parseDate(state.deadline);
  const area = Number(state.area);
  const entries = [...state.entries].sort((a, b) => a.date.localeCompare(b.date));

  const base = { start, deadline, area, entries, ready: false };
  if (!start || !deadline || !area || area <= 0 || entries.length === 0) return base;

  // cumulative series, x = days since start
  let cum = 0;
  const series = entries.map((e) => {
    cum += Number(e.amount);
    return { date: parseDate(e.date), x: daysBetween(start, parseDate(e.date)), y: cum, day: Number(e.amount) };
  });
  const last = series[series.length - 1];
  const installed = last.y;
  const remaining = Math.max(area - installed, 0);
  const pct = Math.min(installed / area, 1);

  const reg = regress(series);
  const rate = reg ? reg.slope : null;

  // days from last update to deadline, and required rate to still hit it
  const daysToDeadline = daysBetween(last.date, deadline);
  const requiredRate = remaining <= 0 ? 0 : (daysToDeadline > 0 ? remaining / daysToDeadline : Infinity);

  let forecastDate = null, forecastEarly = null, forecastLate = null, deltaDays = null, verdict = "idle";

  if (remaining <= 0) {
    // scope met — interpolate the date the cumulative first crossed the target
    let cross = last.date;
    for (let i = 0; i < series.length; i++) {
      if (series[i].y >= area) {
        const prev = i > 0 ? series[i - 1] : { date: start, y: 0 };
        const denom = (series[i].y - prev.y) || 1;
        const frac = (area - prev.y) / denom;
        const gap = daysBetween(prev.date, series[i].date);
        cross = addDays(prev.date, Math.round(gap * frac));
        break;
      }
    }
    forecastDate = cross;
    deltaDays = daysBetween(forecastDate, deadline); // +ve = finished early
    verdict = deltaDays >= 0 ? "ontrack" : "behind";
  } else if (rate && rate > 0) {
    const daysLeft = remaining / rate;
    forecastDate = addDays(last.date, daysLeft);
    deltaDays = daysBetween(forecastDate, deadline); // +ve forecast before deadline = good
    verdict = deltaDays >= 0 ? "ontrack" : "behind";
    // confidence cone from slope std error (±1σ, clamped to sane bounds)
    if (reg.slopeSE > 0) {
      const hi = rate + reg.slopeSE, lo = Math.max(rate - reg.slopeSE, rate * 0.15);
      forecastEarly = addDays(last.date, remaining / hi);
      forecastLate = addDays(last.date, remaining / lo);
    }
  } else {
    verdict = "stalled";
  }

  return {
    ...base, ready: true, series, installed, remaining, pct,
    rate, requiredRate, forecastDate, forecastEarly, forecastLate, deltaDays, verdict,
    lastDate: last.date,
  };
}

/* smootherstep S-curve — realistic planned cumulative (slow→fast→slow) */
function smoother(t) { t = Math.max(0, Math.min(1, t)); return t * t * t * (t * (t * 6 - 15) + 10); }

/* ───────────────────────── chart ───────────────────────── */
function drawChart(f) {
  const host = document.getElementById("chart");
  const W = 880, H = 380;
  const m = { l: 64, r: 24, t: 18, b: 40 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;

  if (!f.start || !f.deadline || !f.area) {
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}"><text x="${W/2}" y="${H/2}" text-anchor="middle" class="c-axis-label" font-size="13">Set project scope to draw the baseline</text></svg>`;
    return;
  }

  // x domain: start → latest of {deadline, forecastLate/forecastDate} + 6% pad
  const start = f.start;
  let endDate = f.deadline;
  for (const d of [f.forecastDate, f.forecastLate]) if (d && d > endDate) endDate = d;
  const span = Math.max(daysBetween(start, endDate), 1);
  const padDays = Math.ceil(span * 0.06);
  const xMaxDays = span + padDays;
  const peak = f.ready && f.series.length ? f.series[f.series.length - 1].y : 0;
  const yMax = Math.max(f.area, peak) * 1.04;

  const X = (days) => m.l + (days / xMaxDays) * iw;
  const Xd = (date) => X(daysBetween(start, date));
  const Y = (v) => m.t + ih - (v / yMax) * ih;

  const svg = [];
  svg.push(`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Installation forecast S-curve">`);

  // y gridlines + labels (0, 25, 50, 75, 100% of scope)
  for (let i = 0; i <= 4; i++) {
    const v = (f.area / 4) * i;
    const y = Y(v);
    svg.push(`<line class="c-grid" x1="${m.l}" y1="${y.toFixed(1)}" x2="${W - m.r}" y2="${y.toFixed(1)}"/>`);
    svg.push(`<text class="c-axis-label" x="${m.l - 10}" y="${(y + 3).toFixed(1)}" text-anchor="end">${fmtNum(v)}</text>`);
  }
  svg.push(`<text class="c-axis-label" x="${m.l - 10}" y="${m.t - 6}" text-anchor="end">m²</text>`);

  // x ticks ~ 5 across the span
  const ticks = 5;
  for (let i = 0; i <= ticks; i++) {
    const days = Math.round((xMaxDays / ticks) * i);
    const x = X(days);
    svg.push(`<line class="c-grid" x1="${x.toFixed(1)}" y1="${m.t}" x2="${x.toFixed(1)}" y2="${m.t + ih}" opacity="0.5"/>`);
    svg.push(`<text class="c-axis-label" x="${x.toFixed(1)}" y="${H - 16}" text-anchor="middle">${fmtShort(addDays(start, days))}</text>`);
  }

  // planned S-curve baseline (start → deadline)
  const planDays = Math.max(daysBetween(start, f.deadline), 1);
  let plan = "";
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const x = X(t * planDays);
    const y = Y(f.area * smoother(t));
    plan += (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1) + " ";
  }
  svg.push(`<path class="c-plan" d="${plan.trim()}"/>`);

  // deadline marker — colour depends on verdict
  const dlx = Xd(f.deadline);
  const dlClass = f.verdict === "behind" ? "c-deadline c-deadline-fill" : "c-deadline";
  svg.push(`<line class="${dlClass}" x1="${dlx.toFixed(1)}" y1="${m.t}" x2="${dlx.toFixed(1)}" y2="${m.t + ih}"/>`);
  svg.push(`<text class="c-tag" x="${dlx.toFixed(1)}" y="${m.t + 12}" text-anchor="${dlx > W - 80 ? "end" : "middle"}" fill="var(--haze)">DEADLINE</text>`);

  if (f.ready && f.series.length) {
    const okClass = f.verdict === "ontrack";

    // confidence cone (between early & late forecast) from last actual point
    if (f.forecastEarly && f.forecastLate) {
      const lp = f.series[f.series.length - 1];
      const px = Xd(lp.date), py = Y(lp.y);
      const ex = Xd(f.forecastEarly), lx = Xd(f.forecastLate);
      const ty = Y(f.area);
      svg.push(`<path class="c-cone ${okClass ? "c-cone--ok" : ""}" d="M${px.toFixed(1)} ${py.toFixed(1)} L${ex.toFixed(1)} ${ty.toFixed(1)} L${lx.toFixed(1)} ${ty.toFixed(1)} Z"/>`);
    }

    // actual installed line + dots
    let act = "";
    act += "M" + Xd(start).toFixed(1) + " " + Y(0).toFixed(1) + " ";
    f.series.forEach((p) => { act += "L" + Xd(p.date).toFixed(1) + " " + Y(p.y).toFixed(1) + " "; });
    svg.push(`<path class="c-actual c-anim" d="${act.trim()}"/>`);
    f.series.forEach((p) => {
      svg.push(`<circle class="c-actual-dot" cx="${Xd(p.date).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3.5"/>`);
    });

    // forecast projection from last actual to completion point
    if (f.forecastDate && f.remaining > 0) {
      const lp = f.series[f.series.length - 1];
      const fx = Xd(f.forecastDate), fy = Y(f.area);
      svg.push(`<path class="c-fc ${okClass ? "c-fc--ok" : ""}" d="M${Xd(lp.date).toFixed(1)} ${Y(lp.y).toFixed(1)} L${fx.toFixed(1)} ${fy.toFixed(1)}"/>`);
      // glowing endpoint
      svg.push(`<circle class="c-endpoint ${okClass ? "c-endpoint--ok" : "c-endpoint--behind"}" cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="5.5"/>`);
      const anchor = fx > W - 90 ? "end" : "start";
      const ox = fx > W - 90 ? -10 : 10;
      svg.push(`<text class="c-tag" x="${(fx + ox).toFixed(1)}" y="${(fy - 12).toFixed(1)}" text-anchor="${anchor}" fill="${okClass ? "var(--mill)" : "var(--molten)"}">${fmtShort(f.forecastDate)}</text>`);
    }
  }

  svg.push(`</svg>`);
  host.innerHTML = svg.join("");
}

/* ───────────────────────── render ───────────────────────── */
function renderJournal() {
  const list = document.getElementById("journalList");
  const empty = document.getElementById("journalEmpty");
  const sorted = [...state.entries].sort((a, b) => a.date.localeCompare(b.date));
  let cum = 0;
  list.innerHTML = sorted.map((e) => {
    cum += Number(e.amount);
    const d = parseDate(e.date);
    return `<li>
      <span>${fmtShort(d)}</span>
      <span>${fmtNum(e.amount)}</span>
      <span class="j-cum">${fmtNum(cum)}</span>
      <button class="j-del" data-date="${e.date}" title="Remove entry" aria-label="Remove ${fmtShort(d)}">×</button>
    </li>`;
  }).join("");
  empty.style.display = sorted.length ? "none" : "block";
}

function setVerdict(f) {
  const el = document.getElementById("verdict");
  const label = document.getElementById("verdictLabel");
  const detail = document.getElementById("verdictDetail");
  const delta = document.getElementById("verdictDelta");
  el.classList.remove("verdict--idle", "verdict--ontrack", "verdict--behind");

  if (!f.ready) {
    el.classList.add("verdict--idle");
    label.textContent = "Awaiting data";
    detail.textContent = "Set the scope and log at least one day to generate a forecast.";
    delta.textContent = "—";
    return;
  }
  if (f.verdict === "stalled") {
    el.classList.add("verdict--behind");
    label.textContent = "Stalled";
    detail.textContent = "No measurable progress across the logged days — no completion date can be projected.";
    delta.textContent = "—";
    return;
  }
  if (f.verdict === "ontrack") {
    el.classList.add("verdict--ontrack");
    label.textContent = f.remaining <= 0 ? "Complete" : "On track";
    const d = Math.abs(f.deltaDays);
    detail.textContent = `Forecast finish ${fmtDate(f.forecastDate)} — ${d} day${d === 1 ? "" : "s"} ahead of the ${fmtDate(f.deadline)} deadline.`;
    delta.textContent = `+${f.deltaDays}d`;
  } else {
    el.classList.add("verdict--behind");
    label.textContent = "Behind schedule";
    const d = Math.abs(f.deltaDays);
    detail.textContent = `Forecast finish ${fmtDate(f.forecastDate)} — ${d} day${d === 1 ? "" : "s"} past the ${fmtDate(f.deadline)} deadline. Lift the daily rate to recover.`;
    delta.textContent = `${f.deltaDays}d`;
  }
}

function setReadouts(f) {
  const set = (id, v) => (document.getElementById(id).textContent = v);
  if (!f.ready) {
    ["rRate", "rReq", "rPct", "rEta"].forEach((id) => set(id, "—"));
    set("rEtaSub", "no projection yet");
    return;
  }
  set("rRate", f.rate && f.rate > 0 ? fmtNum(f.rate) : "0");
  set("rReq", f.requiredRate === Infinity ? "∞" : fmtNum(f.requiredRate));
  set("rPct", Math.round(f.pct * 100) + "%");
  if (f.forecastDate) {
    set("rEta", fmtShort(f.forecastDate));
    set("rEtaSub", f.forecastDate.getFullYear() + (f.remaining <= 0 ? " · delivered" : ""));
  } else {
    set("rEta", "—");
    set("rEtaSub", "no projection yet");
  }
}

function render() {
  // sync inputs (without clobbering focus)
  const ae = document.activeElement;
  const setIf = (id, v) => { const el = document.getElementById(id); if (el !== ae) el.value = v; };
  setIf("projName", state.name);
  setIf("area", state.area ?? "");
  setIf("start", state.start);
  setIf("deadline", state.deadline);

  const f = computeForecast();
  renderJournal();
  setVerdict(f);
  drawChart(f);
  setReadouts(f);
}

/* ───────────────────────── events ───────────────────────── */
document.getElementById("projName").addEventListener("input", (e) => { state.name = e.target.value; save(); });
document.getElementById("area").addEventListener("input", (e) => { state.area = e.target.value ? Number(e.target.value) : null; save(); render(); });
document.getElementById("start").addEventListener("input", (e) => { state.start = e.target.value; save(); render(); });
document.getElementById("deadline").addEventListener("input", (e) => { state.deadline = e.target.value; save(); render(); });

document.getElementById("entryForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const date = document.getElementById("entryDate").value;
  const amount = Number(document.getElementById("entryAmount").value);
  if (!date || !(amount >= 0)) return;
  const existing = state.entries.find((x) => x.date === date);
  if (existing) existing.amount = amount; // one entry per day; overwrite
  else state.entries.push({ date, amount });
  save();
  document.getElementById("entryAmount").value = "";
  // advance the date field to the next day for fast logging
  const next = addDays(parseDate(date), 1);
  document.getElementById("entryDate").value = toISO(next);
  render();
});

document.getElementById("journalList").addEventListener("click", (e) => {
  const btn = e.target.closest(".j-del");
  if (!btn) return;
  state.entries = state.entries.filter((x) => x.date !== btn.dataset.date);
  save(); render();
});

document.getElementById("reset").addEventListener("click", () => {
  if (!confirm("Clear the project and all journal entries?")) return;
  state.name = ""; state.area = null; state.start = ""; state.deadline = ""; state.entries = [];
  save(); render();
});

document.getElementById("loadSample").addEventListener("click", () => {
  loadSample(); save(); render();
});

/* ───────────────────────── sample project ───────────────────────── */
function loadSample() {
  // Logistic Center Houston — 5,800 m² roofing package.
  // Crew works Sun–Fri: Sun–Thu are full days (~100 m²), Fridays are short
  // days (~30 m²). Journal runs 04 May → 06 Jun 2026.
  const start = new Date(2026, 4, 4);    // Mon 04 May 2026
  const end = new Date(2026, 5, 6);      // Sat 06 Jun 2026 (inclusive bound)
  state.name = "Logistic Center Houston - Roofing";
  state.area = 5800;
  state.start = toISO(start);
  state.deadline = toISO(new Date(2026, 6, 1)); // 01 Jul 2026

  // Deterministic pseudo-random so the dataset is identical on every load.
  let seed = 0x5eed1;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const randInt = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

  state.entries = [];
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    const dow = d.getDay();                  // 0 Sun … 6 Sat
    if (dow === 6) continue;                  // Saturday — off
    const amount = dow === 5
      ? randInt(25, 35)                       // Friday — short day (~30)
      : randInt(85, 115);                     // Sun–Thu — full day (~100)
    state.entries.push({ date: toISO(d), amount });
  }
}

/* ───────────────────────── IFC import ─────────────────────────
 * Parses a Tekla IFC (STEP) model in a background Worker and derives the
 * steel roofing area above a given level:
 *   roof area = Σ(purlin length) × purlin spacing
 * Purlins are IfcBeam named PURLINE; their elevation comes from the placement
 * chain (IfcLocalPlacement → IfcAxis2Placement3D → IfcCartesianPoint) and their
 * length from the shared Length base-quantity. Spacing is the dominant
 * nearest-neighbour distance between purlin insertion points.
 */
const WORKER_SRC = `
self.onmessage = function(e){
  var file=e.data.file, thr=e.data.thr;
  var done=function(text){ try{ self.postMessage({ok:true, res: parse(text, thr)}); }catch(err){ self.postMessage({ok:false, err:String(err)}); } };
  if(file.text){ file.text().then(done).catch(function(err){ self.postMessage({ok:false, err:String(err)}); }); }
  else { try{ var fr=new FileReaderSync(); done(fr.readAsText(file)); }catch(err){ self.postMessage({ok:false, err:String(err)}); } }
};
function relPos(place, LP, AX, P){ var lp=LP[place]; if(!lp||lp.r==null)return null; var loc=AX[lp.r]; if(loc==null)return null; return P[loc]||null; }
function estimateSpacing(pts){
  var n=pts.length; if(n<2)return 1.4; var buckets={};
  for(var i=0;i<n;i++){ var best=1e18; for(var j=0;j<n;j++){ if(i===j)continue; var dx=pts[i][0]-pts[j][0],dy=pts[i][1]-pts[j][1],d=dx*dx+dy*dy; if(d>1&&d<best)best=d; } var nn=Math.sqrt(best); if(nn>=200&&nn<=3000){ var b=Math.round(nn/100)*100; buckets[b]=(buckets[b]||0)+1; } }
  var bestB=1400,bestC=0; for(var k in buckets){ if(buckets[k]>bestC){bestC=buckets[k]; bestB=+k;} } return bestB/1000;
}
function parse(text, thr){
  var P={},AX={},LP={},QLEN={},EQ={},REL=[],beams=[]; var lines=text.split('\\n');
  for(var li=0; li<lines.length; li++){ var line=lines[li]; if(line.charCodeAt(0)!==35)continue;
    var eq=line.indexOf('='); if(eq<0)continue; var id=line.substring(1,eq); var rest=line.substring(eq+1);
    var k0=0; while(k0<rest.length && rest.charCodeAt(k0)===32)k0++; if(k0)rest=rest.substring(k0);
    if(rest.charCodeAt(0)!==73)continue;
    if(rest.lastIndexOf('IFCCARTESIANPOINT((',0)===0){ var o=rest.indexOf('((')+2,c=rest.indexOf(')',o),parts=rest.substring(o,c).split(','); if(parts.length>=3)P[id]=[parseFloat(parts[0]),parseFloat(parts[1]),parseFloat(parts[2])]; }
    else if(rest.lastIndexOf('IFCAXIS2PLACEMENT3D(',0)===0){ var m=rest.match(/#(\\d+)/); if(m)AX[id]=m[1]; }
    else if(rest.lastIndexOf('IFCLOCALPLACEMENT(',0)===0){ var a=rest.substring(rest.indexOf('(')+1).split(','),rel=null; if(a[1]){ var rm=a[1].match(/(\\d+)/); if(rm)rel=rm[1]; } LP[id]={r:rel}; }
    else if(rest.lastIndexOf('IFCBEAM(',0)===0 && rest.indexOf('PURLINE')>=0){ var refs=rest.match(/#(\\d+)/g); if(refs&&refs.length>=2)beams.push({id:id, place:refs[1].substring(1)}); }
    else if(rest.lastIndexOf('IFCQUANTITYLENGTH(',0)===0 && rest.indexOf("'Length'")>=0){ var kk=rest.indexOf(',$,$,'); if(kk>=0)QLEN[id]=parseFloat(rest.substring(kk+5)); }
    else if(rest.lastIndexOf('IFCELEMENTQUANTITY(',0)===0){ EQ[id]=rest; }
    else if(rest.lastIndexOf('IFCRELDEFINESBYPROPERTIES(',0)===0){ REL.push(rest); }
  }
  var EQLEN={}; for(var e in EQ){ var rfs=EQ[e].match(/#(\\d+)/g)||[],t=0; for(var i2=0;i2<rfs.length;i2++){ var rid=rfs[i2].substring(1); if(rid in QLEN)t+=QLEN[rid]; } EQLEN[e]=t; }
  var inPur={}; for(var bi=0;bi<beams.length;bi++)inPur[beams[bi].id]=1;
  var BLEN={};
  for(var r=0;r<REL.length;r++){ var rr=REL[r].match(/#(\\d+)/g)||[]; if(rr.length<2)continue; var relating=rr[rr.length-1].substring(1),L=EQLEN[relating]; if(!L)continue; for(var k2=1;k2<rr.length-1;k2++){ var rid2=rr[k2].substring(1); if(inPur[rid2])BLEN[rid2]=L; } }
  var totalLen=0,count=0,pts=[],zmin=1e18,zmax=-1e18,allLen=0,allCount=0;
  for(var b3=0;b3<beams.length;b3++){ var bb=beams[b3],pos=relPos(bb.place,LP,AX,P); if(!pos)continue; var z=pos[2]; if(z<zmin)zmin=z; if(z>zmax)zmax=z; var len=BLEN[bb.id]||0; allLen+=len; allCount++; if(z>=thr){ totalLen+=len; count++; pts.push([pos[0],pos[1]]); } }
  var spacing=estimateSpacing(pts);
  return { purlins:count, totalLenM:totalLen/1000, spacingM:spacing, areaM2:(totalLen/1000)*spacing, zMinM:zmin/1000, zMaxM:zmax/1000, allPurlins:allCount, allAreaM2:(allLen/1000)*spacing, thrM:thr/1000 };
}
`;

const IFC = { file: null, worker: null };

function getWorker() {
  if (IFC.worker) return IFC.worker;
  const blob = new Blob([WORKER_SRC], { type: "application/javascript" });
  IFC.worker = new Worker(URL.createObjectURL(blob));
  IFC.worker.onmessage = onIfcDone;
  IFC.worker.onerror = (err) => showIfc("err", "Worker error: " + (err.message || err));
  return IFC.worker;
}

function showIfc(kind, html) {
  const el = document.getElementById("ifcResult");
  el.hidden = false;
  el.className = "import__result" + (kind ? " import__result--" + kind : "");
  el.innerHTML = html;
}

function runIfcImport(file) {
  if (!file) return;
  IFC.file = file;
  let level = parseFloat(document.getElementById("roofLevel").value);
  if (!Number.isFinite(level) || level < 0) level = 19;
  const thr = level * 1000;
  showIfc("", `<span class="spin"></span>Analysing model — ${file.name}…`);
  getWorker().postMessage({ file, thr });
}

function onIfcDone(e) {
  if (!e.data.ok) { showIfc("err", "Could not parse this IFC: " + e.data.err); return; }
  const r = e.data.res;
  if (!r.purlins) {
    showIfc("err", `No roof purlins found above ${r.thrM} m. Model spans ${r.zMinM.toFixed(1)}–${r.zMaxM.toFixed(1)} m — try a lower roof level.`);
    return;
  }
  const area = Math.round(r.areaM2);
  state.area = area;
  const nm = IFC.file.name.replace(/\.[^.]+$/, "").trim();
  if (nm) state.name = nm;
  save();
  render();
  showIfc("ok",
    `<strong>${fmtNum(area)} m²</strong> steel roofing derived above ${r.thrM} m
     <span class="import__meta">${r.purlins} purlins · ${fmtNum(r.totalLenM)} m total length · ${r.spacingM.toFixed(1)} m spacing · model ${r.zMinM.toFixed(1)}–${r.zMaxM.toFixed(1)} m</span>`);
}

function wireIfc() {
  const input = document.getElementById("ifcFile");
  const drop = document.getElementById("ifcDrop");
  input.addEventListener("change", (e) => { if (e.target.files[0]) runIfcImport(e.target.files[0]); });
  ["dragover", "dragenter"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("is-drag"); }));
  ["dragleave", "dragend", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("is-drag"); }));
  drop.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) runIfcImport(f); });
  document.getElementById("roofLevel").addEventListener("change", () => { if (IFC.file) runIfcImport(IFC.file); });
}

/* ───────────────────────── boot ───────────────────────── */
(function init() {
  // sensible default for the entry date field
  const todayISO = toISO(new Date());
  const ed = document.getElementById("entryDate");
  if (!ed.value) ed.value = todayISO;
  // first run with nothing stored → show the sample so the page is alive
  if (!state.start && state.entries.length === 0 && !state.area) loadSample();
  wireIfc();
  render();
})();
