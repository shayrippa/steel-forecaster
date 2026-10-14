/**
 * Import.gs – שלב 1: ייבוא עסקאות לגיליון "עסקאות".
 * מקורות: קבצי CSV של הממיר (מתיקיית Drive או מהמחשב), וקבצי PDF של כאל
 * שמפוענחים בדפדפן בחלון הייבוא (Import.html) – בלי להתקין כלום במחשב.
 * כללים: שורות "עתידי" לא מיובאות; מזהה/מפתח קיים – מדלגים; ייבוא רק מוסיף.
 */

var CSV_FIELDS = ['מזהה', 'כרטיס', 'מועד חיוב דף', 'סוג', 'תאריך עסקה', 'בית עסק', 'ענף', 'פירוט',
  'כרטיס הוצג', 'סכום עסקה', 'מטבע', 'סכום חיוב ₪', 'תאריך חיוב', 'קובץ מקור'];
var CSV_REQUIRED = ['תאריך עסקה', 'בית עסק', 'סכום חיוב ₪'];
var NOT_CONVERTED_MSG = 'יש להמיר קודם עם הממיר במחשב, או להעלות את קובץ ה-PDF דרך חלון הייבוא.';

/** תפריט: פותח את חלון הייבוא (מצב ייבוא בלבד) */
function menuImport() { showImportDialog_('import'); }

/** תפריט: עדכן הכל – חלון הייבוא במצב "הכל" (ייבוא → סיווג → ניתוח) */
function menuUpdateAll() { showImportDialog_('all'); }

function showImportDialog_(mode) {
  var t = HtmlService.createTemplateFromFile('Import');
  t.mode = mode;
  var html = t.evaluate().setWidth(760).setHeight(620);
  SpreadsheetApp.getUi().showModalDialog(html, mode === 'all' ? 'עדכן הכל' : 'ייבוא קבצים חדשים');
}

/* ---------- פונקציות שנקראות מחלון הייבוא ---------- */

/** רשימת הקבצים שממתינים בתיקיית "קבצים חדשים" */
function listInbox() {
  var folder = ensureFolders_().newFolder;
  var out = { csv: [], pdf: [], other: [], folderUrl: folder.getUrl() };
  var it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    var name = f.getName(), mime = f.getMimeType();
    var item = { id: f.getId(), name: name };
    if (mime === MimeType.PDF || /\.pdf$/i.test(name)) out.pdf.push(item);
    else if (mime === MimeType.CSV || mime === MimeType.GOOGLE_SHEETS || /\.csv$/i.test(name) || mime === 'text/plain') out.csv.push(item);
    else out.other.push(name);
  }
  return out;
}

/** ייבוא קובץ CSV (או Google Sheet שנוצר מ-CSV) מהתיקייה */
function importCsvFile(fileId) {
  var file = DriveApp.getFileById(fileId);
  var rows;
  if (file.getMimeType() === MimeType.GOOGLE_SHEETS) {
    rows = SpreadsheetApp.openById(fileId).getSheets()[0].getDataRange().getDisplayValues();
  } else {
    rows = parseCsvText_(file.getBlob().getDataAsString('UTF-8'));
  }
  var res = importTable_(rows, file.getName());
  if (res.ok) file.moveTo(ensureFolders_().doneFolder);
  return res;
}

/** ייבוא CSV שהועלה מהמחשב (טקסט) */
function importCsvUpload(name, text) {
  var res = importTable_(parseCsvText_(text), name);
  if (res.ok) archiveBlob_(Utilities.newBlob(text, MimeType.CSV, name));
  return res;
}

/** תוכן PDF מהתיקייה כ-base64, לפענוח בדפדפן */
function getPdfBase64(fileId) {
  return Utilities.base64Encode(DriveApp.getFileById(fileId).getBlob().getBytes());
}

/**
 * ייבוא עסקאות שפוענחו מ-PDF בדפדפן.
 * payload = { fileName, fileId (אם מהתיקייה) | base64 (אם מהמחשב), records: [{שדות CSV}] }
 */
function importParsedPdf(payload) {
  var res = importRecords_(payload.records || [], payload.fileName);
  if (res.ok) {
    if (payload.fileId) DriveApp.getFileById(payload.fileId).moveTo(ensureFolders_().doneFolder);
    else if (payload.base64) archiveBlob_(Utilities.newBlob(Utilities.base64Decode(payload.base64), MimeType.PDF, payload.fileName));
  }
  return res;
}

/** אחרי הייבוא: סיווג + ניתוח. מחזיר כמה מחכות לסיווג ידני */
function finishImport(runAnalysis) {
  var c = classifyAll_();
  if (runAnalysis) buildAnalysisAndDashboard_();
  return { pending: c.pending, classified: c.classified };
}

/* ---------- לוגיקה ---------- */

function parseCsvText_(text) {
  text = String(text || '').replace(/^﻿/, '');
  if (/^%PDF/.test(text)) throw new Error('זה קובץ PDF ולא CSV. ' + NOT_CONVERTED_MSG);
  return Utilities.parseCsv(text);
}

/** טבלה (שורת כותרת + שורות) → רשומות → ייבוא */
function importTable_(rows, sourceName) {
  if (!rows || rows.length < 1) return { ok: false, error: 'הקובץ ' + sourceName + ' ריק.' };
  var header = rows[0].map(function (h) { return String(h).replace(/^﻿/, '').trim(); });
  var idx = {};
  header.forEach(function (h, i) { idx[h] = i; });
  var missing = CSV_REQUIRED.filter(function (h) { return !(h in idx); });
  if (missing.length) {
    return { ok: false, error: 'הקובץ "' + sourceName + '" אינו CSV בפורמט של הממיר (חסרות עמודות: ' + missing.join(', ') + '). ' + NOT_CONVERTED_MSG };
  }
  var records = [];
  for (var r = 1; r < rows.length; r++) {
    var row = rows[r];
    if (!row || row.join('').trim() === '') continue;
    var rec = {};
    CSV_FIELDS.forEach(function (f) { rec[f] = f in idx ? row[idx[f]] : ''; });
    records.push(rec);
  }
  return importRecords_(records, sourceName);
}

/** ליבת הייבוא: מסנן עתידי, מונע כפילויות, כותב ב-batch */
function importRecords_(records, sourceName) {
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    var sh = sheet_(SHEETS.TX);
    var existing = readTx_();
    var ids = {}, keys = {};
    existing.forEach(function (r) { if (r[C.ID]) ids[String(r[C.ID])] = 1; if (r[C.KEY]) keys[String(r[C.KEY])] = 1; });

    var occ = {};
    var out = [], skipped = 0, future = 0, bad = 0, sum = 0;
    var now = new Date();
    records.forEach(function (rec) {
      var type = String(rec['סוג'] || 'רגיל').trim();
      if (type === 'עתידי') { future++; return; }
      var date = parseDate_(rec['תאריך עסקה']);
      var ils = parseAmount_(rec['סכום חיוב ₪']);
      if (!date || isNaN(ils)) { bad++; return; }
      var card = String(rec['כרטיס'] || '').replace(/\D/g, '').slice(-4);
      var merchant = String(rec['בית עסק'] || '').trim();
      var bill = parseDate_(rec['תאריך חיוב']) || parseDate_(rec['מועד חיוב דף']);
      var base = [card, ymd_(date), merchantSig_(merchant), ils.toFixed(2), type, ymd_(parseDate_(rec['מועד חיוב דף']))].join('|');
      occ[base] = (occ[base] || 0) + 1;
      var key = base + '|' + occ[base];
      var id = String(rec['מזהה'] || '').trim() || md5_(key);
      if (ids[id] || keys[key]) { skipped++; return; }
      ids[id] = 1; keys[key] = 1;

      var orig = parseAmount_(rec['סכום עסקה']);
      var cur = String(rec['מטבע'] || 'ILS').trim().toUpperCase() || 'ILS';
      var detail = String(rec['פירוט'] || '').trim();
      var branch = String(rec['ענף'] || '').trim();
      var row = new Array(TX_HEADERS.length);
      for (var i = 0; i < row.length; i++) row[i] = '';
      row[C.ID] = id;
      row[C.CARD] = card;
      row[C.DATE] = date;
      row[C.MONTH] = monthKey_(date);
      row[C.WEEK] = weekStart_(date);
      row[C.DOW] = HEB_DAYS[date.getDay()];
      row[C.MERCHANT] = merchant;
      row[C.BRANCH] = branch;
      row[C.DETAIL] = detail;
      row[C.ORIG] = isNaN(orig) ? ils : orig;
      row[C.CUR] = cur;
      row[C.ILS] = round2_(ils);
      row[C.CREDIT] = ils < 0 ? 'כן' : '';
      row[C.ABROAD] = (cur !== 'ILS' || /חו"ל|חו''ל|חול\b/.test(detail)) ? 'כן' : '';
      row[C.STANDING] = /הוראת קבע|הו"ק|הוק\b/.test(detail + ' ' + branch) ? 'כן' : '';
      row[C.BILL] = bill || '';
      row[C.SRC] = String(rec['קובץ מקור'] || sourceName || '');
      row[C.IMPORTED] = now;
      if (type === 'מיידי') row[C.NOTE] = 'חויב מיידית';
      row[C.KEY] = key;
      out.push(row);
      sum += ils;
    });

    if (out.length) {
      var start = sh.getLastRow() + 1;
      if (sh.getMaxRows() < start + out.length) sh.insertRowsAfter(sh.getMaxRows(), start + out.length - sh.getMaxRows());
      // טקסט רגיל לפני הכתיבה – אחרת "2026-03" הופך לתאריך
      sh.getRange(start, C.MONTH + 1, out.length, 1).setNumberFormat('@');
      sh.getRange(start, C.CARD + 1, out.length, 1).setNumberFormat('@');
      sh.getRange(start, 1, out.length, TX_HEADERS.length).setValues(out);
      formatTxSheet_(sh);
    }
    return { ok: true, file: sourceName, imported: out.length, skipped: skipped, future: future, bad: bad, sum: round2_(sum) };
  } finally {
    lock.releaseLock();
  }
}

/** חתימה של שם בית עסק למפתח הכפילויות – רק אותיות וספרות, 8 תווים ראשונים,
 *  כדי שהבדלים קטנים בפענוח (רווחים, גרשיים, סוגריים) בין CSV ל-PDF לא ייצרו כפילות */
function merchantSig_(m) {
  return String(m || '').toLowerCase().replace(/[^a-z0-9\u05d0-\u05ea]/g, '').slice(0, 8);
}

function md5_(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ((b + 256) % 256).toString(16).replace(/^(.)$/, '0$1'); }).join('').slice(0, 16);
}

function archiveBlob_(blob) {
  try { ensureFolders_().doneFolder.createFile(blob); } catch (e) { /* ארכוב לא קריטי */ }
}
