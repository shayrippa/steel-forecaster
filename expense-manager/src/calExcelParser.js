/**
 * calExcelParser.js – קריאת קובץ אקסל של כאל ("פירוט עסקאות וזיכויים", ייצוא מהאתר/אפליקציה).
 * כותרת: "פירוט עסקאות ל... לכרטיס ויזה 9173", ואחריה טבלה אחת שיכולה לכסות כמה חודשים:
 * תאריך עסקה | שם בית עסק | סכום בש"ח | מועד חיוב | סוג עסקה | מזהה כרטיס בארנק | הנחה | הערות.
 * לכל שורה מועד חיוב משלה. עסקאות במט"ח: הסכום המקורי והמטבע מופיעים בהערות ("סכום העסקה הוא 15.99 €").
 * בדיקת תקינות: סכום כל השורות מול "סה"כ עסקאות בגיליון זה".
 */
var CalExcelParser = (function () {
  var COLS = [
    ['date', /^תאריך עסקה/], ['merchant', /שם בית (ה)?עסק/], ['amount', /^סכום/], ['bill', /^מועד חיוב/],
    ['type', /^סוג עסקה/], ['wallet', /ארנק/], ['discount', /^הנחה/], ['notes', /^הערות/]
  ];
  var CUR = { '€': 'EUR', '$': 'USD', '£': 'GBP', '₪': 'ILS' };

  function clean(v) { return String(v == null ? '' : v).replace(/[‎‏‪-‮]/g, '').replace(/\s+/g, ' ').trim(); }
  function pad(n) { n = String(Number(n)); return n.length < 2 ? '0' + n : n; }

  function toDate(v) {
    if (v instanceof Date) return pad(v.getDate()) + '/' + pad(v.getMonth() + 1) + '/' + v.getFullYear();
    if (typeof v === 'number' && v > 20000 && v < 80000) {
      var d = new Date(Math.round((v - 25569) * 864e5));
      return pad(d.getUTCDate()) + '/' + pad(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear();
    }
    var m = clean(v).match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2}|\d{4})$/);
    return m ? pad(m[1]) + '/' + pad(m[2]) + '/' + (m[3].length === 2 ? '20' + m[3] : m[3]) : '';
  }

  function toNum(v) {
    if (typeof v === 'number') return v;
    var s = clean(v).replace(/[₪$€£,\s]/g, '');
    if (!s) return NaN;
    var neg = /-/.test(s);
    var n = Number(s.replace(/-/g, ''));
    return isNaN(n) ? NaN : (neg ? -n : n);
  }

  function headerIndex(rows) {
    for (var i = 0; i < Math.min(rows.length, 15); i++) {
      var c = (rows[i] || []).map(clean);
      if (c.some(function (x) { return /^תאריך עסקה/.test(x); }) && c.some(function (x) { return /שם בית/.test(x); }) &&
        c.some(function (x) { return /^מועד חיוב/.test(x); })) return i;
    }
    return -1;
  }

  function looksLike(rows) { return headerIndex(rows || []) >= 0; }

  function parse(rows, fileName) {
    rows = rows || [];
    var all = rows.map(function (r) { return (r || []).map(clean).join(' | '); });
    var hi = headerIndex(rows);
    var card = '', m;
    for (var i = 0; i < Math.max(hi, 0) && !card; i++) {
      if ((m = all[i].match(/כרטיס[^\d|]*(\d{4})(?!\d)/))) card = m[1];
    }
    var cols = {};
    if (hi >= 0) rows[hi].map(clean).forEach(function (c, ci) {
      COLS.forEach(function (k) { if (k[1].test(c) && !(k[0] in cols)) cols[k[0]] = ci; });
    });

    var txs = [], totals = [];
    for (var r = hi + 1; hi >= 0 && r < rows.length; r++) {
      var row = rows[r] || [], line = all[r];
      if (/סה"כ/.test(line)) {
        totals = totals.concat(row.map(toNum).filter(function (n) { return !isNaN(n) && n !== 0; }));
        continue;
      }
      var date = toDate(row[cols.date]);
      if (!date) continue;
      var ils = toNum(row[cols.amount]);
      var type = clean(row[cols.type]);
      var notes = 'notes' in cols ? clean(row[cols.notes]) : '';
      var orig = ils, cur = 'ILS';
      if ((m = notes.match(/סכום העסקה הוא\s*([\d.,]+)\s*(\S+)/))) {
        orig = toNum(m[1]);
        cur = CUR[m[2]] || m[2].toUpperCase();
      }
      var detail = [];
      if (type && type !== 'רגילה') detail.push(type);
      if (notes) detail.push(notes);
      if ('discount' in cols && toNum(row[cols.discount])) detail.push('הנחה ' + toNum(row[cols.discount]));
      if ('wallet' in cols && clean(row[cols.wallet])) detail.push('מזהה כרטיס בארנק ' + clean(row[cols.wallet]));
      txs.push({
        date: date, merchant: clean(row[cols.merchant]), ils: ils, orig: orig, cur: cur,
        bill: toDate(row[cols.bill]), mode: /מיידי/.test(type) ? 'מיידי' : 'רגיל', detail: detail.join(' · ')
      });
    }

    var good = txs.filter(function (t) { return !isNaN(t.ils); });
    var sum = Math.round(good.reduce(function (s, t) { return s + t.ils; }, 0) * 100) / 100;
    var okSum = totals.some(function (a) { return Math.abs(Math.abs(a) - Math.abs(sum)) < 0.015; });
    var bills = {};
    good.forEach(function (t) { bills[t.bill] = 1; });
    var billList = Object.keys(bills).sort(function (a, b) { return a.split('/').reverse().join('') < b.split('/').reverse().join('') ? -1 : 1; });

    var records = good.map(function (t) {
      return {
        'מזהה': '', 'כרטיס': card, 'מועד חיוב דף': t.bill, 'סוג': t.mode, 'תאריך עסקה': t.date,
        'בית עסק': t.merchant, 'ענף': '', 'פירוט': t.detail, 'כרטיס הוצג': '',
        'סכום עסקה': isNaN(t.orig) ? '' : t.orig.toFixed(2), 'מטבע': t.cur, 'סכום חיוב ₪': t.ils.toFixed(2),
        'תאריך חיוב': '', 'קובץ מקור': fileName
      };
    });
    return {
      records: records,
      report: {
        file: fileName, issuer: 'כאל (אקסל)', card: card,
        billDate: billList.length === 1 ? billList[0] : billList.length ? billList.length + ' מועדי חיוב' : '',
        count: good.length, bad: txs.length - good.length,
        checks: good.length ? [{ mode: 'רגיל', sum: sum, ok: okSum }] : [],
        totals: totals.map(String), ok: good.length > 0 && good.length === txs.length && okSum, headerFound: hi >= 0
      },
      debug: all
    };
  }

  return { parse: parse, looksLike: looksLike };
})();

if (typeof module !== 'undefined') module.exports = CalExcelParser;
