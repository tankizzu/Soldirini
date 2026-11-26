'use strict';
// ================= Soldirini v17 · turni da foto =================
// Motore di lettura ripreso così com'è da Strafobico (foto o screenshot della tabella dei turni del reparto:
// nomi sulle righe, giorni sulle colonne). La lettura avviene sul telefono con Tesseract; poi si controlla
// giorno per giorno prima di salvare.
(function(){
const TESSERACT_URL='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let lettore=null,ultimaImmagine=null,tipi=[],ft=null;
function progresso(p,testo){$('ftBar').style.width=Math.round(p*100)+'%';if(testo)$('ftFase').textContent=testo;}
function caricaScript(url){return new Promise((ok,ko)=>{if(window.Tesseract)return ok();const s=document.createElement('script');s.src=url;s.onload=ok;s.onerror=()=>ko(new Error('non riesco a scaricare il lettore di testo: controlla la connessione'));document.head.appendChild(s);});}
async function preparaLettore(){
  if(lettore)return lettore;progresso(0.03,'Scarico il lettore di testo (solo la prima volta)…');await caricaScript(TESSERACT_URL);
  lettore=await Tesseract.createWorker('eng',1,{logger:m=>{if(m.status&&/load|init/i.test(m.status)&&m.progress!=null)progresso(0.03+0.17*m.progress);}});return lettore;
}
function immagineDaFile(file){return new Promise((ok,ko)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);ok(img);};img.onerror=()=>ko(new Error('il file non sembra un’immagine'));img.src=url;});}

// ---------------- motore di Strafobico (non modificato) ----------------
  /** Immagine in scala di grigi, ingrandita perché il testo sia ben leggibile. */
  function preparaTela(img, forte) {
    // le immagini piccole vengono ingrandite molto: il lettore lavora bene con lettere alte almeno 25-30 pixel
    // (24c.15, D-170) seconda lettura "forte": anche le immagini molto larghe e basse (tabelle stile Excel)
    // vengono ingrandite in base all'area, non solo alla larghezza, così i numeri piccoli diventano leggibili
    const w = img.naturalWidth, h = img.naturalHeight, s = Math.min(5, Math.max(1, 3200 / w, forte ? Math.sqrt(8e6 / (w * h)) : 0));
    const c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s); c.scala = s;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingQuality = 'high';
    x.drawImage(img, 0, 0, c.width, c.height);
    // foto un po' storta: la raddrizzo (le linee e le righe della tabella devono essere orizzontali)
    const ang = inclinazione(x, c.width, c.height);
    if (Math.abs(ang) > 0.12) {
      x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      x.save(); x.translate(c.width / 2, c.height / 2); x.rotate(-ang * Math.PI / 180);
      x.drawImage(img, -c.width / 2, -c.height / 2, c.width, c.height); x.restore();
    }
    c.inclinazione = ang;
    const id = x.getImageData(0, 0, c.width, c.height), p = id.data;
    for (let i = 0; i < p.length; i += 4) { const g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; p[i] = p[i + 1] = p[i + 2] = g; }
    if (forte) {
      // seconda lettura: la lettura di tutta l'immagine (dove sono giorni e nomi) si fa su una copia con il contrasto
      // locale (c.ocr); le celle invece si ritagliano dai grigi originali, dove le lettere sfocate restano lettere
      // e non diventano macchie. I grigi originali servono anche a riconoscere le celle grigie piene.
      const g = new Uint8Array(c.width * c.height); for (let i = 0; i < g.length; i++) g[i] = p[i * 4]; c.grigio = g;
      const orig = new ImageData(new Uint8ClampedArray(p), c.width, c.height);
      contrastoLocale(p, c.width, c.height, s);
      c.linee = togliGriglia(p, c.width, c.height, s);
      const o = document.createElement('canvas'); o.width = c.width; o.height = c.height; o.scala = s;
      o.getContext('2d').putImageData(id, 0, 0); c.ocr = o;
      togliGriglia(orig.data, c.width, c.height, s);
      x.putImageData(orig, 0, 0);
      return c;
    }
    c.linee = togliGriglia(p, c.width, c.height, s);
    x.putImageData(id, 0, 0);
    return c;
  }

  /**
   * (24c.15, D-170) Contrasto locale per le foto sbiadite: ogni pixel viene diviso per il fondo che ha intorno
   * (il più chiaro nelle vicinanze). Fondi colorati o grigi (testata rosa, celle grigie piene) diventano bianchi,
   * le scritte sottili e sfocate tornano scure. Solo nella seconda lettura: le scritte chiare su fondo scuro
   * qui si perderebbero, per questo la prima lettura resta com'era.
   */
  function contrastoLocale(p, w, h, scala) {
    const r = Math.max(4, Math.round(3 * (scala || 1))), n = w * h, g = new Float32Array(n), t = new Float32Array(n);
    for (let i = 0; i < n; i++) g[i] = p[i * 4];
    // massimo e media su finestre (2r+1), prima per righe e poi per colonne, in tempo lineare
    // (massimo: metodo di van Herk con blocchi; media: somma scorrevole)
    const L = Math.max(w, h), sx = new Float32Array(L + 2 * r + 2), dx = new Float32Array(L + 2 * r + 2), riga = new Float32Array(L);
    const passa = (src, dst, lung, conta, passo, salto, f) => {
      const k = 2 * r + 1;
      for (let c = 0; c < conta; c++) {
        const base = c * salto;
        for (let i = 0; i < lung; i++) riga[i] = src[base + i * passo];
        if (f === 'max') {
          // sequenza allungata ai bordi con 0 (non cambia il massimo, i valori sono ≥ 0)
          const N = lung + 2 * r, at = j => (j < r || j >= lung + r) ? 0 : riga[j - r];
          for (let j = 0; j < N; j++) sx[j] = (j % k === 0) ? at(j) : Math.max(sx[j - 1], at(j));
          for (let j = N - 1; j >= 0; j--) dx[j] = (j === N - 1 || (j + 1) % k === 0) ? at(j) : Math.max(dx[j + 1], at(j));
          for (let i = 0; i < lung; i++) dst[base + i * passo] = Math.max(dx[i], sx[i + 2 * r]);
        } else {
          let somma = 0, a = 0, b = -1;
          for (let i = 0; i < lung; i++) {
            const na = Math.max(0, i - r), nb = Math.min(lung - 1, i + r);
            while (b < nb) somma += riga[++b];
            while (a < na) somma -= riga[a++];
            dst[base + i * passo] = somma / (nb - na + 1);
          }
        }
      }
    };
    passa(g, t, w, h, 1, w, 'max'); const bg = new Float32Array(n); passa(t, bg, h, w, w, 1, 'max');
    passa(bg, t, w, h, 1, w, 'media'); passa(t, bg, h, w, w, 1, 'media');
    for (let i = 0; i < n; i++) {
      const v = g[i] / Math.max(1, bg[i]) * 255, q = Math.max(0, Math.min(255, (v - 110) / 125 * 255));
      p[i * 4] = p[i * 4 + 1] = p[i * 4 + 2] = q;
    }
  }

  /**
   * Di quanti gradi è inclinata la tabella: provo piccole rotazioni e tengo quella in cui
   * i pixel scuri si allineano meglio su righe orizzontali (righe di testo e linee della griglia).
   */
  function inclinazione(ctx, W, H) {
    const k = Math.min(1, 1000 / W), w = Math.round(W * k), h = Math.round(H * k);
    const t = document.createElement('canvas'); t.width = w; t.height = h;
    const tx = t.getContext('2d', { willReadFrequently: true }); tx.drawImage(ctx.canvas, 0, 0, w, h);
    const p = tx.getImageData(0, 0, w, h).data, xs = [], ys = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; if (0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2] < 150) { xs.push(x - w / 2); ys.push(y); }
    }
    if (xs.length < 200) return 0;
    const passi = Math.max(1, Math.floor(xs.length / 60000));
    const punteggio = a => {
      const tg = Math.tan(a * Math.PI / 180), b = new Float64Array(h + w + 2), off = w / 2 + 1;
      for (let i = 0; i < xs.length; i += passi) { const yy = Math.round(ys[i] - xs[i] * tg + off); if (yy >= 0 && yy < b.length) b[yy]++; }
      let s = 0; for (let i = 0; i < b.length; i++) s += b[i] * b[i]; return s;
    };
    let best = 0, bs = punteggio(0);
    for (let a = -4; a <= 4.001; a += 0.1) { const s = punteggio(a); if (s > bs * 1.0001) { bs = s; best = a; } }
    const c0 = best;
    for (let a = c0 - 0.1; a <= c0 + 0.1001; a += 0.02) { const s = punteggio(a); if (s > bs) { bs = s; best = a; } }
    return Math.round(best * 100) / 100;
  }

  /**
   * Cancella le linee della tabella (bordi delle celle): sono tratti scuri lunghi e dritti,
   * molto più lunghi di qualsiasi lettera. Senza linee il lettore distingue meglio numeri e sigle.
   */
  function togliGriglia(p, w, h, scala) {
    const T = 205;                                   // anche le linee grigie chiare
    const scuro = i => p[i * 4] < T;
    const off = Math.ceil((scala || 1) * 2) + 2;     // spessore massimo di una linea (dopo l'ingrandimento)
    const lungoO = Math.max(60, Math.round(w * 0.12)), lungoV = Math.max(60, Math.round(h * 0.22));
    const cancella = new Uint8Array(w * h), vConta = new Uint32Array(w), hConta = new Uint32Array(h);
    // posizione delle linee: una linea è una striscia sottile più scura di quello che ha ai due lati,
    // qualunque sia il colore delle celle vicine (anche fucsia o rosso)
    const sa = off + 1, gr = i => p[i * 4];
    const cresta = (i, passo) => { const v = gr(i); return v < 240 && v < gr(i - passo) - 25 && v < gr(i + passo) - 25; };
    // una linea è lunga e sottile: sopra e sotto (o a destra e sinistra) deve essere chiaro,
    // altrimenti è il fondo colorato di una cella e non va toccato
    const sottileO = (y, x1, x2) => {
      let n = 0, sc = 0;
      for (const yy of [y - off, y + off]) { if (yy < 0 || yy >= h) continue; for (let x = x1; x < x2; x += 3) { n++; if (scuro(yy * w + x)) sc++; } }
      return n === 0 || sc / n < 0.5;
    };
    const sottileV = (x, y1, y2) => {
      let n = 0, sc = 0;
      for (const xx of [x - off, x + off]) { if (xx < 0 || xx >= w) continue; for (let y = y1; y < y2; y += 3) { n++; if (scuro(y * w + xx)) sc++; } }
      return n === 0 || sc / n < 0.5;
    };
    for (let y = 0; y < h; y++) {
      let x = 0;
      while (x < w) {
        if (!scuro(y * w + x)) { x++; continue; }
        let x2 = x; while (x2 < w && scuro(y * w + x2)) x2++;
        if (x2 - x >= lungoO && sottileO(y, x, x2)) for (let k = x; k < x2; k++) cancella[y * w + k] = 1;
        x = x2;
      }
    }
    for (let x = 0; x < w; x++) {
      let y = 0;
      while (y < h) {
        if (!scuro(y * w + x)) { y++; continue; }
        let y2 = y; while (y2 < h && scuro(y2 * w + x)) y2++;
        if (y2 - y >= lungoV && sottileV(x, y, y2)) for (let k = y; k < y2; k++) cancella[k * w + x] = 1;
        y = y2;
      }
    }
    // altezza tipica di una riga, dalle linee orizzontali lunghe trovate sopra (serve a distinguere linee e lettere)
    const lineeLunghe = [];
    for (let y = 0; y < h; y++) { let s = 0; for (let x = 0; x < w; x += 2) s += cancella[y * w + x]; if (s * 2 > w * 0.3) lineeLunghe.push(y); }
    const salti = []; for (let i = 1; i < lineeLunghe.length; i++) if (lineeLunghe[i] - lineeLunghe[i - 1] > sa * 3) salti.push(lineeLunghe[i] - lineeLunghe[i - 1]);
    salti.sort((a, b) => a - b);
    const altRiga = salti.length ? salti[Math.floor(salti.length / 2)] : 14 * (scala || 1);
    // una linea è una striscia continua (al massimo piccole interruzioni dove incrocia altre linee)
    // lunga almeno quasi tutta la cella; le lettere allineate in colonna invece hanno spazi tra una riga e l'altra
    const buco = sa * 2 + 2, minV = altRiga * 0.7, minO = altRiga * 1.2;
    for (let x = sa; x < w - sa; x++) {
      let ini = -1, ult = -1;
      for (let y = 0; y <= h; y++) {
        if (y < h && cresta(y * w + x, 1 * sa)) { if (ini < 0 || y - ult > buco) { if (ini >= 0 && ult - ini >= minV) vConta[x] += ult - ini; ini = y; } ult = y; }
      }
      if (ini >= 0 && ult - ini >= minV) vConta[x] += ult - ini;
    }
    for (let y = sa; y < h - sa; y++) {
      let ini = -1, ult = -1;
      for (let x = 0; x <= w; x++) {
        if (x < w && cresta(y * w + x, sa * w)) { if (ini < 0 || x - ult > buco) { if (ini >= 0 && ult - ini >= minO) hConta[y] += ult - ini; ini = x; } ult = x; }
      }
      if (ini >= 0 && ult - ini >= minO) hConta[y] += ult - ini;
    }
    // cancella le linee e i loro bordi sfumati
    const r = Math.max(2, Math.ceil(scala || 1));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!cancella[y * w + x]) continue;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (dx && dy) continue;
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const i = (yy * w + xx) * 4;
        if (cancella[yy * w + xx] || p[i] < 235) p[i] = p[i + 1] = p[i + 2] = 255;
      }
    }
    // posizioni delle linee: servono a sapere dove iniziano e finiscono le celle (anche se larghe diverse)
    const gruppi = (arr, min) => {
      const out = []; let i = 0;
      while (i < arr.length) {
        if (arr[i] < min) { i++; continue; }
        let j = i; while (j + 1 < arr.length && arr[j + 1] >= min) j++;
        out.push([i, j]); i = j + 1;
      }
      return out;
    };
    // gruppi vicini (i due bordi di una linea spessa) → una sola linea [inizio, fine]
    const unisci = a => a.reduce((o, s) => { const u = o[o.length - 1]; if (u && s[0] - u[1] <= sa * 2) u[1] = s[1]; else o.push(s.slice()); return o; }, []);
    const lv = unisci(gruppi(vConta, Math.max(20, h * 0.25))), lo = unisci(gruppi(hConta, Math.max(40, w * 0.3)));
    return { vx: lv.map(s => (s[0] + s[1]) / 2), hy: lo.map(s => (s[0] + s[1]) / 2) };
  }


  /**
   * Usa le linee della tabella per trovare i bordi esatti di ogni cella della riga cercata.
   * Le colonne possono avere larghezze diverse: ogni giorno viene associato alla colonna che ha sopra il suo numero.
   * Restituisce null se la foto non ha linee di griglia utilizzabili (allora si usano le stime).
   */
  function cellePerLinee(r, tela) {
    const L = tela.linee; if (!L || L.vx.length < 6) return null;
    const vx = L.vx.slice().sort((a, b) => a - b);
    if (vx[vx.length - 1] < tela.width - r.passo * 0.3) vx.push(tela.width - 1); // ultima colonna tagliata dal bordo della foto
    const slot = [];
    for (let i = 0; i + 1 < vx.length; i++) if (vx[i + 1] - vx[i] >= r.passo * 0.35) slot.push([vx[i], vx[i + 1]]);
    // una linea non trovata unisce due o più colonne: divido la colonna larga in parti uguali
    const larg = slot.map(s => s[1] - s[0]).sort((a, b) => a - b), tipica = larg[Math.floor(larg.length / 2)] || r.passo;
    for (let i = slot.length - 1; i >= 0; i--) {
      const k = Math.round((slot[i][1] - slot[i][0]) / tipica);
      if (k >= 2 && slot[i][1] - slot[i][0] > tipica * 1.6) {
        const [a, b] = slot[i], parti = [];
        for (let j = 0; j < k; j++) parti.push([a + (b - a) * j / k, a + (b - a) * (j + 1) / k]);
        slot.splice(i, 1, ...parti);
      }
    }
    const slotDi = x => slot.findIndex(s => x > s[0] && x < s[1]);
    const noti = {};
    Object.keys(r.numeri).forEach(d => { const s = slotDi(r.numeri[d]); if (s >= 0) noti[d] = s; });
    const giorniNoti = Object.keys(noti).map(Number).sort((a, b) => a - b);
    if (giorniNoti.length < 4) return null;
    // la griglia vale solo se è coerente con i numeri letti: giorni diversi in colonne diverse, nell'ordine giusto
    if (new Set(giorniNoti.map(d => noti[d])).size < giorniNoti.length) return null;
    let coerenti = 0;
    for (let i = 1; i < giorniNoti.length; i++) if (noti[giorniNoti[i]] - noti[giorniNoti[i - 1]] === giorniNoti[i] - giorniNoti[i - 1]) coerenti++;
    if (coerenti < (giorniNoti.length - 1) * 0.8) return null;
    const indice = d => {
      if (noti[d] != null) return noti[d];
      const sotto = giorniNoti.filter(x => x < d), sopra = giorniNoti.filter(x => x > d);
      const d1 = sotto[sotto.length - 1], d2 = sopra[0];
      if (d1 != null && d2 != null) return (noti[d2] - noti[d1] === d2 - d1) ? noti[d1] + (d - d1) : -1;
      if (d1 != null) return noti[d1] + (d - d1);
      if (d2 != null) return noti[d2] - (d2 - d);
      return -1;
    };
    const colonna = d => { const i = indice(d); return i >= 0 && i < slot.length ? slot[i] : null; };
    // riga: tra la linea orizzontale sopra e quella sotto il nome
    const hy = (L.hy || []).slice().sort((a, b) => a - b), yc = r.riga.yc;
    const su = hy.filter(y => y < yc), giu = hy.filter(y => y > yc);
    let riga = [r.riga.top, r.riga.bottom];
    if (su.length && giu.length) {
      const t = su[su.length - 1], b = giu[0];
      // la riga deve essere alta circa come le altre (se manca una linea si usa la stima)
      if (b - t > r.riga.h * 0.6 && b - t < r.riga.h * 1.5) riga = [t, b];
      else if (yc - t > r.riga.h * 0.25 && yc - t < r.riga.h * 0.85) riga = [t, Math.min(r.riga.bottom, t + r.riga.h)];
      else if (b - yc > r.riga.h * 0.25 && b - yc < r.riga.h * 0.85) riga = [Math.max(r.riga.top, b - r.riga.h), b];
    }
    return { colonna, centro: d => { const c = colonna(d); return c ? (c[0] + c[1]) / 2 : null; }, riga, margine: Math.ceil((tela.scala || 1) * 1.5) + 2 };
  }

  /**
   * "Impronta" della forma scritta in una cella (ritaglio già centrato e ingrandito da tagliaCella):
   * una griglia 48×20 bianco/nero più il rapporto larghezza/altezza. Serve a confrontare celle tra loro.
   */
  function firmaForma(c) {
    // (24c.15, D-170) grigi (non bianco/nero): con le foto sfocate il bianco/nero confonde M e P
    const W = 32, H = 16, larg = Math.max(1, c.width - 48), t = document.createElement('canvas');
    t.width = W; t.height = H;
    const x = t.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingQuality = 'high'; x.drawImage(c, 24, 24, larg, 48, 0, 0, W, H);
    const p = x.getImageData(0, 0, W, H).data, v = new Float32Array(W * H);
    for (let i = 0; i < v.length; i++) v[i] = p[i * 4] / 255;
    return { v, ar: larg / 48 };
  }
  /**
   * Quanto sono diverse due forme: ≤ 1 vuol dire "la stessa scritta". Tre controlli, tutti devono essere piccoli:
   * la differenza più forte in una zona di 3×3 (una P e una R differiscono solo nella gamba, ma lì molto),
   * la differenza media dei grigi e la differenza di proporzioni (una sigla di due lettere è larga il doppio).
   */
  function distanzaForme(a, b) {
    const W = 32, H = 16, df = new Float32Array(W * H);
    let media = 0;
    for (let i = 0; i < df.length; i++) { df[i] = Math.abs(a.v[i] - b.v[i]); media += df[i]; }
    media /= df.length;
    let zona = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < H && xx >= 0 && xx < W) { s += df[yy * W + xx]; n++; } }
      if (s / n > zona) zona = s / n;
    }
    return Math.max(zona / 0.42, media / 0.09, Math.abs(Math.log(a.ar / b.ar)) / 0.25);
  }

  /**
   * (24c.15, D-170) Ritaglio più stretto per il lettore: la scritta alta 32 px con poco margine.
   * Una lettera da sola ("M") in un ritaglio grande spesso non viene letta affatto.
   */
  function compatta(c) {
    const larg = Math.max(1, c.width - 48), k = 32 / 48, t = document.createElement('canvas');
    t.width = Math.round(larg * k) + 24; t.height = 32 + 24;
    const x = t.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, t.width, t.height);
    x.imageSmoothingQuality = 'high'; x.drawImage(c, 24, 24, larg, 48, 12, 12, t.width - 24, 32);
    return t;
  }

  /**
   * (24c.15, D-170) Mette in fila su una riga le celle ritagliate (scritta alta 32 px, 40 px di spazio tra l'una
   * e l'altra). duro: bianco e nero puro (soglia a metà tra il più chiaro e il più scuro di ogni cella).
   * Restituisce { tela, pezzi: [{ d, x0, x1 }] } per ritrovare a quale giorno appartiene ogni lettera letta.
   */
  function rigaDiCelle(celle, duro) {
    const giorni = Object.keys(celle).map(Number).sort((a, b) => a - b); if (!giorni.length) return null;
    const H = 32, S = 40, pezzi = [];
    let x = S;
    const im = giorni.map(d => { const c = celle[d], larg = Math.max(1, Math.round((c.width - 48) * H / 48)); pezzi.push({ d, x0: x, x1: x + larg }); x += larg + S; return { c, larg }; });
    const t = document.createElement('canvas'); t.width = x; t.height = H + 24;
    const g = t.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#fff'; g.fillRect(0, 0, t.width, t.height);
    g.imageSmoothingQuality = 'high';
    im.forEach(({ c, larg }, i) => g.drawImage(c, 24, 24, c.width - 48, 48, pezzi[i].x0, 12, larg, H));
    if (duro) {
      const dati = g.getImageData(0, 0, t.width, t.height), p = dati.data;
      pezzi.forEach(pz => {
        let mi = 255, ma = 0;
        for (let yy = 12; yy < 12 + H; yy++) for (let xx = pz.x0; xx < pz.x1; xx++) { const v = p[(yy * t.width + xx) * 4]; if (v < mi) mi = v; if (v > ma) ma = v; }
        const soglia = (mi + ma) / 2;
        for (let yy = 12; yy < 12 + H; yy++) for (let xx = pz.x0; xx < pz.x1; xx++) { const i = (yy * t.width + xx) * 4, v = p[i] < soglia ? 0 : 255; p[i] = p[i + 1] = p[i + 2] = v; }
      });
      g.putImageData(dati, 0, 0);
    }
    return { tela: t, pezzi };
  }

  /**
   * (24c.15, D-170) Decide la sigla di ogni cella della riga.
   * Nella stessa tabella una sigla è scritta sempre allo stesso modo: le celle dalla forma quasi uguale formano
   * un gruppo e il gruppo prende la sigla letta più spesso dalle sue celle (così una "M" non letta o un "MP"
   * letto "M" prendono la sigla giusta dalle altre). Se il gruppo non è d'accordo, le sue celle restano da controllare.
   * letture: { giorno: ['M', 'M+P', …] } (le letture riuscite di ogni cella); forme: { giorno: firmaForma }.
   * Restituisce { letti: { giorno: ['M','P'] }, incerti: [giorni] }.
   */
  function decidiCelle(letture, forme) {
    // una cella entra in un gruppo solo se è uguale a tutte le celle del gruppo (lettere simili come P e R
    // non si uniscono passando da una cella all'altra)
    const giorni = Object.keys(forme).map(Number).sort((a, b) => a - b), gruppi = [];
    giorni.forEach(d => {
      const g = gruppi.find(g => g.every(e => distanzaForme(forme[d], forme[e]) <= 1));
      if (g) g.push(d); else gruppi.push([d]);
    });
    const letti = {}, incerti = [], sigle = [];
    // una sigla vince se è letta almeno due volte e almeno il doppio di ogni altra
    const vince = voti => { const ord = Object.entries(voti).sort((a, b) => b[1] - a[1]), primo = ord[0], secondo = ord[1]; return primo && primo[1] >= 2 && (!secondo || primo[1] >= secondo[1] * 2) ? primo[0] : null; };
    const info = gruppi.map(g => {
      const voti = {};
      g.forEach(d => (letture[d] || []).forEach(k => { voti[k] = (voti[k] || 0) + 1; }));
      return { g, voti, ar: g.map(d => forme[d].ar).sort((a, b) => a - b)[Math.floor(g.length / 2)], k: vince(voti) };
    });
    // forme diverse = scritte diverse: se una sigla è già di un altro gruppo (sicuro e dalla forma diversa),
    // le letture di quella sigla in un gruppo incerto sono sbagliate (es. "MP" letto "P") e non contano
    const prese = new Set(info.filter(x => x.k).map(x => x.k));
    info.forEach(x => {
      if (x.k) return;
      const voti = {}; Object.entries(x.voti).forEach(([k, n]) => { if (!prese.has(k)) voti[k] = n; });
      x.k = vince(voti);
    });
    info.forEach(x => { if (x.k) sigle.push({ k: x.k, ar: x.ar, g: x.g }); else x.g.forEach(d => incerti.push(d)); });
    // due gruppi con la stessa sigla di una lettera ma uno molto più largo (es. "MP" letto sempre "M"): il più largo va controllato
    // e una sigla di una sola lettera scritta molto larga (una lettera maiuscola è al massimo poco più larga che alta)
    sigle.forEach(x => {
      if (x.k.includes('+')) return;
      const altri = sigle.filter(y => y !== x && y.k === x.k && y.ar * 1.4 < x.ar);
      if (altri.length || (x.k.length === 1 && x.ar > 1.45)) x.dubbio = true;
    });
    sigle.forEach(x => x.g.forEach(d => { if (x.dubbio) incerti.push(d); else letti[d] = x.k.split('+'); }));
    incerti.sort((a, b) => a - b);
    return { letti, incerti };
  }

  /**
   * (24c.15, D-170) Cella colorata o grigia senza scritta, guardando i grigi originali (prima del contrasto locale):
   * fondo non bianco e nessun punto molto più scuro del fondo.
   */
  function cellaPiena(tela, x0, y0, w, h) {
    const g = tela.grigio, W = tela.width, ist = new Uint32Array(256);
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) ist[g[y * W + x]]++;
    let fondo = 0; for (let i = 1; i < 256; i++) if (ist[i] > ist[fondo]) fondo = i;
    if (fondo >= 235) return false;
    let scuri = 0; for (let i = 0; i < fondo - 45; i++) scuri += ist[i];
    return scuri < Math.max(12, w * h * 0.004);
  }

  /** Ritaglia una cella; restituisce null se è vuota (niente "inchiostro"). */
  function tagliaCella(tela, x0, y0, x1, y1, duro) {
    x0 = Math.max(0, Math.round(x0)); y0 = Math.max(0, Math.round(y0));
    x1 = Math.min(tela.width, Math.round(x1)); y1 = Math.min(tela.height, Math.round(y1));
    const w = x1 - x0, h = y1 - y0; if (w < 3 || h < 3) return null;
    if (tela.grigio && cellaPiena(tela, x0, y0, w, h)) return null;
    const dati = tela.getContext('2d').getImageData(x0, y0, w, h), p = dati.data, n = w * h;
    // colore di fondo = il grigio più frequente; la scritta è ciò che se ne stacca (più scura o più chiara)
    const ist = new Array(256).fill(0);
    for (let i = 0; i < p.length; i += 4) ist[p[i] | 0]++;
    let fondo = 0; for (let i = 1; i < 256; i++) if (ist[i] > ist[fondo]) fondo = i;
    let scuri = 0, chiari = 0;
    // su una cella colorata (fucsia, rosso…) la scritta nera stacca meno dal fondo: basta meno contrasto
    const dS = fondo >= 200 ? 60 : 35, dC = fondo <= 55 ? 60 : 35;
    for (let i = 0; i < 256; i++) { if (i < fondo - dS) scuri += ist[i]; if (i > fondo + dC) chiari += ist[i]; }
    const testoScuro = scuri >= chiari, inchiostro = testoScuro ? scuri : chiari;
    if (inchiostro < Math.max(12, Math.min(n * 0.012, h * h * 0.02))) return null; // cella vuota (anche se colorata)
    // immagine pulita: scritta nera su bianco, qualunque fosse il colore della cella
    const ink = new Uint8Array(n);
    // soglia a metà strada tra il fondo e l'inchiostro più marcato: tratti sottili anche se la foto è sfocata
    let estremo = fondo;
    if (testoScuro) { let c = 0; for (let i = 0; i < 256; i++) { c += ist[i]; if (c >= inchiostro * 0.15) { estremo = i; break; } } }
    else { let c = 0; for (let i = 255; i >= 0; i--) { c += ist[i]; if (c >= inchiostro * 0.15) { estremo = i; break; } } }
    // su fondo chiaro conta solo l'inchiostro ben marcato (come prima); su fondo colorato ci si avvicina a metà strada
    const soglia = testoScuro ? Math.min(fondo - dS, Math.max((fondo + estremo) / 2, fondo - 90))
      : Math.max(fondo + dC, Math.min((fondo + estremo) / 2, fondo + 90));
    for (let i = 0; i < n; i++) { const v = p[i * 4]; ink[i] = testoScuro ? v < soglia : v > soglia; }
    // resti delle linee della griglia (righe o colonne quasi tutte "inchiostro") → via
    // (un tratto continuo per quasi tutta la larghezza/altezza: le lettere hanno sempre degli spazi)
    const via = new Uint8Array(n);
    for (let yy = 0; yy < h; yy++) { let run = 0, max = 0; for (let xx = 0; xx < w; xx++) { run = ink[yy * w + xx] ? run + 1 : 0; if (run > max) max = run; } if (max > w * 0.85) for (let xx = 0; xx < w; xx++) if (ink[yy * w + xx]) { ink[yy * w + xx] = 0; via[yy * w + xx] = 1; } }
    for (let xx = 0; xx < w; xx++) { let run = 0, max = 0; for (let yy = 0; yy < h; yy++) { run = ink[yy * w + xx] ? run + 1 : 0; if (run > max) max = run; } if (max > h * 0.85) for (let yy = 0; yy < h; yy++) if (ink[yy * w + xx]) { ink[yy * w + xx] = 0; via[yy * w + xx] = 1; } }
    let minimo = 255, massimo = 0;
    for (let i = 0; i < 256; i++) if (ist[i]) { if (i < minimo) minimo = i; if (i > massimo) massimo = i; }
    let bx0 = w, by0 = h, bx1 = -1, by1 = -1, tot = 0;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const i = yy * w + xx, testo = ink[i];
      // contrasto "morbido": il fondo diventa bianco, l'inchiostro più scuro nero, i bordi delle lettere restano grigi
      // (così le lettere piccole non si impastano); su fondo bianco l'immagine resta com'era
      const v = p[i * 4], q = testoScuro ? (v - minimo) / ((fondo - minimo) || 1) : (massimo - v) / ((massimo - fondo) || 1);
      p[i * 4] = p[i * 4 + 1] = p[i * 4 + 2] = via[i] ? 255 : duro ? (testo ? 0 : 255) : Math.round(Math.max(0, Math.min(1, q)) * 255);
      if (testo) { tot++; if (xx < bx0) bx0 = xx; if (xx > bx1) bx1 = xx; if (yy < by0) by0 = yy; if (yy > by1) by1 = yy; }
    }
    if (bx1 < 0 || tot < Math.max(12, Math.min(n * 0.012, h * h * 0.02))) return null;
    // (24c.15, D-170) cella grigia piena (giorno non disponibile): l'"inchiostro" è un blocco pieno e largo, non una scritta
    if (tot > (bx1 - bx0 + 1) * (by1 - by0 + 1) * 0.9 && (bx1 - bx0 + 1) > w * 0.6 && (by1 - by0 + 1) > h * 0.6) return null;
    const m = Math.round(h * 0.08);
    bx0 = Math.max(0, bx0 - m); by0 = Math.max(0, by0 - m); bx1 = Math.min(w - 1, bx1 + m); by1 = Math.min(h - 1, by1 + m);
    const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1, k = 48 / bh;
    const t = document.createElement('canvas'); t.width = w; t.height = h; t.getContext('2d').putImageData(dati, 0, 0);
    const c = document.createElement('canvas');
    c.width = Math.round(bw * k) + 48; c.height = 48 + 48;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.imageSmoothingQuality = 'high'; x.drawImage(t, bx0, by0, bw, bh, 24, 24, c.width - 48, 48);
    c.altezza = bh; c.centro = x0 + bx0 + bw / 2;
    return c;
  }


  /**
   * (24c.15, D-170) Numeri dei giorni di una riga → quelli che stanno su una stessa retta x = a + b·giorno
   * (colonne tutte larghe uguali), anche se in mezzo ci sono numeri letti male. Un numero per giorno, ordinati.
   */
  function rettaRobusta(el, H) {
    let meglio = null;
    for (let i = 0; i < el.length; i++) for (let j = i + 1; j < el.length; j++) {
      const p = el[i], q = el[j]; if (p.d === q.d) continue;
      const b = (q.xc - p.xc) / (q.d - p.d); if (!(b > H * 0.5)) continue;
      const a = p.xc - b * p.d, per = {};
      el.forEach(o => { const e = Math.abs(o.xc - (a + b * o.d)); if (e <= b * 0.3 && (!per[o.d] || e < per[o.d].e)) per[o.d] = { o, e }; });
      const v = Object.values(per), err = v.reduce((s, x) => s + x.e, 0);
      if (!meglio || v.length > meglio.v.length || (v.length === meglio.v.length && err < meglio.err)) meglio = { v, err };
    }
    return meglio ? meglio.v.map(x => x.o).sort((a, b) => a.d - b.d) : null;
  }

  /**
   * Legge la riga di una persona da una tabella turni (nomi sulle righe, giorni sulle colonne).
   * parole: [{ t: testo, x0, y0, x1, y1 }] con le posizioni restituite dall'OCR.
   */
  function leggiTabella(parole, nome, giorniMese, rigaY) {
    const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const W = parole.map(p => ({ t: String(p.t).trim(), x0: p.x0, y0: p.y0, x1: p.x1, y1: p.y1,
      xc: (p.x0 + p.x1) / 2, yc: (p.y0 + p.y1) / 2, h: p.y1 - p.y0 })).filter(p => p.t);
    if (!W.length) return { errore: 'vuoto' };
    const mediana = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
    const H = mediana(W.map(p => p.h)) || 10;

    // 1) riga d'intestazione: la riga con più numeri di giorno diversi (1..31, anche "03/11")
    const numeri = W.map(p => {
      const m = p.t.replace(/[^\d\/.\-]/g, '').match(/^(\d{1,2})(?:[\/.\-](\d{1,2}))?/);
      if (!m || !/^\D{0,3}\d/.test(p.t)) return null;
      const d = +m[1];
      return d >= 1 && d <= 31 ? Object.assign({ d, mm: m[2] ? +m[2] : null }, p) : null;
    }).filter(Boolean);
    const righe = [];
    numeri.slice().sort((a, b) => a.yc - b.yc).forEach(p => {
      const r = righe.find(r => Math.abs(r.yc - p.yc) < H * 0.6);
      if (r) { r.el.push(p); r.yc = r.el.reduce((s, q) => s + q.yc, 0) / r.el.length; } else righe.push({ yc: p.yc, el: [p] });
    });
    let migliore = null;
    righe.forEach(r => {
      // tieni la sequenza crescente più lunga (giorno che sale con la x)
      const el = r.el.slice().sort((a, b) => a.xc - b.xc);
      const lung = el.map(() => 1), prec = el.map(() => -1);
      for (let i = 0; i < el.length; i++) for (let j = 0; j < i; j++)
        if (el[j].d < el[i].d && lung[j] + 1 > lung[i]) { lung[i] = lung[j] + 1; prec[i] = j; }
      let k = lung.indexOf(Math.max(...lung)); let seq = [];
      while (k >= 0) { seq.unshift(el[k]); k = prec[k]; }
      // (24c.15, D-170) numeri piccoli o sfocati letti male ("3" per "11"): spezzano la sequenza crescente.
      // Allora si cerca la retta giorno → posizione su cui cadono più numeri (ogni coppia di numeri propone una retta)
      // (la sequenza crescente può contenere un numero sbagliato che sposta tutta la retta: si preferisce quella robusta)
      const robusta = rettaRobusta(el, H);
      if (robusta && robusta.length >= 5 && robusta.length >= seq.length * 0.6) seq = robusta;
      if (!migliore || seq.length > migliore.seq.length) migliore = { yc: r.yc, seq };
    });
    if (!migliore || migliore.seq.length < 5) return { errore: 'intestazione' };
    let seq = migliore.seq;

    // posizione x di ogni colonna-giorno: retta x = a + b·giorno, scartando i numeri letti male
    // (un "2" che in realtà era "12" finisce lontano dalla retta e viene tolto)
    let a = 0, b = 0;
    for (let giro = 0; giro < 12; giro++) {
      const n = seq.length, sx = seq.reduce((s, p) => s + p.d, 0), sy = seq.reduce((s, p) => s + p.xc, 0);
      const sxx = seq.reduce((s, p) => s + p.d * p.d, 0), sxy = seq.reduce((s, p) => s + p.d * p.xc, 0);
      b = (n * sxy - sx * sy) / (n * sxx - sx * sx); a = (sy - b * sx) / n;
      if (!(b > 0)) return { errore: 'intestazione' };
      let peggio = -1, scarto = 0;
      seq.forEach((p, i) => { const r = Math.abs(p.xc - (a + b * p.d)); if (r > scarto) { scarto = r; peggio = i; } });
      if (scarto <= b * 0.35 || seq.length <= 5) break;
      seq = seq.filter((_, i) => i !== peggio);
    }
    if (seq.length < 5) return { errore: 'intestazione' };
    // la tabella può mostrare solo una parte del mese (es. dal 12 al 31): si usano solo i giorni visibili
    const dal = Math.max(1, seq[0].d), al = Math.min(giorniMese, seq[seq.length - 1].d);
    if (al < dal) return { errore: 'intestazione' };
    const colonne = {};
    for (let d = dal; d <= al; d++) colonne[d] = a + b * d;
    seq.forEach(p => { if (p.d >= dal && p.d <= al) colonne[p.d] = p.xc; });
    const passo = b, primaX = colonne[dal] - passo / 2;
    const mesi = seq.map(p => p.mm).filter(Boolean);
    const meseTabella = mesi.length >= 3 ? mediana(mesi) : null;

    // 2) riga della persona: parole a sinistra della prima colonna, sotto l'intestazione
    const aSinistra = W.filter(p => p.x1 <= primaX + passo * 0.3 && p.yc > migliore.yc + H * 0.5 && /[a-zà-ü]/i.test(p.t));
    const righeNomi = [];
    aSinistra.slice().sort((p, q) => p.yc - q.yc || p.x0 - q.x0).forEach(p => {
      const r = righeNomi.find(r => Math.abs(r.yc - p.yc) < H * 0.6);
      if (r) r.el.push(p); else righeNomi.push({ yc: p.yc, el: [p] });
    });
    righeNomi.forEach(r => { r.testo = r.el.sort((p, q) => p.x0 - q.x0).map(p => p.t).join(' '); });
    const nomiTrovati = righeNomi.map(r => r.testo).filter(t => norm(t).length >= 2);

    const distanza = (s, t) => {
      const m = s.length, k = t.length, D = Array.from({ length: m + 1 }, (_, i) => [i].concat(new Array(k).fill(0)));
      for (let j = 1; j <= k; j++) D[0][j] = j;
      for (let i = 1; i <= m; i++) for (let j = 1; j <= k; j++)
        D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1));
      return D[m][k];
    };
    // (24c.15, D-170) righe da mostrare se il nome non si legge: si sceglie la propria riga guardando l'immagine
    const fineRiga = r => { const el = r.el.slice().sort((p, q) => p.x0 - q.x0); let f = el[0].x1; for (let i = 1; i < el.length && el[i].x0 - f < Math.min(passo * 0.6, H * 1.2); i++) f = Math.max(f, el[i].x1); return f; };
    const righeScelta = righeNomi.filter(r => r.el.some(p => /[a-zà-ü]{2}/i.test(p.t))).map(r => ({ yc: r.yc, testo: r.testo, fine: fineRiga(r) }));
    const nonTrovato = () => ({ errore: 'nome', nomiTrovati, colonne, meseTabella, righe: righeScelta, primaX });
    const pezzi = String(nome || '').split(/\s+/).map(norm).filter(x => x.length >= 2);
    let rigaNome = null, punti = 0, pari = 0;
    if (rigaY != null) {
      // riga scelta toccandola nell'elenco
      righeNomi.forEach(r => { if (Math.abs(r.yc - rigaY) < H * 0.6 && (!rigaNome || Math.abs(r.yc - rigaY) < Math.abs(rigaNome.yc - rigaY))) rigaNome = r; });
      if (!rigaNome) return nonTrovato();
    }
    if (!rigaNome && !pezzi.length) return nonTrovato();
    // contiene pz anche con una lettera sbagliata (per nomi letti "attaccati", es. ROSSIANNAMARIA)
    const contieneQuasi = (testo, pz) => {
      if (pz.length < 4) return false;
      for (let L = pz.length - 1; L <= pz.length + 1; L++)
        for (let i = 0; i + L <= testo.length; i++) if (distanza(testo.substr(i, L), pz) <= 1) return true;
      return false;
    };
    if (rigaY == null) righeNomi.forEach(r => {
      const parole = r.el.map(p => norm(p.t)).filter(Boolean), tutto = parole.join('');
      let s = 0;
      pezzi.forEach(pz => {
        if (parole.includes(pz) || tutto === pz || (pz.length >= 3 && tutto.includes(pz))) s += 2;
        else if (parole.some(w => (pz.length >= 4 && distanza(w, pz) <= 1) || (w.length >= 3 && pz.startsWith(w))) || contieneQuasi(tutto, pz)) s += 1;
      });
      if (s > punti) { punti = s; rigaNome = r; pari = 0; } else if (s && s === punti) pari++;
    });
    // (24c.15, D-170) somiglianza troppo debole (nomi sfocati letti a caso) o due righe ugualmente simili
    // (es. "Maria" in due nomi): meglio far scegliere la riga guardando l'immagine che prendere quella sbagliata
    if (rigaY == null && rigaNome && (punti < pezzi.length || pari)) rigaNome = null;
    if (!rigaNome) return nonTrovato();

    // 3) prima stima delle celle dalla lettura complessiva (usata come riserva)
    const fineNome = Math.max(...rigaNome.el.map(p => p.x1));
    const celle = W.filter(p => Math.abs(p.yc - rigaNome.yc) < H * 0.7 && p.x0 >= fineNome - 2 && p.xc > primaX);
    const giorni = {};
    celle.forEach(p => {
      const codice = codiceTurno(p.t, typeof tipi !== 'undefined' ? tipi : null);
      if (!codice.length) return;
      const x = (p.x1 - p.x0) > passo * 0.9 ? p.x0 + passo * 0.45 : p.xc; // "Corso" che sborda: conta la cella in cui inizia
      let giorno = null, best = Infinity;
      Object.keys(colonne).forEach(d => { const dd = Math.abs(colonne[d] - x); if (dd < best) { best = dd; giorno = +d; } });
      if (best > passo * 0.65) return;
      const g = giorni[giorno] || (giorni[giorno] = []);
      codice.forEach(c => { if (!g.includes(c)) g.push(c); });
    });
    Object.keys(giorni).forEach(d => giorni[d].sort((x, y) => 'MPC'.indexOf(x) - 'MPC'.indexOf(y)));
    // altezza della riga: distanza tipica tra le righe dei nomi
    const passiY = righeNomi.map(r => r.yc).sort((p, q) => p - q).map((y, i, a) => i ? y - a[i - 1] : 0).filter(d => d > H * 0.8);
    const altezza = passiY.length ? mediana(passiY) : H * 1.6;
    // fascia verticale della riga: le sigle possono stare in alto o in fondo alla cella (in Excel spesso sono in fondo)
    // righe vere vicine (si ignorano pezzi di testo a pochi pixel, che non sono righe della tabella)
    const ys = righeNomi.map(r => r.yc).sort((p, q) => p - q);
    const prima = ys.filter(y => y < rigaNome.yc - altezza * 0.6), dopo = ys.filter(y => y > rigaNome.yc + altezza * 0.6);
    const sopra = prima.length ? prima[prima.length - 1] : Math.max(migliore.yc, rigaNome.yc - altezza);
    const sotto = dopo.length ? dopo[0] : rigaNome.yc + altezza;
    const fascia = { top: Math.max((sopra + rigaNome.yc) / 2, rigaNome.yc - altezza * 0.75), bottom: Math.min((rigaNome.yc + sotto) / 2, rigaNome.yc + altezza * 0.75) };
    // dove finiscono nomi e ruoli: valore tipico su tutte le righe (una cella letta come "nome" in una riga non conta)
    // per ogni riga si prende il primo gruppo di parole vicine tra loro (il nome); le sigle nelle celle sono staccate
    const fineGruppo = fineRiga;
    const fineEtichette = mediana(righeNomi.map(fineGruppo));
    const posNumeri = {}; seq.forEach(p => { posNumeri[p.d] = p.xc; });
    return { giorni, colonne, passo, dal, al, retta: { a, b }, numeri: posNumeri, intestazione: { yc: migliore.yc, h: H }, fineNome: fineEtichette,
      riga: { yc: rigaNome.yc, h: altezza, top: fascia.top, bottom: fascia.bottom }, nomiTrovati, meseTabella,
      rigaTrovata: (() => { const f = fineGruppo(rigaNome); return rigaNome.el.filter(p => p.x1 <= f + 1).map(p => p.t).join(' '); })() };
  }

  /** Lettere che il lettore può trovare nelle celle: sigle e nomi dei tuoi turni. */
  function letterePermesse(tipi) {
    const set = new Set();
    tipi.forEach(t => {
      (t.sigla + t.nome).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z]/g, '')
        .split('').forEach(c => { set.add(c.toUpperCase()); set.add(c.toLowerCase()); });
    });
    return [...set].join('');
  }

  /**
   * Testo di una cella → elenco di sigle. Riconosce:
   * la sigla ("M"), il nome anche tagliato ("Corso", "Cor"), più sigle attaccate ("MP", "M/P").
   * tipi: [{ sigla, nome }]. Senza tipi usa M, P, C (Mattino, Pomeriggio, Corso).
   */
  function codiceTurno(testo, tipi) {
    tipi = tipi && tipi.length ? tipi : [{ sigla: 'M', nome: 'Mattino' }, { sigla: 'P', nome: 'Pomeriggio' }, { sigla: 'C', nome: 'Corso' }];
    const N = x => String(x).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const t = N(testo);
    if (!t) return [];
    const sig = tipi.map(x => ({ s: N(x.sigla), n: N(x.nome) })).filter(x => x.s);
    // 1) sigla esatta
    const es = sig.find(x => x.s === t);
    if (es) return [es.s];
    // 2) nome scritto per intero o tagliato (almeno 3 lettere): "CORSO", "COR"
    if (t.length >= 3) {
      const nm = sig.find(x => x.n.length >= 3 && (x.n.startsWith(t) || t.startsWith(x.n.slice(0, Math.min(4, x.n.length)))));
      if (nm) return [nm.s];
    }
    // 3) più sigle attaccate: "MP" = M + P (tollera un carattere spurio dovuto al bordo della cella)
    const dividi = str => {
      const best = new Array(str.length + 1).fill(null); best[0] = [];
      for (let i = 0; i < str.length; i++) {
        if (!best[i]) continue;
        sig.forEach(x => { if (str.startsWith(x.s, i) && !best[i + x.s.length]) best[i + x.s.length] = best[i].concat(x.s); });
      }
      return best[str.length];
    };
    let parti = dividi(t);
    // (24c.15, D-170, caso L2/L3 di 04) si toglie solo un segno sottile come quelli lasciati dal bordo della cella
    // (I, L, J, 1): una lettera vera come la P di "MP" non viene mai buttata via
    if (!parti && t.length <= 4) {
      for (let i = 0; i < t.length && !parti; i++) if ('ILJ1'.includes(t[i])) parti = dividi(t.slice(0, i) + t.slice(i + 1));
    }
    if (!parti || parti.length > 3) return [];
    const ordine = sig.map(x => x.s);
    return [...new Set(parti)].sort((a, b) => ordine.indexOf(a) - ordine.indexOf(b));
  }
// ---------------- fine motore ----------------

const passo=n=>{[1,2,3,4].forEach(i=>{$('ft'+i).hidden=i!==n;});};
function apriFoto(lid,ym){
  const L=lavori();if(!L.length){toast('Prima aggiungi il tuo lavoro in Impostazioni.','err');return;}
  ft={lid:lid||L[0].id,ym:ym||cur,proposta:null,rigaY:null};
  $('ftLavBox').hidden=L.length<2;$('ftLav').innerHTML=L.map(l=>`<option value="${esc(l.id)}">${esc(l.nome)}</option>`).join('');$('ftLav').value=ft.lid;
  $('ftMese').value=ft.ym;$('ftNome').value=lav0(ft.lid).nomeTab||'';passo(1);chiudiSezioni($('ftModal'));$('ftModal').hidden=false;document.body.classList.add('noscroll');
}
const lav0=id=>(D().lavori||{})[id];
function chiudiFoto(){$('ftModal').hidden=true;$('ftFile').value='';if(['evModal','pjModal','cuModal','dayModal','listModal','confModal','lvModal','tuModal','bpModal','bpArch'].every(x=>!$(x)||$(x).hidden))document.body.classList.remove('noscroll');}
function msgErr(e){return errMsg(e);}
// lettura di tutta l'immagine: parole con la loro posizione
async function leggiParole(w,tela){
  await w.setParameters({tessedit_pageseg_mode:'11',tessedit_char_whitelist:''});const {data}=await w.recognize(tela);
  return (data.words||[]).map(p=>({t:p.text,x0:p.bbox.x0,y0:p.bbox.y0,x1:p.bbox.x1,y1:p.bbox.y1}));
}
// (24c.15, D-170) fasce orizzontali con della scritta (righe di testo), dall'alto in basso
function fasceTesto(tela){
  const W=tela.width,H=tela.height,s=tela.scala||1,p=tela.getContext('2d').getImageData(0,0,W,H).data,conta=new Uint32Array(H);
  for(let y=0;y<H;y++){let c=0;for(let x=0;x<W;x+=2)if(p[(y*W+x)*4]<128)c++;conta[y]=c;}
  const min=Math.max(2,W*0.0015),out=[];let y=0;
  while(y<H){if(conta[y]<min){y++;continue;}let y2=y;while(y2<H&&(conta[y2]>=min||(y2+1<H&&conta[y2+1]>=min)))y2++;out.push([y,y2]);y=y2+1;}
  return out.filter(([a,b])=>b-a>=3*s&&b-a<=40*s);
}
// (24c.15, D-170) riga dei giorni con numeri piccoli: ogni fascia di testo viene riletta da sola cercando solo cifre
async function numeriFasce(w,tela){
  await w.setParameters({tessedit_pageseg_mode:'11',tessedit_char_whitelist:'0123456789'});const out=[];
  for(const [a,b] of fasceTesto(tela)){
    const m=Math.round((b-a)*0.5),y0=Math.max(0,a-m),y1=Math.min(tela.height,b+m),c=document.createElement('canvas');
    c.width=tela.width;c.height=y1-y0;c.getContext('2d').drawImage(tela,0,y0,tela.width,y1-y0,0,0,tela.width,y1-y0);
    const {data}=await w.recognize(c);
    (data.words||[]).forEach(p=>{if(/^\d{1,2}$/.test(p.text.trim()))out.push({t:p.text.trim(),x0:p.bbox.x0,y0:p.bbox.y0+y0,x1:p.bbox.x1,y1:p.bbox.y1+y0});});
  }
  await w.setParameters({tessedit_char_whitelist:''});return out;
}
// quanto è riuscita la lettura della tabella: 0 niente, 1 giorni trovati ma non il nome, 2 tutto
const esitoTabella=r=>!r.errore?2:r.errore==='nome'?1:0;
async function leggiImmagine(file){
  passo(2);progresso(0,'Preparazione…');
  try{const w=await preparaLettore();
    if(file){const img=await immagineDaFile(file);let tela=preparaTela(img);progresso(0.22,'Cerco i giorni e i nomi nella tabella…');
      let parole=await leggiParole(w,tela);
      const nome=$('ftNome').value.trim(),giorni=new Date(...$('ftMese').value.split('-').map(Number),0).getDate(),e1=esitoTabella(leggiTabella(parole,nome,giorni));
      if(e1<2){
        // seconda lettura più attenta (immagini molto larghe e basse, scritte piccole o sbiadite): si tiene se va meglio
        progresso(0.24,'Leggo la tabella con più attenzione…');
        const t2=preparaTela(img,true),p2=(await leggiParole(w,t2.ocr)).concat(await numeriFasce(w,t2.ocr));
        if(esitoTabella(leggiTabella(p2,nome,giorni))>e1){tela=t2;parole=p2;}
      }
      ultimaImmagine={tela,parole};}
    if(!ultimaImmagine)throw new Error('nessuna immagine');await analizza();
  }catch(e){mostraErrore('Si è verificato un problema: '+msgErr(e)+'.');}
}
async function analizza(){
  const {tela,parole}=ultimaImmagine,nome=$('ftNome').value.trim();const l=lav0(ft.lid);
  const [anno,mese]=$('ftMese').value.split('-').map(Number);ft.ym=$('ftMese').value;
  tipi=l.tipi.filter(t=>t.sigla||t.nome).map(t=>({id:t.id,nome:t.nome,sigla:t.sigla||t.nome.slice(0,1),cat:t.cat,icona:t.icona,ore:t.ore}));
  const n=new Date(anno,mese,0).getDate();const r=leggiTabella(parole,nome,n,ft.rigaY);
  if(r.errore==='vuoto'||r.errore==='intestazione'){mostraErrore('Non trovo la riga con i numeri dei giorni (1, 2, 3…). Prova con uno screenshot più nitido, dritto e ritagliato sulla tabella, con la riga dei giorni ben visibile.');return;}
  if(r.errore==='nome'){mostraErrore(nome?'Non trovo «'+nome+'» nella tabella.':'Scrivi il tuo nome com’è nella tabella.',r.nomiTrovati,r);return;}
    const w = lettore, griglia = cellePerLinee(r, tela);
    // ai bordi della tabella un numero di giorno può sfuggire alla prima lettura: lo verifico cella per cella
    await w.setParameters({ tessedit_pageseg_mode: '8', tessedit_char_whitelist: '0123456789' });
    const numeroIn = async (d, box) => {
      const xc = r.retta.a + r.retta.b * d, ins = griglia ? griglia.margine : 0;
      const [x0, x1] = box ? [box[0] + ins, box[1] - ins] : [xc - r.passo * 0.48, xc + r.passo * 0.48];
      const c = tagliaCella(tela, x0, r.intestazione.yc - r.intestazione.h * 1.1, x1, r.intestazione.yc + r.intestazione.h * 1.1);
      const cd = tagliaCella(tela, x0, r.intestazione.yc - r.intestazione.h * 1.1, x1, r.intestazione.yc + r.intestazione.h * 1.1, true);
      if (!c) return false;
      // prima l'immagine "morbida", poi in bianco e nero puro (aiuta con le foto sfocate)
      for (const [im, psm] of (d < 10 ? [[c, '8'], [c, '10'], [c, '7'], [cd, '8'], [cd, '10']] : [[c, '8'], [c, '7'], [cd, '8'], [cd, '7']])) {
        await w.setParameters({ tessedit_pageseg_mode: psm });
        const letto = (await w.recognize(im)).data.text.replace(/\D/g, ''), giusto = String(d);
        if (parseInt(letto, 10) === d) return true;
        // con la griglia confermata basta un numero a due cifre con una sola cifra sbagliata (foto sfocata: "23" per "28")
        if (box && giusto.length === 2 && letto.length === 2 && (letto[0] === giusto[0] || letto[1] === giusto[1])) return true;
      }
      return pareNumero(c);
    };
    // (24c.15, D-170) numeri piccoli e sfocati che il lettore non riconosce: se la retta dei giorni è sicura
    // (almeno 8 numeri letti bene) basta che sopra la colonna ci sia una scritta alta come gli altri numeri
    // e che non sia una parola (es. "TOT" o "ORE" di una colonna dei totali)
    const noti = Object.keys(r.numeri).map(Number), rettaSicura = noti.length >= 8;
    let altNumeri = 0;
    if (rettaSicura) {
      const alt = noti.map(d => { const xc = r.numeri[d], c = tagliaCella(tela, xc - r.passo * 0.48, r.intestazione.yc - r.intestazione.h * 1.1, xc + r.passo * 0.48, r.intestazione.yc + r.intestazione.h * 1.1); return c ? c.altezza : 0; }).filter(Boolean).sort((a, b) => a - b);
      altNumeri = alt.length ? alt[Math.floor(alt.length / 2)] : 0;
    }
    const pareNumero = async c => {
      if (!rettaSicura || !altNumeri || Math.abs(c.altezza - altNumeri) > altNumeri * 0.3) return false;
      await w.setParameters({ tessedit_pageseg_mode: '8', tessedit_char_whitelist: '' });
      const t = (await w.recognize(c)).data.text;
      await w.setParameters({ tessedit_char_whitelist: '0123456789' });
      return !/[A-Za-z]{3,}/.test(t);
    };
    progresso(0.27, 'Controllo i bordi della tabella…');
    if (griglia) {
      // con le linee della griglia: colonne esatte anche se larghe diverse
      while (r.dal > 1 && griglia.colonna(r.dal - 1) && griglia.colonna(r.dal - 1)[0] >= r.fineNome - r.passo * 0.2 && await numeroIn(r.dal - 1, griglia.colonna(r.dal - 1))) r.dal--;
      while (r.al < n && griglia.colonna(r.al + 1) && await numeroIn(r.al + 1, griglia.colonna(r.al + 1))) r.al++;
    }
    while (!griglia && r.dal > 1) {
      const xc = r.retta.a + r.retta.b * (r.dal - 1);
      if (xc - r.passo / 2 < r.fineNome - r.passo * 0.2 || !(await numeroIn(r.dal - 1))) break;
      r.dal--; r.colonne[r.dal] = xc;
    }
    while (!griglia && r.al < n) {
      const xc = r.retta.a + r.retta.b * (r.al + 1);
      // l'ultima colonna può essere tagliata dal bordo dell'immagine: basta che se ne veda la metà
      if (xc + r.passo * 0.05 > tela.width || !(await numeroIn(r.al + 1))) break;
      r.al++; r.colonne[r.al] = xc;
    }

    // (24c.15, D-170) senza linee della griglia: la retta dei giorni viene rifinita con il centro della scritta
    // di ogni numero (i numeri sono centrati nella colonna); su 31 colonne un piccolo errore del passo
    // basterebbe a tagliare le sigle delle ultime colonne
    if (!griglia && r.al - r.dal >= 7) {
      const pt = [];
      for (let d = r.dal; d <= r.al; d++) {
        const xc = r.colonne[d], c = tagliaCella(tela, xc - r.passo * 0.48, r.intestazione.yc - r.intestazione.h * 1.1, xc + r.passo * 0.48, r.intestazione.yc + r.intestazione.h * 1.1);
        if (c) pt.push({ d, x: c.centro });
      }
      let sel = pt;
      for (let giro = 0; giro < 6 && sel.length >= 8; giro++) {
        const n2 = sel.length, sx = sel.reduce((s, p) => s + p.d, 0), sy = sel.reduce((s, p) => s + p.x, 0);
        const sxx = sel.reduce((s, p) => s + p.d * p.d, 0), sxy = sel.reduce((s, p) => s + p.d * p.x, 0);
        const b2 = (n2 * sxy - sx * sy) / (n2 * sxx - sx * sx), a2 = (sy - b2 * sx) / n2;
        const resto = sel.filter(p => Math.abs(p.x - (a2 + b2 * p.d)) <= r.passo * 0.15);
        if (resto.length === sel.length) {
          if (Math.abs(b2 - r.passo) < r.passo * 0.1 && sel.length >= (r.al - r.dal + 1) * 0.6) {
            for (let d = r.dal; d <= r.al; d++) r.colonne[d] = a2 + b2 * d;
            r.passo = b2;
          }
          break;
        }
        sel = resto;
      }
    }

    // seconda lettura: cella per cella, solo le lettere delle sigle e dei nomi dei tuoi turni
    await w.setParameters({ tessedit_pageseg_mode: '8', tessedit_char_whitelist: letterePermesse(tipi) });
    const letture = {}, forme = {}, celle = {};
    const leggi = async (im, psm) => { await w.setParameters({ tessedit_pageseg_mode: psm }); const c = codiceTurno((await w.recognize(im)).data.text.trim(), tipi); return c.length ? c.join('+') : null; };
    for (let d = r.dal; d <= r.al; d++) {
      let cella;
      if (griglia && griglia.colonna(d)) {
        const [cx0, cx1] = griglia.colonna(d), [ry0, ry1] = griglia.riga, ins = griglia.margine;
        cella = tagliaCella(tela, cx0 + ins, ry0 + ins, cx1 - ins, ry1 - ins);
      } else {
        const m = (r.riga.bottom - r.riga.top) * 0.05, xc = r.colonne[d];
        cella = tagliaCella(tela, xc - r.passo * 0.46, r.riga.top + m, xc + r.passo * 0.46, r.riga.bottom - m);
      }
      if (!cella) continue;
      celle[d] = cella; forme[d] = firmaForma(cella); letture[d] = [];
    }
    // (24c.15, D-170) le celle della riga messe in fila su una sola riga di testo: il lettore riconosce molto meglio
    // le lettere in una riga che da sole (una "M" isolata spesso non viene letta). Due versioni: bianco/nero e grigi.
    progresso(0.4, 'Leggo la riga…');
    for (const duro of [true, false]) {
      const fila = rigaDiCelle(celle, duro);
      if (!fila) break;
      await w.setParameters({ tessedit_pageseg_mode: '7' });
      const simboli = ((await w.recognize(fila.tela)).data.symbols || []).map(x => ({ t: x.text, xc: (x.bbox.x0 + x.bbox.x1) / 2 }));
      fila.pezzi.forEach(pz => {
        const t = simboli.filter(x => x.xc > pz.x0 - 4 && x.xc < pz.x1 + 4).map(x => x.t).join('');
        const c = codiceTurno(t, tipi); if (c.length) letture[pz.d].push(c.join('+'));
      });
    }
    // celle lette in modo diverso o non lette: anche da sole (ritaglio grande come parola, stretto come riga)
    const giorniCelle = Object.keys(celle).map(Number);
    for (const [i, d] of giorniCelle.entries()) {
      progresso(0.5 + 0.48 * ((i + 1) / giorniCelle.length), 'Controllo il giorno ' + d + '…');
      const v = letture[d];
      if (v.length === 2 && v[0] === v[1]) continue;
      v.push(await leggi(celle[d], '8'), await leggi(compatta(celle[d]), '13'));
      letture[d] = v.filter(Boolean);
    }
    giorniCelle.forEach(d => { if (r.giorni[d]) letture[d].push(r.giorni[d].join('+')); });
    await w.setParameters({ tessedit_pageseg_mode: '11', tessedit_char_whitelist: '' });
    const { letti: giorniLetti, incerti } = decidiCelle(letture, forme);
  const tipoPer=sg=>tipi.find(t=>String(t.sigla).toUpperCase()===sg);
  const proposta={},dubbi=new Set(incerti.map(d=>`${ft.ym}-${pad(d)}`));
  for(let d=r.dal;d<=r.al;d++)proposta[`${ft.ym}-${pad(d)}`]=(giorniLetti[d]||[]).map(tipoPer).filter(Boolean).map(t=>t.id);
  ft.proposta=proposta;ft.dubbi=dubbi;ft.nome=nome;
  const righe=[ft.rigaY!=null?'Riga scelta: <b>la '+ft.rigaN+'ª dell’elenco</b>':'Riga trovata: <b>'+esc(r.rigaTrovata)+'</b>','Giorni nella foto: '+(r.dal===1&&r.al===n?'tutto il mese':'dal '+r.dal+' al '+r.al+' (gli altri giorni non vengono toccati)')];
  if(dubbi.size)righe.push(`<span class="warn">${dubbi.size} ${dubbi.size===1?'giorno':'giorni'} da controllare (segnati con ⚠)</span>`);
  if((r.riga.h/(tela.scala||1))<18)righe.push('<span class="warn">⚠️ La foto è piccola: alcune lettere possono essere lette male. Per risultati migliori ingrandisci la tabella e rifai lo screenshot.</span>');
  if(r.meseTabella&&r.meseTabella!==mese)righe.push(`<span class="warn">Attenzione: la tabella sembra di ${MESI[r.meseTabella-1]}, ma stai importando in ${MESI[mese-1]}.</span>`);
  $('ftRiass').innerHTML=righe.join('<br>');riempiLetto();renderProposta();passo(4);
}
function testoLetto(){
  if(!ultimaImmagine||!ultimaImmagine.parole.length)return '(nessun testo riconosciuto nell’immagine)';
  const P=ultimaImmagine.parole.map(p=>({t:p.t,x:p.x0,y:(p.y0+p.y1)/2,h:p.y1-p.y0})).sort((a,b)=>a.y-b.y);
  const hs=P.map(p=>p.h).sort((a,b)=>a-b),H=hs[Math.floor(hs.length/2)]||10;const righe=[];
  P.forEach(p=>{const r=righe.find(r=>Math.abs(r.y-p.y)<H*0.6);if(r)r.el.push(p);else righe.push({y:p.y,el:[p]});});
  return 'Immagine '+ultimaImmagine.tela.width+'×'+ultimaImmagine.tela.height+' px, '+P.length+' parole\n\n'+righe.map(r=>r.el.sort((a,b)=>a.x-b.x).map(p=>p.t).join('  ')).join('\n');
}
function riempiLetto(){document.querySelectorAll('#ftModal .lettoTesto').forEach(e=>{e.textContent=testoLetto();});}
function mostraErrore(testo,nomi,tab){
  riempiLetto();$('ftFile').value='';$('ftErr').textContent=testo;
  const righe=tab&&tab.righe&&ultimaImmagine?tab.righe.slice(0,40):[];
  if(righe.length){
    // (24c.15, D-170) nomi piccoli o sfocati: ogni riga della tabella con il suo pezzo d'immagine, si tocca la propria
    const tela=ultimaImmagine.tela,gy=righe.map(x=>x.yc).sort((a,b)=>a-b).map((y,i,a)=>i?y-a[i-1]:0).filter(Boolean).sort((a,b)=>a-b);
    const alto=gy.length?gy[Math.floor(gy.length/2)]:40*(tela.scala||1);
    $('ftNomi').innerHTML=righe.map((x,i)=>{
      const y0=Math.max(0,Math.round(x.yc-alto*0.5)),y1=Math.min(tela.height,Math.round(x.yc+alto*0.5)),x1=Math.min(tela.width,Math.round(Math.min(x.fine,tab.primaX)+alto*0.3)); // solo nome (e sigla del ruolo), non le celle dei giorni
      const c=document.createElement('canvas'),k=64/Math.max(1,y1-y0);c.height=64;c.width=Math.max(1,Math.min(1600,Math.round(x1*k)));
      c.getContext('2d').drawImage(tela,0,y0,x1,y1-y0,0,0,c.width,64);
      return `<button type="button" class="ftriga" data-ftriga="${Math.round(x.yc)}" data-ftn="${i+1}" aria-label="Riga ${i+1}: ${esc(x.testo)}"><img alt="" src="${c.toDataURL('image/png')}"><small>${esc(x.testo)}</small></button>`;
    }).join('');
    $('ftNomiTit').textContent='Righe della tabella: tocca la tua';
  }else{
    $('ftNomi').innerHTML=(nomi||[]).slice(0,30).map(nm=>`<button type="button" class="chip" data-ftnome="${esc(nm)}">${esc(nm)}</button>`).join('');
    $('ftNomiTit').textContent='Nomi che ho letto nella tabella: tocca il tuo';
  }
  $('ftNomiBox').hidden=!(righe.length||(nomi&&nomi.length));passo(3);
}
// controllo giorno per giorno: tocca i tipi per aggiungerli o toglierli
function renderProposta(){
  const l=lav0(ft.lid);const giorni=Object.keys(ft.proposta).sort();
  $('ftLista').innerHTML=giorni.map(d=>{const g=parseYmd(d);const sel=ft.proposta[d];const dub=ft.dubbi.has(d);
    return `<div class="ftg${dub?' dub':''}"><span class="ftd">${dub?'⚠ ':''}${GIORNI[g.getDay()].slice(0,3)} ${g.getDate()}</span><span class="ftc">${l.tipi.map(t=>`<button type="button" class="chip${sel.includes(t.id)?' on':''}" style="--c:${colOk(t.colore||l.colore)}" data-ftd="${d}" data-ftt="${esc(t.id)}" title="${esc(t.nome)}">${esc(t.icona||t.sigla||t.nome)}</button>`).join('')}</span></div>`;}).join('');
  const varT=l.tipi.find(t=>t.cat==='variabile'&&Object.values(ft.proposta).some(x=>x.includes(t.id)));
  $('ftOreBox').hidden=!varT;if(varT){$('ftOreBox').firstChild.nodeValue='Ore per ogni «'+varT.nome+'»';if(!$('ftOre').value)$('ftOre').value=varT.ore||4;}
  $('ftLegenda').innerHTML=l.tipi.map(t=>`${esc(t.icona||t.sigla||'')} = ${esc(t.nome)}`).join(' · ');
}
function confermaFoto(){
  const l=lav0(ft.lid);if(!l||!ft.proposta)return;const now=Date.now();let n=0;const oreV=$('ftOre').value.trim();
  if(ft.nome&&l.nomeTab!==ft.nome){l.nomeTab=ft.nome;l.updatedAt=now;}
  for(const [d,ids] of Object.entries(ft.proposta)){
    for(const x of turniDi(l.id).filter(x=>x.data===d)){x.deleted=true;x.updatedAt=now;}
    for(const id of ids){const t=l.tipi.find(x=>x.id===id);const tid=uid();D().turni[tid]={id:tid,lid:l.id,data:d,tipo:id,da:'',a:'',pausa:'',ore:t&&t.cat==='variabile'&&!(t.da&&t.a)?oreV:'',nota:'',updatedAt:now};n++;}}
  changed();chiudiFoto();cur=ft.ym;render();toast(`Turni salvati: ${n} in ${Object.keys(ft.proposta).length} giorni.`);
}
document.addEventListener('click',e=>{
  const o=e.target.closest('[data-ftopen]');if(o){apriFoto(o.dataset.ftopen||null,cur);return;}
  const c=e.target.closest('[data-ftd]');if(c){const d=c.dataset.ftd,t=c.dataset.ftt;const a=ft.proposta[d];const i=a.indexOf(t);if(i>=0)a.splice(i,1);else a.push(t);ft.dubbi.delete(d);renderProposta();return;}
  const rg=e.target.closest('[data-ftriga]');if(rg){ft.rigaY=+rg.dataset.ftriga;ft.rigaN=+rg.dataset.ftn;passo(2);progresso(0.3,'Leggo la riga scelta…');analizza().catch(er=>mostraErrore(msgErr(er)));return;}
  const nm=e.target.closest('[data-ftnome]');if(nm){ft.rigaY=null;$('ftNome').value=nm.dataset.ftnome;passo(2);progresso(0.3,'Leggo la riga di '+nm.dataset.ftnome+'…');analizza().catch(er=>mostraErrore(msgErr(er)));}
});
function bind(){
  $('ftClose').onclick=chiudiFoto;$('ftAnnulla').onclick=chiudiFoto;$("ftSalva").onclick=confermaFoto;$('ftLav').onchange=()=>{ft.lid=$('ftLav').value;$('ftNome').value=lav0(ft.lid).nomeTab||'';};
  $('ftScegli').onclick=e=>{if(!$('ftNome').value.trim()){e.preventDefault();$('ftNome').focus();$('ftNome').placeholder='Scrivi prima il tuo nome';}};
  $('ftFile').onchange=e=>{const f=e.target.files&&e.target.files[0];if(f){ft.rigaY=null;leggiImmagine(f);}};
  $('ftModal').addEventListener('click',e=>{if(e.target.id==='ftModal')chiudiFoto();});
}
bind();
window.FotoTurni={apriFoto,leggiTabella,codiceTurno,decidiCelle};
})();
