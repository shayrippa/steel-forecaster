/** ניהול הוצאות – קובץ מאוחד (נבנה אוטומטית מתיקיית src באמצעות build.sh). לא לערוך כאן. */

/* ===================== Config.gs ===================== */
/**
 * Config.gs – מקור אמת יחיד: שמות גיליונות, עמודות, קטגוריות, צבעים, כללי סיווג ומילון התחלתי.
 * הקטגוריות והתקציבים עצמם נערכים בגיליון "הגדרות"; כאן רק ערכי ברירת המחדל.
 */

var SHEETS = {
  TX: 'עסקאות',
  SETTINGS: 'הגדרות',
  DICT: 'מילון',
  REVIEW: 'לבירור',
  MONTHLY: 'סיכום חודשי',
  WEEKLY: 'סיכום שבועי',
  PATTERNS: 'דפוסים',
  DASH: 'דשבורד',
  FIXED: 'הוצאות קבועות'
};

var FOLDERS = {
  NEW: 'הוצאות – קבצים חדשים',
  DONE: 'הוצאות – קבצים שעובדו'
};

// עמודות גיליון "עסקאות" (הסדר קובע את מיקום העמודות). שתי האחרונות הן עמודות עזר.
var TX_HEADERS = [
  'מזהה', 'כרטיס', 'תאריך עסקה', 'חודש', 'שבוע', 'יום בשבוע', 'בית עסק', 'ענף (כאל)', 'פירוט',
  'סכום מקורי', 'מטבע', 'סכום ₪', 'זיכוי?', 'חו"ל?', 'הוראת קבע?', 'קטגוריה', 'צבע',
  'סווג ע"י', 'מועד חיוב', 'קובץ מקור', 'תאריך ייבוא', 'הערה', 'הצעה', 'מפתח'
];
var C = {}; // אינדקס עמודה (0-based) לפי שם קצר
(function () {
  var keys = ['ID', 'CARD', 'DATE', 'MONTH', 'WEEK', 'DOW', 'MERCHANT', 'BRANCH', 'DETAIL',
    'ORIG', 'CUR', 'ILS', 'CREDIT', 'ABROAD', 'STANDING', 'CAT', 'COLOR',
    'BY', 'BILL', 'SRC', 'IMPORTED', 'NOTE', 'SUGGEST', 'KEY'];
  keys.forEach(function (k, i) { C[k] = i; });
})();

var REVIEW_CAT = 'לבירור';
var CASH_CAT = 'מזומן';
var OTHER_CAT = 'אחר';

var BY = { DICT: 'מילון', BRANCH: 'ענף', MANUAL: 'ידני', AUTO: 'אוטומטי', OUTLIER: 'חריגה' };

var COLOR_NAMES = { GREEN: 'ירוק', YELLOW: 'צהוב', RED: 'אדום', NONE: '–' };
var COLOR_HEX = { 'ירוק': '#34a853', 'צהוב': '#f9ab00', 'אדום': '#ea4335', '–': '#9aa0a6' };
var COLOR_LIGHT = { 'ירוק': '#e6f4ea', 'צהוב': '#fef7e0', 'אדום': '#fce8e6', '–': '#f1f3f4' };

// ברירת מחדל לגיליון "הגדרות": קטגוריה, צבע, תיאור
var DEFAULT_CATEGORIES = [
  ['דיור', 'ירוק', 'קבוע, אי אפשר לגעת'],
  ['חשבונות', 'ירוק', 'סלולר, גז, חשמל, מים, אינטרנט, דמי כרטיס'],
  ['ביטוחים', 'ירוק', ''],
  ['מנויים', 'ירוק', 'סטרימינג, אפליקציות, חדר כושר/קרוספיט, מועדון ספורט'],
  ['בריאות', 'ירוק', 'קופ"ח, רופא שיניים, תרופות'],
  ['מזון וסופר', 'צהוב', 'חיוני, אפשר לקצץ'],
  ['קניות', 'צהוב', 'ביגוד, אלקטרוניקה, בית, פארם'],
  ['תחבורה', 'צהוב', 'דלק, חניה, פנגו, רב-קו, מוניות'],
  ['מסעדות ובילויים', 'אדום', 'קפה, בר, מסעדה, משלוחים, אירועים'],
  ['חופשות וטיולים', 'אדום', 'טיסות, מלונות, אירוח, הוצאות חו"ל'],
  ['מתנות ואירועים', 'אדום', 'פרחים, מתנות'],
  ['מזומן', '–', 'משיכות מכספומט – נספר בנפרד'],
  ['אחר', '–', 'רק מה שסומן "לא ידוע"']
];

// כללי סיווג
var RULES = {
  BIG_AMOUNT: 1000,          // עסקה מעל סכום זה עוברת לאישור
  BIG_MULTIPLIER: 3,         // או פי 3 מהממוצע של אותו בית עסק
  TRANSFER_MERCHANTS: ['BIT', 'PAYBOX', 'העברה ב BIT', 'ביט', 'פייבוקס'],
  CASH_MERCHANT: 'לאומי לישראל',
  CASH_DETAIL: ['מ.מזומן', 'משיכת מזומן', 'משיכה מכספומט'],
  EAT_OUT_KEYWORDS: ['פיצה', 'סושי', 'שווארמה', 'שוארמה', 'חומוס', 'פלאפל', 'קפה', 'בורגר', 'משקאות', 'CAFE', 'COFFEE', 'PIZZA', 'BURGER'],
  EAT_OUT_WORDS: ['בר', 'BAR', 'PUB', 'פאב'], // התאמה למילה שלמה בלבד
  PARKING_WORDS: ['פנגו', 'חניון', 'חניה', 'חנייה', 'PANGO'],
  GENERAL_BRANCHES: ['מוסדות', 'חינוך', 'עמותות', 'ציוד ומשרד', 'פנאי', 'שונות', 'פיננסים'],
  // [מילה בענף, קטגוריה]. נבדק לפי הסדר. ענפים מיוחדים (מזון, תיירות, תקשורת) מטופלים בקוד.
  BRANCH_MAP: [
    ['מסעדות', 'מסעדות ובילויים'],
    ['אנרגיה', 'תחבורה'],
    ['דלק', 'תחבורה'],
    ['גז', 'חשבונות'],
    ['רפואה', 'בריאות'],
    ['ביטוח', 'ביטוחים'],
    ['ריהוט', 'קניות'],
    ['אופנה', 'קניות'],
    ['מחשבים', 'קניות'],
    ['מוצרי חשמל', 'קניות'],
    ['כלבו', 'קניות'],
    ['דמי כרטיס', 'חשבונות']
  ]
};

// מילון התחלתי – רק התאמות ודאיות. [דפוס, קטגוריה]. כולם "מכיל".
var SEED_DICTIONARY = [
  ['סלקום', 'חשבונות'], ['פלאפון', 'חשבונות'], ['אמישראגז', 'חשבונות'], ['דמי כרטיס', 'חשבונות'],
  ['Spotify', 'מנויים'], ['Google One', 'מנויים'], ['ANTHROPIC', 'מנויים'], ['NBA League Pass', 'מנויים'],
  ['קרוספיט', 'מנויים'], ['הפועל אוסישקין', 'מנויים'],
  ['קרן מכבי', 'בריאות'], ['מכבידנט', 'בריאות'], ['אור השן', 'בריאות'],
  ['ALLIANZ TRAVEL', 'ביטוחים'],
  ['פנגו', 'תחבורה'], ['חניון', 'תחבורה'], ['סנטרל פארק', 'תחבורה'], ['רב-פס', 'תחבורה'], ['Gett', 'תחבורה'],
  ['פז', 'תחבורה'], ['דלק', 'תחבורה'], ['סונול', 'תחבורה'],
  ['שופרסל', 'מזון וסופר'], ['רמי לוי', 'מזון וסופר'], ['כל זול', 'מזון וסופר'], ['טיב טעם', 'מזון וסופר'],
  ['אושר עד', 'מזון וסופר'], ['CARREFOUR', 'מזון וסופר'], ['סופר-זול', 'מזון וסופר'], ['סיטי מרקט', 'מזון וסופר'],
  ['אחימרקט', 'מזון וסופר'], ['מינמרקט', 'מזון וסופר'], ['סופרמרקט', 'מזון וסופר'], ['נתח קצבים', 'מזון וסופר'],
  ['רשת כוורת', 'מזון וסופר'],
  ['KSP', 'קניות'], ['קיי.אס.פי', 'קניות'], ['איבורי', 'קניות'], ['איקאה', 'קניות'], ['אייס', 'קניות'],
  ['הום סנטר', 'קניות'], ['aliexpress', 'קניות'], ['סופר פארם', 'קניות'], ['סופרפארם', 'קניות'], ['גוד פארם', 'קניות'],
  ['WOLT', 'מסעדות ובילויים'], ['סיבוס', 'מסעדות ובילויים'],
  ['ELAL', 'חופשות וטיולים'], ['EASYJET', 'חופשות וטיולים'], ['ALASKA', 'חופשות וטיולים'], ['ישרוטל', 'חופשות וטיולים'],
  ['פרחים', 'מתנות ואירועים'], ['פלורין', 'מתנות ואירועים']
];

// עמודות גיליון "מילון"
var DICT_HEADERS = ['דפוס', 'סוג התאמה', 'קטגוריה', 'שדה', 'מקור', 'תאריך הוספה'];
var MATCH = { EXACT: 'מדויק', CONTAINS: 'מכיל' };
var FIELD = { MERCHANT: 'בית עסק', RECIPIENT: 'נמען (פירוט)' };

var HEB_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

var FONT = 'Rubik';

/* ===================== Util.gs ===================== */
/**
 * Util.gs – פונקציות עזר משותפות: תאריכים, סכומים, נרמול טקסט, קריאת הגדרות.
 */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('הגיליון "' + name + '" לא קיים. יש להריץ "הגדרה ראשונית".');
  return sh;
}

function toast_(msg, title, sec) {
  ss_().toast(msg, title || 'ניהול הוצאות', sec || 5);
}

/** "DD/MM/YYYY" או "DD/MM/YY" או Date → Date (צהריים, כדי לא ליפול בין ימים) */
function parseDate_(v) {
  if (v instanceof Date) return v;
  if (v === null || v === undefined || v === '') return null;
  var m = String(v).trim().match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (!m) return null;
  var y = Number(m[3]);
  if (y < 100) y += 2000;
  return new Date(y, Number(m[2]) - 1, Number(m[1]), 12, 0, 0);
}

function pad2_(n) { return (n < 10 ? '0' : '') + n; }

function ymd_(d) { return d ? d.getFullYear() + '-' + pad2_(d.getMonth() + 1) + '-' + pad2_(d.getDate()) : ''; }

function monthKey_(d) { return d.getFullYear() + '-' + pad2_(d.getMonth() + 1); }

/** תחילת שבוע (יום ראשון) */
function weekStart_(d) {
  var w = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
  w.setDate(w.getDate() - w.getDay());
  return w;
}

/** "1,234.50" / "-12" / "12.00-" / "₪ 5" → מספר */
function parseAmount_(v) {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined) return NaN;
  var s = String(v).replace(/[₪$€,\s]/g, '').replace(/EUR|USD|ILS|EU/gi, '');
  if (!s) return NaN;
  var neg = false;
  if (/-$/.test(s)) { neg = true; s = s.slice(0, -1); }
  if (/^-/.test(s)) { neg = !neg; s = s.slice(1); }
  var n = Number(s);
  if (isNaN(n)) return NaN;
  return neg ? -n : n;
}

function round2_(n) { return Math.round(n * 100) / 100; }

/** נרמול שם להשוואה: אותיות קטנות, בלי רווחים כפולים וסימני פיסוק בקצוות */
function norm_(s) {
  return String(s || '').toLowerCase().replace(/["'`״׳]/g, '').replace(/\s+/g, ' ').trim();
}

function yes_(v) { return v === true || v === 'כן'; }

/** קטגוריות מגיליון "הגדרות": [{name, color, budget}] */
function getCategories_() {
  var sh = ss_().getSheetByName(SHEETS.SETTINGS);
  var rows = sh && sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues() : DEFAULT_CATEGORIES;
  var list = [];
  rows.forEach(function (r) {
    if (!r[0]) return;
    list.push({ name: String(r[0]).trim(), color: String(r[1] || COLOR_NAMES.NONE).trim(), budget: Number(r[3]) || 0 });
  });
  return list;
}

/** מפה קטגוריה → צבע */
function categoryColors_() {
  var map = {};
  getCategories_().forEach(function (c) { map[c.name] = c.color; });
  map[REVIEW_CAT] = '';
  return map;
}

/** הופך מערך שורות-גיליון של עסקאות למערך. מחזיר [] אם אין נתונים */
function readTx_() {
  var sh = sheet_(SHEETS.TX);
  var n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, TX_HEADERS.length).getValues();
}

/** חילוץ הנמען מפירוט של העברת BIT / PayBox ("העברה ל..." ) */
function transferRecipient_(detail) {
  var s = String(detail || '').trim();
  var m = s.match(/(?:העברה|הועבר)\s*(?:ל|אל|ל-)\s*-?\s*(.+)$/);
  var r = m ? m[1] : s;
  return r.replace(/\s+/g, ' ').trim();
}

function isTransfer_(merchant, branch) {
  var m = ' ' + norm_(merchant).replace(/[\-.,/()]/g, ' ').replace(/\s+/g, ' ') + ' ';
  return RULES.TRANSFER_MERCHANTS.some(function (t) { return m.indexOf(' ' + norm_(t) + ' ') >= 0; });
}

/** מריץ פונקציה תחת נעילת מסמך, כדי שפעולות במקביל (למשל לחיצות מהירות בסרגל הצד) לא ידרסו זו את זו */
function withLock_(fn) {
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ===================== Setup.gs ===================== */
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
  setupFixedSheet_();
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
    SHEETS.FIXED, SHEETS.SETTINGS, SHEETS.DICT];
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

/* ===================== Import.gs ===================== */
/**
 * Import.gs – שלב 1: ייבוא עסקאות לגיליון "עסקאות".
 * מקורות: קבצי CSV של הממיר (מתיקיית Drive או מהמחשב), קבצי PDF של כאל ואקסל של ישראכרט
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
    if (mime === MimeType.PDF || /\.(pdf|xlsx?)$/i.test(name)) out.pdf.push(item); // מפוענחים בדפדפן
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
    else if (payload.base64) archiveBlob_(Utilities.newBlob(Utilities.base64Decode(payload.base64),
      /\.xlsx?$/i.test(payload.fileName) ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : MimeType.PDF, payload.fileName));
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
    // מפתח "רופף": כרטיס + תאריך + סכום + חודש החיוב. בלי שם בית העסק – הוא נכתב אחרת ב-PDF ובאקסל
    // (קיצור, סדר מילים), ובלי היום של מועד החיוב (באקסל 10/01, ב-PDF 11/01). סופרים כמה כבר קיימות,
    // כדי ששתי עסקאות זהות לגיטימיות יישמרו.
    var looseHave = {};
    existing.forEach(function (r) {
      if (r[C.ID]) ids[String(r[C.ID])] = 1;
      if (r[C.KEY]) keys[String(r[C.KEY])] = 1;
      var lb = looseKey_(r[C.CARD], r[C.DATE], r[C.MERCHANT], r[C.ILS], r[C.BILL]);
      looseHave[lb] = (looseHave[lb] || 0) + 1;
    });
    var looseNew = {};

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
      var lb = looseKey_(card, date, merchant, ils, bill);
      looseNew[lb] = (looseNew[lb] || 0) + 1;
      if (ids[id] || keys[key] || looseNew[lb] <= (looseHave[lb] || 0)) { skipped++; return; }
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

function looseKey_(card, date, merchant, ils, bill) {
  var d = date instanceof Date ? date : parseDate_(date), b = bill instanceof Date ? bill : parseDate_(bill);
  var c = String(card || '').replace(/\D/g, '').slice(-4);
  // בלי כרטיס (הוצאות קבועות) – השם הוא מה שמבדיל בין הוצאות
  return [c, d ? ymd_(d) : '', c ? '' : merchantSig_(merchant), (Number(ils) || 0).toFixed(2), b ? monthKey_(b) : ''].join('|');
}

function md5_(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ((b + 256) % 256).toString(16).replace(/^(.)$/, '0$1'); }).join('').slice(0, 16);
}

function archiveBlob_(blob) {
  try { ensureFolders_().doneFolder.createFile(blob); } catch (e) { /* ארכוב לא קריטי */ }
}

/* ===================== Classify.gs ===================== */
/**
 * Classify.gs – שלב 2: סיווג עסקאות לקטגוריות.
 * סדר: (0) משיכת מזומן / העברת BIT-PayBox → (1) מילון בתי עסק → (2) כללי ענף ומילות מפתח → (3) "לבירור".
 * עסקה חריגה בגודלה עוברת לאישור גם אם סווגה. סיווג ידני לעולם לא נדרס.
 */

var REVIEW_HEADERS = ['מזהה', 'תאריך', 'בית עסק', 'פירוט', 'סכום ₪', 'ענף (כאל)', 'הצעה', 'קטגוריה', 'החל על'];
var APPLY_ALWAYS = 'תמיד לבית העסק הזה';
var APPLY_ONCE = 'רק לעסקה הזו';

/** תפריט: 2. סיווג עסקאות */
function menuClassify() {
  var res = classifyAll_();
  if (res.pending > 0) {
    toast_('סווגו ' + res.classified + ' עסקאות. ' + res.pending + ' מחכות לסיווג שלך.');
    openReviewSidebar();
  } else {
    toast_('סווגו ' + res.classified + ' עסקאות. הכל מסווג ✓');
  }
}

/** מסווג את כל מה שעוד לא סווג. מחזיר {classified, pending} */
function classifyAll_() { return withLock_(classifyAllUnlocked_); }

function classifyAllUnlocked_() {
  var sh = sheet_(SHEETS.TX);
  var data = readTx_();
  if (!data.length) { rebuildReviewSheet_([]); return { classified: 0, pending: 0 }; }
  var dict = loadDict_();
  var colors = categoryColors_();
  var stats = merchantStats_(data);
  var classified = 0, pending = 0;

  var catCols = [], sugCol = [];
  data.forEach(function (r) {
    var cat = String(r[C.CAT] || ''), by = String(r[C.BY] || ''), sug = r[C.SUGGEST];
    var needs = !cat || (cat === REVIEW_CAT && by !== BY.OUTLIER && by !== BY.MANUAL);
    if (needs) {
      var res = classifyRow_(r, dict, stats);
      if (res.cat !== REVIEW_CAT) classified++;
      cat = res.cat; by = res.by; sug = res.suggest || '';
    }
    if (cat === REVIEW_CAT) pending++;
    catCols.push([cat, cat === REVIEW_CAT ? '' : (colors[cat] || COLOR_NAMES.NONE), by]);
    sugCol.push([sug]);
  });
  sh.getRange(2, C.CAT + 1, data.length, 3).setValues(catCols);
  sh.getRange(2, C.SUGGEST + 1, data.length, 1).setValues(sugCol);

  rebuildReviewSheet_(readTx_());
  return { classified: classified, pending: pending };
}

/** סיווג שורה אחת. מחזיר {cat, by, suggest} */
function classifyRow_(r, dict, stats) {
  var merchant = String(r[C.MERCHANT] || ''), branch = String(r[C.BRANCH] || ''), detail = String(r[C.DETAIL] || '');
  var amount = Number(r[C.ILS]) || 0;
  var all = merchant + ' ' + detail + ' ' + branch;

  // (0א) משיכת מזומן
  if (RULES.CASH_DETAIL.some(function (k) { return all.indexOf(k) >= 0; }) ||
    (merchant.indexOf(RULES.CASH_MERCHANT) >= 0 && /מזומן/.test(all))) {
    return { cat: CASH_CAT, by: BY.AUTO };
  }

  // (0ב) העברות BIT / PayBox – רק לפי נמען שנשמר במילון, אחרת לבירור
  if (isTransfer_(merchant, branch)) {
    var rcp = matchDict_(transferRecipient_(detail), dict, FIELD.RECIPIENT);
    if (rcp) return { cat: rcp, by: BY.DICT };
    return { cat: REVIEW_CAT, by: '', suggest: '' };
  }

  var cat = matchDict_(merchant, dict, FIELD.MERCHANT), by = BY.DICT;
  if (!cat) { cat = branchRule_(merchant, branch, detail, r); by = BY.BRANCH; }
  if (!cat) return { cat: REVIEW_CAT, by: '', suggest: '' };

  // עסקה חריגה בגודלה – לאישור, עם הצעה
  if (cat !== CASH_CAT && amount > 0) {
    var st = stats[norm_(merchant)];
    var othersAvg = st && st.n > 2 ? (st.sum - amount) / (st.n - 1) : 0;
    if (amount > RULES.BIG_AMOUNT || (othersAvg > 0 && amount > RULES.BIG_MULTIPLIER * othersAvg)) {
      return { cat: REVIEW_CAT, by: BY.OUTLIER, suggest: cat };
    }
  }
  return { cat: cat, by: by };
}

/** כללי ענף + מילות מפתח. מחזיר קטגוריה או '' */
function branchRule_(merchant, branch, detail, r) {
  var b = String(branch || '');
  if (!b) {
    if (/דמי כרטיס/.test(merchant + detail)) return 'חשבונות';
    return '';
  }
  if (RULES.GENERAL_BRANCHES.some(function (g) { return b.indexOf(g) >= 0; })) return '';
  if (b.indexOf('מזון') >= 0) return hasEatOutWord_(merchant) ? 'מסעדות ובילויים' : 'מזון וסופר';
  if (b.indexOf('תיירות') >= 0 || b.indexOf('אירוח') >= 0) {
    return RULES.PARKING_WORDS.some(function (w) { return merchant.indexOf(w) >= 0; }) ? 'תחבורה' : 'חופשות וטיולים';
  }
  if (b.indexOf('תקשורת') >= 0) return yes_(r[C.STANDING]) ? 'חשבונות' : '';
  for (var i = 0; i < RULES.BRANCH_MAP.length; i++) {
    if (b.indexOf(RULES.BRANCH_MAP[i][0]) >= 0) return RULES.BRANCH_MAP[i][1];
  }
  return '';
}

function hasEatOutWord_(name) {
  var up = String(name || '').toUpperCase();
  if (RULES.EAT_OUT_KEYWORDS.some(function (k) { return up.indexOf(k.toUpperCase()) >= 0; })) return true;
  var tokens = up.split(/[\s\-.,'"\/()&]+/);
  return RULES.EAT_OUT_WORDS.some(function (w) { return tokens.indexOf(w.toUpperCase()) >= 0; });
}

/** טעינת מילון: [{p, exact, cat, field}] */
function loadDict_() {
  var sh = ss_().getSheetByName(SHEETS.DICT);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues()
    .filter(function (r) { return r[0] && r[2]; })
    .map(function (r) {
      return { p: norm_(r[0]), exact: r[1] === MATCH.EXACT, cat: String(r[2]).trim(), field: r[3] || FIELD.MERCHANT };
    });
}

/** התאמה מהמילון: מדויק או מכיל, עדיפות להתאמה הארוכה ביותר. דפוס קצר (עד 3 תווים) – רק כמילה שלמה */
function matchDict_(text, dict, field) {
  var t = norm_(text);
  if (!t) return '';
  var best = null;
  dict.forEach(function (d) {
    if (d.field !== field || !d.p) return;
    var ok;
    if (d.exact) ok = t === d.p;
    else if (d.p.length <= 3) ok = new RegExp('(^|[\\s\\-.,/()])' + escapeRe_(d.p) + '($|[\\s\\-.,/()])').test(t);
    else ok = t.indexOf(d.p) >= 0;
    if (!ok) return;
    var score = d.p.length + (d.exact ? 0.5 : 0);
    if (!best || score > best.score) best = { score: score, cat: d.cat };
  });
  return best ? best.cat : '';
}

function escapeRe_(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function merchantStats_(data) {
  var st = {};
  data.forEach(function (r) {
    var a = Number(r[C.ILS]) || 0;
    if (a <= 0) return;
    var k = norm_(r[C.MERCHANT]);
    st[k] = st[k] || { n: 0, sum: 0 };
    st[k].n++; st[k].sum += a;
  });
  return st;
}

/* ---------- סרגל הצד ---------- */

function openReviewSidebar() {
  var html = HtmlService.createTemplateFromFile('Review').evaluate().setTitle('סיווג ידני');
  SpreadsheetApp.getUi().showSidebar(html);
}

/** קבוצות לבירור לסרגל הצד */
function getReviewGroups() {
  var data = readTx_();
  var groups = {}, order = [];
  data.forEach(function (r) {
    if (r[C.CAT] !== REVIEW_CAT) return;
    var transfer = isTransfer_(r[C.MERCHANT], r[C.BRANCH]);
    var recipient = transfer ? transferRecipient_(r[C.DETAIL]) : '';
    var outlier = r[C.BY] === BY.OUTLIER;
    var key = outlier ? 'O|' + r[C.ID] : transfer ? 'T|' + norm_(r[C.MERCHANT]) + '|' + norm_(recipient) : 'M|' + norm_(r[C.MERCHANT]);
    if (!groups[key]) {
      groups[key] = { key: key, merchant: String(r[C.MERCHANT]), recipient: recipient, isTransfer: transfer, outlier: outlier,
        branch: String(r[C.BRANCH] || ''), suggest: String(r[C.SUGGEST] || ''), count: 0, total: 0, items: [] };
      order.push(key);
    }
    var g = groups[key];
    g.count++; g.total = round2_(g.total + (Number(r[C.ILS]) || 0));
    g.items.push({
      id: String(r[C.ID]), date: r[C.DATE] instanceof Date ? Utilities.formatDate(r[C.DATE], 'Asia/Jerusalem', 'dd/MM/yy') : String(r[C.DATE]),
      detail: String(r[C.DETAIL] || ''), amount: Number(r[C.ILS]) || 0, orig: r[C.ORIG], cur: r[C.CUR], card: String(r[C.CARD])
    });
  });
  var list = order.map(function (k) { return groups[k]; });
  list.sort(function (a, b) { return Math.abs(b.total) - Math.abs(a.total); });
  var cats = getCategories_().filter(function (c) { return c.name !== OTHER_CAT; })
    .map(function (c) { return { name: c.name, color: c.color, hex: COLOR_HEX[c.color] || COLOR_HEX['–'] }; });
  var txCount = list.reduce(function (s, g) { return s + g.count; }, 0);
  return { groups: list, categories: cats, txCount: txCount };
}

/**
 * החלטה מסרגל הצד: d = {ids, category, scope:'always'|'once', merchant, recipient, isTransfer}
 */
function applyReviewDecision(d) {
  return withLock_(function () {
    applyCategoryToIds_(d.ids, d.category);
    if (d.scope === 'always' && d.category !== OTHER_CAT) {
      if (d.isTransfer) { if (d.recipient) addDictEntry_(d.recipient, d.category, FIELD.RECIPIENT); }
      else addDictEntry_(d.merchant, d.category, FIELD.MERCHANT);
    }
    return { ok: true };
  });
}

function applyCategoryToIds_(ids, category) {
  var sh = sheet_(SHEETS.TX);
  var n = sh.getLastRow() - 1;
  if (n < 1) return;
  var idCol = sh.getRange(2, C.ID + 1, n, 1).getValues();
  var want = {};
  ids.forEach(function (id) { want[String(id)] = 1; });
  var colors = categoryColors_();
  var block = sh.getRange(2, C.CAT + 1, n, 3).getValues();
  var changed = false;
  idCol.forEach(function (r, i) {
    if (want[String(r[0])]) { block[i] = [category, colors[category] || COLOR_NAMES.NONE, BY.MANUAL]; changed = true; }
  });
  if (changed) sh.getRange(2, C.CAT + 1, n, 3).setValues(block);
}

function addDictEntry_(pattern, category, field) {
  pattern = String(pattern || '').trim();
  if (!pattern) return;
  var sh = sheet_(SHEETS.DICT);
  var n = sh.getLastRow() - 1;
  if (n > 0) {
    var vals = sh.getRange(2, 1, n, 4).getValues();
    for (var i = 0; i < vals.length; i++) {
      if (norm_(vals[i][0]) === norm_(pattern) && (vals[i][3] || FIELD.MERCHANT) === field) {
        sh.getRange(i + 2, 2, 1, 2).setValues([[MATCH.EXACT, category]]);
        return;
      }
    }
  }
  sh.appendRow([pattern, MATCH.EXACT, category, field, 'ידני', new Date()]);
}

/** כמה עסקאות מחכות לסיווג */
function pendingCount_() {
  return readTx_().filter(function (r) { return r[C.CAT] === REVIEW_CAT; }).length;
}

/** מסרגל הצד בסיום: מעדכן את הדשבורד */
function refreshFromSidebar() {
  classifyAll_();
  buildAnalysisAndDashboard_();
  return { pending: pendingCount_() };
}

/* ---------- גיליון "לבירור" (גיבוי לסרגל הצד) ---------- */

function rebuildReviewSheet_(data) {
  var sh = ss_().getSheetByName(SHEETS.REVIEW);
  if (!sh) return;
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent().clearDataValidations();
  styleHeader_(sh, REVIEW_HEADERS);
  var rows = data.filter(function (r) { return r[C.CAT] === REVIEW_CAT; }).map(function (r) {
    return [r[C.ID], r[C.DATE], r[C.MERCHANT], r[C.DETAIL], r[C.ILS], r[C.BRANCH], r[C.SUGGEST], '', ''];
  });
  if (rows.length) {
    sh.getRange(2, 1, rows.length, REVIEW_HEADERS.length).setValues(rows);
    sh.getRange(2, 2, rows.length, 1).setNumberFormat('dd/MM/yyyy');
    sh.getRange(2, 5, rows.length, 1).setNumberFormat('₪#,##0.00;[Red]-₪#,##0.00');
    sh.getRange(2, 8, rows.length, 1).setDataValidation(categoryValidation_(false)).setBackground('#fff8e1');
    sh.getRange(2, 9, rows.length, 1).setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInList([APPLY_ONCE, APPLY_ALWAYS], true).build()).setBackground('#fff8e1');
  }
  sh.getRange(1, 1, Math.max(rows.length, 1) + 1, REVIEW_HEADERS.length).setFontFamily(FONT);
  sh.setColumnWidth(1, 70); sh.setColumnWidth(3, 200); sh.setColumnWidth(4, 240); sh.setColumnWidth(8, 150); sh.setColumnWidth(9, 160);
  sh.hideColumns(1);
}

/** תפריט: החל סיווגים מגיליון לבירור */
function menuApplyFromReviewSheet() {
  var sh = sheet_(SHEETS.REVIEW);
  var n = sh.getLastRow() - 1;
  if (n < 1) { toast_('אין עסקאות בגיליון לבירור.'); return; }
  var vals = sh.getRange(2, 1, n, REVIEW_HEADERS.length).getValues();
  var tx = readTx_(), byId = {};
  tx.forEach(function (r) { byId[String(r[C.ID])] = r; });
  var count = 0;
  vals.forEach(function (v) {
    var cat = String(v[7] || '').trim();
    if (!cat) return;
    var r = byId[String(v[0])];
    if (!r) return;
    var transfer = isTransfer_(r[C.MERCHANT], r[C.BRANCH]);
    applyReviewDecision({ ids: [v[0]], category: cat, scope: v[8] === APPLY_ALWAYS ? 'always' : 'once',
      merchant: r[C.MERCHANT], recipient: transfer ? transferRecipient_(r[C.DETAIL]) : '', isTransfer: transfer });
    count++;
  });
  var res = classifyAll_();
  toast_('הוחלו ' + count + ' סיווגים. נשארו ' + res.pending + ' לבירור.');
}

/* ===================== Fixed.gs ===================== */
/**
 * Fixed.gs – הוצאות קבועות שלא עוברות בכרטיס האשראי (למשל שכירות שיורדת ישירות מהבנק).
 * רושמים אותן פעם אחת בגיליון "הוצאות קבועות", ובכל עדכון ניתוח נוספת עסקה לכל חודש
 * מחודש ההתחלה ועד החודש הנוכחי (או עד חודש הסיום). כל חודש נוסף פעם אחת בלבד.
 */

var FIXED_HEADERS = ['שם', 'קטגוריה', 'סכום חודשי ₪', 'יום בחודש', 'החל מחודש (YYYY-MM)', 'עד חודש (ריק = ללא סוף)'];
var FIXED_SRC = 'הוצאות קבועות';

/** תפריט: פותח את גיליון ההוצאות הקבועות (יוצר אותו אם חסר) */
function menuFixed() {
  var sh = setupFixedSheet_();
  ss_().setActiveSheet(sh);
  toast_('ממלאים שורה לכל הוצאה קבועה, ואז "3. עדכון ניתוח ודשבורד".', 'הוצאות קבועות', 8);
}

function setupFixedSheet_() {
  var sh = getOrCreate_(SHEETS.FIXED);
  styleHeader_(sh, FIXED_HEADERS);
  var n = 50;
  sh.getRange(2, 2, n, 1).setDataValidation(categoryValidation_(false));
  sh.getRange(2, 3, n, 1).setNumberFormat('₪#,##0.00');
  sh.getRange(2, 4, n, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireNumberBetween(1, 31)
    .setHelpText('יום בחודש: 1 עד 31').build());
  sh.getRange(2, 5, n, 2).setNumberFormat('@');
  sh.getRange(1, 1, n + 1, FIXED_HEADERS.length).setFontFamily(FONT);
  sh.setColumnWidth(1, 180); sh.setColumnWidths(2, 5, 140);
  return sh;
}

/** "2025-12" / "12/2025" / Date → {y, m} או null */
function parseMonth_(v) {
  if (v instanceof Date) return { y: v.getFullYear(), m: v.getMonth() + 1 };
  var s = String(v || '').trim(), a;
  if ((a = s.match(/^(\d{4})[-\/.](\d{1,2})$/))) return { y: +a[1], m: +a[2] };
  if ((a = s.match(/^(\d{1,2})[-\/.](\d{4})$/))) return { y: +a[2], m: +a[1] };
  return null;
}

/** מוסיף לגיליון "עסקאות" את החודשים שחסרים לכל הוצאה קבועה. מחזיר כמה נוספו */
function syncFixedExpenses_() {
  var sh = ss_().getSheetByName(SHEETS.FIXED);
  if (!sh || sh.getLastRow() < 2) return 0;
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, FIXED_HEADERS.length).getValues();
  var now = new Date();
  var records = [], catById = {};
  rows.forEach(function (r) {
    var name = String(r[0] || '').trim(), cat = String(r[1] || '').trim(), amount = parseAmount_(r[2]);
    var from = parseMonth_(r[4]);
    if (!name || !cat || isNaN(amount) || !from) return;
    var to = parseMonth_(r[5]) || { y: now.getFullYear(), m: now.getMonth() + 1 };
    var day = Math.min(Math.max(Number(r[3]) || 1, 1), 31);
    for (var y = from.y, m = from.m; y < to.y || (y === to.y && m <= to.m); m === 12 ? (y++, m = 1) : m++) {
      var last = new Date(y, m, 0).getDate();
      var d = new Date(y, m - 1, Math.min(day, last), 12);
      if (d > now) break; // לא מוסיפים חיוב שעוד לא קרה
      var id = 'fixed|' + norm_(name) + '|' + y + '-' + pad2_(m);
      catById[id] = cat;
      records.push({
        'מזהה': id, 'כרטיס': '', 'מועד חיוב דף': '', 'סוג': 'רגיל', 'תאריך עסקה': d,
        'בית עסק': name, 'ענף': 'הוצאה קבועה', 'פירוט': 'הוצאה קבועה (בנק)', 'כרטיס הוצג': '',
        'סכום עסקה': amount, 'מטבע': 'ILS', 'סכום חיוב ₪': amount, 'תאריך חיוב': '', 'קובץ מקור': FIXED_SRC
      });
    }
  });
  if (!records.length) return 0;
  var res = importRecords_(records, FIXED_SRC);
  if (res.imported) {
    // קטגוריה ישירות מהגיליון, כ"ידני" – סיווג אוטומטי לא ידרוס
    var byCat = {};
    readTx_().forEach(function (r) {
      var id = String(r[C.ID]);
      if (catById[id] && !r[C.CAT]) (byCat[catById[id]] = byCat[catById[id]] || []).push(id);
    });
    Object.keys(byCat).forEach(function (cat) { applyCategoryToIds_(byCat[cat], cat); });
  }
  return res.imported;
}

/* ===================== Analysis.gs ===================== */
/**
 * Analysis.gs – שלב 3: טבלאות סיכום (סיכום חודשי, סיכום שבועי, דפוסים).
 * הגיליונות נבנים מחדש בכל ריצה, כערכים ולא כנוסחאות. הניתוח לפי תאריך העסקה.
 */

/** תפריט: 3. עדכון ניתוח ודשבורד */
function menuAnalysis() {
  buildAnalysisAndDashboard_();
  toast_('הניתוח והדשבורד עודכנו ✓');
  ss_().setActiveSheet(sheet_(SHEETS.DASH));
}

function buildAnalysisAndDashboard_() {
  syncFixedExpenses_();
  var data = readTx_().filter(function (r) { return r[C.DATE] instanceof Date; });
  var cats = getCategories_();
  var months = uniqueSorted_(data.map(function (r) { return String(r[C.MONTH]); }));
  buildMonthly_(data, cats, months);
  buildWeekly_(data);
  var recurring = findRecurring_(data, months);
  buildPatterns_(data, recurring);
  buildDashboard_(cats, months, recurring);
}

function uniqueSorted_(arr) {
  var o = {};
  arr.forEach(function (v) { if (v) o[v] = 1; });
  return Object.keys(o).sort();
}

function resetSheet_(name) {
  var sh = ss_().getSheetByName(name) || getOrCreate_(name);
  sh.getCharts().forEach(function (c) { sh.removeChart(c); });
  sh.clearConditionalFormatRules();
  sh.getBandings().forEach(function (b) { b.remove(); });
  var f = sh.getFilter(); if (f) f.remove();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
  sh.clear();
  sh.setRightToLeft(true);
  sh.setHiddenGridlines(true);
  return sh;
}

function colorOf_(r, colors) {
  if (r[C.CAT] === REVIEW_CAT || !r[C.CAT]) return REVIEW_CAT;
  return r[C.COLOR] || colors[r[C.CAT]] || COLOR_NAMES.NONE;
}

/* ---------- סיכום חודשי ---------- */

function buildMonthly_(data, cats, months) {
  var sh = resetSheet_(SHEETS.MONTHLY);
  var sums = {}; // cat → month → sum
  data.forEach(function (r) {
    var cat = r[C.CAT] || REVIEW_CAT, m = String(r[C.MONTH]);
    sums[cat] = sums[cat] || {};
    sums[cat][m] = (sums[cat][m] || 0) + (Number(r[C.ILS]) || 0);
  });
  var last = months.length - 1;
  var header = ['קטגוריה', 'צבע'].concat(months, ['שינוי ₪', 'שינוי %', 'ממוצע 3 חודשים', 'מול הממוצע ₪']);
  var out = [header], styles = [];

  function lineFor(label, color, getter) {
    var vals = months.map(function (m) { return round2_(getter(m)); });
    var cur = last >= 0 ? vals[last] : 0, prev = last >= 1 ? vals[last - 1] : 0;
    var prev3 = vals.slice(Math.max(0, last - 3), Math.max(0, last));
    var avg3 = prev3.length ? round2_(prev3.reduce(function (s, v) { return s + v; }, 0) / prev3.length) : '';
    return [label, color].concat(vals, [round2_(cur - prev), prev ? (cur - prev) / Math.abs(prev) : '',
      avg3, avg3 === '' ? '' : round2_(cur - avg3)]);
  }
  function catGetter(names) {
    return function (m) { return names.reduce(function (s, n) { return s + ((sums[n] || {})[m] || 0); }, 0); };
  }

  var groups = ['ירוק', 'צהוב', 'אדום', COLOR_NAMES.NONE];
  groups.forEach(function (g) {
    var names = cats.filter(function (c) { return c.color === g; }).map(function (c) { return c.name; });
    if (!names.length) return;
    names.forEach(function (n) { out.push(lineFor(n, g, catGetter([n]))); styles.push({ type: 'cat', color: g }); });
    if (g !== COLOR_NAMES.NONE) { out.push(lineFor('סה"כ ' + g, g, catGetter(names))); styles.push({ type: 'sub', color: g }); }
  });
  out.push(lineFor(REVIEW_CAT, '', catGetter([REVIEW_CAT]))); styles.push({ type: 'cat', color: '' });
  var allNames = cats.map(function (c) { return c.name; }).concat([REVIEW_CAT]);
  out.push(lineFor('סה"כ כללי', '', catGetter(allNames))); styles.push({ type: 'total' });

  var w = header.length;
  sh.getRange(1, 1, 1, w).setNumberFormat('@');
  sh.getRange(1, 1, out.length, w).setValues(out).setFontFamily(FONT);
  styleHeader_(sh, header);
  if (months.length) sh.getRange(2, 3, out.length - 1, months.length).setNumberFormat('₪#,##0;[Red]-₪#,##0');
  sh.getRange(2, 3 + months.length, out.length - 1, 1).setNumberFormat('+₪#,##0;-₪#,##0');
  sh.getRange(2, 4 + months.length, out.length - 1, 1).setNumberFormat('+0%;-0%');
  sh.getRange(2, 5 + months.length, out.length - 1, 1).setNumberFormat('₪#,##0');
  sh.getRange(2, 6 + months.length, out.length - 1, 1).setNumberFormat('+₪#,##0;-₪#,##0');
  styles.forEach(function (s, i) {
    var row = sh.getRange(i + 2, 1, 1, w);
    if (s.type === 'sub') row.setFontWeight('bold').setBackground(COLOR_LIGHT[s.color]).setBorder(true, null, null, null, null, null);
    if (s.type === 'total') row.setFontWeight('bold').setBackground('#e8eaed').setBorder(true, null, true, null, null, null);
    if (s.color && COLOR_HEX[s.color]) sh.getRange(i + 2, 2).setFontColor(COLOR_HEX[s.color]).setFontWeight('bold');
  });
  sh.setFrozenColumns(2);
  sh.setColumnWidth(1, 160);
  sh.setColumnWidth(2, 50);
  if (w > 2) sh.setColumnWidths(3, w - 2, 95);
}

/* ---------- סיכום שבועי ---------- */

function buildWeekly_(data) {
  var sh = resetSheet_(SHEETS.WEEKLY);
  var colors = categoryColors_();
  var weeks = {};
  data.forEach(function (r) {
    var k = ymd_(r[C.WEEK] instanceof Date ? r[C.WEEK] : weekStart_(r[C.DATE]));
    var w = weeks[k] = weeks[k] || { d: weekStart_(r[C.DATE]), g: 0, y: 0, r: 0, n: 0, q: 0, cnt: 0 };
    var a = Number(r[C.ILS]) || 0, c = colorOf_(r, colors);
    if (c === 'ירוק') w.g += a; else if (c === 'צהוב') w.y += a; else if (c === 'אדום') w.r += a;
    else if (c === REVIEW_CAT) w.q += a; else w.n += a;
    w.cnt++;
  });
  var header = ['שבוע (מתחיל בא\')', 'עד', 'ירוק', 'צהוב', 'אדום', 'מזומן / אחר', 'לבירור', 'סה"כ', 'מס\' עסקאות'];
  var rows = Object.keys(weeks).sort().map(function (k) {
    var w = weeks[k], end = new Date(w.d.getTime()); end.setDate(end.getDate() + 6);
    return [w.d, end, round2_(w.g), round2_(w.y), round2_(w.r), round2_(w.n), round2_(w.q), round2_(w.g + w.y + w.r + w.n + w.q), w.cnt];
  });
  styleHeader_(sh, header);
  if (rows.length) {
    sh.getRange(2, 1, rows.length, header.length).setValues(rows).setFontFamily(FONT);
    sh.getRange(2, 1, rows.length, 2).setNumberFormat('dd/MM/yy');
    sh.getRange(2, 3, rows.length, 6).setNumberFormat('₪#,##0;[Red]-₪#,##0');
    sh.getRange(2, 8, rows.length, 1).setFontWeight('bold');
  }
  [['ירוק', 3], ['צהוב', 4], ['אדום', 5]].forEach(function (p) {
    sh.getRange(1, p[1]).setBackground(COLOR_HEX[p[0]]);
  });
  sh.setColumnWidths(1, header.length, 100);
}

/* ---------- דפוסים ---------- */

/** חיובים חוזרים: אותו בית עסק ב-3 חודשים לפחות, סכום חודשי דומה (±15%) */
function findRecurring_(data, months) {
  var lastMonth = months[months.length - 1] || '';
  var prevMonth = months[months.length - 2] || '';
  var by = {};
  data.forEach(function (r) {
    var a = Number(r[C.ILS]) || 0;
    if (a <= 0 || r[C.CAT] === CASH_CAT || isTransfer_(r[C.MERCHANT], r[C.BRANCH])) return;
    var k = norm_(r[C.MERCHANT]);
    var o = by[k] = by[k] || { name: String(r[C.MERCHANT]), m: {}, cats: {} };
    o.m[r[C.MONTH]] = (o.m[r[C.MONTH]] || 0) + a;
    o.cats[r[C.CAT]] = (o.cats[r[C.CAT]] || 0) + 1;
  });
  var list = [];
  Object.keys(by).forEach(function (k) {
    var o = by[k], ms = Object.keys(o.m).sort();
    if (ms.length < 3) return;
    var vals = ms.map(function (m) { return o.m[m]; });
    var med = median_(vals);
    var similar = ms.filter(function (m) { return Math.abs(o.m[m] - med) <= 0.15 * med; });
    if (similar.length < 3) return;
    var lastM = ms[ms.length - 1], lastV = o.m[lastM];
    var prevV = ms.length > 1 ? o.m[ms[ms.length - 2]] : lastV;
    var alert = lastV > prevV * 1.01 && lastV - prevV >= 1
      ? '⚠ עליית מחיר: ' + round2_(prevV) + ' → ' + round2_(lastV) : '';
    var cat = Object.keys(o.cats).sort(function (a, b) { return o.cats[b] - o.cats[a]; })[0];
    list.push({ name: o.name, cat: cat, months: ms.length, monthly: round2_(med), last: round2_(lastV),
      yearly: round2_(med * 12), lastSeen: lastM, active: lastM === lastMonth || lastM === prevMonth, alert: alert });
  });
  list.sort(function (a, b) { return b.monthly - a.monthly; });
  return list;
}

function median_(arr) {
  var s = arr.slice().sort(function (a, b) { return a - b; });
  var n = s.length;
  return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0;
}

function buildPatterns_(data, recurring) {
  var sh = resetSheet_(SHEETS.PATTERNS);
  var row = 1;
  var fmtDate = function (d) { return d instanceof Date ? d : ''; };

  // 1. חיובים חוזרים
  row = writeSection_(sh, row, 'חיובים חוזרים ומנויים',
    ['בית עסק', 'קטגוריה', 'מס\' חודשים', 'סכום חודשי (חציון)', 'חיוב אחרון', 'סכום שנתי', 'נראה לאחרונה', 'פעיל?', 'התראה'],
    recurring.map(function (x) { return [x.name, x.cat, x.months, x.monthly, x.last, x.yearly, x.lastSeen, x.active ? 'כן' : '', x.alert]; }),
    { money: [4, 5, 6], text: [7] });

  // 2. 10 בתי העסק המובילים
  var byM = {};
  data.forEach(function (r) {
    var k = norm_(r[C.MERCHANT]);
    var o = byM[k] = byM[k] || { name: r[C.MERCHANT], cat: r[C.CAT], n: 0, s: 0 };
    o.n++; o.s += Number(r[C.ILS]) || 0;
  });
  var top = Object.keys(byM).map(function (k) { return byM[k]; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 10);
  row = writeSection_(sh, row, '10 בתי העסק המובילים (לפי סכום)', ['בית עסק', 'קטגוריה', 'מס\' עסקאות', 'סכום ₪'],
    top.map(function (o) { return [o.name, o.cat, o.n, round2_(o.s)]; }), { money: [4] });

  // 3. עסקאות חריגות: מעל פי 3 מהממוצע בקטגוריה
  var catSt = {};
  data.forEach(function (r) {
    var a = Number(r[C.ILS]) || 0; if (a <= 0) return;
    var s = catSt[r[C.CAT]] = catSt[r[C.CAT]] || { n: 0, s: 0 }; s.n++; s.s += a;
  });
  var outl = [];
  data.forEach(function (r) {
    var a = Number(r[C.ILS]) || 0, s = catSt[r[C.CAT]];
    if (a <= 0 || !s || s.n < 3) return;
    var avg = s.s / s.n;
    if (a > RULES.BIG_MULTIPLIER * avg) outl.push([fmtDate(r[C.DATE]), r[C.MERCHANT], r[C.CAT], round2_(a), round2_(avg), round2_(a / avg)]);
  });
  outl.sort(function (a, b) { return b[3] - a[3]; });
  row = writeSection_(sh, row, 'עסקאות חריגות (מעל פי 3 מהממוצע בקטגוריה)',
    ['תאריך', 'בית עסק', 'קטגוריה', 'סכום ₪', 'ממוצע בקטגוריה', 'פי כמה'], outl.slice(0, 40), { money: [4, 5], date: [1] });

  // 4. חשד לחיוב כפול: אותו בית עסק, אותו סכום, אותו יום
  var dup = {};
  data.forEach(function (r) {
    var a = Number(r[C.ILS]) || 0; if (a <= 0) return;
    var k = ymd_(r[C.DATE]) + '|' + norm_(r[C.MERCHANT]) + '|' + a.toFixed(2);
    var o = dup[k] = dup[k] || { d: r[C.DATE], m: r[C.MERCHANT], a: a, n: 0, cards: {} };
    o.n++; o.cards[r[C.CARD]] = 1;
  });
  var dups = Object.keys(dup).map(function (k) { return dup[k]; }).filter(function (o) { return o.n > 1; })
    .map(function (o) { return [o.d, o.m, round2_(o.a), o.n, Object.keys(o.cards).join(', ')]; });
  row = writeSection_(sh, row, 'חשד לחיוב כפול (אותו בית עסק, אותו סכום, אותו יום)',
    ['תאריך', 'בית עסק', 'סכום ₪', 'מס\' פעמים', 'כרטיסים'], dups, { money: [3], date: [1] });

  // 5. קניות קטנות ותכופות: 5+ עסקאות מתחת ל-₪50 בחודש
  var small = {};
  data.forEach(function (r) {
    var a = Number(r[C.ILS]) || 0; if (a <= 0 || a >= 50) return;
    var k = r[C.MONTH] + '|' + norm_(r[C.MERCHANT]);
    var o = small[k] = small[k] || { m: r[C.MONTH], name: r[C.MERCHANT], n: 0, s: 0 }; o.n++; o.s += a;
  });
  var smalls = Object.keys(small).map(function (k) { return small[k]; }).filter(function (o) { return o.n >= 5; })
    .sort(function (a, b) { return a.m < b.m ? 1 : a.m > b.m ? -1 : b.s - a.s; })
    .map(function (o) { return [o.m, o.name, o.n, round2_(o.s)]; });
  row = writeSection_(sh, row, 'קניות קטנות ותכופות (5 עסקאות לפחות מתחת ל-₪50 בחודש)',
    ['חודש', 'בית עסק', 'מס\' עסקאות', 'סכום ₪'], smalls, { money: [4], text: [1] });

  // 6. עמלות מט"ח ודמי כרטיס – לפי שנה
  var fees = {};
  data.forEach(function (r) {
    var y = String(r[C.DATE].getFullYear()), a = Number(r[C.ILS]) || 0, det = String(r[C.DETAIL] || '');
    var o = fees[y] = fees[y] || { card: 0, fxN: 0, fxS: 0, fxFee: 0 };
    if (/דמי כרטיס/.test(r[C.MERCHANT] + ' ' + det)) o.card += a;
    if (r[C.CUR] && r[C.CUR] !== 'ILS') {
      o.fxN++; o.fxS += a;
      var pct = det.match(/עמל[^\d%]{0,25}([\d.]+)\s*%/);
      var abs = det.match(/עמל[^\d%]{0,25}([\d.,]+)(?!\s*%)/);
      if (pct) { var p = Number(pct[1]) / 100; o.fxFee += a * p / (1 + p); }
      else if (abs) { var v = parseAmount_(abs[1]); if (!isNaN(v) && v < a) o.fxFee += v; }
    }
  });
  row = writeSection_(sh, row, 'עמלות מט"ח ודמי כרטיס (לפי שנה)',
    ['שנה', 'דמי כרטיס ₪', 'עסקאות מט"ח', 'סכום עסקאות מט"ח ₪', 'עמלות המרה ₪ (הערכה מתוך הפירוט)'],
    Object.keys(fees).sort().map(function (y) { var o = fees[y]; return [y, round2_(o.card), o.fxN, round2_(o.fxS), round2_(o.fxFee)]; }),
    { money: [2, 4, 5], text: [1] });

  // 7. ימי השבוע
  var days = HEB_DAYS.map(function () { return { s: 0, n: 0, dates: {} }; });
  var minD = null, maxD = null;
  data.forEach(function (r) {
    var d = r[C.DATE], o = days[d.getDay()];
    o.s += Number(r[C.ILS]) || 0; o.n++; o.dates[ymd_(d)] = 1;
    if (!minD || d < minD) minD = d; if (!maxD || d > maxD) maxD = d;
  });
  var nWeeks = minD ? Math.max(1, Math.round((maxD - minD) / (7 * 864e5))) : 1;
  row = writeSection_(sh, row, 'ימי השבוע', ['יום', 'סכום ₪', 'מס\' עסקאות', 'ממוצע לעסקה', 'ממוצע לשבוע'],
    days.map(function (o, i) { return [HEB_DAYS[i], round2_(o.s), o.n, o.n ? round2_(o.s / o.n) : 0, round2_(o.s / nWeeks)]; }),
    { money: [2, 4, 5] });

  sh.setColumnWidth(1, 120); sh.setColumnWidth(2, 200); sh.setColumnWidths(3, 7, 115); sh.setColumnWidth(9, 240);
}

/** כותב כותרת מקטע + טבלה. מחזיר את השורה הפנויה הבאה */
function writeSection_(sh, row, title, headers, rows, fmt) {
  sh.getRange(row, 1).setValue(title).setFontFamily(FONT).setFontSize(13).setFontWeight('bold').setFontColor('#1a73e8');
  row++;
  sh.getRange(row, 1, 1, headers.length).setValues([headers]).setFontFamily(FONT).setFontWeight('bold')
    .setBackground('#202124').setFontColor('#ffffff').setHorizontalAlignment('center').setWrap(true);
  row++;
  if (!rows.length) {
    sh.getRange(row, 1).setValue('אין').setFontColor('#80868b').setFontFamily(FONT);
    return row + 2;
  }
  var rng = sh.getRange(row, 1, rows.length, headers.length);
  (fmt.text || []).forEach(function (c) { sh.getRange(row, c, rows.length, 1).setNumberFormat('@'); });
  rng.setValues(rows).setFontFamily(FONT);
  (fmt.money || []).forEach(function (c) { sh.getRange(row, c, rows.length, 1).setNumberFormat('₪#,##0.00'); });
  (fmt.date || []).forEach(function (c) { sh.getRange(row, c, rows.length, 1).setNumberFormat('dd/MM/yyyy'); });
  rng.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false);
  return row + rows.length + 2;
}

/* ===================== Dashboard.gs ===================== */
/**
 * Dashboard.gs – שלב 3: גיליון "דשבורד" – המסך הסופי.
 * תא בחירת חודש (C3) שכל הכרטיסים, הטבלאות והגרפים מחושבים לפיו בנוסחאות,
 * כך שהחלפת חודש מעדכנת הכל מיד, בלי להריץ קוד. הגרפים נמחקים ונבנים מחדש בכל ריצה.
 * בעמודות N ואילך יש נתוני עזר לגרפים (לא לעריכה).
 */

var DASH = { SEL: 'C3', PREV: 'G3', W_NAME: 170, W_COL: 95 };

var SHADES = {
  'ירוק': ['#137333', '#34a853', '#5bb974', '#81c995', '#a8dab5', '#ceead6'],
  'צהוב': ['#e37400', '#f9ab00', '#fbbc04', '#fdd663', '#fde293', '#feefc3'],
  'אדום': ['#a50e0e', '#d93025', '#ea4335', '#ee675c', '#f28b82', '#fad2cf'],
  '–': ['#5f6368', '#9aa0a6', '#bdc1c6', '#dadce0']
};

function buildDashboard_(cats, months, recurring) {
  var sh = resetSheet_(SHEETS.DASH);
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
  if (sh.getMaxColumns() < 26) sh.insertColumnsAfter(sh.getMaxColumns(), 26 - sh.getMaxColumns());
  sh.getRange(1, 1, 120, 26).setFontFamily(FONT).setVerticalAlignment('middle');
  sh.setColumnWidth(1, DASH.W_NAME); sh.setColumnWidth(2, 70); sh.setColumnWidths(3, 10, DASH.W_COL);
  sh.setColumnWidth(13, 40);

  // כותרת
  sh.getRange('A1:L1').merge().setValue('דשבורד הוצאות').setFontSize(22).setFontWeight('bold')
    .setBackground('#202124').setFontColor('#ffffff').setHorizontalAlignment('center');
  sh.setRowHeight(1, 52);
  sh.getRange('A2:L2').merge().setValue('עודכן: ' + Utilities.formatDate(new Date(), 'Asia/Jerusalem', 'dd/MM/yyyy HH:mm'))
    .setFontColor('#80868b').setHorizontalAlignment('center').setFontSize(9);

  if (!months.length) {
    sh.getRange('A4:L4').merge().setValue('אין עדיין נתונים. תפריט "ניהול הוצאות" ← "עדכן הכל" כדי לייבא קבצים.')
      .setHorizontalAlignment('center').setFontSize(14);
    return;
  }

  var T = "'" + SHEETS.TX + "'!";
  var L = function (c) { return T + columnLetter_(c + 1) + '2:' + columnLetter_(c + 1); };
  var AMT = L(C.ILS), MON = L(C.MONTH), CAT = L(C.CAT), COL = L(C.COLOR), MER = L(C.MERCHANT);
  var sumWhere = function (monthRef, extra) {
    return 'SUM(IFERROR(FILTER(' + AMT + ',' + MON + '=' + monthRef + (extra || '') + '),0))';
  };

  // רשימת חודשים (עזר) – Y11:Y
  var m = months.length, monFirst = 11, monLast = 10 + m;
  var MLIST = '$Y$' + monFirst + ':$Y$' + monLast;
  sh.getRange('Y10').setValue('חודשים');
  // מהחדש לישן – כך גם הרשימה הנפתחת: החודש האחרון למעלה
  var desc = months.slice().reverse();
  sh.getRange(monFirst, 25, m, 1).setNumberFormat('@').setValues(desc.map(function (x) { return [x]; }));

  // בחירת חודש
  sh.getRange('B3').setValue('חודש:').setFontWeight('bold').setHorizontalAlignment('left');
  sh.getRange('C3:D3').merge();
  sh.getRange(DASH.SEL).setNumberFormat('@').setValue(months[m - 1])
    .setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(sh.getRange(monFirst, 25, m, 1), true).setAllowInvalid(false).build())
    .setBackground('#e8f0fe').setFontWeight('bold').setFontSize(13).setHorizontalAlignment('center')
    .setBorder(true, true, true, true, null, null, '#1a73e8', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sh.getRange('E3').setValue('◄ בחרו חודש מהרשימה').setFontColor('#80868b').setFontSize(9);
  sh.getRange('F3').setValue('חודש קודם:').setHorizontalAlignment('left').setFontColor('#5f6368');
  sh.getRange(DASH.PREV).setFormula('=IFERROR(IF(MATCH($C$3,' + MLIST + ',0)<' + m + ',INDEX(' + MLIST + ',MATCH($C$3,' + MLIST + ',0)+1),""),"")')
    .setFontColor('#5f6368').setNumberFormat('@');
  sh.getRange('N3').setFormula('=' + sumWhere('$G$3')); // סה"כ החודש הקודם (עזר)
  sh.getRange('N2').setValue('סה"כ חודש קודם (עזר)');

  // כרטיסים
  var cards = [
    ['A', 'סה"כ החודש', '=' + sumWhere('$C$3'), '="' + 'כל העסקאות' + '"', '#202124', '#ffffff'],
    ['C', 'ירוק – קבוע', '=' + sumWhere('$C$3', ',' + COL + '="ירוק"'), '=IFERROR(C6/$A$6,"")', COLOR_LIGHT['ירוק'], '#137333'],
    ['E', 'צהוב – חיוני', '=' + sumWhere('$C$3', ',' + COL + '="צהוב"'), '=IFERROR(E6/$A$6,"")', COLOR_LIGHT['צהוב'], '#b06000'],
    ['G', 'אדום – מותרות', '=' + sumWhere('$C$3', ',' + COL + '="אדום"'), '=IFERROR(G6/$A$6,"")', COLOR_LIGHT['אדום'], '#a50e0e'],
    ['I', 'שינוי מול החודש הקודם', '=IF($G$3="","",A6-$N$3)', '=IFERROR(I6/$N$3,"")', '#f1f3f4', '#202124'],
    ['K', 'מחכות לסיווג', '=COUNTIF(' + CAT + ',"' + REVIEW_CAT + '")', '="עסקאות (בכל החודשים)"', '#f1f3f4', '#202124']
  ];
  cards.forEach(function (c) {
    var col = c[0], col2 = String.fromCharCode(col.charCodeAt(0) + 1);
    var box = sh.getRange(col + '5:' + col2 + '7');
    box.setBackground(c[4]).setFontColor(c[5]).setHorizontalAlignment('center')
      .setBorder(true, true, true, true, null, null, '#ffffff', SpreadsheetApp.BorderStyle.SOLID_THICK);
    sh.getRange(col + '5:' + col2 + '5').merge().setValue(c[1]).setFontSize(10).setFontWeight('bold');
    sh.getRange(col + '6:' + col2 + '6').merge().setFormula(c[2]).setFontSize(20).setFontWeight('bold');
    sh.getRange(col + '7:' + col2 + '7').merge().setFormula(c[3]).setFontSize(9);
  });
  sh.getRange('A6:H6').setNumberFormat('₪#,##0');
  sh.getRange('C7:H7').setNumberFormat('0% "מהסה״כ"');
  sh.getRange('I6').setNumberFormat('+₪#,##0;-₪#,##0;₪0');
  sh.getRange('I7').setNumberFormat('+0.0%;-0.0%;0%');
  sh.setRowHeight(5, 24); sh.setRowHeight(6, 44); sh.setRowHeight(7, 22);

  var rules = [];
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0).setBackground('#d93025').setFontColor('#ffffff')
    .setRanges([sh.getRange('K5:L7')]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=AND(ISNUMBER($I$6),$I$6>0)').setFontColor('#d93025')
    .setRanges([sh.getRange('I6:J7')]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=AND(ISNUMBER($I$6),$I$6<0)').setFontColor('#137333')
    .setRanges([sh.getRange('I6:J7')]).build());

  // תקציב מול ביצוע
  var list = cats.slice();
  list.push({ name: REVIEW_CAT, color: '', budget: 0 });
  var k = list.length, t0 = 11, t1 = 10 + k, tTot = t1 + 1;
  sectionTitle_(sh, 'A9', 'תקציב מול ביצוע');
  sh.getRange('A10:F10').setValues([['קטגוריה', 'צבע', 'ביצוע ₪', 'תקציב ₪', 'ניצול', 'שינוי מול קודם']])
    .setFontWeight('bold').setBackground('#202124').setFontColor('#ffffff').setHorizontalAlignment('center');
  var SET = "'" + SHEETS.SETTINGS + "'!$A:$D";
  var rowsF = list.map(function (c, i) {
    var r = t0 + i;
    return [
      '=' + sumWhere('$C$3', ',' + CAT + '=$A' + r),
      c.name === REVIEW_CAT ? '' : '=IFERROR(1/(1/VLOOKUP($A' + r + ',' + SET + ',4,FALSE)),"")',
      '=IF(ISNUMBER(D' + r + '),C' + r + '/D' + r + ',"")',
      '=IF($G$3="","",C' + r + '-' + sumWhere('$G$3', ',' + CAT + '=$A' + r) + ')'
    ];
  });
  sh.getRange(t0, 1, k, 2).setValues(list.map(function (c) { return [c.name, c.color]; }));
  sh.getRange(t0, 3, k, 4).setFormulas(rowsF);
  sh.getRange(tTot, 1, 1, 6).setValues([['סה"כ', '', '=SUM(C' + t0 + ':C' + t1 + ')', '=SUM(D' + t0 + ':D' + t1 + ')',
    '=IFERROR(C' + tTot + '/D' + tTot + ',"")', '=IF($G$3="","",SUM(F' + t0 + ':F' + t1 + '))']])
    .setFontWeight('bold').setBackground('#e8eaed');
  sh.getRange(t0, 3, k + 1, 2).setNumberFormat('₪#,##0;[Red]-₪#,##0;"–"');
  sh.getRange(t0, 5, k + 1, 1).setNumberFormat('0%');
  sh.getRange(t0, 6, k + 1, 1).setNumberFormat('+₪#,##0;-₪#,##0;"–"');
  sh.getRange(t0, 2, k + 1, 5).setHorizontalAlignment('center');
  list.forEach(function (c, i) {
    if (COLOR_HEX[c.color]) sh.getRange(t0 + i, 2).setFontColor(COLOR_HEX[c.color]).setFontWeight('bold');
  });
  sh.getRange(t0, 1, k, 6).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false);
  var useRng = sh.getRange(t0, 5, k + 1, 1);
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(1).setBackground('#f4c7c3').setFontColor('#a50e0e').setBold(true).setRanges([useRng]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberBetween(0.9, 1).setBackground('#fce8b2').setRanges([useRng]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberBetween(0, 0.8999).setBackground('#d9ead3').setRanges([useRng]).build());
  sh.setConditionalFormatRules(rules);

  // נתוני עזר לגרפים (N ואילך)
  sh.getRange('N8').setValue('נתוני עזר לגרפים – לא לעריכה').setFontColor('#9aa0a6').setFontSize(8);
  var nc = cats.length;
  sh.getRange('N10:O10').setValues([['קטגוריה', 'סכום']]);
  sh.getRange(11, 14, nc, 2).setFormulas(cats.map(function (c, i) { return ['=A' + (t0 + i), '=MAX(0,C' + (t0 + i) + ')']; }));
  sh.getRange('Q10:R13').setFormulas([['="צבע"', '="סכום"'], ['="ירוק"', '=MAX(0,C6)'], ['="צהוב"', '=MAX(0,E6)'], ['="אדום"', '=MAX(0,G6)']]);
  sh.getRange('T10:W10').setValues([['חודש', 'ירוק', 'צהוב', 'אדום']]);
  var bars = [];
  for (var i = 1; i <= 6; i++) {
    // שורה 1 = הישן מבין 6 החודשים, שורה 6 = החודש הנבחר (הרשימה מסודרת מהחדש לישן)
    var r = 10 + i, pos = 'MATCH($C$3,' + MLIST + ',0)+6-' + i;
    var cell = function (color) { return '=IF($T' + r + '="","",' + sumWhere('$T' + r, ',' + COL + '="' + color + '"') + ')'; };
    bars.push(['=IFERROR(IF(' + pos + '>' + m + ',"",INDEX(' + MLIST + ',' + pos + ')),"")', cell('ירוק'), cell('צהוב'), cell('אדום')]);
  }
  sh.getRange(11, 20, 6, 4).setFormulas(bars);
  sh.getRange(11, 20, 6, 1).setNumberFormat('@');
  sh.getRange(t0, 26, k, 1).setFormulas(list.map(function (c, i) { return ['=IFERROR(ABS(F' + (t0 + i) + '),0)']; }));
  sh.getRange(8, 14, Math.max(tTot, 20), 13).setFontColor('#9aa0a6').setFontSize(8);

  // גרפים
  var chartTop = tTot + 2;
  var pieColors = [], used = {};
  cats.forEach(function (c) {
    var arr = SHADES[c.color] || SHADES['–'];
    used[c.color] = (used[c.color] || 0);
    pieColors.push(arr[used[c.color] % arr.length]);
    used[c.color]++;
  });
  sh.insertChart(sh.newChart().setChartType(Charts.ChartType.PIE)
    .addRange(sh.getRange(10, 14, nc + 1, 2)).setNumHeaders(1)
    .setPosition(9, 7, 10, 0)
    .setOption('title', 'חלוקה לפי קטגוריות – החודש הנבחר').setOption('pieHole', 0.45)
    .setOption('colors', pieColors).setOption('pieSliceText', 'percentage')
    .setOption('legend', { position: 'right', textStyle: { fontSize: 11 } })
    .setOption('titleTextStyle', { fontSize: 14, bold: true }).setOption('fontName', FONT)
    .setOption('width', 560).setOption('height', Math.max(320, (k + 2) * 21)).build());

  sh.insertChart(sh.newChart().setChartType(Charts.ChartType.PIE)
    .addRange(sh.getRange('Q10:R13')).setNumHeaders(1)
    .setPosition(chartTop, 1, 0, 0)
    .setOption('title', 'ירוק / צהוב / אדום – החודש הנבחר').setOption('pieHole', 0.45)
    .setOption('colors', [COLOR_HEX['ירוק'], COLOR_HEX['צהוב'], COLOR_HEX['אדום']])
    .setOption('slices', { 0: { color: COLOR_HEX['ירוק'] }, 1: { color: COLOR_HEX['צהוב'] }, 2: { color: COLOR_HEX['אדום'] } })
    .setOption('legend', { position: 'right' }).setOption('fontName', FONT)
    .setOption('titleTextStyle', { fontSize: 14, bold: true })
    .setOption('width', 600).setOption('height', 320).build());

  sh.insertChart(sh.newChart().setChartType(Charts.ChartType.COLUMN)
    .addRange(sh.getRange('T10:W16')).setNumHeaders(1)
    .setPosition(chartTop, 7, 10, 0)
    .setOption('title', '6 החודשים האחרונים לפי צבע').setOption('isStacked', true)
    .setOption('colors', [COLOR_HEX['ירוק'], COLOR_HEX['צהוב'], COLOR_HEX['אדום']])
    .setOption('series', { 0: { color: COLOR_HEX['ירוק'] }, 1: { color: COLOR_HEX['צהוב'] }, 2: { color: COLOR_HEX['אדום'] } })
    .setOption('legend', { position: 'bottom' }).setOption('fontName', FONT)
    .setOption('titleTextStyle', { fontSize: 14, bold: true }).setOption('vAxis', { format: '₪#,##0' })
    .setOption('width', 560).setOption('height', 320).build());

  // טבלאות קטנות
  var rT = chartTop + 17;
  sectionTitle_(sh, 'A' + rT, '5 בתי העסק המובילים בחודש');
  sh.getRange(rT + 1, 1, 1, 2).setValues([['בית עסק', 'סכום ₪']]).setFontWeight('bold').setBackground('#202124').setFontColor('#ffffff');
  sh.getRange(rT + 2, 1).setFormula('=IFERROR(QUERY({' + MER + ',' + AMT + ',' + MON + '},"select Col1, sum(Col2) where Col3 = \'"&$C$3&"\' and Col1 is not null group by Col1 order by sum(Col2) desc limit 5 label sum(Col2) \'\'",0),"אין נתונים")');
  sh.getRange(rT + 2, 2, 5, 1).setNumberFormat('₪#,##0');

  sectionTitle_(sh, 'D' + rT, '3 השינויים הבולטים');
  sh.getRange(rT + 1, 4, 1, 2).setValues([['קטגוריה', 'שינוי ₪']]).setFontWeight('bold').setBackground('#202124').setFontColor('#ffffff');
  sh.getRange(rT + 2, 4).setFormula('=IF($G$3="","אין חודש קודם",IFERROR(SORTN({A' + t0 + ':A' + t1 + ',F' + t0 + ':F' + t1 + '},3,0,Z' + t0 + ':Z' + t1 + ',FALSE),""))');
  sh.getRange(rT + 2, 5, 3, 1).setNumberFormat('+₪#,##0;-₪#,##0');
  var chgRng = sh.getRange(rT + 2, 5, 3, 1);
  var allRules = sh.getConditionalFormatRules();
  allRules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0).setFontColor('#d93025').setRanges([chgRng]).build());
  allRules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0).setFontColor('#137333').setRanges([chgRng]).build());
  sh.setConditionalFormatRules(allRules);

  sectionTitle_(sh, 'G' + rT, 'מנויים וחיובים חוזרים פעילים');
  sh.getRange(rT + 1, 7, 1, 4).setValues([['בית עסק', 'קטגוריה', 'חודשי ₪', 'התראה']]).setFontWeight('bold').setBackground('#202124').setFontColor('#ffffff');
  var subs = recurring.filter(function (x) { return x.active; })
    .map(function (x) { return [x.name, x.cat, x.monthly, x.alert]; });
  if (subs.length) {
    sh.getRange(rT + 2, 7, subs.length, 4).setValues(subs);
    sh.getRange(rT + 2, 9, subs.length, 1).setNumberFormat('₪#,##0.00');
    sh.getRange(rT + 2, 10, subs.length, 1).setFontColor('#d93025');
    var tot = subs.reduce(function (s, x) { return s + x[2]; }, 0);
    sh.getRange(rT + 2 + subs.length, 7, 1, 3).setValues([['סה"כ בחודש', '', round2_(tot)]]).setFontWeight('bold');
    sh.getRange(rT + 2 + subs.length, 9).setNumberFormat('₪#,##0');
  } else {
    sh.getRange(rT + 2, 7).setValue('אין עדיין (צריך 3 חודשים לפחות)').setFontColor('#80868b');
  }
  sh.setFrozenRows(3);
  ss_().setActiveSheet(sh);
  sh.setActiveSelection(DASH.SEL);
}

function sectionTitle_(sh, a1, text) {
  sh.getRange(a1).setValue(text).setFontSize(13).setFontWeight('bold').setFontColor('#1a73e8');
}

/* ===================== Menu.gs ===================== */
/**
 * Menu.gs – תפריט "ניהול הוצאות" ועדכון אוטומטי כשמשנים קטגוריה ידנית בגיליון "עסקאות".
 */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('ניהול הוצאות')
    .addItem('⟳ עדכן הכל', 'menuUpdateAll')
    .addSeparator()
    .addItem('1. ייבוא קבצים חדשים', 'menuImport')
    .addItem('2. סיווג עסקאות', 'menuClassify')
    .addItem('2א. סיווג ידני של לא-ברורים', 'openReviewSidebar')
    .addItem('2ב. החל סיווגים מגיליון לבירור', 'menuApplyFromReviewSheet')
    .addItem('3. עדכון ניתוח ודשבורד', 'menuAnalysis')
    .addSeparator()
    .addItem('הוצאות קבועות (שכירות וכו\')', 'menuFixed')
    .addSeparator()
    .addItem('הגדרה ראשונית', 'runSetup')
    .addToUi();
}

/** שינוי קטגוריה ידני בגיליון "עסקאות" → צבע + "ידני", כדי שסיווג אוטומטי לא ידרוס */
function onEdit(e) {
  try {
    var sh = e.range.getSheet();
    if (sh.getName() !== SHEETS.TX || e.range.getColumn() !== C.CAT + 1 || e.range.getRow() < 2) return;
    var n = e.range.getNumRows();
    var vals = e.range.getValues();
    var colors = categoryColors_();
    var out = vals.map(function (v) {
      var cat = String(v[0] || '');
      if (!cat) return ['', '', ''];
      return [cat, cat === REVIEW_CAT ? '' : (colors[cat] || COLOR_NAMES.NONE), cat === REVIEW_CAT ? '' : BY.MANUAL];
    });
    sh.getRange(e.range.getRow(), C.CAT + 1, n, 3).setValues(out);
  } catch (err) { /* טריגר פשוט – לא מציגים שגיאות */ }
}

/** מאפשר ל-HTML לכלול קבצים אחרים */
function include_(name) { return HtmlService.createHtmlOutputFromFile(name).getContent(); }
