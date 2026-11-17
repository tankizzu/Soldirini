// v22 (D-034, D-038): turni a colpo d'occhio sul calendario, con lo stile proposto da 02
// (fondo tenue + riga colorata in basso, scritta in --ink). Tutti i dati sono inventati.
const { test, expect } = require('@playwright/test');
const { DriveFinto, nuovoDispositivo, accedi } = require('./helpers/app');

// Novembre 2026: lunedì 9 un turno, martedì 10 due turni, mercoledì 11 tre turni (due lavori).
async function preparaTurni(page) {
  await page.evaluate(() => {
    const l = Stip15.nuovoLavoro('turni'); l.nome = 'Reparto di prova'; l.dal = '2026-01-01';
    l.tipi.push({ id: 'st', nome: 'Straordinario', sigla: 'S', icona: '➕', cat: 'lavoro', aggiunta: true, da: '22:00', a: '23:00', pausa: '', ore: '', colore: '#7048e8' });
    D().lavori[l.id] = l;
    const l2 = Stip15.nuovoLavoro('turni'); l2.nome = 'Secondo lavoro'; l2.dal = '2026-01-01'; D().lavori[l2.id] = l2;
    const tipo = (x, n) => x.tipi.find(t => t.nome === n).id;
    const metti = (x, data, n) => { const id = uid(); (D().turni || (D().turni = {}))[id] = { id, lid: x.id, data, tipo: tipo(x, n), da: '', a: '', pausa: '', ore: '', nota: '', updatedAt: Date.now() }; };
    metti(l, '2026-11-09', 'Mattina');
    metti(l, '2026-11-10', 'Pomeriggio'); metti(l, '2026-11-10', 'Straordinario');
    metti(l, '2026-11-11', 'Mattina'); metti(l, '2026-11-11', 'Straordinario'); metti(l2, '2026-11-11', 'Notte');
    const id = uid(); D().turni[id] = { id, lid: l.id, data: '2026-11-12', tipo: null, da: '09:00', a: '13:30', pausa: '', ore: '', nota: '', updatedAt: Date.now() };
    cur = '2026-11'; changed(); render();
  });
}
const casella = (page, iso) => page.locator(`#grid [data-day="${iso}"]`);

async function apriCalendario(browser, opz = {}) {
  const drive = new DriveFinto();
  const { page, errori } = await nuovoDispositivo(browser, { drive, ...opz });
  await accedi(page);
  return { page, errori };
}

test('390 px: un turno si legge (icona e sigla visibili, non a dimensione 0)', async ({ browser }) => {
  const { page, errori } = await apriCalendario(browser);
  await preparaTurni(page);
  const ev = casella(page, '2026-11-09').locator('.ev.tu');
  await expect(ev).toHaveCount(1);
  const sig = ev.locator('.tus');
  await expect(sig).toBeVisible();
  await expect(sig).toHaveText('M');
  expect(await sig.evaluate(e => parseFloat(getComputedStyle(e).fontSize))).toBe(13);
  expect(await ev.locator('.tui').evaluate(e => parseFloat(getComputedStyle(e).fontSize))).toBe(17);
  await expect(ev.locator('.tun')).toBeHidden();
  const box = await ev.boundingBox(); expect(box.height).toBeGreaterThanOrEqual(30);
  // scritta del colore normale e riga colorata in basso
  const st = await ev.evaluate(e => { const c = getComputedStyle(e); return { col: c.color, ink: getComputedStyle(document.body).color, ombra: c.boxShadow }; });
  expect(st.col).toBe(st.ink);
  expect(st.ombra).toMatch(/inset/);
  // turno senza tipo: orario abbreviato
  await expect(casella(page, '2026-11-12').locator('.ev.tu .tus')).toHaveText('9–13:30');
  expect(errori).toEqual([]);
});

test('390 px: due turni nello stesso giorno restano leggibili; tre o più: i primi due e "+N"', async ({ browser }) => {
  const { page } = await apriCalendario(browser);
  await preparaTurni(page);
  const due = casella(page, '2026-11-10').locator('.ev.tu');
  await expect(due).toHaveCount(2);
  await expect(due.locator('.tus')).toHaveText(['P', 'S']);
  for (const i of [0, 1]) {
    await expect(due.nth(i).locator('.tus')).toBeVisible();
    expect(await due.nth(i).evaluate(e => getComputedStyle(e).flexDirection)).toBe('row');
  }
  // i due riquadri stanno dentro la casella, senza sovrapporsi
  const [a, b] = [await due.nth(0).boundingBox(), await due.nth(1).boundingBox()];
  const cas = await casella(page, '2026-11-10').boundingBox();
  expect(a.y + a.height).toBeLessThanOrEqual(b.y + 0.5);
  expect(b.y + b.height).toBeLessThanOrEqual(cas.y + cas.height + 0.5);
  const tre = casella(page, '2026-11-11');
  await expect(tre.locator('.ev.tu')).toHaveCount(2);
  await expect(tre.locator('.tumore')).toHaveText('+1');
});

test('lettore di schermo: la casella dice giorno, data e turno', async ({ browser }) => {
  const { page } = await apriCalendario(browser);
  await preparaTurni(page);
  const nome = await casella(page, '2026-11-09').evaluate(e => e.innerText.length >= 0 && [...e.querySelectorAll('.vh')].map(x => x.textContent).join(' '));
  expect(nome).toContain('Lunedì 9 novembre');
  expect(nome).toContain('Reparto di prova, Mattina 6–14');
  await expect(page.getByRole('button', { name: /Lunedì 9 novembre.*Mattina 6–14/ })).toHaveCount(1);
  // il terzo turno nascosto dietro "+1" resta leggibile
  expect(await casella(page, '2026-11-11').locator('.vh').allTextContents()).toContain('Secondo lavoro, Notte 22–6');
});

test('senza :has() (browser vecchi) due turni restano grandi, uno sotto l\'altro, e leggibili', async ({ browser }) => {
  const { page } = await apriCalendario(browser);
  await preparaTurni(page);
  // tolgo le regole con :has(), come farebbe un browser che non le conosce
  const tolte = await page.evaluate(() => { let n = 0;
    const giro = l => { for (let i = l.cssRules.length - 1; i >= 0; i--) { const r = l.cssRules[i]; if (r.cssRules && !r.selectorText) giro(r); else if (/:has\(/.test(r.selectorText || '')) { l.deleteRule(i); n++; } } };
    for (const s of document.styleSheets) { try { giro(s); } catch (e) {} } return n; });
  expect(tolte).toBe(3);
  const due = casella(page, '2026-11-10').locator('.ev.tu');
  for (const i of [0, 1]) {
    expect(await due.nth(i).evaluate(e => getComputedStyle(e).flexDirection)).toBe('column');
    await expect(due.nth(i).locator('.tus')).toBeVisible();
    const s = await due.nth(i).locator('.tus').boundingBox(); expect(s.height).toBeGreaterThan(8);
  }
});

test('orario fisso: "Solo i giorni diversi" è il valore iniziale (barretta); "Tutti i giorni" mostra il riquadro', async ({ browser }) => {
  const { page } = await apriCalendario(browser);
  const lid = await page.evaluate(() => {
    const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Ufficio di prova'; l.dal = '2026-01-01';
    for (const d of [1, 2, 3, 4, 5]) l.settimana[d] = { da: '09:00', a: '17:00', pausa: '60' };
    D().lavori[l.id] = l; const id = uid();
    D().turni = D().turni || {}; D().turni[id] = { id, lid: l.id, data: '2026-11-10', tipo: l.tipi.find(t => t.nome === 'Ferie').id, da: '', a: '', pausa: '', ore: '', nota: '', updatedAt: Date.now() };
    cur = '2026-11'; changed(); render(); return l.id; });
  const normale = casella(page, '2026-11-09').locator('.ev.tu');
  await expect(normale).toHaveClass(/\bbar\b/);
  expect((await normale.boundingBox()).height).toBe(6);
  await expect(normale.locator('.tus')).toBeHidden();
  const ferie = casella(page, '2026-11-10').locator('.ev.tu');
  await expect(ferie).not.toHaveClass(/\bbar\b/);
  await expect(ferie.locator('.tus')).toHaveText('F');
  // la scelta nella finestra del lavoro
  await page.evaluate(id => { tab = 'pro'; render(); document.querySelector(`[data-lav="${id}"]`).click(); }, lid);
  await expect(page.locator('#lvModal')).toBeVisible();
  // v23 (D-010): la sezione dell'orario parte chiusa, la apro
  await expect(page.locator('#lvFissoBox')).not.toHaveAttribute('open', '');
  await page.locator('#lvFissoBox > summary').click();
  await expect(page.locator('[name=lvCalMostra][value=diversi]')).toBeChecked();
  await page.locator('[name=lvCalMostra][value=tutti]').check();
  await page.click('#lvSave');
  expect(await page.evaluate(id => D().lavori[id].calMostra, lid)).toBe('tutti');
  await page.evaluate(() => { tab = 'cal'; render(); });
  const ora = casella(page, '2026-11-09').locator('.ev.tu');
  await expect(ora).not.toHaveClass(/\bbar\b/);
  await expect(ora.locator('.tus')).toHaveText('7h');
  await expect(ora.locator('.tui')).toHaveText('💼');
});

test('temi chiaro e scuro: fondo tenue diverso dalla casella, scritta del colore del tema', async ({ browser }) => {
  const { page } = await apriCalendario(browser);
  await preparaTurni(page);
  const ev = casella(page, '2026-11-09').locator('.ev.tu');
  for (const tema of ['light', 'dark']) {
    await page.evaluate(t => { document.documentElement.dataset.theme = t; }, tema);
    await expect.poll(() => ev.evaluate(e => getComputedStyle(e).color === getComputedStyle(document.body).color)).toBe(true);
    const c = await ev.evaluate(e => ({ fondo: getComputedStyle(e).backgroundColor, card: getComputedStyle(document.documentElement).getPropertyValue('--card').trim() }));
    expect(c.fondo).not.toBe('rgba(0, 0, 0, 0)');
    expect(c.fondo).not.toBe(c.card);
  }
});

test('schermo largo: riquadro con icona e nome intero del turno', async ({ browser }) => {
  const { page } = await apriCalendario(browser, { telefono: false });
  await preparaTurni(page);
  const ev = casella(page, '2026-11-09').locator('.ev.tu');
  await expect(ev.locator('.tun')).toBeVisible();
  await expect(ev.locator('.tun')).toHaveText('Mattina');
  await expect(ev.locator('.tus')).toBeHidden();
});

test('lavoro nascosto dai filtri: i suoi turni spariscono e non contano nel "+N"', async ({ browser }) => {
  const { page } = await apriCalendario(browser);
  await preparaTurni(page);
  await page.evaluate(() => { const l = lavori().find(x => x.nome === 'Secondo lavoro');
    localStorage.setItem('soldirini-nascosti', JSON.stringify(['l:' + l.id])); });
  await page.reload();
  await page.waitForFunction(() => typeof Stip15 === 'object' && DB.meta.account);
  await page.evaluate(() => { cur = '2026-11'; render(); });
  const tre = casella(page, '2026-11-11');
  await expect(tre.locator('.ev.tu')).toHaveCount(2);
  await expect(tre.locator('.tumore')).toHaveCount(0);
});
