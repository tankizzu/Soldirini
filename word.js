'use strict';
// ================= Soldirini v9 · documento di riferimento Word (.docx) =================
// Il progetto può avere un file Word della società (es. ricevuta per prestazione occasionale).
// L'utente indica quali testi del documento vanno sostituiti con i dati di Soldirini;
// il documento si compila per uno o più mesi, mantenendo l'impaginazione originale.

const WNS='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const CAMPI_W={
  periodo:'Periodo (es. novembre e dicembre 2025)',mesi:'Mesi (es. Novembre e Dicembre)',anno:'Anno',
  lordo:'Compenso lordo',ritenuta:"Ritenuta d'acconto",inps:'Ritenuta INPS',netto:'Netto a pagare',ore:'Ore totali',
  data_doc:'Data del documento',data_pag:'Data del pagamento',nome:'Nome e cognome',cf:'Codice fiscale',progetto:'Nome progetto'};
const numIt=n=>Number(n||0).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2});
const cap=s=>s?s[0].toUpperCase()+s.slice(1):s;

// ---------- lettura e scrittura del documento ----------
async function docxApri(b64){const zip=await JSZip.loadAsync(b64ToBuf(b64));const xml=await zip.file('word/document.xml').async('string');
  const doc=new DOMParser().parseFromString(xml,'application/xml');return {zip,doc};}
const docxParagrafi=doc=>[...doc.getElementsByTagNameNS(WNS,'p')];
const testoP=p=>[...p.getElementsByTagNameNS(WNS,'t')].map(t=>t.textContent).join('');
// sostituisce la prima occorrenza di `da` nel paragrafo, anche se il testo è spezzato in più parti
function sostituisciInP(p,da,a){
  const ts=[...p.getElementsByTagNameNS(WNS,'t')];const full=ts.map(t=>t.textContent).join('');const i=full.indexOf(da);if(i<0)return false;
  let pos=0,inizio=i,fine=i+da.length,messo=false;
  for(const t of ts){const s=t.textContent,a0=pos,a1=pos+s.length;pos=a1;
    if(a1<=inizio||a0>=fine)continue;
    const l=Math.max(0,inizio-a0),r=Math.min(s.length,fine-a0);
    t.textContent=s.slice(0,l)+(messo?'':a)+s.slice(r);messo=true;t.setAttribute('xml:space','preserve');}
  return true;
}
async function docxLeggi(b64){const {doc}=await docxApri(b64);return docxParagrafi(doc).map(testoP);}

// riconosce da solo i campi più comuni (ricevuta per prestazione occasionale)
function autoMappa(par){
  const map=[];const amount=/^\s*(?:Euro|€)?\s*([\d.]+(?:,\d+)?)\s*$/i;let atteso=null;
  par.forEach((t,i)=>{
    const m=/mese di\s*_*\s*([A-Za-zÀ-ú]+)\s*_*\s*anno\s*_*\s*(\d{4})/i.exec(t);
    if(m){map.push({p:i,da:m[1],campo:'mesi'});map.push({p:i,da:m[2],campo:'anno'});}
    if(/competenze|compenso lordo|importo lordo/i.test(t)&&!amount.test(t))atteso='lordo';
    else if(/ritenuta d.acconto/i.test(t)&&!amount.test(t))atteso='ritenuta';
    else if(/inps/i.test(t)&&!amount.test(t))atteso='inps';
    else if(/netto/i.test(t)&&!amount.test(t))atteso='netto';
    else if(atteso&&amount.test(t)){map.push({p:i,da:amount.exec(t)[1],campo:atteso});atteso=null;}
    const d=/\b(?:lì|li|data)\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(t);if(d)map.push({p:i,da:d[1],campo:'data_doc'});
  });
  return map;
}

// ---------- calcolo dei valori per uno o più mesi ----------
function periodoTesto(yms){
  const s=[...yms].sort();if(!s.length)return {periodo:'',mesi:'',anno:''};
  const nomi=s.map(ym=>MESI[+ym.slice(5)-1]);const anni=[...new Set(s.map(ym=>ym.slice(0,4)))];
  const consec=s.every((ym,i)=>!i||addMesi(s[i-1],1)===ym);
  const lista=a=>a.length<=1?a.join(''):a.slice(0,-1).join(', ')+' e '+a[a.length-1];
  let mesi,periodo;
  if(anni.length===1){mesi=s.length>2&&consec?`da ${nomi[0]} a ${nomi[nomi.length-1]}`:lista(nomi);periodo=`${mesi} ${anni[0]}`;}
  else{const parti=anni.map(a=>lista(s.filter(ym=>ym.startsWith(a)).map(ym=>MESI[+ym.slice(5)-1]))+' '+a);mesi=lista(nomi);periodo=lista(parti);}
  return {periodo,mesi:cap(mesi),anno:anni.join('-')};
}
function valoriWord(pid,yms,dataDoc){
  const p=prog(pid);const T=p.docTpl||{};const pr=D().profilo;
  const ev=eventi().filter(e=>e.pid===pid&&e.ore&&yms.includes(e.data.slice(0,7)));
  let ore=0,lordo=0,rit=0;for(const e of ev){const s=soldiOre(e);ore+=s.ore;lordo+=s.lordo;rit+=s.rit;}
  lordo=r2(lordo);rit=r2(rit);
  // contributo INPS a carico (solo sulla parte oltre la soglia annua delle prestazioni occasionali)
  let inps=0;const pct=+T.inpsPct||0;
  if(pct&&catOf(p)==='occasionale'){
    const anno=[...yms].sort()[0].slice(0,4);const soglia5=soglia('occ5');
    const prima=r2(eventi().filter(e=>e.ore&&catOf(prog(e.pid))==='occasionale'&&e.data.startsWith(anno)&&e.data.slice(0,7)<[...yms].sort()[0]).reduce((a,e)=>a+soldiOre(e).lordo,0));
    const ecc=Math.max(0,prima+lordo-Math.max(soglia5,prima));inps=r2(ecc*pct/100);
  }
  const pag=yms.map(ym=>pagamenti()[`${pid}|${ym}|o`]).filter(g=>g?.pagato&&g.data).map(g=>g.data).sort().pop();
  const per=periodoTesto(yms);
  return {...per,ore:nf(ore),lordo:numIt(lordo),ritenuta:numIt(rit),inps:numIt(inps),netto:numIt(r2(lordo-rit-inps)),
    data_doc:dIt(dataDoc||today()),data_pag:pag?dIt(pag):'',nome:[pr.nome,pr.cognome].filter(Boolean).join(' '),cf:pr.cf||'',progetto:p.nome,
    _n:{lordo,rit,inps,netto:r2(lordo-rit-inps),ore,att:ev.length}};
}
async function docxCompila(pid,yms,dataDoc){
  const p=prog(pid);const T=p.docTpl;const {zip,doc}=await docxApri(T.file);const par=docxParagrafi(doc);const v=valoriWord(pid,yms,dataDoc);
  const mancano=[];
  // prima i testi più lunghi, così un testo corto non “rompe” uno più lungo nello stesso paragrafo
  for(const m of [...T.map].sort((a,b)=>b.da.length-a.da.length)){const P=par[m.p];if(!P||!sostituisciInP(P,m.da,String(v[m.campo]??'')))mancano.push(m.da);}
  zip.file('word/document.xml',new XMLSerializer().serializeToString(doc));
  const bytes=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
  const s=[...yms].sort();const nome=`${T.titolo||'Ricevuta'} ${p.nome} ${s.length>1?`${s[0].slice(5)}-${s[s.length-1].slice(5)}`:s[0].slice(5)}-${s[s.length-1].slice(0,4)}.docx`;
  return {bytes,nome,mancano,v};
}
const DOCX_MIME='application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// ---------- impostazioni del progetto: carica e collega il documento ----------
let wPar=[];
async function renderWordTpl(){
  const box=$('pjWord');if(!box)return;const T=pe.p.docTpl;
  if(!T?.file){box.innerHTML='<p class="muted sm">Nessun documento. Carica il file Word della società (es. la ricevuta per prestazione occasionale): Soldirini lo compilerà con i tuoi dati, anche per più mesi insieme.</p>';return;}
  try{wPar=await docxLeggi(T.file);}catch(e){box.innerHTML=`<p class="note">Non riesco a leggere il documento: ${esc(errMsg(e))}</p>`;return;}
  const usati=new Set(T.map.map(m=>m.p));
  box.innerHTML=`<p class="sm"><b>${esc(T.nome)}</b> · ${T.map.length} testi collegati</p>
    <label>Nome del documento<input id="wTit" value="${esc(T.titolo||'Ricevuta')}"></label>
    <label style="margin-top:6px">Ritenuta INPS a tuo carico % (solo oltre ${eur(soglia('occ5'))} l’anno di prestazioni occasionali)<input id="wInps" inputmode="decimal" value="${esc(T.inpsPct??0)}"></label>
    <div class="wmap">${T.map.map((m,i)=>`<div class="wm"><span><b>${esc(CAMPI_W[m.campo]||m.campo)}</b><small>al posto di “${esc(m.da)}”</small></span><button type="button" class="x" data-wrm="${i}" aria-label="Togli">×</button></div>`).join('')||'<p class="muted sm">Nessun testo collegato.</p>'}</div>
    <p class="muted sm">Per collegare un altro dato: <b>seleziona nel documento</b> il testo da sostituire (es. l’importo), scegli il dato e tocca “Collega”.</p>
    <div class="row"><select id="wCampo" style="flex:1">${Object.entries(CAMPI_W).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select><button type="button" class="btn sm" id="wAdd">Collega</button></div>
    <div class="wdoc" id="wDoc">${wPar.map((t,i)=>t.trim()?`<p data-wp="${i}" class="${usati.has(i)?'on':''}">${esc(t)}</p>`:'').join('')}</div>`;
}
function collegaSelezione(){
  const sel=getSelection();const txt=sel?String(sel).trim():'';
  const nodo=sel?.anchorNode&&(sel.anchorNode.nodeType===1?sel.anchorNode:sel.anchorNode.parentElement)?.closest('[data-wp]');
  if(!txt||!nodo){toast('Prima seleziona nel documento il testo da sostituire.','err');return;}
  const p=+nodo.dataset.wp;if(!wPar[p].includes(txt)){toast('Seleziona il testo dentro una sola riga del documento.','err');return;}
  const T=pe.p.docTpl;T.map=T.map.filter(m=>!(m.p===p&&m.da===txt));T.map.push({p,da:txt,campo:$('wCampo').value});T.updatedAt=Date.now();
  sel.removeAllRanges();renderWordTpl();salvaDocTpl(`Collegato: ${CAMPI_W[$('wCampo').value]}.`);
}

// salva subito il documento nel progetto (senza aspettare “Salva progetto”), se il progetto esiste già
function salvaDocTpl(msg){
  const id=pe?.p?.id;const p=id&&D().progetti[id];
  if(!p||pe.isNew){if(msg)toast(msg+' Tocca “Salva progetto” per tenerlo.');return;}
  if(pe.p.docTpl){p.docTpl=clone(pe.p.docTpl);p.docTpl.updatedAt=Date.now();}else delete p.docTpl;
  p.updatedAt=Date.now();changed();if(msg)toast(msg+' Salvato nel progetto.');
}

// ---------- Documenti: compila per uno o più mesi ----------
const wSel={}; // progetto -> mesi scelti
function mesiConOre(pid){return [...new Set(eventi().filter(e=>e.pid===pid&&e.ore).map(e=>e.data.slice(0,7)))].sort().reverse().slice(0,14);}
function cardWord(p){
  const mesi=mesiConOre(p.id);
  // la scelta dei mesi vale per il mese che stai guardando: se cambi mese, riparte da quello
  if(!wSel[p.id]||wSel[p.id].per!==cur){wSel[p.id]=new Set(mesi.includes(cur)?[cur]:[]);wSel[p.id].per=cur;}
  const S=[...wSel[p.id]].filter(m=>mesi.includes(m));const v=S.length?valoriWord(p.id,S):null;
  return `<div class="card pc" style="--c:${p.colore}" data-fid="word-${p.id}" data-sum="${v?eur(v._n.netto):'—'}"><h3><i></i>${esc(p.nome)} · ${esc(p.docTpl.titolo||'Ricevuta')} (Word)</h3>
    <p class="muted sm" style="margin-top:0">Scegli uno o più mesi da mettere nello stesso documento.</p>
    <div class="row wmesi">${mesi.map(m=>`<button type="button" class="pchip sm ${S.includes(m)?'on':''}" data-wmese="${p.id}|${m}">${cap(MESI[+m.slice(5)-1].slice(0,3))} ${m.slice(2,4)}</button>`).join('')||'<span class="muted sm">Nessun mese con ore segnate.</span>'}</div>
    ${v?`<div class="kv"><span>Periodo</span><b>${esc(v.periodo)}</b></div><div class="kv"><span>Attività · ore</span><b>${v._n.att} · ${v.ore}</b></div>
    <div class="kv"><span>Competenze (lordo)</span><b>${eur(v._n.lordo)}</b></div><div class="kv"><span>Ritenuta d'acconto</span><b>− ${eur(v._n.rit)}</b></div>${v._n.inps?`<div class="kv"><span>Ritenuta INPS</span><b>− ${eur(v._n.inps)}</b></div>`:''}
    <div class="kv big"><span>Netto a pagare</span><b>${eur(v._n.netto)}</b></div>
    <label style="margin-top:8px">Data del documento<input type="date" data-wdata="${p.id}" value="${today()}"></label>
    <div class="acts"><button class="btn" data-wdoc="${p.id}">Scarica Word</button><button class="btn ghost" data-winv="${p.id}">Invia</button>${!DEMO&&DB.meta.account?`<button class="btn ghost sm" data-wdrive="${p.id}">Salva su Drive (+ PDF)</button>`:''}${fileLink(D().files[`doc|${p.id}|${S.sort().join(',')}`],'docx','Word su Drive')}${fileLink(D().files[`doc|${p.id}|${S.sort().join(',')}`],'pdf','PDF su Drive')}</div>`:''}
  </div>`;
}
async function azioneWord(pid,tipo){
  const S=[...(wSel[pid]||[])];if(!S.length){toast('Scegli almeno un mese.','err');return;}
  const data=document.querySelector(`[data-wdata="${pid}"]`)?.value||today();const p=prog(pid);
  if(!p.docTpl?.map?.length){toast('Il documento non ha dati collegati: apri il progetto e collega almeno importi e periodo, altrimenti scaricheresti il file originale.','err');return;}
  busy(true,'Compilo il documento…');
  try{
    const f=await docxCompila(pid,S,data);
    if(f.mancano.length===p.docTpl.map.length){busy(false);toast('Nessun dato è stato inserito: i testi collegati non si trovano più nel documento. Ricarica il file Word nel progetto.','err');return;}
    if(f.mancano.length){busy(false);if(!await conferma(`Non ho trovato nel documento: ${f.mancano.map(x=>'“'+x+'”').join(', ')}. Questi punti resteranno come nel file originale. Continuo?`,'Continua'))return;busy(true,'Compilo il documento…');}
    logStorico('Documento',`${p.docTpl.titolo||'Ricevuta'} ${p.nome} · ${f.v.periodo}`);persist();
    if(tipo==='scarica'){busy(false);download(f.bytes,f.nome,DOCX_MIME);if(!f.mancano.length)toast('Documento scaricato');}
    else if(tipo==='invia'){busy(false);const file=new File([f.bytes],f.nome,{type:DOCX_MIME});const ogg=`${p.docTpl.titolo||'Ricevuta'} ${f.v.periodo} – ${f.v.nome}`;
      const testo=`Buongiorno,\nin allegato ${(p.docTpl.titolo||'la ricevuta').toLowerCase()} per ${f.v.periodo}: netto ${eur(f.v._n.netto)}.\n\nGrazie,\n${f.v.nome}`;
      if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:ogg,text:testo});}catch(e){}}
      else{download(f.bytes,f.nome,DOCX_MIME);await ask(`Ho scaricato “${f.nome}”. Ora apro la posta: ricordati di allegarlo.`,[{t:'Apri la posta',v:1}]);location.href=`mailto:${encodeURIComponent(p.email||'')}?subject=${encodeURIComponent(ogg)}&body=${encodeURIComponent(testo)}`;}}
    else if(tipo==='drive'){
      if(!tokenOk()){busy(false);toast('Accedi o riconnettiti con Google (tocca la scritta in alto).','err');return;}
      const folder=await ensureFolder(p);const key=`doc|${pid}|${S.sort().join(',')}`;const rec=Object.assign({},D().files[key]);
      const blob=new Blob([f.bytes],{type:DOCX_MIME});
      const fd=rec.docx?.id&&await exists(rec.docx.id)?await uploadUpdate(rec.docx.id,{name:f.nome},blob,DOCX_MIME):await uploadNew({name:f.nome,parents:[folder]},blob,DOCX_MIME);
      rec.docx={id:fd.id,link:fd.webViewLink};
      // PDF: Google converte il Word in un documento temporaneo e lo esporta in PDF
      try{busy(true,'Creo il PDF…');const tmp=await uploadNew({name:'tmp '+f.nome,parents:[folder],mimeType:'application/vnd.google-apps.document'},blob,DOCX_MIME);
        const r=await gfetch('GET',`${DRIVE}/files/${tmp.id}/export?mimeType=application/pdf`,{raw:true});const pdf=await r.blob();await trash(tmp.id);
        const nomePdf=f.nome.replace(/\.docx$/,'.pdf');const fp=rec.pdf?.id&&await exists(rec.pdf.id)?await uploadUpdate(rec.pdf.id,{name:nomePdf},pdf,'application/pdf'):await uploadNew({name:nomePdf,parents:[folder],mimeType:'application/pdf'},pdf,'application/pdf');
        rec.pdf={id:fp.id,link:fp.webViewLink};}catch(e){toast('Word salvato su Drive. Il PDF non è riuscito: '+errMsg(e),'err');}
      rec.updatedAt=Date.now();D().files[key]=rec;changed();busy(false);renderDoc();if(rec.pdf)toast('Word e PDF salvati nella cartella del progetto');}
  }catch(e){toast(errMsg(e),'err');}finally{busy(false);}
}

// ---------- caricamento dei file: dal telefono o da Google Drive ----------
const GDOC='application/vnd.google-apps.document',GSHEET='application/vnd.google-apps.spreadsheet';
// riconosco il tipo dal contenuto, non dal nome (i file presi da Drive a volte non hanno l'estensione giusta)
async function tipoFile(buf){
  const u=new Uint8Array(buf.slice(0,8));
  if(u[0]===0xD0&&u[1]===0xCF&&u[2]===0x11&&u[3]===0xE0)return 'vecchio'; // .doc / .xls del vecchio Office
  if(u[0]===0x25&&u[1]===0x50&&u[2]===0x44&&u[3]===0x46)return 'pdf';
  if(!(u[0]===0x50&&u[1]===0x4B))return 'altro';
  const z=await JSZip.loadAsync(buf);if(z.file('word/document.xml'))return 'docx';if(z.file('xl/workbook.xml'))return 'xlsx';return 'altro';
}
async function caricaWord(nome,buf){
  const t=await tipoFile(buf);
  if(t==='vecchio')throw new Error('È un file Word vecchio (.doc). Aprilo con Word o Google Documenti e salvalo come .docx.');
  if(t==='pdf')throw new Error('È un PDF: serve il file Word (.docx) da cui è stato creato.');
  if(t!=='docx')throw new Error('Questo file non è un documento Word (.docx).');
  if(buf.byteLength>3e6)throw new Error('Il file è troppo grande (massimo 3 MB).');
  if(!/\.docx$/i.test(nome))nome=nome.replace(/\.[a-z0-9]{1,5}$/i,'')+'.docx';
  const b64=bufToB64(buf);const par=await docxLeggi(b64);const map=autoMappa(par);
  const tt=/ricevuta[^\n]{0,60}/i.exec(par.find(x=>/ricevuta/i.test(x))||'');
  pe.p.docTpl={nome,file:b64,map,titolo:tt?cap(tt[0].toLowerCase().replace(/\s+/g,' ').trim()).slice(0,60):'Ricevuta',inpsPct:par.some(x=>/11,68\s*%/.test(x))?11.68:0,updatedAt:Date.now()};
  await renderWordTpl();salvaDocTpl(map.length?`Ho riconosciuto ${map.length} dati da compilare: controllali.`:'Documento caricato: ora seleziona i testi da sostituire.');
}
async function caricaExcel(nome,buf){
  const t=await tipoFile(buf);
  if(t==='vecchio')throw new Error('È un file Excel vecchio (.xls). Aprilo con Excel o Fogli Google e salvalo come .xlsx.');
  if(t!=='xlsx')throw new Error('Questo file non è un foglio Excel (.xlsx).');
  if(!/\.xlsx$/i.test(nome))nome=nome.replace(/\.[a-z0-9]{1,5}$/i,'')+'.xlsx';
  pe.p.modello={tipo:'custom',nome,file:bufToB64(buf),map:{campi:{},tab:{row:0,cols:{}}}};$('pjModNome').textContent='File: '+nome;mapSel='nome_completo';await renderMappa();toast('Ora tocca le celle dove scrivere i dati');
}
// sceglie un file dal Google Drive (anche un Documento o un Foglio Google, che viene convertito)
async function scegliDaDrive(tipo){
  if(DEMO||!DB.meta.account)throw new Error('Per scegliere da Drive accedi prima con Google (Impostazioni → Account).');
  if(!navigator.onLine)throw new Error('Serve la connessione per aprire Google Drive.');
  const tok=await getToken(true);
  await loadScript('https://apis.google.com/js/api.js');
  await new Promise((res,rej)=>gapi.load('picker',{callback:res,onerror:rej}));
  const mimes=tipo==='word'?[DOCX_MIME,GDOC]:[XLSX_MIME,GSHEET];
  const f=await new Promise(res=>{
    const view=new google.picker.DocsView(google.picker.ViewId.DOCS).setMimeTypes(mimes.join(',')).setIncludeFolders(true);
    new google.picker.PickerBuilder().addView(view).setOAuthToken(tok).setDeveloperKey(CFG.API_KEY).setAppId(CFG.APP_ID)
      .setTitle(tipo==='word'?'Scegli il documento Word':'Scegli il foglio Excel').setLocale('it').setOrigin(location.origin)
      .setCallback(d=>{if(d.action===google.picker.Action.PICKED){const x=d.docs[0];res({id:x.id,nome:x.name,mime:x.mimeType});}else if(d.action===google.picker.Action.CANCEL)res(null);})
      .build().setVisible(true);
  });
  if(!f)return null;
  busy(true,'Scarico il file da Drive…');
  try{
    let r;
    if(f.mime===GDOC)r=await gfetch('GET',`${DRIVE}/files/${f.id}/export?mimeType=${encodeURIComponent(DOCX_MIME)}`,{raw:true});
    else if(f.mime===GSHEET)r=await gfetch('GET',`${DRIVE}/files/${f.id}/export?mimeType=${encodeURIComponent(XLSX_MIME)}`,{raw:true});
    else r=await gfetch('GET',`${DRIVE}/files/${f.id}?alt=media`,{raw:true});
    return {nome:f.nome,buf:await r.arrayBuffer()};
  }finally{busy(false);}
}

// ---------- estensioni ----------
const _renderDoc9=renderDoc;
renderDoc=function(){
  _renderDoc9();const L=progetti().filter(p=>p.docTpl?.file);if(!L.length)return;
  const box=$('docList');
  for(const p of L){if(foldState()['doc:word-'+p.id]===undefined)foldState()['doc:word-'+p.id]=true;
    const dopo=[...box.children].filter(c=>c.dataset.fold&&c.dataset.fold.includes(p.nome)).pop();
    if(dopo)dopo.insertAdjacentHTML('afterend',cardWord(p));else box.insertAdjacentHTML('afterbegin',cardWord(p));}
  foldify(box,'doc');
};
const _openProj9=openProj;
openProj=function(id){_openProj9(id);if(pe.p.docTpl)pe.p.docTpl=clone(pe.p.docTpl);renderWordTpl();};
const _readProj9=readProj;
readProj=function(){const p=_readProj9();const T=p.docTpl;if(T?.file){if($('wTit'))T.titolo=$('wTit').value.trim()||'Ricevuta';if($('wInps'))T.inpsPct=+String($('wInps').value).replace(',','.')||0;}return p;};

function bind9(){
  $('pjWordFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
    if(f.size>3e6){toast('Il file è troppo grande (massimo 3 MB).','err');return;}
    try{await caricaWord(f.name,await f.arrayBuffer());}catch(err){toast(errMsg(err),'err');}};
  $('pjWordDrive').onclick=async()=>{try{const f=await scegliDaDrive('word');if(f)await caricaWord(f.nome,f.buf);}catch(err){toast(errMsg(err),'err');}};
  $('pjModFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{await caricaExcel(f.name,await f.arrayBuffer());}catch(err){toast(errMsg(err),'err');}};
  $('pjModDrive').onclick=async()=>{try{const f=await scegliDaDrive('excel');if(f)await caricaExcel(f.nome,f.buf);}catch(err){toast(errMsg(err),'err');}};
  $('pjWord').addEventListener('click',e=>{if(e.target.id==='wAdd')collegaSelezione();const r=e.target.closest('[data-wrm]');if(r){pe.p.docTpl.map.splice(+r.dataset.wrm,1);renderWordTpl();salvaDocTpl('Collegamento tolto.');}});
  $('pjWordRm').onclick=async()=>{if(pe.p.docTpl&&await conferma('Tolgo il documento di riferimento da questo progetto?','Togli','danger')){delete pe.p.docTpl;renderWordTpl();salvaDocTpl('Documento tolto.');}};
  $('docList').addEventListener('click',e=>{const m=e.target.closest('[data-wmese]');if(m){const [pid,ym]=m.dataset.wmese.split('|');const s=wSel[pid];s.has(ym)?s.delete(ym):s.add(ym);renderDocSoft();return;}
    const g=a=>e.target.closest(`[${a}]`)?.getAttribute(a);
    if(g('data-wdoc'))azioneWord(g('data-wdoc'),'scarica');if(g('data-winv'))azioneWord(g('data-winv'),'invia');if(g('data-wdrive'))azioneWord(g('data-wdrive'),'drive');});
}
bind9();
