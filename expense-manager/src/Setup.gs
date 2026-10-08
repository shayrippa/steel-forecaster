/**
 * Setup.gs – הגדרה ראשונית: יוצר את כל הגיליונות, הכותרות, העיצוב, הרשימות הנפתחות
 * ואת שתי התיקיות ב-Drive. בטוח להרצה חוזרת – לא מוחק נתונים קיימים.
 */

function runSetup() {
  var ss = ss_();
  ss.setSpreadsheetTimeZone('Asia/Jerusalem');
  ss.setSpreadsheetLocale('iw_IL');

  setupSettings_();
  setupDictionary_();
  setupTransactions_();
  setupReviewSheet_();
  [SHEETS.MONTHLY, SHEETS.WEEKLY, SHEETS.PATTERNS, SHEETS.DASH].forEach(function (n) { getOrCreate_(n); });
  var folders = ensureFolders_();

  // מחיקת הגיליון הריק שנוצר עם הקובץ
  ['Sheet1', 'גיליון1', 'גיליון 1'].forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (sh && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });

  orderSheets_();
  SpreadsheetApp.getUi().alert(
    'ההגדרה הושלמה ✓\n\n' +
    'נוצרו ב-Google Drive שתי תיקיות:\n• ' + FOLDERS.NEW + '\n• ' + FOLDERS.DONE + '\n\n' +
    'השלב הבא: תפריט "ניהול הוצאות" ← "עדכן הכל", והעלאת קבצי PDF או CSV של כאל.\n\n' +
    'קישור לתיקיית הקבצים החדשים:\n' + folders.newFolder.getUrl());
}

function getOrCreate_(name) {
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.setRightToLeft(true);
  return sh;
}

function orderSheets_() {
  var ss = ss_();
  var order = [SHEETS.DASH, SHEETS.TX, SHEETS.REVIEW, SHEETS.MONTHLY, SHEETS.WEEKLY, SHEETS.PATTERNS,
    SHEETS.SETTINGS, SHEETS.DICT];
  order.forEach(function (n, i) {
    var sh = ss.getSheetByName(n);
    if (sh) { ss.setActiveSheet(sh); ss.moveActiveSheet(i + 1); }
  });
  ss.setActiveSheet(ss.getSheetByName(SHEETS.DASH));
}

function styleHeader_(sh, headers) {
  var r = sh.getRange(1, 1, 1, headers.length);
  r.setValues([headers]).setFontWeight('bold').setBackground('#202124').setFontColor('#ffffff')
    .setFontFamily(FONT).setVerticalAlignment('middle').setHorizontalAlignment('center').setWrap(true);
  sh.setFrozenRows(1);
  sh.setRowHeight(1, 34);
}

function setupSettings_() {
  var sh = getOrCreate_(SHEETS.SETTINGS);
  var headers = ['קטגוריה', 'צבע', 'תיאור', 'תקציב חודשי ₪'];
  styleHeader_(sh, headers);
  if (sh.getLastRow() < 2) {
    var rows = DEFAULT_CATEGORIES.map(function (c) { return [c[0], c[1], c[2], '']; });
    sh.getRange(2, 1, rows.length, 4).setValues(rows);
  }
  var n = Math.max(sh.getLastRow() - 1, 1) + 20;
  sh.getRange(2, 2, n, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['ירוק', 'צהוב', 'אדום', '–'], true).build());
  sh.getRange(2, 4, n, 1).setNumberFormat('₪#,##0');
  sh.getRange(1, 1, n + 1, 4).setFontFamily(FONT);
  sh.setColumnWidths(1, 1, 160); sh.setColumnWidth(2, 80); sh.setColumnWidth(3, 340); sh.setColumnWidth(4, 120);
  sh.clearConditionalFormatRules();
  var rng = sh.getRange(2, 1, n, 4);
  sh.setConditionalFormatRules(['ירוק', 'צהוב', 'אדום'].map(function (c) {
    return SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$B2="' + c + '"')
      .setBackground(COLOR_LIGHT[c]).setRanges([rng]).build();
  }));
}

function setupDictionary_() {
  var sh = getOrCreate_(SHEETS.DICT);
  styleHeader_(sh, DICT_HEADERS);
  if (sh.getLastRow() < 2) {
    var today = new Date();
    var rows = SEED_DICTIONARY.map(function (d) { return [d[0], MATCH.CONTAINS, d[1], FIELD.MERCHANT, 'התחלתי', today]; });
    sh.getRange(2, 1, rows.length, DICT_HEADERS.length).setValues(rows);
  }
  var n = Math.max(sh.getLastRow(), 2) + 500;
  sh.getRange(2, 2, n, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList([MATCH.EXACT, MATCH.CONTAINS], true).build());
  sh.getRange(2, 3, n, 1).setDataValidation(categoryValidation_(false));
  sh.getRange(2, 4, n, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList([FIELD.MERCHANT, FIELD.RECIPIENT], true).build());
  sh.getRange(2, 6, n, 1).setNumberFormat('dd/MM/yyyy');
  sh.getRange(1, 1, n, DICT_HEADERS.length).setFontFamily(FONT);
  sh.setColumnWidth(1, 220); sh.setColumnWidths(2, 5, 120);
  if (!sh.getFilter()) sh.getRange(1, 1, sh.getLastRow(), DICT_HEADERS.length).createFilter();
}

function categoryValidation_(withReview) {
  var names = getCategories_().map(function (c) { return c.name; });
  if (withReview) names.push(REVIEW_CAT);
  return SpreadsheetApp.newDataValidation().requireValueInList(names, true).setAllowInvalid(false).build();
}

function setupTransactions_() {
  var sh = getOrCreate_(SHEETS.TX);
  styleHeader_(sh, TX_HEADERS);
  formatTxSheet_(sh);
  var widths = [70, 55, 90, 75, 90, 65, 200, 110, 220, 85, 55, 90, 55, 50, 70, 130, 55, 75, 90, 160, 90, 150, 120, 60];
  widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.hideColumns(C.KEY + 1);
  sh.hideColumns(C.ID + 1);
}

/** עיצוב עמודות, רשימות נפתחות, עיצוב מותנה ומסנן – נקרא גם אחרי כל ייבוא */
function formatTxSheet_(sh) {
  sh = sh || sheet_(SHEETS.TX);
  var n = Math.max(sh.getLastRow() - 1, 1);
  var rows = n + 200;
  if (sh.getMaxRows() < rows + 1) sh.insertRowsAfter(sh.getMaxRows(), rows + 1 - sh.getMaxRows());
  sh.getRange(2, C.DATE + 1, rows, 1).setNumberFormat('dd/MM/yyyy');
  sh.getRange(2, C.MONTH + 1, rows, 1).setNumberFormat('@');
  sh.getRange(2, C.WEEK + 1, rows, 1).setNumberFormat('dd/MM/yyyy');
  sh.getRange(2, C.BILL + 1, rows, 1).setNumberFormat('dd/MM/yyyy');
  sh.getRange(2, C.IMPORTED + 1, rows, 1).setNumberFormat('dd/MM/yyyy');
  sh.getRange(2, C.CARD + 1, rows, 1).setNumberFormat('@');
  sh.getRange(2, C.ORIG + 1, rows, 1).setNumberFormat('#,##0.00');
  sh.getRange(2, C.ILS + 1, rows, 1).setNumberFormat('₪#,##0.00;[Red]-₪#,##0.00');
  sh.getRange(2, C.CAT + 1, rows, 1).setDataValidation(categoryValidation_(true));
  sh.getRange(1, 1, rows + 1, TX_HEADERS.length).setFontFamily(FONT).setVerticalAlignment('middle');

  var full = sh.getRange(2, 1, rows, TX_HEADERS.length);
  var colLetter = columnLetter_(C.COLOR + 1);
  var catLetter = columnLetter_(C.CAT + 1);
  var rules = ['ירוק', 'צהוב', 'אדום'].map(function (c) {
    return SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + colLetter + '2="' + c + '"')
      .setBackground(COLOR_LIGHT[c]).setRanges([full]).build();
  });
  rules.unshift(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + catLetter + '2="' + REVIEW_CAT + '"')
    .setBackground('#fff0b3').setFontColor('#7a4f01').setRanges([full]).build());
  sh.setConditionalFormatRules(rules);

  var f = sh.getFilter();
  if (f) f.remove();
  sh.getRange(1, 1, sh.getLastRow(), TX_HEADERS.length).createFilter();
}

function setupReviewSheet_() {
  var sh = getOrCreate_(SHEETS.REVIEW);
  styleHeader_(sh, REVIEW_HEADERS);
}

function columnLetter_(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/** מחזיר את שתי התיקיות ב-Drive (יוצר אם חסרות). שומר את המזהים כדי שלא ייווצרו כפולות. */
function ensureFolders_() {
  var props = PropertiesService.getDocumentProperties();
  function get(key, name) {
    var id = props.getProperty(key);
    if (id) { try { var f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) { } }
    var it = DriveApp.getFoldersByName(name);
    var folder = it.hasNext() ? it.next() : DriveApp.createFolder(name);
    props.setProperty(key, folder.getId());
    return folder;
  }
  return { newFolder: get('FOLDER_NEW', FOLDERS.NEW), doneFolder: get('FOLDER_DONE', FOLDERS.DONE) };
}
