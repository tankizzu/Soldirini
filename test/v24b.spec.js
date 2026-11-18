// v24b (D-054, D-064, D-087): dati in IndexedDB. Prove T-S1…T-S11 di 03 (report 03-sicurezza-requisiti-v24b) e del piano di 01.
// Dati inventati. Orologio fisso al 18/11/2026.
const { test, expect } = require('./helpers/prova');
const { BASE, DriveFinto, nuovoDispositivo, conArchivio, accedi, aspettaSync, sincronizza } = require('./helpers/app');
const { collega } = require('./helpers/google-finto');
const { sitoDaCommit } = require('./helpers/versione');
const fs = require('fs');
const path = require('path');
const VECCHI = require('./dati/vecchie-versioni');

const OGGI = '2026-11-18T10:00:00+01:00';
const PUBBLICATA = '2928e50'; // 24.0.2, l'ultima versione pubblicata prima della v24b

// telefono con preparazione prima dell'avvio (prima: funzione eseguita nella pagina prima di ogni file dell'app)
async function telefono(browser, { drive = new DriveFinto(), prima, arg, ora = OGGI, sito } = {}) {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', serviceWorkers: 'block', locale: 'it-IT', timezoneId: 'Europe/Rome', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await collega(ctx, { drive, sito });
  if (ora) await ctx.clock.setFixedTime(new Date(ora));
  if (prima) await ctx.addInitScript(prima, arg);
  const page = conArchivio(await ctx.newPage()); const errori = [];
  page.on('pageerror', e => errori.push(e.message));
  await page.goto(BASE);
  return { ctx, page, errori, drive };
}
// la vecchia voce scritta una sola volta (come la lascerebbe la v24 sul telefono)
const vecchiaVoce = ([testo]) => { if (!sessionStorage.getItem('__v')) { localStorage.setItem('soldirini-v1', testo); sessionStorage.setItem('__v', '1'); } };
const rec = page => page.evaluate(() => new Promise((ok, ko) => { const r = indexedDB.open('soldirini', 1); r.onupgradeneeded = () => r.result.createObjectStore('dati');
  r.onsuccess = () => { const d = r.result, g = d.transaction('dati').objectStore('dati').get('dati'); g.onsuccess = () => { d.close(); ok(g.result || null); }; g.onerror = () => { d.close(); ko(g.error); }; }; r.onerror = () => ko(r.error); }));
const recDati = async page => { const r = await rec(page); return r ? JSON.parse(r.testo) : null; };
const ls = (page, k) => page.evaluate(k => localStorage.getItem(k), k);
const ev = (id, data) => ({ id, pid: 'p1', data, tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '50', rimborso: false, spese: [], created: 1, updatedAt: Date.parse(data + 'T12:00:00Z') });
const STATO = () => ({ data: { v: 1, progetti: { p1: { id: 'p1', nome: 'Squadra', colore: '#4a5f8a', ore: { attivo: true }, rimborso: { attivo: false }, updatedAt: 1 } },
  eventi: { e1: ev('e1', '2026-10-05'), e2: ev('e2', '2026-11-02') }, spesePers: { s1: { id: 's1', data: '2026-11-01', cat: 'bar', importo: '4', nota: '', created: 1, updatedAt: Date.parse('2026-11-03T09:00:00Z') } },
  pagamenti: {}, mesi: {}, files: {}, entrate: { 'v24|risposta': { risposta: 'no', updatedAt: 1 } } }, meta: { seq: 7, synced: 0, queue: {}, lastSync: 0 } });
// accesso a Google quando sul telefono ci sono già dati (la schermata di benvenuto non c'è)
// aspetta la libreria di Google (finta), che arriva per conto suo: senza, login() risponde "Google non è ancora pronto"
const entra = async (page, nuovo = true) => { await page.waitForFunction(() => !!(window.google && google.accounts && google.accounts.oauth2)); await page.evaluate(() => { login(); }); if (nuovo) { await page.waitForSelector('#setup:not([hidden])'); await page.click('#setupMy'); } await aspettaSync(page); };
const nuovoEv = (page, id, data) => page.evaluate(([id, data]) => { D().eventi[id] = { id, pid: Object.keys(D().progetti)[0] || 'p1', data, tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '50', rimborso: false, spese: [], created: 1, updatedAt: Date.now() }; changed(); }, [id, data]);

test.describe('v24b · spostamento in IndexedDB (R1)', () => {
  for (const [nome, dati] of Object.entries(VECCHI)) {
    test(`T-S1 ${nome}: dati identici in IndexedDB (prima scrittura), vecchia voce intatta`, async ({ browser }) => {
      const stato = { data: JSON.parse(JSON.stringify(dati)), meta: { seq: 3, synced: 3, queue: {} } }, testo = JSON.stringify(stato);
      // registro la prima scrittura in IndexedDB (lo spostamento), prima di ogni altra modifica dell'app
      const { page, errori } = await telefono(browser, { prima: ([t]) => { if (!sessionStorage.getItem('__v')) { localStorage.setItem('soldirini-v1', t); sessionStorage.setItem('__v', '1'); }
        const put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (v, k) { if (k === 'dati' && !window.__prima) window.__prima = v.testo; return put.apply(this, arguments); }; }, arg: [testo] });
      expect(await page.evaluate(() => [Archivio.modo, Archivio.da])).toEqual(['idb', 'localStorage']);
      const prima = JSON.parse(await page.evaluate(() => window.__prima)); expect(prima.meta.archivio).toMatchObject({ da: 'localStorage', versione: '24b' }); delete prima.meta.archivio;
      expect(JSON.stringify(prima)).toBe(testo);
      expect(await ls(page, 'soldirini-v1')).toBe(testo); // la vecchia voce resta come era
      expect(await ls(page, 'soldirini-spostato')).toBeTruthy();
      expect(await page.evaluate(() => [Object.keys(D().progetti).length, Object.keys(D().eventi).length])).toEqual([Object.keys(dati.progetti).length, Object.keys(dati.eventi).length]);
      // al riavvio i dati vengono da IndexedDB e localStorage non si legge più (R1.5)
      await page.evaluate(() => localStorage.setItem('soldirini-v1', '{"data":{},"meta":{"seq":0}}'));
      await page.reload();
      expect(await page.evaluate(() => [Archivio.da, Object.keys(D().eventi).length])).toEqual(['idb', Object.keys(dati.eventi).length]);
      expect(errori).toEqual([]);
    });
  }

  test('T-S2 vecchia voce rovinata: nessuno spostamento, nessuna cancellazione (copia a parte), app su localStorage, nessun errore', async ({ browser }) => {
    const { page, errori } = await telefono(browser, { prima: vecchiaVoce, arg: ['{"data":{"eventi":'] });
    expect(await page.evaluate(() => [Archivio.modo, Archivio.motivo])).toEqual(['localStorage', 'vecchia voce non leggibile']);
    expect(await rec(page)).toBeNull();
    expect(await ls(page, 'soldirini-v1-illeggibile')).toBe('{"data":{"eventi":');
    await nuovoEv(page, 'n1', '2026-11-10'); // l'app funziona come la v24
    expect(JSON.parse(await ls(page, 'soldirini-v1')).data.eventi).toHaveProperty('n1');
    expect(await ls(page, 'soldirini-v1-illeggibile')).toBe('{"data":{"eventi":'); // il testo rovinato non si perde
    expect(errori).toEqual([]);
  });

  test('T-S3 scrittura che fallisce durante lo spostamento: si resta su localStorage; al riavvio si riprova e riesce', async ({ browser }) => {
    const testo = JSON.stringify(STATO());
    const { page, errori } = await telefono(browser, { prima: ([t]) => { if (!sessionStorage.getItem('__v')) { localStorage.setItem('soldirini-v1', t); sessionStorage.setItem('__v', '1');
      const put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function () { IDBObjectStore.prototype.put = put; throw new DOMException('finto', 'QuotaExceededError'); }; } }, arg: [testo] });
    expect(await page.evaluate(() => [Archivio.modo, Archivio.motivo])).toEqual(['localStorage', 'spostamento non riuscito (QuotaExceededError)']);
    expect(await rec(page)).toBeNull();
    expect(await ls(page, 'soldirini-spostato')).toBeNull();
    expect(await page.evaluate(() => Object.keys(D().eventi).sort())).toEqual(['e1', 'e2']);
    await page.reload();
    expect(await page.evaluate(() => [Archivio.modo, Archivio.da, Object.keys(D().eventi).sort().join()])).toEqual(['idb', 'localStorage', 'e1,e2']);
    expect(errori).toEqual([]);
  });

  test('T-S4 IndexedDB assente o che non risponde entro 3 s: l\'app funziona come la v24 (localStorage)', async ({ browser }) => {
    for (const [prima, motivo] of [[() => { Object.defineProperty(window, 'indexedDB', { value: undefined }); }, 'IndexedDB non disponibile'],
      [() => { const o = IDBFactory.prototype.open; IDBFactory.prototype.open = function (n) { return n === 'soldirini' ? {} : o.apply(this, arguments); }; }, 'IndexedDB non risponde']]) {
      const { page, errori } = await telefono(browser, { prima, ora: null });
      expect(await page.evaluate(() => [Archivio.modo, Archivio.motivo])).toEqual(['localStorage', motivo]);
      await nuovoEv(page, 'n1', '2026-11-10');
      await page.reload();
      expect(await page.evaluate(() => Object.keys(D().eventi))).toEqual(['n1']);
      // 24b.1 (02, tornata 22 A5): riga "Salvataggio sul telefono · Ridotto" in Impostazioni → Account e riga in "Copia i dettagli"
      await page.evaluate(() => { tab = 'pro'; render(); const d = $('accBox').closest('details'); if (d) d.open = true; });
      await expect(page.locator('#ridBox .kv')).toHaveText('Salvataggio sul telefonoRidotto');
      await expect(page.locator('#ridBox p')).toHaveText('Il navigatore non lascia usare a Soldirini il suo archivio dei dati (succede per esempio nelle finestre private). I dati sono in uno spazio più piccolo: foto e documenti grandi potrebbero non essere salvati.');
      expect(await page.evaluate(() => cspTesto().split('\n').filter(r => r.startsWith('Archivio')))).toEqual([`Archivio: ridotto (${motivo})`]);
      expect(errori).toEqual([]);
    }
  });
  test('T-S4b IndexedDB che non risponde dopo lo spostamento: si vede la copia del giorno dello spostamento, ma non si riscrive e le modifiche non contano come salvate', async ({ browser }) => {
    const { ctx, page, errori } = await telefono(browser, { prima: vecchiaVoce, arg: [JSON.stringify(STATO())], ora: null });
    expect(await page.evaluate(() => Archivio.modo)).toBe('idb');
    await nuovoEv(page, 'n1', '2026-11-10');
    const vecchia = await ls(page, 'soldirini-v1');
    // dal prossimo avvio IndexedDB non risponde più
    await ctx.addInitScript(() => { const o = IDBFactory.prototype.open; IDBFactory.prototype.open = function (n) { return n === 'soldirini' ? {} : o.apply(this, arguments); }; });
    await page.reload();
    expect(await page.evaluate(() => [Archivio.modo, Archivio.dopoSpostamento, Object.keys(D().eventi).sort()])).toEqual(['localStorage', true, ['e1', 'e2']]);
    // 24b.1 (02, tornata 22 A4): fascia fissa sotto la barra, con la data dello spostamento; senza account niente frase su Drive
    const fascia = page.locator('#lsFascia');
    await expect(fascia).toBeVisible();
    const il = await page.evaluate(() => gma(new Date(localStorage.getItem('soldirini-spostato'))));
    await expect(fascia.locator('b')).toHaveText('⚠ Dati del telefono non raggiungibili');
    await expect(fascia.locator('span')).toHaveText([`Soldirini mostra una copia del ${il} e le modifiche che fai ora non restano su questo telefono. Chiudi del tutto Soldirini (anche dalle app recenti) e riaprila.`]);
    await page.evaluate(() => { D().profilo = D().profilo || emptyData().profilo; tab = 'cal'; render(); }); await expect(fascia).toBeVisible(); // su tutte le schede
    await page.evaluate(() => { tab = 'pro'; render(); }); await expect(fascia).toBeVisible();
    await expect(page.locator('#ridBox')).toHaveCount(0); // la riga "Ridotto" non si aggiunge alla fascia
    await nuovoEv(page, 'n2', '2026-11-11');
    expect(await ls(page, 'soldirini-v1')).toBe(vecchia); // la vecchia copia resta il punto di ritorno
    expect(await page.evaluate(() => salvataggioInErrore())).toBe(true); // synced non avanza
    expect(errori).toEqual([]);
  });
});

test.describe('v24b · salvataggio (R2)', () => {
  test('T-S5 modifica e chiusura immediata della pagina: riaprendo la modifica c\'è', async ({ browser }) => {
    const { ctx, page } = await telefono(browser, { prima: vecchiaVoce, arg: [JSON.stringify(STATO())] });
    await page.evaluate(() => { D().eventi.z1 = { id: 'z1', pid: 'p1', data: '2026-11-17', tipo: 'altro', titolo: 'ultima', ore: true, fasce: [], fisso: '1', rimborso: false, spese: [], created: 1, updatedAt: Date.now() }; changed(); });
    await page.close(); // senza aspettare la scrittura
    const p2 = conArchivio(await ctx.newPage()); await p2.goto(BASE);
    expect(await p2.evaluate(() => D().eventi.z1?.titolo)).toBe('ultima');
  });

  test('T-S5b chiusura con la scrittura in IndexedDB annullata: la copia sincrona fatta alla chiusura riporta la modifica, poi si cancella', async ({ browser }) => {
    const { ctx, page, errori } = await telefono(browser, { prima: vecchiaVoce, arg: [JSON.stringify(STATO())] });
    // le scritture in IndexedDB di questa pagina non arrivano più (come quando il telefono chiude la pagina a metà scrittura)
    await page.evaluate(() => { IDBObjectStore.prototype.put = function () { throw new DOMException('pagina chiusa', 'AbortError'); };
      D().eventi.z2 = { id: 'z2', pid: 'p1', data: '2026-11-17', tipo: 'altro', titolo: 'salvata alla chiusura', ore: true, fasce: [], fisso: '1', rimborso: false, spese: [], created: 1, updatedAt: Date.now() }; changed(); });
    await page.close();
    const p2 = conArchivio(await ctx.newPage()); p2.on('pageerror', e => errori.push(e.message)); await p2.goto(BASE);
    expect(await p2.evaluate(() => D().eventi.z2?.titolo)).toBe('salvata alla chiusura');
    await p2.evaluate(() => Archivio.salvato());
    await expect.poll(() => ls(p2, 'soldirini-in-attesa')).toBeNull(); // cancellata dopo la scrittura riuscita
    expect(Object.keys((await recDati(p2)).data.eventi).sort()).toEqual(['e1', 'e2', 'z2']);
    expect(errori).toEqual([]);
  });

  test('scritture in fila: tante modifiche di seguito, una scrittura alla volta, alla fine c\'è l\'ultima', async ({ browser }) => {
    const { page, errori } = await telefono(browser, { prima: vecchiaVoce, arg: [JSON.stringify(STATO())] });
    const r = await page.evaluate(async () => { let insieme = 0, max = 0; const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function () { insieme++; max = Math.max(max, insieme); this.transaction.addEventListener('complete', () => insieme--); return put.apply(this, arguments); };
      for (let i = 0; i < 30; i++) { impost().nota = 'n' + i; changed(); }
      await Archivio.salvato(); IDBObjectStore.prototype.put = put; return max; });
    expect(r).toBe(1);
    expect((await recDati(page)).data.impost.nota).toBe('n29');
    expect(errori).toEqual([]);
  });

  test('T-S6 due schede aperte con modifiche diverse: nessuna persa; l\'altra scheda si aggiorna', async ({ browser }) => {
    const { ctx, page: A, errori } = await telefono(browser, { prima: vecchiaVoce, arg: [JSON.stringify(STATO())] });
    const B = conArchivio(await ctx.newPage()); await B.goto(BASE);
    // B non sa ancora niente della modifica di A quando scrive la sua
    await A.evaluate(() => { BroadcastChannel.prototype.postMessage = () => {}; });
    await nuovoEv(A, 'a1', '2026-11-05'); await A.evaluate(() => Archivio.salvato());
    await nuovoEv(B, 'b1', '2026-11-06'); await B.evaluate(() => Archivio.salvato());
    expect(Object.keys((await recDati(A)).data.eventi).sort()).toEqual(['a1', 'b1', 'e1', 'e2']);
    expect(await B.evaluate(() => Object.keys(D().eventi).sort())).toEqual(['a1', 'b1', 'e1', 'e2']);
    // con l'avviso tra schede (BroadcastChannel) A riceve subito la modifica di B
    await A.reload();
    await nuovoEv(B, 'b2', '2026-11-07');
    await expect.poll(() => A.evaluate(() => !!D().eventi.b2)).toBe(true);
    expect(errori).toEqual([]);
  });

  test('T-S7 spazio pieno: messaggio, modifica in memoria, synced fermo; poi si salva da sola', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await accedi(page);
    await page.evaluate(() => { window.__put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function () { throw new DOMException('finto', 'QuotaExceededError'); }; });
    await nuovoEv(page, 'q1', '2026-11-10');
    await expect(page.locator('#toast')).toHaveText('⚠ Memoria del telefono piena: le ultime modifiche non sono salvate. Libera un po’ di spazio, poi Soldirini riprova alla prossima modifica.'); // 02, tornata 22 A3
    await expect(page.locator('#toast')).toHaveAttribute('role', 'alert');
    await sincronizza(page);
    const s = await page.evaluate(() => ({ err: Archivio.errore, ev: !!D().eventi.q1, seq: DB.meta.seq, synced: DB.meta.synced }));
    expect(s.err).toBe('QuotaExceededError'); expect(s.ev).toBe(true); expect(s.synced).toBeLessThan(s.seq);
    expect((await recDati(page)).data.eventi.q1).toBeUndefined();
    // torna lo spazio: alla modifica successiva (o al ritorno nell'app) si salva tutto
    await page.evaluate(() => { IDBObjectStore.prototype.put = window.__put; impost().x = 1; changed(); return Archivio.salvato(); });
    expect(await page.evaluate(() => Archivio.errore)).toBeNull();
    expect((await recDati(page)).data.eventi.q1).toBeTruthy();
    expect(errori).toEqual([]);
  });

  test('foto grandi: più di 5 MiB di dati si salvano (con localStorage fallivano)', async ({ browser }) => {
    const { page, errori } = await telefono(browser, { prima: vecchiaVoce, arg: [JSON.stringify(STATO())] });
    const ok = await page.evaluate(async () => { const foto = 'data:image/jpeg;base64,' + 'A'.repeat(6 * 1024 * 1024);
      D().eventi.e2.spese = [{ importo: '3', foto, updatedAt: Date.now() }]; D().eventi.e2.updatedAt = Date.now(); changed(); return Archivio.salvato(); });
    expect(ok).toBe(true);
    await page.reload();
    expect(await page.evaluate(() => D().eventi.e2.spese[0].foto.length)).toBe(6 * 1024 * 1024 + 23);
    expect(errori).toEqual([]);
  });
});

test.describe('v24b · Esci, versioni vecchie e vecchia copia (R3)', () => {
  test('T-S8 Esci: dati, vecchia voce, token e soldirini-file vuoti, con l\'avviso per le buste non inviate; Strafobico e rimborsi-pwa-v1 intatti; l\'altra scheda non rimette i dati', async ({ browser }) => {
    const { ctx, page, errori } = await telefono(browser, { prima: vecchiaVoce, arg: [JSON.stringify(STATO())] });
    await entra(page);
    await page.evaluate(async () => {
      localStorage.setItem('rimborsi-pwa-v1', '{"mesi":{}}');
      localStorage.setItem('soldirini-v1-illeggibile', '{rovinato'); // copia di una vecchia voce illeggibile: anche questa va via con Esci
      await new Promise(ok => { const r = indexedDB.open('strafobico', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put('turni', 'dati'); t.oncomplete = () => { r.result.close(); ok(); }; }; });
      D().buste = { 'x|2026-10': { lid: 'x', mese: '2026-10', netto: '100', daCaricare: true, updatedAt: 1 } }; changed();
      await soldiriniFile.fset('x|2026-10', { nome: 'busta.pdf', tipo: 'application/pdf', blob: new Blob(['finta']) });
    });
    const B = conArchivio(await ctx.newPage()); await B.goto(BASE);
    // copia fatta alla chiusura di una pagina (archivio.js): anche questa va via con Esci (messa dopo l'avvio della scheda B, che altrimenti la unirebbe)
    await page.evaluate(() => localStorage.setItem('soldirini-in-attesa', '{"data":{}}'));
    const dialoghi = []; page.on('dialog', d => { dialoghi.push(d.message()); d.accept(); });
    // 24b.1 (02, tornata 22 A2): finestra dell'app per le buste in attesa; toccare fuori = "Resta collegato"
    await page.evaluate(() => { logout(); });
    const dlg = page.locator('#dlg');
    await expect(dlg.locator('#dlgMsg')).toHaveText('1 busta paga o cedolino non è ancora su Google DriveSe esci ora, viene cancellato da questo telefono e non lo ritrovi più.Per non perderlo, resta collegato finché il caricamento non è finito, poi esci.');
    await expect(dlg.locator('#dlgBtns button')).toHaveText(['Resta collegato', 'Esci e cancella']);
    await dlg.click({ position: { x: 5, y: 5 } }); await expect(dlg).toBeHidden();
    expect(await page.evaluate(() => [DB.meta.account && DB.meta.account.email, Object.keys(D().eventi).length > 0])).toEqual([expect.any(String), true]); // ancora dentro
    await page.evaluate(() => { logout(); });
    await dlg.locator('#dlgBtns button', { hasText: 'Esci e cancella' }).click();
    await page.evaluate(() => Archivio.salvato());
    await expect.poll(() => B.evaluate(() => window.Archivio && Archivio.avviata ? Object.keys(D().eventi).length : -1).catch(() => -1)).toBe(0); // l'altra scheda si è ricaricata
    await B.close();
    const d = await recDati(page);
    expect([Object.keys(d.data.eventi).length, d.meta.account]).toEqual([0, null]);
    expect(await page.evaluate(() => [localStorage.getItem('soldirini-v1'), localStorage.getItem('soldirini-spostato'), localStorage.getItem('soldirini-tok'), localStorage.getItem('soldirini-v1-illeggibile'), localStorage.getItem('soldirini-in-attesa'), localStorage.getItem('rimborsi-pwa-v1')]))
      .toEqual([null, null, null, null, null, '{"mesi":{}}']);
    expect(await page.evaluate(() => soldiriniFile.fget('x|2026-10'))).toBeUndefined();
    expect(await page.evaluate(() => new Promise(ok => { const r = indexedDB.open('strafobico'); r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get('dati'); g.onsuccess = () => { r.result.close(); ok(g.result); }; }; }))).toBe('turni');
    // riaprendo: nessuna domanda sulla vecchia copia (non c'è più) e dati vuoti
    await page.reload();
    expect(await page.evaluate(() => [$('vcModal').hidden, Object.keys(D().eventi).length])).toEqual([true, 0]);
    expect(errori).toEqual([]);
  });

  test('T-S9 ritorno alla versione pubblicata dopo lo spostamento: dati del giorno dello spostamento; con Drive tornano le modifiche recenti', async ({ browser }) => {
    const v = sitoDaCommit(PUBBLICATA, 'SOLDIRINI_SITO_2402');
    test.skip(!v.sito, v.motivo);
    const drive = new DriveFinto();
    const { ctx, page, errori } = await telefono(browser, { drive, prima: vecchiaVoce, arg: [JSON.stringify(STATO())] });
    await entra(page);
    await nuovoEv(page, 'dopo1', '2026-11-12'); await sincronizza(page); await aspettaSync(page);
    // il telefono riprende la versione pubblicata (per esempio dalla cache): da qui il sito servito è quello del commit pubblicato
    const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
    await ctx.route('https://tankizzu.github.io/Soldirini/**', r => { const f = new URL(r.request().url()).pathname.slice('/Soldirini/'.length) || 'index.html';
      const fp = path.join(v.sito, decodeURIComponent(f)); if (!fp.startsWith(v.sito) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) return r.fulfill({ status: 404, body: 'non trovato' });
      r.fulfill({ status: 200, contentType: TIPI[path.extname(fp)] || 'application/octet-stream', body: fs.readFileSync(fp) }); });
    await page.goto(BASE);
    expect(await page.evaluate(() => typeof Archivio)).toBe('undefined');
    expect(await page.evaluate(() => Object.keys(D().eventi).sort())).toEqual(['e1', 'e2']); // dati del giorno dello spostamento
    await entra(page, false);
    expect(await page.evaluate(() => Object.keys(D().eventi).sort())).toEqual(['dopo1', 'e1', 'e2']); // Drive riporta le modifiche recenti
    expect(errori).toEqual([]);
  });

  test('T-S10 IndexedDB vuoto con la vecchia copia: domanda (testi di 02), nessun ripristino automatico; "Non ora" la ripropone; "Riprendi" unisce', async ({ browser }) => {
    const { page, errori } = await telefono(browser, { prima: vecchiaVoce, arg: [JSON.stringify(STATO())] });
    expect(await page.evaluate(() => $('vcModal').hidden)).toBe(true); // spostamento normale: nessuna domanda
    // IndexedDB svuotato (per esempio dal telefono), la vecchia copia c'è ancora
    await page.evaluate(() => new Promise(ok => { const r = indexedDB.open('soldirini', 1); r.onsuccess = () => { const t = r.result.transaction('dati', 'readwrite'); t.objectStore('dati').clear(); t.oncomplete = () => { r.result.close(); ok(); }; }; }));
    await page.evaluate(() => { Archivio.fermo = true; }); // questa pagina non deve riscrivere prima del riavvio
    await page.reload();
    expect(await page.evaluate(() => [Archivio.da, Object.keys(D().eventi).length])).toEqual(['perso', 0]); // niente ripristino silenzioso
    const m = page.locator('#vcModal');
    await expect(m).toBeVisible();
    await expect(m.locator('#vcTit')).toHaveText('Riprendere i dati salvati il 03/11/2026?');
    await expect(m.locator('#vcTxt')).toHaveText('Su questo telefono i dati di Soldirini risultano vuoti. C’è però una copia più vecchia, salvata il 03/11/2026.');
    await expect(m.locator('#vcSum .kv')).toHaveText(['Attività2 · fino al 02/11/2026', 'Progetti1', 'Spese giornaliere1']);
    await expect(m.locator('#vcAvv')).toHaveText('Mancherà quello che hai inserito o cambiato dopo il 03/11/2026, e potrebbero tornare voci che avevi cancellato dopo quella data.');
    await expect(m.locator('#vcDrive')).toBeHidden(); // senza Drive collegato
    await expect(m.locator('#vcSumT')).toBeHidden();
    await expect(m.locator('#vcNota')).toHaveText('Con «Non ora» la domanda torna al prossimo avvio. Puoi riprendere la copia anche da Impostazioni → Account.'); // 02, tornata 20 §5
    await expect(m.locator('#vcNo')).toHaveText('Non ora'); await expect(m.locator('#vcSi')).toHaveText('Riprendi');
    await m.click({ position: { x: 10, y: 10 } }); await expect(m).toBeVisible(); // B non si chiude toccando fuori
    await m.locator('#vcNo').click();
    await expect(m).toBeHidden();
    expect(await page.evaluate(() => Object.keys(D().eventi).length)).toBe(0);
    await page.reload();
    await expect(page.locator('#vcModal')).toBeVisible(); // torna al prossimo avvio
    await page.locator('#vcSi').click();
    await expect(page.locator('#toast')).toHaveText('✓ Dati del 03/11/2026 ripresi: 2 attività.');
    expect(await page.evaluate(() => Object.keys(D().eventi).sort())).toEqual(['e1', 'e2']);
    await page.reload();
    expect(await page.evaluate(() => [$('vcModal').hidden, Object.keys(D().eventi).length])).toEqual([true, 2]);
    expect(await ls(page, 'soldirini-v1')).toBe(JSON.stringify(STATO())); // la vecchia copia resta (D-087 1a)
    expect(errori).toEqual([]);
  });

  test('D-093: dopo "Non ora" e una nuova attività, la riga "Dati salvati il …" in Impostazioni → Account riprende la copia (unione, nessuna voce persa)', async ({ browser }) => {
    const { page, errori } = await telefono(browser, { prima: ([t]) => { if (!sessionStorage.getItem('__v')) { localStorage.setItem('soldirini-v1', t); localStorage.setItem('soldirini-spostato', '2026-11-04'); sessionStorage.setItem('__v', '1'); } }, arg: [JSON.stringify(STATO())] });
    await expect(page.locator('#vcModal')).toBeVisible();
    await page.locator('#vcNo').click();
    await nuovoEv(page, 'nuova', '2026-11-15');
    await page.reload();
    await expect(page.locator('#vcModal')).toBeHidden(); // i dati non sono più vuoti: la domanda non torna
    await page.evaluate(() => { tab = 'pro'; render(); const d = $('accBox').closest('details'); if (d) d.open = true; });
    const riga = page.locator('#vcRigaBox');
    // testi definitivi di 02 (tornata 20 §3): niente numeri sulla riga
    await expect(riga.locator('.vcrt b')).toHaveText('Dati salvati il 03/11/2026');
    await expect(riga.locator('.vcrt small')).toHaveText('Una copia più vecchia ha voci che oggi su questo telefono non ci sono.');
    await expect(riga.locator('#vcRiga')).toHaveText('Riprendi');
    await expect(riga.locator('#vcRiga')).toHaveAttribute('aria-label', 'Riprendi i dati salvati il 03/11/2026');
    expect((await riga.locator('#vcRiga').boundingBox()).height).toBeGreaterThanOrEqual(44);
    // 24b.1 (D-096, 02 tornata 22 A1): "Non mi serve" nasconde la riga subito, con "Annulla" per 10 secondi
    const nms = riga.locator('#vcNascondi');
    await expect(nms).toHaveText('Non mi serve');
    await expect(nms).toHaveAttribute('aria-label', 'Non mi serve: nascondi la riga dei dati salvati il 03/11/2026');
    expect((await nms.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await nms.click();
    await expect(page.locator('#vcRigaBox')).toHaveCount(0);
    await expect(page.locator('#toast span')).toHaveText('Riga nascosta. La copia resta sul telefono fino a quando esci.');
    await page.locator('#toast .tbtn').click(); // Annulla
    await expect(page.locator('#vcRigaBox')).toHaveCount(1);
    await page.locator('#vcNascondi').click();
    await expect(page.locator('#vcRigaBox')).toHaveCount(0);
    await page.evaluate(() => Archivio.salvato()); await page.reload();
    await page.evaluate(() => { tab = 'pro'; render(); const d = $('accBox').closest('details'); if (d) d.open = true; });
    await expect(page.locator('#protBox')).toBeVisible();
    await expect(page.locator('#vcRigaBox')).toHaveCount(0); // non torna dopo un riavvio
    expect(await ls(page, 'soldirini-v1')).toBeTruthy(); // la vecchia copia resta
    await page.evaluate(() => { delete DB.meta.vecchiaNascosta; render(); }); // per provare anche "Riprendi"
    // una voce che c'è in tutte e due ma è diversa resta com'è oggi
    await page.evaluate(() => { D().eventi.nuova.titolo = 'di oggi'; });
    await riga.locator('#vcRiga').click();
    const m = page.locator('#vcModal');
    // finestra D (02, tornata 20 §4)
    await expect(m.locator('#vcTit')).toHaveText('Aggiungere le voci della copia del 03/11/2026?');
    await expect(m.locator('#vcTxt')).toHaveText('Soldirini aggiunge solo le voci della copia che oggi su questo telefono mancano. Quello che c’è già resta com’è.');
    await expect(m.locator('#vcSumT')).toHaveText('Da aggiungere');
    await expect(m.locator('#vcSum .kv')).toHaveText(['Attività2 · dal 05/10 al 02/11/2026', 'Progetti1', 'Spese giornaliere1']);
    await expect(m.locator('#vcAvv')).toHaveText('Tra queste potrebbero esserci voci che avevi cancellato dopo il 03/11/2026. Se succede, cancellale di nuovo.');
    await expect(m.locator('#vcNota')).toBeHidden(); await expect(m.locator('#vcDrive')).toBeHidden();
    await expect(m.locator('#vcNo')).toHaveText('Annulla'); await expect(m.locator('#vcSi')).toHaveText('Aggiungi');
    await m.click({ position: { x: 10, y: 10 } }); await expect(m).toBeHidden(); // D si chiude toccando fuori (= Annulla)
    expect(await page.evaluate(() => Object.keys(D().eventi).sort())).toEqual(['nuova']);
    await page.locator('#vcRiga').click();
    await m.locator('#vcSi').click();
    await expect(page.locator('#toast')).toHaveText('✓ Aggiunte 4 voci dalla copia del 03/11/2026.');
    expect(await page.evaluate(() => Object.keys(D().eventi).sort())).toEqual(['e1', 'e2', 'nuova']);
    expect(await page.evaluate(() => [D().eventi.nuova.titolo, Object.keys(D().progetti), Object.keys(D().spesePers)])).toEqual(['di oggi', ['p1'], ['s1']]);
    await expect(page.locator('#vcRigaBox')).toHaveCount(0); // niente più da riprendere
    expect(errori).toEqual([]);
  });

  test('D-093: una voce cancellata dopo lo spostamento non fa comparire la riga e non torna (resta come voce "deleted")', async ({ browser }) => {
    const { page, errori } = await telefono(browser, { prima: vecchiaVoce, arg: [JSON.stringify(STATO())] });
    expect(await page.evaluate(() => Archivio.da)).toBe('localStorage');
    // cancellazione come la fa l'app (plus.js): la voce resta con deleted e updatedAt
    await page.evaluate(() => { const now = Date.now(); D().eventi.e1 = Object.assign({}, D().eventi.e1, { deleted: true, deletedAt: now, updatedAt: now }); changed(); });
    await page.reload();
    await page.evaluate(() => { D().profilo = D().profilo || emptyData().profilo; tab = 'pro'; render(); const d = $('accBox').closest('details'); if (d) d.open = true; });
    await expect(page.locator('#protBox')).toBeVisible();
    await expect(page.locator('#vcRigaBox')).toHaveCount(0);
    expect(await page.evaluate(() => Archivio.vecchiaCopia().mancanti)).toBe(0);
    expect(errori).toEqual([]);
  });

  test('T-S10b vecchia copia senza date: finestra senza data', async ({ browser }) => {
    const s = STATO(); for (const k of ['eventi', 'spesePers', 'progetti']) for (const x of Object.values(s.data[k])) delete x.updatedAt;
    const { page } = await telefono(browser, { prima: ([t]) => { if (!sessionStorage.getItem('__v')) { localStorage.setItem('soldirini-v1', t); localStorage.setItem('soldirini-spostato', '2026-11-01'); sessionStorage.setItem('__v', '1'); } }, arg: [JSON.stringify(s)] });
    await expect(page.locator('#vcTit')).toHaveText('Riprendere i dati salvati in precedenza?');
    await expect(page.locator('#vcTxt')).toHaveText('Su questo telefono i dati di Soldirini risultano vuoti. C’è però una copia più vecchia.');
    await expect(page.locator('#vcAvv')).toHaveText('Mancherà quello che hai inserito o cambiato dopo quella copia, e potrebbero tornare voci che avevi cancellato dopo quella data.');
    await page.locator('#vcSi').click();
    await expect(page.locator('#toast')).toHaveText('✓ Dati ripresi: 2 attività.');
  });

  test('utente nuovo: nessuna vecchia voce, record nuovo in IndexedDB con il segno, nessuna domanda', async ({ browser }) => {
    const { page, errori } = await nuovoDispositivo(browser);
    expect(await page.evaluate(() => [Archivio.modo, Archivio.da, $('vcModal').hidden])).toEqual(['idb', 'nuovo', true]);
    await page.evaluate(() => Archivio.salvato());
    expect((await recDati(page)).meta.archivio).toMatchObject({ da: 'nuovo', versione: '24b' });
    expect(await ls(page, 'soldirini-v1')).toBeNull();
    expect(errori).toEqual([]);
  });
});

test.describe('v24b · Impostazioni → Account: protezione dalla pulizia automatica (D-087 1c, testi di 02)', () => {
  const finto = ([persistito, concede]) => { const s = { persisted: async () => window.__p, persist: async () => { window.__p = concede; return concede; } }; window.__p = persistito;
    Object.defineProperty(navigator, 'storage', { value: s, configurable: true }); };
  const vai = page => page.evaluate(() => { tab = 'pro'; render(); const d = $('accBox').closest('details'); if (d) d.open = true; });
  const box = page => page.locator('#protBox');

  test('"No" con spiegazione e "Chiedi protezione"; concessa → "Sì" e messaggio', async ({ browser }) => {
    const { page, errori } = await telefono(browser, { prima: finto, arg: [false, true] });
    await vai(page);
    await expect(box(page).locator('.kv')).toHaveText('Protezione dalla pulizia automaticaNo');
    await expect(box(page).locator('p')).toHaveText('Se lo spazio sul telefono finisce, il telefono può cancellare i dati di Soldirini per fare posto. Su iPhone, se Soldirini non è installata sulla schermata Home, i dati possono sparire anche dopo qualche giorno senza aprirla.'); // D-093 punto 2
    const b = box(page).locator('#protChiedi'); expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await b.click();
    await expect(page.locator('#toast')).toHaveText('✓ Protezione attiva: il telefono non cancellerà i dati di Soldirini per fare posto.');
    await expect(box(page).locator('.pst')).toHaveText('Sì');
    await expect(box(page).locator('p')).toHaveText('Il telefono non cancella i dati di Soldirini per fare posto.');
    await expect(box(page).locator('#protChiedi')).toHaveCount(0);
    expect(errori).toEqual([]);
  });

  test('non concessa → resta "No", il pulsante resta e la spiegazione cambia', async ({ browser }) => {
    const { page } = await telefono(browser, { prima: finto, arg: [false, false] });
    await vai(page); await box(page).locator('#protChiedi').click();
    await expect(box(page).locator('.pst')).toHaveText('No');
    await expect(box(page).locator('p')).toHaveText('Il telefono per ora non l’ha concessa. Di solito la concede quando Soldirini è installata sulla schermata Home e la usi spesso. Su alcuni navigatori te lo chiede con una finestra. Puoi riprovare più avanti.');
    await expect(box(page).locator('#protChiedi')).toBeVisible();
  });

  test('navigatore che non lo dice → "Non si sa", senza pulsante; contrasto delle etichette nei due temi', async ({ browser }) => {
    const { page } = await telefono(browser, { prima: () => Object.defineProperty(navigator, 'storage', { value: undefined, configurable: true }) });
    await vai(page);
    await expect(box(page).locator('.pst')).toHaveText('Non si sa');
    await expect(box(page).locator('p')).toHaveText('Questo navigatore non dice se protegge i dati dalla pulizia.');
    await expect(box(page).locator('#protChiedi')).toHaveCount(0);
    // contrasto testo/fondo delle tre etichette, tema chiaro e scuro (≥ 4,5:1)
    for (const tema of ['light', 'dark']) {
      const r = await page.evaluate(tema => { impost().tema = tema; applyTema(); const el = document.createElement('em'); document.body.append(el); const out = [];
        const cx = document.createElement('canvas').getContext('2d', { willReadFrequently: true }); cx.canvas.width = cx.canvas.height = 1;
        const rgb = c => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); return [...cx.getImageData(0, 0, 1, 1).data].slice(0, 3); }, lum = c => { const v = rgb(c).map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
        for (const k of ['si', 'no', 'nd']) { el.className = 'pst ' + k; const s = getComputedStyle(el); const a = lum(s.color), b = lum(s.backgroundColor); out.push(Math.round((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) * 100) / 100); }
        el.remove(); return out; }, tema);
      for (const c of r) expect(c, tema).toBeGreaterThanOrEqual(4.5);
    }
  });
});
