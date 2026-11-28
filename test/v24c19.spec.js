// 24c.19 (D-183): nella pagina Risparmi ogni sezione si riduce come nel resto dell'app, chiusa a ogni apertura (D-010).
// Solo dati inventati (D-089).
const { test, expect } = require('./helpers/prova');
const { DriveFinto, nuovoDispositivo, dopoAvvio } = require('./helpers/app');

async function telefono(browser) {
  const d = await nuovoDispositivo(browser, { drive: new DriveFinto(), ora: '2026-12-20T10:00:00+01:00', telefono: true });
  await d.page.waitForFunction(() => window.Risparmi && window.Archivio && Archivio.avviata);
  await d.page.evaluate(() => { DB.meta.skipWelcome = true; changed(); render(); });
  await dopoAvvio(d.page); // 24c.18: il controllo a tempo di entrate.js è già passato
  return d;
}
const dati = page => page.evaluate(() => {
  D().risparmi = { 'ob:o1': { nome: 'Vacanze', target: '1000', entro: '2027-06', updatedAt: 1 },
    'mv:m1': { data: '2026-12-02', importo: '100', ob: 'o1', nota: '', updatedAt: 1 },
    'mv:m2': { data: '2026-11-10', importo: '50', ob: '', nota: 'prova', updatedAt: 1 } };
  changed(); vaiA('ris'); });
const sezioni = page => page.locator('#risBody > details.fold');
const sezione = (page, t) => page.locator('#risBody > details.fold', { has: page.locator('summary', { hasText: t }) });
const TITOLI = ['🐷 Metti da parte o preleva', '🎯 Obiettivi', '📊 Andamento 2026', '📒 Movimenti']; // 24c.20: icone di 02 (tornata 62 §4)

test.describe('24c.19 · D-183 pagina Risparmi con le sezioni riducibili', () => {
  test('aprendo la pagina: quattro sezioni chiuse, nell\'ordine di sempre; il riquadro in alto resta visibile; "Andamento" ha il totale dell\'anno nel titolo', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await dati(page);
    await expect(sezioni(page)).toHaveCount(4);
    expect(await page.locator('#risBody > details.fold > summary .st').allTextContents()).toEqual(TITOLI);
    expect(await page.evaluate(() => [...document.querySelectorAll('#risBody details')].filter(d => d.open).length)).toBe(0);
    await expect(page.locator('#risBody .hero')).toBeVisible();
    await expect(page.locator('#risBody .hero b')).toHaveText('150,00 €');
    await expect(sezione(page, 'Andamento').locator('summary .sum')).toHaveText('150,00 €');
    for (const s of ['#rsMv', '#rsPrel', '#rsTogli', '#rsOb', '[data-obed="o1"]', '[data-mved="m1"]']) await expect(page.locator(s)).toBeHidden();
    // il contenuto c'è tutto, solo nascosto
    await expect(sezione(page, 'Obiettivi')).toContainText('Vacanze');
    await expect(sezione(page, 'Movimenti').locator('[data-mved]')).toHaveCount(2);
    expect(errori).toEqual([]);
  });

  test('le sezioni aperte restano aperte mentre si resta nella pagina (salvataggi, scelta D-169); cambiando pagina o ricaricando tornano chiuse; i dati non cambiano aprendo e chiudendo', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await dati(page);
    const prima = await page.evaluate(() => JSON.stringify(D()));
    for (const t of TITOLI) { await sezione(page, t).locator('summary').click(); await expect(sezione(page, t)).toHaveAttribute('open', ''); }
    for (const t of TITOLI) await sezione(page, t).locator('summary').click();
    expect(await page.evaluate(() => JSON.stringify(D()))).toBe(prima);
    // un nuovo obiettivo dalla sezione aperta: dopo il salvataggio la sezione resta aperta e lo mostra
    await sezione(page, 'Obiettivi').locator('summary').click();
    await page.click('#rsOb');
    await page.locator('#obNome').fill('Auto'); await page.locator('#obTarget').fill('3000'); await page.click('#obSave');
    await expect(page.locator('#obModal')).toBeHidden();
    await expect(sezione(page, 'Obiettivi')).toHaveAttribute('open', '');
    await expect(sezione(page, 'Obiettivi')).toContainText('Auto');
    // la scelta D-169 ridisegna la pagina: le due sezioni aperte restano aperte, le altre chiuse
    await sezione(page, 'Metti da parte').locator('summary').click();
    await page.locator('#rsTogli').check();
    expect(await page.evaluate(() => impost().salvaToglie)).toBe(true);
    expect(await page.evaluate(() => [...document.querySelectorAll('#risBody > details.fold')].map(d => d.open))).toEqual([true, true, false, false]);
    // un movimento dalla sezione aperta
    await page.click('#rsMv'); await page.locator('#mvImp').fill('20'); await page.locator('#mvData').fill('2026-12-19'); await page.click('#mvSave');
    await expect(page.locator('#mvModal')).toBeHidden();
    expect(await page.evaluate(() => [...document.querySelectorAll('#risBody > details.fold')].map(d => d.open))).toEqual([true, true, false, false]);
    // altra pagina e ritorno: tutte chiuse (D-010)
    await page.evaluate(() => vaiA('rie'));
    await page.evaluate(() => vaiA('ris'));
    expect(await page.evaluate(() => [...document.querySelectorAll('#risBody details')].filter(d => d.open).length)).toBe(0);
    // ricaricando: chiuse, e niente di ricordato sul telefono
    await sezione(page, 'Movimenti').locator('summary').click();
    await page.reload();
    await page.waitForFunction(() => window.Risparmi && Archivio.avviata);
    await page.evaluate(() => vaiA('ris'));
    await expect(sezioni(page)).toHaveCount(4);
    expect(await page.evaluate(() => [...document.querySelectorAll('#risBody details')].filter(d => d.open).length)).toBe(0);
    expect(await page.evaluate(() => [!!DB.meta.fold, Object.keys(localStorage).filter(k => /fold|sez/i.test(k))])).toEqual([false, []]);
    expect(errori).toEqual([]);
  });

  test('tastiera e numeri nascosti: il titolo si apre con Invio; con «Nascondi i numeri» anche il totale nel titolo è sfocato; con le animazioni ridotte nessun errore', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await dati(page);
    const s = sezione(page, 'Movimenti').locator('summary');
    await s.focus(); await page.keyboard.press('Enter');
    await expect(sezione(page, 'Movimenti')).toHaveAttribute('open', '');
    await expect(page.locator('[data-mved="m1"]')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(sezione(page, 'Movimenti')).not.toHaveAttribute('open', '');
    await page.evaluate(() => document.body.classList.add('nascondi'));
    expect(await sezione(page, 'Andamento').locator('summary .sum').evaluate(e => getComputedStyle(e).filter)).toContain('blur');
    await page.evaluate(() => document.body.classList.remove('nascondi'));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => vaiA('rie')); await page.evaluate(() => vaiA('ris'));
    await sezione(page, 'Obiettivi').locator('summary').click();
    await expect(page.locator('[data-obed="o1"]')).toBeVisible();
    expect(errori).toEqual([]);
  });

  test('pagina vuota (nessun obiettivo, nessun movimento): quattro sezioni chiuse con le frasi di sempre', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(() => { D().risparmi = {}; changed(); vaiA('ris'); });
    await expect(sezioni(page)).toHaveCount(4);
    await expect(sezione(page, 'Obiettivi')).toContainText('Nessun obiettivo per ora.'); // 24c.20: testi definitivi di 02
    await expect(sezione(page, 'Movimenti')).toContainText('Non hai ancora segnato niente.');
    await expect(sezione(page, 'Andamento').locator('summary .sum')).toHaveText('0,00 €');
    expect(errori).toEqual([]);
  });
});

// 24c.19 (D-185): oggi 27/11/2026; turni segnati nei giorni 2-5 dicembre → nel Riepilogo di dicembre la casella "Lavoro dipendente"
// c'è con la stima e la nota "stipendio previsto", ma i soldi rimanenti e le Entrate restano a 0 (D-009, D-071).
async function oggi27(browser) {
  const d = await nuovoDispositivo(browser, { drive: new DriveFinto(), ora: '2026-11-27T10:00:00+01:00', telefono: true });
  await d.page.waitForFunction(() => window.Entrate && window.Stip15 && Archivio.avviata);
  await d.page.evaluate(() => { DB.meta.skipWelcome = true; changed(); render(); });
  await dopoAvvio(d.page);
  return d;
}
const turni = (page, giorni) => page.evaluate(giorni => {
  const l = Stip15.nuovoLavoro('turni'); l.nome = 'Reparto di prova'; l.dal = '2026-01-01'; l.paga = { tipo: 'oraria', importo: '10', divisore: 168 };
  D().lavori = { [l.id]: l }; D().turni = {};
  const tipo = l.tipi.find(t => t.nome === 'Mattina').id;
  for (const g of giorni) { const id = uid(); D().turni[id] = { id, lid: l.id, data: g, tipo, da: '', a: '', pausa: '', ore: '', nota: '', updatedAt: 1 }; }
  changed(); return l.id; }, giorni);
// 24c.18: i lettori dell'app creano raccolte vuote ({}) quando mancano (buste, cedolini…): non sono dati dell'utente, si ignorano
const diversiDa = (page, prima) => page.evaluate(prima => { const a = JSON.parse(prima), b = D();
  const vuota = x => x === undefined || (x !== null && typeof x === 'object' && !Array.isArray(x) && !Object.keys(x).length);
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => !(vuota(a[k]) && vuota(b[k])) && JSON.stringify(a[k]) !== JSON.stringify(b[k])); }, prima);
const riep = (page, ym, modo = 'mese') => page.evaluate(([ym, modo]) => { tab = 'rie'; rieMode = modo; cur = ym; render(); }, [ym, modo]);
const casella = (page, pag) => page.locator(`#heroDet [data-vai="${pag}"]`);

test.describe('24c.19 · D-185 stipendio e pensione previsti nei mesi futuri', () => {
  test('dicembre con turni: casella "Lavoro dipendente" con la stima e "stipendio previsto", soldi rimanenti ed Entrate a 0, niente "Mi dispiace"; novembre come prima; gennaio senza turni come prima; dati invariati', async ({ browser }) => {
    const { page, errori } = await oggi27(browser);
    const lid = await turni(page, ['2026-11-10', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05']);
    const prima = await page.evaluate(() => JSON.stringify(D()));
    // la stima del mese come nella pagina del lavoro: il netto stimato, o il lordo se il netto non si può stimare
    const stima = await page.evaluate(lid => { const p = Entrate.voce(`lav|${lid}|2026-12`).pr; return p.imp ?? p.lordo; }, lid);
    expect(stima).toBeGreaterThan(0);
    // novembre (oggi): come prima, 0,00 € con "stipendio in arrivo"
    await riep(page, '2026-11');
    await expect(casella(page, 'dlav').locator('b')).toHaveText('0,00 €');
    await expect(casella(page, 'dlav').locator('.nota')).toHaveText('stipendio in arrivo');
    // dicembre: la stima con "stipendio previsto"; il riquadro resta a 0
    await riep(page, '2026-12');
    await expect(casella(page, 'dlav')).toContainText('Lavoro dipendente');
    await expect(casella(page, 'dlav').locator('b')).toHaveText(await page.evaluate(v => eur(v), stima));
    await expect(casella(page, 'dlav').locator('.nota')).toHaveText('stipendio previsto');
    await expect(page.locator('#rieTot .hero .rim > b')).toHaveText('0,00 €');
    await expect(page.locator('#rieTot .hero .rim .det')).toHaveText('Entrate 0,00 € · Uscite 0,00 €');
    expect(await page.evaluate(() => [contiMese('2026-12').entrate, contiMese('2026-12').rimanenti, contiMese('2026-12').lav.v])).toEqual([0, 0, 0]);
    await expect(page.locator('#heroDet .nient')).toHaveCount(0);
    // toccandola si apre la pagina del lavoro su dicembre
    await casella(page, 'dlav').click();
    expect(await page.evaluate(() => [tab, cur])).toEqual(['dlav', '2026-12']);
    // gennaio senza turni né stima: come prima (nessuna casella, la frase)
    await riep(page, '2027-01');
    await expect(casella(page, 'dlav')).toHaveCount(0);
    await expect(page.locator('#heroDet .nient')).toHaveText('🙁Mi dispiace che non hai entrate');
    expect(await diversiDa(page, prima)).toEqual([]);
    expect(errori).toEqual([]);
  });

  test('vista Anno: il 2027 con turni solo a gennaio ha la casella con la stima e "stipendio previsto"; il 2026 come prima; segnato entrato a dicembre non c\'è più la stima', async ({ browser }) => {
    const { page, errori } = await oggi27(browser);
    const lid = await turni(page, ['2026-11-10', '2026-12-02', '2027-01-04', '2027-01-05']);
    const gen = await page.evaluate(lid => { const p = Entrate.voce(`lav|${lid}|2027-01`).pr; return p.imp ?? p.lordo; }, lid);
    expect(gen).toBeGreaterThan(0);
    await riep(page, '2027-01', 'anno');
    await expect(casella(page, 'dlav').locator('b')).toHaveText(await page.evaluate(v => eur(v), gen));
    await expect(casella(page, 'dlav').locator('.nota')).toHaveText('stipendio previsto');
    await expect(page.locator('#rieTot .hero .rim > b')).toHaveText('0,00 €');
    await expect(page.locator('#heroDet .nient')).toHaveCount(0);
    // anno di oggi: la casella c'era già (novembre) e resta com'era, senza nota
    await riep(page, '2026-11', 'anno');
    await expect(casella(page, 'dlav').locator('b')).toHaveText('0,00 €');
    await expect(casella(page, 'dlav').locator('.nota')).toHaveCount(0);
    expect(errori).toEqual([]);
  });

  test('Pensione: a dicembre (mese futuro) la casella c\'è con la stima e "pensione prevista", fuori da soldi rimanenti ed Entrate; anno 2027 con la stima dei 12 mesi; senza profilo come prima', async ({ browser }) => {
    const { page, errori } = await oggi27(browser);
    await page.evaluate(() => { D().pensione = { profilo: { lordoMese: '1400', dal: '2026-01', annoNascita: '1958', anniContributi: '40', prima: 'dipendente', updatedAt: 1 } }; changed(); });
    const [dic, anno27] = await page.evaluate(() => [pensioneMese('2026-12').v, r2(Array.from({ length: 12 }, (_, i) => pensioneMese(`2027-${pad(i + 1)}`).v).reduce((a, v) => a + v, 0))]);
    expect(dic).toBeGreaterThan(0);
    await riep(page, '2026-12');
    await expect(casella(page, 'pen').locator('b')).toHaveText(await page.evaluate(v => eur(v), dic));
    await expect(casella(page, 'pen').locator('.nota')).toHaveText('pensione prevista');
    await expect(page.locator('#rieTot .hero .rim .det')).toHaveText('Entrate 0,00 € · Uscite 0,00 €');
    await expect(page.locator('#heroDet .nient')).toHaveCount(0);
    await riep(page, '2027-01', 'anno');
    await expect(casella(page, 'pen').locator('b')).toHaveText(await page.evaluate(v => eur(v), anno27));
    await expect(casella(page, 'pen').locator('.nota')).toHaveText('pensione prevista');
    await expect(page.locator('#rieTot .hero .rim > b')).toHaveText('0,00 €');
    await page.evaluate(() => { D().pensione = {}; changed(); });
    await riep(page, '2026-12');
    await expect(casella(page, 'pen')).toHaveCount(0);
    expect(errori).toEqual([]);
  });
});
