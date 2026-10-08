// סביבת דמה מינימלית של Google Apps Script להרצת הקוד ב-Node
const crypto = require('crypto');
const chain = () => { const f = new Proxy(function () {}, { get: (t, p) => p === 'build' ? () => ({}) : () => f, apply: () => f }); return f; };

function a1ToRC(a1) {
  const m = a1.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
  const col = s => s.split('').reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
  const r = +m[2], c = col(m[1]);
  return [r, c, m[4] ? +m[4] - r + 1 : 1, m[3] ? col(m[3]) - c + 1 : 1];
}

class Sheet {
  constructor(ss, name) { this.ss = ss; this.name = name; this.data = []; this.formulas = {}; this.charts = []; this.maxRows = 1000; this.maxCols = 26; this.hidden = false; }
  getName() { return this.name; }
  getLastRow() { for (let r = this.data.length; r > 0; r--) if ((this.data[r - 1] || []).some(v => v !== '' && v !== undefined)) return r; return 0; }
  getLastColumn() { return Math.max(0, ...this.data.map(r => { for (let c = r.length; c > 0; c--) if (r[c - 1] !== '' && r[c - 1] !== undefined) return c; return 0; })); }
  getMaxRows() { return this.maxRows; } getMaxColumns() { return this.maxCols; }
  insertRowsAfter(a, n) { this.maxRows += n; } insertColumnsAfter(a, n) { this.maxCols += n; }
  getRange(r, c, nr, nc) { if (typeof r === 'string') [r, c, nr, nc] = a1ToRC(r); return new Range(this, r, c, nr || 1, nc || 1); }
  getDataRange() { return this.getRange(1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  clear() { this.data = []; this.formulas = {}; }
  getCharts() { return this.charts.slice(); } removeChart(c) { this.charts = this.charts.filter(x => x !== c); }
  insertChart(c) { this.charts.push(c); } newChart() { return chain(); }
  getFilter() { return null; } getBandings() { return []; } getConditionalFormatRules() { return []; }
  hideSheet() { this.hidden = true; }
  appendRow(r) { this.data[this.getLastRow()] = r.slice(); return this; }
}
['setRightToLeft', 'setFrozenRows', 'setFrozenColumns', 'setRowHeight', 'setColumnWidth', 'setColumnWidths', 'hideColumns', 'clearConditionalFormatRules', 'setConditionalFormatRules', 'setHiddenGridlines', 'setActiveSelection']
  .forEach(m => Sheet.prototype[m] = function () { return this; });

class Range {
  constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr, nc }); if (nr < 1 || nc < 1) throw new Error('bad range ' + nr + 'x' + nc); }
  getValues() { const out = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) { const v = (this.sh.data[this.r - 1 + i] || [])[this.c - 1 + j]; row.push(v === undefined ? '' : v); } out.push(row); } return out; }
  getDisplayValues() { return this.getValues().map(r => r.map(String)); }
  setValues(v) {
    if (v.length !== this.nr || v.some(r => r.length !== this.nc)) throw new Error(`setValues size mismatch ${v.length}x${v[0] && v[0].length} vs ${this.nr}x${this.nc} on ${this.sh.name}`);
    v.forEach((row, i) => row.forEach((x, j) => { const R = this.r - 1 + i; (this.sh.data[R] = this.sh.data[R] || [])[this.c - 1 + j] = x; }));
    return this;
  }
  setValue(v) { return this.setValues(Array.from({ length: this.nr }, () => Array(this.nc).fill(v))); }
  getValue() { return this.getValues()[0][0]; }
  setFormula(f) { this.sh.formulas[this.r + ',' + this.c] = f; return this.setValue('=F'); }
  setFormulas(f) { if (f.length !== this.nr || f.some(r => r.length !== this.nc)) throw new Error('setFormulas size'); f.forEach((row, i) => row.forEach((x, j) => this.sh.formulas[(this.r + i) + ',' + (this.c + j)] = x)); return this; }
  clearContent() { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) { const row = this.sh.data[this.r - 1 + i]; if (row) row[this.c - 1 + j] = ''; } return this; }
  getSheet() { return this.sh; } getRow() { return this.r; } getColumn() { return this.c; } getNumRows() { return this.nr; }
  applyRowBanding() { return chain(); }
}
['setNumberFormat', 'setFontFamily', 'setFontWeight', 'setBackground', 'setFontColor', 'setVerticalAlignment', 'setHorizontalAlignment', 'setWrap', 'setDataValidation', 'clearDataValidations', 'breakApart', 'merge', 'setFontSize', 'setBorder', 'createFilter', 'clear']
  .forEach(m => { if (!Range.prototype[m]) Range.prototype[m] = function () { return this; }; });

class SS {
  constructor() { this.sheets = [new Sheet(this, 'Sheet1')]; this.toasts = []; }
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
  insertSheet(n) { const s = new Sheet(this, n); this.sheets.push(s); return s; }
  getSheets() { return this.sheets; } deleteSheet(s) { this.sheets = this.sheets.filter(x => x !== s); }
  toast(m) { this.toasts.push(m); } setActiveSheet() { } moveActiveSheet() { } setSpreadsheetTimeZone() { } setSpreadsheetLocale() { }
}

function makeEnv() {
  const ss = new SS();
  const files = {}; let fid = 0;
  const folder = (name) => ({ name, files: [], getId: () => name, getUrl: () => 'https://drive/' + name, isTrashed: () => false,
    getFiles() { const l = this.files.slice(); return { hasNext: () => l.length > 0, next: () => l.shift() }; },
    createFile(blob) { this.files.push(blob); } });
  const folders = {};
  const mkFile = (name, content, mime) => { const f = { id: 'f' + (++fid), name, content, mime, parent: null,
    getId() { return this.id; }, getName() { return this.name; }, getMimeType() { return this.mime; },
    getBlob() { const c = this.content; return { getDataAsString: () => c, getBytes: () => [...Buffer.from(c)] }; },
    moveTo(fo) { this.parent.files = this.parent.files.filter(x => x !== this); fo.files.push(this); this.parent = fo; } };
    files[f.id] = f; return f; };
  const g = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss, getUi: () => ({ alert: () => { }, showSidebar: () => { }, showModalDialog: () => { }, createMenu: () => chain() }),
      newDataValidation: chain, newConditionalFormatRule: chain,
      BandingTheme: {}, BorderStyle: {}, openById: () => { throw new Error('n/a'); }
    },
    Charts: { ChartType: { PIE: 'pie', COLUMN: 'col' } },
    MimeType: { PDF: 'application/pdf', CSV: 'text/csv', GOOGLE_SHEETS: 'gsheet' },
    DriveApp: {
      getFolderById: id => folders[id], getFileById: id => files[id],
      getFoldersByName: n => ({ hasNext: () => !!folders[n], next: () => folders[n] }),
      createFolder: n => (folders[n] = folder(n))
    },
    PropertiesService: { getDocumentProperties: () => { const p = g.__props; return { getProperty: k => p[k] || null, setProperty: (k, v) => p[k] = v }; } },
    __props: {},
    LockService: { getDocumentLock: () => ({ waitLock() { }, releaseLock() { } }) },
    HtmlService: { createTemplateFromFile: () => ({ evaluate: () => chain() }), createHtmlOutputFromFile: () => ({ getContent: () => '' }) },
    Utilities: {
      parseCsv: parseCsv,
      computeDigest: (alg, s) => [...crypto.createHash('md5').update(s, 'utf8').digest()].map(b => b > 127 ? b - 256 : b),
      DigestAlgorithm: { MD5: 'md5' }, Charset: { UTF_8: 'utf8' },
      formatDate: (d, tz, f) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`,
      base64Encode: b => Buffer.from(b).toString('base64'), base64Decode: s => [...Buffer.from(s, 'base64')],
      newBlob: (c, m, n) => ({ c, m, n })
    },
    __ss: ss, __folders: folders, __mkFile: mkFile
  };
  return g;
}

function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

module.exports = { makeEnv };
