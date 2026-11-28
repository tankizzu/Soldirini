// 24c.16: finestra di conferma dei turni da foto (prova del Coordinatore sulla foto vera, 26/11): cerchi non scelti spenti,
// "Riga trovata" con il nome scritto dall'utente, avviso della foto piccola solo con dei dubbi. Immagini inventate (D-089).
const path = require('path');
const { test, expect } = require('./helpers/prova');
const { DriveFinto, nuovoDispositivo } = require('./helpers/app');
const { serviTesseract, mancanti } = require('./helpers/tesseract');
const { lavoroATurni, DATI } = require('./helpers/foto-turni');

async function proposta(browser, nome, sigle, file = 'turni-larga.jpg') {
  const { ctx, page } = await nuovoDispositivo(browser, { drive: new DriveFinto(), ora: '2026-12-20T10:00:00+01:00', telefono: true });
  await serviTesseract(ctx);
  await page.waitForFunction(() => window.FotoTurni && window.Stip15 && Archivio.avviata);
  await lavoroATurni(page, sigle);
  await page.evaluate(() => FotoTurni.apriFoto(null, '2026-12'));
  await page.locator('#ftNome').fill(nome);
  await page.locator('#ftMese').fill('2026-12');
  await page.setInputFiles('#ftFile', path.join(DATI, file));
  await expect(page.locator('#ft4:not([hidden]), #ft3:not([hidden])')).toBeVisible({ timeout: 300000 });
  // nomi illeggibili (immagine sporca): si tocca la prima riga delle persone
  if (await page.locator('#ft3').isVisible()) { const r = page.locator('.ftriga'); await r.nth((await r.count()) - 6).click(); }
  await expect(page.locator('#ft4')).toBeVisible({ timeout: 300000 });
  return page;
}
// stile di un cerchio del giorno: fondo, bordo, ombra e icona (opacità, filtro)
const stile = (page, giorno, sigla) => page.evaluate(([g, sg]) => {
  const l = Object.values(D().lavori)[0], t = l.tipi.find(x => x.sigla === sg);
  const b = document.querySelector(`#ftLista [data-ftd="2026-12-${String(g).padStart(2, '0')}"][data-ftt="${t.id}"]`), i = b.querySelector('.ic');
  const cb = getComputedStyle(b), ci = getComputedStyle(i);
  return { on: b.classList.contains('on'), premuto: b.getAttribute('aria-pressed'), fondo: cb.backgroundColor, ombra: cb.boxShadow, opacita: ci.opacity, filtro: ci.filter };
}, [giorno, sigla]);

test.describe('24c.16 · finestra "Turni da foto"', () => {
  test.describe.configure({ timeout: 400000 });
  test.beforeEach(() => { const m = mancanti(); test.skip(m.length > 0, 'pacchetti di Tesseract non scaricati (vedi test/LEGGIMI.md): ' + m.join(', ')); });

  test('cerchi: scelto pieno con l\'anello, non scelto spento; giorno senza turni tutto spento; nome scritto e niente avviso con 0 ⚠', async ({ browser }) => {
    const page = await proposta(browser, 'ROSSI ANNA');
    // giorno 4 = solo il pomeriggio
    const p = await stile(page, 4, 'P'), m = await stile(page, 4, 'M');
    expect(p.on).toBe(true); expect(p.premuto).toBe('true');
    expect(m.on).toBe(false); expect(m.premuto).toBe('false');
    expect(p.opacita).toBe('1'); expect(p.filtro).toBe('none');
    expect(+m.opacita).toBeCloseTo(0.6, 5); expect(m.filtro).toContain('grayscale'); // 24c.20 (02, tornata 59 §1.2): icona al 60%, bordo tratteggiato (v24c20.spec.js)
    expect(m.fondo).toBe('rgba(0, 0, 0, 0)'); expect(p.fondo).not.toBe(m.fondo);
    expect(p.ombra).not.toBe('none'); expect(m.ombra).toBe('none');
    // giorno 1 (vuoto) e giorno 7: nessun cerchio scelto, tutti con lo stile spento
    for (const g of [1, 7]) {
      const n = await page.locator(`#ftLista [data-ftd="2026-12-0${g}"].on`).count(); expect(n, 'giorno ' + g).toBe(0);
      const tutti = await page.locator(`#ftLista [data-ftd="2026-12-0${g}"] .ic`).evaluateAll(e => e.map(x => getComputedStyle(x).opacity));
      expect(tutti.length).toBeGreaterThanOrEqual(5); for (const o of tutti) expect(+o).toBeLessThanOrEqual(0.6); // 24c.20: icona al 60% (02, tornata 59)
    }
    // toccando un cerchio spento diventa pieno (e viceversa)
    await page.locator('#ftLista [data-ftd="2026-12-01"]').first().click();
    expect((await page.locator('#ftLista [data-ftd="2026-12-01"]').first().getAttribute('aria-pressed'))).toBe('true');
    await expect(page.locator('#ftRiass')).toContainText('Riga trovata: ROSSI ANNA');
    await expect(page.locator('#ftRiass')).not.toContainText('La foto è piccola');
    await expect(page.locator('#ftRiass')).not.toContainText('da controllare');
  });

  test('con dei giorni da controllare l\'avviso della foto piccola resta (lavoro senza il pomeriggio: "MP" dubbi)', async ({ browser }) => {
    const page = await proposta(browser, 'ROSSI ANNA', ['M', 'R', 'F', 'Pe', 'Ma'], 'turni-larga-piccola.jpg');
    await expect(page.locator('#ftRiass')).toContainText('da controllare');
    await expect(page.locator('#ftRiass')).toContainText('La foto è piccola');
  });
});
