'use strict';
// ================= Soldirini v16 · finestra "Nuova attività" a sezioni, spese del giorno =================
// Sezioni a comparsa: Lavoro dipendente, Progetti, Spese del giorno (si salvano solo quelle aperte).
// Nei progetti: turni (orari già impostati), ripetizione con inizio e durata, rimborsi spesa (km + scontrini).
(function(){
const C=window.StipCalc;
const SP=()=>D().spesePers||(D().spesePers={});
// 24c.6 (R-D5): una spesa senza data o con la data non di testo (file su Drive rovinato) si salta in silenzio, senza errori
const dataSpesa=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d);
const speseDel=fn=>Object.values(SP()).filter(s=>s&&typeof s==='object'&&!s.deleted&&dataSpesa(s.data)&&fn(s)).sort((a,b)=>(a.data+a.created).localeCompare(b.data+b.created));
// 24c.11 (D-150): "Online" al posto di "Online / Amazon"; stesso codice e stessa icona. Un solo elenco, usato anche da banca.js
const CATS=window.CATS_SPESE=[['online','📦','Online'],['negozio','🛍️','Negozio'],['spesa','🛒','Supermercato'],['bar','☕','Bar e ristoranti'],['amici','🍻','Amici e uscite'],['trasporti','🚗','Trasporti e benzina'],['casa','🏠','Casa e bollette'],['altro','•','Altro']];
// 24c.20 (D-180): le scelte proprie ('sc:<id>') vengono da scelte.js; x = la voce, con la copia di nome e icona come riserva
const catDi=(k,x)=>(window.Scelte&&Scelte.cat(k,x))||CATS.find(c=>c[0]===k)||CATS[CATS.length-1];
const CAT_ALTRO=CATS[CATS.length-1],CATS_PRONTE=CATS.slice(0,-1);
// chip delle spese giornaliere: scelte pronte, poi le proprie, poi «Altro» sempre ultima; sotto «Modifica» e «Togli» (02 §2.1-§2.3)
const chipsSpese=(sel,attr)=>[...CATS_PRONTE.map(c=>`<button type="button" class="chip ${sel===c[0]?'on':''}" data-${attr}="${c[0]}" aria-pressed="${sel===c[0]}">${c[1]} ${esc(c[2])}</button>`),
  window.Scelte?Scelte.chips('spese',sel,attr):'',`<button type="button" class="chip ${sel==='altro'?'on':''}" data-${attr}="altro" aria-pressed="${sel==='altro'}">${CAT_ALTRO[1]} ${esc(CAT_ALTRO[2])}</button>`,
  window.Scelte?Scelte.azioni('spese',sel):''].join('');
// tocco su un chip: m = {set(cat), imp (id del campo importo), ridisegna}
function toccaSpesa(b,attr,m){const scmod=b.closest('[data-scmod]'),sctogli=b.closest('[data-sctogli]');
  if(scmod){Scelte.apri('spese',scmod.dataset.scmod,()=>m.ridisegna());return;}
  if(sctogli){Scelte.togli(sctogli.dataset.sctogli,()=>{m.set('');m.ridisegna();});return;}
  const k=b.dataset[attr];m.set(k);const sc=k.startsWith('sc:')&&window.Scelte?Scelte.prendi(k.slice(3)):null;
  if(sc&&sc.importo&&$(m.imp)&&!$(m.imp).value.trim())$(m.imp).value=(Math.round(+sc.importo*100)/100).toFixed(2).replace('.',',');
  m.ridisegna();
  if(k==='altro'&&window.Scelte)Scelte.apri('spese',null,id=>{const c=document.createElement('button');c.dataset[attr]='sc:'+id;toccaSpesa(c,attr,m);});}
// copia di nome e icona nella voce salvata (si toglie se la categoria non è più una scelta propria)
const conCopiaSp=(o,cat)=>{const c=window.Scelte?Scelte.copia(cat):{};if(c.catNome)Object.assign(o,c);else{delete o.catNome;delete o.catIco;}return o;};
const num=v=>leggiNumero(v)??0; // 24c.6 (P2): importi scritti a mano all'italiana (numeri.js)
const numP=v=>leggiNumeroPunto(v)??0; // 24c.6: campi type="number" (giorni, rate, mesi, percentuale): punto decimale, come prima
// v23 (D-010): le sezioni non ricordano più se erano aperte; tolgo le vecchie memorie dal telefono
try{localStorage.removeItem('soldirini-sez');localStorage.removeItem('soldirini-foldpro');}catch(e){}
let S={lav:null,sp:[],cat:'online'};let pick=false,modTurno=null; // stato delle sezioni mentre la finestra è aperta
window.spesePersonali=speseDel;
// 24c.11 (D-152): mese in cui una voce conta nei soldi. "meseConto" (salvato dall'importazione della banca) vale solo se è il
// mese della data o quello prima: un valore diverso (file su Drive rovinato) si ignora e conta la data, come prima.
const RE_MESE=/^\d{4}-(0[1-9]|1[0-2])$/;
const mesePrima=m=>{let y=+m.slice(0,4),n=+m.slice(5)-1;if(!n){n=12;y--;}return `${y}-${pad(n)}`;};
window.meseContoDi=(data,mc)=>{const m=data.slice(0,7);return typeof mc==='string'&&RE_MESE.test(mc)&&mc===mesePrima(m)?mc:m;}; // anche mc === mese della data (24c.12): conta lì
window.mesePrima=mesePrima;
// 24c.12 (D-155): spese importate dalla banca prima della regola dello stipendio (origine "banca" e nessun "meseConto": 24c.10, e
// 24c.11 senza spostamento). Se nello stesso mese c'è uno stipendio o una pensione segnati entrati con una data dopo la spesa,
// la spesa conta nel mese prima (al massimo un mese, come D-152). Si calcola ogni volta: niente si riscrive, né sul telefono né
// su Drive (D-117), quindi nessun conflitto con gli altri telefoni. Le spese scritte a mano non hanno "origine" e non si toccano.
// Dalla 24c.12 l'importazione salva sempre "meseConto", quindi le voci nuove non passano da qui.
let stipCache=null;
let stipChiave=null;
function stipendiEntrati(){const E=D().entrate||{},oggi=today();if(stipCache&&stipChiave&&stipChiave.E===E&&stipChiave.oggi===oggi)return stipCache;stipChiave={E,oggi};const out=[];
  const lid=new Set((window.lavori?lavori():[]).map(l=>l.id));
  for(const [k,e] of Object.entries(E)){if(!e||typeof e!=='object'||e.entrato!==true||typeof e.data!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(e.data)||e.data>oggi)continue;
    const p=k.split('|');if(p[0]==='pen'||(p[0]==='lav'&&lid.has(p[1])))out.push(e.data);}
  stipCache=out;return out;}
// 24c.13 (nota della verifica della 24c.12): la lista si rifà dopo ogni modifica (changed) e quando i dati cambiano oggetto
// (sincronizzazione, "Sostituisci tutto"): prima si svuotava con setTimeout(0) e un conto fatto nello stesso giro vedeva la lista vecchia
{const _changed=changed;changed=function(){stipCache=null;return _changed.apply(this,arguments);};}
window.meseSpesa=s=>{if(s.origine==='banca'&&s.meseConto===undefined){const m=s.data.slice(0,7);
    return stipendiEntrati().some(d=>d.slice(0,7)===m&&d>s.data)?mesePrima(m):m;}
  return meseContoDi(s.data,s.meseConto);};

// ================= apertura della finestra =================
const _openEv16=openEv;
openEv=function(dates,e,tieni){
  // 24c.20 (D-180): una scelta propria tolta nel frattempo non resta selezionata
  const catOk=k=>!!k&&(!k.startsWith('sc:')||!!(window.Scelte&&Scelte.elenco('spese').some(c=>'sc:'+c.id===k)));
  if(!tieni){S={lav:null,sp:[],cat:catOk(S.cat)?S.cat:'online'};pick=false;modTurno=null;delete $('evTurniBox').dataset.toccato;}
  if(!progetti().length&&!e){
    if(typeof chiudiSheets==='function')chiudiSheets();
    md={dates,id:null,ev:null,pid:null,noProj:true,e:{}};
    $('evTitle').textContent=dates.length>1?`Nuova attività · ${dates.length} giorni`:'Nuova attività';
    $('evDate').value=dates[0];$('evDate').onchange=()=>{md.dates=[$('evDate').value];};$('evDateRow').hidden=dates.length>1;
    const d=parseYmd(dates[0]);$('evSub').textContent=dates.length>1?dates.map(x=>parseYmd(x).getDate()).join(', ')+' '+MESI[d.getMonth()]:'';
    $('evDel').hidden=true;$('evDup').hidden=true;$('evStatoBox').hidden=true;
    $('evModal').hidden=false;document.body.classList.add('noscroll');
  } else {_openEv16(dates,e);if(!md)return;md.noProj=false;}
  const modifica=!!e;
  $('secLav').hidden=modifica;$('secSpese').hidden=modifica;
  $('evProgNo').hidden=!md.noProj;$('evProgBody').hidden=!!md.noProj;
  // v23 (D-010, D-017 n. 11): tutte chiuse; si apre da sola solo la sezione in modifica (attività già salvata)
  if(!tieni){$('secProg').open=modifica;$('secLav').open=false;$('secSpese').open=false;md.progToccato=false;}
  if(!md.noProj)dopoFill();
  if(!modifica)prepRipetizione();
  // v23 (D-043): con almeno un lavoro a turni, "Turni da foto" anche da qui
  $('evFoto').hidden=modifica||!lavoriTurni().length;
  if(window.FissaEv&&!tieni)FissaEv.prepara(md.dates,modifica); // tornando dalla creazione di un progetto restano i campi compilati
  if(window.ExtraEv&&!tieni)ExtraEv.prepara(md.dates,modifica); // 24c.13 (D-074): entrata extra
  if(!tieni)giaTutte=false;
  renderLav();renderSp();aggiornaSum();renderGia();
};

// ================= 24c.15 (D-171): "Già segnato in questo giorno" in cima a Nuova attività =================
// Disegno e testi di 02 (tornata 57): elenco corto (due righe per voce) con "Modifica"; sotto "Aggiungi" e le sezioni.
// Solo con un giorno solo e una nuova attività; su un giorno senza voci scritte (l'orario abituale e le feste non contano)
// l'elenco non c'è. Nessun dato cambia: "Modifica" apre la finestra di ogni voce.
let giaTutte=false,animaDa=null; // "Mostra le altre N" aperto (si richiude a ogni apertura, D-010); righe che entrano con "apri"
const TUR=()=>D().turni||{};
const oreTesto=h=>nf(h,h%1?2:0);
const gm=d=>{const x=parseYmd(d);return `${x.getDate()} ${MESI[x.getMonth()]}`;};
function vociGia(d){
  const out=[],L=lavori();
  // turni e assenze, per lavoro (senza l'orario abituale, che non è una voce scritta)
  for(const l of L){const G=C.vociGiorno(l,turniDi(l.id).filter(t=>t.data===d),d);
    for(const v of G.voci){if(!v.id||v.implicito)continue;
      const lavoro=v.cat==='lavoro'||v.cat==='variabile'||v.aggiunta,orari=v.daS&&v.aS?v.daS+'–'+v.aS:'';
      // ore: quelle scritte (o del tipo), altrimenti dalle–alle meno la pausa (come nella finestra del turno)
      const ore=v.ore!=null?v.ore:v.da!=null&&v.a!=null?Math.max(0,(((v.a-v.da+1440)%1440)||1440)-(v.pausa||0))/60:null;
      const scritte=TUR()[v.id]&&(String(TUR()[v.id].ore||'')!==''||!!TUR()[v.id].da);
      const r2a=lavoro?[orari,ore!=null?oreTesto(Math.round(ore*100)/100)+' ore':''].filter(Boolean):[scritte&&ore!=null?oreTesto(Math.round(ore*100)/100)+' ore':'Tutta la giornata'];
      if(L.length>1)r2a.push(l.nome||'Lavoro');
      out.push({k:'tu',c:v.colore||l.colore,em:v.tipo?.icona||'💼',t1:esc(v.nome),t2:esc(r2a.join(' · ')),att:`data-giatu="${esc(l.id)}|${esc(v.id)}"`,
        lab:`Modifica ${lavoro?'il turno':'l’assenza'} ${v.nome} del ${gm(d)}`});}}
  // attività dei progetti, per ora
  for(const e of eventiDel(e=>e.data===d,true)){const p=prog(e.pid),f=(e.fasce||[]).filter(x=>x.da&&x.a),so=soldiOre(e);
    const r2a=[f.length?f[0].da+'–'+f[f.length-1].a:'',e.ore&&!isFisso(e)&&so.ore?oreTesto(so.ore)+' ore':''].filter(Boolean);
    out.push({k:'ev',c:p?.colore||'#888',em:'📁',t1:esc((p?.nome||'Progetto')+' · '+TIPI[e.tipo])+(e.stato==='previsto'?'<span class="tag">Prevista</span>':''),t2:esc(r2a.join(' · ')),
      att:`data-giaev="${esc(e.id)}"`,lab:`Modifica l’attività ${TIPI[e.tipo]} del progetto ${p?.nome||''} del ${gm(d)}`});}
  // entrate extra (testo di "Modifica" già definitivo, tornata 53)
  for(const x of (window.EntrateExtra?.delGiorno?.(d)||[])){const t=EntrateExtra.tipoDi(x.tipo);
    out.push({k:'ex',em:'🪙',t1:esc(t[2]),t2:`<span class="am ok">+${eur(x.importo)}</span>${x.nota?' · '+esc(x.nota):''}`,att:`data-xe="${esc(x.id)}"`,
      lab:`Modifica l’entrata extra di ${eur(x.importo)} del ${d.slice(8)}/${d.slice(5,7)}/${d.slice(0,4)}`});}
  // spese giornaliere (anche quelle importate dalla banca)
  for(const x of speseDel(s=>s.data===d)){const c=catDi(x.cat,x),nome=x.nota||c[2];
    out.push({k:'sp',em:'🛒',t1:esc(nome),t2:`<span class="am">−${eur(num(x.importo))}</span>${x.nota?' · '+esc(c[2]):''}`,att:`data-giasp="${esc(x.id)}"`,
      lab:`Modifica la spesa ${nome} di ${eur(num(x.importo))}`});}
  return out;
}
function renderGia(){
  const box=$('evGia');if(!box)return;
  const una=md&&!md.id&&md.dates.length===1,V=una?vociGia(md.dates[0]):[];
  box.hidden=!V.length;$('evAggiungi').hidden=!V.length;if(!V.length){box.innerHTML='';return;}
  const molte=V.length>5,vis=molte&&!giaTutte?V.slice(0,4):V;
  box.innerHTML=`<div class="hd"><h3 id="evGiaT">Già segnato in questo giorno</h3><span>${V.length===1?'1 voce':V.length+' voci'}</span></div>`+
    vis.map((v,i)=>`<div class="rg${animaDa!=null&&i>=animaDa?' nuova':''}">${v.c?`<span class="bar" style="--c:${colOk(v.c)}"></span>`:''}<span class="em" aria-hidden="true">${esc(v.em)}</span><span class="tx"><b>${v.t1}</b>${v.t2?`<small>${v.t2}</small>`:''}</span>`+
      `<button type="button" class="btn ghost sm" ${v.att} aria-label="${esc(v.lab)}">Modifica</button></div>`).join('')+
    (animaDa=null,'')+(molte?`<div class="more"><button type="button" class="btn ghost sm" id="evGiaPiu" aria-expanded="${giaTutte}">${giaTutte?'Mostra meno':`Mostra le altre ${V.length-4}`}</button></div>`:'');
}
// che cosa è già scritto nelle sezioni (per la domanda prima di aprire un'attività di un progetto nella stessa finestra)
function sezioniScritte(){letturaLav();const n=[];
  if(S.lav&&S.lav.tipo!==undefined)n.push('Lavoro dipendente');
  if(md&&!md.noProj&&md.progToccato)n.push('Progetti');
  if(S.sp.length||($('spPImp')&&num($('spPImp').value)>0)||($('spPNota')&&$('spPNota').value.trim()))n.push('Spese giornaliere');
  if(window.FissaEv&&FissaEv.compilata())n.push('Uscita fissa');
  if(window.ExtraEv&&ExtraEv.compilata())n.push('Entrata extra');
  return n;}
async function giaClick(e){
  const piu=e.target.closest('#evGiaPiu');if(piu){giaTutte=!giaTutte;animaDa=giaTutte?4:null;renderGia();$('evGiaPiu')?.focus();return;}
  const tu=e.target.closest('[data-giatu]');if(tu){const [lid,id]=tu.dataset.giatu.split('|');const t=TUR()[id];if(t)Stip15.apriTurno([t.data],lid,t);return;}
  const sp=e.target.closest('[data-giasp]');if(sp){apriSpesa(sp.dataset.giasp);return;}
  const ev=e.target.closest('[data-giaev]');if(ev){const x=D().eventi[ev.dataset.giaev];if(!x)return;
    const n=sezioniScritte();
    if(n.length&&!await ask(`<b>Aprire l’attività?</b><br>In questa finestra hai scritto qualcosa (${esc(n.join(', '))}). Se apri l’attività, quello che hai scritto non viene salvato.`,
      [{t:'Resta qui',v:false},{t:'Apri senza salvare',v:true,cls:'ghost'}],true))return;
    openEv([x.data],clone(x));}
}

// ================= 24c.15 (D-171): modifica di una spesa giornaliera (prima si poteva solo eliminare dal giorno aperto) =================
let spEd=null; // {id, cat}
function apriSpesa(id){const s=SP()[id];if(!s||s.deleted)return;spEd={id,cat:s.cat};
  $('spmData').value=s.data;$('spmData').max=today();$('spmImp').value=String(num(s.importo)).replace('.',',');$('spmNota').value=s.nota||'';
  $('spmErr').hidden=true;spmChips();$('spModal').hidden=false;$('spModal').querySelector('.sheet').scrollTop=0;document.body.classList.add('noscroll');}
function chiudiSpesa(){$('spModal').hidden=true;spEd=null;if([...document.querySelectorAll('.modal')].every(m=>m.hidden))document.body.classList.remove('noscroll');}
function spmChips(){$('spmCats').innerHTML=chipsSpese(spEd.cat,'spmc');}
function spmErrore(t){$('spmErr').textContent=t;$('spmErr').hidden=false;}
function dopoSpesa(msg){chiudiSpesa();changed();render();if(!$('dayModal').hidden)apriGiorno(selDay);toast(msg);}
function salvaSpesa(){if(!spEd)return;const s=SP()[spEd.id];if(!s)return chiudiSpesa();
  const data=$('spmData').value,imp=leggiNumero($('spmImp').value,true);
  if(!dataSpesa(data))return spmErrore('Scrivi la data.');if(data>today())return spmErrore('La data non può essere nel futuro.');
  if(!(imp>0))return spmErrore('Scrivi l’importo.');
  // il mese in cui conta (D-152, importate dalla banca) resta solo se il giorno non cambia
  const nuova=conCopiaSp(Object.assign({},s,{data,cat:spEd.cat||'altro',importo:Math.round(imp*100)/100,nota:$('spmNota').value.trim().slice(0,60),updatedAt:Date.now()}),spEd.cat||'altro');
  if(data!==s.data)delete nuova.meseConto;
  SP()[spEd.id]=nuova;dopoSpesa('✓ Spesa salvata.');}
// stessa conferma e stesso segno dell'eliminazione dal giorno aperto
async function eliminaSpesa(){if(!spEd)return;const s=SP()[spEd.id];if(!s)return chiudiSpesa();
  if(!await conferma(`Eliminare la spesa di ${eur(num(s.importo))}?`,'Elimina','danger'))return;
  s.deleted=true;s.updatedAt=Date.now();dopoSpesa('✓ Spesa eliminata.');}
const lavoriTurni=()=>lavori().filter(l=>l.modo==='turni');
async function turniDaFoto(){const T=lavoriTurni();if(!T.length)return;
  let lid=T[0].id;
  if(T.length>1){lid=await ask('Per quale lavoro sono i turni della foto?',T.map(l=>({t:l.nome,v:l.id,cls:'ghost'})).concat([{t:'Annulla',v:null,cls:'ghost'}]));if(!lid)return;}
  const ym=(md&&md.dates&&md.dates[0]||cur+'-01').slice(0,7);closeEv();FotoTurni.apriFoto(lid,ym);}

// ================= sezione Lavoro dipendente =================
function renderLav(){
  const L=lavori();const box=$('evLav');
  if(!L.length){box.innerHTML='<p class="muted sm" style="margin-top:0">Se sei dipendente, aggiungi il tuo lavoro (orario fisso o turni): qui potrai segnare turni, straordinari, ferie e permessi.</p><button type="button" class="btn sm" id="evLavNew">+ Aggiungi lavoro</button>';return;}
  const st=S.lav&&lav0(S.lav.lid)?S.lav:(S.lav={lid:L[0].id,tipo:undefined,da:'',a:'',pausa:'',ore:'',nota:''});const l=lav0(st.lid);
  const d0=md.dates[0];let oggi='';
  if(md.dates.length===1){const G=C.vociGiorno(l,turniDi(l.id).filter(t=>t.data===d0),d0);oggi=G.voci.map(v=>esc((v.tipo?.icona?v.tipo.icona+' ':'')+v.nome+(v.daS&&v.aS?' '+v.daS+'–'+v.aS:'')+(v.implicito?' (abituale)':''))).join(' · ');}
  const t=st.tipo?C.tipoDi(l,st.tipo):null;const scelto=st.tipo!==undefined;
  const ass=scelto&&t&&window.testoAssenza?testoAssenza(l,t,d0.slice(0,7),true):null; // a turni: testo 1e (02, 04)
  const servOrari=scelto&&(!t||t.cat==='lavoro'||t.cat==='variabile');const servOre=scelto&&(!t||!(t.da&&t.a)||!!ass);
  box.innerHTML=(L.length>1?`<label>Lavoro<select id="evLavSel">${L.map(x=>`<option value="${esc(x.id)}" ${x.id===l.id?'selected':''}>${esc(x.nome)}</option>`).join('')}</select></label>`:`<p class="sm" style="margin-top:0"><b>${esc(l.nome)}</b></p>`)+
    (oggi?`<p class="muted sm">Già segnato: ${oggi}</p>`:'')+
    `<div class="tuchips">${l.tipi.map(x=>`<button type="button" class="chip ${st.tipo===x.id?'on':''}" style="--c:${colOk(x.colore||l.colore)}" data-lt="${esc(x.id)}">${esc((x.icona?x.icona+' ':'')+x.nome)}</button>`).join('')}<button type="button" class="chip ${st.tipo===null?'on':''}" data-lt="">Orario diverso</button></div>`+
    (scelto?`<div class="g2" style="margin-top:8px">${servOrari?`<label>Dalle<input type="time" data-lk="da" value="${esc(st.da)}"></label><label>Alle<input type="time" data-lk="a" value="${esc(st.a)}"></label><label>Pausa (min)<input type="number" inputmode="numeric" data-lk="pausa" value="${esc(st.pausa)}"></label>`:''}${servOre?`<label>Ore<input type="number" inputmode="decimal" step="0.25" data-lk="ore" value="${esc(st.ore)}"></label>`:''}<label class="s2">Nota<input data-lk="nota" value="${esc(st.nota)}"></label></div>
      <p class="muted sm">${!t?'Sostituisce l’orario di quel giorno.':ass?ass:t.da&&t.a?`Orario del tipo: ${t.da}–${t.a}. Cambialo solo se quel giorno è diverso.`:((t.cat==='permesso'||t.cat==='nonretr')&&t.ore===''?'Scrivi le ore (oppure dalle–alle).':C.PAGATE.includes(t.cat)||t.cat==='nonretr'?'Lascia vuote le ore per contare l’orario abituale del giorno.':'Scrivi le ore (oppure dalle–alle).')}</p>`:'<p class="muted sm">Tocca un tipo per segnarlo in questo giorno.</p>');
}
const lav0=id=>(D().lavori||{})[id];
function letturaLav(){const st=S.lav;if(!st)return;document.querySelectorAll('#evLav [data-lk]').forEach(i=>st[i.dataset.lk]=i.value.trim());}

// ================= sezione Spese del giorno =================
function renderSp(){
  const tot=S.sp.reduce((a,x)=>a+x.importo,0);
  $('evSpP').innerHTML=`<p class="muted sm" style="margin-top:0">Le tue spese personali (non rimborsate): servono per vedere quanto spendi e quanto risparmi.</p>`+
    S.sp.map((x,i)=>{const c=catDi(x.cat,x);return `<div class="sprow"><span>${c[1]}</span><span class="tx"><b>${esc(c[2])}</b>${x.nota?`<small>${esc(x.nota)}</small>`:''}</span><b>${eur(x.importo)}</b><button type="button" class="x" data-sprm="${i}" aria-label="Togli">×</button></div>`;}).join('')+
    `<div class="spcats" id="spPCats">${chipsSpese(S.cat,'spc')}</div>
    <div class="g2"><label>Importo €<input id="spPImp" inputmode="decimal" placeholder="0,00"></label><label>Nota<input id="spPNota" placeholder="es. regalo, pranzo"></label></div>
    <div class="acts"><button type="button" class="btn ghost sm" id="spPAdd">+ Aggiungi spesa</button>${tot?`<span class="muted sm" style="align-self:center">Totale ${eur(tot)}</span>`:''}</div>
    <div class="acts"><button type="button" class="btn ghost sm" data-bcimp>🏦 Importa movimenti della banca</button></div><p class="sm bcerr" role="alert" hidden></p>`; // 24c.10 (D-147): banca.js
}
function aggiungiSp(){const v=num($('spPImp').value);if(!(v>0))return false;const cat=S.cat||'altro';S.sp.push(conCopiaSp({cat,importo:Math.round(v*100)/100,nota:$('spPNota').value.trim()},cat));renderSp();aggiornaSum();return true;}

function aggiornaSum(){
  const st=S.lav;const l=st&&lav0(st.lid);const t=l&&st.tipo?C.tipoDi(l,st.tipo):null;
  $('secLavSum').textContent=st&&st.tipo!==undefined?(t?t.nome:'orario diverso'):'';
  const tot=S.sp.reduce((a,x)=>a+x.importo,0);$('secSpeseSum').textContent=tot?eur(tot):'';
  $('secProgSum').textContent=md?.noProj?'':prog(md?.e?.pid)?.nome||'';
}

// ================= progetti: "+" per un nuovo progetto, turni, rimborsi spesa =================
const _fillEv16=fillEv;
fillEv=function(e){_fillEv16(e);dopoFill();};
function dopoFill(){
  if(!md||md.noProj||!md.e)return;
  if(!$('evProj').querySelector('[data-newproj]'))$('evProj').insertAdjacentHTML('beforeend','<button type="button" class="pchip add" data-newproj aria-label="Nuovo progetto">+</button>');
  // scontrini dentro "Rimborsi spesa": se l'attività ne ha, la sezione si apre
  if((md.e.spese||[]).length&&!$('evRimb').checked){$('evRimb').checked=true;$('evRimbBox').hidden=false;}
  renderTurni();aggiornaSum();
}
function presetUsati(){const p=prog(md.e.pid);return (md.e.fasce||[]).map(f=>({f,pr:p.ore.fasce.find(q=>q.da===f.da&&q.a===f.a)})).filter(x=>x.pr);}
function renderTurni(){
  const p=prog(md.e.pid);if(!p)return;const usati=presetUsati();
  if(!$('evTurniBox').dataset.toccato)$('evTurniOn').checked=usati.length>0;
  $('evTurniBox').hidden=!$('evTurniOn').checked;
  $('evTurniSel').innerHTML=usati.map(x=>`<div class="tsel"><b>${esc(x.pr.nome||'Turno')}</b><span class="muted sm">${esc(x.f.da)}–${esc(x.f.a)}</span><button type="button" class="x" data-tsrm="${esc(x.pr.id)}" aria-label="Togli">×</button></div>`).join('');
  $('evTurniPick').hidden=!pick;
  if(pick)$('evTurniPick').innerHTML=`<div class="tpick">${p.ore.fasce.map(f=>modTurno===f.id?
      `<div class="tpr"><input class="nm" data-tm="nome" value="${esc(f.nome||'')}" placeholder="Nome"><input type="time" data-tm="da" value="${esc(f.da)}"><input type="time" data-tm="a" value="${esc(f.a)}"><button type="button" class="btn sm" data-tsave="${esc(f.id)}">Ok</button><button type="button" class="x" data-tdel="${esc(f.id)}" aria-label="Elimina turno">🗑</button></div>`
      :`<div class="tpr"><span class="nm"><b>${esc(f.nome||'Turno')}</b> <span class="muted sm">${esc(f.da)}–${esc(f.a)}</span></span><button type="button" class="btn sm" data-tuse="${esc(f.id)}">Usa</button><button type="button" class="btn ghost sm" data-tedit="${esc(f.id)}">Modifica</button></div>`).join('')||'<p class="muted sm">Nessun turno impostato in questo progetto.</p>'}
    <div class="tpr"><input class="nm" id="tnNome" placeholder="Nuovo turno (es. Allenamento)"><input type="time" id="tnDa"><input type="time" id="tnA"><button type="button" class="btn ghost sm" id="tnAdd">+</button></div></div>`;
}
function usaTurno(f){const x=readEv();x.fasce=(x.fasce||[]).filter(q=>!(q.da===''&&q.a===''));
  if(!x.fasce.some(q=>q.da===f.da&&q.a===f.a))x.fasce=[...x.fasce,{da:f.da,a:f.a,id:f.id}].sort((a,b)=>min(a.da)-min(b.da));
  x.ore=true;if(x.tipo!=='allenamento'&&!x.titolo&&f.nome)x.titolo=f.nome;pick=false;fillEv(x);$('evOreBox').hidden=false;}

// ================= ripetizione: inizio del contratto e durata =================
function prepRipetizione(){
  if(!md||md.noProj||md.id)return;$('evRipDal').value=md.dates[0]||'';$('evRipDur').value='data';$('evRipMesi').value=12;mostraDurata();
}
function mostraDurata(){const m=$('evRipDur').value==='mesi';$('evRipMesiL').hidden=!m;$('evRipFinoL').hidden=m;}
function fineDaMesi(dal,n){const d=parseYmd(dal);const f=new Date(d.getFullYear(),d.getMonth()+n,d.getDate()-1);return ymd(f);}

// ================= salvataggio =================
const _saveEv16=saveEv;
saveEv=async function(){
  if(md.id)return _saveEv16();
  letturaLav();
  // v23 (D-017 n. 10): si salva ciò che è compilato, anche se la sezione è stata richiusa
  if($('spPImp')&&num($('spPImp').value)>0)aggiungiSp();
  const dates=[...md.dates];
  const progOn=!md.noProj&&($('secProg').open||!!md.progToccato);
  const st=S.lav&&S.lav.tipo!==undefined?S.lav:null;
  const sp=S.sp;
  const fx=!!(window.FissaEv&&FissaEv.compilata()); // v24 (D-060): uscita fissa da qui
  if(fx&&!FissaEv.valida())return;
  const xe=!!(window.ExtraEv&&ExtraEv.compilata()); // 24c.13 (D-074): entrata extra da qui
  if(xe&&!ExtraEv.valida())return;
  if(!progOn&&!st&&!sp.length&&!fx&&!xe){toast('Non c’è niente da salvare: apri una sezione e compilala.','err');return;}
  if(st){const l=lav0(st.lid),t=st.tipo?C.tipoDi(l,st.tipo):null;
    if(!t&&!(st.da&&st.a)&&!st.ore){toast('Lavoro: scrivi l’orario (dalle–alle) o le ore.','err');$('secLav').open=true;return;}
    if(t&&serveOre(t,l)&&!(st.da&&st.a)&&!st.ore){toast('Lavoro: scrivi quante ore.','err');$('secLav').open=true;return;}}
  let parti=[];
  if(progOn){
    // rimborsi spesa: solo scontrini, senza km
    const kmOk=+String($('evKm').value).replace(',','.')>0||($('evLuogo').value==='__new'&&$('evNewLuogoN').value.trim());
    if($('evRimb').checked&&!kmOk&&(md.e.spese||[]).length)$('evRimb').checked=false;
    // ripetizione con inizio e durata
    if($('evRip').checked&&md.dates.length===1){const dal=$('evRipDal').value;if(!dal){toast('Scegli da quando inizia.','err');return;}
      if($('evRipDur').value==='mesi'){const n=Math.round(numP($('evRipMesi').value));if(!(n>0)){toast('Scrivi per quanti mesi.','err');return;}$('evRipFino').value=fineDaMesi(dal,n);}
      md.dates=[dal];}
    await _saveEv16();
    if(!$('evModal').hidden){md.dates=dates;return;} // salvataggio non riuscito: resto nella finestra
    parti.push('attività');
  } else {closeEv();if(multi){multi=false;selected.clear();}}
  if(st){window.Stip15.metti(st.lid,dates,st.tipo||null,{da:st.da,a:st.a,pausa:st.pausa,ore:st.ore,nota:st.nota});parti.push(dates.length>1?`lavoro in ${dates.length} giorni`:'lavoro');}
  if(sp.length){const now=Date.now();let i=0;for(const d of dates)for(const x of sp){const id=uid();SP()[id]=Object.assign({id,data:d,created:now+i++,updatedAt:now},x);}
    parti.push(sp.length===1?'1 spesa':`${sp.length} spese`);}
  if(fx){FissaEv.salva();parti.push('uscita fissa');}
  if(xe){ExtraEv.salva();parti.push('entrata extra');}
  if(st||sp.length||fx||xe){changed();render();}
  if(parti.length>1||!progOn)toast('Salvato: '+parti.join(', ')+'.');
};

// ================= giorno, calendario e riepilogo: spese del giorno =================
const _apriGiorno16=apriGiorno;
apriGiorno=function(d){_apriGiorno16(d);renderSpeseGiorno(d);};
function renderSpeseGiorno(d){
  let box=$('daySpese');if(!box){box=document.createElement('div');box.id='daySpese';$('dayBox').appendChild(box);}
  const L=speseDel(s=>s.data===d);const tot=L.reduce((a,s)=>a+num(s.importo),0);
  box.innerHTML=L.length?`<div class="tubox"><div class="tuh"><b>🛒 Spese giornaliere</b><small class="muted">${eur(tot)}</small></div>${L.map(s=>{const c=catDi(s.cat,s);return `<div class="sprow"><span>${c[1]}</span><span class="tx"><b>${esc(c[2])}</b>${s.nota?`<small>${esc(s.nota)}</small>`:''}</span><b>${eur(num(s.importo))}</b><button type="button" class="x" data-spdel="${esc(s.id)}" aria-label="Elimina spesa">×</button></div>`;}).join('')}</div>`:'';
  if(tot){const ds=$('daySum');if(ds&&!ds.querySelector('[data-sptot]'))ds.insertAdjacentHTML('beforeend',`<span data-sptot><b>${eur(r2(tot))}</b> spesi</span>`);}
}
const _renderCal16=renderCal;
renderCal=function(){_renderCal16();const per={};for(const s of speseDel(s=>s.data.startsWith(cur)))per[s.data]=(per[s.data]||0)+num(s.importo);
  document.querySelectorAll('#grid [data-day]').forEach(b=>{const v=per[b.dataset.day];if(v)b.querySelector('.evs').insertAdjacentHTML('beforeend',`<span class="ev sp" style="--c:#8a8f98">🛒 ${nf(v,v%1?2:0)} €</span>`);});};
const _renderRie16=renderRiepilogo;
renderRiepilogo=function(){_renderRie16();$('rieSpese').innerHTML='';
  const y=cur.slice(0,4);const anno=rieMode==='anno';const L=speseDel(s=>anno?meseSpesa(s).startsWith(y):meseSpesa(s)===cur);if(!L.length)return; // 24c.11 (D-152): il mese in cui conta
  const tot=L.reduce((a,s)=>a+num(s.importo),0);const per={},voce={};for(const s of L){per[s.cat]=(per[s.cat]||0)+num(s.importo);voce[s.cat]=voce[s.cat]||s;}
  const righe=Object.entries(per).sort((a,b)=>b[1]-a[1]).map(([k,v])=>{const c=catDi(k,voce[k]);return `<div class="kv"><span>${c[1]} ${esc(c[2])}</span><b>${eur(r2(v))}</b></div>`;}).join('');
  let mesi='';if(anno){const pm={};for(const s of L){const m=meseSpesa(s);pm[m]=(pm[m]||0)+num(s.importo);}mesi='<p class="muted sm">Per mese</p>'+Object.keys(pm).sort().map(m=>`<div class="kv"><span>${esc(monthName(m))}</span><b>${eur(r2(pm[m]))}</b></div>`).join('');}
  const h=`<div class="card"><h3>🛒 Spese giornaliere${anno?' '+y:''}</h3>${righe}<div class="kv big"><span>Totale</span><b>${eur(r2(tot))}</b></div>${mesi}</div>`;
  $('rieSpese').insertAdjacentHTML('beforeend',h);}; // 24b.1 (D-098): nella pagina "Spese giornaliere" (mese e anno)

// ================= impostazioni: icone colorate per ogni sezione (v17) =================
// 24b.1 (D-098 punti 6-7): icone anche per Pensione (simbolo e colore della pagina Pensione, mockup 02 della v22) e per Uscite fisse (mockup 02 della tornata 23)
const ICONE=[[/^lavoro dipendente/i,'💼','#1c7ed6'],[/^pensione/i,'🏛️','#5d6b7a'],[/^uscite fisse/i,'💳','#495057'],[/^progetti/i,'📁','#e8590c'],
  [/^account/i,'👤','#0ca678'],[/^aspetto/i,'🎨','#f59f00'],[/^blocco/i,'🔒','#495057'],
  // 24c.20 (D-182, D-190): Google Calendar e Promemoria sono dentro Account, Cestino, Storico e Copia dentro «Dati e copie di sicurezza» (le loro icone sono nel titolo)
  [/^dati e copie/i,'💾','#1c7ed6']];
function icone(){document.querySelectorAll('#v-pro details.fold>summary>.st').forEach(st=>{if(st.querySelector('.ic'))return;const t=st.textContent.trim();const m=ICONE.find(x=>x[0].test(t));
  if(m)st.insertAdjacentHTML('afterbegin',`<span class="ic" style="--ic:${m[2]}" aria-hidden="true">${m[1]}</span>`);});}

// ================= impostazioni: sezioni a comparsa, lavoro per primo =================
const _renderProg16=renderProgetti;
renderProgetti=function(){_renderProg16();
  $('foldLavSum').textContent=lavori().length||'';$('foldProjSum').textContent=progetti().length||'';
  icone();};
// dopo un nuovo progetto creato dalla finestra attività, torno lì con il progetto scelto
const _saveProj16=saveProj;
saveProj=function(){const nuovo=pe?.isNew,id=pe?.p?.id;const r=_saveProj16();
  if(nuovo&&prog(id)&&$('pjModal').hidden&&!$('evModal').hidden&&md&&!md.id){
    if(md.noProj){const lavOpen=$('secLav').open,spOpen=$('secSpese').open;openEv(md.dates,null,true);$('secLav').open=lavOpen;$('secSpese').open=spOpen;}
    const x=defaultsEv(prog(id));fillEv(x);md.pid=id;md.progToccato=true;$('secProg').open=true;document.body.classList.add('noscroll');}
  return r;};
// dopo un nuovo lavoro, aggiorno la sezione lavoro della finestra attività
const _render16=render;
render=function(){_render16();if(!$('evModal').hidden&&md&&!md.id){renderLav();aggiornaSum();renderGia();}};

function bind16(){
  $('evLav').addEventListener('click',e=>{
    if(e.target.id==='evLavNew'){$('lavNew').click();return;}
    const b=e.target.closest('[data-lt]');if(!b)return;letturaLav();const v=b.dataset.lt||null;S.lav.tipo=S.lav.tipo===v?undefined:v;renderLav();aggiornaSum();});
  $('evLav').addEventListener('change',e=>{if(e.target.id==='evLavSel'){S.lav={lid:e.target.value,tipo:undefined,da:'',a:'',pausa:'',ore:'',nota:''};renderLav();aggiornaSum();}});
  $('evLav').addEventListener('input',e=>{if(e.target.dataset.lk)S.lav[e.target.dataset.lk]=e.target.value.trim();});
  $('evSpP').addEventListener('click',e=>{const c=e.target.closest('#spPCats [data-spc],#spPCats [data-scmod],#spPCats [data-sctogli]');if(c){toccaSpesa(c,'spc',{set:k=>{S.cat=k;},imp:'spPImp',ridisegna:()=>{if($('spPCats'))$('spPCats').innerHTML=chipsSpese(S.cat,'spc');}});return;}
    const r=e.target.closest('[data-sprm]');if(r){S.sp.splice(+r.dataset.sprm,1);renderSp();aggiornaSum();return;}
    if(e.target.id==='spPAdd'&&!aggiungiSp())toast('Scrivi l’importo.','err');});
  $('evSpP').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='spPImp'){e.preventDefault();aggiungiSp();}});
  for(const id of ['secLav','secProg','secSpese'])$(id).addEventListener('toggle',aggiornaSum);
  $('evProgNew').onclick=()=>openProj();
  $('evProj').addEventListener('click',e=>{if(e.target.closest('[data-newproj]'))openProj();});
  $('evTurniOn').onchange=()=>{$('evTurniBox').dataset.toccato='1';$('evTurniBox').hidden=!$('evTurniOn').checked;if($('evTurniOn').checked&&!presetUsati().length){pick=true;renderTurni();}};
  $('evTurniPiu').onclick=()=>{pick=!pick;modTurno=null;renderTurni();};
  $('evTurniBox').addEventListener('click',e=>{const p=prog(md.e.pid);const t=e.target;const f=id=>p.ore.fasce.find(q=>q.id===id);
    if(t.dataset.tuse){usaTurno(f(t.dataset.tuse));return;}
    if(t.dataset.tedit){modTurno=t.dataset.tedit;renderTurni();return;}
    if(t.dataset.tsrm){const x=readEv();const q=f(t.dataset.tsrm);x.fasce=(x.fasce||[]).filter(z=>!(z.da===q.da&&z.a===q.a));fillEv(x);return;}
    if(t.dataset.tsave){const q=f(t.dataset.tsave);const row=t.closest('.tpr');const v=k=>row.querySelector(`[data-tm=${k}]`).value;
      if(!v('da')||!v('a')){toast('Scrivi dalle–alle.','err');return;}
      const x=readEv();for(const z of x.fasce||[])if(z.da===q.da&&z.a===q.a){z.da=v('da');z.a=v('a');}
      q.nome=v('nome').trim();q.da=v('da');q.a=v('a');p.updatedAt=Date.now();changed();modTurno=null;fillEv(x);return;}
    if(t.dataset.tdel){const q=f(t.dataset.tdel);if(!q)return;p.ore.fasce=p.ore.fasce.filter(z=>z!==q);p.updatedAt=Date.now();changed();modTurno=null;fillEv(readEv());return;}
    if(t.id==='tnAdd'){const nome=$('tnNome').value.trim(),da=$('tnDa').value,a=$('tnA').value;if(!da||!a){toast('Scrivi dalle–alle del nuovo turno.','err');return;}
      const q={id:uid(),nome:nome||'Turno',da,a};p.ore.fasce.push(q);p.updatedAt=Date.now();changed();usaTurno(q);toast('Turno aggiunto al progetto.');}});
  $('evRipDur').onchange=mostraDurata;
  // 24c.15 (D-171)
  $('evGia').addEventListener('click',giaClick);
  $('spmCats').addEventListener('click',e=>{const c=e.target.closest('[data-spmc],[data-scmod],[data-sctogli]');if(c&&spEd)toccaSpesa(c,'spmc',{set:k=>{if(spEd)spEd.cat=k;},imp:'spmImp',ridisegna:()=>{if(spEd)spmChips();}});});
  $('spmClose').onclick=chiudiSpesa;$('spmAnnulla').onclick=chiudiSpesa;$('spmOk').onclick=salvaSpesa;$('spmDel').onclick=eliminaSpesa;
  $('spModal').addEventListener('click',e=>{if(e.target.id==='spModal')chiudiSpesa();});
  $('dayBox').addEventListener('click',async e=>{const b=e.target.closest('[data-spdel]');if(!b)return;const s=SP()[b.dataset.spdel];if(!s)return;
    if(!await conferma(`Eliminare la spesa di ${eur(num(s.importo))}?`,'Elimina','danger'))return;s.deleted=true;s.updatedAt=Date.now();changed();render();apriGiorno(selDay);});
  // v23: compilare qualcosa nella sezione Progetti vale come "da salvare" anche se poi la sezione si richiude
  for(const ev of ['input','change','click'])$('secProg').addEventListener(ev,e=>{if(md&&!e.target.closest('summary')&&(ev!=='click'||e.target.closest('button')))md.progToccato=true;});
}
bind16();
render();
window.Att16={S,speseDel,fineDaMesi,apriSpesa};
document.addEventListener('click',e=>{if(e.target.closest('#evFotoBtn'))turniDaFoto();});
})();
