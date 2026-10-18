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
