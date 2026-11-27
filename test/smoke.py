#!/usr/bin/env python3
"""Smoke test for the built plugin (main.js, styles.css) in headless Chrome, with a stand-in for Obsidian's API and a
writable vault in memory. It drives the shared interface the way a person would and checks the notes it writes.
Run: python3 test/smoke.py   (needs Playwright and Chrome)"""
import pathlib, json, sys
from playwright.sync_api import sync_playwright
R=pathlib.Path(__file__).resolve().parent.parent
MAIN=(R/'main.js').read_text(); CSS=(R/'styles.css').read_text()
FILES={
 'Calendar/Dentist.md':'---\nstart: 2027-03-14\ncategory: Work\nup: "[[Home]]"\n---\n\n## Plan\nBring forms.\n\n## Reflection\n\n## Notes\nKeep this.\n',
 'Linear/2027-03-20 Ski trip.md':'---\nstart: 2027-03-20\nend: 2027-03-24\ncategory: Travel\n---\n\n## Plan\n\n## Reflection\n',
 'Linear/2027-07-04 NYC » HLN.md':'---\nstart: 2027-07-04\ncategory: "[[Travel]]"\n---\n',
 'Linear/Sometime/2027-06 Paint the porch.md':'---\nmonth: 2027-06\ncategory: Family\n---\nJust some words.\n',
 'Atlas/Some idea.md':'---\nup: "[[Home]]"\n---\nNo dates here.\n',
 'Linear/2027 Linear.md':'---\nyear: 2027\n---\n\n## Intentions\nWrite the book.\n\n## Reflection\n',
 'Linear/Trends/Work/LYT.md':'---\ncategory: Work\ncolor: "#5b2e91"\nstretches:\n  - "2027-01 → 2027-06 · 60%"\n---\n',
}
STUB=r"""
window.__log=[]; var F={};
function yamlParse(s){ var o={},last=null; s.split('\n').forEach(function(l){ var li=l.match(/^\s+-\s+(.*)$/); if(li&&last){ if(!Array.isArray(o[last]))o[last]=[]; var v=li[1].trim(); try{ if(/^"/.test(v))v=JSON.parse(v);}catch(e){} o[last].push(v); return; }
  var m=l.match(/^([^:\s][^:]*):\s*(.*)$/); if(!m)return; last=m[1]; var v=m[2].trim(); if(v==='')o[last]=null; else { if(/^"/.test(v)){try{v=JSON.parse(v)}catch(e){}} else if(v==='true')v=true; o[last]=v; } }); return o; }
function yamlOut(o){ return Object.keys(o).map(function(k){ var v=o[k]; if(Array.isArray(v))return k+':\n'+v.map(function(x){return '  - '+JSON.stringify(x)}).join('\n'); if(v==null)return k+':'; if(typeof v==='string'&&/^\[\[|[:#]/.test(v))return k+': '+JSON.stringify(v); return k+': '+v; }).join('\n'); }
function fmOf(t){ var m=t.match(/^---\n([\s\S]*?)\n---\n?/); return m?yamlParse(m[1]):null; }
function mkf(p,t){ var b=p.split('/').pop(); F[p]={path:p,basename:b.replace(/\.md$/,''),extension:'md',name:b,text:t}; return F[p]; }
Object.keys(window.__files).forEach(function(p){ mkf(p,window.__files[p]); });
var H={}; function on(n){ return function(ev,fn){ (H[n+':'+ev]=H[n+':'+ev]||[]).push(fn); return {}; }; }
window.__fire=function(n,ev,a,b){ (H[n+':'+ev]||[]).forEach(function(f){f(a,b);}); };
var vault={ getMarkdownFiles:function(){ return Object.values(F); }, getAbstractFileByPath:function(p){ return F[p]||(window.__dirs[p]?{path:p}:null); },
  cachedRead:async function(f){ return f.text; }, create:async function(p,t){ if(F[p])throw new Error('exists '+p); __log.push('create '+p); return mkf(p,t); },
  modify:async function(f,t){ __log.push('modify '+f.path); f.text=t; }, process:async function(f,fn){ __log.push('process '+f.path); f.text=fn(f.text); return f.text; },
  createFolder:async function(p){ window.__dirs[p]=1; }, on:on('vault') };
window.__dirs={};
var fileManager={ processFrontMatter:async function(f,fn){ __log.push('fm '+f.path); var m=f.text.match(/^---\n([\s\S]*?)\n---\n?/), o=m?yamlParse(m[1]):{}; fn(o); f.text='---\n'+yamlOut(o)+'\n---\n'+(m?f.text.slice(m[0].length):f.text); },
  renameFile:async function(f,to){ __log.push('rename '+f.path+' -> '+to); var was=f.path; delete F[was]; f.path=to; f.name=to.split('/').pop(); f.basename=f.name.replace(/\.md$/,''); F[to]=f; window.__fire('vault','rename',f,was); },
  trashFile:async function(f){ __log.push('trash '+f.path); delete F[f.path]; } };
var VIEWREF={v:null};
var app={vault:vault,fileManager:fileManager, metadataCache:{getFileCache:function(f){ return {frontmatter:fmOf(f.text)}; },on:on('meta')},
  workspace:{getLeavesOfType:function(){return [];},getActiveViewOfType:function(){ return window.__inactive?null:VIEWREF.v; },getLeaf:function(){return {setViewState:async function(){},openFile:function(f){window.__opened=f.path;}};},revealLeaf:function(){},on:on('ws')}};
function deco(el){ el.empty=function(){ el.textContent=''; }; el.addClass=function(c){ el.classList.add(c); }; el.setAttr=function(k,v){ el.setAttribute(k,v); };
  el.createEl=function(tag,o){ var x=document.createElement(tag); o=o||{}; if(o.text)x.textContent=o.text; if(o.cls)x.className=o.cls; el.appendChild(x); return deco(x); };
  el.createDiv=function(o){ return el.createEl('div',o); }; return el; }
var obs={ItemView:class{constructor(leaf){this.leaf=leaf;this.app=app;this.contentEl=deco(document.createElement('div'));this.contentEl.className='view-content';document.querySelector('.workspace-leaf-content').appendChild(this.contentEl);VIEWREF.v=this;} registerEvent(){} },
  Notice:class{constructor(m){window.__notice=m;}},
  PluginSettingTab:class{constructor(a,p){this.app=a;this.plugin=p;this.containerEl=deco(document.createElement('div'));}}, Setting:class{constructor(){} setName(){return this} setDesc(){return this} addDropdown(){return this} addToggle(){return this} addText(){return this}},
  Plugin:class{constructor(a){this.app=a;} async loadData(){return null;} async saveData(d){window.__saved=d;} registerView(t,f){window.__view=f;} addRibbonIcon(){} addCommand(c){window.__cmd=c;} addSettingTab(t){window.__tab=t;} }};
window.__app=app; window.__obs=obs; window.__F=F;
"""
ok=True
def check(name,cond):
  global ok; ok=ok and bool(cond); print(('PASS ' if cond else 'FAIL ')+name)
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
  pg=b.new_page(viewport={'width':1300,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
  pg.set_content('<!doctype html><html><head><style>button{box-shadow:0 2px 3px rgba(0,0,0,.3);border-radius:8px;height:30px} .workspace-leaf-content{position:absolute;left:220px;top:40px;right:0;bottom:0;display:flex;flex-direction:column} .view-content{flex:1;min-height:0}</style><style>'+CSS+'</style></head><body class="theme-light"><div class="workspace-leaf-content"></div></body></html>')
  pg.add_script_tag(content='window.__files='+json.dumps(FILES)+';'+STUB)
  pg.evaluate("src=>{ var module={exports:null}; new Function('require','module',src)(function(){return window.__obs;},module); window.__P=module.exports; }",MAIN)
  pg.evaluate("async()=>{ var pl=new window.__P(window.__app); await pl.onload(); var v=window.__view({app:window.__app}); window.__v=v; await v.onOpen(); }")
  pg.wait_for_timeout(300)
  text=lambda p_: pg.evaluate("p=>window.__F[p]&&window.__F[p].text",p_)
  log=lambda: pg.evaluate("window.__log.slice()")
  def box(sel):
    bb=pg.locator(sel).first.bounding_box(); return bb['x']+bb['width']/2, bb['y']+bb['height']/2
  def settle(ms=1400): pg.wait_for_timeout(ms)
  check('the web app’s header: year, Life Trends, toolbar icons', pg.locator('.lytlc header #ylab').count()==1 and pg.locator('#lifeBtn').count()==1 and pg.locator('#setbar button').count()>=4)
  check('the categories bar', pg.locator('#cats .chip').count()>=5)
  check('pop-ups and cards sit in a layer outside the pane', pg.evaluate("document.querySelector('.lytlc-layer #setdd')!==null&&document.querySelector('.lytlc-layer #panel')!==null"))
  while pg.text_content('#ylab')!='2027':
    pg.click('#next' if int(pg.text_content('#ylab') or 0)<2027 else '#prev'); pg.wait_for_timeout(60)
  titles=pg.eval_on_selector_all('.seg .lab',"e=>e.map(x=>x.textContent)")
  check('dated notes from anywhere in the vault draw', any('Dentist' in t for t in titles) and any('Ski trip' in t for t in titles))
  check('a note without dates stays out', not any('Some idea' in t for t in titles))
  check('Sometime note sits in June', pg.locator('.mrow[data-m="5"] .sch').count()>=1)
  check('route draws with a tilted triangle', pg.locator('.seg .lab.route').count()>=1)
  bg=pg.evaluate("getComputedStyle(document.querySelector('.view-content.lytlc')).backgroundColor")
  check('Auto theme is Play in a light Obsidian', bg=='rgb(255, 255, 255)' and pg.get_attribute('.view-content.lytlc','data-lc-theme')=='play')
  check('the layer carries the theme too', pg.get_attribute('.lytlc-layer','data-lc-theme')=='play')
  ff=pg.evaluate("getComputedStyle(document.querySelector('.view-content.lytlc')).fontFamily")
  check('Recursive', ff.startswith('Recursive'))
  check('Obsidian button chrome stays out', pg.evaluate("getComputedStyle(document.querySelector('#prev')).boxShadow")=='none')
  # pop-up and Open note
  pg.locator('.seg', has_text='Dentist').first.click(); pg.wait_for_timeout(200)
  check('click opens the item pop-up, as on the web', pg.locator('.lytlc-layer .pop').count()==1)
  pg.locator('.pop button', has_text='Open note').click()
  check('Open note opens the file', pg.evaluate('window.__opened')=='Calendar/Dentist.md')
  # settings card
  pg.click('#setbar [data-tab=cats]'); pg.wait_for_timeout(200)
  sd=pg.locator('#setdd').bounding_box(); vc=pg.locator('.view-content').bounding_box()
  check('Categories card opens inside the pane ('+str(int(sd['x']))+')', pg.locator('#setdd.open').count()==1 and sd['x']>=vc['x'] and sd['x']+sd['width']<=vc['x']+vc['width']+1)
  check('no Import tab (the vault is the data)', not pg.locator('#setbar [data-tab=data]').is_visible())
  pg.click('#setbar [data-tab=cats]'); pg.wait_for_timeout(200)
  # new note by dragging across days
  a=box('.day[data-date="2027-02-08"]'); z=box('.day[data-date="2027-02-11"]')
  pg.mouse.move(*a); pg.mouse.down(); pg.mouse.move(a[0]+20,a[1],steps=3); pg.mouse.move(*z,steps=5); pg.mouse.up()
  pg.keyboard.type('Writing week'); settle(1000)
  check('no file while the name is being typed', not any('Writing' in l for l in log()))
  pg.keyboard.press('Escape'); settle()
  np='Linear/2027-02-08 → 2027-02-11 Writing week.md'
  made=[l for l in log() if l.startswith('create') and 'Writing' in l]
  check('a new item becomes a note in Linear ('+(made[0] if made else 'none')+')', len(made)==1)
  np=made[0][7:] if made else np
  t=text(np) or ''
  check('the note has start, end, Plan and Reflection', 'start: 2027-02-08' in t and 'end: 2027-02-11' in t and '## Plan' in t)
  # move it: drag the bar two days
  seg=pg.locator('.seg', has_text='Writing week').first; bb=seg.bounding_box(); d9=box('.day[data-date="2027-02-09"]'); d11=box('.day[data-date="2027-02-11"]')
  sy=bb['y']+bb['height']/2; pg.mouse.move(d9[0],sy); pg.mouse.down(); pg.mouse.move(d11[0],sy,steps=8); pg.mouse.up(); settle()
  cur=[pth for pth in pg.evaluate("Object.keys(window.__F)") if 'Writing week' in pth]
  t=text(cur[0]) if cur else ''
  check('moving it updates the dates ('+(cur[0] if cur else '')+')', 'start: 2027-02-10' in t and 'end: 2027-02-13' in t)
  check('and the file name follows', cur and '2027-02-10' in cur[0])
  # edit the plan of a note that has other sections
  pg.locator('.seg', has_text='Dentist').first.click(); pg.wait_for_timeout(200)
  pg.locator('.pop button', has_text='Open details').click(); pg.wait_for_timeout(200)
  pg.fill('#f-plan','Bring forms and the card.'); pg.locator('#f-plan').blur(); settle()
  t=text('Calendar/Dentist.md') or ''
  check('editing the Plan writes only that section', 'Bring forms and the card.' in t and '## Notes\nKeep this.' in t and 'up: "[[Home]]"' in t)
  check('a note outside Linear stays where it is', 'Calendar/Dentist.md' in pg.evaluate("Object.keys(window.__F)"))
  pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
  # delete
  pg.locator('.seg', has_text='Writing week').first.click(); pg.wait_for_timeout(200)
  dl=pg.locator('.pop button.danger'); dl.click(); dl.click(); settle()
  check('Delete moves the note to the trash', any(l.startswith('trash') and 'Writing week' in l for l in log()))
  # a change made in Obsidian shows up
  pg.evaluate("()=>{ var f=window.__F['Linear/2027-03-20 Ski trip.md']; f.text=f.text.replace('start: 2027-03-20','start: 2027-04-20').replace('end: 2027-03-24','end: 2027-04-24'); window.__fire('meta','changed',f); }"); settle(900)
  check('an edit in Obsidian redraws the calendar', pg.locator('.mrow[data-m="3"] .seg', has_text='Ski trip').count()>=1)
  # year note
  pg.click('#yearNote'); pg.wait_for_timeout(200)
  ta=pg.locator('aside textarea').first; ta.fill('Write the book. Ship the plugin.'); ta.blur(); settle()
  t=text('Linear/2027 Linear.md') or ''
  check('the year note’s Intentions are written', 'Ship the plugin.' in t)
  pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
  # keys only when the calendar is the active tab
  pg.evaluate("window.__inactive=true"); y0=pg.text_content('#ylab'); pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(100)
  check('keys are left alone when another tab is active', pg.text_content('#ylab')==y0)
  pg.evaluate("window.__inactive=false")
  check('Life Trends thread read from its file', pg.evaluate("Object.keys(window.__F).some(p=>p.indexOf('Trends/Work/LYT')>0)") and not any('Trends' in l for l in log()))
  pg.screenshot(path=str(R/'test/smoke-light.png'))
  pg.evaluate("async()=>{ await window.__v.onClose(); }")
  check('closing removes the layer', pg.locator('.lytlc-layer').count()==0)
  check('no page errors '+('; '.join(errs[:3])), not errs)
  print('log:', log())
  print('ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
