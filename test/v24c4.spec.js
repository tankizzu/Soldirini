// 24c.4: D-128 (la pagina dichiara i due temi: meta color-scheme "light dark" e color-scheme:light sul tema chiaro,
// per il "Force Dark" di Samsung Internet) e D-127 (riquadro "Soldi rimanenti" aperto a ogni apertura, chiudibile).
// Orologio fisso al 17/11/2026. Dati inventati.
const { test, expect } = require('./helpers/prova');
const { BASE, DriveFinto, nuovoDispositivo } = require('./helpers/app');

const OGGI = '2026-11-17T10:00:00+01:00';
async function telefono(browser) {
  const d = await nuovoDispositivo(browser, { drive: new DriveFinto(), ora: OGGI });
  await d.page.waitForFunction(() => window.Entrate && window.Stip15 && window.Pensione); return d;
}
const META = () => [...document.querySelectorAll('meta[name="color-scheme"]')].map(m => m.content);

test.describe('24c.4 · D-128: temi dichiarati al browser', () => {
  test('meta color-scheme "light dark" in tutte le pagine; la CSP resta il secondo elemento', async ({ browser }) => {
    const { page } = await nuovoDispositivo(browser);
    expect(await page.evaluate(META)).toEqual(['light dark']);
    for (const p of ['privacy.html', 'licenze/']) {
      await page.goto(BASE + p); await expect(page.locator('h1')).toBeVisible();
      expect(await page.evaluate(META)).toEqual(['light dark']);
      expect(await page.evaluate(() => document.head.children[1].getAttribute('http-equiv'))).toBe('Content-Security-Policy');
    }
  });

  for (const sistema of ['light', 'dark']) {
    test(`color-scheme della pagina nei tre casi del Tema, telefono in tema ${sistema === 'light' ? 'chiaro' : 'scuro'}`, async ({ browser }) => {
      const { page, errori } = await telefono(browser); await page.emulateMedia({ colorScheme: sistema });
      const prova = tema => page.evaluate(t => { impost().tema = t; applyTema();
        const r = getComputedStyle(document.documentElement); return [r.colorScheme, r.getPropertyValue('--bg').trim(), getComputedStyle(document.body).backgroundColor]; }, tema);
      const [auto, chiaro, scuro] = [await prova('auto'), await prova('light'), await prova('dark')];
      expect(auto[0]).toBe(sistema);
      expect(chiaro[0]).toBe('light only'); // scelto in Impostazioni: il browser non scurisce la pagina da solo expect(chiaro[1]).toBe('#f1f0ee');
      expect(scuro[0]).toBe('dark'); expect(scuro[1]).toBe('#0f1011');
      expect(auto[1]).toBe(sistema === 'light' ? '#f1f0ee' : '#0f1011');
      // il tema dell'app vince su quello del telefono anche per i controlli del browser (campi, barre)
      await page.evaluate(() => { impost().tema = 'light'; applyTema(); });
      const campo = await page.evaluate(() => { const i = document.createElement('input'); document.body.append(i); const c = getComputedStyle(i).colorScheme; i.remove(); return c; });
      expect(campo).toBe('light only');
      expect(errori).toEqual([]);
    });
  }
});

test.describe('24c.4 · D-127: riquadro "Soldi rimanenti" aperto', () => {
  test('aperto all\'avvio (Mese e Anno); un tocco lo chiude; tornando da un\'altra scheda è di nuovo aperto; dalle sue pagine resta com\'era', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    const rim = page.locator('#rieTot .rim'), det = page.locator('#heroDet');
    await page.click('.tabs button[data-tab="rie"]');
    await expect(det).toBeVisible(); await expect(rim).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#rieTot .hero')).toHaveClass(/aperto/);
    await rim.click(); await expect(det).toBeHidden(); await expect(rim).toHaveAttribute('aria-expanded', 'false');
    // in una pagina dei blocchi e ritorno con "Indietro": resta chiuso, come l'ha lasciato
    await page.evaluate(() => vaiA('dfx')); await page.locator('#v-dfx .indietro, .indietro:visible').first().click();
    await expect(page.locator('#rieTot')).toBeVisible(); await expect(det).toBeHidden();
    // un'altra scheda e ritorno: di nuovo aperto
    await page.click('.tabs button[data-tab="cal"]'); await page.click('.tabs button[data-tab="rie"]');
    await expect(det).toBeVisible(); await expect(rim).toHaveAttribute('aria-expanded', 'true');
    // vista Anno: aperto anche lì
    await page.evaluate(() => { rieMode = 'anno'; render(); }); await expect(det).toBeVisible();
    // riaprendo l'app: aperto
    await rim.click(); await expect(det).toBeHidden();
    await page.reload(); await page.waitForFunction(() => window.Entrate && window.Stip15);
    await page.click('.tabs button[data-tab="rie"]'); await expect(page.locator('#heroDet')).toBeVisible();
    expect(errori).toEqual([]);
  });
});

test.describe('24c.4 · D-130: ripartire da dove si era rimasti', () => {
  const ricarica = async page => { await page.reload(); await page.waitForFunction(() => window.Entrate && window.Stip15 && window.Pensione && window.Archivio && Archivio.avviata); };
  const dove = page => page.evaluate(() => ({ tab, cur, rieMode, sezione: [...document.querySelectorAll('main > section')].filter(s => !s.hidden).map(s => s.id) }));
  test('stessa scheda dopo la ricarica (Calendario, Riepilogo, Impostazioni); le finestre non si riaprono', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    expect(await dove(page)).toMatchObject({ tab: 'cal', cur: '2026-11', sezione: ['v-cal'] }); // primo avvio: come sempre
    for (const t of ['rie', 'pro', 'cal', 'rie']) {
      await page.click(`.tabs button[data-tab="${t}"]`); await ricarica(page);
      expect(await dove(page)).toMatchObject({ tab: t, sezione: ['v-' + t] });
      await expect(page.locator(`.tabs button[data-tab="${t}"]`)).toHaveClass(/\bon\b/);
    }
    await page.evaluate(() => openEv(['2026-11-04'])); await expect(page.locator('#evModal')).toBeVisible();
    await ricarica(page); await expect(page.locator('#evModal')).toBeHidden(); expect((await dove(page)).tab).toBe('rie');
    await expect(page.locator('#heroDet')).toBeVisible(); // D-127: riquadro aperto
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('soldirini-posto')))).toEqual({ tab: 'rie', sub: null, cur: '2026-11', rieMode: 'mese' });
    expect(errori).toEqual([]);
  });

  test('stessa pagina dei blocchi, con "Indietro" che torna al Riepilogo; stesso mese passato e vista Anno', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.click('.tabs button[data-tab="rie"]'); await page.evaluate(() => { cur = '2026-09'; render(); vaiA('dlav'); });
    await ricarica(page);
    expect(await dove(page)).toMatchObject({ tab: 'dlav', cur: '2026-09', rieMode: 'mese', sezione: ['v-dlav'] });
    await expect(page.locator('#v-dlav .pgper')).toHaveText('settembre 2026');
    await page.locator('#v-dlav .indietro').click();
    expect(await dove(page)).toMatchObject({ tab: 'rie', sezione: ['v-rie'] });
    // vista Anno in un anno passato
    await page.evaluate(() => { cur = '2025-03'; rieMode = 'anno'; render(); }); await ricarica(page);
    expect(await dove(page)).toMatchObject({ tab: 'rie', cur: '2025-03', rieMode: 'anno' });
    await expect(page.locator('#rieSeg [data-m="anno"]')).toHaveClass(/\bon\b/);
    // pagina Tasse (sottopagina vecchia) e ritorno con il tasto Indietro del telefono
    await page.evaluate(() => vaiA('tas')); await ricarica(page);
    expect((await dove(page)).tab).toBe('tas');
    await page.evaluate(() => history.back()); await expect(page.locator('#v-rie')).toBeVisible();
    expect(errori).toEqual([]);
  });

  test('dati del telefono cancellati o rovinati: si parte come sempre', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.click('.tabs button[data-tab="pro"]');
    for (const v of [null, '{rotto', JSON.stringify({ tab: '<b>', sub: 'xx"y', cur: '2026-13', rieMode: 'boh' })]) {
      await page.evaluate(v => { if (v == null) localStorage.removeItem('soldirini-posto'); else localStorage.setItem('soldirini-posto', v); }, v);
      await page.evaluate(() => { postoPronto = false; }); // la pagina non riscrive prima della ricarica
      await ricarica(page);
      expect(await dove(page)).toMatchObject({ tab: 'cal', cur: '2026-11', rieMode: 'mese', sezione: ['v-cal'] });
      await page.click('.tabs button[data-tab="pro"]');
    }
    expect(errori).toEqual([]);
  });
});
