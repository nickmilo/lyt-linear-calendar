#!/usr/bin/env python3
"""Smoke test for the built plugin (main.js, styles.css) in headless Chrome, with a small stand-in for Obsidian's API.
Run: python3 test/smoke.py   (needs Playwright and Chrome)"""
import pathlib, json, sys
from playwright.sync_api import sync_playwright
R=pathlib.Path(__file__).resolve().parent.parent
MAIN=(R/'main.js').read_text(); CSS=(R/'styles.css').read_text()
FILES=[
  {'path':'Calendar/Linear/2027-03-14 Dentist.md','basename':'2027-03-14 Dentist','fm':{'start':'2027-03-14','category':'Work'}},
  {'path':'Calendar/Linear/2027-03-20 Ski trip.md','basename':'2027-03-20 Ski trip','fm':{'start':'2027-03-20','end':'2027-03-24','category':'Travel'}},
  {'path':'Calendar/Linear/2027-07-04 NYC » HLN.md','basename':'2027-07-04 NYC » HLN','fm':{'start':'2027-07-04','category':'[[Travel]]'}},
  {'path':'Calendar/Linear/Sometime/2027-06 Paint the porch.md','basename':'2027-06 Paint the porch','fm':{'month':'2027-06','category':'Family'}},
  {'path':'Atlas/Some idea.md','basename':'Some idea','fm':{'up':'[[Home]]'}},
  {'path':'Calendar/Linear/2026-12-01 Last year.md','basename':'2026-12-01 Last year','fm':{'start':'2026-12-01'}},
]
STUB=r"""
window.__files=%s;
function deco(el){ el.empty=function(){ el.textContent=''; }; el.addClass=function(c){ el.classList.add(c); }; el.setAttr=function(k,v){ el.setAttribute(k,v); };
  el.createEl=function(tag,o){ var x=document.createElement(tag); o=o||{}; if(o.text)x.textContent=o.text; if(o.cls)x.className=o.cls; if(o.attr)Object.keys(o.attr).forEach(function(k){x.setAttribute(k,o.attr[k]);}); el.appendChild(x); return deco(x); };
  el.createDiv=function(o){ return el.createEl('div',o); }; return el; }
var ev={on:function(){return {};}};
var files=window.__files.map(function(f){return {path:f.path,basename:f.basename,fm:f.fm};});
var app={vault:{getMarkdownFiles:function(){return files;},getAbstractFileByPath:function(p){return files.filter(function(f){return f.path===p})[0]||null;},on:ev.on},
  metadataCache:{getFileCache:function(f){return {frontmatter:f.fm};},on:ev.on},
  workspace:{getLeavesOfType:function(){return [];},getLeaf:function(){return {setViewState:async function(){},openFile:function(f){window.__opened=f.path;}};},revealLeaf:function(){},on:ev.on}};
var obs={ItemView:class{constructor(leaf){this.leaf=leaf;this.app=app;this.contentEl=deco(document.createElement('div'));this.contentEl.className='view-content';document.querySelector('.workspace-leaf-content').appendChild(this.contentEl);} registerEvent(){} },
  PluginSettingTab:class{constructor(a,p){this.app=a;this.plugin=p;this.containerEl=deco(document.createElement('div'));}}, Setting:class{constructor(){} setName(){return this} setDesc(){return this} addDropdown(){return this} addToggle(){return this}},
  Plugin:class{constructor(a){this.app=a;} async loadData(){return null;} async saveData(d){window.__saved=d;} registerView(t,f){window.__view=f;} addRibbonIcon(){} addCommand(c){window.__cmd=c;} addSettingTab(t){window.__tab=t;} }};
window.__app=app; window.__obs=obs;
""" % json.dumps(FILES)
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
  pg=b.new_page(viewport={'width':1200,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
  pg.set_content('<!doctype html><html><head><style>body{--background-primary:#eee6dd;--background-secondary:#e6dbd1;--background-modifier-border:#d1c9c2;--text-normal:#575279;--text-muted:#6a6684;--text-faint:#8a86a0;--interactive-accent:#1a7da4;--text-on-accent:#fff;--font-interface:system-ui}button{box-shadow:0 2px 3px rgba(0,0,0,.3);border-radius:8px;height:30px}</style><style>'+CSS+'</style></head><body class="theme-light"><div class="workspace-leaf-content"></div></body></html>')
  pg.add_script_tag(content=STUB)
  pg.evaluate("src=>{ var module={exports:null}; new Function('require','module',src)(function(){return window.__obs;},module); window.__P=module.exports; }",MAIN)
  pg.evaluate("async()=>{ window.__S=Date; var pl=new window.__P(window.__app); await pl.onload(); var v=window.__view({app:window.__app}); await v.onOpen(); }")
  pg.wait_for_timeout(200)
  ok=True
  def check(name,cond):
    global ok; ok=ok and cond; print(('PASS ' if cond else 'FAIL ')+name)
  pg.evaluate("()=>{ document.querySelector('.lytlc-year') }")
  # show 2027 regardless of today's year
  while pg.text_content('#ylab')!='2027':
    pg.click('.lytlc-head .yr button[aria-label="Next year"]' if int(pg.text_content('#ylab') or 0)<2027 else '.lytlc-head .yr button[aria-label="Previous year"]'); pg.wait_for_timeout(50)
  segs=pg.eval_on_selector_all('.seg',"e=>e.map(x=>x.dataset.id)")
  check('dated notes in 2027 draw (3 items)', sorted(set(segs))==sorted(['Calendar/Linear/2027-03-14 Dentist.md','Calendar/Linear/2027-03-20 Ski trip.md','Calendar/Linear/2027-07-04 NYC » HLN.md']))
  check('Sometime note sits in June', pg.locator('.mrow[data-m="5"] .sch').count()==1)
  check('note without dates is left out', 'Atlas/Some idea.md' not in segs)
  check('title comes from the file name', 'Dentist' in pg.text_content('.seg[data-id$="Dentist.md"]'))
  check('route draws as two rows with a tilted triangle', pg.locator('.seg[data-id$="HLN.md"] .lab.route').count()==1 and pg.locator('.seg[data-id$="HLN.md"] .mk.t.out').count()==1)
  check('each item takes its category mark (Work circle, Family square)', 'c v' in pg.get_attribute('.seg[data-id$="Dentist.md"] svg.mk','class') and ' m' in pg.get_attribute('.sch svg.mk','class'))
  check('marks are SVG', pg.locator('.seg svg.mk').count()>0)
  pg.click('.seg[data-id$="Dentist.md"]'); check('click opens the note', pg.evaluate('window.__opened')=='Calendar/Linear/2027-03-14 Dentist.md')
  bg0=pg.evaluate("getComputedStyle(document.querySelector('.lytlc')).backgroundColor"); we=pg.evaluate("getComputedStyle(document.querySelector('.day.we')).backgroundColor")
  check('Auto theme is Play in a light Obsidian ('+bg0+')', bg0=='rgb(255, 255, 255)' and pg.get_attribute('.lytlc','data-lc-theme')=='play')
  ff=pg.evaluate("getComputedStyle(document.querySelector('.lytlc')).fontFamily"); fv=pg.evaluate("getComputedStyle(document.querySelector('.lytlc')).fontVariationSettings")
  check('Recursive with Casual on ('+ff+'; '+fv+')', ff.startswith('Recursive') and 'CASL' in fv)
  check('fonts requested once', pg.locator('link#lytlc-fonts').count()==1)
  check('Obsidian button chrome stays out', pg.evaluate("getComputedStyle(document.querySelector('.lytlc-head .yr button')).boxShadow")=='none')
  pg.click('.lytlc #shape button:text-is("Half")'); pg.wait_for_timeout(100); check('Whole / Half switches', pg.locator('.mrow.h2').count()==12)
  pg.screenshot(path=str(R/'test/smoke-half.png'))
  pg.click('.lytlc #shape button:text-is("Whole")'); pg.wait_for_timeout(100)
  pg.screenshot(path=str(R/'test/smoke-light.png'))
  pg.evaluate("()=>{ document.body.classList.replace('theme-light','theme-dark'); }"); pg.evaluate("()=>window.__redraw&&window.__redraw()")
  pg.evaluate("()=>{ var c=document.querySelector('.lytlc'); c.setAttribute('data-lc-theme', document.body.classList.contains('theme-dark')?'dark':'play'); }")
  bg=pg.evaluate("getComputedStyle(document.querySelector('.lytlc')).backgroundColor")
  check('LYT Mode colours when chosen ('+bg+')', bg!='rgb(255, 255, 255)')
  pg.screenshot(path=str(R/'test/smoke-dark.png'))
  check('no page errors '+str(errs), not errs)
  b.close()
sys.exit(0 if ok else 1)
