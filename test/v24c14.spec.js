// 24c.14: "c'è 1 entrata" e testi definitivi di 02 (tornate 51 e 53), entrate extra nel calendario (D-167 punto 2), nota vuota
// dal bonifico (D-167 punto 3), informativa di 03, P6, <!DOCTYPE nell'Excel e file Excel "cattivi" 1-5 di 03, casi DS1-DS15e di 04,
// id della voce da confermare dall'impronta (R1), nome di chi manda modificabile (N2), una sola casella "Spese" (D-168).
// Solo dati inventati (D-089).
const { test, expect } = require('./helpers/prova');
const { DriveFinto, nuovoDispositivo } = require('./helpers/app');
const B = require('./helpers/banca-finta');
const r2 = x => Math.round(x * 100) / 100;

async function telefono(browser, ora = '2026-11-20T10:00:00+01:00') {
  const d = await nuovoDispositivo(browser, { drive: new DriveFinto(), ora, telefono: true });
  await d.page.waitForFunction(() => window.Entrate && window.EntrateExtra && window.Stip15 && window.Archivio && Archivio.avviata && window.Banca);
  await d.page.evaluate(() => { DB.meta.skipWelcome = true; changed(); render(); });
  return d;
}
// lavoro "Ditta Esempio" e le uscite fisse del libro di 04 (Affitto 450 il 3, Luce 40 il 5, Streaming 12,99 il 27, dal 2026-10)
const base = (page, { fissi = true, dal = '2026-10' } = {}) => page.evaluate(({ fissi, dal }) => {
  const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Ditta Esempio'; l.dal = '2026-01-01'; D().lavori = { [l.id]: l };
  D().fissi = {};
  if (fissi) for (const [nome, imp, g, cat] of [['Affitto', '450', '3', 'casa'], ['Luce', '40', '5', 'utenze'], ['Streaming', '12.99', '27', 'abbonamenti']]) {
    const id = uid(); D().fissi[id] = { id, cat, nome, importo: imp, giorno: g, dal, al: '', rate: '', nota: '', updatedAt: 1 }; }
  changed(); render(); return l.id; }, { fissi, dal });
// importa una lista con le proposte di partenza; restituisce [data, importo, mese in cui conta] delle spese salvate
async function importa(page, righe) {
  await page.evaluate(() => { document.querySelectorAll('.modal:not([hidden])').forEach(m => m.hidden = true); vaiA('dsp'); });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#v-dsp [data-bcimp]')]);
  await fc.setFiles(B.file(B.lista(righe)));
  await expect(page.locator('#bcModal')).toBeVisible();
  const R = await page.locator('#bcList .bcrow').evaluateAll(R => R.map(r => ({ data: r.querySelector('.bcd').textContent, scelta: r.querySelector('select')?.value ?? null,
    mese: r.querySelector('.bcmese')?.textContent.trim() ?? null, info: r.querySelector('.bcinfo')?.textContent.trim() })));
  await page.click('#bcImporta'); await expect(page.locator('#bcModal')).toBeHidden();
  return R;
}
const spese = page => page.evaluate(() => Object.values(D().spesePers).filter(s => !s.deleted).map(s => [s.data.slice(8) + '/' + s.data.slice(5, 7), s.importo, meseSpesa(s)])
  .sort((a, b) => a[2].localeCompare(b[2]) || a[0].localeCompare(b[0])));

test.describe('24c.14', () => {
  test('riquadro "c’è 1 entrata da confermare" che scende a ogni scelta e sparisce a 0; id dall’impronta (R1); nome di chi manda modificabile (N2); accredito sconosciuto', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(() => vaiA('dsp'));
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#v-dsp [data-bcimp]')]);
    await fc.setFiles(B.file(B.lista([B.bonEnt('05/11/2026', 50, 'RESTITUZIONE ESEMPIO', 'Cena'), B.bonEnt('06/11/2026', 15, 'NOME INVENTATO', 'Altro'), B.accredito('07/11/2026', 0.12, 'Accredito interessi')])));
    // N2: il nome si può cambiare o cancellare prima di "Importa"
    const campi = page.locator('#bcList [data-bcchi]');
    await expect(campi).toHaveCount(2);
    await expect(campi.nth(0)).toHaveValue('RESTITUZIONE ESEMPIO');
    await campi.nth(1).fill('');
    await expect(page.locator('#bcList .bcrow').nth(2).locator('.bcinfo')).toHaveText('Soldi arrivati sul conto, ma Soldirini non sa cosa sono. Vanno tra le «Entrate da confermare», dove scegli cos’è. Finché non scegli, non contano.');
    await page.click('#bcImporta');
    const nota = page.locator('#v-dsp .dcnote');
    await expect(nota.locator('span')).toHaveText('Nella lista ci sono 3 entrate da confermare. Finché non scegli cosa sono, non contano nei soldi.');
    await expect(nota.locator('button')).toHaveAttribute('aria-label', 'Controlla le entrate da confermare');
    const V = await page.evaluate(() => Object.values(D().daConfermare).map(x => [x.id, x.nome, x.fonte, x.impronta]));
    for (const [id, , , h] of V) expect(id).toBe('dc' + h.slice(0, 24));
    expect(V.map(v => [v[1], v[2]])).toEqual([['RESTITUZIONE ESEMPIO', 'bonifico'], ['', 'bonifico'], ['', 'accredito']]);
    await page.evaluate(() => vaiA('dinc')); // (con "Controlla" il riquadro si chiude: qui si va all'elenco senza toccarlo)
    await expect(page.locator('#dcCard h3')).toHaveText('🏦 Entrate da confermare');
    await expect(page.locator('#dcCard .dcchi')).toHaveText(['Da RESTITUZIONE ESEMPIO', 'Bonifico ricevuto', 'Accredito']);
    await expect(page.locator('#dcCard [data-dc]').first()).toHaveAttribute('aria-label', 'Scegli cos’è l’entrata di 50,00 € del 05/11/2026');
    // due scelte → il riquadro dice "c'è 1"
    for (let k = 0; k < 2; k++) { await page.locator('#dcCard [data-dc]').first().click(); await page.locator('#xeScelte input[value="no"]').check(); await page.click('#xeOk'); }
    await expect(page.locator('#toast')).toHaveText('✓ Tolta dall’elenco.');
    await page.evaluate(() => vaiA('dsp'));
    await expect(nota.locator('span')).toHaveText('Nella lista c’è 1 entrata da confermare. Finché non scegli cos’è, non conta nei soldi.');
    await page.evaluate(() => vaiA('dinc'));
    await page.locator('#dcCard [data-dc]').click(); await page.locator('#xeScelte input[value="no"]').check(); await page.click('#xeOk');
    await page.evaluate(() => vaiA('dsp'));
    await expect(page.locator('.dcnote')).toHaveCount(0);
    // R1: la stessa voce creata su un altro telefono ha lo stesso id → una voce sola dopo l'unione
    const unita = await page.evaluate(() => { const id = Object.keys(D().daConfermare)[0]; const a = { daConfermare: { [id]: { id, deleted: true, esito: 'no', updatedAt: 9 } } };
      const b = { daConfermare: { [id]: { id, data: '2026-11-05', importo: 50, nome: 'X', updatedAt: 3 } } }; const m = mergeData(a, b); return Object.keys(m.daConfermare).length; });
    expect(unita).toBe(1);
    expect(errori).toEqual([]);
  });

  test('D-167 (3) e testi della finestra: entrata extra da un bonifico con la nota vuota, nessun nome nei dati; "Conta in"; toast; "⚠ Già segnati come entrati"; nessun progetto', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await importa(page, [B.bonEnt('05/11/2026', 50, 'RESTITUZIONE ESEMPIO', 'Cena')]);
    await page.evaluate(() => vaiA('dinc'));
    await page.locator('#dcCard [data-dc]').click();
    await expect(page.locator('#xeChi')).toHaveText('Da RESTITUZIONE ESEMPIO');
    await expect(page.locator('#xeScelte .check b')).toHaveText(['Entrata extra', 'Compenso o rimborso di un progetto', 'Non è un’entrata']);
    await page.locator('#xeScelte input[value="prog"]').check();
    await expect(page.locator('#xePgVuoto')).toHaveText('Nessun progetto ha attività da collegare. Scegli «Entrata extra», oppure segna prima le attività in Progetti.');
    await expect(page.locator('#xeOk')).toBeDisabled();
    await page.locator('#xeScelte input[value="extra"]').check();
    await expect(page.locator('#xeNota')).toHaveValue(''); // D-167 (3)
    await expect(page.locator('#xeNota')).toHaveAttribute('placeholder', 'es. parte dell’affitto');
    await expect(page.locator('#xePExtra')).toContainText('Non conta per le tasse. Per i compensi di un lavoro usa «Progetti».');
    for (const c of await page.locator('#xeTipi .chip, #xeScelte .check').all()) expect((await c.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await page.click('#xeOk');
    await expect(page.locator('#toast')).toHaveText('✓ Entrata extra salvata: conta in novembre.');
    const ex = await page.evaluate(() => Object.values(D().entrateExtra)[0]);
    expect(ex.nota).toBe('');
    expect(await page.evaluate(() => JSON.stringify([D().entrateExtra, D().daConfermare]))).not.toContain('RESTITUZIONE');
    // "Conta in {mese}." sotto Giorno: un'entrata del 03/11 che conta in ottobre
    await page.evaluate(() => { const id = uid(); D().daConfermare[id] = { id, data: '2026-11-03', meseConto: '2026-10', importo: 9, nome: '', fonte: 'bonifico', updatedAt: 1 }; changed(); render(); });
    await page.locator('#dcCard [data-dc]').click(); await page.locator('#xeScelte input[value="extra"]').check();
    await expect(page.locator('#xeConta')).toHaveText('Conta in ottobre.');
    await page.locator('#xeData').fill('2026-11-04'); await page.locator('#xeData').dispatchEvent('input');
    await expect(page.locator('#xeConta')).toBeHidden();
    await page.click('#xeAnn');
    // "Già segnati come entrati" in un riquadro arancio; toast della scelta b)
    await page.evaluate(() => { const p = nuovoProgetto(); p.nome = 'Squadra Azzurra'; p.ore.attivo = true; D().progetti = { [p.id]: p };
      D().eventi = { e1: { id: 'e1', pid: p.id, data: '2026-10-10', tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '120', rimborso: false, spese: [], created: 1, updatedAt: 1 } };
      D().pagamenti = { [`${p.id}|2026-10|o`]: { pagato: true, data: '2026-11-01', importo: 100, updatedAt: 1 } }; changed(); render(); });
    await page.locator('#dcCard [data-dc]').click(); await page.locator('#xeScelte input[value="prog"]').check();
    await expect(page.locator('#xePgGia')).toHaveText('⚠ Già segnati come entrati il 01/11/2026. Salvando, li sostituisci con questi.');
    await expect(page.locator('#xePgGia')).toHaveClass(/vcavv/);
    await page.click('#xeOk');
    await expect(page.locator('#toast')).toHaveText('✓ Compensi di ottobre segnati come entrati.');
    expect(errori).toEqual([]);
  });

  test('D-167 (2): entrate extra nel calendario ("🪙 +importo") e nel giorno aperto; modifica dal giorno; scheda con il totale; eliminazione con conferma', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(() => { for (const [id, d, imp, tipo, nota] of [['a', '2026-11-12', 80, 'vendita', 'Bici'], ['b', '2026-11-12', 20, 'regalo', ''], ['c', '2026-11-03', 15.5, 'altro', '<b>x</b>']])
      D().entrateExtra = Object.assign(D().entrateExtra || {}, { [id]: { id, data: d, importo: imp, tipo, nota, created: 1, updatedAt: 1 } });
      tab = 'cal'; cur = '2026-11'; changed(); render(); });
    await expect(page.locator('#grid [data-day="2026-11-12"] .ev.ex')).toHaveText('🪙 +100 €');
    await expect(page.locator('#grid [data-day="2026-11-03"] .ev.ex')).toHaveText('🪙 +15,5 €');
    await expect(page.locator('#grid [data-day="2026-11-04"] .ev.ex')).toHaveCount(0);
    await page.evaluate(() => { selDay = '2026-11-12'; apriGiorno('2026-11-12'); });
    const box = page.locator('#dayExtra');
    await expect(box.locator('.tuh')).toHaveText(/🪙 Entrate extra\s*\+ 100,00 €/);
    await expect(box.locator('.sprow .tx')).toHaveText(['VenditaBici', 'Regalo']);
    await box.locator('[data-xe]').first().click();
    await page.locator('#xeImp').fill('70'); await page.click('#xeOk');
    await expect(box.locator('.tuh')).toHaveText(/\+ 90,00 €/);
    // l'occhio nasconde anche questi importi (classe .ev.sp e .sprow b)
    expect(await page.locator('#grid .ev.ex').first().evaluate(e => e.classList.contains('sp'))).toBe(true);
    // scheda nella pagina "Ancora da incassare": testo nella seconda riga, totale con 2 o più voci
    await page.evaluate(() => { document.querySelectorAll('.modal:not([hidden])').forEach(m => m.hidden = true); vaiA('dinc'); });
    await expect(page.locator('#xeT')).toHaveText('🪙 Entrate extra di novembre 2026');
    await expect(page.locator('#rieExtra .ir .tx small').first()).toHaveText('03/11/2026 · <b>x</b>');
    await expect(page.locator('#rieExtra .kv.big')).toHaveText(/Totale\s*105,50 €/);
    await page.locator('#rieExtra [data-xe]').first().click();
    await page.click('#xeDel');
    await expect(page.locator('#dlgMsg')).toHaveText('Eliminare l’entrata extra di 15,50 €?');
    await page.locator('#dlgBtns .btn.danger').click();
    await expect(page.locator('#toast')).toHaveText('✓ Entrata extra eliminata.');
    expect(await page.evaluate(() => contiMese('2026-11').ext)).toBe(90);
    expect(errori).toEqual([]);
  });

  test('D-168: una sola casella "Spese" (uscite fisse + spese giornaliere = Uscite); pagina "Spese" con le due parti; vista Anno; i collegamenti vecchi portano alla parte giusta', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await base(page);
    await page.evaluate(() => { for (const [d, v] of [['2026-11-02', 4.5], ['2026-11-12', 30]]) { const id = uid(); D().spesePers[id] = { id, data: d, cat: 'altro', importo: v, nota: '', created: 1, updatedAt: 1 }; }
      tab = 'rie'; rieMode = 'mese'; cur = '2026-11'; changed(); render(); });
    const C = await page.evaluate(() => contiMese('2026-11'));
    const caselle = await page.locator('#heroDet [data-vai]').evaluateAll(E => E.map(e => [e.dataset.vai, e.querySelector('small,span')?.textContent.trim()]));
    expect(caselle.filter(c => c[0] === 'dsp')).toHaveLength(1);
    expect(caselle.some(c => c[0] === 'dfx')).toBe(false);
    await expect(page.locator('#heroDet [data-vai="dsp"]')).toContainText('Spese');
    await expect(page.locator('#heroDet [data-vai="dsp"]')).toContainText(new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, useGrouping: 'always' }).format(C.usciti) + ' €');
    expect(r2(C.fTot + C.sp)).toBe(C.usciti);
    // la pagina
    await page.locator('#heroDet [data-vai="dsp"]').click();
    await expect(page.locator('#v-dsp h2')).toHaveText('Spese');
    await expect(page.locator('#v-dsp .testa small')).toHaveText('Spese di novembre');
    await expect(page.locator('#v-dsp .testa b')).toHaveText(/^502,99|^537,49/);
    await expect(page.locator('#rieFix summary .st')).toHaveText('💳 Uscite fisse');
    await expect(page.locator('#rieFix summary .sum')).toHaveText('− 502,99 €');
    await expect(page.locator('#rieSpese')).toContainText('🛒 Spese giornaliere');
    expect(await page.evaluate(() => { const v = document.getElementById('v-dsp'), p = [...v.children].map(e => e.id); return p.indexOf('rieFix') < p.indexOf('rieSpese'); })).toBe(true);
    await expect(page.locator('#rieFix')).toContainText('Affitto');
    await expect(page.locator('#rieSpese')).toContainText('34,50 €');
    await expect(page.locator('#v-dsp [data-bcimp]')).toBeVisible();
    await expect(page.locator('#rieFixVuoto')).toBeHidden(); await expect(page.locator('#rieSpeseVuoto')).toBeHidden();
    // la pagina vecchia "Uscite fisse" porta alla parte giusta, anche dal posto salvato (D-130)
    await page.evaluate(() => { vaiA('rie'); vaiA('dfx'); });
    expect(await page.evaluate(() => tab)).toBe('dsp');
    await expect(page.locator('#spFissi')).toBeInViewport();
    await page.evaluate(() => { localStorage.setItem('soldirini-posto', JSON.stringify({ tab: 'rie', sub: 'dfx', cur: '2026-11', rieMode: 'mese' })); });
    await page.reload(); await page.waitForFunction(() => window.Archivio && Archivio.avviata);
    await expect(page.locator('#v-dsp')).toBeVisible();
    await expect(page.locator('#spFissi')).toBeInViewport();
    // vista Anno: casella con i totali dell'anno; casella "Uscite fisse ancora da addebitare" porta alla pagina
    await page.evaluate(() => { tab = 'rie'; rieMode = 'anno'; cur = '2026-11'; render(); });
    const A = await page.evaluate(() => contiAnno('2026'));
    await expect(page.locator('#heroDet [data-vai="dsp"]').first()).toContainText(new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, useGrouping: 'always' }).format(r2(A.fTot + A.sp)) + ' €');
    // solo spese giornaliere, senza uscite fisse: la casella c'è, la parte delle uscite fisse dice che è vuota
    await page.evaluate(() => { for (const f of Object.values(D().fissi)) f.deleted = true; tab = 'rie'; rieMode = 'mese'; changed(); render(); });
    await expect(page.locator('#heroDet [data-vai="dsp"]')).toContainText('34,50 €');
    await page.evaluate(() => vaiA('dsp'));
    await expect(page.locator('#rieFixVuoto')).toBeVisible();
    // niente uscite e niente spese: nessuna casella
    await page.evaluate(() => { for (const s of Object.values(D().spesePers)) s.deleted = true; tab = 'rie'; changed(); render(); });
    await expect(page.locator('#heroDet [data-vai="dsp"]')).toHaveCount(0);
    expect(errori).toEqual([]);
  });

  test('testi definitivi di 02 (tornata 51) e P6: "Soldi rimanenti di {mese}", frase grigia nelle quattro varianti, "−" senza rosso, "Inizia i conti da"; uscita fissa "dal 1900-01"', async ({ browser }) => {
    const { page, errori } = await telefono(browser, '2026-11-20T10:00:00+01:00');
    await page.evaluate(() => {
      const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Ditta Esempio'; l.dal = '2026-01-01'; D().lavori[l.id] = l;
      D().entrate = { [`lav|${l.id}|2026-07`]: { entrato: true, data: '2026-08-10', importo: 100, updatedAt: 1 }, [`lav|${l.id}|2026-09`]: { entrato: true, data: '2026-10-10', importo: 50, updatedAt: 1 } };
      const id = uid(); D().spesePers = { [id]: { id, data: '2026-09-15', cat: 'altro', importo: 30, nota: '', created: 1, updatedAt: 1 } }; changed(); });
    const frase = ym => page.evaluate(ym => { tab = 'rie'; rieMode = 'mese'; cur = ym; render(); return document.querySelector('#rieRim p')?.textContent; }, ym);
    expect(await frase('2026-11')).toBe('Somma dei mesi da agosto 2026 a ottobre 2026. Il numero grande in alto resta solo di novembre.');
    expect(await frase('2026-09')).toBe('Solo agosto 2026, il primo mese con dati. Il numero grande in alto resta solo di settembre.');
    await page.evaluate(() => { impost().contiDa = '2026-09'; changed(); });
    expect(await frase('2026-11')).toBe('Somma dei mesi da settembre 2026 a ottobre 2026, come scelto in Impostazioni → Aspetto. Il numero grande in alto resta solo di novembre.');
    expect(await frase('2026-10')).toBe('Solo settembre 2026, come scelto in Impostazioni → Aspetto. Il numero grande in alto resta solo di ottobre.');
    // "Soldi rimanenti di ottobre", "−30,00 €" con il segno vero e il colore del testo
    await page.locator('#rieRim summary').click();
    const righe = await page.locator('#rieRim .kv').evaluateAll(K => K.map(k => [...k.children].map(c => c.textContent.trim()).join(' ')));
    expect(righe).toEqual(['Rimasti dai mesi prima −30,00 €', 'Soldi rimanenti di ottobre 50,00 €', 'Totale 20,00 €']);
    expect(await page.locator('#rieRim .kv b').first().evaluate(b => getComputedStyle(b).color === getComputedStyle(document.body).color)).toBe(true);
    expect(await page.locator('#rieRim summary .st span[aria-hidden="true"]').textContent()).toBe('↪️');
    // "Inizia i conti da": frase definitiva
    await expect(page.locator('#contiDaNota')).toHaveText('Vale solo per “Rimasti dai mesi prima” nel Riepilogo: somma i mesi da qui in poi. I dati dei mesi prima restano nell’app. Vuoto: dal primo mese con dati.');
    // P6: uscita fissa 10 € "dal 1900-01" → la somma dei 1.200 mesi fino a ottobre 2026, non dei mesi 1900-1999
    const p6 = await page.evaluate(() => { delete impost().contiDa; D().entrate = {}; D().spesePers = {}; D().lavori = {};
      const id = uid(); D().fissi = { [id]: { id, cat: 'utenze', nome: 'Luce', importo: '10', giorno: '5', dal: '1900-01', al: '', rate: '', nota: '', updatedAt: 1 } }; changed();
      tab = 'rie'; rieMode = 'mese'; cur = '2026-11'; render(); return [rimastiPrima('2026-11'), document.querySelector('#rieRim p').textContent]; });
    expect(p6).toEqual([-12000, 'Somma dei mesi da novembre 1926 a ottobre 2026. Il numero grande in alto resta solo di novembre.']);
    // con dati normali niente cambia (uscita dal 2026-09 → −20 a novembre)
    expect(await page.evaluate(() => { Object.values(D().fissi)[0].dal = '2026-09'; changed(); return rimastiPrima('2026-11'); })).toBe(-20);
    expect(errori).toEqual([]);
  });

  test('informativa definitiva di 03 (24c.11 e 24c.13)', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    const pr = await page.evaluate(async () => (await fetch('privacy.html')).text());
    expect(pr).toContain('(versione 24c.14)');
    expect(pr).toContain('entrate extra (restituzioni, regali, vendite e altro, con la data, l’importo, il tipo e la nota se la scrivi), uscite fisse, spese, risparmi');
    expect(pr).toContain('Quando nella lista c’è lo stipendio, salva anche il mese in cui ogni movimento conta nei tuoi soldi.');
    expect(pr).toContain('I bonifici ricevuti e gli altri accrediti che l’app non sa riconoscere vanno tra le «Entrate da confermare», con la data, l’importo e il <b>nome di chi te li manda</b>, che ti serve per capire cosa sono;');
    expect(pr).toContain('il nome resta solo nelle copie di sicurezza fatte prima e, per circa 30 giorni, nelle versioni precedenti del file dei dati che Google Drive conserva da solo.');
    expect(pr).toContain('il saldo del conto, il nome e il conto dell’intestatario, né i nomi di chi riceve un tuo bonifico.');
    expect(pr.match(/<li><b>Movimenti della banca<\/b>/g)).toHaveLength(1);
    expect(errori).toEqual([]);
  });

  test('Excel: <!DOCTYPE → "non si legge bene"; file cattivi 1-5 di 03 (formula e caratteri, parte enorme, entità annidate ed esterne, righe troppe)', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    const R = [B.carta('01/11/2026', -4.5, 'BAR ESEMPIO'), B.carta('02/11/2026', -12, 'NEGOZIO ESEMPIO')];
    const ROVINATO = 'Una riga del file non si legge bene, quindi non è stato importato niente. Prova a scaricare di nuovo la lista.';
    const GRANDE = 'Il file è troppo grande (più di 5 MB o di 5.000 righe): scarica un periodo più breve. Non è stato importato niente.';
    const prova = async (opz, atteso) => { await page.evaluate(() => vaiA('dsp')); await page.setInputFiles('#bcFile', B.xfile(await B.xlsx(page, R, opz)));
      if (atteso) { await expect(page.locator('#bcErr')).toHaveText(atteso); await expect(page.locator('#bcModal')).toBeHidden(); } else await expect(page.locator('#bcModal')).toBeVisible(); };
    const rete = []; page.on('request', r => { if (!r.url().startsWith('data:')) rete.push(r.url()); });
    // 1 – formula e caratteri: si legge; solo testo; niente testata, U+202E, HYPERLINK nei dati
    const R1 = [B.carta('01/11/2026', -4.5, 'BAR ‮ESEMPIO <img src=x onerror=alert(1)> =1+1'), R[1]];
    await page.evaluate(() => vaiA('dsp'));
    await page.setInputFiles('#bcFile', B.xfile(await B.xlsx(page, R1, { cellaExtra: '<c r="G13" t="str"><f>HYPERLINK("http://esempio.invalid","clic")</f><v>clic</v></c>' })));
    await expect(page.locator('#bcModal')).toBeVisible();
    expect(await page.locator('#bcList img').count()).toBe(0);
    await page.click('#bcImporta');
    const dati = await page.evaluate(() => JSON.stringify(D()));
    expect(dati).not.toMatch(/‮|HYPERLINK|esempio\.invalid|Intestatario|NOME INVENTATO|IT00X/);
    expect(await page.evaluate(() => Object.keys(D().bancaImpronte).every(k => /^[0-9a-f]{64}$/.test(k)))).toBe(true);
    // 2 – parte enorme (30 MB di spazi in sharedStrings)
    await prova({ sstGrande: 30 * 1024 * 1024 }, GRANDE);
    // 3 – entità annidate; 4 – entità esterna: tutte e due hanno <!DOCTYPE → rovinato, niente salvato
    const prima = await page.evaluate(() => Object.keys(D().spesePers).length);
    const annidate = '<!DOCTYPE worksheet [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;"><!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;">]>';
    await prova({ doctype: annidate }, ROVINATO);
    await prova({ doctype: '<!DOCTYPE worksheet [<!ENTITY x SYSTEM "file:///etc/passwd">]>' }, ROVINATO);
    expect(await page.evaluate(() => Object.keys(D().spesePers).length)).toBe(prima);
    // 5 – righe troppe (6.000)
    await prova({ righeVuote: 6000 }, GRANDE);
    expect(rete.filter(u => !/\/soldirini\//.test(u))).toEqual([]);
    expect(errori).toEqual([]);
  });

  test('D-169: "I soldi messi da parte si tolgono dai soldi del mese": spenta niente cambia; accesa 100 € il 02/12 → dicembre −100, prelievo 30 € il 15/12 → −70; casella "Messi da parte"; salvadanaio con la data di oggi; tasse identiche; dati rovinati ignorati', async ({ browser }) => {
    const { page, errori } = await telefono(browser, '2026-12-20T10:00:00+01:00');
    await base(page);
    const conti = () => page.evaluate(() => JSON.stringify([['2026-11', '2026-12'].map(m => contiMese(m)), contiAnno('2026'), rimastiPrima('2026-12')]));
    const fisco = () => page.evaluate(() => JSON.stringify([aggrega('2026'), stimaTasse('2026')]));
    const f0 = await fisco(), c0 = await conti();
    await page.evaluate(() => { D().risparmi = { 'mv:a': { data: '2026-12-02', importo: '100', ob: '', nota: '', updatedAt: 1 }, 'mv:b': { data: '2026-12-15', importo: '-30', ob: '', nota: '', updatedAt: 1 },
      'mv:x': { data: '', importo: '50', updatedAt: 1 }, 'mv:y': { importo: '40', updatedAt: 1 }, 'mv:z': { data: '2026-12-03', importo: 'tanti', updatedAt: 1 }, 'mv:w': { data: '2026-12-32', importo: '9', updatedAt: 1 } }; changed(); });
    // spenta (assente): nessun numero cambia
    expect(await conti()).toBe(c0);
    // la pagina Risparmi si apre anche con i dati rovinati
    await page.evaluate(() => { vaiA('ris'); });
    await expect(page.locator('#rsTogli')).not.toBeChecked();
    await expect(page.locator('#rsTogliNota')).toHaveText('Spenta: i risparmi non cambiano i soldi rimanenti.');
    // accesa dalla pagina Risparmi
    await page.locator('#rsTogli').check();
    expect(await page.evaluate(() => impost().salvaToglie)).toBe(true);
    const D12 = await page.evaluate(() => { const c = contiMese('2026-12'); return [c.risMesso, c.risPreso, c.ris]; });
    expect(D12).toEqual([100, 30, 70]);
    const [cP, cD] = [JSON.parse(c0)[0][1], await page.evaluate(() => contiMese('2026-12'))];
    expect(r2(cP.rimanenti - cD.rimanenti)).toBe(70);
    expect([r2(cD.usciti - cP.usciti), r2(cD.entrate - cP.entrate)]).toEqual([100, 30]);
    expect(await page.evaluate(() => contiMese('2026-11').rimanenti)).toBe(JSON.parse(c0)[0][0].rimanenti);
    expect(await page.evaluate(() => contiAnno('2026').ris)).toBe(70);
    // casella "Messi da parte", separata da "Spese"
    await page.evaluate(() => { tab = 'rie'; rieMode = 'mese'; cur = '2026-12'; render(); });
    await expect(page.locator('#heroDet [data-vai="ris"]')).toContainText('Messi da parte');
    await expect(page.locator('#heroDet [data-vai="ris"] b')).toHaveText('70,00 €');
    await expect(page.locator('#heroDet [data-vai="ris"] .nota')).toHaveText('prelevati 30,00 €');
    await page.evaluate(() => { cur = '2026-11'; render(); });
    await expect(page.locator('#heroDet [data-vai="ris"]')).toHaveCount(0); // a novembre niente
    // "Rimasti dai mesi prima" coerente: a gennaio 2027 conta anche dicembre con −70
    expect(await page.evaluate(() => r2(rimastiPrima('2027-01') - (rimastiPrima('2026-12') + contiMese('2026-12').rimanenti)))).toBe(0);
    // tasse, CU e soglie identiche
    expect(await fisco()).toBe(f0);
    // salvadanaio con la scelta accesa: la data è oggi (il mese prima non cambia)
    await page.evaluate(() => { D().risparmi = {}; D().entrate = { [`lav|${Object.keys(D().lavori)[0]}|2026-10`]: { entrato: true, data: '2026-11-09', importo: 1500, updatedAt: 1 } }; changed(); vaiA('ris'); });
    const nov = await page.evaluate(() => contiMese('2026-11').rimanenti);
    await page.click('#rsSalv');
    const mv = await page.evaluate(() => Object.values(D().risparmi).find(m => m.salvadanaio));
    expect(mv.data).toBe('2026-12-20');
    expect(await page.evaluate(() => contiMese('2026-11').rimanenti)).toBe(nov);
    // spenta di nuovo: si torna come prima e la voce sparisce dalle impostazioni
    await page.locator('#rsTogli').uncheck();
    expect(await page.evaluate(() => 'salvaToglie' in impost())).toBe(false);
    expect(await page.evaluate(() => contiMese('2026-12').risMesso)).toBe(0);
    expect(errori).toEqual([]);
  });

  // ---------------- casi DS1-DS15e di 04 (consegne/04-libro-casi-mese-stipendio.md) ----------------
  test('DS A: spese della lista e mese dallo stipendio (DS1-DS8)', async ({ browser }) => {
    const { page, errori } = await telefono(browser, '2026-12-28T10:00:00+01:00');
    const lid = await base(page);
    const azzera = () => page.evaluate(() => { D().spesePers = {}; D().bancaImpronte = {}; D().entrate = {}; changed(); });
    // DS1
    await importa(page, [B.carta('01/11/2026', -4.5, 'BAR ESEMPIO'), B.carta('08/11/2026', -20, 'NEGOZIO ESEMPIO'), B.stip('09/11/2026', 1500, 'OTTOBRE 2026'), B.carta('09/11/2026', -10, 'EDICOLA ESEMPIO'), B.carta('12/11/2026', -30, 'SUPERMERCATO ESEMPIO')]);
    expect(await spese(page)).toEqual([['01/11', 4.5, '2026-10'], ['08/11', 20, '2026-10'], ['09/11', 10, '2026-11'], ['12/11', 30, '2026-11']]);
    expect(await page.evaluate(() => [contiMese('2026-11').rimanenti, contiMese('2026-10').sp])).toEqual([957.01, 24.5]);
    // DS2
    await azzera();
    await importa(page, [B.carta('20/10/2026', -1, 'A ESEMPIO'), B.stip('27/10/2026', 1500, 'OTTOBRE 2026'), B.carta('28/10/2026', -2, 'B ESEMPIO'), B.carta('15/11/2026', -3, 'C ESEMPIO'),
      B.stip('26/11/2026', 1500, 'NOVEMBRE 2026'), B.carta('30/11/2026', -4, 'D ESEMPIO'), B.carta('02/12/2026', -5, 'E ESEMPIO')]);
    expect((await spese(page)).map(s => s[0] + '→' + s[2])).toEqual(['20/10→2026-09', '15/11→2026-10', '28/10→2026-10', '02/12→2026-11', '30/11→2026-11']);
    // DS3: nessuno stipendio → tutto nel mese della data, nessuna riga "Conta in"
    await azzera();
    const r3 = await importa(page, [B.carta('01/11/2026', -4.5, 'BAR ESEMPIO'), B.carta('20/11/2026', -9, 'NEGOZIO ESEMPIO')]);
    expect(r3.every(r => r.mese === null)).toBe(true);
    expect((await spese(page)).map(s => s[2])).toEqual(['2026-11', '2026-11']);
    // DS4 (comportamento di oggi: la domanda 81 aspetta l'utente)
    await azzera();
    await importa(page, [B.carta('05/10/2026', -10, 'A ESEMPIO'), B.stip('09/10/2026', 1500, 'SETTEMBRE 2026'), B.carta('15/10/2026', -20, 'B ESEMPIO'), B.carta('05/11/2026', -30, 'C ESEMPIO'),
      B.stip('09/11/2026', 1500, 'OTTOBRE 2026'), B.carta('15/11/2026', -40, 'D ESEMPIO'), B.carta('05/12/2026', -50, 'E ESEMPIO'), B.carta('20/12/2026', -60, 'F ESEMPIO')]);
    expect((await spese(page)).map(s => s[0] + '→' + s[2])).toEqual(['05/10→2026-09', '05/11→2026-10', '15/10→2026-10', '05/12→2026-11', '15/11→2026-11', '20/12→2026-11']);
    expect(await page.evaluate(() => [contiMese('2026-11').sp, contiMese('2026-12').sp])).toEqual([150, 0]);
    // DS5
    await azzera();
    await importa(page, [B.carta('20/10/2026', -1, 'A ESEMPIO'), B.carta('05/11/2026', -2, 'B ESEMPIO'), B.stip('09/11/2026', 1500, 'OTTOBRE 2026'), B.carta('10/11/2026', -3, 'C ESEMPIO')]);
    expect((await spese(page)).map(s => s[0] + '→' + s[2])).toEqual(['05/11→2026-10', '20/10→2026-10', '10/11→2026-11']);
    // DS6 (limite di un mese, mai in avanti)
    await azzera();
    await importa(page, [B.carta('20/09/2026', -1, 'A ESEMPIO'), B.carta('15/10/2026', -2, 'B ESEMPIO'), B.carta('05/11/2026', -3, 'C ESEMPIO'), B.stip('09/11/2026', 1500, 'OTTOBRE 2026'), B.carta('10/11/2026', -4, 'D ESEMPIO')]);
    expect((await spese(page)).map(s => s[0] + '→' + s[2])).toEqual(['20/09→2026-09', '05/11→2026-10', '15/10→2026-10', '10/11→2026-11']);
    // DS6b
    await azzera();
    await importa(page, [B.carta('05/09/2026', -1, 'A ESEMPIO'), B.stip('09/09/2026', 1500, 'AGOSTO 2026'), B.carta('15/11/2026', -2, 'B ESEMPIO')]);
    expect((await spese(page)).map(s => s[0] + '→' + s[2])).toEqual(['05/09→2026-08', '15/11→2026-10']);
    // DS7: stipendio già segnato a mano (10/11, 1.480): la riga resta "Non importare" ma fa da inizio del mese
    await azzera();
    await page.evaluate(lid => { D().entrate = { [`lav|${lid}|2026-10`]: { entrato: true, data: '2026-11-10', importo: 1480, updatedAt: 1 } }; changed(); }, lid);
    const r7 = await importa(page, [B.carta('03/11/2026', -1, 'A ESEMPIO'), B.stip('09/11/2026', 1500, 'OTTOBRE 2026'), B.carta('09/11/2026', -2, 'B ESEMPIO')]);
    expect(r7[1].scelta).toBe('no');
    expect((await spese(page)).map(s => s[0] + '→' + s[2])).toEqual(['03/11→2026-10', '09/11→2026-11']);
    expect(await page.evaluate(lid => D().entrate[`lav|${lid}|2026-10`], lid)).toMatchObject({ data: '2026-11-10', importo: 1480 });
    // DS8: pensione (02/11) e stipendio (09/11) nella stessa lista: tutti e due fanno da inizio del mese
    await azzera();
    await page.evaluate(() => { D().pensione = { profilo: { lordoMese: '1000', dal: '2025-01', annoNascita: '1960', anniContributi: '40', prima: false, altriRedditi: '', addReg: '', addCom: '', sogliaCom: '', detrazione: true } }; changed(); });
    const r8 = await importa(page, [B.carta('01/11/2026', -1, 'A ESEMPIO'), B.pens('02/11/2026', 900), B.carta('05/11/2026', -2, 'B ESEMPIO'), B.stip('09/11/2026', 1500, 'OTTOBRE 2026')]);
    expect(r8[1].scelta).toMatch(/^en:pen\|/);
    expect((await spese(page)).map(s => s[0] + '→' + s[2])).toEqual(['01/11→2026-10', '05/11→2026-11']);
    expect(errori).toEqual([]);
  });

  test('DS B e C: entrate dei progetti con la data vera per le tasse (DS9, DS9b, DS9d); uscite fisse che non si spostano (DS10, DS10b, DS10c)', async ({ browser }) => {
    const { page, errori } = await telefono(browser, '2027-01-20T10:00:00+01:00');
    const lid = await base(page);
    // DS9: rimborso di ottobre bonificato il 06/11, stipendio 09/11 nella lista → soldi di ottobre, tasse di novembre
    const pid = await page.evaluate(() => { const p = nuovoProgetto(); p.nome = 'Squadra Azzurra'; D().progetti = { [p.id]: p };
      p.ore.attivo = true; D().eventi = { e1: { id: 'e1', pid: p.id, data: '2026-10-10', tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '150', rimborso: false, spese: [], created: 1, updatedAt: 1 } }; changed(); return p.id; });
    // (04 usa un rimborso; qui un compenso dello stesso importo: la regola del mese è la stessa)
    const r9 = await importa(page, [B.bonEnt('06/11/2026', 150, 'SQUADRA AZZURRA', 'Compenso ottobre'), B.stip('09/11/2026', 1500, 'OTTOBRE 2026')]);
    expect(r9[0].scelta).toBe(`pg:${pid}|2026-10|o`);
    const g = await page.evaluate(pid => [pagamenti()[`${pid}|2026-10|o`], meseIncasso(pid, '2026-10', 'o')], pid);
    expect(g[0]).toMatchObject({ pagato: true, data: '2026-11-06', meseConto: '2026-10', importo: 150 });
    expect(g[1]).toBe('2026-11'); // tasse, CU e soglie usano la data vera
    expect(await page.evaluate(() => contiMese('2026-10').prog)).toBe(150);
    // DS9b: compenso pagato il 05/01/2027 con lo stipendio dell'11/01/2027 nella lista → dicembre 2026 nei soldi, 2027 nelle tasse
    await page.evaluate(pid => { D().eventi.e2 = { id: 'e2', pid, data: '2026-12-10', tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '320', rimborso: false, spese: [], created: 1, updatedAt: 1 };
      D().progetti[pid].ore.attivo = true; changed(); }, pid);
    const r9b = await importa(page, [B.bonEnt('05/01/2027', 320, 'SQUADRA AZZURRA', 'Compenso dicembre'), B.stip('11/01/2027', 1500, 'DICEMBRE 2026')]);
    expect(r9b[0].scelta).toBe(`pg:${pid}|2026-12|o`);
    expect(await page.evaluate(pid => [meseIncasso(pid, '2026-12', 'o'), contiMese('2026-12').prog, contiMese('2027-01').prog], pid)).toEqual(['2027-01', 320, 0]);
    // DS9d: lo stipendio di dicembre accreditato il 12/01/2027 conta a gennaio (lo stipendio non si sposta)
    expect(await page.evaluate(() => [contiMese('2026-12').lav.v, contiMese('2027-01').lav.v])).toEqual([0, 1500]);
    // DS10: stipendi 27/10 e 26/11; affitto del 03/11 collegato all'uscita fissa (resta di novembre); spese 15/11 → ottobre, 27/11 → novembre
    await page.evaluate(() => { D().spesePers = {}; D().bancaImpronte = {}; D().entrate = {}; changed(); });
    const r10 = await importa(page, [B.stip('27/10/2026', 1500, 'OTTOBRE 2026'), B.bonUsc('03/11/2026', -450, 'Affitto novembre'), B.carta('15/11/2026', -25, 'A ESEMPIO'), B.stip('26/11/2026', 1500, 'NOVEMBRE 2026'), B.carta('27/11/2026', -5, 'B ESEMPIO')]);
    expect(r10[1].scelta).toMatch(/^fx:/); expect(r10[1].mese).toBe(null);
    expect((await spese(page)).map(s => s[0] + '→' + s[2])).toEqual(['15/11→2026-10', '27/11→2026-11']);
    expect(await page.evaluate(() => [contiMese('2026-11').fTot, contiMese('2026-11').sp])).toEqual([502.99, 5]);
    // DS10b: Luce −40 del 05/11 con lo stipendio del 09/11 → collegata alla Luce di novembre, nessun "Conta in"
    await page.evaluate(() => { D().spesePers = {}; D().bancaImpronte = {}; D().entrate = {}; changed(); });
    const r10b = await importa(page, [B.sdd('05/11/2026', -40, 'LUCE ESEMPIO S P A'), B.stip('09/11/2026', 1500, 'OTTOBRE 2026')]);
    expect([r10b[0].scelta.slice(0, 3), r10b[0].mese]).toEqual(['fx:', null]);
    // DS10c: Luce −46 (oltre il 10%) → spesa che conta in ottobre (domanda 73 aspetta l'utente)
    await page.evaluate(() => { D().bancaImpronte = {}; changed(); });
    await importa(page, [B.sdd('05/11/2026', -46, 'LUCE ESEMPIO S P A'), B.stip('09/11/2026', 1500, 'OTTOBRE 2026')]);
    expect((await spese(page)).map(s => s[0] + '→' + s[2] + ' ' + s[1])).toEqual(['05/11→2026-10 46']);
    expect(errori).toEqual([]);
  });

  test('DS D: "Rimasti dai mesi prima" e "Inizia i conti da" (DS11-DS14c)', async ({ browser }) => {
    const { page, errori } = await telefono(browser, '2026-11-20T10:00:00+01:00');
    const lid = await base(page, { fissi: false });
    const metti = (ent, sp, extra) => page.evaluate(({ lid, ent, sp }) => { D().entrate = {}; D().spesePers = {}; D().fissi = D().fissi || {};
      for (const [m, d, v] of ent) D().entrate[`lav|${lid}|${m}`] = { entrato: true, data: d, importo: v, updatedAt: 1 };
      sp.forEach(([d, v, mc], k) => { const id = 's' + k; D().spesePers[id] = { id, data: d, importo: v, cat: 'altro', nota: '', created: 1, updatedAt: 1, ...(mc ? { origine: 'banca', meseConto: mc } : {}) }; });
      delete impost().contiDa; changed(); }, { lid, ent, sp });
    const X = ym => page.evaluate(ym => rimastiPrima(ym), ym);
    // DS11: agosto +100, settembre −30, ottobre +50
    await metti([['2026-07', '2026-08-10', 100], ['2026-09', '2026-10-10', 50]], [['2026-09-15', 30]]);
    expect([await X('2026-08'), await X('2026-09'), await X('2026-10'), await X('2026-11')]).toEqual([null, 100, 70, 120]);
    expect(await page.evaluate(() => r2(rimastiPrima('2026-10') + contiMese('2026-10').rimanenti))).toBe(120);
    // DS11b: la spesa di 20 del 05/09 conta in agosto → agosto 80, settembre −10; X di ottobre resta 70, X di settembre 80
    await metti([['2026-07', '2026-08-10', 100], ['2026-09', '2026-10-10', 50]], [['2026-09-15', 10], ['2026-09-05', 20, '2026-08']]);
    expect(await page.evaluate(() => [contiMese('2026-08').rimanenti, contiMese('2026-09').rimanenti, rimastiPrima('2026-10'), rimastiPrima('2026-09')])).toEqual([80, -10, 70, 80]);
    // DS12: settembre senza dati → conta 0
    await metti([['2026-07', '2026-08-10', 100], ['2026-09', '2026-10-10', 50]], []);
    expect(await X('2026-11')).toBe(150);
    // DS12b: uscite fisse dal 2026-06, entrate da ottobre (+497,01) → a novembre −1.514,95; DS12c con "Inizia i conti da" = ottobre → 497,01
    await metti([['2026-09', '2026-10-10', 1000]], []);
    await page.evaluate(() => { for (const [nome, imp, g] of [['Affitto', '450', '3'], ['Luce', '40', '5'], ['Streaming', '12.99', '27']]) { const id = uid(); D().fissi[id] = { id, cat: 'altro', nome, importo: imp, giorno: g, dal: '2026-06', al: '', rate: '', nota: '', updatedAt: 1 }; } changed(); });
    expect(await page.evaluate(() => [contiMese('2026-10').rimanenti, rimastiPrima('2026-11')])).toEqual([497.01, -1514.95]);
    await page.evaluate(() => { impost().contiDa = '2026-10'; changed(); });
    expect([await X('2026-11'), await X('2026-10')]).toEqual([497.01, null]);
    // DS13: primo mese con dati = mese guardato; uscita fissa senza "dal" valido non decide il primo mese
    await page.evaluate(() => { D().fissi = {}; changed(); });
    await metti([['2026-10', '2026-11-10', 100]], []);
    expect(await X('2026-11')).toBe(null);
    await page.evaluate(() => { const id = uid(); D().fissi[id] = { id, cat: 'altro', nome: 'Senza inizio', importo: '5', giorno: '1', dal: '', al: '', rate: '', nota: '', updatedAt: 1 }; changed(); });
    expect(await X('2026-11')).toBe(null);
    await page.evaluate(() => { D().fissi = {}; changed(); });
    // DS14, DS14b, DS14c
    await metti([['2026-07', '2026-08-10', 100], ['2026-09', '2026-10-10', 50]], [['2026-09-15', 30]]);
    const conDa = async v => { await page.evaluate(v => { if (v == null) delete impost().contiDa; else impost().contiDa = v; changed(); }, v); return [await X('2026-10'), await X('2026-09'), await X('2026-08')]; };
    expect(await conDa('2026-09')).toEqual([-30, null, null]);
    expect(await page.evaluate(() => contiMese('2026-08').rimanenti)).toBe(100);
    expect((await conDa(null))[0]).toBe(70);
    expect((await conDa('2026-13'))[0]).toBe(70);
    expect((await conDa('testo'))[0]).toBe(70);
    expect((await conDa('2026-07'))[0]).toBe(70);
    expect(errori).toEqual([]);
  });

  test('DS E: voci importate prima della regola (DS15-DS15e)', async ({ browser }) => {
    const { page, errori } = await telefono(browser, '2026-12-20T10:00:00+01:00');
    const lid = await base(page, { fissi: false });
    const metti = (sp, stip) => page.evaluate(({ lid, sp, stip }) => { D().spesePers = {}; D().entrate = {};
      sp.forEach(([d, v, banca, mc], k) => { const id = 's' + k; D().spesePers[id] = { id, data: d, importo: v, cat: 'altro', nota: '', created: 1, updatedAt: 1, ...(banca ? { origine: 'banca' } : {}), ...(mc ? { meseConto: mc } : {}) }; });
      for (const [m, d] of stip) D().entrate[`lav|${lid}|${m}`] = { entrato: true, data: d, importo: 1500, updatedAt: 1 };
      changed(); }, { lid, sp, stip });
    const sp = () => page.evaluate(() => ['2026-10', '2026-11', '2026-12'].map(m => contiMese(m).sp));
    const DS15 = [['2026-11-01', 4.5, true], ['2026-11-08', 20, true], ['2026-11-12', 30, true], ['2026-11-02', 7, false], ['2026-11-03', 9, true, '2026-11'], ['2026-12-03', 11, true]];
    // DS15
    await metti(DS15, [['2026-10', '2026-11-09']]);
    expect(await sp()).toEqual([24.5, 46, 11]);
    await metti(DS15, []);
    expect((await sp())[1]).toBe(70.5);
    // DS15b: stipendio segnato a mano il 10/11, spesa della 24c.10 del 09/11 → ottobre
    await metti([['2026-11-09', 10, true]], [['2026-10', '2026-11-10']]);
    expect((await sp())[0]).toBe(10);
    // DS15d: stipendio con data nel futuro → nessuno spostamento
    await metti([['2026-12-02', 10, true]], [['2026-11', '2026-12-28']]);
    expect((await sp())[2]).toBe(10);
    // DS15e: lista importata senza stipendio (meseConto = mese della data) e poi stipendio segnato a mano → non si sposta
    await metti([['2026-12-02', 10, true, '2026-12']], [['2026-11', '2026-12-09']]);
    expect((await sp())[2]).toBe(10);
    // DS15c: oggi 05/12 la spesa del 02/12 è di dicembre; quando lo stipendio entra il 09/12 e si segna, passa a novembre
    await metti([['2026-12-02', 10, true]], []);
    expect((await sp())[2]).toBe(10);
    await metti([['2026-12-02', 10, true]], [['2026-11', '2026-12-09']]);
    expect(await sp()).toEqual([0, 10, 0]);
    expect(errori).toEqual([]);
  });
});
