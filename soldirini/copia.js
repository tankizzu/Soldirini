'use strict';
// ================= Soldirini v24c · copia di sicurezza con password e ripresa =================
// D-054, D-058, D-059, D-065 punto 3, D-097 (piano 01 approvato), requisiti V1-V15 di 03 (tornata 22), testi di 02 (tornate 14 e 22).
// - "Salva una copia": file soldirini-copia-AAAA-MM-GG.soldirini (zip con info.json in chiaro + contenuto, cifrato se protetta:
//   AES-GCM 256, chiave da PBKDF2-SHA-256 a 600.000 iterazioni, sale 16 byte, iv 12 byte nuovo a ogni copia; info.json come dati
//   autenticati). Nel contenuto solo DB.data, un riepilogo e i file in attesa di Drive: mai token, PIN, DB.meta o diagnostica.
// - "Riprendi da una copia": il file è "non fidato" (V2, V5-V8). Niente cambia prima della scelta dell'utente.
//   Unisci = stessa unione di Drive. Sostituisci tutto = i dati di adesso vanno da parte (V9), epoca nuova (V10) e,
//   con Drive, generazione nuova (V11-V14, in app.js).
// - Promemoria dei 30 giorni in Riepilogo (D-058) solo per chi non usa Drive.
(function (g) {
  const FORMATO = 1, ITER = 600000, ITER_MAX = 5000000, MAX_FILE = 200 * 1024 * 1024, MAX_ESTRATTO = 500 * 1024 * 1024, GG = 864e5;
  const enc = new TextEncoder(), dec = new TextDecoder();
  const VIETATI = new Set(['__proto__', 'constructor', 'prototype']);
  // parti conosciute di DB.data (V6): le altre si scartano
  const RACCOLTE = ['pagamenti', 'progetti', 'eventi', 'mesi', 'files', 'cu', 'lavori', 'turni', 'buste', 'cedolini', 'spesePers', 'risparmi', 'fondi', 'fissi', 'entrate', 'gcal', 'bancaImpronte', 'entrateExtra', 'daConfermare', 'scelte']; // 24c.20 (D-180): scelte proprie; 24c.12 (P1 di 03): impronte dei movimenti della banca; 24c.13 (D-074, D-165)
  const OGGETTI = ['impost', 'profilo', 'root', 'pensione'];
  // raccolte in cui chi legge salta già le voci "deleted": qui una voce tolta da "Sostituisci tutto" resta come cancellata
  // (domanda 1 di 03, consiglio). Pagamenti, entrate, mesi e file di Drive non hanno questo segno: lì la voce si toglie e basta.
  const CON_CANCELLATE = ['eventi', 'progetti', 'lavori', 'turni', 'buste', 'cedolini', 'fissi', 'spesePers', 'cu', 'fondi', 'risparmi', 'bancaImpronte', 'entrateExtra', 'daConfermare', 'scelte'];
  const TIPI = { 'application/pdf': [0x25, 0x50, 0x44, 0x46], 'image/jpeg': [0xff, 0xd8, 0xff], 'image/png': [0x89, 0x50, 0x4e, 0x47] };
  // testi di 02 (report tornata 14 e 22, mockup 02-mockup-v24c-riprendi-copia e 02-mockup-v24-d054)
  const MSG = {
    rovinato: 'Questo file non si può leggere: forse è rovinato o non è una copia di Soldirini.',
    nuova: 'Questa copia è stata fatta con una versione più nuova di Soldirini. Aggiorna l’app e riprova.',
    grande: 'Questo file è troppo grande per essere una copia di Soldirini.',
    password: 'Password sbagliata. Se l’hai dimenticata, questa copia non si può aprire: prova con un’altra copia.',
    diverse: 'Le due password non sono uguali.',
    facile: 'Questa password è troppo facile da indovinare. Evita lettere o numeri tutti uguali o in fila, come "aaaaaaaa" o "12345678".',
    corta: 'La password è troppo corta: servono almeno 8 caratteri.', // 02, tornata 29 §2
    salva: 'Non è stato possibile salvare la copia. Controlla che ci sia spazio sul telefono e riprova.',
    // 02, tornata 24 (V1-V4)
    driveNo: 'Soldirini non è riuscita a salvare su Google Drive i dati di adesso, quindi non ha sostituito niente. Controlla la connessione e riprova.',
    pausa: 'Drive in pausa: le modifiche restano su questo telefono finché non rispondi. Tocca «Drive in pausa» in alto quando vuoi.', // provvisorio (decisione 1 di 02)
    cifraNo: 'Questo navigatore non riesce a proteggere la copia con una password. Aggiorna il navigatore e riprova.',
    apriNo: 'Questo navigatore non riesce ad aprire le copie protette. Aggiorna il navigatore e riprova.',
    parte: 'Soldirini non è riuscita a mettere da parte i dati di adesso, quindi non ha cambiato niente.', // 02, tornata 29 §2
    driveCon: 'Per prendere i dati di Drive servono la connessione e l’accesso a Google. Controlla e riprova.', // 02, tornata 29 §2
    primaSost: 'Per sostituire i dati con questa copia, prima rispondi a questa domanda.', // 02, tornata 30 §4 (2.A di 03)
    primaRimetti: 'Per rimettere i dati messi da parte, prima rispondi a questa domanda.'
  };
  const cifraOk = () => !!(g.crypto && crypto.subtle && crypto.getRandomValues);
  const inAttesaDrive = ' su questo telefono. Google Drive verrà aggiornato appena c’è connessione.'; // V2 di 02
  class CopiaErr extends Error { constructor(t) { super(MSG[t] || t); this.tipo = t; } }
  const C = () => DB.meta.copia || (DB.meta.copia = {});
  const piano = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const parseSicuro = t => JSON.parse(t, (k, v) => VIETATI.has(k) ? undefined : v);
  const haChiave = (o, k) => piano(o) && Object.prototype.hasOwnProperty.call(o, k);
  const b64 = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const da64 = s => { if (typeof s !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return null; try { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; } catch (e) { return null; } };
  const dItc = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '';
  const vive = x => Object.values(x || {}).filter(v => piano(v) && !v.deleted);

  // ---------- conteggi (21b, 21c, 22): sempre ricalcolati dai dati, mai presi dal file ----------
  function conteggi(d) {
    const ev = vive(d.eventi), date = ev.map(e => e.data).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x || '')).sort();
    return { att: ev.length, dal: date[0] || '', al: date[date.length - 1] || '', prog: vive(d.progetti).length, lav: vive(d.lavori).length,
      buste: vive(d.buste).length, ced: vive(d.cedolini).length, fissi: vive(d.fissi).length, spese: vive(d.spesePers).length };
  }
  const nAtt = n => n === 1 ? '1 attività' : n + ' attività';

  // ---------- password (D-059, ritocco B di 03, V3) ----------
  function controllaPassword(p) {
    if ([...p].length < 8) return 'corta';
    const c = [...p.toLowerCase()];
    if (c.every(x => x === c[0])) return 'facile';
    const cod = c.map(x => x.codePointAt(0)), passo = cod[1] - cod[0];
    if ((passo === 1 || passo === -1) && (/^[0-9]+$/.test(p) || /^[a-z]+$/i.test(p)) && cod.every((x, i) => !i || x - cod[i - 1] === passo)) return 'facile';
    return '';
  }
  async function chiave(pw, sale, iter) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pw.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: sale, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  // ---------- creazione ----------
  async function fileInAttesa(d) {
    const chiavi = [];
    for (const [k, b] of Object.entries(d.buste || {})) if (piano(b) && !b.deleted && b.daCaricare) chiavi.push(k);
    for (const [m, c] of Object.entries(d.cedolini || {})) if (piano(c) && !c.deleted && c.daCaricare) chiavi.push('ced|' + m);
    for (const [id, l] of Object.entries(d.lavori || {})) if (piano(l) && !l.deleted && l.contrattoFile && l.contrattoFile.daCaricare) chiavi.push('contr|' + id);
    const out = [];
    for (const k of chiavi) {
      let f = null; try { f = await g.soldiriniFile.fget(k); } catch (e) { }
      if (!f || !f.blob || !TIPI[f.tipo]) continue;
      out.push({ chiave: k, nome: String(f.nome || ''), tipo: f.tipo, buf: new Uint8Array(await f.blob.arrayBuffer()) });
    }
    return out;
  }
  async function crea(pw) {
    const dati = D(), z = new JSZip();
    z.file('dati.json', JSON.stringify(dati));
    z.file('riepilogo.json', JSON.stringify(Object.assign({ data: today() }, conteggi(dati))));
    const F = await fileInAttesa(dati);
    F.forEach((f, i) => z.file(`file/${i}.bin`, f.buf));
    z.file('file/elenco.json', JSON.stringify(F.map((f, n) => ({ chiave: f.chiave, nome: f.nome, tipo: f.tipo, n }))));
    const interno = await z.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    let info, corpo;
    if (pw) {
      const sale = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
      info = { formato: FORMATO, app: 'soldirini', protetta: true, kdf: { nome: 'PBKDF2', hash: 'SHA-256', iterazioni: ITER, sale: b64(sale) }, cifra: { nome: 'AES-GCM', iv: b64(iv) } };
      const infoB = enc.encode(JSON.stringify(info));
      corpo = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: infoB }, await chiave(pw, sale, ITER), interno));
      info = infoB;
    } else { info = enc.encode(JSON.stringify({ formato: FORMATO, app: 'soldirini', protetta: false })); corpo = interno; }
    const fuori = new JSZip(); fuori.file('info.json', info); fuori.file('contenuto', corpo);
    return fuori.generateAsync({ type: 'uint8array', compression: 'STORE' });
  }

  // ---------- lettura: il file non è fidato ----------
  // V6: solo le parti conosciute, raccolte = oggetti di oggetti, niente id pericolosi, updatedAt mai nel futuro
  // 24c.1 (proposta 2 di 03, tornata 29): una copia è sempre fatta nel passato, quindi una data oltre adesso diventa adesso
  function pulisci(o) {
    if (!piano(o)) throw new CopiaErr('rovinato');
    const ora = Date.now(), lim = ora;
    const fix = v => { if (v.updatedAt != null && !(+v.updatedAt <= lim)) v.updatedAt = Number.isFinite(+v.updatedAt) ? ora : 0; return v; };
    const d = emptyData();
    for (const k of RACCOLTE) {
      if (o[k] == null) continue; if (!piano(o[k])) throw new CopiaErr('rovinato');
      const m = {};
      for (const [id, v] of Object.entries(o[k])) {
        if (VIETATI.has(id) || !piano(v)) continue;
        if (k === 'eventi' && !v.deleted && (typeof v.data !== 'string' || typeof v.pid !== 'string')) continue;
        // impronte: solo codici SHA-256 (64 caratteri 0-9a-f) con {updatedAt} ed eventualmente deleted, niente altro
        if (k === 'bancaImpronte') { if (!/^[0-9a-f]{64}$/.test(id)) continue; m[id] = fix({ updatedAt: Number.isFinite(+v.updatedAt) ? +v.updatedAt : 0, ...(v.deleted ? { deleted: true } : {}) }); continue; }
        m[id] = fix(v);
      }
      d[k] = m;
    }
    for (const k of OGGETTI) {
      if (o[k] === null && k === 'root') { d.root = null; continue; }
      if (o[k] == null) continue; if (!piano(o[k])) throw new CopiaErr('rovinato');
      d[k] = fix(o[k]);
    }
    if (d.impost.soglie != null && !Array.isArray(d.impost.soglie)) d.impost.soglie = null;
    if (Array.isArray(o.storico)) d.storico = o.storico.filter(x => piano(x) && typeof x.id === 'string' && Number.isFinite(+x.t)).slice(-400);
    return d;
  }
  // V8: solo i file di buste, cedolini e contratti presenti nei dati e ancora da caricare
  function fileAtteso(d, k) {
    let m;
    if ((m = /^ced\|(\d{4}-\d{2})$/.exec(k))) return haChiave(d.cedolini, m[1]) && !d.cedolini[m[1]].deleted && !!d.cedolini[m[1]].daCaricare;
    if ((m = /^contr\|(.+)$/.exec(k))) return haChiave(d.lavori, m[1]) && !d.lavori[m[1]].deleted && !!(d.lavori[m[1]].contrattoFile && d.lavori[m[1]].contrattoFile.daCaricare);
    if (/^[^|]+\|\d{4}-\d{2}$/.test(k)) return haChiave(d.buste, k) && !d.buste[k].deleted && !!d.buste[k].daCaricare;
    return false;
  }
  // { serve:'password' } oppure { dati, file, data, protetta, vecchia }
  async function apri(file, pw) {
    if (!file || !(file.size >= 0)) throw new CopiaErr('rovinato');
    if (file.size > MAX_FILE) throw new CopiaErr('grande');
    const u = new Uint8Array(await file.arrayBuffer());
    if (u[0] === 0x50 && u[1] === 0x4b) return apriNuova(u, pw);
    return apriVecchia(u);
  }
  // vecchi file (D-097 punto 3): "Scarica backup" (dati con v:1) e copia mensile di Drive {app:'soldirini', dati}
  function apriVecchia(u) {
    let o; try { o = parseSicuro(dec.decode(u)); } catch (e) { throw new CopiaErr('rovinato'); }
    if (piano(o) && o.app === 'soldirini' && piano(o.dati)) { const t = typeof o.data === 'string' ? o.data.slice(0, 10) : ''; return { dati: pulisci(o.dati), file: [], data: /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : '', vecchia: true }; }
    if (piano(o) && o.v === 1 && (piano(o.eventi) || piano(o.progetti) || piano(o.profilo))) return { dati: pulisci(o), file: [], data: '', vecchia: true };
    throw new CopiaErr('rovinato');
  }
  // 24c.1 (proposta 3 di 03, tornata 29): un pezzo dello zip si legge a blocchi e ci si ferma appena supera il limite,
  // così un file "gonfiato" (pochi KB che diventano GB) non riempie la memoria prima del controllo
  function leggiFino(f, max) {
    return new Promise((ok, ko) => {
      const parti = []; let n = 0, finito = false; const s = f.internalStream('uint8array');
      s.on('data', c => { if (finito) return; n += c.length; if (n > max) { finito = true; s.pause(); ko(new CopiaErr('grande')); return; } parti.push(c); })
        .on('error', () => { if (!finito) { finito = true; ko(new CopiaErr('rovinato')); } })
        .on('end', () => { if (finito) return; finito = true; const b = new Uint8Array(n); let o = 0; for (const c of parti) { b.set(c, o); o += c.length; } ok(b); })
        .resume();
    });
  }
  async function apriNuova(u, pw) {
    let z; try { z = await JSZip.loadAsync(u); } catch (e) { throw new CopiaErr('rovinato'); }
    const fi = z.file('info.json'), fc = z.file('contenuto'); if (!fi || !fc) throw new CopiaErr('rovinato');
    let infoB; try { infoB = await leggiFino(fi, 4000); } catch (e) { throw new CopiaErr('rovinato'); } // V1: questi byte, così come sono
    let info; try { info = JSON.parse(dec.decode(infoB)); } catch (e) { throw new CopiaErr('rovinato'); }
    if (!piano(info) || info.app !== 'soldirini' || typeof info.formato !== 'number') throw new CopiaErr('rovinato');
    if (info.formato > FORMATO) throw new CopiaErr('nuova');
    if (info.formato !== FORMATO || typeof info.protetta !== 'boolean') throw new CopiaErr('rovinato');
    let sale = null, iv = null;
    if (info.protetta) { // V2: parametri controllati prima di calcolare
      const k = info.kdf, c = info.cifra;
      if (!piano(k) || !piano(c) || k.nome !== 'PBKDF2' || k.hash !== 'SHA-256' || c.nome !== 'AES-GCM' || !Number.isInteger(k.iterazioni) || k.iterazioni < ITER || k.iterazioni > ITER_MAX) throw new CopiaErr('rovinato');
      sale = da64(k.sale); iv = da64(c.iv); if (!sale || sale.length !== 16 || !iv || iv.length !== 12) throw new CopiaErr('rovinato');
      if (!cifraOk()) throw new CopiaErr('apriNo');
      if (pw == null) return { serve: 'password' };
    }
    let corpo = await leggiFino(fc, MAX_ESTRATTO), tot = corpo.length;
    if (info.protetta) {
      try { corpo = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: infoB }, await chiave(pw, sale, info.kdf.iterazioni), corpo)); }
      catch (e) { throw new CopiaErr('password'); }
    }
    let zi; try { zi = await JSZip.loadAsync(corpo); } catch (e) { throw new CopiaErr('rovinato'); }
    // V5: si estraggono solo i pezzi attesi, uno alla volta, contando i byte
    const pezzo = async nome => { const f = zi.file(nome); if (!f) return null; const b = await leggiFino(f, MAX_ESTRATTO - tot); tot += b.length; return b; };
    const bd = await pezzo('dati.json'); if (!bd) throw new CopiaErr('rovinato');
    let o; try { o = parseSicuro(dec.decode(bd)); } catch (e) { throw new CopiaErr('rovinato'); }
    const dati = pulisci(o);
    let data = ''; try { const r = JSON.parse(dec.decode(await pezzo('riepilogo.json') || new Uint8Array())); if (piano(r) && /^\d{4}-\d{2}-\d{2}$/.test(r.data || '')) data = r.data; } catch (e) { }
    const file = [], be = await pezzo('file/elenco.json');
    let L = []; try { L = be ? JSON.parse(dec.decode(be)) : []; } catch (e) { L = []; }
    if (Array.isArray(L)) for (const x of L.slice(0, 2000)) {
      if (!piano(x) || typeof x.chiave !== 'string' || typeof x.nome !== 'string' || !TIPI[x.tipo] || !Number.isInteger(x.n) || x.n < 0) continue;
      if (!fileAtteso(dati, x.chiave) || file.some(f => f.chiave === x.chiave)) continue;
      const b = await pezzo(`file/${x.n}.bin`); if (!b || !TIPI[x.tipo].every((v, i) => b[i] === v)) continue;
      file.push({ chiave: x.chiave, nome: x.nome.slice(0, 200), tipo: x.tipo, buf: b });
    }
    return { dati, file, data, protetta: info.protetta, vecchia: false };
  }

  // ---------- unione e sostituzione ----------
  async function rimettiFile(file) {
    let n = 0;
    for (const f of file || []) {
      if (!fileAtteso(D(), f.chiave)) continue;
      try { if (await g.soldiriniFile.fget(f.chiave)) continue; await g.soldiriniFile.fset(f.chiave, { nome: f.nome, tipo: f.tipo, blob: new Blob([f.buf], { type: f.tipo }) }); n++; } catch (e) { }
    }
    return n;
  }
  function unisci(c) {
    const prima = D(), dopo = mergeData(prima, c.dati); let agg = 0, mod = 0;
    for (const k of RACCOLTE) {
      const a = prima[k] || {}, b = c.dati[k] || {}, o = dopo[k] || {};
      for (const id of Object.keys(b)) { if (o[id] !== b[id]) continue; if (!haChiave(a, id)) { if (!b[id].deleted) agg++; } else if (a[id] !== b[id]) mod++; }
    }
    DB.data = dopo; return { agg, mod };
  }
  // le voci che c'erano e che nei dati nuovi non ci sono restano come cancellate (domanda 1 di 03, consiglio: provvisorio)
  function conCancellate(nuovi, vecchi) {
    const ora = Date.now(), o = Object.assign({}, nuovi);
    for (const k of CON_CANCELLATE) {
      const v = (vecchi && vecchi[k]) || {}; let m = null;
      for (const [id, x] of Object.entries(v)) {
        if (VIETATI.has(id) || !piano(x) || x.deleted || haChiave(o[k], id)) continue;
        m = m || Object.assign({}, o[k] || {}); m[id] = Object.assign({}, x, { deleted: true, updatedAt: ora });
        delete m[id].deletedAt; // non finisce nel cestino: è una voce tolta dalla sostituzione
      }
      if (m) o[k] = m;
    }
    return o;
  }
  const conDrive = () => !!(DB.meta.account && DB.meta.dataId);
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  // V2 di 02: dopo la sostituzione si aspetta l'invio a Drive (al massimo 20 s) per dire all'utente se è arrivato
  async function invia() {
    const lim = Date.now() + 20000;
    clearTimeout(syncTimer); while (syncing && Date.now() < lim) await pausa(50);
    const s = sync(false).catch(() => {}).then(() => true);
    while (DB.meta.sostituzione && Date.now() < lim) if (await Promise.race([s, pausa(100).then(() => false)])) break;
    return !DB.meta.sostituzione;
  }
  // "Sostituisci tutto" (D-097 punto 1-2, V9, V10, V13) e "Rimetti questi dati" (stessa cosa con i dati messi da parte).
  // fase(testo) aggiorna il pulsante (V1 di 02). Restituisce { err } (niente è cambiato) oppure { inviata } (Drive aggiornato o no).
  async function sostituisci(dati, file, fase, rimetti) {
    // 24c.1 (V13): finché la sostituzione non è pronta non parte nessuna sincronizzazione (un'unione normale con Drive arriverebbe
    // dopo i dati nuovi); quella già in corso finisce prima della copia
    syncFermo = true;
    let S;
    try { S = await preparaSostituzione(dati, file, fase, rimetti); } finally { syncFermo = false; }
    if (S && S.err) return S;
    render();
    return { inviata: S ? await invia() : true };
  }
  async function preparaSostituzione(dati, file, fase, rimetti) {
    let S = null;
    if (conDrive()) {
      if (!navigator.onLine || !tokenOk()) return { err: MSG.driveNo };
      fase('Salvo i dati di adesso su Drive…');
      clearTimeout(syncTimer); while (syncing) await pausa(50); // niente sincronizzazione a metà della copia
      try { const m = await metaDati(DB.meta.dataId); await copiaDatiSuDrive(DB.meta.dataId, 'Soldirini copia prima della ripresa'); S = { copiata: true, rev: m.headRevisionId || '' }; }
      catch (e) { console.warn(e); return { err: MSG.driveNo }; } // V13 punto 1: senza la copia su Drive ci si ferma
    }
    fase(rimetti ? 'Rimetto i dati…' : 'Sostituisco i dati…');
    try { await Archivio.salvato(); } catch (e) { }
    if (!await Archivio.mettiDaParte({ il: today(), testo: JSON.stringify(D()) })) return { err: MSG.parte };
    Archivio.blocca(); DB.data = conCancellate(dati, D());
    // 24c.1: il segno della sostituzione va messo insieme ai dati nuovi. Prima veniva dopo rimettiFile e una
    // sincronizzazione partita in quell'attimo faceva un'unione normale con Drive (contro V13).
    DB.meta.seq++; if (S) DB.meta.sostituzione = S;
    await rimettiFile(file);
    if (Archivio.modo === 'idb') await Archivio.nuovaEpoca(); else persist();
    return S;
  }

  // ---------- finestra unica della copia ----------
  let passo = null, aperta = null, occupato = false, primaVolta = false, pwScelta = true;
  const M = () => $('cpModal');
  function mostra(tit, html, chiudibile) {
    $('cpTit').textContent = tit; $('cpBody').innerHTML = html; $('cpX').hidden = !chiudibile;
    const sh = M().querySelector('[role=dialog]'); if ($('cpMotivo')) sh.setAttribute('aria-describedby', 'cpMotivo'); else sh.removeAttribute('aria-describedby'); // 02, tornata 30 §4
    M().hidden = false; document.body.classList.add('noscroll');
    const f = $('cpBody').querySelector('input:not([type=file]):not([type=checkbox]),.foot .btn:last-child'); if (f) try { f.focus(); } catch (e) { }
  }
  function chiudi() { if (occupato) return; M().hidden = true; passo = null; aperta = null; primaVolta = false; $('cpBody').innerHTML = ''; if ([...document.querySelectorAll('.modal')].every(m => m.hidden)) document.body.classList.remove('noscroll'); }
  const errore = (t) => { const e = $('cpErr'); if (!e) return; e.textContent = t || ''; e.hidden = !t; };
  const attendi = (btn, testo) => { occupato = true; $('cpBody').querySelectorAll('input,button').forEach(x => x.disabled = true); btn.dataset.t = btn.textContent; btn.innerHTML = `<i class="spin" aria-hidden="true"></i>${esc(testo)}`; };
  const fine = (btn) => { occupato = false; if (!$('cpBody').contains(btn)) return; $('cpBody').querySelectorAll('input,button').forEach(x => x.disabled = false); btn.textContent = btn.dataset.t || btn.textContent; };

  // 12 · domanda alla prima copia
  function domanda() {
    passo = 'domanda'; primaVolta = true;
    mostra('Proteggere la copia con una password?', `<p style="margin-top:0">La copia contiene tutti i tuoi dati: stipendi, buste paga, dati per le ricevute. Con la password, chi trova il file non può aprirlo.</p>
      <div role="radiogroup" aria-label="Password della copia">
      <button type="button" class="cpopt on" role="radio" aria-checked="true" data-pw="1"><b>🔒 Sì, con password <span class="tag">Consigliato</span></b><span class="pro">Il file è protetto anche se finisce in mani sbagliate.</span><span class="con">Se dimentichi la password, la copia non si apre più. Nessuno può recuperarla, nemmeno l’autore dell’app.</span></button>
      <button type="button" class="cpopt" role="radio" aria-checked="false" data-pw="0"><b>🔓 No, senza password</b><span class="con">Chi apre il file vede tutti i tuoi dati.</span></button></div>
      <div class="foot"><button class="btn" data-cp="continua">Continua</button></div>
      <p class="muted sm">Con "Sì" la password ti viene chiesta ogni volta che salvi una copia: Soldirini non la conserva. Puoi cambiare la scelta in Impostazioni → Dati e copie di sicurezza → Copia di sicurezza.</p>`, true);
  }
  // 13 · password (prima volta) o "Password per questa copia"
  function chiediPassword() {
    passo = 'password'; const prima = !C().ultimaConPw;
    mostra(prima ? 'Scegli la password' : 'Password per questa copia', `${prima ? '' : '<p style="margin-top:0">Soldirini non conserva la password: scrivila per proteggere questa copia. Puoi usare la stessa dell’ultima volta o una nuova.</p>'}
      <label>Password<input type="password" id="cpP1" autocomplete="new-password" aria-describedby="cpP1n"></label>${prima ? '<p class="muted sm" id="cpP1n" style="margin:4px 0 0">Almeno 8 caratteri. Meglio una frase che ricordi bene.</p>' : ''}
      <label>Scrivila di nuovo<input type="password" id="cpP2" autocomplete="new-password"></label>
      <label class="check"><input type="checkbox" id="cpMostra"> Mostra la password</label>
      ${prima ? '<div class="cpwarn"><b>⚠ Non dimenticarla</b> Soldirini non la salva da nessuna parte e te la chiederà a ogni copia. Senza password la copia non si apre più. Scrivila in un posto sicuro.</div>' : '<p class="muted sm">Per riprendere questa copia servirà la password che scrivi adesso.</p>'}
      <p class="err" id="cpErr" role="alert" hidden></p>
      <div class="foot"><button class="btn ghost" data-cp="${primaVolta ? 'indietro' : 'annulla'}">${primaVolta ? 'Indietro' : 'Annulla'}</button><button class="btn" data-cp="salvapw">Salva la copia</button></div>`, true);
  }
  // 13 in basso · senza password
  function senzaPassword() {
    passo = 'senza';
    mostra('Il file non sarà protetto', `<p style="margin-top:0">Chi lo apre vede tutti i tuoi dati. Tienilo in un posto sicuro e non mandarlo in chat.</p>
      <p class="err" id="cpErr" role="alert" hidden></p>
      <div class="foot"><button class="btn ghost" data-cp="${primaVolta ? 'indietro' : 'annulla'}">${primaVolta ? 'Indietro' : 'Annulla'}</button><button class="btn" data-cp="salvano">Salva senza password</button></div>`, true);
  }
  function salvaUnaCopia() { if (C().password === undefined) domanda(); else if (C().password) chiediPassword(); else senzaPassword(); }
  async function scrivi(pw, btn) {
    if (pw && !cifraOk()) { errore(MSG.cifraNo); return; }
    attendi(btn, pw ? 'Proteggo la copia…' : 'Salvo la copia…');
    let bytes; const nome = `soldirini-copia-${today()}.soldirini`;
    try { bytes = await crea(pw); download(bytes, nome, 'application/octet-stream'); }
    catch (e) { console.warn(e); fine(btn); errore(MSG.salva); return; }
    finally { pw = null; }
    const c = C(); c.ultima = today(); c.protetta = btn.dataset.cp === 'salvapw'; if (c.protetta) c.ultimaConPw = true; c.piuTardi = 0;
    if (primaVolta) c.password = pwScelta; // la scelta della schermata 12 vale da quando la prima copia è salvata
    primaVolta = false; persist();
    occupato = false; chiudi(); render();
    toast(`✓ Copia salvata: ${nome}\nDi solito la trovi nella cartella Download.\nRicorda: il telefono può copiare la cartella Download nei suoi backup.`, '', 9000);
  }

  // 21a · scelta del file e password
  let scelto = null;
  function riprendi() {
    passo = 'file'; scelto = null; aperta = null;
    mostra('Riprendi da una copia', `<p style="margin-top:0">Scegli il file della copia: finisce con <b>.soldirini</b> e di solito è nella cartella Download.</p>
      <p class="muted sm">Vanno bene anche le copie fatte con le versioni di prima (file <b>.json</b>), comprese le copie mensili di Google Drive.</p>
      <button type="button" class="btn ghost cpfile" data-cp="file">📂 Scegli il file</button><input type="file" id="cpFile" hidden>
      <p class="muted sm" id="cpNome"></p>
      <div id="cpPw" hidden><p>Questa copia è protetta. Scrivi la sua password.</p><label>Password<input type="password" id="cpPwIn" autocomplete="current-password"></label></div>
      <p class="err" id="cpErr" role="alert" hidden></p>
      <div class="foot"><button class="btn ghost" data-cp="annulla">Annulla</button><button class="btn" data-cp="apri" disabled>Apri</button></div>`, true);
  }
  async function prova(pw) {
    const btn = $('cpBody').querySelector('[data-cp=apri]'); errore('');
    attendi(btn, 'Apro la copia…');
    try {
      const r = await apri(scelto, pw);
      fine(btn);
      if (r.serve) { $('cpPw').hidden = false; btn.disabled = false; $('cpPwIn').focus(); return; }
      aperta = r; scelta();
    } catch (e) { fine(btn); if (!(e instanceof CopiaErr)) console.warn(e); errore(e instanceof CopiaErr ? e.message : MSG.rovinato); if (e.tipo === 'password') { const i = $('cpPwIn'); if (i) { i.classList.add('manca'); i.focus(); } } }
  }
  // 21b · riepilogo e scelta
  function scelta() {
    passo = 'scelta'; const n = conteggi(aperta.dati);
    const kv = (a, b) => `<div class="kv"><span>${a}</span><b>${b}</b></div>`;
    mostra('Riprendi da una copia', `<div class="card cpsum"><b>${aperta.data ? 'Copia del ' + dItc(aperta.data) : 'Copia di una versione precedente'}</b>
      ${kv('Attività', n.att + (n.dal ? ` · dal ${dItc(n.dal)} al ${dItc(n.al)}` : ''))}${kv('Progetti', n.prog)}${kv('Lavori e buste paga', `${n.lav} · ${n.buste === 1 ? '1 busta' : n.buste + ' buste'}`)}
      ${n.ced ? kv('Pensione', n.ced === 1 ? '1 cedolino' : n.ced + ' cedolini') : ''}${kv('Uscite fisse', n.fissi)}${kv('Spese giornaliere', n.spese)}</div>
      <p style="font-weight:700;margin:12px 0 0">Come vuoi riprenderla?</p>
      <div role="radiogroup" aria-label="Come riprendere la copia">
      <button type="button" class="cpopt on" role="radio" aria-checked="true" data-modo="unisci"><b>➕ Unisci <span class="tag">Consigliato</span></b><span class="pro">Aggiunge quello che manca e, per ogni voce presente in tutti e due, tiene la versione più recente.</span><span class="pro">Non perdi niente di quello che c’è già su questo telefono.</span></button>
      <button type="button" class="cpopt" role="radio" aria-checked="false" data-modo="sostituisci"><b>♻️ Sostituisci tutto</b><span class="con">Toglie i dati di questo telefono e mette solo quelli della copia.</span><span>Prima Soldirini mette da parte i dati di adesso: puoi rimetterli da Impostazioni.</span>${conDrive() ? '<span>Con Google Drive: la sostituzione vale anche per Drive e per gli altri dispositivi collegati.</span>' : ''}</button></div>
      <div class="foot"><button class="btn ghost" data-cp="annulla">Annulla</button><button class="btn" data-cp="usa">Riprendi</button></div>`, true);
  }
  // V5 di 02, testo della tornata 31 §2 (con le voci cancellate, D-105; anche i documenti dei progetti)
  const avvisoAltri = '<div class="cpwarn"><b>Usi Soldirini anche su un altro telefono o tablet?</b><br>Prima aggiornalo: in fondo a Impostazioni deve dire «versione 24c» o più nuova. Una versione più vecchia prende i dati della copia senza chiederlo e senza mettere da parte i suoi. Poi può rimettere i pagamenti, le entrate e i documenti dei progetti segnati come fatti o inviati che la copia non ha, e le modifiche fatte lì più di recente.</div>';
  // 21c · conferma di "Sostituisci tutto"
  // 24c.1 (2.A di 03, tornata 29): con "Drive in pausa" si risponde prima alla domanda 23, poi si può sostituire
  // la riga va in cima alla finestra 23 (02, tornata 30 §4); dopo la risposta l'azione non riparte da sola
  function primaLaPausa(motivo) { if (!DB.meta.drivePausa) return false; domandaPausa(true, motivo); return true; }
  function confermaSostituisci() {
    if (primaLaPausa(MSG.primaSost)) return;
    passo = 'conferma'; const a = conteggi(D()), b = conteggi(aperta.dati);
    mostra('Sostituire tutti i dati di questo telefono?', `<p style="margin-top:0">Ora ci sono <b>${nAtt(a.att)}</b>${a.dal ? ` (dal ${dItc(a.dal)} al ${dItc(a.al)})` : ''}. Dopo ci saranno solo quelle della copia: <b>${nAtt(b.att)}</b>${b.al ? ` (fino al ${dItc(b.al)})` : ''}.</p>
      <p>I dati di adesso restano da parte e puoi rimetterli da Impostazioni → Dati e copie di sicurezza → Copia di sicurezza.</p>
      ${conDrive() ? '<p><b>Con Google Drive:</b> anche i dati su Drive vengono sostituiti. Prima Soldirini salva i dati di adesso nella cartella "Copie di sicurezza" di Drive.</p>' + avvisoAltri : ''}
      <p class="err" id="cpErr" role="alert" hidden></p>
      <div class="foot"><button class="btn ghost" data-cp="annulla">Annulla</button><button class="btn danger" data-cp="sostituisci">Sostituisci tutto</button></div>`, false);
  }
  // 22 · conferma di "Rimetti questi dati" (scambio: i dati di adesso vanno da parte al loro posto)
  let parteAperta = null;
  async function confermaRimetti() {
    const p = await Archivio.parte(); if (!p) { render(); return; }
    if (conDrive() && primaLaPausa(MSG.primaRimetti)) return;
    let dati; try { dati = pulisci(parseSicuro(p.testo)); } catch (e) { toast(MSG.rovinato, 'err'); return; }
    parteAperta = { dati, il: p.il }; passo = 'rimetti'; const a = conteggi(D()), b = conteggi(dati);
    mostra('Rimettere i dati messi da parte?', `<p style="margin-top:0">Ora ci sono <b>${nAtt(a.att)}</b>${a.al ? ` (fino al ${dItc(a.al)})` : ''}. Dopo tornano i dati messi da parte il ${dItc(p.il)}: <b>${nAtt(b.att)}</b>${b.al ? ` (fino al ${dItc(b.al)})` : ''}.</p>
      <p>I dati di adesso restano da parte al loro posto, così puoi tornare indietro di nuovo.</p>
      ${conDrive() ? '<p><b>Con Google Drive:</b> anche i dati su Drive vengono sostituiti, come prima.</p>' + avvisoAltri : ''}
      <p class="err" id="cpErr" role="alert" hidden></p>
      <div class="foot"><button class="btn ghost" data-cp="annulla">Annulla</button><button class="btn danger" data-cp="rimettisi">Rimetti questi dati</button></div>`, false);
  }
  // 23 · domanda sugli altri dispositivi (Drive in pausa finché non si risponde: decisione 1 di 02, consiglio)
  let chiestoPausa = false;
  function domandaPausa(forza, motivo) {
    const P = DB.meta.drivePausa; if (!P || (!forza && chiestoPausa) || occupato) return; chiestoPausa = true; passo = 'pausa';
    mostra('I dati sono stati sostituiti su un altro dispositivo', `${motivo ? `<p class="cpinvio cima" id="cpMotivo">${esc(motivo)}</p>` : ''}<p style="margin-top:0">${P.il ? `Il ${dItc(P.il)}, su` : 'Su'} un altro telefono o tablet, i dati di Soldirini sono stati sostituiti con una copia di sicurezza.</p>
      <p>Per avere gli stessi dati anche qui, Soldirini prende quelli di Google Drive. I dati di questo telefono restano da parte: puoi rimetterli da Impostazioni → Dati e copie di sicurezza → Copia di sicurezza.</p>
      <p class="err" id="cpErr" role="alert" hidden></p>
      <div class="foot"><button class="btn ghost" data-cp="annulla">Non ora</button><button class="btn" data-cp="prendi">Prendi i dati di Drive</button></div>
      <p class="muted sm">Con "Non ora" questo telefono non si sincronizza con Drive: la domanda torna toccando "Drive in pausa" o al prossimo avvio.</p>`, false);
  }
  async function prendiDrive(btn) {
    if (!navigator.onLine || !tokenOk()) { errore(MSG.driveCon); return; }
    attendi(btn, 'Prendo i dati di Drive…');
    try {
      const id = DB.meta.dataId, m = await metaDati(id);
      const remote = leggiDati(await gfetch('GET', `${DRIVE}/files/${id}?alt=media`, { raw: true }).then(r => r.text()));
      try { await Archivio.salvato(); } catch (e) { }
      if (!await Archivio.mettiDaParte({ il: today(), testo: JSON.stringify(D()) })) throw new Error(MSG.parte);
      // 2.A di 03: una sostituzione fatta qui e non ancora inviata non vale più (i dati sono quelli di Drive)
      Archivio.blocca(); DB.data = remote; DB.meta.gen = genDi(m); DB.meta.drivePausa = null; DB.meta.sostituzione = null; DB.meta.synced = DB.meta.seq;
      if (Archivio.modo === 'idb') await Archivio.nuovaEpoca(); else persist();
    } catch (e) { fine(btn); errore(errMsg(e)); return; }
    occupato = false; chiudi(); render(); scheduleSync(0);
    toast('✓ Dati presi da Google Drive. Quelli di prima sono in Impostazioni → Dati e copie di sicurezza → Copia di sicurezza.', '', 6000);
  }

  async function azione(b) {
    const a = b.dataset.cp;
    if (a === 'annulla') { const p = passo; chiudi(); if (p === 'pausa') toast(MSG.pausa, '', 8000); return; }
    if (a === 'indietro') { domanda(); return; }
    if (a === 'salva') { salvaUnaCopia(); return; }
    if (a === 'riprendi') { riprendi(); return; }
    if (a === 'file') { $('cpFile').click(); return; }
    if (a === 'rimetti') { confermaRimetti(); return; }
    if (a === 'continua') { pwScelta = $('cpBody').querySelector('.cpopt.on').dataset.pw === '1'; if (pwScelta) chiediPassword(); else senzaPassword(); return; }
    if (a === 'salvano') { scrivi(null, b); return; }
    if (a === 'salvapw') {
      const p1 = $('cpP1').value, p2 = $('cpP2').value; const k = controllaPassword(p1.normalize('NFC'));
      if (k) { errore(MSG[k]); $('cpP1').focus(); return; }
      if (p1.normalize('NFC') !== p2.normalize('NFC')) { errore(MSG.diverse); $('cpP2').focus(); return; }
      scrivi(p1, b); return;
    }
    if (a === 'apri') { prova($('cpPwIn') && !$('cpPw').hidden ? $('cpPwIn').value : null); return; }
    if (a === 'usa') {
      const modo = $('cpBody').querySelector('.cpopt.on').dataset.modo;
      if (modo === 'sostituisci') { confermaSostituisci(); return; }
      const r = unisci(aperta), k = await rimettiFile(aperta.file); changed(); occupato = false; chiudi(); render();
      // V4 di 02: con Drive, quante buste o cedolini della copia verranno caricati
      const fileDrive = k && DB.meta.account ? (k === 1 ? '\n1 busta paga o cedolino verrà caricato su Google Drive.' : `\n${k} buste paga o cedolini verranno caricati su Google Drive.`) : '';
      toast((r.agg || r.mod ? `✓ Copia ripresa: ${r.agg === 1 ? '1 voce aggiunta' : r.agg + ' voci aggiunte'}, ${r.mod === 1 ? '1 aggiornata' : r.mod + ' aggiornate'}.` : '✓ Copia ripresa: su questo telefono c’era già tutto.') + fileDrive, '', 6000);
      return;
    }
    if (a === 'sostituisci' || a === 'rimettisi') {
      const rim = a === 'rimettisi', P = rim ? parteAperta : aperta; errore('');
      attendi(b, conDrive() ? 'Salvo i dati di adesso su Drive…' : rim ? 'Rimetto i dati…' : 'Sostituisco i dati…');
      const fase = t => { if ($('cpBody').contains(b)) b.innerHTML = `<i class="spin" aria-hidden="true"></i>${esc(t)}`; };
      const r = await sostituisci(P.dati, rim ? [] : P.file, fase, rim);
      if (r.err) { fine(b); errore(r.err); return; } // V1 di 02: la finestra resta aperta, niente è cambiato
      occupato = false; chiudi();
      const testo = rim ? `✓ Rimessi i dati messi da parte il ${dItc(P.il)}` : `✓ Dati sostituiti con la copia ${P.data ? 'del ' + dItc(P.data) : 'scelta'}`;
      // 02, tornata 29 §2 testo 6: senza Drive o con Drive già aggiornato, "Rimetti" dice dove sono finiti i dati di prima
      toast(testo + (r.inviata ? (rim ? '. Quelli che c’erano prima ora sono messi da parte.' : '.') : inAttesaDrive), '', r.inviata ? 6000 : 9000); return;
    }
    if (a === 'prendi') { prendiDrive(b); return; }
  }

  // ---------- Impostazioni → Dati e copie di sicurezza → Copia di sicurezza (schermata 14; 24c.20, D-182) ----------
  async function renderBox() {
    const box = $('cpBox'); if (!box) return; const c = C(), pw = c.password !== false;
    box.innerHTML = `<p class="muted sm" style="margin-top:0">${c.ultima ? `Ultima copia: ${dItc(c.ultima)} · ${c.protetta ? 'con password' : 'senza password'}` : 'Nessuna copia salvata finora.'}</p>
      <div class="cprow"><span id="cpPwL">Proteggi le copie con una password</span><div class="seg" role="group" aria-labelledby="cpPwL"><button type="button" data-cpw="1" class="${pw ? 'on' : ''}" aria-pressed="${pw}">Sì</button><button type="button" data-cpw="0" class="${pw ? '' : 'on'}" aria-pressed="${!pw}">No</button></div></div>
      <p class="muted sm">Vale per le prossime copie. Le copie già salvate restano come sono. La password te la chiediamo a ogni copia: Soldirini non la conserva.</p>
      ${DB.meta.account ? '<p class="muted sm">Con Google Drive: c’è anche una copia automatica ogni mese. Le copie automatiche su Drive sono protette dal tuo account Google, non dalla password.</p>' : ''}
      <div class="acts"><button class="btn sm" data-cp="salva">Salva una copia</button><button class="btn ghost sm" data-cp="riprendi">Riprendi da una copia</button></div>
      ${DB.meta.sostituzione ? '<div class="cpinvio" role="status"><b>⏳ Sostituzione non ancora su Google Drive</b><p class="muted sm" style="margin:2px 0 0">Verrà inviata appena c’è connessione. Fino ad allora non usare Soldirini su altri telefoni o tablet: le modifiche fatte lì andrebbero perse.</p></div>' : ''}
      <div id="cpParte"></div>`;
    const p = await Archivio.parte(); const dove = $('cpParte'); if (!dove || !p) return;
    let n = null; try { n = conteggi(parseSicuro(p.testo)); } catch (e) { }
    if (!n) return;
    dove.innerHTML = `<div class="cpparte"><b>Dati messi da parte il ${dItc(p.il)}</b><p class="muted sm" style="margin:2px 0 0">Sono i dati che c’erano prima dell’ultima sostituzione: ${nAtt(n.att)}${n.al ? ', fino al ' + dItc(n.al) : ''}.</p>
      <div class="acts"><button class="btn ghost sm" data-cp="rimetti">Rimetti questi dati</button></div><p class="muted sm">Restano qui fino alla prossima sostituzione. «Esci» li cancella.</p></div>`;
  }

  // ---------- Riepilogo: promemoria dei 30 giorni (schermata 24; D-058, D-097 punto 4) ----------
  // solo per chi non usa Drive e ha già qualcosa da salvare (scelta di 01: a un telefono vuoto non serve)
  function promemoria() {
    const vecchio = $('cpRem'); const c = C();
    const giorni = c.ultima ? (Date.parse(today()) - Date.parse(c.ultima)) / GG : Infinity;
    const vedi = tab === 'rie' && !DB.meta.account && datiPieni(D()) && giorni > 30 && !(c.piuTardi && Date.now() - c.piuTardi < 7 * GG);
    if (!vedi) { if (vecchio) vecchio.remove(); return; }
    const html = `<div class="rem" id="cpRem" role="status"><span class="i" aria-hidden="true">🛟</span><div class="tx"><b>${c.ultima ? 'Ultima copia di sicurezza: ' + dItc(c.ultima) : 'Non hai ancora una copia di sicurezza'}</b><small>I dati sono solo su questo telefono. Una copia ti salva se il telefono si rompe o si perde.</small>
      <div class="b"><button type="button" class="btn ghost sm" data-cprem="tardi">Più tardi</button><button type="button" class="btn sm" data-cp="salva">Salva una copia</button></div></div></div>`;
    if (vecchio) vecchio.outerHTML = html; else $('rieTot').insertAdjacentHTML('afterend', html);
  }

  // ---------- collegamenti ----------
  const _renderProgCp = renderProgetti;
  renderProgetti = function () { _renderProgCp(); renderBox(); };
  const _renderRieCp = renderRiepilogo;
  renderRiepilogo = function () { _renderRieCp(); promemoria(); };
  document.addEventListener('click', e => {
    const w = e.target.closest('[data-cpw]'); if (w) { C().password = w.dataset.cpw === '1'; persist(); renderBox(); return; }
    const r = e.target.closest('[data-cprem]'); if (r) { C().piuTardi = Date.now(); persist(); promemoria(); toast('Il promemoria torna tra 7 giorni.'); return; }
    const o = e.target.closest('#cpBody .cpopt'); if (o) { o.parentElement.querySelectorAll('.cpopt').forEach(x => { x.classList.toggle('on', x === o); x.setAttribute('aria-checked', x === o); }); return; }
    const b = e.target.closest('[data-cp]'); if (b && !b.disabled && (b.closest('#cpModal') || b.closest('#cpBox') || b.closest('#cpRem'))) azione(b);
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'cpMostra') { for (const id of ['cpP1', 'cpP2']) $(id).type = e.target.checked ? 'text' : 'password'; return; }
    if (e.target.id === 'cpFile') {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      scelto = f; $('cpNome').textContent = f.name; $('cpPw').hidden = true; const i = $('cpPwIn'); if (i) i.value = '';
      $('cpBody').querySelector('[data-cp=apri]').disabled = false; prova(null);
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'cpPwIn') { e.preventDefault(); const b = $('cpBody').querySelector('[data-cp=apri]'); if (b && !b.disabled) prova(e.target.value); } });
  $('cpX').addEventListener('click', chiudi);

  // la domanda 23 torna a ogni avvio finché Drive è in pausa (decisione 1 di 02)
  if (DB.meta.drivePausa) setTimeout(() => domandaPausa(false), 300);

  g.Copia = { crea, apri, pulisci, conCancellate, controllaPassword, domandaPausa, salvaUnaCopia, riprendi, conteggi, MSG };
})(window);
