/**
 * calParser.js – פענוח דף פירוט PDF של כאל בדפדפן (גרסת JavaScript של cal_pdf_to_csv.py).
 * מקבל מילים עם מיקום (מ-pdf.js) ומחזיר עסקאות בפורמט ה-CSV של הממיר + דוח בדיקת סכומים.
 * עברית ב-PDF שמורה לפעמים בסדר ויזואלי הפוך – מזוהה אוטומטית לפי אותיות סופיות (ך ם ן ף ץ).
 * העמודות מזוהות לפי מיקום מילות הכותרת. שורה שמתחילה בתאריך = עסקה חדשה;
 * שורה בלי תאריך עד 12 נקודות מתחתיה = המשך שלה. עמודת הפרסומות משמאל והכותרת התחתונה מסוננות.
 *
 * pages: [{ width, height, items: [{ str, x, y, w, h }] }]   (y נמדד מלמעלה)
 */
var CalParser = (function () {
  var HEB = /[֐-׿]/;
  var FINALS = 'ךםןףץ';
  var DATE_RE = /^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2}|\d{4})$/;
  var AMOUNT_RE = /-?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})|-?\d+(?:\.\d{1,2})?/g;
  var LINE_TOL = 2.5;      // נקודות – אותה שורה
  var CONT_GAP = 12;       // נקודות – שורת המשך
  var KEYS = ['תאריך', 'שם', 'ענף', 'פירוט', 'כרטיס', 'סכום'];

  function cleanQuotes(s) { return String(s).replace(/[״]/g, '"').replace(/[׳]/g, "'"); }

  /** האם הטקסט במסמך הפוך (סדר ויזואלי)? לפי מיקום האותיות הסופיות */
  function detectReversed(pages) {
    var start = 0, end = 0;
    pages.forEach(function (p) {
      p.items.forEach(function (it) {
        String(it.str).split(/\s+/).forEach(function (w) {
          w = w.replace(/[^א-ת]/g, '');
          if (w.length < 2) return;
          if (FINALS.indexOf(w[0]) >= 0) start++;
          if (FINALS.indexOf(w[w.length - 1]) >= 0) end++;
        });
      });
    });
    return start > end;
  }

  /** היפוך סדר ויזואלי ↔ לוגי: הופכים הכל, ואז מחזירים רצפים של ספרות/לטינית לסדרם */
  function flip(s) {
    if (!HEB.test(s)) return s;
    var r = s.split('').reverse().join('');
    r = r.replace(/[A-Za-z0-9$€£₪%][A-Za-z0-9.,:\/%\-+*'&$€£₪]*[A-Za-z0-9$€£₪%]|[A-Za-z0-9]/g, function (m) {
      return m.split('').reverse().join('');
    });
    return r.replace(/[()[\]]/g, function (c) { return { '(': ')', ')': '(', '[': ']', ']': '[' }[c]; });
  }

  function groupLines(items) {
    var sorted = items.slice().sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    var lines = [];
    sorted.forEach(function (it) {
      var last = lines[lines.length - 1];
      if (last && Math.abs(it.y - last.y) <= LINE_TOL) { last.items.push(it); }
      else lines.push({ y: it.y, items: [it] });
    });
    lines.forEach(function (l) {
      l.items.sort(function (a, b) { return b.x - a.x; });
      l.text = joinCell(l.items);
    });
    return lines;
  }

  /** חיבור פריטים לטקסט: עברית – מימין לשמאל; בלי עברית – משמאל לימין */
  function joinCell(items) {
    if (!items.length) return '';
    var heb = items.some(function (i) { return HEB.test(i.str); });
    var s = items.slice().sort(function (a, b) { return heb ? b.x - a.x : a.x - b.x; });
    return s.map(function (i) { return String(i.str).trim(); }).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }

  function isHeaderLine(text) {
    return text.indexOf('תאריך') >= 0 && text.indexOf('סכום') >= 0 &&
      (text.indexOf('שם') >= 0 || text.indexOf('בית עסק') >= 0 || text.indexOf('ענף') >= 0);
  }

  /** כותרת טבלה שעשויה להתפרס על כמה שורות: מחזיר את האינדקס של השורה האחרונה בכותרת, או -1 */
  var HEADER_SPAN = 20;
  function headerEnd(lines, li) {
    var t = lines[li].text;
    if (t.indexOf('תאריך') < 0 && t.indexOf('סכום') < 0) return -1;
    if (DATE_RE.test(t.split(' ')[0]) || /\d+\.\d\d/.test(t)) return -1;
    var all = t, end = li;
    for (var j = li + 1; j < lines.length && lines[j].y - lines[li].y <= HEADER_SPAN; j++) {
      if (/\d{1,2}\/\d{1,2}\/\d{2}/.test(lines[j].text)) break;
      all += ' ' + lines[j].text; end = j;
    }
    return isHeaderLine(all) ? end : -1;
  }

  /** בניית עמודות מאזור הכותרת */
  function buildColumns(lines, hi, hEnd, pageWidth) {
    var region = [];
    for (var li = hi; li <= hEnd; li++) region = region.concat(lines[li].items);
    // אשכולות לפי חפיפה אופקית
    region.sort(function (a, b) { return a.x - b.x; });
    var clusters = [];
    region.forEach(function (it) {
      var x0 = it.x, x1 = it.x + it.w;
      var c = null;
      for (var i = 0; i < clusters.length; i++) {
        if (x0 <= clusters[i].x1 + 3 && x1 >= clusters[i].x0 - 3) { c = clusters[i]; break; }
      }
      if (!c) { c = { x0: x0, x1: x1, items: [] }; clusters.push(c); }
      c.items.push(it); c.x0 = Math.min(c.x0, x0); c.x1 = Math.max(c.x1, x1);
    });
    // מיזוג אשכולות שנוגעים זה בזה אחרי ההרחבה
    var merged = true;
    while (merged) {
      merged = false;
      for (var a = 0; a < clusters.length && !merged; a++) {
        for (var b = a + 1; b < clusters.length && !merged; b++) {
          if (clusters[a].x0 <= clusters[b].x1 + 3 && clusters[a].x1 >= clusters[b].x0 - 3) {
            clusters[a].items = clusters[a].items.concat(clusters[b].items);
            clusters[a].x0 = Math.min(clusters[a].x0, clusters[b].x0);
            clusters[a].x1 = Math.max(clusters[a].x1, clusters[b].x1);
            clusters.splice(b, 1); merged = true;
          }
        }
      }
    }
    var cols = [];
    clusters.forEach(function (c) {
      var byLine = groupLines(c.items).map(function (l) { return l.text; });
      var t = cleanQuotes(byLine.join(' '));
      var key = null;
      if (t.indexOf('סכום') >= 0) key = t.indexOf('חיוב') >= 0 ? 'charge' : 'amount';
      else if (t.indexOf('תאריך') >= 0) key = t.indexOf('חיוב') >= 0 ? 'billDate' : 'date';
      else if (t.indexOf('שם') >= 0 || t.indexOf('בית עסק') >= 0) key = 'merchant';
      else if (t.indexOf('ענף') >= 0) key = 'branch';
      else if (t.indexOf('פירוט') >= 0 || t.indexOf('הערות') >= 0) key = 'detail';
      else if (t.indexOf('כרטיס') >= 0) key = 'shown';
      if (key) cols.push({ key: key, x0: c.x0, x1: c.x1, cx: (c.x0 + c.x1) / 2, title: t });
    });
    // שתי עמודות "סכום" בלי המילה "חיוב": השמאלית היא סכום החיוב
    var amounts = cols.filter(function (c) { return c.key === 'amount'; });
    if (amounts.length > 1 && !cols.some(function (c) { return c.key === 'charge'; })) {
      amounts.sort(function (a, b) { return a.cx - b.cx; })[0].key = 'charge';
    }
    if (!cols.some(function (c) { return c.key === 'charge'; })) {
      var am = cols.filter(function (c) { return c.key === 'amount'; });
      if (am.length === 1) am[0].key = 'charge';
    }
    cols.sort(function (a, b) { return a.cx - b.cx; });
    for (var i = 0; i < cols.length; i++) {
      cols[i].b0 = i === 0 ? cols[i].x0 - 40 : (cols[i - 1].cx + cols[i].cx) / 2;
      cols[i].b1 = i === cols.length - 1 ? Math.max(cols[i].x1 + 40, pageWidth || 0) : (cols[i].cx + cols[i + 1].cx) / 2;
      // עמודות מספרים צרות: גבול לפי הכותרת עצמה + מרווח
    }
    return cols;
  }

  function assign(items, cols) {
    var cells = {};
    cols.forEach(function (c) { cells[c.key] = []; });
    items.forEach(function (it) {
      var x0 = it.x, x1 = it.x + it.w, best = null, bestOv = 0;
      cols.forEach(function (c) {
        var ov = Math.min(x1, c.b1) - Math.max(x0, c.b0);
        if (ov > bestOv) { bestOv = ov; best = c; }
      });
      if (best) cells[best.key].push(it);
    });
    var out = {};
    Object.keys(cells).forEach(function (k) { out[k] = cleanQuotes(joinCell(cells[k])); });
    return out;
  }

  function lineHeight(items) {
    var h = items.map(function (i) { return i.h || 0; }).sort(function (a, b) { return a - b; });
    return h.length ? h[Math.floor(h.length / 2)] : 0;
  }

  function normDate(s) {
    var m = String(s || '').trim().match(DATE_RE);
    if (!m) return '';
    var y = m[3].length === 2 ? '20' + m[3] : m[3];
    return pad(m[1]) + '/' + pad(m[2]) + '/' + y;
  }
  function pad(n) { n = String(Number(n)); return n.length < 2 ? '0' + n : n; }

  function parseAmount(s) {
    s = String(s || '').replace(/[₪$€£\s]/g, '').replace(/,/g, '');
    if (!s) return NaN;
    var neg = false;
    if (/-$/.test(s)) { neg = true; s = s.slice(0, -1); }
    if (/^-/.test(s)) { neg = !neg; s = s.slice(1); }
    var m = s.match(/^\d+(?:\.\d+)?/);
    if (!m) return NaN;
    var n = Number(m[0]);
    return neg ? -n : n;
  }

  function currencyOf(s) {
    s = String(s || '');
    if (/\$|USD|דולר/.test(s)) return 'USD';
    if (/€|EUR|\bEU\b|אירו|יורו/.test(s)) return 'EUR';
    if (/£|GBP/.test(s)) return 'GBP';
    return 'ILS';
  }

  function amountsIn(text) {
    var out = [];
    String(text).replace(/(\d)\s+(?=[,.]\d)/g, '$1').replace(AMOUNT_RE, function (m) {
      var n = parseAmount(m);
      if (!isNaN(n) && /[.,]/.test(m)) out.push(Math.round(n * 100) / 100);
      return m;
    });
    return out;
  }

  function findCard(text) {
    var cands = {};
    var res = [
      /(?:המסתיים|מסתיים|בספרות|שמספרו|לכרטיס|כרטיס)[^\d\n]{0,30}(\d{4})(?!\d)/g,
      /[*xX•·]{2,}[\s\-]*(\d{4})(?!\d)/g,
      /(?<!\d)(\d{4})[\s\-]*[*xX•·]{2,}/g
    ];
    res.forEach(function (re) {
      var m;
      while ((m = re.exec(text))) { cands[m[1]] = (cands[m[1]] || 0) + 1; }
    });
    var best = Object.keys(cands).filter(function (k) { return !/^(19|20)\d\d$/.test(k) || cands[k] > 1; })
      .sort(function (a, b) { return cands[b] - cands[a]; })[0];
    return best || '';
  }

  function findBillDate(text) {
    var res = [
      /(?:מועד|תאריך)\s*(?:ה)?חיוב[^\d\n]{0,25}(\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4})/,
      /לחיוב\s*(?:ב|ביום|בתאריך)?[^\d\n]{0,15}(\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4})/,
      /(\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4})[^\d\n]{0,15}(?:מועד|תאריך)\s*(?:ה)?חיוב/
    ];
    for (var i = 0; i < res.length; i++) {
      var m = text.match(res[i]);
      if (m) return normDate(m[1].replace(/\./g, '/'));
    }
    return '';
  }

  /** הפענוח הראשי */
  function parse(pages, fileName, opts) {
    opts = opts || {};
    var reversed = opts.reversed !== undefined ? opts.reversed : detectReversed(pages);
    var txs = [], totals = [], debug = [], fullText = [], headers = 0;
    var mode = 'רגיל';

    pages.forEach(function (page, pi) {
      var items = page.items.filter(function (it) { return String(it.str).trim() !== ''; }).map(function (it) {
        return { str: reversed ? flip(String(it.str)) : String(it.str), x: it.x, y: it.y, w: it.w || 0, h: it.h || 0 };
      });
      var lines = groupLines(items);
      lines.forEach(function (l) { l.text = cleanQuotes(l.text); fullText.push(l.text); });
      var cols = null, last = null, footerY = page.height ? page.height * 0.95 : Infinity, skipTo = -1;

      lines.forEach(function (l, li) {
        debug.push('[' + (pi + 1) + ':' + Math.round(l.y) + '] ' + l.text);
        if (li <= skipTo) return;
        var t = l.text;
        var he = headerEnd(lines, li);
        if (he >= 0) { cols = buildColumns(lines, li, he, page.width); headers++; skipTo = he; last = null; return; }
        if (/עתידי/.test(t) && !/^\d/.test(t)) { mode = 'עתידי'; last = null; }
        else if (/מיידי|חויבו מיד/.test(t) && !DATE_RE.test(t.split(' ')[0])) { mode = 'מיידי'; last = null; }
        if (/סה"כ|סך הכל|סך הכול/.test(t)) {
          totals.push({ text: t, amounts: amountsIn(t), mode: mode, page: pi + 1 });
          last = null; return;
        }
        if (!cols || l.y > footerY) return;
        var minX = Math.min.apply(null, cols.map(function (c) { return c.x0; })) - 40;
        var its = l.items.filter(function (it) { return it.x + it.w >= minX; });
        if (!its.length) return;
        var cells = assign(its, cols);
        var date = normDate(cells.date);
        if (date) {
          var amtCell = cells.amount || '', chCell = cells.charge || '';
          var charge = parseAmount(chCell), amount = parseAmount(amtCell);
          if (isNaN(charge) && !isNaN(amount) && currencyOf(amtCell) === 'ILS') charge = amount;
          if (isNaN(amount)) amount = charge;
          last = {
            mode: mode, date: date, merchant: cells.merchant || '', branch: cells.branch || '', detail: cells.detail || '',
            shown: cells.shown || '', amount: amount, currency: currencyOf(amtCell + ' ' + (cells.detail || '')),
            charge: charge, billDate: normDate(cells.billDate), y: l.y, page: pi
          };
          if (last.currency !== 'ILS' && currencyOf(amtCell) === 'ILS') last.currency = 'ILS';
          txs.push(last);
        } else if (last && last.page === pi && l.y - last.y <= Math.max(CONT_GAP, 1.6 * lineHeight(its))) {
          if (cells.merchant) last.merchant = (last.merchant + ' ' + cells.merchant).trim();
          if (cells.detail) last.detail = (last.detail + ' ' + cells.detail).trim();
          if (cells.branch) last.branch = (last.branch + ' ' + cells.branch).trim();
          if (isNaN(last.charge) && cells.charge) last.charge = parseAmount(cells.charge);
          last.y = l.y;
        } else {
          last = null;
        }
      });
    });

    var text = fullText.join('\n');
    var card = opts.card || findCard(text);
    var bill = opts.billDate || findBillDate(text);
    var good = txs.filter(function (t) { return !isNaN(t.charge); });
    var bad = txs.length - good.length;

    // בדיקת סכומים מול שורות ה"סה"כ"
    var groups = {};
    good.forEach(function (t) { groups[t.mode] = Math.round(((groups[t.mode] || 0) + t.charge) * 100) / 100; });
    var allAmounts = [];
    totals.forEach(function (t) { allAmounts = allAmounts.concat(t.amounts); });
    var checks = Object.keys(groups).map(function (m) {
      var s = groups[m];
      var match = allAmounts.some(function (a) { return Math.abs(Math.abs(a) - Math.abs(s)) < 0.015; });
      return { mode: m, sum: s, ok: match };
    });
    var ok = good.length > 0 && bad === 0 && checks.every(function (c) { return c.ok; });

    var records = good.map(function (t) {
      return {
        'מזהה': '', 'כרטיס': card, 'מועד חיוב דף': bill, 'סוג': t.mode, 'תאריך עסקה': t.date,
        'בית עסק': t.merchant, 'ענף': t.branch, 'פירוט': t.detail, 'כרטיס הוצג': t.shown,
        'סכום עסקה': isNaN(t.amount) ? '' : t.amount.toFixed(2), 'מטבע': t.currency,
        'סכום חיוב ₪': t.charge.toFixed(2), 'תאריך חיוב': t.mode === 'מיידי' ? (t.billDate || '') : '',
        'קובץ מקור': fileName
      };
    });
    return {
      records: records,
      report: {
        file: fileName, card: card, billDate: bill, count: good.length, bad: bad, reversed: reversed,
        checks: checks, totals: totals.map(function (t) { return t.text; }), ok: ok,
        headerFound: headers > 0
      },
      debug: debug
    };
  }

  return { parse: parse, flip: flip, detectReversed: detectReversed, findCard: findCard, findBillDate: findBillDate, parseAmount: parseAmount };
})();

if (typeof module !== 'undefined') module.exports = CalParser;
