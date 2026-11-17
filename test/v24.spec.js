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
  test('T-R1 riquadro: "Soldi rimanenti:" / "del mese", entrati, usciti, righe Uscite fisse e Spese giornaliere; righe addebitata/addebito', async ({ browser }) => {
    const { page } = await telefono(browser);
    const lid = await page.evaluate(DATI);
    await page.evaluate(lid => { D().entrate[`lav|${lid}|2026-10`] = { entrato: true, data: '2026-11-10', importo: 1500, updatedAt: 1 };
      const p = nuovoProgetto(); p.nome = 'Squadra'; p.ore.attivo = true; D().progetti[p.id] = p; const id = uid();
      D().eventi[id] = { id, pid: p.id, data: '2026-10-12', tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '375', rimborso: false, spese: [], created: 1, updatedAt: 1 };
      pagamenti()[`${p.id}|2026-10|o`] = { pagato: true, data: '2026-11-05', importo: 300, updatedAt: 1 }; changed(); }, lid);
    await vaiRie(page);
    const rim = page.locator('#rieTot .hero .rim');
    await expect(rim).toContainText('Soldi rimanenti:');
    await expect(rim.locator('.dm')).toHaveText('del mese');
    await expect(rim.locator('b')).toHaveText('1150,00 €');
    await expect(rim.locator('.det')).toHaveText('Entrati 1800,00 € · usciti 650,00 €');
    await expect(rim.locator('.hl')).toHaveText(['Uscite fisse: 570,00 €', 'Spese giornaliere: 80,00 €']);
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
    const box = page.locator('#rieIn .inarr');
    await expect(box.locator('.ir').filter({ hasText: 'Stipendio di novembre' })).toContainText('1480,00 € (stima)');
    await expect(box.locator('.ir').filter({ hasText: 'Stipendio di agosto' })).toContainText('⚠ Da più di 2 mesi: controlla se è entrato');
    await expect(box.locator('.ir').filter({ hasText: 'Stipendio di settembre' })).not.toContainText('⚠');
    await expect(box.locator('h3')).toContainText('non contati');
    await vaiRie(page, '2026-12'); await expect(page.locator('#rieIn .inarr')).toHaveCount(0);
    await expect(page.locator('#rieFix .kv span').filter({ hasText: 'Affitto' })).toContainText('addebito il 3');
    await vaiRie(page, '2026-11', 'anno'); await expect(page.locator('#rieIn .inarr')).toHaveCount(0);
  });

  test('finestra: proposta dalla busta, data nel futuro rifiutata (T-S9), data insolita (T-S10), salva, "Non entrato" (T-S8), avviso busta diversa (T-S7)', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    const lid = await page.evaluate(DATI);
    await vaiRie(page);
    await page.locator('#rieIn .ir').filter({ hasText: 'Stipendio di ottobre' }).locator('button').click();
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
    await expect(page.locator('#rieIn .ir').filter({ hasText: 'Stipendio di ottobre' })).toHaveCount(1);
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
    await expect(rim).toContainText('Rimasti nel 2026');
    await expect(rim.locator('.dm')).toHaveText('somma dei mesi da gennaio a novembre');
    await expect(rim.locator('.hl').last()).toHaveText('Uscite fisse ancora da addebitare entro dicembre: 570,00 €');
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

  test('"Termina da questo mese": già addebitata → conta ancora a novembre (T-U9); non ancora addebitata → da novembre non conta (T-U8)', async ({ browser }) => {
    const { page } = await telefono(browser);
    await page.evaluate(DATI);
    const ids = await page.evaluate(() => Object.fromEntries(Object.values(D().fissi).map(f => [f.nome, f.id])));
    // testi 19a/19b di 02 (report 02-ux-d072)
    const termina = async (id, testo, dopo) => {
      await page.evaluate(id => Soldi18.apriFisso(D().fissi[id]), id);
      await expect(page.locator('#fxFineNota')).toContainText(testo + ' I mesi passati restano come sono.');
      await page.locator('#fxFine').click();
      await expect(page.locator('#dlgMsg')).toContainText(testo);
      await page.locator('#dlgBtns').getByRole('button', { name: 'Termina' }).click();
      await expect(page.locator('#toast')).toHaveText(dopo);
    };
    await termina(ids.Affitto, 'Questo mese è già stata pagata: conta ancora a novembre e non conta più da dicembre 2026.', '✓ Affitto terminata: conta fino a novembre 2026.');
    await termina(ids.Assicurazione, 'Da novembre 2026 non conta più.', '✓ Assicurazione terminata: conta fino a ottobre 2026.');
    const r = await page.evaluate(ids => [D().fissi[ids.Affitto].al, D().fissi[ids.Assicurazione].al, contiMese('2026-10').fTot, contiMese('2026-11').fTot, contiMese('2026-12').fTot], ids);
    expect(r).toEqual(['2026-11', '2026-10', 570, 463, 13]); // ottobre invariato; novembre senza assicurazione; dicembre solo Netflix
    // "Elimina" toglie anche dai mesi passati (T-U8, comportamento di prima)
    await page.evaluate(id => Soldi18.apriFisso(D().fissi[id]), ids.Netflix);
    await page.locator('#fxDel').click(); await page.locator('#dlgBtns').getByRole('button', { name: 'Elimina' }).click();
    expect(await page.evaluate(() => contiMese('2026-10').fTot)).toBe(557);
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
    await vaiRie(page);
    await expect(page.locator('#rieIn .ir').filter({ hasText: 'Stipendio di ottobre' })).toContainText('1500,00 €');
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
    const doc = page => page.evaluate(async () => {
      const foto = []; const orig = window.html2canvas; window.html2canvas = async (...a) => { const c = await orig(...a); foto.push(c.toDataURL('image/png')); return c; };
      try { await pdfRimbBytes('pX', '2026-10'); const n = foto.length; await pagesToPdf(pagineOre('2026-10'));
        const mesi = [{ ym: '2026-10', d: docData('pX', '2026-10') }];
        const parti = async b => { const z = await JSZip.loadAsync(b); const o = {}; for (const k of Object.keys(z.files).sort()) o[k] = [...await z.files[k].async('uint8array')].join(','); return JSON.stringify(o); };
        const ric = await parti(await MODELLI.ricevute(await tpl('ricevuta.xlsx'), mesi, await logoSrc(prog('pX')))), nota = await parti(await MODELLI.note(await tpl('nota.xlsx'), mesi));
        return { rimb: foto.slice(0, n), ore: foto.slice(n), ric, nota }; } finally { window.html2canvas = orig; } });
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
