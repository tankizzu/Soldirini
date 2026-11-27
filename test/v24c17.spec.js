// 24c.17: salvadanaio senza la quota a percentuale (D-176), "Metto da parte" e "Prelevo" segnati a mano, scelta D-169 nella pagina
// Risparmi; testi di 02 (tornata 55) per la pagina "Spese" e la casella "Messi da parte". Solo dati inventati (D-089).
const { test, expect } = require('./helpers/prova');
const { DriveFinto, nuovoDispositivo, accedi, accediEsistente, sincronizza } = require('./helpers/app');
const B = require('./helpers/banca-finta');
const r2 = x => Math.round(x * 100) / 100;

async function telefono(browser, ora = '2026-12-20T10:00:00+01:00', { trattieni = false } = {}) {
  const d = await nuovoDispositivo(browser, { drive: new DriveFinto(), ora, telefono: true });
  // 24c.18: trattieni = i timer da 800 ms dell'app (la lettura a tempo di entrate.js, forseChiedi) non partono da soli:
  // la prova li fa partire quando vuole con window.__partiTimer(), come su una macchina lenta (GitHub Actions)
  if (trattieni) { await d.page.context().addInitScript(() => { const st = window.setTimeout, fermi = []; window.setTimeout = (f, t, ...a) => t === 800 ? (fermi.push(() => f(...a)), 0) : st(f, t, ...a);
      window.__partiTimer = () => { while (fermi.length) fermi.shift()(); }; });
    await d.page.reload(); }
  await d.page.waitForFunction(() => window.Entrate && window.Stip15 && window.Archivio && Archivio.avviata);
  await d.page.evaluate(() => { DB.meta.skipWelcome = true; changed(); render(); });
  return d;
}
const base = page => page.evaluate(() => {
  const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Ditta Esempio'; l.dal = '2026-01-01'; D().lavori = { [l.id]: l };
  D().fissi = {}; const id = uid(); D().fissi[id] = { id, cat: 'casa', nome: 'Affitto', importo: '450', giorno: '3', dal: '2026-10', al: '', rate: '', nota: '', updatedAt: 1 };
  changed(); render(); });
const fisco = page => page.evaluate(() => JSON.stringify([aggrega('2026'), stimaTasse('2026')]));
const conti = page => page.evaluate(() => ['2026-11', '2026-12', '2027-01'].map(m => { const c = contiMese(m); return { m, rim: c.rimanenti, u: c.usciti, e: c.entrate, ris: c.ris }; }));
// segna un movimento a mano dalla pagina Risparmi
async function segna(page, pulsante, imp, data) {
  await page.click(pulsante);
  await expect(page.locator('#mvModal')).toBeVisible();
  await page.locator('#mvImp').fill(imp);
  await page.locator('#mvData').fill(data);
  await page.click('#mvSave');
  await expect(page.locator('#mvModal')).toBeHidden();
}

test.describe('24c.17 · D-176 salvadanaio senza quota', () => {
  test('pagina Risparmi: nessuna quota proposta; "Metto da parte" e "Prelevo" a mano con D-169 accesa contano nel mese della loro data; spenta niente; tasse identiche', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await base(page);
    const f0 = await fisco(page), c0 = await conti(page);
    await page.evaluate(() => vaiA('ris'));
    await page.locator('#risBody summary', { hasText: 'Metti da parte o preleva' }).click(); // 24c.19 (D-183): sezioni chiuse all'apertura
    // niente percentuale, niente quota, niente pulsanti legati alla quota
    for (const s of ['#rsPerc', '#rsSalv', '#rsSalvAltro']) await expect(page.locator(s)).toHaveCount(0);
    await expect(page.locator('#v-ris')).not.toContainText('Percentuale');
    await expect(page.locator('#v-ris')).not.toContainText('%');
    await expect(page.locator('#rsMv')).toHaveText('Metto da parte');
    await expect(page.locator('#rsPrel')).toHaveText('Prelevo');
    await expect(page.locator('#rsTogli')).not.toBeChecked();
    // spenta: un movimento a mano non cambia i soldi del mese
    await segna(page, '#rsMv', '100', '2026-12-02');
    expect(await page.evaluate(() => Object.values(D().risparmi).filter(m => m.importo).map(m => [m.data, m.importo, 'salvadanaio' in m]))).toEqual([['2026-12-02', '100', false]]);
    expect(await conti(page)).toEqual(c0);
    // "Prelevo": la finestra parte su Prelevo e salva un importo negativo
    await page.click('#rsPrel');
    await expect(page.locator('#mvTipo [data-t="out"]')).toHaveClass(/on/);
    await expect(page.locator('#mvTit')).toHaveText('Prelevo dai risparmi');
    await page.locator('#mvImp').fill('30'); await page.locator('#mvData').fill('2027-01-15'); await page.click('#mvSave');
    expect(await conti(page)).toEqual(c0);
    // accesa: il messo da parte è un'uscita a dicembre, il prelievo un'entrata a gennaio (nel mese della data)
    await page.locator('#rsTogli').check();
    const c1 = await conti(page);
    expect(c1[0]).toEqual(c0[0]); // novembre uguale
    expect([r2(c1[1].u - c0[1].u), r2(c0[1].rim - c1[1].rim), c1[1].ris]).toEqual([100, 100, 100]);
    expect([r2(c1[2].e - c0[2].e), c1[2].ris]).toEqual([30, -30]);
    // "Rimasti dai mesi prima" di gennaio ha già i −100 di dicembre
    expect(await page.evaluate(() => r2(rimastiPrima('2027-01') - (rimastiPrima('2026-12') + contiMese('2026-12').rimanenti)))).toBe(0);
    // casella di gennaio: si è prelevato più di quanto messo → "Presi dai risparmi" (02, tornata 55 §2.3)
    await page.evaluate(() => { tab = 'rie'; rieMode = 'mese'; cur = '2027-01'; render(); });
    await expect(page.locator('#heroDet [data-vai="ris"] small').first()).toHaveText('Presi dai risparmi');
    await expect(page.locator('#heroDet [data-vai="ris"] b')).toHaveText('30,00 €');
    await expect(page.locator('#heroDet [data-vai="ris"]')).toHaveAttribute('aria-label', 'Presi dai risparmi a gennaio: 30,00 €. Apri i risparmi.');
    await page.evaluate(() => { cur = '2026-12'; render(); });
    await expect(page.locator('#heroDet [data-vai="ris"] small').first()).toHaveText('Messi da parte');
    await expect(page.locator('#heroDet [data-vai="ris"] b')).toHaveText('100,00 €');
    // tasse, CU e soglie identiche con la scelta accesa
    expect(await fisco(page)).toBe(f0);
    // spenta di nuovo: tutto come prima
    await page.evaluate(() => vaiA('ris'));
    await page.locator('#risBody summary', { hasText: 'Metti da parte o preleva' }).click(); // 24c.19 (D-183): sezioni chiuse all'apertura
    await page.locator('#rsTogli').uncheck();
    expect(await conti(page)).toEqual(c0);
    expect(await fisco(page)).toBe(f0);
    expect(errori).toEqual([]);
  });

  test('dati vecchi con la percentuale e i movimenti "salvadanaio": si aprono senza errori, restano nei dati e contano con la loro data (D-117)', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await base(page);
    const f0 = await fisco(page), c0 = await conti(page);
    const vecchi = { cfg: { perc: '12.125', updatedAt: 5 },
      'mv:s1': { data: '2026-12-18', importo: '75', ob: '', nota: '', salvadanaio: '2026-12', updatedAt: 6 },
      'mv:s2': { data: '2026-11-28', importo: '60', ob: '', nota: '', salvadanaio: '2026-11', updatedAt: 7 } };
    await page.evaluate(v => { D().risparmi = JSON.parse(JSON.stringify(v)); changed(); vaiA('ris'); }, vecchi);
    await expect(page.locator('#v-ris')).toBeVisible();
    await page.locator('#risBody summary', { hasText: 'Metti da parte o preleva' }).click(); // 24c.19 (D-183): sezioni chiuse all'apertura
    for (const s of ['#rsPerc', '#rsSalv', '#rsSalvAltro']) await expect(page.locator(s)).toHaveCount(0);
    // accesa: ogni movimento conta nel mese della sua data (il 18/12 a dicembre, il 28/11 a novembre), niente "dal giorno 1"
    await page.locator('#rsTogli').check();
    const c1 = await conti(page);
    expect([r2(c0[0].rim - c1[0].rim), r2(c0[1].rim - c1[1].rim), r2(c0[2].rim - c1[2].rim)]).toEqual([60, 75, 0]);
    expect([c1[0].ris, c1[1].ris]).toEqual([60, 75]);
    // modificare un movimento vecchio tiene il segno "salvadanaio"
    await page.evaluate(() => { document.querySelector('#v-ris [data-mved="s1"]').click(); });
    await expect(page.locator('#mvModal')).toBeVisible();
    await page.locator('#mvNota').fill('nota inventata'); await page.click('#mvSave');
    // nessuna riscrittura né cancellazione dei dati vecchi
    const dopo = await page.evaluate(() => JSON.parse(JSON.stringify(D().risparmi)));
    expect(dopo.cfg).toEqual(vecchi.cfg);
    expect(dopo['mv:s2']).toEqual(vecchi['mv:s2']);
    expect([dopo['mv:s1'].salvadanaio, dopo['mv:s1'].data, dopo['mv:s1'].importo, dopo['mv:s1'].nota]).toEqual(['2026-12', '2026-12-18', '75', 'nota inventata']);
    expect(await fisco(page)).toBe(f0);
    expect(errori).toEqual([]);
  });
});

test.describe('24c.17 · testi di 02 (tornata 55) per la pagina "Spese"', () => {
  test('testata 💸 con le due righe; frasi delle parti vuote con il mese; "Movimenti della banca" in fondo; casella "Spese" senza nota con aria-label', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await base(page);
    await page.evaluate(() => { cur = '2026-12'; rieMode = 'mese'; tab = 'rie'; render(); });
    const cas = page.locator('#heroDet [data-vai="dsp"]');
    await expect(cas.locator('.nota')).toHaveCount(0);
    await expect(cas).toHaveAttribute('aria-label', 'Spese a dicembre: 450,00 €. Uscite fisse 450,00 €. Apri le spese.');
    await page.evaluate(() => vaiA('dsp'));
    await expect(page.locator('#v-dsp .testa .ic')).toHaveText('💸');
    await expect(page.locator('#v-dsp .testa .tr')).toHaveText(['Uscite fisse 450,00 €']);
    await expect(page.locator('#rieSpeseVuoto')).toHaveText('Nessuna spesa giornaliera a dicembre. Tocca «+ Aggiungi spesa» oppure importa i movimenti della banca.');
    // l'ultima scheda della pagina è quella della banca
    expect(await page.evaluate(() => [...document.querySelectorAll('#v-dsp > :not([hidden])')].pop().className)).toMatch(/bcimp/);
    // con una spesa giornaliera: due righe nella testata
    await page.evaluate(() => { const id = uid(); D().spesePers[id] = { id, data: '2026-12-05', importo: '20', cat: 'spesa', nota: '', updatedAt: 1 }; changed(); render(); vaiA('dsp'); });
    await expect(page.locator('#v-dsp .testa .tr')).toHaveText(['Uscite fisse 450,00 €', 'Spese giornaliere 20,00 €']);
    await expect(page.locator('#rieSpeseVuoto')).toBeHidden();
    // vista Anno senza uscite fisse
    await page.evaluate(() => { D().fissi = {}; changed(); cur = '2026-12'; rieMode = 'anno'; tab = 'rie'; render(); vaiA('dsp'); });
    await expect(page.locator('#rieFixVuoto')).toHaveText('Nessuna uscita fissa nel 2026. Le aggiungi da Nuova attività o da Impostazioni → Uscite fisse.');
    expect(errori).toEqual([]);
  });
});

// ---------- D-160: cosa fare del file della banca dopo «Importa» ----------
const RIGHE = [B.carta('02/11/2026', -6, 'BAR ESEMPIO', '03/11/2026'), B.bonEnt('05/11/2026', 50, 'NOME INVENTATO', 'RESTITUZIONE ESEMPIO'), B.carta('11/11/2026', -9, 'NEGOZIO ESEMPIO', '12/11/2026')];
const CSV = B.lista(RIGHE);
const conDrive = async (browser, drive = new DriveFinto(), contesto) => {
  const d = await nuovoDispositivo(browser, { drive, ora: '2026-11-20T10:00:00+01:00', telefono: true, contesto });
  await d.page.waitForFunction(() => window.Banca && window.EntrateExtra && Archivio.avviata);
  await accedi(d.page); await d.page.evaluate(() => { DB.meta.skipWelcome = true; changed(); render(); });
  return { ...d, drive };
};
async function importaFile(page, f = B.file(CSV)) {
  await page.evaluate(() => vaiA('dsp'));
  await page.setInputFiles('#bcFile', f);
  await expect(page.locator('#bcModal')).toBeVisible();
  await page.click('#bcImporta');
  await expect(page.locator('#bcTit')).toHaveText('Movimenti importati');
}
const archiviati = drive => Object.values(drive.file).filter(f => f.appProperties && f.appProperties.soldirini === 'banca');
const cartelle = drive => Object.values(drive.file).filter(f => f.name === 'Movimenti banca');

test.describe('24c.17 · D-160 file della banca dopo «Importa»', () => {
  test('con Drive: domanda nella stessa finestra, riquadro senza «Controlla»; «Archivia su Drive» copia il file così com’è in Soldirini/Movimenti banca, con un nome senza dati; un solo caricamento; dopo, «Controlla»', async ({ browser }) => {
    const { page, errori, drive, ctx } = await conDrive(browser);
    let toast = 0; await page.exposeFunction('__toast', () => toast++);
    await page.evaluate(() => { const t = window.toast; window.toast = (...a) => { __toast(); return t(...a); }; });
    await importaFile(page);
    expect(toast).toBe(0); // niente toast: il messaggio è in cima alla finestra
    await expect(page.locator('#bcSub')).toHaveText('Lista movimenti ING · dal 03/11/2026 al 12/11/2026');
    await expect(page.locator('#bcDopo .bcfatti')).toHaveText('✓ Importati 3 movimenti: 2 spese, 1 entrata da confermare.');
    await expect(page.locator('#bcDopo .dcnote')).toHaveText('Nella lista c’è 1 entrata da confermare. Finché non scegli cos’è, non conta nei soldi. «Controlla» compare dopo la domanda qui sotto.');
    await expect(page.locator('#bcDopo [data-bccontrolla]')).toHaveCount(0);
    await expect(page.locator('#bcDopo .bcdom')).toHaveText('E il file della banca?');
    await expect(page.locator('#bcArch')).toHaveText('Archivia su DriveUna copia va nella cartella «Soldirini/Movimenti banca» del tuo Google Drive. Soldirini non la rilegge.');
    await expect(page.locator('#bcNoCons')).toHaveText('Non conservarloSoldirini non tiene nessuna copia.');
    await expect(page.locator('#bcDopo .bcsolo')).toHaveText('Si sceglie solo adesso: chiudendo la finestra, Soldirini non tiene il file.');
    for (const id of ['#bcList', '#bcTot', '#bcAnn', '#bcImporta', '#bcPrima']) await expect(page.locator(id)).toBeHidden();
    await expect(page.locator('#bcFatto')).toBeVisible();
    // mentre copia: «Archivio su Drive…», le due righe ferme; un secondo tocco non carica di nuovo
    const prima = drive.registro.length;
    drive.ritardo = v => v === 'POST /upload/drive/v3/files' ? 1500 : 0;
    await page.click('#bcArch');
    await expect(page.locator('#bcArch')).toContainText('Archivio su Drive…');
    await expect(page.locator('#bcArch')).toBeDisabled(); await expect(page.locator('#bcNoCons')).toBeDisabled();
    await page.evaluate(() => $('bcArch').click());
    await expect(page.locator('#bcDopo .bcesito')).toHaveText('✓ File archiviato su Drive, nella cartella «Soldirini/Movimenti banca».');
    expect(drive.registro.slice(prima).filter(v => v === 'POST /upload/drive/v3/files')).toHaveLength(1); drive.ritardo = null;
    // niente passi dopo «Archivia» finché l'utente non risponde alla domanda 93
    await expect(page.locator('#bcDopo .passi')).toHaveCount(0);
    // il file su Drive: stessi byte, testo CSV (niente Foglio Google), nome solo con banca e date, proprietà solo soldirini:'banca'
    const A = archiviati(drive); expect(A).toHaveLength(1);
    expect(A[0].name).toBe('Movimenti ING 2026-11-03 – 2026-11-12.csv');
    expect(A[0].mimeType).toBe('text/csv');
    expect(A[0].appProperties).toEqual({ soldirini: 'banca' });
    expect(Buffer.compare(Buffer.from(A[0].corpo), Buffer.from(CSV, 'utf8'))).toBe(0);
    const C = cartelle(drive); expect(C).toHaveLength(1);
    expect(C[0].parents).toEqual([await page.evaluate(() => D().root.id)]);
    expect(C[0].appProperties).toEqual({ soldirini: 'movimenti-banca' });
    expect(A[0].parents).toEqual([C[0].id]);
    // nei dati niente del file (né il suo id): solo l'id della cartella, sul telefono
    expect(await page.evaluate(() => JSON.stringify(D()))).not.toMatch(/Movimenti ING|IT00X|movimenti-banca/);
    expect(await page.evaluate(() => DB.meta.bancaDir)).toBe(C[0].id);
    // dopo la scelta compare «Controlla»: chiude la finestra e apre l'elenco delle entrate da confermare
    await page.click('#bcDopo [data-bccontrolla]');
    await expect(page.locator('#bcModal')).toBeHidden();
    await expect(page.locator('#v-dinc')).toBeVisible();
    // seconda lista: stessa cartella, nessuna cartella nuova; anche da un altro telefono che non conosce la cartella
    const L2 = B.lista([B.carta('19/11/2026', -4, 'BAR ESEMPIO', '20/11/2026')]);
    await importaFile(page, B.file(L2)); await page.click('#bcArch'); await expect(page.locator('#bcDopo .bcesito')).toBeVisible(); await page.click('#bcFatto');
    await sincronizza(page);
    const T2 = await nuovoDispositivo(browser, { drive, ora: '2026-11-21T10:00:00+01:00', telefono: true });
    await T2.page.waitForFunction(() => window.Banca && Archivio.avviata); await accediEsistente(T2.page);
    await T2.page.evaluate(() => { DB.meta.skipWelcome = true; changed(); render(); });
    await importaFile(T2.page, B.file(B.lista([B.carta('21/11/2026', -3, 'EDICOLA ESEMPIO', '21/11/2026')])));
    await T2.page.click('#bcArch'); await expect(T2.page.locator('#bcDopo .bcesito')).toBeVisible();
    expect(cartelle(drive)).toHaveLength(1); expect(archiviati(drive)).toHaveLength(3);
    expect(errori).toEqual([]); expect(T2.errori).toEqual([]);
  });

  test('errori di «Archivia su Drive» (aggiunta 20): generico, accesso scaduto, Drive pieno; le righe restano toccabili, niente nuovo tentativo automatico; «Non conservarlo» con i passi, Android prima', async ({ browser }) => {
    const { page, errori, drive } = await conDrive(browser);
    await importaFile(page);
    const up = () => drive.registro.filter(v => v === 'POST /upload/drive/v3/files').length;
    const u0 = up();
    const err = page.locator('#bcDopo .bcarcerr');
    drive.guasto = v => v === 'POST /upload/drive/v3/files' ? 500 : 0;
    await page.click('#bcArch');
    await expect(err).toHaveText('Soldirini non è riuscita a copiare il file su Google Drive. Controlla la connessione e riprova, oppure scegli «Non conservarlo».');
    await expect(err).toHaveAttribute('role', 'alert');
    await page.waitForTimeout(1500); expect(up()).toBe(u0 + 1); // nessun nuovo tentativo da solo
    drive.guasto = v => v === 'POST /upload/drive/v3/files' ? { status: 403, reason: 'storageQuotaExceeded', message: 'The user’s Drive storage quota has been exceeded.' } : 0;
    await page.click('#bcArch');
    await expect(err).toHaveText('Soldirini non è riuscita a copiare il file su Google Drive: nel tuo Drive non c’è più spazio. Puoi liberarne un po’ e toccare di nuovo «Archivia su Drive», oppure scegliere «Non conservarlo».');
    drive.guasto = v => v === 'POST /upload/drive/v3/files' ? 401 : 0;
    await page.click('#bcArch');
    await expect(err).toHaveText('Soldirini non è riuscita a copiare il file su Google Drive: l’accesso a Google è scaduto. Tocca di nuovo «Archivia su Drive» per accedere, oppure scegli «Non conservarlo».');
    expect(archiviati(drive)).toHaveLength(0);
    // senza connessione: stesso messaggio generico, nessuna richiesta
    await page.context().setOffline(true); drive.guasto = null; const u1 = up();
    await page.click('#bcArch');
    await expect(err).toHaveText(/Controlla la connessione e riprova/);
    expect(up()).toBe(u1);
    await page.context().setOffline(false);
    // «Non conservarlo»: il file non va da nessuna parte; passi Android prima di iPhone
    await page.click('#bcNoCons');
    await expect(page.locator('#bcDopo .bcesito')).toHaveText('✓ Soldirini non ha tenuto il file.');
    await expect(page.locator('#bcDopo')).toContainText('Il file che hai scaricato è ancora nel telefono. Soldirini non può cancellarlo da sola: se vuoi, toglilo così.');
    await expect(page.locator('#bcDopo .bcpt')).toHaveText(['Android', 'iPhone']);
    await expect(page.locator('#bcDopo .passi').first().locator('li')).toHaveText(['Apri l’app «File» (su Samsung «Archivio» o «I miei file»).', 'Apri «Download».', 'Tieni premuto il file della banca e tocca «Elimina».', 'Se c’è il «Cestino», svuotalo per toglierlo del tutto.']);
    await expect(page.locator('#bcDopo .passi').nth(1).locator('li')).toHaveText(['Apri l’app «File» e tocca «Sfoglia».', 'Apri «Download» (in «iCloud Drive» o «Sul mio iPhone»).', 'Tieni premuto il file della banca e tocca «Elimina».', 'In «Eliminati di recente» toccalo e scegli «Elimina» per toglierlo del tutto.']);
    await expect(page.locator('#bcArch')).toHaveCount(0);
    await page.click('#bcFatto'); await expect(page.locator('#bcModal')).toBeHidden();
    expect(archiviati(drive)).toHaveLength(0);
    // il riquadro delle entrate da confermare resta sotto il pulsante della pagina
    await expect(page.locator('#v-dsp .dcnote [data-dcvai]')).toBeVisible();
    // chiudere con × durante la domanda = non conservarlo: nessun caricamento, niente nella memoria del telefono
    await importaFile(page, B.file(B.lista([B.carta('15/11/2026', -2, 'BAR ESEMPIO', '15/11/2026')])));
    const u2 = up(); await page.click('#bcClose');
    expect(up()).toBe(u2);
    expect(await page.evaluate(() => JSON.stringify(localStorage).includes('BAR ESEMPIO'))).toBe(false);
    expect(errori).toEqual([]);
  });

  test('senza Drive niente domanda, subito i passi; tutto già importato: «Come cancellarlo»; su iPhone prima i passi di iPhone; Excel archiviato come .xlsx', async ({ browser }) => {
    const { page, errori } = await nuovoDispositivo(browser, { drive: new DriveFinto(), ora: '2026-11-20T10:00:00+01:00', telefono: true });
    await page.waitForFunction(() => window.Banca && Archivio.avviata); await page.evaluate(() => { DB.meta.skipWelcome = true; changed(); render(); });
    await importaFile(page);
    await expect(page.locator('#bcArch')).toHaveCount(0);
    await expect(page.locator('#bcDopo .bcfatti')).toHaveText('✓ Importati 3 movimenti: 2 spese, 1 entrata da confermare.');
    await expect(page.locator('#bcDopo')).toContainText('Soldirini non ha tenuto il file. Quello che hai scaricato è ancora nel telefono: se vuoi, toglilo così.');
    await expect(page.locator('#bcDopo [data-bccontrolla]')).toBeVisible(); // senza domanda «Controlla» c'è subito
    await expect(page.locator('#bcDopo .bcpt')).toHaveText(['Android', 'iPhone']);
    await page.click('#bcFatto');
    // stesso file: tutto già importato → riga grigia e «Come cancellarlo», che apre e chiude i passi
    await page.setInputFiles('#bcFile', B.file(CSV));
    await expect(page.locator('#bcList .bcresta')).toHaveText('Il file che hai scaricato è ancora nel telefono. Come cancellarlo');
    const come = page.locator('#bcList [data-bcpassi]');
    await expect(page.locator('#bcList .bcpassi')).toBeHidden();
    await come.click(); await expect(page.locator('#bcList .bcpassi')).toBeVisible(); await expect(come).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#bcList .bcpassi .passi')).toHaveCount(2);
    await page.click('#bcAnn'); await expect(page.locator('#bcModal')).toBeHidden();
    expect(errori).toEqual([]);
    // iPhone: prima i passi di iPhone; Excel archiviato così com'è
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const I = await conDrive(browser, new DriveFinto(), { userAgent: ua });
    const XL = await B.xlsx(I.page, RIGHE);
    await importaFile(I.page, B.xfile(XL));
    await I.page.click('#bcArch'); await expect(I.page.locator('#bcDopo .bcesito')).toBeVisible();
    const A = archiviati(I.drive); expect(A).toHaveLength(1);
    expect(A[0].name).toMatch(/^Movimenti ING 2026-11-0\d – 2026-11-12\.xlsx$/);
    expect(A[0].mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(Buffer.compare(Buffer.from(A[0].corpo), XL)).toBe(0);
    await I.page.click('#bcFatto');
    await I.page.setInputFiles('#bcFile', B.xfile(XL));
    await I.page.click('#bcList [data-bcpassi]');
    await expect(I.page.locator('#bcList .bcpt')).toHaveText(['iPhone', 'Android']);
    expect(I.errori).toEqual([]);
  });

  test('pagina Licenze: pdf-lib 1.17.1; informativa del file della banca e della cancellazione di un mese (03)', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    const lic = await page.evaluate(async () => (await fetch('licenze/index.html')).text());
    expect(lic).toContain('<b>pdf-lib 1.17.1</b>');
    const pr = await page.evaluate(async () => (await fetch('privacy.html')).text());
    expect(pr).toContain('(versione 24c.17)');
    expect(pr).not.toContain('Il file non viene caricato su Google Drive, né altrove, e non viene conservato.');
    expect(pr).toContain('Con «Archivia su Drive» l’app mette una copia del file, così com’è, nella cartella “Soldirini/Movimenti banca” del <b>tuo</b> Google Drive.');
    expect(pr).toContain('e la cartella “Movimenti banca” se hai archiviato le liste della banca');
    expect(pr).toContain('Per togliere solo un mese: Impostazioni → Copia di sicurezza → «Elimina i dati di un mese…».');
    expect(errori).toEqual([]);
  });
});

// ---------- D-156 e D-164: «Elimina i dati di un mese» ----------
// Dati inventati come nel libro di 04 (tornata 52): Affitto 500 € dal 2026-08, stipendio 1.400 € entrato il 10 del mese dopo,
// spese 300/400/450/350 da agosto a novembre.
const datiEM = page => page.evaluate(() => {
  const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Ditta Esempio'; l.dal = '2026-01-01'; D().lavori = { [l.id]: l };
  const f = uid(); D().fissi = { [f]: { id: f, cat: 'casa', nome: 'Affitto', importo: '500', giorno: '3', dal: '2026-08', al: '', rate: '', nota: '', updatedAt: 1 } };
  D().entrate = {}; D().spesePers = {}; D().buste = {}; // buste: la crea comunque una lettura a tempo di entrate.js (forseChiedi)
  [['2026-07', '2026-08-10'], ['2026-08', '2026-09-10'], ['2026-09', '2026-10-10'], ['2026-10', '2026-11-10']].forEach(([m, d]) => { D().entrate[`lav|${l.id}|${m}`] = { entrato: true, data: d, importo: 1400, updatedAt: 1 }; });
  [['2026-08-12', 300], ['2026-09-12', 400], ['2026-10-12', 450], ['2026-11-12', 350]].forEach(([d, v], i) => { const id = 's' + i; D().spesePers[id] = { id, data: d, cat: 'spesa', importo: v, nota: 'Spesa inventata', created: i, updatedAt: 1 }; });
  changed(); render(); return l.id; });
// 24c.18: chiavi dei dati diverse da `prima` (testo di JSON.stringify(D())), con il valore prima → dopo, così un fallimento si
// capisce dal log. Una raccolta vuota che un lettore dell'app crea da sola (BUS() crea buste:{} quando la lettura a tempo di
// entrate.js, 800 ms dopo l'avvio, passa dalle buste) non è un cambiamento dei dati: è la causa del fallimento su GitHub Actions
// della run 45900090003 (riprodotto con trattieni:true). L'ordine delle chiavi in cima non conta; dentro ogni raccolta sì.
const diversiDa = (page, prima) => page.evaluate(prima => { const a = JSON.parse(prima), b = D();
  const vuota = x => x === undefined || (x !== null && typeof x === 'object' && !Array.isArray(x) && !Object.keys(x).length);
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => !(vuota(a[k]) && vuota(b[k])) && JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .map(k => `${k}: ${String(JSON.stringify(a[k])).slice(0, 400)} → ${String(JSON.stringify(b[k])).slice(0, 400)}`); }, prima);
const rim = page => page.evaluate(() => ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12'].map(m => [contiMese(m).rimanenti, rimastiPrima(m)]));
const apriEM = async (page, ym) => { await page.evaluate(ym => { cur = ym; tab = 'pro'; render(); $('emApri').closest('details')?.setAttribute('open', ''); }, ym); await page.click('#emApri'); await expect(page.locator('#emModal')).toBeVisible(); };
const riga = (page, c) => page.locator(`#emBody [data-em="${c}"]`);

test.describe('24c.17 · D-156 «Elimina i dati di un mese»', () => {
  test('finestra (A1-A4): caselle spente con i numeri, «Scegli tutto», riepilogo, avviso, copia prima; «Annulla» non tocca niente; EM1: spese di ottobre → ottobre e «Rimasti» dei mesi dopo +450', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await datiEM(page);
    const r0 = await rim(page);
    expect(r0[2][0]).toBe(450); expect(r0[3][1]).toBe(1550); // ottobre 1.400 − 450 − 500; «Rimasti» di novembre 600 + 500 + 450
    await page.evaluate(() => { tab = 'pro'; render(); $('emApri').closest('details')?.setAttribute('open', ''); });
    await expect(page.locator('#emApri')).toHaveText('Elimina i dati di un mese…');
    await expect(page.locator('#emApri + p')).toHaveText('Per togliere tutto quello che hai segnato in un mese, per esempio un mese importato per errore. Le uscite fisse restano.');
    await page.evaluate(() => { cur = '2026-10'; render(); });
    const prima = await page.evaluate(() => JSON.stringify(D()));
    await apriEM(page, '2026-10');
    await expect(page.locator('#emTit')).toHaveText('Elimina i dati di un mese');
    await expect(page.locator('#emMese')).toHaveValue('2026-10');
    await expect(page.locator('#emMese')).toHaveAttribute('type', 'month');
    await expect(page.locator('#emBody .emtesta p')).toHaveText('Scegli cosa togliere da ottobre 2026:');
    const testi = await page.locator('#emBody .emck').evaluateAll(R => R.map(r => [r.querySelector('.t').textContent, r.querySelector('.n').textContent, r.querySelector('input').checked, r.querySelector('input').disabled]));
    expect(testi).toEqual([['Spese giornaliere', '1', false, false], ['Entrate segnatestipendio o pensione «È entrato» ed entrate extra', '1', false, false],
      ['Turni e assenzeniente in questo mese', '0', false, true], ['Attività dei progettiniente in questo mese', '0', false, true], ['Buste paga e cedolininiente in questo mese', '0', false, true]]);
    await expect(page.locator('#emBody .emfisse')).toHaveText('Le uscite fisse non si cancellano da qui: usa «Termina». La CU, i risparmi e i fondi restano, perché non sono di un mese.');
    await expect(page.locator('#emCont')).toBeDisabled();
    await page.click('#emTutto'); await expect(page.locator('#emFoot .emriep')).toHaveText('Scelte: 2 voci'); await expect(page.locator('#emTutto')).toHaveText('Togli tutto');
    await page.click('#emTutto'); await expect(page.locator('#emCont')).toBeDisabled();
    await riga(page, 'sp').check(); await expect(page.locator('#emFoot .emriep')).toHaveText('Scelte: 1 voce');
    await page.click('#emCont');
    await expect(page.locator('#emTit')).toHaveText('Eliminare 1 voce di ottobre 2026?');
    await expect(page.locator('#emBody > p').first()).toHaveText('Spariscono 1 voce di ottobre 2026: 1 spesa.');
    await expect(page.locator('#emBody .vcavv')).toHaveText('⚠ Anche altri conti possono cambiare.Tasse, CU e «Rimasti dai mesi prima» dei mesi dopo si ricalcolano senza queste voci.');
    await expect(page.locator('#emBody .emcopia')).toContainText('Nessuna copia salvata finora. Prima di eliminare, salvane una.');
    await expect(page.locator('#emVia')).toHaveText('Elimina 1 voce di ottobre 2026'); await expect(page.locator('#emVia')).toBeDisabled();
    // «‹ Cambia la scelta» torna al passo 1 con le caselle come erano; «Annulla» chiude senza cambiare niente
    await page.click('#emCambia'); await expect(riga(page, 'sp')).toBeChecked();
    await page.click('#emCont'); await page.click('#emAnn'); await expect(page.locator('#emModal')).toBeHidden();
    expect(await diversiDa(page, prima)).toEqual([]);
    // anche con × e con il mese cambiato
    await apriEM(page, '2026-10'); await page.locator('#emMese').fill('2026-09'); await page.click('#emClose');
    expect(await diversiDa(page, prima)).toEqual([]);
    // EM1
    await apriEM(page, '2026-10'); await riga(page, 'sp').check(); await page.click('#emCont');
    await page.locator('#emSenza').check(); await expect(page.locator('#emVia')).toBeEnabled();
    await page.click('#emVia');
    await expect(page.locator('#emModal')).toBeHidden();
    await expect(page.locator('#toast')).toHaveText('✓ Eliminata 1 voce di ottobre 2026.');
    const r1 = await rim(page);
    expect(r1[2][0]).toBe(900); expect(r1[3][1]).toBe(2000); expect(r1[4][1]).toBe(r0[4][1] + 450);
    expect([r1[0], r1[1], r1[3][0]]).toEqual([r0[0], r0[1], r0[3][0]]); // mesi vicini e uscite fisse invariati
    // della spesa resta solo il segno, senza importo e nota (domanda 90 A)
    expect(await page.evaluate(() => D().spesePers.s2)).toEqual({ id: 's2', data: '2026-10-12', deleted: true, updatedAt: expect.any(Number) });
    expect(await page.evaluate(() => Object.keys(D().fissi).length)).toBe(1);
    expect(errori).toEqual([]);
  });

  test('tutto novembre con Drive: secondo telefono, un solo invio, la copia di Drive non rimette le voci, «Unisci» con una copia vecchia nemmeno; reimportando la lista i movimenti tornano una volta; PDF nel cestino di Drive (D-164); attività nel Cestino', async ({ browser }) => {
    const drive = new DriveFinto();
    const A = await conDrive(browser, drive); const page = A.page;
    const lid = await page.evaluate(() => { const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Ditta Esempio'; l.dal = '2026-01-01'; D().lavori = { [l.id]: l }; changed(); return l.id; });
    await importaFile(page); await page.click('#bcNoCons'); await page.click('#bcFatto'); // 2 spese della banca (con l'impronta) e 1 entrata da confermare
    const pdf = await page.evaluate(() => 'f' + Date.now());
    await page.evaluate(({ lid, pdf }) => {
      const now = Date.now();
      D().spesePers.m1 = { id: 'm1', data: '2026-11-15', cat: 'spesa', importo: 20, nota: 'Spesa inventata', created: 1, updatedAt: now };
      D().spesePers.o1 = { id: 'o1', data: '2026-10-15', cat: 'spesa', importo: 30, nota: 'Ottobre inventato', created: 1, updatedAt: now };
      D().entrate[`lav|${lid}|2026-10`] = { entrato: true, data: '2026-11-09', importo: 1400, updatedAt: now };
      D().entrateExtra = { x1: { id: 'x1', data: '2026-11-03', importo: 25, tipo: 'regalo', nota: 'Regalo inventato', created: 1, updatedAt: now } };
      D().turni = { t1: { id: 't1', lid, data: '2026-11-04', tipo: null, da: '08:00', a: '12:00', pausa: '', ore: '', nota: 'nota', updatedAt: now } };
      const p = nuovoProgetto(); p.nome = 'Squadra Esempio'; const q = nuovoProgetto(); q.nome = 'Corso Esempio'; D().progetti = { [p.id]: p, [q.id]: q };
      D().eventi = { e1: { id: 'e1', pid: p.id, data: '2026-11-05', tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '80', rimborso: false, spese: [], created: 1, updatedAt: now },
        e2: { id: 'e2', pid: q.id, data: '2026-11-06', tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '60', rimborso: false, spese: [], created: 1, updatedAt: now } };
      D().pagamenti = { [`${q.id}|2026-11|o`]: { pagato: true, data: '2026-11-18', importo: 60, updatedAt: now } };
      D().buste = { [`${lid}|2026-11`]: { lid, mese: '2026-11', netto: '1400', lordo: '1900', file: { id: pdf, link: '', name: 'Busta paga novembre 2026.pdf' }, deleted: false, updatedAt: now } };
      changed(); render(); }, { lid, pdf });
    drive.file[pdf] = { id: pdf, name: 'Busta paga novembre 2026.pdf', parents: ['x'], mimeType: 'application/pdf', mt: Date.now(), corpo: '' };
    await sincronizza(page);
    const copiaVecchia = Buffer.from(await page.evaluate(async () => [...await Copia.crea(null)]));
    const B2 = await nuovoDispositivo(browser, { drive, ora: '2026-11-20T11:00:00+01:00', telefono: true });
    await B2.page.waitForFunction(() => window.EliminaMese && Archivio.avviata); await accediEsistente(B2.page);
    expect(await B2.page.evaluate(() => contiMese('2026-11').rimanenti)).toBe(await page.evaluate(() => contiMese('2026-11').rimanenti));
    const vicini = () => page.evaluate(() => ['2026-10', '2026-12'].map(m => contiMese(m)));
    const v0 = await vicini();
    await apriEM(page, '2026-11');
    await expect(riga(page, 'sp').locator('xpath=..')).toContainText('comprese 2 importate dalla banca');
    await expect(riga(page, 'inc').locator('xpath=..')).toContainText('Anche l’attività già incassataconta nelle tasse 20261');
    await page.click('#emTutto');
    await expect(riga(page, 'inc')).not.toBeChecked(); // «Scegli tutto» lascia fuori le attività già incassate (domanda 89 A)
    await expect(page.locator('#emFoot .emriep')).toHaveText('Scelte: 8 voci'); // 3 spese, 2 entrate, 1 turno, 1 attività, 1 busta
    await page.click('#emCont');
    await expect(page.locator('#emBody > p').first()).toHaveText('Spariscono 8 voci di novembre 2026: 3 spese, 2 entrate, 1 turno, 1 attività, 1 busta paga.');
    await expect(page.locator('#emBody')).toContainText('Spariscono anche dagli altri telefoni collegati e da Google Drive.');
    await expect(page.locator('#emBody .emimp')).toHaveCount(0); // le spese importate dalla 24c.17 hanno l'impronta
    await expect(page.locator('#emBody .empdf legend')).toHaveText('Il PDF della busta di novembre 2026 su Google Drive?');
    await expect(page.locator('#emBody [name=emPdf][value=lascia]')).toBeChecked();
    await page.locator('#emBody [name=emPdf][value=cestino]').check();
    await page.locator('#emSenza').check();
    const idDati = drive.fileDati()[0].id, reg0 = drive.registro.length;
    await page.click('#emVia');
    await expect(page.locator('#toast')).toHaveText('✓ Eliminate 8 voci di novembre 2026. 1 PDF è nel cestino di Drive.');
    expect(drive.file[pdf].trashed).toBe(true);
    await sincronizza(page);
    // un solo invio del file dei dati per la cancellazione; dopo, i fogli dei progetti riscritti (markExport) ne fanno uno loro
    const dopo = drive.registro.slice(reg0), fogli = dopo.indexOf('POST /upload/drive/v3/files');
    expect((fogli < 0 ? dopo : dopo.slice(0, fogli)).filter(v => v === 'PATCH /upload/drive/v3/files/' + idDati)).toHaveLength(1);
    // segni di cancellazione su Drive: niente importi, note o nomi; entrate e pagamenti con entrato/pagato false (03, C1)
    const J = drive.datiJson();
    expect(J.entrate[`lav|${lid}|2026-10`]).toEqual({ entrato: false, deleted: true, updatedAt: expect.any(Number) });
    expect(J.entrateExtra.x1).toEqual({ id: 'x1', data: '2026-11-03', deleted: true, updatedAt: expect.any(Number) });
    expect(J.turni.t1).toEqual({ id: 't1', lid, data: '2026-11-04', deleted: true, updatedAt: expect.any(Number) });
    expect(J.buste[`${lid}|2026-11`]).toEqual({ lid, mese: '2026-11', deleted: true, updatedAt: expect.any(Number) });
    expect(Object.values(J.spesePers).filter(s => s.deleted).every(s => !('importo' in s) && !('nota' in s))).toBe(true);
    expect(J.spesePers.o1.deleted).toBeUndefined(); // ottobre resta
    expect(J.eventi.e1).toMatchObject({ deleted: true, deletedAt: expect.any(Number) }); expect(J.eventi.e2.deleted).toBeUndefined();
    expect(Object.values(J.pagamenti)).toEqual([{ pagato: true, data: '2026-11-18', importo: 60, updatedAt: expect.any(Number) }]); // l'attività incassata e il suo pagamento restano
    // l'entrata da confermare (non è tra le voci del mese) e la sua impronta restano
    expect(Object.values(J.daConfermare).filter(x => !x.deleted)).toHaveLength(1);
    // attività nel Cestino, come le cancellazioni una per una (domanda 91 A)
    await page.evaluate(() => { tab = 'pro'; render(); });
    await expect(page.locator('#cestBox')).toContainText('Squadra Esempio');
    // mesi vicini invariati
    expect(await vicini()).toEqual(v0);
    // secondo telefono: riceve la cancellazione; due sincronizzazioni non rimettono niente
    await sincronizza(B2.page); await sincronizza(B2.page);
    expect(await B2.page.evaluate(() => [contiMese('2026-11').rimanenti, Object.values(D().spesePers).filter(s => !s.deleted).length, Entrate.leggi(Object.values(D().entrate)[0])]))
      .toEqual([await page.evaluate(() => contiMese('2026-11').rimanenti), 1, null]);
    await sincronizza(page);
    expect(await page.evaluate(() => Object.values(D().spesePers).filter(s => !s.deleted).map(s => s.id))).toEqual(['o1']);
    // «Unisci» con la copia di prima: le voci non tornano (il segno è più recente)
    await page.evaluate(() => { tab = 'pro'; render(); $('cpBox').closest('details')?.setAttribute('open', ''); document.querySelector('#cpBox [data-cp=riprendi]').click(); });
    await page.setInputFiles('#cpFile', { name: 'c.soldirini', mimeType: 'application/octet-stream', buffer: copiaVecchia });
    await page.click('#cpBody .cpopt[data-modo=unisci]'); await page.click('[data-cp=usa]');
    await expect(page.locator('#toast')).toContainText('✓');
    expect(await page.evaluate(() => Object.values(D().spesePers).filter(s => !s.deleted).map(s => s.id))).toEqual(['o1']);
    // reimportando la stessa lista le due spese si possono importare di nuovo (una volta sola); l'entrata da confermare resta «Già importato»
    await page.evaluate(() => vaiA('dsp'));
    await page.setInputFiles('#bcFile', B.file(CSV));
    const g = await page.locator('#bcList .bcrow').evaluateAll(R => R.map(r => r.classList.contains('gia')));
    expect(g).toEqual([false, true, false]);
    await page.click('#bcImporta'); await page.click('#bcNoCons'); await page.click('#bcFatto');
    expect(await page.evaluate(() => Object.values(D().spesePers).filter(s => !s.deleted && s.origine === 'banca').length)).toBe(2);
    await page.setInputFiles('#bcFile', B.file(CSV));
    expect(await page.locator('#bcList .bcrow.gia').count()).toBe(3);
    await page.click('#bcAnn');
    expect(A.errori).toEqual([]); expect(B2.errori).toEqual([]);
  });

  test('EM9-EM10 (domande 87-88 A), avviso dello stipendio, spese senza impronta, EM7b e attività già incassate (89 A), mese vuoto, errore senza cambiare niente, copia salvata prima', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    const ids = await page.evaluate(() => {
      const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Ditta Esempio'; l.dal = '2026-01-01'; D().lavori = { [l.id]: l }; D().fissi = {};
      // spese della banca della 24c.10/24c.11 (senza meseConto né impronta): 01/11 e 08/11 contano a ottobre per lo stipendio entrato il 09/11
      D().spesePers = { b1: { id: 'b1', data: '2026-11-01', cat: 'bar', importo: 4.5, nota: 'BAR', origine: 'banca', created: 1, updatedAt: 1 },
        b2: { id: 'b2', data: '2026-11-08', cat: 'spesa', importo: 20, nota: 'NEGOZIO', origine: 'banca', created: 2, updatedAt: 1 },
        b3: { id: 'b3', data: '2026-11-12', cat: 'spesa', importo: 30, nota: 'NEGOZIO', origine: 'banca', created: 3, updatedAt: 1 } };
      D().entrate = { [`lav|${l.id}|2026-10`]: { entrato: true, data: '2026-11-09', importo: 1400, updatedAt: 1 } };
      const p = nuovoProgetto(); p.nome = 'Esempio'; D().progetti = { [p.id]: p };
      D().eventi = { e9: { id: 'e9', pid: p.id, data: '2026-09-20', tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '200', rimborso: false, spese: [], created: 1, updatedAt: 1 } };
      D().pagamenti = { [`${p.id}|2026-09|o`]: { pagato: true, data: '2026-10-15', importo: 160, updatedAt: 1 } };
      changed(); render(); return { lid: l.id, pid: p.id }; });
    const spese = m => page.evaluate(m => contiMese(m).spese ?? contiMese(m).sp, m);
    expect(await page.evaluate(() => [meseSpesa(D().spesePers.b1), meseSpesa(D().spesePers.b3)])).toEqual(['2026-10', '2026-11']);
    await apriEM(page, '2026-11');
    await expect(page.locator('#emBody .emck .n')).toHaveText(['1', '1', '0', '0', '0']); // novembre: solo la spesa del 12/11 e lo stipendio entrato il 09/11
    // solo le entrate: seconda riga dell'avviso
    await riga(page, 'en').check(); await page.click('#emCont');
    await expect(page.locator('#emBody .vcavv')).toContainText('Togli lo stipendio di ottobre segnato entrato: le spese importate dalla banca prima del suo arrivo tornano a contare nel mese della loro data.');
    await page.click('#emCambia'); await riga(page, 'sp').check(); await page.click('#emCont');
    await expect(page.locator('#emBody .vcavv')).not.toContainText('Togli lo stipendio');
    await expect(page.locator('#emBody .emimp')).toHaveText('1 spesa importata dalla banca resta «Già importato»: se reimporti la lista, aggiungila a mano.');
    // errore (dati che non si possono scrivere): il messaggio e nessun cambiamento
    const prima = await page.evaluate(() => JSON.stringify(D()));
    await page.evaluate(() => Object.freeze(D().entrate));
    await page.locator('#emSenza').check(); await page.click('#emVia');
    await expect(page.locator('#emBody .err')).toHaveText('Soldirini non è riuscita a eliminare le voci, quindi non ha cambiato niente. Riprova.');
    await expect(page.locator('#emModal')).toBeVisible();
    expect(await diversiDa(page, prima)).toEqual([]);
    await page.evaluate(() => { D().entrate = { ...D().entrate }; });
    // copia salvata dalla finestra stessa (senza password): «✓ Copia salvata oggi.» e il pulsante rosso si accende
    await page.locator('#emSenza').uncheck(); await expect(page.locator('#emVia')).toBeDisabled();
    await page.evaluate(() => { DB.meta.copia = { password: false }; });
    const [dl] = await Promise.all([page.waitForEvent('download'), (async () => { await page.click('#emCopia'); await page.click('[data-cp=salvano]'); })()]);
    expect(dl.suggestedFilename()).toBe('soldirini-copia-2026-12-20.soldirini');
    await expect(page.locator('#emBody .emok')).toHaveText('✓ Copia salvata oggi.');
    await expect(page.locator('#emBody .emcopia')).toHaveCount(0);
    await page.click('#emVia');
    await expect(page.locator('#toast')).toHaveText('✓ Eliminate 2 voci di novembre 2026.');
    // EM10 (88 A): le due spese di ottobre tornano a novembre e restano
    expect(await page.evaluate(() => Object.values(D().spesePers).filter(s => !s.deleted).map(s => [s.id, meseSpesa(s)]))).toEqual([['b1', '2026-11'], ['b2', '2026-11']]);
    expect(await page.evaluate(() => Entrate.leggi(Object.values(D().entrate)[0]))).toBe(null); // lo stipendio torna «in arrivo»
    // mese vuoto (A3)
    await apriEM(page, '2026-11'); await page.locator('#emMese').fill('2025-03');
    await expect(page.locator('#emBody .emvuoto')).toHaveText('In marzo 2025 non c\'è niente da eliminare.');
    await expect(page.locator('#emAnn')).toHaveText('Chiudi'); await expect(page.locator('#emCont')).toBeDisabled();
    // EM7b e 89 A: settembre ha solo un'attività già incassata → riga a parte, spenta
    await page.locator('#emMese').fill('2026-09');
    await expect(riga(page, 'at')).toBeDisabled();
    await expect(riga(page, 'inc')).not.toBeChecked();
    const t0 = await page.evaluate(() => JSON.stringify(stimaTasse('2026')));
    await riga(page, 'inc').check(); await page.click('#emCont');
    await expect(page.locator('#emBody > p').first()).toHaveText('Spariscono 1 voce di settembre 2026: 1 attività.');
    await page.click('#emVia'); await expect(page.locator('#toast')).toHaveText('✓ Eliminata 1 voce di settembre 2026.');
    expect(await page.evaluate(pid => pagamenti()[`${pid}|2026-09|o`], ids.pid)).toEqual({ pagato: false, deleted: true, updatedAt: expect.any(Number) });
    expect(await page.evaluate(() => JSON.stringify(stimaTasse('2026')))).not.toBe(t0); // le tasse si ricalcolano senza l'attività (avviso)
    // una nuova attività dello stesso mese e progetto è da incassare (il vecchio pagamento non torna valido)
    expect(await page.evaluate(pid => { D().eventi.e10 = { id: 'e10', pid, data: '2026-09-21', tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '50', rimborso: false, spese: [], created: 2, updatedAt: Date.now() }; changed();
      return [pagOk(pagamenti()[`${pid}|2026-09|o`]), meseIncasso(pid, '2026-09', 'o')]; }, ids.pid)).toEqual([false, '2026-09']);
    expect(errori).toEqual([]);
  });

  test('24c.18 · il timer di entrate.js che parte durante «Elimina» (come su GitHub Actions) non fa sembrare cambiati i dati; il ripristino rimette ogni voce; una differenza vera si vede chiave per chiave', async ({ browser }) => {
    const { page, errori } = await telefono(browser, undefined, { trattieni: true });
    await page.evaluate(() => {
      const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Ditta Esempio'; l.dal = '2026-01-01'; D().lavori = { [l.id]: l };
      D().spesePers = { s1: { id: 's1', data: '2026-11-12', cat: 'spesa', importo: 30, nota: 'Spesa inventata', origine: 'banca', impronta: 'a'.repeat(64), created: 1, updatedAt: 1 } };
      D().bancaImpronte = { ['a'.repeat(64)]: { updatedAt: 1 } };
      D().turni = { t1: { id: 't1', lid: l.id, data: '2026-11-04', tipo: null, da: '08:00', a: '12:00', pausa: '', ore: '', nota: 'nota', updatedAt: 1 } };
      D().entrate = { [`lav|${l.id}|2026-10`]: { entrato: true, data: '2026-11-09', importo: 1400, updatedAt: 1 } };
      delete D().buste; changed(); render(); });
    await apriEM(page, '2026-11'); await page.click('#emTutto'); await page.click('#emCont');
    const prima = await page.evaluate(() => JSON.stringify(D()));
    expect(JSON.parse(prima).buste).toBeUndefined();
    // il timer parte adesso, tra la fotografia dei dati e il controllo: crea solo buste:{}
    await page.evaluate(() => window.__partiTimer());
    expect(await page.evaluate(() => D().buste)).toEqual({});
    // spese, impronta e turni si scrivono prima delle entrate bloccate: il ripristino deve rimetterli tutti
    await page.evaluate(() => Object.freeze(D().entrate));
    await page.locator('#emSenza').check(); await page.click('#emVia');
    await expect(page.locator('#emBody .err')).toHaveText('Soldirini non è riuscita a eliminare le voci, quindi non ha cambiato niente. Riprova.');
    expect(await diversiDa(page, prima)).toEqual([]);
    expect(await page.evaluate(() => [D().spesePers.s1.importo, D().bancaImpronte['a'.repeat(64)], D().turni.t1.nota])).toEqual([30, { updatedAt: 1 }, 'nota']);
    // una differenza vera si vede: chiave, prima e dopo
    await page.evaluate(() => { D().turni.t1.nota = 'cambiata'; });
    expect(await diversiDa(page, prima)).toEqual([expect.stringMatching(/^turni: .*"nota":"nota".* → .*"nota":"cambiata"/)]);
    expect(errori).toEqual([]);
  });
});
