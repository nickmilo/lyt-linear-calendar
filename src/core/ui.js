/* LYT Linear Calendar: the shared interface (header, categories, pop-ups, cards, dragging, settings, Life Trends editing).
   GPL-3.0. Runs in the web app and in the Obsidian plugin. Each platform defines, before calling initUI():
   S (state), save(), EX (export options) and PF:
     PF.root     element holding the app (web: document.body)       PF.layer   where pop-ups and cards go
     PF.themeEl  element carrying the theme attributes and --hdr    PF.scroller / PF.scrollEl  what scrolls, and what fires 'scroll'
     PF.sy()     how far it has scrolled                             PF.signal  AbortSignal that removes every listener
     PF.active() whether keystrokes belong to the app                PF.canExport  whether "Export to Obsidian" shows
     PF.openExport(), PF.vh() (visible height), optional PF.openFile(id)/PF.hasFile(id), PF.folder() */
/* every listener goes through ON, so a platform can remove them all at once, and keys only count while the app is active */
function ON(t,type,fn,opt){ var o=typeof opt==='object'&&opt?opt:{capture:!!opt}; if(PF.signal)o.signal=PF.signal;
  var f=(type==='keydown'||type==='keyup')?function(e){ if(PF.active&&!PF.active())return; return fn.call(this,e); }:fn; t.addEventListener(type,f,o); }

/* ---------- apply settings ---------- */
function applySet(){
  var r=PF.themeEl;
  r.setAttribute('data-lc-theme',PF.themeName?PF.themeName(S.set.theme):S.set.theme);
  r.setAttribute('data-font',S.set.font);
  r.style.setProperty('--panel-op',(100-(S.set.see==null?22:S.set.see))+'%');
}

/* ---------- categories bar ---------- */
function renderCats(){
  var c=$('cats');c.textContent='';
  c.appendChild(el('span','lbl','Categories'));
  S.cats.forEach(function(k){
    var b=el('button','chip'+(S.hidden.indexOf(k.id)>=0?' off':''));b.dataset.cat=k.id;
    b.appendChild(mk(k.mark));b.appendChild(document.createTextNode(k.name));
    b.title='Show or hide '+k.name+' · drag to reorder · right-click to edit';
    b.setAttribute('aria-pressed',S.hidden.indexOf(k.id)<0);
    b.onclick=function(){if(chipDrag.just){chipDrag.just=false;return;}var i=S.hidden.indexOf(k.id);if(i>=0)S.hidden.splice(i,1);else S.hidden.push(k.id);save();renderCats();renderYear();};
    c.appendChild(b);
  });
  var add=el('button','chip','+ Category');add.style.borderStyle='dashed';add.onclick=function(){openSettings(true)};c.appendChild(add);
  c.appendChild(el('span','hint','Drag across days for a span · Click a day for a single date'));
}

/* drag a category chip to reorder */
var chipDrag={};
function chipFollow(D,x){ D.el.style.transform='none'; var r=D.el.getBoundingClientRect(); D.el.style.transform='translateX('+(x-D.grab-r.left)+'px)'; return r; }
var SWATCH=['#ed3982','#c8175f','#f6a3c6','#6c2f90','#5b2e91','#13b6e3','#4072ba','#03ae4b','#7cd2f6','#ffcf34'];
/* a thread's colour: Maya's colours, any colour, or Auto (a shade of its category) */
function colorRow(t,after){ var r=el('div','lcolors'); r.setAttribute('role','group'); r.setAttribute('aria-label','Colour for '+t.name);
  var au=el('button','lsw auto'+(t.color?'':' on'),'Auto');au.title='A shade of the category’s colours';au.onclick=function(e){e.stopPropagation(); delete t.color; save(); after(); };r.appendChild(au);
  SWATCH.forEach(function(c){ var b=el('button','lsw'+(t.color===c?' on':''));b.style.background=c;b.setAttribute('aria-label','Colour '+c);b.onclick=function(e){e.stopPropagation(); t.color=c; save(); after(); };r.appendChild(b); });
  var lab=el('label','lsw cust');lab.title='Any colour';var ci=el('input');ci.type='color';ci.value=t.color||'#ed3982';ci.setAttribute('aria-label','Any colour');ci.oninput=function(){ t.color=ci.value; save(); renderYear(); };ci.onchange=function(){ after(); };lab.appendChild(ci);r.appendChild(lab);
  return r; }
function strandColorPop(t,x,y){ closeLifePop(); var p=el('div','pop lpop');p.setAttribute('role','dialog');p.setAttribute('aria-label','Colour for '+t.name);
  var hd=el('div','row');hd.appendChild(el('b','','Thread'));var cb=closeBtn();cb.style.marginLeft='auto';cb.style.width='30px';cb.style.height='30px';cb.onclick=closeLifePop;hd.appendChild(cb);p.appendChild(hd);
  var rn=el('input');rn.value=t.name;rn.setAttribute('aria-label','Thread name');rn.style.marginBottom='4px';
  rn.onchange=function(){ var v=(rn.value||'').trim(); if(!v||v===t.name)return; var same=S.trends.filter(function(x){return x!==t&&x.cat===t.cat&&x.name.toLowerCase()===v.toLowerCase()})[0];
    if(same){ same.stretches=same.stretches.concat(t.stretches); S.trends=S.trends.filter(function(x){return x!==t}); toast('Merged into '+same.name); closeLifePop(); } else { t.name=v; } save(); renderYear(); };
  rn.onkeydown=function(e){ if(e.key==='Enter'){ e.preventDefault(); rn.blur(); } };
  p.appendChild(rn);
  p.appendChild(colorRow(t,function(){ renderYear(); strandColorPop(t,parseFloat(p.style.left),parseFloat(p.style.top)-12); }));
  PF.layer.appendChild(p); lpop=p; var r=p.getBoundingClientRect(); p.style.left=Math.max(8,Math.min(x,innerWidth-r.width-8))+'px'; p.style.top=Math.max(8,Math.min(y+12,innerHeight-r.height-8))+'px'; }
/* drag across months to add a stretch; click a stretch to edit it */
var LD=null, lpop=null;
function lifeSel(){ PF.root.querySelectorAll('.lband.lsel').forEach(function(x){x.classList.remove('lsel')}); if(!LD)return; var a=Math.min(LD.a,LD.b), b=Math.max(LD.a,LD.b);
  PF.root.querySelectorAll('.lband[data-cat="'+LD.cat+'"]').forEach(function(x){ var i=+x.dataset.i; if(i>=a&&i<=b)x.classList.add('lsel'); }); }
function lifePrune(s){ if(!s.at)return; Object.keys(s.at).forEach(function(ym){ if(ym<s.from||ym>s.to||(s.share!=null&&s.share!==''&&+s.at[ym]===+s.share))delete s.at[ym]; }); if(!Object.keys(s.at).length)delete s.at; }
function lifeStretch(D){ var t=S.trends.filter(function(x){return x.id===D.tid})[0]; return t?{t:t,s:t.stretches[D.k]}:null; }
/* share grips: inside the month they set that month's shares; past the month they extend the stretch */
function lifeShareRestore(D){ D.parts.forEach(function(q){ if(q.at0)q.s.at=JSON.parse(JSON.stringify(q.at0)); else delete q.s.at; q.s.to=q.to0; }); }
function lifeShare(e,b){ var D=LD, ym=ymOf(D.at); lifeShareRestore(D);
  var same=b&&+b.dataset.i===D.at, tip=$('lpct'); if(!tip){ tip=el('div','lpct num');tip.id='lpct';PF.layer.appendChild(tip); }
  var mine=D.parts[D.j];
  if(!same&&b&&mine&&mi(mine.to0)===D.at&&+b.dataset.i>D.at){ mine.s.to=ymOf(+b.dataset.i); tip.textContent='Extend to '+ymNice(mine.s.to); }
  else {
    var cell=PF.root.querySelector('.lband[data-cat="'+D.cat+'"][data-i="'+D.at+'"]'); if(!cell)return; var r=cell.getBoundingClientRect();
    var step=e.shiftKey?1:5, pct=Math.round(((e.clientX-r.left)/r.width*100)/step)*step;
    D.parts.forEach(function(q){ q.s.at=q.s.at||{}; q.s.at[ym]=Math.round(q.w); });   /* this month's shares become explicit */
    var start=0; for(var j=0;j<D.j;j++)start+=Math.round(D.parts[j].w);
    if(D.j<D.parts.length-1){ var end=start+Math.round(D.parts[D.j].w)+Math.round(D.parts[D.j+1].w), nb=Math.max(start,Math.min(end,pct)); mine.s.at[ym]=nb-start; D.parts[D.j+1].s.at[ym]=end-nb; }
    else { var tot=0; D.parts.forEach(function(q,j){ if(j!==D.j)tot+=Math.round(q.w); }); mine.s.at[ym]=Math.max(0,Math.min(100-tot,pct-start)); }
    tip.textContent=ymNice(ym)+' · '+D.parts.map(function(q){ var t=S.trends.filter(function(x){return x.stretches.indexOf(q.s)>=0})[0]; return (t?t.name:'')+' '+q.s.at[ym]+'%'; }).join(' · ');
  }
  tip.style.left=(e.clientX+14)+'px'; tip.style.top=(e.clientY+16)+'px';
  renderYear(); }
function closeLifePop(){ if(lpop){lpop.remove();lpop=null;} PF.root.querySelectorAll('.lband.lsel').forEach(function(x){x.classList.remove('lsel')}); }
function lifePop(x,y,o){
  closeLifePop(); var c=cat(o.cat), editing=!!o.t, st=editing?o.t.stretches[o.k]:{from:o.from,to:o.to,share:null};
  var p=el('div','pop lpop');p.setAttribute('role','dialog');p.setAttribute('aria-label',editing?'Edit stretch':'New stretch');
  var hd=el('div','row');var dt=el('div','l num when');
  var f1=el('input','lym num');f1.value=st.from;f1.setAttribute('aria-label','From (year-month)');var f2=el('input','lym num');f2.value=st.to;f2.setAttribute('aria-label','To (year-month)');
  dt.appendChild(f1);dt.appendChild(document.createTextNode(' – '));dt.appendChild(f2);hd.appendChild(dt);
  var cn=el('span','small');cn.style.marginLeft='auto';cn.appendChild(mk(c?c.mark:'none'));cn.appendChild(document.createTextNode(' '+(c?c.name:'')));hd.appendChild(cn);
  var cb=closeBtn();cb.style.width='30px';cb.style.height='30px';cb.onclick=closeLifePop;hd.appendChild(cb);p.appendChild(hd);
  var nm=el('input');nm.placeholder='Thread, like LYT or Montana';nm.value=editing?o.t.name:'';nm.setAttribute('aria-label','Thread');
  if(editing){ var tt=el('div','ltitle');var tsw=el('i');tsw.style.background=strandColor(o.t);tt.appendChild(tsw);tt.appendChild(el('b','',o.t.name));p.appendChild(tt); } else p.appendChild(nm);
  var ex=strandsOf(o.cat); if(ex.length&&!editing){ var cp=el('div','catpick'); ex.forEach(function(t){ var b=el('button','chip'+(editing&&t===o.t?' on':''));var sw=el('i');sw.style.cssText='width:10px;height:10px;display:inline-block;background:'+strandColor(t);b.appendChild(sw);b.appendChild(document.createTextNode(t.name));b.onclick=function(){nm.value=t.name;cp.querySelectorAll('.chip').forEach(function(z){z.classList.toggle('on',z===b)});};cp.appendChild(b); }); p.appendChild(cp); }
  if(editing){ var cl=el('div','l small','Colour');cl.style.marginTop='2px';p.appendChild(cl); var crow=null; var redo=function(){ renderYear(); var nr=colorRow(o.t,redo); crow.replaceWith(nr); crow=nr; }; crow=colorRow(o.t,redo); p.appendChild(crow); }
  var sh=el('label','chk');sh.style.marginTop='2px';sh.appendChild(document.createTextNode('Share'));var si=el('input','num');si.type='number';si.min=0;si.max=100;si.placeholder='even';si.style.width='70px';si.value=st.share==null?'':st.share;sh.appendChild(si);sh.appendChild(el('span','small','% of the month (blank splits evenly)'));p.appendChild(sh);
  var acts=el('div','row acts');var ok=el('button','primary',editing?'Done':'Add');
  function apply(){ var name=(nm.value||'').trim(); if(!name){nm.focus();return;} var a=f1.value.trim(), b=f2.value.trim(); if(!/^\d{4}-\d{2}$/.test(a)||!/^\d{4}-\d{2}$/.test(b))return toast('Dates are year-month, like 2016-01'); if(a>b){var z=a;a=b;b=z;}
    var share=si.value===''?null:Math.max(0,Math.min(100,+si.value));
    var t=editing?o.t:S.trends.filter(function(x){return x.cat===o.cat&&x.name.toLowerCase()===name.toLowerCase()})[0];
    if(editing){ o.t.stretches.splice(o.k,1); }
    if(!t){ t={id:uid(),cat:o.cat,name:name,stretches:[]}; S.trends.push(t); }
    var keepAt=editing&&st.at?JSON.parse(JSON.stringify(st.at)):null; t.stretches.push(keepAt?{from:a,to:b,share:share,at:keepAt}:{from:a,to:b,share:share}); lifePrune(t.stretches[t.stretches.length-1]); t.stretches.sort(function(x,y){return x.from<y.from?-1:1});
    save(); closeLifePop(); renderYear(); }
  ok.onclick=apply; [nm,si,f1,f2].forEach(function(i){ i.onkeydown=function(e){ if(e.key==='Enter'){e.preventDefault();apply();} }; });
  acts.appendChild(ok);
  if(editing){ var more=el('button','','+ Add another thread to these months');more.onclick=function(){ var r0=p.getBoundingClientRect(); lifePop(r0.left,r0.top-12,{cat:o.cat,from:f1.value.trim()||st.from,to:f2.value.trim()||st.to}); };acts.appendChild(more); }
  if(editing){ var dl=el('button','danger','Delete');dl.style.marginLeft='auto';dl.onclick=function(){ o.t.stretches.splice(o.k,1); if(!o.t.stretches.length)S.trends=S.trends.filter(function(x){return x!==o.t}); save(); closeLifePop(); renderYear(); }; acts.appendChild(dl); }
  p.appendChild(acts);
  PF.layer.appendChild(p); lpop=p;
  var r=p.getBoundingClientRect(); p.style.left=Math.max(8,Math.min(x,innerWidth-r.width-8))+'px'; p.style.top=Math.max(8,Math.min(y+12,innerHeight-r.height-8))+'px';
  if(editing)ok.focus(); else nm.focus();
}
function setView(v){ S.set.view=v; save(); PF.root.classList.toggle('lifeview',v==='life'); $('lifeBtn').classList.toggle('on',v==='life'); $('lifeBtn').setAttribute('aria-pressed',v==='life'); closeLifePop(); if(v!=='life')$('year').classList.remove('life'); PF.scroller.scrollTo(0,0); renderYear(); }

/* ---------- whole ↔ half months, animated ---------- */
function shapeSync(){ PF.root.querySelectorAll('#shape button').forEach(function(b){ var on=(b.dataset.half==='1')===!!S.set.half; b.classList.toggle('on',on); b.setAttribute('aria-pressed',on); }); }
function keyed(){ var out={};
  PF.root.querySelectorAll('.day[data-date]').forEach(function(e){out['d'+e.dataset.date]=e;});
  PF.root.querySelectorAll('.mrow:not(.h2) .mname').forEach(function(e){out['n'+e.dataset.ym]=e;});
  PF.root.querySelectorAll('.mrow:not(.h2) .some').forEach(function(e){out['s'+e.dataset.ym]=e;});
  return out; }
/* ---------- harp: a plucked glissando for Whole ⇄ Half (Karplus-Strong, made in the browser, no files) ---------- */
var AC=null, HARP={};
function pluck(f){ if(HARP[f])return HARP[f]; var sr=AC.sampleRate, len=Math.floor(sr*3), N=Math.round(sr/f), b=AC.createBuffer(1,len,sr), d=b.getChannelData(0), ring=new Float32Array(N), i, prev=0;
  for(i=0;i<N;i++){ prev=prev*0.6+(Math.random()*2-1)*0.4; ring[i]=prev; }   /* pre-softened noise: a finger, not a pick */
  var k=0; for(i=0;i<len;i++){ var a=ring[k], n=ring[(k+1)%N]; d[i]=a; ring[k]=(a+n)*0.4992; k=(k+1)%N; }
  var at=Math.floor(sr*0.012); for(i=0;i<at;i++)d[i]*=i/at; return HARP[f]=b; }
function harp(up){
  if(S.set.harp!==true)return;
  try{ AC=AC||new (window.AudioContext||window.webkitAudioContext)(); if(AC.state==='suspended')AC.resume(); }catch(e){return;}
  /* fits inside the Whole/Half move (560ms + stagger): notes over 0.36s, all faded out by 0.7s, no echo */
  var t=AC.currentTime+0.02, END=0.7;
  var out=AC.createGain(); out.gain.setValueAtTime(0.1,t); out.gain.setValueAtTime(0.1,t+0.4); out.gain.exponentialRampToValueAtTime(0.0001,t+END);
  var lp=AC.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1700; lp.Q.value=0.4;
  out.connect(lp); lp.connect(AC.destination);
  var notes=[146.83,164.81,185,220,246.94,293.66,329.63]; /* D major pentatonic from D3 */
  if(!up)notes=notes.slice().reverse();
  notes.forEach(function(f,i){ var s=AC.createBufferSource(); s.buffer=pluck(f); var g=AC.createGain(); g.gain.value=0.75-i*0.05; s.connect(g); g.connect(out); s.start(t+i*0.06); s.stop(t+END+0.05); });
}
function setShape(half){
  if(!!S.set.half===half)return;
  var still=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var before={}, k0=keyed(), H=PF.vh(); Object.keys(k0).forEach(function(k){ var r=k0[k].getBoundingClientRect(); if(r.bottom>-50&&r.top<H+50)before[k]=r; });   /* only what's on screen moves */
  var hdr=parseFloat(getComputedStyle(PF.themeEl).getPropertyValue('--hdr'))||0, anchor=null, at=0;
  if(S.set.scroll){ var rows=PF.root.querySelectorAll('.mrow:not(.h2)'); for(var i=0;i<rows.length;i++){ var rb=rows[i].getBoundingClientRect(); if(rb.bottom>hdr){ anchor=rows[i].dataset.y+'-'+rows[i].dataset.m; at=rb.top; break; } } }
  S.set.half=half; save(); shapeSync(); harp(half); renderYear();
  if(S.set.scroll)holdScroll=Date.now()+700;
  if(anchor){ var ar=PF.root.querySelector('.mrow[data-k="'+anchor+'-0"]'); if(ar)PF.scroller.scrollBy(0,ar.getBoundingClientRect().top-at); }
  if(still||!document.body.animate)return;
  var k1=keyed();
  Object.keys(k1).forEach(function(k){ var a=before[k]; if(!a)return; var e=k1[k], b=e.getBoundingClientRect();
    var dx=a.left-b.left, dy=a.top-b.top; if(!dx&&!dy)return;
    var col=k.charAt(0)==='d'?((+k.slice(-2)-1)%16):0;
    e.animate([{transform:'translate('+dx+'px,'+dy+'px)'},{transform:'none'}],{duration:560,delay:col*9,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'}); });
  PF.root.querySelectorAll('.seg,.trace,.cellmark').forEach(function(e){ e.animate([{opacity:0},{opacity:1}],{duration:320,delay:420,easing:'ease-out',fill:'backwards'}); });
}
/* ---------- pointer: create, move, drop ---------- */
var drag=null, pickedId=null;
function dateAt(x,y){
  var e=document.elementFromPoint(x,y);
  while(e&&e!==document.body){ if(e.dataset&&e.dataset.date)return e.dataset.date;
    if(e.classList&&e.classList.contains('seg')){ /* look through segment to the day column */ var r=e.parentNode; return dayFromRow(r,x); }
    if(e.classList&&e.classList.contains('mrow'))return dayFromRow(e,x);
    e=e.parentNode; }
  return null;
}
function dayFromRow(row,x){
  var cells=row.querySelectorAll('.day[data-date]');
  for(var i=0;i<cells.length;i++){var r=cells[i].getBoundingClientRect();if(x>=r.left&&x<r.right)return cells[i].dataset.date;}
  return null;
}
function bands(a,b,cls){
  PF.root.querySelectorAll('.band'+(cls?'.'+cls:':not(.hov)')).forEach(function(x){x.remove()});
  if(!a||!b)return; var lo=a<b?a:b, hi=a<b?b:a;
  PF.root.querySelectorAll('.mrow').forEach(function(row){
    var m=+row.dataset.m, ry=+row.dataset.y, r0=+row.dataset.d0||1, r1=Math.min(+row.dataset.d1||31,new Date(ry,m+1,0).getDate()), first=iso(new Date(ry,m,r0)), last=iso(new Date(ry,m,r1));
    if(hi<first||lo>last)return;
    var d1=parse(lo<first?first:lo).getDate(), d2=parse(hi>last?last:hi).getDate();
    var x=el('div','band'+(cls?' '+cls:''));x.style.gridColumn=(d1-r0+2)+' / '+(d2-r0+3);row.appendChild(x);
  });
}
function paintRange(a,b){ bands(a,b); if(a)bands(null,null,'hov'); }
var hovDate=null;
var hovId=null, COLW=34;
function hoverItem(id){ if(id===hovId)return; PF.root.querySelectorAll('.seg.hov,.sch.hov').forEach(function(x){x.classList.remove('hov')}); hovId=id;
  if(id)PF.root.querySelectorAll('.seg[data-id="'+id+'"],.sch[data-id="'+id+'"]').forEach(function(x){x.classList.add('hov')});
  PF.root.querySelectorAll('.cellmark .mk').forEach(function(m){ m.style.transform=(id&&m.dataset.id===id)?'scale(1.25)':''; }); }
var ghost=null;
/* the Sometime column under the pointer: its month as YYYY-MM */
function someAt(x,y){ var e=document.elementFromPoint(x,y), so=e&&e.closest&&e.closest('.some'); return so&&so.dataset.ym?so.dataset.ym:null; }
function markDrop(mo){ PF.root.querySelectorAll('.some.drop').forEach(function(x){x.classList.remove('drop')}); if(mo){ var so=PF.root.querySelector('.mrow:not(.h2) .some[data-ym="'+mo+'"]'); if(so)so.classList.add('drop'); } }
function liftSeg(id){ PF.root.querySelectorAll('.seg[data-id="'+id+'"],.sch[data-id="'+id+'"]').forEach(function(x){x.classList.add('lifted')}); }
function revertDrag(D){ var n=find(D.id); if(!n||!D.orig)return; ['start','end','month'].forEach(function(k){ if(D.orig[k]!=null)n[k]=D.orig[k]; else delete n[k]; }); }
/* ---------- notes ---------- */
function find(id){for(var i=0;i<S.notes.length;i++)if(S.notes[i].id===id)return S.notes[i];return null}
function newNote(f){
  var lastCat=S.lastCat&&cat(S.lastCat)?S.lastCat:'';
  var n={id:uid(),title:'',category:lastCat,plan:'',reflection:''};
  if(f.start)n.start=f.start; if(f.end)n.end=f.end; if(f.month)n.month=f.month;
  S.notes.push(n);save();
  if($('panel').classList.contains('open'))closePanel();
  renderYear();
  var it=PF.root.querySelector('.seg[data-id="'+n.id+'"],.sch[data-id="'+n.id+'"]');
  var r=it?it.getBoundingClientRect():{left:innerWidth/2-180,bottom:innerHeight/3};
  itemPop(n,r.left,r.bottom+8,true);
}
function dropEmpty(keep){ var before=S.notes.length; S.notes=S.notes.filter(function(n){return n.id===keep||(n.title||'').trim()||(n.plan||'').trim()||(n.reflection||'').trim()}); if(S.notes.length!==before)save(); }
function closePanel(){
  var p=$('panel'); var id=pickedId; pickedId=null; delete p.dataset.fresh;
  if(id){ var n=find(id); if(n&&!(n.title||'').trim()&&!(n.plan||'').trim()&&!(n.reflection||'').trim()){ S.notes=S.notes.filter(function(x){return x.id!==id}); save(); } }
  p.classList.remove('open'); $('yearNote').classList.remove('on'); renderYear();
}
function openNote(id,fresh){
  $('yearNote').classList.remove('on');
  closeSettings();
  var keepScroll=($('panel').classList.contains('open')&&panelMode==='note'&&pickedId===id)?$('panel').scrollTop:0;
  dropEmpty(id); panelMode='note'; $('panel').dataset.mode='note';
  var n=find(id); if(!n)return; pickedId=id;
  var p=$('panel'); p.textContent='';
  var hd=el('div','ph');
  var t=el('input','ttl');t.value=n.title||'';t.placeholder='Name it';t.setAttribute('aria-label','Title');
  t.oninput=function(){n.title=t.value;save();renderYear();pv();};
  t.onkeydown=function(e){ if(e.key==='Enter'&&!e.isComposing){ e.preventDefault(); closePanel(); } };
  hd.appendChild(t);
  var x=closeBtn();x.setAttribute('aria-label','Close');x.onclick=closePanel;hd.appendChild(x);
  p.appendChild(hd);

  var f=el('div','fld');f.appendChild(el('div','l','What it is'));
  var sg=el('div','seg3');
  [['one','Single date'],['span','Span'],['some','Sometime']].forEach(function(o){
    var b=el('button',kindOf(n)===o[0]?'on':'',o[1]);
    b.onclick=function(){
      var k=kindOf(n);
      if(o[0]==='one'){ if(!n.start){n.start=(n.month||Y+'-01')+'-01';} delete n.end; delete n.month; }
      if(o[0]==='span'){ if(!n.start){n.start=(n.month||Y+'-01')+'-01';} if(!n.end||n.end===n.start)n.end=addDays(n.start,2); delete n.month; }
      if(o[0]==='some'){ if(n.start)n.month=n.start.slice(0,7); delete n.start; delete n.end; }
      save();renderYear();openNote(n.id);
    };
    sg.appendChild(b);
  });
  f.appendChild(sg);p.appendChild(f);

  var k=kindOf(n);
  if(k==='some'){
    var fm=el('div','fld');var lm=el('label','','Month');var im=el('input','num');im.type='month';im.value=n.month||'';im.id='f-month';lm.htmlFor='f-month';
    im.onchange=function(){if(im.value){n.month=im.value;save();renderYear();pv();}};
    fm.appendChild(lm);fm.appendChild(im);fm.appendChild(el('div','small','Drag it from the Sometime column onto a day once you know the date.'));p.appendChild(fm);
  } else {
    var two=el('div','two');
    var f1=el('div','fld');var l1=el('label','','Start');var i1=el('input','num');i1.type='date';i1.value=n.start;i1.id='f-start';l1.htmlFor='f-start';
    i1.onchange=function(){ if(!i1.value)return; var len=n.end?diff(n.start,n.end):0; n.start=i1.value; if(n.end)n.end=addDays(n.start,len); save();renderYear();openNote(n.id); };
    f1.appendChild(l1);f1.appendChild(i1);two.appendChild(f1);
    if(k==='span'){
      var f2=el('div','fld');var l2=el('label','','End');var i2=el('input','num');i2.type='date';i2.value=n.end;i2.min=n.start;i2.id='f-end';l2.htmlFor='f-end';
      i2.onchange=function(){ if(!i2.value)return; n.end=i2.value<n.start?n.start:i2.value; if(n.end===n.start)delete n.end; save();renderYear();openNote(n.id); };
      f2.appendChild(l2);f2.appendChild(i2);two.appendChild(f2);
    }
    p.appendChild(two);
    p.appendChild(el('div','small num',k==='span'?(diff(n.start,n.end)+1)+' days':nice(n.start)));
  }

  var fc=el('div','fld');fc.appendChild(el('div','l','Category'));var cp=el('div','catpick');
  var none=el('button','chip'+(!n.category?' on':''),'None');none.onclick=function(){n.category='';save();renderYear();openNote(n.id)};cp.appendChild(none);
  S.cats.forEach(function(c){var b=el('button','chip'+(n.category===c.id?' on':''));b.dataset.cat=c.id;b.title='Right-click to edit';b.appendChild(mk(c.mark));b.appendChild(document.createTextNode(c.name));
    b.onclick=function(){n.category=c.id;S.lastCat=c.id;save();renderYear();openNote(n.id)};cp.appendChild(b);});
  var addc=el('button','chip','+');addc.style.borderStyle='dashed';addc.style.minWidth='36px';addc.style.justifyContent='center';addc.title='New category';addc.setAttribute('aria-label','New category');
  addc.onclick=function(){ var used=S.cats.map(function(k){return k.mark}); var nc={id:uid(),name:'New category',mark:MARKS.filter(function(x){return used.indexOf(x)<0})[0]||MARKS[0]};
    S.cats.push(nc); n.category=nc.id; S.lastCat=nc.id; save(); renderCats(); renderYear(); openNote(n.id);
    var chip=$('panel').querySelector('.chip[data-cat="'+nc.id+'"]'); var r=(chip||addc).getBoundingClientRect(); catPop(nc, r.left, r.bottom+6); };
  cp.appendChild(addc);
  fc.appendChild(cp);p.appendChild(fc);

  [['plan','Plan','What it is, what to prepare'],['reflection','Reflection','After it happens: what stood out?']].forEach(function(q){
    var ff=el('div','fld');var lb=el('label','',q[1]);var ta=el('textarea');ta.id='f-'+q[0];lb.htmlFor=ta.id;ta.placeholder=q[2];ta.value=n[q[0]]||'';
    ta.oninput=function(){n[q[0]]=ta.value;save();pv();};ff.appendChild(lb);ff.appendChild(ta);p.appendChild(ff);
  });

  var fp=el('div','fld');fp.appendChild(el('div','l','In Obsidian, this becomes'));var pre=el('pre','pre num');fp.appendChild(pre);p.appendChild(fp);
  function pv(){ pre.textContent='Linear/'+fileName(n,{})+'\n'+noteText(n); }
  pv();
  var hn=el('label','chk');hn.style.marginTop='14px';var hc=el('input');hc.type='checkbox';hc.checked=!!n.hide;
  hc.onchange=function(){ if(hc.checked)n.hide=true; else delete n.hide; save(); renderYear(); pv(); };
  hn.appendChild(hc);hn.appendChild(document.createTextNode('Hide the name on the calendar'));p.appendChild(hn);

  var ft=el('div','pfoot');
  var ok=el('button','primary');ok.appendChild(document.createTextNode(fresh||p.dataset.fresh===n.id?'Create':'Done'));ok.appendChild(el('span','kbd',KEYS));
  if(fresh)p.dataset.fresh=n.id;
  ok.onclick=closePanel;
  var del=el('button','danger','Delete');
  del.onclick=function(){ if(del.dataset.sure){ S.notes=S.notes.filter(function(x){return x.id!==n.id}); pickedId=null; save(); $('panel').classList.remove('open'); renderYear(); toast('Deleted'); } else { del.dataset.sure=1; del.textContent='Delete for good?'; } };
  ft.appendChild(ok);ft.appendChild(del);p.appendChild(ft);

  p.classList.add('open'); renderYear(); p.scrollTop=keepScroll;
  if(fresh)t.focus({preventScroll:true});
}

/* ---------- year note ---------- */
function openYear(){
  $('yearNote').classList.add('on');
  closeSettings();
  dropEmpty(); pickedId=null; panelMode='year'; $('panel').dataset.mode='year'; $('panel').scrollTop=0;
  var yn=S.years[Y]||(S.years[Y]={intentions:'',reflection:''});
  var p=$('panel');p.textContent='';
  var hd=el('div','ph');hd.appendChild(el('h2','',Y+' Linear'));var x=closeBtn();x.setAttribute('aria-label','Close');x.onclick=closePanel;hd.appendChild(x);p.appendChild(hd);
  p.appendChild(el('div','small','The note for the whole year. It exports as '+Y+' Linear.md, so it never clashes with a '+Y+' note you already have.'));
  [['intentions','Intentions','Themes, hopes and anchors for '+Y],['reflection','Reflection','Looking back on '+Y]].forEach(function(q){
    var ff=el('div','fld');var lb=el('label','',q[1]);var ta=el('textarea');ta.id='y-'+q[0];lb.htmlFor=ta.id;ta.placeholder=q[2];ta.value=yn[q[0]]||'';ta.style.minHeight='160px';
    ta.oninput=function(){yn[q[0]]=ta.value;save();};ff.appendChild(lb);ff.appendChild(ta);p.appendChild(ff);
  });
  p.classList.add('open');renderYear();
}

/* ---------- settings ---------- */
var openPick=null, pickNote=null, panelMode=null;
function markGrid(c,onPick,noteKey){
  var pk=el('div','mpick');pk.setAttribute('role','group');pk.setAttribute('aria-label','Choose a mark for '+c.name);
  var r1=el('div','mrowp'), r2=el('div','mrowp'), r3=el('div','mrowp');
  function opt(m,row,lock){var o=el('button',(m===c.mark?'on':'')+(lock?' locked':''));o.appendChild(mk(m));o.setAttribute('aria-label',markName(m)+(lock?' (book bonus, locked)':''));o.title=markName(m)+(lock?' · book bonus':'');
    o.onclick=function(){ if(lock){ pickNote=noteKey; onPick(null); return; } c.mark=m;pickNote=null;save();renderCats();renderYear();onPick(m);};row.appendChild(o);}
  MARKS.forEach(function(m){opt(m,r1,false)});
  BONUS.forEach(function(m,i){opt(m,i<6?r2:r3,!S.unlocked)});
  var tg=el('div','tag','Book bonus');tg.style.margin='4px 0 0';
  pk.appendChild(r1);pk.appendChild(tg);pk.appendChild(r2);pk.appendChild(r3);
  if(pickNote===noteKey&&!S.unlocked){
    var nt=el('div','mnote');nt.appendChild(el('div','','Bonus marks come with the Linking Your Thinking book. Pre-order it, email your receipt, and we’ll send you a code.'));
    var cr=el('div','row');cr.style.marginTop='8px';
    var ci=el('input');ci.placeholder='Have a code?';ci.setAttribute('aria-label','Unlock code');ci.style.flex='1';ci.style.minWidth='0';ci.style.padding='6px 8px';ci.style.fontSize='13px';
    var cb=el('button','','Unlock');cb.style.padding='6px 10px';cb.style.fontSize='13px';
    var msg=el('div','small');
    function tryCode(){ checkCode(ci.value).then(function(ok){ if(ok){ S.unlocked=true;pickNote=null;save();toast('Bonus marks unlocked');onPick(null); } else { msg.textContent='That code didn’t work.'; } }); }
    cb.onclick=tryCode; ci.onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();e.stopPropagation();tryCode();}};
    cr.appendChild(ci);cr.appendChild(cb);nt.appendChild(cr);nt.appendChild(msg);pk.appendChild(nt);
  }
  return pk;
}
function refreshPanel(){ if(!$('panel').classList.contains('open'))return; if(panelMode==='note'&&pickedId)openNote(pickedId); else if($('setdd').classList.contains('open'))openSettings(); }
var CODES=['bd11ba115434b55ceff477bb8e61dc094bcfca09ece004db557973ba6289ca0e'];
function checkCode(v){
  v=(v||'').trim().toLowerCase(); if(!v||!window.crypto||!crypto.subtle)return Promise.resolve(false);
  return crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)).then(function(b){var h=[].map.call(new Uint8Array(b),function(x){return ('0'+x.toString(16)).slice(-2)}).join('');return CODES.indexOf(h)>=0;});
}
var KEYS=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent)?'⌘↵':'Ctrl ↵';
var popEl=null;
function closePop(){ if(!popEl)return; var fid=popEl.dataset.fresh; popEl.remove();popEl=null;
  if(fid){ var fn=find(fid); if(fn&&!(fn.title||'').trim()&&!(fn.plan||'').trim()&&!(fn.reflection||'').trim()){ S.notes=S.notes.filter(function(x){return x.id!==fid}); save(); } }pickNote=null;renderCats();renderYear();refreshPanel(); }
var cpEl=null;
function closeCat(){ if(!cpEl)return; cpEl.remove();cpEl=null;pickNote=null;renderCats();renderYear();refreshPanel(); if(popEl&&popEl._rebuild)popEl._rebuild(); }
function catPop(c,x,y){
  if(cpEl){cpEl.remove();cpEl=null;}
  var p=el('div','pop cat');p.style.zIndex=90;p.setAttribute('role','dialog');p.setAttribute('aria-label','Edit category');
  var hd=el('div','row');hd.appendChild(el('div','l','Edit category'));var cb=closeBtn();cb.style.marginLeft='auto';cb.style.width='32px';cb.style.height='32px';cb.onclick=closeCat;hd.appendChild(cb);p.appendChild(hd);
  var nm=el('input');nm.value=c.name;nm.setAttribute('aria-label','Category name');
  nm.oninput=function(){c.name=nm.value;save();renderCats();};
  nm.onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();closeCat();}};
  p.appendChild(nm);
  p.appendChild(el('div','l','Shape and colour'));
  var holder=el('div');p.appendChild(holder);
  function draw(){holder.textContent='';holder.appendChild(markGrid(c,function(){draw();},'pop'));}
  draw();
  var used=S.notes.filter(function(n){return n.category===c.id}).length;
  var del=el('button','danger','Delete category');del.style.alignSelf='flex-start';del.style.marginTop='4px';
  var warn=el('div','small');
  del.onclick=function(){
    if(!del.dataset.sure){ del.dataset.sure=1; del.textContent='Delete “'+(c.name||'category')+'” for good';
      warn.textContent=used?used+(used===1?' item keeps its dates but loses this category.':' items keep their dates but lose this category.'):'Nothing uses it yet.'; return; }
    S.cats=S.cats.filter(function(k){return k.id!==c.id});
    S.notes.forEach(function(n){if(n.category===c.id)n.category='';});
    S.hidden=S.hidden.filter(function(h){return h!==c.id});
    if(S.lastCat===c.id)S.lastCat='';
    save(); toast('Deleted '+(c.name||'category')); closeCat();
  };
  p.appendChild(del);p.appendChild(warn);
  PF.layer.appendChild(p);cpEl=p;
  var r=p.getBoundingClientRect();
  p.style.left=Math.max(8,Math.min(x,innerWidth-r.width-8))+'px';
  p.style.top=Math.max(8,Math.min(y,innerHeight-r.height-8))+'px';
  nm.focus();nm.select();
}
/* a small month calendar for picking a date (the browser's own picker is blocked in some places) */
function miniCal(host,anchor,val,key,a0,b0,pick){
  var c=el('div','mcal'); c._key=key; c.setAttribute('role','dialog'); c.setAttribute('aria-label','Pick a date');
  var cur=parse(val); cur.setDate(1);
  function draw(){
    c.textContent='';
    var hd=el('div','mch'), pv=el('button','mcn','‹'), nx=el('button','mcn','›'), t=el('span','mct',MNL[cur.getMonth()]+' '+cur.getFullYear());
    pv.setAttribute('aria-label','Previous month'); nx.setAttribute('aria-label','Next month');
    pv.onclick=function(e){e.stopPropagation();cur.setMonth(cur.getMonth()-1);draw();}; nx.onclick=function(e){e.stopPropagation();cur.setMonth(cur.getMonth()+1);draw();};
    hd.appendChild(pv);hd.appendChild(t);hd.appendChild(nx);c.appendChild(hd);
    var g=el('div','mcg');
    ['S','M','T','W','T','F','S'].forEach(function(w){g.appendChild(el('span','mcw',w));});
    for(var i=0;i<cur.getDay();i++)g.appendChild(el('span'));
    var last=new Date(cur.getFullYear(),cur.getMonth()+1,0).getDate();
    for(var d=1;d<=last;d++){ (function(d){ var ds=iso(new Date(cur.getFullYear(),cur.getMonth(),d)), b=el('button','mcd num',d);
      if(ds===val)b.classList.add('on'); else if(ds>=a0&&ds<=b0)b.classList.add('inr'); if(ds===TODAY)b.classList.add('tdy');
      b.setAttribute('aria-label',nice(ds)); b.onclick=function(e){ e.stopPropagation(); c.remove(); pick(ds); }; g.appendChild(b); })(d); }
    c.appendChild(g);
  }
  draw(); host.appendChild(c);
  var hr=host.getBoundingClientRect(), ar=anchor.getBoundingClientRect();
  c.style.top=(ar.bottom-hr.top+6)+'px'; c.style.left=Math.max(8,Math.min(ar.left-hr.left,hr.width-c.offsetWidth-8))+'px';
  var on=c.querySelector('.mcd.on'); (on||c.querySelector('.mcd')).focus();
  return c;
}
function itemPop(n,x,y,fresh){
  if(popEl){popEl.remove();popEl=null;}
  var p=el('div','pop');p.setAttribute('role','dialog');p.setAttribute('aria-label',fresh?'New item':'Edit item');if(fresh)p.dataset.fresh=n.id;
  var hd=el('div','row');var when=n.start?(n.end&&n.end!==n.start?nice(n.start).slice(5)+' – '+nice(n.end).slice(5):nice(n.start)):'Sometime in '+MNL[+n.month.slice(5,7)-1];
  var wh=el('div','l num when');
  /* each date opens a date picker */
  function setDate(key,v){
    if(key==='start'){ var len=n.end?diff(n.start,n.end):0; n.start=v; if(n.end)n.end=addDays(v,len); }
    else { if(v<n.start){ n.end=n.start; n.start=v; } else n.end=v; }
    if(n.end===n.start)delete n.end;
    if(+n.start.slice(0,4)!==Y)S.year=+n.start.slice(0,4);
    save(); renderYear(); if(typeof refreshPanel==='function')refreshPanel(); p._rebuild(); }
  function dbtn(key){ var b=el('button','dbtn',key==='start'?(n.end&&n.end!==n.start?nice(n.start).slice(5):nice(n.start)):nice(n.end).slice(5)); b.title='Pick a date'; b.setAttribute('aria-haspopup','dialog');
    b.onclick=function(e){ e.stopPropagation(); var open=p.querySelector('.mcal'); if(open){ var same=open._key===key; open.remove(); if(same)return; }
      miniCal(p,b,n[key]||n.start,key,n.start,n.end||n.start,function(v){ setDate(key,v); }); };
    return b; }
  if(n.start){ wh.appendChild(dbtn('start')); if(n.end&&n.end!==n.start){ wh.appendChild(document.createTextNode(' – ')); wh.appendChild(dbtn('end')); } }
  else wh.textContent=when;
  hd.appendChild(wh);var cb=closeBtn();cb.style.marginLeft='auto';cb.style.width='32px';cb.style.height='32px';cb.onclick=closePop;hd.appendChild(cb);p.appendChild(hd);
  var nm=el('input');nm.value=n.title||'';nm.placeholder='Name it';nm.setAttribute('aria-label','Title');
  nm.oninput=function(){n.title=nm.value;save();renderYear();};
  nm.onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();closePop();}};
  p.appendChild(nm);
  var cp=el('div','catpick');
  S.cats.forEach(function(c){var b=el('button','chip'+(n.category===c.id?' on':''));b.dataset.cat=c.id;b.appendChild(mk(c.mark));b.appendChild(document.createTextNode(c.name));
    b.onclick=function(){n.category=n.category===c.id?'':c.id;if(n.category)S.lastCat=c.id;save();renderYear();cp.querySelectorAll('.chip').forEach(function(x){x.classList.toggle('on',x.dataset.cat===n.category);});};cp.appendChild(b);});
  var acts=el('div','row acts');
  if(fresh){ var addb=el('button','primary');addb.appendChild(document.createTextNode('Add'));addb.appendChild(el('span','kbd','↵'));addb.style.display='flex';addb.style.gap='8px';addb.style.alignItems='center';addb.onclick=closePop;acts.appendChild(addb); }
  function act(b,ic){ b.classList.add('act'); var sv=document.createElementNS('http://www.w3.org/2000/svg','svg'); sv.setAttribute('viewBox','0 0 24 24'); sv.setAttribute('aria-hidden','true'); sv.innerHTML=ic; b.insertBefore(sv,b.firstChild); return b; }
  var IC={open:'<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" x2="14" y1="3" y2="10"/><line x1="3" x2="10" y1="21" y2="14"/>',
    dup:'<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    some:'<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M10 16h4"/>',
    del:'<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>'};
  var op=el('button','',fresh?'More…':'Open details');op.title='Dates, Plan and Reflection in a larger card';op.onclick=function(){ if(popEl)delete popEl.dataset.fresh; closePop();openNote(n.id);};
  var du=el('button','','Duplicate');du.title=n.start?'A copy right after this one':'A copy in the same month';
  du.onclick=function(){ var cpy=JSON.parse(JSON.stringify(n)); cpy.id=uid(); if(n.start){ var len=n.end?diff(n.start,n.end):0; cpy.start=addDays(n.end||n.start,1); if(n.end)cpy.end=addDays(cpy.start,len); } S.notes.push(cpy); save(); toast('Duplicated '+(n.title||'Untitled')); closePop(); };
  var sm=null;
  if(n.start){ sm=el('button','','Move to the Sometime Sidebar');sm.title='Keep the month, drop the day';sm.onclick=function(){ n.month=n.start.slice(0,7); delete n.start; delete n.end; save(); closePop(); }; }
  var dl=el('button','danger','Delete');
  dl.onclick=function(){ if(!dl.dataset.sure){dl.dataset.sure=1;dl.lastChild.textContent='Delete for good?';return;} S.notes=S.notes.filter(function(x){return x.id!==n.id}); if(pickedId===n.id){pickedId=null;$('panel').classList.remove('open');} save(); toast('Deleted'); closePop(); };
  acts.appendChild(op); if(!fresh){acts.appendChild(du);if(sm)acts.appendChild(sm);}
  if(!fresh&&PF.openFile&&PF.hasFile(n.id)){ var of=el('button','','Open note');of.title='Open the note in a new tab';of.onclick=function(){ closePop(); PF.openFile(n.id); }; acts.appendChild(act(of,IC.open)); }
  p.appendChild(acts);
  var ac=null, acRow=null;
  if(!fresh&&n.start){ ac=el('button','','Add to calendar…'); ac.title='Send a copy to Google, Outlook or Apple Calendar (one way, no sync)';
    acRow=el('div','row acts calrow'); acRow.hidden=true;
    [['Google',function(){ window.open(gcalUrl(n),'_blank','noopener'); }],['Outlook',function(){ window.open(outlookUrl(n),'_blank','noopener'); }],['Apple / other (.ics)',function(){ download(new Blob([icsFile([n])],{type:'text/calendar'}),clean(n.title)+'.ics'); toast('Open the .ics to add it to your calendar'); }]].forEach(function(o){ var b=el('button','act',o[0]); b.onclick=o[1]; acRow.appendChild(b); });
    ac.onclick=function(){ acRow.hidden=!acRow.hidden; ac.setAttribute('aria-expanded',!acRow.hidden); };
    acts.appendChild(ac); acts.after(acRow); }
  IC.cal='<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4"/>';
  if(!fresh){ act(op,IC.open); act(du,IC.dup); if(sm)act(sm,IC.some); if(ac)act(ac,IC.cal); act(dl,IC.del); }
  cp.classList.add('sec'); p.appendChild(cp);
  if(!fresh){ var dr=el('div','row sec');dr.appendChild(dl);p.appendChild(dr); }
  PF.layer.appendChild(p);popEl=p;
  p._id=n.id; p._t=Date.now();
  p._rebuild=function(){ if(!find(n.id))return; var L=p.style.left, T=p.style.top; itemPop(n,parseFloat(L),parseFloat(T),fresh); };
  var r=p.getBoundingClientRect();
  p.style.left=Math.max(8,Math.min(x,innerWidth-r.width-8))+'px';
  p.style.top=Math.max(8,Math.min(y,innerHeight-r.height-8))+'px';
  nm.focus();nm.select();
}
var setTab=null;
function CHK(box){ return function(o){var l=el('label','chk');var c=el('input');c.type='checkbox';c.checked=!!S.set[o[0]];c.onchange=function(){S.set[o[0]]=c.checked;save();if(o[0]==='harp'){if(c.checked)harp(true);}else if(o[0]==='scroll'){ SCR=null; Y=S.year; renderYear(); if(c.checked)goYear(Y); else PF.scroller.scrollTo(0,0); } else renderYear();};l.appendChild(c);l.appendChild(document.createTextNode(o[1]));box.appendChild(l);}; }
var TABS=[['cats','Categories'],['cal','Display'],['look','Theme and font'],['export','Export'],['data','Import & data']];
/* Settings → Export: the format of the notes */
function exportTab(p){
  var e=exo();
  var top=el('div','fld');
  var ex=el('button','primary','Export to Obsidian');ex.style.alignSelf='flex-start';ex.onclick=function(){closeSettings();openExport();};
  top.appendChild(ex); top.appendChild(el('div','small','A Linear folder of Markdown notes for your vault, written the way you set below.')); if(PF.canExport)p.appendChild(top);
  else p.appendChild(el('div','small','How new notes are written in your vault’s '+PF.folder()+' folder. Notes you already have keep their names and places.'));

  var preview=el('pre','pre num exprev');
  function upd(){ save(); var out=[], seen={}, picks=[], kinds={};
    S.notes.forEach(function(n){ var k=kindOf(n); if(!kinds[k]&&(n.title||'').trim()){kinds[k]=1;picks.push(n);} });
    if(!picks.length)picks=[{id:'x',title:'Dentist',start:Y+'-03-14',category:(S.cats[0]||{}).id||''}];
    picks.slice(0,3).forEach(function(n){ out.push('Linear/'+fileName(n,seen)+'\n'+noteText(n).split('\n## Plan')[0].trim()); });
    if(e.ics)out.push('Linear.ics  (beside the Linear folder)');
    preview.textContent=out.join('\n\n'); }
  function custom(){ if(e.preset!=='custom'){ e.preset='custom'; segs.querySelectorAll('button').forEach(function(b){b.classList.toggle('on',b.dataset.v==='custom')}); } }
  function seg(opts,cur,on){ var r=el('div','row segrow'); opts.forEach(function(o){ var b=el('button',cur===o[0]?'on':'',o[1]); b.dataset.v=o[0]; b.onclick=function(){ on(o[0]); }; r.appendChild(b); }); return r; }

  /* properties */
  var fp=el('div','fld');var fph=el('div','row');fph.style.alignItems='center';fph.appendChild(el('div','l','Properties'));fp.appendChild(fph);
  /* Reset order: the presets' order (PROPDEF), your own properties last; back to the preset's name if nothing else differs */
  var defIds=PROPDEF.map(function(d){return d.id}), curIds=e.props.map(function(q){return q.id}), sorted=e.props.filter(function(q){return !q.extra}).sort(function(a,b){return defIds.indexOf(a.id)-defIds.indexOf(b.id)}).concat(e.props.filter(function(q){return q.extra}));
  if(sorted.some(function(q,i){return q.id!==curIds[i]})){ var ro=el('button','linkbtn','Reset order');ro.title='Put the properties back in the preset order';ro.style.marginLeft='auto';
    ro.onclick=function(){ e.props=sorted; var same=function(pre){ var ref=propsFor(pre); return e.props.length===ref.length&&e.props.every(function(q,i){ return q.id===ref[i].id&&q.key===ref[i].key&&!!q.on===!!ref[i].on&&(q.val||'')===(ref[i].val||''); }); };
      if(same('basic'))e.preset='basic'; else if(same('lyt'))e.preset='lyt'; save(); openSettings(); };
    fph.appendChild(ro); }
  var segs=seg([['basic','Minimal'],['lyt','LYT Style'],['custom','Custom']],e.preset,function(v){ if(v!=='custom'){ e.props=propsFor(v); } e.preset=v; save(); openSettings(); });
  fp.appendChild(segs);
  fp.appendChild(el('div','small',e.preset==='basic'?'Dates and category only.':e.preset==='lyt'?'Your LYT header first (up, related, created, collections), then the dates.':'Rename, switch off or add properties. Import reads the same names back.'));
  var plist=el('div','plist');
  e.props.forEach(function(pr,pi){ var d=PROPDEF.filter(function(x){return x.id===pr.id})[0]||{key:'',hint:''}, extra=!!pr.extra; var r=el('div','prow');r.dataset.pid=pr.id;
    var g=el('span','pgrip');g.innerHTML='<svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true"><circle cx="3" cy="3" r="1.3"/><circle cx="9" cy="3" r="1.3"/><circle cx="3" cy="7" r="1.3"/><circle cx="9" cy="7" r="1.3"/><circle cx="3" cy="11" r="1.3"/><circle cx="9" cy="11" r="1.3"/></svg>';g.title='Drag to reorder';r.appendChild(g);
    var c=el('input');c.type='checkbox';c.checked=!!pr.on||!!d.req;c.disabled=!!d.req;c.title=d.req?'Needed to read the notes back':'Include';c.className='pchk';
    c.onchange=function(){ pr.on=c.checked; custom(); upd(); };
    var k=el('input');k.value=pr.key;k.placeholder='property';k.setAttribute('aria-label','Property name'+(d.key?' for '+d.key:''));k.oninput=function(){ pr.key=k.value; custom(); upd(); };
    r.appendChild(c); r.appendChild(k);
    if(pr.id==='collections'||extra){ var w=el('div','row');w.style.gap='4px';w.style.flexWrap='nowrap';var v=el('input');v.value=pr.val||'';v.placeholder=extra?'value':'';v.setAttribute('aria-label',extra?'Value':'Collections');v.oninput=function(){ pr.val=v.value; custom(); upd(); }; w.appendChild(v);
      if(extra){ var rm=closeBtn();rm.style.width='28px';rm.style.height='28px';rm.setAttribute('aria-label','Remove property');rm.onclick=function(){ e.props.splice(pi,1); save(); openSettings(); }; w.appendChild(rm); }
      r.appendChild(w); }
    else r.appendChild(el('span','small',d.hint||''));
    plist.appendChild(r); });
  fp.appendChild(plist);
  /* drag a row by its grip to reorder: the frontmatter follows this order */
  plist.addEventListener('pointerdown',function(ev){ var g=ev.target.closest('.pgrip'); if(!g)return; ev.preventDefault(); var row=g.parentNode; row.classList.add('pdrag'); PF.root.classList.add('pmoving');
    function mv(e2){ var rows=[].slice.call(plist.children).filter(function(x){return x!==row}), before=null; for(var q=0;q<rows.length;q++){ var rb=rows[q].getBoundingClientRect(); if(e2.clientY<rb.top+rb.height/2){ before=rows[q]; break; } } plist.insertBefore(row,before); }
    function up(){ window.removeEventListener('pointermove',mv); window.removeEventListener('pointerup',up); row.classList.remove('pdrag'); PF.root.classList.remove('pmoving');
      var ids=[].slice.call(plist.children).map(function(x){return x.dataset.pid}), now=ids.map(function(id){ return e.props.filter(function(pq){return pq.id===id})[0]; });
      if(now.some(function(x,qi){return x!==e.props[qi]})){ e.props=now; e.preset='custom'; save(); var sc=$('setdd').querySelector('.body'), st0=sc?sc.scrollTop:0; openSettings(); var sc2=$('setdd').querySelector('.body'); if(sc2)sc2.scrollTop=st0; } }
    window.addEventListener('pointermove',mv); window.addEventListener('pointerup',up); });
  var add=el('button','','+ Add a property');add.style.alignSelf='flex-start';add.style.marginTop='4px';add.onclick=function(){ e.props.push({id:'x'+uid(),key:'',val:'',on:true,extra:true}); e.preset='custom'; save(); openSettings(); var ins=$('setdd').querySelectorAll('.plist input[placeholder=property]'); if(ins.length)ins[ins.length-1].focus(); };fp.appendChild(add);
  p.appendChild(fp);

  /* categories */
  var fc=el('div','fld');fc.appendChild(el('div','l','Categories'));
  var cr=el('div','row');cr.style.alignItems='center';cr.appendChild(el('span','small','Write the category as'));
  cr.appendChild(seg([['text','Text'],['link','Link']],e.catAs,function(v){e.catAs=v;save();openSettings();}));fc.appendChild(cr);
  if(e.catAs==='link'){ var l=el('label','chk');var cn=el('input');cn.type='checkbox';cn.checked=!!e.catNotes;cn.onchange=function(){e.catNotes=cn.checked;upd();};l.appendChild(cn);l.appendChild(document.createTextNode('Add a note for each category, so the links lead somewhere'));fc.appendChild(l); }
  var det=el('details','percat');var sm=el('summary','','Extra properties by category');det.appendChild(sm);
  det.appendChild(el('div','small','One per line, like  collections: [[Trips]]. Added to that category’s notes only.'));
  S.cats.forEach(function(c){ var r=el('div','pcrow'); var h=el('div','row');h.style.gap='6px';h.appendChild(mk(c.mark));h.appendChild(el('span','',c.name));r.appendChild(h);
    var ta=el('textarea');ta.rows=2;ta.value=e.perCat[c.id]||'';ta.placeholder='property: value';ta.oninput=function(){ if(ta.value.trim())e.perCat[c.id]=ta.value; else delete e.perCat[c.id]; upd(); }; r.appendChild(ta); det.appendChild(r); });
  if(Object.keys(e.perCat).length)det.open=true;
  fc.appendChild(det); p.appendChild(fc);

  /* file names */
  var fn=el('div','fld');fn.appendChild(el('div','l','File names'));
  var SUG={one:['{date} {title}','{title}','{title} {date}','{date} {category} {title}'],span:['{start} {title}','{start} to {end} {title}','{start} – {end} {title}','{title}'],some:['{month} {title}','{title}','{year} Sometime {title}']};
  [['one','Single dates'],['span','Spans'],['some','Sometime']].forEach(function(o){ var r=el('div','prow nrow'); r.appendChild(el('span','small',o[1]));
    var dl=el('datalist');dl.id='dl-'+o[0];SUG[o[0]].forEach(function(v){var op=el('option');op.value=v;dl.appendChild(op);});
    var k=el('input');k.setAttribute('list','dl-'+o[0]);k.value=e.names[o[0]];k.setAttribute('aria-label','File name for '+o[1]);k.oninput=function(){ e.names[o[0]]=k.value||NAMEPAT[o[0]]; upd(); };
    r.appendChild(k);r.appendChild(dl);fn.appendChild(r); });
  fn.appendChild(el('div','small','Pieces you can use: {date} {start} {end} {month} {year} {title} {category}'));
  p.appendChild(fn);

  /* folders and the calendar file */
  var ff=el('div','fld');ff.appendChild(el('div','l','Folders'));
  ff.appendChild(seg([['flat','All in Linear'],['year','By year']],e.folders==='year'?'year':'flat',function(v){e.folders=v;save();openSettings();}));
  var il=el('label','chk');var ic=el('input');ic.type='checkbox';ic.checked=!!e.ics;ic.onchange=function(){e.ics=ic.checked;upd();};il.appendChild(ic);il.appendChild(document.createTextNode('Add Linear.ics beside the folder: every dated item, ready for Google, Apple or Outlook Calendar'));ff.appendChild(il);
  p.appendChild(ff);

  var fx=el('div','fld');fx.appendChild(el('div','l','Example'));fx.appendChild(preview);p.appendChild(fx);
  upd();
}
function dataTab(p){
  var fo=el('div','fld');fo.appendChild(el('div','l','Import'));
  var im=el('button','','Import notes');im.style.alignSelf='flex-start';im.onclick=function(){$('importInput').click();};fo.appendChild(im);
  fo.appendChild(el('div','small','Reads a Linear folder (zipped) or loose .md files back in, using the names set in Export.'));
  p.appendChild(fo);
}

function closeSettings(){ var d=$('setdd'); if(!d.classList.contains('open'))return; d.classList.remove('open'); openPick=null; $('settingsBtn').setAttribute('aria-expanded','false'); $('settingsBtn').classList.remove('on'); setbarSync(); }
function openSettings(tab){
  if(tab===true)tab='cats';
  if($('panel').classList.contains('open'))closePanel();
  setTab=tab||setTab||S.set.stab||'cats'; S.set.stab=setTab; save();
  var d=$('setdd'), wasOpen=d.classList.contains('open'), body0=d.querySelector('.body'), keepScroll=wasOpen&&body0&&body0.dataset.tab===setTab?body0.scrollTop:0;
  d.textContent='';
  var tb=el('div','tabs');   /* a plain title: the toolbar icons are the tabs */
  var tt=TABS.filter(function(t){return t[0]===setTab})[0]; tb.appendChild(el('h2','sdh',tt?tt[1]:'Settings'));
  var x=closeBtn();x.setAttribute('aria-label','Close settings');x.onclick=closeSettings;tb.appendChild(x);
  d.appendChild(tb);
  var p=el('div','body');p.dataset.tab=setTab;p.setAttribute('role','tabpanel');d.appendChild(p);
  if(setTab==='cats'){
  var fc=el('div','fld');fc.id='catsec';
  S.cats.forEach(function(c,i){
    var r=el('div','catedit');
    var mb=el('button','icon');mb.dataset.cat=c.id;mb.style.width='32px';mb.style.height='32px';mb.appendChild(mk(c.mark));mb.setAttribute('aria-label','Change mark for '+c.name);
    mb.setAttribute('aria-expanded',openPick===c.id);
    mb.onclick=function(){openPick=openPick===c.id?null:c.id;openSettings(true);};
    var nm=el('input');nm.value=c.name;nm.setAttribute('aria-label','Category name');nm.oninput=function(){c.name=nm.value;save();renderCats();};
    var rm=el('button','ghost','Remove');rm.onclick=function(){ if(!rm.dataset.sure){rm.dataset.sure=1;rm.textContent='Sure?';rm.classList.add('danger');return;} S.cats.splice(i,1);S.notes.forEach(function(n){if(n.category===c.id)n.category='';});S.hidden=S.hidden.filter(function(h){return h!==c.id});save();renderCats();renderYear();openSettings(true);};
    r.appendChild(mb);r.appendChild(nm);r.appendChild(rm);
    if(openPick===c.id){ r.appendChild(markGrid(c,function(m){ if(m)openPick=null; openSettings(true); },c.id)); }
    fc.appendChild(r);
  });
  var add=el('button','','+ Add a category');add.style.marginTop='8px';add.style.alignSelf='flex-start';
  add.onclick=function(){var used=S.cats.map(function(c){return c.mark});var m=MARKS.filter(function(x){return used.indexOf(x)<0})[0]||MARKS[0];S.cats.push({id:uid(),name:'New category',mark:m});save();renderCats();openSettings(true);};
  fc.appendChild(add);
  var gl=el('div');gl.style.marginTop='10px';[['ghost','Show hidden categories as traces under the dates']].forEach(CHK(gl));fc.appendChild(gl);fc.appendChild(el('div','small','Click a mark to choose its shape and colour. Right-click any category chip to edit it from anywhere.'));p.appendChild(fc);

  }
  else if(setTab==='cal'){
  var fv=el('div','fld');fv.appendChild(el('div','l','View'));
  [['scroll','Scrolling months (run across years)'],['condensed','Condensed (labels on the line)'],['weekends','Shade weekends'],['past','Fade past events'],['noNames','Hide all names (marks and lines only)'],['harp','Harp when switching Whole · Half']].forEach(CHK(fv));
  p.appendChild(fv);

  }
  else if(setTab==='look'){
  var ff=el('div','fld');ff.appendChild(el('div','l','Font'));var g=el('div','two');g.style.gridTemplateColumns='repeat(3,1fr)';
  [['recursive','Recursive',"'Recursive'"],['atkinson','Atkinson',"'Atkinson Hyperlegible Next'"],['familjen','Familjen',"'Familjen Grotesk'"]].forEach(function(o){
    var b=el('button','fontbtn'+(S.set.font===o[0]?' on':''));b.style.fontFamily=o[2]+',sans-serif';b.appendChild(el('b','','Aa 27'));b.appendChild(el('span','small',o[1]));
    b.onclick=function(){S.set.font=o[0];save();applySet();openSettings();};g.appendChild(b);});
  ff.appendChild(g);p.appendChild(ff);

  var ft=el('div','fld');ft.appendChild(el('div','l','Theme'));var tr=el('div','two');tr.style.gridTemplateColumns='repeat(3,1fr)';
  [['play','Play','#ffffff','#161616','#161616','#5b2e91','#e2e2de'],['paper','Soft Paper','#eee6dd','#575279','#575279','#1a7da4','#d1c9c2'],['dark','LYT Mode','hsl(225,12%,20%)','hsl(59,81%,47%)','hsl(191,54%,64%)','hsl(58,86%,66%)','hsl(225,18%,27%)']].forEach(function(o){
    var b=el('button','themebtn tprev'+(S.set.theme===o[0]?' on':''));
    b.style.background=o[2];b.style.color=o[4];b.style.borderColor=o[6];
    b.setAttribute('aria-pressed',S.set.theme===o[0]);b.setAttribute('aria-label',o[1]+' theme');
    var nm=el('b','',o[1]);nm.style.color=o[3];b.appendChild(nm);
    var ln=el('span','tline');ln.setAttribute('aria-hidden','true');ln.appendChild(mk('c v'));var i=el('i');i.style.background=o[4];ln.appendChild(i);ln.appendChild(mk('g'));b.appendChild(ln);
    var ac=el('span','tacc');ac.style.background=o[5];ac.setAttribute('aria-hidden','true');b.appendChild(ac);
    b.onclick=function(){S.set.theme=o[0];save();applySet();openSettings();};tr.appendChild(b);});
  ft.appendChild(tr);
  var see=S.set.see==null?22:S.set.see;
  var sl=el('label','chk small');sl.style.marginTop='10px';sl.htmlFor='f-see';
  var sv=el('span','num',see+'%');
  sl.appendChild(document.createTextNode('Card see-through'));
  var rg=el('input');rg.type='range';rg.min=0;rg.max=100;rg.step=2;rg.value=see;rg.id='f-see';rg.style.cssText='flex:1;padding:0;border:0;accent-color:var(--accent)';
  rg.style.setProperty('--v',see+'%');rg.oninput=function(){S.set.see=+rg.value;rg.style.setProperty('--v',rg.value+'%');sv.textContent=rg.value+'%';applySet();save();};
  sl.appendChild(rg);sl.appendChild(sv);ft.appendChild(sl);
  p.appendChild(ft);

  }
  else if(setTab==='export'){ exportTab(p); }
  else {
  dataTab(p);
  var fd=el('div','fld');fd.appendChild(el('div','l','Your data'));
  fd.appendChild(el('div','small','Everything stays in this browser until you export it. Clearing your browser data clears your calendar, so export now and then.'));
  var clr=el('button','danger','Clear the calendar');clr.style.alignSelf='flex-start';clr.style.marginTop='6px';
  clr.onclick=function(){ if(clr.dataset.sure){ S.notes=[];S.years={};save();renderYear();toast('Calendar cleared');openSettings(); } else { clr.dataset.sure=1; clr.textContent='Clear everything? This can’t be undone'; } };
  fd.appendChild(clr);p.appendChild(fd);

  }
  d.classList.add('open'); $('settingsBtn').setAttribute('aria-expanded','true'); $('settingsBtn').classList.add('on'); setbarSync();
  p.scrollTop=keepScroll;
}
/* ---------- wire up ---------- */
function yearRow(y){ return PF.root.querySelector('.mrow[data-y="'+y+'"][data-m="0"]'); }
function goYear(y,smooth){ if(!S.set.scroll){ S.year=y; save(); closePanel(); return; }
  holdScroll=Date.now()+(smooth?900:300);
  if(!SCR||y*12<SCR.from||y*12+11>SCR.to){ SCR={from:(y-1)*12,to:(y+1)*12+11}; S.year=y; renderYear(); }
  Y=y; S.year=y; $('ylab').textContent=y;
  var r=yearRow(y); if(r)PF.scroller.scrollTo({top:PF.sy()+r.getBoundingClientRect().top-(parseFloat(getComputedStyle(PF.themeEl).getPropertyValue('--hdr'))||0),behavior:smooth?'smooth':'auto'}); }
/* in scrolling months: the year shown follows the month at the top; more months load near either end */
var scrollBusy=false, holdScroll=0;   /* holdScroll: no loading more months right after a jump we made */
function setbarSync(){ var open=$('setdd').classList.contains('open'); PF.root.querySelectorAll('#setbar button').forEach(function(b){ var on=open&&b.dataset.tab===setTab; b.classList.toggle('on',on); b.setAttribute('aria-pressed',on); }); }
function setHdr(){ var hb=PF.root.querySelector('header').getBoundingClientRect().bottom, rr=PF.root.getBoundingClientRect(), cw=document.documentElement.clientWidth, ch=document.documentElement.clientHeight;
  PF.themeEl.style.setProperty('--hdr',hb+'px'); PF.themeEl.style.setProperty('--vr',Math.max(0,cw-rr.right)+12+'px'); PF.themeEl.style.setProperty('--vbot',Math.max(0,ch-rr.bottom)+'px'); }

/* the app changed size: the header's height and the half-day offset follow (a platform can call this for its own resizes) */
function relayout(){ setHdr(); var nw=PF.root.querySelector('.day[data-date]'); if(nw)$('year').style.setProperty('--ho',Math.max(0,(nw.getBoundingClientRect().width/2-5.5))+'px'); }

/* ---------- start: wire the interface to the page (the platform calls this once its markup is in place) ---------- */
function initUI(){
ON($('cats'),'pointerdown',function(e){
  if(e.button!==0)return; var b=e.target.closest('.chip[data-cat]'); if(!b)return;
  var r=b.getBoundingClientRect();
  chipDrag={el:b,x:e.clientX,grab:e.clientX-r.left,on:false,just:false};
});
ON(window,'pointermove',function(e){
  var D=chipDrag; if(!D.el)return;
  if(!D.on){ if(Math.abs(e.clientX-D.x)<4)return; D.on=true; D.el.classList.add('lifting'); PF.root.classList.add('moving'); }
  var chips=[].slice.call($('cats').querySelectorAll('.chip[data-cat]'));
  var w=D.el.offsetWidth, cx=e.clientX-D.grab+w/2;
  var others=chips.filter(function(k){return k!==D.el});
  var idx=others.filter(function(k){var r=k.getBoundingClientRect();return r.left+r.width/2<cx;}).length;
  if(idx!==chips.indexOf(D.el)){
    var before={}; others.forEach(function(k){before[k.dataset.cat]=k.getBoundingClientRect().left;});
    if(idx>=others.length)others[others.length-1].after(D.el); else others[idx].before(D.el);
    others.forEach(function(k){ var dx=before[k.dataset.cat]-k.getBoundingClientRect().left; if(!dx)return;
      k.style.transition='none';k.style.transform='translateX('+dx+'px)';k.getBoundingClientRect();k.style.transition='transform .16s ease';k.style.transform='';});
  }
  chipFollow(D,e.clientX);
});
ON(window,'pointerup',function(){
  var D=chipDrag; if(!D.el)return; chipDrag={};
  if(!D.on)return;
  PF.root.classList.remove('moving'); D.el.classList.remove('lifting'); D.el.style.transform='';
  var ids=[].map.call($('cats').querySelectorAll('.chip[data-cat]'),function(c){return c.dataset.cat});
  S.cats.sort(function(a,b){return ids.indexOf(a.id)-ids.indexOf(b.id)});
  chipDrag.just=true;
  save(); renderCats(); renderYear(); refreshPanel();
});

ON($('year'),'pointerdown',function(e){ if(S.set.view!=='life'||e.button!==0)return; var b=e.target.closest('.lband'); if(!b)return; e.preventDefault(); closeLifePop();
  var sg=e.target.closest('.lseg'), at=+b.dataset.i;
  if(sg){ var t=S.trends.filter(function(x){return x.id===sg.dataset.tid})[0], k=+sg.dataset.k, st=t&&t.stretches[k]; if(!st)return;
    var gr=e.target.closest('.lh.lr'), kind=e.target.closest('.lh.ll')?'rl':gr?'share':(e.altKey?'dup':'move');
    LD={kind:kind,cat:b.dataset.cat,tid:t.id,k:k,at:at,x:e.clientX,y:e.clientY,moved:false,orig:{from:st.from,to:st.to,at:st.at?JSON.parse(JSON.stringify(st.at)):null},last:at};
    if(kind==='share'){ LD.j=+gr.dataset.j; var mix=mixAt(b.dataset.cat,at); LD.parts=mix.map(function(p){ return {s:p.s,w:p.w,at0:p.s.at?JSON.parse(JSON.stringify(p.s.at)):null,to0:p.s.to}; }); }
    return; }
  LD={kind:'new',cat:b.dataset.cat,a:at,b:at,x:e.clientX,y:e.clientY,moved:false}; lifeSel(); },true);
ON(window,'pointermove',function(e){ if(!LD)return; if(!LD.moved&&Math.abs(e.clientX-LD.x)+Math.abs(e.clientY-LD.y)<4)return;
  var first=!LD.moved; LD.moved=true; PF.root.classList.toggle('lmoving',LD.kind!=='new');
  var el2=document.elementFromPoint(e.clientX,e.clientY), b=el2&&el2.closest&&el2.closest('.lband[data-cat="'+LD.cat+'"]');
  if(LD.kind==='new'){ if(b){ LD.b=+b.dataset.i; lifeSel(); } return; }
  if(first&&LD.kind==='dup'){ var o=lifeStretch(LD); if(!o)return; o.t.stretches.push({from:o.s.from,to:o.s.to,share:o.s.share,at:o.s.at?JSON.parse(JSON.stringify(o.s.at)):undefined}); LD.k=o.t.stretches.length-1; }
  if(LD.kind==='share'){ lifeShare(e,b); return; }
  if(!b)return; var i=+b.dataset.i; if(i===LD.last&&!first)return; LD.last=i;
  var x=lifeStretch(LD); if(!x)return; var f=mi(LD.orig.from), to=mi(LD.orig.to);
  if(LD.kind==='rl'){ x.s.from=ymOf(Math.min(i,to)); }
  else if(LD.kind==='rr'){ x.s.to=ymOf(Math.max(i,f)); }
  else { var d=i-LD.at; x.s.from=ymOf(f+d); x.s.to=ymOf(to+d); if(LD.orig.at){ var na={}; Object.keys(LD.orig.at).forEach(function(ym){ na[ymOf(mi(ym)+d)]=LD.orig.at[ym]; }); x.s.at=na; } }
  renderYear(); });
ON(window,'pointerup',function(e){ if(!LD)return; var D=LD; LD=null; PF.root.classList.remove('lmoving'); var tp=$('lpct'); if(tp)tp.remove();
  if(D.kind==='share'){ if(D.moved){ D.parts.forEach(function(q){ lifePrune(q.s); }); save(); renderYear(); } else { var x0=lifeStretch(D); if(x0)lifePop(e.clientX,e.clientY,{cat:x0.t.cat,t:x0.t,k:D.k}); } return; }
  if(D.kind==='new'){ var a=Math.min(D.a,D.b), z=Math.max(D.a,D.b); LD={cat:D.cat,a:a,b:z}; lifeSel(); LD=null; lifePop(e.clientX,e.clientY,{cat:D.cat,from:ymOf(a),to:ymOf(z)}); return; }
  var x=lifeStretch(D); if(!x)return;
  if(!D.moved){ lifePop(e.clientX,e.clientY,{cat:x.t.cat,t:x.t,k:D.k}); return; }
  lifePrune(x.s); x.t.stretches.sort(function(p,q){return p.from<q.from?-1:1}); save(); renderYear();
  if(D.kind==='dup')toast('Copied '+x.t.name+' to '+ymNice(x.s.from)+(x.s.to!==x.s.from?' – '+ymNice(x.s.to):''));
  else if(D.kind==='rr'||D.kind==='rl')toast(x.t.name+': '+ymNice(x.s.from)+' – '+ymNice(x.s.to)); });
ON(window,'keydown',function(e){ if(e.key!=='Escape'||!LD)return; e.stopImmediatePropagation(); var D=LD; LD=null; PF.root.classList.remove('lmoving');
  var tp=$('lpct'); if(tp)tp.remove();
  if(D.kind==='share'&&D.moved){ lifeShareRestore(D); }
  else if(D.kind!=='new'&&D.moved){ var x=lifeStretch(D); if(x){ if(D.kind==='dup')x.t.stretches.splice(D.k,1); else { x.s.from=D.orig.from; x.s.to=D.orig.to; if(D.orig.at)x.s.at=D.orig.at; else delete x.s.at; } } }
  renderYear(); },true);
ON(document,'pointerdown',function(e){ if(lpop&&!e.target.closest('.lpop')&&!e.target.closest('.lband')&&!e.target.closest('.lst'))closeLifePop(); });
ON(window,'keydown',function(e){ if(e.key==='Escape'&&lpop){ e.stopImmediatePropagation(); closeLifePop(); } },true);
ON($('shape'),'click',function(e){ var b=e.target.closest('button'); if(b)setShape(b.dataset.half==='1'); });

ON($('year'),'pointermove',function(ev){
  if(drag||ev.pointerType==='touch')return;
  var t=ev.target, d=null;
  if(!t.closest('.mname,.some,.seg,.sch')){ var day=t.closest('.day[data-date]'); d=day?day.dataset.date:null; if(!d){var row=t.closest('.mrow');if(row)d=dayFromRow(row,ev.clientX);} }
  if(d===hovDate)return; hovDate=d; bands(d,d,'hov');
});
ON($('year'),'pointerleave',function(){hovDate=null;bands(null,null,'hov');});
// hovering an item highlights every piece of it (a span cut by a month edge too)
ON($('year'),'pointerover',function(e){ if(drag&&drag.moved)return; var cm=e.target.closest('.cellmark .mk'); if(cm){hoverItem(cm.dataset.id);return;} var it=e.target.closest('.seg,.sch'); hoverItem(it&&!it.classList.contains('ghost')?it.dataset.id:null); });
ON($('year'),'pointerleave',function(){hoverItem(null);});
ON($('year'),'dblclick',function(e){ var it=e.target.closest('.seg:not(.ghost),.sch:not(.ghost),.cellmark .mk'); if(!it)return; var n=find(it.dataset.id); if(!n)return; if(cpEl){cpEl.remove();cpEl=null;} if(popEl){popEl.remove();popEl=null;} openNote(n.id); });
ON($('year'),'pointerdown',function(ev){
  if(ev.button!==0)return;
  var t=ev.target;
  if(t.closest('.some.mini')&&!t.closest('.sch')){ ev.preventDefault(); S.set.someMin=false; save(); renderYear(); return; }
  var add=t.closest('.some .add'); if(add){ ev.preventDefault(); newNote({month:add.dataset.month}); return; }
  var rh=t.closest('.rh');
  if(rh&&!ev.altKey){ ev.preventDefault(); var sgr=rh.closest('.seg'), nr=find(sgr.dataset.id); if(!nr)return;
    drag={kind:'resize',lane0:(parseInt(sgr.style.gridRow,10)||2)-2,side:rh.classList.contains('rl')?'l':'r',id:nr.id,x:ev.clientX,y:ev.clientY,moved:false,el:sgr}; return; }
  var cmk=t.closest('.cellmark .mk')||t.closest('.cellmark');
  if(cmk){ var segFor=PF.root.querySelector('.seg[data-id="'+cmk.dataset.id+'"]'); if(segFor)t=segFor; }
  var sg=t.closest('.seg,.sch');
  if(sg){ ev.preventDefault(); var n=find(sg.dataset.id); if(!n)return;
    if(ev.altKey){ var cp=JSON.parse(JSON.stringify(n)); cp.id=uid(); S.notes.push(cp); var dupOf=n.id; n=cp; }
    drag={kind:sg.classList.contains('sch')?'some':'move',lane0:(parseInt(sg.style.gridRow,10)||2)-2,id:n.id,dup:!!dupOf,x:ev.clientX,y:ev.clientY,from:dateAt(ev.clientX,ev.clientY),moved:false,el:sg};
    return; }
  var day=t.closest('.day[data-date]'), ds=day?day.dataset.date:null;
  if(!ds){ var row=t.closest('.mrow'); if(row&&!t.closest('.mname,.some'))ds=dayFromRow(row,ev.clientX); }
  if(ds){ ev.preventDefault(); drag={kind:'new',a:ds,b:ds,x:ev.clientX,y:ev.clientY,moved:false,closing:$('panel').classList.contains('open')}; if(!drag.closing)paintRange(drag.a,drag.b); }
  else if($('panel').classList.contains('open')&&!t.closest('.seg,.sch,.some .add'))closePanel();
});
ON(window,'pointermove',function(ev){
  if(!drag)return;
  if(!drag.moved&&Math.abs(ev.clientX-drag.x)+Math.abs(ev.clientY-drag.y)<5)return;
  drag.moved=true;
  var d=dateAt(ev.clientX,ev.clientY);
  if(drag.kind==='new'){ if(d){drag.b=d;paintRange(drag.a,drag.b);} return; }
  var n=find(drag.id); if(!n)return;
  if(!drag.orig){ drag.orig={start:n.start,end:n.end,month:n.month}; PF.root.classList.add(drag.kind==='resize'?'resizing':'moving');
    drag.lanes={}; PF.root.querySelectorAll('.mrow').forEach(function(r){ drag.lanes[r.dataset.k]=(r.style.gridTemplateRows.match(/repeat\((\d+)/)||[0,1])[1]*1; }); }
  var mo=drag.kind!=='resize'&&!d?someAt(ev.clientX,ev.clientY):null;
  var key=d||(mo?'S'+mo:'none'); if(key===drag.last)return; drag.last=key;
  var o=drag.orig;
  if(drag.kind==='resize'){
    var oe=o.end||o.start;
    if(!d){ n.start=o.start; if(o.end)n.end=o.end; else delete n.end; }
    else if(drag.side==='l'){ n.start=d>oe?oe:d; n.end=oe; }
    else { n.start=o.start; n.end=d<o.start?o.start:d; }
    if(n.end===n.start)delete n.end;
  }
  else if(mo){ delete n.start; delete n.end; n.month=mo; }
  else if(drag.kind==='move'){
    if(d&&drag.from){ var k=diff(drag.from,d); n.start=addDays(o.start,k); if(o.end)n.end=addDays(o.end,k); }
    else { n.start=o.start; if(o.end)n.end=o.end; }
  } else {
    if(d){ n.start=d; delete n.end; delete n.month; } else { delete n.start; n.month=o.month; }
  }
  renderYear(); liftSeg(n.id); markDrop(mo); if(n.start)paintRange(n.start,n.end||n.start);
});
ON(window,'pointerup',function(ev){
  if(!drag)return; var D=drag; drag=null;
  if(ghost){ghost.remove();ghost=null;} PF.root.classList.remove('moving');
  paintRange(null,null);
  if(D.kind==='new'){
    if(D.closing&&!D.moved){ closePanel(); return; }
    var a=D.a<D.b?D.a:D.b, b=D.a<D.b?D.b:D.a;
    newNote(a===b?{start:a}:{start:a,end:b});
    return;
  }
  var n=find(D.id); if(!n)return;
  PF.root.classList.remove('moving');PF.root.classList.remove('resizing');
  var dmo=D.kind!=='resize'&&D.moved&&!dateAt(ev.clientX,ev.clientY)?someAt(ev.clientX,ev.clientY):null; markDrop(null);
  if(D.dup&&(!D.moved||(!dateAt(ev.clientX,ev.clientY)&&!dmo))){ S.notes=S.notes.filter(function(x){return x.id!==n.id}); renderYear(); return; }
  if(!D.moved&&$('panel').classList.contains('open')&&panelMode==='note'){ if(pickedId===n.id)closePanel(); else openNote(n.id); return; }
  if(!D.moved){ var r0=(D.el&&D.el.isConnected?D.el:PF.root.querySelector('.seg[data-id="'+n.id+'"],.sch[data-id="'+n.id+'"]')); var rb=r0?r0.getBoundingClientRect():{left:ev.clientX,bottom:ev.clientY}; itemPop(n,Math.max(rb.left,ev.clientX-60),rb.bottom+8); return; }
  var d=dateAt(ev.clientX,ev.clientY);
  if(dmo&&D.orig){ delete n.start; delete n.end; n.month=dmo; if(D.dup)toast('Duplicated '+(n.title||'Untitled')); else if(D.kind==='move')toast((n.title||'Untitled')+' moved to Sometime in '+MNL[+dmo.slice(5)-1]); save(); renderYear(); if(pickedId===n.id)openNote(n.id); return; }
  if(!d||!D.orig){ revertDrag(D); renderYear(); return; }
  if(D.dup)toast('Duplicated '+(n.title||'Untitled'));
  if(D.kind==='some') toast((n.title||'Untitled')+' set for '+nice(n.start));
  save();renderYear(); if(pickedId===n.id)openNote(n.id);
});
ON(window,'keydown',function(e){ if(e.key==='Alt')PF.root.classList.add('alt'); });
ON(window,'keyup',function(e){ if(e.key==='Alt')PF.root.classList.remove('alt'); });
ON(window,'blur',function(){PF.root.classList.remove('alt');});
ON(window,'keydown',function(e){ if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){ if(cpEl){e.preventDefault();closeCat();return;} if(popEl){e.preventDefault();closePop();return;} if($('panel').classList.contains('open')){ e.preventDefault(); if(document.activeElement&&document.activeElement.blur)document.activeElement.blur(); closePanel(); return; } } if(e.key==='Escape'){ if(drag&&drag.orig){ if(drag.dup){ var did=drag.id; S.notes=S.notes.filter(function(x){return x.id!==did}); } else revertDrag(drag); drag=null; PF.root.classList.remove('moving');PF.root.classList.remove('resizing'); paintRange(null,null); renderYear(); return; } if(cpEl){closeCat();return;} if(popEl){closePop();return;} if($('veil').classList.contains('open'))closeExport(); else closePanel(); } });

/* click away closes the panel */
ON(document,'pointerdown',function(e){
  if(!$('panel').classList.contains('open'))return;
  if(e.target.closest('aside,.veil,button,input,label,#year,#setdd'))return;
  closePanel();
});

ON(window,'keydown',function(e){ var mc=PF.root.querySelector('.mcal'); if(e.key==='Escape'&&mc){ e.stopImmediatePropagation(); e.preventDefault(); mc.remove(); } },true);
ON(document,'pointerdown',function(e){ var mc=PF.root.querySelector('.mcal'); if(mc&&!e.target.closest('.mcal,.dbtn'))mc.remove(); },true);
ON(document,'contextmenu',function(e){
  var it=e.target.closest('#year .seg:not(.ghost),#year .sch:not(.ghost),.cellmark .mk');
  if(it){ var ni=find(it.dataset.id); if(ni){ e.preventDefault(); itemPop(ni,e.clientX,e.clientY); return; } }
  var t=e.target.closest('[data-cat]'); if(!t)return;
  var c=cat(t.dataset.cat); if(!c)return;
  e.preventDefault(); catPop(c,e.clientX,e.clientY);
});
ON(document,'pointerdown',function(e){
  if(cpEl&&!e.target.closest('.pop.cat')){ closeCat(); e.stopPropagation(); return; }
  if(popEl&&!cpEl&&!e.target.closest('.pop')){
    var it=e.target.closest('.seg,.sch,.cellmark .mk');
    if(it&&it.dataset.id===popEl._id&&Date.now()-popEl._t<450){ var id=popEl._id; popEl.remove();popEl=null; openNote(id); e.stopPropagation(); e.preventDefault(); return; }   // double-click: the details card
    closePop(); e.stopPropagation(); }
},true);
ON(document,'pointerdown',function(e){
  if(!$('setdd').classList.contains('open')||cpEl)return;
  if(e.target.closest('#setdd,#setbar,.pop,.veil'))return;
  closeSettings();
},true);
ON(window,'keydown',function(e){ if(e.key==='Escape'&&$('setdd').classList.contains('open')&&!cpEl&&!popEl&&!(drag&&drag.orig)){ closeSettings(); } });

$('prev').onclick=function(){ goYear(Y-1,true); };
$('next').onclick=function(){ goYear(Y+1,true); };
ON(PF.scrollEl,'scroll',function(){ if(!S.set.scroll||scrollBusy||drag||Date.now()<holdScroll)return; scrollBusy=true; requestAnimationFrame(function(){ scrollBusy=false;
  var hdr=parseFloat(getComputedStyle(PF.themeEl).getPropertyValue('--hdr'))||0, rows=PF.root.querySelectorAll('.mrow:not(.h2)'), top=null;
  for(var i=0;i<rows.length;i++){ if(rows[i].getBoundingClientRect().bottom>hdr+40){ top=rows[i]; break; } }
  if(top&&+top.dataset.y!==Y){ Y=+top.dataset.y; S.year=Y; $('ylab').textContent=Y; save(); }
  var doc=PF.themeEl;
  if(PF.sy()+PF.vh()>doc.scrollHeight-900){ SCR.to+=12; if(SCR.to-SCR.from>59){ var cut=yearRow(Math.floor(SCR.from/12)+1), h0=cut?cut.getBoundingClientRect().top:0; SCR.from+=12; renderYear(); var cut2=yearRow(Math.floor(SCR.from/12)); if(cut2)PF.scroller.scrollBy(0,cut2.getBoundingClientRect().top-h0); } else renderYear(); }
  else if(PF.sy()<600){ var first=PF.root.querySelector('.mrow'), t0=first?first.getBoundingClientRect().top:0, key=first?first.dataset.k:null; SCR.from-=12; if(SCR.to-SCR.from>59)SCR.to-=12; renderYear(); var again=key&&PF.root.querySelector('.mrow[data-k="'+key+'"]'); if(again)PF.scroller.scrollBy(0,again.getBoundingClientRect().top-t0); }
}); },{passive:true});
$('yearNote').onclick=function(){ if($('panel').classList.contains('open')&&!pickedId&&$('panel').querySelector('h2')&&$('panel').querySelector('h2').textContent.indexOf('Linear')>0)closePanel(); else openYear(); };
ON($('setbar'),'click',function(e){ var b=e.target.closest('button'); if(!b)return; if($('setdd').classList.contains('open')&&setTab===b.dataset.tab)closeSettings(); else openSettings(b.dataset.tab); });
$('settingsBtn').onclick=function(){ if($('setdd').classList.contains('open'))closeSettings(); else openSettings(); };

ON(window,'resize',relayout);
$('lifeBtn').onclick=function(){ setView(S.set.view==='life'?'year':'life'); };
PF.root.classList.toggle('lifeview',S.set.view==='life'); $('lifeBtn').classList.toggle('on',S.set.view==='life');
mkDefs(); var bm=$('brandMotif'); bm.appendChild(mk('c v')); bm.appendChild(el('i')); bm.appendChild(mk('m'));
applySet();renderCats();shapeSync();renderYear();setHdr();
if(S.set.scroll)requestAnimationFrame(function(){ goYear(S.year); });

}
