'use strict';
// ================= Soldirini v16 · finestra "Nuova attività" a sezioni, spese del giorno =================
// Sezioni a comparsa: Lavoro dipendente, Progetti, Spese del giorno (si salvano solo quelle aperte).
// Nei progetti: turni (orari già impostati), ripetizione con inizio e durata, rimborsi spesa (km + scontrini).
(function(){
const C=window.StipCalc;
const SP=()=>D().spesePers||(D().spesePers={});
const speseDel=fn=>Object.values(SP()).filter(s=>!s.deleted&&fn(s)).sort((a,b)=>(a.data+a.created).localeCompare(b.data+b.created));
const CATS=[['online','📦','Online / Amazon'],['negozio','🛍️','Negozio'],['spesa','🛒','Supermercato'],['bar','☕','Bar e ristoranti'],['amici','🍻','Amici e uscite'],['trasporti','🚗','Trasporti e benzina'],['casa','🏠','Casa e bollette'],['altro','•','Altro']];
const catDi=k=>CATS.find(c=>c[0]===k)||CATS[CATS.length-1];
const num=v=>{const n=parseFloat(String(v??'').replace(',','.'));return isNaN(n)?0:n;};
const pref=()=>{try{return JSON.parse(localStorage.getItem('soldirini-sez')||'{}');}catch(e){return {};}};
const setPref=o=>{try{localStorage.setItem('soldirini-sez',JSON.stringify(Object.assign(pref(),o)));}catch(e){}};
let S={lav:null,sp:[],cat:'online'};let pick=false,modTurno=null; // stato delle sezioni mentre la finestra è aperta
window.spesePersonali=speseDel;

// ================= apertura della finestra =================
const _openEv16=openEv;
openEv=function(dates,e,tieni){
  if(!tieni){S={lav:null,sp:[],cat:S.cat||'online'};pick=false;modTurno=null;delete $('evTurniBox').dataset.toccato;}
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
  if(!tieni){const p=pref();$('secProg').open=modifica||(!md.noProj&&p.prog!==false);$('secLav').open=!modifica&&!!p.lav&&lavori().length>0;$('secSpese').open=!modifica&&!!p.sp;}
  if(!md.noProj)dopoFill();
  if(!modifica)prepRipetizione();
  renderLav();renderSp();aggiornaSum();
};

// ================= sezione Lavoro dipendente =================
function renderLav(){
  const L=lavori();const box=$('evLav');
  if(!L.length){box.innerHTML='<p class="muted sm" style="margin-top:0">Se sei dipendente, aggiungi il tuo lavoro (orario fisso o turni): qui potrai segnare turni, straordinari, ferie e permessi.</p><button type="button" class="btn sm" id="evLavNew">+ Aggiungi lavoro</button>';return;}
  const st=S.lav&&lav0(S.lav.lid)?S.lav:(S.lav={lid:L[0].id,tipo:undefined,da:'',a:'',pausa:'',ore:'',nota:''});const l=lav0(st.lid);
  const d0=md.dates[0];let oggi='';
  if(md.dates.length===1){const G=C.vociGiorno(l,turniDi(l.id).filter(t=>t.data===d0),d0);oggi=G.voci.map(v=>esc((v.tipo?.icona?v.tipo.icona+' ':'')+v.nome+(v.daS&&v.aS?' '+v.daS+'–'+v.aS:'')+(v.implicito?' (abituale)':''))).join(' · ');}
  const t=st.tipo?C.tipoDi(l,st.tipo):null;const scelto=st.tipo!==undefined;
  const servOrari=scelto&&(!t||t.cat==='lavoro'||t.cat==='variabile');const servOre=scelto&&(!t||!(t.da&&t.a));
  box.innerHTML=(L.length>1?`<label>Lavoro<select id="evLavSel">${L.map(x=>`<option value="${x.id}" ${x.id===l.id?'selected':''}>${esc(x.nome)}</option>`).join('')}</select></label>`:`<p class="sm" style="margin-top:0"><b>${esc(l.nome)}</b></p>`)+
    (oggi?`<p class="muted sm">Già segnato: ${oggi}</p>`:'')+
    `<div class="tuchips">${l.tipi.map(x=>`<button type="button" class="chip ${st.tipo===x.id?'on':''}" style="--c:${x.colore||l.colore}" data-lt="${x.id}">${esc((x.icona?x.icona+' ':'')+x.nome)}</button>`).join('')}<button type="button" class="chip ${st.tipo===null?'on':''}" data-lt="">Orario diverso</button></div>`+
    (scelto?`<div class="g2" style="margin-top:8px">${servOrari?`<label>Dalle<input type="time" data-lk="da" value="${esc(st.da)}"></label><label>Alle<input type="time" data-lk="a" value="${esc(st.a)}"></label><label>Pausa (min)<input type="number" inputmode="numeric" data-lk="pausa" value="${esc(st.pausa)}"></label>`:''}${servOre?`<label>Ore<input type="number" inputmode="decimal" step="0.25" data-lk="ore" value="${esc(st.ore)}"></label>`:''}<label class="s2">Nota<input data-lk="nota" value="${esc(st.nota)}"></label></div>
      <p class="muted sm">${!t?'Sostituisce l’orario di quel giorno.':t.da&&t.a?`Orario del tipo: ${t.da}–${t.a}. Cambialo solo se quel giorno è diverso.`:C.PAGATE.includes(t.cat)?'Lascia vuote le ore per contare l’orario abituale del giorno.':'Scrivi le ore (oppure dalle–alle).'}</p>`:'<p class="muted sm">Tocca un tipo per segnarlo in questo giorno.</p>');
}
const lav0=id=>(D().lavori||{})[id];
function letturaLav(){const st=S.lav;if(!st)return;document.querySelectorAll('#evLav [data-lk]').forEach(i=>st[i.dataset.lk]=i.value.trim());}

// ================= sezione Spese del giorno =================
function renderSp(){
  const tot=S.sp.reduce((a,x)=>a+x.importo,0);
  $('evSpP').innerHTML=`<p class="muted sm" style="margin-top:0">Le tue spese personali (non rimborsate): servono per vedere quanto spendi e quanto risparmi.</p>`+
    S.sp.map((x,i)=>{const c=catDi(x.cat);return `<div class="sprow"><span>${c[1]}</span><span class="tx"><b>${esc(c[2])}</b>${x.nota?`<small>${esc(x.nota)}</small>`:''}</span><b>${eur(x.importo)}</b><button type="button" class="x" data-sprm="${i}" aria-label="Togli">×</button></div>`;}).join('')+
    `<div class="spcats">${CATS.map(c=>`<button type="button" class="chip ${S.cat===c[0]?'on':''}" data-spc="${c[0]}">${c[1]} ${esc(c[2])}</button>`).join('')}</div>
    <div class="g2"><label>Importo €<input id="spPImp" inputmode="decimal" placeholder="0,00"></label><label>Nota<input id="spPNota" placeholder="es. regalo, pranzo"></label></div>
    <div class="acts"><button type="button" class="btn ghost sm" id="spPAdd">+ Aggiungi spesa</button>${tot?`<span class="muted sm" style="align-self:center">Totale ${eur(tot)}</span>`:''}</div>`;
}
function aggiungiSp(){const v=num($('spPImp').value);if(!(v>0))return false;S.sp.push({cat:S.cat,importo:Math.round(v*100)/100,nota:$('spPNota').value.trim()});renderSp();aggiornaSum();return true;}

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
      `<div class="tpr"><input class="nm" data-tm="nome" value="${esc(f.nome||'')}" placeholder="Nome"><input type="time" data-tm="da" value="${esc(f.da)}"><input type="time" data-tm="a" value="${esc(f.a)}"><button type="button" class="btn sm" data-tsave="${f.id}">Ok</button><button type="button" class="x" data-tdel="${f.id}" aria-label="Elimina turno">🗑</button></div>`
      :`<div class="tpr"><span class="nm"><b>${esc(f.nome||'Turno')}</b> <span class="muted sm">${esc(f.da)}–${esc(f.a)}</span></span><button type="button" class="btn sm" data-tuse="${f.id}">Usa</button><button type="button" class="btn ghost sm" data-tedit="${f.id}">Modifica</button></div>`).join('')||'<p class="muted sm">Nessun turno impostato in questo progetto.</p>'}
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
  if($('secSpese').open&&$('spPImp')&&num($('spPImp').value)>0)aggiungiSp();
  const dates=[...md.dates];const aperte={prog:$('secProg').open,lav:$('secLav').open,sp:$('secSpese').open},senzaProg=!!md.noProj;
  const progOn=$('secProg').open&&!md.noProj;
  const st=$('secLav').open&&S.lav&&S.lav.tipo!==undefined?S.lav:null;
  const sp=$('secSpese').open?S.sp:[];
  if(!progOn&&!st&&!sp.length){toast('Non c’è niente da salvare: apri una sezione e compilala.','err');return;}
  if(st){const l=lav0(st.lid),t=st.tipo?C.tipoDi(l,st.tipo):null;
    if(!t&&!(st.da&&st.a)&&!st.ore){toast('Lavoro: scrivi l’orario (dalle–alle) o le ore.','err');$('secLav').open=true;return;}
    if(t&&(t.cat==='variabile'||t.cat==='permesso'||t.aggiunta||t.cat==='nonretr')&&!(t.da&&t.a)&&t.ore===''&&!(st.da&&st.a)&&!st.ore){toast('Lavoro: scrivi quante ore.','err');$('secLav').open=true;return;}}
  let parti=[];
  if(progOn){
    // rimborsi spesa: solo scontrini, senza km
    const kmOk=+String($('evKm').value).replace(',','.')>0||($('evLuogo').value==='__new'&&$('evNewLuogoN').value.trim());
    if($('evRimb').checked&&!kmOk&&(md.e.spese||[]).length)$('evRimb').checked=false;
    // ripetizione con inizio e durata
    if($('evRip').checked&&md.dates.length===1){const dal=$('evRipDal').value;if(!dal){toast('Scegli da quando inizia.','err');return;}
      if($('evRipDur').value==='mesi'){const n=Math.round(num($('evRipMesi').value));if(!(n>0)){toast('Scrivi per quanti mesi.','err');return;}$('evRipFino').value=fineDaMesi(dal,n);}
      md.dates=[dal];}
    await _saveEv16();
    if(!$('evModal').hidden){md.dates=dates;return;} // salvataggio non riuscito: resto nella finestra
    parti.push('attività');
  } else {closeEv();if(multi){multi=false;selected.clear();}}
  if(st){window.Stip15.metti(st.lid,dates,st.tipo||null,{da:st.da,a:st.a,pausa:st.pausa,ore:st.ore,nota:st.nota});parti.push(dates.length>1?`lavoro in ${dates.length} giorni`:'lavoro');}
  if(sp.length){const now=Date.now();let i=0;for(const d of dates)for(const x of sp){const id=uid();SP()[id]=Object.assign({id,data:d,created:now+i++,updatedAt:now},x);}
    parti.push(sp.length===1?'1 spesa':`${sp.length} spese`);}
  setPref(Object.assign(senzaProg?{}:{prog:aperte.prog},{lav:aperte.lav,sp:aperte.sp}));
  if(st||sp.length){changed();render();}
  if(parti.length>1||!progOn)toast('Salvato: '+parti.join(', ')+'.');
};

// ================= giorno, calendario e riepilogo: spese del giorno =================
const _apriGiorno16=apriGiorno;
apriGiorno=function(d){_apriGiorno16(d);renderSpeseGiorno(d);};
function renderSpeseGiorno(d){
  let box=$('daySpese');if(!box){box=document.createElement('div');box.id='daySpese';$('dayBox').appendChild(box);}
  const L=speseDel(s=>s.data===d);const tot=L.reduce((a,s)=>a+num(s.importo),0);
  box.innerHTML=L.length?`<div class="tubox"><div class="tuh"><b>🛒 Spese del giorno</b><small class="muted">${eur(tot)}</small></div>${L.map(s=>{const c=catDi(s.cat);return `<div class="sprow"><span>${c[1]}</span><span class="tx"><b>${esc(c[2])}</b>${s.nota?`<small>${esc(s.nota)}</small>`:''}</span><b>${eur(num(s.importo))}</b><button type="button" class="x" data-spdel="${s.id}" aria-label="Elimina spesa">×</button></div>`;}).join('')}</div>`:'';
  if(tot){const ds=$('daySum');if(ds&&!ds.querySelector('[data-sptot]'))ds.insertAdjacentHTML('beforeend',`<span data-sptot><b>${eur(r2(tot))}</b> spesi</span>`);}
}
const _renderCal16=renderCal;
renderCal=function(){_renderCal16();const per={};for(const s of speseDel(s=>s.data.startsWith(cur)))per[s.data]=(per[s.data]||0)+num(s.importo);
  document.querySelectorAll('#grid [data-day]').forEach(b=>{const v=per[b.dataset.day];if(v)b.querySelector('.evs').insertAdjacentHTML('beforeend',`<span class="ev sp" style="--c:#8a8f98">🛒 ${nf(v,v%1?2:0)} €</span>`);});};
const _renderRie16=renderRiepilogo;
renderRiepilogo=function(){_renderRie16();
  const y=cur.slice(0,4);const anno=rieMode==='anno';const L=speseDel(s=>anno?s.data.startsWith(y):s.data.startsWith(cur));if(!L.length)return;
  const tot=L.reduce((a,s)=>a+num(s.importo),0);const per={};for(const s of L)per[s.cat]=(per[s.cat]||0)+num(s.importo);
  const righe=Object.entries(per).sort((a,b)=>b[1]-a[1]).map(([k,v])=>{const c=catDi(k);return `<div class="kv"><span>${c[1]} ${esc(c[2])}</span><b>${eur(r2(v))}</b></div>`;}).join('');
  let mesi='';if(anno){const pm={};for(const s of L){const m=s.data.slice(0,7);pm[m]=(pm[m]||0)+num(s.importo);}mesi='<p class="muted sm">Per mese</p>'+Object.keys(pm).sort().map(m=>`<div class="kv"><span>${esc(monthName(m))}</span><b>${eur(r2(pm[m]))}</b></div>`).join('');}
  const h=`<div class="card"><h3>🛒 Spese personali${anno?' '+y:''}</h3>${righe}<div class="kv big"><span>Totale</span><b>${eur(r2(tot))}</b></div>${mesi}</div>`;
  (anno?$('rieAnno'):$('rieCards')).insertAdjacentHTML('beforeend',h);};

// ================= impostazioni: icone colorate per ogni sezione (v17) =================
const ICONE=[[/^lavoro dipendente/i,'💼','#1c7ed6'],[/^progetti/i,'📁','#e8590c'],[/^google calendar/i,'📅','#2f9e44'],[/^dati di strafobico/i,'🔄','#7048e8'],[/vecchia app/i,'📦','#868e96'],
  [/^account/i,'👤','#0ca678'],[/^i tuoi dati/i,'🪪','#7048e8'],[/^la tua firma/i,'✍️','#c2255c'],[/^aspetto/i,'🎨','#f59f00'],[/^promemoria/i,'🔔','#e8590c'],[/^blocco/i,'🔒','#495057'],
  [/^cestino/i,'🗑️','#c92a2a'],[/^storico/i,'🕘','#1098ad'],[/^copia di sicurezza/i,'💾','#1c7ed6']];
function icone(){document.querySelectorAll('#v-pro details.fold>summary>.st').forEach(st=>{if(st.querySelector('.ic'))return;const t=st.textContent.trim();const m=ICONE.find(x=>x[0].test(t));
  if(m)st.insertAdjacentHTML('afterbegin',`<span class="ic" style="--ic:${m[2]}" aria-hidden="true">${m[1]}</span>`);});}

// ================= impostazioni: sezioni a comparsa, lavoro per primo =================
const _renderProg16=renderProgetti;
renderProgetti=function(){_renderProg16();
  $('foldLavSum').textContent=lavori().length||'';$('foldProjSum').textContent=progetti().length||'';
  try{const f=JSON.parse(localStorage.getItem('soldirini-foldpro')||'{}');if(f.lav!=null&&!$('foldLav').dataset.init)$('foldLav').open=f.lav;if(f.proj!=null&&!$('foldProj').dataset.init)$('foldProj').open=f.proj;}catch(e){}
  $('foldLav').dataset.init=$('foldProj').dataset.init='1';icone();};
// dopo un nuovo progetto creato dalla finestra attività, torno lì con il progetto scelto
const _saveProj16=saveProj;
saveProj=function(){const nuovo=pe?.isNew,id=pe?.p?.id;const r=_saveProj16();
  if(nuovo&&prog(id)&&$('pjModal').hidden&&!$('evModal').hidden&&md&&!md.id){
    if(md.noProj){const lavOpen=$('secLav').open,spOpen=$('secSpese').open;openEv(md.dates,null,true);$('secLav').open=lavOpen;$('secSpese').open=spOpen;}
    const x=defaultsEv(prog(id));fillEv(x);md.pid=id;$('secProg').open=true;document.body.classList.add('noscroll');}
  return r;};
// dopo un nuovo lavoro, aggiorno la sezione lavoro della finestra attività
const _render16=render;
render=function(){_render16();if(!$('evModal').hidden&&md&&!md.id){renderLav();aggiornaSum();}};

function bind16(){
  $('evLav').addEventListener('click',e=>{
    if(e.target.id==='evLavNew'){$('lavNew').click();return;}
    const b=e.target.closest('[data-lt]');if(!b)return;letturaLav();const v=b.dataset.lt||null;S.lav.tipo=S.lav.tipo===v?undefined:v;renderLav();aggiornaSum();});
  $('evLav').addEventListener('change',e=>{if(e.target.id==='evLavSel'){S.lav={lid:e.target.value,tipo:undefined,da:'',a:'',pausa:'',ore:'',nota:''};renderLav();aggiornaSum();}});
  $('evLav').addEventListener('input',e=>{if(e.target.dataset.lk)S.lav[e.target.dataset.lk]=e.target.value.trim();});
  $('evSpP').addEventListener('click',e=>{const c=e.target.closest('[data-spc]');if(c){S.cat=c.dataset.spc;document.querySelectorAll('#evSpP [data-spc]').forEach(x=>x.classList.toggle('on',x===c));return;}
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
  $('dayBox').addEventListener('click',async e=>{const b=e.target.closest('[data-spdel]');if(!b)return;const s=SP()[b.dataset.spdel];if(!s)return;
    if(!await conferma(`Eliminare la spesa di ${eur(num(s.importo))}?`,'Elimina','danger'))return;s.deleted=true;s.updatedAt=Date.now();changed();render();apriGiorno(selDay);});
  for(const [id,k] of [['foldLav','lav'],['foldProj','proj']])$(id).addEventListener('toggle',()=>{try{const f=JSON.parse(localStorage.getItem('soldirini-foldpro')||'{}');f[k]=$(id).open;localStorage.setItem('soldirini-foldpro',JSON.stringify(f));}catch(e){}});
}
bind16();
render();
window.Att16={S,speseDel,fineDaMesi};
})();
