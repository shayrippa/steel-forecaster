// בדיקת פענוח PDF אמיתי: Chromium מייצר PDF מדף לדוגמה (נתונים בדויים), pdf.js מחלץ, CalParser מפענח.
// דרישות: playwright, ו-pdfjs-dist@3.11.174 (PDFJS_DIR=<תיקיית package>). הרצה: node test/pdf.test.js
const path = require('path'), fs = require('fs'), assert = require('assert');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const PDFJS = process.env.PDFJS_DIR || path.join(__dirname, '../node_modules/pdfjs-dist');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const p = await b.newPage();
  await p.goto('file://' + path.join(__dirname, 'fixtures/sample-statement.html'));
  const pdf = await p.pdf({ format: 'A4' });
  await p.goto('about:blank');
  await p.addScriptTag({ content: fs.readFileSync(path.join(PDFJS, 'build/pdf.min.js'), 'utf8') });
  await p.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../src/calParser.js'), 'utf8') });
  const worker = fs.readFileSync(path.join(PDFJS, 'build/pdf.worker.min.js'), 'utf8');
  const res = await p.evaluate(async ({ data, worker }) => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([worker], { type: 'text/javascript' }));
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(data) }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const pg = await doc.getPage(i), vp = pg.getViewport({ scale: 1 }), tc = await pg.getTextContent();
      pages.push({ width: vp.width, height: vp.height, items: tc.items.filter(it => it.str && it.str.trim())
        .map(it => ({ str: it.str, x: it.transform[4], y: vp.height - it.transform[5], w: it.width, h: it.height })) });
    }
    return CalParser.parse(pages, 'sample.pdf');
  }, { data: [...pdf], worker });
  await b.close();
  const r = res.records;
  assert.ok(res.report.ok, JSON.stringify(res.report));
  assert.strictEqual(r.length, 8);
  assert.strictEqual(res.report.card, '1875');
  assert.strictEqual(r[0]['בית עסק'], 'שופרסל דיל רמת גן');
  assert.strictEqual(r[0]['ענף'], 'מזון ומשקא');
  assert.strictEqual(r[2]['מטבע'], 'USD');
  assert.strictEqual(r[3]['פירוט'], 'העברה לדני כהן');
  assert.strictEqual(r[4]['סכום חיוב ₪'], '-1200.00');
  assert.strictEqual(r[6]['סוג'], 'מיידי');
  assert.strictEqual(r[7]['סוג'], 'עתידי');
  assert.ok(!r.some(x => /פרסומת|הלוואה/.test(JSON.stringify(x))), 'ads filtered');
  console.log('✓ PDF test passed');
})().catch(e => { console.error(e); process.exit(1); });
