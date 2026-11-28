'use strict';
// ================= 24c.20 (D-180): scelte proprie per le spese giornaliere e le uscite fisse =================
// Disegno e testi: 02, tornata 62 §2 (mockup B1-B5), con le risposte dell'utente D-190 (due liste separate; rinominando, le voci
// seguono il nome nuovo). Privacy e requisiti: 03, consegna 24c20 §2.
// Dati: D().scelte[id] = {id, lista:'spese'|'fissi', nome, ico, importo, giorno, creata, updatedAt, deleted?}.
// - «Togli» non cancella la voce: la segna deleted e tiene nome e icona, così le spese e le uscite già segnate si vedono ancora
//   con l'ultimo nome (come le vecchie Netflix e Disney+, D-117). Una voce salvata ha anche catNome/catIco (copia del momento),
//   usati solo se la scelta non c'è proprio (per esempio non è ancora arrivata da Drive).
// - Si sincronizza voce per voce come gli altri elenchi (mergeData generico di stipendio.js), va nella copia di sicurezza
//   (copia.js), «Esci» la cancella con gli altri dati, «Elimina i dati di un mese» non la tocca.
// - Il nome scritto dall'utente si mostra sempre con esc() o textContent e non va mai in console, toast d'errore o diagnostica.
(function(){
const MAX=12,MAXL=24; // 02 §2.2: 12 scelte per elenco, 24 lettere per nome
// 02 §2.2: 24 icone che nell'app non hanno già un altro significato, più «•» (nessuna icona)
const ICONE=[['•','Nessuna icona'],['☕','Tazza'],['🍕','Pizza'],['🥐','Cornetto'],['🍺','Birra'],['🚌','Autobus'],['🚗','Auto'],['⛽','Benzina'],['🐶','Cane'],
  ['🏋️','Palestra'],['🎮','Giochi'],['🎵','Musica'],['📚','Libri'],['💊','Medicine'],['✂️','Parrucchiere'],['🎁','Regalo'],['🧒','Bambini'],['🌳','Parco'],
  ['✈️','Viaggio'],['🎟️','Biglietto'],['👕','Vestiti'],['🔧','Attrezzi'],['🐾','Animali'],['🧴','Cura della persona']];
const LISTA={spese:'spese giornaliere',fissi:'uscite fisse'};
// leggere non crea niente (24c.18: le raccolte vuote create leggendo cambiano i dati)
const tutte=()=>{const o=D().scelte;return o&&typeof o==='object'?Object.values(o).filter(s=>s&&typeof s==='object'&&typeof s.id==='string'):[];};
const nomeOk=s=>typeof s.nome==='string'&&s.nome.trim()!=='';
const icoOk=v=>ICONE.some(i=>i[0]===v)?v:'•';
const elenco=lista=>tutte().filter(s=>s.lista===lista&&!s.deleted&&nomeOk(s)).sort((a,b)=>(a.creata||0)-(b.creata||0)||String(a.id).localeCompare(String(b.id)));
const prendi=id=>{const s=(D().scelte||{})[id];return s&&typeof s==='object'&&nomeOk(s)?s:null;};
// categoria di una voce: [chiave, icona, nome]; null se la chiave non è di una scelta propria
function cat(k,voce){if(typeof k!=='string'||!k.startsWith('sc:'))return null;const s=prendi(k.slice(3));
  if(s)return [k,icoOk(s.ico),s.nome.trim()];
  return [k,voce&&typeof voce.catIco==='string'?icoOk(voce.catIco):'•',voce&&typeof voce.catNome==='string'&&voce.catNome.trim()?voce.catNome.trim().slice(0,MAXL):'Altro'];}
// copia di nome e icona da salvare nella voce
function copia(k){const c=cat(k);return c?{catNome:c[2],catIco:c[1]}:{};}
// chip delle scelte proprie (attr = nome dell'attributo data-… del modulo)
function chips(lista,sel,attr){return elenco(lista).map(s=>{const k='sc:'+s.id,on=sel===k;
  return `<button type="button" class="chip ${on?'on':''}" data-${attr}="${esc(k)}" aria-pressed="${on}">${icoOk(s.ico)} ${esc(s.nome.trim())}</button>`;}).join('');}
// sotto i chip, solo con una scelta propria selezionata (02 §2.3)
function azioni(lista,sel){const c=typeof sel==='string'&&sel.startsWith('sc:')?prendi(sel.slice(3)):null;if(!c||c.deleted||c.lista!==lista)return '';
  return `<div class="acts scazioni"><button type="button" class="btn ghost sm" data-scmod="${esc(c.id)}">✏️ Modifica «${esc(c.nome.trim())}»</button><button type="button" class="btn danger sm" data-sctogli="${esc(c.id)}">Togli dalle scelte</button></div>`;}

// ---------- finestra «Nuova scelta» / «Modifica scelta» ----------
let st=null; // {lista, id (modifica), ico, fatto(id)}
const lettere=v=>[...v].length;
function errore(campo,t){const e=$('sc'+campo+'Err');e.textContent=t||'';e.hidden=!t;$('sc'+campo).classList.toggle('bad',!!t);$('sc'+campo).setAttribute('aria-invalid',t?'true':'false');return !t;}
function controllaNome(){const v=$('scNome').value.trim();if(!v)return errore('Nome','Scrivi un nome per la scelta.');
  if(lettere(v)>MAXL)return errore('Nome',`Il nome può avere al massimo ${MAXL} lettere.`);
  const n=v.toLocaleLowerCase('it'),pronte=st.lista==='spese'?(window.CATS_SPESE||[]):(window.FCAT_PRONTE||[]);
  const doppio=pronte.some(c=>String(c[2]).toLocaleLowerCase('it')===n)||elenco(st.lista).some(s=>s.id!==st.id&&s.nome.trim().toLocaleLowerCase('it')===n);
  return errore('Nome',doppio?'C’è già una scelta con questo nome. Scrivine un altro.':'');}
function controllaImp(){const v=$('scImp').value.trim();if(!v)return errore('Imp','');const n=leggiNumero(v,true);return errore('Imp',n>0?'':'Scrivi un importo più grande di 0.');}
function controllaGiorno(){if(st.lista!=='fissi')return true;const v=$('scGiorno').value.trim();if(!v)return errore('Giorno','');const g=Number(v);
  return errore('Giorno',Number.isInteger(g)&&g>=1&&g<=31?'':'Scrivi il giorno di addebito (1–31).');}
function disegnaIcone(){$('scIco').innerHTML=ICONE.map(([i,n])=>`<button type="button" class="scic" data-scico="${i}" aria-label="${esc(n)}" aria-pressed="${st.ico===i}"><span aria-hidden="true">${i}</span></button>`).join('');}
function apri(lista,id,fatto){const s=id?prendi(id):null;if(id&&!s)return;
  st={lista,id:s?s.id:null,ico:s?icoOk(s.ico):'•',fatto};
  $('scTit').textContent=s?'Modifica scelta':'Nuova scelta';
  $('scFrase').textContent=`La scelta resta tra quelle delle ${LISTA[lista]} e la puoi togliere quando vuoi.`;
  $('scNome').value=s?s.nome.trim():'';$('scImp').value=s&&s.importo?(Math.round(+s.importo*100)/100).toFixed(2).replace('.',','):'';$('scGiorno').value=s&&s.giorno?String(s.giorno):'';
  $('scGiornoL').hidden=lista!=='fissi';for(const c of ['Nome','Imp','Giorno'])errore(c,'');
  const pieno=!s&&elenco(lista).length>=MAX;$('scMax').hidden=!pieno;$('scSave').disabled=pieno;
  disegnaIcone();$('scModal').hidden=false;document.body.classList.add('noscroll');$('scModal').querySelector('.sheet').scrollTop=0;
  setTimeout(()=>{if(!$('scModal').hidden)$('scNome').focus();},50);}
function chiudi(){$('scModal').hidden=true;st=null;if([...document.querySelectorAll('.modal')].every(m=>m.hidden))document.body.classList.remove('noscroll');}
function salva(){if(!st||$('scSave').disabled)return;const ok=[controllaNome(),controllaImp(),controllaGiorno()];
  if(ok.includes(false)){const e=['Nome','Imp','Giorno'][ok.indexOf(false)];$('sc'+e).focus();return;}
  if(!st.id&&elenco(st.lista).length>=MAX)return;
  const nome=$('scNome').value.trim(),imp=$('scImp').value.trim()?String(Math.round(leggiNumero($('scImp').value,true)*100)/100):'';
  const giorno=st.lista==='fissi'&&$('scGiorno').value.trim()?String(Number($('scGiorno').value.trim())):'';
  const scelte=D().scelte||(D().scelte={}),id=st.id||uid(),prima=scelte[id]||{};
  scelte[id]=Object.assign({},prima,{id,lista:st.lista,nome,ico:st.ico,importo:imp,giorno,creata:prima.creata||Date.now(),deleted:false,updatedAt:Date.now()});
  const fatto=st.fatto;chiudi();changed();toast(`✓ Scelta salvata: ${nome}.`);if(fatto)fatto(id);}
// «Togli dalle scelte» con la conferma (02 §2.3)
async function togli(id,fatto){const s=prendi(id);if(!s||s.deleted)return;const n=esc(s.nome.trim());
  const voci=s.lista==='fissi'?'Le uscite già segnate':'Le spese già segnate';
  const ok=await ask(`<b class="dlgt">Togliere «${n}» dalle scelte?</b><span class="dlgp">${voci} con «${n}» restano dove sono, con il loro nome. Non si cancella niente.</span>`,
    [{t:'Annulla',v:false,cls:'ghost'},{t:'Togli la scelta',v:true,cls:'danger'}],true);
  if(!ok)return;const v=D().scelte[id];v.deleted=true;v.updatedAt=Date.now();changed();toast('✓ Scelta tolta.');if(fatto)fatto();}
function bind(){
  $('scIco').addEventListener('click',e=>{const b=e.target.closest('[data-scico]');if(!b||!st)return;st.ico=b.dataset.scico;
    document.querySelectorAll('#scIco [data-scico]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});
  $('scNome').addEventListener('blur',()=>{if(st)controllaNome();});$('scImp').addEventListener('blur',()=>{if(st)controllaImp();});$('scGiorno').addEventListener('blur',()=>{if(st)controllaGiorno();});
  // gli errori spariscono appena il valore è giusto
  $('scNome').addEventListener('input',()=>{if(st&&!$('scNomeErr').hidden)controllaNome();});
  $('scImp').addEventListener('input',()=>{if(st&&!$('scImpErr').hidden)controllaImp();});$('scGiorno').addEventListener('input',()=>{if(st&&!$('scGiornoErr').hidden)controllaGiorno();});
  $('scSave').onclick=salva;$('scAnn').onclick=chiudi;$('scClose').onclick=chiudi;
  $('scModal').addEventListener('click',e=>{if(e.target.id==='scModal')chiudi();});
  $('scModal').addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();chiudi();}if(e.key==='Enter'&&e.target.tagName==='INPUT'){e.preventDefault();salva();}});}
bind();
window.Scelte={elenco,cat,copia,chips,azioni,apri,togli,prendi,MAX,MAXL,ICONE};
})();
