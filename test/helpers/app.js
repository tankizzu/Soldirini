// Aiuti comuni: apre Soldirini in un "dispositivo" finto, accede con Google finto, aspetta la sincronizzazione.
'use strict';
const { expect } = require('@playwright/test');
const { BASE, DriveFinto, CalendarFinto, collega } = require('./google-finto');

// Apre un nuovo dispositivo (contesto del browser separato: memoria del telefono propria).
// ora: data e ora fisse del telefono (orologio finto di Playwright), es. '2026-11-17T10:00:00+01:00'
async function nuovoDispositivo(browser, { drive, calendar, stato, telefono = true, sito, ora, contesto } = {}) {
  const ctx = await browser.newContext({
    reducedMotion: 'reduce', serviceWorkers: 'block', locale: 'it-IT', timezoneId: 'Europe/Rome',
    ...(telefono ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {}),
    ...(contesto || {}) // 24c.5: opzioni in più del contesto (es. userAgent, colorScheme)
  });
  await collega(ctx, { drive, calendar, sito });
  if (ora) await ctx.clock.setFixedTime(new Date(ora));
  if (stato) await ctx.addInitScript(([k, v]) => { if (!sessionStorage.getItem('__statoMesso')) { localStorage.setItem(k, v); sessionStorage.setItem('__statoMesso', '1'); } }, ['soldirini-v1', JSON.stringify(stato)]);
  const page = await ctx.newPage();
  conArchivio(page);
  const errori = [];
  page.on('pageerror', e => errori.push(e.message));
  await page.goto(BASE);
  return { ctx, page, errori };
}

// v24b: archivio.js legge i dati da IndexedDB e solo dopo carica gli altri file dell'app, anche dopo l'evento "load".
// Dopo goto/reload si aspetta che l'app sia partita; prima di un reload si aspetta la fine della scrittura in corso
// (come farebbe un telefono che resta aperto). Le versioni vecchie (senza Archivio) non aspettano niente.
const avviata = page => page.waitForFunction(() => !window.Archivio || window.Archivio.avviata === true, null, { timeout: 20000 });
function conArchivio(page) {
  const goto = page.goto.bind(page), reload = page.reload.bind(page);
  page.goto = async (...a) => { const r = await goto(...a); if (String(a[0]).startsWith(BASE)) await avviata(page); return r; };
  page.reload = async (...a) => {
    await page.evaluate(() => window.Archivio && window.Archivio.salvato && window.Archivio.salvato()).catch(() => {});
    const r = await reload(...a); if (page.url().startsWith(BASE)) await avviata(page); return r;
  };
  return page;
}

async function testoSync(page) { return ((await page.textContent('#sync')) || '').trim(); }

// Stato della sincronizzazione letto dall'app (non solo la scritta).
const statoSync = page => page.evaluate(() => ({ testo: ($('sync').textContent || '').trim(), syncing, lastSync: DB.meta.lastSync || 0,
  dataId: DB.meta.dataId || null, inCoda: pendingCount(), timer: !!syncTimer }));

// Aspetta una sincronizzazione FINITA E RIUSCITA: scritta "Sincronizzato", nessuna sincronizzazione in corso,
// file dati noto, niente da inviare e ultima sincronizzazione successiva a "dopo" (v20b: prima bastava la scritta).
async function aspettaSync(page, { dopo = 0, ms = 20000 } = {}) {
  await expect.poll(async () => { const s = await statoSync(page);
    return s.testo === 'Sincronizzato' && !s.syncing && s.dataId && s.inCoda === 0 && s.lastSync > dopo ? 'ok' : JSON.stringify(s); },
  { timeout: ms, message: 'la sincronizzazione non è finita' }).toBe('ok');
}

// Sincronizza adesso e aspetta che QUESTA sincronizzazione finisca: annulla quella programmata da changed()
// e, se una è già in corso, aspetta che termini (sync() chiamata durante un'altra esce subito senza fare niente).
async function sincronizza(page) {
  return page.evaluate(async () => {
    clearTimeout(syncTimer);
    while (syncing) await new Promise(r => setTimeout(r, 20));
    await sync(true);
  });
}

// Primo accesso con Google finto: crea la cartella su Drive e sincronizza.
// 24b.2: prima si aspetta la libreria di Google (finta), che arriva per conto suo. Su GitHub, più lento, il tocco arrivava
// prima e login() rispondeva "Google non è ancora pronto": la finestra della cartella non compariva (sync.spec.js:12, 18/11).
const googlePronto = page => page.waitForFunction(() => !!(window.google && google.accounts && google.accounts.oauth2), null, { timeout: 20000 });
async function accedi(page) {
  await googlePronto(page);
  await page.click('#loginW');
  await page.waitForSelector('#setup:not([hidden])');
  await page.click('#setupMy');
  await aspettaSync(page);
}

// Accesso su un secondo dispositivo, quando su Drive c'è già il file dati.
async function accediEsistente(page) {
  await googlePronto(page);
  await page.click('#loginW');
  await aspettaSync(page);
}

module.exports = { BASE, DriveFinto, CalendarFinto, nuovoDispositivo, conArchivio, avviata, accedi, accediEsistente, aspettaSync, sincronizza, statoSync, testoSync };
