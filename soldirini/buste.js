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
  /** Testo della busta con le posizioni: [{t,x0,y0,x1,y1}] (y dall'alto, +10000 per ogni pagina). */
  async function testoBusta(file,prog){
    const pezzi=[];
    const ocr=async(tela,pag)=>{const w=await preparaLettore(prog);prog&&prog(0.4,'Leggo il testo…');await w.setParameters({tessedit_pageseg_mode:'3'});const {data}=await w.recognize(tela);
      (data.words||[]).forEach(p=>pezzi.push({t:p.text,x0:p.bbox.x0,y0:p.bbox.y0+pag*10000,x1:p.bbox.x1,y1:p.bbox.y1+pag*10000}));};
    if(/pdf/i.test(file.type)||/\.pdf$/i.test(file.name)){
      prog&&prog(0.1,'Apro il PDF…');
      const lib=await pdfJs(),doc=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
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

  function analizzaBusta(pezzi) {
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
    const P = pezzi.map(p => Object.assign({}, p, { u: N(p.t), yc: (p.y0 + p.y1) / 2, h: p.y1 - p.y0, v: numero(p.t) }));
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
    const valoreDi = e => {
      const dx = e.riga.el.slice(e.j + 1).filter(p => p.v != null && p.x0 >= e.x1 - 2);
      if (dx.length) return dx[0].v;
      const sotto = P.filter(p => p.v != null && p.yc > e.yc + H * 0.4 && p.yc < e.yc + H * 4.5 && p.x1 > e.x0 - H * 2 && p.x0 < e.x1 + H * 8)
        .sort((a, b) => (a.yc - b.yc) || (Math.abs(a.x1 - e.x1) - Math.abs(b.x1 - e.x1)));
      return sotto.length ? sotto[0].v : null;
    };
    const primo = (...re) => { for (const r of re) for (const e of trova(r)) { const v = valoreDi(e); if (v != null && v > 0) return v; } return null; };
    const netto = primo(/^NETTO (DEL MESE|A PAGARE|IN BUSTA|BUSTA|DA PAGARE|IN PAGAMENTO)$/, /^NETTO$/);
    const lordo = primo(/^TOT(ALE|\.)? ?COMPETENZE$/, /^COMPETENZE LORDE$/, /^(RETRIBUZIONE|TOTALE) LORD[AO]$/, /^IMPONIBILE PREVIDENZIALE$/);
    const trattenute = primo(/^TOT(ALE|\.)? ?TRATTENUTE$/, /^TOTALE RITENUTE$/);
    // mese: "OTTOBRE 2026" oppure "10/2026"
    const MM = ['GENNAIO','FEBBRAIO','MARZO','APRILE','MAGGIO','GIUGNO','LUGLIO','AGOSTO','SETTEMBRE','OTTOBRE','NOVEMBRE','DICEMBRE'];
    let mese = null; const T = N(testo);
    const m1 = T.match(new RegExp('(' + MM.join('|') + ')\\s*(20\\d\\d)'));
    if (m1) mese = m1[2] + '-' + String(MM.indexOf(m1[1]) + 1).padStart(2, '0');
    else { const m2 = T.match(/(?:MESE|PERIODO|RETRIBUZIONE)[^\n]{0,25}?\b(0?[1-9]|1[0-2])[\/\-.](20\d\d)\b/) || T.match(/\b(0?[1-9]|1[0-2])[\/\-](20\d\d)\b/);
      if (m2) mese = m2[2] + '-' + String(+m2[1]).padStart(2, '0'); }
    // saldo di una riga del riepilogo ferie/permessi: "Saldo 12,00" sulla riga, oppure la colonna Saldo/Residuo, oppure l'ultimo numero
    const saldoDi = rf => {
      if (!rf) return { v: null, unita: null };
      let v = null;
      const kw = rf.testo.match(/(SALDO|RESIDU[OEI]|DA GODERE|RIMANENZA|SPETTANTI RESIDU[OEI])\s*:?\s*(-?[\d.,]+-?)/);
      if (kw) v = numero(kw[2]);
      if (v == null) {
        const testa = P.filter(p => /^(SALDO|RESIDU[OEI]?|RESID\.?|DA|RIMAN)/.test(p.u) && !/^RES\.?$/.test(p.u) && p.yc < rf.yc && p.yc > rf.yc - H * 8);
        const nums = rf.el.filter(p => p.v != null);
        if (testa.length) {
          const t0 = testa.sort((a, c) => c.yc - a.yc)[0], xc = (t0.x0 + t0.x1) / 2;
          v = nums.sort((a, c) => Math.abs((a.x0 + a.x1) / 2 - xc) - Math.abs((c.x0 + c.x1) / 2 - xc))[0].v;
        } else v = nums[nums.length - 1].v;
      }
      const vicino = righe.filter(r => Math.abs(r.yc - rf.yc) < H * 8).map(r => r.testo).join(' ');
      // prima guardo la riga stessa (es. "FERIE GG"), poi le righe vicine
      const propria = /\b(GG|GIORNI)\b/.test(rf.testo) ? 'giorni' : /\bORE\b|\bH\b/.test(rf.testo) ? 'ore' : null;
      return { v, unita: propria || (/\bORE\b|\bH\b/.test(vicino) ? 'ore' : /\b(GG|GIORNI)\b/.test(vicino) ? 'giorni' : null) };
    };
    const conNumeri = r => r.el.some(p => p.v != null);
    const EXF = /EX[\s.\-]*FEST|FESTIVITA'?\s*(SOPPRESSE|NON GODUTE|ABOLITE|RIDOTTE)|FEST\.?\s*SOPPR/;
    // ferie: riga che inizia con FERIE (non permessi o ex festività)
    const rf = righe.find(r => /^FERIE\b/.test(r.testo) && conNumeri(r)) || righe.find(r => /\bFERIE\b/.test(r.testo) && !/PERMESS|FESTIVIT|ROL\b/.test(r.testo) && conNumeri(r));
    // permessi ROL (riduzione orario di lavoro)
    const rr = righe.find(r => r !== rf && /\bR\.?O\.?L\.?\b|RIDUZ(IONE|\.)?\s*ORARIO|^PERMESS[OI]\b(?!.*(STUDIO|SINDAC|ELETTOR|LUTTO|104))/.test(r.testo) && !EXF.test(r.testo) && conNumeri(r));
    // ex festività / festività non godute
    const rx = righe.find(r => r !== rf && r !== rr && EXF.test(r.testo) && conNumeri(r));
    const sf = saldoDi(rf), sr = saldoDi(rr), sx = saldoDi(rx);
    const ferieV = sf.v, unita = sf.unita;
    return { mese, lordo, trattenute, netto: netto != null ? netto : (lordo != null && trattenute != null ? Math.round((lordo - trattenute) * 100) / 100 : null), ferie: ferieV, unita, rol: sr.v, exfest: sx.v, unitaPermessi: sr.unita || sx.unita || 'ore', testo };
  }

  g.Buste={testoBusta,analizzaBusta};
})(typeof window!=='undefined'?window:globalThis);
