/* LYT Linear Calendar for Obsidian: the plugin shell. GPL-3.0.
   The core (src/core) draws the year; this file feeds it the vault's notes and opens a note when you click it. */
var obsidian = require('obsidian');
var VIEW_TYPE = 'lyt-linear-calendar';
var S = { year: new Date().getFullYear(), notes: [], years: {}, cats: JSON.parse(JSON.stringify(DEF_CATS)), hidden: [], trends: [],
  set: { weekends: true, past: true, ghost: true, view: 'year' } };
var EX = { year: true, past: true }, COLW = 34, drag = null, pickedId = null, LD = null, hovDate = null, hovId = null;
var PLUGIN = null;

function save() { if (PLUGIN) PLUGIN.saveData({ year: S.year, cats: S.cats, hidden: S.hidden, set: S.set }); }
function strandColorPop() {}   /* Life Trends editing comes later in the plugin */

function isDay(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')); }
function isMonth(v) { return /^\d{4}-\d{2}$/.test(String(v || '')); }
function catFor(name) {
  if (!name) return '';
  name = String(name).replace(/^\[\[([^\]|]*)(\|[^\]]*)?\]\]$/, '$1').trim();
  var c = S.cats.filter(function (k) { return k.name.toLowerCase() === name.toLowerCase(); })[0];
  if (!c) { var used = S.cats.map(function (k) { return k.mark; });
    c = { id: uid(), name: name, mark: MARKS.filter(function (x) { return used.indexOf(x) < 0; })[0] || MARKS[0] }; S.cats.push(c); save(); }
  return c.id;
}
/* every note with a start date (or a month, for Sometime) becomes an item, wherever it lives */
function readVault(app) {
  var notes = [];
  app.vault.getMarkdownFiles().forEach(function (f) {
    var cache = app.metadataCache.getFileCache(f), fm = cache && cache.frontmatter; if (!fm) return;
    function F(id, def) { var k = pkey(id); var v = fm[k] != null && fm[k] !== '' ? fm[k] : fm[def]; return v == null ? '' : String(v); }
    var st = F('start', 'start').slice(0, 10), en = F('end', 'end').slice(0, 10), mo = F('month', 'month').slice(0, 7);
    if (!isDay(st) && !isMonth(mo)) return;
    var n = { id: f.path, title: '', plan: '', reflection: '', category: catFor(F('category', 'category')) };
    if (isDay(st)) { n.start = st; if (isDay(en) && en > st) n.end = en; } else n.month = mo;
    if (F('hide', 'hide-name').toLowerCase() === 'true') n.hide = true;
    n.title = titleFrom(f.basename, kindOf(n));
    notes.push(n);
  });
  S.notes = notes;
}
function themeFor() { return document.body.classList.contains('theme-dark') ? 'dark' : 'play'; }

class LinearCalendarView extends obsidian.ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.timer = null; }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return 'Linear calendar'; }
  getIcon() { return 'calendar-range'; }
  async onOpen() {
    var self = this, c = this.contentEl;
    c.empty(); c.addClass('lytlc'); c.setAttr('data-lc-theme', themeFor());
    var hd = c.createDiv({ cls: 'lytlc-head' });
    var prev = hd.createEl('button', { text: '‹', attr: { 'aria-label': 'Previous year' } });
    hd.createEl('span', { cls: 'num lytlc-year', attr: { id: 'ylab' } });
    var next = hd.createEl('button', { text: '›', attr: { 'aria-label': 'Next year' } });
    prev.onclick = function () { S.year--; save(); self.draw(); };
    next.onclick = function () { S.year++; save(); self.draw(); };
    c.createDiv({ cls: 'year', attr: { id: 'year' } });
    c.addEventListener('click', function (e) {
      var it = e.target.closest('.seg:not(.ghost),.sch:not(.ghost)'); if (!it) return;
      var f = self.app.vault.getAbstractFileByPath(it.dataset.id); if (f) self.app.workspace.getLeaf(e.metaKey || e.ctrlKey).openFile(f);
    });
    var later = function () { clearTimeout(self.timer); self.timer = setTimeout(function () { self.draw(); }, 250); };
    this.registerEvent(this.app.metadataCache.on('changed', later));
    this.registerEvent(this.app.vault.on('delete', later));
    this.registerEvent(this.app.vault.on('rename', later));
    this.registerEvent(this.app.workspace.on('css-change', function () { c.setAttr('data-lc-theme', themeFor()); }));
    mkDefs(); this.draw();
  }
  draw() { readVault(this.app); renderYear(); }
  async onClose() { clearTimeout(this.timer); }
}

class LinearCalendarPlugin extends obsidian.Plugin {
  async onload() {
    PLUGIN = this;
    var d = (await this.loadData()) || {};
    if (d.cats) S.cats = d.cats; if (d.hidden) S.hidden = d.hidden; if (d.year) S.year = d.year;
    if (d.set) Object.keys(d.set).forEach(function (k) { S.set[k] = d.set[k]; });
    S.set.view = 'year'; S.set.scroll = false;
    var self = this;
    this.registerView(VIEW_TYPE, function (leaf) { return new LinearCalendarView(leaf, self); });
    this.addRibbonIcon('calendar-range', 'Open linear calendar', function () { self.open(); });
    this.addCommand({ id: 'open', name: 'Open linear calendar', callback: function () { self.open(); } });
  }
  async open() {
    var ws = this.app.workspace, leaf = ws.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) { leaf = ws.getLeaf(true); await leaf.setViewState({ type: VIEW_TYPE, active: true }); }
    ws.revealLeaf(leaf);
  }
}
module.exports = LinearCalendarPlugin;
