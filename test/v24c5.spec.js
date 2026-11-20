// 24c.5 (D-132, rivista con D-137): colori giusti su tutti i telefoni, in silenzio. Tema scuro dell'app nel browser Samsung
// con "Come il telefono" e meta darkreader-lock; nessun avviso e nessuna diagnostica per l'utente. Prove anche con il "Force Dark"
// di Chromium (--blink-settings=forceDarkModeEnabled=true, lo stesso motore del browser Samsung) e lo user agent di Samsung.
// Orologio fisso al 17/11/2026. Dati inventati.
const { test, expect, chromium } = require('@playwright/test');
const prova = require('./helpers/prova');
const { DriveFinto, nuovoDispositivo } = require('./helpers/app');

const OGGI = '2026-11-17T10:00:00+01:00';
const UA_SAMSUNG = 'Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36';
const UA_CHROME = 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
async function telefono(browser, contesto) {
  const d = await nuovoDispositivo(browser, { drive: new DriveFinto(), ora: OGGI, contesto });
  await d.page.waitForFunction(() => window.Entrate && window.Stip15 && window.Pensione); return d;
}
const tema = (page, t) => page.evaluate(t => { impost().tema = t; applyTema(); const r = document.documentElement;
  return { theme: r.dataset.theme || '', bg: getComputedStyle(r).getPropertyValue('--bg').trim(), cs: getComputedStyle(r).colorScheme }; }, t);
// colore vero di un punto dello schermo (dopo il filtro del browser): la fotografia letta in una pagina vuota
async function pixel(page, x, y) {
  const png = (await page.screenshot()).toString('base64');
  const p = await page.context().newPage();
  const c = await p.evaluate(async ([b, x, y]) => { const i = new Image(); i.src = 'data:image/png;base64,' + b; await i.decode();
    const k = document.createElement('canvas'); k.width = i.width; k.height = i.height; const g = k.getContext('2d'); g.drawImage(i, 0, 0);
    return [...g.getImageData(x, y, 1, 1).data].slice(0, 3); }, [png, x, y]);
  await p.close(); return c;
}

prova.test.describe('24c.5 · D-132: browser Samsung', () => {
  for (const sistema of ['light', 'dark']) {
    prova.test(`browser Samsung, telefono ${sistema === 'light' ? 'chiaro' : 'scuro'}: "Come il telefono" usa il tema scuro dell'app; Chiaro e Scuro restano quelli scelti`, async ({ browser }) => {
      const { page, errori } = await telefono(browser, { userAgent: UA_SAMSUNG, colorScheme: sistema });
      expect(await tema(page, 'auto')).toEqual({ theme: 'dark', bg: '#0f1011', cs: 'dark' });
      expect(await tema(page, 'light')).toEqual({ theme: 'light', bg: '#f1f0ee', cs: 'light only' });
      expect(await tema(page, 'dark')).toEqual({ theme: 'dark', bg: '#0f1011', cs: 'dark' });
      expect(errori).toEqual([]);
    });
  }

  prova.test('altri browser: "Come il telefono" segue il telefono come prima (24c.4)', async ({ browser }) => {
    for (const sistema of ['light', 'dark']) {
      const { page, errori } = await telefono(browser, { userAgent: UA_CHROME, colorScheme: sistema });
      const t = await tema(page, 'auto');
      expect(t.theme).toBe(''); expect(t.bg).toBe(sistema === 'light' ? '#f1f0ee' : '#0f1011');
      expect(errori).toEqual([]);
    }
  });

  prova.test('meta darkreader-lock nella pagina', async ({ browser }) => {
    const { page } = await telefono(browser);
    expect(await page.evaluate(() => document.querySelectorAll('meta[name="darkreader-lock"]').length)).toBe(1);
  });

  prova.test('D-137: nel browser Samsung nessun avviso e, in Impostazioni → Account, nessuna sezione nuova rispetto a Chrome', async ({ browser }) => {
    const vista = async ua => {
      const { page, errori } = await telefono(browser, { userAgent: ua, colorScheme: 'dark' });
      // in cima alla pagina: solo gli elementi di prima (nessun avviso nuovo)
      const main = await page.evaluate(() => [...document.querySelector('main').children].map(e => e.id || e.className));
      await page.click('.tabs button[data-tab="pro"]');
      const acc = await page.evaluate(() => { const c = document.getElementById('accBox').closest('.card'); c.querySelectorAll('details').forEach(d => d.open = true);
        return { sezioni: [...c.querySelectorAll('summary')].map(s => s.textContent.trim()), testo: c.innerText }; });
      const testo = await page.evaluate(() => document.body.innerText);
      expect(errori).toEqual([]); await page.context().close();
      return { main, acc, testo };
    };
    const sam = await vista(UA_SAMSUNG), chr = await vista(UA_CHROME);
    expect(sam.main).toEqual(chr.main);
    expect(sam.acc.sezioni).toEqual(chr.acc.sezioni);
    for (const t of [sam.testo, sam.acc.testo]) expect(t).not.toMatch(/Samsung|Controllo dei colori|Copia i dettagli|colori strani/i);
    expect(await (async () => { const { page } = await telefono(browser, { userAgent: UA_SAMSUNG });
      return page.evaluate(() => ['coloriBox', 'samAvviso'].filter(id => document.getElementById(id))); })()).toEqual([]);
  });
});

// Force Dark di Chromium: browser a parte con l'impostazione accesa
test.describe('24c.5 · D-132 con il "Force Dark" di Chromium', () => {
  test('browser Samsung con il filtro acceso, telefono chiaro: la pagina è scura con i colori dell\'app, non quelli del filtro', async () => {
    const b = await chromium.launch({ args: ['--blink-settings=forceDarkModeEnabled=true'] });
    try {
      const { page, errori } = await telefono(b, { userAgent: UA_SAMSUNG, colorScheme: 'light' });
      await page.click('.tabs button[data-tab="pro"]'); await page.waitForTimeout(300);
      // fondo della pagina vicino al bordo: #0f1011 del tema scuro dell'app (il filtro lascia stare una pagina già scura)
      const [r, g, bl] = await pixel(page, 3, 600);
      expect(Math.max(Math.abs(r - 0x0f), Math.abs(g - 0x10), Math.abs(bl - 0x11))).toBeLessThanOrEqual(3);
      expect(errori).toEqual([]);
      // per confronto, Chrome con lo stesso filtro e il tema chiaro dell'app: il fondo non è più quello dell'app (#f1f0ee)
      const c = await telefono(b, { userAgent: UA_CHROME, colorScheme: 'light' });
      await c.page.click('.tabs button[data-tab="pro"]'); await c.page.waitForTimeout(300);
      const [r2] = await pixel(c.page, 3, 600);
      expect(r2).toBeLessThan(0xf1 - 40); // scurito dal filtro: è il caso che il browser Samsung non lascia correggere
    } finally { await b.close(); }
  });
});
