// 24c.15 (D-170): legge una foto dei turni con l'app (Tesseract vero) e restituisce i turni proposti per ogni giorno.
const path = require('path');
const { expect } = require('@playwright/test');
// sigle: se data, il lavoro tiene solo i tipi con queste sigle (es. ['M'] per chi non ha il pomeriggio)
async function lavoroATurni(page, sigle) {
  return page.evaluate(sigle => { const l = Stip15.nuovoLavoro('turni'); l.nome = 'Reparto Esempio'; l.dal = '2026-01-01'; if (sigle) l.tipi = l.tipi.filter(t => sigle.includes(t.sigla)); D().lavori = { [l.id]: l }; DB.meta.skipWelcome = true; changed(); render(); return l.id; }, sigle);
}
// → { errore } oppure { giorni: { '2': 'MP', ... }, dubbi: [giorni con ⚠], riga }
// opz.riga: se il nome non si legge, tocca la riga numero opz.riga tra le persone (0 = la prima sotto l'intestazione)
async function leggiFoto(page, file, nome, mese = '2026-12', opz = {}) {
  await page.evaluate(m => FotoTurni.apriFoto(null, m), mese);
  await page.locator('#ftNome').fill(nome);
  await page.locator('#ftMese').fill(mese);
  await page.setInputFiles('#ftFile', file);
  await expect(page.locator('#ft4:not([hidden]), #ft3:not([hidden])')).toBeVisible({ timeout: 300000 });
  if (await page.locator('#ft3').isVisible() && opz.riga != null && await page.locator('.ftriga').count()) {
    const righe = page.locator('.ftriga'), n = await righe.count();
    // le persone sono le ultime righe dell'elenco (sopra possono esserci righe della testata)
    await righe.nth(n - (opz.persone || 6) + opz.riga).click();
    await expect(page.locator('#ft4:not([hidden]), #ft3:not([hidden])')).toBeVisible({ timeout: 300000 });
  }
  if (await page.locator('#ft3').isVisible()) { const e = await page.locator('#ftErr').textContent(); await page.evaluate(() => $('ftClose').click()); return { errore: e }; }
  const r = await page.evaluate(() => {
    const l = Object.values(D().lavori)[0], sig = id => (l.tipi.find(t => t.id === id) || {}).sigla;
    const giorni = {}, dubbi = [];
    for (const g of document.querySelectorAll('#ftLista .ftg')) {
      const d = +g.querySelector('[data-ftd]').dataset.ftd.slice(8), on = [...g.querySelectorAll('.chip.on')].map(c => sig(c.dataset.ftt));
      if (on.length) giorni[d] = on.join(''); if (g.classList.contains('dub')) dubbi.push(d);
    }
    return { giorni, dubbi, riga: document.getElementById('ftRiass').textContent };
  });
  await page.evaluate(() => $('ftClose').click());
  return r;
}
const DATI = path.join(__dirname, '..', 'dati', 'turni');
module.exports = { lavoroATurni, leggiFoto, DATI };
