// בדיקת קריאת אקסל של ישראכרט – שורות בדויות באותו מבנה של ייצוא "פירוט עסקאות"
const P = require('../src/isracardParser.js');
const assert = require('assert');
const rows = [
  ['פירוט עסקאות', null, 'נובמבר 2026'],
  ['‫FLYCARD‬ - 1234', null, null, null, null, null, null, '₪ 500.40'],
  ['על שם ישראל ישראלי', null, null, null, null, null, null, 'לחיוב ב-10.11'],
  ['עסקאות שטרם נקלטו'],
  ['תאריך רכישה', 'שם בית עסק', 'סכום עסקה', 'מטבע עסקה'],
  ['17.10.26', 'מאפייה', 30, '₪'],
  [null, 'סה"כ עסקאות שטרם נקלטו', 30, '₪'],
  ['עסקאות למועד חיוב'],
  ['תאריך רכישה', 'שם בית עסק', 'סכום עסקה', 'מטבע עסקה', 'סכום חיוב', 'מטבע חיוב', "מס' שובר", 'פירוט נוסף'],
  ['16.10.26', 'סלקום ישראל בע"מ', 59, '₪', 59, '₪', '111', 'הוראת קבע'],
  ['15.10.26', 'NETFLIX.COM    ', 12.5, '$', 46.9, '₪', '222', 'אתר חו"ל\nהוראת קבע'],
  ['12.10.26', 'שופרסל דיל', 394.5, '₪', 394.5, '₪', '333', ''],
  [null, 'סה"כ לחיוב החודש בכרטיס בש"ח', null, null, 500.4, '₪'],
  ['עסקאות שבוצעו וטרם נקלטו - הסבר ארוך'],
];
assert.ok(P.looksLike(rows));
const res = P.parse(rows, 'isra.xlsx');
assert.strictEqual(res.report.card, '1234');
assert.strictEqual(res.report.billDate, '10/11/2026');
assert.ok(res.report.ok, JSON.stringify(res.report.checks));
const reg = res.records.filter(r => r['סוג'] === 'רגיל');
assert.strictEqual(reg.length, 3);
assert.strictEqual(res.records.filter(r => r['סוג'] === 'עתידי').length, 1, 'pending rows marked, not imported');
assert.strictEqual(reg[0]['מזהה'], 'isra-1234-111');
assert.strictEqual(reg[1]['בית עסק'], 'NETFLIX.COM');
assert.strictEqual(reg[1]['מטבע'], 'USD');
assert.strictEqual(reg[1]['סכום עסקה'], '12.50');
assert.strictEqual(reg[1]['סכום חיוב ₪'], '46.90');
assert.strictEqual(reg[1]['פירוט'], 'אתר חו"ל · הוראת קבע');
assert.strictEqual(reg[2]['תאריך עסקה'], '12/10/2026');
assert.ok(!P.looksLike([['תאריך', 'תיאור', 'חובה', 'זכות']]), 'bank file is not Isracard');
console.log('✓ Isracard test passed');
