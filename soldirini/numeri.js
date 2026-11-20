'use strict';
// ================= Soldirini 24c.6 · lettura dei numeri scritti all'italiana (P2 di 04, D-139) =================
// Una sola funzione per tutta l'app. Senza interfaccia e senza dipendenze: si carica per prima (archivio.js) e, nelle prove
// in Node, prima di stipcalc.js e pencalc.js.
//   "1.260,00" "1260,00" "1 260" "1260.5" → 1260 / 1260 / 1260 / 1260,5
//   dati già salvati con la vecchia regola (solo la prima virgola cambiata in punto): "1.680.00" → 1680; "1.680.000" → 1680000
//   "1.680" (un punto e tre cifre) è ambiguo (1.680 € o 1,68 €): non si indovina, vale "non capito".
// Due modi:
//   leggiNumero(v)        lettura dei dati: come il vecchio parseFloat prende il numero all'inizio e lascia il resto ("12 €" → 12)
//   leggiNumero(v,true)   lettura rigida (campi delle finestre, pencalc): tutto il testo deve essere un numero ("€" ammesso)
// Il risultato è un numero finito oppure null. capisciNumero(v,rigido) dice anche il perché: {n, stato:'ok'|'vuoto'|'ambiguo'|'no'}.
// La regola dell'ambiguo vale solo per i testi scritti a mano all'italiana (busta, importi di testo).
//   leggiNumeroPunto(v)   valori dei campi type="number" e delle impostazioni del lavoro e dei turni: il punto è sempre il
//                         decimale ("8.125" = 8,125, "10.500" = 10,5), come la lettura di prima (parseFloat, virgola → punto).
(function(g){
  const SP=/[\s  ]/,SPg=/[\s  ]/g;
  const NO={stato:'no',n:null};
  // gruppi delle migliaia: 1-3 cifre, poi gruppi di 3
  const migliaia=(s,sep)=>{const p=s.split(sep);return /^\d{1,3}$/.test(p[0])&&p.slice(1).every(x=>/^\d{3}$/.test(x));};
  // t: solo cifre, punti e virgole
  function interpreta(t){
    if(/^\d+$/.test(t))return +t;
    if(/^[.,]\d+$/.test(t))return +('0.'+t.slice(1)); // ",5" come parseFloat(".5")
    const pv=t.lastIndexOf(','),pp=t.lastIndexOf('.');
    if(pv>=0&&pp>=0){ // tutti e due: l'ultimo è il decimale, l'altro separa le migliaia ("1.260,00", "1,260.50")
      const i=Math.max(pv,pp),dec=t[i],mig=dec===','?'.':',',int=t.slice(0,i),fr=t.slice(i+1);
      return !int.includes(dec)&&/^\d+$/.test(fr)&&migliaia(int,mig)?+(int.split(mig).join('')+'.'+fr):NaN;}
    const sep=pv>=0?',':'.',p=t.split(sep);
    if(p.length===2){
      if(sep==='.'&&/^[1-9]\d{0,2}$/.test(p[0])&&/^\d{3}$/.test(p[1]))return 'ambiguo'; // "1.680"
      return /^\d+$/.test(p[0])&&/^\d+$/.test(p[1])?+(p[0]+'.'+p[1]):NaN;}
    if(migliaia(t,sep))return +p.join(''); // "1.680.000"
    if(sep==='.'){const int=p.slice(0,-1).join('.'),fr=p[p.length-1]; // "1.680.00", salvato da "1.680,00"
      if(migliaia(int,'.')&&/^\d+$/.test(fr))return +(int.split('.').join('')+'.'+fr);}
    return NaN;}
  function capisciNumero(v,rigido){
    if(v==null)return {stato:'vuoto',n:null};
    if(typeof v==='number')return Number.isFinite(v)?{stato:'ok',n:v}:NO;
    if(typeof v!=='string')return NO;
    let s=v.trim();if(!s)return {stato:'vuoto',n:null};
    if(rigido)s=s.replace(/^€\s*/,'').replace(/\s*€$/,'');
    let segno=1;const m=/^([+\-−])\s*/.exec(s);if(m){segno=m[1]==='+'?1:-1;s=s.slice(m[0].length);}
    const corsa=/^[\d.,\s  ]*/.exec(s)[0],resto=s.slice(corsa.length);
    let t=corsa.replace(/[\s  ]+$/,'');
    if(SP.test(t)){ // spazi solo tra gruppi di tre cifre ("1 260", "12 600,50"); altrimenti lo spazio chiude il numero
      if(/^\d{1,3}(?:[\s  ]\d{3})+(?:[.,]\d+)?$/.test(t))t=t.replace(SPg,'');
      else if(rigido)return NO;else t=t.split(SP)[0];}
    if(rigido){if(resto.trim())return NO;}
    else t=t.replace(/[.,]+$/,''); // come parseFloat: "12." → 12
    if(!t)return NO;
    const r=interpreta(t);
    if(r==='ambiguo')return {stato:'ambiguo',n:null};
    const n=segno*r;return Number.isFinite(n)?{stato:'ok',n}:NO;}
  const leggiNumero=(v,rigido)=>capisciNumero(v,rigido).n;
  const leggiNumeroPunto=v=>{if(v===''||v==null)return null;const n=typeof v==='number'?v:parseFloat(String(v).replace(',','.'));return isNaN(n)?null:n;};
  // sia sull'oggetto globale sia su window (nelle prove in Node window può essere un oggetto a parte)
  for(const o of [g,typeof window!=='undefined'?window:null])if(o){o.capisciNumero=capisciNumero;o.leggiNumero=leggiNumero;o.leggiNumeroPunto=leggiNumeroPunto;}
})(globalThis);
