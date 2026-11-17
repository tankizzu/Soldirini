// v23 "Ordine, leggibilità e consenso" (compito 01-sviluppo-v23.md, D-010, D-017, D-024, D-043, D-045).
// Tutti i dati sono inventati.
const { test, expect } = require('@playwright/test');
const { DriveFinto, CalendarFinto, nuovoDispositivo, accedi } = require('./helpers/app');

const oggi = () => new Date().toISOString().slice(0, 10);
async function conLavoro(page, modo = 'turni', nome = 'Reparto di prova') {
  return page.evaluate(([modo, nome]) => { const l = Stip15.nuovoLavoro(modo); l.nome = nome; l.dal = '2026-01-01';
    if (modo === 'fisso') for (const d of [1, 2, 3, 4, 5]) l.settimana[d] = { da: '09:00', a: '17:00', pausa: '60' };
    D().lavori[l.id] = l; changed(); render(); return l.id; }, [modo, nome]);
}
const aperte = (page, sel) => page.evaluate(s => [...document.querySelectorAll(s + ' details')].filter(d => d.open).length, sel);

// ================= A. sezioni chiuse a ogni apertura (D-010) =================
test.describe('A · sezioni chiuse a ogni apertura', () => {
  test('Impostazioni: all\'apertura nessuna sezione è aperta; riaprendo la pagina si richiudono', async ({ browser }) => {
    const { page, errori } = await nuovoDispositivo(browser, { drive: new DriveFinto() });
    await accedi(page);
    await page.click('nav [data-tab=pro]');
    expect(await aperte(page, '#v-pro')).toBe(0);
    await page.locator('#foldLav > summary').click();
    await page.locator('#foldFix > summary').click();
    expect(await aperte(page, '#v-pro')).toBe(2);
    await page.evaluate(() => render()); // un aggiornamento mentre resto nella pagina non le richiude
    expect(await aperte(page, '#v-pro')).toBe(2);
    await page.click('nav [data-tab=cal]'); await page.click('nav [data-tab=pro]');
    expect(await aperte(page, '#v-pro')).toBe(0);
    // le vecchie memorie non ci sono più, né sul telefono né nei dati
    expect(await page.evaluate(() => [localStorage.getItem('soldirini-sez'), localStorage.getItem('soldirini-foldpro'), DB.meta.fold ?? null])).toEqual([null, null, null]);
    expect(errori).toEqual([]);
  });

  test('Riepilogo: i riquadri partono chiusi, restano aperti durante la visita e si richiudono riaprendo l\'app', async ({ browser }) => {
    const { page } = await nuovoDispositivo(browser, { drive: new DriveFinto() });
    await accedi(page); await conLavoro(page, 'fisso', 'Ufficio di prova');
    await page.click('nav [data-tab=rie]');
    await expect(page.locator('#v-rie details.fold').first()).toBeVisible();
    expect(await aperte(page, '#v-rie')).toBe(0);
    await page.locator('#v-rie details.fold > summary').first().click();
    expect(await aperte(page, '#v-rie')).toBe(1);
    await page.evaluate(() => render());
    expect(await aperte(page, '#v-rie')).toBe(1);
    // una vecchia memoria (versioni precedenti) viene tolta all'avvio
    await page.evaluate(() => { DB.meta.fold = { 'rie:x': true }; persist(); localStorage.setItem('soldirini-sez', '{"lav":true}'); });
    await page.reload(); await page.waitForFunction(() => typeof Pensione === 'object');
    await page.click('nav [data-tab=rie]');
    expect(await aperte(page, '#v-rie')).toBe(0);
    expect(await page.evaluate(() => [DB.meta.fold ?? null, localStorage.getItem('soldirini-sez')])).toEqual([null, null]);
  });

  test('Nuova attività: sezioni chiuse; modificando un\'attività si apre solo quella in modifica', async ({ browser }) => {
    const { page } = await nuovoDispositivo(browser, { drive: new DriveFinto() });
    await accedi(page); await conLavoro(page);
    await page.evaluate(d => openEv([d]), oggi());
    expect(await aperte(page, '#evModal')).toBe(0);
    await page.locator('#secLav > summary').click(); await page.click('#evClose');
    await page.evaluate(d => openEv([d]), oggi());
    expect(await aperte(page, '#evModal')).toBe(0); // non ricorda la volta prima
  });

  test('Nuova attività: si salva ciò che è compilato, anche con le sezioni richiuse; la sezione con un errore si apre', async ({ browser }) => {
    const { page } = await nuovoDispositivo(browser, { drive: new DriveFinto() });
    await accedi(page); const lid = await conLavoro(page);
    const d = oggi();
    await page.evaluate(d => openEv([d]), d);
    // lavoro: tocco "Mattina" e richiudo la sezione
    await page.locator('#secLav > summary').click();
    await page.click('#evLav [data-lt]:not([data-lt=""])');
    await page.locator('#secLav > summary').click();
    // spesa: scrivo l'importo e richiudo la sezione senza toccare "+ Aggiungi spesa"
    await page.locator('#secSpese > summary').click();
    await page.fill('#spPImp', '4,50');
    await page.locator('#secSpese > summary').click();
    expect(await aperte(page, '#evModal')).toBe(0);
    await page.click('#evSave');
    await expect(page.locator('#evModal')).toBeHidden();
    const r = await page.evaluate(([lid, d]) => [turniDi(lid).filter(t => t.data === d).length, Object.values(D().spesePers || {}).filter(s => s.data === d).map(s => s.importo)], [lid, d]);
    expect(r).toEqual([1, [4.5]]);
    // errore: "Orario diverso" senza orario né ore → la sezione Lavoro si riapre da sola
    await page.evaluate(d => openEv([d]), d);
    await page.locator('#secLav > summary').click();
    await page.click('#evLav [data-lt=""]');
    await page.locator('#secLav > summary').click();
    await page.click('#evSave');
    await expect(page.locator('#secLav')).toHaveAttribute('open', '');
    await expect(page.locator('#evModal')).toBeVisible();
  });

  test('finestra Lavoro e finestra Progetto: sezioni chiuse a ogni apertura', async ({ browser }) => {
    const { page } = await nuovoDispositivo(browser, { drive: new DriveFinto() });
    await accedi(page); const lid = await conLavoro(page, 'fisso');
    await page.evaluate(id => { tab = 'pro'; render(); document.querySelector(`[data-lav="${id}"]`).click(); }, lid);
    await expect(page.locator('#lvModal')).toBeVisible();
    expect(await aperte(page, '#lvModal')).toBe(0);
    await page.locator('#lvPagaBox > summary').click(); await page.click('#lvClose');
    await page.evaluate(id => document.querySelector(`[data-lav="${id}"]`).click(), lid);
    expect(await aperte(page, '#lvModal')).toBe(0);
    await page.click('#lvClose');
    await page.evaluate(() => openProj(null));
    await expect(page.locator('#pjModal')).toBeVisible();
    await page.evaluate(() => document.querySelectorAll('#pjModal details').forEach(d => d.open = true));
    await page.click('#pjClose');
    await page.evaluate(() => openProj(null));
    expect(await aperte(page, '#pjModal')).toBe(0);
  });
});

// ================= B. contrasti e tocchi =================
test.describe('B · contrasti e tocchi', () => {
  test('a 390 px i comandi piccoli misurano almeno 44 × 44 px', async ({ browser }) => {
    const { page } = await nuovoDispositivo(browser, { drive: new DriveFinto() });
    await accedi(page); await conLavoro(page);
    const misura = sel => page.evaluate(s => [...document.querySelectorAll(s)].filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return [s, Math.round(r.width), Math.round(r.height)]; }), sel);
    let tutti = [];
    for (const s of ['nav.tabs button', '#prev', '#next', '#listBtn', '#oggi', '#occhio', '#sync']) tutti = tutti.concat(await misura(s));
    await page.evaluate(d => openEv([d]), oggi());
    await page.locator('#secSpese > summary').click(); await page.locator('#secLav > summary').click();
    for (const s of ['#evClose', '#evModal .spcats .chip', '#evLav .chip', '#evFotoBtn']) tutti = tutti.concat(await misura(s));
    await page.click('#evClose');
    await page.evaluate(() => openProj(null));
    for (const s of ['#pjColori .sw', '#pjClose']) tutti = tutti.concat(await misura(s));
    expect(tutti.length).toBeGreaterThan(20);
    const piccoli = tutti.filter(([, w, h]) => w < 44 || h < 44);
    expect(piccoli).toEqual([]);
  });

  test('contrasti nei due temi: testo ≥ 4,5:1, bordo dei campi ≥ 3:1', async ({ browser }) => {
    const { page } = await nuovoDispositivo(browser, { drive: new DriveFinto() });
    await accedi(page);
    for (const tema of ['light', 'dark']) {
      const r = await page.evaluate(async t => {
        document.documentElement.dataset.theme = t; document.body.style.transition = 'none';
        await new Promise(r => setTimeout(r, 400));
        const cv = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
        // colore reale come lo vede l'occhio: dipinto sopra lo sfondo (gestisce trasparenze e ogni formato di colore)
        const rgb = (s, sotto) => { cv.clearRect(0, 0, 1, 1); for (const c of [getComputedStyle(document.documentElement).getPropertyValue('--card').trim(), ...(sotto ? [`rgb(${sotto.join(',')})`] : []), s]) { cv.fillStyle = '#000'; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); } return [...cv.getImageData(0, 0, 1, 1).data].slice(0, 3); };
        const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
        const ctr = (a, b) => { const B = rgb(b); const [x, y] = [lum(rgb(a, B)), lum(B)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
        const card = getComputedStyle(document.documentElement).getPropertyValue('--card').trim();
        const fondo = el => { for (let p = el; p; p = p.parentElement) { const b = getComputedStyle(p).backgroundColor; if (b !== 'rgba(0, 0, 0, 0)' && b !== 'transparent') return b; } return getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(); };
        const prova = html => { const d = document.createElement('div'); d.className = 'card'; d.innerHTML = html; document.querySelector('main').appendChild(d); return d; };
        const box = prova('<span class="bdg ok">✓ salvata</span><span class="bdg warn">⚠ da completare</span><b style="color:var(--err)">errore</b><b style="color:var(--ok)">ok</b><input id="zzIn">');
        const cs = sel => getComputedStyle(box.querySelector(sel));
        const tab = document.querySelector('nav.tabs button.on');
        const out = {
          ok: ctr(cs('.bdg.ok').color, cs('.bdg.ok').backgroundColor), warn: ctr(cs('.bdg.warn').color, cs('.bdg.warn').backgroundColor),
          err: ctr(cs('[style*="--err"]').color, card), okTesto: ctr(cs('[style*="--ok"]').color, card),
          tab: ctr(getComputedStyle(tab).color, fondo(tab)),
          bordo: ctr(cs('#zzIn').borderTopColor, card) };
        box.remove(); return out; }, tema);
      for (const k of ['ok', 'warn', 'err', 'okTesto', 'tab']) expect(r[k], `${tema} ${k}`).toBeGreaterThanOrEqual(4.5);
      expect(r.bordo, `${tema} bordo`).toBeGreaterThanOrEqual(3);
    }
  });
});

// ================= C. consenso Google Calendar e malattia come "Assenza" =================
test.describe('C · Google Calendar', () => {
  // in Impostazioni il riquadro "Google Calendar" è una sezione che parte chiusa (v23, D-010): la apro come farebbe l'utente
  async function apriCardGcal(page) {
    const aperta = await page.evaluate(() => document.querySelector('#gcalBody').closest('details')?.open ?? true);
    if (!aperta) await page.locator('details:has(#gcalBody) > summary').click();
  }
  async function apriConsenso(page) {
    await page.click('nav [data-tab=pro]');
    await apriCardGcal(page);
    await page.click('#gcalOn');
    await expect(page.locator('#gcModal')).toBeVisible();
  }

  test('finestra di consenso vera, con i blocchi visibili, pulsanti da 44 px non preselezionati; "Non ora" non cambia niente', async ({ browser }) => {
    const calendar = new CalendarFinto();
    const { page, errori } = await nuovoDispositivo(browser, { drive: new DriveFinto(), calendar });
    await accedi(page);
    await apriConsenso(page);
    const dlg = page.locator('#gcModal [role=dialog]');
    await expect(dlg).toHaveAttribute('aria-labelledby', 'gcTit');
    await expect(page.locator('#gcTit')).toHaveText('Collegare Google Calendar?');
    for (const t of ['Cosa fa', 'Cosa non fa', 'Da sapere', 'Puoi tornare indietro quando vuoi']) await expect(dlg.getByRole('heading', { name: t })).toBeVisible();
    await expect(dlg).toContainText('comprese ferie, permessi e assenze');
    await expect(dlg).toContainText('I giorni di malattia compaiono come “Assenza”');
    await expect(dlg.getByRole('link', { name: 'Leggi l’informativa privacy' })).toHaveAttribute('href', 'privacy.html');
    for (const id of ['#gcNo', '#gcSi']) expect((await page.locator(id).boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => ['gcSi', 'gcNo'].includes(document.activeElement?.id))).toBe(false);
    await page.click('#gcNo');
    await expect(page.locator('#gcModal')).toBeHidden();
    expect(await page.evaluate(() => !!(D().gcal?.cfg?.attivo))).toBe(false);
    expect(calendar.registro).toEqual([]);
    expect(errori).toEqual([]);
  });

  test('senza accesso: la finestra chiede di accedere con Google', async ({ browser }) => {
    const { page } = await nuovoDispositivo(browser);
    await page.click('#skipW');
    await apriConsenso(page);
    await expect(page.locator('#gcNoAcc')).toHaveText('Per usare Google Calendar devi prima accedere con Google.');
    await expect(page.locator('#gcSi')).toHaveText('Accedi con Google');
  });

  test('schermata di Google chiusa o permesso negato: messaggio chiaro, Calendar resta spento', async ({ browser }) => {
    const calendar = new CalendarFinto();
    const { page } = await nuovoDispositivo(browser, { drive: new DriveFinto(), calendar });
    await accedi(page);
    for (const rifiuto of ['popup_closed', 'access_denied']) {
      await page.evaluate(r => { window.__gsiRifiuto = r; }, rifiuto);
      await apriConsenso(page);
      await page.click('#gcSi');
      await expect(page.locator('#toast')).toHaveText('Non hai dato il permesso: Google Calendar resta spento. Puoi riprovare quando vuoi.');
      expect(await page.evaluate(() => !!(D().gcal?.cfg?.attivo))).toBe(false);
    }
    expect(calendar.registro).toEqual([]);
  });

  test('malattia: di base "Assenza" senza note; con la scelta in Impostazioni diventa "Malattia"', async ({ browser }) => {
    const calendar = new CalendarFinto();
    const { page, errori } = await nuovoDispositivo(browser, { drive: new DriveFinto(), calendar });
    await accedi(page);
    const lid = await conLavoro(page);
    const d = oggi();
    await page.evaluate(([lid, d]) => { const l = D().lavori[lid]; const t = l.tipi.find(x => x.nome === 'Malattia');
      const id = uid(); D().turni = D().turni || {}; D().turni[id] = { id, lid, data: d, tipo: t.id, da: '', a: '', pausa: '', ore: '', nota: 'febbre', updatedAt: Date.now() }; changed(); }, [lid, d]);
    await apriConsenso(page);
    await page.click('#gcSi');
    await expect(page.locator('#toast')).toContainText(/Google Calendar attivo: \d+ attivit/);
    const eventi = () => Object.values(calendar.cal).flatMap(c => Object.values(c.ev));
    let mal = eventi().filter(e => e.start.date === d || (e.start.dateTime || '').startsWith(d));
    expect(mal.map(e => [e.summary, e.description])).toEqual([['Assenza · Reparto di prova', '']]);
    expect(JSON.stringify(eventi())).not.toMatch(/Malattia|febbre|🤒/);
    // la scelta facoltativa, con conferma
    await apriCardGcal(page);
    await page.locator('#gcalMal').click(); // apre la conferma: il riquadro si ridisegna dopo la scelta
    await expect(page.locator('#dlgMsg')).toContainText('Scrivere “Malattia” nel calendario?');
    await page.getByRole('button', { name: 'Scrivi “Malattia”' }).click();
    await expect(page.locator('#toast')).toHaveText('Calendario aggiornato: i giorni di malattia ora si chiamano «Malattia».');
    mal = eventi().filter(e => e.start.date === d || (e.start.dateTime || '').startsWith(d));
    expect(mal[0].summary).toMatch(/Malattia · Reparto di prova/);
    expect(mal[0].description).toBe('febbre');
    // spegnendola torna "Assenza", senza conferma
    await page.locator('#gcalMal').click();
    await expect(page.locator('#toast')).toHaveText('Calendario aggiornato: i giorni di malattia ora si chiamano «Assenza».');
    expect(eventi().filter(e => e.start.date === d)[0].summary).toBe('Assenza · Reparto di prova');
    expect(errori).toEqual([]);
  });
});

// ================= D. Turni da foto in "Nuova attività" (D-043) =================
test.describe('D · Turni da foto', () => {
  test('compare con un lavoro a turni e apre la lettura della foto; non compare con solo orario fisso', async ({ browser }) => {
    const { page } = await nuovoDispositivo(browser, { drive: new DriveFinto() });
    await accedi(page);
    await conLavoro(page, 'fisso', 'Ufficio');
    await page.evaluate(d => openEv([d]), oggi());
    await expect(page.locator('#evFotoBtn')).toBeHidden();
    await page.click('#evClose');
    const lid = await conLavoro(page, 'turni', 'Reparto A');
    await page.evaluate(d => openEv([d]), oggi());
    await expect(page.locator('#evFotoBtn')).toBeVisible();
    await page.click('#evFotoBtn');
    await expect(page.locator('#ftModal')).toBeVisible();
    await expect(page.locator('#evModal')).toBeHidden();
    expect(await page.locator('#ftLav').inputValue()).toBe(lid);
  });

  test('con più lavori a turni chiede quale', async ({ browser }) => {
    const { page } = await nuovoDispositivo(browser, { drive: new DriveFinto() });
    await accedi(page);
    await conLavoro(page, 'turni', 'Reparto A'); const b = await conLavoro(page, 'turni', 'Reparto B');
    await page.evaluate(d => openEv([d]), oggi());
    await page.click('#evFotoBtn');
    await expect(page.locator('#dlgMsg')).toHaveText('Per quale lavoro sono i turni della foto?');
    await page.getByRole('button', { name: 'Reparto B' }).click();
    await expect(page.locator('#ftModal')).toBeVisible();
    expect(await page.locator('#ftLav').inputValue()).toBe(b);
  });
});
