// v24b (D-054, D-064, D-087): i dati di Soldirini passano da localStorage a IndexedDB.
// È il primo file che il telefono carica: apre IndexedDB, legge i dati (e li sposta da localStorage una volta sola),
// poi carica gli altri file dell'app nell'ordine di sempre. Se IndexedDB non c'è o non risponde entro 3 secondi,
// l'app parte con localStorage come nella v24 (Archivio.modo = 'localStorage').
// Requisiti di 03: report 03-sicurezza-requisiti-v24b-2026-11-17 (R1-R5). Nessun dato viene mai cancellato qui,
// tranne con "Esci" / cambio account (svuotaFile, chiamata da app.js).
'use strict';
// anti-riquadro (v24csp): app.js ora parte dopo la lettura di IndexedDB, quindi la pagina si nasconde già qui,
// prima di qualsiasi attesa. app.js tiene il suo controllo (IN_RIQUADRO) come prima.
try { if (window.top !== window.self) document.documentElement.style.display = 'none'; } catch (e) { document.documentElement.style.display = 'none'; }
(function (g) {
  const LS = 'soldirini-v1';             // vecchia voce: resta intatta come punto di ritorno (R3.1, D-087 1a)
  const CHIUSURA = 'chiusura'; // v24c (V10b di 03): la scrittura alla chiusura va in questa chiave, mai sopra il record dei dati
  const DIARIO = 'soldirini-in-attesa'; // solo alla chiusura della pagina, con dati non ancora scritti in IndexedDB (vedi scriviSubito)
  const SEGNO = 'soldirini-spostato';     // solo la data dello spostamento, nessun dato: serve a capire se IndexedDB è stato svuotato (R3.2)
  const NOME = 'soldirini', ST = 'dati', K = 'dati', ATTESA = 3000;
  const PARTE = 'da-parte'; // v24c (V9 di 03): "dati messi da parte" con una chiave a parte, mai uniti né mandati su Drive
  const SCRIPT = ['lib/jszip.min.js', 'lib/jspdf.umd.min.js', 'lib/html2canvas.min.js', 'numeri.js', 'docs.js', 'xlsx.js', 'modelli.js', 'app.js', 'plus.js', 'tasse.js',
    'ui.js', 'word.js', 'pdfdoc.js', 'stipcalc.js', 'pencalc.js', 'buste.js', 'stipendio.js', 'scelte.js', 'attivita.js', 'fototurni.js', 'gcal.js', 'soldi.js', 'risparmi.js',
    'pensione.js', 'entrate.js', 'extra.js', 'banca.js', 'copia.js', 'eliminamese.js', 'animazioni.js'];
  // modo: 'idb' oppure 'localStorage'; da: 'localStorage' (spostati ora) | 'nuovo' | 'perso' (IndexedDB vuoto dopo uno spostamento) | 'idb'
  // epoca (v24c, V10 di 03): cresce con "Esci", cambio account, "Sostituisci tutto", "Rimetti" e "Prendi i dati di Drive".
  // Una scheda che trova un'epoca più alta della sua non unisce e non scrive: si ricarica con i dati nuovi.
  const A = { modo: 'localStorage', motivo: '', dopoSpostamento: false, da: null, iniziale: null, rev: 0, epoca: 0, errore: null, daSalvare: false, fermo: false, avviata: false,
    prot: { stato: null, rifiutata: false } };
  g.Archivio = A;
  let db = null, canale = null, inCorso = null, ancora = false, abbandonato = false;
  const nomeErr = e => (e && (e.name && e.name !== 'Error' ? e.name : e.message)) || 'errore';

  // ---------- IndexedDB ----------
  function apri() {
    return new Promise((ok, ko) => {
      let r; try { r = indexedDB.open(NOME, 1); } catch (e) { ko(e); return; }
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(ST)) r.result.createObjectStore(ST); };
      r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
    });
  }
  // lettura e scrittura valgono solo a transazione completata (evento "complete", R1.2)
  function leggi() {
    return new Promise((ok, ko) => {
      const t = db.transaction(ST, 'readonly'), r = t.objectStore(ST).get(K); let v;
      r.onsuccess = () => { v = r.result; }; t.oncomplete = () => ok(v); t.onerror = t.onabort = () => ko(t.error || new Error('lettura'));
    });
  }
  function metti(rec) {
    return new Promise((ok, ko) => {
      const t = db.transaction(ST, 'readwrite');
      try { if (rec === undefined) t.objectStore(ST).delete(K); else t.objectStore(ST).put(rec, K); } catch (e) { ko(e); return; }
      t.oncomplete = () => ok(); t.onerror = t.onabort = () => ko(t.error || new Error('scrittura'));
    });
  }
  async function impronta(s) {
    try { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join(''); }
    catch (e) { return 'testo:' + s; }
  }
  const conta = o => { const d = (o && o.data) || {}; const n = x => Object.keys(x || {}).length; return [n(d.eventi), n(d.progetti), (o && o.meta && o.meta.seq) || 0].join('|'); };

  // ---------- spostamento, una volta sola (R1) ----------
  // restituisce il risultato; avvia() lo applica solo se non è scaduto il tempo massimo
  async function sposta() {
    const rec = await leggi(), rev0 = (rec && rec.rev) || 0;
    if (rec && typeof rec.testo === 'string') {
      let o = null; try { o = JSON.parse(rec.testo); } catch (e) { }
      if (o && typeof o === 'object' && o.meta && o.meta.archivio) return { modo: 'idb', da: 'idb', iniziale: o, rev: rev0, epoca: +rec.epoca || 0 };
    }
    let testo = null, segno = null;
    try { testo = localStorage.getItem(LS); segno = localStorage.getItem(SEGNO); } catch (e) { }
    // già spostati in passato, ma ora IndexedDB è vuoto o rovinato: si riparte vuoti e si chiede se riprendere la vecchia copia
    // (R3.2: mai un ripristino silenzioso)
    const ep0 = (rec && +rec.epoca) || 0;
    if (segno) return { modo: 'idb', da: 'perso', iniziale: null, rev: rev0, epoca: ep0 };
    if (testo == null) return { modo: 'idb', da: 'nuovo', iniziale: null, rev: rev0, epoca: ep0 }; // utente nuovo
    let o = null; try { o = JSON.parse(testo); } catch (e) { }
    // R1.1: dati non leggibili → nessuno spostamento, nessuna cancellazione, si resta su localStorage
    if (!o || typeof o !== 'object' || !o.data || !o.meta || typeof o.data !== 'object' || typeof o.meta !== 'object') {
      // l'app resterà su localStorage e al primo salvataggio riscriverà la voce: il testo rovinato va prima messo da parte (nessuna cancellazione)
      try { if (localStorage.getItem(LS + '-illeggibile') == null) localStorage.setItem(LS + '-illeggibile', testo); } catch (e) { }
      return { motivo: 'vecchia voce non leggibile' };
    }
    const originale = JSON.stringify(o);
    o.meta.archivio = { da: 'localStorage', il: new Date().toISOString(), versione: '24b' };
    const nuovo = JSON.stringify(o), rev = rev0 + 1;
    try { await metti({ rev, testo: nuovo }); } catch (e) { return { motivo: 'spostamento non riuscito (' + nomeErr(e) + ')' }; } // R1.3: al prossimo avvio si riprova
    // controllo (R1.3): rilettura, impronta SHA-256 del testo senza il segno, conteggi di eventi, progetti e seq
    let ok = false, letto = null;
    try {
      letto = await leggi(); const o2 = JSON.parse(letto.testo); delete o2.meta.archivio;
      ok = letto.rev === rev && await impronta(JSON.stringify(o2)) === await impronta(originale) && conta(o2) === conta(JSON.parse(originale));
    } catch (e) { ok = false; }
    if (!ok || abbandonato) { try { await metti(undefined); } catch (e) { } return { motivo: abbandonato ? 'spostamento troppo lento' : 'controllo dello spostamento non riuscito' }; }
    try { localStorage.setItem(SEGNO, o.meta.archivio.il); } catch (e) { }
    return { modo: 'idb', da: 'localStorage', iniziale: JSON.parse(letto.testo), rev };
  }

  async function avvia() {
    if (!g.indexedDB) { A.motivo = 'IndexedDB non disponibile'; return; }
    try { db = await Promise.race([apri(), new Promise((_, ko) => setTimeout(() => ko(new Error('IndexedDB non risponde')), ATTESA))]); }
    catch (e) { A.motivo = nomeErr(e); db = null; return; }
    // con più schede aperte lo spostamento lo fa una sola (R1.6)
    const lavoro = () => sposta();
    const tutto = g.navigator.locks ? g.navigator.locks.request('soldirini-dati', lavoro) : lavoro();
    let r;
    try { r = await Promise.race([tutto, new Promise((_, ko) => setTimeout(() => ko(new Error('troppo lento')), ATTESA * 3))]); }
    catch (e) { abbandonato = true; r = { motivo: nomeErr(e) }; }
    if (r && r.modo === 'idb') { A.modo = 'idb'; A.da = r.da; A.iniziale = r.iniziale; A.rev = r.rev; A.epoca = r.epoca || 0; } else A.motivo = (r && r.motivo) || 'sconosciuto';
    if (A.modo === 'idb') A.chiusura = await new Promise(ok => { // v24c (V10b): scrittura fatta alla chiusura della pagina, se c'è
      try { const t = db.transaction(ST, 'readonly'), q = t.objectStore(ST).get(CHIUSURA); let v; q.onsuccess = () => { v = q.result; }; t.oncomplete = () => ok(v || null); t.onerror = t.onabort = () => ok(null); } catch (e) { ok(null); }
    });
    if (A.modo === 'idb' && 'BroadcastChannel' in g) {
      canale = new BroadcastChannel('soldirini');
      canale.onmessage = ev => ricevi(ev.data || {});
    }
  }

  // ---------- salvataggio (R2): una scrittura alla volta, sempre con lo stato più recente ----------
  function unisci(rec) {
    if (A.blocco) return; // v24c: dati appena sostituiti, la scrittura senza unione (nuovaEpoca) sta per partire
    let o = null; try { o = JSON.parse(rec.testo); } catch (e) { return; }
    if (!o || !o.data) return;
    DB.data = mergeData(DB.data, o.data); // stessa unione per updatedAt usata con Drive
    const m = o.meta || {}, M = DB.meta;
    M.seq = Math.max(M.seq || 0, m.seq || 0); M.synced = Math.min(M.synced || 0, m.synced || 0);
    M.queue = Object.assign({}, m.queue || {}, M.queue || {}); M.lastSync = Math.max(M.lastSync || 0, m.lastSync || 0);
    for (const k of ['dataId', 'account']) if (!M[k] && m[k]) M[k] = m[k];
    A.rev = rec.rev;
  }
  function scriviUna() {
    return new Promise((ok, ko) => {
      let rev = 0, fermata = false; const t = db.transaction(ST, 'readwrite'), s = t.objectStore(ST), r = s.get(K);
      r.onsuccess = () => {
        try {
          const rec = r.result;
          // V10: un'altra scheda ha sostituito i dati o è uscita (epoca più alta): niente unione e niente scrittura
          if (rec && (+rec.epoca || 0) > A.epoca) { fermata = true; nuovaEpocaVista(); try { t.abort(); } catch (x) { } return; }
          if (rec && (rec.rev || 0) > A.rev) unisci(rec); // un'altra scheda ha scritto dopo di noi (R2.4)
          rev = ((rec && rec.rev) || 0) + 1; s.put({ rev, testo: JSON.stringify(DB), epoca: A.epoca }, K);
        } catch (e) { try { t.abort(); } catch (x) { } ko(e); }
      };
      t.oncomplete = () => { A.rev = rev; if (canale) try { canale.postMessage({ tipo: 'scritto', rev }); } catch (e) { } ok(); };
      t.onerror = t.onabort = () => fermata ? ok() : ko(t.error || r.error || new Error('scrittura'));
    });
  }
  A.salva = function () {
    if (A.modo !== 'idb' || A.fermo || !db) return Promise.resolve(false);
    A.daSalvare = true;
    if (inCorso) { ancora = true; return inCorso; }
    inCorso = (async () => {
      try {
        do { ancora = false; await scriviUna(); } while (ancora);
        A.errore = null; A.daSalvare = false; return true;
      } catch (e) { // R2.2: messaggio come oggi; la modifica resta in memoria e si riprova alla prossima modifica o al ritorno nell'app
        A.errore = nomeErr(e);
        // testi di 02 (tornata 22 A3), almeno 8 secondi
        try { toast(A.errore === 'QuotaExceededError' ? MSG_MEMORIA_PIENA : '⚠ Le ultime modifiche non sono salvate sul telefono. Soldirini riprova alla prossima modifica: intanto non chiudere l’app.', 'err', 8000); } catch (x) { }
        return false;
      }
    })().finally(() => { inCorso = null; });
    return inCorso;
  };
  // per le prove e per "Esci": aspetta la fine della scrittura in corso
  A.salvato = () => inCorso || Promise.resolve(!A.daSalvare);
  // R2.3: app in secondo piano o chiusa → la scrittura in sospeso parte subito
  const svuota = () => { if (A.daSalvare && !inCorso) A.salva(); };
  // Pagina che si chiude (pagehide) con dati non ancora scritti. IndexedDB è asincrono: se la pagina sparisce prima che la
  // scrittura sia completa, il telefono la annulla (visto nelle prove, T-S5). Per questo:
  // 1) copia sincrona in localStorage['soldirini-in-attesa'], che resta anche se la pagina sparisce subito; all'avvio dopo
  //    app.js la unisce (stessa unione di Drive) e la cancella appena la scrittura in IndexedDB è riuscita. Può non starci
  //    (oltre circa 5 MiB): allora resta solo il punto 2. "Esci" la cancella con la vecchia copia;
  // 2) scrittura diretta in IndexedDB, senza lettura prima, con revisione alta (ora attuale): un'altra scheda aperta la vede
  //    come più nuova e la unisce prima di scrivere (R2.4).
  // v24c (V10, V10b e V16 di 03): le due copie portano l'epoca e valgono solo con la stessa epoca del record dei dati.
  // La scrittura in IndexedDB va nella chiave "chiusura", mai sopra il record "dati": così non può cancellare quello che hanno
  // fatto "Esci" o "Sostituisci tutto" in un'altra scheda. All'avvio app.js unisce le copie (stessa unione di Drive) e le cancella.
  const scriviSubito = () => {
    if (!(A.daSalvare || inCorso) || A.modo !== 'idb' || A.fermo || !db) return;
    let testo; try { testo = JSON.stringify(DB); } catch (e) { return; }
    // V16: se la copia non ci sta, si toglie anche quella vecchia (non deve restare una copia superata)
    try { localStorage.setItem(DIARIO, JSON.stringify({ epoca: A.epoca, testo })); } catch (e) { try { localStorage.removeItem(DIARIO); } catch (x) { } }
    try {
      const t = db.transaction(ST, 'readwrite'), s = t.objectStore(ST), r = s.get(K);
      r.onsuccess = () => { const rec = r.result; if (rec && (+rec.epoca || 0) !== A.epoca) return; s.put({ epoca: A.epoca, testo }, CHIUSURA); if (t.commit) t.commit(); };
    } catch (e) { }
  };
  const copiaValida = w => {
    try {
      if (!w || typeof w !== 'object' || (+w.epoca || 0) !== A.epoca || typeof w.testo !== 'string') return null; // epoca diversa: non vale più
      const o = JSON.parse(w.testo); return o && typeof o === 'object' && o.data && typeof o.data === 'object' ? o : null;
    } catch (e) { return null; }
  };
  // copie da unire all'avvio (0, 1 o 2); quelle non valide si cancellano subito
  A.diario = () => {
    let w = null; try { const t = localStorage.getItem(DIARIO); w = t ? JSON.parse(t) : null; } catch (e) { }
    const out = [], a = copiaValida(w), b = copiaValida(A.chiusura);
    if (a) out.push(a); else if (w) try { localStorage.removeItem(DIARIO); } catch (e) { }
    if (b) out.push(b); else if (A.chiusura) togliChiusura();
    return out;
  };
  function togliChiusura() { A.chiusura = null; if (!db) return; try { db.transaction(ST, 'readwrite').objectStore(ST).delete(CHIUSURA); } catch (e) { } }
  A.togliDiario = () => { try { localStorage.removeItem(DIARIO); } catch (e) { } togliChiusura(); };
  g.addEventListener('pagehide', scriviSubito);
  document.addEventListener('visibilitychange', () => { if (document.hidden) svuota(); else if (A.errore) A.salva(); });

  // V4 di 02: dopo la ricarica app.js mostra un messaggio, ma solo se ci sono dati o un account (dopo "Esci" non ci sono).
  // Il segno si mette sempre: la scheda può accorgersi dell'epoca nuova dal messaggio o dalla propria scrittura.
  function nuovaEpocaVista() { if (A.fermo) return; A.fermo = true; try { sessionStorage.setItem('soldirini-ricaricata', '1'); } catch (e) { } try { location.reload(); } catch (e) { } }
  async function ricevi(m) {
    if (m.tipo === 'esci' || m.tipo === 'epoca') { nuovaEpocaVista(); return; } // un'altra scheda è uscita o ha sostituito i dati: questa non deve rimetterli
    if (m.tipo !== 'scritto' || !(m.rev > A.rev) || !db) return;
    try { const rec = await leggi(); if (rec && (+rec.epoca || 0) > A.epoca) { nuovaEpocaVista(); return; } if (rec && (rec.rev || 0) > A.rev) { unisci(rec); try { render(); } catch (e) { } } } catch (e) { }
  }

  // ---------- "Esci" e cambio account (R3.4, R3.5, D-087 1b) ----------
  // si cancellano solo le voci e i database di Soldirini, per nome (R3.6): mai Strafobico né rimborsi-pwa-v1
  A.togliVecchia = () => { try { localStorage.removeItem(LS); localStorage.removeItem(SEGNO); localStorage.removeItem(LS + '-illeggibile'); localStorage.removeItem(DIARIO); localStorage.removeItem('soldirini-' + PARTE); } catch (e) { } };
  A.svuotaFile = () => new Promise(ok => {
    try {
      const r = indexedDB.open('soldirini-file', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('f');
      r.onsuccess = () => { const d = r.result; try { const t = d.transaction('f', 'readwrite'); t.objectStore('f').clear(); t.oncomplete = t.onabort = t.onerror = () => { d.close(); ok(); }; } catch (e) { d.close(); ok(); } };
      r.onerror = () => ok();
    } catch (e) { ok(); }
  });
  A.esci = () => { if (canale) try { canale.postMessage({ tipo: 'esci' }); } catch (e) { } };

  // ---------- v24c: nuova epoca (V10) e dati messi da parte (V9) ----------
  // Scrive i dati di adesso SENZA unire quelli delle altre schede, con un'epoca più alta; le altre schede si ricaricano.
  // da chiamare subito PRIMA di sostituire DB: nessuna unione con le altre schede fino alla scrittura con l'epoca nuova
  A.blocca = () => { A.blocco = true; };
  A.nuovaEpoca = async function () {
    A.blocco = true;
    if (A.modo !== 'idb' || !db) { A.blocco = false; return true; }
    try { await A.salvato(); } catch (e) { }
    return new Promise(ok => {
      let rev = 0, ep = 0; const t = db.transaction(ST, 'readwrite'), s = t.objectStore(ST), r = s.get(K);
      try { localStorage.removeItem(DIARIO); } catch (e) { } // V16: le copie fatte alla chiusura si tolgono prima di scrivere
      r.onsuccess = () => { const rec = r.result; ep = Math.max((rec && +rec.epoca) || 0, A.epoca) + 1; rev = ((rec && rec.rev) || 0) + 1; s.put({ rev, testo: JSON.stringify(DB), epoca: ep }, K); s.delete(CHIUSURA); };
      t.oncomplete = () => { A.rev = rev; A.epoca = ep; A.daSalvare = false; A.blocco = false; A.togliDiario(); if (canale) try { canale.postMessage({ tipo: 'epoca', epoca: ep }); } catch (e) { } ok(true); };
      t.onerror = t.onabort = () => { A.blocco = false; ok(false); };
    });
  };
  const LSP = 'soldirini-' + PARTE;
  // { il: 'AAAA-MM-GG', testo: JSON dei dati } oppure null
  A.parte = () => new Promise(ok => {
    const vale = v => v && typeof v === 'object' && typeof v.testo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.il || '') ? v : null;
    if (A.modo !== 'idb' || !db) { try { ok(vale(JSON.parse(localStorage.getItem(LSP) || 'null'))); } catch (e) { ok(null); } return; }
    try { const t = db.transaction(ST, 'readonly'), r = t.objectStore(ST).get(PARTE); let v; r.onsuccess = () => { v = r.result; }; t.oncomplete = () => ok(vale(v)); t.onerror = t.onabort = () => ok(null); } catch (e) { ok(null); }
  });
  A.mettiDaParte = (v) => new Promise(ok => {
    if (A.modo !== 'idb' || !db) { try { localStorage.setItem(LSP, JSON.stringify(v)); ok(true); } catch (e) { ok(false); } return; }
    try { const t = db.transaction(ST, 'readwrite'); t.objectStore(ST).put(v, PARTE); t.oncomplete = () => ok(true); t.onerror = t.onabort = () => ok(false); } catch (e) { ok(false); }
  });
  A.togliParte = () => new Promise(ok => {
    try { localStorage.removeItem(LSP); } catch (e) { }
    if (A.modo !== 'idb' || !db) { ok(true); return; }
    try { const t = db.transaction(ST, 'readwrite'); t.objectStore(ST).delete(PARTE); t.oncomplete = () => ok(true); t.onerror = t.onabort = () => ok(false); } catch (e) { ok(false); }
  });

  // ---------- vecchia copia (R3.2): domanda se i dati attuali sono vuoti e la vecchia voce ha dati ----------
  const vivi = x => Object.values(x || {}).filter(v => v && typeof v === 'object' && !v.deleted);
  const pieni = d => d && ['eventi', 'progetti', 'lavori', 'fissi', 'spesePers', 'buste', 'cedolini', 'turni'].some(k => vivi(d[k]).length > 0);
  A.vecchiaCopia = () => {
    if (A.modo !== 'idb') return null;
    let o = null; try { o = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { return null; }
    if (!o || typeof o !== 'object' || !o.data || typeof o.data !== 'object' || !pieni(o.data)) return null;
    // data della copia: la modifica più recente dentro la copia (updatedAt) o l'ultima sincronizzazione; se non c'è, nessuna data
    let t = (o.meta && +o.meta.lastSync) || 0;
    for (const k of Object.keys(o.data)) { const x = o.data[k]; if (x && typeof x === 'object') for (const v of Object.values(x)) if (v && typeof v === 'object' && +v.updatedAt > t) t = +v.updatedAt; }
    const m = mancantiDi(o.data);
    const ev = vivi(o.data.eventi), date = ev.map(e => e.data).filter(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    return { data: o.data, quando: t >= 1577836800000 && t < 4102444800000 ? new Date(t) : null, // solo date vere (dal 2020)
      attivita: ev.length, ultima: date.pop() || null,
      progetti: vivi(o.data.progetti).length, spese: vivi(o.data.spesePers).length, manca: m, mancanti: m.tot };
  };
  // voci della vecchia copia che nei dati attuali non ci sono (D-093 punto 1: la riga in Impostazioni compare solo se ce n'è almeno una)
  // Il confronto è per id: le voci cancellate restano nei dati come voce "deleted" (con updatedAt), quindi una voce cancellata
  // dopo lo spostamento NON conta come mancante e "Aggiungi" non la rimette. Torna solo se quella voce "deleted" è andata persa
  // (IndexedDB svuotato) – per questo la finestra ha l'avviso di 02.
  const RACCOLTE = ['eventi', 'progetti', 'lavori', 'fissi', 'spesePers', 'buste', 'cedolini', 'turni'];
  const ymd = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
  const mancantiDi = vecchi => {
    const r = { tot: 0, per: {}, voci: {}, dal: null, al: null };
    for (const k of RACCOLTE) {
      const ora = (DB.data && DB.data[k]) || {};
      const m = Object.entries(vecchi[k] || {}).filter(([id, v]) => v && typeof v === 'object' && !v.deleted && !(id in ora));
      if (!m.length) continue;
      r.per[k] = m.length; r.tot += m.length; r.voci[k] = Object.fromEntries(m);
      if (k === 'eventi') for (const [, v] of m) if (ymd(v.data)) { if (!r.dal || v.data < r.dal) r.dal = v.data; if (!r.al || v.data > r.al) r.al = v.data; }
    }
    return r;
  };
  A.datiVuoti = () => !pieni(DB.data);

  // ---------- protezione dalla pulizia automatica (D-087 1c) ----------
  // Chrome e Safari non chiedono niente all'utente; Firefox per computer mostra una richiesta: lì solo dopo il tocco (R4)
  A.controllaProtezione = async (auto) => {
    const S = g.navigator.storage;
    if (!S || typeof S.persisted !== 'function') { A.prot.stato = 'nd'; return A.prot.stato; }
    try {
      let si = await S.persisted();
      const installata = g.matchMedia && g.matchMedia('(display-mode: standalone)').matches, firefox = /Firefox\//.test(g.navigator.userAgent);
      if (!si && auto && installata && !firefox && typeof S.persist === 'function') si = await S.persist();
      A.prot.stato = si ? 'si' : 'no';
    } catch (e) { A.prot.stato = 'nd'; }
    return A.prot.stato;
  };
  A.chiediProtezione = async () => {
    const S = g.navigator.storage; let si = false;
    try { si = !!(S && typeof S.persist === 'function' && await S.persist()); } catch (e) { si = false; }
    A.prot.stato = si ? 'si' : 'no'; A.prot.rifiutata = !si; return si;
  };

  // ---------- caricamento degli altri file, nell'ordine di sempre ----------
  function carica() {
    let ultimo = null;
    for (const s of SCRIPT) { const e = document.createElement('script'); e.src = s; e.async = false; document.body.appendChild(e); ultimo = e; }
    const fine = () => { A.avviata = true; try { if (typeof g.dopoAvvioArchivio === 'function') g.dopoAvvioArchivio(); } catch (e) { } };
    ultimo.addEventListener('load', fine); ultimo.addEventListener('error', fine);
  }
  // dati già spostati in passato ma IndexedDB ora non risponde: la vecchia voce in localStorage è la copia del giorno dello spostamento.
  // L'app la mostra, ma non la riscrive (resta il punto di ritorno) e non segna le modifiche come salvate (app.js, LS_FERMO).
  const dopo = () => { if (A.modo !== 'idb') { try { A.dopoSpostamento = !!localStorage.getItem(SEGNO); } catch (e) { } } carica(); };
  avvia().catch(e => { A.modo = 'localStorage'; A.iniziale = null; A.motivo = nomeErr(e); }).finally(dopo);
})(window);
