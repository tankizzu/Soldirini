// v24c (D-054, D-058, D-059, D-065, D-097): copia di sicurezza con password, ripresa, "Sostituisci tutto" con Drive.
// Prove C1-C13 del piano di 01 e requisiti V1-V15 di 03 (tornata 22). Solo dati inventati. Orologio fisso al 18/11/2026.
const { test, expect } = require('./helpers/prova');
const { DriveFinto, nuovoDispositivo, dopoAvvio, conArchivio, accedi, accediEsistente, aspettaSync, sincronizza } = require('./helpers/app');
const fs = require('fs');

const OGGI = '2026-11-18T10:00:00+01:00';
const PW = 'Gatto-sul-tetto-7';
const PDF = Buffer.from('%PDF-1.4\n% busta finta\n%%EOF\n');
const telefono = (browser, o = {}) => nuovoDispositivo(browser, { ora: OGGI, ...o });
const pronto = async page => { await page.waitForFunction(() => window.Copia && window.Archivio && Archivio.avviata); await dopoAvvio(page); }; // 24c.18: dopo la lettura a tempo di entrate.js

// dati inventati: un progetto, tre attività, un lavoro con una busta in attesa di Drive (file PDF finto nel telefono)
const DATI = async (page, extra = '') => page.evaluate(async (extra) => {
  const ora = Date.now(); const ev = (id, data) => ({ id, pid: 'p1', data, tipo: 'altro', titolo: 'Allenamento ' + extra, ore: true, fasce: [], fisso: '50', rimborso: false, spese: [], created: 1, updatedAt: ora });
  D().progetti.p1 = { ...nuovoProgetto(), id: 'p1', nome: 'Squadra' + extra, updatedAt: ora };
  D().eventi = { e1: ev('e1', '2026-10-05'), e2: ev('e2', '2026-11-02'), e3: ev('e3', '2026-11-10') };
  const l = Stip15.nuovoLavoro('fisso'); l.id = 'l1'; l.nome = 'Reparto'; D().lavori = { l1: l };
  D().buste = { 'l1|2026-10': { lid: 'l1', mese: '2026-10', netto: '1500', daCaricare: true, nomeFile: 'busta.pdf', updatedAt: ora } };
  D().spesePers = { s1: { id: 's1', data: '2026-11-01', cat: 'bar', importo: '4', nota: '', created: 1, updatedAt: ora } };
  D().entrate = { 'v24|risposta': { risposta: 'no', updatedAt: 1 } }; // domanda del primo avvio della v24 già risposta
  changed(); await Archivio.salvato();
}, extra);
const mettiFile = (page, buf) => page.evaluate(async b => { await soldiriniFile.fset('l1|2026-10', { nome: 'busta.pdf', tipo: 'application/pdf', blob: new Blob([new Uint8Array(b)], { type: 'application/pdf' }) }); }, [...buf]);
// crea la copia nella pagina e la restituisce come Buffer
const creaCopia = async (page, pw) => Buffer.from(await page.evaluate(async pw => [...await Copia.crea(pw)], pw));
// apre la copia nella pagina (come se l'utente avesse scelto il file)
const apriCopia = (page, buf, pw, nome = 'soldirini-copia-2026-11-18.soldirini') => page.evaluate(async ([b, pw, nome]) => {
  try { const r = await Copia.apri(new File([new Uint8Array(b)], nome), pw); return r.serve ? { serve: r.serve } : { dati: r.dati, file: r.file.map(f => ({ chiave: f.chiave, n: f.buf.length })), data: r.data, protetta: r.protetta, vecchia: r.vecchia }; }
  catch (e) { return { errore: e.tipo || e.message }; }
}, [[...buf], pw ?? null, nome]);
const canonPag = (page, o) => page.evaluate(o => canon(o), o);
const recIdb = (page, k = 'dati') => page.evaluate(k => new Promise(ok => { const r = indexedDB.open('soldirini', 1); r.onsuccess = () => { const d = r.result, g = d.transaction('dati').objectStore('dati').get(k); g.onsuccess = () => { d.close(); ok(g.result || null); }; }; }), k);
// zip costruito a mano nella pagina (per i file rovinati o modificati)
// la funzione restituisce un array di byte (Playwright la passa alla pagina senza eval: la CSP lo vieterebbe)
const zipFatto = (page, fn, arg) => page.evaluate(fn, arg).then(Buffer.from);

test.describe('v24c · formato e cifratura (C1-C5, V1-V5)', () => {
  test('C1: copia con password → telefono nuovo: dati identici, busta in attesa compresa; nessun dato in chiaro nel file', async ({ browser }) => {
    const A = await telefono(browser); await pronto(A.page); await DATI(A.page); await mettiFile(A.page, PDF);
    const copia = await creaCopia(A.page, PW);
    expect(copia.includes(Buffer.from('Squadra'))).toBe(false); expect(copia.includes(Buffer.from('Reparto'))).toBe(false);
    const datiA = await A.page.evaluate(() => canon(D()));
    const B = await telefono(browser); await pronto(B.page);
    expect(await apriCopia(B.page, copia)).toEqual({ serve: 'password' });
    const r = await apriCopia(B.page, copia, PW);
    expect(r.protetta).toBe(true); expect(r.data).toBe('2026-11-18'); expect(r.file).toEqual([{ chiave: 'l1|2026-10', n: PDF.length }]);
    expect(await canonPag(B.page, r.dati)).toBe(datiA);
    // la copia contiene solo DB.data: niente token, account, coda, cartelle
    const dentro = await B.page.evaluate(async ([b]) => { const z = await JSZip.loadAsync(new Uint8Array(b)); return Object.keys(z.files).sort(); }, [[...copia]]);
    expect(dentro).toEqual(['contenuto', 'info.json']);
    expect(A.errori).toEqual([]); expect(B.errori).toEqual([]);
  });

  test('C2: password sbagliata, file rovinato, di un\'altra app, troppo grande, di una versione futura → messaggi di 02, niente cambia', async ({ browser }) => {
    const { page, errori } = await telefono(browser); await pronto(page); await DATI(page);
    const prima = await page.evaluate(() => canon(D()));
    const copia = await creaCopia(page, PW);
    expect((await apriCopia(page, copia, 'Altra-password-9')).errore).toBe('password');
    expect((await apriCopia(page, Buffer.concat([Buffer.from('PK'), Buffer.alloc(200, 7)]))).errore).toBe('rovinato');
    expect((await apriCopia(page, Buffer.from(JSON.stringify({ app: 'altra', dati: {} })), null, 'x.json')).errore).toBe('rovinato');
    expect((await apriCopia(page, Buffer.from('ciao'), null, 'x.txt')).errore).toBe('rovinato');
    expect(await page.evaluate(async () => { try { await Copia.apri({ size: 201 * 1024 * 1024, arrayBuffer: async () => new ArrayBuffer(0) }); } catch (e) { return e.tipo; } })).toBe('grande');
    const futura = await zipFatto(page, async () => { const z = new JSZip(); z.file('info.json', JSON.stringify({ formato: 2, app: 'soldirini', protetta: false })); z.file('contenuto', 'x'); return [...await z.generateAsync({ type: 'uint8array' })]; });
    expect((await apriCopia(page, futura)).errore).toBe('nuova');
    expect(await page.evaluate(() => Copia.MSG.nuova)).toBe('Questa copia è stata fatta con una versione più nuova di Soldirini. Aggiorna l’app e riprova.');
    expect(await page.evaluate(() => canon(D()))).toBe(prima);
    expect(errori).toEqual([]);
  });

  test('C3, V1, V2: intestazione cambiata o parametri fuori misura → non si apre, senza calcolare per ore', async ({ browser }) => {
    const { page, errori } = await telefono(browser); await pronto(page); await DATI(page);
    const copia = await creaCopia(page, PW);
    const cambia = (fn) => page.evaluate(async ([b, fn]) => {
      const z = await JSZip.loadAsync(new Uint8Array(b)); const info = JSON.parse(await z.file('info.json').async('string'));
      if (fn === 'nonprotetta') info.protetta = false; if (fn === 'miliardo') info.kdf.iterazioni = 1e9; if (fn === 'poche') info.kdf.iterazioni = 599999;
      if (fn === 'sha1') info.kdf.hash = 'SHA-1'; if (fn === 'iv') info.cifra.iv = 'AAAA'; if (fn === 'ordine') { const k = info.kdf; delete info.kdf; info.kdf = k; }
      z.file('info.json', JSON.stringify(info)); const u = await z.generateAsync({ type: 'uint8array' });
      const t0 = performance.now(); let tipo = 'aperta'; try { await Copia.apri(new File([u], 'c.soldirini'), 'Gatto-sul-tetto-7'); } catch (e) { tipo = e.tipo; }
      return { tipo, ms: performance.now() - t0 };
    }, [[...copia], fn]);
    expect((await cambia('nonprotetta')).tipo).toBe('rovinato');
    const lenta = await cambia('miliardo'); expect(lenta.tipo).toBe('rovinato'); expect(lenta.ms).toBeLessThan(3000);
    expect((await cambia('poche')).tipo).toBe('rovinato');
    expect((await cambia('sha1')).tipo).toBe('rovinato');
    expect((await cambia('iv')).tipo).toBe('rovinato');
    // stessi valori, campi in un altro ordine: i byte autenticati cambiano → non si apre (V1: si usano i byte del file)
    expect((await cambia('ordine')).tipo).toBe('password');
    // il file non toccato si apre (i byte di info.json sono quelli del file)
    expect((await apriCopia(page, copia, PW)).protetta).toBe(true);
    expect(errori).toEqual([]);
  });

  test('V3: la password con "è" scritta nei due modi (composta e scomposta) apre la stessa copia', async ({ browser }) => {
    const { page } = await telefono(browser); await pronto(page); await DATI(page);
    const copia = await creaCopia(page, 'caff\u00e8-amaro-42');
    expect((await apriCopia(page, copia, 'caffe\u0300-amaro-42')).protetta).toBe(true);
  });

  test('C4, C5, V4: dalle Impostazioni, password facile o diversa → errori; con password la copia si scarica e la password non resta da nessuna parte', async ({ browser }) => {
    const { page, errori } = await telefono(browser); await pronto(page); await DATI(page);
    await page.evaluate(() => { tab = 'pro'; render(); (e => { for (let d = e && e.closest('details'); d; d = d.parentElement.closest('details')) d.open = true; })($('cpBox')); });
    await expect(page.locator('#cpBox')).toContainText('Nessuna copia salvata finora.');
    await page.evaluate(() => document.querySelector('#cpBox [data-cp=salva]').click());
    await expect(page.locator('#cpTit')).toHaveText('Proteggere la copia con una password?');
    await expect(page.locator('#cpBody .cpopt.on')).toContainText('Consigliato');
    await page.click('#cpBody [data-cp=continua]');
    await expect(page.locator('#cpTit')).toHaveText('Scegli la password');
    await page.fill('#cpP1', 'aaaaaaaa'); await page.fill('#cpP2', 'aaaaaaaa'); await page.click('[data-cp=salvapw]');
    await expect(page.locator('#cpErr')).toHaveText(/troppo facile da indovinare/);
    for (const p of ['12345678', 'abcdefgh', '87654321']) { await page.fill('#cpP1', p); await page.fill('#cpP2', p); await page.click('[data-cp=salvapw]'); await expect(page.locator('#cpErr')).toHaveText(/troppo facile/); }
    await page.fill('#cpP1', 'corta'); await page.fill('#cpP2', 'corta'); await page.click('[data-cp=salvapw]'); await expect(page.locator('#cpErr')).toHaveText('La password è troppo corta: servono almeno 8 caratteri.');
    await page.fill('#cpP1', PW); await page.fill('#cpP2', PW + 'x'); await page.click('[data-cp=salvapw]'); await expect(page.locator('#cpErr')).toHaveText('Le due password non sono uguali.');
    await page.fill('#cpP2', PW);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-cp=salvapw]')]);
    expect(dl.suggestedFilename()).toBe('soldirini-copia-2026-11-18.soldirini');
    await expect(page.locator('#toast')).toContainText('✓ Copia salvata: soldirini-copia-2026-11-18.soldirini');
    await expect(page.locator('#toast')).toContainText('Di solito la trovi nella cartella Download.');
    await expect(page.locator('#cpModal')).toBeHidden();
    await expect(page.locator('#cpBox')).toContainText('Ultima copia: 18/11/2026 · con password');
    const file = fs.readFileSync(await dl.path());
    expect((await apriCopia(page, file, PW)).protetta).toBe(true);
    // la password non è nei dati, in localStorage, in IndexedDB, nella pagina
    await page.evaluate(() => Archivio.salvato());
    const tutto = await page.evaluate(async () => JSON.stringify(localStorage) + JSON.stringify(DB) + document.body.innerHTML);
    expect(tutto.includes(PW)).toBe(false);
    expect(JSON.stringify(await recIdb(page))).not.toContain(PW);
    // la seconda volta: "Password per questa copia"; con "No" in Impostazioni: avviso del file non protetto (C5)
    await page.evaluate(() => document.querySelector('#cpBox [data-cp=salva]').click());
    await expect(page.locator('#cpTit')).toHaveText('Password per questa copia');
    await page.click('#cpBody [data-cp=annulla]');
    await page.click('#cpBox [data-cpw="0"]');
    await page.evaluate(() => document.querySelector('#cpBox [data-cp=salva]').click());
    await expect(page.locator('#cpTit')).toHaveText('Il file non sarà protetto');
    const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('[data-cp=salvano]')]);
    const r = await apriCopia(page, fs.readFileSync(await dl2.path()));
    expect(r.protetta).toBe(false); expect(r.serve).toBeUndefined();
    await expect(page.locator('#cpBox')).toContainText('· senza password');
    expect(errori).toEqual([]);
  });
});

test.describe('v24c · dati in arrivo non fidati (C9, C10, V6-V8)', () => {
  test('V6, V8: parti sconosciute e id pericolosi scartati, updatedAt nel futuro riportato ad adesso, file che non corrispondono scartati', async ({ browser }) => {
    const { page, errori } = await telefono(browser); await pronto(page);
    const z = await zipFatto(page, async () => {
      const ora = Date.now(); const dati = { v: 1, sconosciuto: { x: 1 }, profilo: { nome: 'Ada', updatedAt: ora + 9e10 },
        eventi: { e1: { id: 'e1', pid: 'p1', data: '2026-11-02', updatedAt: ora + 5e9 }, e2: { id: 'e2', data: 7 }, e3: 'testo' },
        buste: { 'l1|2026-10': { lid: 'l1', mese: '2026-10', daCaricare: true, updatedAt: 1 } } };
      const testo = JSON.stringify(dati).replace('"sconosciuto"', '"__proto__":{"inquinato":1},"sconosciuto"').replace('"e1":', '"constructor":{"id":"c"},"e1":');
      const i = new JSZip(); i.file('dati.json', testo);
      i.file('file/0.bin', new Uint8Array([0x25, 0x50, 0x44, 0x46, 1])); i.file('file/1.bin', new Uint8Array([1, 2, 3, 4])); i.file('file/2.bin', new Uint8Array([0x25, 0x50, 0x44, 0x46]));
      i.file('file/elenco.json', JSON.stringify([{ chiave: 'l1|2026-10', nome: 'b.pdf', tipo: 'application/pdf', n: 0 }, { chiave: 'l1|2026-09', nome: 'x.pdf', tipo: 'application/pdf', n: 2 }, { chiave: 'ced|2026-10', nome: 'y.pdf', tipo: 'application/pdf', n: 1 }, { chiave: 'l1|2026-10', nome: 'z.exe', tipo: 'application/x', n: 1 }]));
      const fuori = new JSZip(); fuori.file('info.json', JSON.stringify({ formato: 1, app: 'soldirini', protetta: false })); fuori.file('contenuto', await i.generateAsync({ type: 'uint8array' }));
      return [...await fuori.generateAsync({ type: 'uint8array' })];
    });
    const r = await apriCopia(page, z);
    expect(r.dati.sconosciuto).toBeUndefined(); expect(Object.keys(r.dati.eventi)).toEqual(['e1']);
    expect(r.dati.profilo.updatedAt).toBe(await page.evaluate(() => Date.now())); expect(r.dati.eventi.e1.updatedAt).toBe(await page.evaluate(() => Date.now()));
    expect(r.file).toEqual([{ chiave: 'l1|2026-10', n: 5 }]);
    expect(await page.evaluate(() => ({}).inquinato)).toBeUndefined();
    expect(errori).toEqual([]);
  });

  test('C9, V7: testi con HTML e virgolette in nomi, luoghi, km, soglie, foto → nessun elemento aggiunto alla pagina', async ({ browser }) => {
    const { page, errori } = await telefono(browser); await pronto(page);
    const male = '"><img src=x id=iniettato onerror=alert(1)>';
    const z = await zipFatto(page, async (male) => {
      const ora = Date.now(); const base = nuovoProgetto(); const p = { ...base, id: 'p1', nome: 'Squadra' + male, colore: '#4a5f8a', ore: { ...base.ore, attivo: true },
        rimborso: { ...base.rimborso, attivo: true, tariffa: '0,3' + male, luoghi: [{ id: 'l' + male, nome: 'Campo' + male, km: '12' + male }], logo: 'data:image/png;base64,AAAA' + male }, updatedAt: ora };
      const dati = { v: 1, progetti: { p1: p }, eventi: { e1: { id: 'e1', pid: 'p1', data: '2026-11-02', tipo: 'altro', titolo: male, ore: true, fasce: [], fisso: '50', rimborso: true, luogoId: 'x' + male, luogo: male,
        spese: [{ tipo: 'altro', importo: '3', foto: 'data:image/jpeg;base64,AA' + male }], updatedAt: ora } },
        mesi: { 'p1|2026-11': { pedaggi: '2' + male, tariffa: male, updatedAt: ora } }, impost: { soglie: [{ id: 'x', nome: 'Soglia' + male, cat: 'occasionale', limite: '5000' + male }], updatedAt: ora } };
      const i = new JSZip(); i.file('dati.json', JSON.stringify(dati));
      const f = new JSZip(); f.file('info.json', JSON.stringify({ formato: 1, app: 'soldirini', protetta: false })); f.file('contenuto', await i.generateAsync({ type: 'uint8array' }));
      return [...await f.generateAsync({ type: 'uint8array' })];
    }, male);
    await page.evaluate(async b => { const r = await Copia.apri(new File([new Uint8Array(b)], 'c.soldirini')); DB.data = mergeData(D(), r.dati); changed(); }, [...z]);
    for (const t of ['rie', 'cal', 'pro', 'tas']) await page.evaluate(t => { cur = '2026-11'; tab = t; render(); }, t);
    await page.evaluate(() => { cur = '2026-11'; vaiA('drim'); });
    await page.evaluate(() => { openEv(['2026-11-02']); });
    await page.evaluate(() => { const p = prog('p1'); if (p) openProj('p1'); });
    expect(await page.locator('#iniettato').count()).toBe(0);
    expect(await page.evaluate(() => document.querySelectorAll('[onerror]').length)).toBe(0);
    expect(errori).toEqual([]);
  });

  test('C10: i vecchi file (Scarica backup e copia mensile di Drive) si riprendono; altri JSON no', async ({ browser }) => {
    const { page, errori } = await telefono(browser); await pronto(page); await DATI(page);
    const d = await page.evaluate(() => D());
    const vecchio = await apriCopia(page, Buffer.from(JSON.stringify(d, null, 1)), null, 'soldirini-backup-2026-10-05.json');
    expect(vecchio.vecchia).toBe(true); expect(vecchio.data).toBe(''); expect(Object.keys(vecchio.dati.eventi).length).toBe(3);
    const mensile = await apriCopia(page, Buffer.from(JSON.stringify({ app: 'soldirini', versione: '24', data: '2026-11-01T08:00:00.000Z', dati: d })), null, 'Soldirini copia 2026-11-01.json');
    expect(mensile.data).toBe('2026-11-01'); expect(Object.keys(mensile.dati.progetti)).toEqual(['p1']);
    expect((await apriCopia(page, Buffer.from(JSON.stringify({ v: 2, x: 1 })), null, 'a.json')).errore).toBe('rovinato');
    // dall'interfaccia: copia di una versione precedente
    await page.evaluate(() => { tab = 'pro'; render(); (e => { for (let d = e && e.closest('details'); d; d = d.parentElement.closest('details')) d.open = true; })($('cpBox')); document.querySelector('#cpBox [data-cp=riprendi]').click(); });
    await page.setInputFiles('#cpFile', { name: 'soldirini-backup-2026-10-05.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(d)) });
    await expect(page.locator('#cpBody .cpsum')).toContainText('Copia di una versione precedente');
    await expect(page.locator('#cpBody .cpsum')).toContainText('3 · dal 05/10/2026 al 10/11/2026');
    expect(errori).toEqual([]);
  });
});

test.describe('v24c · Unisci, Sostituisci, Rimetti sul telefono (C6, C7, V9, V10)', () => {
  test('C6: Unisci dall\'interfaccia → nessuna voce persa, messaggio con i conteggi; di nuovo → "c\'era già tutto"', async ({ browser }) => {
    const A = await telefono(browser); await pronto(A.page); await DATI(A.page);
    const copia = await creaCopia(A.page, PW);
    const { page, errori } = await telefono(browser); await pronto(page);
    await page.evaluate(() => { const ora = Date.now(); D().progetti.p9 = { ...nuovoProgetto(), id: 'p9', nome: 'Mio', updatedAt: ora }; D().eventi.z1 = { id: 'z1', pid: 'p9', data: '2026-11-15', tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '10', rimborso: false, spese: [], created: 1, updatedAt: ora }; changed(); });
    await page.evaluate(() => { tab = 'pro'; render(); (e => { for (let d = e && e.closest('details'); d; d = d.parentElement.closest('details')) d.open = true; })($('cpBox')); document.querySelector('#cpBox [data-cp=riprendi]').click(); });
    await page.setInputFiles('#cpFile', { name: 'soldirini-copia-2026-11-18.soldirini', mimeType: 'application/octet-stream', buffer: copia });
    await expect(page.locator('#cpPw')).toBeVisible();
    await page.fill('#cpPwIn', 'sbagliata-123'); await page.click('[data-cp=apri]');
    await expect(page.locator('#cpErr')).toHaveText('Password sbagliata. Se l’hai dimenticata, questa copia non si può aprire: prova con un’altra copia.');
    await page.fill('#cpPwIn', PW); await page.click('[data-cp=apri]');
    await expect(page.locator('#cpBody .cpsum')).toContainText('Copia del 18/11/2026');
    await expect(page.locator('#cpBody .cpopt.on')).toContainText('Unisci');
    await page.click('[data-cp=usa]');
    await expect(page.locator('#toast')).toHaveText('✓ Copia ripresa: 8 voci aggiunte, 0 aggiornate.');
    expect(await page.evaluate(() => [Object.keys(D().eventi).sort(), Object.keys(D().progetti).sort()])).toEqual([['e1', 'e2', 'e3', 'z1'], ['p1', 'p9']]);
    // la busta in attesa torna nel telefono
    expect(await page.evaluate(async () => (await soldiriniFile.fget('l1|2026-10'))?.nome)).toBe(undefined); // nessun file nella copia di A (non era nel telefono)
    await page.evaluate(() => document.querySelector('#cpBox [data-cp=riprendi]').click());
    await page.setInputFiles('#cpFile', { name: 'c.soldirini', mimeType: 'application/octet-stream', buffer: copia });
    await page.fill('#cpPwIn', PW); await page.click('[data-cp=apri]'); await page.click('[data-cp=usa]');
    await expect(page.locator('#toast')).toHaveText('✓ Copia ripresa: su questo telefono c’era già tutto.');
    expect(errori).toEqual([]);
  });

  test('C7, V9: Sostituisci tutto → dati della copia, i dati di prima messi da parte; Rimetti → dati di prima identici (scambio); Esci li cancella', async ({ browser }) => {
    const A = await telefono(browser); await pronto(A.page); await DATI(A.page); await mettiFile(A.page, PDF);
    const copia = await creaCopia(A.page, null);
    const { page, errori } = await telefono(browser); await pronto(page);
    await page.evaluate(() => { const ora = Date.now(); D().progetti.p9 = { ...nuovoProgetto(), id: 'p9', nome: 'Mio', updatedAt: ora }; D().eventi.z1 = { id: 'z1', pid: 'p9', data: '2026-11-15', tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '10', rimborso: false, spese: [], created: 1, updatedAt: ora }; changed(); });
    await page.evaluate(() => { tab = 'pro'; render(); (e => { for (let d = e && e.closest('details'); d; d = d.parentElement.closest('details')) d.open = true; })($('cpBox')); });
    await page.evaluate(() => Archivio.salvato());
    const prima = await page.evaluate(() => canon(D()));
    await page.evaluate(() => document.querySelector('#cpBox [data-cp=riprendi]').click());
    await page.setInputFiles('#cpFile', { name: 'c.soldirini', mimeType: 'application/octet-stream', buffer: copia });
    await page.click('#cpBody .cpopt[data-modo=sostituisci]'); await page.click('[data-cp=usa]');
    await expect(page.locator('#cpTit')).toHaveText('Sostituire tutti i dati di questo telefono?');
    await expect(page.locator('#cpBody')).toContainText('Ora ci sono 1 attività (dal 15/11/2026 al 15/11/2026). Dopo ci saranno solo quelle della copia: 3 attività (fino al 10/11/2026).');
    await expect(page.locator('#cpBody .cpwarn')).toHaveCount(0); // senza Drive
    await page.click('[data-cp=sostituisci]');
    await expect(page.locator('#toast')).toHaveText('✓ Dati sostituiti con la copia del 18/11/2026.');
    expect(await page.evaluate(() => [Object.keys(D().eventi).filter(k => !D().eventi[k].deleted).sort(), D().eventi.z1?.deleted, D().progetti.p9?.deleted])).toEqual([['e1', 'e2', 'e3'], true, true]);
    expect(await page.evaluate(async () => (await soldiriniFile.fget('l1|2026-10'))?.nome)).toBe('busta.pdf');
    // V9: messi da parte con una chiave a parte, non nel record dei dati
    const parte = await recIdb(page, 'da-parte'); expect(parte.il).toBe('2026-11-18'); expect(await canonPag(page, JSON.parse(parte.testo))).toBe(prima);
    expect((await recIdb(page)).testo).not.toContain('"z1":{"created"'); // il record dei dati ha z1 solo come cancellata
    await expect(page.locator('#cpBox .cpparte')).toContainText('Dati messi da parte il 18/11/2026');
    await expect(page.locator('#cpBox .cpparte')).toContainText('1 attività, fino al 15/11/2026');
    // dopo un riavvio i dati sostituiti restano
    await page.reload(); await pronto(page);
    expect(await page.evaluate(() => Object.keys(D().eventi).filter(k => !D().eventi[k].deleted).length)).toBe(3);
    // Rimetti (22): scambio
    await page.evaluate(() => { tab = 'pro'; render(); (e => { for (let d = e && e.closest('details'); d; d = d.parentElement.closest('details')) d.open = true; })($('cpBox')); });
    await page.click('#cpBox [data-cp=rimetti]');
    await expect(page.locator('#cpTit')).toHaveText('Rimettere i dati messi da parte?');
    await expect(page.locator('#cpBody')).toContainText('Ora ci sono 3 attività (fino al 10/11/2026). Dopo tornano i dati messi da parte il 18/11/2026: 1 attività (fino al 15/11/2026).');
    await page.click('[data-cp=rimettisi]');
    await expect(page.locator('#toast')).toHaveText('✓ Rimessi i dati messi da parte il 18/11/2026. Quelli che c’erano prima ora sono messi da parte.');
    expect(await page.evaluate(() => Object.keys(D().eventi).filter(k => !D().eventi[k].deleted))).toEqual(['z1']);
    expect(Object.keys(JSON.parse((await recIdb(page, 'da-parte')).testo).eventi).filter(k => k !== 'z1').sort()).toEqual(['e1', 'e2', 'e3']);
    // "Esci" cancella anche i dati messi da parte
    page.on('dialog', d => d.accept());
    await page.evaluate(() => logout());
    await expect.poll(() => recIdb(page, 'da-parte')).toBeNull();
    expect(errori).toEqual([]);
  });

  test('V10: con due schede aperte, "Sostituisci tutto" e "Esci" non vengono annullati dall\'altra scheda', async ({ browser }) => {
    const A = await telefono(browser); await pronto(A.page); await DATI(A.page);
    const copia = await creaCopia(A.page, null);
    const { ctx, page } = await telefono(browser); await pronto(page);
    const evZ = id => ({ id, pid: 'p9', data: '2026-11-15', tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '1', rimborso: false, spese: [], created: 1, updatedAt: Date.now() });
    await page.evaluate(e => { D().progetti.p9 = { ...nuovoProgetto(), id: 'p9', nome: 'Mio', updatedAt: Date.now() }; D().eventi.z1 = e; changed(); return Archivio.salvato(); }, evZ('z1'));
    const p2 = conArchivio(await ctx.newPage()); await p2.goto(page.url()); await pronto(p2);
    expect(await p2.evaluate(() => !!D().eventi.z1)).toBe(true);
    const ep0 = (await recIdb(page)).epoca || 0;
    await page.evaluate(async b => { window.__r = await Copia.apri(new File([new Uint8Array(b)], 'c.soldirini')); }, [...copia]);
    // la seconda scheda scrive proprio mentre la prima sostituisce (stessi passi del pulsante, senza Drive)
    await Promise.all([
      page.evaluate(async () => { await Archivio.salvato(); await Archivio.mettiDaParte({ il: today(), testo: JSON.stringify(D()) }); DB.data = Copia.conCancellate(window.__r.dati, D()); DB.meta.seq++; await Archivio.nuovaEpoca(); }),
      p2.evaluate(e => { D().eventi.z2 = e; changed(); }, evZ('z2')).catch(() => {}) // la scheda può ricaricarsi proprio adesso (epoca nuova)
    ]);
    expect((await recIdb(page)).epoca).toBe(ep0 + 1);
    await p2.waitForFunction(() => window.Archivio && Archivio.avviata && Object.keys(D().eventi).filter(k => !D().eventi[k].deleted).length === 3, null, { timeout: 15000 });
    await expect(p2.locator('#toast')).toHaveText('I dati sono stati sostituiti in un’altra finestra di Soldirini: qui sono stati ricaricati.'); // V4 di 02
    await p2.evaluate(() => { changed(); return Archivio.salvato(); });
    const d = JSON.parse((await recIdb(page)).testo).data;
    expect(Object.keys(d.eventi).filter(k => !d.eventi[k].deleted).sort()).toEqual(['e1', 'e2', 'e3']);
    // "Esci" con l'altra scheda aperta: dopo, IndexedDB non ha più dati, anche se l'altra scheda scrive ancora
    page.on('dialog', x => x.accept());
    await page.evaluate(() => { logout(); }); await page.click('#dlgBtns button.danger'); // la busta della copia non è ancora su Drive
    await p2.waitForFunction(() => window.Archivio && Archivio.avviata && !Object.keys(D().eventi).length, null, { timeout: 15000 });
    await p2.evaluate(() => { changed(); return Archivio.salvato(); });
    expect(Object.keys(JSON.parse((await recIdb(page)).testo).data.eventi)).toEqual([]);
  });
});

test.describe('v24c · Sostituisci tutto con Google Drive (C8, V11-V14)', () => {
  test('C8: copia su Drive prima, file sostituito con generazione +1; l\'altro telefono chiede, "Non ora" = Drive in pausa, poi prende i dati di Drive', async ({ browser }) => {
    const drive = new DriveFinto();
    const A = await telefono(browser, { drive }); await accedi(A.page); await DATI(A.page); await sincronizza(A.page);
    const copia = await creaCopia(A.page, PW);
    const B = await telefono(browser, { drive }); await accediEsistente(B.page);
    await B.page.evaluate(() => { D().eventi.b1 = { id: 'b1', pid: 'p1', data: '2026-11-17', tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '10', rimborso: false, spese: [], created: 1, updatedAt: Date.now() }; changed(); });
    await sincronizza(B.page); await sincronizza(A.page);
    expect(await A.page.evaluate(() => !!D().eventi.b1)).toBe(true);
    // A sostituisce tutto con la copia (senza b1)
    await A.page.evaluate(() => { tab = 'pro'; render(); document.querySelector('#cpBox [data-cp=riprendi]').click(); });
    await A.page.setInputFiles('#cpFile', { name: 'c.soldirini', mimeType: 'application/octet-stream', buffer: copia });
    await A.page.fill('#cpPwIn', PW); await A.page.click('[data-cp=apri]');
    await expect(A.page.locator('#cpBody .cpopt[data-modo=sostituisci]')).toContainText('Con Google Drive: la sostituzione vale anche per Drive e per gli altri dispositivi collegati.');
    await A.page.click('#cpBody .cpopt[data-modo=sostituisci]'); await A.page.click('[data-cp=usa]');
    await expect(A.page.locator('#cpBody .cpwarn')).toContainText('in fondo a Impostazioni deve dire «versione 24c» o più nuova. Una versione più vecchia prende i dati della copia senza chiederlo e senza mettere da parte i suoi. Poi può rimettere i pagamenti, le entrate e i documenti dei progetti segnati come fatti o inviati che la copia non ha, e le modifiche fatte lì più di recente.');
    await A.page.click('[data-cp=sostituisci]');
    await expect(A.page.locator('#toast')).toHaveText('✓ Dati sostituiti con la copia del 18/11/2026.');
    await expect.poll(() => A.page.evaluate(() => !DB.meta.sostituzione && !syncing), { timeout: 20000 }).toBe(true);
    await aspettaSync(A.page);
    const f = drive.fileDati()[0];
    expect(f.appProperties).toMatchObject({ soldirini: 'dati', soldirini_gen: '1', soldirini_gen_il: '2026-11-18' });
    const su = drive.datiJson(); expect(su.eventi.b1.deleted).toBe(true); expect(Object.keys(su.eventi).filter(k => !su.eventi[k].deleted).sort()).toEqual(['e1', 'e2', 'e3']);
    const copie = Object.values(drive.file).filter(x => /^Soldirini copia prima della ripresa 2026-11-18\.json$/.test(x.name));
    // una copia (due se il file è cambiato a metà: la seconda è fatta prima della scrittura, V13)
    expect(copie.length).toBeGreaterThanOrEqual(1);
    for (const c of copie) { expect(JSON.parse(c.corpo).eventi.b1.deleted).toBeFalsy(); expect(c.appProperties).toBeUndefined(); }
    // B: modifica e sincronizzazione → domanda 23, nessuna scrittura su Drive
    const scritture0 = drive.registro.filter(v => v.startsWith('PATCH /upload')).length;
    await B.page.evaluate(() => { D().eventi.b2 = { id: 'b2', pid: 'p1', data: '2026-11-18', tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '10', rimborso: false, spese: [], created: 1, updatedAt: Date.now() }; changed(); });
    await sincronizza(B.page);
    await expect(B.page.locator('#cpTit')).toHaveText('I dati sono stati sostituiti su un altro dispositivo');
    await expect(B.page.locator('#cpBody')).toContainText('Il 18/11/2026, su un altro telefono o tablet');
    await B.page.click('[data-cp=annulla]');
    await expect(B.page.locator('#toast')).toHaveText('Drive in pausa: le modifiche restano su questo telefono finché non rispondi. Tocca «Drive in pausa» in alto quando vuoi.');
    await expect(B.page.locator('#sync')).toHaveText('Drive in pausa');
    await expect(B.page.locator('#sync')).toHaveClass(/pausa/);
    await expect(B.page.locator('#sync')).toHaveAttribute('aria-label', 'Drive in pausa: tocca per rispondere alla domanda sui dati sostituiti');
    expect(await B.page.locator('#sync').evaluate(e => getComputedStyle(e).backgroundColor)).toBe('rgb(243, 201, 105)');
    // Impostazioni → Account: riga "Google Drive · In pausa" con "Rispondi ora" (02, tornata 24 V3)
    await B.page.evaluate(() => { tab = 'pro'; render(); });
    await expect(B.page.locator('#accBox .drpausa b')).toHaveText('Google Drive · In pausa');
    await B.page.evaluate(() => { const d = $('accBox').closest('details'); if (d) d.open = true; });
    await B.page.click('#pausaRispondi');
    await expect(B.page.locator('#cpTit')).toHaveText('I dati sono stati sostituiti su un altro dispositivo');
    await B.page.click('[data-cp=annulla]');
    await sincronizza(B.page);
    expect(drive.registro.filter(v => v.startsWith('PATCH /upload')).length).toBe(scritture0);
    expect(drive.datiJson().eventi.b2).toBeUndefined();
    // tocco su "Drive in pausa" → di nuovo la domanda → Prendi i dati di Drive
    await B.page.click('#sync');
    await B.page.click('[data-cp=prendi]');
    await expect(B.page.locator('#toast')).toHaveText('✓ Dati presi da Google Drive. Quelli di prima sono in Impostazioni → Dati e copie di sicurezza → Copia di sicurezza.'); // 24c.20 (D-182)
    await aspettaSync(B.page);
    expect(await B.page.evaluate(() => Object.keys(D().eventi).filter(k => !D().eventi[k].deleted).sort())).toEqual(['e1', 'e2', 'e3']);
    expect(Object.keys(JSON.parse((await recIdb(B.page, 'da-parte')).testo).eventi)).toContain('b2');
    expect(await B.page.evaluate(() => DB.meta.gen)).toBe(1);
    // un telefono nuovo (senza dati) prende la generazione senza domanda
    const C = await telefono(browser, { drive }); await accediEsistente(C.page);
    await expect(C.page.locator('#cpModal')).toBeHidden();
    expect(await C.page.evaluate(() => [DB.meta.gen, Object.keys(D().eventi).filter(k => !D().eventi[k].deleted).length])).toEqual([1, 3]);
    expect(A.errori).toEqual([]); expect(B.errori).toEqual([]); expect(C.errori).toEqual([]);
  });

  test('V13, V14: Sostituisci tutto e poi niente rete → riavvio → rete: Drive riceve i dati sostituiti, mai un\'unione normale', async ({ browser }) => {
    const drive = new DriveFinto();
    const A = await telefono(browser, { drive }); await accedi(A.page); await DATI(A.page); await sincronizza(A.page);
    const copia = await creaCopia(A.page, null);
    await A.page.evaluate(() => { D().eventi.x1 = { id: 'x1', pid: 'p1', data: '2026-11-17', tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '10', rimborso: false, spese: [], created: 1, updatedAt: Date.now() }; changed(); });
    await sincronizza(A.page);
    // il caricamento su Drive fallisce (rete persa dopo la copia di sicurezza)
    drive.guasto = v => v.startsWith('PATCH /upload') ? 503 : 0;
    await A.page.evaluate(async b => { const r = await Copia.apri(new File([new Uint8Array(b)], 'c.soldirini')); window.__r = r; }, [...copia]);
    await A.page.evaluate(() => { tab = 'pro'; render(); });
    await A.page.evaluate(async () => { document.querySelector('#cpBox [data-cp=riprendi]').click(); });
    await A.page.setInputFiles('#cpFile', { name: 'c.soldirini', mimeType: 'application/octet-stream', buffer: copia });
    await A.page.click('#cpBody .cpopt[data-modo=sostituisci]'); await A.page.click('[data-cp=usa]'); await A.page.click('[data-cp=sostituisci]');
    // V2 di 02: sostituito sul telefono, Drive non ancora aggiornato → messaggio e riga in Impostazioni
    await expect(A.page.locator('#toast')).toHaveText('✓ Dati sostituiti con la copia del 18/11/2026 su questo telefono. Google Drive verrà aggiornato appena c’è connessione.', { timeout: 25000 });
    await expect.poll(() => A.page.evaluate(() => !!DB.meta.sostituzione && !syncing)).toBe(true);
    await A.page.evaluate(() => { tab = 'pro'; render(); });
    await expect(A.page.locator('#cpBox .cpinvio b')).toHaveText('⏳ Sostituzione non ancora su Google Drive');
    expect(drive.datiJson().eventi.x1.deleted).toBeFalsy();
    await A.page.reload();
    expect(await A.page.evaluate(() => !!DB.meta.sostituzione)).toBe(true);
    drive.guasto = null;
    await sincronizza(A.page);
    expect(await A.page.evaluate(() => DB.meta.sostituzione)).toBeNull();
    await A.page.evaluate(() => { tab = 'pro'; render(); });
    await expect(A.page.locator('#cpBox .cpinvio')).toHaveCount(0); // inviata: la riga sparisce
    const su = drive.datiJson(); expect(su.eventi.x1.deleted).toBe(true);
    expect(drive.fileDati()[0].appProperties.soldirini_gen).toBe('1');
    expect(A.errori).toEqual([]);
  });
});

test.describe('v24c · promemoria dei 30 giorni (C12, D-058)', () => {
  test('senza Drive e con dati: riga sotto il riquadro; "Più tardi" la nasconde 7 giorni; dopo il salvataggio sparisce; con Drive mai', async ({ browser }) => {
    const { page, errori } = await telefono(browser); await pronto(page); await DATI(page);
    await page.evaluate(() => { tab = 'rie'; render(); });
    await expect(page.locator('#cpRem')).toContainText('Non hai ancora una copia di sicurezza');
    await expect(page.locator('#cpRem')).toContainText('I dati sono solo su questo telefono. Una copia ti salva se il telefono si rompe o si perde.');
    await expect(page.locator('#cpRem')).toHaveAttribute('role', 'status');
    expect(await page.evaluate(() => document.querySelector('#rieTot').nextElementSibling.id)).toBe('cpRem');
    await page.click('#cpRem [data-cprem=tardi]');
    await expect(page.locator('#cpRem')).toHaveCount(0); await expect(page.locator('#toast')).toHaveText('Il promemoria torna tra 7 giorni.');
    await page.evaluate(() => { DB.meta.copia.piuTardi = Date.now() - 8 * 864e5; DB.meta.copia.ultima = '2026-10-10'; render(); });
    await expect(page.locator('#cpRem b')).toHaveText('Ultima copia di sicurezza: 10/10/2026');
    await page.evaluate(() => { DB.meta.copia.ultima = '2026-11-01'; render(); });
    await expect(page.locator('#cpRem')).toHaveCount(0);
    await page.evaluate(() => { DB.meta.copia.ultima = '2026-10-10'; DB.meta.account = { email: 'mario.rossi@example.com' }; render(); });
    await expect(page.locator('#cpRem')).toHaveCount(0);
    expect(errori).toEqual([]);
  });
});

test.describe('v24c · testi di 02 (tornata 24) e copie fatte alla chiusura (V10b, V16 di 03)', () => {
  test('V1: copia su Drive non riuscita o rete assente → errore nella finestra, niente cambia; pulsanti di nuovo attivi', async ({ browser }) => {
    const drive = new DriveFinto();
    const A = await telefono(browser, { drive }); await accedi(A.page); await DATI(A.page); await sincronizza(A.page);
    const copia = await creaCopia(A.page, null);
    await A.page.evaluate(() => { D().eventi.x1 = { id: 'x1', pid: 'p1', data: '2026-11-17', tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '10', rimborso: false, spese: [], created: 1, updatedAt: Date.now() }; changed(); });
    await sincronizza(A.page);
    const prima = await A.page.evaluate(() => canon(D()));
    drive.guasto = v => v.startsWith('POST /upload') ? 403 : 0; // la copia nella cartella "Copie di sicurezza" non si salva
    await A.page.evaluate(() => { tab = 'pro'; render(); document.querySelector('#cpBox [data-cp=riprendi]').click(); });
    await A.page.setInputFiles('#cpFile', { name: 'c.soldirini', mimeType: 'application/octet-stream', buffer: copia });
    await A.page.click('#cpBody .cpopt[data-modo=sostituisci]'); await A.page.click('[data-cp=usa]'); await A.page.click('[data-cp=sostituisci]');
    const msg = 'Soldirini non è riuscita a salvare su Google Drive i dati di adesso, quindi non ha sostituito niente. Controlla la connessione e riprova.';
    await expect(A.page.locator('#cpErr')).toHaveText(msg);
    await expect(A.page.locator('#cpErr')).toHaveAttribute('role', 'alert');
    await expect(A.page.locator('[data-cp=sostituisci]')).toBeEnabled(); await expect(A.page.locator('[data-cp=annulla]')).toBeEnabled();
    await expect(A.page.locator('[data-cp=sostituisci]')).toHaveText('Sostituisci tutto');
    expect(await A.page.evaluate(() => canon(D()))).toBe(prima);
    expect(await recIdb(A.page, 'da-parte')).toBeNull();
    // senza rete già al tocco: stesso messaggio
    drive.guasto = null; await A.page.context().setOffline(true);
    await A.page.click('[data-cp=sostituisci]');
    await expect(A.page.locator('#cpErr')).toHaveText(msg);
    await A.page.context().setOffline(false);
    expect(await A.page.evaluate(() => canon(D()))).toBe(prima);
    expect(A.errori.filter(e => !/guasto simulato/.test(e))).toEqual([]);
  });

  test('V4: Unisci con una busta della copia e Drive → riga sui file da caricare; icone 🔓 e 📂; navigatore senza cifratura', async ({ browser }) => {
    const A = await telefono(browser); await pronto(A.page); await DATI(A.page); await mettiFile(A.page, PDF);
    const copia = await creaCopia(A.page, null), protetta = await creaCopia(A.page, PW);
    const drive = new DriveFinto();
    const B = await telefono(browser, { drive }); await accedi(B.page);
    await B.page.evaluate(() => { tab = 'pro'; render(); document.querySelector('#cpBox [data-cp=riprendi]').click(); });
    await expect(B.page.locator('#cpBody [data-cp=file]')).toHaveText('📂 Scegli il file');
    await B.page.setInputFiles('#cpFile', { name: 'c.soldirini', mimeType: 'application/octet-stream', buffer: copia });
    await B.page.click('[data-cp=usa]');
    await expect(B.page.locator('#toast')).toContainText('1 busta paga o cedolino verrà caricato su Google Drive.');
    // prima copia: la scelta "No" ha l'icona 🔓
    await B.page.evaluate(() => { DB.meta.copia = {}; Copia.salvaUnaCopia(); });
    await expect(B.page.locator('#cpBody .cpopt[data-pw="0"] b')).toHaveText('🔓 No, senza password');
    await B.page.click('#cpX');
    // navigatore senza Web Crypto: messaggi di 02
    await B.page.evaluate(() => Object.defineProperty(window.crypto, 'subtle', { value: undefined, configurable: true }));
    expect(await apriCopia(B.page, protetta, null)).toEqual({ errore: 'apriNo' });
    expect(await B.page.evaluate(() => Copia.MSG.apriNo)).toBe('Questo navigatore non riesce ad aprire le copie protette. Aggiorna il navigatore e riprova.');
    await B.page.evaluate(() => { DB.meta.copia = { password: true }; Copia.salvaUnaCopia(); });
    await B.page.fill('#cpP1', PW); await B.page.fill('#cpP2', PW); await B.page.click('[data-cp=salvapw]');
    await expect(B.page.locator('#cpErr')).toHaveText('Questo navigatore non riesce a proteggere la copia con una password. Aggiorna il navigatore e riprova.');
    expect(A.errori).toEqual([]); expect(B.errori).toEqual([]);
  });

  test('V10b: dopo "Esci" in un\'altra scheda, la copia fatta alla chiusura non rimette i dati; la scrittura alla chiusura non tocca il record dei dati', async ({ browser }) => {
    const { ctx, page } = await telefono(browser); await pronto(page); await DATI(page);
    const p2 = conArchivio(await ctx.newPage()); await p2.goto(page.url()); await pronto(p2);
    // la seconda scheda non riceve il messaggio "esci" (come se si chiudesse proprio in quel momento)
    await page.evaluate(() => { BroadcastChannel.prototype.postMessage = () => {}; });
    page.on('dialog', d => d.accept());
    await page.evaluate(() => { logout(); });
    await page.locator('#dlgBtns button.danger').click({ timeout: 2000 }).catch(() => {}); // la busta non ancora su Drive
    await expect.poll(async () => Object.keys(JSON.parse((await recIdb(page)).testo).data.eventi).length).toBe(0);
    // la seconda scheda, con i dati vecchi, fa una modifica e si chiude subito
    await p2.evaluate(() => { D().eventi.z9 = { id: 'z9', pid: 'p1', data: '2026-11-17', tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '1', rimborso: false, spese: [], created: 1, updatedAt: Date.now() }; changed(); window.dispatchEvent(new Event('pagehide')); });
    await p2.close();
    expect(Object.keys(JSON.parse((await recIdb(page)).testo).data.eventi)).toEqual([]);
    const p3 = conArchivio(await ctx.newPage()); await p3.goto(page.url()); await pronto(p3);
    expect(await p3.evaluate(() => Object.keys(D().eventi).length)).toBe(0);
    await expect.poll(() => p3.evaluate(() => localStorage.getItem('soldirini-in-attesa'))).toBeNull();
    expect(await recIdb(p3, 'chiusura')).toBeNull();
    expect(Object.keys(JSON.parse((await recIdb(p3)).testo).data.eventi)).toEqual([]);
  });

  test('V10b, V16: la scrittura alla chiusura va nella chiave "chiusura" e torna al riavvio; una copia che non entra toglie quella vecchia', async ({ browser }) => {
    const { ctx, page } = await telefono(browser); await pronto(page); await DATI(page);
    const rev0 = (await recIdb(page)).rev, url = page.url(), errori = [];
    // una copia rimasta da prima; poi la nuova copia non entra in localStorage e le scritture normali non arrivano
    await page.evaluate(() => { localStorage.setItem('soldirini-in-attesa', JSON.stringify({ epoca: Archivio.epoca, testo: '{"data":{"eventi":{"vecchia":{"id":"vecchia"}}}}' }));
      const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'soldirini-in-attesa') throw new DOMException('pieno', 'QuotaExceededError'); return set.call(this, k, v); };
      const put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (v, k) { if (k === 'dati') throw new DOMException('pagina chiusa', 'AbortError'); return put.call(this, v, k); };
      D().eventi.z3 = { id: 'z3', pid: 'p1', data: '2026-11-17', tipo: 'altro', titolo: 'alla chiusura', ore: true, fasce: [], fisso: '1', rimborso: false, spese: [], created: 1, updatedAt: Date.now() }; changed();
      window.dispatchEvent(new Event('pagehide')); });
    expect(await page.evaluate(() => localStorage.getItem('soldirini-in-attesa'))).toBeNull(); // V16: la copia vecchia non resta
    await expect.poll(async () => !!(await recIdb(page, 'chiusura'))).toBe(true);
    expect((await recIdb(page)).rev).toBe(rev0); // il record dei dati non è stato toccato
    await page.close();
    const p2 = conArchivio(await ctx.newPage()); p2.on('pageerror', e => errori.push(e.message)); await p2.goto(url); await pronto(p2);
    expect(await p2.evaluate(() => D().eventi.z3?.titolo)).toBe('alla chiusura');
    await p2.evaluate(() => Archivio.salvato());
    await expect.poll(() => recIdb(p2, 'chiusura')).toBeNull();
    expect(Object.keys(JSON.parse((await recIdb(p2)).testo).data.eventi)).toContain('z3');
    // una copia di un'epoca vecchia non vale e si cancella
    await p2.evaluate(() => Storage.prototype.setItem.call(localStorage, 'soldirini-in-attesa', JSON.stringify({ epoca: Archivio.epoca - 1, testo: JSON.stringify({ data: { eventi: { vv: { id: 'vv', pid: 'p1', data: '2026-11-01', updatedAt: Date.now() } } } }) })));
    await p2.reload(); await pronto(p2);
    expect(await p2.evaluate(() => !!D().eventi.vv)).toBe(false);
    expect(await p2.evaluate(() => localStorage.getItem('soldirini-in-attesa'))).toBeNull();
    expect(errori).toEqual([]);
  });
});

test.describe('v24c · testate della vista Anno (02, tornata 24 §1)', () => {
  test('"…, fino a {mese}" per tutte le pagine dell\'anno in corso; da "Incassato dai progetti" la testata è 💶 con quell\'importo', async ({ browser }) => {
    const { page, errori } = await telefono(browser); await pronto(page); await DATI(page);
    await page.evaluate(() => { D().pagamenti = { 'p1|2026-10|o': { pagato: true, data: '2026-10-20', importo: 50, updatedAt: 1 } }; D().fissi = { f1: { id: 'f1', nome: 'Affitto', cat: 'altro', importo: '400', giorno: '1', dal: '2026-01', al: '', rate: '', updatedAt: 1 } }; changed(); });
    const testa = async t => { await page.evaluate(t => { cur = '2026-11'; rieMode = 'anno'; tab = 'rie'; render(); vaiA(t); }, t); return page.locator(`#v-${t} .testa small`).textContent(); };
    expect(await testa('drim')).toBe('Rimborsi spese 2026, fino a novembre');
    expect(await testa('dsp')).toBe('Spese 2026, fino a novembre'); // 24c.14 (D-168): una pagina sola
    expect(await testa('drit')).toBe('Ritenuta d’acconto 2026, fino a novembre');
    expect(await testa('dlav')).toBe('Entrato da lavoro dipendente nel 2026, fino a novembre');
    expect(await testa('dinc')).toBe('Ancora da incassare (tutto l’anno)');
    await page.evaluate(() => { cur = '2025-11'; rieMode = 'anno'; tab = 'rie'; render(); vaiA('drim'); });
    await expect(page.locator('#v-drim .testa small')).toHaveText('Rimborsi spese 2025');
    // dalla casella "Incassato dai progetti"
    await page.evaluate(() => { cur = '2026-11'; rieMode = 'anno'; tab = 'rie'; render(); });
    if (await page.locator('#heroDet').isHidden()) await page.locator('#rieTot .rim').click();
    const cella = page.locator('#heroDet > button.hcel').filter({ hasText: 'Incassato dai progetti' });
    const importo = (await cella.locator('b').textContent()).trim();
    await cella.click();
    await expect(page.locator('#v-dinc .testa small')).toHaveText('Incassato dai progetti nel 2026, fino a novembre');
    await expect(page.locator('#v-dinc .testa .ic')).toHaveText('💶');
    await expect(page.locator('#v-dinc .testa b')).toHaveText(importo);
    // tornando al Riepilogo e riaprendo la pagina dalla sua casella, la testata torna "Ancora da incassare"
    await page.evaluate(() => { tab = 'rie'; render(); vaiA('dinc'); });
    await expect(page.locator('#v-dinc .testa small')).toHaveText('Ancora da incassare (tutto l’anno)');
    expect(errori).toEqual([]);
  });
});
