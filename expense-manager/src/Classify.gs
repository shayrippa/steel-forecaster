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
