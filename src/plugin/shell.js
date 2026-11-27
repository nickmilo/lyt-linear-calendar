/* LYT Linear Calendar for Obsidian: the platform. GPL-3.0.
   The shared interface (src/core/ui.js) runs inside the view, as in the web app. This file gives it a place to live (PF),
   keeps settings in the plugin's data, and keeps the calendar and the vault's notes in step:
   every note with a start date (or a month, for Sometime) is an item, wherever it lives. New items become notes in the Linear folder. */
var obsidian = require('obsidian');
var VIEW_TYPE = 'lyt-linear-calendar';
var S = { year: now.getFullYear(), notes: [], years: {}, cats: JSON.parse(JSON.stringify(DEF_CATS)), hidden: [], trends: [],
  set: { font: 'recursive', theme: 'auto', weekends: true, past: true, ghost: true } };
var EX = { year: true, past: true };
var PLUGIN = null, VIEW = null, FOLDER = 'Linear';

/* ---------- the place the interface lives ---------- */
var PF = { root: null, layer: null, themeEl: null, scroller: null, scrollEl: null, signal: null, canExport: false,
  sy: function () { return PF.scroller.scrollTop; },
  vh: function () { return PF.scroller.clientHeight; },
  active: function () { return !!(PLUGIN && VIEW && PLUGIN.app.workspace.getActiveViewOfType(LinearCalendarView) === VIEW); },
  openExport: function () {},
  folder: function () { return FOLDER; },
  hasFile: function (id) { return !!FILE[id]; },
  openFile: function (id) { var f = FILE[id] && PLUGIN.app.vault.getAbstractFileByPath(FILE[id]); if (f) PLUGIN.app.workspace.getLeaf('tab').openFile(f); },
  /* Auto: Play when Obsidian is light, LYT Mode when it is dark */
  themeName: function (t) { if (t === 'play' || t === 'paper' || t === 'dark') return t; return document.body.classList.contains('theme-dark') ? 'dark' : 'play'; } };
function download(blob, name) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }

/* settings live in the plugin's data; the notes live in the vault */
var saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function () { if (PLUGIN) PLUGIN.saveData({ year: S.year, cats: S.cats, hidden: S.hidden, set: S.set, folder: FOLDER }); }, 300);
  SYNC.later();
}

/* ---------- the vault ---------- */
var FILE = {}, PATHID = {}, SNAP = {}, SECS = {}, YSNAP = {}, TFILE = {}, TSNAP = {}, WROTE = {};
function snapNote(n) { return JSON.stringify([n.title || '', n.start || '', n.end || '', n.month || '', n.category || '', !!n.hide, n.plan || '', n.reflection || '']); }
function snapYear(y) { var v = S.years[y] || {}; return JSON.stringify([v.intentions || '', v.reflection || '']); }
function inFolder(p) { return p.indexOf(FOLDER + '/') === 0; }
function mine(p) { WROTE[p] = Date.now(); }
function ours(p) { return WROTE[p] && Date.now() - WROTE[p] < 2500; }
function hasDates(fm) { if (!fm) return false; var k = [pkey('start'), 'start', pkey('month'), 'month'];
  return k.some(function (x) { var v = fm[x]; return v != null && /^\d{4}-\d{2}/.test(String(v)); }); }
/* read every dated note, the year notes and the Life Trends threads */
async function readVault(app) {
  var notes = [], years = {}, trends = [], file = {}, pathid = {}, snap = {}, secs = {}, ysnap = {}, tfile = {}, tsnap = {};
  var oldT = {}; Object.keys(TFILE).forEach(function (id) { oldT[TFILE[id]] = id; });
  var list = app.vault.getMarkdownFiles().filter(function (f) {
    var fm = (app.metadataCache.getFileCache(f) || {}).frontmatter;
    return hasDates(fm) || (inFolder(f.path) && (/^\d{4} Linear$/.test(f.basename) || (/\/Trends\//.test('/' + f.path.slice(FOLDER.length)) && fm && fm.stretches)));
  });
  for (var i = 0; i < list.length; i++) {
    var f = list[i], text;
    try { text = await app.vault.cachedRead(f); } catch (e) { continue; }
    var r = parseMd(inFolder(f.path) ? f.path.slice(FOLDER.length + 1) : f.path, text); if (!r) continue;
    if (r.year) { if (!inFolder(f.path)) continue; years[r.year] = { intentions: r.intentions, reflection: r.reflection }; ysnap[r.year] = JSON.stringify([r.intentions || '', r.reflection || '']); continue; }
    if (r.trend) {
      var tc = r.trend.cat, c = tc ? S.cats.filter(function (k) { return k.name.toLowerCase() === tc.toLowerCase(); })[0] : null;
      if (tc && !c) { var used = S.cats.map(function (k) { return k.mark; }); c = { id: uid(), name: tc, mark: MARKS.filter(function (x) { return used.indexOf(x) < 0; })[0] || MARKS[0] }; S.cats.push(c); }
      var t = { id: oldT[f.path] || uid(), cat: c ? c.id : '', name: r.trend.name, stretches: r.trend.stretches }; if (r.trend.color) t.color = r.trend.color;
      trends.push(t); tfile[t.id] = f.path; continue; }
    r.id = PATHID[f.path] || r.id; notes.push(r);
    file[r.id] = f.path; pathid[f.path] = r.id; snap[r.id] = snapNote(r); secs[r.id] = /^##\s+(Plan|Reflection)\s*$/mi.test(text);
  }
  S.notes = notes; S.years = years; S.trends = trends;
  FILE = file; PATHID = pathid; SNAP = snap; SECS = secs; YSNAP = ysnap; TFILE = tfile;
  TSNAP = {}; trendFiles().forEach(function (x) { TSNAP[x.id] = x.text; });
}
/* the Life Trends files, written the way the web app exports them */
function trendFiles() {
  var out = [];
  (S.trends || []).forEach(function (t) { var one = S.trends; S.trends = [t]; var f = buildFiles({ year: false, past: true }).filter(function (x) { return x.trend; })[0]; S.trends = one;
    if (f) out.push({ id: t.id, path: FOLDER + '/' + f.name.replace(/^Linear\//, ''), text: f.text }); });
  return out;
}
/* put text under a "## Heading" in a note, leaving everything else as it is */
function putSection(text, head, val) {
  val = (val || '').trim();
  var m = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/), fm = m ? m[0] : '', body = text.slice(fm.length);
  var rx = new RegExp('(^##\\s+' + head + '\\s*$)([\\s\\S]*?)(?=^#{1,2}\\s|(?![\\s\\S]))', 'mi');
  if (rx.test(body)) body = body.replace(rx, function (all, h, rest, at) { var last = at + all.length >= body.length; return h + '\n' + (val ? val + '\n' : '') + (last ? '' : '\n'); });
  else if (val) body = body.replace(/\s*$/, '') + (body.trim() ? '\n\n' : '') + '## ' + head + '\n' + val + '\n';
  return fm + body;
}
function freePath(p) { var vault = PLUGIN.app.vault, base = p.replace(/\.md$/, ''), i = 2; while (vault.getAbstractFileByPath(p)) { p = base + ' ' + i + '.md'; i++; } return p; }
async function ensureFolder(p) { var dir = p.split('/').slice(0, -1).join('/'), vault = PLUGIN.app.vault, acc = '';
  for (var part of dir.split('/')) { acc = acc ? acc + '/' + part : part; if (!vault.getAbstractFileByPath(acc)) { try { await vault.createFolder(acc); } catch (e) {} } } }
function typing() { var a = document.activeElement; return !!(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && ((PF.layer && PF.layer.contains(a)) || (PF.root && PF.root.contains(a)))); }

var SYNC = {
  timer: null, busy: false, again: false,
  later: function () { clearTimeout(SYNC.timer); SYNC.timer = setTimeout(SYNC.run, 700); },
  run: async function () {
    if (!PLUGIN || !SYNC.ready) return;
    if (SYNC.busy) { SYNC.again = true; return; }
    SYNC.busy = true;
    try { await SYNC.write(); } catch (e) { console.error('LYT Linear Calendar', e); new obsidian.Notice('Linear Calendar couldn’t save a note: ' + e.message); }
    SYNC.busy = false;
    if (SYNC.again) { SYNC.again = false; SYNC.later(); }
  },
  write: async function () {
    var app = PLUGIN.app, vault = app.vault, fmgr = app.fileManager, held = typing(), e = exo(), live = {};
    for (var n of S.notes.slice()) {
      live[n.id] = 1;
      var p = FILE[n.id], f = p && vault.getAbstractFileByPath(p);
      if (!f) {   /* a new item: a note once it has a name and nobody is typing it */
        if (!(n.title || '').trim() || held) continue;
        var np = freePath(FOLDER + '/' + fileName(n, {}));
        await ensureFolder(np); mine(np); f = await vault.create(np, noteText(n));
        FILE[n.id] = np; PATHID[np] = n.id; SNAP[n.id] = snapNote(n); SECS[n.id] = true; continue; }
      if (SNAP[n.id] === snapNote(n)) continue;
      var old = JSON.parse(SNAP[n.id] || '[]');
      if (old[1] !== (n.start || '') || old[2] !== (n.end || '') || old[3] !== (n.month || '') || old[4] !== (n.category || '') || old[5] !== !!n.hide) {
        mine(f.path);
        await fmgr.processFrontMatter(f, function (fm) {
          function put(id, def, v) { var k = pkey(id) || def; if (v) fm[k] = v; else delete fm[k]; if (k !== def && fm[def] != null && !v) delete fm[def]; }
          put('start', 'start', n.start || ''); put('end', 'end', n.start && n.end && n.end !== n.start ? n.end : '');
          put('month', 'month', !n.start && n.month ? n.month : '');
          var c = cat(n.category); put('category', 'category', c ? (e.catAs === 'link' ? '[[' + clean(c.name) + ']]' : c.name) : '');
          put('hide', 'hide-name', n.hide ? true : '');
        });
      }
      if (old[6] !== (n.plan || '') || old[7] !== (n.reflection || '')) {
        var hadSecs = SECS[n.id]; mine(f.path);
        await vault.process(f, function (text) {
          if (!hadSecs && old[7] === (n.reflection || '')) {   /* a note without Plan and Reflection: its body is the Plan */
            var m = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/), fm = m ? m[0] : ''; return fm + (n.plan || '').trim() + '\n'; }
          return putSection(putSection(text, 'Plan', n.plan), 'Reflection', n.reflection); });
        if (!hadSecs && old[7] !== (n.reflection || '')) SECS[n.id] = true;
      }
      /* the name (or Sometime and back) changed: the file follows, and Obsidian updates links to it */
      /* the file follows the name and dates only while it still carries the name the calendar gave it; names you chose stay */
      if (!held && (n.title || '').trim()) {
        var on = { title: old[0], category: old[4] }; if (old[1]) { on.start = old[1]; if (old[2]) on.end = old[2]; } else on.month = old[3];
        var was = f.path, oldName = fileName(on, {}), newName = fileName(n, {});
        if (oldName !== newName && was.slice(-oldName.split('/').pop().length) === oldName.split('/').pop()) {
          var want = inFolder(was) ? FOLDER + '/' + newName : was.replace(/[^/]*$/, '') + newName.split('/').pop();
          if (want !== was) { want = freePath(want); await ensureFolder(want); mine(was); mine(want); await fmgr.renameFile(f, want);
            delete PATHID[was]; FILE[n.id] = want; PATHID[want] = n.id; } }
      }
      SNAP[n.id] = snapNote(n);
    }
    /* deleted in the calendar: the note goes to the trash (Obsidian's or the system's, as set in Obsidian) */
    for (var id of Object.keys(FILE)) { if (live[id]) continue;
      var df = vault.getAbstractFileByPath(FILE[id]); if (df) { mine(df.path); await fmgr.trashFile(df); }
      delete PATHID[FILE[id]]; delete FILE[id]; delete SNAP[id]; delete SECS[id]; }
    /* year notes */
    for (var y of Object.keys(S.years)) { if (YSNAP[y] === snapYear(y)) continue;
      var yp = FOLDER + '/' + y + ' Linear.md', yf = vault.getAbstractFileByPath(yp), v = S.years[y] || {}; mine(yp);
      if (yf) await vault.process(yf, function (text) { return putSection(putSection(text, 'Intentions', v.intentions), 'Reflection', v.reflection); });
      else if ((v.intentions || '').trim() || (v.reflection || '').trim()) { await ensureFolder(yp); await vault.create(yp, yearText(y)); }
      YSNAP[y] = snapYear(y); }
    /* Life Trends threads: these files belong to the calendar, so they are written whole */
    var tl = {};
    for (var tf of trendFiles()) { tl[tf.id] = 1; if (TSNAP[tf.id] === tf.text) continue;   /* a thread is only written when it changed in the calendar */
      var cur = TFILE[tf.id] && vault.getAbstractFileByPath(TFILE[tf.id]);
      if (cur && cur.path !== tf.path) { var to = freePath(tf.path); await ensureFolder(to); mine(cur.path); mine(to); await fmgr.renameFile(cur, to); tf.path = to; }
      mine(tf.path);
      if (cur) await vault.modify(cur, tf.text); else { var ex = vault.getAbstractFileByPath(tf.path); if (ex) await vault.modify(ex, tf.text); else { await ensureFolder(tf.path); await vault.create(tf.path, tf.text); } }
      TFILE[tf.id] = tf.path; TSNAP[tf.id] = tf.text; }
    for (var tid of Object.keys(TFILE)) { if (tl[tid]) continue; var tff = vault.getAbstractFileByPath(TFILE[tid]); if (tff) { mine(tff.path); await fmgr.trashFile(tff); } delete TFILE[tid]; delete TSNAP[tid]; }
  }
};

/* ---------- the view ---------- */
var FONT_URL = 'https://fonts.googleapis.com/css2?family=Recursive:slnt,wght,CASL,CRSV,MONO@-15..0,300..1000,0..1,0..1,0..1&family=Atkinson+Hyperlegible+Next:ital,wght@0,200..800;1,200..800&family=Familjen+Grotesk:ital,wght@0,400..700;1,400..700&display=swap';
var FLOATING = ['panel', 'setdd', 'veil', 'toast'];
function refresh() { if (!VIEW) return; renderCats(); renderYear(); if (typeof shapeSync === 'function') shapeSync(); }

class LinearCalendarView extends obsidian.ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.timer = null; }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return 'Linear calendar'; }
  getIcon() { return 'calendar-range'; }
  async onOpen() {
    var self = this, c = this.contentEl;
    if (VIEW && VIEW !== this) { c.empty(); c.createDiv({ text: 'The linear calendar is open in another tab.' }); return; }
    VIEW = this; this.ac = new AbortController();
    c.empty(); c.addClass('lytlc');
    c.insertAdjacentHTML('afterbegin', APP_HTML);
    /* pop-ups and cards float over the whole window, so they live outside the pane */
    var layer = document.body.appendChild(document.createElement('div')); layer.className = 'lytlc lytlc-layer';
    FLOATING.forEach(function (id) { var x = c.querySelector('#' + id); if (x) layer.appendChild(x); });
    this.layer = layer;
    var mirror = function () { ['data-lc-theme', 'data-font'].forEach(function (a) { var v = c.getAttribute(a); if (v) layer.setAttribute(a, v); }); layer.style.cssText = c.style.cssText; };
    this.mo = new MutationObserver(mirror); this.mo.observe(c, { attributes: true, attributeFilter: ['data-lc-theme', 'data-font', 'style'] });
    PF.root = c; PF.themeEl = c; PF.scroller = c; PF.scrollEl = c; PF.layer = layer; PF.signal = this.ac.signal;
    layer.addEventListener('focusout', function () { SYNC.later(); }, { signal: this.ac.signal });
    await readVault(this.app); SYNC.ready = true;
    initUI(); mirror();
    var later = function (f) { if (f && ours(f.path)) return; clearTimeout(self.timer); self.timer = setTimeout(function again() {
      if (drag || typing() || SYNC.busy) { self.timer = setTimeout(again, 800); return; }
      readVault(self.app).then(refresh); }, 400); };
    this.registerEvent(this.app.metadataCache.on('changed', later));
    this.registerEvent(this.app.vault.on('create', function (f) { if (f.extension === 'md') later(f); }));
    this.registerEvent(this.app.vault.on('delete', later));
    this.registerEvent(this.app.vault.on('rename', function (f, oldPath) {
      var id = PATHID[oldPath]; if (id) { delete PATHID[oldPath]; PATHID[f.path] = id; FILE[id] = f.path; }
      Object.keys(TFILE).forEach(function (k) { if (TFILE[k] === oldPath) TFILE[k] = f.path; });
      later(f); }));
    this.registerEvent(this.app.workspace.on('css-change', function () { applySet(); }));
  }
  onResize() { if (VIEW === this && typeof relayout === 'function') relayout(); }
  async onClose() {
    if (VIEW !== this) return;
    clearTimeout(this.timer); clearTimeout(SYNC.timer); await SYNC.run();
    if (this.ac) this.ac.abort(); if (this.mo) this.mo.disconnect(); if (this.layer) this.layer.remove();
    VIEW = null; SYNC.ready = false; PF.signal = null;
  }
}

class LinearCalendarPlugin extends obsidian.Plugin {
  async onload() {
    PLUGIN = this;
    var d = (await this.loadData()) || {};
    if (d.cats) S.cats = d.cats; if (d.hidden) S.hidden = d.hidden; if (d.year) S.year = d.year; if (d.folder) FOLDER = d.folder;
    if (d.set) Object.keys(d.set).forEach(function (k) { S.set[k] = d.set[k]; });
    if (S.set.colors) delete S.set.colors;
    if (!document.getElementById('lytlc-fonts')) { var lk = document.createElement('link'); lk.id = 'lytlc-fonts'; lk.rel = 'stylesheet'; lk.href = FONT_URL; document.head.appendChild(lk); }
    var self = this;
    this.registerView(VIEW_TYPE, function (leaf) { return new LinearCalendarView(leaf, self); });
    this.addRibbonIcon('calendar-range', 'Open linear calendar', function () { self.open(); });
    this.addCommand({ id: 'open', name: 'Open linear calendar', callback: function () { self.open(); } });
    this.addSettingTab(new LinearCalendarSettings(this.app, this));
  }
  onunload() { ['lytlc-fonts', 'lc-mkdefs'].forEach(function (id) { var x = document.getElementById(id); if (x) x.remove(); }); }
  async open() {
    var ws = this.app.workspace, leaf = ws.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) { leaf = ws.getLeaf(true); await leaf.setViewState({ type: VIEW_TYPE, active: true }); }
    ws.revealLeaf(leaf);
  }
}
/* Obsidian's settings: only what the calendar's own settings can't hold */
class LinearCalendarSettings extends obsidian.PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); }
  display() {
    var c = this.containerEl; c.empty();
    new obsidian.Setting(c).setName('Folder for new notes').setDesc('New items become notes here. Notes elsewhere with a start date or month show too, and stay where they are.')
      .addText(function (t) { t.setValue(FOLDER).onChange(function (v) { v = (v || '').trim().replace(/^\/+|\/+$/g, ''); if (!v) return; FOLDER = v; save(); }); });
    new obsidian.Setting(c).setName('Theme').setDesc('Auto uses Play when Obsidian is light and LYT Mode when it is dark. The calendar’s own Theme card picks one for good.')
      .addDropdown(function (d) { d.addOption('auto', 'Auto').addOption('play', 'Play').addOption('paper', 'Soft Paper').addOption('dark', 'LYT Mode').setValue(S.set.theme || 'auto').onChange(function (v) { S.set.theme = v; save(); if (VIEW) applySet(); }); });
  }
}
module.exports = LinearCalendarPlugin;
