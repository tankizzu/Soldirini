'use strict';
// ================= Soldirini v18 · soldi rimanenti, pagamenti fissi, occhio, calendari, scorrimento, backup =================
(function(){
const num=v=>leggiNumero(v)??0; // 24c.6 (P2): importi scritti a mano all'italiana (numeri.js)
const numP=v=>leggiNumeroPunto(v)??0; // 24c.6: campi type="number" (giorni, rate, mesi, percentuale): punto decimale, come prima
const FX=()=>D().fissi||(D().fissi={});
const fissi=()=>Object.values(FX()).filter(f=>!f.deleted).sort((a,b)=>(+a.giorno||0)-(+b.giorno||0)||a.nome.localeCompare(b.nome));
const FCAT=[['netflix','🎬','Netflix'],['disney','✨','Disney+'],['mutuo','🏠','Mutuo'],['rata','💳','Rata'],['abbonamento','📱','Abbonamento'],['utenze','💡','Utenze'],['altro','•','Altro']];
const fcat=k=>FCAT.find(c=>c[0]===k)||FCAT[FCAT.length-1];
const addMese=(ym,n)=>{const d=new Date(+ym.slice(0,4),+ym.slice(5)-1+n,1);return `${d.getFullYear()}-${pad(d.getMonth()+1)}`;};
// 24.1: "dal" e "al" arrivano anche da Drive: valgono solo se sono AAAA-MM validi (altrimenti come se mancassero)
const ymOk=v=>typeof v==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(v);
const fineFisso=f=>ymOk(f.al)?f.al:(+f.rate>0&&ymOk(f.dal)?addMese(f.dal,+f.rate-1):'');
const attivoNel=(f,ym)=>(!ymOk(f.dal)||ym>=f.dal)&&(!fineFisso(f)||ym<=fineFisso(f));
const giornoNel=(f,ym)=>{const n=new Date(+ym.slice(0,4),+ym.slice(5),0).getDate();return `${ym}-${pad(Math.min(n,Math.max(1,+f.giorno||1)))}`;};
window.fissiDel=ym=>fissi().filter(f=>attivoNel(f,ym)).map(f=>({f,data:giornoNel(f,ym)}));

// ---------- conti del mese: entrate − uscite ----------
// v24 (D-009, E-2): entrano solo le voci segnate "Entrato", nel mese della data di entrata (entrate.js).
// v24 (D-066, E-11): le uscite fisse del mese contano tutte dal primo giorno del mese (fTot); fAdd resta solo per "addebitata".
// D-067 (E-12): ogni mese è calcolato da solo, nessun saldo portato dai mesi prima.
const fissiMese=ym=>{const F=fissiDel(ym);const t=today();return {F,fTot:r2(F.reduce((a,x)=>a+num(x.f.importo),0)),fAdd:r2(F.filter(x=>x.data<=t).reduce((a,x)=>a+num(x.f.importo),0))};};
// 24c.14 (D-169): con "I soldi messi da parte si tolgono dai soldi del mese" (impost().salvaToglie === true) ogni "Metti da parte"
// conta come uscita e ogni "Prelevo dai risparmi" come entrata, nel mese della sua data. Spenta o assente: tutto come prima.
// Movimenti con data non valida o importo non numero sono ignorati (dati da Drive). Tasse, CU e soglie non usano contiMese.
const salvaToglie=()=>impost().salvaToglie===true;
function risMese(ym){let messo=0,preso=0;if(!salvaToglie())return {messo,preso};
  for(const [k,m] of Object.entries(D().risparmi||{})){if(!k.startsWith('mv:')||!m||typeof m!=='object'||m.deleted||typeof m.data!=='string'||!m.data.startsWith(ym+'-')||!(window.Entrate&&Entrate.dataValida(m.data)))continue;
    const v=leggiNumero(m.importo);if(v==null||!isFinite(v)||!v)continue;if(v>0)messo+=v;else preso-=v;}
  return {messo:r2(messo),preso:r2(preso)};}
const mesiRisparmi=()=>salvaToglie()?Object.entries(D().risparmi||{}).filter(([k,m])=>k.startsWith('mv:')&&m&&!m.deleted&&typeof m.data==='string'&&window.Entrate&&Entrate.dataValida(m.data)&&leggiNumero(m.importo)).map(([,m])=>m.data.slice(0,7)):[];
function contiMese(ym,IDX){
  const I=(IDX||(window.Entrate?Entrate.indice():{}))[ym]||{lav:0,pen:0,prog:0}; // all'avvio entrate.js può non essere ancora caricato
  const {fAdd,fTot}=fissiMese(ym);
  const sp=r2((window.spesePersonali?spesePersonali(s=>meseSpesa(s)===ym):[]) // 24c.11 (D-152): mese in cui conta
    .reduce((a,s)=>a+num(s.importo),0));
  const prog=r2(I.prog),lav={v:r2(I.lav),stima:false},pen={v:r2(I.pen),stima:false};
  const ext=r2(I.ext||0); // 24c.13 (D-074): entrate extra del mese (extra.js); mai nei conti fiscali
  const R=risMese(ym); // 24c.14 (D-169)
  const entrate=r2(prog+lav.v+pen.v+ext+R.preso);const usciti=r2(fTot+sp+R.messo);
  return {prog,lav,pen,ext,fAdd,fTot,fArrivo:r2(fTot-fAdd),sp,risMesso:R.messo,risPreso:R.preso,ris:r2(R.messo-R.preso),entrate,usciti,rimanenti:r2(entrate-usciti)};
}
// vista Anno (E-13 a): anno in corso fino al mese in corso; anni passati tutti i 12 mesi; anni futuri nessun mese.
// fResto = uscite fisse dei mesi dopo quello in corso (riga "ancora da addebitare entro dicembre"), non contate.
function contiAnno(y){const T={prog:0,lav:0,pen:0,ext:0,risMesso:0,risPreso:0,ris:0,fAdd:0,fTot:0,sp:0,entrate:0,usciti:0,rimanenti:0,fResto:0,stima:false,penStima:false};
  const ora=today().slice(0,7),oy=+ora.slice(0,4);const ult=+y<oy?12:+y===oy?+ora.slice(5):0;T.mesi=ult;const I=window.Entrate?Entrate.indice():{};
  for(let m=1;m<=ult;m++){const c=contiMese(`${y}-${pad(m)}`,I);for(const k of ['prog','ext','risMesso','risPreso','ris','fAdd','fTot','sp','entrate','usciti','rimanenti'])T[k]+=c[k];T.lav+=c.lav.v;T.pen+=c.pen.v;}
  if(+y===oy)for(let m=ult+1;m<=12;m++)T.fResto+=fissiMese(`${y}-${pad(m)}`).fTot;
  for(const k in T)if(typeof T[k]==='number')T[k]=r2(T[k]);return T;}
window.contiMese=contiMese;window.contiAnno=contiAnno;window.salvaToglie=salvaToglie;
// 24c.11 (D-151): soldi rimasti nei mesi prima, a catena. Primo mese con dati: il più vecchio tra spese (mese in cui contano),
// entrate segnate e inizio delle uscite fisse. X = somma dei rimanenti (contiMese) di ogni mese da lì fino al mese prima di ym.
const meseDopo=m=>{let y=+m.slice(0,4),n=+m.slice(5)+1;if(n>12){n=1;y++;}return `${y}-${pad(n)}`;};
function primoMeseConDati(){let p=null;const min=m=>{if(ymOk(m)&&(!p||m<p))p=m;};
  if(window.spesePersonali)for(const s of spesePersonali(()=>true))min(meseSpesa(s));
  if(window.Entrate)for(const m of Object.keys(Entrate.indice()))min(m);
  for(const f of fissi())min(f.dal);
  for(const m of mesiRisparmi())min(m); // 24c.14 (D-169): con la scelta accesa anche i risparmi sono dati del mese
  return p;}
// 24c.12 (D-157): "Inizia i conti da" (impost().contiDa): la somma parte da quel mese (o dal primo mese con dati, se è dopo);
// nel mese scelto e prima la sezione non c'è. I mesi prima restano nell'app.
const contiDa=()=>{const v=impost().contiDa;return ymOk(v)?v:null;};
function inizioConti(){const p=primoMeseConDati(),d=contiDa();return d&&(!p||d>p)?d:p;}
// 24c.14 (P6 di 03): il giro parte al massimo 1.200 mesi prima del mese guardato e arriva sempre fino al mese prima.
// Prima partiva dal primo mese con dati e si fermava dopo 1.200 mesi: con una data molto vecchia (es. "dal 1900-01")
// sommava i mesi sbagliati. Nessuna soglia di data (la domanda 80 aspetta l'utente).
const meseIndietro=(m,k)=>{const t=(+m.slice(0,4))*12+(+m.slice(5))-1-k;return `${Math.floor(t/12)}-${pad(t%12+1)}`;};
const inizioGiro=ym=>{const p=inizioConti();if(!p||p>=ym)return null;const lim=meseIndietro(ym,1200);return p<lim?lim:p;};
function rimastiPrima(ym){const p=inizioGiro(ym);if(!p)return null; // nessun mese prima da contare: la sezione non c'è
  const I=window.Entrate?Entrate.indice():{};let x=0,m=p;
  while(m<ym){x+=contiMese(m,I).rimanenti;m=meseDopo(m);}
  return r2(x);}
// 24c.14: frase grigia della sezione, testi definitivi di 02 (tornata 51, righe 5-8)
function fraseRimasti(ym){const S=inizioGiro(ym),E=mesePrima(ym),scelto=contiDa()&&contiDa()===inizioConti()&&S===inizioConti();
  const mn=m=>esc(monthName(m)),solo=esc(MESI[+ym.slice(5)-1]);
  const prima=S===E?(scelto?`Solo ${mn(E)}, come scelto in Impostazioni → Aspetto.`:`Solo ${mn(E)}, il primo mese con dati.`)
    :`Somma dei mesi da ${mn(S)} a ${mn(E)}${scelto?', come scelto in Impostazioni → Aspetto':''}.`;
  return `${prima} Il numero grande in alto resta solo di ${solo}.`;}
window.rimastiPrima=rimastiPrima;

// ---------- riepilogo: in alto i soldi rimanenti, poi lavoro dipendente, rimborsi, ritenuta, pagamenti fissi ----------
// 24.2 (D-085): riquadro riducibile. Chiuso: soldi rimanenti, "Entrate · Uscite". Aperto: le caselle.
// 24c.4 (D-127, sostituisce "chiuso a ogni apertura" di D-085): aperto a ogni apertura dell'app e ogni volta che si torna
// al Riepilogo da un'altra scheda; toccandolo si chiude. Lo stato resta solo in memoria, non si salva.
let heroAperto=true;
function heroStato(h){const b=h.querySelector('.rim'),d=h.querySelector('#heroDet');if(!b||!d)return;
  // 24.2b (testi di 02): lo stato si comunica solo con aria-expanded; il testo nascosto ", dettagli" resta fisso
  h.classList.toggle('aperto',heroAperto);b.setAttribute('aria-expanded',String(heroAperto));d.hidden=!heroAperto;}
const _renderRie18=renderRiepilogo;
renderRiepilogo=function(){_renderRie18();
  const anno=rieMode==='anno',y=cur.slice(0,4);const hero=$('rieTot').querySelector('.hero');if(!hero)return;
  const {tot}=anno?aggrega(y):riepilogo(cur);const daInc=r2(dovuti().filter(d=>!d.pag).reduce((a,d)=>a+d.imp,0));
  const C=anno?contiAnno(y):contiMese(cur);const nConf=window.EntrateExtra?EntrateExtra.daConf().length:0;const lavV=anno?C.lav:C.lav.v,penV=anno?C.pen:C.pen.v;
  // 24b.1 (D-098 punto 3): ogni casella del riquadro aperto porta alla sua pagina di dettaglio (data-vai = scheda)
  // al (24c.17): testo letto dal lettore di schermo al posto di "…, apri la pagina" (02, tornata 55)
  const cella=(t,v,cls='',nota='',pag='',al='')=>({h:c=>{const k=[cls,c,pag?'hcel':''].filter(Boolean).join(' '),dentro=`<small>${t}</small><b>${v}</b>${nota?`<small class="nota">${nota}</small>`:''}`;
    return pag?`<button type="button" class="${k}" data-vai="${pag}"${al?` aria-label="${esc(al)}"`:''}>${dentro}${al?'':`<span class="vh">, apri la pagina${/lungo/.test(k)?' Uscite fisse':''}</span>`}</button>`:`<div class="${k}">${dentro}</div>`;}});
  // vista Anno: resta "somma dei mesi da gennaio a …"; vista Mese senza "del mese" (D-085)
  const ora=today().slice(0,7);const sotto=!anno?'':+y<+ora.slice(0,4)?'somma dei mesi da gennaio a dicembre':+y===+ora.slice(0,4)?`somma dei mesi da gennaio a ${MESI[C.mesi-1]}`:'l’anno non è ancora iniziato';
  // 24b.2 (D-101): una casella compare solo se nel periodo mostrato ha un valore diverso da zero o qualcosa da mostrare
  // (stessa regola per tutte; per Lavoro dipendente e Pensione conta anche la voce del periodo: busta, cedolino, stima
  // o stipendio/pensione in arrivo, che stanno nella loro pagina). I calcoli non cambiano.
  const conVoce=tipo=>{if(!window.Entrate)return false;const fino=anno?(+y<+ora.slice(0,4)?y+'-12':ora):(cur<ora?cur:ora);
    return Entrate.voci(fino).some(v=>v.tipo===tipo&&(anno?v.ym.startsWith(y+'-'):v.ym===cur||(cur===ora&&!v.ent)));};
  // 24c.1 (richiesta dell'utente confermata il 19/11, punto 4b): prima le entrate, poi le uscite in fondo
  // 24c.14 (D-168): una sola casella "Spese" = uscite fisse + spese giornaliere (lo stesso numero di "Uscite"); c'è se almeno una ha un valore
  // 24c.17 (02, tornata 55 §1.1 e §2.3): "Spese" senza nota, con l'aria-label delle due parti; "Messi da parte" oppure "Presi dai risparmi"
  const perL=anno?'nel '+cur.slice(0,4):'a '+MESI[+cur.slice(5)-1];
  const spL=`Spese ${perL}: ${eur(r2(C.fTot+C.sp))}.${[['Uscite fisse',C.fTot],['spese giornaliere',C.sp]].filter(x=>x[1]).map(x=>` ${x[0]} ${eur(x[1])}`).join(',')}. Apri le spese.`;
  const preso=C.risPreso>C.risMesso,risT=preso?'Presi dai risparmi':'Messi da parte',risV=eur(Math.abs(C.ris));
  const risN=preso?(C.risMesso?`messi da parte ${eur(C.risMesso)}`:''):(C.risPreso?`prelevati ${eur(C.risPreso)}`:'');
  const uscite=[C.sp||C.fTot?cella('Spese',eur(r2(C.fTot+C.sp)),'','','dsp',spL):null,
    // 24c.14 (D-169): solo con la scelta accesa e se nel periodo c'è qualcosa
    C.risMesso||C.risPreso?cella(risT,risV,'',risN,'ris',`${risT} ${perL}: ${risV}${risN?', '+risN:''}. Apri i risparmi.`):null].filter(Boolean);
  // 24c.1 (02, tornata 27 §3): casella a 0,00 € che c'è solo per una voce in arrivo → nota "stipendio/pensione in arrivo", senza importo
  const inArrivo=t=>!anno&&cur===ora&&!!window.Entrate&&Entrate.voci(ora).some(v=>v.tipo===t&&!v.ent);
  // 24c.19 (D-185): mesi dopo quello di oggi (il mese mostrato, o quelli dell'anno mostrato) con turni o una stima: la casella c'è,
  // con la stima e la nota "stipendio previsto"/"pensione prevista". Solo da vedere: non entra nei soldi rimanenti né in Entrate
  // (D-009, D-071), che restano a 0 finché lo stipendio non è segnato entrato. Le caselle che c'erano già non cambiano.
  const futuri=!window.Entrate?[]:anno?Array.from({length:12},(_,i)=>`${y}-${pad(i+1)}`).filter(m=>m>ora):cur>ora?[cur]:[];
  const previsto=t=>{if(!futuri.length)return null;
    const V=t==='lav'?Entrate.voci(futuri[futuri.length-1]).filter(v=>v.tipo==='lav'&&futuri.includes(v.ym)):futuri.map(m=>Entrate.voce('pen|'+m)).filter(v=>v&&v.pr&&v.pr.fonte);
    return V.length?r2(V.reduce((a,v)=>a+(v.pr.imp??v.pr.lordo??0),0)):null;};
  const lavP=lavV||(lavori().length&&conVoce('lav'))?null:previsto('lav'),penP=penV||conVoce('pen')?null:previsto('pen');
  const entrate=[lavV||(lavori().length&&conVoce('lav'))?cella('Lavoro dipendente',eur(lavV),'',!lavV&&inArrivo('lav')?'stipendio in arrivo':'','dlav'):
      lavP!=null?cella('Lavoro dipendente',eur(lavP),'','stipendio previsto','dlav'):null,
    penV||conVoce('pen')?cella('Pensione',eur(penV),'',!penV&&inArrivo('pen')?'pensione in arrivo':'','pen'):
      penP!=null?cella('Pensione',eur(penP),'','pensione prevista','pen'):null,
    anno&&r2(tot.netto+tot.rimb)?cella('Incassato dai progetti',eur(r2(tot.netto+tot.rimb)),'','','dinc'):null, // 02 (Decisione 3): "Mese per mese (incassi)"
    // 24c.13 (D-074): entrate extra del periodo; (D-165) "Ancora da incassare" c'è anche con sole entrate da confermare, con il loro numero
    C.ext?cella('Entrate extra',eur(C.ext),'','','dinc'):null,
    daInc||nConf?cella('Ancora da incassare',eur(daInc),'',nConf?(nConf===1?'1 entrata da confermare':`${nConf} entrate da confermare`):'','dinc'):null,tot.rimb?cella('Rimborsi spese',eur(tot.rimb),'','','drim'):null,tot.rit?cella('Ritenuta d’acconto',eur(tot.rit),'','','drit'):null].filter(Boolean);
  const caselle=entrate.concat(uscite);
  // D-101: nessuna entrata nel periodo e nessuna casella delle entrate → la frase dell'utente (stile di 02, tornata 27 §1)
  const nessuna=!C.entrate&&!entrate.length?'<p class="nient" role="note"><span class="em" aria-hidden="true">🙁</span><span>Mi dispiace che non hai entrate</span></p>':'';
  // con due colonne, se l'ultima casella resta sola occupa tutta la larghezza (classe "dispari")
  // la frase sta nel posto delle entrate, prima delle uscite (varianti V4 e V5 del disegno dell'utente)
  const det=nessuna+caselle.map((c,i)=>c.h(i===caselle.length-1&&caselle.length%2?'dispari':'')).join('')+
    (anno&&C.fResto?cella('Uscite fisse ancora da addebitare entro dicembre',eur(C.fResto),'lungo','Non contate nei soldi rimanenti: dicembre non è ancora iniziato.','dfx').h():'');
  // D-092: anche nella vista Anno il titolo è "Soldi rimanenti"; sotto zero il segno è "−" (02)
  const imp=eur(C.rimanenti).replace(/^-/,'−');
  hero.innerHTML=`<button type="button" class="rim${C.rimanenti<0?' neg':''}" aria-controls="heroDet"><small class="tit">Soldi rimanenti</small>${sotto?`<small class="dm">${sotto}</small>`:''}<b>${imp}</b><small class="det">Entrate ${eur(C.entrate)} · Uscite ${eur(C.usciti)}</small><span class="vh">, dettagli</span></button><div id="heroDet" class="heroDet">${det}</div>`;
  heroStato(hero);
  // 24c.11 (D-151): sezione "Rimasti dai mesi prima", solo nella vista Mese, sotto il riquadro e chiusa a ogni apertura (D-010).
  // Il numero grande resta solo del mese (D-067); qui si somma a catena quello che è rimasto nei mesi prima.
  if(!anno){const X=rimastiPrima(cur);if(X!=null){const s=v=>eur(v).replace(/^-/,'−'),T=r2(X+C.rimanenti);
    hero.insertAdjacentHTML('afterend',`<div class="cards" id="rieRim"><div class="card rimprima" data-fid="rimasti" data-sum="${s(X)}"><h3><span aria-hidden="true">↪️</span> Rimasti dai mesi prima</h3>
      <div class="kv"><span>Rimasti dai mesi prima</span><b>${s(X)}</b></div><div class="kv"><span>Soldi rimanenti di ${esc(MESI[+cur.slice(5)-1])}</span><b>${s(C.rimanenti)}</b></div>
      <div class="kv big"><span>Totale</span><b>${s(T)}</b></div><p class="muted sm">${fraseRimasti(cur)}</p></div></div>`);
    foldify($('rieRim'),'rie');}}
  // 24b.1 (D-098, 02 §2): la testata di ogni pagina mostra lo stesso importo della sua casella
  window.VALORI_RIE={dfx:C.fTot,dsp:r2(C.fTot+C.sp),fx:C.fTot,sp:C.sp,dlav:lavV,pen:penV,drim:tot.rimb,drit:tot.rit,dinc:daInc,inc:anno?r2(tot.netto+tot.rimb):0,mesi:C.mesi};
  // uscite fisse del mese (D-065: "Uscite fisse" ovunque; righe "addebitata il N" / "addebito il N")
  const box=$('rieFix'); // 24b.1 (D-098): nella pagina "Uscite fisse"
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
  $('fixList').innerHTML=L.map(f=>{const c=fcat(f.cat);const fine=fineFisso(f);return `<button class="card prow fxr" data-fx="${esc(f.id)}"><span>${c[1]}</span><span class="tx"><b>${esc(f.nome)}</b><small>${eur(num(f.importo))} il giorno ${+f.giorno||1}${fine?' · fino a '+esc(monthName(fine)):''}</small></span><span class="chev">›</span></button>`;}).join('')||'<p class="muted sm">Nessun pagamento fisso.</p>';}
let fx=null;
function apriFisso(f){fx=f?clone(f):{id:uid(),cat:'netflix',nome:'',importo:'',giorno:'',dal:today().slice(0,7),al:'',rate:'',nota:''};const isNew=!f;
  $('fxTit').textContent=isNew?'Nuova uscita fissa':'Uscita fissa';$('fxDel').hidden=isNew;
  $('fxNome').value=fx.nome;$('fxImp').value=fx.importo;$('fxGiorno').value=fx.giorno;$('fxDal').value=fx.dal;$('fxRate').value=fx.rate;$('fxAl').value=fx.al;$('fxNota').value=fx.nota||'';
  $('fxDur').value=fx.rate?'rate':fx.al?'al':'';durata();catChips();riquadroFine(isNew?null:f);$('fxModal').hidden=false;document.body.classList.add('noscroll');}
function catChips(){$('fxCats').innerHTML=FCAT.map(c=>`<button type="button" class="chip ${fx.cat===c[0]?'on':''}" data-fxc="${c[0]}">${c[1]} ${c[2]}</button>`).join('');}
function durata(){const d=$('fxDur').value;$('fxRateL').hidden=d!=='rate';$('fxAlL').hidden=d!=='al';}
function chiudiFisso(){$('fxModal').hidden=true;document.body.classList.remove('noscroll');}
function salvaFisso(){const nome=$('fxNome').value.trim()||fcat(fx.cat)[2];const imp=num($('fxImp').value);const g=Math.round(numP($('fxGiorno').value));
  if(!(imp>0)){toast('Scrivi l’importo.','err');return;}if(!(g>=1&&g<=31)){toast('Scrivi il giorno di addebito (1–31).','err');return;}
  const d=$('fxDur').value;Object.assign(fx,{nome,importo:String(r2(imp)),giorno:String(g),dal:$('fxDal').value||today().slice(0,7),rate:d==='rate'?String(Math.round(numP($('fxRate').value))||''):'',al:d==='al'?$('fxAl').value:'',nota:$('fxNota').value.trim(),deleted:false,updatedAt:Date.now()});
  FX()[fx.id]=fx;changed();chiudiFisso();render();toast('Uscita fissa salvata.');}
// 24.1 (D-073, D-076; regola D-072; testi di 02): "Termina" con l'ultimo giorno scelto (passato, oggi o futuro; di base oggi).
// Se l'addebito del mese di quel giorno cade entro quel giorno (29-31: giorno vero del mese, giornoNel), quel mese conta ancora (al = quel mese);
// altrimenti al = mese prima. I mesi prima non cambiano. Fine prima dell'inizio: errore (usa Elimina). Non allunga mai una fine che c'è già (P-1).
// Se toglie l'uscita da mesi già passati si può salvare, con l'avviso.
const giornoOk=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const [y,m,g]=v.split('-').map(Number);const x=new Date(y,m-1,g);return x.getFullYear()===y&&x.getMonth()===m-1&&x.getDate()===g;};
function terminaCon(f,giorno){if(!giornoOk(giorno))return {err:'Scegli l’ultimo giorno.'};
  const m=giorno.slice(0,7),add=giornoNel(f,m),entro=add<=giorno,al=entro?m:addMese(m,-1),fine=fineFisso(f),da=addMese(al,1);
  if(ymOk(f.dal)&&al<f.dal)return {err:`È prima dell’inizio (${monthName(f.dal)}). Se l’avevi inserita per errore, usa Elimina.`};
  if(fine&&al>=fine)return {err:`Finisce già a ${monthName(fine)}: “Termina” può solo anticipare la fine.`};
  const ad=`L’addebito del ${+add.slice(8)} ${MESI[+m.slice(5)-1]}`;
  const frase=entro?`${ad} è entro questo giorno: conta ancora a ${esc(monthName(m))} e <b>non conta più da ${esc(monthName(da))}</b>.`
    :`${ad} è dopo questo giorno: <b>non conta più da ${esc(monthName(da))}</b>.`;
  // mesi già passati (prima del mese in corso) che perdono l'uscita
  const ult=addMese(today().slice(0,7),-1),fin=fine&&fine<ult?fine:ult;
  const avviso=da<=fin?(da===fin?`⚠ Cambiano i soldi rimanenti di ${monthName(da)} (già passato). Se è giusto, termina pure.`
    :`⚠ Cambiano i soldi rimanenti di ${monthName(da)} – ${monthName(fin)} (già passati). Se è giusto, termina pure.`):'';
  return {al,frase,avviso};}
function terminaControlla(){const f=FX()[fx&&fx.id];if(!f)return null;const T=terminaCon(f,$('tmData').value);
  if(T.err){$('tmMsg').textContent=T.err;$('tmMsg').className='sm err';}else{$('tmMsg').innerHTML=T.frase;$('tmMsg').className='sm';}
  $('tmPrima').hidden=!!T.err;$('tmAvv').textContent=T.avviso||'';$('tmAvv').hidden=!T.avviso;$('tmOk').disabled=!!T.err;return T;}
function terminaFisso(){const f=FX()[fx.id];if(!f)return;$('tmTit').textContent=`Termina “${f.nome}”`;$('tmData').value=today();terminaControlla();$('tmModal').hidden=false;}
function chiudiTermina(){$('tmModal').hidden=true;}
function salvaTermina(){const f=FX()[fx.id];const T=terminaControlla();if(!f||!T||T.err)return;
  f.al=T.al;f.rate='';f.updatedAt=Date.now();changed();chiudiTermina();chiudiFisso();render();toast(`✓ ${f.nome} terminata: conta fino a ${monthName(T.al)}.`);}
// riquadro nella finestra dell'uscita fissa: "Non la paghi più?" oppure, se ha già una fine, "Terminata: conta fino a …"
function riquadroFine(f){const fine=f&&fineFisso(f);$('fxFineBox').hidden=!f;if(!f)return;
  $('fxFineTit').textContent=fine?`Terminata: conta fino a ${monthName(fine)}.`:'Non la paghi più?';$('fxFineNota').hidden=!!fine;$('fxFine').textContent=fine?'Cambia l’ultimo giorno':'Termina';}
async function eliminaFisso(){if(!await conferma(`Eliminare “${fx.nome}”?`,'Elimina','danger'))return;const f=FX()[fx.id];if(f){f.deleted=true;f.updatedAt=Date.now();}changed();chiudiFisso();render();}

// ---------- calendario: pagamenti fissi, filtri a comparsa, scorrimento ----------
let nascosti=new Set();try{nascosti=new Set(JSON.parse(localStorage.getItem('soldirini-nascosti')||'[]'));}catch(e){}
window.lavoroNascosto=id=>nascosti.has('l:'+id); // v22: i turni dei lavori nascosti non entrano nemmeno nel conteggio "+N"
const salvaNascosti=()=>{try{localStorage.setItem('soldirini-nascosti',JSON.stringify([...nascosti]));}catch(e){}};
let popAperto=false;
const _renderCal18=renderCal;
renderCal=function(){_renderCal18();
  for(const x of fissiDel(cur)){if(nascosti.has('fx'))break;const b=document.querySelector(`#grid [data-day="${CSS.escape(x.data)}"] .evs`);if(b)b.insertAdjacentHTML('beforeend',`<span class="ev fx" style="--c:#868e96">${fcat(x.f.cat)[1]} ${esc(x.f.nome)}</span>`);}
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
    ${P.length?`<h4>Progetti</h4><label class="crow"><input type="radio" name="cf" value="" ${!filtro?'checked':''}> Tutti i progetti</label>${P.map(p=>`<label class="crow" style="--c:${colOk(p.colore)}"><input type="radio" name="cf" value="${esc(p.id)}" ${filtro===p.id?'checked':''}><i></i>${esc(p.nome)}</label>`).join('')}`:''}
    <h4>Mostra anche</h4>${L.map(l=>`<label class="crow" style="--c:${colOk(l.colore)}"><input type="checkbox" data-cv="l:${esc(l.id)}" ${nascosti.has('l:'+l.id)?'':'checked'}><i></i>💼 ${esc(l.nome)}</label>`).join('')}
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
  $('rieTot').addEventListener('click',e=>{const pg=e.target.closest('[data-vai]');if(pg){const inc=pg.textContent.startsWith('Incassato dai progetti');window.testaInc=inc;vaiA(pg.dataset.vai);if(inc)apriSezione('#rieAnno','Mese per mese');return;} // 24b.1 (D-098)
    const h=e.target.closest('.hero');if(!h||!h.querySelector('#heroDet')||e.target.closest('[data-b]'))return;heroAperto=!heroAperto;heroStato(h);});
  // D-127: tornando al Riepilogo da un'altra scheda (Calendario, Impostazioni) il riquadro è di nuovo aperto; dalle sue pagine resta com'era.
  // In cattura, così vale la scheda di prima: app.js cambia `tab` nel suo ascolto.
  document.querySelector('.tabs')?.addEventListener('click',e=>{if(e.target.closest('button[data-tab="rie"]')&&tab!=='rie'&&SUB[tab]!=='rie')heroAperto=true;},true);
  $('filtri').addEventListener('click',e=>{if(e.target.closest('#calBtn')){popAperto=!popAperto;filtriPop();e.stopImmediatePropagation();}},true);
  $('filtri').addEventListener('change',e=>{const t=e.target;if(t.name==='cf'){filtro=t.value;render();return;}
    if(t.dataset.cv){t.checked?nascosti.delete(t.dataset.cv):nascosti.add(t.dataset.cv);salvaNascosti();render();}});
  document.addEventListener('click',e=>{if(popAperto&&!e.target.closest('#filtri')){popAperto=false;filtriPop();}});
  $('fixNew').onclick=()=>apriFisso(null);$('fixList').addEventListener('click',e=>{const b=e.target.closest('[data-fx]');if(b)apriFisso(FX()[b.dataset.fx]);});
  $('fxCats').addEventListener('click',e=>{const b=e.target.closest('[data-fxc]');if(!b)return;const prima=fcat(fx.cat)[2];fx.cat=b.dataset.fxc;if(!$('fxNome').value.trim()||$('fxNome').value===prima)$('fxNome').value=['netflix','disney'].includes(fx.cat)?fcat(fx.cat)[2]:'';catChips();});
  $('fxDur').onchange=durata;$('fxClose').onclick=chiudiFisso;$('fxSave').onclick=salvaFisso;$('fxDel').onclick=eliminaFisso;$('fxFine').onclick=terminaFisso;
  $('tmData').addEventListener('input',terminaControlla);$('tmAnn').onclick=chiudiTermina;$('tmClose').onclick=chiudiTermina;$('tmOk').onclick=salvaTermina;
  $('tmModal').addEventListener('click',e=>{if(e.target.id==='tmModal')chiudiTermina();});
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
function efSum(){const imp=num($('evFixImp').value),g=Math.round(numP($('evFixGiorno').value));$('secFixSum').textContent=imp>0?`${eur(imp)}${g>=1&&g<=31?' · il '+g:''}`:'';
  $('evFixCorto').hidden=!(g>=29&&g<=31);}
// compilata = c'è un importo o un nome (la categoria da sola non basta)
const efCompilata=()=>!$('secFix').hidden&&(num($('evFixImp').value)>0||!!$('evFixNome').value.trim());
function efErrore(t){$('evFixErr').textContent=t;$('evFixErr').hidden=false;$('secFix').open=true;return false;}
function efValida(){$('evFixErr').hidden=true;const imp=num($('evFixImp').value),g=Math.round(numP($('evFixGiorno').value));
  if(!(imp>0))return efErrore('Scrivi l’importo.');if(!(g>=1&&g<=31))return efErrore('Scrivi il giorno di addebito (1–31).');return true;}
function efSalva(){const d=$('evFixDur').value;const f={id:uid(),cat:efCat,nome:$('evFixNome').value.trim()||fcat(efCat)[2],importo:String(r2(num($('evFixImp').value))),giorno:String(Math.round(numP($('evFixGiorno').value))),
  dal:$('evFixDal').value||today().slice(0,7),rate:d==='rate'?String(Math.round(numP($('evFixRate').value))||''):'',al:d==='al'?$('evFixAl').value:'',nota:'',deleted:false,updatedAt:Date.now()};
  FX()[f.id]=f;return f;}
window.FissaEv={prepara:efPrepara,compilata:efCompilata,valida:efValida,salva:efSalva};
document.addEventListener('click',e=>{const b=e.target.closest('[data-efc]');if(b){efCat=b.dataset.efc;efChips();}});
document.addEventListener('input',e=>{if(e.target.closest&&e.target.closest('#evFix'))efSum();});
document.addEventListener('change',e=>{if(e.target.id==='evFixDur')efDurata();});

})();
