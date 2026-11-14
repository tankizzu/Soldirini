// Dati salvati da versioni precedenti: l'app li apre senza errori e non perde nessuna informazione.
// I dati sono inventati e riproducono la forma dei file salvati dalle versioni 14, 15 e 18.
const { test, expect } = require('@playwright/test');
const { DriveFinto, nuovoDispositivo, accediEsistente, aspettaSync, sincronizza } = require('./helpers/app');
const VECCHI = require('./dati/vecchie-versioni');

for (const [nome, dati] of Object.entries(VECCHI)) {
  test(`file dati della ${nome} su Drive, telefono nuovo`, async ({ browser }) => {
    const drive = new DriveFinto();
    const root = { id: drive.nuovoId(), name: 'Soldirini', mimeType: 'application/vnd.google-apps.folder', mt: Date.now() };
    drive.file[root.id] = root;
    const contenuto = JSON.parse(JSON.stringify({ ...dati, root: { id: root.id, name: 'Soldirini' }, chiaveDelFuturo: { x: { a: 1, updatedAt: 5 } } }));
    const f = { id: drive.nuovoId(), name: 'Soldirini - dati (non cancellare).json', parents: [root.id], mimeType: 'application/json', appProperties: { soldirini: 'dati' }, corpo: JSON.stringify(contenuto), mt: Date.now() };
    drive.file[f.id] = f;
    const { page, errori } = await nuovoDispositivo(browser, { drive });
    await accediEsistente(page);
    for (const t of ['cal', 'rie', 'pro', 'tas', 'ris']) {
      await page.evaluate(t => { if (document.querySelector(`[data-tab="${t}"]`) || t === 'ris') { tab = t; render(); } }, t);
    }
    await page.evaluate(() => { cur = '2026-03'; tab = 'rie'; render(); });
    await sincronizza(page);
    await aspettaSync(page);
    const dopo = drive.datiJson();
    for (const k of Object.keys(contenuto)) expect(dopo, `chiave "${k}" conservata`).toHaveProperty(k);
    for (const k of ['progetti', 'eventi']) for (const id of Object.keys(contenuto[k] || {})) expect(dopo[k]).toHaveProperty(id);
    expect(errori).toEqual([]);
  });

  test(`memoria del telefono della ${nome}: l'app si apre senza errori`, async ({ browser }) => {
    const stato = { data: JSON.parse(JSON.stringify(dati)), meta: { seq: 3, synced: 3, queue: {} } };
    const { page, errori } = await nuovoDispositivo(browser, { stato });
    await page.evaluate(() => { cur = '2026-03'; for (const t of ['cal', 'rie', 'pro', 'tas']) { tab = t; render(); } });
    const n = await page.evaluate(() => [Object.keys(D().progetti).length, Object.keys(D().eventi).length]);
    expect(n).toEqual([Object.keys(dati.progetti).length, Object.keys(dati.eventi).length]);
    expect(errori).toEqual([]);
  });
}
