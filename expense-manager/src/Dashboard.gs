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
