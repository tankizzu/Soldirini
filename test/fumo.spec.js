// Prova di base: l'app si apre, si accede con Google finto, si salva un'attività e arriva su Drive.
const { test, expect } = require('@playwright/test');
const { DriveFinto, nuovoDispositivo, accedi, aspettaSync, sincronizza } = require('./helpers/app');

test('apertura, accesso e sincronizzazione', async ({ browser }) => {
  const drive = new DriveFinto();
  const { page, errori } = await nuovoDispositivo(browser, { drive });
  await accedi(page);
  expect(drive.fileDati()).toHaveLength(1);
  await page.evaluate(() => {
    const p = nuovoProgetto(); p.nome = 'Squadra di prova'; p.ore.attivo = true; p.ore.tariffa = '15'; D().progetti[p.id] = p;
    const id = uid(); D().eventi[id] = { id, pid: p.id, data: '2026-11-02', tipo: 'allenamento', titolo: '', ore: true, fasce: [{ da: '17:00', a: '19:00' }], rimborso: false, spese: [], updatedAt: Date.now() };
    changed(); render();
  });
  await sincronizza(page);
  await aspettaSync(page);
  const dati = drive.datiJson();
  expect(Object.values(dati.progetti).map(p => p.nome)).toContain('Squadra di prova');
  expect(Object.keys(dati.eventi)).toHaveLength(1);
  expect(errori).toEqual([]);
});
