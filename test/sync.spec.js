// Sincronizzazione con Drive (finto): casi 5a, 5b, 5c del report 01 e Drive che non risponde.
// "Più dispositivi" = la STESSA persona con telefono e tablet, stesso account, stesso file nel proprio Drive.
const { test, expect } = require('./helpers/prova');
const { DriveFinto, nuovoDispositivo, accedi, accediEsistente, aspettaSync, testoSync, sincronizza } = require('./helpers/app');

const aggiungiSpesa = (page, nota) => page.evaluate(n => {
  const id = uid(); (D().spesePers || (D().spesePers = {}))[id] = { id, data: '2026-11-03', cat: 'altro', importo: '1', nota: n, created: Date.now(), updatedAt: Date.now() };
  changed();
}, nota);
const noteSuDrive = drive => Object.values(drive.datiJson().spesePers || {}).map(s => s.nota).sort();

test('5b · file dati illeggibile: non viene sovrascritto e l\'utente viene avvisato', async ({ browser }) => {
  const drive = new DriveFinto();
  const { page, errori } = await nuovoDispositivo(browser, { drive });
  await accedi(page);
  const f = drive.fileDati()[0];
  for (const rovinato of ['{"progetti": {"a"', '', 'null', '[1,2]']) {
    f.corpo = rovinato;
    await aggiungiSpesa(page, 'spesa locale');
    await sincronizza(page);
    await expect.poll(() => testoSync(page)).toMatch(/non si legge/i);
    expect(f.corpo, `il file "${rovinato}" non deve essere toccato`).toBe(rovinato);
    expect(await page.evaluate(() => Object.values(D().spesePers).some(s => s.nota === 'spesa locale')), 'i dati restano sul telefono').toBe(true);
  }
  // quando il file torna leggibile (es. versione precedente ripristinata su Drive) la sincronizzazione riparte
  f.corpo = JSON.stringify({ progetti: {}, eventi: {} });
  await sincronizza(page);
  await aspettaSync(page);
  expect(noteSuDrive(drive)).toContain('spesa locale');
  expect(errori).toEqual([]);
});

test('5a · telefono e tablet sincronizzano insieme: subito dopo il giro su Drive ci sono le modifiche di entrambi (v21)', async ({ browser }) => {
  const drive = new DriveFinto();
  const A = await nuovoDispositivo(browser, { drive });
  await accedi(A.page);
  const B = await nuovoDispositivo(browser, { drive });
  await accediEsistente(B.page);
  for (let giro = 1; giro <= 3; giro++) {
    await aggiungiSpesa(A.page, 'dal telefono ' + giro);
    await aggiungiSpesa(B.page, 'dal tablet ' + giro);
    await Promise.all([sincronizza(A.page), sincronizza(B.page)]);
    // se le due scritture erano in viaggio insieme, il controllo fatto poco dopo la scrittura (TEMPI.verifica) rimette tutto insieme
    await expect.poll(() => noteSuDrive(drive), { timeout: 8000, message: `giro ${giro}` }).toEqual(expect.arrayContaining(['dal telefono ' + giro, 'dal tablet ' + giro]));
    await aspettaSync(A.page); await aspettaSync(B.page);
  }
  expect(A.errori.concat(B.errori)).toEqual([]);
});

// Modifica fatta "da un altro dispositivo" direttamente sul Drive finto.
function scritturaEsterna(drive, nota) {
  const f = drive.fileDati()[0]; const d = JSON.parse(f.corpo); d.spesePers = d.spesePers || {};
  d.spesePers['ext' + nota.length] = { id: 'ext' + nota.length, data: '2026-11-04', cat: 'altro', importo: '2', nota, created: 1, updatedAt: Date.now() + 1000 };
  f.corpo = JSON.stringify(d); f.mt = Date.now(); drive.nuovaRevisione(f);
}

test('5a · il file cambia tra la lettura e la scrittura: l\'app rilegge e unisce invece di sovrascrivere (v21)', async ({ browser }) => {
  const drive = new DriveFinto();
  const { page } = await nuovoDispositivo(browser, { drive });
  await accedi(page);
  await aggiungiSpesa(page, 'dal telefono');
  let controlli = 0;
  drive.guasto = (voce, req) => { if (voce.startsWith('GET /drive/v3/files/') && req.url().includes('fields=headRevisionId') && ++controlli === 2) scritturaEsterna(drive, 'dal tablet'); return 0; };
  await sincronizza(page);
  expect(noteSuDrive(drive)).toEqual(['dal tablet', 'dal telefono']);
  expect(await page.evaluate(() => Object.values(D().spesePers).map(s => s.nota).sort())).toEqual(['dal tablet', 'dal telefono']);
});

test('5a · un altro dispositivo scrive subito dopo: l\'app se ne accorge e riscrive con tutto (v21)', async ({ browser }) => {
  const drive = new DriveFinto();
  const { page } = await nuovoDispositivo(browser, { drive });
  await accedi(page);
  await aggiungiSpesa(page, 'dal telefono');
  // la scrittura del tablet arriva subito dopo quella del telefono e la "copre" (non contiene la spesa del telefono)
  drive.dopoScrittura = async f => { const d = JSON.parse(f.corpo); delete d.spesePers; f.corpo = JSON.stringify(d); scritturaEsterna(drive, 'dal tablet'); };
  await sincronizza(page);
  expect(noteSuDrive(drive)).toEqual(['dal tablet', 'dal telefono']);
  await aspettaSync(page);
});

test('5a · la scrittura di un altro dispositivo arriva dopo tutti i controlli: il ricontrollo poco dopo rimette tutto insieme (v21)', async ({ browser }) => {
  const drive = new DriveFinto();
  const { page } = await nuovoDispositivo(browser, { drive });
  await accedi(page);
  await aggiungiSpesa(page, 'dal telefono');
  await sincronizza(page);
  expect(noteSuDrive(drive)).toEqual(['dal telefono']);
  // il tablet scrive mezzo secondo dopo, con dati che non contengono la spesa del telefono
  const f = drive.fileDati()[0]; const d = JSON.parse(f.corpo); delete d.spesePers; f.corpo = JSON.stringify(d); scritturaEsterna(drive, 'dal tablet');
  await expect.poll(() => noteSuDrive(drive), { timeout: 8000 }).toEqual(['dal tablet', 'dal telefono']);
});

test('5c · due file dati su Drive: vengono uniti nel più vecchio, l\'altro è messo da parte e non cancellato (v21)', async ({ browser }) => {
  const drive = new DriveFinto();
  const A = await nuovoDispositivo(browser, { drive });
  await accedi(A.page);
  await aggiungiSpesa(A.page, 'nel primo file'); await sincronizza(A.page); await aspettaSync(A.page);
  const primo = drive.fileDati()[0];
  // secondo file creato più tardi (es. da un altro telefono al primo avvio), con una spesa diversa
  const d = JSON.parse(primo.corpo); d.spesePers = { s2: { id: 's2', data: '2026-11-05', cat: 'bar', importo: '3', nota: 'nel secondo file', created: 1, updatedAt: Date.now() } };
  const secondo = { ...primo, id: drive.nuovoId(), corpo: JSON.stringify(d), mt: Date.now() + 60000, ct: Date.now() + 60000 };
  drive.nuovaRevisione(secondo); drive.file[secondo.id] = secondo;
  // un tablet che conosceva solo il secondo file
  const B = await nuovoDispositivo(browser, { drive });
  await B.page.evaluate(id => { DB.meta.dataId = id; persist(); }, secondo.id);
  await accediEsistente(B.page);
  expect(await B.page.evaluate(() => DB.meta.dataId)).toBe(primo.id);
  expect(drive.fileDati().map(f => f.id)).toEqual([primo.id]);
  expect(noteSuDrive(drive)).toEqual(['nel primo file', 'nel secondo file']);
  expect(drive.file[secondo.id].name).toMatch(/unito, si può eliminare/);
  expect(drive.file[secondo.id].trashed).toBeFalsy();
  // anche il telefono A, alla prossima sincronizzazione, resta sul file principale e riceve la spesa del secondo
  await sincronizza(A.page); await aspettaSync(A.page);
  expect(await A.page.evaluate(() => Object.values(D().spesePers).map(s => s.nota).sort())).toEqual(['nel primo file', 'nel secondo file']);
  expect(A.errori.concat(B.errori)).toEqual([]);
});

test('Drive che non risponde: la sincronizzazione non resta bloccata', async ({ browser }) => {
  const drive = new DriveFinto();
  const { page } = await nuovoDispositivo(browser, { drive });
  await accedi(page);
  await page.evaluate(() => { TEMPI.richiesta = 1500; });
  drive.ritardo = voce => voce.startsWith('GET /drive/v3/files/') ? 60000 : 0;
  await aggiungiSpesa(page, 'in attesa');
  await sincronizza(page);
  await expect.poll(() => testoSync(page), { timeout: 10000 }).toMatch(/non risponde/i);
  expect(await page.evaluate(() => syncing)).toBe(false);
  drive.ritardo = null;
  await sincronizza(page);
  await aspettaSync(page);
  expect(noteSuDrive(drive)).toContain('in attesa');
});

test('scritta in alto prima della prima sincronizzazione: "Scegli la cartella" e "Non ancora su Drive" (v21, D-026)', async ({ browser }) => {
  const drive = new DriveFinto();
  const { page } = await nuovoDispositivo(browser, { drive });
  await page.click('#loginW');
  await page.waitForSelector('#setup:not([hidden])');
  expect(drive.fileDati()).toHaveLength(0);
  expect(await testoSync(page)).toBe('Scegli la cartella');
  expect(await page.getAttribute('#sync', 'class')).toContain('warn');
  // toccandola si torna alla scelta della cartella
  await page.evaluate(() => { showSetup = false; render(); });
  await page.click('#sync');
  await page.waitForSelector('#setup:not([hidden])');
  // cartella scelta ma Drive non raggiungibile: "Non ancora su Drive", in bianco
  drive.guasto = voce => voce.startsWith('POST /upload/') ? 500 : 0;
  await page.click('#setupMy');
  await expect.poll(() => testoSync(page)).toBe('Non ancora su Drive');
  expect(await page.getAttribute('#sync', 'class')).toContain('warn');
  drive.guasto = null;
  await sincronizza(page);
  await aspettaSync(page);
  expect(drive.fileDati()).toHaveLength(1);
});

test('"N da inviare" è bianca: il giallo è solo per ciò che è in corso (v21)', async ({ browser }) => {
  const drive = new DriveFinto();
  const { page } = await nuovoDispositivo(browser, { drive });
  await accedi(page);
  await aggiungiSpesa(page, 'non ancora inviata');
  await page.evaluate(() => { clearTimeout(syncTimer); renderSync(); });
  expect(await testoSync(page)).toMatch(/da inviare/);
  expect(await page.getAttribute('#sync', 'class')).toContain('warn');
  await sincronizza(page);
  await aspettaSync(page);
});
