// 24c.1: correzione 2.A e proposte 2-3 di 03 (report tornata 29) sulla copia di sicurezza. Solo dati inventati. Orologio fisso al 19/11/2026.
const { test, expect } = require('./helpers/prova');
const { DriveFinto, nuovoDispositivo, accedi, aspettaSync, sincronizza } = require('./helpers/app');

const OGGI = '2026-11-19T10:00:00+01:00';
const PW = 'Gatto-sul-tetto-7';
const telefono = (browser, o = {}) => nuovoDispositivo(browser, { ora: OGGI, ...o });
const pronto = page => page.waitForFunction(() => window.Copia && window.Archivio && Archivio.avviata);
const DATI = page => page.evaluate(async () => {
  const ora = Date.now(); const ev = (id, data) => ({ id, pid: 'p1', data, tipo: 'altro', titolo: 'Allenamento', ore: true, fasce: [], fisso: '50', rimborso: false, spese: [], created: 1, updatedAt: ora });
  D().progetti.p1 = { ...nuovoProgetto(), id: 'p1', nome: 'Squadra', updatedAt: ora };
  D().eventi = { e1: ev('e1', '2026-10-05'), e2: ev('e2', '2026-11-02') };
  D().entrate = { 'v24|risposta': { risposta: 'no', updatedAt: 1 } }; changed(); await Archivio.salvato();
});
const vivi = page => page.evaluate(() => Object.keys(D().eventi).filter(k => !D().eventi[k].deleted).sort());
const creaCopia = async (page, pw) => Buffer.from(await page.evaluate(async pw => [...await Copia.crea(pw)], pw));
const apriCopia = (page, buf) => page.evaluate(async b => {
  try { const r = await Copia.apri(new File([new Uint8Array(b)], 'c.soldirini')); return r.serve ? { serve: r.serve } : { dati: r.dati }; }
  catch (e) { return { errore: e.tipo || e.message }; }
}, [...buf]);
const zipFatto = (page, fn, arg) => page.evaluate(fn, arg).then(Buffer.from);
const SOST = 'Per sostituire i dati con questa copia, prima rispondi a questa domanda.', RIM = 'Per rimettere i dati messi da parte, prima rispondi a questa domanda.';
// 02, tornata 30 §4: riga in cima alla finestra 23 (non un errore), letta per prima dal lettore di schermo
const rigaPausa = async (page, testo) => { const r = page.locator('#cpBody > p#cpMotivo:first-child'); await expect(r).toHaveText(testo); await expect(r).toHaveClass(/cpinvio/);
  await expect(page.locator('#cpModal [role=dialog]')).toHaveAttribute('aria-describedby', 'cpMotivo'); await expect(page.locator('#cpErr')).toBeHidden(); };

test.describe('24c.1 · 2.A di 03: "Drive in pausa" e sostituzioni', () => {
  test('in pausa, "Sostituisci tutto" non parte: si apre la domanda 23 con il messaggio e niente cambia, né qui né su Drive', async ({ browser }) => {
    const drive = new DriveFinto();
    const A = await telefono(browser, { drive }); const page = A.page; await accedi(page); await pronto(page); await DATI(page); await sincronizza(page);
    const copia = await creaCopia(page, PW);
    await page.evaluate(() => { D().eventi.e3 = { ...D().eventi.e2, id: 'e3', data: '2026-11-18', updatedAt: Date.now() }; changed(); });
    await sincronizza(page);
    const scritture0 = drive.registro.filter(v => v.startsWith('PATCH /upload') || v.startsWith('POST /upload')).length;
    await page.evaluate(() => { DB.meta.drivePausa = { gen: 1, il: '2026-11-18' }; persist(); render(); });
    await page.evaluate(() => { tab = 'pro'; render(); document.querySelector('#cpBox [data-cp=riprendi]').click(); });
    await page.setInputFiles('#cpFile', { name: 'c.soldirini', mimeType: 'application/octet-stream', buffer: copia });
    await page.fill('#cpPwIn', PW); await page.click('[data-cp=apri]');
    await page.click('#cpBody .cpopt[data-modo=sostituisci]'); await page.click('[data-cp=usa]');
    await expect(page.locator('#cpTit')).toHaveText('I dati sono stati sostituiti su un altro dispositivo');
    await rigaPausa(page, SOST);
    await expect(page.locator('#cpBody [data-cp=sostituisci]')).toHaveCount(0);
    expect(await vivi(page)).toEqual(['e1', 'e2', 'e3']);
    expect(await page.evaluate(() => [DB.meta.sostituzione || null, !!DB.meta.drivePausa])).toEqual([null, true]);
    expect(await page.evaluate(() => Archivio.parte())).toBeNull();
    expect(drive.registro.filter(v => v.startsWith('PATCH /upload') || v.startsWith('POST /upload')).length).toBe(scritture0);
    expect(Object.values(drive.file).filter(x => /copia prima della ripresa/.test(x.name))).toHaveLength(0);
    expect(A.errori).toEqual([]);
  });

  test('in pausa, "Rimetti questi dati" con Drive non parte: domanda 23; senza Drive "Rimetti" funziona come prima', async ({ browser }) => {
    const drive = new DriveFinto();
    const A = await telefono(browser, { drive }); const page = A.page; await accedi(page); await pronto(page); await DATI(page); await sincronizza(page);
    await page.evaluate(async () => { const p = JSON.parse(JSON.stringify(D())); delete p.eventi.e2; await Archivio.mettiDaParte({ il: '2026-11-17', testo: JSON.stringify(p) }); DB.meta.drivePausa = { gen: 1, il: '2026-11-18' }; persist(); tab = 'pro'; render(); });
    await page.locator('#cpParte [data-cp=rimetti]').waitFor({ state: 'attached' }); await page.evaluate(() => document.querySelector('#cpParte [data-cp=rimetti]').click());
    await expect(page.locator('#cpTit')).toHaveText('I dati sono stati sostituiti su un altro dispositivo');
    await rigaPausa(page, RIM);
    expect(await vivi(page)).toEqual(['e1', 'e2']);
    // senza Drive (telefono senza account) la pausa non c'è e "Rimetti" apre la sua conferma
    const B = await telefono(browser); await pronto(B.page); await DATI(B.page);
    await B.page.evaluate(async () => { const p = JSON.parse(JSON.stringify(D())); delete p.eventi.e2; await Archivio.mettiDaParte({ il: '2026-11-17', testo: JSON.stringify(p) }); tab = 'pro'; render(); });
    await B.page.locator('#cpParte [data-cp=rimetti]').waitFor({ state: 'attached' }); await B.page.evaluate(() => document.querySelector('#cpParte [data-cp=rimetti]').click());
    await expect(B.page.locator('#cpTit')).toHaveText('Rimettere i dati messi da parte?');
    expect(A.errori).toEqual([]); expect(B.errori).toEqual([]);
  });

  test('"Prendi i dati di Drive" toglie una sostituzione rimasta in sospeso: nessuna generazione nuova su Drive', async ({ browser }) => {
    const drive = new DriveFinto();
    const A = await telefono(browser, { drive }); const page = A.page; await accedi(page); await pronto(page); await DATI(page); await sincronizza(page);
    const gen0 = drive.fileDati()[0].appProperties.soldirini_gen;
    // come nel caso di 03: il telefono era in pausa e aveva fatto "Sostituisci tutto" (segno rimasto)
    await page.evaluate(() => { DB.meta.drivePausa = { gen: 1, il: '2026-11-18' }; DB.meta.sostituzione = { copiata: true, rev: 'x' }; persist(); Copia.domandaPausa(true); });
    await expect(page.locator('#cpMotivo')).toHaveCount(0); expect(await page.locator('#cpModal [role=dialog]').getAttribute('aria-describedby')).toBeNull(); // senza motivo, niente riga
    await page.click('[data-cp=prendi]');
    await expect(page.locator('#toast')).toHaveText('✓ Dati presi da Google Drive. Quelli di prima sono in Impostazioni → Dati e copie di sicurezza → Copia di sicurezza.'); // 24c.20 (D-182)
    await aspettaSync(page);
    expect(await page.evaluate(() => [DB.meta.sostituzione || null, DB.meta.drivePausa || null])).toEqual([null, null]);
    expect(drive.fileDati()[0].appProperties.soldirini_gen).toBe(gen0);
    expect(Object.values(drive.file).filter(x => /copia prima della ripresa/.test(x.name))).toHaveLength(0);
    expect(A.errori).toEqual([]);
  });

  test('V13: una sincronizzazione che parte mentre "Sostituisci tutto" rimette i file non fa un\'unione normale con Drive', async ({ browser }) => {
    const drive = new DriveFinto();
    const A = await telefono(browser, { drive }); const page = A.page; await accedi(page); await pronto(page); await DATI(page);
    // una busta in attesa di Drive, così la copia contiene un file e "Sostituisci tutto" passa da rimettiFile
    await page.evaluate(async () => { const l = Stip15.nuovoLavoro('fisso'); l.id = 'l1'; l.nome = 'Reparto'; D().lavori = { l1: l };
      D().buste = { 'l1|2026-10': { lid: 'l1', mese: '2026-10', netto: '1500', daCaricare: true, nomeFile: 'busta.pdf', updatedAt: Date.now() } }; changed();
      await soldiriniFile.fset('l1|2026-10', { nome: 'busta.pdf', tipo: 'application/pdf', blob: new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])], { type: 'application/pdf' }) }); await Archivio.salvato(); });
    const copia = await creaCopia(page, PW);
    await page.evaluate(() => { D().eventi.e3 = { ...D().eventi.e2, id: 'e3', data: '2026-11-18', updatedAt: Date.now() }; changed(); });
    await sincronizza(page);
    // mentre rimette i file, parte una sincronizzazione (come un timer o il ritorno della rete)
    await page.evaluate(() => { const orig = soldiriniFile.fget; soldiriniFile.fget = async k => { await sync(false); return orig.call(soldiriniFile, k); }; });
    await page.evaluate(() => { tab = 'pro'; render(); document.querySelector('#cpBox [data-cp=riprendi]').click(); });
    await page.setInputFiles('#cpFile', { name: 'c.soldirini', mimeType: 'application/octet-stream', buffer: copia });
    await page.fill('#cpPwIn', PW); await page.click('[data-cp=apri]');
    await page.click('#cpBody .cpopt[data-modo=sostituisci]'); await page.click('[data-cp=usa]'); await page.click('[data-cp=sostituisci]');
    await expect(page.locator('#toast')).toContainText('✓ Dati sostituiti con la copia');
    await expect.poll(() => page.evaluate(() => !DB.meta.sostituzione && !syncing), { timeout: 20000 }).toBe(true);
    await aspettaSync(page);
    // tutte le copie fatte prima della ripresa hanno ancora e3: nessuna unione normale è arrivata su Drive prima della sostituzione
    const copie = Object.values(drive.file).filter(x => /^Soldirini copia prima della ripresa/.test(x.name));
    expect(copie.length).toBeGreaterThanOrEqual(1);
    for (const c of copie) expect(JSON.parse(c.corpo).eventi.e3.deleted).toBeFalsy();
    expect(drive.fileDati()[0].appProperties.soldirini_gen).toBe('1'); expect(drive.datiJson().eventi.e3.deleted).toBe(true);
    expect(A.errori).toEqual([]);
  });

  test('V13: una sincronizzazione che parte durante "Sostituisci tutto" (dopo l\'attesa iniziale) non scrive un\'unione su Drive', async ({ browser }) => {
    const drive = new DriveFinto();
    const A = await telefono(browser, { drive }); const page = A.page; await accedi(page); await pronto(page); await DATI(page); await sincronizza(page);
    const copia = await creaCopia(page, PW);
    await page.evaluate(() => { D().eventi.e3 = { ...D().eventi.e2, id: 'e3', data: '2026-11-18', updatedAt: Date.now() - 60000 }; changed(); });
    await sincronizza(page);
    // mentre "Sostituisci tutto" fa la copia su Drive parte una sincronizzazione (es. il ricontrollo dopo una scrittura) e la sua lettura
    // del file dati è lenta: senza protezione la sua unione arriverebbe dopo la sostituzione
    await page.evaluate(() => { const gf = window.gfetch, cp = window.copiaDatiSuDrive; let n = -1;
      window.gfetch = async (m, u, o) => { if (n >= 0 && m === 'GET' && /alt=media/.test(u) && ++n === 2) await new Promise(r => setTimeout(r, 1500)); return gf(m, u, o); };
      window.copiaDatiSuDrive = async (...a) => { if (n < 0) { n = 0; sync(false); } return cp(...a); }; });
    await page.evaluate(() => { tab = 'pro'; render(); document.querySelector('#cpBox [data-cp=riprendi]').click(); });
    await page.setInputFiles('#cpFile', { name: 'c.soldirini', mimeType: 'application/octet-stream', buffer: copia });
    await page.fill('#cpPwIn', PW); await page.click('[data-cp=apri]');
    await page.click('#cpBody .cpopt[data-modo=sostituisci]'); await page.click('[data-cp=usa]'); await page.click('[data-cp=sostituisci]');
    await expect(page.locator('#toast')).toContainText('✓ Dati sostituiti con la copia', { timeout: 20000 });
    await expect.poll(() => page.evaluate(() => !DB.meta.sostituzione && !syncing), { timeout: 20000 }).toBe(true);
    await aspettaSync(page);
    const copie = Object.values(drive.file).filter(x => /^Soldirini copia prima della ripresa/.test(x.name));
    for (const c of copie) expect(JSON.parse(c.corpo).eventi.e3.deleted).toBeFalsy();
    expect(drive.fileDati()[0].appProperties.soldirini_gen).toBe('1'); expect(drive.datiJson().eventi.e3.deleted).toBe(true);
    expect(A.errori).toEqual([]);
  });

  test('K7 di 03: Drive aggiornato ma il telefono si chiude prima di salvare → alla riapertura la sostituzione si rimanda senza perdere dati', async ({ browser }) => {
    const drive = new DriveFinto();
    const A = await telefono(browser, { drive }); const page = A.page; await accedi(page); await pronto(page); await DATI(page); await sincronizza(page);
    const copia = await creaCopia(page, PW);
    await page.evaluate(() => { D().eventi.e3 = { ...D().eventi.e2, id: 'e3', data: '2026-11-18', updatedAt: Date.now() - 60000 }; changed(); });
    await sincronizza(page);
    await page.evaluate(() => { tab = 'pro'; render(); document.querySelector('#cpBox [data-cp=riprendi]').click(); });
    await page.setInputFiles('#cpFile', { name: 'c.soldirini', mimeType: 'application/octet-stream', buffer: copia });
    await page.fill('#cpPwIn', PW); await page.click('[data-cp=apri]');
    await page.click('#cpBody .cpopt[data-modo=sostituisci]'); await page.click('[data-cp=usa]'); await page.click('[data-cp=sostituisci]');
    await expect(page.locator('#toast')).toContainText('✓ Dati sostituiti con la copia');
    await expect.poll(() => page.evaluate(() => !DB.meta.sostituzione && !syncing), { timeout: 20000 }).toBe(true); await aspettaSync(page);
    expect(drive.fileDati()[0].appProperties.soldirini_gen).toBe('1');
    // come se il telefono si fosse chiuso subito dopo l'invio: il segno della sostituzione c'è ancora e la generazione no
    await page.evaluate(() => { DB.meta.sostituzione = { copiata: true, rev: 'vecchia' }; DB.meta.gen = 0; persist(); });
    await sincronizza(page);
    expect(await page.evaluate(() => [DB.meta.sostituzione || null, DB.meta.drivePausa || null, DB.meta.gen])).toEqual([null, null, 2]);
    expect(await vivi(page)).toEqual(['e1', 'e2']);
    const su = drive.datiJson(); expect(Object.keys(su.eventi).filter(k => !su.eventi[k].deleted).sort()).toEqual(['e1', 'e2']); expect(su.eventi.e3.deleted).toBe(true);
    expect(drive.fileDati()[0].appProperties.soldirini_gen).toBe('2'); // gli altri dispositivi ricevono di nuovo la domanda, con gli stessi dati
    await expect(page.locator('#cpModal')).toBeHidden();
    expect(A.errori).toEqual([]);
  });

  test('02 (tornata 31 §3): in Nuova attività il testo dice "Lascia vuote le ore…"', async ({ browser }) => {
    const { page, errori } = await telefono(browser); await pronto(page);
    const t = await page.evaluate(() => { const l = Stip15.nuovoLavoro('turni'); l.oreGiorno = '8'; const f = l.tipi.find(x => x.cat === 'ferie');
      return [testoAssenza(l, f, '2026-11', true), testoAssenza(l, f, '2026-11')]; });
    expect(t[0]).toMatch(/^Lascia vuote le ore per contare una giornata intera: <b>8 ore<\/b>\. In quel caso/); expect(t[1]).toMatch(/^Lascia vuoto per contare una giornata intera/);
    // tornata 32: quarta variante di 04 anche in Nuova attività, con il campo "Ore" visibile
    await page.evaluate(() => { const l = Stip15.nuovoLavoro('turni'); l.id = 'lt'; l.nome = 'Reparto'; l.oreGiorno = '8'; const f = l.tipi.find(x => x.cat === 'ferie'); f.da = '06:00'; f.a = '14:00';
      D().lavori = { lt: l }; changed(); });
    await page.evaluate(() => openEv(['2026-11-04']));
    await page.evaluate(() => { const s = document.getElementById('secLav'); if (s && !s.open) s.open = true; });
    await page.locator('#evLav [data-lt]').filter({ hasText: 'Ferie' }).first().click();
    await expect(page.locator('#evLav p.muted.sm').last()).toHaveText('Lascia vuote le ore per usare quelle del tipo «Ferie»: 8 ore. I turni di lavoro di questo giorno restano.');
    await expect(page.locator('#evLav [data-lk="ore"]')).toBeVisible();
    expect(errori).toEqual([]);
  });

  test('testi di 02 (tornata 29 §2): connessione mancante e pulsante che lavora', async ({ browser }) => {
    const drive = new DriveFinto();
    const A = await telefono(browser, { drive }); const page = A.page; await accedi(page); await pronto(page); await DATI(page); await sincronizza(page);
    await page.evaluate(() => { DB.meta.drivePausa = { gen: 1, il: '2026-11-18' }; persist(); Copia.domandaPausa(true); });
    await page.context().setOffline(true);
    await page.click('[data-cp=prendi]');
    await expect(page.locator('#cpErr')).toHaveText('Per prendere i dati di Drive servono la connessione e l’accesso a Google. Controlla e riprova.');
    await page.context().setOffline(false);
    expect(A.errori.filter(e => !/ERR_INTERNET_DISCONNECTED|Failed to fetch/.test(e))).toEqual([]);
  });
});

test.describe('24c.1 · proposte 2 e 3 di 03', () => {
  test('proposta 2: in una copia una data di modifica anche di un\'ora nel futuro diventa adesso', async ({ browser }) => {
    const { page, errori } = await telefono(browser); await pronto(page);
    const z = await zipFatto(page, async () => {
      const ora = Date.now();
      const dati = { v: 1, eventi: { e1: { id: 'e1', pid: 'p1', data: '2026-11-02', updatedAt: ora + 3600e3 }, e2: { id: 'e2', pid: 'p1', data: '2026-11-03', updatedAt: ora - 1000 } } };
      const i = new JSZip(); i.file('dati.json', JSON.stringify(dati));
      const f = new JSZip(); f.file('info.json', JSON.stringify({ formato: 1, app: 'soldirini', protetta: false })); f.file('contenuto', await i.generateAsync({ type: 'uint8array' }));
      return [...await f.generateAsync({ type: 'uint8array' })];
    });
    const r = await apriCopia(page, z); const ora = await page.evaluate(() => Date.now());
    expect(r.dati.eventi.e1.updatedAt).toBe(ora); expect(r.dati.eventi.e2.updatedAt).toBe(ora - 1000);
    expect(errori).toEqual([]);
  });

  test('proposta 3: un pezzo troppo grande si legge a blocchi e ci si ferma subito dopo il limite (info.json di 8 MB → rovinata); le copie normali si aprono', async ({ browser }) => {
    const { page, errori } = await telefono(browser); await pronto(page); await DATI(page);
    // tutto nella pagina: zip con info.json di 8 MB poco comprimibile (tanti blocchi), poi conto i byte che JSZip estrae davvero
    const r = await page.evaluate(async () => {
      let t = ''; while (t.length < 8 * 1024 * 1024) t += Math.random().toString(36).slice(2);
      const f = new JSZip(); f.file('info.json', t); f.file('contenuto', new Uint8Array([1, 2, 3]));
      const z = await f.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
      const x = new JSZip(); x.file('a', 'b'); const P = Object.getPrototypeOf(x.file('a')), orig = P.internalStream; let letti = 0;
      P.internalStream = function (tipo) { const s = orig.call(this, tipo); s.on('data', c => { letti += c.length; }); return s; };
      let esito; try { await Copia.apri(new File([z], 'c.soldirini')); esito = 'aperta'; } catch (e) { esito = e.tipo; }
      P.internalStream = orig; return { esito, letti };
    });
    expect(r.esito).toBe('rovinato');
    expect(r.letti).toBeLessThan(1024 * 1024); // prima della 24c.1: tutti gli 8 MB
    const buona = await creaCopia(page, null);
    expect(Object.keys((await apriCopia(page, buona)).dati.eventi).sort()).toEqual(['e1', 'e2']);
    expect(errori).toEqual([]);
  });

});
