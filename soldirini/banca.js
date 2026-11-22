'use strict';
// ================= Soldirini 24c.10 · movimenti della banca da CSV (D-147, prima banca: ING) =================
// Forma del file: consegne/00-formato-lista-movimenti-ing.md §1. Regole di privacy: 03 tornata 36, E1-E10.
// - Il file si legge solo sul telefono, in memoria: niente rete, niente Drive, niente IndexedDB o localStorage (E1, E2).
// - Si salvano solo data, importo, nome (esercente o creditore, modificabile) e categoria delle spese; per stipendio,
//   pensione e compensi solo "È entrato" con data e importo (D-009). Mai IBAN, carte, BIC, Creditor id, Id Mandato, numeri
//   dei bonifici, nomi e indirizzi delle persone, saldo (E3, E5).
// - Doppioni: per ogni riga vista si salva un'impronta SHA-256 (D().bancaImpronte), non la descrizione (E4).
// - Niente si salva senza il tocco su "Importa".
(function(){
const MAX_BYTE=5*1024*1024,MAX_RIGHE=5000; // E6
const TESTA=['DATA CONTABILE','DATA VALUTA','USCITE','ENTRATE','CAUSALE','DESCRIZIONE OPERAZIONE'];
const SP=()=>D().spesePers||(D().spesePers={});
const EN=()=>D().entrate||(D().entrate={});
const IMP=()=>D().bancaImpronte||(D().bancaImpronte={});
const CATS=window.CATS_SPESE; // 24c.11 (D-150): lo stesso elenco di attivita.js
const gm=d=>`${d.slice(8)}/${d.slice(5,7)}`;
const segno=v=>(v<0?'−':'+')+eur(Math.abs(v));

// ---------- lettura del file ----------
// E7: UTF-8 (anche con BOM); se non è UTF-8 valido, Windows-1252. Mai indovinare a caso.
function decodifica(buf){let t;try{t=new TextDecoder('utf-8',{fatal:true}).decode(buf);}catch(e){t=new TextDecoder('windows-1252').decode(buf);}
  return t.charCodeAt(0)===0xFEFF?t.slice(1):t;}
// vero lettore CSV (RFC 4180): virgolette, "" dentro le virgolette, virgole e a capo dentro i campi, CRLF o LF
function leggiCsv(t){const R=[];let r=[],f='',q=false,campo=false;
  const chiudiRiga=()=>{r.push(f);f='';campo=false;if(r.length>1||r[0]!=='')R.push(r);r=[];};
  for(let i=0;i<t.length;i++){const c=t[i];
    if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;continue;}
    if(c==='"'&&!campo&&f===''){q=true;campo=true;continue;}
    if(c===','){r.push(f);f='';campo=false;continue;}
    if(c==='\r'){if(t[i+1]==='\n')i++;chiudiRiga();if(R.length>MAX_RIGHE+2)return null;continue;}
    if(c==='\n'){chiudiRiga();if(R.length>MAX_RIGHE+2)return null;continue;}
    f+=c;campo=true;}
  if(q)return undefined; // virgolette non chiuse: file rovinato
  if(f!==''||r.length)chiudiRiga();
  return R;}
// E10: niente caratteri di controllo né caratteri che girano il testo
const pulisci=s=>String(s??'').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g,' ').replace(/\s+/g,' ').trim();
function dataIt(s){const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s||'');if(!m)return null;const [,g,me,y]=m.map(Number);const x=new Date(y,me-1,g);
  return x.getFullYear()===y&&x.getMonth()===me-1&&x.getDate()===g?`${y}-${pad(me)}-${pad(g)}`:null;}
const cent=v=>Math.round(v*100);

// testo → {err} oppure {mov, saldoOk, dal, al}
function analizza(testo){
  const R=leggiCsv(testo);if(R===null)return {err:'grande'};if(R===undefined)return {err:'rovinato'};
  return analizzaRighe(R);}
// righe del CSV (o dell'Excel portato nella stessa forma) → {err} oppure {mov, saldoOk, dal, al}
function analizzaRighe(R){
  if(!R.length)return {err:'banca'};
  const h=R[0].map(x=>pulisci(x).toUpperCase());
  if(h.length!==TESTA.length||h.some((x,i)=>x!==TESTA[i]))return {err:'banca'};
  let ini=null,fin=null;const mov=[];
  for(const r0 of R.slice(1)){
    if(r0.length!==TESTA.length)return {err:'rovinato'};
    const r=r0.map(pulisci);const [dc,dv,usc,ent,caus,desc]=r;
    if(!caus&&/^saldo (iniziale|finale)$/i.test(desc)){const v=leggiNumero(ent||usc,true);if(v==null||!dataIt(dc))return {err:'rovinato'};
      if(/iniziale/i.test(desc))ini={v,data:dataIt(dc)};else fin={v,data:dataIt(dc)};continue;}
    const data=dataIt(dc),val=dv?dataIt(dv):data;
    if(!data||!val||!caus||(usc&&ent)||(!usc&&!ent))return {err:'rovinato'};
    const v=leggiNumero(usc||ent,true);
    if(v==null||v===0||(usc&&v>0)||(ent&&v<0))return {err:'rovinato'};
    mov.push({dc:data,dv:val,v,caus,desc,grezzo:r0.join('\u0001'),pulito:r.join('\u0001')});}
  if(!mov.length)return {err:'vuoto'};
  const somma=mov.reduce((a,m)=>a+cent(m.v),0);
  const saldoOk=!!(ini&&fin)&&cent(ini.v)+somma===cent(fin.v);
  const date=mov.map(m=>m.dc).sort();
  return {mov,saldoOk,dal:ini?.data||date[0],al:fin?.data||date[date.length-1]};}

// ---------- 24c.11 (D-153): la stessa lista in Excel (.xlsx) ----------
// Si legge con JSZip (già nell'app) e il lettore XML del browser: niente librerie nuove, niente rete. Solo i valori delle celle
// (testi e numeri), mai formule, collegamenti o macro (E8); ogni parte del file al massimo 20 MB dopo la decompressione.
// La lista diventa righe nella stessa forma del CSV (date GG/MM/AAAA, importi "+1.500,00" in ENTRATE o "-4,50" in USCITE):
// così valgono gli stessi controlli, le stesse proposte e la stessa impronta (lo stesso movimento in CSV e in Excel = "Già importato").
const MAX_PARTE=20*1024*1024;
function leggiFino(f,max){return new Promise((ok,ko)=>{const parti=[];let n=0,fine=false;const st=f.internalStream('uint8array');
  st.on('data',c=>{if(fine)return;n+=c.length;if(n>max){fine=true;st.pause();ko(new Error('grande'));return;}parti.push(c);})
    .on('error',e=>{if(!fine){fine=true;ko(e);}})
    .on('end',()=>{if(fine)return;fine=true;const b=new Uint8Array(n);let o=0;for(const c of parti){b.set(c,o);o+=c.length;}ok(b);}).resume();});}
const xml=t=>new DOMParser().parseFromString(t,'application/xml');
const figli=(el,nome)=>[...el.getElementsByTagName('*')].filter(x=>x.localName===nome);
const testoDi=el=>figli(el,'t').map(t=>t.textContent).join('');
const colonna=ref=>{const m=/^([A-Z]+)/.exec(ref||'');if(!m)return -1;let n=0;for(const c of m[1])n=n*26+c.charCodeAt(0)-64;return n-1;};
const fmtData=d=>`${d.slice(8)}/${d.slice(5,7)}/${d.slice(0,4)}`;
const fmtImp=v=>{const [i,dec]=Math.abs(v).toFixed(2).split('.');return (v<0?'-':'+')+i.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+','+dec;};
function dataExcel(v,base1904){if(typeof v==='number'){if(!(v>0&&v<200000))return '';const t=Date.UTC(base1904?1904:1899,base1904?0:11,base1904?1:30)+Math.round(v)*86400000;
    const x=new Date(t);return `${pad(x.getUTCDate())}/${pad(x.getUTCMonth()+1)}/${x.getUTCFullYear()}`;}
  return pulisci(v);}
const TESTA_X=['DATA CONTABILE','DATA VALUTA','CAUSALE','DESCRIZIONE OPERAZIONE','IMPORTO IN EURO'];
async function analizzaXlsx(buf){
  let z;try{z=await JSZip.loadAsync(buf);}catch(e){return {err:'banca'};}
  const parte=async nome=>{const f=z.file(nome);return f?new TextDecoder().decode(await leggiFino(f,MAX_PARTE)):null;};
  try{
    const wbT=await parte('xl/workbook.xml');if(!wbT)return {err:'banca'};const wb=xml(wbT);
    const base1904=figli(wb,'workbookPr').some(x=>/^(1|true)$/.test(x.getAttribute('date1904')||''));
    // il primo foglio, dal suo collegamento; se manca, sheet1.xml
    let percorso='xl/worksheets/sheet1.xml';const primo=figli(wb,'sheet')[0];const relsT=await parte('xl/_rels/workbook.xml.rels');
    if(primo&&relsT){const rid=[...primo.attributes].find(a=>a.localName==='id')?.value;const r=figli(xml(relsT),'Relationship').find(x=>x.getAttribute('Id')===rid);
      const t=r&&r.getAttribute('Target');if(t&&!/^[a-z]+:/i.test(t))percorso=t.startsWith('/')?t.slice(1):'xl/'+t.replace(/^\.\//,'');}
    const ssT=await parte('xl/sharedStrings.xml');const SS=ssT?figli(xml(ssT),'si').map(testoDi):[];
    const shT=await parte(percorso);if(!shT)return {err:'banca'};
    const righe=figli(xml(shT),'row');if(righe.length>MAX_RIGHE+40)return {err:'grande'};
    const G=righe.map(r=>{const out=[];for(const c of figli(r,'c')){const i=colonna(c.getAttribute('r'));if(i<0||i>50)continue;const t=c.getAttribute('t');
        const v=figli(c,'v')[0]?.textContent;let x='';
        if(t==='s')x=SS[+v]??'';else if(t==='inlineStr')x=testoDi(c);else if(t==='str'||t==='e')x=v??'';else if(t==='b')x=v==='1'?'VERO':'FALSO';
        else if(v!=null&&v!==''&&isFinite(+v))x=+v;
        out[i]=x;}return out;});
    // intestazione: le 5 colonne una dopo l'altra (nel file vero dalla colonna B, riga 12)
    let hr=-1,c0=-1;
    for(let r=0;r<G.length&&r<60&&hr<0;r++)for(let c=0;c<G[r].length;c++){if(TESTA_X.every((h,k)=>pulisci(G[r][c+k]).toUpperCase()===h)){hr=r;c0=c;break;}}
    if(hr<0)return {err:'banca'};
    // testata (prima dell'intestazione): saldi e periodo, solo per il controllo; il saldo non si salva
    const testata=G.slice(0,hr).flat().filter(x=>typeof x==='string').map(pulisci).join(' | ');
    const saldo=re=>{const m=re.exec(testata);return m?m[1]:null;};
    const ini=saldo(/Saldo iniziale:?\s*([+-]?\d{1,3}(?:\.\d{3})*,\d{2})/i),fin=saldo(/Saldo finale:?\s*([+-]?\d{1,3}(?:\.\d{3})*,\d{2})/i);
    const per=/dal (\d{2}\/\d{2}\/\d{4}) al (\d{2}\/\d{2}\/\d{4})/i.exec(testata);
    const R=[TESTA.slice()],mov=[];
    for(const r of G.slice(hr+1)){const x=r.slice(c0,c0+5);if(x.every(v=>v===undefined||v===''))continue;
      const [dc,dv,caus,desc,imp]=x;const v=typeof imp==='number'?imp:leggiNumero(pulisci(imp),true);
      if(v==null||!isFinite(v))return {err:'rovinato'};const f=fmtImp(v);
      mov.push([dataExcel(dc,base1904),dataExcel(dv,base1904),v<0?f:'',v<0?'':f,pulisci(caus),pulisci(desc)]);}
    if(!mov.length)return {err:'vuoto'};
    const dal=per?per[1]:mov[0][0],al=per?per[2]:mov[mov.length-1][0];
    const conSegno=x=>/^[+-]/.test(x)?x:'+'+x;
    if(ini)R.push([dal,'','',conSegno(ini),'','Saldo iniziale']);
    R.push(...mov);
    if(fin)R.push([al,'','',conSegno(fin),'','Saldo finale']);
    return analizzaRighe(R);
  }catch(e){return {err:e&&e.message==='grande'?'grande':'rovinato'};}}

// ---------- cosa c'è nella descrizione (solo per capire la riga: niente di questo si salva, tranne il nome proposto) ----------
const tra=(s,re)=>{const m=re.exec(s);return m?pulisci(m[1]):'';};
const PAROLE_VUOTE=new Set(['spa','srl','srls','snc','sas','coop','societa','italia','servizi','the','and','per','del','della','dei','con']);
const parole=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').split(/[^a-z0-9]+/).filter(w=>w.length>=3&&!PAROLE_VUOTE.has(w));
const nomeComune=(a,b)=>{const B=parole(b);return parole(a).some(w=>B.includes(w));};
function catDaNome(n){const s=n.toLowerCase();
  if(/\b(bar|caff|cafe|ristor|pizz|trattor|osteria|pub|gelat|pasticc|mcdonald|burger)/.test(s))return 'bar';
  if(/(paypal|amazon|stream|netflix|spotify|ebay|zalando|apple\.com|google)/.test(s))return 'online';
  if(/(conad|coop|esselunga|lidl|carrefour|eurospin|penny|pam |famila|despar|supermerc|ipercoop|aldi|md )/.test(s))return 'spesa';
  if(/(esso|eni |enilive|q8|tamoil|ip |benzin|carbur|trenitalia|italo|autostrad|telepass|atm |atac|taxi|parcheg)/.test(s))return 'trasporti';
  return 'negozio';}
const MESE_N=s=>MESI.indexOf(String(s||'').toLowerCase())+1;

// voci a cui si può collegare un movimento
const fissiNel=ym=>(window.fissiDel?fissiDel(ym):[]).map(x=>x.f);
function fissoSimile(ym,nome,imp){const a=Math.abs(imp);
  return fissiNel(ym).find(f=>{const fi=leggiNumero(f.importo)??0;return fi>0&&Math.abs(a-fi)<=fi*0.10+0.005&&(nomeComune(f.nome,nome));})||null;}
function vociStipendio(ym){const out=[];
  for(const l of lavori())out.push({val:`en:lav|${l.id}|${ym}`,txt:`È entrato: stipendio di ${monthName(ym)} · ${l.nome||'Lavoro'}`,nome:l.nome||''});
  const P=window.Pensione;if(P&&P.profilo&&P.profilo())out.push({val:`en:pen|${ym}`,txt:`È entrata: pensione di ${monthName(ym)}`,nome:'pensione'});
  return out;}
function vociProgetti(ym){if(!window.Entrate)return [];
  return Entrate.voci(ym).filter(v=>v.tipo==='prog'&&!v.ent).map(v=>({val:'pg:'+v.key.slice(5),txt:`È entrato: ${v.titolo.toLowerCase()} · ${v.fonteNome}`,imp:v.pr.imp,t:v.t,nome:v.fonteNome}));}

// una proposta per ogni movimento: {nome, info, scelte:[{val,txt}], val}
function proponi(m){const c=m.caus.toLowerCase(),d=m.desc;const ym=m.dv.slice(0,7);let nome='',info='',data=m.dv,val='no';const scelte=[];
  const spese=cat=>CATS.map(k=>({val:'sp:'+k[0],txt:`Spesa · ${k[1]} ${k[2]}`})).sort((a,b)=>(b.val==='sp:'+cat)-(a.val==='sp:'+cat));
  const ignora=(t='Ignora')=>({val:'no',txt:t});
  if(c==='pagamento carta'){
    data=dataIt(tra(d,/Operazione \S+ del (\d{2}\/\d{2}\/\d{4})/))||m.dv;
    nome=tra(d,/ presso (.+?)(?: - Transazione.*)?$/)||'Pagamento con carta';
    const div=tra(d,/Div=([A-Z]{3})/);info=`Pagamento con carta · acquisto del ${gm(data)}${div&&div!=='EUR'?' · in '+div:''}`;
    const cat=catDaNome(nome);scelte.push(...spese(cat),ignora());val='sp:'+cat;}
  else if(c==='addebito diretto'){
    nome=tra(d,/Creditor id\. \S+ (.+?) Id Mandato/)||'Addebito diretto';
    const f=fissoSimile(ym,nome,m.v);info='Addebito diretto (bolletta, abbonamento, rata)';
    for(const x of fissiNel(ym))scelte.push({val:'fx:'+x.id,txt:`Uscita fissa “${x.nome}” (già contata)`});
    scelte.push(...spese('casa'),ignora());val=f?'fx:'+f.id:'sp:casa';
    if(f)info=`Sembra l’uscita fissa “${f.nome}”: si collega e non si conta due volte`;}
  else if(c==='accredito stipendio/pensione'){
    nome=tra(d,/Anagrafica Ordinante (.+?)(?: Note:|$)/)||'Stipendio o pensione';
    const per=/periodo ([a-zà-ú]+) (\d{4})/i.exec(d);const n=per?MESE_N(per[1]):0;const ymC=n?`${per[2]}-${pad(n)}`:ym;
    const V=vociStipendio(ymC);info=`Stipendio o pensione${n?' di '+monthName(ymC):''}: si segna “È entrato”, non un’entrata in più`;
    const v=V.find(x=>x.nome!=='pensione'&&nomeComune(x.nome,nome))||V.find(x=>x.nome!=='pensione')||V[0];
    scelte.push(...V,ignora());
    if(v){const gia=Entrate.voce(v.val.slice(3))?.ent;val=gia?'no':v.val;if(gia)info=`Già segnato come entrato il ${gm(gia.data)}`;}
    else info='Nelle impostazioni non c’è un lavoro o una pensione da segnare';}
  else if(c==='accredito bonifico'){
    nome=tra(d,/Anagrafica Ordinante (.+?)(?: Note:|$)/)||'Bonifico';
    const note=tra(d,/ Note: (.*)$/);info='Bonifico ricevuto'+(note?` · ${note}`:'');
    const V=vociProgetti(ym);const rimb=/rimbors/i.test(note);
    const punti=x=>(x.imp!=null&&Math.abs(x.imp-m.v)<0.005?4:0)+(nomeComune(x.nome,nome)?2:0)+(rimb===(x.t==='r')?1:0);
    V.sort((a,b)=>punti(b)-punti(a));scelte.push(...V,ignora());const best=V[0];val=best&&punti(best)>=2?best.val:'no';}
  else if(c==='bonifico in uscita'){
    const note=tra(d,/ Note: (.*)$/);nome=note||'Bonifico'; // 03, decisione 1: niente nomi delle persone, si propone la nota
    info='Bonifico fatto da te';const f=fissoSimile(ym,nome,m.v);const cat=/(affitt|mutuo|condomin|bollett)/i.test(note)?'casa':'altro';
    for(const x of fissiNel(ym))scelte.push({val:'fx:'+x.id,txt:`Uscita fissa “${x.nome}” (già contata)`});
    scelte.push(...spese(cat),ignora());val=f?'fx:'+f.id:'sp:'+cat;}
  else if(c==='giroconto'){nome='Giroconto';info='Verso un tuo conto: non è una spesa';
    scelte.push(ignora('Ignora (soldi tuoi)'));if(m.v<0)scelte.push(...spese('altro'));val='no';}
  else{nome=m.caus;info=m.caus;if(m.v<0){scelte.push(...spese('altro'),ignora());val='sp:altro';}else scelte.push(ignora());}
  return {nome:nome.slice(0,60),info,scelte,val,data};}

// 24c.11 (D-152): il mese parte dallo stipendio. Nella lista si cercano gli accrediti di stipendio o pensione (data valuta).
// Ogni movimento conta nei soldi del mese dell'ultimo stipendio arrivato prima di lui o nello stesso giorno; quelli prima del primo
// stipendio contano nel mese prima di quello dello stipendio. Un movimento si sposta al massimo al mese prima del suo (mai in avanti,
// mai più indietro): così una lista lunga senza lo stipendio di un mese non sposta tutto. Senza stipendi nella lista non cambia niente.
// La data vera non si tocca: il mese si salva a parte (meseConto) solo quando è diverso da quello della data.
function meseDaStipendio(mov){const S=mov.filter(m=>m.caus.toLowerCase()==='accredito stipendio/pensione').map(m=>m.dv).sort();
  for(const r of L){r.mc=null;if(!S.length)continue;const proprio=r.data.slice(0,7);const prima=S.filter(d=>d<=r.data);
    let m=prima.length?prima[prima.length-1].slice(0,7):mesePrima(S[0].slice(0,7));
    if(m>proprio)m=proprio;if(m<mesePrima(proprio))m=mesePrima(proprio);
    if(m!==proprio)r.mc=m;}}
const nomeMese=(m,d)=>MESI[+m.slice(5)-1]+(m.slice(0,4)===d.slice(0,4)?'':' '+m.slice(0,4));
const sposta=r=>!!r.mc&&/^(sp|en|pg):/.test(r.val);

// impronta della riga del file (E4): SHA-256, si salva solo questa
// 24c.11: si calcola sulla riga con gli spazi già sistemati (uguale per CSV ed Excel); si riconosce anche l'impronta della riga
// così com'era nel file, salvata dalla 24c.10
async function impronta(t){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('soldirini-banca|'+t));
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}

// ---------- finestra "Movimenti da importare" ----------
let L=null; // righe della finestra, solo in memoria
async function apriFile(file){
  if(!file)return;
  if(file.size>MAX_BYTE){toast('Il file è troppo grande: scarica un periodo più breve.','err');return;}
  let A;try{const buf=await file.arrayBuffer();const u=new Uint8Array(buf,0,Math.min(4,buf.byteLength));
    // 24c.11 (D-153): un file .xlsx è uno zip (comincia con "PK"); tutto il resto si legge come CSV
    A=u[0]===0x50&&u[1]===0x4B?await analizzaXlsx(buf):analizza(decodifica(buf));}catch(e){A={err:'rovinato'};}
  if(A.err){toast({banca:'Questo file non sembra la lista movimenti di ING (CSV o Excel): per ora Soldirini legge solo quella. Non ho importato niente.',
    rovinato:'Il file non si legge bene: non ho importato niente.',grande:'Il file è troppo grande: scarica un periodo più breve.',vuoto:'Nel file non ci sono movimenti.'}[A.err],'err',8000);return;}
  const imp=IMP();
  const vista=h=>!!imp[h]&&!imp[h].deleted;
  L=await Promise.all(A.mov.map(async m=>{const p=proponi(m);const h=await impronta(m.pulito);const gia=vista(h)||(m.grezzo!==m.pulito&&vista(await impronta(m.grezzo)));
    return {...p,v:m.v,h,gia,on:!gia&&p.val!=='no'};}));
  meseDaStipendio(A.mov);
  $('bcSub').textContent=`Lista movimenti ING · dal ${gm(A.dal)}/${A.dal.slice(0,4)} al ${gm(A.al)}/${A.al.slice(0,4)} · ${L.length===1?'1 movimento':L.length+' movimenti'}`;
  $('bcAvviso').hidden=A.saldoOk;$('bcOk').hidden=!A.saldoOk;
  disegna();$('bcModal').hidden=false;$('bcModal').querySelector('.sheet').scrollTop=0;document.body.classList.add('noscroll');}
function riga(r,i){
  const nomeVisibile=r.val.startsWith('sp:');
  return `<div class="bcrow${r.gia?' gia':''}${r.on?'':' off'}" data-bc="${i}">
    <label class="check bchk"><input type="checkbox" data-bcon="${i}" ${r.on?'checked':''} ${r.gia?'disabled':''} aria-label="Importa il movimento del ${gm(r.data)} di ${segno(r.v)}">
      <span class="bcd">${gm(r.data)}</span><span class="bcn">${esc(r.nome)}</span><b class="bci ${r.v<0?'usc':'ent'}">${segno(r.v)}</b></label>
    <small class="muted bcinfo">${r.gia?'Già importato':esc(r.info)}</small>${!r.gia&&sposta(r)?`<small class="muted bcinfo bcmese">Conta nei soldi di ${esc(nomeMese(r.mc,r.data))}</small>`:''}
    ${r.gia?'':`<select data-bcs="${i}" aria-label="Cosa fare con il movimento del ${gm(r.data)}">${r.scelte.map(s=>`<option value="${esc(s.val)}" ${s.val===r.val?'selected':''}>${esc(s.txt)}</option>`).join('')}</select>
    ${nomeVisibile?`<input data-bcnome="${i}" value="${esc(r.nome)}" maxlength="60" aria-label="Nome della spesa" autocomplete="off">`:''}`}
  </div>`;}
function disegna(){$('bcList').innerHTML=L.map(riga).join('');aggiornaTot();}
function aggiornaTot(){const S=L.filter(r=>r.on&&!r.gia&&r.val!=='no');const u=S.filter(r=>r.v<0).reduce((a,r)=>a-cent(r.v),0)/100,e=S.filter(r=>r.v>0).reduce((a,r)=>a+cent(r.v),0)/100;
  $('bcTot').textContent=S.length?`Uscite ${eur(u)} · Entrate ${eur(e)}`:'Nessun movimento scelto.';
  const b=$('bcImporta');b.textContent=S.length===1?'Importa 1 movimento':`Importa ${S.length} movimenti`;b.disabled=!S.length;}
function chiudi(){$('bcModal').hidden=true;L=null;$('bcList').innerHTML='';
  if([...document.querySelectorAll('.modal')].every(m=>m.hidden))document.body.classList.remove('noscroll');}
function importa(){if(!L)return;const now=Date.now();let n=0,k=0;const imp=IMP();
  for(const r of L){if(r.gia)continue;
    if(r.on&&r.val!=='no'){const [t,x]=[r.val.slice(0,2),r.val.slice(3)];
      const mc=r.mc?{meseConto:r.mc}:{}; // 24c.11 (D-152)
      if(t==='sp'){const id=uid();SP()[id]={id,data:r.data,...mc,created:now+k++,updatedAt:now,cat:x,importo:r2(Math.abs(r.v)),nota:pulisci(r.nome).slice(0,60),origine:'banca'};}
      else if(t==='en')EN()[x]={entrato:true,data:r.data,...mc,importo:r2(r.v),updatedAt:now};
      else if(t==='pg')pagamenti()[x]={pagato:true,data:r.data,...mc,importo:r2(r.v),updatedAt:now};
      // 'fx': uscita fissa già contata nel mese: si collega e non si aggiunge niente
      n++;}
    // righe importate e righe da ignorare: la prossima volta sono "già importato"; una riga solo tolta dalla casella torna
    if((r.on&&r.val!=='no')||r.val==='no')imp[r.h]={updatedAt:now};
  }
  chiudi();changed();render();toast(n===1?'Importato 1 movimento.':`Importati ${n} movimenti.`);}

function bind(){
  document.addEventListener('click',e=>{if(e.target.closest('[data-bcimp]')){const f=$('bcFile');f.value='';f.click();}});
  $('bcFile').addEventListener('change',async e=>{const f=e.target.files[0];await apriFile(f);e.target.value='';}); // E1: il campo si svuota
  $('bcList').addEventListener('change',e=>{const t=e.target;
    if(t.dataset.bcon!=null){const r=L[+t.dataset.bcon];r.on=t.checked;t.closest('.bcrow').classList.toggle('off',!r.on);aggiornaTot();return;}
    if(t.dataset.bcs!=null){const i=+t.dataset.bcs,r=L[i];r.val=t.value;r.on=r.val!=='no';disegna();return;}});
  $('bcList').addEventListener('input',e=>{const t=e.target;if(t.dataset.bcnome!=null)L[+t.dataset.bcnome].nome=t.value;});
  $('bcClose').onclick=chiudi;$('bcAnn').onclick=chiudi;$('bcImporta').onclick=importa;}
bind();
window.Banca={analizza,analizzaXlsx,leggiCsv,proponi,apriFile};
})();
