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
