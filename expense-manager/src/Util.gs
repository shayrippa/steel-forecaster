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
