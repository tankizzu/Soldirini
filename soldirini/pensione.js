'use strict';
// ================= Soldirini v22 · pensione =================
// Pagina "Pensione" in Riepilogo (contributi, fondo pensione, pensione futura e, per il pensionato, i mesi e l'anno in breve),
// "La mia pensione" in Impostazioni, finestra Cedolino con archivio e cartella Soldirini/Pensione/<anno> su Drive,
// riga "Pensione · mese" in Riepilogo. Calcoli in pencalc.js, lettura dei cedolini in buste.js.
// Decisioni: D-011, D-033, D-036, D-039, D-040. Ogni importo calcolato è una stima.
(function(){
const P=window.PenCalc;const n=P.n;const z=v=>n(v)||0;
const PEN=()=>D().pensione||(D().pensione={});
const FON=()=>D().fondi||(D().fondi={});
const CED=()=>D().cedolini||(D().cedolini={});
const profilo=()=>{const p=PEN().profilo;return p&&!p.deleted&&n(p.lordoMese)>0?p:null;};
const cedolini=()=>Object.values(CED()).filter(c=>c&&!c.deleted&&c.mese).sort((a,b)=>a.mese.localeCompare(b.mese));
const cedDi=ym=>{const c=CED()[ym];return c&&!c.deleted?c:null;};
const fondoDi=y=>{const f=FON()[y];return f&&!f.deleted?f:null;};
const Mc=m=>MESI[m-1][0].toUpperCase()+MESI[m-1].slice(1);
const ymDi=(y,m)=>`${y}-${pad(m)}`;
const mesePrima=ym=>{const d=new Date(+ym.slice(0,4),+ym.slice(5)-2,1);return `${d.getFullYear()}-${pad(d.getMonth()+1)}`;};
const eu=v=>eur(r2(v));
const MAI={FUTURA:'https://www.inps.it/it/it/dettaglio-scheda.it.schede-servizio-strumento.schede-servizi.la-mia-pensione-futura-simulazione-della-propria-pensione-50033.la-mia-pensione-futura-simulazione-della-propria-pensione.html',
  PENSAMI:'https://www.inps.it/it/it/dettaglio-scheda.it.schede-servizio-strumento.schede-servizi.pensami-simulatore-scenari-pensionistici.pensami---simulatore-scenari-pensionistici.html'};
// avvertenze di 04 §6, una per sezione
const AVV={
  1:y=>`Importi stimati con le regole ${P.valori(y).regole}. Il netto vero è quello del cedolino INPS: può cambiare ogni mese per addizionali e conguagli.`,
  2:()=>'La quattordicesima la decide l’INPS in base ai tuoi redditi: qui è solo una stima.',
  3:()=>'I contributi sono letti dalle tue buste paga: per i dati ufficiali controlla l’estratto conto contributivo INPS.',
  4:()=>'Il risparmio del fondo pensione è una stima senza detrazioni; il TFR conferito non si deduce.',
  5:()=>'Soldirini non calcola la pensione futura: usa il simulatore ufficiale INPS.'};
const avv=(k,y)=>`<p class="pnota">${esc(AVV[k](y))}</p>`;
SUB.pen='rie';

// ---------- mesi di pensione e importo del mese (per Riepilogo e Soldi rimanenti fino alla v24, D-040) ----------
function mesiPensione(p,y){const per=P.periodo(p,y);if(!per.mesi)return [];const ora=today().slice(0,7);const ult=+y<+ora.slice(0,4)?12:+y===+ora.slice(0,4)?+ora.slice(5):0;
  const out=[];for(let m=per.primoMese;m<=ult;m++)out.push(ymDi(y,m));return out;}
function nelPeriodo(p,ym){const per=P.periodo(p,+ym.slice(0,4));return per.mesi>0&&+ym.slice(5)>=per.primoMese;}
// netto del cedolino se c'è, altrimenti la stima (decisione 2 di 02, approvata il 16/11/2026)
function pensioneMese(ym){const p=profilo();const c=cedDi(ym);
  if(c&&n(c.netto)!=null)return {v:r2(z(c.netto)),stima:false,ced:c};
  if(!p||!nelPeriodo(p,ym))return {v:0,stima:false};
  const s=P.stimaMese(p,ym);return {v:s||0,stima:true};}
window.pensioneMese=pensioneMese;

// ================= pagina Pensione =================
let penAnno=+today().slice(0,4),aperte=new Set(),tabPrima='';
const sez=(id,tit,sum,corpo)=>`<details class="card fold pensez" data-sez="${id}"${aperte.has(id)?' open':''}><summary><span class="st">${tit}</span><span class="sum">${sum||''}</span></summary><div class="fbody">${corpo}</div></details>`;
const kv=(a,b,cls='')=>`<div class="kv ${cls}"><span>${a}</span><b>${b}</b></div>`;
function contribBuste(){return Object.values(D().buste||{}).filter(b=>b&&!b.deleted&&b.mese&&(b.lid?!D().lavori?.[b.lid]?.deleted:true));}

function secMia(p,y){const S=P.stimaAnno(p,y);const mesi=mesiPensione(p,y).reverse();
  const righe=mesi.map(ym=>{const c=cedDi(ym);const m=+ym.slice(5);
    if(c&&n(c.netto)!=null){const st=c.lettura?.manuale?'Scritto a mano':c.daControllare?.length?'Cedolino · <span class="dc">da controllare</span>':'Cedolino ✓';
      return `<button class="yr" data-cdm="${ym}"><b>${Mc(m).slice(0,3)}</b><span class="tx">Netto accreditato<small>${st}</small></span><span class="am">${eu(c.netto)}</span></button>`;}
    const s=P.stimaMese(p,ym);return `<button class="yr manca" data-cdm="${ym}"><b>${Mc(m).slice(0,3)}</b><span class="tx">Manca il cedolino<small>Stima ${eu(s)}</small></span><span class="am">—</span></button>`;}).join('');
  const ric=r2(cedolini().filter(c=>c.mese.startsWith(y+'-')).reduce((a,c)=>a+z(c.netto),0));
  const q=P.quattordicesima({anno:y,annoNascita:p.annoNascita,anniContributi:p.anniContributi,tipo:p.prima,reddito:S.reddito,dal:p.dal});
  const q14=q.importo>0?`Quattordicesima probabile: ${eu(q.importo)}, a ${q.mese===12?'dicembre':'luglio'}. La decide l’INPS.`:q.importo===null?'Quattordicesima probabile, ridotta in dodicesimi dal mese del tuo compleanno, a dicembre. La decide l’INPS.':'';
  const corpo=`${kv('Pensione lorda al mese',eu(p.lordoMese))}${kv(`Netto stimato al mese <span class="stima">stima</span>`,eu(S.nettoMese))}
    <p class="pnota">${S.add.esenti?'Con IRPEF zero le addizionali non sono dovute.':S.add.indicate?'Con le addizionali che hai indicato (trattenute a rate da gennaio e da marzo).':'Senza addizionali.'}${S.prudente?' Per l’anno del pensionamento la stima è prudente.':''}</p>
    ${S.acconto.importo>0?`<p class="pnota pacc">Acconto dell’addizionale comunale: ${eu(S.acconto.importo)} in 9 rate da marzo <span class="stima">stima</span><br>È il 30% dell’addizionale dell’anno prima, calcolato con le aliquote che hai scritto: il Comune usa quelle deliberate per l’anno prima.</p>`:''}
    ${righe||`<p class="muted sm">${S.mesi?'Nessun mese da mostrare in questo anno.':'In questo anno non eri ancora in pensione.'}</p>`}
    ${q14?`<p class="sm">${esc(q14)}</p>`:''}
    <div class="acts"><button class="btn sm" data-cdnew="1">+ Carica cedolino</button><button class="btn ghost sm" data-cdarch="1">Tutti i cedolini</button><button class="btn ghost sm" data-penedit="1">Modifica i dati</button></div>
    ${avv(1,y)}${q14?avv(2,y):''}`;
  return sez('mia','La mia pensione',ric?eu(ric):eu(S.nettoMese)+'/mese',corpo);}

function grafico(p,y){const V=[],St=[];for(let m=1;m<=12;m++){const ym=ymDi(y,m);const c=cedDi(ym);V.push(c&&n(c.netto)!=null?z(c.netto):null);St.push(nelPeriodo(p,ym)?P.stimaMese(p,ym):null);}
  const mx=Math.max(1,...V.filter(v=>v!=null),...St.filter(v=>v!=null))*1.08;
  const punti=St.map((v,i)=>v==null?null:`${((i+.5)/12*100).toFixed(2)},${(100-v/mx*100).toFixed(2)}`);
  // linea tratteggiata della stima, spezzata dove la stima non c'è
  const tratti=[];let t=[];for(const q of punti){if(q)t.push(q);else if(t.length){tratti.push(t);t=[];}}if(t.length)tratti.push(t);
  const linee=tratti.map(t=>t.length>1?`<polyline points="${t.join(' ')}" fill="none" stroke="var(--gold)" stroke-width="2" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/>`:`<circle cx="${t[0].split(',')[0]}" cy="${t[0].split(',')[1]}" r="1.2" fill="var(--gold)"/>`).join('');
  return `<div class="penleg"><span><i></i> netto ricevuto</span><span><i class="l"></i> stima</span></div>
    <div class="penbars" role="img" aria-label="Netto ricevuto mese per mese nel ${y}"><div class="pb">${V.map((v,i)=>`<span class="${v==null?'vuota':''}" style="height:${v==null?2:Math.max(2,Math.round(v/mx*100))}%" title="${esc(Mc(i+1))}: ${v==null?'manca il cedolino':eu(v)}"></span>`).join('')}</div>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${linee}</svg></div>
    <div class="pbl">${MESI.map(m=>`<span>${m[0].toUpperCase()}</span>`).join('')}</div>`;}
function secAnno(p,y){const S=P.stimaAnno(p,y);const C=cedolini().filter(c=>c.mese.startsWith(y+'-'));const R=P.confrontoAnno(C,S.netto,y);const T=R.totali;
  const attesi=mesiPensione(p,y);const mancano=attesi.filter(ym=>!cedDi(ym));
  let conf;
  if(S.mesi<12)conf=`${kv('Confronto con la stima','—','big')}<p class="pnota" style="margin-top:0">Il confronto si fa solo per gli anni interi di pensione.</p>`;
  else if(!R.completo){const nm=R.mancano.length;conf=`${kv('Confronto con la stima','<small class="muted">a fine anno</small>','big')}<p class="pnota" style="margin-top:0">Il confronto si fa con tutti i 12 cedolini: ${nm===1?'ne manca 1':'ne mancano '+nm}${nm<=3?' ('+R.mancano.map(ym=>MESI[+ym.slice(5)-1]).join(', ')+')':''}.</p>`;}
  else conf=`${kv('Stima dell’anno',eu(R.stima))}${kv('Ricevuto (senza 14ª e altre somme)',eu(R.ricevuto))}${kv('Differenza',(R.differenza>0?'+':'')+eu(R.differenza),'big')}
    ${R.avviso?'<p class="warn sm">Differenza da capire: controlla conguagli, detrazioni per familiari e addizionali.</p>':''}`;
  // una riga che spiega i mesi diversi, ricavata dai dati
  const sp=[];const ced=m=>cedDi(ymDi(y,m));
  if(ced(7)?.crediti?.some(x=>x.tipo==='14'))sp.push('Luglio più alto: quattordicesima.');
  if(ced(12))sp.push('Dicembre: tredicesima, niente addizionali.');
  if(C.some(c=>+c.mese.slice(5)<12&&(z(c.addReg)||z(c.addComSaldo)||z(c.addComAcconto))))sp.push('Da gennaio e da marzo partono le rate delle addizionali.');
  if(mancano.length&&mancano.length<=3)sp.push(mancano.map(ym=>Mc(+ym.slice(5))).join(', ')+': manca il cedolino.');
  const corpo=`${grafico(p,y)}
    ${kv('Lordo ricevuto',eu(T.lordo))}${kv('IRPEF',eu(T.irpef))}${kv('Addizionali',eu(T.addizionali))}${T.altre?kv('Altre trattenute',eu(T.altre)):''}${T.crediti?kv('Altre somme (13ª, 14ª…)',eu(T.crediti)):''}${kv('Netto ricevuto',eu(T.netto),'big')}
    ${mancano.length?`<p class="pnota" style="margin-top:0">Mancano ${mancano.length} ${mancano.length===1?'cedolino':'cedolini'} fino a ${MESI[+attesi[attesi.length-1].slice(5)-1]}.</p>`:''}
    ${conf}${sp.length?`<p class="pnota">${esc(sp.join(' '))}</p>`:''}${avv(1,y)}${avv(2,y)}`;
  return sez('anno','L’anno in breve',C.length?`${C.length} ${C.length===1?'cedolino':'cedolini'}`:'',corpo);}

function secContributi(){const B=contribBuste().map(b=>({mese:b.mese,imponibilePrev:b.imponibilePrev,contribLav:b.contribLav}));
  const anni=[...new Set(B.map(b=>b.mese.slice(0,4)))].sort().reverse();
  const righe=anni.map(y=>{const C=P.contributiAnno(B,y);
    const sotto=C.conContributi?`Imponibile ${eu(C.imponibile)} · ${C.mancano?`${C.buste} ${C.buste===1?'busta':'buste'}, ne ${C.mancano===1?'manca 1':'mancano '+C.mancano}`:`${C.settimane} settimane stimate`}`:'Contributi non ancora scritti nelle buste';
    return `<div class="yr"><b>${y}</b><span class="tx">Contributi a tuo carico<small>${sotto}</small>${C.sopraMassimale?'<small>Oltre il massimale contributivo dell’anno: conta solo per chi ha iniziato a versare dopo il 1995.</small>':''}</span><span class="am">${C.conContributi?eu(C.contributi):'—'}</span></div>`;}).join('');
  const Cy=P.contributiAnno(B,penAnno);
  const corpo=`${righe||'<p class="muted sm">Ancora nessuna busta paga. Caricale dal riepilogo del lavoro: i contributi si leggono da lì.</p>'}
    <p class="pnota">Le settimane sono una stima (servono almeno ${eu(P.valori(penAnno).sogliaSett)} di imponibile a settimana).</p>${avv(3,penAnno)}`;
  return sez('contributi','Contributi versati',Cy.conContributi?eu(Cy.contributi):'',corpo);}

function secFondo(y){const f=fondoDi(y);let corpo,sum='';
  if(f){const F=P.fondo({anno:y,...f});sum=`${eu(F.deducibile)} / ${eu(F.limite)}`;
    corpo=`${f.nome?`<p class="sm" style="margin-top:0"><b>${esc(f.nome)}</b></p>`:''}${kv('Versati da te',eu(f.propri))}${kv('Versati dal datore',eu(f.datore))}${z(f.tfr)?kv('TFR mandato al fondo <small class="muted">non si deduce</small>',eu(f.tfr)):''}
      ${kv('Deducibile',`${eu(F.deducibile)} <small class="muted">su ${eu(F.limite)}</small>`,'big')}
      ${F.oltre?`<p class="warn sm">${eu(F.oltre)} oltre il limite: non si deducono. Comunicalo al tuo fondo.</p>`:''}
      ${F.risparmio!=null?kv('Risparmio stimato <span class="stima">stima</span>',eu(F.risparmio)):'<p class="muted sm">Scrivi il reddito dell’anno per stimare il risparmio.</p>'}`;}
  else corpo=`<p class="muted sm" style="margin-top:0">Nessun versamento indicato per il ${y}.</p>`;
  corpo+=`<div class="acts"><button class="btn sm" data-fpedit="${y}">${f?'Modifica versamenti '+y:'+ Versamenti '+y}</button></div>${avv(4,y)}`;
  return sez('fondo','Fondo pensione',sum,corpo);}

function secFutura(){return sez('futura','Pensione futura','',`${avv(5,penAnno)}
  <div class="acts"><a class="btn sm" href="${MAI.FUTURA}" target="_blank" rel="noopener">Simula la tua pensione su INPS ↗</a></div>
  <p class="muted sm">Serve l’accesso con SPID, CIE o CNS.</p>
  <p class="sm"><a href="${MAI.PENSAMI}" target="_blank" rel="noopener">PensAMi: quando potrai andare in pensione ↗</a></p>`);}

function renderPensione(){
  if(tabPrima!=='pen')aperte=new Set(); // le sezioni partono chiuse a ogni apertura della pagina
  const y=penAnno;$('penTitle').textContent='Pensione '+y;const p=profilo();
  const conBuste=lavori().length>0||contribBuste().some(b=>n(b.contribLav)!=null);const conProg=progetti().length>0;
  const fondoUsato=Object.values(FON()).some(f=>f&&!f.deleted);
  const S=[];
  if(p){S.push(secMia(p,y),secAnno(p,y));}
  if(conBuste)S.push(secContributi());
  if(fondoUsato||(!p&&(conBuste||conProg)))S.push(secFondo(y));
  if(!p&&(conBuste||conProg||fondoUsato))S.push(secFutura());
  $('penBody').innerHTML=S.length?S.join(''):`<div class="card pempty"><p>Qui vedi i contributi letti dalle buste paga, il fondo pensione e, se sei in pensione, quanto ti arriva ogni mese.</p>
    <div class="acts"><button class="btn" data-penedit="1">Sono in pensione</button><button class="btn ghost" data-fpedit="${y}">Ho un fondo pensione</button><button class="btn ghost" data-pengo="lav">Ho buste paga da caricare</button></div></div>`;
}
const _renderPen=render;
render=function(){_renderPen();if(tab==='pen')renderPensione();tabPrima=tab;};

// ================= Riepilogo: riga "Pensione · mese" =================
const _renderRiePen=renderRiepilogo;
renderRiepilogo=function(){_renderRiePen();const p=profilo();let box=$('riePen');
  if(!box){box=document.createElement('div');box.id='riePen';box.className='cards';($('rieLav')||$('rieTot')).after(box);}
  if($('rieLav')&&box.previousElementSibling!==$('rieLav'))$('rieLav').after(box);
  const anno=rieMode==='anno',y=cur.slice(0,4);
  const ced=cedolini().some(c=>c.mese.startsWith(anno?y+'-':cur));
  if(!p&&!ced){box.innerHTML='';return;}
  if(anno){let tot=0,stima=false;const righe=[];
    for(let m=1;m<=12;m++){const ym=ymDi(y,m);const x=pensioneMese(ym);if(!x.v)continue;tot+=x.v;stima=stima||x.stima;
      righe.push(kv(Mc(m),`${eu(x.v)}${x.stima?' <span class="stima">stima</span>':''}`));}
    box.innerHTML=`<div class="card pencard" data-fid="pen" data-sum="${eu(tot)}"><h3>🏛️ Pensione ${y}</h3>${righe.join('')||'<p class="muted">Niente in questo anno.</p>'}${kv('Totale'+(stima?' (con stime)':''),eu(tot),'big')}
      <div class="acts"><button class="btn ghost sm" data-pengo="pagina">Pagina Pensione</button></div></div>`;}
  else{const x=pensioneMese(cur);const m=+cur.slice(5);if(!x.v&&!x.ced){box.innerHTML='';return;}
    const c=x.ced;let corpo;
    if(c)corpo=`${kv('Lordo del pagamento',eu(n(c.lordoPagamento)??P.lordoPagamento(c)))}${P.trattenuteTot(c)?kv('Trattenute','− '+eu(P.trattenuteTot(c))):''}${kv('Netto accreditato',eu(c.netto),'big')}`;
    else corpo=`${kv('Pensione lorda',eu(p.lordoMese))}${kv('Netto stimato <span class="stima">stima</span>',eu(x.v),'big')}<p class="muted sm">Quando arriva il cedolino, caricalo: conta il netto vero.</p>`;
    let extra='';if(p){const S=P.stimaAnno(p,+y);const q=P.quattordicesima({anno:+y,annoNascita:p.annoNascita,anniContributi:p.anniContributi,tipo:p.prima,reddito:S.reddito,dal:p.dal});
      if(m===12)extra+='<p class="muted sm">A dicembre arriva anche la tredicesima.</p>';
      if(q.importo>0&&q.mese===m)extra+=`<p class="muted sm">Quattordicesima probabile: ${eu(q.importo)}. La decide l’INPS.</p>`;}
    box.innerHTML=`<div class="card pencard" data-fid="pen" data-sum="${eu(x.v)}${x.stima?' · stima':''}"><h3>🏛️ Pensione · ${MESI[m-1]}${x.stima?' <span class="stima">stima</span>':''}</h3>${corpo}${extra}
      <div class="acts">${c?`<button class="btn ghost sm" data-cdm="${cur}">Apri il cedolino</button>`:`<button class="btn sm" data-cdm="${cur}">Carica il cedolino</button>`}<button class="btn ghost sm" data-pengo="pagina">Pagina Pensione</button></div></div>`;}
  foldify(box,'pen');
};

// ================= Impostazioni: "La mia pensione" =================
function renderPenImp(){const p=profilo();
  $('foldPenSum').textContent=p?eu(P.stimaAnno(p,+today().slice(0,4)).nettoMese)+'/mese':'';
  $('penImp').innerHTML=p?`<button class="card prow" data-penedit="1" style="--c:var(--pen)"><i></i><span><b>La mia pensione</b><small>lorda ${eu(p.lordoMese)} al mese${p.dal?' · dal '+esc(monthName(p.dal)):''}</small></span><span class="chev">›</span></button>`
    :'<p class="muted sm">Se sei in pensione, scrivi qui la tua pensione: Soldirini stima il netto e tiene i cedolini di ogni mese.</p><div class="acts"><button class="btn sm" data-penedit="1">Sono in pensione</button></div>';}
const _renderProgPen=renderProgetti;
renderProgetti=function(){_renderProgPen();renderPenImp();};

// ---------- finestre ----------
const MOD=['penModal','fpModal','cdModal','cdArch'];
function apri(id){$(id).hidden=false;document.body.classList.add('noscroll');}
function chiudi(id){$(id).hidden=true;if([...document.querySelectorAll('.modal')].every(x=>x.hidden))document.body.classList.remove('noscroll');}

// ---------- finestra "La mia pensione" ----------
const PFX={penLordo:'lordoMese',penDal:'dal',penNascita:'annoNascita',penAnni:'anniContributi',penAltri:'altriRedditi',penAddReg:'addReg',penAddCom:'addCom',penSoglia:'sogliaCom'};
function leggiProfilo(){const o={};for(const [id,k] of Object.entries(PFX))o[k]=$(id).value.trim();
  o.prima=document.querySelector('[name=penPrima]:checked')?.value||'dipendente';
  o.detrazione=$('penDetrBox').hidden?'':(document.querySelector('[name=penDetr]:checked')?.value||'pensione');return o;}
// anno del pensionamento con anche uno stipendio: la pensione inizia dopo gennaio e c'è un lavoro attivo prima di quella data
function ancheLavoro(dal){if(!/^\d{4}-\d{2}$/.test(dal||'')||+dal.slice(5)===1)return false;
  return lavori().some(l=>(l.dal||'0000')<=dal+'-31'&&(!l.al||l.al.slice(0,4)>=dal.slice(0,4)));}
function aggiornaProfilo(){const o=leggiProfilo();$('penDetrBox').hidden=!ancheLavoro(o.dal);if(!$('penDetrBox').hidden)o.detrazione=document.querySelector('[name=penDetr]:checked')?.value||'pensione';
  const reg=n(o.addReg),com=n(o.addCom);$('penAddSum').textContent=reg==null&&com==null?'non indicate':[reg!=null?'reg. '+nf(reg)+'%':'',com!=null?'com. '+nf(com)+'%':''].filter(Boolean).join(' · ');
  if(!(n(o.lordoMese)>0)){$('penLive').innerHTML='Scrivi la pensione lorda al mese per vedere il netto stimato.';return;}
  const y=o.dal&&+o.dal.slice(0,4)>+today().slice(0,4)?+o.dal.slice(0,4):+today().slice(0,4);const S=P.stimaAnno(o,y);
  $('penLive').innerHTML=`Netto stimato al mese <b>${eu(S.nettoMese)}</b><br><small>${S.add.esenti?'addizionali non dovute (IRPEF zero)':S.add.indicate?'con addizionali':'senza addizionali'} · stima con le regole ${S.regole}${S.prudente?' · stima prudente per l’anno del pensionamento':''}</small>`;}
function apriProfilo(){const p=PEN().profilo&&!PEN().profilo.deleted?PEN().profilo:{};
  for(const [id,k] of Object.entries(PFX))$(id).value=p[k]??'';
  document.querySelectorAll('[name=penPrima]').forEach(r=>r.checked=r.value===(p.prima||'dipendente'));
  document.querySelectorAll('[name=penDetr]').forEach(r=>r.checked=r.value===(p.detrazione||'pensione'));
  $('penAddBox').open=false;$('penDel').hidden=!profilo();for(const e of ['penLordoErr','penNascitaErr'])$(e).hidden=true;
  aggiornaProfilo();apri('penModal');}
function erroreCampo(id,msg){$(id+'Err').textContent=msg;$(id+'Err').hidden=!msg;$(id).setAttribute('aria-invalid',msg?'true':'false');if(msg)$(id).focus();return !!msg;}
function salvaProfilo(){const o=leggiProfilo();const anno=+today().slice(0,4);
  const e1=erroreCampo('penLordo',n(o.lordoMese)>0?'':'Scrivi la pensione lorda al mese.');
  const an=n(o.annoNascita);const e2=!e1&&erroreCampo('penNascita',o.annoNascita===''||(Number.isInteger(an)&&an>=1900&&an<=anno)?'':'Scrivi l’anno di nascita con quattro cifre (es. 1956).');
  if(e1||e2)return;
  PEN().profilo=Object.assign({},o,{deleted:false,updatedAt:Date.now()});changed();chiudi('penModal');render();toast('Dati della pensione salvati.');}
async function togliProfilo(){if(!await conferma('Togliere i dati della pensione? I cedolini già salvati restano.','Togli','danger'))return;
  PEN().profilo={deleted:true,updatedAt:Date.now()};changed();chiudi('penModal');render();}

// ---------- finestra "Fondo pensione · anno" ----------
let fpAnno=null;const FPX={fpNome:'nome',fpPropri:'propri',fpDatore:'datore',fpTfr:'tfr',fpReddito:'reddito'};
function redditoProposto(y){const B=contribBuste().filter(b=>b.mese.startsWith(y+'-')&&n(b.lordo)!=null);return B.length?r2(B.reduce((a,b)=>a+z(b.lordo),0)):null;}
function aggiornaFondo(){const o={anno:fpAnno};for(const [id,k] of Object.entries(FPX))o[k]=$(id).value.trim();const F=P.fondo(o);
  $('fpLive').innerHTML=`Deducibile <b>${eu(F.deducibile)}</b> su ${eu(F.limite)}${F.risparmio!=null?` · Risparmio stimato <b>${eu(F.risparmio)}</b> <span class="stima">stima</span>`:''}
    ${F.oltre?`<p class="warn sm">${eu(F.oltre)} oltre il limite: non si deducono. Comunicalo al tuo fondo.</p>`:''}`;}
function apriFondo(y){fpAnno=+y;const f=fondoDi(y)||{};$('fpTit').textContent='Fondo pensione · '+y;
  for(const [id,k] of Object.entries(FPX))$(id).value=f[k]??'';
  const prop=f.reddito==null||f.reddito===''?redditoProposto(y):null;if(prop!=null)$('fpReddito').value=prop;$('fpRedDc').hidden=prop==null;
  $('fpDel').hidden=!fondoDi(y);aggiornaFondo();apri('fpModal');}
function salvaFondo(){const o={};for(const [id,k] of Object.entries(FPX))o[k]=$(id).value.trim();
  if(!['propri','datore','tfr'].some(k=>n(o[k])>0)){toast('Scrivi almeno un versamento.','err');$('fpPropri').focus();return;}
  FON()[fpAnno]=Object.assign({anno:String(fpAnno)},o,{deleted:false,updatedAt:Date.now()});changed();chiudi('fpModal');render();toast('Fondo pensione salvato.');}
async function togliFondo(){if(!await conferma(`Togliere i versamenti del ${fpAnno}?`,'Togli','danger'))return;FON()[fpAnno]={deleted:true,updatedAt:Date.now()};changed();chiudi('fpModal');render();}

// ================= cedolino =================
const CAMPI=['pensioneLorda','lordoPagamento','irpef','addReg','addComSaldo','addComAcconto','conguagliDebito','altreTrattenute','netto'];
const TIPI_CR=[['13','Tredicesima'],['14','Quattordicesima'],['aggiuntivo','Importo aggiuntivo'],['arretrati','Arretrati'],['rimborso','Rimborso IRPEF'],['altro','Altra somma']];
let cd=null;
function renderCrediti(){$('cdCrediti').innerHTML=cd.crediti.map((c,i)=>`<div class="cdcr" data-i="${i}"><label>Voce<select data-k="tipo">${TIPI_CR.map(([v,t])=>`<option value="${v}"${c.tipo===v?' selected':''}>${t}</option>`).join('')}</select></label>
  <label>Importo<input data-k="importo" inputmode="decimal" value="${esc(c.importo??'')}"></label><button type="button" class="x" data-crrm="${i}" aria-label="Togli la voce">×</button><div class="cdmsg s3" data-msg="crediti.${i}"></div></div>`).join('');
  $('cdLordoBox').hidden=!cd.crediti.length;}
function leggiCrediti(){document.querySelectorAll('#cdCrediti .cdcr').forEach(r=>{const c=cd.crediti[+r.dataset.i];c.tipo=r.querySelector('[data-k=tipo]').value;c.importo=r.querySelector('[data-k=importo]').value.trim().replace(',','.');c.descr=TIPI_CR.find(t=>t[0]===c.tipo)[1];});}
function leggiCed(){leggiCrediti();const c={mese:$('cdMese').value,dataAccredito:$('cd-dataAccredito').value,crediti:cd.crediti.filter(x=>x.importo!==''&&x.importo!=null).map(x=>({tipo:x.tipo,descr:x.descr,importo:x.importo}))};
  for(const k of CAMPI)c[k]=$('cd-'+k).value.trim().replace(',','.');if(!c.crediti.length)c.lordoPagamento='';c.altreNota=$('cd-altreNota').value.trim();return c;}
function messaggiCed(){const c=leggiCed();document.querySelectorAll('#cdModal .cdmsg').forEach(e=>e.innerHTML='');
  for(const k of CAMPI.concat(['crediti']))document.querySelectorAll(`#cdModal [data-cdc="${k}"]`).forEach(e=>e.hidden=!cd.dc.includes(k));
  const L=c.mese?P.controlliCedolino(c,{precedente:cedDi(mesePrima(c.mese))}):[];
  for(const x of L){const box=document.querySelector(`#cdModal [data-msg="${x.campo}"]`);if(box){box.insertAdjacentHTML('beforeend',`<p class="sm ${x.tipo==='avviso'?'warn':'k-'+x.tipo}">${x.tipo==='avviso'?'⚠ ':''}${esc(x.testo)}</p>`);
    if(x.tipo!=='nota'){const d=box.closest('details');if(d)d.open=true;}}} // la sezione con un avviso o un errore si apre da sola
  const tr=P.trattenuteTot(c);$('cdTrSum').textContent=tr?'− '+eu(tr):'';$('cdAltreSum').textContent=c.crediti.length?'+ '+eu(c.crediti.reduce((a,x)=>a+z(x.importo),0)):'';
  if(!$('cdLordoBox').hidden)$('cd-lordoPagamento').placeholder=eu(P.lordoPagamento(c));
  return L;}
function apriCedolino(ym,esistente){const c=esistente?cedDi(ym):null;cd={key:c?ym:null,file:null,dc:[...(c?.daControllare||[])],crediti:clone(c?.crediti||[]),letti:null};
  $('cdTit').textContent=c?'Cedolino · '+monthName(ym):'Cedolino';$('cdStep1').hidden=!!c;$('cdStep2').hidden=!c;$('cdProg').hidden=true;$('cdErr').hidden=true;$('cdRis').hidden=true;$('cdDel').hidden=!c;
  $('cdMese').value=ym||cur;$('cd-dataAccredito').value=c?.dataAccredito||'';for(const k of CAMPI)$('cd-'+k).value=c?.[k]??'';$('cd-altreNota').value=c?.altreNota||'';
  $('cdNote').textContent='';chiudiSezioni($('cdModal')); // v23: chiuse all'apertura; si apre da sola la sezione con un avviso
  renderCrediti();messaggiCed();apri('cdModal');}
function manuale(){$('cdStep1').hidden=true;$('cdStep2').hidden=false;$('cdNote').textContent='Bastano mese, pensione lorda e netto accreditato; il resto è facoltativo. Senza file il cedolino resta solo nell’app.';$('cd-pensioneLorda').focus();}
const valoriLetti=r=>{const o={};for(const k of CAMPI)o[k]=r[k]==null?'':String(r[k]);o.crediti=(r.crediti||[]).map(x=>({tipo:x.tipo,descr:x.descr,importo:String(x.importo)}));if(r.dataAccredito)o.dataAccredito=r.dataAccredito;
  o.daControllare=CAMPI.filter(k=>r[k]!=null);return o;};
async function leggiCedolino(file){cd.file=file;$('cdStep1').hidden=true;$('cdProg').hidden=false;$('cdErr').hidden=true;
  const prog=(p,t)=>{$('cdBar').style.width=Math.round(p*100)+'%';if(t)$('cdFase').textContent=t;};
  let r={crediti:[]};try{const pezzi=await Buste.testoBusta(file,prog);prog(.95,'Cerco le voci…');r=Buste.analizzaCedolino(pezzi);}
  catch(e){$('cdErr').textContent='Non sono riuscito a leggerlo ('+errMsg(e)+'): scrivi tu i valori, lo archivio lo stesso.';$('cdErr').hidden=false;}
  $('cdProg').hidden=true;$('cdStep2').hidden=false;if(r.mese)$('cdMese').value=r.mese;if(r.dataAccredito)$('cd-dataAccredito').value=r.dataAccredito;
  const v=valoriLetti(r);for(const k of CAMPI){$('cd-'+k).value=v[k];$('cd-'+k).classList.toggle('manca',v[k]===''&&['pensioneLorda','netto'].includes(k));}
  cd.crediti=v.crediti;cd.dc=v.daControllare;cd.letti=true;renderCrediti();
  const ok=['mese','pensioneLorda','netto'].filter(k=>k==='mese'?r.mese:r[k]!=null);
  $('cdNote').innerHTML=`<b>${ok.length?'Cedolino letto':'Non ho trovato le voci'}</b><br>${['mese','pensioneLorda','netto'].map(k=>`${ok.includes(k)?'✓':'✗'} ${k==='pensioneLorda'?'pensione lorda':k==='netto'?'netto':'mese'}`).join(' · ')}<br>Controlla i valori “da controllare” e salva.`;
  messaggiCed();}
async function salvaCedolino(){const c=leggiCed();
  if(!/^\d{4}-\d{2}$/.test(c.mese)){toast('Indica il mese del cedolino.','err');$('cdMese').focus();return;}
  if(!(n(c.pensioneLorda)>0)){toast('Scrivi la pensione lorda.','err');$('cd-pensioneLorda').focus();return;}
  if(n(c.netto)==null){toast('Scrivi il netto accreditato.','err');$('cd-netto').focus();return;}
  const L=messaggiCed();if(L.some(x=>x.tipo==='errore')){toast('Il netto non può essere più alto del lordo: controlla il valore.','err');$('cd-netto').focus();return;}
  if(cedDi(c.mese)&&c.mese!==cd.key&&!await ask(`Hai già il cedolino di ${MESI[+c.mese.slice(5)-1]}. Lo sostituisco con questo?`,[{t:'Annulla',v:false,cls:'ghost'},{t:'Sostituisci',v:true}]))return;
  if(cd.key&&cd.key!==c.mese){const o=CED()[cd.key];if(o){o.deleted=true;o.updatedAt=Date.now();}}
  const vecchio=cd.key?CED()[cd.key]:null;
  const x=Object.assign({},vecchio&&!vecchio.deleted?{file:vecchio.file,nomeFile:vecchio.nomeFile,daCaricare:vecchio.daCaricare,lettura:vecchio.lettura}:{},c,{deleted:false,updatedAt:Date.now()});
  delete x.daControllare; // salvando dalla finestra l'utente ha visto i valori
  if(cd.file){await soldiriniFile.fset('ced|'+c.mese,{nome:cd.file.name,tipo:cd.file.type||'application/pdf',blob:cd.file});x.daCaricare=true;x.nomeFile=cd.file.name;x.lettura={auto:true};if(cd.key&&cd.key!==c.mese)x.file=null;}
  else if(!cd.key)x.lettura={manuale:true};
  CED()[c.mese]=x;changed();chiudi('cdModal');render();if(!$('cdArch').hidden)renderArchivio();
  if(x.daCaricare&&DB.meta.account&&navigator.onLine){busy(true,'Salvo il cedolino su Drive…');try{await caricaSuDrive(c.mese);toast('Cedolino salvato e archiviato su Drive.');}catch(e){toast('Cedolino salvato nell’app. Su Drive lo carico appena possibile ('+errMsg(e)+').','err');}finally{busy(false);render();}}
  else toast(x.daCaricare?'Cedolino salvato. Lo carico su Drive appena ti colleghi.':'Cedolino salvato.');}
async function togliCedolino(){const c=CED()[cd.key];if(!c)return;if(!await conferma(`Togliere il cedolino di ${monthName(cd.key)} dall’app? Il file su Drive resta.`,'Togli','danger'))return;
  c.deleted=true;c.updatedAt=Date.now();await soldiriniFile.fset('ced|'+cd.key,undefined);changed();chiudi('cdModal');render();if(!$('cdArch').hidden)renderArchivio();}
// più cedolini insieme, come per le buste: il mese si legge dal cedolino; se manca lo chiedo
let senzaMese=[];
async function leggiMolti(files){$('cdStep1').hidden=true;$('cdStep2').hidden=true;$('cdProg').hidden=false;$('cdErr').hidden=true;$('cdRis').hidden=true;senzaMese=[];const righe=[];
  for(let i=0;i<files.length;i++){const f=files[i];const prog=(p,t)=>{$('cdBar').style.width=Math.round((i+p)/files.length*100)+'%';$('cdFase').textContent=`Cedolino ${i+1} di ${files.length} · ${t||''}`;};
    let r=null,err=null;try{r=Buste.analizzaCedolino(await Buste.testoBusta(f,prog));}catch(e){err=errMsg(e);}
    if(r&&r.mese){const vecchio=cedDi(r.mese);CED()[r.mese]=Object.assign({mese:r.mese},valoriLetti(r),{nomeFile:f.name,daCaricare:true,deleted:false,lettura:{auto:true},updatedAt:Date.now()});
      await soldiriniFile.fset('ced|'+r.mese,{nome:f.name,tipo:f.type||'application/pdf',blob:f});
      righe.push(`<div class="bai"><span class="tx"><b>${esc(f.name)}</b><small>${esc(monthName(r.mese))}${r.netto!=null?' · netto '+eu(r.netto):''}${vecchio?' · sostituisce quello già presente':''}</small></span><small class="dc">da controllare</small></div>`);}
    else{senzaMese.push({f,v:valoriLetti(r||{})});const j=senzaMese.length-1;
      righe.push(`<div class="bai"><span class="tx"><b>${esc(f.name)}</b><small>${err?'Non sono riuscito a leggerlo ('+esc(err)+')':'Non trovo il mese'}</small><span class="row"><input type="month" id="cdFixM${j}" aria-label="Mese del cedolino"><button class="btn sm" data-cdfix="${j}">Salva</button></span></span><small class="bdg warn">⚠ indica il mese</small></div>`);}}
  changed();render();$('cdProg').hidden=true;$('cdRis').hidden=false;const ok=righe.length-senzaMese.length;
  $('cdRis').innerHTML=`<p><b>${ok} ${ok===1?'cedolino salvato':'cedolini salvati'} su ${files.length}.</b> ${senzaMese.length?'Per quelli senza mese scegli il mese e tocca Salva.':''} Controlla i valori dall’elenco dei mesi (pagina Pensione).</p>${righe.join('')}<div class="foot"><button class="btn" id="cdFine">Fatto</button></div>`;
  if(DB.meta.account&&navigator.onLine)caricaPendenti(true).catch(()=>{});}
async function salvaSenzaMese(j){const x=senzaMese[j];const m=$('cdFixM'+j).value;if(!x||!/^\d{4}-\d{2}$/.test(m)){toast('Scegli il mese.','err');return;}
  CED()[m]=Object.assign({mese:m},x.v,{nomeFile:x.f.name,daCaricare:true,deleted:false,lettura:{auto:true},updatedAt:Date.now()});
  await soldiriniFile.fset('ced|'+m,{nome:x.f.name,tipo:x.f.type||'application/pdf',blob:x.f});changed();render();
  const b=document.querySelector(`[data-cdfix="${j}"]`);b.closest('.bai').querySelector('.bdg').outerHTML='<small class="dc">da controllare</small>';b.parentElement.remove();
  if(DB.meta.account&&navigator.onLine)caricaPendenti(true).catch(()=>{});}

// ---------- archivio dei cedolini e Drive: Soldirini / Pensione / <anno> ----------
function renderArchivio(){const C=cedolini().slice().reverse();const anni=[...new Set(C.map(c=>c.mese.slice(0,4)))];const pend=C.filter(c=>c.daCaricare).length;const dr=PEN().drive;
  $('caBody').innerHTML=`<div class="acts"><button class="btn sm" data-cdnew="1">+ Carica cedolino</button><button class="btn ghost sm" id="caTutti">Salva tutto su Drive${pend?` (${pend})`:''}</button>${dr?.cartella?.link?`<a class="btn ghost sm" href="${esc(dr.cartella.link)}" target="_blank" rel="noopener">Cartella su Drive ↗</a>`:''}</div>`+
    (anni.map(y=>`<h3 class="bay">${y}</h3>`+C.filter(c=>c.mese.startsWith(y)).map(c=>`<div class="bai"><span class="tx"><b>${Mc(+c.mese.slice(5))}</b><small>netto ${eu(c.netto)} · lordo ${eu(c.pensioneLorda)}${c.daCaricare?' · ⏳ da caricare su Drive':c.file?' · su Drive':' · senza file'}</small>${c.lettura?.manuale?'<small class="bdg">✍️ scritto a mano</small>':''}${c.daControllare?.length?' <small class="dc">da controllare</small>':''}</span>
      ${c.file?.link?`<a class="btn ghost sm" href="${esc(c.file.link)}" target="_blank" rel="noopener">Apri</a>`:''}<button class="btn ghost sm" data-cdm="${c.mese}">Modifica</button></div>`).join('')).join('')||'<p class="muted" style="margin-top:12px">Ancora nessun cedolino.</p>');}
function apriArchivio(){renderArchivio();apri('cdArch');}
async function cartellaPensione(anno){const x=PEN();const dr=Object.assign({},x.drive&&!x.drive.deleted?x.drive:{});
  if(!(dr.cartella?.id&&await exists(dr.cartella.id))){const root=D().root?.id;if(!root)throw new Error('Manca la cartella Soldirini su Drive.');const f=await createFolder('Pensione',root,{soldirini:'pensione'});dr.cartella={id:f.id,link:f.webViewLink};dr.anni={};}
  dr.anni=dr.anni||{};if(!(dr.anni[anno]&&await exists(dr.anni[anno]))){const f=await createFolder(String(anno),dr.cartella.id,{soldirini:'pensione-anno'});dr.anni[anno]=f.id;}
  dr.updatedAt=Date.now();x.drive=dr;return dr.anni[anno];}
async function caricaSuDrive(ym){const c=CED()[ym];const f=await soldiriniFile.fget('ced|'+ym);if(!c||c.deleted||!f)return false;const anno=ym.slice(0,4);const parent=await cartellaPensione(anno);
  const est=(f.nome.match(/\.([a-z0-9]{2,4})$/i)||[,'pdf'])[1].toLowerCase();const name=`Cedolino pensione ${MESI[+ym.slice(5)-1]} ${anno}.${est}`;
  let r;if(c.file?.id&&await exists(c.file.id))r=await uploadUpdate(c.file.id,{name},f.blob,f.tipo||'application/pdf');else r=await uploadNew({name,parents:[parent]},f.blob,f.tipo||'application/pdf');
  c.file={id:r.id,link:r.webViewLink,name};c.daCaricare=false;c.updatedAt=Date.now();await soldiriniFile.fset('ced|'+ym,undefined);changed();return true;}
async function caricaPendenti(silenzioso){const keys=Object.keys(CED()).filter(k=>CED()[k]?.daCaricare&&!CED()[k].deleted);
  if(!keys.length){if(!silenzioso)toast('Tutti i cedolini sono già su Drive.');return 0;}
  if(!DB.meta.account||!navigator.onLine){if(!silenzioso)toast('Serve la connessione e l’accesso con Google.','err');return 0;}
  let k=0;if(!silenzioso)busy(true,'Salvo i cedolini su Drive…');
  try{for(const ym of keys){try{if(await caricaSuDrive(ym))k++;}catch(e){if(!silenzioso)throw e;console.warn(e);}}}catch(e){toast(errMsg(e),'err');}finally{if(!silenzioso)busy(false);}
  if(k&&!silenzioso)toast(k===1?'1 cedolino salvato su Drive.':`${k} cedolini salvati su Drive.`);if(k){render();if(!$('cdArch').hidden)renderArchivio();}return k;}
const _processQueuePen=processQueue;
processQueue=async function(){const r=await _processQueuePen();await codaPasso('cedolini',()=>caricaPendenti(true));return r;};

// ---------- collegamenti ----------
function vaiPensione(sezione){for(const id of MOD.concat(['bpArch']))if($(id)&&!$(id).hidden)chiudi(id);
  if(tab!=='pen')vaiA('pen');if(sezione){aperte.add(sezione);renderPensione();document.querySelector(`[data-sez="${sezione}"]`)?.scrollIntoView({block:'start'});}}
function bind(){
  document.addEventListener('click',e=>{const t=e.target.closest('[data-penedit],[data-fpedit],[data-cdnew],[data-cdm],[data-cdarch],[data-pengo],[data-penapri],#caTutti,#cdFine,[data-cdfix],[data-crrm]');if(!t)return;
    if(t.dataset.penapri){e.preventDefault();vaiPensione(t.dataset.penapri);return;}
    if(t.dataset.penedit){apriProfilo();return;}
    if(t.dataset.fpedit){apriFondo(t.dataset.fpedit);return;}
    if(t.dataset.cdnew){apriCedolino(cur,false);return;}
    if(t.dataset.cdm){apriCedolino(t.dataset.cdm,!!cedDi(t.dataset.cdm));return;}
    if(t.dataset.cdarch){apriArchivio();return;}
    if(t.dataset.pengo==='pagina'){vaiA('pen');return;}
    if(t.dataset.pengo==='lav'){vaiA('pro');const f=$('foldLav');if(f){f.open=true;f.scrollIntoView({block:'start'});}return;}
    if(t.id==='caTutti'){caricaPendenti(false);return;}
    if(t.id==='cdFine'){chiudi('cdModal');return;}
    if(t.dataset.cdfix){salvaSenzaMese(+t.dataset.cdfix);return;}
    if(t.dataset.crrm!=null){leggiCrediti();cd.crediti.splice(+t.dataset.crrm,1);renderCrediti();messaggiCed();}});
  $('penBody').addEventListener('toggle',e=>{const d=e.target;if(d.dataset?.sez){if(d.open)aperte.add(d.dataset.sez);else aperte.delete(d.dataset.sez);}},true);
  $('penPrev').onclick=()=>{penAnno--;render();};$('penNext').onclick=()=>{penAnno++;render();};
  $('penClose').onclick=()=>chiudi('penModal');$('penSave').onclick=salvaProfilo;$('penDel').onclick=togliProfilo;
  $('penModal').addEventListener('input',aggiornaProfilo);$('penModal').addEventListener('change',aggiornaProfilo);
  $('fpClose').onclick=()=>chiudi('fpModal');$('fpSave').onclick=salvaFondo;$('fpDel').onclick=togliFondo;
  $('fpModal').addEventListener('input',e=>{if(e.target.id==='fpReddito')$('fpRedDc').hidden=true;aggiornaFondo();});
  $('cdClose').onclick=()=>chiudi('cdModal');$('cdSave').onclick=salvaCedolino;$('cdDel').onclick=togliCedolino;$('cdManuale').onclick=manuale;
  $('cdFile').onchange=e=>{const F=[...e.target.files];e.target.value='';if(F.length>1)leggiMolti(F);else if(F[0])leggiCedolino(F[0]);};
  $('cdCredAdd').onclick=()=>{leggiCrediti();cd.crediti.push({tipo:+$('cdMese').value.slice(5)===12?'13':'14',importo:''});renderCrediti();messaggiCed();$('cdCrediti').querySelector('.cdcr:last-child [data-k=importo]')?.focus();};
  $('cdModal').addEventListener('input',e=>{const k=(e.target.id||'').replace(/^cd-/,'');if(cd&&cd.dc.includes(k))cd.dc=cd.dc.filter(x=>x!==k);if(cd)messaggiCed();});
  $('cdModal').addEventListener('change',()=>{if(cd)messaggiCed();});
  $('caClose').onclick=()=>chiudi('cdArch');
  for(const id of MOD)$(id).addEventListener('click',e=>{if(e.target.id===id)chiudi(id);});
}
bind();
window.Pensione={renderPensione,apriProfilo,apriFondo,apriCedolino,apriArchivio,caricaPendenti,profilo};
})();
