// 24c.3 (campagna calcoli, seconda parte): campi nuovi del lavoro per D-120 (straordinario di notte e di festa) e D-121
// (feste in settimana non lavorate pagate); testi provvisori di 04. Orologio fisso al 17/11/2026. Dati inventati.
const { test, expect } = require('./helpers/prova');
const { DriveFinto, nuovoDispositivo, accedi } = require('./helpers/app');

const OGGI = '2026-11-17T10:00:00+01:00';
async function telefono(browser) {
  const d = await nuovoDispositivo(browser, { drive: new DriveFinto(), ora: OGGI }); await accedi(d.page);
  await d.page.waitForFunction(() => window.Entrate && window.Stip15 && window.Pensione); return d;
}
const LAVORO = page => page.evaluate(() => {
  const lf = Stip15.nuovoLavoro('fisso'); lf.id = 'lf'; lf.nome = 'Ufficio'; lf.paga = { tipo: 'oraria', importo: '10', divisore: 168 };
  for (const d of [1, 2, 3, 4, 5]) lf.settimana[d] = { da: '09:00', a: '18:00', pausa: '60' };
  lf.magg = { stra: '25', nott: '20', fest: '50', dom: '30', altro: 'resta' }; D().lavori = { lf }; changed();
});
const apriLavoro = page => page.evaluate(() => { tab = 'pro'; render(); document.querySelector('[data-lav="lf"]').click();
  document.querySelectorAll('#lvModal details').forEach(d => { d.open = true; }); });

test.describe('24c.3 · campi del contratto nel lavoro (D-120, D-121)', () => {
  test('due campi dello straordinario e la scelta delle feste pagate: si salvano, vuoti/spenti di base, nascosta con la paga mensile', async ({ browser }) => {
    const { page, errori } = await telefono(browser); await LAVORO(page); await apriLavoro(page);
    await expect(page.locator('label:has(#lvM-straNott)')).toHaveText('Straordinario di notte');
    await expect(page.locator('label:has(#lvM-straFest)')).toHaveText('Straordinario nei giorni di festa e di domenica');
    await expect(page.locator('#lvMStraNota')).toHaveText('Se li lasci vuoti, lo straordinario di notte o di festa somma le due maggiorazioni (es. straordinario + notturno).');
    await expect(page.locator('#lvFestePagBox')).toHaveText('Le feste in settimana non lavorate sono pagate');
    await expect(page.locator('#lvM-straNott')).toHaveValue(''); await expect(page.locator('#lvM-straFest')).toHaveValue('');
    await expect(page.locator('#lvFestePag')).not.toBeChecked();
    // tocco di almeno 44 px sulla riga della scelta
    expect((await page.locator('#lvFestePagBox').boundingBox()).height).toBeGreaterThanOrEqual(44);
    await page.fill('#lvM-straNott', '50'); await page.fill('#lvM-straFest', '60'); await page.check('#lvFestePag');
    await page.click('#lvSave'); await expect(page.locator('#lvModal')).toBeHidden();
    expect(await page.evaluate(() => [D().lavori.lf.magg, D().lavori.lf.festePagate]))
      .toEqual([{ stra: '25', nott: '20', fest: '50', dom: '30', altro: 'resta', straNott: '50', straFest: '60' }, true]);
    // riaperto: i valori ci sono; con la paga mensile la scelta delle feste sparisce (la festa è già nello stipendio)
    await apriLavoro(page);
    await expect(page.locator('#lvM-straNott')).toHaveValue('50'); await expect(page.locator('#lvFestePag')).toBeChecked();
    await page.selectOption('#lvPagaTipo', 'mensile'); await expect(page.locator('#lvFestePagBox')).toBeHidden();
    await page.selectOption('#lvPagaTipo', 'giornaliera'); await expect(page.locator('#lvFestePagBox')).toBeVisible();
    expect(errori).toEqual([]);
  });

  test('scheda del lavoro: le ore delle feste pagate nella riga delle ore e nella paga base', async ({ browser }) => {
    const { page, errori } = await telefono(browser); await LAVORO(page);
    await page.evaluate(() => { D().lavori.lf.festePagate = true; changed(); cur = '2026-12'; rieMode = 'mese'; tab = 'rie'; render(); vaiA('dlav'); });
    const card = page.locator('#rieLav details.lavcard'); await card.locator('summary').click();
    await expect(card).toContainText('168 ore lavorate · 16 di feste pagate');
    await expect(card).toContainText('Paga base1.840,00 €');
    // spenta: come prima
    await page.evaluate(() => { D().lavori.lf.festePagate = false; changed(); render(); });
    await expect(page.locator('#rieLav details.lavcard')).not.toContainText('feste pagate');
    expect(errori).toEqual([]);
  });
});
