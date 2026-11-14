// Nota d'autore (D-012): in fondo a Impostazioni (accanto alla versione) e nella schermata di accesso; mai nei documenti.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { DriveFinto, nuovoDispositivo, accedi } = require('./helpers/app');
const { SITO } = require('./helpers/google-finto');

const NOTA = '© 2026 Stefano Tanca · Ideato da Stefano Tanca';

test('nella schermata di accesso', async ({ browser }) => {
  const { page } = await nuovoDispositivo(browser);
  await expect(page.locator('#welcome')).toContainText(NOTA);
});

test('in fondo a Impostazioni, accanto alla versione', async ({ browser }) => {
  const drive = new DriveFinto();
  const { page } = await nuovoDispositivo(browser, { drive });
  await accedi(page);
  await page.click('nav [data-tab=pro]');
  await expect(page.locator('#appVer')).toContainText(/versione/i);
  await expect(page.locator('#appVer')).toContainText(NOTA);
});

test('non compare nei documenti generati (nessun altro file la contiene)', () => {
  const conNota = [];
  const giro = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) giro(p); else if (/\.(js|html|css)$/.test(f) && fs.readFileSync(p, 'utf8').includes('Ideato da')) conNota.push(path.relative(SITO, p)); } };
  giro(SITO);
  expect(conNota.sort()).toEqual(['index.html', 'ui.js']);
});
