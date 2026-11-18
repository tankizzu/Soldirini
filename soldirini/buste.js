'use strict';
// ================= Soldirini v15 · lettura delle buste paga =================
// Ripreso da Strafobico: testo del PDF con le posizioni (pdf.js), foto e scansioni lette con Tesseract (solo quando serve),
// poi ricerca delle voci principali (lordo, trattenute, netto, ferie, ROL, ex festività).
(function(g){
  const TESSERACT_URL='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  let lettore=null;
  const script=url=>new Promise((ok,ko)=>{if(document.querySelector(`script[src="${url}"]`)&&g.Tesseract)return ok();const s=document.createElement('script');s.src=url;s.onload=ok;s.onerror=()=>ko(new Error('non riesco a scaricare il lettore di testo: controlla la connessione'));document.head.appendChild(s);});
  async function preparaLettore(prog){
    if(lettore)return lettore;prog&&prog(0.05,'Scarico il lettore di testo (solo la prima volta)…');
    await script(TESSERACT_URL);
    lettore=await g.Tesseract.createWorker('eng',1,{logger:m=>{if(m.status&&/load|init/i.test(m.status)&&m.progress!=null)prog&&prog(0.05+0.2*m.progress);}});
    return lettore;
  }
  const immagine=file=>new Promise((ok,ko)=>{const u=URL.createObjectURL(file),i=new Image();i.onload=()=>{URL.revokeObjectURL(u);ok(i);};i.onerror=()=>ko(new Error('il file non sembra un’immagine'));i.src=u;});
  // v24.0.1: le righe e le colonne delle tabelle confondono Tesseract (numeri e etichette persi nelle caselle):
  // prima di leggere, i tratti scuri lunghi (orizzontali o verticali) diventano bianchi. Il testo resta.
  function senzaLinee(tela){
    try{const W=tela.width,H=tela.height,cx=tela.getContext('2d'),im=cx.getImageData(0,0,W,H),d=im.data,L=Math.max(60,Math.round(Math.max(W,H)*0.06)); // una linea è lunga: le barre unite di "TT" in grassetto no
      const scuro=new Uint8Array(W*H);for(let i=0,j=0;i<d.length;i+=4,j++)scuro[j]=(d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114)<160?1:0;
      const S=Math.max(4,Math.round(Math.min(W,H)*0.006)); // spessore massimo di una linea: i riquadri scuri pieni (testo bianco su fondo scuro) restano
      const oriz=new Uint8Array(W*H),vert=new Uint8Array(W*H),via=new Uint8Array(W*H);
      for(let y=0;y<H;y++){let x=0;while(x<W){if(scuro[y*W+x]){const a=x;while(x<W&&scuro[y*W+x])x++;if(x-a>=L)for(let k=a;k<x;k++)oriz[y*W+k]=1;}else x++;}}
      for(let x=0;x<W;x++){let y=0;while(y<H){if(scuro[y*W+x]){const a=y;while(y<H&&scuro[y*W+x])y++;if(y-a>=L)for(let k=a;k<y;k++)vert[k*W+x]=1;}else y++;}}
      for(let x=0;x<W;x++){let y=0;while(y<H){if(oriz[y*W+x]){const a=y;while(y<H&&oriz[y*W+x])y++;if(y-a<=S)for(let k=a;k<y;k++)via[k*W+x]=1;}else y++;}}
      for(let y=0;y<H;y++){let x=0;while(x<W){if(vert[y*W+x]){const a=x;while(x<W&&vert[y*W+x])x++;if(x-a<=S)for(let k=a;k<x;k++)via[y*W+k]=1;}else x++;}}
      for(let j=0;j<via.length;j++)if(via[j]){const i=j*4;d[i]=d[i+1]=d[i+2]=255;}
      cx.putImageData(im,0,0);}catch(e){/* se non si può leggere la tela, si va avanti senza */}
  }
  // v24.0.1: un importo stampato con spazi ("1. 234, 50", "2.345, 67", importi inventati) arriva in più pezzi: li riunisco
  function unisciNumeri(pezzi){
    const out=[];const yc=p=>(p.y0+p.y1)/2,linee=[];
    pezzi.slice().sort((a,b)=>yc(a)-yc(b)).forEach(p=>{const l=linee.find(l=>Math.abs(l.y-yc(p))<Math.max(1,p.y1-p.y0)*0.5);if(l)l.el.push(p);else linee.push({y:yc(p),el:[p]});});
    const S=[].concat(...linee.map(l=>l.el.sort((a,b)=>a.x0-b.x0)));
    const ok=t=>/^\d{1,3}(\.\d{3})*,\d{2}$|^\d+,\d{2}$/.test(t);
    for(let i=0;i<S.length;i++){let p=Object.assign({},S[i]);
      while(i+1<S.length){const q=S[i+1],h=Math.max(1,p.y1-p.y0),stessa=Math.abs((p.y0+p.y1)/2-(q.y0+q.y1)/2)<h*0.5,vicino=q.x0-p.x1<h*1.2&&q.x1>p.x1;
        const t=p.t+q.t;
        if(stessa&&vicino&&(/[.,]$/.test(p.t)||/^[.,]/.test(q.t))&&/^[\d.,]+$/.test(p.t)&&/^[\d.,]+$/.test(q.t)&&(ok(t)||/^\d{1,3}[.,]$/.test(t)||/^\d{1,3}\.\d{3},$/.test(t)||/^\d+,$/.test(t))){
          p={t,x0:Math.min(p.x0,q.x0),y0:Math.min(p.y0,q.y0),x1:Math.max(p.x1,q.x1),y1:Math.max(p.y1,q.y1)};i++;} else break;}
      out.push(p);}
    return out;
  }
  /** Testo della busta con le posizioni: [{t,x0,y0,x1,y1}] (y dall'alto, +10000 per ogni pagina). */
  async function testoBusta(file,prog){
    const pezzi=[];
    const ocr=async(tela,pag)=>{const w=await preparaLettore(prog);prog&&prog(0.4,'Leggo il testo…');senzaLinee(tela);await w.setParameters({tessedit_pageseg_mode:'3'});const {data}=await w.recognize(tela);
      (data.words||[]).forEach(p=>pezzi.push({t:p.text,x0:p.bbox.x0,y0:p.bbox.y0+pag*10000,x1:p.bbox.x1,y1:p.bbox.y1+pag*10000}));};
    if(/pdf/i.test(file.type)||/\.pdf$/i.test(file.name)){
      prog&&prog(0.1,'Apro il PDF…');
      const lib=await pdfJs(),doc=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;
      for(let n=1;n<=Math.min(doc.numPages,3);n++){
        const pag=await doc.getPage(n),vp=pag.getViewport({scale:1}),tc=await pag.getTextContent();const prima=pezzi.length;
        tc.items.forEach(it=>{if(!it.str||!it.str.trim())return;const hh=Math.abs(it.transform[3])||it.height||8,x=it.transform[4],y=vp.height-it.transform[5];
          const tot=it.str.length,lw=(it.width||hh*0.5*tot)/tot;
          it.str.replace(/\S+/g,(w,i)=>{pezzi.push({t:w,x0:x+i*lw,x1:x+(i+w.length)*lw,y0:y-hh+(n-1)*10000,y1:y+(n-1)*10000});return w;});});
        if(pezzi.length-prima<15){ // PDF scansionato: lo leggo come immagine
          prog&&prog(0.3,'Il PDF è una scansione: leggo l’immagine (pagina '+n+')…');
          const v2=pag.getViewport({scale:2.5}),c=document.createElement('canvas');c.width=v2.width;c.height=v2.height;
          await pag.render({canvasContext:c.getContext('2d'),viewport:v2}).promise;await ocr(c,n-1);}
      }
    } else {
      prog&&prog(0.2,'Leggo la foto…');
      const img=await immagine(file),s=Math.min(3,Math.max(1,2400/img.naturalWidth));
      const c=document.createElement('canvas');c.width=img.naturalWidth*s;c.height=img.naturalHeight*s;
      const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);await ocr(c,0);
    }
    return pezzi;
  }

  // v22: parti comuni alla busta paga e al cedolino della pensione (righe, etichette, valori)
  function struttura(pezzi) {
    const N = s => String(s).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const numero = s => {
      let t = String(s).replace(/[€\s]/g, ''); const neg = /-$|^-/.test(t); t = t.replace(/^-|-$/g, '');
      if (!/^\d{1,3}([.,]\d{3})*([.,]\d{1,2})?$|^\d+([.,]\d+)?$/.test(t)) return null;
      if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
      else if (/\.\d{1,2}$/.test(t) && /,/.test(t)) t = t.replace(/,/g, '');
      else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
      else t = t.replace(',', '.');
      const v = parseFloat(t); return isNaN(v) ? null : (neg ? -v : v);
    };
    const P = unisciNumeri(pezzi).map(p => Object.assign({}, p, { u: N(p.t), yc: (p.y0 + p.y1) / 2, h: p.y1 - p.y0, v: numero(p.t) }));
    const hs = P.map(p => p.h).sort((a, b) => a - b), H = hs[Math.floor(hs.length / 2)] || 10;
    // righe
    const righe = [];
    P.slice().sort((a, b) => a.yc - b.yc).forEach(p => { const r = righe.find(r => Math.abs(r.yc - p.yc) < H * 0.55); if (r) r.el.push(p); else righe.push({ yc: p.yc, el: [p] }); });
    righe.forEach(r => { r.el.sort((a, b) => a.x0 - b.x0); r.testo = r.el.map(p => p.u).join(' '); });
    const testo = righe.map(r => r.el.map(p => p.t).join(' ')).join('\n');
    // etichetta = gruppo di parole consecutive nella stessa riga che corrisponde all'espressione
    const trova = re => {
      const out = [];
      righe.forEach(r => { for (let i = 0; i < r.el.length; i++) for (let j = i; j < Math.min(r.el.length, i + 5); j++) {
        const s = r.el.slice(i, j + 1).map(p => p.u).join(' ');
        if (re.test(s)) { out.push({ riga: r, x0: r.el[i].x0, x1: r.el[j].x1, yc: r.yc, j }); i = j; break; }
      } });
      return out;
    };
    // valore: il numero più vicino a destra sulla stessa riga, altrimenti il più vicino sotto l'etichetta
    // 24.2: ok(p) controlla il numero trovato; se non va bene il valore resta vuoto (non si passa al numero dopo, che è di un'altra voce)
    const valoreDi = (e, ok = () => true) => {
      const dx = e.riga.el.slice(e.j + 1).filter(p => p.v != null && p.x0 >= e.x1 - 2);
      if (dx.length) return ok(dx[0]) ? dx[0].v : null;
      const sotto = P.filter(p => p.v != null && p.yc > e.yc + H * 0.4 && p.yc < e.yc + H * 4.5 && p.x1 > e.x0 - H * 2 && p.x0 < e.x1 + H * 8)
        .sort((a, b) => (a.yc - b.yc) || (Math.abs(a.x1 - e.x1) - Math.abs(b.x1 - e.x1)));
      return sotto.length && ok(sotto[0]) ? sotto[0].v : null;
    };
    const primoCon = (ok, ...re) => { for (const r of re) for (const e of trova(r)) { const v = valoreDi(e, ok); if (v != null && v > 0) return v; } return null; };
    const primo = (...re) => primoCon(() => true, ...re);
    const conCentesimi = p => /[.,]\d{2}-?$/.test(p.t); // 24.2: importo stampato con i centesimi ("1.23500" o "1004" sono letti male)
    return { N, numero, P, H, righe, testo, trova, valoreDi, primo, primoCon, conCentesimi };
  }
  const MM = ['GENNAIO','FEBBRAIO','MARZO','APRILE','MAGGIO','GIUGNO','LUGLIO','AGOSTO','SETTEMBRE','OTTOBRE','NOVEMBRE','DICEMBRE'];
  function analizzaBusta(pezzi) {
    const { N, numero, P, H, righe, testo, primo, primoCon, conCentesimi } = struttura(pezzi);
    // 24.2: gli importi (netto, totali, imponibile, contributi) valgono solo se stampati con i centesimi: un pezzo letto a metà
    // ("1004") o con la virgola persa ("1.23500" → 1,235) resta vuoto invece di dare un valore sbagliato
    let netto = primoCon(conCentesimi, /^NETTO (DEL MESE|A PAGARE|IN BUSTA|BUSTA|DA PAGARE|IN PAGAMENTO)$/, /^NETTO$/);
    // v22: l'imponibile previdenziale NON è il lordo (report 04, caso T-C6): ha un campo suo
    let lordo = primo(/^TOT(ALE|\.)? ?COMPETENZE$/, /^COMPETENZE LORDE$/, /^(RETRIBUZIONE|TOTALE) LORD[AO]$/);
    if (lordo == null) lordo = primoCon(conCentesimi, /^TOTALI$/);
    // v22: voci per la pensione (etichette ipotizzate da 04: vanno sempre controllate dall'utente)
    const imponibilePrev = primoCon(conCentesimi, /^IMPONIBILE PREVIDENZIALE$/, /^IMPON(IBILE|\.)? ?PREVID(ENZIALE|\.)?$/, /^IMPON(IBILE|\.)? ?INPS$/, /^IMPONIBILE CONTRIBUTIVO$/, /^IMPON(IBILE|\.)? ?CONTR(IBUTIVO|IBUTI|\.)? ?MESE$/);
    // 24.2: "CONTRIBUTI INPS" prima di "CONTRIBUTI IVS" (nelle buste TeamSystem "CONTRIBUTI IVS" è una riga di voce con la base)
    const contribLav = primoCon(conCentesimi, /^CONTRIBUTI PREVIDENZIALI$/, /^CONTRIBUT[OI] INPS$/, /^CONTR(IBUTI|\.)? ?IVS$/, /^F\.? ?P\.? ?L\.? ?D\.?$/, /^TOT(ALE|\.)? ?CONTRIBUTI$/);
    const gi = primo(/^(GG|GIORNI) INPS$/, /^GIORNI RETRIBUITI$/);
    const giorniInps = gi != null && gi <= 31 && Number.isInteger(gi) ? gi : null;
    let trattenute = primo(/^TOT(ALE|\.)? ?TRATTENUTE$/, /^TOTALE RITENUTE$/);
    // v24.0.1: riga "TOTALI" con due importi (competenze e trattenute): il secondo sono le trattenute
    if (trattenute == null && lordo != null) { const rt = righe.find(r => r.el.some(p => p.u === 'TOTALI'));
      const nn = rt ? rt.el.filter(p => p.v != null && p.v > 0 && conCentesimi(p)).sort((a, b) => a.x0 - b.x0) : [];
      if (nn.length >= 2 && nn[0].v === lordo && nn[1].v < lordo) trattenute = nn[1].v; }
    // v24.0.1: un netto più piccolo dei contributi non è credibile (pezzo di un numero letto male): meglio vuoto che sbagliato
    if (netto != null && contribLav != null && netto < contribLav) netto = null;
    // v17: totali senza etichetta (es. sotto le colonne COMPETENZE e TRATTENUTE): due importi sulla stessa riga con competenze − trattenute = netto
    if (netto != null && (lordo == null || trattenute == null)) {
      cerca: for (const r of righe) { const nn = r.el.filter(p => p.v != null && p.v > 0);
        for (let i = 0; i < nn.length; i++) for (let j = i + 1; j < nn.length; j++) if (Math.abs(nn[i].v - nn[j].v - netto) < 0.6) {
          if (lordo == null) lordo = nn[i].v; if (trattenute == null) trattenute = nn[j].v; break cerca; } }
    }
    // v24.0.1: se lordo e trattenute ci sono ma il netto non torna (oltre 1 € di arrotondamento), il netto letto è sbagliato
    if (netto != null && lordo != null && trattenute != null && Math.abs(lordo - trattenute - netto) > 1) netto = null;
    // 24.2: netto molto più piccolo delle trattenute, che non torna con i totali: è letto male → vuoto (o ricalcolato dai totali)
    if (netto != null && trattenute != null && netto < trattenute * 0.5 && !(lordo != null && Math.abs(lordo - trattenute - netto) <= 1)) netto = null;
    if (netto != null && lordo != null && trattenute == null && lordo > netto) trattenute = Math.round((lordo - netto) * 100) / 100;
    // mese (24.2): mai da una data con il giorno (v24.0.1). 1) vicino a MESE / PERIODO / RETRIBUZIONE / COMPETENZA (stessa riga
    // o quella sotto): "OTTOBRE 2026" oppure un "10/2026" isolato; 2) altrimenti nel resto del testo, se c'è un mese solo;
    // 3) con due mesi diversi, o nessuno, resta vuoto (meglio vuoto che sbagliato)
    const T = N(testo), ym = (a, m) => a + '-' + String(m).padStart(2, '0');
    const RE_NOME = new RegExp('\\b(' + MM.join('|') + ')\\s*(20\\d\\d)\\b', 'g'), RE_NUM = /(?<![\d\/.\-])(0?[1-9]|1[0-2])[\/\-.](20\d\d)(?![\d\/.\-])/g;
    const mesiIn = s => [...[...s.matchAll(RE_NOME)].map(m => ym(m[2], MM.indexOf(m[1]) + 1)), ...[...s.matchAll(RE_NUM)].map(m => ym(m[2], +m[1]))];
    const vicini = new Set();
    righe.forEach((r, i) => { if (/\b(MESE|PERIODO|RETRIBUZIONE|COMPETENZA)\b/.test(r.testo)) { mesiIn(r.testo).forEach(m => vicini.add(m));
      const sotto = righe[i + 1]; if (sotto && sotto.yc - r.yc < H * 3) mesiIn(sotto.testo).forEach(m => vicini.add(m)); } });
    const tutti = new Set(mesiIn(T));
    const mese = vicini.size === 1 ? [...vicini][0] : vicini.size === 0 && tutti.size === 1 ? [...tutti][0] : null;
    // saldo di una riga del riepilogo ferie/permessi: "Saldo 12,00" sulla riga, oppure la colonna Saldo/Residuo, oppure l'ultimo numero
    const saldoDi = rf => {
      if (!rf) return { v: null, unita: null };
      let v = null;
      const kw = rf.testo.match(/(SALDO|RESIDU[OEI]|DA GODERE|RIMANENZA|SPETTANTI RESIDU[OEI])\s*:?\s*(-?[\d.,]+-?)/);
      if (kw) v = numero(kw[2]);
      if (v == null) {
        const pul = u => u.replace(/^[\s|\[(]+/, ''); // v24.0.2: "|RESIDUO" o "RESDUO" letti dalla foto
        const testa = P.filter(p => /^(SALDO|RESI?DU[OEI]?|RESID\.?|DA|RIMAN)/.test(pul(p.u)) && !/^RES\.?$/.test(pul(p.u)) && p.yc < rf.yc && p.yc > rf.yc - H * 14); // 24.2: H*8 → H*14 (tabella con 4 righe sotto l'intestazione)
        const nums = rf.el.filter(p => p.v != null);
        if (testa.length) {
          const t0 = testa.sort((a, c) => c.yc - a.yc)[0], xc = (t0.x0 + t0.x1) / 2;
          const n0 = nums.sort((a, c) => Math.abs((a.x0 + a.x1) / 2 - xc) - Math.abs((c.x0 + c.x1) / 2 - xc))[0];
          // v24.0.2: il numero deve stare sotto la colonna del residuo; se è lontano (altra tabella) la riga è vuota
          v = Math.abs((n0.x0 + n0.x1) / 2 - xc) <= Math.max(t0.x1 - t0.x0, H * 3) ? n0.v : null;
        } else if (nums.length >= 3) {
          v = null; // 24.2b: colonna RESIDUO non trovata e 3 o più numeri: non si sa quale sia il residuo (potrebbe essere la PROIEZIONE) → vuoto
        } else if (!rf.senzaEtichetta) {
          // v24.0.2: senza intestazione, l'ultimo numero del gruppo vicino all'etichetta (un numero molto più a destra è di un'altra tabella)
          let k = 0; while (k + 1 < nums.length && nums[k + 1].x0 - nums[k].x1 < H * 8) k++; v = nums[k].v;
        }
      }
      // 24.2: nella tabella ferie/permessi i valori hanno i decimali: uno senza, in una riga dove gli altri li hanno, è letto male → vuoto
      const sc = rf.el.find(p => p.v === v);
      if (v != null && sc && !/[.,]\d{1,2}$/.test(sc.t) && rf.el.filter(p => p.v != null && /[.,]\d{2}$/.test(p.t)).length >= 2) v = null;
      const vicino = righe.filter(r => Math.abs(r.yc - rf.yc) < H * 8).map(r => r.testo).join(' ');
      // prima guardo la riga stessa (es. "FERIE GG"), poi le righe vicine
      const propria = /\b(GG|GIORNI)\b/.test(rf.testo) ? 'giorni' : /\bORE\b|\bH\b/.test(rf.testo) ? 'ore' : null;
      return { v, unita: propria || (/\bORE\b|\bH\b/.test(vicino) ? 'ore' : /\b(GG|GIORNI)\b/.test(vicino) ? 'giorni' : null) };
    };
    const conNumeri = r => r.el.some(p => p.v != null);
    // v24.0.2: nelle foto i numeri di una riga della tabella possono finire mezza riga sotto l'etichetta ("EX FEST." e sotto i numeri):
    // un'etichetta senza numeri si unisce alla riga subito sotto, se quella ha solo numeri a destra dell'etichetta
    const LAB = /[A-Z]{3}/;
    const conSotto = (r, re) => { if (conNumeri(r)) return r;
      const lab = r.el.find(p => LAB.test(p.u) && re(p.u)) || r.el.find(p => LAB.test(p.u)); if (!lab) return r;
      // nella riga sotto, nessuna altra etichetta all'altezza della colonna delle etichette (a sinistra può esserci testo a margine)
      const s = righe.find(q => q !== r && q.yc > r.yc && q.yc - r.yc < H * 1.3 && conNumeri(q) && !q.el.some(p => p.v == null && LAB.test(p.u) && p.x0 > lab.x0 - H && p.x0 < lab.x1 + H * 6));
      if (!s) return r;
      // i numeri vanno all'etichetta più vicina: se un'altra etichetta della colonna è più vicina a quella riga, non sono di questa
      const altra = righe.some(q => q !== r && q !== s && Math.abs(q.yc - s.yc) <= s.yc - r.yc && q.el.some(p => p.v == null && LAB.test(p.u) && p.x0 > lab.x0 - H && p.x0 < lab.x1 + H * 2));
      return altra ? r : { yc: r.yc, el: r.el.concat(s.el).sort((a, c) => a.x0 - c.x0), testo: r.testo + ' ' + s.testo }; };
    const etichetta = (re, rp = () => true) => { for (const r of righe.slice().sort((a, c) => a.yc - c.yc)) if (re(r)) { const u = conSotto(r, rp); if (conNumeri(u)) return u; } return null; };
    const EXF = /EX[\s.\-]*FEST|FESTIVITA'?\s*(SOPPRESSE|NON GODUTE|ABOLITE|RIDOTTE)|FEST\.?\s*SOPPR/;
    // ferie: riga che inizia con FERIE (non permessi o ex festività)
    let rf = etichetta(r => /^FERIE\b/.test(r.testo), u => /^FERIE/.test(u)) || etichetta(r => /\bFERIE\b/.test(r.testo) && !/PERMESS|FESTIVIT|ROL\b/.test(r.testo));
    // v24.0.2: etichetta "FERIE" persa nella foto. Tabella con MATURATO / GODUTO / RESIDUO: la prima riga sotto le intestazioni,
    // con almeno due numeri e senza un'etichetta leggibile, è quella delle ferie (prima riga della tabella)
    if (!rf) { const th = righe.find(r => /MATURAT/.test(r.testo) && /GODUT/.test(r.testo) && /RESI?DU/.test(r.testo));
      const q = th && righe.filter(r => r.yc > th.yc && r.yc - th.yc < H * 3 && conNumeri(r)).sort((a, c) => a.yc - c.yc)[0];
      const n1 = q && q.el.find(p => p.v != null);
      if (q && q.el.filter(p => p.v != null).length >= 2 && !q.el.some(p => p.v == null && LAB.test(p.u) && p.x0 < n1.x0)) rf = Object.assign({}, q, { senzaEtichetta: true }); }
    // permessi ROL (riduzione orario di lavoro)
    // 24.2: prima la riga R.O.L. / riduzione orario; "PERMESSI" solo se non c'è (nelle buste TeamSystem sono righe diverse)
    const rr = etichetta(r => r !== rf && /\bR\.?O\.?L\.?\b|RIDUZ(IONE|\.)?\s*ORARIO/.test(r.testo) && !EXF.test(r.testo))
      || etichetta(r => r !== rf && /^PERMESS[OI]\b(?!.*(STUDIO|SINDAC|ELETTOR|LUTTO|104))/.test(r.testo) && !EXF.test(r.testo));
    // ex festività / festività non godute
    const rx = etichetta(r => r !== rf && (!rr || r.yc !== rr.yc) && EXF.test(r.testo), u => /^EX/.test(u));
    const sf = saldoDi(rf), sr = saldoDi(rr), sx = saldoDi(rx);
    const ferieV = sf.v, unita = sf.unita;
    return { mese, lordo, trattenute, netto: netto != null ? netto : (lordo != null && trattenute != null ? Math.round((lordo - trattenute) * 100) / 100 : null), ferie: ferieV, unita, rol: sr.v, exfest: sx.v, unitaPermessi: sr.unita || sx.unita || 'ore', imponibilePrev, contribLav, giorniInps, testo };
  }

  // ---------- v22: cedolino della pensione INPS ----------
  // Etichette dalle guide INPS alla lettura del cedolino (report 04 · Fisco, 15/11/2026); alcune non sono verificate su
  // cedolini veri: ogni valore letto va controllato dall'utente. Si restituiscono SOLO numeri: nessun testo del PDF
  // (contiene codice fiscale, indirizzo e conto di accredito) e nessuna descrizione delle "altre trattenute" (D-039).
  function analizzaCedolino(pezzi) {
    const { N, numero, righe } = struttura(pezzi);
    // importo della riga: l'ultimo numero con due decimali (non l'anno citato nella descrizione)
    const importo = r => { const v = r.el.filter(p => p.v != null && /[.,]\d{2}-?$/.test(p.t.replace(/[€\s]/g, ''))); return v.length ? Math.abs(v[v.length - 1].v) : null; };
    const out = { pensioneLorda: null, lordoPagamento: null, irpef: null, addReg: null, addComSaldo: null, addComAcconto: null, conguagliDebito: null, altreTrattenute: null, netto: null, crediti: [] };
    const somma = (k, v) => { out[k] = Math.round(((out[k] || 0) + v) * 100) / 100; };
    const primoV = (k, v) => { if (out[k] == null) out[k] = v; };
    for (const r of righe) {
      const t = r.testo, v = importo(r); if (v == null) continue;
      if (/^PENSIONE LORDA\b/.test(t)) primoV('pensioneLorda', v);
      else if (/^IMPORTO LORDO( DEL PAGAMENTO)?\b/.test(t)) primoV('lordoPagamento', v);
      else if (/^IMPORTO NETTO( DEL PAGAMENTO)?\b/.test(t)) primoV('netto', v);
      else if (/^ACCONTO ADDIZIONALE( IRPEF)? COMUNALE\b/.test(t)) somma('addComAcconto', v);
      else if (/^ADDIZIONALE( IRPEF)? COMUNALE\b/.test(t)) somma('addComSaldo', v);
      else if (/^ADDIZIONALE( IRPEF)? REGIONALE\b/.test(t)) somma('addReg', v);
      else if (/^(TRATTENUTE IRPEF|IRPEF NETTA)\b/.test(t)) primoV('irpef', v);
      else if (/QUATTORDICESIMA/.test(t)) out.crediti.push({ tipo: '14', descr: 'Quattordicesima', importo: v });
      else if (/IMPORTO AGGIUNTIVO/.test(t)) out.crediti.push({ tipo: 'aggiuntivo', descr: 'Importo aggiuntivo', importo: v });
      else if (/^TREDICESIMA\b|\b13\W? ?MENSILITA\b/.test(t)) out.crediti.push({ tipo: '13', descr: 'Tredicesima', importo: v });
      else if (/^CONGUAGLIO A CREDITO IRPEF\b/.test(t)) out.crediti.push({ tipo: 'rimborso', descr: 'Conguaglio a credito IRPEF', importo: v });
      else if (/^CONGUAGLIO PER ARRETRATI\b/.test(t)) out.crediti.push({ tipo: 'arretrati', descr: 'Arretrati', importo: v });
      else if (/^CONGUAGLIO IRPEF A DEBITO\b|^IRPEF ANNI PRECEDENTI\b|\b730\b.*\bDEBITO\b/.test(t)) somma('conguagliDebito', v);
      else if (/^CONTRIBUTO ASSOCIATIVO\b|^CONTRIBUTO EX ONPI\b|^TRATTENUTA MENSILE RECUPERO\b|^CESSIONE\b|\bDEBITO ANNO\b/.test(t)) somma('altreTrattenute', v);
    }
    const T = N(righe.map(r => r.el.map(p => p.t).join(' ')).join('\n'));
    let mese = null;
    const m1 = T.match(new RegExp('(?:RATA|MESE)\\s+(?:DI\\s+)?(' + MM.join('|') + ')\\s*(20\\d\\d)')) || T.match(new RegExp('(' + MM.join('|') + ')\\s*(20\\d\\d)'));
    if (m1) mese = m1[2] + '-' + String(MM.indexOf(m1[1]) + 1).padStart(2, '0');
    let dataAccredito = null;
    const v1 = T.match(new RegExp('VALUTA\\s*(?:DEL\\s*|AL\\s*)?(\\d{1,2})\\s*[°ºO]?\\s*(' + MM.join('|') + ')\\s*(20\\d\\d)'));
    const v2 = T.match(/VALUTA\s*(?:DEL\s*|AL\s*)?(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d\d)/);
    if (v1) dataAccredito = `${v1[3]}-${String(MM.indexOf(v1[2]) + 1).padStart(2, '0')}-${String(+v1[1]).padStart(2, '0')}`;
    else if (v2) dataAccredito = `${v2[3]}-${String(+v2[2]).padStart(2, '0')}-${String(+v2[1]).padStart(2, '0')}`;
    return Object.assign(out, { mese, dataAccredito });
  }

  // ---------- v16: testo di un documento qualsiasi (contratto o busta) diviso in righe ----------
  async function testoDocumento(file,prog,maxPag=40){
    const isPdf=/pdf/i.test(file.type)||/\.pdf$/i.test(file.name);
    let pezzi;
    if(isPdf){
      prog&&prog(0.1,'Apro il PDF…');
      const lib=await pdfJs(),doc=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;pezzi=[];
      for(let n=1;n<=Math.min(doc.numPages,maxPag);n++){const pag=await doc.getPage(n),vp=pag.getViewport({scale:1}),tc=await pag.getTextContent();
        prog&&prog(0.1+0.6*n/Math.min(doc.numPages,maxPag),'Leggo la pagina '+n+'…');
        tc.items.forEach(it=>{if(!it.str||!it.str.trim())return;const hh=Math.abs(it.transform[3])||8;pezzi.push({t:it.str,x0:it.transform[4],x1:it.transform[4]+(it.width||0),y0:vp.height-it.transform[5]-hh+(n-1)*10000,y1:vp.height-it.transform[5]+(n-1)*10000});});}
      if(pezzi.length<15)pezzi=await testoBusta(file,prog); // scansione: OCR delle prime pagine
    } else pezzi=await testoBusta(file,prog);
    const hs=pezzi.map(p=>p.y1-p.y0).sort((a,b)=>a-b),H=hs[Math.floor(hs.length/2)]||10;const righe=[];
    pezzi.map(p=>Object.assign({yc:(p.y0+p.y1)/2},p)).sort((a,b)=>a.yc-b.yc).forEach(p=>{const r=righe.find(r=>Math.abs(r.yc-p.yc)<H*0.55);if(r)r.el.push(p);else righe.push({yc:p.yc,el:[p]});});
    return righe.map(r=>r.el.sort((a,b)=>a.x0-b.x0).map(p=>p.t).join(' ').replace(/\s+/g,' ').trim()).filter(Boolean);
  }
  // numeri all'italiana: 1.680,00 · 1680,5 · 25
  const numIt=t=>{t=String(t).replace(/[€\s]/g,'');if(!/^\d{1,3}(\.\d{3})*(,\d{1,4})?$|^\d+([.,]\d{1,4})?$/.test(t))return null;
    if(/,\d+$/.test(t))t=t.replace(/\./g,'').replace(',','.');else if(/^\d{1,3}(\.\d{3})+$/.test(t))t=t.replace(/\./g,'');return parseFloat(t);};
  const numeriIn=s=>(s.match(/\d{1,3}(?:\.\d{3})*(?:,\d{1,4})?|\d+(?:[.,]\d{1,4})?/g)||[]).map(numIt).filter(v=>v!=null);
  /** Valori utili per impostare un lavoro, trovati nel testo di un contratto o di una busta paga.
   *  Restituisce {chiave:{v, testo}} con il pezzo di testo da cui viene il valore (da mostrare all'utente). */
  function suggerisci(righe){
    const N=s=>String(s).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
    // anche frasi lunghe dei contratti: unisco le righe e divido per frase
    const frasi=[...righe.join(' ').replace(/\s+/g,' ').split(/(?<=[a-zà-ù0-9%)][.;])\s+(?=[A-ZÀ-Ú])/),...righe].map(x=>x.trim()).filter(Boolean); // frasi intere (testi a capo) e righe (tabelle)
    const out={};const metti=(k,v,t)=>{if(v==null||out[k])return;out[k]={v,testo:t.length>160?t.slice(0,157)+'…':t};};
    const NO=/INPS|IRPEF|CONTRIBUT|ADDIZIONAL|RITENUT|IMPOSTA|DETRAZ|TFR|FONDO|ALIQUOT/;
    const perc=(re,k,escludi)=>{for(const f of frasi){const u=N(f);if(!re.test(u)||NO.test(u)||(escludi&&escludi.test(u)))continue;const m=f.match(/(\d{1,3}(?:[.,]\d{1,2})?)\s*%/);if(m){const v=numIt(m[1]);if(v>0&&v<=200){metti(k,v,f);return;}}}};
    perc(/STRAORDINAR/,'stra');perc(/NOTTURN/,'nott');perc(/FESTIV/,'fest',/EX[\s.\-]*FEST|SOPPRESS|NON GODUT/);perc(/DOMENIC/,'dom');
    // busta paga: paga base e voci fisse del mese, paga oraria, divisore
    const ultimo=(re)=>{for(const r of righe){const u=N(r);if(re.test(u)){const n=numeriIn(r.replace(/\d{1,3}(?:[.,]\d{1,2})?\s*%/g,''));if(n.length)return {v:n[n.length-1],t:r};}}return null;};
    const tot=ultimo(/^(TOT(ALE|\.)? ?)?(RETRIBUZIONE (MENSILE|CONTRATTUALE|LORDA MENSILE)|ELEMENTI (FISSI|RETRIBUTIVI))\b/);
    if(tot&&tot.v>100)metti('pagaMensile',tot.v,tot.t);
    else{let somma=0,testo=[];for(const re of [/^PAGA BASE|^RETRIBUZIONE BASE|^STIPENDIO BASE|^MINIMO (TABELLARE|CONTRATTUALE|CONGLOBATO)/,/^CONTINGENZA/,/^SUPERMINIMO/,/^SCATTI/,/^E\.?D\.?R\.?\b|ELEMENTO DISTINTO/,/^TERZO ELEMENTO/]){const x=ultimo(re);if(x&&x.v>0&&x.v<10000){somma+=x.v;testo.push(x.t);}}
      if(somma>100)metti('pagaMensile',Math.round(somma*100)/100,testo.join(' · '));}
    // v17: righe "quantità × compenso unitario = importo" (es. GIORNI PRESTAZIONE 22 × 110,00 = 2.420,00; ORE ORDINARIE 168 × 11,50)
    for(const r of righe){const u=N(r);const n=numeriIn(r.replace(/\d{1,3}(?:[.,]\d{1,2})?\s*%/g,'')).filter(v=>v>0);
      for(let i=0;i+2<n.length;i++){const [q,p,t]=[n[i],n[i+1],n[i+2]];if(Math.abs(q*p-t)>0.6||q>400)continue;
        if(/GIORN|\bGG\b/.test(u)&&q<=31&&p>=20)metti('pagaGiornaliera',p,r);
        else if(/\bORE\b|\bHH\b|ORARI/.test(u)&&!/STRAORD|NOTT|FESTIV|DOMENIC|MAGG/.test(u)&&p<200)metti('pagaOraria',p,r);break;}}
    // date di inizio e fine del rapporto (intestazione su una riga, valori sotto)
    for(let i=0;i+1<righe.length;i++){const u=N(righe[i]);if(!/ASSUNZIONE/.test(u))continue;
      const dd=(righe[i+1].match(/\b\d{2}\/\d{2}\/\d{4}\b/g)||[]).map(x=>x.split('/').reverse().join('-'));
      if(dd[0])metti('dal',dd[0],righe[i]+' → '+righe[i+1]);if(dd[1]&&/CESSAZIONE|SCADENZA|FINE/.test(u))metti('al',dd[1],righe[i]+' → '+righe[i+1]);break;}
    for(let i=0;i+1<righe.length;i++)if(/CONTRATTO APPLICATO|C\.?C\.?N\.?L/.test(N(righe[i]))){const m=righe[i+1].match(/\b([A-Z]\d{2,3}\s?-\s?[A-Z][A-Z .'\-]{3,40})/);if(m){metti('ccnl',m[1].trim(),righe[i+1]);break;}}
    const or=ultimo(/(PAGA|RETRIBUZIONE|QUOTA) ORARIA/);if(or&&or.v>0&&or.v<200)metti('pagaOraria',or.v,or.t);
    const dv=ultimo(/DIVISORE/);if(dv&&dv.v>=20&&dv.v<=200)metti('divisore',dv.v,dv.t);
    // contratto: ferie, permessi, nome del CCNL
    for(const f of frasi){const u=N(f);
      if(!out.ferieGiorni&&/FERIE/.test(u)){const m=u.match(/(\d{1,2})\s*GIORNI[^.]{0,40}FERIE|FERIE[^.]{0,80}?(\d{1,3})\s*(GIORNI|GG)/);if(m)metti('ferieGiorni',+(m[1]||m[2]),f);
        else{const o=u.match(/FERIE[^.]{0,80}?(\d{2,3})\s*ORE/);if(o)metti('ferieOre',+o[1],f);}}
      if(!out.rolOre&&/PERMESS|R\.?O\.?L|RIDUZIONE (DELL')?ORARIO/.test(u)){const m=u.match(/(\d{1,3})\s*ORE[^;]{0,80}(PERMESS|R\.?O\.?L|RIDUZIONE)|(PERMESS|R\.?O\.?L|RIDUZIONE)[^;]{0,80}?(\d{1,3})\s*ORE/);if(m&&+(m[1]||m[4])>=4)metti('rolOre',+(m[1]||m[4]),f);}
      if(!out.ccnl){const m=f.match(/C\.?\s?C\.?\s?N\.?\s?L\.?\s*(?:PER\s+(?:I\s+)?(?:DIPENDENTI\s+)?(?:DA\s+)?|DEL\s+|DEI\s+)?([A-Za-zÀ-ÿ'][A-Za-zÀ-ÿ'\s\-,]{3,70})/i);if(m)metti('ccnl',m[1].replace(/\s+/g,' ').trim().replace(/[,\-\s]+$/,''),f);}
    }
    return out;
  }
  g.Buste={testoBusta,analizzaBusta,senzaLinee,analizzaCedolino,testoDocumento,suggerisci};
})(typeof window!=='undefined'?window:globalThis);
