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

// גרסה (ב): דף חיוב אחד – מועד חיוב וסה"כ מעל הטבלה, עמודת ענף, סכום עסקה ≠ סכום חיוב = מט"ח
const rowsB = [
  ['פירוט עסקאות לחשבון לאומי לישראל 1-2 לכרטיס מאסטרקארד WORLD המסתיים ב-5555'], [],
  ['עסקאות לחיוב ב-10/07/2026: 1,098.79 ₪'],
  ['תאריך\r\nעסקה', 'שם בית עסק', 'סכום\r\nעסקה', 'סכום\r\nחיוב', 'סוג\r\nעסקה', 'ענף', 'הערות'],
  [46212, 'פיצה קוטה', 160, 160, 'רגילה', 'מסעדות'],
  [46190, 'VAL*VOLCANO HOUSE', 94.97, 287.84, 'רגילה', 'מלונאות ואירוח'],
  [46198, 'דמי כרטיס', 19.9, 19.9, 'שרותים', 'ציוד ומשרד'],
  [46191, 'אושר עד בני ברק', 631.05, 631.05, 'רגילה', 'מזון ומשקאות'],
];
const rb = P.parse(rowsB, 'b.xlsx');
assert.ok(rb.report.ok, JSON.stringify(rb.report));
assert.strictEqual(rb.report.card, '5555');
assert.strictEqual(rb.report.billDate, '10/07/2026');
assert.strictEqual(rb.records[0]['ענף'], 'מסעדות');
assert.strictEqual(rb.records[0]['מועד חיוב דף'], '10/07/2026');
assert.strictEqual(rb.records[1]['מטבע'], 'מט"ח');
assert.strictEqual(rb.records[1]['סכום חיוב ₪'], '287.84');
assert.strictEqual(rb.records[2]['פירוט'], '');
console.log('✓ Cal Excel (single statement) test passed');
