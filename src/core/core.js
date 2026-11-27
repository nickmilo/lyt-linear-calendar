/* LYT Linear Calendar core, shared by the web app and the Obsidian plugin.
   GPL-3.0. (c) Linking Your Thinking.
   Included as source into each shell's closure at build time (no modules, no bundler).
   A shell must define: S (state, with notes, cats, hidden, trends, years, set), save(), EX (export options),
   COLW, drag, pickedId, LD, hovDate, hovId, and the hooks the drawing calls: renderCats, refreshPanel,
   strandColorPop, closeLifePop, openNote, itemPop. Element ids used: year, ylab. */
var MARKS=['c v','c m','c g','v','m','g','t v','t m','t g'];
var BONUS=['c p','p','t p','c y','y','t y','c cy','cy','t cy','c pk','pk','t pk'];
var DEF_CATS=[{id:'k1',name:'Work',mark:'c v'},{id:'k2',name:'Family',mark:'m'},{id:'k3',name:'Health',mark:'g'},{id:'k4',name:'Interests',mark:'v'},{id:'k5',name:'Travel',mark:'t g'}];
var now=new Date(); var TODAY=iso(now);
/* ---------- dates ---------- */
function pad(n){return (n<10?'0':'')+n}
function iso(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function parse(s){var p=s.split('-');return new Date(+p[0],+p[1]-1,+p[2])}
function addDays(s,n){var d=parse(s);d.setDate(d.getDate()+n);return iso(d)}
function diff(a,b){return Math.round((parse(b)-parse(a))/864e5)}
var MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var MNL=['January','February','March','April','May','June','July','August','September','October','November','December'];
var WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function nice(s){var d=parse(s);return WD[d.getDay()]+', '+MN[d.getMonth()]+' '+d.getDate()+', '+d.getFullYear()}

/* ---------- helpers ---------- */
function $(id){return document.getElementById(id)}
function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
function uid(){return 'n'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function cat(id){for(var i=0;i<S.cats.length;i++)if(S.cats[i].id===id)return S.cats[i];return null}
function markOf(n){var c=cat(n.category);return c?c.mark:'none'}
/* marks are inline SVG (Obsidian's lint rules out clip-path): shape from the first token, gradient from the last */
var MKG={v:[['#6c2f90',0],['#13b6e3',1]],m:[['#ed3982',0],['#ffcf34',1]],g:[['#03ae4b',0],['#7cd2f6',1]],p:[['#6c2f90',0],['#6c2f90',.45],['#e2a54f',1]],y:[['#ffcf34',0],['#ffcf34',.45],['#9a5c73',1]],cy:[['#13b6e3',0],['#13b6e3',.45],['#c64e98',1]],pk:[['#ed3982',0],['#ed3982',.45],['#3a9ad3',1]]};
function mkDefs(){ if(document.getElementById('lc-mkdefs'))return; var NS='http://www.w3.org/2000/svg', sv=document.createElementNS(NS,'svg'); sv.id='lc-mkdefs'; sv.setAttribute('aria-hidden','true'); sv.setAttribute('width','0'); sv.setAttribute('height','0'); sv.style.position='absolute';
  var d=document.createElementNS(NS,'defs'); Object.keys(MKG).forEach(function(k){ var g=document.createElementNS(NS,'linearGradient'); g.id='lc-g-'+k; g.setAttribute('x1','0');g.setAttribute('y1','0');g.setAttribute('x2','1');g.setAttribute('y2','1');
    MKG[k].forEach(function(st){ var o=document.createElementNS(NS,'stop'); o.setAttribute('offset',st[1]); o.setAttribute('stop-color',st[0]); g.appendChild(o); }); d.appendChild(g); }); sv.appendChild(d); document.body.prepend(sv); }
function mk(m,extra,leg){ var NS='http://www.w3.org/2000/svg', k=(m||'none').split(' '), shape=k.length>1?k[0]:(k[0]==='none'?'c':'s'), col=k[k.length-1];
  var sv=document.createElementNS(NS,'svg'); sv.setAttribute('class','mk '+m+(extra?' '+extra:'')); sv.setAttribute('viewBox','0 0 100 100'); sv.setAttribute('preserveAspectRatio','none'); sv.setAttribute('aria-hidden','true');
  var sh=shape==='c'?document.createElementNS(NS,'circle'):shape==='t'?document.createElementNS(NS,'polygon'):document.createElementNS(NS,'rect');
  if(shape==='c'){ sh.setAttribute('cx','50');sh.setAttribute('cy','50');sh.setAttribute('r',col==='none'?'46':'50'); } else if(shape==='t'){ sh.setAttribute('points',leg?'50,0 76,75 24,75':'50,0 100,100 0,100'); } else { sh.setAttribute('width','100');sh.setAttribute('height','100'); }
  sh.setAttribute('class','mkshape'); if(MKG[col])sh.setAttribute('fill','url(#lc-g-'+col+')');
  sv.appendChild(sh); return sv; }
function route(t){ var m=(t||'').match(/^\s*([^»>→–—«←<]{1,24}?)\s*(<-|->|«|←|<|»|→|>|—|–)\s*([^»>→–—«←<]{1,24}?)\s*$/); if(!(m&&m[1]&&m[3]))return null; return [m[1],m[3],/^(<-|«|←|<)$/.test(m[2])?'l':'r']; }
/* "NYC to HLN" counts as a leg too, but only for travel (a Travel category or a triangle mark), so "Talk to Sam" stays one line */
function travelish(n){ var c=cat(n.category); return !!c&&(/^travel$/i.test((c.name||'').trim())||c.mark.split(' ')[0]==='t'); }
function rt(n){ var r=route(n.title); if(r)return r; if(!travelish(n))return null; var m=(n.title||'').match(/^\s*([^»>→–—«←<]{1,24}?)\s+to\s+([^»>→–—«←<]{1,24}?)\s*$/i); return m?[m[1],m[2],'r']:null; }
/* the arrow in the name sets the leg: NYC > HLN points up (out), NYC < HLN points down (back) */
function legMark(n,m){ var k=m.split(' '), c=cat(n.category), leg=rt(n)&&n.start&&(!n.end||n.end===n.start)&&(k[0]==='t'||(c&&/^travel$/i.test((c.name||'').trim())));
  if(!leg)return mk(m); var e=mk('t '+k[k.length-1],null,true); e.classList.add(rt(n)[2]==='l'?'ret':'out'); return e; }
function named(n){ return !S.set.noNames&&!n.hide; }
function labEl(n){ if(!named(n))return el('span','lab hid'); var r=rt(n), l=el('span','lab'); if(r){ l.classList.add('route'); l.appendChild(el('span','',r[0])); l.appendChild(el('span','',r[1])); l.setAttribute('aria-label',n.title); } else l.textContent=n.title||'Untitled'; return l; }
function closeBtn(){var b=el('button','ghost icon close');b.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';return b}
function toast(t){var e=$('toast');e.textContent=t;e.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(function(){e.classList.remove('show')},2600)}
function visible(n){return !n.category||S.hidden.indexOf(n.category)<0}

/* ---------- year grid ---------- */
var Y;
function segsFor(y,m,d0,d1){
  d0=d0||1; var len=new Date(y,m+1,0).getDate(); d1=Math.min(d1||31,len);
  var first=iso(new Date(y,m,d0)), last=iso(new Date(y,m,d1));
  var out=[];
  S.notes.forEach(function(n){
    var gh=!visible(n); if(!n.start||(gh&&S.set.ghost===false))return;
    var e=n.end||n.start;
    if(e<first||n.start>last)return;
    var a=n.start<first?first:n.start, b=e>last?last:e;
    out.push({n:n,ghost:gh,a:parse(a).getDate(),b:parse(b).getDate(),head:n.start>=first,tail:e<=last,one:!n.end||n.end===n.start});
  });
  // while resizing, the item keeps the row it started in (sort by its original dates)
  var rz=drag&&drag.kind==='resize'&&drag.orig?drag:null;
  out.forEach(function(x){ x.ka=x.a; x.kb=x.b;
    if(rz&&x.n.id===rz.id){ var os=rz.orig.start, oe=rz.orig.end||rz.orig.start; x.ka=os<first?d0:(os>last?d1:parse(os).getDate()); x.kb=oe>last?d1:(oe<first?d0:parse(oe).getDate()); } });
  out.sort(function(p,q){return (p.one-q.one)||p.ka-q.ka||(S.notes.indexOf(p.n)-S.notes.indexOf(q.n))});
  var ghosts=out.filter(function(s){return s.ghost}); out=out.filter(function(s){return !s.ghost});
  var tl=[];
  ghosts.forEach(function(s){ for(var i=0;i<tl.length;i++){ if(tl[i]<s.a){tl[i]=s.b;s.lane=i;return;} } s.lane=Math.min(tl.length,2); if(tl.length<3)tl.push(s.b); else tl[2]=Math.max(tl[2],s.b); });
  var held=null;
  if(drag&&drag.orig&&drag.lane0!=null){ held=out.filter(function(x){return x.n.id===drag.id})[0]||null; if(held)out=out.filter(function(x){return x!==held}); }
  var occ=[];   // per row: the day ranges already taken
  function labDays(s){ if(!named(s.n))return 1; var r=rt(s.n), px=r?22+Math.max(r[0].length,r[1].length)*6:22+(s.n.title||'Untitled').length*6.6; return Math.max(1,Math.ceil(px/COLW)); }
  function span_(s,side){ if(!s.one)return [s.a,s.b]; var w=labDays(s); if(side==='l')return [Math.max(d0,s.a-w+1),s.a]; return [s.a,Math.min(d1,s.a+w-1)]; }
  function free(i,a,b){ return !(occ[i]||[]).some(function(r){return a<=r[1]&&b>=r[0];}); }
  if(held){ var hs=span_(held,held.side); while(occ.length<=drag.lane0)occ.push([]); occ[drag.lane0].push(hs); }
  out.forEach(function(s){
    var i=0, sp;
    for(;;i++){
      sp=span_(s); if(free(i,sp[0],sp[1])){ s.side='r'; break; }
      if(s.one){ var lp=span_(s,'l'); if(s.a-labDays(s)+1>=d0&&free(i,lp[0],lp[1])){ sp=lp; s.side='l'; break; } }
    }
    while(occ.length<=i)occ.push([]); occ[i].push(sp); s.lane=i;
  });
  var lanes=occ;
  if(held){ held.lane=drag.lane0; out.push(held); }
  return {segs:out,ghosts:ghosts,lanes:Math.max(1,lanes.length,held?held.lane+1:0)};
}
/* scrolling months: a run of months across years (absolute month index = year*12 + month) */
var SCR=null;
function monthsToDraw(){ if(!S.set.scroll){ SCR=null; var a=[]; for(var m=0;m<12;m++)a.push([Y,m]); return a; }
  if(!SCR)SCR={from:(S.year-1)*12,to:(S.year+1)*12+11};
  var a=[]; for(var i=SCR.from;i<=SCR.to;i++)a.push([Math.floor(i/12),i%12]); return a; }
function renderYear(){
  if(S.set.view==='life'){ renderLife(); return; }
  $('year').classList.remove('life');
  hovDate=null; hovId=null;
  var cw=PF.root.querySelector('.day[data-date]'); if(cw&&cw.offsetWidth)COLW=cw.offsetWidth;
  if(!S.set.scroll||Y==null)Y=S.year; $('ylab').textContent=Y;
  var root=$('year');root.textContent='';
  var HALF=!!S.set.half, NC=HALF?16:31, COLS='44px repeat('+NC+',minmax(0,1fr)) '+(S.set.someMin?'34px':'150px');
  root.classList.toggle('half',HALF); root.classList.toggle('cond',!!S.set.condensed);
  root.style.setProperty('--ho',Math.max(0,Math.round(COLW/2-5.5))+'px');
  var h=el('div','heads');h.style.gridTemplateColumns=COLS;h.appendChild(el('div'));
  for(var i=1;i<=NC;i++)h.appendChild(el('div'));
  var sl=el('div','sl'), sb=el('button','sfold');   /* the Sometime column folds to an icon's width */
  sb.innerHTML=S.set.someMin?'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M10 16h4"/></svg>':'Sometime <span aria-hidden="true">›</span>';
  sb.title=S.set.someMin?'Show the Sometime column':'Fold the Sometime column'; sb.setAttribute('aria-expanded',!S.set.someMin); sb.setAttribute('aria-label',sb.title);
  sb.onclick=function(){ S.set.someMin=!S.set.someMin; save(); renderYear(); };
  sl.appendChild(sb); h.appendChild(sl); root.appendChild(h);
  var BANDS=HALF?[[1,15],[16,31]]:[[1,31]];
  monthsToDraw().forEach(function(mm){ var yy=mm[0], m=mm[1]; BANDS.forEach(function(bd,bi){
    var d0=bd[0], d1=bd[1], off=d0-1;
    var row=el('div','mrow'+(bi?' h2':''));row.dataset.m=m;row.dataset.y=yy;row.dataset.k=yy+'-'+m+'-'+bi;if(S.set.scroll&&m===0&&!bi)row.classList.add('ystart');row.dataset.d0=d0;row.dataset.d1=d1;row.style.gridTemplateColumns=COLS;
    var len=new Date(yy,m+1,0).getDate();
    var L=segsFor(yy,m,d0,d1);
    if(drag&&drag.orig&&drag.lanes){   // rows hold their height during a drag; the lifted item may overlap others
      var fz=drag.lanes[row.dataset.k]||1; L.lanes=fz; L.segs.forEach(function(x){ if(x.lane>=fz)x.lane=fz-1; });
    }
    /* traces: alone on their days → just under the numbers, where an event would sit; sharing days with events → a strip below them */
    function pack(list){ var tl=[]; list.sort(function(x,y){return x.a-y.a}).forEach(function(g){ for(var i=0;i<tl.length;i++){ if(tl[i]<g.a){tl[i]=g.b;g.lane=i;return;} } g.lane=Math.min(tl.length,2); if(tl.length<3)tl.push(g.b); else tl[2]=Math.max(tl[2],g.b); }); return tl.length; }
    var gTop=[], gLow=[]; L.ghosts.forEach(function(g){ (L.segs.some(function(v){return v.a<=g.b&&v.b>=g.a;})?gLow:gTop).push(g); g.top=gLow.indexOf(g)<0; });
    pack(gTop); var gl=pack(gLow);
    row.style.gridTemplateRows='24px repeat('+L.lanes+','+(S.set.condensed?'19px':'31px')+')'+(gl?' '+(gl*6)+'px':'')+' 4px';
    var nm=el('div','mname',bi?'':MN[m]);nm.dataset.m=m;nm.dataset.ym=yy+'-'+pad(m+1);if(S.set.scroll&&!bi&&(m===0||(SCR&&yy*12+m===SCR.from)))nm.appendChild(el('span','myr num',yy));row.appendChild(nm);
    for(var d=d0;d<d0+NC;d++){
      var c=el('div','day');c.style.gridColumn=(d-off+1);
      if(d>len||d>d1){c.classList.add('nil');row.appendChild(c);continue;}
      var ds=yy+'-'+pad(m+1)+'-'+pad(d), wd=new Date(yy,m,d).getDay();
      c.dataset.date=ds;c.title=nice(ds);
      if(S.set.weekends&&(wd===0||wd===6))c.classList.add('we');
      if(ds===TODAY)c.classList.add('today');
      var sp=el('span','num',d);c.appendChild(sp);
      row.appendChild(c);
    }
    L.segs.forEach(function(s){
      var b=el('button','seg'+(s.one?' one':'')+(s.head?' head':' cont')+(s.tail?' tail':'')+(s.ghost?' ghost':'')+(s.n.id===pickedId?' picked':''));if(s.ghost){b.tabIndex=-1;b.setAttribute('aria-hidden','true');}
      b.style.gridColumn=(s.a-off+1)+' / '+(s.b-off+2);b.style.gridRow=(s.lane+2);
      b.dataset.id=s.n.id;
      if(S.set.past&&(s.n.end||s.n.start)<TODAY&&!(drag&&drag.id===s.n.id))b.classList.add('old');
      var m2=markOf(s.n);
      b.title=(s.n.title||'Untitled')+' · '+(s.one?nice(s.n.start):nice(s.n.start)+' – '+nice(s.n.end));
      var isRt=s.one&&rt(s.n);
      if(s.one){ if(s.side==='l')b.classList.add('lft'); if(isRt)b.classList.add('rt'); b.appendChild(legMark(s.n,m2)); b.appendChild(labEl(s.n)); }
      else if(S.set.condensed){
        b.classList.add('flat');
        var bar=el('span','bar');
        if(s.head)bar.appendChild(mk(m2)); else bar.appendChild(el('i')).style.flex='0 0 10px';
        bar.appendChild(el('span','lab',named(s.n)?(s.n.title||'Untitled'):''));bar.appendChild(el('i'));
        if(s.tail)bar.appendChild(mk(m2));
        b.appendChild(bar);
      }
      else{
        b.appendChild(el('span','lab',named(s.n)?(s.n.title||'Untitled'):''));
        var bar=el('span','bar');bar.appendChild(mk(m2,s.head?'':'gone'));bar.appendChild(el('i'));bar.appendChild(mk(m2,s.tail?'':'gone'));
        b.appendChild(bar);
      }
      if(s.head){var hl=el('span','rh rl');hl.setAttribute('aria-hidden','true');b.appendChild(hl);}
      if(s.tail){var hr=el('span','rh rr');hr.setAttribute('aria-hidden','true');b.appendChild(hr);}
      row.appendChild(b);
    });
    L.ghosts.forEach(function(s){
      var t=el('div','trace'+(s.one?'':(s.head?' head':'')+(s.tail?' tail':'')));t.style.gridColumn=(s.a-off+1)+' / '+(s.b-off+2);if(s.top){t.style.gridRow=2;t.style.alignSelf='start';t.style.marginTop=(4+s.lane*6)+'px';} else {t.style.gridRow=(L.lanes+2);t.style.alignSelf='start';t.style.marginTop=(s.lane*6)+'px';}t.setAttribute('aria-hidden','true');
      var m3=markOf(s.n);
      if(s.one){t.appendChild(legMark(s.n,m3));t.style.justifyContent='center';}
      else{t.appendChild(mk(m3,s.head?'':'gone'));t.appendChild(el('i'));t.appendChild(mk(m3,s.tail?'':'gone'));}
      row.appendChild(t);
    });
    var so=el('div','some'+(S.set.someMin?' mini':''));so.dataset.m=m;so.dataset.ym=yy+'-'+pad(m+1);so.style.gridColumn=(NC+2);
    if(bi){ row.appendChild(so); root.appendChild(row); return; }
    var mkey=yy+'-'+pad(m+1);
    var shown=0, extra=0, names=[];
    S.notes.forEach(function(n){
      var gh=!visible(n); if(n.start||n.month!==mkey||(gh&&S.set.ghost===false))return;
      if(!gh)names.push(n.title||'Untitled');
      if(S.set.someMin){ if(gh)return; if(shown>=2){extra++;return;} shown++; }
      var x=el('button','sch'+(gh?' ghost':'')+(n.id===pickedId?' picked':''));if(gh){x.tabIndex=-1;x.setAttribute('aria-hidden','true');}x.dataset.id=n.id;x.title=(n.title||'Untitled')+' · sometime in '+MNL[m];
      x.appendChild(mk(markOf(n)));x.appendChild(el('span','',n.title||'Untitled'));so.appendChild(x);
    });
    if(extra)so.appendChild(el('span','smore num','+'+extra));
    if(S.set.someMin)so.title=names.length?MNL[m]+', sometime: '+names.join(', ')+'. Click to show the column.':'Nothing for '+MNL[m]+' yet. Click to show the column.';
    var add=el('button','add','+ Sometime');add.dataset.month=mkey;add.title='Add a plan for '+MNL[m]+' without a day yet';so.appendChild(add);
    row.appendChild(so);
    root.appendChild(row);
  }); });
  var nw=PF.root.querySelector('.day[data-date]'); if(nw&&nw.offsetWidth)root.style.setProperty('--ho',Math.max(0,(nw.getBoundingClientRect().width/2-5.5))+'px');
  if(nw&&nw.offsetWidth&&Math.abs(nw.offsetWidth-COLW)>COLW*.15&&!renderYear.again){ renderYear.again=true; renderYear(); renderYear.again=false; }
}

/* ---------- Life Trends: a row per year, a band per category, strands sharing each month ---------- */
var GRAD={v:['#6c2f90','#13b6e3'],m:['#ed3982','#ffcf34'],g:['#03ae4b','#7cd2f6'],p:['#5b2e91','#c9a0e6'],y:['#c99700','#ffe17a'],cy:['#0b86ad','#97def5'],pk:['#c8175f','#f6a3c6'],none:['#8a8a8a','#c8c8c8']};
function mixHex(a,b,t){ var x=parseInt(a.slice(1),16), y=parseInt(b.slice(1),16); function ch(s){ return Math.round(((x>>s)&255)*(1-t)+((y>>s)&255)*t); } return 'rgb('+ch(16)+','+ch(8)+','+ch(0)+')'; }
function catGrad(c){ var k=c?c.mark.split(' ').pop():'none'; return GRAD[k]||GRAD.none; }
function strandsOf(cid){ return S.trends.filter(function(t){return t.cat===cid}); }
function strandColor(t){ if(t.color)return t.color; var list=strandsOf(t.cat), i=list.indexOf(t), n=list.length, g=catGrad(cat(t.cat)); return mixHex(g[0],g[1],n<=1?0.25:i/(n-1)); }
function mi(ym){ return +ym.slice(0,4)*12+(+ym.slice(5,7))-1; }
function ymOf(i){ return Math.floor(i/12)+'-'+pad(i%12+1); }
function ymNice(ym){ return MN[+ym.slice(5,7)-1]+' '+ym.slice(0,4); }
/* the strands in one category for one month, with their widths */
function mixAt(cid,i){ var parts=[]; strandsOf(cid).forEach(function(t){ t.stretches.forEach(function(s,k){ if(mi(s.from)<=i&&i<=mi(s.to)){ var ym=ymOf(i), o=s.at&&s.at[ym]!=null?s.at[ym]:s.share; parts.push({t:t,s:s,k:k,share:o}); } }); });
  if(!parts.length)return parts;
  var fixed=parts.filter(function(p){return p.share!=null&&p.share!==''}), sum=fixed.reduce(function(a,p){return a+(+p.share)},0), free=parts.length-fixed.length;
  var rest=Math.max(0,100-sum), each=free?rest/free:0, scale=sum>100?100/sum:1;
  if(free&&rest<100/parts.length){ each=100/parts.length; scale=sum?(100-each*free)/sum:1; }   /* a full month makes room for a new thread */
  parts.forEach(function(p){ p.w=(p.share!=null&&p.share!=='')?(+p.share)*scale:each; });
  return parts; }
function lifeRange(){ var lo=null, hi=null, now=new Date().getFullYear();
  S.trends.forEach(function(t){ t.stretches.forEach(function(s){ var a=+s.from.slice(0,4), b=+s.to.slice(0,4); lo=lo==null?a:Math.min(lo,a); hi=hi==null?b:Math.max(hi,b); }); });
  var from=S.born?S.born:(lo!=null?Math.min(lo,now-10):now-10), to=Math.max(now,hi||now);
  return [from,to]; }
function renderLife(){
  var root=$('year');root.textContent='';root.classList.add('life');
  var cats=S.cats.filter(function(c){return S.hidden.indexOf(c.id)<0});
  var top=el('div','lhead');
  var bl=el('label','lborn');bl.appendChild(document.createTextNode('Born'));var bi=el('input');bi.className='num';bi.inputMode='numeric';bi.placeholder='year';bi.value=S.born||'';bi.setAttribute('aria-label','Year you were born');
  bi.onchange=function(){ var v=parseInt(bi.value,10); S.born=(v>1900&&v<=new Date().getFullYear())?v:null; save(); renderYear(); };bl.appendChild(bi);top.appendChild(bl);
  var lg=el('div','llegend');
  cats.forEach(function(c){ var g=el('div','lg');var h=el('b','',c.name);h.prepend(mk(c.mark));g.appendChild(h);
    strandsOf(c.id).forEach(function(t){ var s=el('button','lst');s.title='Rename '+t.name+' or change its colour';var sw=el('i');sw.style.background=strandColor(t);s.appendChild(sw);s.appendChild(document.createTextNode(t.name));s.onclick=function(e){ e.stopPropagation(); var r=s.getBoundingClientRect(); strandColorPop(t,r.left,r.bottom); };g.appendChild(s); });
    lg.appendChild(g); });
  top.appendChild(lg);
  top.appendChild(el('div','small lhint','Drag across months in a band to add a stretch. Click a stretch to change it.'));
  root.appendChild(top);
  var mh=el('div','lgrid lmonths');mh.appendChild(el('span'));MN.forEach(function(m){mh.appendChild(el('span','',m));});root.appendChild(mh);
  var r=lifeRange(), NOW=new Date(), nowI=NOW.getFullYear()*12+NOW.getMonth();
  for(var y=r[0];y<=r[1];y++){
    var row=el('div','lgrid lrow'+(y===NOW.getFullYear()?' lnow':''));row.dataset.y=y;
    var lab=el('span','lyl num');lab.appendChild(el('b','',y));if(S.born)lab.appendChild(el('span','',y-S.born));row.appendChild(lab);
    for(var m=0;m<12;m++){ var i=y*12+m, cell=el('div','lcell'+(i>nowI?' lfut':''));
      cats.forEach(function(c){ var b=el('div','lband');b.dataset.cat=c.id;b.dataset.i=i;
        var mix=mixAt(c.id,i), tip=[];
        mix.forEach(function(p,j){ var sg=el('i','lseg');sg.style.width=p.w+'%';sg.style.background=strandColor(p.t);sg.dataset.tid=p.t.id;sg.dataset.k=p.k;
          if(j===0&&mi(p.s.from)===i){ var hl=el('b','lh ll');hl.setAttribute('aria-hidden','true');sg.appendChild(hl); }
          var hr=el('b','lh lr'+(mi(p.s.to)===i?' lend':''));hr.dataset.j=j;hr.setAttribute('aria-hidden','true');hr.title=j<mix.length-1?'Drag to trade share with the next thread this month':'Drag to change this month’s share'+(mi(p.s.to)===i?'; past the month to extend':'');sg.appendChild(hr);
          if(LD&&LD.moved&&LD.tid===p.t.id&&LD.k===p.k)sg.classList.add('llift');
          b.appendChild(sg); tip.push(p.t.name+' '+Math.round(p.w)+'%'); });
        b.title=ymNice(ymOf(i))+' · '+c.name+(tip.length?': '+tip.join(', '):'');
        cell.appendChild(b); });
      row.appendChild(cell); }
    root.appendChild(row); }
}
/* ---------- push one item to a calendar app (one way, no sync) ---------- */
function calDates(n){ var a=n.start.replace(/-/g,''), b=addDays(n.end||n.start,1).replace(/-/g,''); return [a,b]; }   /* all-day; the end is exclusive */
function calText(n){ return (n.plan||'').trim(); }
function gcalUrl(n){ var d=calDates(n); return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text='+encodeURIComponent(n.title||'Untitled')+'&dates='+d[0]+'/'+d[1]+(calText(n)?'&details='+encodeURIComponent(calText(n)):''); }
function outlookUrl(n){ return 'https://outlook.live.com/calendar/0/action/compose?subject='+encodeURIComponent(n.title||'Untitled')+'&startdt='+n.start+'&enddt='+addDays(n.end||n.start,1)+'&allday=true'+(calText(n)?'&body='+encodeURIComponent(calText(n)):''); }
function icsEsc(t){ return String(t).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n'); }
function icsEvent(n){ var d=calDates(n), now=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+/,'');
  var L=['BEGIN:VEVENT','UID:'+n.id+'@lytlinearcalendar.com','DTSTAMP:'+now,'DTSTART;VALUE=DATE:'+d[0],'DTEND;VALUE=DATE:'+d[1],'SUMMARY:'+icsEsc(n.title||'Untitled')];
  var c=cat(n.category); if(c)L.push('CATEGORIES:'+icsEsc(c.name)); if(calText(n))L.push('DESCRIPTION:'+icsEsc(calText(n))); L.push('END:VEVENT'); return L; }
function icsFile(list){ var L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//LYT Linear Calendar//EN','CALSCALE:GREGORIAN']; list.forEach(function(n){ L=L.concat(icsEvent(n)); }); L.push('END:VCALENDAR'); return L.join('\r\n')+'\r\n'; }
function markName(m){var k=m.split(' ');var sh=k[0]==='c'?'Circle':k[0]==='t'?'Triangle':'Square';var c2=k[k.length-1];var co=c2==='p'?'purple with gold':c2==='y'?'gold with purple':c2==='cy'?'cyan with pink':c2==='pk'?'pink with cyan':m.indexOf('v')>=0?'violet to blue':m.indexOf('v')>=0?'violet to blue':m.indexOf(' m')>=0||m==='m'?'magenta to yellow':'green to sky blue';return sh+', '+co}
/* ---------- Markdown ---------- */
/* ---------- export format: properties, file names, folders (Settings → Export) ---------- */
var PROPDEF=[
  {id:'up',key:'up',lyt:1,hint:'links to the year note'},
  {id:'related',key:'related',lyt:1,hint:'left empty'},
  {id:'created',key:'created',lyt:1,hint:'the export date'},
  {id:'collections',key:'collections',lyt:1,val:'[[Linear Calendar]]',hint:'comma-separate several'},
  {id:'start',key:'start',req:1,hint:'first day'},
  {id:'end',key:'end',req:1,hint:'last day, spans only'},
  {id:'month',key:'month',req:1,hint:'Sometime items'},
  {id:'category',key:'category',hint:''},
  {id:'hide',key:'hide-name',hint:'only when a name is hidden'}];
var NAMEPAT={one:'{date} {title}',span:'{start} {title}',some:'{month} {title}'};
function propsFor(preset){ return PROPDEF.map(function(d){ return {id:d.id,key:d.key,val:d.val||'',on:preset==='lyt'?true:!d.lyt}; }); }
function exDefaults(){ return {preset:'basic',props:propsFor('basic'),extra:[],perCat:{},catAs:'text',catNotes:true,names:JSON.parse(JSON.stringify(NAMEPAT)),folders:'flat',ics:false}; }
function exo(){ var e=S.set.ex; if(!e||!e.props){ e=S.set.ex=exDefaults(); }
  PROPDEF.forEach(function(d){ if(!e.props.some(function(p){return p.id===d.id}))e.props.push({id:d.id,key:d.key,val:d.val||'',on:!d.lyt}); });
  e.names=e.names||JSON.parse(JSON.stringify(NAMEPAT)); e.extra=e.extra||[]; e.perCat=e.perCat||{};
  if(e.extra.length){ e.extra.forEach(function(x){ e.props.push({id:'x'+uid(),key:x.key,val:x.value,on:true,extra:true}); }); e.extra=[]; }
  return e; }
function pkey(id){ var p=exo().props.filter(function(x){return x.id===id})[0]; return (p&&(p.key||'').trim())||PROPDEF.filter(function(d){return d.id===id})[0].key; }
function kindOf(n){ return !n.start?'some':(n.end&&n.end!==n.start?'span':'one'); }
function clean(s){return (s||'Untitled').replace(/\s*(->|>)\s*/g,' » ').replace(/\s*(<-|<)\s*/g,' « ').replace(/[\\\/:*?"<>|#^\[\]]/g,' ').replace(/\s+/g,' ').trim()||'Untitled'}
function tokens(n){ var c=cat(n.category), st=n.start||'', mo=n.month||st.slice(0,7);
  return {date:st,start:st,end:n.end||st,month:mo,year:(st||mo).slice(0,4),title:clean(n.title),category:c?clean(c.name):''}; }
function fillPat(pat,n){ var t=tokens(n); return (pat||'').replace(/\{(\w+)\}/g,function(m,k){return t[k]!=null?t[k]:m;}); }
function fileName(n,seen){
  var e=exo(), k=kindOf(n), base=fillPat(e.names[k]||NAMEPAT[k],n).replace(/[\\\/:*?"<>|#^\[\]{}]/g,' ').replace(/\s+/g,' ').trim()||clean(n.title);
  var y=(n.start||n.month||'').slice(0,4), dir='';
  if(e.folders==='year'||e.folders==='month')dir=y+'/';   /* 'month' was an option; it now reads as by year */
  if(!n.start)dir=(e.folders==='flat'?'':y+'/')+'Sometime/';
  var name=dir+base+'.md', i=2;
  while(seen[name.toLowerCase()]){name=dir+base+' '+i+'.md';i++;}
  seen[name.toLowerCase()]=1;return name;
}
function yv(v){return /[:#\[\]{},&*!|>'"%@`]|^\s|\s$/.test(v)?JSON.stringify(v):v}
function yl(k,v){ /* one property: '' is empty, an array is a list */
  if(Array.isArray(v))return v.length?k+':\n'+v.map(function(x){return '  - '+JSON.stringify(x)}).join('\n'):k+':';
  return v===''||v==null?k+':':k+': '+v; }
function parseExtra(t){ return String(t||'').split(/\r?\n/).map(function(l){var i=l.indexOf(':');return i>0?{key:l.slice(0,i).trim(),value:l.slice(i+1).trim()}:null}).filter(function(x){return x&&x.key}); }
function noteText(n){
  var e=exo(), c=cat(n.category), fmk=[], fmv={};
  function put(k,v){ if(!k)return; if(!(k in fmv)){ fmk.push(k); fmv[k]=v; return; }
    var cur=fmv[k]; if(Array.isArray(cur)){ (Array.isArray(v)?v:[v]).forEach(function(x){ if(x!==''&&cur.indexOf(x)<0)cur.push(x); }); } else if(cur===''||cur==null)fmv[k]=v; }
  e.props.forEach(function(p){ if(!p.on)return; var k=(p.key||'').trim(); if(!k)return;
    switch(p.id){
      case 'up': put(k,EX.year!==false?['[['+tokens(n).year+' Linear]]']:''); break;
      case 'related': put(k,''); break;
      case 'created': put(k,TODAY); break;
      case 'collections': put(k,(p.val||'').split(',').map(function(x){return x.trim()}).filter(Boolean)); break;
      case 'start': if(n.start)put(k,n.start); break;
      case 'end': if(n.start&&n.end&&n.end!==n.start)put(k,n.end); break;
      case 'month': if(!n.start&&n.month)put(k,n.month); break;
      case 'category': if(c)put(k,e.catAs==='link'?JSON.stringify('[['+clean(c.name)+']]'):yv(c.name)); break;
      case 'hide': if(n.hide)put(k,'true'); break;
      default: if(p.extra){ var xv=(p.val||'').trim(); put(k,/^\[\[.*\]\]$/.test(xv)?JSON.stringify(xv):(xv?yv(xv):'')); } } });
  var more=(c&&e.perCat[c.id]?parseExtra(e.perCat[c.id]):[]);
  more.forEach(function(x){ var k=(x.key||'').trim(), v=(x.value||'').trim(); if(!k)return;
    if(Array.isArray(fmv[k])){ put(k,v.replace(/^"(.*)"$/,'$1')); return; }   /* adds to a list, like collections */
    put(k,/^\[\[.*\]\]$/.test(v)?JSON.stringify(v):(v?yv(v):'')); });
  var fm=['---'].concat(fmk.map(function(k){ return yl(k,fmv[k]); }));
  fm.push('---','');
  var body='## Plan\n'+((n.plan||'').trim()?n.plan.trim()+'\n':'')+'\n## Reflection\n'+((n.reflection||'').trim()?n.reflection.trim()+'\n':'');
  return fm.join('\n')+body;
}
function yearText(y){var yn=S.years[y]||{};return '---\nyear: '+y+'\n---\n\n## Intentions\n'+((yn.intentions||'').trim()?yn.intentions.trim()+'\n':'')+'\n## Reflection\n'+((yn.reflection||'').trim()?yn.reflection.trim()+'\n':'');}
function baseText(){ var st=pkey('start'), en=pkey('end'), mo=pkey('month'), ca=pkey('category');
  return 'filters:\n  and:\n    - file.folder.contains("Linear")\nviews:\n  - type: table\n    name: Year\n    filters:\n      and:\n      - '+st+'\n    order:\n      - file.name\n      - '+st+'\n      - '+en+'\n      - '+ca+'\n    sort:\n      - property: '+st+'\n        direction: ASC\n  - type: table\n    name: Sometime\n    filters:\n      and:\n        - file.folder.contains("Sometime")\n    order:\n      - file.name\n      - '+mo+'\n      - '+ca+'\n    sort:\n      - property: '+mo+'\n        direction: ASC\n'; }
function buildFiles(opts){
  var seen={}, files=[], e=exo();
  var years={};
  S.notes.forEach(function(n){ if(!(n.title||'').trim()&&!(n.plan||'').trim()&&!(n.reflection||'').trim())return;
    if(opts.past===false&&n.start&&(n.end||n.start)<TODAY)return;
    var y=(n.start||n.month||'').slice(0,4); if(y)years[y]=1;
    files.push({name:'Linear/'+fileName(n,seen),text:noteText(n),n:n}); });
  Object.keys(S.years).forEach(function(y){var v=S.years[y];if((v.intentions||'').trim()||(v.reflection||'').trim())years[y]=1;});
  years[Y]=1;
  files.sort(function(a,b){var x=a.n&&!a.n.start, y=b.n&&!b.n.start; return x-y||(a.name<b.name?-1:1)});
  if(e.catAs==='link'&&e.catNotes){ var usedC={}; files.forEach(function(f){ var c=f.n&&cat(f.n.category); if(c)usedC[c.id]=c; });
    Object.keys(usedC).forEach(function(id){ files.push({name:'Linear/Categories/'+clean(usedC[id].name)+'.md',text:'',catNote:1}); }); }
  if(opts.year!==false) Object.keys(years).sort().forEach(function(y){files.unshift({name:'Linear/'+y+' Linear.md',text:yearText(y),year:y});});
  (S.trends||[]).forEach(function(t){ if(!t.stretches.length)return; var c=cat(t.cat), cn=c?clean(c.name):'Uncategorised', ck=pkey('category');
    var txt='---\n'+(c?ck+': '+(e.catAs==='link'?JSON.stringify('[['+clean(c.name)+']]'):yv(c.name))+'\n':'')+(t.color?'color: "'+t.color+'"\n':'')+'stretches:\n'+t.stretches.map(function(s){ return '  - '+JSON.stringify(s.from+' → '+s.to+(s.share!=null&&s.share!==''?' · '+s.share+'%':'')+(s.at?Object.keys(s.at).sort().map(function(ym){return ' · '+ym+' '+s.at[ym]+'%'}).join(''):'')); }).join('\n')+'\n---\n';
    files.push({name:'Linear/Trends/'+cn+'/'+clean(t.name)+'.md',text:txt,trend:1}); });
  files.unshift({name:'Linear/Linear.base',text:baseText()});
  if(e.ics){ var dated=files.filter(function(f){return f.n&&f.n.start}).map(function(f){return f.n}); if(dated.length)files.push({name:'Linear.ics',text:icsFile(dated),ics:1}); }
  return files;
}

/* ---------- zip (store) ---------- */
var CRC=(function(){var t=[];for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(u){var c=0xFFFFFFFF;for(var i=0;i<u.length;i++)c=CRC[(c^u[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
function zip(files){
  var enc=new TextEncoder(), parts=[], central=[], off=0;
  var d=new Date(), time=(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1), date=((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();
  files.forEach(function(f){
    var nm=enc.encode(f.name), data=enc.encode(f.text), crc=crc32(data);
    var h=new DataView(new ArrayBuffer(30));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);h.setUint16(10,time,true);h.setUint16(12,date,true);
    h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,nm.length,true);h.setUint16(28,0,true);
    parts.push(new Uint8Array(h.buffer),nm,data);
    var c=new DataView(new ArrayBuffer(46));
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(10,0,true);c.setUint16(12,time,true);c.setUint16(14,date,true);
    c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,nm.length,true);
    c.setUint32(42,off,true);
    central.push(new Uint8Array(c.buffer),nm);
    off+=30+nm.length+data.length;
  });
  var csize=central.reduce(function(s,a){return s+a.length},0);
  var e=new DataView(new ArrayBuffer(22));
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,csize,true);e.setUint32(16,off,true);
  return new Blob(parts.concat(central,[new Uint8Array(e.buffer)]),{type:'application/zip'});
}
/* ---------- import ---------- */
/* the title back out of a file name, using the same pattern the export used */
function titleFrom(base,kind){
  var pat=exo().names[kind]||NAMEPAT[kind];
  var rx='^'+pat.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+').replace(/\{(\w+)\}/g,function(m,k){
    return k==='title'?'(.+?)':(k==='date'||k==='start'||k==='end')?'\\d{4}-\\d{2}-\\d{2}':k==='month'?'\\d{4}-\\d{2}':k==='year'?'\\d{4}':'.*?'; })+'$';
  var m=null; try{ m=base.match(new RegExp(rx)); }catch(e){}
  if(m&&m[1])return m[1];
  return base.replace(/^\d{4}-\d{2}(-\d{2})?\s+/,''); }

function F0(fm,id){ var k=pkey(id); return fm[k]!=null&&fm[k]!==''?fm[k]:fm[id]; }
function parseMd(name,text){
  var fm={}, body=text;
  var m=text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if(m){ body=text.slice(m[0].length); var lastK=null; m[1].split(/\r?\n/).forEach(function(l){ var li=l.match(/^\s+-\s+(.*)$/); if(li&&lastK){ var lv=li[1].trim(); if(/^".*"$/.test(lv)){try{lv=JSON.parse(lv)}catch(e){}} if(!Array.isArray(fm[lastK]))fm[lastK]=[]; fm[lastK].push(lv); return; } var i=l.indexOf(':');if(i>0){ lastK=l.slice(0,i).trim();var k=l.slice(0,i).trim(),v=l.slice(i+1).trim();if(/^".*"$/.test(v)){try{v=JSON.parse(v)}catch(e){}}else v=v.replace(/^'(.*)'$/,'$1');fm[k]=v;}}); }
  function sec(h){var r=new RegExp('^##\\s+'+h+'\\s*$([\\s\\S]*?)(?=^##\\s|$(?![\\s\\S]))','mi');var x=body.match(r);return x?x[1].trim():null;}
  var base=name.split('/').pop().replace(/\.md$/i,'');
  if(Array.isArray(fm.stretches)&&/(^|\/)Trends\//.test(name)){ var tc=F0(fm,'category'); var sts=fm.stretches.map(function(x){ var mm=String(x).match(/^(\d{4}-\d{2})\s*(?:→|->|–|-|to)\s*(\d{4}-\d{2})(?:\s*·\s*(\d+(?:\.\d+)?)%)?/); if(!mm)return null; var o={from:mm[1],to:mm[2],share:mm[3]!=null?+mm[3]:null}, rest=String(x).slice(mm[0].length), ov, rx=/(\d{4}-\d{2})\s+(\d+(?:\.\d+)?)%/g; while((ov=rx.exec(rest))){ o.at=o.at||{}; o.at[ov[1]]=+ov[2]; } return o; }).filter(Boolean);
    return sts.length?{trend:{color:/^#[0-9a-f]{6}$/i.test(fm.color||'')?fm.color.toLowerCase():null,cat:tc?String(tc).replace(/^\[\[([^\]|]*)(\|[^\]]*)?\]\]$/,'$1').trim():'',name:base,stretches:sts}}:null; }
  var ym=base.match(/^(\d{4}) Linear$/);
  if(ym){ return {year:ym[1],intentions:sec('Intentions')||'',reflection:sec('Reflection')||''}; }
  function F(id,def){ var k=pkey(id); return fm[k]!=null&&fm[k]!==''?fm[k]:fm[def]; }
  var fs=F('start','start'), fe=F('end','end'), fmo=F('month','month'), fc=F('category','category'), fh=F('hide','hide-name');
  var start=/^\d{4}-\d{2}-\d{2}$/.test(fs||'')?fs:null, month=/^\d{4}-\d{2}$/.test(fmo||'')?fmo:null;
  if(!start&&!month)return null;
  var title=titleFrom(base,start?(fe&&fe>start?'span':'one'):'some');
  var plan=sec('Plan'), refl=sec('Reflection');
  if(plan===null&&refl===null)plan=body.trim();
  var cid='';
  if(fc){ fc=String(fc).replace(/^\[\[([^\]|]*)(\|[^\]]*)?\]\]$/,'$1').trim(); var c=S.cats.filter(function(k){return k.name.toLowerCase()===fc.toLowerCase()})[0];
    if(!c){ var used=S.cats.map(function(k){return k.mark}); c={id:uid(),name:fc,mark:MARKS.filter(function(x){return used.indexOf(x)<0})[0]||MARKS[0]}; S.cats.push(c);} cid=c.id; }
  var n={id:uid(),title:title,category:cid,plan:plan||'',reflection:refl||''};
  if(String(fh).toLowerCase()==='true')n.hide=true;
  if(start){n.start=start; if(/^\d{4}-\d{2}-\d{2}$/.test(fe||'')&&fe>start)n.end=fe;} else n.month=month;
  return n;
}
function unzip(buf){
  var dv=new DataView(buf), out=[], i=buf.byteLength-22;
  while(i>=0&&dv.getUint32(i,true)!==0x06054b50)i--;
  if(i<0)return Promise.reject(new Error('Not a zip file'));
  var cnt=dv.getUint16(i+10,true), p=dv.getUint32(i+16,true), dec=new TextDecoder();
  var jobs=[];
  for(var k=0;k<cnt;k++){
    var method=dv.getUint16(p+10,true), csz=dv.getUint32(p+20,true), nl=dv.getUint16(p+28,true), el2=dv.getUint16(p+30,true), cl=dv.getUint16(p+32,true), lo=dv.getUint32(p+42,true);
    var name=dec.decode(new Uint8Array(buf,p+46,nl)); p+=46+nl+el2+cl;
    var ln=dv.getUint16(lo+26,true), le=dv.getUint16(lo+28,true), data=new Uint8Array(buf,lo+30+ln+le,csz);
    if(!/\.md$/i.test(name)||/(^|\/)(__MACOSX|\.)/.test(name))continue;
    (function(name,method,data){
      if(method===0)jobs.push(Promise.resolve({name:name,text:dec.decode(data)}));
      else if(method===8&&typeof DecompressionStream!=='undefined'){
        jobs.push(new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text().then(function(t){return {name:name,text:t}}));
      }
    })(name,method,data);
  }
  return Promise.all(jobs);
}
