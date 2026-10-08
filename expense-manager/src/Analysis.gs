/**
 * Analysis.gs – שלב 3: טבלאות סיכום (סיכום חודשי, סיכום שבועי, דפוסים).
 * הגיליונות נבנים מחדש בכל ריצה, כערכים ולא כנוסחאות. הניתוח לפי תאריך העסקה.
 */

/** תפריט: 3. עדכון ניתוח ודשבורד */
function menuAnalysis() {
  buildAnalysisAndDashboard_();
  toast_('הניתוח והדשבורד עודכנו ✓');
  ss_().setActiveSheet(sheet_(SHEETS.DASH));
}

function buildAnalysisAndDashboard_() {
  var data = readTx_().filter(function (r) { return r[C.DATE] instanceof Date; });
  var cats = getCategories_();
  var months = uniqueSorted_(data.map(function (r) { return String(r[C.MONTH]); }));
  buildMonthly_(data, cats, months);
  buildWeekly_(data);
  var recurring = findRecurring_(data, months);
  buildPatterns_(data, recurring);
  buildDashboard_(cats, months, recurring);
}

function uniqueSorted_(arr) {
  var o = {};
  arr.forEach(function (v) { if (v) o[v] = 1; });
  return Object.keys(o).sort();
}

function resetSheet_(name) {
  var sh = ss_().getSheetByName(name) || getOrCreate_(name);
  sh.getCharts().forEach(function (c) { sh.removeChart(c); });
  sh.clearConditionalFormatRules();
  sh.getBandings().forEach(function (b) { b.remove(); });
  var f = sh.getFilter(); if (f) f.remove();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
  sh.clear();
  sh.setRightToLeft(true);
  sh.setHiddenGridlines(true);
  return sh;
}

function colorOf_(r, colors) {
  if (r[C.CAT] === REVIEW_CAT || !r[C.CAT]) return REVIEW_CAT;
  return r[C.COLOR] || colors[r[C.CAT]] || COLOR_NAMES.NONE;
}

/* ---------- סיכום חודשי ---------- */

function buildMonthly_(data, cats, months) {
  var sh = resetSheet_(SHEETS.MONTHLY);
  var sums = {}; // cat → month → sum
  data.forEach(function (r) {
    var cat = r[C.CAT] || REVIEW_CAT, m = String(r[C.MONTH]);
    sums[cat] = sums[cat] || {};
    sums[cat][m] = (sums[cat][m] || 0) + (Number(r[C.ILS]) || 0);
  });
  var last = months.length - 1;
  var header = ['קטגוריה', 'צבע'].concat(months, ['שינוי ₪', 'שינוי %', 'ממוצע 3 חודשים', 'מול הממוצע ₪']);
  var out = [header], styles = [];

  function lineFor(label, color, getter) {
    var vals = months.map(function (m) { return round2_(getter(m)); });
    var cur = last >= 0 ? vals[last] : 0, prev = last >= 1 ? vals[last - 1] : 0;
    var prev3 = vals.slice(Math.max(0, last - 3), Math.max(0, last));
    var avg3 = prev3.length ? round2_(prev3.reduce(function (s, v) { return s + v; }, 0) / prev3.length) : '';
    return [label, color].concat(vals, [round2_(cur - prev), prev ? (cur - prev) / Math.abs(prev) : '',
      avg3, avg3 === '' ? '' : round2_(cur - avg3)]);
  }
  function catGetter(names) {
    return function (m) { return names.reduce(function (s, n) { return s + ((sums[n] || {})[m] || 0); }, 0); };
  }

  var groups = ['ירוק', 'צהוב', 'אדום', COLOR_NAMES.NONE];
  groups.forEach(function (g) {
    var names = cats.filter(function (c) { return c.color === g; }).map(function (c) { return c.name; });
    if (!names.length) return;
    names.forEach(function (n) { out.push(lineFor(n, g, catGetter([n]))); styles.push({ type: 'cat', color: g }); });
    if (g !== COLOR_NAMES.NONE) { out.push(lineFor('סה"כ ' + g, g, catGetter(names))); styles.push({ type: 'sub', color: g }); }
  });
  out.push(lineFor(REVIEW_CAT, '', catGetter([REVIEW_CAT]))); styles.push({ type: 'cat', color: '' });
  var allNames = cats.map(function (c) { return c.name; }).concat([REVIEW_CAT]);
  out.push(lineFor('סה"כ כללי', '', catGetter(allNames))); styles.push({ type: 'total' });

  var w = header.length;
  sh.getRange(1, 1, 1, w).setNumberFormat('@');
  sh.getRange(1, 1, out.length, w).setValues(out).setFontFamily(FONT);
  styleHeader_(sh, header);
  if (months.length) sh.getRange(2, 3, out.length - 1, months.length).setNumberFormat('₪#,##0;[Red]-₪#,##0');
  sh.getRange(2, 3 + months.length, out.length - 1, 1).setNumberFormat('+₪#,##0;-₪#,##0');
  sh.getRange(2, 4 + months.length, out.length - 1, 1).setNumberFormat('+0%;-0%');
  sh.getRange(2, 5 + months.length, out.length - 1, 1).setNumberFormat('₪#,##0');
  sh.getRange(2, 6 + months.length, out.length - 1, 1).setNumberFormat('+₪#,##0;-₪#,##0');
  styles.forEach(function (s, i) {
    var row = sh.getRange(i + 2, 1, 1, w);
    if (s.type === 'sub') row.setFontWeight('bold').setBackground(COLOR_LIGHT[s.color]).setBorder(true, null, null, null, null, null);
    if (s.type === 'total') row.setFontWeight('bold').setBackground('#e8eaed').setBorder(true, null, true, null, null, null);
    if (s.color && COLOR_HEX[s.color]) sh.getRange(i + 2, 2).setFontColor(COLOR_HEX[s.color]).setFontWeight('bold');
  });
  sh.setFrozenColumns(2);
  sh.setColumnWidth(1, 160);
  sh.setColumnWidth(2, 50);
  if (w > 2) sh.setColumnWidths(3, w - 2, 95);
}

/* ---------- סיכום שבועי ---------- */

function buildWeekly_(data) {
  var sh = resetSheet_(SHEETS.WEEKLY);
  var colors = categoryColors_();
  var weeks = {};
  data.forEach(function (r) {
    var k = ymd_(r[C.WEEK] instanceof Date ? r[C.WEEK] : weekStart_(r[C.DATE]));
    var w = weeks[k] = weeks[k] || { d: weekStart_(r[C.DATE]), g: 0, y: 0, r: 0, n: 0, q: 0, cnt: 0 };
    var a = Number(r[C.ILS]) || 0, c = colorOf_(r, colors);
    if (c === 'ירוק') w.g += a; else if (c === 'צהוב') w.y += a; else if (c === 'אדום') w.r += a;
    else if (c === REVIEW_CAT) w.q += a; else w.n += a;
    w.cnt++;
  });
  var header = ['שבוע (מתחיל בא\')', 'עד', 'ירוק', 'צהוב', 'אדום', 'מזומן / אחר', 'לבירור', 'סה"כ', 'מס\' עסקאות'];
  var rows = Object.keys(weeks).sort().map(function (k) {
    var w = weeks[k], end = new Date(w.d.getTime()); end.setDate(end.getDate() + 6);
    return [w.d, end, round2_(w.g), round2_(w.y), round2_(w.r), round2_(w.n), round2_(w.q), round2_(w.g + w.y + w.r + w.n + w.q), w.cnt];
  });
  styleHeader_(sh, header);
  if (rows.length) {
    sh.getRange(2, 1, rows.length, header.length).setValues(rows).setFontFamily(FONT);
    sh.getRange(2, 1, rows.length, 2).setNumberFormat('dd/MM/yy');
    sh.getRange(2, 3, rows.length, 6).setNumberFormat('₪#,##0;[Red]-₪#,##0');
    sh.getRange(2, 8, rows.length, 1).setFontWeight('bold');
  }
  [['ירוק', 3], ['צהוב', 4], ['אדום', 5]].forEach(function (p) {
    sh.getRange(1, p[1]).setBackground(COLOR_HEX[p[0]]);
  });
  sh.setColumnWidths(1, header.length, 100);
}

/* ---------- דפוסים ---------- */

/** חיובים חוזרים: אותו בית עסק ב-3 חודשים לפחות, סכום חודשי דומה (±15%) */
function findRecurring_(data, months) {
  var lastMonth = months[months.length - 1] || '';
  var prevMonth = months[months.length - 2] || '';
  var by = {};
  data.forEach(function (r) {
    var a = Number(r[C.ILS]) || 0;
    if (a <= 0 || r[C.CAT] === CASH_CAT || isTransfer_(r[C.MERCHANT], r[C.BRANCH])) return;
    var k = norm_(r[C.MERCHANT]);
    var o = by[k] = by[k] || { name: String(r[C.MERCHANT]), m: {}, cats: {} };
    o.m[r[C.MONTH]] = (o.m[r[C.MONTH]] || 0) + a;
    o.cats[r[C.CAT]] = (o.cats[r[C.CAT]] || 0) + 1;
  });
  var list = [];
  Object.keys(by).forEach(function (k) {
    var o = by[k], ms = Object.keys(o.m).sort();
    if (ms.length < 3) return;
    var vals = ms.map(function (m) { return o.m[m]; });
    var med = median_(vals);
    var similar = ms.filter(function (m) { return Math.abs(o.m[m] - med) <= 0.15 * med; });
    if (similar.length < 3) return;
    var lastM = ms[ms.length - 1], lastV = o.m[lastM];
    var prevV = ms.length > 1 ? o.m[ms[ms.length - 2]] : lastV;
    var alert = lastV > prevV * 1.01 && lastV - prevV >= 1
      ? '⚠ עליית מחיר: ' + round2_(prevV) + ' → ' + round2_(lastV) : '';
    var cat = Object.keys(o.cats).sort(function (a, b) { return o.cats[b] - o.cats[a]; })[0];
    list.push({ name: o.name, cat: cat, months: ms.length, monthly: round2_(med), last: round2_(lastV),
      yearly: round2_(med * 12), lastSeen: lastM, active: lastM === lastMonth || lastM === prevMonth, alert: alert });
  });
  list.sort(function (a, b) { return b.monthly - a.monthly; });
  return list;
}

function median_(arr) {
  var s = arr.slice().sort(function (a, b) { return a - b; });
  var n = s.length;
  return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0;
}

function buildPatterns_(data, recurring) {
  var sh = resetSheet_(SHEETS.PATTERNS);
  var row = 1;
  var fmtDate = function (d) { return d instanceof Date ? d : ''; };

  // 1. חיובים חוזרים
  row = writeSection_(sh, row, 'חיובים חוזרים ומנויים',
    ['בית עסק', 'קטגוריה', 'מס\' חודשים', 'סכום חודשי (חציון)', 'חיוב אחרון', 'סכום שנתי', 'נראה לאחרונה', 'פעיל?', 'התראה'],
    recurring.map(function (x) { return [x.name, x.cat, x.months, x.monthly, x.last, x.yearly, x.lastSeen, x.active ? 'כן' : '', x.alert]; }),
    { money: [4, 5, 6], text: [7] });

  // 2. 10 בתי העסק המובילים
  var byM = {};
  data.forEach(function (r) {
    var k = norm_(r[C.MERCHANT]);
    var o = byM[k] = byM[k] || { name: r[C.MERCHANT], cat: r[C.CAT], n: 0, s: 0 };
    o.n++; o.s += Number(r[C.ILS]) || 0;
  });
  var top = Object.keys(byM).map(function (k) { return byM[k]; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 10);
  row = writeSection_(sh, row, '10 בתי העסק המובילים (לפי סכום)', ['בית עסק', 'קטגוריה', 'מס\' עסקאות', 'סכום ₪'],
    top.map(function (o) { return [o.name, o.cat, o.n, round2_(o.s)]; }), { money: [4] });

  // 3. עסקאות חריגות: מעל פי 3 מהממוצע בקטגוריה
  var catSt = {};
  data.forEach(function (r) {
    var a = Number(r[C.ILS]) || 0; if (a <= 0) return;
    var s = catSt[r[C.CAT]] = catSt[r[C.CAT]] || { n: 0, s: 0 }; s.n++; s.s += a;
  });
  var outl = [];
  data.forEach(function (r) {
    var a = Number(r[C.ILS]) || 0, s = catSt[r[C.CAT]];
    if (a <= 0 || !s || s.n < 3) return;
    var avg = s.s / s.n;
    if (a > RULES.BIG_MULTIPLIER * avg) outl.push([fmtDate(r[C.DATE]), r[C.MERCHANT], r[C.CAT], round2_(a), round2_(avg), round2_(a / avg)]);
  });
  outl.sort(function (a, b) { return b[3] - a[3]; });
  row = writeSection_(sh, row, 'עסקאות חריגות (מעל פי 3 מהממוצע בקטגוריה)',
    ['תאריך', 'בית עסק', 'קטגוריה', 'סכום ₪', 'ממוצע בקטגוריה', 'פי כמה'], outl.slice(0, 40), { money: [4, 5], date: [1] });

  // 4. חשד לחיוב כפול: אותו בית עסק, אותו סכום, אותו יום
  var dup = {};
  data.forEach(function (r) {
    var a = Number(r[C.ILS]) || 0; if (a <= 0) return;
    var k = ymd_(r[C.DATE]) + '|' + norm_(r[C.MERCHANT]) + '|' + a.toFixed(2);
    var o = dup[k] = dup[k] || { d: r[C.DATE], m: r[C.MERCHANT], a: a, n: 0, cards: {} };
    o.n++; o.cards[r[C.CARD]] = 1;
  });
  var dups = Object.keys(dup).map(function (k) { return dup[k]; }).filter(function (o) { return o.n > 1; })
    .map(function (o) { return [o.d, o.m, round2_(o.a), o.n, Object.keys(o.cards).join(', ')]; });
  row = writeSection_(sh, row, 'חשד לחיוב כפול (אותו בית עסק, אותו סכום, אותו יום)',
    ['תאריך', 'בית עסק', 'סכום ₪', 'מס\' פעמים', 'כרטיסים'], dups, { money: [3], date: [1] });

  // 5. קניות קטנות ותכופות: 5+ עסקאות מתחת ל-₪50 בחודש
  var small = {};
  data.forEach(function (r) {
    var a = Number(r[C.ILS]) || 0; if (a <= 0 || a >= 50) return;
    var k = r[C.MONTH] + '|' + norm_(r[C.MERCHANT]);
    var o = small[k] = small[k] || { m: r[C.MONTH], name: r[C.MERCHANT], n: 0, s: 0 }; o.n++; o.s += a;
  });
  var smalls = Object.keys(small).map(function (k) { return small[k]; }).filter(function (o) { return o.n >= 5; })
    .sort(function (a, b) { return a.m < b.m ? 1 : a.m > b.m ? -1 : b.s - a.s; })
    .map(function (o) { return [o.m, o.name, o.n, round2_(o.s)]; });
  row = writeSection_(sh, row, 'קניות קטנות ותכופות (5 עסקאות לפחות מתחת ל-₪50 בחודש)',
    ['חודש', 'בית עסק', 'מס\' עסקאות', 'סכום ₪'], smalls, { money: [4], text: [1] });

  // 6. עמלות מט"ח ודמי כרטיס – לפי שנה
  var fees = {};
  data.forEach(function (r) {
    var y = String(r[C.DATE].getFullYear()), a = Number(r[C.ILS]) || 0, det = String(r[C.DETAIL] || '');
    var o = fees[y] = fees[y] || { card: 0, fxN: 0, fxS: 0, fxFee: 0 };
    if (/דמי כרטיס/.test(r[C.MERCHANT] + ' ' + det)) o.card += a;
    if (r[C.CUR] && r[C.CUR] !== 'ILS') {
      o.fxN++; o.fxS += a;
      var pct = det.match(/עמל[^\d%]{0,25}([\d.]+)\s*%/);
      var abs = det.match(/עמל[^\d%]{0,25}([\d.,]+)(?!\s*%)/);
      if (pct) { var p = Number(pct[1]) / 100; o.fxFee += a * p / (1 + p); }
      else if (abs) { var v = parseAmount_(abs[1]); if (!isNaN(v) && v < a) o.fxFee += v; }
    }
  });
  row = writeSection_(sh, row, 'עמלות מט"ח ודמי כרטיס (לפי שנה)',
    ['שנה', 'דמי כרטיס ₪', 'עסקאות מט"ח', 'סכום עסקאות מט"ח ₪', 'עמלות המרה ₪ (הערכה מתוך הפירוט)'],
    Object.keys(fees).sort().map(function (y) { var o = fees[y]; return [y, round2_(o.card), o.fxN, round2_(o.fxS), round2_(o.fxFee)]; }),
    { money: [2, 4, 5], text: [1] });

  // 7. ימי השבוע
  var days = HEB_DAYS.map(function () { return { s: 0, n: 0, dates: {} }; });
  var minD = null, maxD = null;
  data.forEach(function (r) {
    var d = r[C.DATE], o = days[d.getDay()];
    o.s += Number(r[C.ILS]) || 0; o.n++; o.dates[ymd_(d)] = 1;
    if (!minD || d < minD) minD = d; if (!maxD || d > maxD) maxD = d;
  });
  var nWeeks = minD ? Math.max(1, Math.round((maxD - minD) / (7 * 864e5))) : 1;
  row = writeSection_(sh, row, 'ימי השבוע', ['יום', 'סכום ₪', 'מס\' עסקאות', 'ממוצע לעסקה', 'ממוצע לשבוע'],
    days.map(function (o, i) { return [HEB_DAYS[i], round2_(o.s), o.n, o.n ? round2_(o.s / o.n) : 0, round2_(o.s / nWeeks)]; }),
    { money: [2, 4, 5] });

  sh.setColumnWidth(1, 120); sh.setColumnWidth(2, 200); sh.setColumnWidths(3, 7, 115); sh.setColumnWidth(9, 240);
}

/** כותב כותרת מקטע + טבלה. מחזיר את השורה הפנויה הבאה */
function writeSection_(sh, row, title, headers, rows, fmt) {
  sh.getRange(row, 1).setValue(title).setFontFamily(FONT).setFontSize(13).setFontWeight('bold').setFontColor('#1a73e8');
  row++;
  sh.getRange(row, 1, 1, headers.length).setValues([headers]).setFontFamily(FONT).setFontWeight('bold')
    .setBackground('#202124').setFontColor('#ffffff').setHorizontalAlignment('center').setWrap(true);
  row++;
  if (!rows.length) {
    sh.getRange(row, 1).setValue('אין').setFontColor('#80868b').setFontFamily(FONT);
    return row + 2;
  }
  var rng = sh.getRange(row, 1, rows.length, headers.length);
  (fmt.text || []).forEach(function (c) { sh.getRange(row, c, rows.length, 1).setNumberFormat('@'); });
  rng.setValues(rows).setFontFamily(FONT);
  (fmt.money || []).forEach(function (c) { sh.getRange(row, c, rows.length, 1).setNumberFormat('₪#,##0.00'); });
  (fmt.date || []).forEach(function (c) { sh.getRange(row, c, rows.length, 1).setNumberFormat('dd/MM/yyyy'); });
  rng.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false);
  return row + rows.length + 2;
}
