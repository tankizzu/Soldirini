'use strict';
// ================= Soldirini =================
// v24csp (D-048): un altro sito non può mostrare Soldirini dentro un suo riquadro per ingannare i tocchi
// (con il solo <meta> la CSP non permette frame-ancestors). Dentro un riquadro la pagina resta nascosta.
const IN_RIQUADRO=(()=>{try{return window.top!==window.self;}catch(e){return true;}})();
if(IN_RIQUADRO)document.documentElement.style.display='none';
// v24csp: blocchi della politica di sicurezza (CSP), solo in memoria (mai su Drive né nel telefono).
// Si tengono ora, tipo (direttiva) e solo il nome del sito: niente indirizzo completo, campione di codice o file sorgente.
const CSP_BLOCCHI=[];let cspTotale=0;
function cspDaDove(u){
  if(!u)return 'in linea';
  if(/^(inline|eval|wasm-eval|data|blob|trusted-types-sink|trusted-types-policy)$/.test(u))return {inline:'in linea',eval:'eval','wasm-eval':'eval'}[u]||u;
  try{const x=new URL(u);return x.protocol==='data:'?'data':x.protocol==='blob:'?'blob':x.host||x.protocol.replace(':','');}catch(e){return 'altro';}
}
document.addEventListener('securitypolicyviolation',e=>{
  cspTotale++;CSP_BLOCCHI.unshift({ora:Date.now(),dir:String(e.effectiveDirective||e.violatedDirective||'').split(' ')[0],da:cspDaDove(e.blockedURI)});
  if(CSP_BLOCCHI.length>20)CSP_BLOCCHI.length=20;
  try{renderCsp();}catch(err){}
});
const CFG={
  CLIENT_ID:'1065907133263-mi5uke963ickepji7mv0cja048asl5q8.apps.googleusercontent.com',
  API_KEY:'AIzaSyCW_oQK4jbdIiCPZuVmdkQKvYvTvVs7fZM',
  APP_ID:'1065907133263',
  SCOPE:'https://www.googleapis.com/auth/drive.file'
};
const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseYmd=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d);};
const eur=n=>Number(n||0).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
const nf=(n,d=2)=>Number(n||0).toLocaleString('it-IT',{maximumFractionDigits:d});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// v24c (V7 di 03): valori dei dati negli attributi. Numeri: solo se sono numeri; date: solo AAAA-MM-GG; immagini: solo JPEG, PNG o WebP in base64
const numAttr=v=>{if(v==null||v==='')return '';const n=Number(String(v).replace(',','.'));return Number.isFinite(n)?esc(v):'';};
const dataAttr=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:'';
const imgOk=v=>typeof v==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(v)?v:'';
const clone=o=>JSON.parse(JSON.stringify(o));
const uid=()=>Date.now().toString(36).slice(-4)+Math.random().toString(36).slice(2,8);
const r2=n=>Math.round((+n||0)*100)/100;
const MESI=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
const GIORNI=['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'];
const monthName=ym=>{const [y,m]=ym.split('-').map(Number);return `${MESI[m-1]} ${y}`;};
const lastDay=ym=>{const [y,m]=ym.split('-').map(Number);return new Date(y,m,0).getDate();};
const today=()=>ymd(new Date());
const TIPI={allenamento:'Allenamento',partita:'Partita',amichevole:'Amichevole',lavoro:'Lavoro',altro:'Altro'};
const COLORI=['#5b6475','#7d5c52','#6e6079','#776a52','#58665f','#8a6f3e','#4f6d7a','#7a5566','#707070'];
// 24.1 (D-077): i colori arrivano anche da Drive: nella pagina (stile in linea) va solo un #rrggbb, altrimenti un grigio
// 24.1 (D-077): un pagamento dei progetti letto da Drive conta solo con pagato===true e una data AAAA-MM-GG vera (come leggiPag di entrate.js)
const dataOk=d=>{if(typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d))return false;const [y,m,g]=d.split('-').map(Number);const x=new Date(y,m-1,g);return x.getFullYear()===y&&x.getMonth()===m-1&&x.getDate()===g;};
const pagOk=g=>!!g&&typeof g==='object'&&g.pagato===true&&dataOk(g.data);
const colOk=c=>typeof c==='string'&&/^#[0-9a-fA-F]{6}$/.test(c)?c:'#707070';
const min=t=>{const m=/^(\d{1,2})[:.](\d{2})$/.exec(String(t||'').trim());return m?(+m[1])*60+(+m[2]):null;};
const normT=t=>{const v=min(t);return v==null?'':`${Math.floor(v/60)}:${pad(v%60)}`;};

// ---------------- dati ----------------
const STORE='soldirini-v1'; // v24 (D-070): codice della demo tolto
const emptyData=()=>({v:1,pagamenti:{},impost:{soglie:null,tema:'auto',promemoria:false,updatedAt:0},profilo:{cognome:'',nome:'',natoA:'',dataNascita:'',residenza:'',via:'',cf:'',auto:{modello:'',targa:''},updatedAt:0},progetti:{},eventi:{},mesi:{},files:{},root:null});
// v24b (D-054, D-064): i dati arrivano da archivio.js (IndexedDB). Se IndexedDB non c'è o non risponde, come nella v24 da localStorage.
const ARCH=window.Archivio&&Archivio.modo==='idb'?Archivio:null;
let DB=(ARCH?ARCH.iniziale:(()=>{try{return JSON.parse(localStorage.getItem(STORE)||'null');}catch(e){return null;}})())||{};
if(ARCH)ARCH.iniziale=null; // 03 (tornata 22, 1.3 B): dopo l'avvio i dati restano solo in DB
DB.data=DB.data||emptyData();
DB.meta=Object.assign({dataId:null,seq:0,synced:0,lastSync:0,queue:{},account:null},DB.meta||{});
// v24b: persist() resta senza attesa; con IndexedDB la scrittura va in fila in archivio.js (una alla volta, sempre lo stato più recente)
// v24b: dati già spostati in IndexedDB che ora non risponde: si vede la vecchia copia, ma non si riscrive (punto di ritorno)
// e le modifiche non contano come salvate (Drive le riceve comunque alla sincronizzazione). Testo provvisorio, da confermare con 02.
const LS_FERMO=!ARCH&&!!(window.Archivio&&Archivio.dopoSpostamento);
function persist(){if(ARCH){ARCH.salva();return;}if(LS_FERMO)return; /* la fascia in alto lo dice (fasciaLsFermo) */try{localStorage.setItem(STORE,JSON.stringify(DB));}catch(e){toast(MSG_MEMORIA_PIENA,'err',8000);}}
// 24b.1 (02, tornata 22 A3)
const MSG_MEMORIA_PIENA='⚠ Memoria del telefono piena: le ultime modifiche non sono salvate. Libera un po’ di spazio, poi Soldirini riprova alla prossima modifica.';
// v24b: utente nuovo, o IndexedDB svuotato dopo lo spostamento: il primo salvataggio scrive il segno (R1.4)
if(ARCH&&!DB.meta.archivio){DB.meta.archivio={da:ARCH.da||'nuovo',il:new Date().toISOString(),versione:'24b'};persist();}
const salvataggioInErrore=()=>!!(ARCH&&ARCH.errore)||LS_FERMO; // R2.2: synced non avanza su dati mai salvati sul telefono
const D=()=>DB.data;
const progetti=(all)=>Object.values(D().progetti).filter(p=>all||!p.deleted).sort((a,b)=>(a.ordine??0)-(b.ordine??0)||a.nome.localeCompare(b.nome));
const prog=id=>D().progetti[id];
const eventiTutti=()=>Object.values(D().eventi).filter(e=>!e.deleted);
const eventi=()=>eventiTutti().filter(e=>e.stato!=='previsto');
const eventiDel=(fn,tutti)=>(tutti?eventiTutti():eventi()).filter(fn).sort((a,b)=>(a.data+(a.ora||'')+a.created).localeCompare(b.data+(b.ora||'')+b.created));

function changed(){DB.meta.seq++;persist();scheduleSync(2500);}
function markExport(keys){for(const k of keys)if(k)DB.meta.queue[k]=Date.now();}
const exportKeysOf=e=>{if(!e)return [];const y=e.data.slice(0,4),k=[];const cu=prog(e.pid)?.modello?.tipo==='custom';if(cu)k.push(`cust|${e.pid}|${y}`);else if(e.rimborso||(e.spese||[]).length)k.push(`rimb|${e.pid}|${y}`);if(e.ore)k.push(`ore|${y}`);return k;};

function nuovoProgetto(o={}){
  const n=progetti(true).length;const used=new Set(progetti().map(p=>p.colore));
  return Object.assign({id:uid(),nome:'',colore:COLORI.find(c=>!used.has(c))||COLORI[n%COLORI.length],ordine:n,cartella:null,parent:null,
    rimborso:{attivo:true,origine:'',tariffa:'',tariffaData:'',occasione:'',mansione:'',squadra:'',assoc:{riga1:'Spett.le',nome:'',nomeBig:'',via:'',citta:'',cf:''},luoghi:[],logo:null},
    ore:{attivo:false,tariffa:'',ritenuta:20,fasce:[]},
    def:{tipo:'allenamento'},updatedAt:Date.now()},o);
}

// ---------------- calcoli ----------------
const oreFasce=f=>r2((f||[]).reduce((s,x)=>{const a=min(x.da),b=min(x.a);return s+(a!=null&&b!=null&&b>a?(b-a)/60:0);},0));
const oreOf=e=>e.oreMan!=null&&e.oreMan!==''?+e.oreMan:oreFasce(e.fasce);
const isFisso=e=>e.fisso!=null&&e.fisso!=='';
function soldiOre(e){
  if(!e.ore)return {ore:0,lordo:0,rit:0,netto:0};
  const p=prog(e.pid);const tar=e.tariffa??p?.ore.tariffa??0, rp=e.rit??p?.ore.ritenuta??20;
  const ore=isFisso(e)?0:oreOf(e);
  const lordo=isFisso(e)?r2(e.fisso):r2(ore*tar);
  const rit=r2(lordo*rp/100);
  return {ore,lordo,rit,netto:r2(lordo-rit),tar,rp};
}
const kmOf=e=>e.rimborso?(+e.km||0):0;
function motivo(e){
  const p=prog(e.pid);const sq=e.squadra||p?.rimborso.squadra||'';
  if(e.tipo==='allenamento')return `Allenamento${sq?' '+sq:''}`;
  if(e.tipo==='partita')return `Partita${sq?' '+sq:''}${e.titolo?' vs '+e.titolo:''}`;
  if(e.tipo==='amichevole')return e.titolo?`Amichevole con ${e.titolo}`:`Amichevole${sq?' '+sq:''}`;
  return e.titolo||TIPI[e.tipo]||'';
}
const etichetta=e=>e.tipo==='allenamento'?motivo(e):(e.titolo?`${TIPI[e.tipo]}: ${e.titolo}`:TIPI[e.tipo]);
const meseKey=(pid,ym)=>`${pid}|${ym}`;
function meseExtra(pid,ym){const p=prog(pid);return Object.assign({pedaggi:0,altro:0,altroDesc:'',pernN:'',pernEur:0,pastiN:'',pastiEur:0,allegati:'',dataFirma:'',tariffa:p.rimborso.tariffa,tariffaData:p.rimborso.tariffaData},D().mesi[meseKey(pid,ym)]||{});}
let docData; // v21: versione originale tolta (non usata); definita in plus.js
function riepilogo(prefix){ // prefix: 'YYYY-MM' o 'YYYY'
  const per={};const tot={km:0,rimb:0,ore:0,lordo:0,rit:0,netto:0,n:0};
  for(const p of progetti())per[p.id]={p,km:0,rimb:0,ore:0,lordo:0,rit:0,netto:0,n:0};
  const mesi=new Set();
  for(const e of eventi()){if(!e.data.startsWith(prefix)||!per[e.pid])continue;const t=per[e.pid];t.n++;
    const s=soldiOre(e);t.ore+=s.ore;t.lordo+=s.lordo;t.rit+=s.rit;t.netto+=s.netto;
    if(e.rimborso&&kmOf(e)>0)t.km+=kmOf(e);if((e.rimborso&&kmOf(e)>0)||(e.spese||[]).length)mesi.add(e.pid+'|'+e.data.slice(0,7));}
  for(const k of mesi){const [pid,ym]=k.split('|');per[pid].rimb+=docData(pid,ym).tot;}
  for(const t of Object.values(per)){for(const k of ['km','rimb','ore','lordo','rit','netto']){t[k]=r2(t[k]);tot[k]=r2(tot[k]+t[k]);}tot.n+=t.n;}
  return {per,tot};
}

// ---------------- unione dati (vince la modifica più recente) ----------------
function mergeMap(a,b){const o={};for(const k of new Set([...Object.keys(a||{}),...Object.keys(b||{})])){const x=a?.[k],y=b?.[k];o[k]=!x?y:!y?x:((y.updatedAt||0)>(x.updatedAt||0)?y:x);}return o;}
function mergeStorico(a,b){const m={};for(const x of [...(a||[]),...(b||[])])m[x.id]=x;return Object.values(m).sort((x,y)=>x.t-y.t).slice(-400);}
function mergeData(a,b){
  if(!b)return a;
  return {v:1,profilo:(b.profilo?.updatedAt||0)>(a.profilo?.updatedAt||0)?b.profilo:a.profilo,
    pagamenti:mergeMap(a.pagamenti,b.pagamenti),impost:(b.impost?.updatedAt||0)>(a.impost?.updatedAt||0)?b.impost:(a.impost||b.impost),
    progetti:mergeMap(a.progetti,b.progetti),eventi:mergeMap(a.eventi,b.eventi),mesi:mergeMap(a.mesi,b.mesi),files:mergeMap(a.files,b.files),
    cu:mergeMap(a.cu,b.cu),storico:mergeStorico(a.storico,b.storico),
    root:(b.root?.updatedAt||0)>(a.root?.updatedAt||0)?b.root:a.root};
}
const canon=o=>JSON.stringify(o,(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.keys(v).sort().reduce((r,x)=>(r[x]=v[x],r),{}):v);

// ================= Google: accesso =================
let TOK=(()=>{try{return JSON.parse(localStorage.getItem('soldirini-tok')||'null');}catch(e){return null;}})();
let tokenClient=null,tokWait=null;
const loadScript=src=>new Promise((res,rej)=>{if(document.querySelector(`script[src="${src}"]`)){const t=setInterval(()=>{if(src.includes('gsi')?window.google?.accounts?.oauth2:window.gapi){clearInterval(t);res();}},50);setTimeout(()=>{clearInterval(t);rej(new Error('caricamento'))},15000);return;}
  const s=document.createElement('script');s.src=src;s.async=true;s.onload=res;s.onerror=()=>{s.remove();rej(new Error('Non riesco a caricare '+src));};document.head.appendChild(s);});
function gisReady(){return !!window.google?.accounts?.oauth2;}
async function prepGis(){if(!navigator.onLine)return;try{await loadScript('https://accounts.google.com/gsi/client');initTokenClient();}catch(e){}}
function initTokenClient(){
  if(tokenClient||!gisReady())return;
  tokenClient=google.accounts.oauth2.initTokenClient({client_id:CFG.CLIENT_ID,scope:CFG.SCOPE,
    callback:r=>{if(r.error){tokWait?.rej(new Error(r.error_description||r.error));tokWait=null;return;}
      TOK={access:r.access_token,exp:Date.now()+(+r.expires_in||3600)*1000,scope:r.scope};try{localStorage.setItem('soldirini-tok',JSON.stringify(TOK));}catch(e){}
      tokWait?.res(TOK.access);tokWait=null;},
    error_callback:err=>{tokWait?.rej(new Error(err.type==='popup_closed'?'Accesso annullato.':err.type==='popup_failed_to_open'?'Il browser ha bloccato la finestra di accesso.':(err.message||err.type)));tokWait=null;}});
}
const tokenOk=()=>TOK&&TOK.access&&TOK.exp>Date.now()+60000;
// interactive=true solo da un tocco dell'utente (apre la finestra di Google)
function getToken(interactive){
  if(tokenOk())return Promise.resolve(TOK.access);
  if(!interactive)return Promise.resolve(null);
  if(!tokenClient){initTokenClient();if(!tokenClient)return Promise.reject(new Error(navigator.onLine?'Google non è ancora pronto, riprova tra un attimo.':'Serve la connessione per accedere.'));}
  return new Promise((res,rej)=>{tokWait={res,rej};
    tokenClient.requestAccessToken({prompt:DB.meta.account?'':'consent',login_hint:DB.meta.account?.email||undefined});});
}
async function login(){
  try{
    await getToken(true);
    const me=await gfetch('GET',`${DRIVE}/about?fields=user(displayName,emailAddress,photoLink)`);
    const prev=DB.meta.account?.email;
    if(prev&&prev!==me.user.emailAddress){
      if(!confirm(`Prima eri collegato come ${prev}. Vuoi passare a ${me.user.emailAddress}? I dati sul telefono verranno sostituiti con quelli del nuovo account.`)){TOK=null;return;}
      if(!await confermaFileInAttesa()){TOK=null;return;}
      if(ARCH)ARCH.blocca();DB.data=emptyData();DB.meta.dataId=null;DB.meta.queue={};DB.meta.gen=0;DB.meta.drivePausa=null;DB.meta.sostituzione=null;
      await togliDatiVecchi(); // v24b (R3.4, D-087 1b): anche la vecchia copia e buste/cedolini in attesa del vecchio account
      if(ARCH)await ARCH.nuovaEpoca(); // v24c (V10)
    }
    DB.meta.account={email:me.user.emailAddress,name:me.user.displayName,photo:me.user.photoLink};persist();
    toast('Accesso fatto: '+me.user.emailAddress);
    await sync(true);
  }catch(e){toast(errMsg(e),'err');}
  render();
}
async function logout(){
  if(!confirm('Vuoi uscire da questo account? I dati salvati su Drive restano lì.'))return;
  if(DB.meta.seq>DB.meta.synced&&!confirm('Ci sono modifiche non ancora salvate su Drive. Uscendo le perdi. Continuo?'))return;
  try{if(TOK?.access&&window.google?.accounts?.oauth2)google.accounts.oauth2.revoke(TOK.access,()=>{});}catch(e){}
  if(!await confermaFileInAttesa())return;
  TOK=null;localStorage.removeItem('soldirini-tok');
  // v24b (R3.4, R3.6, D-087 1b): dati in IndexedDB, vecchia copia soldirini-v1, token e soldirini-file; le altre app non si toccano
  const segno=DB.meta.archivio;if(ARCH)ARCH.blocca(); // v24c (V10): niente unione con un'altra scheda fino alla scrittura con l'epoca nuova
  DB={data:emptyData(),meta:{dataId:null,seq:0,synced:0,lastSync:0,queue:{},account:null,skipWelcome:true,archivio:segno}};persist();
  // v24c (V10): scrittura senza unione con un'epoca nuova, così un'altra scheda aperta non rimette i dati
  await togliDatiVecchi();if(ARCH){await ARCH.nuovaEpoca();ARCH.esci();}render();
}
// v24b: buste paga e cedolini caricati sul telefono e non ancora su Drive (restano in soldirini-file)
const fileInAttesa=()=>['buste','cedolini'].reduce((n,k)=>n+Object.values(D()[k]||{}).filter(x=>x&&x.daCaricare&&!x.deleted).length,0);
// 24b.1 (02, tornata 22 A2): finestra al posto della domanda del navigatore; toccare fuori = "Resta collegato".
// "…finché il caricamento non è finito": la scritta "Sincronizzato" può comparire anche con una busta non caricata (errore saltato)
async function confermaFileInAttesa(){const n=fileInAttesa();if(!n)return true;const uno=n===1;
  const html=`<b class="dlgt">${uno?'1 busta paga o cedolino non è ancora su Google Drive':n+' buste paga o cedolini non sono ancora su Google Drive'}</b>`
    +`<span class="dlgp">${uno?'Se esci ora, viene cancellato da questo telefono e non lo ritrovi più.':'Se esci ora, vengono cancellati da questo telefono e non li ritrovi più.'}</span>`
    +`<span class="dlgp">${uno?'Per non perderlo':'Per non perderli'}, resta collegato finché il caricamento non è finito, poi esci.</span>`;
  const m=$('dlg'),fuori=e=>{if(e.target===m){const b=$('dlgBtns').querySelector('[data-i="0"]');if(b)b.click();}};m.addEventListener('click',fuori);
  try{return await ask(html,[{t:'Resta collegato',v:false,cls:'ghost'},{t:'Esci e cancella',v:true,cls:'danger'}],true);}finally{m.removeEventListener('click',fuori);}}
async function togliDatiVecchi(){
  try{localStorage.removeItem(STORE);}catch(e){}
  if(window.Archivio){Archivio.togliVecchia();await Archivio.svuotaFile();if(Archivio.togliParte)await Archivio.togliParte();} // v24c (V9): anche i dati messi da parte
  else await new Promise(ok=>{try{const r=indexedDB.open('soldirini-file',1);r.onupgradeneeded=()=>r.result.createObjectStore('f');r.onsuccess=()=>{const d=r.result;const t=d.transaction('f','readwrite');t.objectStore('f').clear();t.oncomplete=t.onabort=()=>{d.close();ok();};};r.onerror=()=>ok();}catch(e){ok();}});
}
const errMsg=e=>(e&&e.message)||String(e);

// ================= Google Drive =================
const DRIVE='https://www.googleapis.com/drive/v3',UPLOAD='https://www.googleapis.com/upload/drive/v3',SHEETS_MIME='application/vnd.google-apps.spreadsheet',FOLDER_MIME='application/vnd.google-apps.folder';
const XLSX_MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
class AuthErr extends Error{}
// v20: tempo massimo di attesa delle risposte di Google (millisecondi). Senza limite una richiesta "appesa" bloccava la sincronizzazione.
const TEMPI={richiesta:30000,caricamento:120000,verifica:1500};
class TempoErr extends Error{}
// fetch con tempo massimo: se Google non risponde in tempo la richiesta viene interrotta
async function fetchTempo(url,opt,ms,chi){
  const ac=new AbortController();const tm=setTimeout(()=>ac.abort(),ms);
  try{return await fetch(url,Object.assign({},opt,{signal:ac.signal}));}
  catch(e){if(ac.signal.aborted)throw new TempoErr(`${chi||'Google'} non risponde: riprova più tardi.`);throw e;}
  finally{clearTimeout(tm);}
}
async function gfetch(method,url,{json,body,headers,raw}={}){
  const t=await getToken(false);if(!t)throw new AuthErr('Accedi con Google per sincronizzare.');
  const h=Object.assign({Authorization:'Bearer '+t},headers||{});
  if(json!==undefined){h['Content-Type']='application/json';body=JSON.stringify(json);}
  const r=await fetchTempo(url,{method,headers:h,body},url.startsWith(UPLOAD)?TEMPI.caricamento:TEMPI.richiesta,'Google Drive');
  if(r.status===401){TOK=null;localStorage.removeItem('soldirini-tok');throw new AuthErr('Accesso scaduto: tocca "Sincronizza" per riconnetterti.');}
  if(!r.ok){let m='';try{const j=await r.json();m=j.error?.message||'';}catch(e){}const err=new Error(`Google Drive (${r.status}): ${m||r.statusText}`);err.status=r.status;throw err;}
  if(raw)return r;
  const ct=r.headers.get('content-type')||'';return ct.includes('json')?r.json():r.text();
}
function multipart(meta,data,mime){
  const b='soldirini'+Math.random().toString(36).slice(2);
  const body=new Blob([`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: ${mime}\r\n\r\n`,data,`\r\n--${b}--`]);
  return {body,headers:{'Content-Type':'multipart/related; boundary='+b}};
}
const F='id,name,webViewLink,parents';
const createFolder=(name,parent,props)=>gfetch('POST',`${DRIVE}/files?fields=${F}`,{json:{name,mimeType:FOLDER_MIME,parents:[parent||'root'],appProperties:props}});
async function uploadNew(meta,data,mime){const m=multipart(meta,data,mime);return gfetch('POST',`${UPLOAD}/files?uploadType=multipart&fields=${F}`,m);}
async function uploadUpdate(id,meta,data,mime,campi=F){const m=multipart(meta,data,mime);return gfetch('PATCH',`${UPLOAD}/files/${id}?uploadType=multipart&fields=${campi}`,m);}
const trash=id=>gfetch('PATCH',`${DRIVE}/files/${id}?fields=id`,{json:{trashed:true}}).catch(()=>{});
const getMeta=id=>gfetch('GET',`${DRIVE}/files/${id}?fields=${F},trashed`);
async function exists(id){if(!id)return false;try{const m=await getMeta(id);return !m.trashed;}catch(e){if(e.status===404)return false;throw e;}}

// Picker (scegli una cartella del tuo Drive)
async function pickFolder(title){
  const t=await getToken(true);
  await loadScript('https://apis.google.com/js/api.js');
  await new Promise((res,rej)=>gapi.load('picker',{callback:res,onerror:rej}));
  return new Promise(res=>{
    const view=new google.picker.DocsView(google.picker.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true).setMimeTypes(FOLDER_MIME).setParent('root');
    const shared=new google.picker.DocsView(google.picker.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true).setMimeTypes(FOLDER_MIME).setEnableDrives(true);
    new google.picker.PickerBuilder().addView(view).addView(shared).setOAuthToken(t).setDeveloperKey(CFG.API_KEY).setAppId(CFG.APP_ID)
      .setTitle(title||'Scegli una cartella').setLocale('it').setOrigin(location.origin)
      .setCallback(d=>{if(d.action===google.picker.Action.PICKED){const x=d.docs[0];res({id:x.id,nome:x.name});}else if(d.action===google.picker.Action.CANCEL)res(null);})
      .build().setVisible(true);
  });
}

// ================= Sincronizzazione =================
let syncing=false,syncTimer=null,lastErr='',needLogin=false;
// 24c.1 (V13): vero mentre "Sostituisci tutto" / "Rimetti" preparano la sostituzione; nessuna sincronizzazione parte in quel tempo
let syncFermo=false;
// v20: il file dati su Drive non si legge → non lo tocco e fermo la sincronizzazione finché non torna leggibile
let datiIllegibili=false;
class IllegErr extends Error{}
const MSG_ILLEGGIBILE='Il file dei dati su Drive (“Soldirini - dati (non cancellare).json”) non si legge. Non l’ho toccato: i tuoi dati restano su questo telefono. Su Drive ripristina una versione precedente del file dalla sua cronologia delle versioni (nella cartella “Copie di sicurezza” trovi anche le copie mensili), poi tocca la scritta in alto per riprovare.';
function leggiDati(testo){
  let o;try{o=JSON.parse(testo);}catch(e){o=undefined;}
  if(!o||typeof o!=='object'||Array.isArray(o))throw new IllegErr(MSG_ILLEGGIBILE);
  return o;
}
const DATA_Q="appProperties has { key='soldirini' and value='dati' } and trashed=false";
function scheduleSync(ms){clearTimeout(syncTimer);syncTimer=setTimeout(()=>sync(false),ms??1500);renderSync();}
const pendingCount=()=>(DB.meta.seq>DB.meta.synced?1:0)+Object.keys(DB.meta.queue).length;
// v21: tutti i file dati, dal più vecchio. Se ce n'è più di uno (es. due telefoni al primo avvio) tutti i dispositivi scelgono lo stesso: il più vecchio.
async function fileDati(){
  const r=await gfetch('GET',`${DRIVE}/files?q=${encodeURIComponent(DATA_Q)}&fields=files(id,name,createdTime)&spaces=drive&pageSize=50`);
  return (r.files||[]).sort((a,b)=>(a.createdTime||'').localeCompare(b.createdTime||'')||a.id.localeCompare(b.id));
}
async function findDataFile(){return (await fileDati())[0]||null;}
// v21: controllo di versione. Drive v3 non permette di scrivere "solo se il file non è cambiato" (niente ETag),
// quindi si confronta il numero di revisione del contenuto (headRevisionId) prima e dopo la scrittura.
const revisione=id=>gfetch('GET',`${DRIVE}/files/${id}?fields=headRevisionId`).then(m=>m.headRevisionId||'');
const MSG_CAMBIA='Il file dei dati su Drive viene modificato da un altro dispositivo proprio adesso: riprovo tra poco.';
// v24c (D-097 punto 2, V11-V14 di 03): "generazione" del file dati nelle sue proprietà private (appProperties soldirini_gen,
// soldirini_gen_il). Cresce di 1 a ogni "Sostituisci tutto" / "Rimetti". Un telefono che trova una generazione più alta della
// sua non unisce e non scrive: chiede (domanda 23 di 02) e intanto Drive è in pausa. Le versioni vecchie non toccano queste proprietà.
const metaDati=id=>gfetch('GET',`${DRIVE}/files/${id}?fields=headRevisionId,appProperties`);
const genDi=m=>{const g=parseInt(m&&m.appProperties&&m.appProperties.soldirini_gen,10);return Number.isFinite(g)&&g>0?g:0;};
const genIl=m=>{const d=m&&m.appProperties&&m.appProperties.soldirini_gen_il;return typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)?d:'';};
class PausaErr extends Error{}
const datiPieni=d=>!!d&&['eventi','progetti','lavori','fissi','spesePers','buste','cedolini','turni'].some(k=>Object.values(d[k]||{}).some(v=>v&&typeof v==='object'&&!v.deleted));
// scrive il file dati senza unione, con la generazione nuova; restituisce false se il file è cambiato nel frattempo
async function scriviGenerazione(id,rev,gen){
  if(await revisione(id)!==rev)return false;
  await uploadUpdate(id,{appProperties:{soldirini:'dati',soldirini_gen:String(gen),soldirini_gen_il:today()}},canon(D()),'application/json','id,headRevisionId');
  DB.meta.gen=gen;persist();return true;
}
async function salvaDati(){
  const id=DB.meta.dataId;
  for(let giro=1;giro<=4;giro++){
    const m=await metaDati(id),rev=m.headRevisionId||'',gen=genDi(m);
    const remote=leggiDati(await gfetch('GET',`${DRIVE}/files/${id}?alt=media`,{raw:true}).then(r=>r.text()));
    datiIllegibili=false;
    // V12: controllo a ogni giro, subito prima dell'unione
    if(gen>(DB.meta.gen||0)){
      if(!datiPieni(D())){if(ARCH)ARCH.blocca();DB.data=remote;DB.meta.gen=gen;if(ARCH)await ARCH.nuovaEpoca();else persist();return;} // telefono senza dati: prende Drive senza chiedere
      DB.meta.drivePausa={gen,il:genIl(m)};persist();throw new PausaErr('Drive in pausa');
    }
    const merged=mergeData(D(),remote);DB.data=merged;persist();
    if(canon(merged)===canon(remote))return;
    if(await revisione(id)!==rev)continue;                       // cambiato mentre leggevo: rileggo e riunisco
    const scritto=await uploadUpdate(id,{},canon(merged),'application/json','id,headRevisionId');
    if(!scritto.headRevisionId||await revisione(id)===scritto.headRevisionId){verificaDopo(id,scritto.headRevisionId);return;}   // l'ultima scrittura è la mia
    // un altro dispositivo ha scritto subito dopo di me: rileggo, riunisco e riscrivo
  }
  throw new Error(MSG_CAMBIA);
}
// v21: poco dopo aver scritto ricontrollo una volta, senza bloccare l'app: se un altro dispositivo ha scritto
// mentre la mia scrittura era in viaggio, la sua copre la mia; me ne accorgo qui e risincronizzo (unendo di nuovo).
let verificaTimer=null;
function verificaDopo(id,mia){
  clearTimeout(verificaTimer);if(!mia)return;
  verificaTimer=setTimeout(async()=>{verificaTimer=null;
    try{if(DB.meta.dataId===id&&tokenOk()&&navigator.onLine&&await revisione(id)!==mia)scheduleSync(0);}catch(e){console.warn('Verifica dopo la scrittura non riuscita',e);}
  },TEMPI.verifica);
}
// v24c (V13): copia del file dati com'è adesso nella cartella "Copie di sicurezza" (contenuto copiato, senza le proprietà del file dati)
async function copiaDatiSuDrive(id,nome){
  let dir=DB.meta.backupDir;
  if(!(dir&&await exists(dir))){const f=await createFolder('Copie di sicurezza',D().root.id,{soldirini:'backup'});dir=f.id;DB.meta.backupDir=dir;}
  const testo=await gfetch('GET',`${DRIVE}/files/${id}?alt=media`,{raw:true}).then(r=>r.text());
  const f=await uploadNew({name:`${nome} ${today()}.json`,parents:[dir]},new Blob([testo],{type:'application/json'}),'application/json');
  if(!f||!f.id)throw new Error('Copia su Drive non riuscita.');
}
// v24c (V13, V15): "Sostituisci tutto" / "Rimetti" verso Drive, senza unione. Prima una copia del file su Drive (se è cambiato
// dopo quella fatta al momento della sostituzione); le voci che su Drive ci sono e qui no restano come cancellate
// (domanda 1 di 03, consiglio), così una versione vecchia o un ritardo non le rimette.
async function inviaSostituzione(id){
  for(let giro=1;giro<=3;giro++){
    const S=DB.meta.sostituzione;if(!S)return;
    const m=await metaDati(id),rev=m.headRevisionId||'';
    if(!(S.copiata&&S.rev===rev))await copiaDatiSuDrive(id,'Soldirini copia prima della ripresa');
    const remote=leggiDati(await gfetch('GET',`${DRIVE}/files/${id}?alt=media`,{raw:true}).then(r=>r.text()));
    if(window.Copia)DB.data=Copia.conCancellate(D(),remote);
    if(await scriviGenerazione(id,rev,Math.max(genDi(m),DB.meta.gen||0)+1)){DB.meta.sostituzione=null;DB.meta.drivePausa=null;persist();return;}
    DB.meta.sostituzione={copiata:false};persist();
  }
  throw new Error(MSG_CAMBIA);
}
// v21: unisce i file dati in più dentro quello principale e li mette da parte (rinominati, non cancellati)
async function unisciFileDati(altri){
  const fatti=[];
  for(const f of altri){
    let dati;try{dati=leggiDati(await gfetch('GET',`${DRIVE}/files/${f.id}?alt=media`,{raw:true}).then(r=>r.text()));}
    catch(e){if(e instanceof IllegErr){console.warn('File dati in più illeggibile, lasciato com\u2019è:',f.id);continue;}throw e;}
    DB.data=mergeData(D(),dati);persist();fatti.push(f);
  }
  return fatti;
}
// il file esiste, non è nel cestino ed è ancora un file dati (non uno già messo da parte)
async function fileDatiValido(id){try{const m=await gfetch('GET',`${DRIVE}/files/${id}?fields=trashed,appProperties`);return !m.trashed&&m.appProperties?.soldirini==='dati';}catch(e){if(e.status===404)return false;throw e;}}
const metteDaParte=f=>gfetch('PATCH',`${DRIVE}/files/${f.id}?fields=id`,{json:{name:'Soldirini - dati (unito, si può eliminare).json',appProperties:{soldirini:'dati-unito'}}});
async function sync(interactive){
  if(syncing){return;}
  if(syncFermo){scheduleSync(1500);return;}
  if(!DB.meta.account){renderSync();return;}
  if(!navigator.onLine){renderSync();return;}
  if(!tokenOk()){
    if(!interactive){needLogin=true;renderSync();return;}
    try{await getToken(true);}catch(e){toast(errMsg(e),'err');renderSync();return;}
  }
  if(DB.meta.drivePausa){renderSync();if(window.Copia)Copia.domandaPausa(false);return;} // v24c (decisione 1 di 02): niente sincronizzazione finché non si risponde
  needLogin=false;syncing=true;renderSync();
  try{
    // v21: elenco dei file dati a ogni sincronizzazione (per trovare i doppioni). La ricerca di Drive può non vedere subito
    // un file appena creato: in quel caso tengo quello che conosco già, se esiste ancora.
    const L=await fileDati();
    if(DB.meta.dataId&&!L.some(f=>f.id===DB.meta.dataId)){if(await fileDatiValido(DB.meta.dataId))L.push({id:DB.meta.dataId,createdTime:'9'});else DB.meta.dataId=null;}
    const altri=L.slice(1);
    if(L.length)DB.meta.dataId=L[0].id;
    if(!DB.meta.dataId){
      if(D().root?.id&&await exists(D().root.id)){
        const nf=await uploadNew({name:'Soldirini - dati (non cancellare).json',parents:[D().root.id],mimeType:'application/json',appProperties:{soldirini:'dati'}},canon(D()),'application/json');
        DB.meta.dataId=nf.id;
      } else {syncing=false;showSetup=true;render();return;}
    }
    const seq0=DB.meta.seq;
    if(DB.meta.sostituzione)await inviaSostituzione(DB.meta.dataId); // v24c (V13): prima la sostituzione da inviare, mai un'unione normale
    const uniti=altri.length?await unisciFileDati(altri):[];
    // v20: se il file non si legge salvaDati si ferma prima di qualsiasi scrittura (prima veniva sovrascritto con i soli dati del telefono)
    // eventi arrivati da altri dispositivi: niente da esportare qui (lo fa chi li ha creati)
    await salvaDati();
    for(const f of uniti)await metteDaParte(f);
    if(DB.meta.seq===seq0&&!salvataggioInErrore())DB.meta.synced=seq0;
    await processQueue();
    DB.meta.lastSync=Date.now();lastErr='';persist();
  }catch(e){if(e instanceof PausaErr){lastErr='';syncing=false;renderSync();if(window.Copia)Copia.domandaPausa(true);return;}
    lastErr=errMsg(e);if(e instanceof AuthErr)needLogin=true;
    if(e instanceof IllegErr){if((!datiIllegibili||interactive)&&typeof ask==='function')ask(MSG_ILLEGGIBILE,[{t:'Ho capito',v:true}]);datiIllegibili=true;}
    console.warn(e);}
  finally{syncing=false;render();if(DB.meta.seq>DB.meta.synced&&!lastErr)scheduleSync(1500);}
}

// --- cartella principale (primo accesso) ---
let showSetup=false;
async function setupRoot(where){
  try{
    await getToken(true);
    let parent='root',pnome='Il mio Drive';
    if(where==='scegli'){const f=await pickFolder('Dove creo la cartella Soldirini?');if(!f)return;parent=f.id;pnome=f.nome;}
    toast('Creo la cartella Soldirini…');
    const f=await createFolder('Soldirini',parent,{soldirini:'root'});
    D().root={id:f.id,nome:'Soldirini',dove:pnome,link:f.webViewLink,updatedAt:Date.now()};
    const nf=await uploadNew({name:'Soldirini - dati (non cancellare).json',parents:[f.id],mimeType:'application/json',appProperties:{soldirini:'dati'}},canon(D()),'application/json');
    DB.meta.dataId=nf.id;showSetup=false;
    for(const p of progetti())if(!p.cartella)DB.meta.queue['folder|'+p.id]=Date.now();
    changed();toast('Cartella creata in '+pnome);await sync(false);
  }catch(e){toast(errMsg(e),'err');}
  render();
}

// --- coda: cartelle dei progetti e Fogli Google ---
const tplCache={};
async function tpl(name){if(!tplCache[name]){const r=await fetch('tpl/'+name);if(!r.ok)throw new Error('Modello mancante: '+name);tplCache[name]=await r.arrayBuffer();}return tplCache[name].slice(0);}
// v24 (D-049): il file logo-bulldogs.jpg è tolto. Dalla 23b il logo è salvato nei dati del progetto;
// un valore '@bulldogs' rimasto (telefono mai aggiornato alla 23b) vale "nessun logo", senza errori.
async function logoSrc(p){const l=p&&p.rimborso&&p.rimborso.logo;return imgOk(l)||null;} // v24c (V7): solo immagini vere
async function ensureFolder(p){
  if(p.cartella?.id&&await exists(p.cartella.id))return p.cartella.id;
  const parent=p.parent?.id||D().root?.id;if(!parent)throw new Error('Manca la cartella Soldirini.');
  const f=await createFolder(p.nome,parent,{soldirini:'progetto',pid:p.id});
  p.cartella={id:f.id,nome:f.name,link:f.webViewLink};p.updatedAt=Date.now();changed();
  return f.id;
}
// salva un Foglio Google: aggiorna quello esistente, altrimenti ne crea uno nuovo
async function saveSheet(fileKey,slot,name,parent,bytes){
  const rec=D().files[fileKey]||{};
  const old=rec[slot];
  const blob=new Blob([bytes],{type:XLSX_MIME});
  let f=null;
  if(old?.id&&await exists(old.id)){
    try{f=await uploadUpdate(old.id,{name},blob,XLSX_MIME);}catch(e){console.warn('aggiornamento non riuscito, ne creo uno nuovo',e);f=null;}
    if(!f){f=await uploadNew({name,parents:[parent],mimeType:SHEETS_MIME},blob,XLSX_MIME);await trash(old.id);}
  } else f=await uploadNew({name,parents:[parent],mimeType:SHEETS_MIME},blob,XLSX_MIME);
  D().files[fileKey]=Object.assign({},D().files[fileKey],{[slot]:{id:f.id,link:f.webViewLink,name},updatedAt:Date.now()});
  DB.meta.seq++;persist();
}
let exportRimborsi; // v21: versione originale tolta (non usata); definita in plus.js
function oreMesi(year){
  const yms=[...new Set(eventi().filter(e=>e.ore&&e.data.startsWith(year)&&prog(e.pid)&&!prog(e.pid).deleted).map(e=>e.data.slice(0,7)))].sort();
  return yms.map(ym=>{
    const ev=eventiDel(e=>e.ore&&e.data.startsWith(ym)&&prog(e.pid)&&!prog(e.pid).deleted);
    const righe=ev.map(e=>{const s=soldiOre(e);return {data:e.data,progetto:prog(e.pid).nome,attivita:etichetta(e),fasce:isFisso(e)?[]:(e.fasce||[]),ore:s.ore,tariffa:s.tar,lordo:s.lordo,fisso:isFisso(e),rit:s.rp};});
    const per={};for(const e of ev){const n=prog(e.pid).nome,s=soldiOre(e),t=per[n]||(per[n]={nome:n,ore:0,lordo:0,rit:0,netto:0});t.ore=r2(t.ore+s.ore);t.lordo=r2(t.lordo+s.lordo);t.rit=r2(t.rit+s.rit);t.netto=r2(t.netto+s.netto);}
    return {ym,righe,progetti:Object.values(per)};
  });
}
const intestazione=()=>{const pr=D().profilo;return [pr.nome,pr.cognome].filter(Boolean).join(' ');};
async function exportOre(year){
  const mesi=oreMesi(year);if(!mesi.length)return;
  if(!D().root?.id)throw new Error('Manca la cartella Soldirini.');
  const bytes=await MODELLI.ore(await tpl('ore.xlsx'),year,mesi,intestazione());
  await saveSheet(`ore|${year}`,'ore',`Ritenuta d'acconto ${year}`,D().root.id,bytes);
}
let queueBusy='';
// v20: coda che non si blocca. Un elemento in errore viene saltato e ritentato dopo 1, 5, poi 15 minuti; gli altri proseguono.
// I tentativi sono tenuti solo in memoria (non nei dati salvati): riaprendo l'app si riprova subito.
const codaAttesa={};let codaTimer=null;
const ATTESE=[60000,300000,900000];
const codaBloccante=e=>e instanceof AuthErr||e instanceof TempoErr||e instanceof IllegErr||!navigator.onLine;
function codaRitenta(){
  clearTimeout(codaTimer);codaTimer=null;
  const t=Math.min(...Object.values(codaAttesa).map(a=>a.dopo));if(!isFinite(t))return;
  codaTimer=setTimeout(()=>{codaTimer=null;scheduleSync(0);},Math.max(1000,t-Date.now()));
}
// esegue un passo della coda; false se è stato saltato o è fallito (resta in attesa)
async function codaPasso(k,fn){
  const a=codaAttesa[k];if(a&&a.dopo>Date.now())return false;
  try{await fn();delete codaAttesa[k];codaRitenta();return true;}
  catch(e){if(codaBloccante(e))throw e;
    const n=(a?.n||0)+1;codaAttesa[k]={n,dopo:Date.now()+ATTESE[Math.min(n,ATTESE.length)-1],err:errMsg(e)};
    console.warn('In attesa:',k,e);codaRitenta();renderSync();return false;}
}
const inAttesa=()=>Object.keys(codaAttesa).length;
async function processQueue(){
  const keys=Object.keys(DB.meta.queue).sort((a,b)=>(a.startsWith('folder')?0:1)-(b.startsWith('folder')?0:1));
  for(const k of keys){
    const ts=DB.meta.queue[k];if(ts===undefined)continue;const [kind,a,b]=k.split('|');
    queueBusy=kind==='cust'?`Foglio ${prog(a)?.nome||''} ${b}`:kind==='ore'?`Foglio ritenuta ${a}`:kind==='rimb'?`Fogli rimborsi ${prog(a)?.nome||''} ${b}`:`Cartella ${prog(a)?.nome||''}`;renderSync();
    const ok=await codaPasso(k,async()=>{
      if(kind==='folder'){const p=prog(a);if(p&&!p.deleted)await ensureFolder(p);}
      else if(kind==='rimb')await exportRimborsi(a,b);
      else if(kind==='cust')await exportCustom(a,b);
      else if(kind==='ore')await exportOre(a);
    });
    if(ok&&DB.meta.queue[k]===ts)delete DB.meta.queue[k];persist();
  }
  queueBusy='';
  // se ho cambiato file o cartelle, salvo anche i dati (mai sopra un file dati che non si legge)
  if(!datiIllegibili&&DB.meta.seq>DB.meta.synced){const s0=DB.meta.seq;await salvaDati();if(DB.meta.seq===s0&&!salvataggioInErrore())DB.meta.synced=s0;}
}

// ================= PDF =================
function download(bytes,name,type){const blob=new Blob([bytes],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},4000);}
async function uploadPdf(key,name,parent,bytes){
  const rec=D().files[key];const blob=new Blob([bytes],{type:'application/pdf'});let f;
  if(rec?.pdf?.id&&await exists(rec.pdf.id))f=await uploadUpdate(rec.pdf.id,{name},blob,'application/pdf');
  else f=await uploadNew({name,parents:[parent],mimeType:'application/pdf'},blob,'application/pdf');
  D().files[key]={pdf:{id:f.id,link:f.webViewLink,name},updatedAt:Date.now()};changed();
}
let pdfRimborso; // v21: versione originale tolta (non usata); definita in plus.js
function pagineOre(ym){
  const m=oreMesi(ym.slice(0,4)).find(x=>x.ym===ym);if(!m)return [];
  const pr=intestazione();
  const th=t=>`<th style="border:1px solid #1b1c1e;background:#2a2c30;color:#fff;padding:5px 4px;font-size:10.5pt">${t}</th>`;
  const td=(t,al='left',b)=>`<td style="border:1px solid #9aa5a1;padding:4px;text-align:${al};font-size:10pt;${al!=='left'?'white-space:nowrap;':''}${b?'font-weight:700;background:#ecebe8;':''}">${t}</td>`;
  const head=`<tr>${['Data','Progetto','Attività','Orari','Ore','Lordo','Ritenuta','Netto'].map(th).join('')}</tr>`;
  const rows=m.righe.map(r=>{const net=r2(r.lordo-r2(r.lordo*r.rit/100));return `<tr>${td(parseYmd(r.data).toLocaleDateString('it-IT'),'center')}${td(esc(r.progetto))}${td(esc(r.attivita))}${td(r.fisso?'compenso fisso':r.fasce.map(f=>esc(f.da+'–'+f.a)).join('<br>'),'center')}${td(r.fisso?'':nf(r.ore),'center')}${td(eur(r.lordo),'right')}${td(eur(r2(r.lordo*r.rit/100)),'right')}${td(eur(net),'right')}</tr>`;});
  const T=m.progetti.reduce((a,p)=>({ore:a.ore+p.ore,lordo:a.lordo+p.lordo,rit:a.rit+p.rit,netto:a.netto+p.netto}),{ore:0,lordo:0,rit:0,netto:0});
  const tot=`<tr>${td('Totale','left',1)}${td('','left',1)}${td('','left',1)}${td('','left',1)}${td(nf(T.ore),'center',1)}${td(eur(T.lordo),'right',1)}${td(eur(T.rit),'right',1)}${td(eur(T.netto),'right',1)}</tr>`;
  const perP=`<table style="border-collapse:collapse;width:100%;margin-top:18px"><tr>${['Progetto','Ore','Lordo','Ritenuta','Netto'].map(th).join('')}</tr>${m.progetti.map(p=>`<tr>${td(esc(p.nome))}${td(nf(p.ore),'center')}${td(eur(p.lordo),'right')}${td(eur(p.rit),'right')}${td(eur(p.netto),'right')}</tr>`).join('')}<tr>${td('Totale','left',1)}${td(nf(T.ore),'center',1)}${td(eur(T.lordo),'right',1)}${td(eur(T.rit),'right',1)}${td(eur(T.netto),'right',1)}</tr></table>`;
  const titolo=`<div style="font:700 17pt system-ui,Arial;color:#2a2c30">Prospetto ore e ritenuta d'acconto</div><div style="font:12pt system-ui,Arial;margin:4px 0 14px">${esc(pr)} · ${esc(monthName(ym))}</div>`;
  // pagine da ~28 righe
  const per=26,pages=[];
  for(let i=0;i<Math.max(1,rows.length);i+=per){
    const last=i+per>=rows.length;
    const pg=newPage();const box=el('div','position:absolute;left:48px;top:48px;width:698px;font-family:system-ui,Arial,sans-serif;color:#111');
    box.innerHTML=(i===0?titolo:'')+`<table style="border-collapse:collapse;width:100%">${head}${rows.slice(i,i+per).join('')}${last?tot:''}</table>`+(last?perP:'');
    pg.appendChild(box);pages.push(pg);
  }
  return pages;
}
async function pdfOre(ym){
  const pages=pagineOre(ym);if(!pages.length){toast('In questo mese non ci sono ore segnate.','err');return;}
  busy(true,'Preparo il PDF…');
  try{const bytes=await pagesToPdf(pages);const [y,m]=ym.split('-');const name=`Prospetto ore ${m}-${y}.pdf`;download(bytes,name,'application/pdf');
    if(navigator.onLine&&tokenOk()&&D().root?.id){try{await uploadPdf(`pdfore|${ym}`,name,D().root.id,bytes);toast('PDF scaricato e salvato su Drive');}catch(e){toast('PDF scaricato. Su Drive non è andato: '+errMsg(e),'err');}}
    else toast('PDF scaricato');
  }catch(e){toast(errMsg(e),'err');}finally{busy(false);render();}
}

// ================= Interfaccia =================
let cur=today().slice(0,7),tab='cal',selDay=today(),multi=false,selected=new Set(),filtro='';
// v24csp: diagnostica in Impostazioni → Account (testi di 02), visibile solo se c'è stato un blocco
function cspCosa(d){d=d||'';
  if(/^script-src/.test(d))return 'un programma';if(/^connect-src/.test(d))return 'un collegamento a un sito';if(/^img-src/.test(d))return 'un\'immagine';
  if(/^(font-src|style-src)/.test(d))return 'un carattere o uno stile';if(/^(frame-src|child-src)/.test(d))return 'una finestra di un altro sito';
  if(/^worker-src/.test(d))return 'un\'attività in sottofondo';return 'un contenuto';}
function telefonoBreve(){const u=navigator.userAgent||'';
  const nav=(/Edg\/(\d+)/.exec(u)&&'Edge '+/Edg\/(\d+)/.exec(u)[1])||(/SamsungBrowser\/(\d+)/.exec(u)&&'Samsung Internet '+/SamsungBrowser\/(\d+)/.exec(u)[1])
    ||(/(?:Chrome|CriOS)\/(\d+)/.exec(u)&&'Chrome '+/(?:Chrome|CriOS)\/(\d+)/.exec(u)[1])||(/(?:Firefox|FxiOS)\/(\d+)/.exec(u)&&'Firefox '+/(?:Firefox|FxiOS)\/(\d+)/.exec(u)[1])
    ||(/Version\/(\d+)[.\d]* .*Safari/.exec(u)&&'Safari '+/Version\/(\d+)/.exec(u)[1])||'navigatore sconosciuto';
  const so=(/Android (\d+)/.exec(u)&&'Android '+/Android (\d+)/.exec(u)[1])||(/(?:iPhone|CPU) OS (\d+)/.exec(u)&&'iOS '+/OS (\d+)/.exec(u)[1])
    ||(/Windows/.test(u)&&'Windows')||(/Mac OS X/.test(u)&&'macOS')||(/Linux/.test(u)&&'Linux')||'sistema sconosciuto';
  return nav+' · '+so;}
const cspOra=t=>new Date(t).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
function cspTesto(){return [`Soldirini ${typeof APP_VERSIONE!=='undefined'?APP_VERSIONE:''} – blocchi di sicurezza`,
  ...CSP_BLOCCHI.map(b=>`${cspOra(b.ora)} · ${b.dir} · ${b.da}`),...(window.Archivio&&Archivio.modo!=='idb'?[`Archivio: ridotto (${Archivio.motivo||'sconosciuto'})`]:[]),'Telefono: '+telefonoBreve()].join('\n');}
function renderCsp(){
  const b=$('cspBox');if(!b)return;
  if(!cspTotale){b.hidden=true;b.innerHTML='';return;}
  const aperti=!!b.querySelector('details[open]');
  b.hidden=false;
  b.innerHTML=`<p class="csptit"><span aria-hidden="true">⚠</span> Soldirini ha bloccato qualcosa</p>
    <p class="sm">Per proteggere i tuoi dati, da quando hai aperto l'app Soldirini ha impedito ${cspTotale===1?'un caricamento':cspTotale+' caricamenti'} che non riconosce. Di solito non cambia nulla per te.</p>
    <p class="sm"><b>Se una funzione non va</b> (per esempio accesso a Google, lettura di una foto o di un PDF, calcolo dei km), tocca <i>Copia i dettagli</i> e mandali all'autore dell'app: trovi il contatto nell'<a href="privacy.html">informativa privacy</a>.</p>
    <div class="acts"><button type="button" class="btn ghost sm" id="cspCopia">Copia i dettagli</button></div>
    <details class="subfold" ${aperti?'open':''}><summary>Mostra i dettagli</summary>
      <table class="csptab"><thead><tr><th>Ora</th><th>Cosa</th><th>Da dove</th></tr></thead><tbody>
      ${CSP_BLOCCHI.slice(0,10).map(x=>`<tr><td>${cspOra(x.ora)}</td><td>${esc(cspCosa(x.dir))}</td><td>${esc(x.da)}</td></tr>`).join('')}</tbody></table></details>`;
}
document.addEventListener('click',async e=>{if(!e.target.closest('#cspCopia'))return;
  try{await navigator.clipboard.writeText(cspTesto());toast('Dettagli copiati.');}catch(err){toast('Non riesco a copiare i dettagli: tieni premuto su “Mostra i dettagli” e fai una foto della scheda.','err');}});
function toast(msg,kind,ms){const t=$('toast');t.setAttribute('role',kind==='err'?'alert':'status');t.textContent=msg;t.className='toast show'+(kind?' '+kind:'');clearTimeout(toast.t);toast.t=setTimeout(()=>t.className='toast',ms||(kind==='err'?6000:3000));}
// 24b.1: messaggio con un pulsante (per esempio "Annulla"), che resta ms millisecondi
function toastAzione(msg,etichetta,fn,ms){const t=$('toast');t.setAttribute('role','status');t.textContent='';
  const s=document.createElement('span');s.textContent=msg;const b=document.createElement('button');b.type='button';b.className='tbtn';b.textContent=etichetta;
  b.onclick=()=>{clearTimeout(toast.t);t.className='toast';fn();};t.append(s,b);t.className='toast show azione';clearTimeout(toast.t);toast.t=setTimeout(()=>t.className='toast',ms||10000);}
function busy(on,msg){$('busy').hidden=!on;if(msg)$('busyMsg').textContent=msg;}
// accesso fatto ma nessuna cartella Soldirini ancora scelta (né file dati conosciuto)
const cartellaMancante=()=>!!DB.meta.account&&!DB.meta.dataId&&!D().root?.id;
function renderSync(){
  const c=$('sync');if(!c)return;
  let txt,cls;
  if(!DB.meta.account){txt='Accedi';cls='warn';}
  else if(!navigator.onLine){txt='Offline'+(pendingCount()?' · '+pendingCount()+' da inviare':'');cls='off';}
  else if(syncing){txt=queueBusy?'Aggiorno: '+queueBusy:'Sincronizzo…';cls='busy';}
  else if(needLogin){txt='Tocca per riconnettere';cls='warn';}
  else if(DB.meta.drivePausa){txt='Drive in pausa';cls='pausa';} // v24c (decisione 1 di 02; aspetto: 02, tornata 24 V3)
  else if(datiIllegibili){txt='File dati non si legge';cls='err';}
  // v21 (D-026): prima della prima sincronizzazione riuscita, scritte che dicono cosa manca; il giallo resta solo per ciò che è in corso
  else if(cartellaMancante()){txt='Scegli la cartella';cls='warn';}
  else if(!DB.meta.lastSync){txt='Non ancora su Drive';cls='warn';}
  else if(lastErr){txt=/non risponde/.test(lastErr)?'Drive non risponde · riprova':'Errore · riprova';cls='err';}
  else if(inAttesa()){const n=inAttesa();txt=n===1?'1 elemento in attesa':n+' elementi in attesa';cls='warn';}
  else if(pendingCount()){txt=pendingCount()+' da inviare';cls='warn';}
  else {txt='Sincronizzato';cls='ok';}
  c.textContent=txt;c.className='chip sync '+cls;
  if(cls==='pausa')c.setAttribute('aria-label','Drive in pausa: tocca per rispondere alla domanda sui dati sostituiti');else c.removeAttribute('aria-label');c.title=lastErr||(inAttesa()?'Riprovo da solo tra qualche minuto: '+Object.values(codaAttesa).map(a=>a.err).join(' · '):'')||(DB.meta.lastSync?'Ultima sincronizzazione: '+new Date(DB.meta.lastSync).toLocaleString('it-IT'):'');
}
function render(){
  renderSync();
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
  document.querySelectorAll('main > section').forEach(s=>s.hidden=s.id!=='v-'+tab);
  $('acc').innerHTML=DB.meta.account?`<span title="${esc(DB.meta.account.email)}">${esc((DB.meta.account.name||DB.meta.account.email).split(' ')[0])}</span>`:'';
  $('welcome').hidden=!!DB.meta.account||!!progetti().length||!!DB.meta.skipWelcome;
  $('setup').hidden=!(showSetup&&DB.meta.account);
  if(tab==='cal')renderCal();
  if(tab==='rie')renderRiepilogo();
  if(tab==='pro')renderProgetti();
}
// ---- calendario ----
function renderCal(){
  $('mese').textContent=monthName(cur);
  const ps=progetti();
  $('filtri').innerHTML=ps.length>1?`<button class="fchip ${filtro?'':'on'}" data-f="">Tutti</button>`+ps.map(p=>`<button class="fchip ${filtro===p.id?'on':''}" data-f="${esc(p.id)}" style="--c:${colOk(p.colore)}"><i></i>${esc(p.nome)}</button>`).join(''):'';
  const [y,m]=cur.split('-').map(Number);const first=new Date(y,m-1,1);const off=(first.getDay()+6)%7;const n=lastDay(cur);
  const by={};for(const e of eventiDel(e=>e.data.startsWith(cur)&&(!filtro||e.pid===filtro),true))(by[e.data]=by[e.data]||[]).push(e);
  let h=['lun','mar','mer','gio','ven','sab','dom'].map(d=>`<div class="dow">${d}</div>`).join('');
  for(let i=0;i<off;i++)h+='<div class="day empty"></div>';
  const t=today();
  for(let d=1;d<=n;d++){
    const id=`${cur}-${pad(d)}`;const es=by[id]||[];
    const cls=['day',id===t?'today':'',id===selDay&&!multi?'sel':'',multi&&selected.has(id)?'msel':'',[0,6].includes(new Date(y,m-1,d).getDay())?'we':''].join(' ');
    h+=`<button class="${cls}" data-day="${id}"><span class="n">${d}</span><span class="evs">${es.slice(0,3).map(e=>{const p=prog(e.pid);return `<span class="ev${e.stato==='previsto'?' prev':''}" style="--c:${colOk(p?.colore||'#888')}">${esc(etichettaBreve(e))}</span>`;}).join('')}${es.length>3?`<span class="more">+${es.length-3}</span>`:''}</span></button>`;
  }
  $('grid').innerHTML=h;
  $('multiBtn').classList.toggle('on',multi);$('multiBtn').textContent=multi?'Fine selezione':'Più giorni';
  $('multiBar').hidden=!multi;$('multiN').textContent=selected.size?`${selected.size} giorni selezionati`:'Tocca i giorni da selezionare';$('multiAdd').disabled=!selected.size;
  renderDay();renderLista();
}
function etichettaBreve(e){const p=prog(e.pid);if(e.tipo==='allenamento')return 'All.';if(e.tipo==='partita')return 'Partita';if(e.tipo==='amichevole')return 'Amich.';return e.titolo||TIPI[e.tipo];}
function evRow(e,withDate){
  const p=prog(e.pid);const s=soldiOre(e);const bits=[];
  if(e.rimborso&&kmOf(e))bits.push(`${nf(kmOf(e),1)} km${e.luogo?' · '+esc(e.luogo):''}`);
  if(e.ore)bits.push(isFisso(e)?`compenso ${eur(s.lordo)}`:`${nf(s.ore)} h · ${eur(s.lordo)} lordi`);
  const d=parseYmd(e.data);
  if((e.spese||[]).length)bits.push(`spese ${eur((e.spese||[]).reduce((a,x)=>a+(+x.importo||0),0))}`);
  return `<button class="evrow${e.stato==='previsto'?' prev':''}" data-ev="${esc(e.id)}" style="--c:${colOk(p?.colore||'#888')}">${withDate?`<span class="dd"><b>${d.getDate()}</b>${GIORNI[d.getDay()].slice(0,3)}</span>`:''}<span class="bar"></span><span class="tx"><b>${esc(etichetta(e))}${e.stato==='previsto'?' <em class="tag">prevista</em>':''}${e.serie?' <em class="tag rip">↻</em>':''}</b><small>${esc(p?.nome||'?')}${bits.length?' · '+bits.join(' · '):''}</small></span></button>`;
}
function renderDay(){
  const box=$('dayBox');if(multi){box.hidden=true;return;}box.hidden=false;
  const d=parseYmd(selDay);$('dayTitle').textContent=`${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`;
  const es=eventiDel(e=>e.data===selDay,true);
  $('dayList').innerHTML=es.length?es.map(e=>evRow(e)).join(''):'<p class="muted">Nessuna attività.</p>';
}
function renderLista(){
  const es=eventiDel(e=>e.data.startsWith(cur)&&(!filtro||e.pid===filtro),true);
  $('listaN').textContent=es.length;
  $('lista').innerHTML=es.length?es.map(e=>evRow(e,true)).join(''):'<p class="muted">Ancora niente questo mese.</p>';
}
function shift(n){const [y,m]=cur.split('-').map(Number);const d=new Date(y,m-1+n,1);cur=`${d.getFullYear()}-${pad(d.getMonth()+1)}`;selDay=cur===today().slice(0,7)?today():cur+'-01';selected.clear();render();}

// ---- finestra attività ----
let md=null; // stato della finestra
function openEv(dates,e){
  const ps=progetti();
  if(!ps.length){toast('Prima crea un progetto (squadra o lavoro).','err');tab='pro';render();openProj();return;}
  const p=e?prog(e.pid):(prog(filtro)||ps.find(x=>x.id===DB.meta.lastPid)||ps[0]);
  md={dates,id:e?.id||null,ev:e?clone(e):null,pid:p.id,tipoSet:!!e};
  fillEv(e?clone(e):defaultsEv(p));
  $('evDel').hidden=!e;$('evDup').hidden=!e;
  $('evTitle').textContent=e?'Modifica attività':dates.length>1?`Nuova attività · ${dates.length} giorni`:'Nuova attività';
  const d=parseYmd(dates[0]);$('evDate').value=dates[0];$('evDate').onchange=()=>{if(!md.id)md.dates=[$('evDate').value];};$('evDateRow').hidden=dates.length>1;
  $('evSub').textContent=dates.length>1?dates.map(x=>parseYmd(x).getDate()).join(', ')+' '+MESI[d.getMonth()]:'';
  $('evModal').hidden=false;document.body.classList.add('noscroll');
}
function defaultsEv(p){
  return {pid:p.id,tipo:p.def?.tipo||(p.rimborso.attivo?'allenamento':'lavoro'),titolo:'',squadra:'',rimborso:!!p.rimborso.attivo,luogoId:p.rimborso.luoghi[0]?.id||'',luogo:p.rimborso.luoghi[0]?.nome||'',km:p.rimborso.luoghi[0]?.km??'',
    ore:!!p.ore.attivo,fasce:p.ore.attivo?clone(p.ore.fasce.slice(0,1)).map(f=>({da:f.da,a:f.a,id:f.id})):[],oreMan:null,fisso:null,tariffa:p.ore.tariffa,rit:p.ore.ritenuta,note:''};
}
function fillEv(e){
  md.e=e;const p=prog(e.pid);
  $('evProj').innerHTML=progetti().map(x=>`<button type="button" class="pchip ${x.id===e.pid?'on':''}" data-pid="${esc(x.id)}" style="--c:${colOk(x.colore)}"><i></i>${esc(x.nome)}</button>`).join('');
  document.querySelectorAll('#evTipo button').forEach(b=>b.classList.toggle('on',b.dataset.t===e.tipo));
  const lab={allenamento:'Squadra (se diversa dal solito)',partita:'Avversario',amichevole:'Avversario',lavoro:'Descrizione',altro:'Descrizione'}[e.tipo];
  $('evTitoloL').textContent=lab;
  $('evTitolo').value=e.tipo==='allenamento'?(e.squadra||''):(e.titolo||'');
  $('evTitolo').placeholder=e.tipo==='allenamento'?(p.rimborso.squadra||'es. Under15'):e.tipo==='lavoro'?'es. Turno pomeridiano':'';
  $('evRimb').checked=!!e.rimborso;$('evRimbBox').hidden=!e.rimborso;
  $('evLuogo').innerHTML=p.rimborso.luoghi.map(l=>`<option value="${esc(l.id)}">${esc(l.nome)} · ${nf(l.km,1)} km</option>`).join('')+'<option value="__new">+ Nuovo luogo…</option>'+(e.luogoId&&!p.rimborso.luoghi.find(l=>l.id===e.luogoId)?`<option value="${esc(e.luogoId)}">${esc(e.luogo)}</option>`:'');
  $('evLuogo').value=e.luogoId||(p.rimborso.luoghi.length?p.rimborso.luoghi[0].id:'__new');
  $('evNewLuogo').hidden=$('evLuogo').value!=='__new';
  $('evKm').value=e.km??'';
  $('evOrig').textContent=p.rimborso.origine?`Andata e ritorno da ${p.rimborso.origine}`:'Km andata e ritorno';
  $('evOre').checked=!!e.ore;$('evOreBox').hidden=!e.ore;
  $('evFisso').checked=isFisso(e);$('evFasceBox').hidden=isFisso(e);$('evFissoBox').hidden=!isFisso(e);
  $('evFissoV').value=isFisso(e)?e.fisso:'';
  $('evPreset').innerHTML=p.ore.fasce.map(f=>{const on=(e.fasce||[]).some(x=>x.da===f.da&&x.a===f.a);return `<button type="button" class="pchip ${on?'on':''}" data-fa="${esc(f.id)}"><i></i>${esc(f.nome)} ${f.da}–${f.a}</button>`;}).join('');
  renderFasce();
  $('evTar').value=e.tariffa??p.ore.tariffa;$('evRit').value=e.rit??p.ore.ritenuta;
  $('evNote').value=e.note||'';
  calcEv();
}
function renderFasce(){
  const e=md.e;
  $('evFasce').innerHTML=(e.fasce||[]).map((f,i)=>`<div class="fascia"><input type="time" value="${toTime(f.da)}" data-fi="${i}" data-k="da"><span>→</span><input type="time" value="${toTime(f.a)}" data-fi="${i}" data-k="a"><button type="button" class="x" data-frm="${i}" aria-label="Togli">×</button></div>`).join('');
}
const toTime=t=>{const v=min(t);return v==null?'':`${pad(Math.floor(v/60))}:${pad(v%60)}`;};
function readEv(){
  const e=md.e;
  if(e.tipo==='allenamento'){e.squadra=$('evTitolo').value.trim();e.titolo='';}else{e.titolo=$('evTitolo').value.trim();e.squadra='';}
  e.rimborso=$('evRimb').checked;e.ore=$('evOre').checked;
  e.km=$('evKm').value===''?'':+$('evKm').value.replace(',','.');
  e.fisso=$('evFisso').checked?($('evFissoV').value===''?0:+String($('evFissoV').value).replace(',','.')):null;
  e.tariffa=+String($('evTar').value).replace(',','.')||0;e.rit=+String($('evRit').value).replace(',','.')||0;
  e.note=$('evNote').value.trim();
  return e;
}
function calcEv(){
  const e=readEv();const s=soldiOre(Object.assign({},e,{ore:true}));
  $('evOreTot').textContent=isFisso(e)?'':`${nf(oreFasce(e.fasce))} ore`;
  $('evCalc').textContent=e.ore?`Lordo ${eur(s.lordo)} · ritenuta ${eur(s.rit)} · netto ${eur(s.netto)}`:'';
}
let saveEv; // v21: versione originale tolta (non usata); definita in plus.js
let delEv; // v21: versione originale tolta (non usata); definita in plus.js
function dupEv(){const e=clone(readEv());const d=$('evDate').value;md={dates:[d],id:null,ev:null,pid:e.pid};fillEv(e);
  $('evTitle').textContent='Copia attività';$('evDel').hidden=true;$('evDup').hidden=true;$('evDateRow').hidden=false;$('evSub').textContent='Scegli il giorno della copia';}
function closeEv(){$('evModal').hidden=true;document.body.classList.remove('noscroll');}

// ---- riepilogo ----
let rieMode='mese';
let renderRiepilogo; // v21: versione originale tolta (non usata); definita in plus.js

// ---- documenti ----
function fileLink(rec,slot,label){const f=rec?.[slot];return f?.link?`<a class="btn ghost sm" href="${esc(f.link)}" target="_blank" rel="noopener">${label} ↗</a>`:'';}
let renderDoc; // v21: versione originale tolta (non usata); definita in plus.js
function saveExtra(pid,k,v){
  const key=meseKey(pid,cur);const x=Object.assign({},meseExtra(pid,cur),D().mesi[key]||{});
  x[k]=['pedaggi','altro','pernEur','pastiEur','tariffa'].includes(k)?(v===''?0:+String(v).replace(',','.')||0):v;
  x.updatedAt=Date.now();D().mesi[key]=x;markExport([`rimb|${pid}|${cur.slice(0,4)}`]);changed();
}

// ---- progetti ----
function renderProgetti(){
  const ps=progetti();
  $('projList').innerHTML=ps.map(p=>`<button class="card prow" data-proj="${esc(p.id)}" style="--c:${colOk(p.colore)}"><i></i><span><b>${esc(p.nome)}</b><small>${[p.rimborso.attivo?'rimborsi spesa':'',p.ore.attivo?'ore / ritenuta':''].filter(Boolean).join(' · ')}${p.cartella?.nome?' · cartella “'+esc(p.cartella.nome)+'”':' · cartella da creare'}</small></span><span class="chev">›</span></button>`).join('')||'<p class="muted">Nessun progetto. Crea la tua prima squadra o il tuo primo lavoro.</p>';
  const pr=D().profilo;
  for(const k of ['cognome','nome','natoA','dataNascita','residenza','via','cf'])if(document.activeElement!==$('pf-'+k))$('pf-'+k).value=pr[k]||'';
  if(document.activeElement!==$('pf-modello'))$('pf-modello').value=pr.auto?.modello||'';
  if(document.activeElement!==$('pf-targa'))$('pf-targa').value=pr.auto?.targa||'';
  const a=DB.meta.account,root=D().root;
  $('accBox').innerHTML=a?`<p>Collegato come <b>${esc(a.email)}</b></p>${root?`<p class="muted sm">Cartella: <a href="${esc(root.link||'#')}" target="_blank" rel="noopener">Soldirini ↗</a> ${root.dove?'in '+esc(root.dove):''}</p>`:''}${DB.meta.drivePausa?'<div class="drpausa" role="status"><b>Google Drive · In pausa</b><p class="muted sm" style="margin:2px 0 6px">Su un altro telefono o tablet i dati sono stati sostituiti con una copia di sicurezza. Finché non rispondi, Soldirini non legge e non scrive su Drive: le modifiche restano solo su questo telefono.</p><button class="btn ghost sm" id="pausaRispondi">Rispondi ora</button></div>':''}${protRiga()}<div class="acts"><button class="btn ghost" id="syncNow">Sincronizza ora</button><button class="btn ghost" id="logout">Esci</button></div>`
    :`<p>Accedi con Google per salvare tutto sul tuo Drive e usarla su più dispositivi.</p><button class="btn google" id="loginBtn2">Accedi con Google</button>${protRiga()}`;
}
let pe=null; // progetto in modifica
function openProj(id){
  const p=id?clone(prog(id)):nuovoProgetto();pe={p,isNew:!id};
  $('pjTitle').textContent=id?'Modifica progetto':'Nuovo progetto';
  $('pjNome').value=p.nome;
  $('pjColori').innerHTML=COLORI.map(c=>`<button type="button" class="sw ${c===p.colore?'on':''}" data-col="${c}" style="background:${c}" aria-label="colore"></button>`).join('');
  $('pjDove').innerHTML=p.cartella?.id?`<p class="sm">Cartella su Drive: <a href="${esc(p.cartella.link||'#')}" target="_blank" rel="noopener">${esc(p.cartella.nome)} ↗</a></p>`:
    `<p class="sm">La cartella “${esc(p.nome||'nome progetto')}” verrà creata in: <b>${esc(p.parent?.nome||'Soldirini')}</b></p><div class="acts"><button type="button" class="btn ghost sm" id="pjScegli">Scegli un'altra cartella su Drive</button>${p.parent?'<button type="button" class="btn ghost sm" id="pjRootDef">Usa la cartella Soldirini</button>':''}</div>`;
  $('pjRimb').checked=p.rimborso.attivo;$('pjOre').checked=p.ore.attivo;
  const R=p.rimborso;
  for(const k of ['origine','occasione','mansione','squadra','tariffaData'])$('pjR-'+k).value=R[k]||'';
  $('pjR-tariffa').value=R.tariffa||'';
  for(const k of ['riga1','nome','nomeBig','via','citta','cf'])$('pjA-'+k).value=R.assoc[k]||'';
  renderLuoghi();renderLogo();
  $('pjO-tariffa').value=p.ore.tariffa||'';$('pjO-ritenuta').value=p.ore.ritenuta;
  renderPjFasce();
  $('pjTipo').value=p.def?.tipo||'allenamento';
  $('pjDel').hidden=!id;
  togglePj();
  chiudiSezioni($('pjModal'));$('pjModal').hidden=false;document.body.classList.add('noscroll');
}
function togglePj(){$('pjRimbBox').hidden=!$('pjRimb').checked;$('pjOreBox').hidden=!$('pjOre').checked;}
function renderLuoghi(){$('pjLuoghi').innerHTML=pe.p.rimborso.luoghi.map((l,i)=>`<div class="luogo"><input value="${esc(l.nome)}" data-li="${i}" data-k="nome" placeholder="Luogo"><input inputmode="decimal" value="${numAttr(l.km)}" data-li="${i}" data-k="km" placeholder="km A/R"><button type="button" class="x" data-lrm="${i}">×</button></div>`).join('');}
function renderPjFasce(){$('pjFasce').innerHTML=pe.p.ore.fasce.map((f,i)=>`<div class="luogo"><input value="${esc(f.nome)}" data-pf="${i}" data-k="nome"><input type="time" value="${toTime(f.da)}" data-pf="${i}" data-k="da"><input type="time" value="${toTime(f.a)}" data-pf="${i}" data-k="a"><button type="button" class="x" data-pfrm="${i}">×</button></div>`).join('');}
async function renderLogo(){const s=await logoSrc(pe.p);$('pjLogo').innerHTML=s?`<img src="${s}" alt="logo"><button type="button" class="btn ghost sm" id="pjLogoRm">Togli logo</button>`:'<span class="muted sm">Nessun logo</span>';}
function readProj(){
  const p=pe.p;p.nome=$('pjNome').value.trim();
  p.rimborso.attivo=$('pjRimb').checked;p.ore.attivo=$('pjOre').checked;
  for(const k of ['origine','occasione','mansione','squadra','tariffaData'])p.rimborso[k]=$('pjR-'+k).value.trim();
  p.rimborso.tariffa=+String($('pjR-tariffa').value).replace(',','.')||0;
  for(const k of ['riga1','nome','nomeBig','via','citta','cf'])p.rimborso.assoc[k]=$('pjA-'+k).value.trim();
  p.ore.tariffa=+String($('pjO-tariffa').value).replace(',','.')||0;p.ore.ritenuta=+String($('pjO-ritenuta').value).replace(',','.')||0;
  p.def={tipo:$('pjTipo').value};
  p.rimborso.luoghi=p.rimborso.luoghi.filter(l=>l.nome.trim()).map(l=>({...l,nome:l.nome.trim(),km:+String(l.km).replace(',','.')||0}));
  p.ore.fasce=p.ore.fasce.filter(f=>min(f.da)!=null&&min(f.a)!=null);
  return p;
}
function saveProj(){
  const p=readProj();
  if(!p.nome){toast('Dai un nome al progetto.','err');return;}
  if(progetti().some(x=>x.id!==p.id&&x.nome.toLowerCase()===p.nome.toLowerCase())){toast('Esiste già un progetto con questo nome.','err');return;}
  const old=prog(p.id);
  p.updatedAt=Date.now();D().progetti[p.id]=p;
  if(!p.cartella)DB.meta.queue['folder|'+p.id]=Date.now();
  // se cambiano dati che finiscono nei documenti, rifaccio i fogli dell'anno
  if(old&&canon(old)!==canon(p)){const ys=new Set(eventi().filter(e=>e.pid===p.id).map(e=>e.data.slice(0,4)));ys.forEach(y=>markExport([`rimb|${p.id}|${y}`,`ore|${y}`]));}
  closeProj();changed();render();toast(pe.isNew?'Progetto creato':'Progetto salvato');
}
let delProj; // v21: versione originale tolta (non usata); definita in plus.js
function closeProj(){$('pjModal').hidden=true;document.body.classList.remove('noscroll');}
function saveProfilo(){
  const pr=D().profilo;for(const k of ['cognome','nome','natoA','dataNascita','residenza','via','cf'])pr[k]=$('pf-'+k).value.trim();
  pr.auto={modello:$('pf-modello').value.trim(),targa:$('pf-targa').value.trim()};pr.updatedAt=Date.now();
  const ys=new Set(eventi().filter(e=>e.rimborso||e.ore).map(e=>e.data.slice(0,4)));
  for(const p of progetti())ys.forEach(y=>{if(eventi().some(e=>e.pid===p.id&&e.rimborso&&e.data.startsWith(y)))markExport([`rimb|${p.id}|${y}`]);});
  ys.forEach(y=>{if(eventi().some(e=>e.ore&&e.data.startsWith(y)))markExport([`ore|${y}`]);});
  changed();toast('Dati personali salvati');
}


// ---- backup ----
// v24c: "Scarica backup" sostituito da "Salva una copia" (copia.js); i vecchi file .json si riprendono ancora

// ================= eventi interfaccia =================
// v21: i pulsanti chiamano la funzione per nome al momento del tocco, così usano sempre la versione attuale
// (anche se un file successivo la ridefinisce), qualunque sia l'ordine in cui i file si caricano.
function bind(){
  document.querySelector('.tabs').addEventListener('click',e=>{const b=e.target.closest('button[data-tab]');if(b){tab=b.dataset.tab;render();window.scrollTo(0,0);}});
  $('sync').addEventListener('click',()=>{if(!DB.meta.account)login();else if(DB.meta.drivePausa&&window.Copia)Copia.domandaPausa(true);else if(cartellaMancante()&&!syncing){showSetup=true;render();}else sync(true);});
    $('prev').onclick=()=>shift(-1);$('next').onclick=()=>shift(1);$('oggi').onclick=()=>{cur=today().slice(0,7);selDay=today();render();};
  $('rPrev').onclick=()=>shift(rieMode==='anno'?-12:-1);$('rNext').onclick=()=>shift(rieMode==='anno'?12:1);
  // 24b.1 (D-098): le pagine di dettaglio del Riepilogo scorrono come il Riepilogo (mese o anno); Documenti non ha più una pagina sua
  document.addEventListener('click',e=>{const b=e.target.closest('.pagrie .pgPrev,.pagrie .pgNext');if(b)shift((b.classList.contains('pgPrev')?-1:1)*(rieMode==='anno'?12:1));});
  $('filtri').addEventListener('click',e=>{const b=e.target.closest('[data-f]');if(b){filtro=b.dataset.f;render();}});
  $('grid').addEventListener('click',e=>{const b=e.target.closest('[data-day]');if(!b)return;const d=b.dataset.day;
    if(multi){selected.has(d)?selected.delete(d):selected.add(d);renderCal();return;}
    if(selDay===d&&!eventiDel(x=>x.data===d,true).length){openEv([d]);return;}
    selDay=d;renderCal();if(innerWidth<900)$('dayBox').scrollIntoView({behavior:'smooth',block:'nearest'});});
  $('multiBtn').onclick=()=>{multi=!multi;selected.clear();renderCal();};
  $('multiAdd').onclick=()=>openEv([...selected].sort());
  $('dayAdd').onclick=()=>openEv([selDay]);
  $('fab').onclick=()=>multi&&selected.size?openEv([...selected].sort()):openEv([selDay.startsWith(cur)?selDay:cur+'-01']);
  for(const id of ['dayList','lista'])$(id).addEventListener('click',e=>{const b=e.target.closest('[data-ev]');if(b){const ev=D().eventi[b.dataset.ev];selDay=ev.data;openEv([ev.data],ev);}});
  $('listaHead').onclick=()=>{$('listaSec').classList.toggle('closed');};
  // finestra attività
  $('evClose').onclick=e=>closeEv(e);$('evModal').addEventListener('click',e=>{if(e.target.id==='evModal')closeEv();});
  $('evProj').addEventListener('click',e=>{const b=e.target.closest('[data-pid]');if(!b)return;const cur0=readEv();const p=prog(b.dataset.pid);
    const n=defaultsEv(p);if(md.tipoSet)n.tipo=cur0.tipo;n.titolo=cur0.titolo;n.squadra=cur0.squadra;n.note=cur0.note;fillEv(n);});
  $('evTipo').addEventListener('click',e=>{const b=e.target.closest('[data-t]');if(!b)return;const x=readEv();
    if(x.tipo==='allenamento'&&b.dataset.t!=='allenamento'){x.titolo='';}x.tipo=b.dataset.t;md.tipoSet=true;fillEv(x);$('evTitolo').focus();});
  $('evRimb').onchange=()=>{$('evRimbBox').hidden=!$('evRimb').checked;calcEv();};
  $('evOre').onchange=()=>{const e=readEv();if(e.ore&&!(e.fasce||[]).length&&!isFisso(e)){const p=prog(e.pid);if(p.ore.fasce[0])e.fasce=[{...p.ore.fasce[0]}];}fillEv(e);$('evOreBox').hidden=!e.ore;};
  $('evFisso').onchange=()=>{const e=readEv();fillEv(e);};
  $('evLuogo').onchange=()=>{const p=prog(md.e.pid);const v=$('evLuogo').value;$('evNewLuogo').hidden=v!=='__new';const l=p.rimborso.luoghi.find(x=>x.id===v);if(l){$('evKm').value=l.km;md.e.luogoId=l.id;md.e.luogo=l.nome;}else{$('evKm').value='';$('evNewLuogoN').focus();}};
  $('evPreset').addEventListener('click',e=>{const b=e.target.closest('[data-fa]');if(!b)return;const x=readEv();const p=prog(x.pid);const f=p.ore.fasce.find(q=>q.id===b.dataset.fa);
    const i=(x.fasce||[]).findIndex(q=>q.da===f.da&&q.a===f.a);if(i>=0)x.fasce.splice(i,1);else{x.fasce=[...(x.fasce||[]),{da:f.da,a:f.a,id:f.id}].sort((a,b)=>min(a.da)-min(b.da));}fillEv(x);});
  $('evFasceAdd').onclick=()=>{const x=readEv();x.fasce=[...(x.fasce||[]),{da:'',a:''}];fillEv(x);};
  $('evFasce').addEventListener('input',e=>{const t=e.target;if(t.dataset.fi==null)return;md.e.fasce[+t.dataset.fi][t.dataset.k]=normT(t.value);calcEv();
    const p=prog(md.e.pid);document.querySelectorAll('#evPreset [data-fa]').forEach(b=>{const f=p.ore.fasce.find(q=>q.id===b.dataset.fa);b.classList.toggle('on',md.e.fasce.some(x=>x.da===f.da&&x.a===f.a));});});
  $('evFasce').addEventListener('click',e=>{const b=e.target.closest('[data-frm]');if(!b)return;const x=readEv();x.fasce.splice(+b.dataset.frm,1);fillEv(x);});
  for(const id of ['evFissoV','evTar','evRit','evKm'])$(id).addEventListener('input',calcEv);
  $('evSave').onclick=e=>saveEv(e);$('evDel').onclick=e=>delEv(e);$('evDup').onclick=e=>dupEv(e);
  // riepilogo
  $('rieSeg').addEventListener('click',e=>{const b=e.target.closest('[data-m]');if(b){rieMode=b.dataset.m;render();}});
  // 24b.2: "Mese per mese (incassi)": il tocco (o Invio) su una riga porta a quel mese, nella stessa pagina
  const vaiMese=r=>{cur=r.dataset.ym;rieMode='mese';render();scrollTo(0,0);};
  $('rieAnno').addEventListener('click',e=>{const r=e.target.closest('tr[data-ym]');if(r)vaiMese(r);});
  $('rieAnno').addEventListener('keydown',e=>{const r=e.target.closest('tr[data-ym]');if(r&&(e.key==='Enter'||e.key===' ')){e.preventDefault();vaiMese(r);}});
  // documenti
  $('docList').addEventListener('click',e=>{const b=e.target.closest('[data-pdf]');if(b)pdfRimborso(b.dataset.pdf,cur);if(e.target.closest('[data-pdfore]'))pdfOre(cur);});
  $('docList').addEventListener('change',e=>{const t=e.target;if(t.dataset.x==null)return;saveExtra(t.closest('[data-pid]').dataset.pid,t.dataset.x,t.value);renderDocSoft();});
  // progetti e profilo
  $('projNew').onclick=()=>openProj();
  $('projList').addEventListener('click',e=>{const b=e.target.closest('[data-proj]');if(b)openProj(b.dataset.proj);});
  $('pfSave').onclick=e=>saveProfilo(e);
  $('accBox').addEventListener('click',e=>{if(e.target.id==='syncNow')sync(true);if(e.target.id==='logout')logout();if(e.target.id==='protChiedi')chiediProt();if(e.target.id==='vcNascondi')nascondiVecchiaRiga();if(e.target.id==='vcRiga')apriVecchiaCopia();if(e.target.id==='loginBtn2')login();if(e.target.id==='pausaRispondi'&&window.Copia)Copia.domandaPausa(true);});
  // finestra progetto
  $('pjClose').onclick=e=>closeProj(e);$('pjSave').onclick=e=>saveProj(e);$('pjDel').onclick=e=>delProj(e);
  $('pjModal').addEventListener('click',e=>{if(e.target.id==='pjModal')closeProj();});
  $('pjColori').addEventListener('click',e=>{const b=e.target.closest('[data-col]');if(!b)return;pe.p.colore=b.dataset.col;document.querySelectorAll('#pjColori .sw').forEach(x=>x.classList.toggle('on',x===b));});
  $('pjRimb').onchange=togglePj;$('pjOre').onchange=togglePj;
  $('pjNome').addEventListener('input',()=>{const s=$('pjDove').querySelector('b');if(s&&!pe.p.cartella){const t=$('pjDove').querySelector('p');t.firstChild.textContent=`La cartella “${$('pjNome').value.trim()||'nome progetto'}” verrà creata in: `;}});
  $('pjDove').addEventListener('click',async e=>{
    if(e.target.id==='pjScegli'){try{const f=await pickFolder('Dove creo la cartella del progetto?');if(f){readProj();pe.p.parent=f;const keep=pe;openProjRefresh(keep);}}catch(err){toast(errMsg(err),'err');}}
    if(e.target.id==='pjRootDef'){readProj();pe.p.parent=null;openProjRefresh(pe);}
  });
  $('pjLuoghi').addEventListener('input',e=>{const t=e.target;if(t.dataset.li==null)return;pe.p.rimborso.luoghi[+t.dataset.li][t.dataset.k]=t.value;});
  $('pjLuoghi').addEventListener('click',e=>{const b=e.target.closest('[data-lrm]');if(b){pe.p.rimborso.luoghi.splice(+b.dataset.lrm,1);renderLuoghi();}});
  $('pjLuogoAdd').onclick=()=>{pe.p.rimborso.luoghi.push({id:uid(),nome:'',km:''});renderLuoghi();$('pjLuoghi').querySelector('.luogo:last-child input').focus();};
  $('pjFasce').addEventListener('input',e=>{const t=e.target;if(t.dataset.pf==null)return;pe.p.ore.fasce[+t.dataset.pf][t.dataset.k]=t.dataset.k==='nome'?t.value:normT(t.value);});
  $('pjFasce').addEventListener('click',e=>{const b=e.target.closest('[data-pfrm]');if(b){pe.p.ore.fasce.splice(+b.dataset.pfrm,1);renderPjFasce();}});
  $('pjFasciaAdd').onclick=()=>{pe.p.ore.fasce.push({id:uid(),nome:'Turno',da:'',a:''});renderPjFasce();};
  $('pjLogoFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{pe.p.rimborso.logo=await toJpeg(f);renderLogo();}catch(err){toast('Immagine non valida','err');}e.target.value='';};
  $('pjLogo').addEventListener('click',e=>{if(e.target.id==='pjLogoRm'){pe.p.rimborso.logo=null;renderLogo();}});
  // setup cartella
  $('loginW').onclick=e=>login(e);$('skipW').onclick=()=>{DB.meta.skipWelcome=true;persist();render();};
  $('setupMy').onclick=()=>setupRoot('mio');$('setupPick').onclick=()=>setupRoot('scegli');
  addEventListener('online',()=>{prepGis();scheduleSync(500);});addEventListener('offline',renderSync);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleSync(800);});
  setInterval(()=>{if(pendingCount())sync(false);},60000);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('evModal').hidden)closeEv();else if(!$('pjModal').hidden)closeProj();}});
}
function openProjRefresh(keep){const p=keep.p,isNew=keep.isNew;D().progetti.__tmp=p;openProj('__tmp');delete D().progetti.__tmp;pe={p,isNew};pe.p.id=p.id;if(isNew){$('pjTitle').textContent='Nuovo progetto';$('pjDel').hidden=true;$('pjPreset').hidden=false;}}
function renderDocSoft(){const open=[...document.querySelectorAll('#docList details[open]')].map(d=>d.dataset.pid);const y=scrollY;renderDoc();open.forEach(id=>{const d=document.querySelector(`#docList details[data-pid="${CSS.escape(id)}"]`);if(d)d.open=true;});scrollTo(0,y);}
async function toJpeg(file){
  const url=URL.createObjectURL(file);const img=new Image();img.src=url;await img.decode();
  const k=Math.min(1,460/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement('canvas');c.width=Math.round(img.naturalWidth*k);c.height=Math.round(img.naturalHeight*k);
  const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);
  return c.toDataURL('image/jpeg',0.86);
}


// ================= v24b: protezione dalla pulizia automatica e vecchia copia dei dati (testi di 02, report 02-ux-v24b-testi) =================
// righe di Impostazioni → Account della v24b: dati salvati in precedenza, protezione, salvataggio ridotto
function protRiga(){if(!window.Archivio)return '';return vecchiaRiga()+protBoxHtml()+ridottoRiga();}
function protBoxHtml(){const A=Archivio,p=A.prot,st=p.stato;
  if(!st){A.controllaProtezione(false).then(aggiornaProt);} // "Controllo…" finché il navigatore non risponde
  const lab={si:['si','Sì'],no:['no','No'],nd:['nd','Non si sa']}[st]||['nd','Controllo…'];
  const nota=st==='si'?'Il telefono non cancella i dati di Soldirini per fare posto.'
    :st==='no'?(p.rifiutata?'Il telefono per ora non l’ha concessa. Di solito la concede quando Soldirini è installata sulla schermata Home e la usi spesso. Su alcuni navigatori te lo chiede con una finestra. Puoi riprovare più avanti.' // testo definitivo di 02 (tornata 20 §2)
      :'Se lo spazio sul telefono finisce, il telefono può cancellare i dati di Soldirini per fare posto. Su iPhone, se Soldirini non è installata sulla schermata Home, i dati possono sparire anche dopo qualche giorno senza aprirla.') // D-093 punto 2 (testo di 03)
    :st==='nd'?'Questo navigatore non dice se protegge i dati dalla pulizia.':'';
  return `<div class="prot" id="protBox"><div class="kv"><span>Protezione dalla pulizia automatica</span><em class="pst ${lab[0]}">${lab[1]}</em></div>${nota?`<p class="muted sm">${nota}</p>`:''}${st==='no'?'<button class="btn ghost sm" id="protChiedi">Chiedi protezione</button>':''}</div>`;}
// 24b.1 (02, tornata 22 A5): riga solo quando l'app è partita con il ripiego su localStorage (non con la fascia LS_FERMO)
const salvataggioRidotto=()=>!!(window.Archivio&&Archivio.modo!=='idb'&&!LS_FERMO);
function ridottoRiga(){if(!salvataggioRidotto())return '';
  return `<div class="prot" id="ridBox"><div class="kv"><span>Salvataggio sul telefono</span><em class="pst no">Ridotto</em></div><p class="muted sm">Il navigatore non lascia usare a Soldirini il suo archivio dei dati (succede per esempio nelle finestre private). I dati sono in uno spazio più piccolo: foto e documenti grandi potrebbero non essere salvati.</p></div>`;}
// D-093 punto 1: riga "Dati salvati il {data}" con [Riprendi], finché la vecchia copia ha voci che qui mancano (testi definitivi di 02, §3: niente numeri)
// 24b.1 (D-096, 02 tornata 22 A1): "Non mi serve" la nasconde per sempre (segno in DB.meta, solo su questo telefono); la vecchia copia resta
function vecchiaRiga(){if(DB.meta.vecchiaNascosta)return '';const v=window.Archivio&&Archivio.vecchiaCopia();if(!v||!v.mancanti)return '';const q=v.quando?gma(v.quando):null;
  const di=q?'dei dati salvati il '+q:'dei dati salvati in precedenza';
  return `<div class="prot vcriga" id="vcRigaBox"><div class="vcrt"><b>${q?'Dati salvati il '+q:'Dati salvati in precedenza'}</b><small>Una copia più vecchia ha voci che oggi su questo telefono non ci sono.</small></div><div class="vcacts"><button class="btn link sm" id="vcNascondi" aria-label="Non mi serve: nascondi la riga ${di}">Non mi serve</button><button class="btn ghost sm" id="vcRiga" aria-label="${q?'Riprendi i dati salvati il '+q:'Riprendi i dati salvati in precedenza'}">Riprendi</button></div></div>`;}
function nascondiVecchiaRiga(){DB.meta.vecchiaNascosta=true;persist();const b=$('vcRigaBox');if(b)b.remove();
  toastAzione('Riga nascosta. La copia resta sul telefono fino a quando esci.','Annulla',()=>{delete DB.meta.vecchiaNascosta;persist();render();},10000);}
function aggiornaProt(){const b=$('protBox');if(b)b.outerHTML=protBoxHtml();}
async function chiediProt(){const b=$('protChiedi');if(b)b.disabled=true;const si=await Archivio.chiediProtezione();aggiornaProt();
  if(si)toast('✓ Protezione attiva: il telefono non cancellerà i dati di Soldirini per fare posto.');}

const gma=d=>`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
let vecchiaInVista=null;
// R3.2: la domanda compare solo se i dati attuali sono vuoti e la vecchia copia ha dati; con "Non ora" torna al prossimo avvio.
// (La riga "Dati salvati il {data}" con [Riprendi] in Impostazioni aspetta la decisione dell'utente: basterà chiamare apriVecchiaCopia().)
function apriVecchiaCopia(){const v=window.Archivio&&Archivio.vecchiaCopia();if(!v)return false;
  const q=v.quando?gma(v.quando):null,vuoti=Archivio.datiVuoti(),riga=(t,x)=>`<div class="kv"><span>${t}</span><b>${x}</b></div>`;
  vecchiaInVista=Object.assign(v,{unione:!vuoti});
  if(vuoti){ // B: dati vuoti (testi di 02, tornata 17; nota sotto i pulsanti della tornata 20 §5)
    $('vcTit').textContent=q?`Riprendere i dati salvati il ${q}?`:'Riprendere i dati salvati in precedenza?';
    $('vcTxt').innerHTML=q?`Su questo telefono i dati di Soldirini risultano vuoti. C’è però una copia più vecchia, salvata il <b>${q}</b>.`:'Su questo telefono i dati di Soldirini risultano vuoti. C’è però una copia più vecchia.';
    $('vcSum').innerHTML=(v.attivita?riga('Attività',v.attivita+(v.ultima?' · fino al '+gma(parseYmd(v.ultima)):'')):'')+(v.progetti?riga('Progetti',v.progetti):'')+(v.spese?riga('Spese giornaliere',v.spese):'');
    $('vcAvv').textContent=q?`Mancherà quello che hai inserito o cambiato dopo il ${q}, e potrebbero tornare voci che avevi cancellato dopo quella data.`
      :'Mancherà quello che hai inserito o cambiato dopo quella copia, e potrebbero tornare voci che avevi cancellato dopo quella data.';
    $('vcDrive').textContent='Con Google Drive collegato, dopo la ripresa la sincronizzazione aggiunge le modifiche salvate su Drive.';
    $('vcNo').textContent='Non ora';$('vcSi').textContent='Riprendi';
  }else{ // D: dati presenti, si aggiungono solo le voci che mancano (testi definitivi di 02, tornata 20 §4)
    $('vcTit').textContent=q?`Aggiungere le voci della copia del ${q}?`:'Aggiungere le voci della copia salvata in precedenza?';
    $('vcTxt').textContent='Soldirini aggiunge solo le voci della copia che oggi su questo telefono mancano. Quello che c’è già resta com’è.';
    const m=v.manca,per=m.per,dm=d=>{const x=parseYmd(d);return `${String(x.getDate()).padStart(2,'0')}/${String(x.getMonth()+1).padStart(2,'0')}`;};
    const quando=!m.dal?'':m.dal===m.al?' · il '+gma(parseYmd(m.dal)):` · dal ${m.dal.slice(0,4)===m.al.slice(0,4)?dm(m.dal):gma(parseYmd(m.dal))} al ${gma(parseYmd(m.al))}`;
    const NOMI=[['eventi','Attività'],['progetti','Progetti'],['lavori','Lavori'],['turni','Turni'],['fissi','Uscite fisse'],['spesePers','Spese giornaliere'],['buste','Buste paga'],['cedolini','Cedolini']];
    $('vcSum').innerHTML=NOMI.filter(([k])=>per[k]).map(([k,t])=>riga(t,per[k]+(k==='eventi'?quando:''))).join('');
    $('vcAvv').textContent=q?`Tra queste potrebbero esserci voci che avevi cancellato dopo il ${q}. Se succede, cancellale di nuovo.`
      :'Tra queste potrebbero esserci voci che avevi cancellato dopo quella copia. Se succede, cancellale di nuovo.';
    $('vcDrive').textContent='Con Google Drive collegato, le voci aggiunte vanno anche su Drive alla prossima sincronizzazione.';
    $('vcNo').textContent='Annulla';$('vcSi').textContent='Aggiungi';
  }
  $('vcSumT').hidden=vuoti;$('vcSum').hidden=!$('vcSum').innerHTML;$('vcNota').hidden=!vuoti;
  $('vcDrive').hidden=!DB.meta.account;
  $('vcModal').hidden=false;document.body.classList.add('noscroll');return true;}
function chiudiVecchiaCopia(){$('vcModal').hidden=true;vecchiaInVista=null;if([...document.querySelectorAll('.modal')].every(m=>m.hidden))document.body.classList.remove('noscroll');}
function riprendiVecchiaCopia(){const v=vecchiaInVista;if(!v)return;const q=v.quando?gma(v.quando):null;
  if(!v.unione){
    // B: unione per updatedAt (come con Drive): con i dati vuoti è la copia; se intanto è arrivato qualcosa da Drive, non si perde
    DB.data=mergeData(DB.data,v.data);changed();chiudiVecchiaCopia();render();
    toast(q?`✓ Dati del ${q} ripresi: ${v.attivita} attività.`:`✓ Dati ripresi: ${v.attivita} attività.`);return;}
  // D: si aggiungono SOLO le voci che mancano (quelle del riepilogo); quelle che ci sono restano come sono, anche se nella copia sono diverse
  const m=v.manca;for(const [k,voci] of Object.entries(m.voci)){D()[k]=D()[k]||{};for(const [id,x] of Object.entries(voci))if(!(id in D()[k]))D()[k][id]=JSON.parse(JSON.stringify(x));}
  changed();chiudiVecchiaCopia();render();
  const dove=q?`dalla copia del ${q}`:'dalla copia salvata in precedenza';
  toast(m.tot===1?`✓ Aggiunta 1 voce ${dove}.`:`✓ Aggiunte ${m.tot} voci ${dove}.`);}
// 24b.1 (02, tornata 22 A4): dati già spostati ma IndexedDB non risponde → fascia fissa sotto la barra, finché l'app non si riapre
function fasciaLsFermo(){const f=$('lsFascia');if(!f)return;let q=null;try{const d=new Date(localStorage.getItem('soldirini-spostato')||'');if(!isNaN(d))q=gma(d);}catch(e){}
  f.innerHTML=`<b>⚠ Dati del telefono non raggiungibili</b><span>Soldirini mostra una copia ${q?'del '+q:'più vecchia'} e le modifiche che fai ora non restano su questo telefono. Chiudi del tutto Soldirini (anche dalle app recenti) e riaprila.</span>${DB.meta.account?'<span>Con Google Drive collegato, le modifiche vanno comunque su Drive.</span>':''}`;f.hidden=false;}
window.dopoAvvioArchivio=()=>{
  $('vcNo').onclick=chiudiVecchiaCopia;$('vcSi').onclick=riprendiVecchiaCopia;
  // D si chiude anche toccando fuori (= Annulla); B no (02)
  $('vcModal').addEventListener('click',e=>{if(e.target.id==='vcModal'&&vecchiaInVista&&vecchiaInVista.unione)chiudiVecchiaCopia();});
  if(LS_FERMO)fasciaLsFermo();
  // v24b: dati scritti alla chiusura della pagina in localStorage (archivio.js, scriviSubito) e forse non arrivati in IndexedDB:
  // si uniscono qui, dopo tutti i file (mergeData completo), poi la copia si cancella quando la scrittura è riuscita
  // v24c (V10b): anche la scrittura fatta alla chiusura (chiave "chiusura" di IndexedDB); valgono solo con la stessa epoca
  const jj=(ARCH&&ARCH.diario())||[];
  for(const j of jj){const m=j.meta||{};
    if(!(m.account&&DB.meta.account&&m.account.email!==DB.meta.account.email)){ // dati di un altro account: non si uniscono
      DB.data=mergeData(DB.data,j.data);DB.meta.seq=Math.max(DB.meta.seq||0,+m.seq||0);
      DB.meta.queue=Object.assign({},m.queue||{},DB.meta.queue||{});persist();render();}}
  if(jj.length)ARCH.salvato().then(()=>{if(!ARCH.errore)ARCH.togliDiario();});
  try{if(sessionStorage.getItem('soldirini-ricaricata')){sessionStorage.removeItem('soldirini-ricaricata');if(DB.meta.account||datiPieni(D()))toast('I dati sono stati sostituiti in un’altra finestra di Soldirini: qui sono stati ricaricati.','',7000);}}catch(e){}
  if(window.Archivio){Archivio.controllaProtezione(true).then(()=>{if($('protBox'))aggiornaProt();});
    if(Archivio.datiVuoti())apriVecchiaCopia();}
};
