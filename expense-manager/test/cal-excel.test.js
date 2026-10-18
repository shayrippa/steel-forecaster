// בדיקת קריאת אקסל של כאל ("פירוט עסקאות וזיכויים") – נתונים בדויים באותו מבנה
const P = require('../src/calExcelParser.js');
const I = require('../src/isracardParser.js');
const assert = require('assert');
const rows = [
  ['פירוט עסקאות לישראל ישראלי לחשבון לאומי לישראל 123 לכרטיס ויזה 4321'],
  ['תאריך\r\nעסקה', 'שם בית עסק', 'סכום\r\nבש"ח', 'מועד\r\nחיוב', 'סוג\r\nעסקה', 'מזהה כרטיס\r\nבארנק דיגילטי', 'הנחה', 'הערות'],
  [46014, 'הפועל אוסישקין', 33, 46032, 'הוראת קבע'],
  [45998, 'תן ביס', 7, 46001, 'רגילה'],
  [45998, 'תן ביס', 7, 46001, 'רגילה'],          // שתי עסקאות זהות לגיטימיות
  [45885, 'TERRANOVA', 63.74, 45910, 'רגילה', 7807, null, 'סכום העסקה הוא 15.99 €'],
  [45834, 'AMAZON', -0.07, 45848, 'זיכוי'],
  [],
  ['סה"כ עסקאות בגיליון זה:', 110.67, 'הסכום אינו כולל...'],
];
assert.ok(P.looksLike(rows) && !I.looksLike(rows));
const res = P.parse(rows, 'cal.xlsx');
assert.strictEqual(res.report.card, '4321');
assert.ok(res.report.ok, JSON.stringify(res.report));
const r = res.records;
assert.strictEqual(r.length, 5);
assert.strictEqual(r[0]['תאריך עסקה'], '23/12/2025');
assert.strictEqual(r[0]['מועד חיוב דף'], '10/01/2026');
assert.strictEqual(r[0]['פירוט'], 'הוראת קבע');
assert.strictEqual(r[3]['מטבע'], 'EUR');
assert.strictEqual(r[3]['סכום עסקה'], '15.99');
assert.strictEqual(r[3]['סכום חיוב ₪'], '63.74');
assert.strictEqual(r[4]['סכום חיוב ₪'], '-0.07');
console.log('✓ Cal Excel test passed');
