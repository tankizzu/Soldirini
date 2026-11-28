'use strict';
// ================= Soldirini 24c.13 · Entrate extra (D-074, D-078) ed "Entrate da confermare" (D-165) =================
// Dati (sincronizzati: mergeData li unisce voce per voce per updatedAt; le voci tolte restano con deleted:true, D-105, D-164):
//   entrateExtra{id} = {id, data 'AAAA-MM-GG', importo > 0, tipo 'restituzione'|'regalo'|'vendita'|'altro', nota (≤ 60),
//                       meseConto? (D-152), origine? 'banca', created, updatedAt, deleted?}
//   daConfermare{id} = {id, data (data valuta del movimento), importo > 0, nome (chi manda il bonifico, già pulito, ≤ 60),
//                       meseConto, impronta (SHA-256 della riga, come bancaImpronte), origine 'banca', created, updatedAt}
//   Quando l'utente sceglie, la voce resta solo come {id, deleted:true, esito, updatedAt}: il nome di chi manda non si tiene.
// Conti: le entrate extra entrano negli "Entrati" del mese (Entrate.indice → ext, mese = meseConto o mese della data).
// Tasse, CU e soglie non le vedono mai: usano aggrega/meseIncasso, non Entrate.indice (E-6). Le entrate da confermare non
// contano da nessuna parte finché l'utente non sceglie.
(function(){
const EX=()=>D().entrateExtra||(D().entrateExtra={});
const DC=()=>D().daConfermare||(D().daConfermare={});
// tipi e testi di 02 (mockup D-072, schermata 20)
const TIPI=[['restituzione','↩️','Restituzione'],['regalo','🎁','Regalo'],['vendita','🏷️','Vendita'],['altro','•','Altro']];
const tipoDi=t=>TIPI.find(x=>x[0]===t)||TIPI[3];
const impOk=v=>typeof v==='number'&&isFinite(v)&&v>0&&v<1e8;
const dOk=d=>Entrate.dataValida(d);
const gmA=d=>`${d.slice(8)}/${d.slice(5,7)}/${d.slice(0,4)}`;
const testo=(s,n=60)=>typeof s==='string'?pulisciT(s).slice(0,n):'';
const pulisciT=s=>window.Banca?Banca.pulisci(s):String(s).trim();
const pl=(n,uno,tanti)=>`${n} ${n===1?uno:tanti}`;
// 24c.14 (02, tornata 53 §2 punto 1): 🪙 per le entrate extra; 💶 vuol già dire "Incassato dai progetti" (§6 delle regole)
const ICONA='🪙';
const chiDi=x=>x.nome?`Da ${x.nome}`:x.fonte==='accredito'?'Accredito':'Bonifico ricevuto';
const NOTA_TASSE='Non conta per le tasse. Per i compensi di un lavoro usa «Progetti».';
const FUTURO='La data non può essere nel futuro: i soldi devono essere già arrivati.'; // D-078, testo di 02
const VENDITA='⚠ Se compri per rivendere o vendi in modo continuativo, questi soldi possono essere tassati: chiedi a un commercialista. L’app non li conta nelle tasse.'; // 04, D-074

// ---------- lettura prudente (03: i dati che arrivano da Drive non sono fidati) ----------
function extra(){const out=[];
  for(const [id,x] of Object.entries(EX())){if(!x||typeof x!=='object'||x.deleted||!dOk(x.data)||x.data>today()||!impOk(x.importo))continue;
    out.push({id,data:x.data,importo:x.importo,tipo:tipoDi(x.tipo)[0],nota:testo(x.nota),meseConto:x.meseConto,mese:meseContoDi(x.data,x.meseConto)});}
  return out.sort((a,b)=>a.data<b.data?-1:a.data>b.data?1:0);}
function daConf(){const out=[];
  for(const [id,x] of Object.entries(DC())){if(!x||typeof x!=='object'||x.deleted||!dOk(x.data)||!impOk(x.importo))continue;
    out.push({id,data:x.data,importo:x.importo,nome:testo(x.nome),fonte:x.fonte==='accredito'?'accredito':'bonifico',meseConto:x.meseConto});}
  return out.sort((a,b)=>a.data<b.data?-1:a.data>b.data?1:0);}

// ---------- nei conti: "Entrati" del mese ----------
const _indice=Entrate.indice;
Entrate.indice=function(){const I=_indice();
  for(const e of extra()){const x=I[e.mese]||(I[e.mese]={lav:0,pen:0,prog:0});x.ext=r2((x.ext||0)+e.importo);}
  return I;};

// ---------- pagina "Ancora da incassare": Entrate da confermare ed Entrate extra ----------
// 24c.14: testi definitivi di 02 (tornata 53 §1.3 e §1.6); importi in --ink senza "+" (le entrate da confermare non contano)
function righeConf(L){return L.map(x=>`<div class="ir"><span class="tx"><b class="dcchi">${esc(chiDi(x))}</b><small>${gmA(x.data)} · dalla lista movimenti</small></span><b class="imp">${eur(x.importo)}</b>`+
    `<button type="button" class="btn sm ghost" data-dc="${esc(x.id)}" aria-label="Scegli cos’è l’entrata di ${eur(x.importo)} del ${gmA(x.data)}">Scegli</button></div>`).join('');}
function righeExtra(L){return L.map(x=>{const t=tipoDi(x.tipo);
  return `<div class="ir"><span class="tx"><b><span aria-hidden="true">${t[1]}</span> ${t[2]}</b><small>${gmA(x.data)}${x.nota?' · '+esc(x.nota):''}${x.mese!==x.data.slice(0,7)?` · conta in ${esc(MESI[+x.mese.slice(5)-1])}`:''}</small></span>`+
    `<b class="imp">${eur(x.importo)}</b><button type="button" class="btn sm ghost" data-xe="${esc(x.id)}" aria-label="Modifica l’entrata extra di ${eur(x.importo)} del ${gmA(x.data)}">Modifica</button></div>`;}).join('');}
function renderPagina(){const bc=$('rieConf'),bx=$('rieExtra');if(!bc||!bx)return;
  const C=daConf();
  bc.innerHTML=C.length?`<section class="card inarr" id="dcCard" aria-labelledby="dcT"><h3 id="dcT"><span aria-hidden="true">🏦</span> Entrate da confermare</h3>`+
    `<p class="muted sm" style="margin:0 0 4px">Soldi arrivati sul conto che Soldirini non sa riconoscere. Non contano nei soldi rimanenti finché non scegli cosa sono.</p>${righeConf(C)}</section>`:'';
  const anno=rieMode==='anno',y=cur.slice(0,4);const X=extra().filter(e=>anno?e.mese.startsWith(y+'-'):e.mese===cur);
  const tot=r2(X.reduce((a,e)=>a+e.importo,0));
  bx.innerHTML=X.length?`<section class="card inarr" aria-labelledby="xeT"><h3 id="xeT"><span aria-hidden="true">${ICONA}</span> Entrate extra ${anno?'del '+y:'di '+esc(monthName(cur))}</h3>`+
    `${righeExtra(X)}${X.length>1?`<div class="kv big"><span>Totale</span><b>${eur(tot)}</b></div>`:''}<p class="muted sm" style="margin:6px 0 0">Non contano per le tasse.</p></section>`:'';
  aggiornaRiquadro();}
const _rr=renderRiepilogo;renderRiepilogo=function(){_rr.apply(this,arguments);renderPagina();};

// ---------- 24c.14 (D-167 punto 2): entrate extra nel calendario e nel giorno aperto, nello stile delle spese ----------
const delGiorno=d=>extra().filter(e=>e.data===d);
const _renderCal13=renderCal;
renderCal=function(){_renderCal13.apply(this,arguments);const per={};for(const e of extra())if(e.data.startsWith(cur))per[e.data]=r2((per[e.data]||0)+e.importo);
  document.querySelectorAll('#grid [data-day]').forEach(b=>{const v=per[b.dataset.day],box=b.querySelector('.evs');
    if(v&&box)box.insertAdjacentHTML('beforeend',`<span class="ev sp ex" style="--c:#8a8f98">${ICONA} +${nf(v,v%1?2:0)} €</span>`);});};
const _apriGiorno13=apriGiorno;
apriGiorno=function(d){_apriGiorno13.apply(this,arguments);
  let box=$('dayExtra');if(!box){box=document.createElement('div');box.id='dayExtra';$('dayBox').appendChild(box);}
  const L=delGiorno(d);const tot=r2(L.reduce((a,e)=>a+e.importo,0));
  box.innerHTML=L.length?`<div class="tubox"><div class="tuh"><b><span aria-hidden="true">${ICONA}</span> Entrate extra</b><small class="muted">+ ${eur(tot)}</small></div>${L.map(e=>{const t=tipoDi(e.tipo);
    return `<div class="sprow"><span aria-hidden="true">${t[1]}</span><span class="tx"><b>${t[2]}</b>${e.nota?`<small>${esc(e.nota)}</small>`:''}</span><b>+ ${eur(e.importo)}</b>`+
      `<button type="button" class="btn sm ghost" data-xe="${esc(e.id)}" aria-label="Modifica l’entrata extra di ${eur(e.importo)} del ${gmA(e.data)}">Modifica</button></div>`;}).join('')}</div>`:'';};

// ---------- finestra: scegli cos'è / modifica un'entrata extra ----------
let F=null; // {modo:'dc'|'ex', id, voce, scelta, tipo}
const pagabili=()=>(window.dovuti?dovuti():[]).sort((a,b)=>(!!a.pag-!!b.pag)||b.ym.localeCompare(a.ym)||a.p.nome.localeCompare(b.p.nome));
function apri(modo,id){
  const v=modo==='dc'?daConf().find(x=>x.id===id):extra().find(x=>x.id===id);if(!v)return;
  F={modo,id,voce:v,scelta:modo==='ex'?'extra':null,tipo:modo==='ex'?v.tipo:'restituzione'};
  $('xeTit').textContent=modo==='dc'?'Entrata da confermare':'Entrata extra';
  $('xeSub').hidden=modo!=='dc';$('xeScelte').hidden=modo!=='dc';
  if(modo==='dc'){$('xeChi').textContent=chiDi(v);$('xeQuando').textContent=`${gmA(v.data)} · ${eur(v.importo)} · dalla lista movimenti`;
    for(const r of document.querySelectorAll('input[name="xeS"]'))r.checked=false;}
  $('xeData').value=v.data;$('xeData').max=today();$('xeImp').value=String(v.importo).replace('.',',');$('xeNota').value=modo==='ex'?v.nota:'';
  $('xePgData').value=v.data;$('xePgData').max=today();$('xePgImp').value=String(v.importo).replace('.',',');
  const P=pagabili();$('xePg').innerHTML=P.map(d=>`<option value="${esc(d.key)}">${esc(d.p.nome)} · ${d.t==='r'?'Rimborsi spese':'Compensi'} di ${esc(monthName(d.ym))} · ${eur(d.imp)}${d.pag?' · già entrati':''}</option>`).join('');
  $('xePgVuoto').hidden=!!P.length;$('xePgCampi').hidden=!P.length;
  $('xeDel').hidden=modo!=='ex';
  $('xeErr').hidden=true;aggiorna();$('xeModal').hidden=false;$('xeModal').querySelector('.sheet').scrollTop=0;document.body.classList.add('noscroll');}
function chiudi(){$('xeModal').hidden=true;F=null;if([...document.querySelectorAll('.modal')].every(m=>m.hidden))document.body.classList.remove('noscroll');}
function chips(){$('xeTipi').innerHTML=TIPI.map(t=>`<button type="button" class="chip ${F.tipo===t[0]?'on':''}" data-xt="${t[0]}" aria-pressed="${F.tipo===t[0]}">${t[1]} ${t[2]}</button>`).join('');}
function aggiorna(){if(!F)return;const s=F.scelta;
  $('xePExtra').hidden=s!=='extra';$('xePProg').hidden=s!=='prog';$('xePNo').hidden=s!=='no';
  chips();$('xeVendita').hidden=F.tipo!=='vendita';contaIn();
  const k=$('xePg').value,d=pagabili().find(x=>x.key===k);
  $('xePgGia').hidden=!(s==='prog'&&d&&d.pag);if(d&&d.pag)$('xePgGia').textContent=`⚠ Già segnati come entrati il ${gmA(d.pag.data)}. Salvando, li sostituisci con questi.`;
  const b=$('xeOk');b.disabled=!s||(s==='prog'&&!pagabili().length);
  b.textContent=F.modo==='ex'?'Salva':s==='prog'?'Segna come entrati':s==='no'?'Togli dall’elenco':s==='extra'?'Salva l’entrata extra':'Salva';
  b.classList.toggle('danger',s==='no');}
// "Conta in {mese}." sotto Giorno, quando il mese in cui conta è diverso da quello del giorno (§13 delle regole)
function contaIn(){if(!F)return;const d=$('xeData').value,el=$('xeConta');if(!dOk(d)){el.hidden=true;return;}
  const m=meseContoDi(d,mc(F.voce,d).meseConto);el.hidden=m===d.slice(0,7);if(!el.hidden)el.textContent=`Conta in ${MESI[+m.slice(5)-1]}.`;}
function errore(t){$('xeErr').textContent=t;$('xeErr').hidden=false;return false;}
// data e importo dei campi: {data, importo} oppure false (con l'errore scritto)
function letti(idD,idI){const data=$(idD).value,imp=leggiNumero($(idI).value,true);
  if(!dOk(data))return errore('Scrivi la data.');if(data>today())return errore(FUTURO);
  if(!(imp>0))return errore('Scrivi l’importo.');return {data,importo:r2(imp)};}
// il mese in cui conta (D-152) resta solo se la data è quella del movimento
const mc=(v,data)=>data===v.data&&/^\d{4}-(0[1-9]|1[0-2])$/.test(v.meseConto||'')?{meseConto:v.meseConto}:{};
function togliConf(id,esito){DC()[id]={id,deleted:true,esito,updatedAt:Date.now()};} // senza nome, importo e data (03)
function salva(){if(!F)return;const v=F.voce,now=Date.now();let msg='';
  if(F.scelta==='extra'){const x=letti('xeData','xeImp');if(!x)return;const nota=testo($('xeNota').value);
    const id=F.modo==='ex'?F.id:uid();const prima=F.modo==='ex'?EX()[id]:null;
    EX()[id]={id,data:x.data,...mc(v,x.data),importo:x.importo,tipo:F.tipo,nota,...(prima&&prima.origine||F.modo==='dc'?{origine:'banca'}:{}),created:prima&&prima.created||now,updatedAt:now};
    if(F.modo==='dc')togliConf(F.id,'extra');msg=F.modo==='ex'?'✓ Entrata extra salvata.':`✓ Entrata extra salvata: conta in ${MESI[+meseContoDi(x.data,EX()[id].meseConto).slice(5)-1]}.`;}
  else if(F.scelta==='prog'){const k=$('xePg').value,d=pagabili().find(x=>x.key===k);if(!d)return errore('Scegli a cosa si riferisce.');
    const x=letti('xePgData','xePgImp');if(!x)return;
    pagamenti()[k]={pagato:true,data:x.data,...mc(v,x.data),importo:x.importo,updatedAt:now};togliConf(F.id,'progetto');
    msg=`✓ ${d.t==='r'?'Rimborsi':'Compensi'} di ${MESI[+d.ym.slice(5)-1]} segnati come entrati.`;}
  else if(F.scelta==='no'){togliConf(F.id,'no');msg='✓ Tolta dall’elenco.';}
  else return;
  chiudi();changed();render();giornoAperto();toast(msg);}
// stessa conferma dell'eliminazione di una spesa giornaliera (02, tornata 53 §1.6); resta solo il segno (D-105, D-164)
async function elimina(){if(!F||F.modo!=='ex')return;const id=F.id,v=F.voce;
  if(!await conferma(`Eliminare l’entrata extra di ${eur(v.importo)}?`,'Elimina','danger'))return;
  EX()[id]={id,deleted:true,updatedAt:Date.now()};chiudi();changed();render();giornoAperto();toast('✓ Entrata extra eliminata.');}
// se il giorno è aperto (modifica dal giorno), si ridisegna come dopo l'eliminazione di una spesa
function giornoAperto(){if(!$('dayModal').hidden)apriGiorno(selDay);}

// ---------- dopo "Importa": riquadro "Nella lista ci sono N entrate da controllare" (banca.js) ----------
// 24c.14: testi definitivi di 02 (tornata 53 §1.2); il numero è quello delle voci di questa lista ancora da scegliere
let ultimiIds=[];
function testoRiquadro(n){return n===1?'<b>Nella lista c’è 1 entrata da confermare.</b> Finché non scegli cos’è, non conta nei soldi.'
  :`<b>Nella lista ci sono ${n} entrate da confermare.</b> Finché non scegli cosa sono, non contano nei soldi.`;}
function riquadro(ids,dopo){document.querySelectorAll('.dcnote').forEach(e=>e.remove());ultimiIds=Array.isArray(ids)?ids:[];
  const n=ultimiIds.filter(id=>daConf().some(x=>x.id===id)).length;if(!n||!dopo)return;
  const el=document.createElement('div');el.className='note dcnote';el.setAttribute('role','status');
  el.innerHTML=`<span>${testoRiquadro(n)}</span><button type="button" class="btn sm" data-dcvai aria-label="Controlla le entrate da confermare">Controlla</button>`;
  dopo.insertAdjacentElement('afterend',el);}
// 24c.20: il riquadro da aggiornare è quello sotto il pulsante usato, mai quello dentro la finestra della banca (#bcModal, banca.js riqConf):
// prima un render() qualunque (per esempio la sincronizzazione dopo «Archivia su Drive») trovava quello della finestra e lo toglieva,
// insieme al suo «Controlla» (prova v24c17 instabile, 2 volte su 15 anche sulla 24c.19)
function aggiornaRiquadro(){const el=[...document.querySelectorAll('.dcnote')].find(e=>!e.closest('#bcModal'));if(!el)return;
  const n=ultimiIds.filter(id=>daConf().some(x=>x.id===id)).length;if(!n){el.remove();return;}el.querySelector('span').innerHTML=testoRiquadro(n);}
function vai(){document.querySelectorAll('.dcnote').forEach(e=>e.remove());vaiA('dinc');
  const c=$('dcCard');if(c){c.scrollIntoView({block:'start'});c.querySelector('[data-dc]')?.focus({preventScroll:true});}}

// ---------- 🪙 Entrata extra in Nuova attività (come l'uscita fissa, soldi.js FissaEv) ----------
let exTipo='restituzione',exData='';
function exPrepara(dates,modifica){const s=$('secExtra');if(!s)return;const una=dates.length===1&&!modifica;s.hidden=!una;s.open=false;if(!una)return;
  exTipo='restituzione';exData=dates[0];$('evExImp').value='';$('evExNota').value='';$('evExErr').hidden=true;exChips();exSum();}
function exChips(){$('evExTipi').innerHTML=TIPI.map(t=>`<button type="button" class="chip ${exTipo===t[0]?'on':''}" data-ext="${t[0]}" aria-pressed="${exTipo===t[0]}">${t[1]} ${t[2]}</button>`).join('');
  $('evExVendita').hidden=exTipo!=='vendita';}
function exSum(){const imp=leggiNumero($('evExImp').value);$('secExtraSum').textContent=imp>0?'+ '+eur(imp):'';}
const exCompilata=()=>!!$('secExtra')&&!$('secExtra').hidden&&(leggiNumero($('evExImp').value)>0||!!$('evExNota').value.trim());
function exErrore(t){$('evExErr').textContent=t;$('evExErr').hidden=false;$('secExtra').open=true;return false;}
function exValida(){$('evExErr').hidden=true;const imp=leggiNumero($('evExImp').value,true);
  if(!(imp>0))return exErrore('Scrivi l’importo.');if(!dOk(exData))return exErrore('Scrivi la data.');if(exData>today())return exErrore(FUTURO);return true;}
function exSalva(){const id=uid(),now=Date.now();EX()[id]={id,data:exData,importo:r2(leggiNumero($('evExImp').value,true)),tipo:exTipo,nota:testo($('evExNota').value),created:now,updatedAt:now};return id;}
window.ExtraEv={prepara:exPrepara,compilata:exCompilata,valida:exValida,salva:exSalva};

function bind(){
  document.addEventListener('click',e=>{const t=e.target;
    const a=t.closest('[data-dc]');if(a){apri('dc',a.dataset.dc);return;}
    const b=t.closest('[data-xe]');if(b){apri('ex',b.dataset.xe);return;}
    if(t.closest('[data-dcvai]')){vai();return;}
    const c=t.closest('[data-xt]');if(c&&F){F.tipo=c.dataset.xt;aggiorna();return;}
    const d=t.closest('[data-ext]');if(d){exTipo=d.dataset.ext;exChips();}});
  $('xeScelte').addEventListener('change',e=>{if(e.target.name==='xeS'&&F){F.scelta=e.target.value;aggiorna();}});
  $('xePg').addEventListener('change',aggiorna);$('xeData').addEventListener('input',contaIn);
  $('xeClose').onclick=chiudi;$('xeAnn').onclick=chiudi;$('xeOk').onclick=salva;$('xeDel').onclick=elimina;
  $('xeModal').addEventListener('click',e=>{if(e.target.id==='xeModal')chiudi();});
  $('evExImp').addEventListener('input',exSum);}
bind();
window.EntrateExtra={extra,daConf,apri,riquadro,TIPI,delGiorno,tipoDi};
})();
