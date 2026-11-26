// 24b.2 (D-099 punti 1 e 4, D-101): caselle del riquadro solo con un valore, frase senza entrate, compensi non entrati nel
// Riepilogo, stipendio e pensione in arrivo nelle loro pagine, pagine con le sezioni chiuse, "Mese per mese (incassi)", "1 voce".
// Orologio fisso al 17/11/2026. Dati inventati.
const { test, expect } = require('./helpers/prova');
const { DriveFinto, nuovoDispositivo } = require('./helpers/app');

const OGGI = '2026-11-17T10:00:00+01:00';
const pronto = page => page.waitForFunction(() => window.Entrate && window.Stip15 && window.Pensione);
async function telefono(browser) { const d = await nuovoDispositivo(browser, { drive: new DriveFinto(), ora: OGGI }); await pronto(d.page); return d; }
const vai = (page, t, ym = '2026-11', modo = 'mese') => page.evaluate(([t, ym, modo]) => { cur = ym; rieMode = modo; tab = 'rie'; render(); if (t !== 'rie') vaiA(t); }, [t, ym, modo]);
const apri = async page => { if (await page.locator('#heroDet').isHidden()) await page.locator('#rieTot .rim').click(); };
const caselle = page => page.locator('#heroDet > * > small:first-child').allTextContents();
// un progetto con un compenso di settembre (200 €, 150 entrati il 05/10) e uno di novembre (90 €) da incassare; pensione; nessun lavoro
const DATI = () => {
  const p = nuovoProgetto(); p.nome = 'Squadra'; p.ore.attivo = true; D().progetti = { [p.id]: p };
  const ev = (data, fisso) => { const id = uid(); D().eventi[id] = { id, pid: p.id, data, tipo: 'altro', titolo: '', ore: true, fasce: [], fisso, rimborso: false, spese: [], created: 1, updatedAt: 1 }; };
  D().eventi = {}; ev('2026-09-10', '200'); ev('2026-11-03', '90');
  D().pagamenti = { [`${p.id}|2026-09|o`]: { pagato: true, data: '2026-10-05', importo: 160, updatedAt: 1 } };
  D().pensione = { profilo: { lordoMese: '1000', dal: '2026-10', annoNascita: '1956', anniContributi: '30', prima: 'dipendente', updatedAt: 1 } };
  D().entrate = { 'v24|risposta': { risposta: 'no', updatedAt: 1 } }; D().fissi = {}; D().spesePers = {};
  changed(); return p.id;
};

test.describe('24b.2 · riquadro (D-101)', () => {
  test('senza nessuna entrata e nessuna uscita: solo la frase; con un\'uscita fissa la casella e la frase', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(() => { D().entrate = { 'v24|risposta': { risposta: 'no', updatedAt: 1 } }; changed(); });
    await vai(page, 'rie', '2026-11'); await apri(page);
    expect(await caselle(page)).toEqual([]);
    await expect(page.locator('#heroDet .nient')).toHaveText('🙁Mi dispiace che non hai entrate');
    await page.evaluate(() => { const id = uid(); D().fissi = { [id]: { id, nome: 'Affitto', cat: 'altro', importo: '450', giorno: '3', dal: '2026-10', al: '', rate: '', updatedAt: 1 } }; changed(); render(); });
    expect(await caselle(page)).toEqual(['Spese']); // 24c.14 (D-168)
    // le caselle-pulsante hanno il fondo del riquadro (nella 24b.1 avevano il fondo chiaro del navigatore: testo bianco su grigio)
    expect(await page.locator('#heroDet > button.hcel').first().evaluate(b => [getComputedStyle(b).backgroundColor, getComputedStyle(b).display, getComputedStyle(b).borderRadius])).toEqual(['rgba(255, 255, 255, 0.1)', 'flex', '11px']);
    await expect(page.locator('#heroDet .nient')).toHaveCount(1);
    expect(await page.evaluate(() => contiMese('2026-11').usciti)).toBe(450);
    expect(errori).toEqual([]);
  });

  test('caselle solo con un valore, mese per mese e nell\'anno; il calcolo non cambia', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(DATI);
    const conti = await page.evaluate(() => JSON.stringify([contiMese('2026-10'), contiAnno('2026')]));
    // ottobre: entrati 160 dal progetto (nessuna casella delle entrate di ottobre) + pensione stimata → niente frase
    await vai(page, 'rie', '2026-10'); await apri(page);
    // ottobre: pensione (stima) e compenso da incassare ("Ancora da incassare" è il totale di tutto ciò che manca, come prima)
    expect(await caselle(page)).toEqual(['Pensione', 'Ancora da incassare']);
    await expect(page.locator('#heroDet .nient')).toHaveCount(0);
    // vista Anno: stessa regola sull'anno
    await vai(page, 'rie', '2026-11', 'anno');
    expect(await caselle(page)).toEqual(['Pensione', 'Incassato dai progetti', 'Ancora da incassare', 'Ritenuta d’acconto']); // 24c.1 (4b)
    expect(await page.evaluate(() => JSON.stringify([contiMese('2026-10'), contiAnno('2026')]))).toBe(conti);
    expect(errori).toEqual([]);
  });
});

test.describe('24b.2 · "In arrivo" (D-099 punto 1)', () => {
  test('nel Riepilogo solo i compensi non entrati (scheda nello stile di Tasse e Risparmi); la pensione in arrivo in cima alla pagina Pensione', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(DATI);
    await vai(page, 'rie');
    const sc = page.locator('#rieIn .insub');
    await expect(sc.locator('.inhead b')).toHaveText('Compensi non ancora entrati');
    await expect(sc.locator('.inhead small')).toContainText('non contati nei soldi rimanenti');
    expect(await sc.locator('.ir .tx b').allTextContents()).toEqual(['Compensi di novembre']); // settembre è già entrato
    await expect(page.locator('#rieIn')).not.toContainText('Pensione di');
    // pensione: in cima alla pagina, con "È entrata"
    await vai(page, 'pen');
    const pi = page.locator('#penIn .inarr');
    await expect(pi.locator('h3')).toContainText('In arrivo');
    await expect(pi.locator('.ir').filter({ hasText: 'Pensione di novembre' }).locator('button')).toHaveText('È entrata');
    expect(await page.evaluate(() => document.querySelector('#penIn').nextElementSibling.id)).toBe('riePen');
    // la finestra "È entrata" funziona da qui
    await pi.locator('.ir').filter({ hasText: 'Pensione di novembre' }).locator('button').click();
    await expect(page.locator('#enModal')).toBeVisible(); await expect(page.locator('#enTit')).toHaveText('Pensione di novembre');
    expect(errori).toEqual([]);
  });
});

test.describe('24b.2 · correzioni', () => {
  test('"Mese per mese (incassi)": il tocco (o Invio) su una riga porta a quel mese nella stessa pagina; Tasse: "1 voce"', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(DATI);
    await vai(page, 'dinc', '2026-11', 'anno');
    await page.locator('#rieAnno details').filter({ hasText: 'Mese per mese (incassi)' }).locator('summary').click();
    const riga = page.locator('#rieAnno tr[data-ym="2026-10"]');
    await expect(riga).toHaveAttribute('tabindex', '0');
    await riga.click();
    await expect(page.locator('#v-dinc')).toBeVisible(); await expect(page.locator('#v-dinc .pgper')).toHaveText('ottobre 2026');
    expect(await page.evaluate(() => rieMode)).toBe('mese');
    await vai(page, 'dinc', '2026-11', 'anno');
    // 24c.1: nei giri lunghi a volte il fuoco non arrivava sulla riga e l'Invio finiva sul titolo della sezione (che si chiudeva).
    // Apro la sezione, metto il fuoco sulla riga e controllo che ci sia, poi premo Invio una volta sola: si prova lo stesso tasto.
    const sez = page.locator('#rieAnno details').filter({ hasText: 'Mese per mese (incassi)' });
    await sez.evaluate(d => { d.open = true; });
    const nov = page.locator('#rieAnno tr[data-ym="2026-11"]');
    await expect(async () => { await nov.focus(); await expect(nov).toBeFocused({ timeout: 500 }); }).toPass({ timeout: 10000 });
    await page.keyboard.press('Enter');
    await expect(page.locator('#v-dinc .pgper')).toHaveText('novembre 2026');
    // "Elenco pagamenti" (vista Anno di Ancora da incassare): un solo pagamento nell'anno → "1 voce"
    await page.evaluate(() => { for (const e of Object.values(D().eventi)) if (e.data === '2026-11-03') e.deleted = true; changed(); });
    await vai(page, 'dinc', '2026-11', 'anno');
    await expect(page.locator('#rieAnno details').filter({ hasText: 'Elenco pagamenti' }).locator('summary .sum')).toHaveText('1 voce');
    expect(errori).toEqual([]);
  });

  test('D-099 punto 4: aprendo una pagina tutte le sezioni sono chiuse, anche la principale', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(DATI);
    for (const t of ['pen', 'drit', 'dinc']) {
      await vai(page, t, '2026-09');
      expect(await page.locator(`#v-${t} details.fold[open]`).count(), t).toBe(0);
    }
    expect(errori).toEqual([]);
  });
});
