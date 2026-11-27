#!/usr/bin/env python3
"""Build main.js (the shared markup as APP_HTML, core.js, ui.js, then the plugin platform) and styles.css from src/core (shared with the web app) and src/plugin.
The core is plain JS included as source into one closure with the plugin shell, so no bundler or npm is needed.
styles.css scopes the core's styles to the view (.lytlc) and leaves out rules Obsidian's review flags
(!important, :has, clip-path, text-decoration, scrollbar-width, all:) and the web page's print and body rules."""
import pathlib, re
R=pathlib.Path(__file__).resolve().parent.parent
import json
core='var APP_HTML='+json.dumps((R/'src/core/app.html').read_text())+';\n'+(R/'src/core/core.js').read_text()+'\n'+(R/'src/core/ui.js').read_text(); shell=(R/'src/plugin/shell.js').read_text()
(R/'main.js').write_text('/* LYT Linear Calendar for Obsidian. GPL-3.0. Built by tools/build.py from src/core and src/plugin; edit those, not this file. */\n(function () {\n'+core+'\n'+shell+'\n})();\n')
BANNED=re.compile(r'!important|:has\(|clip-path|text-decoration|scrollbar-width|(^|[;{\s])all\s*:')
def scope(sel):
  sel=sel.strip()
  if sel in (':root','html','body','html,body'): return '.lytlc'
  m=re.match(r'^(\[data-font="\w+"\])(\s+body)?(\s.*)?$',sel)
  if m: return '.lytlc'+m.group(1)+(m.group(3) or '')
  m=re.match(r'^body((?:\.[\w-]+)+)(.*)$',sel)
  if m: return '.lytlc'+m.group(1)+m.group(2)
  if sel.startswith('body') or ' body' in sel or sel.startswith('html'): return None
  if sel=='*': return '.lytlc *'
  m=re.match(r'^(\[data-lc-theme="\w+"\])(.*)$',sel)
  if m: return '.lytlc'+m.group(1)+m.group(2)
  return '.lytlc '+sel
def rules(css):
  i=0; out=[]
  css=re.sub(r'/\*.*?\*/','',css,flags=re.S)
  while i<len(css):
    j=css.find('{',i)
    if j<0: break
    head=css[i:j].strip()
    if head.startswith('@'):
      depth=1; k=j+1
      while depth and k<len(css):
        depth+=1 if css[k]=='{' else -1 if css[k]=='}' else 0; k+=1
      if not head.startswith('@media print'): 
        inner=rules(css[j+1:k-1])
        if inner: out.append(head+'{'+''.join(inner)+'}')
      i=k; continue
    k=css.find('}',j); body=css[j+1:k]; i=k+1
    if BANNED.search(body): continue
    sels=[scope(s) for s in head.split(',')]; sels=[s for s in sels if s]
    if sels: out.append(','.join(sels)+'{'+body.strip()+'}\n')
  return out
css=''.join(rules((R/'src/core/core.css').read_text()))+(R/'src/plugin/plugin.css').read_text()
(R/'styles.css').write_text('/* LYT Linear Calendar for Obsidian. GPL-3.0. Built by tools/build.py; edit src/core/core.css or src/plugin/plugin.css. */\n'+css)
bad=[l for l in css.split('\n') if BANNED.search(l)]
print('built main.js and styles.css;', 'lint-flagged rules left:', len(bad))
