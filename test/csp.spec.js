// v24csp (D-048, D-055): politica di sicurezza dei contenuti (CSP) nel <meta>, anti-riquadro, diagnostica.
// Tutti i dati sono inventati. Le prove che provocano blocchi apposta chiamano consentiBlocchiCsp().
const fs = require('fs');
const path = require('path');
const { test, expect, consentiBlocchiCsp } = require('./helpers/prova');
const { BASE, DriveFinto, nuovoDispositivo, accedi } = require('./helpers/app');
const { SITO } = require('./helpers/google-finto');
const { sitoDaCommit } = require('./helpers/versione');

const BASE_23B = '091612a'; // 23b pubblicata: il prima per il confronto dei documenti
const POLITICA = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://accounts.google.com/gsi/client https://apis.google.com https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/ https://cdn.jsdelivr.net/npm/tesseract.js@v5.1.1/ https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.1.1/; worker-src 'self' blob:; connect-src 'self' https://www.googleapis.com https://oauth2.googleapis.com https://accounts.google.com/gsi/ https://nominatim.openstreetmap.org https://router.project-osrm.org https://cdn.jsdelivr.net; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; frame-src https://accounts.google.com/gsi/ https://docs.google.com; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'";
const SECONDARIE = "default-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; form-action 'none'";

test.describe('CSP · la politica è attiva', () => {
  test('il <meta> è il secondo elemento di <head>, prima di ogni link e script, con la politica approvata', async ({ browser }) => {
    const { page } = await nuovoDispositivo(browser);
    const r = await page.evaluate(() => { const h = [...document.head.children];
      return { primo: h[0].outerHTML, secondo: h[1].getAttribute('http-equiv'), politica: h[1].getAttribute('content'),
        primaDiLink: h.findIndex(e => e.matches('link,script,style')) > 1 }; });
    expect(r.primo).toBe('<meta charset="utf-8">');
    expect(r.secondo).toBe('Content-Security-Policy');
    expect(r.politica).toBe(POLITICA);
    expect(r.primaDiLink).toBe(true);
    const script = r.politica.split(';').find(d => d.trim().startsWith('script-src'));
    expect(script).not.toMatch(/'unsafe-inline'|'unsafe-eval'/); // regola B2
  });

  test('codice in <img onerror>, <script> aggiunto alla pagina ed eval non vengono eseguiti', async ({ browser }) => {
    const blocchi = consentiBlocchiCsp();
    const { page } = await nuovoDispositivo(browser);
    await page.evaluate(() => {
      document.body.insertAdjacentHTML('beforeend', '<img src="x-non-esiste" onerror="window.__img=1">');
      const s = document.createElement('script'); s.textContent = 'window.__script=1'; document.body.appendChild(s);
      // eval chiamato dall'app (in un'attesa), non dallo strumento di prova
      setTimeout(() => { try { eval('window.__eval=1'); } catch (e) { window.__evalErr = e.name; }
        try { new Function('window.__fn=1')(); } catch (e) { window.__fnErr = e.name; } }, 0);
    });
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => [window.__img, window.__script, window.__eval, window.__fn, window.__evalErr, window.__fnErr]))
      .toEqual([undefined, undefined, undefined, undefined, 'EvalError', 'EvalError']);
    expect(blocchi.map(b => `${b.direttiva}:${b.bloccato}`).sort()).toEqual(['script-src-attr:inline', 'script-src-elem:inline', 'script-src:eval', 'script-src:eval'].sort());
  });

  test('pagine Privacy e Licenze: hanno la loro politica e si aprono senza blocchi', async ({ browser }) => {
    const { page } = await nuovoDispositivo(browser);
    for (const p of ['privacy.html', 'licenze/']) {
      await page.goto(BASE + p);
      await expect(page.locator('h1')).toBeVisible();
      expect(await page.evaluate(() => [document.head.children[1].getAttribute('http-equiv'), document.head.children[1].getAttribute('content')]))
        .toEqual(['Content-Security-Policy', SECONDARIE]);
    }
  });
});

test('anti-riquadro: dentro un iframe di un altro sito l\'app non compare; aperta da sola sì', async ({ browser }) => {
  const { ctx, page } = await nuovoDispositivo(browser);
  await expect(page.locator('body')).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).display)).not.toBe('none');
  await ctx.route('https://altro-sito.test/**', r => r.fulfill({ contentType: 'text/html', body: `<!doctype html><h1>Altro sito</h1><iframe id="f" src="${BASE}" width="390" height="600"></iframe>` }));
  const p2 = await ctx.newPage();
  // v24b: app.js arriva in ritardo (come dopo una lettura lenta di IndexedDB): la pagina deve essere già nascosta da archivio.js
  let rilascia; const appArrivato = new Promise(r => { rilascia = r; });
  await p2.route('**/app.js', async r => { await appArrivato; await r.fallback(); });
  await p2.goto('https://altro-sito.test/');
  const f = p2.frameLocator('#f');
  await expect(f.locator('#toast')).toBeAttached(); // la pagina è stata caricata…
  const frame = p2.frames().find(x => x.url().startsWith(BASE));
  // v24b: nascosta subito da archivio.js, prima che app.js sia caricato (dopo la lettura di IndexedDB)
  await frame.waitForFunction(() => typeof Archivio !== 'undefined');
  expect(await frame.evaluate(() => [typeof IN_RIQUADRO, getComputedStyle(document.documentElement).display])).toEqual(['undefined', 'none']);
  rilascia();
  await frame.waitForFunction(() => typeof IN_RIQUADRO !== 'undefined');
  expect(await frame.evaluate(() => [IN_RIQUADRO, getComputedStyle(document.documentElement).display])).toEqual([true, 'none']); // …ma resta nascosta
  await expect(f.locator('nav.tabs')).toBeHidden();
});

test.describe('CSP · diagnostica in Impostazioni → Account', () => {
  test('senza blocchi non compare', async ({ browser }) => {
    const { page } = await nuovoDispositivo(browser, { drive: new DriveFinto() });
    await accedi(page);
    await page.click('nav [data-tab=pro]');
    if (await page.evaluate(() => document.querySelector('#cspBox').closest('details')?.open === false)) await page.locator('details:has(#cspBox) > summary').click();
    await expect(page.locator('#accBox')).toBeVisible();
    await expect(page.locator('#cspBox')).toBeHidden();
  });

  test('con un blocco compare: solo il nome del sito, dettagli chiusi, "Copia i dettagli" senza dati personali', async ({ browser }) => {
    consentiBlocchiCsp();
    const { page } = await nuovoDispositivo(browser, { drive: new DriveFinto() });
    await accedi(page);
    // un collegamento a un sito non ammesso, con dati nell'indirizzo (che non devono finire da nessuna parte)
    await page.evaluate(() => { setTimeout(() => { fetch('https://sito-estraneo.test/percorso/privato?token=SEGRETO123&cf=RSSMRA90E12H501X').catch(() => {}); }, 0); });
    await page.click('nav [data-tab=pro]');
    const box = page.locator('#cspBox');
    // la scheda Account è una sezione che parte chiusa (v23, D-010): la apro come farebbe l'utente
    if (await page.evaluate(() => document.querySelector('#cspBox').closest('details')?.open === false)) await page.locator('details:has(#cspBox) > summary').click();
    await expect(box).toBeVisible();
    await expect(box).toHaveAttribute('role', 'region');
    await expect(box).toContainText('Soldirini ha bloccato qualcosa');
    await expect(box).toContainText('ha impedito un caricamento che non riconosce');
    await expect(box.locator('details')).not.toHaveAttribute('open', '');
    await box.locator('summary').click();
    await expect(box.locator('tbody tr')).toHaveCount(1);
    await expect(box.locator('tbody tr td').nth(1)).toHaveText('un collegamento a un sito');
    await expect(box.locator('tbody tr td').nth(2)).toHaveText('sito-estraneo.test');
    expect((await box.locator('#cspCopia').boundingBox()).height).toBeGreaterThanOrEqual(44);
    // un secondo blocco (codice in linea): il conteggio sale e la sezione aperta resta aperta
    await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<img src="x-non-esiste" onerror="1">'));
    await expect(box).toContainText('ha impedito 2 caricamenti');
    await expect(box.locator('details')).toHaveAttribute('open', '');
    await expect(box.locator('tbody tr td').nth(2)).toHaveText('in linea');
    // Copia i dettagli
    await page.evaluate(() => { window.__copiato = null; navigator.clipboard.writeText = async t => { window.__copiato = t; }; });
    await box.locator('#cspCopia').click();
    await expect(page.locator('#toast')).toHaveText('Dettagli copiati.');
    const testo = await page.evaluate(() => window.__copiato);
    const righe = testo.split('\n');
    expect(righe[0]).toBe(`Soldirini ${await page.evaluate(() => APP_VERSIONE)} – blocchi di sicurezza`);
    expect(righe[1]).toMatch(/^\d\d:\d\d · script-src-attr · in linea$/);
    expect(righe[2]).toMatch(/^\d\d:\d\d · connect-src · sito-estraneo\.test$/);
    expect(righe[3]).toMatch(/^Telefono: Chrome \d+ · (Android \d+|Linux|Windows|macOS)$/);
    expect(righe).toHaveLength(4);
    expect(testo).not.toMatch(/SEGRETO|RSSMRA|percorso|token|Mozilla|AppleWebKit|https?:/); // niente indirizzi completi né user agent intero
    // solo in memoria: niente nel telefono e niente nei dati
    expect(await page.evaluate(() => JSON.stringify(localStorage).includes('sito-estraneo') || JSON.stringify(DB).includes('sito-estraneo'))).toBe(false);
  });
});

test.describe('CSP · documenti identici alla 23b', () => {
  // stessi dati inventati nelle due versioni; confronto pixel per pixel delle pagine prima della compressione in PDF
  async function pagine(browser, sito) {
    const { page } = await nuovoDispositivo(browser, { sito });
    return page.evaluate(async () => {
      const pr = D().profilo; Object.assign(pr, { nome: 'Mario', cognome: 'Prova', via: 'Via Inventata 1', residenza: 'Paese di prova', cf: 'PRVMRA80A01H501Z' });
      const p = nuovoProgetto(); p.nome = 'Squadra di prova'; p.colore = '#4a5f8a';
      Object.assign(p.rimborso, { attivo: true, origine: 'Paese di prova', tariffa: 0.4, occasione: 'Allenatore', mansione: 'Allenatore', squadra: 'Under 15' });
      p.rimborso.assoc = { riga1: 'Spett.le', nome: 'Associazione di prova', nomeBig: 'PROVA', via: 'Via Esempio 2', citta: 'Città di prova', cf: '' };
      p.rimborso.luoghi = [{ id: 'l1', nome: 'Palestra di prova', km: 12.5 }];
      Object.assign(p.ore, { attivo: true, tariffa: '15', categoria: 'occasionale' });
      D().progetti[p.id] = p;
      const ev = (id, data, campi) => { D().eventi[id] = Object.assign({ id, pid: p.id, data, tipo: 'allenamento', titolo: '', ore: false, fasce: [], rimborso: false, spese: [], created: 1, updatedAt: 1 }, campi); };
      ev('e1', '2026-10-05', { rimborso: true, km: 25, luogo: 'Palestra di prova', spese: [{ tipo: 'pedaggi', importo: '3.20' }] });
      ev('e2', '2026-10-12', { rimborso: true, km: 25, luogo: 'Palestra di prova' });
      ev('e3', '2026-10-14', { ore: true, fasce: [{ da: '17:00', a: '19:30' }] });
      ev('e4', '2026-10-21', { ore: true, fasce: [{ da: '17:00', a: '19:00' }] });
      const foto = []; const orig = window.html2canvas;
      window.html2canvas = async (...a) => { const c = await orig(...a); foto.push(c.toDataURL('image/png')); return c; };
      try { await pdfRimbBytes(p.id, '2026-10'); const n = foto.length; await pagesToPdf(pagineOre('2026-10')); return { rimborso: foto.slice(0, n), ore: foto.slice(n) }; }
      finally { window.html2canvas = orig; }
    });
  }
  test('ricevuta, nota spese e prospetto ore: stesse pagine, pixel per pixel', async ({ browser }) => {
    const prima = sitoDaCommit(BASE_23B, 'SOLDIRINI_23B');
    test.skip(!prima.sito, prima.motivo);
    const a = await pagine(browser, prima.sito);
    const b = await pagine(browser, SITO);
    expect(a.rimborso.length).toBeGreaterThanOrEqual(2); // ricevuta + nota spese
    expect(a.ore.length).toBeGreaterThanOrEqual(1);
    expect(b.rimborso.length).toBe(a.rimborso.length);
    expect(b.ore.length).toBe(a.ore.length);
    a.rimborso.forEach((x, i) => expect(b.rimborso[i] === x, `pagina ${i + 1} del rimborso`).toBe(true));
    a.ore.forEach((x, i) => expect(b.ore[i] === x, `pagina ${i + 1} del prospetto ore`).toBe(true));
  });
});

test('senza rete: l\'app si apre dalla copia sul telefono e la politica resta attiva', async ({ browser }) => {
  const blocchi = consentiBlocchiCsp();
  const ctx = await browser.newContext({ serviceWorkers: 'allow', locale: 'it-IT' });
  await require('./helpers/google-finto').collega(ctx, {});
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.waitForFunction(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!(r && r.active); }, null, { timeout: 30000 });
  await page.waitForFunction(async () => (await caches.keys()).some(k => k.startsWith('soldirini-')), null, { timeout: 30000 });
  await page.reload(); // ora la pagina è servita dal service worker
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
  await ctx.setOffline(true);
  await page.reload();
  await expect(page.locator('nav.tabs')).toBeVisible();
  expect(await page.evaluate(() => [navigator.onLine, !!navigator.serviceWorker.controller, document.head.children[1].getAttribute('http-equiv')])).toEqual([false, true, 'Content-Security-Policy']);
  await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<img src="x-non-esiste" onerror="window.__img=1">'));
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__img)).toBeUndefined();
  expect(blocchi.some(b => b.direttiva === 'script-src-attr')).toBe(true);
  await ctx.close();
});

// I veri file di Tesseract 5.1.1 (presi dai pacchetti npm, solo in locale) serviti agli stessi indirizzi di jsDelivr:
// controllano che la politica lasci passare worker, motore e dati della lingua (D-055).
const TESS = path.join(__dirname, '.tesseract');
const pacchetto = n => path.join(TESS, n, 'package');
test('Tesseract sotto la CSP: lettura di un\'immagine inventata senza blocchi', async ({ browser }) => {
  const manca = ['tesseract.js-5.1.1', 'tesseract.js-core-5.1.1', 'tesseract.js-data-eng-1.0.0'].filter(n => !fs.existsSync(pacchetto(n)));
  test.skip(manca.length > 0, 'pacchetti di Tesseract non scaricati (vedi test/LEGGIMI.md): ' + manca.join(', '));
  test.setTimeout(180000);
  const { ctx, page } = await nuovoDispositivo(browser);
  const richieste = [];
  const TIPI = { '.js': 'text/javascript', '.wasm': 'application/wasm', '.gz': 'application/gzip' };
  await ctx.route('https://cdn.jsdelivr.net/npm/**', r => {
    const u = new URL(r.request().url()).pathname; richieste.push(u);
    const mappa = [[/^\/npm\/tesseract\.js@v?5\.1\.1\//, 'tesseract.js-5.1.1'], [/^\/npm\/tesseract\.js-core@v5\.1\.1\//, 'tesseract.js-core-5.1.1'], [/^\/npm\/@tesseract\.js-data\/eng\//, 'tesseract.js-data-eng-1.0.0']];
    const m = mappa.find(([re]) => re.test(u));
    const f = m && path.join(pacchetto(m[1]), u.replace(m[0], ''));
    if (!f || !fs.existsSync(f)) return r.fulfill({ status: 404, body: 'non trovato' });
    r.fulfill({ status: 200, contentType: TIPI[path.extname(f)] || 'application/octet-stream', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(f) });
  });
  const testo = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 900; c.height = 260; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 900, 260); g.fillStyle = '#000'; g.font = '48px Arial';
    g.fillText('PROVA LETTURA', 40, 100); g.fillText('SOLDIRINI 2026', 40, 190);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const r = await Buste.testoBusta(new File([blob], 'prova.png', { type: 'image/png' }));
    const visti = new WeakSet(); const testo = (x, d = 0) => typeof x === 'string' ? x : (x && typeof x === 'object' && d < 6 && !visti.has(x) && (visti.add(x), true)) ? Object.values(x).map(v => testo(v, d + 1)).join(' ') : '';
    return testo(r);
  });
  expect(testo).toMatch(/PROVA/);
  expect(testo).toMatch(/SOLDIRINI/);
  // sono passati davvero dai percorsi con la "v" corretti nella politica
  expect(richieste.some(u => u.startsWith('/npm/tesseract.js@v5.1.1/'))).toBe(true);
  expect(richieste.some(u => u.startsWith('/npm/tesseract.js-core@v5.1.1/'))).toBe(true);
  expect(richieste.some(u => u.startsWith('/npm/@tesseract.js-data/eng/'))).toBe(true);
});
