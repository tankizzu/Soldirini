'use strict';
// ================= Soldirini v15 · lavoro dipendente =================
// Lavori con orario fisso o a turni, calcolo di ore e stipendio (stima), buste paga con archivio su Drive.
// I calcoli sono in stipcalc.js, la lettura delle buste in buste.js.
(function(){
const C=window.StipCalc;
const LAV=()=>D().lavori||(D().lavori={});
const TUR=()=>D().turni||(D().turni={});
const BUS=()=>D().buste||(D().buste={});
const lavori=()=>Object.values(LAV()).filter(l=>!l.deleted).sort((a,b)=>(a.ordine??0)-(b.ordine??0)||a.nome.localeCompare(b.nome));
const lav=id=>LAV()[id];
const turniDi=lid=>Object.values(TUR()).filter(t=>t.lid===lid&&!t.deleted);
const busteDi=lid=>{const o={};for(const [k,b] of Object.entries(BUS()))if(b.lid===lid&&!b.deleted)o[k]=b;return o;};
const nOre=h=>nf(h,h%1?2:0);
const SETT=['','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
window.lavori=lavori;window.turniDi=turniDi;

// ---------- sincronizzazione: i nuovi elenchi si uniscono come gli altri (vince la modifica più recente) ----------
const _merge15=mergeData;
mergeData=function(a,b){const o=_merge15(a,b);if(!b)return o;
  for(const k of new Set([...Object.keys(a||{}),...Object.keys(b||{})]))if(!(k in o)){const x=a?.[k],y=b?.[k];
    o[k]=x&&y&&typeof x==='object'&&!Array.isArray(x)&&typeof y==='object'&&!Array.isArray(y)?mergeMap(x,y):(y??x);}
  return o;};

// ---------- nuovo lavoro ----------
const TIPI_TURNI=()=>[
  {nome:'Mattina',sigla:'M',icona:'☀️',cat:'lavoro',da:'06:00',a:'14:00',colore:'#e0a400'},
  {nome:'Pomeriggio',sigla:'P',icona:'🌇',cat:'lavoro',da:'14:00',a:'22:00',colore:'#e8590c'},
  {nome:'Notte',sigla:'N',icona:'🌙',cat:'lavoro',da:'22:00',a:'06:00',colore:'#4c5fd5'},
  {nome:'Riposo',sigla:'R',icona:'😴',cat:'riposo',colore:'#8a8f98'},
  {nome:'Ferie',sigla:'F',icona:'🏖️',cat:'ferie',colore:'#2f9e44'},
  {nome:'Permesso',sigla:'Pe',icona:'⏱️',cat:'permesso',colore:'#1c7ed6'},
  {nome:'Malattia',sigla:'Ma',icona:'🤒',cat:'malattia',colore:'#c92a2a'}].map(t=>Object.assign({id:uid(),pausa:'',ore:''},t));
const TIPI_FISSO=()=>[
  {nome:'Straordinario',sigla:'S',icona:'➕',cat:'lavoro',aggiunta:true,colore:'#e8590c'},
  {nome:'Ferie',sigla:'F',icona:'🏖️',cat:'ferie',colore:'#2f9e44'},
  {nome:'Permesso',sigla:'Pe',icona:'⏱️',cat:'permesso',colore:'#1c7ed6'},
  {nome:'Malattia',sigla:'Ma',icona:'🤒',cat:'malattia',colore:'#c92a2a'}].map(t=>Object.assign({id:uid(),da:'',a:'',pausa:'',ore:''},t));
function nuovoLavoro(modo){
  const used=new Set([...progetti().map(p=>p.colore),...lavori().map(l=>l.colore)]);
  return {id:uid(),nome:'',colore:COLORI.find(c=>!used.has(c))||COLORI[0],ordine:lavori().length,modo,dal:today().slice(0,7)+'-01',
    paga:{tipo:modo==='fisso'?'mensile':'oraria',importo:'',divisore:168},oreMese:'',oreGiorno:'',settimana:{},tipi:modo==='fisso'?TIPI_FISSO():TIPI_TURNI(),
    magg:{stra:'',nott:'',fest:'',dom:''},nott:{da:'22:00',a:'06:00'},locali:'',ferie:{unita:'giorni',anno:'',residuo:''},perm:{unita:'ore',anno:''},
    tratt:'',contratto:'',drive:null,updatedAt:Date.now()};
}

// ---------- finestre ----------
const MODALI=['lvModal','tuModal','bpModal','bpArch'];
function apri(id){$(id).hidden=false;document.body.classList.add('noscroll');}
function chiudi(id){$(id).hidden=true;if([...MODALI,'evModal','pjModal','cuModal','dayModal','listModal','confModal'].every(x=>!$(x)||$(x).hidden))document.body.classList.remove('noscroll');}

// ================= Impostazioni: elenco e modifica dei lavori =================
function renderLavori(){
  const L=lavori();
  $('lavList').innerHTML=L.map(l=>`<button class="card prow" data-lav="${esc(l.id)}" style="--c:${colOk(l.colore)}"><i></i><span><b>${esc(l.nome||'Lavoro')}</b><small>${l.modo==='fisso'?'orario fisso':'a turni'} · ${l.paga.importo!==''?`paga ${l.paga.tipo==='mensile'?'mensile':'oraria'} ${eur(+l.paga.importo)}`:'paga da impostare'}</small></span><span class="chev">›</span></button>`).join('')
    ||'<p class="muted sm">Se sei dipendente, aggiungi qui il tuo lavoro: a orario fisso oppure a turni. Soldirini calcola ore, straordinari e una stima dello stipendio.</p>';
}
let lv=null; // lavoro in modifica
async function nuovo(){
  const modo=await ask('Come lavori?',[{t:'Annulla',v:null,cls:'ghost'},{t:'A turni',v:'turni',cls:'ghost'},{t:'Orario fisso',v:'fisso'}]);if(!modo)return;
  apriLavoro(nuovoLavoro(modo),true);
}
function apriLavoro(l,isNew){
  lv={l:clone(l),isNew};const x=lv.l;chiudiSezioni($('lvModal')); // v23: sezioni chiuse a ogni apertura
  $('lvTitle').textContent=isNew?'Nuovo lavoro':'Lavoro';$('lvDel').hidden=isNew;
  $('lvNome').value=x.nome;$('lvColore').value=x.colore;
  document.querySelectorAll('[name=lvModo]').forEach(r=>r.checked=r.value===x.modo);
  $('lvPagaTipo').value=x.paga.tipo;$('lvPaga').value=x.paga.importo;$('lvDiv').value=x.paga.divisore||168;
  $('lvOreMese').value=x.oreMese;$('lvOreGiorno').value=x.oreGiorno||'';$('lvOreGiornoErr').hidden=true;notaOreGiorno();$('lvDal').value=x.dal||'';$('lvAl').value=x.al||'';
  for(const k of ['stra','nott','fest','dom'])$('lvM-'+k).value=x.magg[k]??'';
  $('lvNottDa').value=x.nott?.da||'';$('lvNottA').value=x.nott?.a||'';
  $('lvLocali').value=x.locali||'';$('lvFerieU').value=x.ferie.unita;$('lvFerieA').value=x.ferie.anno;$('lvFerieR').value=x.ferie.residuo;
  document.querySelectorAll('[name=lvCalMostra]').forEach(r=>r.checked=r.value===calMostra(x));$('lvPermU').value=x.perm.unita;$('lvPermA').value=x.perm.anno;$('lvTratt').value=x.tratt;$('lvContratto').value=x.contratto||'';
  docRis=null;lv.pendBusta=null;lv.pendContr=null;$('lvDocRis').innerHTML='';$('lvDocProg').hidden=true;
  $('lvContrFile').innerHTML=x.contrattoFile?(x.contrattoFile.file?.link?`Contratto su Drive: <a href="${esc(x.contrattoFile.file.link)}" target="_blank" rel="noopener">${esc(x.contrattoFile.nome)} ↗</a>`:`Contratto “${esc(x.contrattoFile.nome)}” da caricare su Drive`):'';
  renderSett();renderTipi();aggiornaModo();apri('lvModal');
}
// 24c.1 (02, tornata 30 §1): "Ore di una giornata", solo a turni. Vuoto = valido; altrimenti un numero tra 0,5 e 24 (con la virgola)
const oreGiornoOk=v=>{v=String(v||'').trim();if(!v)return true;if(!/^\d{1,2}([.,]\d{1,2})?$/.test(v))return false;const n=C.num(v);return n>=0.5&&n<=24;};
function notaOreGiorno(){$('lvOreGiornoVuoto').hidden=!!$('lvOreGiorno').value.trim()||!C.num($('lvOreMese').value);}
function controllaOreGiorno(){const ok=oreGiornoOk($('lvOreGiorno').value);$('lvOreGiornoErr').hidden=ok;$('lvOreGiorno').setAttribute('aria-invalid',String(!ok));return ok;}
function aggiornaModo(){const m=document.querySelector('[name=lvModo]:checked')?.value||lv.l.modo;lv.l.modo=m;
  $('lvFissoBox').hidden=m!=='fisso';$('lvTurniBox').hidden=m!=='turni';$('lvOreGiornoBox').hidden=m!=='turni';const pt=$('lvPagaTipo').value;$('lvDivBox').hidden=pt==='oraria';$('lvDivBox').firstChild.nodeValue=pt==='giornaliera'?'Ore di una giornata (per calcolare straordinari e maggiorazioni)':'Ore al mese per la paga oraria (divisore del contratto)';$('lvDiv').placeholder=pt==='giornaliera'?'8':'168';
  $('lvTipiTit').textContent=m==='fisso'?'Eccezioni (straordinari, ferie, permessi…)':'Tipi di turno';}
function renderSett(){const S=lv.l.settimana||{};
  $('lvSett').innerHTML=[1,2,3,4,5,6,7].map(d=>{const s=S[d]||{};return `<div class="srow" data-d="${d}"><b>${SETT[d].slice(0,3)}</b><input type="time" data-k="da" value="${esc(s.da||'')}" aria-label="${SETT[d]} dalle"><input type="time" data-k="a" value="${esc(s.a||'')}" aria-label="${SETT[d]} alle"><input type="number" inputmode="numeric" min="0" step="5" data-k="pausa" value="${esc(s.pausa??'')}" placeholder="pausa" aria-label="${SETT[d]} pausa in minuti"></div>`;}).join('');}
function leggiSett(){const S={};document.querySelectorAll('#lvSett .srow').forEach(r=>{const v=k=>r.querySelector(`[data-k=${k}]`).value;if(v('da')&&v('a'))S[r.dataset.d]={da:v('da'),a:v('a'),pausa:v('pausa')};});return S;}
const CAT_OPT=Object.entries(C.CAT).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');
function renderTipi(){
  $('lvTipi').innerHTML=lv.l.tipi.map((t,i)=>`<div class="trow" data-i="${i}">
    <div class="trh"><input data-k="icona" value="${esc(t.icona||'')}" class="ico" aria-label="Icona" maxlength="4"><input data-k="nome" value="${esc(t.nome)}" placeholder="Nome" aria-label="Nome"><input data-k="sigla" value="${esc(t.sigla||'')}" placeholder="Sigla" class="sig" maxlength="3" aria-label="Sigla"><input type="color" data-k="colore" value="${esc(t.colore||'#888888')}" aria-label="Colore"><button type="button" class="x" data-trm="${i}" aria-label="Togli">×</button></div>
    <div class="trb"><select data-k="cat" aria-label="Tipo">${CAT_OPT}</select>${(()=>{const orari=t.cat==='lavoro',ore=['variabile','permesso','nonretr','retribuita'].includes(t.cat)||t.aggiunta;
      return `<input type="time" data-k="da" value="${esc(t.da||'')}" aria-label="Dalle" ${orari?'':'hidden'}><input type="time" data-k="a" value="${esc(t.a||'')}" aria-label="Alle" ${orari?'':'hidden'}><input type="number" data-k="pausa" value="${esc(t.pausa??'')}" placeholder="pausa min" aria-label="Pausa in minuti" ${orari?'':'hidden'}><input type="number" step="0.25" data-k="ore" value="${esc(t.ore??'')}" placeholder="ore (vuoto = le scrivi ogni volta)" aria-label="Ore" ${ore?'':'hidden'}>`;})()}</div>
    <label class="check sm" ${t.cat==='lavoro'&&lv.l.modo==='fisso'?'':'hidden'}><input type="checkbox" data-k="aggiunta" ${t.aggiunta?'checked':''}> Si aggiunge all’orario (straordinario)</label></div>`).join('');
  document.querySelectorAll('#lvTipi .trow').forEach(r=>r.querySelector('[data-k=cat]').value=lv.l.tipi[+r.dataset.i].cat);
}
function leggiTipi(){document.querySelectorAll('#lvTipi .trow').forEach(r=>{const t=lv.l.tipi[+r.dataset.i];r.querySelectorAll('[data-k]').forEach(f=>{t[f.dataset.k]=f.type==='checkbox'?f.checked:f.value.trim();});});}
function leggiLavoro(){
  const x=lv.l;leggiTipi();
  x.nome=$('lvNome').value.trim();x.colore=$('lvColore').value;x.modo=document.querySelector('[name=lvModo]:checked').value;
  x.paga={tipo:$('lvPagaTipo').value,importo:$('lvPaga').value.trim(),divisore:$('lvDiv').value.trim()||168};
  x.oreMese=$('lvOreMese').value.trim();x.oreGiorno=$('lvOreGiorno').value.trim();x.dal=$('lvDal').value;x.al=$('lvAl').value;x.settimana=leggiSett();
  x.magg={};for(const k of ['stra','nott','fest','dom'])x.magg[k]=$('lvM-'+k).value.trim();
  x.nott={da:$('lvNottDa').value,a:$('lvNottA').value};x.locali=$('lvLocali').value.trim();
  x.ferie={unita:$('lvFerieU').value,anno:$('lvFerieA').value.trim(),residuo:$('lvFerieR').value.trim()};
  x.perm={unita:$('lvPermU').value,anno:$('lvPermA').value.trim()};if(x.modo==='fisso')x.calMostra=document.querySelector('[name=lvCalMostra]:checked')?.value||'diversi';x.tratt=$('lvTratt').value.trim();x.contratto=$('lvContratto').value.trim();
  x.tipi=x.tipi.filter(t=>t.nome);
  return x;
}
function salvaLavoro(){
  const x=leggiLavoro();if(!x.nome){toast('Scrivi il nome del lavoro (es. il datore di lavoro).','err');$('lvNome').focus();return;}
  if(x.modo==='turni'&&!controllaOreGiorno()){const d=$('lvOreGiornoBox').closest('details');if(d)d.open=true;$('lvOreGiorno').focus();return;}
  if(x.modo==='fisso'&&!Object.keys(x.settimana).length){toast('Scrivi l’orario di almeno un giorno della settimana.','err');return;}
  x.updatedAt=Date.now();LAV()[x.id]=x;changed();chiudi('lvModal');render();toast('Lavoro salvato.');
  salvaDocInAttesa(x.id).catch(e=>toast(errMsg(e),'err'));
}
async function eliminaLavoro(){
  if(!await conferma(`Eliminare “${lv.l.nome}”? Spariscono anche i suoi turni e le buste dall’app (i file su Drive restano).`,'Elimina','danger'))return;
  const now=Date.now();const x=LAV()[lv.l.id];if(x){x.deleted=true;x.updatedAt=now;}
  for(const t of turniDi(lv.l.id)){t.deleted=true;t.updatedAt=now;}
  for(const b of Object.values(busteDi(lv.l.id))){b.deleted=true;b.updatedAt=now;}
  changed();chiudi('lvModal');render();toast('Lavoro eliminato.');
}

// ================= calendario =================
// v22 (D-034, D-038): ogni turno è un riquadro con icona e sigla (sul telefono) o nome intero (schermi larghi);
// i giorni normali del lavoro a orario fisso, se l'utente sceglie "solo i giorni diversi", sono una barretta.
const MESI_N=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
const dataLunga=iso=>{const [y,m,d]=iso.split('-').map(Number);const g=(new Date(y,m-1,d).getDay()+6)%7+1;return `${SETT[g]} ${d} ${MESI_N[m-1]}`;};
const oraBreve=h=>!h?'':h.replace(/^0(?=\d)/,'').replace(/:00$/,'');
const calMostra=l=>l.calMostra==='tutti'?'tutti':'diversi';
window.etichettaTurno=function(l,v){
  let ico='',sig,nome,full;
  if(v.implicito){const o=(v.a<=v.da?v.a+1440:v.a)-v.da-(v.pausa||0);sig=nome=nOre(Math.round(o/60*100)/100)+'h';ico='💼';
    full=`${l.nome}, orario abituale ${oraBreve(v.daS)}–${oraBreve(v.aS)}`;}
  else if(v.tipo){ico=v.tipo.icona||'';sig=v.tipo.sigla||v.tipo.nome;nome=v.tipo.nome;
    full=`${l.nome}, ${v.tipo.nome}${v.daS&&v.aS?' '+oraBreve(v.daS)+'–'+oraBreve(v.aS):''}`;}
  else{sig=`${oraBreve(v.daS)}–${oraBreve(v.aS)}`;nome=`${v.daS||''}–${v.aS||''}`;full=`${l.nome}, turno ${sig}`;}
  const bar=v.implicito&&l.modo==='fisso'&&calMostra(l)==='diversi';
  return {bar,full,html:`<span class="ev tu${v.implicito?' imp':''}${bar?' bar':''}" data-lid="${esc(l.id)}" style="--c:${colOk(v.colore||l.colore)}" title="${esc(full)}">${ico?`<span class="tui" aria-hidden="true">${esc(ico)}</span>`:''}<span class="tus" aria-hidden="true">${esc(sig)}</span><span class="tun" aria-hidden="true">${esc(nome)}</span><span class="vh">${esc(full)}</span></span>`};
};
const _renderCal15=renderCal;
renderCal=function(){
  _renderCal15();
  // etichetta per il lettore di schermo: "Lunedì 9 novembre" prima del contenuto della casella
  document.querySelectorAll('#grid [data-day]').forEach(b=>{const n=b.querySelector('.n');if(n&&!n.hasAttribute('aria-hidden')){n.setAttribute('aria-hidden','true');n.insertAdjacentHTML('afterend',`<span class="vh">${dataLunga(b.dataset.day)}</span>`);}});
  const L=lavori();if(!L.length)return;
  const per={};
  for(const l of L){if(window.lavoroNascosto?.(l.id))continue;const ts=turniDi(l.id).filter(t=>t.data.startsWith(cur));const byD={};for(const t of ts)(byD[t.data]=byD[t.data]||[]).push(t);
    for(let d=1;d<=new Date(+cur.slice(0,4),+cur.slice(5),0).getDate();d++){const iso=`${cur}-${pad(d)}`;const G=C.vociGiorno(l,byD[iso]||[],iso);
      for(const v of G.voci)(per[iso]=per[iso]||[]).push(etichettaTurno(l,v));}}
  document.querySelectorAll('#grid [data-day]').forEach(b=>{const x=per[b.dataset.day];if(!x)return;
    // al massimo due riquadri; le barrette (giorni normali) non contano
    const box=x.filter(e=>!e.bar),bar=x.filter(e=>e.bar);const vis=box.slice(0,2),altri=box.slice(2);
    const h=bar.map(e=>e.html).join('')+vis.map(e=>e.html).join('')+(altri.length?`<span class="more tumore" aria-hidden="true">+${altri.length}</span><span class="vh">${esc(altri.map(e=>e.full).join('; '))}</span>`:'');
    b.querySelector('.evs').insertAdjacentHTML('afterbegin',h);});
};
// riepilogo del giorno: turni e scelta veloce
const _apriGiorno15=apriGiorno;
apriGiorno=function(d){_apriGiorno15(d);renderTurniGiorno(d);};
function renderTurniGiorno(d){
  let box=$('dayTurni');if(!box){box=document.createElement('div');box.id='dayTurni';$('dayBox').insertBefore(box,$('dayList'));}
  const L=lavori();if(!L.length){box.innerHTML='';return;}
  box.innerHTML=L.map(l=>{const G=C.vociGiorno(l,turniDi(l.id).filter(t=>t.data===d),d);
    const voci=G.voci.map(v=>`<div class="tuv" style="--c:${colOk(v.colore||l.colore)}"><span class="bar"></span><span class="tx"><b>${esc((v.tipo?.icona?v.tipo.icona+' ':'')+v.nome)}</b><small>${v.daS&&v.aS?esc(v.daS+'–'+v.aS):''}${v.ore!=null?` · ${nOre(v.ore)} ore`:''}${v.implicito?' · orario abituale':''}${v.nota?' · '+esc(v.nota):''}</small></span>${v.id?`<button class="btn ghost sm" data-tued="${esc(l.id)}|${esc(v.id)}">Modifica</button>`:''}</div>`).join('');
    return `<div class="tubox"><div class="tuh" style="--c:${colOk(l.colore)}"><i></i><b>${esc(l.nome)}</b>${G.fest?`<small class="muted">${esc(G.fest)}</small>`:''}</div>${voci||'<p class="muted sm">Niente in questo giorno.</p>'}
      <div class="tuchips">${l.tipi.map(t=>`<button class="chip" style="--c:${colOk(t.colore||l.colore)}" data-tuq="${esc(l.id)}|${esc(t.id)}">${esc((t.icona?t.icona+' ':'')+t.nome)}</button>`).join('')}<button class="chip" data-tuq="${esc(l.id)}|">Altro…</button>${l.modo==='turni'?`<button class="chip" data-ftopen="${esc(l.id)}">📷 Da foto</button>`:''}</div></div>`;}).join('');
}
// un tocco su un tipo: lo metto nel giorno (se servono le ore, apro la finestra)
// D-118: a turni Permesso e Assenza non pagata si salvano anche senza ore (valgono le "Ore di una giornata", come ferie e malattia)
function serveOre(t,l){if(t&&l&&l.modo==='turni'&&(t.cat==='permesso'||t.cat==='nonretr'))return false;
  return !t||((t.cat==='variabile'||t.cat==='permesso'||t.aggiunta||t.cat==='nonretr')&&!(t.da&&t.a)&&t.ore==='');}
function metti(lid,date,tipoId,extra={}){
  const l=lav(lid);const t=C.tipoDi(l,tipoId);const now=Date.now();
  for(const d of date){
    // un turno normale sostituisce quelli già presenti; uno "in aggiunta" si somma
    if(!t?.aggiunta)for(const x of turniDi(lid).filter(x=>x.data===d)){const tx=C.tipoDi(l,x.tipo);if(!tx?.aggiunta||!t){x.deleted=true;x.updatedAt=now;}}
    const id=uid();TUR()[id]=Object.assign({id,lid,data:d,tipo:tipoId||null,da:'',a:'',pausa:'',ore:'',nota:'',updatedAt:now},extra);
  }
  changed();
}

// ================= finestra turno (uno o più giorni) =================
let tu=null;
function apriTurno(dates,lid,turno){
  const L=lavori();if(!L.length){toast('Prima aggiungi il tuo lavoro in Impostazioni.','err');return;}
  tu={dates,lid:lid||L[0].id,id:turno?.id||null,tipo:turno?turno.tipo:(L.find(l=>l.id===lid)||L[0]).tipi[0]?.id||null};
  $('tuTitle').textContent=turno?'Modifica turno':dates.length>1?`Turno · ${dates.length} giorni`:'Turno · '+(()=>{const d=parseYmd(dates[0]);return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`;})();
  $('tuLavBox').hidden=L.length<2;$('tuLav').innerHTML=L.map(l=>`<option value="${esc(l.id)}">${esc(l.nome)}</option>`).join('');$('tuLav').value=tu.lid;
  $('tuDa').value=turno?.da||'';$('tuA').value=turno?.a||'';$('tuPausa').value=turno?.pausa||'';$('tuOre').value=turno?.ore||'';$('tuNota').value=turno?.nota||'';
  $('tuDel').hidden=!turno;$('tuClear').hidden=!!turno;
  renderTuTipi();apri('tuModal');
}
// 24c.1 (02, tornata 30 §3): sotto le ore di un'assenza, a turni. HTML con soli numeri e mese (nessun testo dell'utente)
const oreTesto=n=>String(r2(n)).replace('.',',');
function testoAssenza(l,t,ym,attivita){ // attivita: testo di Nuova attività (02, tornata 31 §3: "Lascia vuote le ore…")
  if(!l||l.modo!=='turni'||!t||!(C.PAGATE.includes(t.cat)||t.cat==='nonretr')||serveOre(t,l))return null;
  const fisso='Se scrivi le ore o «dalle–alle», conta solo quella parte e i turni di lavoro restano.';
  const lv=attivita?'Lascia vuote le ore':'Lascia vuoto';
  // quarta variante (04, tornata 31 §2; provvisoria, 02 può ritoccarla): il tipo ha già le ore o "dalle–alle" (punti 3-4 di R-TURNI-1)
  const delTipo=C.oreAssenza(l,{},t,ym+'-01');if(delTipo.punto===3||delTipo.punto===4)return `${lv} per contare le ore del tipo «${esc(t.nome)}»: <b>${oreTesto(delTipo.ore)} ore</b>. I turni di lavoro di questo giorno restano.`;
  const og=C.num(l.oreGiorno),om=C.num(l.oreMese);
  if(og>0)return `${lv} per contare una giornata intera: <b>${oreTesto(og)} ore</b>. In quel caso i turni di lavoro di questo giorno non contano.<br>${fisso}`;
  if(om>0){const g=C.giorniLavorativi(ym,C.parseLocali(l.locali));if(g)return `${lv} per contare una giornata intera: <b>${oreTesto(om/g)} ore</b> a ${MESI[+ym.slice(5,7)-1]}, calcolate dalle ore al mese del lavoro. In quel caso i turni di lavoro di questo giorno non contano.<br>${fisso}`;}
  return `${lv} per contare una giornata intera. Prima scrivi le «Ore di una giornata» nel lavoro: senza, il giorno conta 0 ore.<br>${fisso}`;
}
window.testoAssenza=testoAssenza;window.serveOre=serveOre; // usati anche da Nuova attività (attivita.js)
function renderTuTipi(){const l=lav(tu.lid);
  $('tuTipi').innerHTML=l.tipi.map(t=>`<button type="button" class="chip ${tu.tipo===t.id?'on':''}" style="--c:${colOk(t.colore||l.colore)}" data-tut="${esc(t.id)}">${esc((t.icona?t.icona+' ':'')+t.nome)}</button>`).join('')+`<button type="button" class="chip ${tu.tipo===null?'on':''}" data-tut="">Orario diverso</button>`;
  const t=C.tipoDi(l,tu.tipo);const ass=!serveOre(t,l)?testoAssenza(l,t,tu.dates[0].slice(0,7)):null;
  $('tuOrari').hidden=!ass&&!!t&&!!(t.da&&t.a)&&t.cat!=='lavoro'&&!t.aggiunta; // a turni l'assenza con "dalle–alle" nel tipo mostra i campi: "Lascia vuoto" deve avere un campo
  if(ass){$('tuHint').innerHTML=ass;return;}
  $('tuHint').textContent=!t?'Scrivi l’orario di questo giorno: sostituisce quello abituale.':t.da&&t.a?`Orario del tipo: ${t.da}–${t.a}. Cambialo qui solo se quel giorno è diverso.`:serveOre(t,l)?'Scrivi le ore (oppure dalle–alle).':C.PAGATE.includes(t.cat)||t.cat==='nonretr'?'Lascia vuoto per contare l’orario abituale del giorno.':'';
}
function salvaTurno(){
  const extra={da:$('tuDa').value,a:$('tuA').value,pausa:$('tuPausa').value.trim(),ore:$('tuOre').value.trim(),nota:$('tuNota').value.trim()};
  const l=lav(tu.lid),t=C.tipoDi(l,tu.tipo);
  if(!t&&!(extra.da&&extra.a)&&!extra.ore){toast('Scrivi l’orario (dalle–alle) o le ore.','err');return;}
  if(t&&serveOre(t,l)&&!(extra.da&&extra.a)&&!extra.ore){toast('Scrivi quante ore (oppure dalle–alle).','err');return;}
  if(tu.id){const x=TUR()[tu.id];Object.assign(x,extra,{tipo:tu.tipo||null,lid:tu.lid,updatedAt:Date.now()});changed();}
  else metti(tu.lid,tu.dates,tu.tipo,extra);
  chiudi('tuModal');if(multi)esciMulti();render();if(!$('dayModal').hidden)renderTurniGiorno(selDay);toast(tu.dates.length>1?`Turno messo in ${tu.dates.length} giorni.`:'Turno salvato.');
}
function togliTurno(){if(tu.id){const x=TUR()[tu.id];x.deleted=true;x.updatedAt=Date.now();}else{const now=Date.now();for(const d of tu.dates)for(const x of turniDi(tu.lid).filter(x=>x.data===d)){x.deleted=true;x.updatedAt=now;}}
  changed();chiudi('tuModal');if(multi)esciMulti();render();if(!$('dayModal').hidden)renderTurniGiorno(selDay);toast('Tolto.');}

// ================= riepilogo =================
function datiMese(l,ym){const M=C.calcolaMese(l,turniDi(l.id),ym);const B=busteDi(l.id);const tr=C.trattenute(l,B);const b=B[`${l.id}|${ym}`];
  return {M,tr,netto:M.lordo!=null&&tr?r2(M.lordo*(1-tr.p)):null,busta:b,saldi:C.saldi(l,turniDi(l.id),B,ym)};}
window.datiMeseLavoro=datiMese;
function cardMese(l,ym){
  const {M,tr,netto,busta,saldi}=datiMese(l,ym);const T=M.T;const kv=(a,b)=>`<div class="kv"><span>${a}</span><b>${b}</b></div>`;
  const ore=[`${nOre(T.lav)} ore lavorate`,T.stra?`${nOre(T.stra)} di straordinario`:'',T.nott?`${nOre(T.nott)} notturne`:'',T.fest?`${nOre(T.fest)} festive`:'',T.dom?`${nOre(T.dom)} di domenica`:''].filter(Boolean);
  const ass=[T.ferie?`${T.ferie} ${T.ferie===1?'giorno':'giorni'} di ferie`:'',T.perm?`${nOre(T.perm)} ore di permesso`:'',T.mal?`${nOre(T.mal)} ore di malattia`:'',T.nonretr?`${nOre(T.nonretr)} ore non pagate`:''].filter(Boolean);
  const mg=(k,lab)=>M.magg[k]==null&&T[k==='stra'?'stra':k]?`<p class="muted sm">${lab}: maggiorazione non impostata, contata come ora normale.</p>`:'';
  const E=M.E;const voce=(t,v)=>v?kv(t,eur(v)):'';
  const sal=[saldi.ferie?`Ferie: ${nOre(saldi.ferie.saldo)} ${saldi.ferie.unita}`:'',saldi.rol?`Permessi: ${nOre(saldi.rol.saldo)} ${saldi.rol.unita}`:'',saldi.exfest?`Ex festività: ${nOre(saldi.exfest.saldo)} ${saldi.exfest.unita}`:''].filter(Boolean);
  const diff=busta&&M.lordo!=null&&busta.lordo!==''?r2(+busta.lordo-M.lordo):null;
  return `<div class="card lavcard" data-lavcard="${esc(l.id)}" style="--c:${colOk(l.colore)}"><h3><i></i><span>${esc(l.nome)} <small class="muted">· lavoro dipendente</small></span></h3>
    ${kv('Giorni lavorati',T.giorniLav)}${kv('Ore',ore.join(' · ')||'0')}${ass.length?kv('Assenze',ass.join(' · ')):''}
    ${M.lordo!=null?`${voce('Paga base',E.base)}${voce('Straordinari',E.stra)}${voce('Notturno',E.nott)}${voce('Festivi',E.fest)}${voce('Domeniche',E.dom)}
      <div class="kv big"><span>Lordo stimato</span><b>${eur(M.lordo)}</b></div>${netto!=null?`<div class="kv"><span>Netto stimato</span><b>${eur(netto)}</b></div><p class="muted sm">Trattenute ${nf(tr.p*100,1)}% ${tr.fonte==='busta'?'ricavate dalla busta di '+esc(monthName(tr.mese)):'impostate nel lavoro'}.</p>`:'<p class="muted sm">Carica una busta paga per stimare anche il netto.</p>'}
      ${mg('stra','Straordinario')}${mg('nott','Notturno')}${mg('fest','Festivi')}${mg('dom','Domeniche')}`
    :'<p class="muted sm">Imposta la paga nel lavoro (Impostazioni) per vedere la stima dello stipendio.</p>'}
    ${busta?`<div class="kv"><span>Busta paga</span><b>${busta.netto!==''?'netto '+eur(+busta.netto):''}${busta.lordo!==''?' · lordo '+eur(+busta.lordo):''}</b></div>${diff!=null&&Math.abs(diff)>=1?`<p class="sm ${diff<0?'warn':'muted'}">${diff<0?'In busta ci sono '+eur(-diff)+' in meno della stima: controlla straordinari e ore.':'In busta ci sono '+eur(diff)+' in più della stima.'}</p>`:''}`:''}
    ${sal.length?`<p class="muted sm">Saldi: ${sal.join(' · ')}</p>`:''}
    <p class="muted sm">Stima: per i valori esatti fa fede la busta paga.</p>
    ${(window.Entrate?Entrate.rigaStato(`lav|${l.id}|${ym}`):'')}
    <div class="acts"><button class="btn sm" data-bpnew="${esc(l.id)}">${busta?'Sostituisci busta':'Carica busta paga'}</button><button class="btn ghost sm" data-bparch="${esc(l.id)}">Archivio buste</button>${l.modo==='turni'?`<button class="btn ghost sm" data-ftopen="${esc(l.id)}">📷 Turni da foto</button>`:''}</div></div>`;
}
function cardAnno(l,y){
  const righe=[];let tl=0,to=0,tb=0;const B=busteDi(l.id);
  for(let m=1;m<=12;m++){const ym=`${y}-${pad(m)}`;const M=C.calcolaMese(l,turniDi(l.id),ym);const b=B[`${l.id}|${ym}`];if(!M.T.lav&&!M.T.pagate&&!b)continue;
    tl+=M.lordo||0;to+=M.T.lav;tb+=b&&b.netto!==''?+b.netto:0;
    righe.push(`<div class="kv"><span>${MESI[m-1][0].toUpperCase()+MESI[m-1].slice(1)}</span><b>${nOre(M.T.lav)} ore${M.lordo!=null?' · '+eur(M.lordo):''}${b&&b.netto!==''?' · busta '+eur(+b.netto):''}</b></div>`+(ym<=today().slice(0,7)?(window.Entrate?Entrate.rigaStato(`lav|${l.id}|${ym}`):''):''));}
  return `<div class="card lavcard" style="--c:${colOk(l.colore)}"><h3><i></i>${esc(l.nome)} · ${y}</h3>${righe.join('')||'<p class="muted">Niente in questo anno.</p>'}
    <div class="kv big"><span>Totale</span><b>${nOre(r2(to))} ore${tl?' · lordo stimato '+eur(r2(tl)):''}</b></div>${tb?`<div class="kv"><span>Netto dalle buste</span><b>${eur(r2(tb))}</b></div>`:''}
    <div class="acts"><button class="btn ghost sm" data-bparch="${esc(l.id)}">Archivio buste</button></div></div>`;
}
// netto del mese di un lavoro: dalla busta se c'è, altrimenti la stima (netto, o lordo se manca il netto)
function nettoMese(l,ym){const {M,netto,busta}=datiMese(l,ym);if(busta&&busta.netto!=='')return {v:+busta.netto,fonte:'busta'};if(netto!=null)return {v:netto,fonte:'stima'};if(M.lordo)return {v:M.lordo,fonte:'lordo'};return {v:0,fonte:null};}
function totaleLavoro(periodo){const L=lavori();let v=0,stima=false;
  for(const l of L){const mesi=periodo.length===4?Array.from({length:12},(_,i)=>`${periodo}-${pad(i+1)}`):[periodo];
    for(const ym of mesi){const n=nettoMese(l,ym);v+=n.v;if(n.fonte&&n.fonte!=='busta')stima=true;}}return {v:r2(v),stima};}
window.totaleLavoro=totaleLavoro;
const _renderRie15=renderRiepilogo;
renderRiepilogo=function(){_renderRie15();const L=lavori();let box=$('rieLav');
  // 24b.1 (D-098): il contenitore è nella pagina "Lavoro dipendente"
  if(!L.length){box.innerHTML='';return;}
  const anno=rieMode==='anno',y=cur.slice(0,4);
  // 24c.1 (02, tornata 30 §2): riquadro arancio per ogni lavoro a turni con assenze contate 0 ore nel mese (punto 8 di R-TURNI-1)
  const avvisi=anno?'':L.filter(l=>l.modo==='turni').map(l=>{const n=C.calcolaMese(l,turniDi(l.id),cur).T.senzaOre;if(!n)return '';
    return `<div class="vcavv avvore" role="note" data-avvore="${esc(l.id)}"><b>⚠ ${n===1?'1 giorno di assenza contato 0 ore':n+' giorni di assenza contati 0 ore'}</b><p class="sm">Nel lavoro «${esc(l.nome||'Lavoro')}» manca quante ore vale una giornata. Finché manca, ferie, malattia e altre assenze senza ore non entrano nella stima né nei saldi.</p><button type="button" class="btn ghost sm" data-oregiorno="${esc(l.id)}" aria-label="Scrivi le ore di una giornata per il lavoro ${esc(l.nome||'Lavoro')}">Scrivi le ore di una giornata</button></div>`;}).join('');
  box.innerHTML=avvisi+L.map(l=>{const h=anno?cardAnno(l,y):cardMese(l,cur);const n=anno?null:nettoMese(l,cur);
    return h.replace('<div class="card lavcard"',`<div class="card lavcard" data-fid="lav-${esc(l.id)}" data-sum="${n&&n.v?eur(n.v):''}"`);}).join('');
  foldify(box,'lav');
  // totali generali: progetti + lavoro dipendente
  const T=totaleLavoro(anno?y:cur);if(!T.v)return;
  const hero=$('rieTot').querySelector('.hero');if(!hero)return;const prima=hero.firstElementChild?.querySelector('b');
  if(prima){const base=+(prima.textContent.replace(/[^\d,-]/g,'').replace(',','.'))||0;prima.textContent=eur(r2(base+T.v));}
  hero.insertAdjacentHTML('beforeend',`<div><small>Lavoro dipendente${T.stima?' (stima)':''}</small><b>${eur(T.v)}</b></div>`);};

// ================= buste paga =================
// file in attesa di caricamento su Drive (restano sul telefono finché non vanno su Drive)
const fdb=()=>new Promise((ok,ko)=>{const r=indexedDB.open('soldirini-file',1);r.onupgradeneeded=()=>r.result.createObjectStore('f');r.onsuccess=()=>ok(r.result);r.onerror=()=>ko(r.error);});
async function fset(k,v){const d=await fdb();return new Promise(ok=>{const t=d.transaction('f','readwrite');if(v===undefined)t.objectStore('f').delete(k);else t.objectStore('f').put(v,k);t.oncomplete=ok;t.onerror=ok;});}
async function fget(k){const d=await fdb();return new Promise(ok=>{const t=d.transaction('f').objectStore('f').get(k);t.onsuccess=()=>ok(t.result);t.onerror=()=>ok(undefined);});}
window.soldiriniFile={fset,fget};
// cartelle: Soldirini / <lavoro> / Buste paga / <anno>
async function cartellaBuste(l,anno){
  const x=LAV()[l.id];const dr=x.drive=x.drive||{};
  if(!(dr.cartella?.id&&await exists(dr.cartella.id))){const root=D().root?.id;if(!root)throw new Error('Manca la cartella Soldirini su Drive.');const f=await createFolder(x.nome,root,{soldirini:'lavoro',lid:x.id});dr.cartella={id:f.id,link:f.webViewLink};dr.buste=null;dr.anni={};}
  if(!(dr.buste?.id&&await exists(dr.buste.id))){const f=await createFolder('Buste paga',dr.cartella.id,{soldirini:'buste'});dr.buste={id:f.id,link:f.webViewLink};dr.anni={};}
  dr.anni=dr.anni||{};if(!(dr.anni[anno]&&await exists(dr.anni[anno]))){const f=await createFolder(String(anno),dr.buste.id,{soldirini:'buste-anno'});dr.anni[anno]=f.id;}
  x.updatedAt=Date.now();return dr.anni[anno];
}
async function caricaSuDrive(key){
  const b=BUS()[key];const f=await fget(key);if(!b||!f)return false;const l=lav(b.lid);if(!l)return false;
  const anno=b.mese.slice(0,4);const parent=await cartellaBuste(l,anno);
  const est=(f.nome.match(/\.([a-z0-9]{2,4})$/i)||[,'pdf'])[1].toLowerCase();const name=`Busta paga ${MESI[+b.mese.slice(5)-1]} ${anno}.${est}`;
  let r;if(b.file?.id&&await exists(b.file.id))r=await uploadUpdate(b.file.id,{name},f.blob,f.tipo||'application/pdf');
  else r=await uploadNew({name,parents:[parent]},f.blob,f.tipo||'application/pdf');
  b.file={id:r.id,link:r.webViewLink,name};b.daCaricare=false;b.updatedAt=Date.now();await fset(key,undefined);changed();return true;
}
async function caricaContratto(lid){
  const x=LAV()[lid];const f=await fget('contr|'+lid);if(!x||!f)return false;const dr=x.drive=x.drive||{};
  await cartellaBuste(x,new Date().getFullYear()); // crea la cartella del lavoro se manca
  if(!(dr.contratto?.id&&await exists(dr.contratto.id))){const c=await createFolder('Contratto',dr.cartella.id,{soldirini:'contratto'});dr.contratto={id:c.id,link:c.webViewLink};}
  const r=await uploadNew({name:f.nome,parents:[dr.contratto.id]},f.blob,f.tipo||'application/pdf');
  x.contrattoFile={nome:f.nome,file:{id:r.id,link:r.webViewLink},daCaricare:false};x.updatedAt=Date.now();await fset('contr|'+lid,undefined);changed();return true;
}
async function caricaPendenti(silenzioso){
  for(const l of lavori())if(l.contrattoFile?.daCaricare&&DB.meta.account&&navigator.onLine){try{await caricaContratto(l.id);}catch(e){console.warn(e);}}
  const keys=Object.keys(BUS()).filter(k=>BUS()[k].daCaricare&&!BUS()[k].deleted);if(!keys.length){if(!silenzioso)toast('Tutte le buste sono già su Drive.');return 0;}
  if(!DB.meta.account||!navigator.onLine){if(!silenzioso)toast('Serve la connessione e l’accesso con Google.','err');return 0;}
  let n=0;if(!silenzioso)busy(true,'Salvo le buste su Drive…');
  try{for(const k of keys){try{if(await caricaSuDrive(k))n++;}catch(e){if(!silenzioso)throw e;console.warn(e);}}}
  catch(e){toast(errMsg(e),'err');}finally{if(!silenzioso)busy(false);}
  if(n&&!silenzioso)toast(n===1?'1 busta salvata su Drive.':`${n} buste salvate su Drive.`);if(n)render();return n;
}
const _processQueue15=processQueue;
processQueue=async function(){const r=await _processQueue15();await codaPasso('buste',()=>caricaPendenti(true));return r;};

let bp=null;
function apriBusta(lid,mese,esistente){
  bp={lid,file:null,key:esistente?`${lid}|${mese}`:null};$('bpRis').hidden=true;
  $('bpTit').textContent='Busta paga · '+lav(lid).nome;$('bpStep1').hidden=!!esistente;$('bpStep2').hidden=!esistente;$('bpProg').hidden=true;$('bpErr').hidden=true;
  const b=esistente?BUS()[bp.key]:{};
  $('bpMese').value=mese||cur;document.querySelectorAll('#bpModal .manca').forEach(e=>e.classList.remove('manca'));for(const k of ['lordo','trattenute','netto','ferie','rol','exfest'])$('bp-'+k).value=b?.[k]??'';
  $('bpUF').value=b?.unitaFerie||lav(lid).ferie.unita;$('bpUP').value=b?.unitaPerm||lav(lid).perm.unita;
  for(const k of PEN_B)$('bp-'+k).value=b?.[k]??'';bp.dc=[...(b?.daControllare||[])];
  $('bpPenNota').hidden=!(esistente&&PEN_B.every(k=>(b?.[k]??'')===''));penBusta();
  $('bpNote').textContent=esistente?'':'';apri('bpModal');
}
async function leggiBusta(file){
  bp.file=file;$('bpStep1').hidden=true;$('bpProg').hidden=false;$('bpErr').hidden=true;
  const prog=(p,t)=>{$('bpBar').style.width=Math.round(p*100)+'%';if(t)$('bpFase').textContent=t;};
  let r={};try{const pezzi=await Buste.testoBusta(file,prog);prog(.95,'Cerco le voci…');r=Buste.analizzaBusta(pezzi);}
  catch(e){$('bpErr').textContent='Non sono riuscito a leggerla ('+errMsg(e)+'): scrivi tu i valori, la archivio lo stesso.';$('bpErr').hidden=false;}
  $('bpProg').hidden=true;$('bpStep2').hidden=false;
  // 24.2 (D-081): mese non sicuro → campo vuoto con il bordo rosso (meglio vuoto che sbagliato); si salva solo dopo averlo scelto
  $('bpMese').value=r.mese||'';$('bpMese').classList.toggle('manca',!r.mese);
  const metti=(k,v)=>{const el=$('bp-'+k);el.value=v==null?'':v;el.classList.toggle('manca',v==null);};
  metti('lordo',r.lordo);metti('trattenute',r.trattenute);metti('netto',r.netto);metti('ferie',r.ferie);metti('rol',r.rol);metti('exfest',r.exfest);
  if(r.unita)$('bpUF').value=r.unita;if(r.unitaPermessi)$('bpUP').value=r.unitaPermessi;
  for(const k of PEN_B){$('bp-'+k).value=r[k]==null?'':r[k];$('bp-'+k).classList.toggle('manca',!!(r.dubbi&&r.dubbi.includes(k)));} // 24b.1 (D-095): valore scartato → vuoto con il bordo rosso
  bp.dc=PEN_B.filter(k=>r[k]!=null);$('bpPenNota').hidden=true;penBusta();
  bp.letti=letteVoci(r);
  $('bpNote').innerHTML=`<b>${bp.letti.ok.length?'Busta letta':'Non ho trovato le voci'}</b><br>${bp.letti.html}<br>${bp.letti.manca.length?'Quelle mancanti (bordo rosso) scrivile tu o lasciale vuote.':'Controlla e salva.'}`;
}
async function salvaBusta(){
  const mese=$('bpMese').value;if(!/^\d{4}-\d{2}$/.test(mese)){toast('Indica il mese della busta.','err');return;}
  const key=`${bp.lid}|${mese}`;const vecchia=BUS()[key];
  if(bp.key&&bp.key!==key){const o=BUS()[bp.key];if(o){o.deleted=true;o.updatedAt=Date.now();}}
  const val=k=>$('bp-'+k).value.trim().replace(',','.');
  const b=Object.assign({},vecchia&&!vecchia.deleted?vecchia:{},bp.key?BUS()[bp.key]:{},{lid:bp.lid,mese,deleted:false,updatedAt:Date.now()});
  for(const k of ['lordo','trattenute','netto','ferie','rol','exfest'])b[k]=val(k);b.unitaFerie=$('bpUF').value;b.unitaPerm=$('bpUP').value;
  // v22: campi per la pensione; salvando dalla finestra l'utente li ha visti, quindi tolgo "da controllare"
  for(const k of PEN_B)b[k]=val(k);delete b.daControllare;
  if(bp.file){await fset(key,{nome:bp.file.name,tipo:bp.file.type||'application/pdf',blob:bp.file});b.daCaricare=true;b.nomeFile=bp.file.name;}
  if(bp.letti)b.lettura={auto:bp.letti.ok,manca:bp.letti.manca.filter(k=>!b[k==='mese'?'mese':k])};else if(!bp.key)b.lettura={manuale:true};
  BUS()[key]=b;changed();chiudi('bpModal');render();
  if(b.daCaricare&&DB.meta.account&&navigator.onLine){busy(true,'Salvo la busta su Drive…');try{await caricaSuDrive(key);toast('Busta salvata e archiviata su Drive.');}catch(e){toast('Busta salvata nell’app. Su Drive la carico appena possibile ('+errMsg(e)+').','err');}finally{busy(false);render();}}
  else toast(b.daCaricare?'Busta salvata. La carico su Drive appena ti colleghi.':'Busta salvata.');
  if(!$('bpArch').hidden)renderArchivio();
}
let archLid=null;
function apriArchivio(lid){archLid=lid;renderArchivio();apri('bpArch');}
function renderArchivio(){
  const l=lav(archLid);const B=Object.values(busteDi(archLid)).sort((a,b)=>b.mese.localeCompare(a.mese));
  $('baTit').textContent='Buste paga · '+l.nome;
  const anni=[...new Set(B.map(b=>b.mese.slice(0,4)))];const pend=B.filter(b=>b.daCaricare).length;
  $('baBody').innerHTML=`<div class="acts"><button class="btn sm" data-bpnew="${esc(l.id)}">+ Carica busta paga</button><button class="btn ghost sm" id="baTutte">Salva tutto su Drive${pend?` (${pend})`:''}</button>${l.drive?.buste?.link?`<a class="btn ghost sm" href="${esc(l.drive.buste.link)}" target="_blank" rel="noopener">Cartella su Drive ↗</a>`:''}</div>`+
    (anni.map(y=>`<h3 class="bay">${y}</h3>`+rigaContributi(B,y)+B.filter(b=>b.mese.startsWith(y)).map(b=>`<div class="bai"><span class="tx"><b>${(m=>m[0].toUpperCase()+m.slice(1))(MESI[+b.mese.slice(5)-1])}</b><small>${b.netto!==''?'netto '+eur(+b.netto):''}${b.lordo!==''?' · lordo '+eur(+b.lordo):''}${b.daCaricare?' · ⏳ da caricare su Drive':b.file?' · su Drive':' · senza file'}</small>${statoLettura(b)}${b.daControllare?.length?' <small class="dc">da controllare</small>':''}</span>
      ${b.file?.link?`<a class="btn ghost sm" href="${esc(b.file.link)}" target="_blank" rel="noopener">Apri</a>`:''}<button class="btn ghost sm" data-bped="${esc(b.lid+'|'+b.mese)}">Modifica</button></div>`).join('')).join('')||'<p class="muted" style="margin-top:12px">Ancora nessuna busta paga.</p>');
}
async function eliminaBusta(){const b=BUS()[bp.key];if(!b)return;if(!await conferma(`Togliere la busta di ${monthName(b.mese)} dall’app? Il file su Drive resta.`,'Togli','danger'))return;
  b.deleted=true;b.updatedAt=Date.now();await fset(bp.key,undefined);changed();chiudi('bpModal');render();if(!$('bpArch').hidden)renderArchivio();}

// ---------- v17: cosa è stato letto, più buste insieme ----------
const VOCI_B=[['mese','mese'],['lordo','lordo'],['trattenute','trattenute'],['netto','netto'],['ferie','ferie'],['rol','permessi'],['exfest','ex festività'],['imponibilePrev','imponibile previdenziale'],['contribLav','contributi']];
function letteVoci(r){const ok=VOCI_B.filter(([k])=>r[k]!=null).map(([k])=>k),manca=VOCI_B.filter(([k])=>r[k]==null&&['mese','lordo','netto'].includes(k)).map(([k])=>k);
  return {ok,manca,html:VOCI_B.filter(([k])=>r[k]!=null||['mese','lordo','netto'].includes(k)).map(([k,t])=>r[k]!=null?`✓ ${t}`:`✗ ${t}`).join(' · ')};}
function statoLettura(b){const L=b.lettura;if(!L)return '';if(L.manuale)return '<small class="bdg">✍️ scritta a mano</small>';
  return L.manca&&L.manca.length?`<small class="bdg warn">⚠ letta in parte: manca ${L.manca.join(', ')}</small>`:'<small class="bdg ok">✓ letta</small>';}
// ---------- v22: campi "Per la pensione" nella busta ----------
const PEN_B=['imponibilePrev','contribLav','giorniInps'];
function penBusta(){
  for(const k of PEN_B){const f=document.querySelector(`#bpModal [data-dc="${k}"]`);if(f)f.hidden=!bp.dc.includes(k);}
  const anno=($('bpMese').value||cur).slice(0,4);const c=PenCalc.controlloContributi($('bp-imponibilePrev').value,$('bp-contribLav').value,anno);
  $('bpC2').hidden=!c;$('bpC2').textContent=c?'⚠ '+c.testo:'';
}
function rigaContributi(B,y){const C=PenCalc.contributiAnno(B.map(b=>({mese:b.mese,imponibilePrev:b.imponibilePrev,contribLav:b.contribLav})),y);
  return C.conContributi?`<p class="sm muted bacon"><a href="#" data-penapri="contributi">Contributi ${y}: <b>${eur(C.contributi)}</b> · ${C.buste} ${C.buste===1?'busta':'buste'} ›</a></p>`:'';}
let molte=[];
async function leggiMolte(files){
  $('bpStep1').hidden=true;$('bpStep2').hidden=true;$('bpProg').hidden=false;$('bpErr').hidden=true;$('bpRis').hidden=true;molte=[];
  const righe=[];const valori=r=>{const s=v=>v==null?'':String(v);return {lordo:s(r.lordo),trattenute:s(r.trattenute),netto:s(r.netto),ferie:s(r.ferie),rol:s(r.rol),exfest:s(r.exfest),
    imponibilePrev:s(r.imponibilePrev),contribLav:s(r.contribLav),giorniInps:s(r.giorniInps),daControllare:PEN_B.filter(k=>r[k]!=null)};};
  for(let i=0;i<files.length;i++){const f=files[i];
    const prog=(p,t)=>{$('bpBar').style.width=Math.round((i+p)/files.length*100)+'%';$('bpFase').textContent=`Busta ${i+1} di ${files.length} · ${t||''}`;};
    let r=null,err=null;try{r=Buste.analizzaBusta(await Buste.testoBusta(f,prog));}catch(e){err=errMsg(e);}
    const lt=r?letteVoci(r):null;
    if(r&&r.mese){const key=`${bp.lid}|${r.mese}`;const vecchia=BUS()[key];
      BUS()[key]=Object.assign({},vecchia&&!vecchia.deleted?vecchia:{},valori(r),{lid:bp.lid,mese:r.mese,unitaFerie:r.unita||lav(bp.lid).ferie.unita,unitaPerm:r.unitaPermessi||lav(bp.lid).perm.unita,
        nomeFile:f.name,daCaricare:true,deleted:false,lettura:{auto:lt.ok,manca:lt.manca},updatedAt:Date.now()});
      await fset(key,{nome:f.name,tipo:f.type||'application/pdf',blob:f});
      righe.push(`<div class="bai"><span class="tx"><b>${esc(f.name)}</b><small>${esc(monthName(r.mese))} · ${lt.html}${vecchia&&!vecchia.deleted?' · sostituisce quella già presente':''}</small></span>${lt.manca.length?'<small class="bdg warn">⚠ da completare</small>':'<small class="bdg ok">✓ salvata</small>'}</div>`);}
    else{molte.push({f,r:r||{},valori:valori(r||{})});const j=molte.length-1;
      righe.push(`<div class="bai"><span class="tx"><b>${esc(f.name)}</b><small>${err?'Non sono riuscito a leggerla ('+esc(err)+')':'Non trovo il mese'}${lt?' · '+lt.html:''}</small><span class="row"><input type="month" id="bpFixM${j}" aria-label="Mese della busta"><button class="btn sm" data-bpfix="${j}">Salva</button></span></span><small class="bdg warn">⚠ indica il mese</small></div>`);}
  }
  changed();render();$('bpProg').hidden=true;$('bpRis').hidden=false;
  const salvate=righe.length-molte.length;
  $('bpRis').innerHTML=`<p><b>${salvate} ${salvate===1?'busta salvata':'buste salvate'} su ${files.length}.</b> ${molte.length?'Per quelle senza mese scegli il mese e tocca Salva.':''} Quelle “da completare” le puoi correggere dall’archivio (Modifica).</p>${righe.join('')}<div class="foot"><button class="btn" id="bpFine">Fatto</button></div>`;
  $('bpFine').onclick=()=>{chiudi('bpModal');if(!$('bpArch').hidden)renderArchivio();};
  if(DB.meta.account&&navigator.onLine)caricaPendenti(true).then(()=>{if(!$('bpArch').hidden)renderArchivio();toast('Buste salvate anche su Drive.');}).catch(()=>{});
}
async function salvaSenzaMese(j){const x=molte[j];const m=$('bpFixM'+j).value;if(!x||!/^\d{4}-\d{2}$/.test(m)){toast('Scegli il mese.','err');return;}
  const key=`${bp.lid}|${m}`;BUS()[key]=Object.assign({},x.valori,{lid:bp.lid,mese:m,unitaFerie:lav(bp.lid).ferie.unita,unitaPerm:lav(bp.lid).perm.unita,nomeFile:x.f.name,daCaricare:true,deleted:false,lettura:{auto:[],manca:['mese']},updatedAt:Date.now()});
  await fset(key,{nome:x.f.name,tipo:x.f.type||'application/pdf',blob:x.f});changed();render();
  const btn=document.querySelector(`[data-bpfix="${j}"]`);btn.closest('.bai').querySelector('.bdg').outerHTML='<small class="bdg ok">✓ salvata</small>';btn.parentElement.remove();
  if(DB.meta.account&&navigator.onLine)caricaPendenti(true).catch(()=>{});}


// ================= v16: compila il lavoro dai documenti (contratto o busta) =================
let docRis=null;
const DOC_VOCI={pagaMensile:['Paga mensile lorda','€'],pagaGiornaliera:['Paga giornaliera lorda','€'],pagaOraria:['Paga oraria lorda','€'],dal:['Inizio del contratto','data'],al:['Fine del contratto','data'],divisore:['Divisore orario',''],stra:['Straordinario','%'],nott:['Notturno','%'],fest:['Festivi','%'],dom:['Domenica','%'],
  ferieGiorni:['Ferie all’anno','giorni'],ferieOre:['Ferie all’anno','ore'],rolOre:['Permessi (ROL) all’anno','ore'],ccnl:['Contratto','']};
async function leggiDoc(file,tipo){
  $('lvDocProg').hidden=false;$('lvDocRis').innerHTML='';
  const prog=(p,t)=>{$('lvDocBar').style.width=Math.round(p*100)+'%';if(t)$('lvDocFase').textContent=t;};
  try{
    let righe,bres=null;
    if(tipo==='busta'){const pezzi=await Buste.testoBusta(file,prog);bres=Buste.analizzaBusta(pezzi);righe=(bres.testo||'').split('\n');}
    else righe=await Buste.testoDocumento(file,prog);
    prog(.97,'Cerco i valori…');docRis={tipo,file,S:Buste.suggerisci(righe),bres};
  }catch(e){docRis={tipo,file,S:{},bres:null,err:errMsg(e)};}
  $('lvDocProg').hidden=true;renderDocRis();
}
function renderDocRis(){
  const R=docRis;if(!R){$('lvDocRis').innerHTML='';return;}const S=R.S;const keys=Object.keys(DOC_VOCI).filter(k=>S[k]);
  const fmt=(k)=>{const [,u]=DOC_VOCI[k];const v=S[k].v;return u==='data'?parseYmd(v).toLocaleDateString('it-IT'):u==='€'?eur(v):u==='%'?nf(v,v%1?1:0)+'%':u?`${nf(v,v%1?1:0)} ${u}`:esc(String(v));};
  const off=k=>k==='pagaOraria'&&(S.pagaMensile||S.pagaGiornaliera); // se c'è la paga mensile, quella oraria resta solo informativa
  $('lvDocRis').innerHTML=(R.err?`<p class="warn sm">Non sono riuscito a leggerlo (${esc(R.err)}).</p>`:'')+
    (keys.length?`<p class="sm"><b>Ho trovato:</b></p>`+keys.map(k=>`<label class="check docv"><input type="checkbox" data-dv="${k}" ${off(k)?'':'checked'}><span><b>${DOC_VOCI[k][0]}: ${fmt(k)}</b><small class="muted">“${esc(S[k].testo)}”</small></span></label>`).join('')
      :`<p class="muted sm">Non ho trovato valori da proporre${R.tipo==='busta'?' (la busta può comunque essere archiviata)':''}: compila a mano le sezioni qui sotto.</p>`)+
    (R.tipo==='busta'&&R.bres?.mese?`<label class="check sm"><input type="checkbox" id="lvDocArch" checked> Archivia anche come busta paga di ${esc(monthName(R.bres.mese))}</label>`:'')+
    (R.tipo==='contratto'?`<label class="check sm"><input type="checkbox" id="lvDocArch" checked> Salva il contratto nella cartella del lavoro su Drive</label>`:'')+
    `<div class="acts"><button type="button" class="btn sm" id="lvDocApplica">${keys.length?'Applica i valori scelti':'Ok'}</button></div>`;
}
function applicaDoc(){
  const R=docRis;if(!R)return;const S=R.S;const scelti=[...document.querySelectorAll('#lvDocRis [data-dv]:checked')].map(c=>c.dataset.dv);
  for(const k of scelti){const v=S[k].v;
    if(k==='pagaMensile'){$('lvPagaTipo').value='mensile';$('lvPaga').value=v;}
    if(k==='pagaOraria'){$('lvPagaTipo').value='oraria';$('lvPaga').value=v;}
    if(k==='pagaGiornaliera'){$('lvPagaTipo').value='giornaliera';$('lvPaga').value=v;if(!$('lvDiv').value||$('lvDiv').value==='168')$('lvDiv').value=8;}
    if(k==='dal')$('lvDal').value=v;if(k==='al')$('lvAl').value=v;
    if(k==='divisore')$('lvDiv').value=v;
    if(['stra','nott','fest','dom'].includes(k))$('lvM-'+k).value=v;
    if(k==='ferieGiorni'){$('lvFerieU').value='giorni';$('lvFerieA').value=v;}if(k==='ferieOre'){$('lvFerieU').value='ore';$('lvFerieA').value=v;}
    if(k==='rolOre'){$('lvPermU').value='ore';$('lvPermA').value=v;}
    if(k==='ccnl'&&!$('lvContratto').value.trim())$('lvContratto').value=v;}
  const arch=$('lvDocArch')?.checked;
  if(arch&&R.tipo==='busta')lv.pendBusta={file:R.file,bres:R.bres};
  if(arch&&R.tipo==='contratto')lv.pendContr={file:R.file};
  aggiornaModo();
  if(scelti.some(k=>['stra','nott','fest','dom'].includes(k)))document.querySelectorAll('#lvModal details').forEach(d=>{if(d.querySelector('#lvM-stra'))d.open=true;});
  $('lvDocRis').innerHTML=`<p class="sm">✓ ${scelti.length?`Inseriti ${scelti.length} valori: controllali qui sotto`:'Fatto'}${arch?(R.tipo==='busta'?'; la busta viene archiviata quando salvi il lavoro':'; il contratto viene salvato su Drive quando salvi il lavoro'):''}.</p>`;
  docRis=null;
}
async function salvaDocInAttesa(lid){
  const P=lv?.pendBusta,Q=lv?.pendContr;if(lv){lv.pendBusta=null;lv.pendContr=null;}
  if(P&&P.bres?.mese){const r=P.bres,key=`${lid}|${r.mese}`;const s=v=>v==null?'':String(v);
    BUS()[key]=Object.assign({},BUS()[key]?.deleted?{}:BUS()[key]||{},{lid,mese:r.mese,lordo:s(r.lordo),trattenute:s(r.trattenute),netto:s(r.netto),ferie:s(r.ferie),rol:s(r.rol),exfest:s(r.exfest),
      unitaFerie:r.unita||lav(lid).ferie.unita,unitaPerm:r.unitaPermessi||lav(lid).perm.unita,daCaricare:true,nomeFile:P.file.name,deleted:false,updatedAt:Date.now()});
    await fset(key,{nome:P.file.name,tipo:P.file.type||'application/pdf',blob:P.file});}
  if(Q){const x=LAV()[lid];x.contrattoFile={nome:Q.file.name,daCaricare:true};x.updatedAt=Date.now();await fset('contr|'+lid,{nome:Q.file.name,tipo:Q.file.type||'application/pdf',blob:Q.file});}
  if(P||Q){changed();render();if(DB.meta.account&&navigator.onLine){busy(true,'Salvo i documenti su Drive…');try{await caricaPendenti(true);toast('Documenti salvati su Drive.');}finally{busy(false);render();}}
    else toast('Documenti salvati nell’app: li carico su Drive appena ti colleghi.');}
}

// ================= collegamenti =================
const _renderProg15=renderProgetti;
renderProgetti=function(){_renderProg15();renderLavori();};
function bind15(){
  $('lavNew').onclick=nuovo;
  $('lavList').addEventListener('click',e=>{const b=e.target.closest('[data-lav]');if(b)apriLavoro(lav(b.dataset.lav),false);});
  $('lvOreGiorno').addEventListener('blur',controllaOreGiorno);
  $('lvOreGiorno').addEventListener('input',()=>{notaOreGiorno();if(!$('lvOreGiornoErr').hidden)controllaOreGiorno();});$('lvOreMese').addEventListener('input',notaOreGiorno);
  $('lvClose').onclick=()=>chiudi('lvModal');$('lvSave').onclick=salvaLavoro;$('lvDel').onclick=eliminaLavoro;
  $('lvModal').addEventListener('change',e=>{if(e.target.name==='lvModo'||e.target.id==='lvPagaTipo'){leggiTipi();aggiornaModo();renderTipi();}if(['cat','aggiunta'].includes(e.target.dataset?.k)){leggiTipi();renderTipi();}});
  $('lvDocBusta').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)leggiDoc(f,'busta');};
  $('lvDocContr').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)leggiDoc(f,'contratto');};
  $('lvDocRis').addEventListener('click',e=>{if(e.target.id==='lvDocApplica')applicaDoc();});
  $('lvTipiAdd').onclick=()=>{leggiTipi();lv.l.tipi.push({id:uid(),nome:'',sigla:'',icona:'',cat:'lavoro',da:'',a:'',pausa:'',ore:'',colore:lv.l.colore});renderTipi();};
  $('lvTipi').addEventListener('click',e=>{const b=e.target.closest('[data-trm]');if(!b)return;leggiTipi();lv.l.tipi.splice(+b.dataset.trm,1);renderTipi();});
  $('lvCopia').onclick=()=>{const r=document.querySelector('#lvSett .srow[data-d="1"]');const v=k=>r.querySelector(`[data-k=${k}]`).value;
    if(!v('da')||!v('a')){toast('Scrivi prima l’orario del lunedì.','err');return;}
    for(const d of [2,3,4,5]){const x=document.querySelector(`#lvSett .srow[data-d="${d}"]`);for(const k of ['da','a','pausa'])x.querySelector(`[data-k=${k}]`).value=v(k);}};
  // giorno
  $('dayBox').addEventListener('click',e=>{const q=e.target.closest('[data-tuq]');if(q){const [lid,tid]=q.dataset.tuq.split('|');const l=lav(lid);const t=C.tipoDi(l,tid);
      if(!tid||serveOre(t,l)){apriTurno([selDay],lid);tu.tipo=tid||null;renderTuTipi();return;}
      metti(lid,[selDay],tid);render();renderTurniGiorno(selDay);toast((t.icona?t.icona+' ':'')+t.nome+' segnato.');return;}
    const ed=e.target.closest('[data-tued]');if(ed){const [lid,id]=ed.dataset.tued.split('|');apriTurno([TUR()[id].data],lid,TUR()[id]);}});
  // più giorni
  const mb=$('multiBar');if(mb&&!$('multiTurno')){mb.insertAdjacentHTML('beforeend','<button class="btn sm" id="multiTurno" hidden>Turno</button>');}
  $('multiTurno').onclick=()=>{const L=[...selected].sort();if(!L.length)return;apriTurno(L);};
  // finestra turno
  $('tuClose').onclick=()=>chiudi('tuModal');$('tuSave').onclick=salvaTurno;$('tuDel').onclick=togliTurno;$('tuClear').onclick=togliTurno;
  $('tuLav').onchange=()=>{tu.lid=$('tuLav').value;tu.tipo=lav(tu.lid).tipi[0]?.id||null;renderTuTipi();};
  $('tuTipi').addEventListener('click',e=>{const b=e.target.closest('[data-tut]');if(!b)return;tu.tipo=b.dataset.tut||null;renderTuTipi();});
  // buste
  document.addEventListener('click',e=>{const og=e.target.closest('[data-oregiorno]');if(og){const l=lav(og.dataset.oregiorno);if(!l)return;
      apriLavoro(l,false);const d=$('lvOreGiornoBox').closest('details');if(d)d.open=true;requestAnimationFrame(()=>{$('lvOreGiorno').focus();$('lvOreGiornoBox').scrollIntoView({block:'center'});});return;}
    const n=e.target.closest('[data-bpnew]');if(n){apriBusta(n.dataset.bpnew,cur);return;}
    const a=e.target.closest('[data-bparch]');if(a){apriArchivio(a.dataset.bparch);return;}
    const ed=e.target.closest('[data-bped]');if(ed){const [lid,m]=ed.dataset.bped.split('|');apriBusta(lid,m,true);$('bpDel').hidden=false;return;}
    if(e.target.id==='baTutte')caricaPendenti(false).then(()=>renderArchivio());});
  $('bpFile').onchange=e=>{const F=[...e.target.files];e.target.value='';if(F.length>1)leggiMolte(F);else if(F[0])leggiBusta(F[0]);};
  $('bpRis').addEventListener('click',e=>{const b=e.target.closest('[data-bpfix]');if(b)salvaSenzaMese(+b.dataset.bpfix);});
  $('bpManuale').onclick=()=>{$('bpStep1').hidden=true;$('bpStep2').hidden=false;$('bpNote').textContent='Scrivi i valori della busta. Senza file la busta resta solo nell’app.';};
  for(const k of PEN_B)$('bp-'+k).addEventListener('input',()=>{bp.dc=bp.dc.filter(x=>x!==k);penBusta();});
  $('bpMese').addEventListener('change',()=>{$('bpMese').classList.toggle('manca',!$('bpMese').value);if(bp)penBusta();});
  $('bpClose').onclick=()=>chiudi('bpModal');$('bpSave').onclick=salvaBusta;$('bpDel').onclick=eliminaBusta;$('baClose').onclick=()=>chiudi('bpArch');
  for(const id of MODALI)$(id).addEventListener('click',e=>{if(e.target.id===id)chiudi(id);});
}
// la barra dei più giorni mostra "Turno" solo se c'è un lavoro
const _renderCal15b=renderCal;
renderCal=function(){_renderCal15b();const b=$('multiTurno');if(b){b.hidden=!lavori().length;b.disabled=!selected.size;}};
const _apriBusta=apriBusta;apriBusta=function(lid,mese,es){_apriBusta(lid,mese,es);$('bpDel').hidden=!es;};

bind15();
render();
window.Stip15={nuovoLavoro,caricaPendenti,metti,apriTurno,apriBusta,apriArchivio,cardMese};
})();
