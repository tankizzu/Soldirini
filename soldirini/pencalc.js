'use strict';
// ================= Soldirini v22 · calcoli della pensione =================
// Regole del report 04 · Fisco (15/11/2026): contributi (C-1…C-4), fondo pensione (F-1…F-5),
// pensionato dal lordo al netto (P-1…P-7), controlli del cedolino (K-1…K-8) e confronto con la stima.
// Solo calcoli, nessuna schermata: le schermate sono in pensione.js. Ogni risultato è una STIMA.
(function(){
const r2=x=>Math.round((x+Number.EPSILON)*100)/100;
const n=v=>{if(v==null||v==='')return null;const x=+String(v).replace(/\s/g,'').replace(',','.');return isFinite(x)?x:null;};
const z=v=>n(v)||0;

// ---------- valori per anno (una sola tabella; fonti nel report 04) ----------
const ANNI={
  2026:{
    scaglioni:[[28000,23],[50000,33],[Infinity,43]],            // L. 199/2025
    detr:{base:1955,minimo:713,s1:8500,fissa:700,var:1255,s2:28000,s3:50000,extra:50,extraDa:25000,extraA:29000}, // art. 13 c. 3 e 3-bis TUIR
    minimoMese:611.85,                                          // trattamento minimo, circ. INPS 153/2025
    q14:{soglia1:11931.08,soglia2:15908.10,                     // 1,5 e 2 volte il minimo annuo (messaggio INPS 2052/2026)
      dip:[15,25],aut:[18,28],importiA:[437,546,655],importiB:[336,420,504],
      maxA:[12368.08,12477.08,12586.08],maxB:[16244.10,16328.10,16412.10],eta:64},
    fondoLimite:5300,                                           // L. 199/2025 c. 201
    sogliaSett:244.74,primaFascia:56224,massimale:122295,       // circ. INPS 6/2026
    aliqDip:9.19,aliqExtra:1,                                   // circ. INPS 23/2007 e 88/2023
    controllo:[8,11],controlloApprendisti:[5,7]                 // fasce dell'avviso C-2 (proposta 04)
  }
};
// 2025: oltre al limite del fondo (T-F4) si conoscono solo gli scaglioni IRPEF già usati da Tasse; il resto è preso dal 2026
const DIFF={2025:{scaglioni:[[28000,23],[50000,35],[Infinity,43]],fondoLimite:5164.57}};
function valori(anno){anno=+anno||2026;
  if(ANNI[anno])return Object.assign({anno,regole:anno},ANNI[anno]);
  // anni senza tabella: valori 2026, con l'indicazione "stima con le regole 2026"
  return Object.assign({anno,regole:2026},ANNI[2026],DIFF[anno]||{});
}

// ---------- IRPEF ----------
function irpefLorda(R,anno){let t=0,prev=0;for(const [lim,al] of valori(anno).scaglioni){if(R>prev)t+=(Math.min(R,lim)-prev)*al/100;prev=lim;}return r2(t);}
const giorniAnno=anno=>((anno%4===0&&anno%100!==0)||anno%400===0)?366:365;
// Detrazione per redditi di pensione (P-3). giorni = giorni di pensione nell'anno.
// Il minimo di 713 € vale dopo la proporzione ai giorni (rilettura delle fonti, caso T-P7b);
// i 50 € in più si applicano per intero (non verificato da 04, segnalato nel report).
function detrPensione(R,giorni,anno){const v=valori(anno).detr,ga=giorniAnno(+anno||2026);giorni=giorni==null?ga:Math.max(0,Math.min(ga,giorni));
  let d;
  if(R<=v.s1){d=v.base*giorni/ga;if(giorni>0)d=Math.max(d,v.minimo);}
  else if(R<=v.s2)d=(v.fissa+v.var*(v.s2-R)/(v.s2-v.s1))*giorni/ga;
  else if(R<=v.s3)d=(v.fissa*(v.s3-R)/(v.s3-v.s2))*giorni/ga;
  else d=0;
  if(R>v.extraDa&&R<=v.extraA&&giorni>0)d+=v.extra;
  return r2(d);
}
// Funzione unica richiesta dal compito: tipo 'pensione' (detrazione per pensione) oppure 'nessuna'
// (anno del pensionamento con la detrazione da lavoro dipendente scelta per lo stipendio: stima prudente, D-039).
function irpefNetta(reddito,tipo,giorni,anno){const R=Math.max(0,z(reddito));const lorda=irpefLorda(R,anno);
  const detr=tipo==='pensione'?detrPensione(R,giorni,anno):0;
  return {reddito:r2(R),lorda,detr,netta:r2(Math.max(0,lorda-detr))};}

// ---------- addizionali (P-5): aliquote scritte dall'utente; vuote = "senza addizionali" ----------
// v22c (04, conferme del 16/11/2026): le addizionali sono dovute solo se l'IRPEF netta dell'anno è più di zero;
// in quel caso si calcolano sull'intero reddito, con la soglia di esenzione del Comune. irpefNetta assente = non controllata.
function addizionali(R,{addReg,addCom,sogliaCom}={},irpefNetta){const reg=n(addReg),com=n(addCom),soglia=n(sogliaCom);
  const indicate=reg!=null||com!=null;
  if(irpefNetta!=null&&!(irpefNetta>0))return {regionale:0,comunale:0,rataReg:0,rataComSaldo:0,indicate,esenti:indicate};
  const regionale=reg!=null?r2(R*reg/100):0;
  const comunale=com!=null&&!(soglia!=null&&R<=soglia)?r2(R*com/100):0;
  return {regionale,comunale,rataReg:r2(regionale/11),rataComSaldo:r2(comunale/11),indicate,esenti:false};}

// ---------- profilo pensionato: giorni, mesi e stima dell'anno ----------
function periodo(p,anno){anno=+anno;const dal=String(p.dal||'');const [ay,am]=dal.split('-').map(Number);
  if(!ay||ay<anno)return {mesi:12,giorni:giorniAnno(anno),primoMese:1};
  if(ay>anno)return {mesi:0,giorni:0,primoMese:13};
  const inizio=new Date(Date.UTC(anno,am-1,1)),fine=new Date(Date.UTC(anno+1,0,1));
  return {mesi:13-am,giorni:Math.round((fine-inizio)/864e5),primoMese:am};}
// Reddito dell'anno (P-1): 12 mensilità + tredicesima (in proporzione ai mesi se la pensione inizia nell'anno) + altri redditi.
// La quattordicesima non si somma: è esente (rilettura delle fonti, punto 3).
function baseAnno(p,anno){const per=periodo(p,anno);
  const pensione=r2(z(p.lordoMese)*per.mesi*13/12);const altri=z(p.altriRedditi);const R=r2(pensione+altri);
  const tipo=p.detrazione==='lavoro'?'nessuna':'pensione';
  const I=irpefNetta(R,tipo,per.giorni,anno);return {per,pensione,altri,R,I,A:addizionali(R,p,I.netta)};}
// Acconto dell'addizionale comunale trattenuto nell'anno (9 rate, marzo-novembre): 30% dell'addizionale comunale dell'anno prima,
// sul reddito dell'anno prima. Se l'anno prima non c'era pensione o l'addizionale era zero, l'acconto è zero.
// L'app conosce solo le aliquote scritte dall'utente (non quelle deliberate dal Comune per l'anno prima): quindi è sempre una "stima".
function accontoComunale(p,anno){const prima=baseAnno(p,+anno-1);const com=prima.per.mesi?prima.A.comunale:0;
  const importo=r2(com*0.3);return {importo,rata:r2(importo/9),stima:importo>0};}
// v23 (04, P-5): nei cedolini dell'anno l'INPS trattiene in 11 rate (gennaio-novembre) l'addizionale regionale e il saldo
// della comunale DELL'ANNO PRIMA; il saldo è l'addizionale comunale dell'anno prima meno l'acconto già pagato in quell'anno.
// Se l'anno prima non c'era pensione, le rate sono zero.
function rateAnnoPrima(p,anno){const prima=baseAnno(p,+anno-1);if(!prima.per.mesi)return {reg:0,comSaldo:0};
  const saldo=Math.max(0,prima.A.comunale-accontoComunale(p,+anno-1).importo);
  return {reg:r2(prima.A.regionale/11),comSaldo:r2(saldo/11)};}
function stimaAnno(p,anno){const v=valori(anno);const B=baseAnno(p,anno);const per=B.per,pensione=B.pensione,altri=B.altri,R=B.R,I=B.I,A=B.A;
  const netto=r2(pensione-I.netta-A.regionale-A.comunale);
  // netto di un mese normale (02, mockup: 1.000 € lordi → circa 898 €): (pensione − IRPEF) / 13, senza le rate delle addizionali
  const mese=per.mesi?r2((pensione-I.netta)/(per.mesi*13/12)):0;
  return {anno:+anno,regole:v.regole,mesi:per.mesi,giorni:per.giorni,pensione,altri,reddito:R,irpef:I,add:A,acconto:accontoComunale(p,anno),rate:rateAnnoPrima(p,anno),netto,nettoMese:mese,
    // anno del pensionamento con anche uno stipendio: una sola detrazione, quindi stima prudente (D-039)
    prudente:per.mesi>0&&per.mesi<12&&!!p.detrazione};}
// netto stimato di un mese preciso (solo andamento, 04 §3): rata normale, tredicesima a dicembre, rate delle addizionali
function stimaMese(p,ym){const [y,m]=ym.split('-').map(Number);const S=stimaAnno(p,y);const per=periodo(p,y);
  if(m<per.primoMese||!S.mesi)return null;
  let netto=S.nettoMese*(m===12?2:1);
  if(m<=11)netto-=S.rate.reg+S.rate.comSaldo;
  if(m>=3&&m<=11)netto-=S.acconto.rata;
  return r2(netto);}

// ---------- quattordicesima (P-7): solo "probabile", la decide l'INPS ----------
// tipo: 'dipendente' | 'autonomo'. meseCompleanno (1-12) serve solo a chi compie 64 anni nell'anno.
function quattordicesima({anno,annoNascita,anniContributi,tipo='dipendente',reddito,dal,meseCompleanno}){
  const v=valori(anno).q14;anno=+anno;const nascita=+annoNascita;
  if(!nascita||anno-nascita<v.eta)return {importo:0,motivo:'eta'};
  const anni=z(anniContributi);const lim=tipo==='autonomo'?v.aut:v.dip;const i=anni<=lim[0]?0:anni<=lim[1]?1:2;
  const R=z(reddito);let imp;
  if(R<=v.soglia1)imp=v.importiA[i];
  // oltre la prima soglia: il più alto tra la differenza fino al massimo della prima fascia e l'importo della seconda
  // (tabella INPS "Somma aggiuntiva anno 2026": la fascia intermedia finisce dove la differenza scende sotto l'importo B)
  else if(R<=v.soglia2)imp=Math.max(r2(v.maxA[i]-R),v.importiB[i]);
  else if(R<v.maxB[i])imp=r2(v.maxB[i]-R);
  else return {importo:0,motivo:'reddito'};
  // in dodicesimi: compleanno nell'anno (mese compreso) o pensione iniziata dopo gennaio
  let mesi=12,mese=7;
  if(anno-nascita===v.eta){if(!meseCompleanno)return {importo:null,ridotta:true,mese:12,motivo:'compleanno'};mesi=Math.min(mesi,13-meseCompleanno);mese=12;}
  const [ay,am]=String(dal||'').split('-').map(Number);
  if(ay===anno&&am>1){mesi=Math.min(mesi,13-am);mese=12;}
  if(ay>anno)return {importo:0,motivo:'decorrenza'};
  return {importo:r2(imp*mesi/12),ridotta:mesi<12,mese};
}

// ---------- fondo pensione (F-1…F-4) ----------
function fondo({anno,propri,datore,tfr,reddito}){const lim=valori(anno).fondoLimite;const vers=r2(z(propri)+z(datore));
  const deducibile=r2(Math.min(vers,lim)),oltre=r2(Math.max(0,vers-lim));const R=n(reddito);
  const risparmio=R!=null&&R>0?r2(irpefLorda(R,anno)-irpefLorda(Math.max(0,R-deducibile),anno)):null;
  return {limite:lim,versati:vers,tfr:r2(z(tfr)),deducibile,oltre,risparmio};}

// ---------- contributi dalle buste paga (C-1…C-4) ----------
// buste: elenco di {mese:'AAAA-MM', imponibilePrev, contribLav, giorniInps}
function contributiAnno(buste,anno){const v=valori(anno);const B=buste.filter(b=>String(b.mese||'').startsWith(anno+'-'));
  const mesi=new Set(B.map(b=>b.mese));let contrib=0,imp=0,conContrib=0;
  for(const b of B){const c=n(b.contribLav),i=n(b.imponibilePrev);if(c!=null){contrib+=c;conContrib++;}if(i!=null)imp+=i;}
  const lavorate=Math.floor(mesi.size*52/12);
  const settimane=Math.min(52,lavorate,Math.floor(r2(imp)/v.sogliaSett));
  return {anno:+anno,buste:mesi.size,mancano:Math.max(0,12-mesi.size),contributi:r2(contrib),imponibile:r2(imp),conContributi:conContrib,
    settimane,sopraMassimale:imp>v.massimale};}
function contributiAttesi(impAnno,anno){const v=valori(anno);return r2(impAnno*v.aliqDip/100+Math.max(0,impAnno-v.primaFascia)*v.aliqExtra/100);}
// C-2: avviso se contributi/imponibile è fuori dall'8–11% (e non nel 5–7% degli apprendisti). Mai una correzione.
function controlloContributi(imponibile,contributi,anno){const i=n(imponibile),c=n(contributi);if(!(i>0)||c==null)return null;
  const v=valori(anno),p=r2(c/i*100);const dentro=([a,b])=>p>=a&&p<=b;
  return dentro(v.controllo)||dentro(v.controlloApprendisti)?null:{percentuale:p,testo:`Sembra ${p>v.controllo[1]?'alto':'basso'} (${String(Math.round(p)).replace('.',',')}% dell’imponibile, di solito 9–10%). Controlla il valore sulla busta.`};}

// ---------- cedolino della pensione: controlli K-1…K-8 (avvisi, mai correzioni) ----------
const MESI=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
const TOL=0.02;
function lordoPagamento(c){return r2(z(c.pensioneLorda)+(c.crediti||[]).reduce((a,x)=>a+z(x.importo),0));}
function trattenuteTot(c){return r2(z(c.irpef)+z(c.addReg)+z(c.addComSaldo)+z(c.addComAcconto)+z(c.conguagliDebito)+z(c.altreTrattenute));}
const eur2=x=>(Math.round(x*100)/100).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
// precedente = cedolino del mese prima (se c'è); giaPresente = c'è già un cedolino per lo stesso mese
function controlliCedolino(c,{precedente,giaPresente}={}){const out=[];const m=+String(c.mese||'').slice(5,7);const nomeM=MESI[m-1]||'';
  const crediti=c.crediti||[];const somma=lordoPagamento(c);
  const lordoLetto=n(c.lordoPagamento),lordo=lordoLetto!=null?lordoLetto:somma,netto=n(c.netto);
  if(lordoLetto!=null&&Math.abs(lordoLetto-somma)>TOL)out.push({k:'K-2',campo:'lordoPagamento',tipo:'avviso',testo:`Pensione lorda + altre somme = ${eur2(somma)}, ma il lordo letto è ${eur2(lordoLetto)}.`});
  if(netto!=null&&lordo>0&&netto>lordo+TOL)out.push({k:'K-3',campo:'netto',tipo:'errore',testo:'Il netto non può essere più alto del lordo: controlla il valore letto.'});
  else if(netto!=null&&lordo>0){const atteso=r2(lordo-trattenuteTot(c));
    // K-1 solo se è stata scritta almeno una trattenuta (inserimento a mano: bastano lordo e netto)
    const scritte=['irpef','addReg','addComSaldo','addComAcconto','conguagliDebito','altreTrattenute'].some(k=>n(c[k])!=null);
    if(scritte&&Math.abs(atteso-netto)>TOL)out.push({k:'K-1',campo:'netto',tipo:'avviso',differenza:r2(netto-atteso),testo:`I numeri non tornano: lordo − trattenute = ${eur2(atteso)}, ma il netto letto è ${eur2(netto)}. Controlla le voci sul cedolino.`});}
  if(m){const insolita=campo=>out.push({k:'K-4',campo,tipo:'avviso',testo:`Voce insolita per ${nomeM}: di solito a ${nomeM} non c’è.`});
    if(m===12){for(const k of ['addReg','addComSaldo','addComAcconto'])if(z(c[k]))insolita(k);}
    else if(m<3&&z(c.addComAcconto))insolita('addComAcconto');
    crediti.forEach((x,i)=>{if(x.tipo==='14'&&m!==7&&m!==12)out.push({k:'K-5',campo:'crediti.'+i,tipo:'avviso',testo:'La quattordicesima di solito arriva a luglio o dicembre.'});
      if(x.tipo==='13'&&m!==12)out.push({k:'K-6',campo:'crediti.'+i,tipo:'avviso',testo:'La tredicesima di solito arriva a dicembre.'});});
    const pl=n(c.pensioneLorda),pp=precedente?n(precedente.pensioneLorda):null;
    if(pl!=null&&pp!=null&&Math.abs(pl-pp)>TOL)out.push({k:'K-7',campo:'pensioneLorda',tipo:'nota',testo:m===1?'A gennaio la pensione viene rivalutata.':`È diversa dal mese prima (${eur2(pp)}).`});}
  if(giaPresente)out.push({k:'K-8',campo:'mese',tipo:'domanda',testo:`Hai già il cedolino di ${nomeM}. Lo sostituisco con questo?`});
  return out;}

// ---------- confronto con la stima (04 §3) ----------
// netto confrontabile: senza crediti esenti (14ª, importo aggiuntivo), arretrati e rimborsi dell'anno prima;
// con le trattenute non fiscali e i conguagli a debito degli anni precedenti rimessi dentro
function nettoConfrontabile(c){let x=z(c.netto);
  for(const k of c.crediti||[])if(['14','aggiuntivo','arretrati','rimborso'].includes(k.tipo))x-=z(k.importo);
  return r2(x+z(c.altreTrattenute)+z(c.conguagliDebito));}
// cedolini: elenco dell'anno; stima: netto stimato dell'anno (P-6)
function confrontoAnno(cedolini,stima,anno){const C=cedolini.filter(c=>String(c.mese||'').startsWith(anno+'-'));const mesi=new Set(C.map(c=>c.mese));
  const mancano=[];for(let m=1;m<=12;m++){const k=`${anno}-${String(m).padStart(2,'0')}`;if(!mesi.has(k))mancano.push(k);}
  const T={lordo:0,irpef:0,addizionali:0,altre:0,crediti:0,netto:0,confrontabile:0};
  for(const c of C){T.lordo+=lordoPagamento(c)-(c.crediti||[]).reduce((a,x)=>a+z(x.importo),0);T.irpef+=z(c.irpef)+z(c.conguagliDebito);
    T.addizionali+=z(c.addReg)+z(c.addComSaldo)+z(c.addComAcconto);T.altre+=z(c.altreTrattenute);
    T.crediti+=(c.crediti||[]).reduce((a,x)=>a+z(x.importo),0);T.netto+=z(c.netto);T.confrontabile+=nettoConfrontabile(c);}
  for(const k in T)T[k]=r2(T[k]);
  if(mancano.length)return {totali:T,mancano,completo:false};
  const diff=r2(T.confrontabile-stima),perc=stima?r2(diff/stima*100):0;
  return {totali:T,mancano,completo:true,stima:r2(stima),ricevuto:T.confrontabile,differenza:diff,percentuale:perc,avviso:Math.abs(perc)>3||Math.abs(diff)>100};}

window.PenCalc={valori,irpefLorda,detrPensione,irpefNetta,addizionali,accontoComunale,rateAnnoPrima,periodo,stimaAnno,stimaMese,quattordicesima,fondo,
  contributiAnno,contributiAttesi,controlloContributi,lordoPagamento,trattenuteTot,controlliCedolino,nettoConfrontabile,confrontoAnno,MESI,r2,n};
})();
