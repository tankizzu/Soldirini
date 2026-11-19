// 24b.1 (D-098): Riepilogo a pagine. Il riquadro aperto porta alle pagine di dettaglio; le sezioni del Riepilogo e di
// Documenti sono dentro le pagine. Controlla che nessuna funzione si perda e che i conti siano gli stessi.
// Orologio fisso al 17/11/2026. Dati inventati.
const { test, expect } = require('./helpers/prova');
const { DriveFinto, nuovoDispositivo } = require('./helpers/app');

const OGGI = '2026-11-17T10:00:00+01:00';
const pronto = page => page.waitForFunction(() => window.Entrate && window.Stip15 && window.FissaEv);
async function telefono(browser, o = {}) { const d = await nuovoDispositivo(browser, { drive: new DriveFinto(), ora: OGGI, ...o }); await pronto(d.page); return d; }
// apre il Riepilogo e il riquadro (con un tocco, come l'utente)
const vaiRie = async (page, ym = '2026-11', modo = 'mese') => { await page.evaluate(([ym, modo]) => { cur = ym; rieMode = modo; tab = 'rie'; render(); }, [ym, modo]);
  if (await page.locator('#heroDet').isHidden()) await page.locator('#rieTot .rim').click(); await expect(page.locator('#heroDet')).toBeVisible(); };

// un lavoro, un progetto con un'attività di ottobre (375 €, 300 entrati il 05/11, 12 € di spese da rimborsare), tre uscite fisse, due spese a novembre
const DATI = () => {
  const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Reparto'; l.dal = '2026-09-01';
  for (const d of [1, 2, 3, 4, 5]) l.settimana[d] = { da: '09:00', a: '17:00', pausa: '60' };
  l.paga = { tipo: 'mensile', importo: '2000', divisore: '' }; l.tratt = '26'; D().lavori = { [l.id]: l };
  D().buste = { [`${l.id}|2026-10`]: { lid: l.id, mese: '2026-10', lordo: '', trattenute: '', netto: '1500', updatedAt: 1 } };
  D().fissi = {}; for (const [nome, imp, g] of [['Affitto', 450, 3], ['Netflix', 13, 27], ['Assicurazione', 107, 30]]) { const id = uid(); D().fissi[id] = { id, nome, cat: 'altro', importo: String(imp), giorno: String(g), dal: '2026-10', al: '', rate: '', updatedAt: 1 }; }
  D().spesePers = {}; for (const [d, i] of [['2026-11-04', 50], ['2026-11-12', 30]]) { const id = uid(); D().spesePers[id] = { id, data: d, cat: 'bar', importo: String(i), nota: '', created: 1, updatedAt: 1 }; }
  D().entrate = { 'v24|risposta': { risposta: 'no', updatedAt: 1 }, [`lav|${l.id}|2026-10`]: { entrato: true, data: '2026-11-10', importo: 1500, updatedAt: 1 } };
  const p = nuovoProgetto(); p.nome = 'Squadra'; p.ore.attivo = true; p.rimborso.attivo = true; D().progetti = { [p.id]: p }; const id = uid();
  D().eventi = { [id]: { id, pid: p.id, data: '2026-10-12', tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '375', rimborso: false, spese: [{ tipo: 'altro', importo: '12' }], created: 1, updatedAt: 1 } };
  changed();
};
const cella = (page, n) => page.locator('#heroDet > *').filter({ hasText: n });

test.describe('24b.1 · Riepilogo a pagine (D-098)', () => {
  test('Riepilogo: niente Documenti; Tasse, Risparmi e Pensione restano; le sezioni non sono più sotto il riquadro', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(DATI); await vaiRie(page, '2026-10');
    await expect(page.locator('#v-rie .subnav [data-goto]')).toHaveCount(3);
    expect(await page.locator('#v-rie .subnav [data-goto]').evaluateAll(b => b.map(x => x.dataset.goto))).toEqual(['tas', 'ris', 'pen']);
    for (const id of ['rieFix', 'rieLav', 'rieCards', 'docList', 'rieSpese', 'rieInc', 'rieMesi']) expect(await page.locator(`#v-rie #${id}`).count(), id).toBe(0);
    expect(errori).toEqual([]);
  });

  test('ogni casella porta alla sua pagina, con il periodo, "‹ Riepilogo" e il tasto Indietro; le funzioni di prima ci sono', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(DATI); await vaiRie(page, '2026-10');
    const conti = await page.evaluate(() => JSON.stringify(contiMese('2026-10')));
    const vai = async (nome, id) => {
      await vaiRie(page, '2026-10'); await cella(page, nome).click();
      await expect(page.locator('#v-' + id)).toBeVisible(); await expect(page.locator('#v-rie')).toBeHidden();
      await expect(page.locator(`#v-${id} .pgper`)).toHaveText('ottobre 2026');
      await expect(page.locator('nav .tabs button[data-tab="rie"], nav button[data-tab="rie"]').first()).toHaveClass(/on/); // la scheda Riepilogo resta accesa
      return page.locator('#v-' + id);
    };
    // Uscite fisse: le righe di prima
    let p = await vai('Uscite fisse', 'dfx');
    await expect(p.locator('#rieFix .kv span').filter({ hasText: 'Affitto' })).toContainText('addebitata il 3');
    await page.goBack(); await expect(page.locator('#v-rie')).toBeVisible(); // tasto Indietro del telefono
    // Lavoro dipendente: la scheda del lavoro con la busta e "È entrato"
    p = await vai('Lavoro dipendente', 'dlav');
    await expect(p.locator('#rieLav .lavcard')).toHaveCount(1);
    // D-098 punto 5: per chi non è in pensione, contributi, fondo pensione e pensione futura sono qui (stesse sezioni della pagina Pensione)
    expect(await p.locator('#penLav .pensez').evaluateAll(d => d.map(x => x.dataset.sez))).toEqual(['contributi', 'fondo', 'futura']);
    await expect(p.locator('#penLav details[open]')).toHaveCount(0); // chiuse all'apertura (D-010)
    await p.locator('.back').click(); await expect(page.locator('#v-rie')).toBeVisible();
    // Rimborsi spese: la scheda del rimborso del progetto (prima in Documenti), aperta all'arrivo; testata con l'importo del riquadro
    p = await vai('Rimborsi spese', 'drim');
    await expect(p.locator('.testa small')).toHaveText('Rimborsi spese di ottobre');
    const rim = p.locator('#docList > details:visible');
    await expect(rim).toHaveCount(1); await expect(rim.locator('summary .st')).toHaveText('Squadra · rimborso spese');
    await expect(rim).not.toHaveAttribute('open', ''); // 24b.2 (D-099 punto 4): tutte le sezioni chiuse all'apertura
    // Ritenuta d'acconto: ore e ritenuta del progetto e il prospetto di tutti i progetti (prima in Documenti); niente rimborsi
    p = await vai('Ritenuta d’acconto', 'drit');
    expect(await p.locator('#docList > details:visible summary .st').allTextContents()).toEqual(['Squadra · ore e ritenuta', 'Ritenuta d\'acconto · tutti i progetti']);
    await expect(p.locator('#docList [data-pdfp]')).toHaveCount(1); await expect(p.locator('#docList [data-pdfore]')).toHaveCount(1);
    // "Per il commercialista" è ora in Tasse
    await vaiRie(page, '2026-10'); await page.evaluate(() => vaiA('tas')); await expect(page.locator('#tasComm')).toContainText('Per il commercialista');
    // Ancora da incassare: l'elenco "Da incassare" con il pulsante per segnare il pagamento
    p = await vai('Ancora da incassare', 'dinc');
    await expect(p.locator('#rieInc')).toContainText('Da incassare');
    await expect(p.locator('#rieInc')).toContainText('Squadra');
    // i conti non cambiano
    expect(await page.evaluate(() => JSON.stringify(contiMese('2026-10')))).toBe(conti);
    expect(errori).toEqual([]);
  });

  test('Spese giornaliere: pagina con le spese del mese; nella pagina si cambia mese come nel Riepilogo', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(DATI); await vaiRie(page, '2026-11');
    await cella(page, 'Spese giornaliere').click();
    const p = page.locator('#v-dsp');
    await expect(p.locator('#rieSpese h3')).toHaveText('🛒 Spese giornaliere');
    await expect(p.locator('#rieSpese .kv.big b')).toHaveText('80,00 €');
    await p.locator('.pgPrev').click();
    await expect(p.locator('.pgper')).toHaveText('ottobre 2026');
    await expect(p.locator('#rieSpese')).toBeEmpty();
    await p.locator('.pgNext').click();
    await expect(p.locator('#rieSpese .kv.big b')).toHaveText('80,00 €');
    expect(errori).toEqual([]);
  });

  test('vista Anno: "Incassato dai progetti" apre "Mese per mese" in Ancora da incassare; Ritenuta mostra un mese per riga', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(DATI); await vaiRie(page, '2026-11', 'anno');
    await cella(page, 'Incassato dai progetti').click();
    let p = page.locator('#v-dinc');
    await expect(p).toBeVisible(); await expect(p.locator('.pgper')).toHaveText('2026');
    await expect(p.locator('#rieAnno details[open] summary .st')).toContainText('Mese per mese');
    // Ritenuta d'acconto, vista Anno: un mese per riga; il tocco porta ai documenti di quel mese
    await vaiRie(page, '2026-11', 'anno'); await cella(page, 'Ritenuta d’acconto').click();
    p = page.locator('#v-drit');
    await expect(p.locator('.pgper')).toHaveText('2026');
    await expect(p.locator('#docList')).toBeHidden();
    await expect(p.locator('.mesibox .mrow')).toHaveCount(1); await expect(p.locator('.mesibox .mrow')).toContainText('Ottobre');
    await p.locator('.mesibox .mrow').click(); await expect(p.locator('.pgper')).toHaveText('ottobre 2026');
    await expect(p.locator('#docList')).toBeVisible(); await expect(p.locator('.mesibox')).toBeEmpty();
    await page.evaluate(() => { rieMode = 'anno'; render(); });
    await p.locator('.pgPrev').click(); await expect(p.locator('.pgper')).toHaveText('2025');
    await expect(p.locator('.mesibox')).toContainText('Niente in questo anno.');
    // soglie e "Per il commercialista" sono in Tasse
    await page.evaluate(() => { cur = '2026-11'; vaiA('tas'); });
    await expect(page.locator('#tasComm')).toContainText('Soglie dell’anno');
    expect(errori).toEqual([]);
  });

  test('il vecchio nome "doc" apre Rimborsi spese; Pensione (pensionato) mostra la riga del mese in cima', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(DATI);
    await page.evaluate(() => { cur = '2026-10'; tab = 'doc'; render(); });
    await expect(page.locator('#v-drim')).toBeVisible();
    await page.evaluate(() => vaiA('doc')); await expect(page.locator('#v-drim')).toBeVisible();
    await page.evaluate(() => { tab = 'pen'; render(); });
    await expect(page.locator('#v-pen #riePen')).toHaveCount(1);
    expect(errori).toEqual([]);
  });

  test('lavoro e pensione insieme (02 §3): contributi e fondo solo in Lavoro dipendente; La mia pensione e L\'anno in breve solo in Pensione', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(DATI);
    await page.evaluate(() => { D().pensione = { profilo: { lordoMese: '1000', dal: '2020-01', annoNascita: '1956', anniContributi: '30', prima: 'dipendente', updatedAt: Date.now() } }; changed(); });
    await page.evaluate(() => { cur = '2026-10'; vaiA('dlav'); });
    expect(await page.locator('#penLav .pensez').evaluateAll(d => d.map(x => x.dataset.sez))).toEqual(['contributi', 'fondo']);
    await page.evaluate(() => vaiA('pen'));
    expect(await page.locator('#penBody .pensez').evaluateAll(d => d.map(x => x.dataset.sez))).toEqual(['mia', 'anno']);
    // il collegamento ai contributi (archivio buste) porta a Lavoro dipendente, con la sezione aperta
    await page.evaluate(() => { const a = document.createElement('a'); a.href = '#'; a.dataset.penapri = 'contributi'; document.body.append(a); a.click(); a.remove(); });
    await expect(page.locator('#v-dlav')).toBeVisible(); await expect(page.locator('#v-dlav [data-sez=contributi]')).toHaveAttribute('open', '');
    expect(errori).toEqual([]);
  });

  test('Impostazioni: "Pensione" e "Uscite fisse" hanno l\'icona come le altre sezioni', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(() => { tab = 'pro'; render(); });
    for (const id of ['foldLav', 'foldPen', 'foldProj', 'foldFix']) await expect(page.locator(`#${id} > summary .ic`), id).toHaveCount(1);
    expect(errori).toEqual([]);
  });
});
