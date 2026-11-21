'use strict';
// ================= Soldirini v8 · interfaccia pulita =================
// Calendario a schermo pieno: tocco = riepilogo del giorno, doppio tocco = nuova attività,
// pressione lunga = selezione di più giorni. Documenti e Tasse sono sottopagine di Riepilogo.

const APP_VERSIONE='24c.10';
const SUB={tas:'rie'}; // sottopagina -> scheda madre
// 24b.1 (D-098): pagine di dettaglio del Riepilogo, una per casella del riquadro (Documenti è dentro "Rimborsi spese")
const PAG_RIE={dfx:'Uscite fisse',dsp:'Spese giornaliere',dlav:'Lavoro dipendente',drim:'Rimborsi spese',drit:'Ritenuta d’acconto',dinc:'Ancora da incassare'};
for(const k in PAG_RIE)SUB[k]='rie';
const sheets=['dayModal','listModal','confModal'];
function chiudiSheets(){for(const id of sheets)$(id).hidden=true;if($('evModal').hidden&&$('pjModal').hidden&&$('cuModal').hidden)document.body.classList.remove('noscroll');}
function apriSheet(id){chiudiSheets();$(id).hidden=false;document.body.classList.add('noscroll');}

// ---------- navigazione ----------
function vaiA(t){
  if(t==='doc')t='drim';
  const da=tab;tab=t;chiudiSheets();render();scrollTo(0,0);
  if(SUB[t]&&!SUB[da])history.pushState({sub:t},'');
}
addEventListener('popstate',()=>{if(SUB[tab]){tab=SUB[tab];render();scrollTo(0,0);}});

const _render8=render;
// 24b.1 (D-098, mockup 02 tornata 23 §2): testata scura delle pagine, con l'icona e lo stesso importo della casella toccata
// v24c (02, tornata 24 §1): nella vista Anno dell'anno in corso tutte le testate dicono "…, fino a {mese}", come il riquadro
const fino=f=>f?', fino a '+f:'';
const TESTA={dfx:['💳',(m,a,y,f)=>a?`Uscite fisse ${y}${fino(f)}`:`Uscite fisse di ${m}`],dsp:['🛒',(m,a,y,f)=>a?`Spese giornaliere ${y}${fino(f)}`:`Spese giornaliere di ${m}`],
  dlav:['💼',(m,a,y,f)=>a?`Entrato da lavoro dipendente nel ${y}${fino(f)}`:`Entrato da lavoro dipendente a ${m}`],pen:['🏛️',(m,a,y,f)=>a?`Pensione ${y}${fino(f)}`:`Pensione di ${m}`],
  drim:['🧾',(m,a,y,f)=>a?`Rimborsi spese ${y}${fino(f)}`:`Rimborsi spese di ${m}`],drit:['📄',(m,a,y,f)=>a?`Ritenuta d’acconto ${y}${fino(f)}`:`Ritenuta d’acconto di ${m}`],
  dinc:['⏳',(m,a)=>a?'Ancora da incassare (tutto l’anno)':'Ancora da incassare'],
  // arrivando dalla casella "Incassato dai progetti" (vista Anno) la testata mostra quella casella, con 💶 (02, tornata 24 §1-2)
  inc:['💶',(m,a,y,f)=>`Incassato dai progetti nel ${y}${fino(f)}`]};
// documenti dei progetti (prima in Documenti): rimborsi in "Rimborsi spese", ore, ritenuta e documento della società in "Ritenuta d'acconto".
// È lo stesso #docList (con i suoi pulsanti), spostato nella pagina aperta; le schede dell'altra pagina restano nascoste.
const docDi=c=>{const t=(c.querySelector('summary .st,h3')?.textContent||'');return /· rimborso spese$|· modello personalizzato$/.test(t.trim())?'drim':/· ore e ritenuta$|tutti i progetti$/.test(t.trim())||/^doc:word-/.test(c.dataset.fold||'')||c.dataset.fid?.startsWith('word-')?'drit':'';};
function docPerPagina(){const L=$('docList');if(!L||(tab!=='drim'&&tab!=='drit'))return;const anno=rieMode==='anno';L.hidden=anno;
  for(const c of L.children){const d=docDi(c);c.hidden=!!d&&d!==tab;}}
// vista Anno di Rimborsi e Ritenuta: un mese per riga; il tocco porta al mese nella vista Mese, senza un passo in più nella cronologia
function mesiDoc(){document.querySelectorAll('.mesibox').forEach(b=>b.innerHTML='');const box=document.querySelector('#v-'+tab+' .mesibox');if(!box||rieMode!=='anno')return;
  const y=cur.slice(0,4),A=aggrega(y),k=tab==='drim'?'rimb':'rit';let righe='';
  for(let m=1;m<=12;m++){const r=A.mesi[m-1];if(!r.n||!r[k])continue;const np=Object.values(riepilogo(`${y}-${pad(m)}`).per).filter(t=>t.n&&t[k]).length;
    righe+=`<button type="button" class="mrow" data-mese="${y}-${pad(m)}"><span class="tx"><b>${MESI[m-1][0].toUpperCase()+MESI[m-1].slice(1)}</b><small>${np===1?'1 progetto':np+' progetti'}</small></span><b>${eur(r[k])}</b></button>`;}
  box.innerHTML=`<div class="card mesi"><h3>Mese per mese</h3>${righe||'<p class="muted">Niente in questo anno.</p>'}<p class="muted sm">Tocca un mese per i documenti di quel mese.</p></div>`;}
document.addEventListener('click',e=>{const b=e.target.closest('.mesibox [data-mese]');if(b){cur=b.dataset.mese;rieMode='mese';render();scrollTo(0,0);}});
// chiunque ridisegni i documenti (anche word.js e pdfdoc.js dopo un salvataggio), le schede restano nella pagina giusta
new MutationObserver(docPerPagina).observe($('docList'),{childList:true});
// la docList va nella pagina aperta (prima del contenitore dei mesi o del segnaposto)
function spostaDoc(){const L=$('docList');if(!L)return;if(tab==='drim'&&L.parentElement.id!=='v-drim')$('rieMesi').before(L);
  if(tab==='drit'&&L.parentElement.id!=='v-drit'){$('v-drit').querySelector('.docposto').before(L);}}
// 24b.2 (D-099 punto 4): aprendo una pagina tutte le sezioni sono chiuse, anche la principale (D-010); niente più apriPrincipale
window.apriSezione=(dentro,titolo)=>{requestAnimationFrame(()=>{const d=[...document.querySelectorAll(dentro+' details')].find(x=>x.querySelector('summary .st')?.textContent.startsWith(titolo));if(d){d.open=true;d.scrollIntoView({block:'start'});}});};
render=function(){
  if(tab==='doc')tab='drim'; // nome vecchio della pagina Documenti
  _render8();
  if(tab!=='dinc')window.testaInc=false; // la testata di "Incassato dai progetti" vale solo finché si resta in quella pagina
  if(PAG_RIE[tab]||tab==='pen'){
    renderRiepilogo(); // stessi conti e stesse sezioni del Riepilogo
    if(tab==='drim'||tab==='drit'){spostaDoc();renderDoc();docPerPagina();}mesiDoc();
    const anno=rieMode==='anno',y=cur.slice(0,4),m=MESI[+cur.slice(5)-1],per=anno?y:monthName(cur);
    document.querySelectorAll('#v-'+tab+' .pgper').forEach(x=>x.textContent=per);
    const inc=tab==='dinc'&&anno&&window.testaInc,t=TESTA[inc?'inc':tab],V=window.VALORI_RIE||{},ora=today().slice(0,7);
    const f=anno&&+y===+ora.slice(0,4)?MESI[(V.mesi||+ora.slice(5))-1]:'';
    const box=$('v-'+tab).querySelector('.testa');if(box&&t)box.innerHTML=`<span class="ic" aria-hidden="true">${t[0]}</span><div><small>${t[1](m,anno,y,f)}</small><b>${eur(V[inc?'inc':tab]||0)}</b></div>`;
  }
  // 02 (Decisione 2, consiglio): il pulsante Pensione resta solo per chi non ha né lavoro dipendente né profilo pensione
  const bp=document.querySelector('#v-rie .subnav [data-goto="pen"]');if(bp)bp.hidden=!!((typeof lavori==='function'&&lavori().length)||(window.Pensione&&Pensione.profilo()));
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
// v21b: piede con i collegamenti Privacy e Licenze (stessa finestra), versione e nota d'autore su due righe (02, indicazione B)
renderProgetti=function(){_renderProg11();let v=$('appVer');if(!v){v=document.createElement('div');v.id='appVer';v.className='piede';document.querySelector('#v-pro .two > .stack:last-child').appendChild(v);}
  v.innerHTML=`<nav class="lnk" aria-label="Informazioni legali"><a href="privacy.html">Privacy</a><span class="muted" aria-hidden="true">·</span><a href="licenze/">Licenze</a></nav>
    <p class="muted sm">Soldirini · versione ${APP_VERSIONE}</p><p class="muted sm">© 2026 Stefano Tanca · Ideato da Stefano Tanca</p>`;};
