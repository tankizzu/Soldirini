// v24: interfaccia di "conta quando entra", primo avvio, uscite fisse, pulizia (D-049, D-063, D-070),
// requisiti di 03 (dati non fidati, dati delle altre app non toccati) e confronti con la 24csp pubblicata (T-X1, T-X2, documenti).
// Orologio fisso al 17/11/2026. Dati inventati.
const { test, expect } = require('./helpers/prova');
const { BASE, DriveFinto, nuovoDispositivo, accedi, accediEsistente, sincronizza } = require('./helpers/app');
const { SITO } = require('./helpers/google-finto');
const { sitoDaCommit } = require('./helpers/versione');

const OGGI = '2026-11-17T10:00:00+01:00';
const BASE_24CSP = '1e446a0';
const pronto = page => page.waitForFunction(() => window.Entrate && window.Stip15 && window.FissaEv);
async function telefono(browser, o = {}) { const d = await nuovoDispositivo(browser, { drive: new DriveFinto(), ora: OGGI, ...o }); await pronto(d.page); return d; }
const vaiRie = (page, ym = '2026-11', modo = 'mese') => page.evaluate(([ym, modo]) => { cur = ym; rieMode = modo; tab = 'rie'; render(); }, [ym, modo]);
// 24b.2: pagina di dettaglio del Riepilogo (stipendio in arrivo in Lavoro dipendente, D-099 punto 1)
const vaiPag = (page, t, ym = '2026-11', modo = 'mese') => page.evaluate(([t, ym, modo]) => { cur = ym; rieMode = modo; tab = 'rie'; render(); vaiA(t); }, [t, ym, modo]);

// dati con un lavoro (busta di ottobre 1.500), uscite fisse di esempio e due spese di novembre
const DATI = () => {
  const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Reparto'; l.dal = '2026-11-01';
  for (const d of [1, 2, 3, 4, 5]) l.settimana[d] = { da: '09:00', a: '17:00', pausa: '60' };
  l.paga = { tipo: 'mensile', importo: '2000', divisore: '' }; l.tratt = '26'; D().lavori = { [l.id]: l };
  D().buste = { [`${l.id}|2026-10`]: { lid: l.id, mese: '2026-10', lordo: '', trattenute: '', netto: '1500', updatedAt: 1 } };
  D().fissi = {}; for (const [nome, imp, g] of [['Affitto', 450, 3], ['Netflix', 13, 27], ['Assicurazione', 107, 30]]) { const id = uid(); D().fissi[id] = { id, nome, cat: 'altro', importo: String(imp), giorno: String(g), dal: '2026-10', al: '', rate: '', updatedAt: 1 }; }
  D().spesePers = {}; for (const [d, i] of [['2026-11-04', 50], ['2026-11-12', 30]]) { const id = uid(); D().spesePers[id] = { id, data: d, cat: 'bar', importo: String(i), nota: '', created: 1, updatedAt: 1 }; }
  D().entrate = { 'v24|risposta': { risposta: 'no', updatedAt: 1 } }; changed(); return l.id;
};

test.describe('v24 · finestra "È entrato" e "In arrivo"', () => {
  test('T-R1 riquadro (24.2, D-085): "Soldi rimanenti", "Entrate · Uscite"; aperto: Uscite fisse e Spese giornaliere; righe addebitata/addebito', async ({ browser }) => {
    const { page } = await telefono(browser);
    const lid = await page.evaluate(DATI);
    await page.evaluate(lid => { D().entrate[`lav|${lid}|2026-10`] = { entrato: true, data: '2026-11-10', importo: 1500, updatedAt: 1 };
      const p = nuovoProgetto(); p.nome = 'Squadra'; p.ore.attivo = true; D().progetti[p.id] = p; const id = uid();
      D().eventi[id] = { id, pid: p.id, data: '2026-10-12', tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '375', rimborso: false, spese: [], created: 1, updatedAt: 1 };
      pagamenti()[`${p.id}|2026-10|o`] = { pagato: true, data: '2026-11-05', importo: 300, updatedAt: 1 }; changed(); }, lid);
    await vaiRie(page);
    const rim = page.locator('#rieTot .hero .rim');
    await expect(rim.locator('.tit')).toHaveText('Soldi rimanenti');
    await expect(rim.locator('.dm')).toHaveCount(0);
    await expect(rim.locator('b')).toHaveText('1150,00 €');
    await expect(rim.locator('.det')).toHaveText('Entrate 1800,00 € · Uscite 650,00 €');
    await rim.click();
    await expect(page.locator('#heroDet > *').nth(0)).toHaveText('Uscite fisse570,00 €, apri la pagina');
    await expect(page.locator('#heroDet > *').nth(1)).toHaveText('Spese giornaliere80,00 €, apri la pagina');
    await expect(page.locator('#rieTot .hero')).not.toContainText('Pagamenti fissi');
    await expect(page.locator('#rieFix summary .st')).toHaveText('💳 Uscite fisse');
    await expect(page.locator('#rieFix .kv span').filter({ hasText: 'Affitto' })).toContainText('addebitata il 3');
    await expect(page.locator('#rieFix .kv span').filter({ hasText: 'Netflix' })).toContainText('addebito il 27');
    await expect(page.locator('#rieFix .kv span').filter({ hasText: 'Assicurazione' })).toContainText('addebito il 30');
  });

  test('T-S2, T-R4, E-7: "In arrivo" con stima, avviso oltre 2 mesi; niente nella vista Anno né nei mesi futuri (T-U6)', async ({ browser }) => {
    const { page } = await telefono(browser);
    await page.evaluate(DATI);
    await page.evaluate(() => { const l = Object.values(D().lavori)[0]; l.dal = '2026-08-01';
      D().buste[`${l.id}|2026-08`] = { lid: l.id, mese: '2026-08', lordo: '', trattenute: '', netto: '300', updatedAt: 1 }; changed(); });
    await vaiRie(page);
    // 24b.2 (D-099 punto 1): nel Riepilogo solo i compensi; stipendio e pensione in arrivo in cima alla pagina Lavoro dipendente
    await expect(page.locator('#rieIn')).not.toContainText('Stipendio');
    await vaiPag(page, 'dlav');
    const box = page.locator('#lavIn .inarr');
    await expect(box.locator('.ir').filter({ hasText: 'Stipendio di novembre' })).toContainText('1480,00 € (stima)');
    await expect(box.locator('.ir').filter({ hasText: 'Stipendio di agosto' })).toContainText('⚠ Da più di 2 mesi: controlla se è entrato');
    await expect(box.locator('.ir').filter({ hasText: 'Stipendio di settembre' })).not.toContainText('⚠');
    await expect(box.locator('h3')).toContainText('non contati');
    await vaiPag(page, 'dlav', '2026-12'); await expect(page.locator('#lavIn .inarr')).toHaveCount(0);
    await vaiRie(page, '2026-12'); await expect(page.locator('#rieFix .kv span').filter({ hasText: 'Affitto' })).toContainText('addebito il 3');
    await vaiPag(page, 'dlav', '2026-11', 'anno'); await expect(page.locator('#lavIn .inarr')).toHaveCount(0);
  });

  test('finestra: proposta dalla busta, data nel futuro rifiutata (T-S9), data insolita (T-S10), salva, "Non entrato" (T-S8), avviso busta diversa (T-S7)', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    const lid = await page.evaluate(DATI);
    await vaiPag(page, 'dlav');
    await page.locator('#lavIn .ir').filter({ hasText: 'Stipendio di ottobre' }).locator('button').click();
    const m = page.locator('#enModal');
    await expect(m.locator('#enTit')).toHaveText('Stipendio di ottobre');
    await expect(m.locator('#enImp')).toHaveValue('1500');
    await expect(m.locator('#enImpNota')).toHaveText('Proposto dal netto della busta. Correggilo se in banca è diverso.');
    await expect(m.locator('#enData')).toHaveValue('2026-11-17');
    await m.locator('#enData').fill('2026-11-20');
    await expect(m.locator('#enDataMsg')).toHaveText('La data non può essere nel futuro: i soldi devono essere già arrivati.');
    await expect(m.locator('#enSave')).toBeDisabled();
    await m.locator('#enData').fill('2026-09-30');
    await expect(m.locator('#enDataMsg')).toHaveText('⚠ Data insolita: è prima di ottobre, il mese dello stipendio. Se è giusta, salva pure.');
    await expect(m.locator('#enSave')).toBeEnabled();
    await m.locator('#enData').fill('2026-11-10'); await m.locator('#enImp').fill('1452');
    await m.locator('#enSave').click();
    await expect(page.locator('#toast')).toHaveText('Entrato il 10/11/2026: conta nei soldi di novembre 2026.');
    expect(await page.evaluate(lid => [D().entrate[`lav|${lid}|2026-10`], contiMese('2026-11').lav.v], lid)).toEqual([expect.objectContaining({ entrato: true, data: '2026-11-10', importo: 1452 }), 1452]);
    // T-S7: la busta dice 1.500, segnato 1.452
    await page.evaluate(lid => Entrate.apri(`lav|${lid}|2026-10`), lid);
    await expect(m.locator('#enImpAvv')).toHaveText('⚠ La busta dice 1500,00 €. Conta quello che hai scritto: correggilo se serve.');
    await expect(m.locator('#enNo')).toBeVisible();
    await m.locator('#enNo').click();
    await expect(page.locator('#toast')).toHaveText('Tolto: ora è tra quelli in arrivo.');
    expect(await page.evaluate(lid => [D().entrate[`lav|${lid}|2026-10`].entrato, contiMese('2026-11').lav.v], lid)).toEqual([false, 0]);
    await expect(page.locator('#lavIn .ir').filter({ hasText: 'Stipendio di ottobre' })).toHaveCount(1);
    expect(errori).toEqual([]);
  });

  test('T-S11 solo il lordo: campo vuoto con "scrivi quanto è entrato", Salva solo con un importo', async ({ browser }) => {
    const { page } = await telefono(browser);
    const lid = await page.evaluate(DATI);
    await page.evaluate(lid => { D().lavori[lid].tratt = ''; changed(); }, lid);
    await page.evaluate(lid => Entrate.apri(`lav|${lid}|2026-11`), lid);
    await expect(page.locator('#enImp')).toHaveValue('');
    await expect(page.locator('#enImp')).toHaveAttribute('placeholder', 'scrivi quanto è entrato');
    await expect(page.locator('#enImpNota')).toHaveText('C’è solo il lordo: il netto lo trovi sull’estratto conto.');
    await expect(page.locator('#enSave')).toBeDisabled();
    await page.locator('#enImp').fill('1410,50'); await expect(page.locator('#enSave')).toBeEnabled();
  });

  test('progetti: la stessa finestra salva sempre l\'importo (T-P6) e la data decide l\'anno per le tasse', async ({ browser }) => {
    const { page } = await telefono(browser);
    await page.evaluate(DATI);
    const key = await page.evaluate(() => { const p = nuovoProgetto(); p.nome = 'Squadra'; p.ore.attivo = true; p.pagamento = { ritardo: 1 }; D().progetti[p.id] = p; const id = uid();
      D().eventi[id] = { id, pid: p.id, data: '2026-10-12', tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '375', rimborso: false, spese: [], created: 1, updatedAt: 1 }; changed(); return `${p.id}|2026-10|o`; });
    await vaiRie(page);
    const riga = page.locator('#rieIn .ir').filter({ hasText: 'Compensi di ottobre' });
    await expect(riga).toContainText('Squadra · 300,00 € · previsti a novembre');
    await riga.locator('button').click();
    await expect(page.locator('#enImpNota')).toContainText('La data decide anche l’anno per le tasse.');
    await page.locator('#enSave').click();
    expect(await page.evaluate(k => pagamenti()[k], key)).toEqual(expect.objectContaining({ pagato: true, data: '2026-11-17', importo: 300 }));
  });

  test('stato nei mesi di Lavoro e Pensione: "In attesa" con pulsante, "✓ Entrato il …" con importo', async ({ browser }) => {
    const { page } = await telefono(browser);
    const lid = await page.evaluate(DATI);
    await page.evaluate(lid => { D().lavori[lid].dal = '2026-10-01'; D().entrate[`lav|${lid}|2026-10`] = { entrato: true, data: '2026-11-10', importo: 1500, updatedAt: 1 };
      D().pensione = { profilo: { lordoMese: '1400', dal: '2026-01', annoNascita: '1958', anniContributi: '40', prima: 'dipendente', updatedAt: 1 } };
      D().cedolini = { '2026-10': { mese: '2026-10', pensioneLorda: '1400', netto: '905', updatedAt: 1 } }; D().entrate['pen|2026-10'] = { entrato: true, data: '2026-10-01', importo: 905, updatedAt: 1 }; changed(); }, lid);
    await vaiRie(page, '2026-10');
    await expect(page.locator(`#rieLav .enst`)).toContainText('✓ Entrato il 10/11');
    await expect(page.locator('#riePen .enst')).toContainText('✓ Entrata il 01/10');
    await expect(page.locator('#riePen .enst')).toContainText('905,00 €');
    await vaiRie(page, '2026-11');
    await expect(page.locator(`#rieLav .enst`)).toContainText('In attesa');
    await expect(page.locator(`#rieLav .enst button`)).toHaveText('È entrato');
    await expect(page.locator('#riePen .enst button')).toHaveText('È entrata');
    // vista Anno del lavoro e "La mia pensione"
    await vaiRie(page, '2026-11', 'anno');
    await expect(page.locator(`#rieLav .enst.ok`).first()).toContainText('✓ Entrato il 10/11');
    await page.evaluate(() => { tab = 'pen'; render(); });
    await page.locator('[data-sez=mia] summary').click();
    await expect(page.locator('[data-sez=mia] .enst.ok')).toContainText('✓ Entrata il 01/10');
  });
});

test.describe('v24 · vista Anno (E-13 a)', () => {
  test('anno in corso: "somma dei mesi da gennaio a novembre", riga "ancora da addebitare entro dicembre"; mesi futuri "non ancora contato"', async ({ browser }) => {
    const { page } = await telefono(browser);
    await page.evaluate(DATI);
    await vaiRie(page, '2026-11', 'anno');
    const rim = page.locator('#rieTot .hero .rim');
    await expect(rim.locator('.tit')).toHaveText('Soldi rimanenti'); // D-092
    await expect(rim.locator('.dm')).toHaveText('somma dei mesi da gennaio a novembre');
    await expect(page.locator('#heroDet > *').last()).toHaveText('Uscite fisse ancora da addebitare entro dicembre570,00 €Non contate nei soldi rimanenti: dicembre non è ancora iniziato., apri la pagina Uscite fisse');
    await expect(page.locator('#rieFix .kv').filter({ hasText: 'dicembre 2026' })).toContainText('non ancora contato');
    await expect(page.locator('#rieFix .kv.big')).toContainText('Totale fino a novembre');
    await vaiRie(page, '2025-06', 'anno');
    await expect(rim.locator('.dm')).toHaveText('somma dei mesi da gennaio a dicembre');
  });
});

test.describe('v24 · uscite fisse', () => {
  test('Nuova attività → "Uscita fissa": chiusa, giorno e mese già compilati, giorno obbligatorio; nascosta con più giorni e in modifica', async ({ browser }) => {
    const { page } = await telefono(browser);
    await page.evaluate(() => { D().entrate = { 'v24|risposta': { risposta: 'no', updatedAt: 1 } }; changed(); });
    await page.evaluate(() => openEv(['2026-11-27']));
    const s = page.locator('#secFix');
    await expect(s).toBeVisible(); await expect(s).not.toHaveAttribute('open', '');
    await expect(page.locator('#secSpese summary')).toContainText('Spese giornaliere');
    await s.locator('summary').click();
    await expect(page.locator('#evFixGiorno')).toHaveValue('27');
    await expect(page.locator('#evFixDal')).toHaveValue('2026-11');
    await expect(s).toContainText('Conta nei soldi rimanenti di ogni mese, già dal primo giorno del mese.');
    await page.locator('#evFixNome').fill('Netflix'); await page.locator('#evFixImp').fill('13');
    await page.locator('#evFixGiorno').fill('');
    await page.locator('#evSave').click();
    await expect(page.locator('#evFixErr')).toHaveText('Scrivi il giorno di addebito (1–31).');
    await expect(page.locator('#evModal')).toBeVisible();
    await page.locator('#evFixGiorno').fill('27');
    await expect(page.locator('#secFixSum')).toHaveText('13,00 € · il 27');
    await page.locator('#evSave').click();
    await expect(page.locator('#evModal')).toBeHidden();
    expect(await page.evaluate(() => Object.values(D().fissi).map(f => [f.nome, f.importo, f.giorno, f.dal]))).toEqual([['Netflix', '13', '27', '2026-11']]);
    expect(await page.evaluate(() => contiMese('2026-11').fTot)).toBe(13);
    await page.evaluate(() => openEv(['2026-11-03', '2026-11-04']));
    await expect(page.locator('#secFix')).toBeHidden();
  });

  // 24.1 (D-073, D-076): un solo pulsante "Termina" che apre una finestra con l'ultimo giorno (di base oggi). Testi di 02 (report 02-ux-finestra-termina-d073).
  const ids = page => page.evaluate(() => Object.fromEntries(Object.values(D().fissi).map(f => [f.nome, f.id])));
  const apriTermina = async (page, id, giorno) => {
    await page.evaluate(id => Soldi18.apriFisso(D().fissi[id]), id);
    await page.locator('#fxFine').click();
    await expect(page.locator('#tmModal')).toBeVisible();
    if (giorno !== undefined) await page.locator('#tmData').fill(giorno);
  };
  test('finestra "Termina" con oggi: testi di 02, T-U9 e T-U8; riaprendo "Terminata" e "Cambia l\'ultimo giorno"', async ({ browser }) => {
    const { page } = await telefono(browser);
    await page.evaluate(DATI); const I = await ids(page);
    await page.evaluate(id => Soldi18.apriFisso(D().fissi[id]), I.Affitto);
    await expect(page.locator('#fxFineTit')).toHaveText('Non la paghi più?');
    await expect(page.locator('#fxFineNota')).toHaveText('Scegli l’ultimo giorno: i mesi prima restano come sono.');
    await expect(page.locator('#fxFine')).toHaveText('Termina');
    await expect(page.locator('#fxDel')).toHaveText('Elimina');
    await page.locator('#fxFine').click();
    await expect(page.locator('#tmTit')).toHaveText('Termina “Affitto”');
    await expect(page.locator('#tmData')).toHaveValue('2026-11-17'); // di base oggi
    await expect(page.locator('#tmModal')).toContainText('Di solito è oggi. Puoi scegliere anche un giorno passato o futuro.');
    await expect(page.locator('#tmMsg')).toHaveText('L’addebito del 3 novembre è entro questo giorno: conta ancora a novembre 2026 e non conta più da dicembre 2026.');
    await expect(page.locator('#tmMsg b')).toHaveText('non conta più da dicembre 2026');
    await expect(page.locator('#tmPrima')).toHaveText('I mesi prima restano come sono.');
    await expect(page.locator('#tmAvv')).toBeHidden();
    await page.locator('#tmOk').click();
    await expect(page.locator('#toast')).toHaveText('✓ Affitto terminata: conta fino a novembre 2026.');
    await expect(page.locator('#tmModal')).toBeHidden(); await expect(page.locator('#fxModal')).toBeHidden();
    await apriTermina(page, I.Assicurazione);
    await expect(page.locator('#tmMsg')).toHaveText('L’addebito del 30 novembre è dopo questo giorno: non conta più da novembre 2026.');
    await expect(page.locator('#tmAvv')).toBeHidden(); // novembre è il mese in corso, non già passato
    await page.locator('#tmOk').click();
    await expect(page.locator('#toast')).toHaveText('✓ Assicurazione terminata: conta fino a ottobre 2026.');
    expect(await page.evaluate(I => [D().fissi[I.Affitto].al, D().fissi[I.Assicurazione].al, contiMese('2026-10').fTot, contiMese('2026-11').fTot, contiMese('2026-12').fTot], I))
      .toEqual(['2026-11', '2026-10', 570, 463, 13]);
    // riaprendo un'uscita terminata
    await page.evaluate(id => Soldi18.apriFisso(D().fissi[id]), I.Affitto);
    await expect(page.locator('#fxFineTit')).toHaveText('Terminata: conta fino a novembre 2026.');
    await expect(page.locator('#fxFineNota')).toBeHidden();
    await expect(page.locator('#fxFine')).toHaveText('Cambia l’ultimo giorno');
    await page.locator('#fxFine').click();
    await expect(page.locator('#tmMsg')).toHaveText('Finisce già a novembre 2026: “Termina” può solo anticipare la fine.'); // P-1 con oggi
    await page.locator('#tmData').fill('2026-11-02'); // anticipare si può
    await expect(page.locator('#tmMsg')).toHaveText('L’addebito del 3 novembre è dopo questo giorno: non conta più da novembre 2026.');
    await page.locator('#tmAnn').click(); await expect(page.locator('#tmModal')).toBeHidden(); await expect(page.locator('#fxModal')).toBeVisible();
    expect(await page.evaluate(id => D().fissi[id].al, I.Affitto)).toBe('2026-11'); // "Annulla" non cambia niente
    // "Elimina" toglie anche dai mesi passati (comportamento di prima)
    await page.evaluate(id => Soldi18.apriFisso(D().fissi[id]), I.Netflix);
    await page.locator('#fxDel').click(); await page.locator('#dlgBtns').getByRole('button', { name: 'Elimina' }).click();
    expect(await page.evaluate(() => contiMese('2026-10').fTot)).toBe(557);
  });

  // casi T-T1…T-T16 di 04 (report 04-fisco-d073-termina-d074): oggi 17/11/2026; ogni caso con una sola uscita, così i totali del mese sono i suoi
  const USC = { aff: ['Affitto', 450, 3, '2026-10'], ass: ['Assicurazione', 107, 30, '2026-10'], abb: ['Abbonamento', 10, 31, '2026-10'] };
  const CASI = [
    ['T-T1', 'aff', '2026-11-17', { al: '2026-11', mesi: { '2026-10': 450, '2026-11': 450, '2026-12': 0 } }],
    ['T-T2', 'ass', '2026-11-17', { al: '2026-10', mesi: { '2026-10': 107, '2026-11': 0 } }],
    ['T-T3', 'aff', '2026-11-03', { al: '2026-11', mesi: { '2026-11': 450, '2026-12': 0 }, frase: 'L’addebito del 3 novembre è entro questo giorno' }],
    ['T-T4', 'aff', '2026-11-02', { al: '2026-10', mesi: { '2026-10': 450, '2026-11': 0 } }],
    ['T-T5', 'aff', '2026-10-20', { al: '2026-10', mesi: { '2026-10': 450, '2026-11': 0 } }], // novembre è il mese in corso: niente avviso
    ['T-T6', ['Assicurazione', 107, 30, '2026-09'], '2026-10-15', { al: '2026-09', mesi: { '2026-09': 107, '2026-10': 0, '2026-11': 0 }, avviso: '⚠ Cambiano i soldi rimanenti di ottobre 2026 (già passato). Se è giusto, termina pure.' }],
    ['T-T6b', 'ass', '2026-10-15', { err: 'È prima dell’inizio (ottobre 2026). Se l’avevi inserita per errore, usa Elimina.', mesi: { '2026-10': 107, '2026-11': 107 } }], // "dal 2026-10": fine prima dell'inizio (D-076 punto 2)
    ['due mesi passati (dal 2026-08)', ['Assicurazione', 107, 30, '2026-08'], '2026-09-10', { al: '2026-08', mesi: { '2026-08': 107, '2026-09': 0, '2026-10': 0 }, avviso: '⚠ Cambiano i soldi rimanenti di settembre 2026 – ottobre 2026 (già passati). Se è giusto, termina pure.' }],
    ['T-T7', 'aff', '2027-01-15', { al: '2027-01', mesi: { '2026-11': 450, '2026-12': 450, '2027-01': 450, '2027-02': 0 } }],
    ['T-T8', 'ass', '2027-01-15', { al: '2026-12', mesi: { '2026-11': 107, '2026-12': 107, '2027-01': 0 } }],
    ['T-T9', 'abb', '2026-11-30', { al: '2026-11', mesi: { '2026-11': 10, '2026-12': 0 }, frase: 'L’addebito del 30 novembre è entro questo giorno' }],
    ['T-T10', 'abb', '2027-02-28', { al: '2027-02', mesi: { '2027-02': 10, '2027-03': 0 }, frase: 'L’addebito del 28 febbraio è entro questo giorno: conta ancora a febbraio 2027 e non conta più da marzo 2027.' }],
    ['T-T11', 'abb', '2027-02-27', { al: '2027-01', mesi: { '2027-01': 10, '2027-02': 0 }, frase: 'L’addebito del 28 febbraio è dopo questo giorno: non conta più da febbraio 2027.' }],
    ['T-T12', 'abb', '2028-02-28', { al: '2028-01', mesi: { '2028-01': 10, '2028-02': 0 }, frase: 'L’addebito del 29 febbraio è dopo questo giorno' }],
    ['T-T13', 'abb', '2026-12-31', { al: '2026-12', mesi: { '2026-12': 10, '2027-01': 0 } }],
    ['T-T14', { nome: 'Rata', importo: '100', giorno: '3', dal: '2026-09', rate: '3' }, '2027-01-15', { err: 'Finisce già a novembre 2026: “Termina” può solo anticipare la fine.', mesi: { '2026-11': 100, '2026-12': 0, '2027-01': 0 } }],
    ['T-T15', ['Palestra', 30, 20, '2026-11'], '2026-11-17', { err: 'È prima dell’inizio (novembre 2026). Se l’avevi inserita per errore, usa Elimina.', mesi: { '2026-10': 0, '2026-11': 30 } }],
    // 24.2: casi in più di 04 (report 04-fisco-revisione-prove-24-1, §2)
    ['T-T14b', { nome: 'Rata', importo: '100', giorno: '3', dal: '2026-09', rate: '3' }, '2026-10-15', { al: '2026-10', mesi: { '2026-09': 100, '2026-10': 100, '2026-11': 0 } }], // nessun avviso: ottobre resta com'era
    ['T-T18', { nome: 'Affitto', importo: '450', giorno: '3', dal: '2026-10', al: '2026-12' }, '2026-12-31', { err: 'Finisce già a dicembre 2026: “Termina” può solo anticipare la fine.', mesi: { '2026-12': 450, '2027-01': 0 } }],
    ['T-T19', { nome: 'Uscita', importo: '20', giorno: '', dal: '2026-10' }, '2026-11-17', { al: '2026-11', mesi: { '2026-11': 20, '2026-12': 0 } }], // giorno vuoto: vale 1
  ];
  test('casi T-T1…T-T15, T-T6b, T-T14b, T-T18 e T-T19 di 04 (D-073, D-076), dalla finestra', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(() => { D().entrate = { 'v24|risposta': { risposta: 'no', updatedAt: 1 } }; changed(); });
    for (const [nome, u, G, att] of CASI) {
      const f = typeof u === 'string' ? USC[u] : u;
      const campi = Array.isArray(f) ? { nome: f[0], importo: String(f[1]), giorno: String(f[2]), dal: f[3], rate: '' } : f;
      const id = await page.evaluate(c => { D().fissi = {}; const id = uid(); D().fissi[id] = Object.assign({ id, cat: 'altro', al: '', rate: '', updatedAt: 1 }, c); changed(); return id; }, campi);
      await apriTermina(page, id, G);
      if (att.err) {
        await expect(page.locator('#tmMsg'), nome).toHaveText(att.err);
        await expect(page.locator('#tmOk'), nome).toBeDisabled();
        await page.locator('#tmAnn').click(); await page.locator('#fxClose').click();
      } else {
        if (att.frase) await expect(page.locator('#tmMsg'), nome).toContainText(att.frase);
        if (att.avviso) await expect(page.locator('#tmAvv'), nome).toHaveText(att.avviso); else await expect(page.locator('#tmAvv'), nome).toBeHidden();
        await page.locator('#tmOk').click();
        await expect(page.locator('#tmModal'), nome).toBeHidden();
      }
      const r = await page.evaluate(([id, mesi]) => ({ al: D().fissi[id].al, rate: D().fissi[id].rate, mesi: Object.fromEntries(Object.keys(mesi).map(m => [m, contiMese(m).fTot])) }), [id, att.mesi || {}]);
      expect(r.al, nome).toBe(att.err ? (campi.al || '') : att.al);
      if (att.err) expect(r.rate, nome).toBe(campi.rate || ''); // nessuna modifica
      else expect(r.rate, nome).toBe(''); // "Termina" scrive solo "al" e svuota le rate
      if (att.mesi) expect(r.mesi, nome).toEqual(att.mesi);
    }
    expect(errori).toEqual([]);
  });

  test('T-T16: giorno non valido o vuoto → "Scegli l\'ultimo giorno.", niente salvataggio', async ({ browser }) => {
    const { page } = await telefono(browser);
    await page.evaluate(DATI); const I = await ids(page);
    await apriTermina(page, I.Affitto);
    for (const v of ['2026-13-40', 'domani', '']) {
      await page.evaluate(v => { const i = document.getElementById('tmData'); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, v);
      await expect(page.locator('#tmMsg')).toHaveText('Scegli l’ultimo giorno.');
      await expect(page.locator('#tmOk')).toBeDisabled();
      await expect(page.locator('#tmPrima')).toBeHidden();
    }
    await page.locator('#tmOk').click({ force: true });
    expect(await page.evaluate(id => D().fissi[id].al, I.Affitto)).toBe('');
  });

  test('T-T17: due telefoni sullo stesso Drive, uno termina: dopo la sincronizzazione l\'altro ha la stessa fine', async ({ browser }) => {
    const drive = new DriveFinto();
    const A = await nuovoDispositivo(browser, { drive, ora: OGGI }); await pronto(A.page); await accedi(A.page);
    await A.page.evaluate(DATI); await sincronizza(A.page);
    const B = await nuovoDispositivo(browser, { drive, ora: OGGI }); await pronto(B.page); await accediEsistente(B.page);
    const I = await ids(A.page);
    await apriTermina(A.page, I.Affitto); await A.page.locator('#tmOk').click(); await sincronizza(A.page);
    await sincronizza(B.page);
    expect(await B.page.evaluate(id => [D().fissi[id].al, contiMese('2026-12').fTot], I.Affitto)).toEqual(['2026-11', 120]);
  });

  test('"al" e "dal" letti da Drive: un valore non AAAA-MM vale come se mancasse (03), senza errori', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    const r = await page.evaluate(() => { D().fissi = {};
      for (const [id, al, dal] of [['a', 'presto', '2026-10'], ['b', '2026-13', '2026-10'], ['c', '<b>x</b>', 'ieri'], ['d', '2026-10', '2026-10']])
        D().fissi[id] = { id, nome: id, cat: 'altro', importo: '10', giorno: '5', dal, al, rate: '', updatedAt: 1 };
      D().fissi.e = { id: 'e', nome: 'e', cat: 'altro', importo: '10', giorno: '5', dal: 'xx', al: '', rate: '3', updatedAt: 1 };
      changed(); return [contiMese('2026-09').fTot, contiMese('2026-10').fTot, contiMese('2027-05').fTot]; });
    // settembre: c ed e (dal non valido = senza inizio); ottobre: tutte; maggio 2027: a, b, c, e (d finita a ottobre; e senza fine: le rate non si contano senza un "dal" valido)
    expect(r).toEqual([20, 50, 40]);
    await page.evaluate(() => { tab = 'pro'; render(); });
    expect(errori).toEqual([]);
  });

  test('nomi: "Uscite fisse" in Impostazioni e nel filtro del calendario; niente più "Pagamenti fissi" né "Spese del giorno"', async ({ browser }) => {
    const { page } = await telefono(browser);
    await page.evaluate(DATI);
    await page.click('nav [data-tab=pro]');
    await expect(page.locator('#foldFix summary')).toContainText('Uscite fisse');
    await page.evaluate(() => { tab = 'cal'; render(); document.querySelector('#calBtn')?.click(); });
    await expect(page.locator('#calPop')).toContainText('Uscite fisse');
    await expect(page.locator('#calPop')).toContainText('Spese giornaliere');
    expect(await page.evaluate(() => /Pagamenti fissi|pagamento fisso|Spese del giorno/.test(document.body.innerHTML))).toBe(false);
  });
});

test.describe('v24 · primo avvio (E-10, D-051, D-071)', () => {
  // dati come li ha un telefono con la v23: busta di ottobre, lavoro di settembre con solo il lordo (T-M4), compensi di settembre non segnati (T-M5)
  const DATI_V23 = () => {
    const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Reparto'; l.dal = '2026-09-01';
    for (const d of [1, 2, 3, 4, 5]) l.settimana[d] = { da: '09:00', a: '17:00', pausa: '60' };
    l.paga = { tipo: 'mensile', importo: '1900', divisore: '' }; l.tratt = ''; D().lavori = { [l.id]: l };
    D().buste = { [`${l.id}|2026-10`]: { lid: l.id, mese: '2026-10', lordo: '', trattenute: '', netto: '1500', updatedAt: 1 } };
    const p = nuovoProgetto(); p.nome = 'Squadra'; p.ore.attivo = true; p.pagamento = { ritardo: 1 }; D().progetti[p.id] = p; const id = uid();
    D().eventi[id] = { id, pid: p.id, data: '2026-09-12', tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '375', rimborso: false, spese: [], created: 1, updatedAt: 1 };
    delete D().entrate; persist(); return l.id;
  };
  test('T-M1, T-M4, T-M5, T-M3: con "sì" ottobre 1.500 al 31/10 e settembre col lordo 1.900; compensi in arrivo; Tasse invariate; una volta sola', async ({ browser }) => {
    const { page } = await telefono(browser);
    const lid = await page.evaluate(DATI_V23);
    const tasse = await page.evaluate(() => aggrega('2026').tot.netto);
    await page.reload(); await pronto(page);
    await expect(page.locator('#dlgMsg')).toContainText('Segno come entrati stipendi e pensioni dei mesi passati?', { timeout: 5000 });
    await expect(page.locator('#dlgMsg')).toContainText('Novembre resta in attesa');
    await page.getByRole('button', { name: 'Sì, segnali come entrati' }).click();
    const r = await page.evaluate(lid => [D().entrate[`lav|${lid}|2026-10`], D().entrate[`lav|${lid}|2026-09`], D().entrate[`lav|${lid}|2026-11`], contiMese('2026-10').lav.v, aggrega('2026').tot.netto, D().entrate['v24|risposta'].risposta], lid);
    expect(r[0]).toEqual(expect.objectContaining({ entrato: true, data: '2026-10-31', importo: 1500 }));
    expect(r[1]).toEqual(expect.objectContaining({ entrato: true, data: '2026-09-30', importo: 1900 })); // T-M4: il lordo, come contava la v23
    expect(r[2]).toBeUndefined(); // novembre resta in attesa
    expect(r.slice(3)).toEqual([1500, tasse, 'si']);
    // T-M5 (D-071): i compensi di settembre non segnati restano in arrivo, previsti a ottobre
    await vaiRie(page);
    await expect(page.locator('#rieIn .ir').filter({ hasText: 'Compensi di settembre' })).toContainText('previsti a ottobre');
    expect(await page.evaluate(() => contiMese('2026-10').prog)).toBe(0);
    await page.reload(); await pronto(page); await page.waitForTimeout(1200);
    await expect(page.locator('#dlg')).toBeHidden(); // T-M3
  });
  test('T-M2 con "no": ottobre 0 e "in arrivo"; chiudere senza scegliere non vale come risposta', async ({ browser }) => {
    const { page } = await telefono(browser);
    const lid = await page.evaluate(DATI_V23);
    await page.reload(); await pronto(page);
    await expect(page.locator('#dlgMsg')).toContainText('Segno come entrati', { timeout: 5000 });
    await page.keyboard.press('Escape'); await page.evaluate(() => { const d = document.querySelector('#dlg'); if (!d.hidden) d.click(); });
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => D().entrate?.['v24|risposta'] ?? null)).toBeNull();
    await page.reload(); await pronto(page);
    await expect(page.locator('#dlgMsg')).toContainText('Segno come entrati', { timeout: 5000 });
    await page.getByRole('button', { name: 'No, li segno io' }).click();
    expect(await page.evaluate(lid => [contiMese('2026-10').lav.v, D().entrate[`lav|${lid}|2026-10`] ?? null, D().entrate['v24|risposta'].risposta], lid)).toEqual([0, null, 'no']);
    await vaiPag(page, 'dlav');
    await expect(page.locator('#lavIn .ir').filter({ hasText: 'Stipendio di ottobre' })).toContainText('1500,00 €');
  });
});

test.describe('v24 · requisiti di 03', () => {
  test('dati sbagliati nel file su Drive: nessun errore, nessun HTML inserito, voci ignorate', async ({ browser }) => {
    const drive = new DriveFinto();
    const { page, errori } = await nuovoDispositivo(browser, { drive, ora: OGGI }); await pronto(page);
    await accedi(page);
    const lid = await page.evaluate(DATI);
    await page.evaluate(lid => { Object.assign(D().entrate, {
      [`lav|${lid}|2026-10`]: { entrato: 'yes', data: '2026-11-10', importo: 1500, updatedAt: 9e12 },
      [`lav|${lid}|2026-09`]: { entrato: true, data: '2026-13-45', importo: 1500, updatedAt: 9e12 },
      [`lav|${lid}|2026-11`]: { entrato: true, data: '2026-11-02', importo: '<img src=x onerror="window.__x=1">', updatedAt: 9e12 },
      [`lav|<img src=x onerror="window.__y=1">|2026-10`]: { entrato: true, data: '2026-11-03', importo: 99, updatedAt: 9e12 },
      'pen|2026-10': { entrato: true, data: '2026-11-04', importo: Infinity, updatedAt: 9e12 },
      'pen|<b>x</b>': { entrato: true, data: '2026-11-04', importo: 5, updatedAt: 9e12 } });
      pagamenti()['x|2026-10|o'] = { pagato: true, data: 'ieri', importo: 'molto', updatedAt: 1 }; changed(); }, lid);
    await vaiRie(page);
    await page.waitForTimeout(300);
    // ottobre ('yes') e settembre (data sbagliata) ignorati; novembre: importo non numerico → vale l'importo calcolato (stima 1480); pensione Infinity → nessuna pensione calcolata → 0
    expect(await page.evaluate(() => [contiMese('2026-11').lav.v, contiMese('2026-11').pen.v, contiMese('2026-10').lav.v, contiMese('2026-09').lav.v, window.__x, window.__y])).toEqual([1480, 0, 0, 0, undefined, undefined]);
    expect(await page.evaluate(() => document.querySelectorAll('#rieTot img, #rieIn img, #rieLav img').length)).toBe(0);
    expect(errori).toEqual([]);
  });

  test('D-077: pagamenti sbagliati su un progetto esistente (data impossibile, numero, pagato "yes"), id con HTML, colore non #rrggbb: Riepilogo e Tasse coerenti, nessun errore', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(() => { D().entrate = { 'v24|risposta': { risposta: 'no', updatedAt: 1 } }; changed(); });
    // stesso progetto due volte: prima senza pagamenti (riferimento), poi con i pagamenti sbagliati
    const prepara = sbagliati => page.evaluate(sbagliati => {
      const pid = 'p"><b id="iniettato">x</b>'; const p = nuovoProgetto(); p.id = pid; p.nome = 'Squadra'; p.colore = sbagliati ? 'red;background:url(x)' : '#4a5f8a';
      p.ore.attivo = true; p.ore.categoria = 'occasionale'; p.pagamento = { ritardo: 1 }; D().progetti = { [pid]: p }; D().eventi = {};
      for (const [id, data] of [['e1', '2026-08-12'], ['e2', '2026-09-12'], ['e3', '2026-10-12']])
        D().eventi[id] = { id, pid, data, tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '375', rimborso: false, spese: [], created: 1, updatedAt: 1 };
      D().pagamenti = sbagliati ? { [`${pid}|2026-08|o`]: { pagato: true, data: '2026-13-45', updatedAt: 1 }, [`${pid}|2026-09|o`]: { pagato: true, data: 20261005, updatedAt: 1 },
        [`${pid}|2026-10|o`]: { pagato: 'yes', data: '2026-11-05', updatedAt: 1 } } : {};
      changed();
      const A = aggrega('2026'); return { tot: A.tot, mesi: A.mesi.map(m => [m.netto, m.lordo, m.rit]), incasso: ['2026-08', '2026-09', '2026-10'].map(ym => meseIncasso(pid, ym, 'o')),
        elenco: elencoPagamenti('2026').map(i => [i.ym, i.mi, i.data]), prog: ['2026-09', '2026-10', '2026-11'].map(ym => contiMese(ym).prog) };
    }, sbagliati);
    const rif = await prepara(false), bad = await prepara(true);
    expect(bad).toEqual(rif); // i pagamenti sbagliati valgono "non entrati": stesse cifre in Riepilogo e Tasse
    expect(bad.incasso).toEqual(['2026-09', '2026-10', '2026-11']); // mese previsto dal progetto
    expect(bad.elenco.every(r => r[2] === null)).toBe(true);
    // le pagine si disegnano: Riepilogo (mese e anno), Documenti, Tasse
    for (const [t, ym, modo] of [['rie', '2026-11', 'mese'], ['rie', '2026-11', 'anno'], ['doc', '2026-10', 'mese'], ['tas', '2026-11', 'mese']])
      await page.evaluate(([t, ym, modo]) => { cur = ym; rieMode = modo; tab = t; render(); }, [t, ym, modo]);
    // colore non #rrggbb: nella pagina va il grigio (nessuno stile con url(x)); nei pulsanti dei pagamenti la chiave è protetta da esc()
    // (l'id del progetto entra ancora senza esc() in altri attributi, per esempio in Documenti: segnalato nel report 24.1, fuori da D-077)
    await page.evaluate(() => { cur = '2026-10'; tab = 'doc'; render(); });
    expect(await page.evaluate(() => [document.querySelectorAll('[style*="url(x)"]').length, document.querySelectorAll('[data-pag] #iniettato, [data-unpag] #iniettato').length,
      [...new Set([...document.querySelectorAll('[data-pag]')].map(b => b.dataset.pag))].sort()])).toEqual([0, 0, ['2026-08', '2026-09', '2026-10'].map(m => `p"><b id="iniettato">x</b>|${m}|o`)]);
    // un pagamento valido sulla stessa chiave: il pulsante "✓ Entrati" porta la chiave intera, senza HTML inserito
    await page.evaluate(() => { const pid = Object.keys(D().progetti)[0]; pagamenti()[`${pid}|2026-09|o`] = { pagato: true, data: '2026-10-05', updatedAt: 2 }; changed(); cur = '2026-09'; tab = 'doc'; render(); });
    const k = await page.evaluate(() => [...document.querySelectorAll('[data-unpag]')].map(b => b.dataset.unpag));
    expect(k).toContain('p"><b id="iniettato">x</b>|2026-09|o');
    expect(await page.evaluate(() => document.querySelectorAll('[data-pag] #iniettato, [data-unpag] #iniettato').length)).toBe(0);
    expect(errori).toEqual([]);
  });

  test('importazioni tolte: niente schede di Strafobico e della vecchia app; i loro dati restano intatti (non vengono cancellati)', async ({ browser }) => {
    const ctxDati = async page => page.evaluate(() => new Promise(ok => { const r = indexedDB.open('strafobico', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { const db = r.result; const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put({ turni: [{ date: '2026-11-02', tipo: 'M' }] }, 'dati'); t.oncomplete = () => { db.close(); ok(); }; }; }));
    const { page } = await telefono(browser);
    await ctxDati(page);
    await page.evaluate(() => localStorage.setItem('rimborsi-pwa-v1', JSON.stringify({ mesi: { a: { id: '2026-10', entries: [] } } })));
    await page.reload(); await pronto(page); await page.waitForTimeout(500);
    expect(await page.evaluate(() => [!!document.getElementById('stfBox'), !!document.getElementById('importBox'), typeof window.importOld, typeof window.seedDemo, typeof window.BULLDOGS, typeof window.DEMO])).toEqual([false, false, 'undefined', 'undefined', 'undefined', 'undefined']);
    const resta = await page.evaluate(() => new Promise(ok => { const r = indexedDB.open('strafobico'); r.onsuccess = () => { const db = r.result;
      const g = db.transaction('kv').objectStore('kv').get('dati'); g.onsuccess = () => { ok([!!g.result, localStorage.getItem('rimborsi-pwa-v1') !== null]); db.close(); }; }; }));
    expect(resta).toEqual([true, true]);
  });

  test('logo "@bulldogs" rimasto nei dati (telefono mai aggiornato alla 23b): nessun logo e nessun errore; il file non c\'è più', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    const r = await page.evaluate(async () => { const p = nuovoProgetto(); p.nome = 'Squadra'; p.rimborso.attivo = true; p.rimborso.tariffa = 0.4; p.rimborso.logo = '@bulldogs'; D().progetti[p.id] = p;
      const id = uid(); D().eventi[id] = { id, pid: p.id, data: '2026-10-05', tipo: 'allenamento', titolo: '', ore: false, fasce: [], rimborso: true, km: 20, luogo: 'Palestra', spese: [], created: 1, updatedAt: 1 }; changed();
      const f = await pdfRimbBytes(p.id, '2026-10'); return [await logoSrc(p), f.bytes.byteLength > 1000, (await fetch('logo-bulldogs.jpg')).status]; });
    expect(r).toEqual([null, true, 404]);
    await page.evaluate(() => openProj(Object.keys(D().progetti)[0]));
    await expect(page.locator('#pjLogo img')).toHaveCount(0);
    expect(errori).toEqual([]);
  });
});

test.describe('v24 · confronti con la 24csp pubblicata', () => {
  // stessi dati inventati nelle due versioni
  const progetti = () => {
    const pr = D().profilo; Object.assign(pr, { nome: 'Mario', cognome: 'Prova', via: 'Via Inventata 1', residenza: 'Paese di prova', cf: 'PRVMRA80A01H501Z' });
    const c = document.createElement('canvas'); c.width = 120; c.height = 80; const g = c.getContext('2d'); g.fillStyle = '#3a6'; g.fillRect(0, 0, 120, 80); g.fillStyle = '#fff'; g.fillText('LOGO', 40, 45);
    const p = nuovoProgetto(); p.nome = 'Squadra di prova'; p.colore = '#4a5f8a'; p.id = 'pX';
    Object.assign(p.rimborso, { attivo: true, origine: 'Paese di prova', tariffa: 0.4, occasione: 'Allenatore', mansione: 'Allenatore', squadra: 'Under 15', logo: c.toDataURL('image/jpeg', 0.9) });
    p.rimborso.assoc = { riga1: 'Spett.le', nome: 'Associazione di prova', nomeBig: 'PROVA', via: 'Via Esempio 2', citta: 'Città di prova', cf: '' };
    p.rimborso.luoghi = [{ id: 'l1', nome: 'Palestra di prova', km: 12.5 }];
    Object.assign(p.ore, { attivo: true, tariffa: '15', categoria: 'occasionale' }); p.pagamento = { ritardo: 1 }; D().progetti = { [p.id]: p };
    const ev = (id, data, campi) => { D().eventi[id] = Object.assign({ id, pid: p.id, data, tipo: 'allenamento', titolo: '', ore: false, fasce: [], rimborso: false, spese: [], created: 1, updatedAt: 1 }, campi); };
    ev('e1', '2026-10-05', { rimborso: true, km: 25, luogo: 'Palestra di prova', luogoId: 'l1', spese: [{ tipo: 'pedaggi', importo: '3.20' }] });
    ev('e2', '2026-10-12', { rimborso: true, km: 25, luogo: 'Palestra di prova', luogoId: 'l1' });
    ev('e3', '2026-10-14', { ore: true, fasce: [{ da: '17:00', a: '19:30' }] }); ev('e4', '2026-09-21', { ore: true, fisso: '375' });
    pagamenti()['pX|2026-09|o'] = { pagato: true, data: '2026-10-07', updatedAt: 1 };
    D().fissi = { f1: { id: 'f1', nome: 'Affitto', cat: 'altro', importo: '450', giorno: '3', dal: '2026-10', updatedAt: 1 }, f2: { id: 'f2', nome: 'Netflix', cat: 'altro', importo: '13', giorno: '27', dal: '2026-10', updatedAt: 1 } };
    D().spesePers = { s1: { id: 's1', data: '2026-10-15', cat: 'bar', importo: '20', nota: '', created: 1, updatedAt: 1 }, s2: { id: 's2', data: '2026-11-03', cat: 'bar', importo: '7', nota: '', created: 1, updatedAt: 1 } };
    D().entrate = { 'v24|risposta': { risposta: 'no', updatedAt: 1 } };
  };
  async function apri(browser, sito) { const { page } = await nuovoDispositivo(browser, { sito, ora: OGGI }); await page.waitForFunction(() => window.Soldi18 && typeof MODELLI !== 'undefined' && typeof docData === 'function'); await page.evaluate(progetti); return page; }
  test('T-X1 Tasse 2026, soglie e Certificazioni: stessi importi; T-X2 spese giornaliere e uscite fisse dei mesi passati uguali', async ({ browser }) => {
    const prima = sitoDaCommit(BASE_24CSP, 'SOLDIRINI_24CSP');
    test.skip(!prima.sito, prima.motivo);
    const leggi = page => page.evaluate(() => { const A = aggrega('2026'); return { tot: A.tot, mesi: A.mesi.map(m => [m.netto, m.rimb, m.lordo, m.rit]), soglie: soglieAnno('2026').map(s => s.usato),
      ott: [contiMese('2026-10').sp, contiMese('2026-10').fTot], nov: [contiMese('2026-11').sp, contiMese('2026-11').fTot, contiMese('2026-11').fAdd] }; });
    const a = await leggi(await apri(browser, prima.sito)), b = await leggi(await apri(browser, SITO));
    expect(b.tot).toEqual(a.tot); expect(b.mesi).toEqual(a.mesi); expect(b.soglie).toEqual(a.soglie);
    expect(b.ott).toEqual(a.ott); // ottobre: tutte già addebitate
    expect(b.nov.slice(0, 2)).toEqual(a.nov.slice(0, 2)); // spese e totale del mese uguali; nei rimanenti la 24csp usava solo le addebitate (fAdd 450), la v24 tutte (D-066)
  });
  test('documenti: ricevuta, nota spese, prospetto ore (pixel) ed Excel delle ricevute identici alla 24csp, con logo salvato, luoghi e dati', async ({ browser }) => {
    const prima = sitoDaCommit(BASE_24CSP, 'SOLDIRINI_24CSP');
    test.skip(!prima.sito, prima.motivo);
    // 24.1: impronte SHA-256 calcolate nella pagina (di ogni immagine PNG e di ogni parte degli Excel) al posto dei dati interi:
    // stesso confronto, molta meno memoria (con i dati interi la pagina poteva chiudersi per memoria piena sotto carico)
    const doc = async page => { try { return await page.evaluate(async () => {
      const sha = async buf => [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map(x => x.toString(16).padStart(2, '0')).join('');
      const png = c => new Promise(ok => c.toBlob(b => ok(b.arrayBuffer()), 'image/png'));
      const foto = []; const orig = window.html2canvas; window.html2canvas = async (...a) => { const c = await orig(...a); foto.push(await sha(await png(c))); return c; };
      try { await pdfRimbBytes('pX', '2026-10'); const n = foto.length; await pagesToPdf(pagineOre('2026-10'));
        const mesi = [{ ym: '2026-10', d: docData('pX', '2026-10') }];
        const parti = async b => { const z = await JSZip.loadAsync(b); const o = {}; for (const k of Object.keys(z.files).sort()) o[k] = await sha(await z.files[k].async('uint8array')); return JSON.stringify(o); };
        const ric = await parti(await MODELLI.ricevute(await tpl('ricevuta.xlsx'), mesi, await logoSrc(prog('pX')))), nota = await parti(await MODELLI.note(await tpl('nota.xlsx'), mesi));
        return { rimb: foto.slice(0, n), ore: foto.slice(n), ric, nota }; } finally { window.html2canvas = orig; } }); } finally { await page.context().close(); } };
    const a = await doc(await apri(browser, prima.sito)), b = await doc(await apri(browser, SITO));
    expect(a.rimb.length).toBeGreaterThanOrEqual(2); expect(a.ore.length).toBeGreaterThanOrEqual(1);
    expect(b.rimb.length).toBe(a.rimb.length); expect(b.ore.length).toBe(a.ore.length);
    a.rimb.forEach((x, i) => expect(b.rimb[i] === x, `pagina ${i + 1} di ricevuta e nota spese`).toBe(true));
    a.ore.forEach((x, i) => expect(b.ore[i] === x, `pagina ${i + 1} del prospetto ore`).toBe(true));
    expect(b.ric === a.ric, 'Excel delle ricevute').toBe(true); expect(b.nota === a.nota, 'Excel della nota').toBe(true);
  });
  test('compatibilità: un telefono 24csp e uno v24 sullo stesso Drive: le voci "Entrato" non si perdono', async ({ browser }) => {
    const prima = sitoDaCommit(BASE_24CSP, 'SOLDIRINI_24CSP');
    test.skip(!prima.sito, prima.motivo);
    const drive = new DriveFinto();
    const B = await nuovoDispositivo(browser, { drive, ora: OGGI }); await pronto(B.page); await accedi(B.page);
    const lid = await B.page.evaluate(DATI);
    await B.page.evaluate(lid => { D().entrate[`lav|${lid}|2026-10`] = { entrato: true, data: '2026-11-10', importo: 1452, updatedAt: Date.now() }; changed(); }, lid);
    await sincronizza(B.page);
    const A = await nuovoDispositivo(browser, { drive, sito: prima.sito, ora: OGGI }); await accediEsistente(A.page);
    expect(await A.page.evaluate(() => typeof window.Entrate)).toBe('undefined'); // è davvero la 24csp
    await A.page.evaluate(() => { const id = uid(); D().spesePers[id] = { id, data: '2026-11-15', cat: 'bar', importo: '5', nota: '', created: 1, updatedAt: Date.now() }; changed(); });
    await sincronizza(A.page);
    expect(drive.datiJson().entrate[`lav|${lid}|2026-10`].importo).toBe(1452);
    await sincronizza(B.page);
    expect(await B.page.evaluate(lid => [D().entrate[`lav|${lid}|2026-10`].importo, Object.keys(D().spesePers).length, contiMese('2026-11').lav.v], lid)).toEqual([1452, 3, 1452]);
  });
});
