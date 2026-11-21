// 24c.8 (D-144): feste italiane sul calendario. Scelta "Mostra le feste nel calendario" (Impostazioni → Aspetto, accesa di
// partenza), segno 🎉 nella casella, nome della festa nel giorno aperto, feste locali dei lavori attivi. Solo vista.
// Solo dati inventati.
const { test, expect } = require('./helpers/prova');
const { DriveFinto, nuovoDispositivo } = require('./helpers/app');

async function telefono(browser, ora = '2026-12-10T10:00:00+01:00') {
  const d = await nuovoDispositivo(browser, { drive: new DriveFinto(), ora });
  await d.page.waitForFunction(() => window.Entrate && window.Stip15 && window.Archivio && Archivio.avviata);
  return d;
}
const mese = (page, ym) => page.evaluate(ym => { tab = 'cal'; cur = ym; render(); }, ym);
const conSegno = page => page.locator('#grid [data-day]:has(.fst)').evaluateAll(b => b.map(x => x.dataset.day));

test.describe('24c.8 · D-144: feste nel calendario', () => {
  test('dicembre 2026: 8, 25 e 26 con il segno; aprile 2026: Pasqua 5/4 e Pasquetta 6/4; nomi nel giorno; scelta spenta → nessun segno', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    expect(await page.evaluate(() => impost().festeCal)).toBeUndefined(); // nessun dato nuovo finché non si tocca la scelta
    await mese(page, '2026-12');
    expect(await conSegno(page)).toEqual(['2026-12-08', '2026-12-25', '2026-12-26']);
    expect(await page.locator('[data-day="2026-12-25"] .fst').getAttribute('title')).toBe('Natale');
    expect(await page.locator('[data-day="2026-12-08"] .vh').first().textContent()).toContain(', Immacolata');
    await mese(page, '2026-04');
    expect(await conSegno(page)).toEqual(['2026-04-05', '2026-04-06', '2026-04-25']);
    await page.evaluate(() => apriGiorno('2026-04-06'));
    await expect(page.locator('#dayFesta .fnome')).toHaveText('🎉 Pasquetta (Lunedì dell’Angelo)'); // 24c.9: nome del calendario
    await page.evaluate(() => apriGiorno('2026-04-07'));
    await expect(page.locator('#dayFesta')).toBeHidden();
    await page.evaluate(() => apriGiorno('2026-04-05')); await expect(page.locator('#dayFesta .fnome')).toHaveText('🎉 Pasqua');
    // la scelta in Impostazioni → Aspetto: accesa di partenza; spenta → nessun segno e nessuna riga
    await page.evaluate(() => { document.querySelectorAll('.sheet, .modal').forEach(m => { if (m.id === 'dayModal') m.hidden = true; }); tab = 'pro'; render(); });
    const scelta = page.locator('#festeCal');
    await page.evaluate(() => { const d = document.getElementById('festeCal').closest('details'); if (d) d.open = true; });
    await expect(scelta).toBeChecked();
    await scelta.uncheck();
    expect(await page.evaluate(() => impost().festeCal)).toBe(false);
    await mese(page, '2026-12');
    expect(await conSegno(page)).toEqual([]);
    await page.evaluate(() => apriGiorno('2026-12-25')); await expect(page.locator('#dayFesta')).toBeHidden();
    expect(errori).toEqual([]);
  });

  test('feste locali: lavoro con "29/06" → 29 giugno con il segno e "Festa locale"; non prima dell\'inizio del lavoro né dopo la fine', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(() => { const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Ditta'; l.dal = '2026-01-01'; l.al = '2026-12-31'; l.locali = '29/06'; D().lavori[l.id] = l; changed(); });
    await mese(page, '2026-06');
    expect(await conSegno(page)).toEqual(['2026-06-02', '2026-06-29']);
    await page.evaluate(() => apriGiorno('2026-06-29')); await expect(page.locator('#dayFesta .fnome')).toHaveText('🎉 Festa locale');
    await mese(page, '2027-06');
    expect(await conSegno(page)).toEqual(['2027-06-02']); // il lavoro è finito
    expect(errori).toEqual([]);
  });

  test('giorno con turno e festa a 390 px: si vedono tutti e due, niente testo tagliato; calcoli uguali con la scelta accesa o spenta', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    const lid = await page.evaluate(() => { const l = Stip15.nuovoLavoro('turni'); l.nome = 'Reparto'; l.dal = '2026-01-01'; D().lavori[l.id] = l;
      const t = l.tipi.find(x => x.cat === 'lavoro'); D().turni = { t1: { id: 't1', lid: l.id, data: '2026-12-25', tipo: t.id, updatedAt: 1 }, t2: { id: 't2', lid: l.id, data: '2026-12-08', tipo: l.tipi.find(x => x.cat === 'ferie').id, updatedAt: 1 } }; changed(); return l.id; });
    await mese(page, '2026-12');
    for (const d of ['2026-12-25', '2026-12-08']) {
      const cella = page.locator(`[data-day="${d}"]`);
      await expect(cella.locator('.fst')).toBeVisible(); await expect(cella.locator('.ev.tu')).toBeVisible();
      const r = await cella.evaluate(c => { const f = c.querySelector('.fst').getBoundingClientRect(), t = c.querySelector('.ev.tu').getBoundingClientRect(), n = (() => { const r = document.createRange(); r.selectNodeContents(c.querySelector('.n')); return r.getBoundingClientRect(); })(), b = c.getBoundingClientRect();
        const s = c.querySelector('.tus'); return { dentro: f.right <= b.right + 0.5 && f.top >= b.top - 0.5, sopraN: !(f.left < n.right && f.right > n.left && f.top < n.bottom && f.bottom > n.top), sigla: s.scrollWidth <= s.clientWidth + 1 }; });
      expect(r).toEqual({ dentro: true, sopraN: true, sigla: true });
    }
    expect(await page.evaluate(() => innerWidth)).toBe(390);
    const conti = () => page.evaluate(lid => JSON.stringify([Stip15 && window.StipCalc.calcolaMese(D().lavori[lid], Object.values(D().turni), '2026-12'), contiMese('2026-12')]), lid);
    const acceso = await conti();
    await page.evaluate(() => { impost().festeCal = false; changed(); render(); });
    expect(await conti()).toBe(acceso);
    expect(errori).toEqual([]);
  });
});
