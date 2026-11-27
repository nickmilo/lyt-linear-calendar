/* LYT Linear Calendar for Obsidian: the plugin shell. GPL-3.0.
   The core (src/core) draws the year; this file feeds it the vault's notes and opens a note when you click it. */
var obsidian = require('obsidian');
var VIEW_TYPE = 'lyt-linear-calendar';
var S = { year: new Date().getFullYear(), notes: [], years: {}, cats: JSON.parse(JSON.stringify(DEF_CATS)), hidden: [], trends: [],
  set: { weekends: true, past: true, ghost: true, view: 'year', theme: 'auto', font: 'recursive', half: false } };
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
/* the web app's themes and fonts. Auto: Play when Obsidian is light, LYT Mode when it is dark */
function themeFor() { var t = S.set.theme; if (t === 'play' || t === 'paper' || t === 'dark') return t; return document.body.classList.contains('theme-dark') ? 'dark' : 'play'; }
function dress(c) { c.setAttr('data-lc-theme', themeFor()); c.setAttr('data-font', S.set.font || 'recursive'); }
var FONT_URL = 'https://fonts.googleapis.com/css2?family=Recursive:slnt,wght,CASL,CRSV,MONO@-15..0,300..1000,0..1,0..1,0..1&family=Atkinson+Hyperlegible+Next:ital,wght@0,200..800;1,200..800&family=Familjen+Grotesk:ital,wght@0,400..700;1,400..700&display=swap';
function redrawAll() { if (!PLUGIN) return; PLUGIN.app.workspace.getLeavesOfType(VIEW_TYPE).forEach(function (l) { if (l.view && l.view.draw) { dress(l.view.contentEl); l.view.draw(); } }); }
var ICON_PREV = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
var ICON_NEXT = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';

class LinearCalendarView extends obsidian.ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.timer = null; }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return 'Linear calendar'; }
  getIcon() { return 'calendar-range'; }
  async onOpen() {
    var self = this, c = this.contentEl;
    c.empty(); c.addClass('lytlc'); dress(c);
    var hd = c.createDiv({ cls: 'lytlc-head' });
    var brand = hd.createDiv({ cls: 'brand' }); var mo = brand.createEl('span', { cls: 'motif' }); mo.appendChild(mk('c v')); mo.appendChild(el('i')); mo.appendChild(mk('m'));
    var yr = hd.createDiv({ cls: 'yr' });
    var prev = yr.createEl('button', { attr: { 'aria-label': 'Previous year', title: 'Previous year' } }); prev.innerHTML = ICON_PREV;
    yr.createEl('span', { cls: 'num', attr: { id: 'ylab' } });
    var next = yr.createEl('button', { attr: { 'aria-label': 'Next year', title: 'Next year' } }); next.innerHTML = ICON_NEXT;
    var today = hd.createEl('button', { cls: 'lytlc-today', text: 'Today' });
    var shape = hd.createDiv({ cls: 'yr', attr: { id: 'shape', role: 'group', 'aria-label': 'Months as' } });
    var whole = shape.createEl('button', { text: 'Whole', attr: { title: 'A row a month' } }), half = shape.createEl('button', { text: 'Half', attr: { title: 'Two rows a month' } });
    function shapeSync() { whole.classList.toggle('on', !S.set.half); half.classList.toggle('on', !!S.set.half); today.classList.toggle('lytlc-hide', S.year === new Date().getFullYear()); }
    whole.onclick = function () { S.set.half = false; save(); self.draw(); };
    half.onclick = function () { S.set.half = true; save(); self.draw(); };
    prev.onclick = function () { S.year--; save(); self.draw(); };
    next.onclick = function () { S.year++; save(); self.draw(); };
    today.onclick = function () { S.year = new Date().getFullYear(); save(); self.draw(); };
    this.shapeSync = shapeSync;
    c.createDiv({ cls: 'year', attr: { id: 'year' } });
    c.addEventListener('click', function (e) {
      var it = e.target.closest('.seg:not(.ghost),.sch:not(.ghost)'); if (!it) return;
      var f = self.app.vault.getAbstractFileByPath(it.dataset.id); if (f) self.app.workspace.getLeaf(e.metaKey || e.ctrlKey).openFile(f);
    });
    var later = function () { clearTimeout(self.timer); self.timer = setTimeout(function () { self.draw(); }, 250); };
    this.registerEvent(this.app.metadataCache.on('changed', later));
    this.registerEvent(this.app.vault.on('delete', later));
    this.registerEvent(this.app.vault.on('rename', later));
    this.registerEvent(this.app.workspace.on('css-change', function () { dress(c); }));
    mkDefs(); this.draw();
  }
  draw() { readVault(this.app); renderYear(); if (this.shapeSync) this.shapeSync(); }
  async onClose() { clearTimeout(this.timer); }
}

class LinearCalendarPlugin extends obsidian.Plugin {
  async onload() {
    PLUGIN = this;
    var d = (await this.loadData()) || {};
    if (d.cats) S.cats = d.cats; if (d.hidden) S.hidden = d.hidden; if (d.year) S.year = d.year;
    if (d.set) Object.keys(d.set).forEach(function (k) { S.set[k] = d.set[k]; });
    S.set.view = 'year'; S.set.scroll = false; if (S.set.colors) delete S.set.colors;
    if (!document.getElementById('lytlc-fonts')) { var lk = document.createElement('link'); lk.id = 'lytlc-fonts'; lk.rel = 'stylesheet'; lk.href = FONT_URL; document.head.appendChild(lk); }
    var self = this;
    this.registerView(VIEW_TYPE, function (leaf) { return new LinearCalendarView(leaf, self); });
    this.addRibbonIcon('calendar-range', 'Open linear calendar', function () { self.open(); });
    this.addCommand({ id: 'open', name: 'Open linear calendar', callback: function () { self.open(); } });
    this.addSettingTab(new LinearCalendarSettings(this.app, this));
  }
  onunload() { var lk = document.getElementById('lytlc-fonts'); if (lk) lk.remove(); }
  async open() {
    var ws = this.app.workspace, leaf = ws.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) { leaf = ws.getLeaf(true); await leaf.setViewState({ type: VIEW_TYPE, active: true }); }
    ws.revealLeaf(leaf);
  }
}
class LinearCalendarSettings extends obsidian.PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); }
  display() {
    var c = this.containerEl; c.empty();
    function set(k, v) { S.set[k] = v; save(); redrawAll(); }
    new obsidian.Setting(c).setName('Theme').setDesc('Auto uses Play when Obsidian is light and LYT Mode when it is dark.')
      .addDropdown(function (d) { d.addOption('auto', 'Auto').addOption('play', 'Play').addOption('paper', 'Soft Paper').addOption('dark', 'LYT Mode').setValue(S.set.theme || 'auto').onChange(function (v) { set('theme', v); }); });
    new obsidian.Setting(c).setName('Font').setDesc('Loaded from Google Fonts; without a connection the calendar uses your system font.')
      .addDropdown(function (d) { d.addOption('recursive', 'Recursive').addOption('atkinson', 'Atkinson Hyperlegible Next').addOption('familjen', 'Familjen Grotesk').setValue(S.set.font || 'recursive').onChange(function (v) { set('font', v); }); });
    new obsidian.Setting(c).setName('Shade weekends').addToggle(function (t) { t.setValue(S.set.weekends !== false).onChange(function (v) { set('weekends', v); }); });
    new obsidian.Setting(c).setName('Fade past events').setDesc('Items that have ended draw lighter.').addToggle(function (t) { t.setValue(!!S.set.past).onChange(function (v) { set('past', v); }); });
    new obsidian.Setting(c).setName('Condensed').setDesc('Names on the line instead of above it.').addToggle(function (t) { t.setValue(!!S.set.condensed).onChange(function (v) { set('condensed', v); }); });
  }
}
module.exports = LinearCalendarPlugin;
