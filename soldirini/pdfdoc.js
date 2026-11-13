'use strict';
// ================= Soldirini v14 · documento di riferimento PDF + un solo pulsante per Word, PDF ed Excel =================
// PDF: il file non si può “modificare” come un Word. Soldirini copre il vecchio valore con un riquadro bianco
// e ci scrive sopra il nuovo (pdf-lib). I punti si riconoscono da soli dal testo del PDF (pdf.js) o si toccano sulla pagina.

async function pdfJs(){if(!window.pdfjsLib)await loadScript('lib/pdf.min.js');pdfjsLib.GlobalWorkerOptions.workerSrc='lib/pdf.worker.min.js';return pdfjsLib;}
async function pdfLib(){if(!window.PDFLib)await loadScript('lib/pdf-lib.min.js');return PDFLib;}

// testo del PDF con la posizione di ogni pezzo (coordinate PDF: punti, origine in basso a sinistra)
async function pdfLeggi(b64,maxPag=4){
  const L=await pdfJs();const doc=await L.getDocument({data:new Uint8Array(b64ToBuf(b64))}).promise;const pagine=[];
  for(let n=1;n<=Math.min(doc.numPages,maxPag);n++){const pg=await doc.getPage(n);const vp=pg.getViewport({scale:1});const tc=await pg.getTextContent();
    const items=tc.items.filter(i=>i.str&&i.str.trim()).map(i=>{const [a,b,c,d,e,f]=i.transform;return {s:i.str,x:e,y:f,w:i.width,h:Math.hypot(c,d)||Math.hypot(a,b)||10};});
    pagine.push({n:n-1,w:vp.width,h:vp.height,items,pg});}
  return {doc,pagine};
}
// riquadro di un pezzo di testo dentro un elemento (proporzionale ai caratteri)
// misuro le parole con un font simile per trovare la posizione giusta dentro la riga
const _mis=document.createElement('canvas').getContext('2d');
const largh=t=>{_mis.font='100px Arial, Helvetica, sans-serif';return _mis.measureText(t).width;};
function boxDi(it,da,i){if(i==null)i=it.s.indexOf(da);if(i<0)return null;const k=it.w/(largh(it.s)||1);
  return {x:it.x+largh(it.s.slice(0,i))*k,y:it.y,w:Math.max(largh(da)*k,4),h:it.h};}
// carattere della riga che corrisponde a una posizione x
function indiceA(it,x){const k=it.w/(largh(it.s)||1);for(let i=1;i<=it.s.length;i++)if(it.x+largh(it.s.slice(0,i))*k>=x)return i-1;return it.s.length-1;}
// quanto spazio c'è a destra prima della scritta successiva (per non sovrapporre i testi)
function spazioLibero(P,it,m,fine){let rest=it.s.slice(fine);
  if(rest&&!rest.trim().replace(/_/g,''))rest='';
  if(rest&&rest.trim().length<=2&&!/[\p{L}\d]/u.test(rest)){m.dopo=rest.trim();m.w=it.x+it.w-m.x;} // es. il punto finale: lo riscrivo dopo il nuovo testo
  else if(rest.trim()){m.lim=m.w*1.08;return;}
  const dx=P.items.filter(o=>o!==it&&Math.abs(o.y-it.y)<it.h*.6&&o.x>m.x+m.w-1).map(o=>o.x);
  m.lim=Math.max(m.w,(dx.length?Math.min(...dx)-4:P.w-36)-m.x);}
function autoMappaPdf(pagine){
  const map=[];
  for(const P of pagine){const tx=P.items.map(i=>i.s);
    const am=autoMappa(tx);
    // mese e anno nella stessa riga: li sostituisco insieme con il periodo (es. “ottobre e novembre 2026”)
    for(const m of am.filter(x=>x.campo==='mesi')){const a=am.find(x=>x.campo==='anno'&&x.p===m.p);if(!a)continue;const s=P.items[m.p].s;const i=s.indexOf(m.da),j=s.indexOf(a.da,i);
      if(i>=0&&j>i){m.campo='mesi_anno';m.mezzo=s.slice(i+m.da.length,j).replace(/_/g,' ').replace(/\s+/g,' ');m.da=s.slice(i,j+a.da.length);m.i=i;am.splice(am.indexOf(a),1);}}
    for(const m of am){const it=P.items[m.p];const b=boxDi(it,m.da,m.i);if(!b)continue;const x={pg:P.n,...b,size:it.h,cover:true,campo:m.campo,da:m.da};if(m.mezzo)x.mezzo=m.mezzo;
      spazioLibero(P,it,x,(m.i??it.s.indexOf(m.da))+m.da.length);map.push(x);}}
  return map;
}
const pulisciAnsi=s=>String(s??'').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/[^\x20-\x7E -ÿ€]/g,'');
async function pdfCompila(pid,yms,dataDoc){
  const p=prog(pid);const T=p.docTpl;const L=await pdfLib();const v=valoriWord(pid,yms,dataDoc);
  const pdf=await L.PDFDocument.load(b64ToBuf(T.file),{ignoreEncryption:true});const font=await pdf.embedFont(L.StandardFonts.Helvetica);const pages=pdf.getPages();const mancano=[];
  for(const m of T.map){const pg=pages[m.pg];if(!pg){mancano.push(m.campo==='mesi_anno'?'Mesi e anno':CAMPI_W[m.campo]||m.campo);continue;}
    let size=Math.max(6,Math.min(24,m.size||10));
    const val=m.campo==='mesi_anno'?`${v.mesi}${m.mezzo||' '}${v.anno}`:v[m.campo];const txt=pulisciAnsi(val)+(m.dopo||'');
    // se il nuovo testo non sta nello spazio libero, lo rimpicciolisco un po' (fino al 65%)
    const spazio=m.lim||m.w*1.08;let tw=font.widthOfTextAtSize(txt,size);
    if(m.cover&&tw>spazio){size=Math.max(size*.65,size*spazio/tw);tw=font.widthOfTextAtSize(txt,size);}
    const hs=Math.max(6,Math.min(24,m.size||10));
    if(m.cover)pg.drawRectangle({x:m.x-1.5,y:m.y-hs*0.3,width:Math.max(m.w,Math.min(tw,spazio))+3,height:hs*1.3,color:L.rgb(1,1,1)});
    pg.drawText(txt,{x:m.x,y:m.y,size,font,color:L.rgb(0,0,0)});}
  const bytes=await pdf.save();
  const s=[...yms].sort();const nome=`${T.titolo||'Ricevuta'} ${p.nome} ${s.length>1?`${s[0].slice(5)}-${s[s.length-1].slice(5)}`:s[0].slice(5)}-${s[s.length-1].slice(0,4)}.pdf`;
  return {bytes,nome,mancano,v};
}

// ---------- un solo pulsante per caricare Word, Google Documenti, PDF, Excel, Fogli Google ----------
async function caricaRiferimento(nome,buf){
  const t=await tipoFile(buf);
  if(t==='docx')return caricaWord(nome,buf);
  if(t==='pdf')return caricaPdf(nome,buf);
  if(t==='xlsx'){await caricaExcel(nome,buf);document.querySelectorAll('[name=pjMod]').forEach(r=>r.checked=r.value==='custom');pe.p.modello.tipo='custom';$('pjModBox').hidden=false;
    $('pjModBox').scrollIntoView({behavior:'smooth',block:'start'});toast('È un foglio Excel: tocca qui sotto le celle dove scrivere i dati, poi “Salva progetto”.');return;}
  if(t==='vecchio')throw new Error('È un file del vecchio Office (.doc o .xls): aprilo e salvalo come .docx o .xlsx, oppure esportalo in PDF.');
  throw new Error('Questo file non è un Word, un PDF o un Excel.');
}
async function caricaPdf(nome,buf){
  if(buf.byteLength>3e6)throw new Error('Il file è troppo grande (massimo 3 MB).');
  if(!/\.pdf$/i.test(nome))nome=nome.replace(/\.[a-z0-9]{1,5}$/i,'')+'.pdf';
  const b64=bufToB64(buf);busy(true,'Leggo il PDF…');
  try{
    const {pagine}=await pdfLeggi(b64);const testo=pagine.flatMap(P=>P.items.map(i=>i.s));
    const map=autoMappaPdf(pagine);const tt=/ricevuta[^\n]{0,60}/i.exec(testo.find(x=>/ricevuta/i.test(x))||'');
    pe.p.docTpl={kind:'pdf',nome,file:b64,map,titolo:tt?cap(tt[0].toLowerCase().replace(/\s+/g,' ').trim()).slice(0,60):'Ricevuta',inpsPct:testo.some(x=>/11,68\s*%/.test(x))?11.68:0,updatedAt:Date.now()};
    busy(false);await renderWordTpl();
    salvaDocTpl(map.length?`Ho riconosciuto ${map.length} dati da compilare nel PDF: controllali sull’anteprima.`:(testo.length?'PDF caricato: tocca sull’anteprima i punti dove scrivere i dati.':'PDF caricato, ma è una scansione senza testo: tocca sull’anteprima i punti dove scrivere i dati.'));
  }finally{busy(false);}
}

// ---------- impostazioni: anteprima del PDF su cui toccare ----------
let pdfAnte=null;
const _renderWordTpl14=renderWordTpl;
renderWordTpl=async function(){
  const T=pe?.p?.docTpl;if(!T||T.kind!=='pdf')return _renderWordTpl14();
  const box=$('pjWord');
  box.innerHTML=`<p class="sm"><b>${esc(T.nome)}</b> · PDF · ${T.map.length} dati collegati</p>
    <label>Nome del documento<input id="wTit" value="${esc(T.titolo||'Ricevuta')}"></label>
    <label style="margin-top:6px">Ritenuta INPS a tuo carico % (solo oltre ${eur(soglia('occ5'))} l’anno di prestazioni occasionali)<input id="wInps" inputmode="decimal" value="${esc(T.inpsPct??0)}"></label>
    <div class="wmap">${T.map.map((m,i)=>`<div class="wm"><span><b>${esc(m.campo==='mesi_anno'?'Mesi e anno':CAMPI_W[m.campo]||m.campo)}</b><small>pagina ${m.pg+1}${m.da?` · al posto di “${esc(m.da)}”`:m.cover?' · copre il testo':' · scritto in quel punto'}</small></span><button type="button" class="x" data-wrm="${i}" aria-label="Togli">×</button></div>`).join('')||'<p class="muted sm">Nessun dato collegato.</p>'}</div>
    <p class="muted sm">Per aggiungere un dato: sceglilo qui sotto, poi <b>tocca sull’anteprima</b> la scritta da sostituire (oppure un punto vuoto, dove scriverlo).</p>
    <div class="row"><select id="wCampo" style="flex:1">${Object.entries(CAMPI_W).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
    <div class="pdfante" id="pdfAnte"><p class="muted sm">Preparo l’anteprima…</p></div>`;
  try{
    const {pagine}=await pdfLeggi(T.file,3);const cont=$('pdfAnte');if(!cont)return;cont.innerHTML='';pdfAnte=[];
    const W=Math.min(520,cont.clientWidth||340);
    for(const P of pagine){
      const sc=W/P.w;const vp=P.pg.getViewport({scale:sc*2});const cv=document.createElement('canvas');cv.width=vp.width;cv.height=vp.height;
      await P.pg.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise;
      const wrap=el('div',`position:relative;width:${W}px;height:${P.h*sc}px;margin:0 auto 10px;box-shadow:0 1px 4px rgba(0,0,0,.2);background:#fff`);
      wrap.dataset.pg=P.n;wrap.dataset.sc=sc;const img=new Image();img.src=cv.toDataURL('image/jpeg',.8);img.style.cssText='width:100%;height:100%;display:block';img.alt='Pagina '+(P.n+1);wrap.appendChild(img);
      // collegamenti già fatti
      T.map.filter(m=>m.pg===P.n).forEach(m=>{const size=m.size||10;wrap.appendChild(el('div',`position:absolute;left:${(m.x-1)*sc}px;top:${(P.h-m.y-size*.95)*sc}px;width:${Math.max(m.w,size*3)*sc}px;height:${size*1.25*sc}px;border:1.5px solid #c0392b;background:rgba(192,57,43,.12);border-radius:3px;pointer-events:none`,`<span style="position:absolute;left:0;top:-14px;font:600 10px system-ui;color:#c0392b;white-space:nowrap">${esc(m.campo==='mesi_anno'?'Mesi e anno':CAMPI_W[m.campo]||m.campo)}</span>`));});
      cont.appendChild(wrap);pdfAnte.push({P,sc});
    }
  }catch(e){const c=$('pdfAnte');if(c)c.innerHTML=`<p class="note">Non riesco a mostrare il PDF: ${esc(errMsg(e))}</p>`;}
};
function tocchiPdf(e){
  const wrap=e.target.closest('[data-pg]');if(!wrap||!pe?.p?.docTpl||pe.p.docTpl.kind!=='pdf')return;
  const r=wrap.getBoundingClientRect();const sc=+wrap.dataset.sc;const A=pdfAnte.find(a=>a.P.n===+wrap.dataset.pg);if(!A)return;
  const x=(e.clientX-r.left)/sc,y=A.P.h-(e.clientY-r.top)/sc;
  // tocco su una scritta: la sostituisco; altrimenti scrivo nel punto toccato
  const it=A.P.items.find(i=>x>=i.x-2&&x<=i.x+i.w+2&&y>=i.y-i.h*.3&&y<=i.y+i.h*1.05);
  const campo=$('wCampo').value;const T=pe.p.docTpl;
  if(it){
    // prendo la parola toccata (le parole sono separate da spazi o trattini bassi)
    const sep=/[\s_]/;let i=indiceA(it,x);
    if(sep.test(it.s[i]||' ')){let l=i,r=i;while(l>0&&sep.test(it.s[l]))l--;while(r<it.s.length-1&&sep.test(it.s[r]))r++;i=sep.test(it.s[l])?r:sep.test(it.s[r])?l:(i-l<=r-i?l:r);}
    let a=i,z=i;while(a>0&&!sep.test(it.s[a-1]))a--;while(z<it.s.length-1&&!sep.test(it.s[z+1]))z++;
    const da=it.s.slice(a,z+1);if(!da.trim()){toast('Tocca più precisamente sulla scritta.','err');return;}
    const b=boxDi(it,da,a);const nm={pg:A.P.n,...b,size:it.h,cover:true,campo,da};spazioLibero(A.P,it,nm,a+da.length);T.map.push(nm);}
  else T.map.push({pg:A.P.n,x,y:y-3,w:40,h:10,size:10,cover:false,campo});
  T.updatedAt=Date.now();renderWordTpl();salvaDocTpl(`Collegato: ${CAMPI_W[campo]}.`);
}

// ---------- Documenti: stessa scheda, pulsanti per il PDF ----------
const _cardWord14=cardWord;
cardWord=function(p){let h=_cardWord14(p);if(p.docTpl?.kind==='pdf')h=h.replace('(Word)</h3>','(PDF)</h3>').replace('>Scarica Word<','>Scarica PDF<').replace('>Salva su Drive (+ PDF)<','>Salva su Drive<').replace(/<a [^>]*>Word su Drive ↗<\/a>/,'');return h;};
const _azioneWord14=azioneWord;
azioneWord=async function(pid,tipo){
  const p=prog(pid);if(p.docTpl?.kind!=='pdf')return _azioneWord14(pid,tipo);
  const S=[...(wSel[pid]||[])];if(!S.length){toast('Scegli almeno un mese.','err');return;}
  if(!p.docTpl.map?.length){toast('Il PDF non ha dati collegati: apri il progetto e tocca sull’anteprima i punti da compilare.','err');return;}
  const data=document.querySelector(`[data-wdata="${pid}"]`)?.value||today();
  busy(true,'Compilo il PDF…');
  try{const f=await pdfCompila(pid,S,data);busy(false);
    logStorico('Documento',`${p.docTpl.titolo||'Ricevuta'} ${p.nome} · ${f.v.periodo}`);persist();
    if(tipo==='scarica'){download(f.bytes,f.nome,'application/pdf');toast('PDF scaricato');}
    else if(tipo==='invia')await inviaPdf({bytes:f.bytes,name:f.nome},p,`${p.docTpl.titolo||'Ricevuta'} ${f.v.periodo} – ${f.v.nome}`,`Buongiorno,\nin allegato ${(p.docTpl.titolo||'la ricevuta').toLowerCase()} per ${f.v.periodo}: netto ${eur(f.v._n.netto)}.\n\nGrazie,\n${f.v.nome}`);
    else if(tipo==='drive'){if(!tokenOk()){toast('Accedi o riconnettiti con Google (tocca la scritta in alto).','err');return;}busy(true,'Salvo su Drive…');
      const key=`doc|${pid}|${S.sort().join(',')}`;await uploadPdf(key,f.nome,await ensureFolder(p),f.bytes);busy(false);renderDoc();toast('PDF salvato nella cartella del progetto');}
  }catch(e){toast(errMsg(e),'err');}finally{busy(false);}
};

// ---------- scelta da Drive: tutti i tipi ammessi ----------
const _scegli14=scegliDaDrive;
scegliDaDrive=async function(tipo){
  if(tipo!=='rif')return _scegli14(tipo);
  if(innerWidth<700){
    const v=await ask('Sul telefono è più comodo il selettore del telefono: tocca “Apri selettore”, poi nel menu (☰) scegli Drive e il tuo file (Word, PDF o Excel).',[{t:'Annulla',v:null,cls:'ghost'},{t:'Google Drive',v:'drive',cls:'ghost'},{t:'Apri selettore',v:'tel'}]);
    if(!v)return null;if(v==='tel'){$('pjWordFile').click();return null;}
  }
  if(DEMO||!DB.meta.account)throw new Error('Per scegliere da Drive accedi prima con Google (Impostazioni → Account).');
  if(!navigator.onLine)throw new Error('Serve la connessione per aprire Google Drive.');
  const tok=await getToken(true);await loadScript('https://apis.google.com/js/api.js');await new Promise((res,rej)=>gapi.load('picker',{callback:res,onerror:rej}));
  const mimes=[DOCX_MIME,GDOC,'application/pdf',XLSX_MIME,GSHEET,'application/msword','application/vnd.ms-excel'];
  const f=await new Promise(res=>{
    const view=new google.picker.DocsView(google.picker.ViewId.DOCS).setIncludeFolders(true).setMode(google.picker.DocsViewMode.LIST);
    new google.picker.PickerBuilder().addView(view).addView(new google.picker.DocsView(google.picker.ViewId.RECENTLY_PICKED)).setSelectableMimeTypes(mimes.join(',')).enableFeature(google.picker.Feature.SUPPORT_DRIVES)
      .setOAuthToken(tok).setDeveloperKey(CFG.API_KEY).setAppId(CFG.APP_ID).setSize(Math.min(1051,innerWidth-16),Math.min(650,innerHeight-40))
      .setTitle('Scegli il documento (Word, PDF o Excel)').setLocale('it').setOrigin(location.origin)
      .setCallback(d=>{if(d.action===google.picker.Action.PICKED){const x=d.docs[0];res({id:x.id,nome:x.name,mime:x.mimeType});}else if(d.action===google.picker.Action.CANCEL)res(null);})
      .build().setVisible(true);});
  if(!f)return null;
  if(/msword|ms-excel/.test(f.mime||''))throw new Error('È un file del vecchio Office (.doc o .xls): aprilo e salvalo come .docx o .xlsx, oppure esportalo in PDF.');
  busy(true,'Scarico il file da Drive…');
  try{let r;
    if(f.mime===GDOC)r=await gfetch('GET',`${DRIVE}/files/${f.id}/export?mimeType=${encodeURIComponent(DOCX_MIME)}`,{raw:true});
    else if(f.mime===GSHEET)r=await gfetch('GET',`${DRIVE}/files/${f.id}/export?mimeType=${encodeURIComponent(XLSX_MIME)}`,{raw:true});
    else r=await gfetch('GET',`${DRIVE}/files/${f.id}?alt=media`,{raw:true});
    return {nome:f.nome,buf:await r.arrayBuffer()};}finally{busy(false);}
};

function bind14(){
  $('pjWordFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;if(f.size>3e6){toast('Il file è troppo grande (massimo 3 MB).','err');return;}
    try{await caricaRiferimento(f.name,await f.arrayBuffer());}catch(err){busy(false);toast(errMsg(err),'err');}};
  $('pjWordDrive').onclick=async()=>{try{const f=await scegliDaDrive('rif');if(f)await caricaRiferimento(f.nome,f.buf);}catch(err){busy(false);toast(errMsg(err),'err');}};
  $('pjWord').addEventListener('click',tocchiPdf);
}
bind14();
