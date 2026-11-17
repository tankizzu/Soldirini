'use strict';
// ================= Soldirini v18 · soldi rimanenti, pagamenti fissi, occhio, calendari, scorrimento, backup =================
(function(){
const num=v=>{const n=parseFloat(String(v??'').replace(',','.'));return isNaN(n)?0:n;};
const FX=()=>D().fissi||(D().fissi={});
const fissi=()=>Object.values(FX()).filter(f=>!f.deleted).sort((a,b)=>(+a.giorno||0)-(+b.giorno||0)||a.nome.localeCompare(b.nome));
const FCAT=[['netflix','🎬','Netflix'],['disney','✨','Disney+'],['mutuo','🏠','Mutuo'],['rata','💳','Rata'],['abbonamento','📱','Abbonamento'],['utenze','💡','Utenze'],['altro','•','Altro']];
const fcat=k=>FCAT.find(c=>c[0]===k)||FCAT[FCAT.length-1];
const addMese=(ym,n)=>{const d=new Date(+ym.slice(0,4),+ym.slice(5)-1+n,1);return `${d.getFullYear()}-${pad(d.getMonth()+1)}`;};
const fineFisso=f=>f.al||(+f.rate>0?addMese(f.dal,+f.rate-1):'');
const attivoNel=(f,ym)=>(!f.dal||ym>=f.dal)&&(!fineFisso(f)||ym<=fineFisso(f));
const giornoNel=(f,ym)=>{const n=new Date(+ym.slice(0,4),+ym.slice(5),0).getDate();return `${ym}-${pad(Math.min(n,Math.max(1,+f.giorno||1)))}`;};
window.fissiDel=ym=>fissi().filter(f=>attivoNel(f,ym)).map(f=>({f,data:giornoNel(f,ym)}));

// ---------- conti del mese: entrate − uscite ----------
// v24 (D-009, E-2): entrano solo le voci segnate "Entrato", nel mese della data di entrata (entrate.js).
// v24 (D-066, E-11): le uscite fisse del mese contano tutte dal primo giorno del mese (fTot); fAdd resta solo per "addebitata".
// D-067 (E-12): ogni mese è calcolato da solo, nessun saldo portato dai mesi prima.
const fissiMese=ym=>{const F=fissiDel(ym);const t=today();return {F,fTot:r2(F.reduce((a,x)=>a+num(x.f.importo),0)),fAdd:r2(F.filter(x=>x.data<=t).reduce((a,x)=>a+num(x.f.importo),0))};};
function contiMese(ym,IDX){
  const I=(IDX||(window.Entrate?Entrate.indice():{}))[ym]||{lav:0,pen:0,prog:0}; // all'avvio entrate.js può non essere ancora caricato
  const {fAdd,fTot}=fissiMese(ym);
  const sp=r2((window.spesePersonali?spesePersonali(s=>s.data.startsWith(ym)):[]).reduce((a,s)=>a+num(s.importo),0));
  const prog=r2(I.prog),lav={v:r2(I.lav),stima:false},pen={v:r2(I.pen),stima:false};
  const entrate=r2(prog+lav.v+pen.v);const usciti=r2(fTot+sp);
  return {prog,lav,pen,fAdd,fTot,fArrivo:r2(fTot-fAdd),sp,entrate,usciti,rimanenti:r2(entrate-usciti)};
}
// vista Anno (E-13 a): anno in corso fino al mese in corso; anni passati tutti i 12 mesi; anni futuri nessun mese.
// fResto = uscite fisse dei mesi dopo quello in corso (riga "ancora da addebitare entro dicembre"), non contate.
function contiAnno(y){const T={prog:0,lav:0,pen:0,fAdd:0,fTot:0,sp:0,entrate:0,usciti:0,rimanenti:0,fResto:0,stima:false,penStima:false};
  const ora=today().slice(0,7),oy=+ora.slice(0,4);const ult=+y<oy?12:+y===oy?+ora.slice(5):0;T.mesi=ult;const I=window.Entrate?Entrate.indice():{};
  for(let m=1;m<=ult;m++){const c=contiMese(`${y}-${pad(m)}`,I);for(const k of ['prog','fAdd','fTot','sp','entrate','usciti','rimanenti'])T[k]+=c[k];T.lav+=c.lav.v;T.pen+=c.pen.v;}
  if(+y===oy)for(let m=ult+1;m<=12;m++)T.fResto+=fissiMese(`${y}-${pad(m)}`).fTot;
  for(const k in T)if(typeof T[k]==='number')T[k]=r2(T[k]);return T;}
window.contiMese=contiMese;window.contiAnno=contiAnno;

// ---------- riepilogo: in alto i soldi rimanenti, poi lavoro dipendente, rimborsi, ritenuta, pagamenti fissi ----------
const _renderRie18=renderRiepilogo;
renderRiepilogo=function(){_renderRie18();
  const anno=rieMode==='anno',y=cur.slice(0,4);const hero=$('rieTot').querySelector('.hero');if(!hero)return;
  const {tot}=anno?aggrega(y):riepilogo(cur);const daInc=r2(dovuti().filter(d=>!d.pag).reduce((a,d)=>a+d.imp,0));
  const C=anno?contiAnno(y):contiMese(cur);const lavV=anno?C.lav:C.lav.v,penV=anno?C.pen:C.pen.v;
  const cella=(t,v,cls='')=>`<div class="${cls}"><small>${t}</small><b>${v}</b></div>`;
  // v24 (D-065, D-066, D-067): "Soldi rimanenti:" / "del mese"; usciti = uscite fisse del mese + spese giornaliere
  const ora=today().slice(0,7);const sotto=!anno?'del mese':+y<+ora.slice(0,4)?'somma dei mesi da gennaio a dicembre':+y===+ora.slice(0,4)?`somma dei mesi da gennaio a ${MESI[C.mesi-1]}`:'l’anno non è ancora iniziato';
  hero.innerHTML=`<div class="rim${C.rimanenti<0?' neg':''}"><small>${anno?'Rimasti nel '+y:'Soldi rimanenti:'}</small><small class="dm">${sotto}</small><b>${eur(C.rimanenti)}</b><small class="det">Entrati ${eur(C.entrate)} · usciti ${eur(C.usciti)}</small>`+
    (fissi().length?`<small class="hl">Uscite fisse: ${eur(C.fTot)}</small>`:'')+
    (C.sp||!anno?`<small class="hl">Spese giornaliere: ${eur(C.sp)}</small>`:'')+
    (anno&&C.fResto?`<small class="hl">Uscite fisse ancora da addebitare entro dicembre: ${eur(C.fResto)}</small>`:'')+`</div>`+
    (lavori().length?cella('Lavoro dipendente',eur(lavV)):'')+
    (penV||(window.Pensione&&Pensione.profilo())?cella('Pensione',eur(penV)):'')+
    cella('Rimborsi spese',eur(tot.rimb))+cella('Ritenuta d’acconto',eur(tot.rit))+
    cella(anno?'Incassato dai progetti':'Lavorato nei progetti',eur(r2(tot.netto+tot.rimb)))+cella('Ancora da incassare',eur(daInc));
  // uscite fisse del mese (D-065: "Uscite fisse" ovunque; righe "addebitata il N" / "addebito il N")
  let box=$('rieFix');if(!box){box=document.createElement('div');box.id='rieFix';box.className='cards';($('rieLav')||$('rieTot')).after(box);}
  if($('rieLav')&&box.previousElementSibling!==$('rieLav'))$('rieLav').after(box);
  const F=anno?[]:fissiDel(cur);
  if(!F.length&&!(anno&&fissi().length)){box.innerHTML='';return;}
  const t=today();
  box.innerHTML=anno?`<div class="card" data-fid="fissi" data-sum="− ${eur(C.fTot)}"><h3>💳 Uscite fisse ${y}</h3>${Array.from({length:12},(_,i)=>{const ym=`${y}-${pad(i+1)}`;const v=fissiMese(ym).fTot;
        return v?`<div class="kv"><span>${esc(monthName(ym))}${i+1>C.mesi?' <small class="muted">· non ancora contato</small>':''}</span><b>${eur(v)}</b></div>`:'';}).join('')}<div class="kv big"><span>${C.mesi===12?'Totale':C.mesi?'Totale fino a '+MESI[C.mesi-1]:'Totale'}</span><b>${eur(C.fTot)}</b></div></div>`
    :`<div class="card" data-fid="fissi" data-sum="− ${eur(C.fTot)}"><h3>💳 Uscite fisse</h3>${F.map(x=>{const c=fcat(x.f.cat);const ok=x.data<=t;return `<div class="kv"><span>${c[1]} ${esc(x.f.nome)} <small class="muted">· ${ok?'addebitata':'addebito'} il ${+x.data.slice(8)}</small></span><b>${eur(num(x.f.importo))}</b></div>`;}).join('')}<div class="kv big"><span>Totale del mese</span><b>${eur(C.fTot)}</b></div></div>`;
  foldify(box,'fissi');
};

// ---------- pagamenti fissi: impostazioni ----------
function renderFissi(){const L=fissi();$('foldFixSum').textContent=L.length?eur(r2(L.filter(f=>attivoNel(f,today().slice(0,7))).reduce((a,f)=>a+num(f.importo),0)))+'/mese':'';
  $('fixList').innerHTML=L.map(f=>{const c=fcat(f.cat);const fine=fineFisso(f);return `<button class="card prow fxr" data-fx="${f.id}"><span>${c[1]}</span><span class="tx"><b>${esc(f.nome)}</b><small>${eur(num(f.importo))} il giorno ${+f.giorno||1}${fine?' · fino a '+esc(monthName(fine)):''}</small></span><span class="chev">›</span></button>`;}).join('')||'<p class="muted sm">Nessun pagamento fisso.</p>';}
let fx=null;
function apriFisso(f){fx=f?clone(f):{id:uid(),cat:'netflix',nome:'',importo:'',giorno:'',dal:today().slice(0,7),al:'',rate:'',nota:''};const isNew=!f;
  $('fxTit').textContent=isNew?'Nuova uscita fissa':'Uscita fissa';$('fxDel').hidden=isNew;
  $('fxNome').value=fx.nome;$('fxImp').value=fx.importo;$('fxGiorno').value=fx.giorno;$('fxDal').value=fx.dal;$('fxRate').value=fx.rate;$('fxAl').value=fx.al;$('fxNota').value=fx.nota||'';
  $('fxDur').value=fx.rate?'rate':fx.al?'al':'';durata();catChips();const T=isNew?null:terminaDa(f);$('fxFine').hidden=!T;$('fxFineNota').hidden=!T;if(T)$('fxFineNota').textContent=T.testo+' “Elimina” la toglie anche dai mesi passati: usalo solo se l’hai inserita per errore.';$('fxModal').hidden=false;document.body.classList.add('noscroll');}
function catChips(){$('fxCats').innerHTML=FCAT.map(c=>`<button type="button" class="chip ${fx.cat===c[0]?'on':''}" data-fxc="${c[0]}">${c[1]} ${c[2]}</button>`).join('');}
function durata(){const d=$('fxDur').value;$('fxRateL').hidden=d!=='rate';$('fxAlL').hidden=d!=='al';}
function chiudiFisso(){$('fxModal').hidden=true;document.body.classList.remove('noscroll');}
function salvaFisso(){const nome=$('fxNome').value.trim()||fcat(fx.cat)[2];const imp=num($('fxImp').value);const g=Math.round(num($('fxGiorno').value));
  if(!(imp>0)){toast('Scrivi l’importo.','err');return;}if(!(g>=1&&g<=31)){toast('Scrivi il giorno di addebito (1–31).','err');return;}
  const d=$('fxDur').value;Object.assign(fx,{nome,importo:String(r2(imp)),giorno:String(g),dal:$('fxDal').value||today().slice(0,7),rate:d==='rate'?String(Math.round(num($('fxRate').value))||''):'',al:d==='al'?$('fxAl').value:'',nota:$('fxNota').value.trim(),deleted:false,updatedAt:Date.now()});
  FX()[fx.id]=fx;changed();chiudiFisso();render();toast('Uscita fissa salvata.');}
// v24 (D-072): "Termina da questo mese" non riscrive il passato (Elimina invece la toglie da tutti i mesi).
// Se l'addebito di questo mese è già passato conta ancora in questo mese (al = mese in corso), altrimenti al = mese prima.
function terminaDa(f){const ora=today().slice(0,7);if(!attivoNel(f,ora))return null;const pagata=giornoNel(f,ora)<=today();
  const al=pagata?ora:addMese(ora,-1);if(f.dal&&al<f.dal)return null;
  // testi 19a/19b di 02 (D-072): con l'addebito già passato (anche oggi) conta ancora questo mese
  return {al,testo:(pagata?`Questo mese è già stata pagata: conta ancora a ${MESI[+ora.slice(5)-1]} e non conta più da ${monthName(addMese(ora,1))}.`:`Da ${monthName(ora)} non conta più.`)+' I mesi passati restano come sono.'};}
async function terminaFisso(){const f=FX()[fx.id];const T=f&&terminaDa(f);if(!T)return;
  if(!await conferma(`Terminare “${f.nome}”? ${T.testo}`,'Termina'))return;f.al=T.al;f.rate='';f.updatedAt=Date.now();changed();chiudiFisso();render();toast(`✓ ${f.nome} terminata: conta fino a ${monthName(T.al)}.`);}
async function eliminaFisso(){if(!await conferma(`Eliminare “${fx.nome}”?`,'Elimina','danger'))return;const f=FX()[fx.id];if(f){f.deleted=true;f.updatedAt=Date.now();}changed();chiudiFisso();render();}

// ---------- calendario: pagamenti fissi, filtri a comparsa, scorrimento ----------
let nascosti=new Set();try{nascosti=new Set(JSON.parse(localStorage.getItem('soldirini-nascosti')||'[]'));}catch(e){}
window.lavoroNascosto=id=>nascosti.has('l:'+id); // v22: i turni dei lavori nascosti non entrano nemmeno nel conteggio "+N"
const salvaNascosti=()=>{try{localStorage.setItem('soldirini-nascosti',JSON.stringify([...nascosti]));}catch(e){}};
let popAperto=false;
const _renderCal18=renderCal;
renderCal=function(){_renderCal18();
  for(const x of fissiDel(cur)){if(nascosti.has('fx'))break;const b=document.querySelector(`#grid [data-day="${x.data}"] .evs`);if(b)b.insertAdjacentHTML('beforeend',`<span class="ev fx" style="--c:#868e96">${fcat(x.f.cat)[1]} ${esc(x.f.nome)}</span>`);}
  // tolgo dalla griglia i calendari nascosti
  if(nascosti.has('sp'))document.querySelectorAll('#grid .ev.sp').forEach(e=>e.remove());
  for(const l of lavori())if(nascosti.has('l:'+l.id))document.querySelectorAll('#grid .ev.tu').forEach(e=>{if(e.dataset.lid===l.id)e.remove();});
  filtriPop();
};
function filtriPop(){
  const P=progetti(),L=lavori();const box=$('filtri');if(!box)return;
  const quanti=P.length+L.length+(fissi().length?1:0)+1;
  if(quanti<2&&!P.length){box.innerHTML='';return;}
  const sel=filtro?prog(filtro)?.nome:'Tutti';const altri=[...nascosti].length;
  box.innerHTML=`<div class="calpanel"><button class="calbtn" id="calBtn" aria-expanded="${popAperto}">📅 ${esc(sel||'Tutti')}${altri?` · ${altri} nascost${altri===1?'o':'i'}`:''} ▾</button></div>`+(popAperto?`<div class="calpop" id="calPop">
    ${P.length?`<h4>Progetti</h4><label class="crow"><input type="radio" name="cf" value="" ${!filtro?'checked':''}> Tutti i progetti</label>${P.map(p=>`<label class="crow" style="--c:${p.colore}"><input type="radio" name="cf" value="${p.id}" ${filtro===p.id?'checked':''}><i></i>${esc(p.nome)}</label>`).join('')}`:''}
    <h4>Mostra anche</h4>${L.map(l=>`<label class="crow" style="--c:${l.colore}"><input type="checkbox" data-cv="l:${l.id}" ${nascosti.has('l:'+l.id)?'':'checked'}><i></i>💼 ${esc(l.nome)}</label>`).join('')}
    <label class="crow" style="--c:#8a8f98"><input type="checkbox" data-cv="sp" ${nascosti.has('sp')?'':'checked'}><i></i>🛒 Spese giornaliere</label>
    ${fissi().length?`<label class="crow" style="--c:#868e96"><input type="checkbox" data-cv="fx" ${nascosti.has('fx')?'':'checked'}><i></i>💳 Uscite fisse</label>`:''}</div>`:'');
}
function swipe(el,avanti,indietro){let x0=null,y0=0,t0=0;
  el.addEventListener('touchstart',e=>{if(e.touches.length!==1){x0=null;return;}x0=e.touches[0].clientX;y0=e.touches[0].clientY;t0=Date.now();},{passive:true});
  el.addEventListener('touchend',e=>{if(x0==null||multi)return;const t=e.changedTouches[0];const dx=t.clientX-x0,dy=t.clientY-y0;x0=null;
    if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.6&&Date.now()-t0<700){(dx<0?avanti:indietro)();}},{passive:true});}

// ---------- occhio: nasconde gli importi ----------
function occhio(on){document.body.classList.toggle('nascondi',on);$('occhio').setAttribute('aria-pressed',on);$('occhio').setAttribute('aria-label',on?'Mostra gli importi':'Nascondi gli importi');try{localStorage.setItem('soldirini-occhio',on?'1':'');}catch(e){}}

// ---------- copia di sicurezza automatica su Drive, una volta al mese ----------
async function backupMensile(){
  const ym=today().slice(0,7);if(DB.meta.backupMese===ym||!DB.meta.account||!navigator.onLine||!tokenOk()||!D().root?.id)return;
  let dir=DB.meta.backupDir;
  if(!(dir&&await exists(dir))){const f=await createFolder('Copie di sicurezza',D().root.id,{soldirini:'backup'});dir=f.id;DB.meta.backupDir=dir;}
  const blob=new Blob([JSON.stringify({app:'soldirini',versione:APP_VERSIONE,data:new Date().toISOString(),dati:D()})],{type:'application/json'});
  await uploadNew({name:`Soldirini copia ${today()}.json`,parents:[dir]},blob,'application/json');
  DB.meta.backupMese=ym;DB.meta.backupUltimo=Date.now();persist();
}
const _processQueue18=processQueue;
processQueue=async function(){const r=await _processQueue18();await codaPasso('backup',backupMensile);return r;};

// ---------- impostazioni ----------
const _renderProg18=renderProgetti;
renderProgetti=function(){_renderProg18();renderFissi();
  const n=$('bkNota')||(()=>{const b=$('accBox');if(!b)return null;b.insertAdjacentHTML('afterend','<p class="muted sm" id="bkNota"></p>');return $('bkNota');})();
  if(n)n.textContent=DB.meta.backupUltimo?`Copia di sicurezza automatica su Drive: ultima il ${new Date(DB.meta.backupUltimo).toLocaleDateString('it-IT')} (una al mese, cartella “Copie di sicurezza”).`:'Copia di sicurezza automatica: una volta al mese su Drive, nella cartella “Copie di sicurezza”.';
  const st=document.querySelector('#foldFix>summary>.st');if(st&&!st.querySelector('.ic'))st.insertAdjacentHTML('afterbegin','<span class="ic" style="--ic:#495057" aria-hidden="true">💳</span>');
};

function bind18(){
  $('occhio').onclick=()=>occhio(!document.body.classList.contains('nascondi'));
  try{occhio(localStorage.getItem('soldirini-occhio')==='1');}catch(e){}
  swipe($('v-cal'),()=>$('next').click(),()=>$('prev').click());
  swipe($('rieTot'),()=>$('rNext').click(),()=>$('rPrev').click());
  $('filtri').addEventListener('click',e=>{if(e.target.closest('#calBtn')){popAperto=!popAperto;filtriPop();e.stopImmediatePropagation();}},true);
  $('filtri').addEventListener('change',e=>{const t=e.target;if(t.name==='cf'){filtro=t.value;render();return;}
    if(t.dataset.cv){t.checked?nascosti.delete(t.dataset.cv):nascosti.add(t.dataset.cv);salvaNascosti();render();}});
  document.addEventListener('click',e=>{if(popAperto&&!e.target.closest('#filtri')){popAperto=false;filtriPop();}});
  $('fixNew').onclick=()=>apriFisso(null);$('fixList').addEventListener('click',e=>{const b=e.target.closest('[data-fx]');if(b)apriFisso(FX()[b.dataset.fx]);});
  $('fxCats').addEventListener('click',e=>{const b=e.target.closest('[data-fxc]');if(!b)return;const prima=fcat(fx.cat)[2];fx.cat=b.dataset.fxc;if(!$('fxNome').value.trim()||$('fxNome').value===prima)$('fxNome').value=['netflix','disney'].includes(fx.cat)?fcat(fx.cat)[2]:'';catChips();});
  $('fxDur').onchange=durata;$('fxClose').onclick=chiudiFisso;$('fxSave').onclick=salvaFisso;$('fxDel').onclick=eliminaFisso;$('fxFine').onclick=terminaFisso;
  $('fxModal').addEventListener('click',e=>{if(e.target.id==='fxModal')chiudiFisso();});
}
bind18();render();
window.Soldi18={contiMese,contiAnno,fissi,apriFisso,backupMensile};
// ---------- v24 (D-060): uscita fissa da "Nuova attività" ----------
let efCat='netflix';
function efPrepara(dates,modifica){const s=$('secFix');if(!s)return;const una=dates.length===1&&!modifica;s.hidden=!una;s.open=false;if(!una)return;
  efCat='netflix';$('evFixNome').value='';$('evFixImp').value='';$('evFixGiorno').value=String(+dates[0].slice(8));$('evFixDal').value=dates[0].slice(0,7);
  $('evFixDur').value='';$('evFixRate').value='';$('evFixAl').value='';$('evFixErr').hidden=true;efDurata();efChips();efSum();}
function efChips(){$('evFixCats').innerHTML=FCAT.map(c=>`<button type="button" class="chip ${efCat===c[0]?'on':''}" data-efc="${c[0]}">${c[1]} ${c[2]}</button>`).join('');}
function efDurata(){const d=$('evFixDur').value;$('evFixRateL').hidden=d!=='rate';$('evFixAlL').hidden=d!=='al';}
function efSum(){const imp=num($('evFixImp').value),g=Math.round(num($('evFixGiorno').value));$('secFixSum').textContent=imp>0?`${eur(imp)}${g>=1&&g<=31?' · il '+g:''}`:'';
  $('evFixCorto').hidden=!(g>=29&&g<=31);}
// compilata = c'è un importo o un nome (la categoria da sola non basta)
const efCompilata=()=>!$('secFix').hidden&&(num($('evFixImp').value)>0||!!$('evFixNome').value.trim());
function efErrore(t){$('evFixErr').textContent=t;$('evFixErr').hidden=false;$('secFix').open=true;return false;}
function efValida(){$('evFixErr').hidden=true;const imp=num($('evFixImp').value),g=Math.round(num($('evFixGiorno').value));
  if(!(imp>0))return efErrore('Scrivi l’importo.');if(!(g>=1&&g<=31))return efErrore('Scrivi il giorno di addebito (1–31).');return true;}
function efSalva(){const d=$('evFixDur').value;const f={id:uid(),cat:efCat,nome:$('evFixNome').value.trim()||fcat(efCat)[2],importo:String(r2(num($('evFixImp').value))),giorno:String(Math.round(num($('evFixGiorno').value))),
  dal:$('evFixDal').value||today().slice(0,7),rate:d==='rate'?String(Math.round(num($('evFixRate').value))||''):'',al:d==='al'?$('evFixAl').value:'',nota:'',deleted:false,updatedAt:Date.now()};
  FX()[f.id]=f;return f;}
window.FissaEv={prepara:efPrepara,compilata:efCompilata,valida:efValida,salva:efSalva};
document.addEventListener('click',e=>{const b=e.target.closest('[data-efc]');if(b){efCat=b.dataset.efc;efChips();}});
document.addEventListener('input',e=>{if(e.target.closest&&e.target.closest('#evFix'))efSum();});
document.addEventListener('change',e=>{if(e.target.id==='evFixDur')efDurata();});

})();
