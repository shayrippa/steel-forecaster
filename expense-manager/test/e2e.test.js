// בדיקה מקצה לקצה של קוד השרת על סביבת דמה
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const { makeEnv } = require('./mock');
const env = makeEnv();
const ctx = vm.createContext(Object.assign({ console }, env));
vm.runInContext(fs.readFileSync(__dirname + '/../dist/Code.gs', 'utf8'), ctx);
const run = s => vm.runInContext(s, ctx);

const H = ['מזהה','כרטיס','מועד חיוב דף','סוג','תאריך עסקה','בית עסק','ענף','פירוט','כרטיס הוצג','סכום עסקה','מטבע','סכום חיוב ₪','תאריך חיוב','קובץ מקור'];
let n = 0; const rows = [];
const add = (date, merchant, branch, amount, o = {}) => rows.push([o.id || 'h' + (++n), o.card || '1875', o.bill || '10/' + date.slice(3), o.type || 'רגיל', date, merchant, branch, o.detail || '', '', o.orig || amount, o.cur || 'ILS', amount, o.billDate || '', 'x.pdf']);
const months = ['01', '02', '03', '04', '05', '06'];
months.forEach((m, i) => {
  add(`03/${m}/2026`, 'שופרסל דיל', 'מזון ומשקא', '412.50');
  add(`10/${m}/2026`, 'שופרסל דיל', 'מזון ומשקא', '388.10');
  add(`05/${m}/2026`, 'SPOTIFY', 'שונות', i === 5 ? '23.90' : '21.90');
  add(`07/${m}/2026`, 'סלקום', 'תקשורת ומח', '59.90', { detail: 'הוראת קבע' });
  add(`12/${m}/2026`, 'פיצה האט', 'מזון ומשקא', '96.00');
  add(`15/${m}/2026`, 'BIT', 'פיננסים', '200.00', { detail: 'העברה לדני כהן' });
  add(`16/${m}/2026`, 'ביטוח ישיר', 'ביטוח', '180.00');
  add(`18/${m}/2026`, 'מספרה של רוני', 'שונות', '80.00');
  add(`20/${m}/2026`, 'דמי כרטיס', '', '19.90');
  for (let k = 0; k < (i === 2 ? 6 : 2); k++) add(`2${k}/${m}/2026`, 'קפה גרג', 'מסעדות', '18.00');
});
add('22/03/2026', 'KSP מחשבים', 'מחשבים', '1500.00');
add('23/03/2026', 'ELAL', 'תיירות', '-1200.00', { detail: 'ביטול עסקה' });
add('24/03/2026', 'לאומי לישראל', 'פיננסים', '463.90', { type: 'מיידי', detail: 'מ.מזומן', billDate: '24/03/2026' });
add('25/03/2026', 'AMAZON', 'שונות', '120.40', { cur: 'USD', orig: '33.00', detail: 'ארה"ב עמלה 3%' });
add('26/03/2026', 'פנגו', 'תיירות', '12.00');
add('27/03/2026', 'פנגו', 'תיירות', '12.00');
add('27/03/2026', 'פנגו', 'תיירות', '12.00'); // כפילות לגיטימית – מזהה שונה
add('28/06/2026', 'עתידי בע"מ', 'שונות', '210.74', { type: 'עתידי' });
const csv = '﻿' + [H].concat(rows).map(r => r.map(v => /[",]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v).join(',')).join('\n');
const fileSum = rows.reduce((s, r) => s + Number(r[11]), 0);

run('runSetup()');
const folders = env.__folders;
const inbox = folders['הוצאות – קבצים חדשים'];
const put = (name, content, mime) => { const f = env.__mkFile(name, content, mime); f.parent = inbox; inbox.files.push(f); return f; };

const f1 = put('transactions.csv', csv, 'text/csv');
let lst = run('listInbox()');
assert.strictEqual(lst.csv.length, 1);
ctx.__id = f1.id;
let res = run('importCsvFile(__id)');
assert.ok(res.ok, JSON.stringify(res));
assert.strictEqual(res.imported, rows.length - 1, 'עתידי לא מיובא');
assert.strictEqual(res.future, 1);
const tx = () => run('readTx_()');
const sheetSum = tx().reduce((s, r) => s + r[11], 0);
assert.ok(Math.abs(sheetSum - (fileSum - 210.74)) < 0.001, 'sum check');
assert.strictEqual(inbox.files.length, 0, 'moved to processed');
console.log('✓ ייבוא:', res.imported, 'שורות, סכום תואם');

// ייבוא חוזר
const f2 = put('again.csv', csv, 'text/csv'); ctx.__id = f2.id;
res = run('importCsvFile(__id)');
assert.strictEqual(res.imported, 0); console.log('✓ ייבוא חוזר: 0 חדשות');

// קובץ לא-CSV
const f3 = put('wrong.csv', 'just,some\n1,2', 'text/csv'); ctx.__id = f3.id;
res = run('importCsvFile(__id)'); assert.ok(!res.ok && /להמיר/.test(res.error)); console.log('✓ קובץ לא תקין: הודעה ברורה');

// סיווג
let c = run('classifyAll_()');
const byMerchant = m => tx().filter(r => r[6] === m);
const cat = m => byMerchant(m)[0][15];
assert.strictEqual(cat('שופרסל דיל'), 'מזון וסופר');
assert.strictEqual(cat('פיצה האט'), 'מסעדות ובילויים');
assert.strictEqual(cat('סלקום'), 'חשבונות');
assert.strictEqual(cat('ביטוח ישיר'), 'ביטוחים');
assert.strictEqual(cat('קפה גרג'), 'מסעדות ובילויים');
assert.strictEqual(cat('לאומי לישראל'), 'מזומן');
assert.strictEqual(cat('דמי כרטיס'), 'חשבונות');
assert.strictEqual(cat('פנגו'), 'תחבורה');
assert.strictEqual(cat('ELAL'), 'חופשות וטיולים');
assert.strictEqual(cat('KSP מחשבים'), 'לבירור'); assert.strictEqual(byMerchant('KSP מחשבים')[0][22], 'קניות');
assert.ok(byMerchant('BIT').every(r => r[15] === 'לבירור'), 'BIT לבירור');
assert.strictEqual(cat('מספרה של רוני'), 'לבירור');
console.log('✓ סיווג אוטומטי. לבירור:', c.pending);

const groups = run('getReviewGroups()');
const bitG = groups.groups.find(g => g.isTransfer);
assert.ok(bitG && bitG.count === 6 && bitG.recipient === 'דני כהן', JSON.stringify(bitG));
const barber = groups.groups.find(g => g.merchant === 'מספרה של רוני');
assert.strictEqual(groups.txCount, c.pending);
console.log('✓ סרגל צד: קבוצות', groups.groups.map(g => g.merchant + '×' + g.count).join(', '));

ctx.__d = { ids: barber.items.map(i => i.id), category: 'קניות', scope: 'always', merchant: barber.merchant, isTransfer: false };
run('applyReviewDecision(__d)');
ctx.__d = { ids: bitG.items.map(i => i.id), category: 'מתנות ואירועים', scope: 'always', merchant: 'BIT', recipient: bitG.recipient, isTransfer: true };
run('applyReviewDecision(__d)');
const ksp = groups.groups.find(g => g.outlier);
ctx.__d = { ids: ksp.items.map(i => i.id), category: ksp.suggest, scope: 'once', merchant: ksp.merchant, isTransfer: false };
run('applyReviewDecision(__d)');
const amz = groups.groups.find(g => g.merchant === 'AMAZON');
ctx.__d = { ids: amz.items.map(i => i.id), category: 'אחר', scope: 'once', merchant: 'AMAZON', isTransfer: false };
run('applyReviewDecision(__d)');
c = run('classifyAll_()');
assert.strictEqual(c.pending, 0, 'all classified'); assert.strictEqual(cat('מספרה של רוני'), 'קניות');
assert.strictEqual(byMerchant('מספרה של רוני')[0][17], 'ידני');

// ייבוא חדש: סיווג "תמיד" חל אוטומטית
const newRows = [['', '1875', '10/08/2026', 'רגיל', '02/07/2026', 'מספרה של רוני', 'שונות', '', '', '90', 'ILS', '90', '', 'jul.pdf'],
  ['', '1875', '10/08/2026', 'רגיל', '03/07/2026', 'BIT', 'פיננסים', 'העברה לדני כהן', '', '50', 'ILS', '50', '', 'jul.pdf'],
  ['', '1875', '10/08/2026', 'רגיל', '03/07/2026', 'BIT', 'פיננסים', 'העברה למשה', '', '70', 'ILS', '70', '', 'jul.pdf']];
ctx.__recs = newRows.map(r => Object.fromEntries(H.map((h, i) => [h, r[i]])));
res = run('importParsedPdf({fileName:"jul.pdf", records:__recs})');
assert.strictEqual(res.imported, 3);
res = run('importParsedPdf({fileName:"jul.pdf", records:__recs})');
assert.strictEqual(res.imported, 0, 'PDF re-import dedupe by key');
c = run('classifyAll_()');
assert.strictEqual(tx().filter(r => r[4 + 2] === 'מספרה של רוני' && r[3] === '2026-07')[0][15], 'קניות');
assert.strictEqual(c.pending, 1, 'only unknown BIT recipient pending');
console.log('✓ "תמיד" חל בייבוא הבא; נמען BIT חדש עובר לבירור');

// ניתוח ודשבורד
run('buildAnalysisAndDashboard_()');
const ms = env.__ss.getSheetByName('סיכום חודשי').data;
const totalRow = ms.find(r => r[0] === 'סה"כ כללי');
const marchTotal = tx().filter(r => r[3] === '2026-03').reduce((s, r) => s + r[11], 0);
const mi = ms[0].indexOf('2026-03');
assert.ok(Math.abs(totalRow[mi] - marchTotal) < 0.01, 'monthly total');
const trav = ms.find(r => r[0] === 'חופשות וטיולים');
assert.strictEqual(trav[mi], -1200, 'credit offsets category');
const pat = env.__ss.getSheetByName('דפוסים').data.map(r => r.join('|')).join('\n');
assert.ok(/SPOTIFY.*עליית מחיר/.test(pat), 'price alert');
assert.ok(/קניות קטנות/.test(pat) && /2026-03\|קפה גרג\|6/.test(pat), 'small frequent');
assert.ok(/פנגו\|12\|2/.test(pat), 'double charge');
const dash = env.__ss.getSheetByName('דשבורד');
assert.strictEqual(dash.charts.length, 3);
assert.strictEqual(dash.getRange('C3').getValue(), '2026-07');
run('buildAnalysisAndDashboard_()');
assert.strictEqual(dash.charts.length, 3, 'charts not duplicated');
console.log('✓ ניתוח ודשבורד נבנו, 3 גרפים, בלי כפילויות');
console.log('נוסחת סה"כ:', dash.formulas['6,1']);
console.log('ALL TESTS PASSED');

// הוצאות קבועות: שכירות מחודש 2026-01, ב-1 לחודש
run('setupFixedSheet_()');
const fx = env.__ss.getSheetByName('הוצאות קבועות');
fx.getRange(2, 1, 1, 6).setValues([['שכירות', 'דיור', 5000, 1, '2026-01', '2026-06']]);
run('buildAnalysisAndDashboard_()');
let rent = tx().filter(r => r[6] === 'שכירות');
assert.strictEqual(rent.length, 6, 'rent months');
assert.ok(rent.every(r => r[15] === 'דיור' && r[17] === 'ידני' && r[11] === 5000));
run('buildAnalysisAndDashboard_()');
assert.strictEqual(tx().filter(r => r[6] === 'שכירות').length, 6, 'no duplicates on rerun');
const ms2 = env.__ss.getSheetByName('סיכום חודשי').data;
assert.ok(ms2.find(r => r[0] === 'דיור')[ms2[0].indexOf('2026-03')] === 5000, 'rent in monthly summary');
console.log('✓ הוצאות קבועות: 6 חודשי שכירות, בלי כפילויות, בסיכום החודשי');

// ייבוא ישראכרט דרך אותו מסלול: מזהה לפי שובר, ייבוא חוזר לא מכפיל
const IP = require('../src/isracardParser.js');
const isr = IP.parse([
  ['פירוט עסקאות', null, 'נובמבר 2026'], ['X - 1234'], ['לחיוב ב-10.11'],
  ['תאריך רכישה', 'שם בית עסק', 'סכום עסקה', 'מטבע עסקה', 'סכום חיוב', 'מטבע חיוב', "מס' שובר"],
  ['16.10.26', 'סלקום ישראל בע"מ', 59, '₪', 59, '₪', '111'],
  [null, 'סה"כ לחיוב החודש', null, null, 59, '₪']], 'isra.xlsx');
ctx.__recs = isr.records;
res = run('importParsedPdf({fileName:"isra.xlsx", records:__recs})');
assert.strictEqual(res.imported, 1);
assert.strictEqual(run('importParsedPdf({fileName:"isra.xlsx", records:__recs})').imported, 0);
run('classifyAll_()');
assert.strictEqual(tx().find(r => r[0] === 'isra-1234-111')[15], 'חשבונות');
console.log('✓ ישראכרט: יובא, סווג (סלקום → חשבונות), בלי כפילויות');
