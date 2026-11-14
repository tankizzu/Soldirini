// Sincronizzazione con Drive (finto): casi 5a, 5b, 5c del report 01 e Drive che non risponde.
// "Più dispositivi" = la STESSA persona con telefono e tablet, stesso account, stesso file nel proprio Drive.
const { test, expect } = require('@playwright/test');
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

test('5a · telefono e tablet sincronizzano insieme: nessuna modifica va persa dopo il giro successivo', async ({ browser }) => {
  const drive = new DriveFinto();
  const A = await nuovoDispositivo(browser, { drive });
  await accedi(A.page);
  const B = await nuovoDispositivo(browser, { drive });
  await accediEsistente(B.page);
  await aggiungiSpesa(A.page, 'dal telefono');
  await aggiungiSpesa(B.page, 'dal tablet');
  await Promise.all([sincronizza(A.page), sincronizza(B.page)]);
  await aspettaSync(A.page); await aspettaSync(B.page);
  // limite noto (v21): subito dopo, una delle due può mancare su Drive; al giro successivo tornano entrambe
  await sincronizza(A.page); await aspettaSync(A.page);
  await sincronizza(B.page); await aspettaSync(B.page);
  expect(noteSuDrive(drive)).toEqual(['dal tablet', 'dal telefono']);
  expect(A.errori.concat(B.errori)).toEqual([]);
});

test('5c · due file dati su Drive: si usa il più recente (comportamento attuale, da rivedere in v21)', async ({ browser }) => {
  const drive = new DriveFinto();
  const A = await nuovoDispositivo(browser, { drive });
  await accedi(A.page);
  await aggiungiSpesa(A.page, 'nel file vecchio'); await sincronizza(A.page); await aspettaSync(A.page);
  await A.ctx.close(); // il telefono A non deve più scrivere: il test riguarda solo cosa sceglie B
  const vecchio = drive.fileDati()[0];
  const nuovo = { ...vecchio, id: drive.nuovoId(), corpo: JSON.stringify({ ...JSON.parse(vecchio.corpo), spesePers: {} }), mt: Date.now() + 60000 };
  drive.file[nuovo.id] = nuovo;
  const B = await nuovoDispositivo(browser, { drive });
  await accediEsistente(B.page);
  expect(await B.page.evaluate(() => DB.meta.dataId)).toBe(nuovo.id);
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

test('la scritta "Sincronizzato" non compare prima della prima sincronizzazione (v20b)', async ({ browser }) => {
  const drive = new DriveFinto();
  const { page } = await nuovoDispositivo(browser, { drive });
  await page.click('#loginW');
  await page.waitForSelector('#setup:not([hidden])');
  expect(drive.fileDati()).toHaveLength(0);
  expect(await testoSync(page)).toBe('Da sincronizzare');
  await page.click('#setupMy');
  await aspettaSync(page);
  expect(drive.fileDati()).toHaveLength(1);
});
