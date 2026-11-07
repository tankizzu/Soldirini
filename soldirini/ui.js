'use strict';
// ================= Soldirini v8 · interfaccia pulita =================
// Calendario a schermo pieno: tocco = riepilogo del giorno, doppio tocco = nuova attività,
// pressione lunga = selezione di più giorni. Documenti e Tasse sono sottopagine di Riepilogo.

const APP_VERSIONE='19';
const SUB={doc:'rie',tas:'rie'}; // sottopagina -> scheda madre
const sheets=['dayModal','listModal','confModal'];
function chiudiSheets(){for(const id of sheets)$(id).hidden=true;if($('evModal').hidden&&$('pjModal').hidden&&$('cuModal').hidden)document.body.classList.remove('noscroll');}
function apriSheet(id){chiudiSheets();$(id).hidden=false;document.body.classList.add('noscroll');}

// ---------- navigazione ----------
function vaiA(t){
  const da=tab;tab=t;chiudiSheets();render();scrollTo(0,0);
  if(SUB[t]&&!SUB[da])history.pushState({sub:t},'');
}
addEventListener('popstate',()=>{if(SUB[tab]){tab=SUB[tab];render();scrollTo(0,0);}});

const _render8=render;
render=function(){
  _render8();
  if(SUB[tab])document.querySelector(`.tabs button[data-tab="${SUB[tab]}"]`)?.classList.add('on');
  if(tab==='cal')requestAnimationFrame(adattaCalendario);
};

// ---------- calendario a schermo pieno ----------
function adattaCalendario(){
  const g=$('grid');if(!g||$('v-cal').hidden)return;
  const righe=Math.ceil(g.querySelectorAll('.day').length/7)||5;
  const dow=g.querySelector('.dow')?.offsetHeight||20;
  const gap=4*(righe+1);
  const spazio=innerHeight-Math.max(0,g.getBoundingClientRect().top)-16-(parseFloat(getComputedStyle(document.documentElement).paddingBottom)||0);
  const h=Math.max(innerWidth<520?52:64,Math.floor((spazio-dow-gap)/righe));
  g.style.setProperty('--cellh',h+'px');
}
addEventListener('resize',()=>{if(tab==='cal')adattaCalendario();});

// riepilogo del giorno in una finestra
function apriGiorno(d){
  selDay=d;renderCal();renderDay();
  const es=eventiDel(e=>e.data===d,true);
  let km=0,ore=0,netto=0,rimb=0;
  for(const e of es){if(e.stato==='previsto')continue;km+=kmOf(e);const s=soldiOre(e);ore+=s.ore;netto+=s.netto;rimb+=(e.spese||[]).reduce((a,x)=>a+(+x.importo||0),0);}
  const bits=[`<span><b>${es.length}</b> ${es.length===1?'attività':'attività'}</span>`];
  if(km)bits.push(`<span><b>${nf(km,1)}</b> km</span>`);if(ore)bits.push(`<span><b>${nf(ore)}</b> ore</span>`);
  if(netto)bits.push(`<span><b>${eur(r2(netto))}</b> netti</span>`);if(rimb)bits.push(`<span><b>${eur(r2(rimb))}</b> di spese</span>`);
  $('daySum').innerHTML=es.length?bits.join(''):'';
  apriSheet('dayModal');
}

// tocco, doppio tocco e pressione lunga sul giorno
let tapT=null,tapDay=null,lpT=null,lpFatto=false,lpX=0,lpY=0;
function entraMulti(d){multi=true;selected.clear();selected.add(d);renderCal();if(navigator.vibrate)navigator.vibrate(25);toast('Selezione di più giorni: tocca gli altri giorni');}
function esciMulti(){multi=false;selected.clear();renderCal();}
function bindGriglia(){
  const vecchia=$('grid');const g=vecchia.cloneNode(true);vecchia.replaceWith(g); // tolgo il vecchio comportamento
  g.addEventListener('contextmenu',e=>{if(e.target.closest('[data-day]'))e.preventDefault();});
  g.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-day]');if(!b)return;lpFatto=false;lpX=e.clientX;lpY=e.clientY;clearTimeout(lpT);
    b.classList.add('lp');lpT=setTimeout(()=>{lpFatto=true;b.classList.remove('lp');if(multi){selected.add(b.dataset.day);renderCal();}else entraMulti(b.dataset.day);},480);});
  const annullaLp=()=>{clearTimeout(lpT);g.querySelectorAll('.lp').forEach(x=>x.classList.remove('lp'));};
  g.addEventListener('pointermove',e=>{if(Math.hypot(e.clientX-lpX,e.clientY-lpY)>10)annullaLp();});
  g.addEventListener('pointerup',annullaLp);g.addEventListener('pointercancel',annullaLp);g.addEventListener('pointerleave',annullaLp);
  g.addEventListener('click',e=>{const b=e.target.closest('[data-day]');if(!b)return;const d=b.dataset.day;
    if(lpFatto){lpFatto=false;return;}
    if(multi){selected.has(d)?selected.delete(d):selected.add(d);if(!selected.size)esciMulti();else renderCal();return;}
    if(tapT&&tapDay===d){clearTimeout(tapT);tapT=null;selDay=d;renderCal();openEv([d]);return;}
    clearTimeout(tapT);tapDay=d;tapT=setTimeout(()=>{tapT=null;apriGiorno(d);},270);});
}

// barra della selezione multipla
const _renderCal8=renderCal;
renderCal=function(){
  _renderCal8();
  $('multiBar').hidden=!multi;
  $('multiN').textContent=selected.size===1?'1 giorno selezionato':`${selected.size} giorni selezionati`;
  $('multiAdd').disabled=!selected.size;
  if(tab==='cal')requestAnimationFrame(adattaCalendario);
};
// attività da confermare: un avviso compatto sopra il calendario
const _renderConf8=renderConfermare;
renderConfermare=function(){_renderConf8();const n=daConfermare().length;const b=$('confBanner');b.hidden=!n;
  b.textContent=n===1?'1 attività da confermare':`${n} attività da confermare`;if(!n&&!$('confModal').hidden)chiudiSheets();};

// le finestre si chiudono quando si apre un'attività
const _openEv8=openEv;
openEv=function(dates,e){chiudiSheets();return _openEv8(dates,e);};

// elenco del mese e ricerca
const _renderLista8=renderLista;
renderLista=function(){_renderLista8();$('listaTit').textContent='Attività di '+monthName(cur);};

// tasse: anche le soglie (spostate qui dalle impostazioni)
const _renderTasse8=renderTasse;
renderTasse=function(){_renderTasse8();renderImpost();};

function bind8(){
  bindGriglia();
  document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.goto==='rie'&&history.state?.sub)history.back();else vaiA(b.dataset.goto);}));
  $('multiCancel').onclick=esciMulti;
  $('multiAdd').onclick=()=>{const L=[...selected].sort();esciMulti();openEv(L);};
  $('fab').onclick=()=>openEv([selDay.startsWith(cur)?selDay:cur+'-01']);
  $('dayClose').onclick=chiudiSheets;$('listClose').onclick=chiudiSheets;$('confClose').onclick=chiudiSheets;
  for(const id of sheets)$(id).addEventListener('click',e=>{if(e.target.id===id)chiudiSheets();});
  $('listaHead').onclick=null;
  $('listBtn').onclick=()=>{$('cerca').value='';renderLista();apriSheet('listModal');};
  $('confBanner').onclick=()=>{renderConfermare();apriSheet('confModal');};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(multi)esciMulti();chiudiSheets();}});
}

// ---------- avvio ----------
bind8();
if(tab==='doc'||tab==='tas')history.replaceState({},''),history.pushState({sub:tab},'');
render();

// su schermi larghi nel giorno si legge il nome completo dell'attività
const _etBreve8=etichettaBreve;
etichettaBreve=function(e){return innerWidth>=900?etichetta(e):_etBreve8(e);};
render();

// progetto senza orari tipici: preparo subito una riga orario da compilare
const _openEv10=openEv;
openEv=function(dates,e){const r=_openEv10(dates,e);
  if(md&&md.e?.ore&&!isFisso(md.e)&&!(md.e.fasce||[]).length){md.e.fasce=[{da:'',a:''}];renderFasce();}
  const p=md&&prog(md.e?.pid);if(p&&!p.ore.fasce.length)$('evPreset').innerHTML='<span class="muted sm">Scrivi gli orari. Per inserirli con un tocco, aggiungi gli “orari tipici” nel progetto.</span>';
  return r;};

// numero di versione visibile in Impostazioni (per controllare che l'aggiornamento sia arrivato)
const _renderProg11=renderProgetti;
renderProgetti=function(){_renderProg11();let v=$('appVer');if(!v){v=document.createElement('p');v.id='appVer';v.className='muted sm';v.style.textAlign='center';document.querySelector('#v-pro .two > .stack:last-child').appendChild(v);}
  v.textContent=`Soldirini · versione ${APP_VERSIONE}`;};
