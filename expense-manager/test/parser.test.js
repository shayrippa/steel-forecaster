// בדיקת הפענוח על דף סינתטי בסגנון כאל (בשני כיווני עברית)
const P = require('../src/calParser.js');
const assert = require('assert');
const rev = s => P.flip(s); // הופך לוגי→ויזואלי (הפעולה סימטרית)

function page(visual) {
  const items = [];
  const add = (str, x, y, w) => items.push({ str: visual ? rev(str) : str, x, y, w: w || str.length * 4.5, h: 8 });
  add('פירוט חיובים לכרטיס ויזה המסתיים ב-1875', 250, 40, 200);
  add('מועד חיוב: 10/02/26', 380, 55, 100);
  // header (two lines)
  add('תאריך', 505, 100, 28); add('שם בית העסק', 400, 100, 60); add('ענף', 320, 100, 18);
  add('סכום', 250, 100, 22); add('סכום', 180, 100, 22); add('פירוט', 90, 100, 25);
  add('עסקה', 505, 110, 24); add('עסקה', 250, 110, 22); add('חיוב', 180, 110, 20);
  const rows = [
    ['05/01/26', 'שופרסל דיל', 'מזון ומשקא', '245.30', '245.30', ''],
    ['07/01/26', 'WOLT', 'מסעדות', '88.00', '88.00', ''],
    ['09/01/26', 'SPOTIFY', 'שונות', '$ 11.99', '41.20', 'ארה"ב שער 3.3'],
    ['12/01/26', 'BIT', 'פיננסים', '150.00', '150.00', 'העברה לדני כהן'],
    ['15/01/26', 'זיכוי אל על', 'תיירות', '-1,200.00', '-1,200.00', 'ביטול עסקה'],
  ];
  let y = 125;
  rows.forEach(r => {
    add(r[0], 505, y, 36); add(r[1], 470 - r[1].length * 4.5, y); add(r[2], 300, y, 45);
    add(r[3], 240, y, 34); add(r[4], 175, y, 30); if (r[5]) add(r[5], 60, y, 80);
    y += 16;
  });
  // continuation line for merchant
  add('סניף רמת גן', 420, 130, 50);
  add('פרסומת: הלוואה!', 2, 140, 30); // ads column
  add('סה"כ לחיוב בש"ח: 1,324.50-', 200, y + 10, 160);
  add('-675.50', 120, y + 10, 30);
  return { width: 595, height: 842, items };
}

for (const visual of [false, true]) {
  const pg = page(visual);
  // make sure visual data really looks reversed for the detector
  assert.strictEqual(P.detectReversed([pg]), visual, 'detectReversed ' + visual);
  const res = P.parse([pg], 'test.pdf');
  const r = res.records;
  if (process.env.DEBUG) console.log(res.debug.join('\n'), JSON.stringify(res.report, null, 1), r);
  assert.strictEqual(r.length, 5, 'count');
  assert.strictEqual(res.report.card, '1875');
  assert.strictEqual(res.report.billDate, '10/02/2026');
  assert.strictEqual(r[0]['בית עסק'], 'שופרסל דיל סניף רמת גן');
  assert.strictEqual(r[0]['ענף'], 'מזון ומשקא');
  assert.strictEqual(r[0]['תאריך עסקה'], '05/01/2026');
  assert.strictEqual(r[2]['מטבע'], 'USD');
  assert.strictEqual(r[2]['סכום עסקה'], '11.99');
  assert.strictEqual(r[2]['סכום חיוב ₪'], '41.20');
  assert.strictEqual(r[3]['פירוט'], 'העברה לדני כהן');
  assert.strictEqual(r[4]['סכום חיוב ₪'], '-1200.00');
  assert.ok(res.report.ok, 'sum check ' + JSON.stringify(res.report.checks));
  console.log('ok visual=' + visual);
}
