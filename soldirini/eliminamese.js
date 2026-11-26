'use strict';
// ================= Soldirini 24c.17 · «Elimina i dati di un mese» (D-156, D-164) =================
// Disegno e testi di 02 (tornata 52, schermi A1-A6), rischi di 03 (tornata 52 §1, C1-C5), casi di 04 (tornata 52, EM1-EM18),
// piano di 01 (24c.12 §5, 24c.13 §2). Risposte provvisorie (consiglio A) alle domande 87-92, da confermare con l'utente:
//   87 A  ogni voce è nel mese in cui conta nei soldi (spese: meseSpesa; «È entrato» ed entrate extra: mese della data/meseConto)
//   88 A  le voci si scelgono una volta sola, prima di cancellare: le spese della banca che dopo tornano nel mese restano
//   89 A  le attività dei progetti già incassate restano fuori, con una casella a parte spenta di partenza
//   90 A  della voce resta solo il segno (id, data o mese, collegamento, deleted, updatedAt): niente importi, note o nomi
//   91 A  le attività dei progetti vanno nel Cestino per 30 giorni, come quando si cancellano una per una
//   92 A  le spese importate prima della 24c.17 (senza impronta) restano «Già importato»: il passo 2 lo dice
// Uscite fisse, CU, risparmi, fondi e impostazioni non si toccano. Un solo changed() alla fine (un solo invio a Drive).
(function(){
const RE_D=/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/,RE_YM=/^\d{4}-(0[1-9]|1[0-2])$/,RE_H=/^[0-9a-f]{64}$/;
const pl=(n,uno,tanti)=>`${n} ${n===1?uno:tanti}`;
const obj=x=>x&&typeof x==='object';
const vivi=o=>Object.entries(o||{}).filter(([,x])=>obj(x)&&!x.deleted);
const conDrive=()=>!!(DB.meta.account&&DB.meta.dataId);
const gmA=d=>`${d.slice(8,10)}/${d.slice(5,7)}/${d.slice(0,4)}`;

// ---------- cosa c'è nel mese (si legge soltanto: niente si crea né si cambia nei dati) ----------
function raccogli(ym){
  const lavVivi=new Set(Object.values(D().lavori||{}).filter(l=>obj(l)&&!l.deleted).map(l=>l.id));
  const spese=vivi(D().spesePers).filter(([,s])=>RE_D.test(s.data||'')&&meseSpesa(s)===ym).map(([k,s])=>({k,s}));
  const banca=spese.filter(x=>x.s.origine==='banca');
  const entrate=[];
  for(const [k,r] of Object.entries(D().entrate||{})){if(!/^(lav\|[^|]+|pen)\|\d{4}-\d{2}$/.test(k))continue;const e=Entrate.leggi(r);if(e&&e.mese===ym)entrate.push({col:'entrate',k,ym:k.slice(-7),pen:k.startsWith('pen|')});}
  for(const x of (window.EntrateExtra?EntrateExtra.extra():[]))if(x.mese===ym)entrate.push({col:'entrateExtra',k:x.id,data:x.data});
  const turni=vivi(D().turni).filter(([,t])=>RE_D.test(t.data||'')&&t.data.slice(0,7)===ym&&lavVivi.has(t.lid)).map(([k,t])=>({k,t}));
  // attività dei progetti per data dell'attività (04, EM8), insieme al loro pagamento; per progetto: già incassate o no
  const pag=D().pagamenti||{},gruppi={};
  for(const [k,e] of vivi(D().eventi)){if(!e.pid||!RE_D.test(e.data||'')||e.data.slice(0,7)!==ym)continue;const p=prog(e.pid);if(!p||p.deleted)continue;
    (gruppi[e.pid]||(gruppi[e.pid]={pid:e.pid,ev:[]})).ev.push({k,e});}
  const libere={ev:[],pag:[]},incassate={ev:[],pag:[],anni:new Set()};
  for(const g of Object.values(gruppi)){const pk=['o','r'].map(t=>`${g.pid}|${ym}|${t}`);const ok=pk.filter(k=>pagOk(pag[k]));
    const dove=ok.length?incassate:libere;dove.ev.push(...g.ev);dove.pag.push(...pk.filter(k=>obj(pag[k])&&!pag[k].deleted));
    for(const k of ok)incassate.anni.add(pag[k].data.slice(0,4));}
  const buste=vivi(D().buste).filter(([,b])=>b.mese===ym&&(!b.lid||lavVivi.has(b.lid))).map(([k,b])=>({col:'buste',k,b}));
  const c=(D().cedolini||{})[ym],ced=obj(c)&&!c.deleted?[{col:'cedolini',k:ym,b:c}]:[];
  return {ym,spese,banca:banca.length,senzaImpronta:banca.filter(x=>!RE_H.test(x.s.impronta||'')).length,entrate,turni,libere,incassate,buste,ced};}

// ---------- la finestra ----------
const RIGHE=[['sp','Spese giornaliere'],['en','Entrate segnate'],['tu','Turni e assenze'],['at','Attività dei progetti'],['inc',''],['bu','Buste paga e cedolini']];
let S=null; // {ym, R, sel:{}, passo, pdf, senzaCopia, occupato, err}
const conto=(R,c)=>c==='sp'?R.spese.length:c==='en'?R.entrate.length:c==='tu'?R.turni.length:c==='at'?R.libere.ev.length:c==='inc'?R.incassate.ev.length:R.buste.length+R.ced.length;
const scelte=()=>RIGHE.map(r=>r[0]).filter(c=>S.sel[c]&&conto(S.R,c)>0);
const totale=()=>scelte().reduce((a,c)=>a+conto(S.R,c),0);
function riga(c){const R=S.R,n=conto(R,c),M=monthName(S.ym);
  let nome=RIGHE.find(r=>r[0]===c)[1],sotto='';
  if(c==='sp')sotto=R.banca?`comprese ${R.banca} importate dalla banca`:'';
  if(c==='en')sotto='stipendio o pensione «È entrato» ed entrate extra';
  if(c==='tu')sotto='anche ferie, permessi e malattia';
  if(c==='at')sotto='ore, compensi e rimborsi del mese';
  if(c==='inc'){const a=[...R.incassate.anni].sort();nome=`Anche ${n===1?'l’attività già incassata':`le ${n} attività già incassate`}`;sotto=`${n===1?'conta':'contano'} nelle tasse ${a.join(' e ')}`;}
  if(c==='bu'){const b=R.buste.length,cd=R.ced.length;sotto=b&&cd?`la busta e il cedolino di ${M}`:b>1?`le buste di ${M}`:b?`la busta di ${M}`:`il cedolino di ${M}`;}
  if(!n)sotto='niente in questo mese';
  if(c==='inc'&&!n)return '';
  return `<label class="emck${n?'':' zero'}${c==='inc'?' eminc':''}"><input type="checkbox" data-em="${c}" ${S.sel[c]&&n?'checked':''} ${n?'':'disabled'}>
    <span class="t">${nome}${sotto?`<small class="muted">${sotto}</small>`:''}</span><b class="n">${n}</b></label>`;}
const FISSE='<p class="muted sm emfisse">Le uscite fisse non si cancellano da qui: usa «Termina». La CU, i risparmi e i fondi restano, perché non sono di un mese.</p>';
function passo1(){const R=S.R,M=monthName(S.ym),vuoto=!RIGHE.some(r=>conto(R,r[0])>0),N=totale();
  $('emTit').textContent='Elimina i dati di un mese';
  const tutti=RIGHE.filter(r=>r[0]!=='inc'&&conto(R,r[0])>0).every(r=>S.sel[r[0]]);
  $('emBody').innerHTML=`<label class="emmese">Mese<input type="month" id="emMese" value="${S.ym}"></label>
    ${vuoto?`<p class="muted emvuoto">In ${M} non c'è niente da eliminare.</p><p class="muted sm">Scegli un altro mese qui sopra.</p>`
    :`<div class="emtesta"><p class="muted sm">Scegli cosa togliere da ${M}:</p><button type="button" class="btn link sm" id="emTutto">${tutti?'Togli tutto':'Scegli tutto'}</button></div>${RIGHE.map(r=>riga(r[0])).join('')}`}
    ${FISSE}`;
  $('emFoot').innerHTML=`${vuoto?'':`<p class="emriep">Scelte: <b>${pl(N,'voce','voci')}</b></p>`}
    <div class="pls"><button type="button" class="btn ghost" id="emAnn">${vuoto?'Chiudi':'Annulla'}</button><button type="button" class="btn" id="emCont" ${N?'':'disabled'}>Continua</button></div>`;}
function parti(){const R=S.R,s=new Set(scelte());const b=s.has('bu')?R.buste.length:0,c=s.has('bu')?R.ced.length:0,a=(s.has('at')?R.libere.ev.length:0)+(s.has('inc')?R.incassate.ev.length:0);
  return [s.has('sp')&&pl(R.spese.length,'spesa','spese'),s.has('en')&&pl(R.entrate.length,'entrata','entrate'),s.has('tu')&&pl(R.turni.length,'turno','turni'),a&&pl(a,'attività','attività'),b&&pl(b,'busta paga','buste paga'),c&&pl(c,'cedolino','cedolini')].filter(Boolean).join(', ');}
const pdfDi=R=>[...R.buste,...R.ced].filter(x=>x.b.file&&x.b.file.id);
const copiaOk=()=>(DB.meta.copia||{}).ultima===today();
function passo2(){const R=S.R,M=monthName(S.ym),N=totale(),s=new Set(scelte());
  $('emTit').textContent=N===1?`Eliminare 1 voce di ${M}?`:`Eliminare ${N} voci di ${M}?`;
  // seconda riga dell'avviso (02, PROVVISORIA per 04): solo con le entrate e senza le spese, se c'è uno stipendio o una pensione «È entrato»
  const st=s.has('en')&&!s.has('sp')?R.entrate.find(x=>x.col==='entrate'):null;
  const riga2=st?`<br>Togli ${st.pen?'la pensione':'lo stipendio'} di ${MESI[+st.ym.slice(5)-1]} ${st.pen?'segnata entrata':'segnato entrato'}: le spese importate dalla banca prima del suo arrivo tornano a contare nel mese della loro data.`:'';
  const imp=s.has('sp')?R.senzaImpronta:0;
  const pdf=s.has('bu')&&conDrive()?pdfDi(R):[];
  const soloCed=pdf.length&&pdf.every(x=>x.col==='cedolini');
  const dom=pdf.length===1?(soloCed?`Il PDF del cedolino di ${M} su Google Drive?`:`Il PDF della busta di ${M} su Google Drive?`):soloCed?'I PDF dei cedolini su Google Drive?':'I PDF delle buste su Google Drive?';
  const c=DB.meta.copia||{};
  const copia=copiaOk()?(S.copiaFatta?'<p class="sm emok">✓ Copia salvata oggi.</p>':'')
    :`<div class="emcopia">${c.ultima?`Ultima copia di sicurezza: ${gmA(c.ultima)}. Prima di eliminare, salvane una nuova.`:'Nessuna copia salvata finora. Prima di eliminare, salvane una.'}
      <button type="button" class="btn ghost sm" id="emCopia">Salva una copia</button>
      <label class="check"><input type="checkbox" id="emSenza" ${S.senzaCopia?'checked':''}> Continuo senza salvare una copia</label></div>`;
  $('emBody').innerHTML=`<p>Spariscono <b>${pl(N,'voce','voci')}</b> di ${M}: ${parti()}.</p>
    ${conDrive()?'<p class="muted sm">Spariscono anche dagli altri telefoni collegati e da Google Drive.</p>':''}
    <div class="vcavv" role="status"><b>⚠ Anche altri conti possono cambiare.</b><br>Tasse, CU e «Rimasti dai mesi prima» dei mesi dopo si ricalcolano senza queste voci.${riga2}</div>
    ${imp?`<p class="muted sm emimp">${imp===1?'1 spesa importata dalla banca resta «Già importato»: se reimporti la lista, aggiungila a mano.':`${imp} spese importate dalla banca restano «Già importato»: se reimporti la lista, aggiungile a mano.`}</p>`:''}
    ${pdf.length?`<fieldset class="empdf"><legend>${dom}</legend>
      <label class="radio"><input type="radio" name="emPdf" value="lascia" ${S.pdf!=='cestino'?'checked':''}><span>Lasciali su Drive<small class="muted">La busta sparisce da Soldirini, il PDF resta nella cartella di Drive.</small></span></label>
      <label class="radio"><input type="radio" name="emPdf" value="cestino" ${S.pdf==='cestino'?'checked':''}><span>Spostali nel cestino di Drive<small class="muted">Dal cestino di Drive si possono recuperare per 30 giorni.</small></span></label></fieldset>`:''}
    ${copia}
    ${S.err?'<p class="sm err" role="alert">Soldirini non è riuscita a eliminare le voci, quindi non ha cambiato niente. Riprova.</p>':''}`;
  const pronto=copiaOk()||S.senzaCopia;
  $('emFoot').innerHTML=`<div class="pls"><button type="button" class="btn ghost" id="emAnn" ${S.occupato?'disabled':''}>Annulla</button>
    <button type="button" class="btn danger" id="emVia" ${pronto&&!S.occupato?'':'disabled'}>${S.occupato?'<i class="spin" aria-hidden="true"></i>Elimino…':`Elimina ${pl(N,'voce','voci')} di ${M}`}</button></div>
    <div class="emindietro"><button type="button" class="btn link sm" id="emCambia" ${S.occupato?'disabled':''}>‹ Cambia la scelta</button></div>`;}
function disegna(){if(!S)return;if(S.passo===2)passo2();else passo1();}
function apri(ym){S={ym:RE_YM.test(ym||'')?ym:today().slice(0,7),sel:{},passo:1,pdf:'lascia',senzaCopia:false,occupato:false,err:false,copiaFatta:false};S.R=raccogli(S.ym);
  disegna();$('emModal').hidden=false;document.body.classList.add('noscroll');$('emModal').querySelector('.sheet').scrollTop=0;}
function chiudi(){if(S&&S.occupato)return;S=null;$('emModal').hidden=true;$('emBody').innerHTML='';$('emFoot').innerHTML='';
  if([...document.querySelectorAll('.modal')].every(m=>m.hidden))document.body.classList.remove('noscroll');}
function cambiaMese(ym){if(!RE_YM.test(ym||''))return;S.ym=ym;S.R=raccogli(ym);for(const c of Object.keys(S.sel))if(!conto(S.R,c))S.sel[c]=false;disegna();$('emMese')?.focus();}

// ---------- l'eliminazione ----------
// segno di cancellazione (03, C1 e C2; domanda 90 A): solo id, data o mese, collegamento, deleted, updatedAt.
// Entrate e pagamenti: entrato:false / pagato:false, perché i telefoni con una versione vecchia non leggono deleted.
function elimina(){const R=S.R,s=new Set(scelte()),now=Date.now(),fatto=[],ev=[],attesa=[];
  // il segno è sempre più recente della voce che toglie, anche se l'orologio di questo telefono è indietro rispetto a quello
  // dell'altro telefono che l'ha scritta: così all'unione vince sempre la cancellazione (mergeMap: vince updatedAt più grande)
  const metti=(col,k,v)=>{const C=D()[col]||(D()[col]={}),cera=Object.prototype.hasOwnProperty.call(C,k),prima=C[k];
    const u=obj(prima)&&Number.isFinite(+prima.updatedAt)?+prima.updatedAt+1:0;if(u>v.updatedAt)v.updatedAt=u;
    C[k]=v;fatto.push([col,k,cera,prima]);};
  try{
    if(s.has('sp'))for(const {k,s:x} of R.spese){metti('spesePers',k,{id:x.id||k,data:x.data,deleted:true,updatedAt:now});
      // l'impronta della riga della banca torna libera: reimportando la lista il movimento si può importare di nuovo (03, C4)
      if(RE_H.test(x.impronta||''))metti('bancaImpronte',x.impronta,{deleted:true,updatedAt:now});}
    if(s.has('en'))for(const x of R.entrate){if(x.col==='entrate')metti('entrate',x.k,{entrato:false,deleted:true,updatedAt:now});
      else metti('entrateExtra',x.k,{id:x.k,data:x.data,deleted:true,updatedAt:now});}
    if(s.has('tu'))for(const {k,t} of R.turni)metti('turni',k,{id:t.id||k,lid:t.lid,data:t.data,deleted:true,updatedAt:now});
    // attività: nel Cestino per 30 giorni come quelle cancellate una per una (domanda 91 A), con il loro pagamento (04, EM7b)
    for(const g of [s.has('at')&&R.libere,s.has('inc')&&R.incassate].filter(Boolean)){
      for(const {k,e} of g.ev){ev.push(e);metti('eventi',k,Object.assign({},e,{deleted:true,deletedAt:now,updatedAt:now}));}
      for(const k of g.pag)metti('pagamenti',k,{pagato:false,deleted:true,updatedAt:now});}
    if(s.has('bu')){for(const {k,b} of R.buste){metti('buste',k,{lid:b.lid,mese:b.mese,deleted:true,updatedAt:now});attesa.push(k);}
      for(const {k} of R.ced){metti('cedolini',k,{mese:k,deleted:true,updatedAt:now});attesa.push('ced|'+k);}}
  }catch(e){// niente è cambiato: si rimette tutto com'era
    for(const [col,k,cera,v] of fatto.reverse()){try{const C=D()[col];if(cera)C[k]=v;else delete C[k];}catch(x){console.warn(x);}}
    console.warn(e);return null;}
  for(const e of ev)markExport(exportKeysOf(e)); // i fogli Excel dei progetti si riscrivono
  for(const k of attesa)if(window.soldiriniFile)soldiriniFile.fset(k,undefined); // file delle buste ancora in attesa di Drive
  logStorico('Eliminazione',`${pl(totale(),'voce','voci')} di ${monthName(S.ym)} eliminate`);
  changed();render();return fatto.length;}
async function nelCestino(L){let n=0,no=0;for(const x of L){try{await gfetch('PATCH',`${DRIVE}/files/${x.b.file.id}?fields=id`,{json:{trashed:true}});n++;}catch(e){no++;}}return {n,no};}
async function via(){if(!S||S.occupato||!(copiaOk()||S.senzaCopia))return;
  const M=monthName(S.ym),N=totale(),pdf=S.pdf==='cestino'&&scelte().includes('bu')&&conDrive()?pdfDi(S.R):[];
  S.occupato=true;S.err=false;disegna();
  if(elimina()===null){S.occupato=false;S.err=true;disegna();return;}
  let msg=N===1?`✓ Eliminata 1 voce di ${M}.`:`✓ Eliminate ${N} voci di ${M}.`;
  if(pdf.length){const r=await nelCestino(pdf);if(r.n)msg+=` ${r.n} PDF ${r.n===1?'è':'sono'} nel cestino di Drive.`;
    if(r.no)msg+=` ${r.no} PDF ${r.no===1?'è rimasto':'sono rimasti'} su Drive: Soldirini non è riuscita a raggiungerl${r.no===1?'o':'i'}.`;}
  S.occupato=false;chiudi();toast(msg);}

// ---------- eventi ----------
function bind(){
  document.addEventListener('click',e=>{if(e.target.closest('#emApri'))apri(typeof cur==='string'?cur:'');});
  $('emClose').onclick=chiudi;
  $('emModal').addEventListener('click',e=>{if(e.target.id==='emModal'){chiudi();return;}const b=e.target.closest('button');if(!b||!S)return;
    if(b.id==='emAnn'){chiudi();return;}
    if(b.id==='emTutto'){const tutti=RIGHE.filter(r=>r[0]!=='inc'&&conto(S.R,r[0])>0).every(r=>S.sel[r[0]]);for(const [c] of RIGHE)if(c!=='inc')S.sel[c]=!tutti&&conto(S.R,c)>0;disegna();return;}
    if(b.id==='emCont'&&totale()){S.passo=2;S.err=false;disegna();$('emModal').querySelector('.sheet').scrollTop=0;return;}
    if(b.id==='emCambia'){S.passo=1;S.err=false;disegna();return;}
    if(b.id==='emCopia'){Copia.salvaUnaCopia();return;}
    if(b.id==='emVia'){via();}});
  $('emModal').addEventListener('change',e=>{const t=e.target;if(!S)return;
    if(t.id==='emMese'){cambiaMese(t.value);return;}
    if(t.dataset.em){S.sel[t.dataset.em]=t.checked;disegna();$('emModal').querySelector(`[data-em="${t.dataset.em}"]`)?.focus();return;}
    if(t.name==='emPdf'){S.pdf=t.value;return;}
    if(t.id==='emSenza'){S.senzaCopia=t.checked;disegna();$('emSenza')?.focus();}});
  // dopo «Salva una copia» (finestra delle copie, sopra questa) la riga diventa «✓ Copia salvata oggi.»
  new MutationObserver(()=>{if(S&&S.passo===2&&$('cpModal').hidden){if(copiaOk())S.copiaFatta=true;disegna();}}).observe($('cpModal'),{attributes:true,attributeFilter:['hidden']});}
bind();
window.EliminaMese={apri,raccogli};
})();
