// Coda dei caricamenti su Drive (cartelle, fogli, PDF, foto): un elemento in errore non deve bloccare gli altri.
const { test, expect } = require('./helpers/prova');
const { DriveFinto, nuovoDispositivo, accedi, aspettaSync, testoSync, sincronizza } = require('./helpers/app');

const cartelle = drive => Object.values(drive.file).filter(f => f.mimeType === 'application/vnd.google-apps.folder').map(f => f.name);

test('un elemento in errore viene saltato, gli altri proseguono, poi viene ritentato', async ({ browser }) => {
  const drive = new DriveFinto();
  const { page, errori } = await nuovoDispositivo(browser, { drive });
  await accedi(page);
  drive.guasto = (voce, req) => voce === 'POST /drive/v3/files' && (req.postData() || '').includes('Progetto B') ? 500 : 0;
  await page.evaluate(() => {
    for (const n of ['Progetto A', 'Progetto B', 'Progetto C']) { const p = nuovoProgetto(); p.nome = n; D().progetti[p.id] = p; DB.meta.queue['folder|' + p.id] = Date.now(); }
    changed();
  });
  await sincronizza(page);
  await expect.poll(() => testoSync(page)).toMatch(/1 elemento in attesa/);
  expect(cartelle(drive)).toEqual(expect.arrayContaining(['Progetto A', 'Progetto C']));
  expect(cartelle(drive)).not.toContain('Progetto B');
  expect(await page.evaluate(() => Object.keys(DB.meta.queue).length)).toBe(1);
  expect(await page.evaluate(() => !!codaTimer), 'è programmato un nuovo tentativo').toBe(true);
  // Drive torna a funzionare e passa il tempo d'attesa: il nuovo tentativo va a buon fine
  drive.guasto = null;
  await page.evaluate(() => { for (const k in codaAttesa) codaAttesa[k].dopo = 0; });
  await sincronizza(page);
  await aspettaSync(page);
  expect(cartelle(drive)).toContain('Progetto B');
  expect(errori).toEqual([]);
});

test('una foto di scontrino che non si carica non blocca le cartelle', async ({ browser }) => {
  const drive = new DriveFinto();
  const { page } = await nuovoDispositivo(browser, { drive });
  await accedi(page);
  drive.guasto = (voce, req) => voce === 'POST /upload/drive/v3/files' && (req.postData() || '').includes('Scontrino') ? 500 : 0;
  await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 300; const g = c.getContext('2d');
    for (let i = 0; i < 400; i++) { g.fillStyle = `hsl(${i},70%,50%)`; g.fillRect(i, (i * 7) % 300, 3, 3); }
    const foto = c.toDataURL('image/jpeg', 1);
    const p = nuovoProgetto(); p.nome = 'Trasferte'; D().progetti[p.id] = p;
    const id = uid(); D().eventi[id] = { id, pid: p.id, data: '2026-11-02', tipo: 'allenamento', titolo: '', ore: false, fasce: [], rimborso: true, km: 10,
      spese: [{ tipo: 'pedaggi', importo: '2', foto }], updatedAt: Date.now() };
    const q = nuovoProgetto(); q.nome = 'Altra cartella'; D().progetti[q.id] = q; DB.meta.queue['folder|' + q.id] = Date.now();
    changed();
  });
  await sincronizza(page);
  await expect.poll(() => cartelle(drive), { timeout: 10000 }).toContain('Altra cartella');
  await expect.poll(() => testoSync(page)).toMatch(/1 elemento in attesa/);
});

test('copia di sicurezza mensile che non riesce: conta come elemento in attesa', async ({ browser }) => {
  const drive = new DriveFinto();
  drive.guasto = (voce, req) => voce === 'POST /upload/drive/v3/files' && (req.postData() || '').includes('Soldirini copia') ? 500 : 0;
  const { page } = await nuovoDispositivo(browser, { drive });
  // qui la prima sincronizzazione non può finire "pulita" (la copia fallisce): accedo senza aspettare "Sincronizzato"
  await page.click('#loginW'); await page.waitForSelector('#setup:not([hidden])'); await page.click('#setupMy');
  await expect.poll(() => testoSync(page)).toMatch(/1 elemento in attesa/);
  drive.guasto = null;
  await page.evaluate(() => { for (const k in codaAttesa) codaAttesa[k].dopo = 0; });
  await sincronizza(page);
  await aspettaSync(page);
  expect(Object.values(drive.file).some(f => /^Soldirini copia/.test(f.name))).toBe(true);
});
