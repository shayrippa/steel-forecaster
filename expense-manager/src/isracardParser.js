/**
 * isracardParser.js – קריאת קובץ אקסל של ישראכרט ("פירוט עסקאות", ייצוא מהאתר/אפליקציה).
 * מקבל שורות (מערך של מערכים, מ-SheetJS) ומחזיר עסקאות באותו פורמט CSV כמו כאל + דוח בדיקת סכומים.
 * מבנה הקובץ: כותרת עם שם הכרטיס ("FLYCARD - 7973") ו"לחיוב ב-10.11", ואחריה טבלאות:
 *  "עסקאות שטרם נקלטו" – עוד לא סופיות, לא מיובאות (יופיעו בחודש הבא);
 *  "עסקאות למועד חיוב" – העסקאות של החודש, עם "סה"כ לחיוב החודש" לבדיקה.
 * מזהה העסקה מבוסס על מספר השובר, ולכן ייבוא חוזר (גם של קובץ מעודכן של אותו חודש) לא מכפיל.
 */
var IsracardParser = (function () {
  var MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  var COLS = [
    ['date', /תאריך (רכישה|עסקה)/], ['merchant', /שם בית (ה)?עסק/], ['amount', /^סכום עסקה/], ['cur', /^מטבע עסקה/],
    ['charge', /^סכום חיוב/], ['chargeCur', /^מטבע חיוב/], ['voucher', /שובר/], ['detail', /פירוט/], ['branch', /^ענף/]
  ];

  function clean(v) { return String(v == null ? '' : v).replace(/[‎‏‪-‮]/g, '').trim(); }
  function pad(n) { n = String(Number(n)); return n.length < 2 ? '0' + n : n; }

  /** "17.10.26" / "17/10/2026" / מספר סידורי של אקסל / Date → "DD/MM/YYYY" */
  function toDate(v) {
    if (v instanceof Date) return pad(v.getDate()) + '/' + pad(v.getMonth() + 1) + '/' + v.getFullYear();
    if (typeof v === 'number' && v > 20000 && v < 80000) {
      var d = new Date(Math.round((v - 25569) * 864e5));
      return pad(d.getUTCDate()) + '/' + pad(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear();
    }
    var m = clean(v).match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2}|\d{4})$/);
    if (!m) return '';
    return pad(m[1]) + '/' + pad(m[2]) + '/' + (m[3].length === 2 ? '20' + m[3] : m[3]);
  }

  function toNum(v) {
    if (typeof v === 'number') return v;
    var s = clean(v).replace(/[₪$€£,\s]/g, '');
    if (!s) return NaN;
    var neg = /-$/.test(s) || /^-/.test(s);
    var n = Number(s.replace(/-/g, ''));
    return isNaN(n) ? NaN : (neg ? -n : n);
  }

  function currency(v) {
    var s = clean(v);
    if (/\$|USD|דולר/.test(s)) return 'USD';
    if (/€|EUR|אירו|יורו/.test(s)) return 'EUR';
    if (/£|GBP/.test(s)) return 'GBP';
    return 'ILS';
  }

  /** זיהוי: האם זה קובץ ישראכרט (טבלה עם "תאריך רכישה" + "שם בית עסק") */
  function looksLike(rows) {
    return rows.some(function (r) {
      var t = (r || []).map(clean).join('|');
      return /תאריך רכישה/.test(t) && /שם בית עסק/.test(t);
    });
  }

  function parse(rows, fileName) {
    rows = rows || [];
    var all = rows.map(function (r) { return (r || []).map(clean).join(' | '); });
    var text = all.join('\n');

    var card = '', m;
    for (var i = 0; i < Math.min(rows.length, 10) && !card; i++) {
      (rows[i] || []).forEach(function (c) { var a = clean(c).match(/[-–]\s*(\d{4})$/); if (a && !card) card = a[1]; });
    }
    var year = '', titleMonth = 0;
    if ((m = text.match(new RegExp('(' + MONTHS.join('|') + ')\\s+(\\d{4})')))) { year = m[2]; titleMonth = MONTHS.indexOf(m[1]) + 1; }
    var bill = '';
    if ((m = text.match(/לחיוב ב-?\s*(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{2,4}))?/))) {
      var by = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : (year || String(new Date().getFullYear()));
      if (!m[3] && titleMonth && Number(m[2]) < titleMonth - 6) by = String(Number(by) + 1);
      bill = pad(m[1]) + '/' + pad(m[2]) + '/' + by;
    }

    var mode = 'רגיל', cols = null, txs = [], totals = [], headers = 0;
    rows.forEach(function (r) {
      r = r || [];
      var cells = r.map(clean), line = cells.join(' ');
      if (!line.trim()) return;
      if (/טרם נקלטו/.test(cells[0]) && !/סה"כ/.test(line)) { mode = 'עתידי'; cols = null; return; }
      if (/^עסקאות/.test(cells[0]) && cells.slice(1).every(function (c) { return !c; })) { mode = 'רגיל'; cols = null; return; }
      if (cells.some(function (c) { return /תאריך (רכישה|עסקה)/.test(c); }) && cells.some(function (c) { return /שם בית/.test(c); })) {
        cols = {};
        cells.forEach(function (c, ci) {
          COLS.forEach(function (k) { if (k[1].test(c) && !(k[0] in cols)) cols[k[0]] = ci; });
        });
        headers++;
        return;
      }
      if (/סה"כ/.test(line)) {
        var nums = r.map(toNum).filter(function (n) { return !isNaN(n) && n !== 0; });
        totals.push({ text: line, amounts: nums.map(function (n) { return Math.round(n * 100) / 100; }), mode: mode });
        return;
      }
      if (!cols) return;
      var date = toDate(r[cols.date]);
      if (!date) return;
      var amount = toNum(r[cols.amount]);
      var charge = 'charge' in cols ? toNum(r[cols.charge]) : NaN;
      var cur = currency(r[cols.cur]);
      if (isNaN(charge) && cur === 'ILS') charge = amount;
      txs.push({
        mode: mode, date: date, merchant: cells[cols.merchant] || '', amount: amount, cur: cur, charge: charge,
        voucher: 'voucher' in cols ? cells[cols.voucher] : '',
        detail: 'detail' in cols ? cells[cols.detail].replace(/\s*\n\s*/g, ' · ') : '',
        branch: 'branch' in cols ? cells[cols.branch] : ''
      });
    });

    var good = txs.filter(function (t) { return !isNaN(t.charge); });
    var groups = {};
    good.forEach(function (t) { groups[t.mode] = Math.round(((groups[t.mode] || 0) + t.charge) * 100) / 100; });
    var amounts = [];
    totals.forEach(function (t) { amounts = amounts.concat(t.amounts); });
    var checks = Object.keys(groups).map(function (k) {
      return { mode: k, sum: groups[k], ok: amounts.some(function (a) { return Math.abs(Math.abs(a) - Math.abs(groups[k])) < 0.015; }) };
    });
    var ok = good.some(function (t) { return t.mode !== 'עתידי'; }) && good.length === txs.length &&
      checks.every(function (c) { return c.ok || c.mode === 'עתידי'; });

    var records = good.map(function (t) {
      return {
        'מזהה': t.voucher && card ? 'isra-' + card + '-' + t.voucher : '', 'כרטיס': card, 'מועד חיוב דף': bill,
        'סוג': t.mode, 'תאריך עסקה': t.date, 'בית עסק': t.merchant.replace(/\s+/g, ' '), 'ענף': t.branch,
        'פירוט': t.detail, 'כרטיס הוצג': '', 'סכום עסקה': isNaN(t.amount) ? '' : t.amount.toFixed(2),
        'מטבע': t.cur, 'סכום חיוב ₪': t.charge.toFixed(2), 'תאריך חיוב': '', 'קובץ מקור': fileName
      };
    });
    return {
      records: records,
      report: { file: fileName, issuer: 'ישראכרט', card: card, billDate: bill, count: good.length, bad: txs.length - good.length,
        checks: checks, totals: totals.map(function (t) { return t.text; }), ok: ok, headerFound: headers > 0 },
      debug: all
    };
  }

  return { parse: parse, looksLike: looksLike, toDate: toDate };
})();

if (typeof module !== 'undefined') module.exports = IsracardParser;
