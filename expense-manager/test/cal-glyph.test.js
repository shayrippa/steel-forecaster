// בדיקה על דף בסגנון כאל האמיתי: כל תו הוא פריט נפרד (כמו ש-pdf.js מחזיר מדפי כאל),
// כותרת בשתי שורות, פרסומות משמאל, שורות המשך, מט"ח, BIT, עסקאות עתידיות. נתונים בדויים.
const P = require('../src/calParser.js');
const assert = require('assert');
const HEB = /[֐-׿]/;
const CW = 4.5, H = 8;
const items = [];
// תא: טקסט לוגי, מיושר לימין בתוך [x0,x1], כל תו פריט נפרד במיקום הוויזואלי שלו
function glyphs(text, x1, y) {
  const vis = HEB.test(text) ? P.flip(text) : text;
  let x = x1 - vis.length * CW;
  for (const ch of vis) { if (ch !== ' ') items.push({ str: ch, x, y, w: CW * 0.9, h: H }); x += CW; }
}
function chunk(text, x, y) { items.push({ str: text, x, y, w: text.length * CW, h: H }); }
const COL = { date: 560, merchant: 510, branch: 395, detail: 330, shown: 150, amount: 110, charge: 60 };
let y = 40;
chunk('דף חיוב חודשי ל-10/07/26', 380, y); y += 12;
glyphs('מועד החיוב הבא הינו: 10/08/2026', 560, y); y += 12;
glyphs('לכרטיס מסטרקארד המסתיים ב- 1875 ע"ש ישראל ישראלי', 560, y); y += 20;
glyphs('פירוט עסקות שנצברו עד ל-10/07/2026', 560, y); y += 12;
// כותרת בשתי שורות
[['תאריך', 'date'], ['שם בית העסק', 'merchant'], ['ענף', 'branch'], ['פירוט', 'detail'], ['כרטיס', 'shown'], ['סכום', 'amount'], ['סכום', 'charge']]
  .forEach(([t, c]) => glyphs(t, COL[c], y));
chunk('FLY CARD', 2, y);
y += 6;
[['העסקה', 'date'], ['הוצגה', 'shown'], ['עסקה', 'amount'], ['חיוב', 'charge']].forEach(([t, c]) => glyphs(t, COL[c], y));
y += 11;
function row(cells, cont) {
  const [date, merchant, branch, detail, shown, amount, charge] = cells;
  glyphs(date, COL.date, y); glyphs(merchant, COL.merchant, y); glyphs(branch, COL.branch, y);
  if (detail) glyphs(detail, COL.detail, y); if (shown) glyphs(shown, COL.shown, y);
  chunk(amount, COL.amount - amount.length * CW, y); chunk(charge, COL.charge - charge.length * CW, y);
  y += 10;
  (cont || []).forEach(([text, col]) => { glyphs(text, COL[col], y); y += 10; });
  y += 1;
}
row(['10/06/2026', 'aliexpress', 'בתי כלבו', 'לוקסמבורג. מזהה כרטיס אינטרנט 4674', 'לא', '₪ 251.26', '₪ 251.26']);
chunk('קונים אונליין', 5, y - 6); // פרסומת בשורה נפרדת
row(['11/06/2026', 'EHAWAII.GOV MPT', 'מוסדות', 'ארצות הברית. ב-12/06/26 הומר לש"ח', 'לא', '$ 76.88', '₪ 231.28'],
  [['בשער יציג 2.9350. וסכום זה נגבתה', 'detail'], ['עמלת עסקה במט"ח 3.00% בסך 6.77', 'detail']]);
row(['11/06/2026', 'רשת כוורת בצה"ל', 'מזון ומשקא', 'מזהה כרטיס Google Pay 4130', '', '₪ 100.30', '₪ 100.30']);
chunk('טל"ח', 5, y - 11); // פרסומת באותה שורה
row(['16/06/2026', 'סלקום ישראל בע"מ', 'תקשורת', 'הוראת קבע', 'לא', '₪ 265.78', '₪ 265.78'], [['ומח', 'branch']]);
row(['24/06/2026', 'העברה ב BIT בנה"פ', 'פיננסים', 'העברה לשחר ברק', 'לא', '₪ 50.00', '₪ 50.00']);
row(['12/06/2026', 'אל על נתיבי אויר', 'תיירות', 'זיכוי', 'לא', '₪ -1,200.00', '₪ -1,200.00']);
glyphs('1', 300, y); y += 3;
row(['25/06/2026', 'דמי כרטיס', 'שונות', 'עמלה', 'לא', '₪ 19.90', '₪ 19.90']);
chunk('סה"כ לתאריך 10/07/26 ₪ -281.48', 200, y); y += 25;
glyphs('פירוט עסקות לחיוב עתידי', 560, y); y += 10;
[['תאריך', 'date'], ['שם בית העסק', 'merchant'], ['ענף', 'branch'], ['פירוט', 'detail'], ['כרטיס', 'shown'], ['סכום', 'amount'], ['סכום', 'charge']]
  .forEach(([t, c]) => glyphs(t, COL[c], y));
y += 6;
[['העסקה', 'date'], ['הוצגה', 'shown'], ['עסקה', 'amount'], ['חיוב', 'charge']].forEach(([t, c]) => glyphs(t, COL[c], y));
y += 11;
row(['02/07/2026', 'קרן מכבי - חיוב', 'רפואה ובריאות', 'הוראת קבע', 'לא', '₪ 210.74', '₪ 210.74']);

const res = P.parse([{ width: 595, height: 842, items }], 'cal.pdf', { debugCols: !!process.env.DEBUG });
if (process.env.DEBUG) console.log(res.debug.join('\n'), JSON.stringify(res.report, null, 1));
const r = res.records;
const show = x => [x['סוג'], x['תאריך עסקה'], x['בית עסק'], x['ענף'], x['פירוט'], x['כרטיס הוצג'], x['סכום עסקה'], x['מטבע'], x['סכום חיוב ₪']].join(' | ');
r.forEach(x => console.log(show(x)));
assert.strictEqual(res.report.card, '1875', 'card');
assert.strictEqual(res.report.billDate, '10/07/2026', 'bill date');
assert.strictEqual(r.length, 8, 'count');
assert.strictEqual(r[0]['בית עסק'], 'aliexpress');
assert.strictEqual(r[0]['ענף'], 'בתי כלבו');
assert.strictEqual(r[0]['פירוט'], 'לוקסמבורג. מזהה כרטיס אינטרנט 4674');
assert.strictEqual(r[0]['כרטיס הוצג'], 'לא');
assert.strictEqual(r[1]['בית עסק'], 'EHAWAII.GOV MPT');
assert.strictEqual(r[1]['מטבע'], 'USD');
assert.strictEqual(r[1]['סכום עסקה'], '76.88');
assert.ok(r[1]['פירוט'].startsWith('ארצות הברית. ב-12/06/26 הומר לש"ח בשער יציג 2.9350.'), r[1]['פירוט']);
assert.strictEqual(r[2]['בית עסק'], 'רשת כוורת בצה"ל');
assert.strictEqual(r[3]['ענף'], 'תקשורת ומח');
assert.strictEqual(r[4]['בית עסק'], 'העברה ב BIT בנה"פ');
assert.strictEqual(r[4]['פירוט'], 'העברה לשחר ברק');
assert.strictEqual(r[5]['סכום חיוב ₪'], '-1200.00');
assert.strictEqual(r[6]['פירוט'], 'עמלה');
assert.strictEqual(r[7]['סוג'], 'עתידי');
assert.ok(!JSON.stringify(r).match(/טל"ח|קונים|FLY/), 'ads filtered');
assert.ok(res.report.ok, JSON.stringify(res.report.checks));
console.log('✓ Cal glyph-level test passed');
