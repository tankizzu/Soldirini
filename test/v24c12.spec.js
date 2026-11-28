// 24c.12: D-155 (voci importate prima della regola dello stipendio), punti della tornata 50 (MB5, MB6, MB12, MB14, MB18 di 04;
// P1, P3, C.11, E11 di 03; testi definitivi di 02; informativa). Solo dati inventati.
const { test, expect } = require('./helpers/prova');
const { DriveFinto, nuovoDispositivo } = require('./helpers/app');

const TESTA = 'DATA CONTABILE,DATA VALUTA,USCITE,ENTRATE,CAUSALE,DESCRIZIONE OPERAZIONE';
const it = v => { const [i, d] = Math.abs(v).toFixed(2).split('.'); return (v < 0 ? '-' : '+') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d; };
const carta = (dc, acq, v, presso) => [dc, acq, v < 0 ? `"${it(v)}"` : '', v > 0 ? `"${it(v)}"` : '', 'Pagamento Carta', `Operazione Mastercard del ${acq} alle ore 10:00 con Carta xxxxxxxxxxxx0000 Div=EUR Importo in divisa=${Math.abs(v)} / Importo in Euro=${Math.abs(v)} presso ${presso}`];
const stip = (d, v, per, chi = 'DITTA ESEMPIO S.R.L.', nota = 'Accredito stipendi-emolumenti') => [d, d, '', `"${it(v)}"`, 'Accredito Stipendio/Pensione', `Bonifico N. 0000000000 BIC Ordinante XXXXITMM Codifica Ordinante IT00X0000000000000000000000 Anagrafica Ordinante ${chi} Note: ${nota}${per ? ' periodo ' + per : ''}`];
const sdd = (d, v, nome) => [d, d, `"${it(v)}"`, '', 'Addebito Diretto', `Addebito SDD CORE Scad. ${d} Imp. ${Math.abs(v)} Creditor id. IT00ZZZ0000000000000 ${nome} Id Mandato 0000000000 Debitore MARIO ROSSI VIA ESEMPIO Rif. 000000000000`];
const bonUsc = (d, v, nota) => [d, d, `"${it(v)}"`, '', 'Bonifico In Uscita', `Bonifico istantaneo da voi disposto N. 0000000000 A favore di Mario Rossi IBAN beneficiario IT00X0000000000000000000000 Note: ${nota}`];
function lista(righe, iniziale = 500) {
  const tot = righe.reduce((a, r) => a + Number((r[2] || r[3]).replace(/"/g, '').replace(/\./g, '').replace(',', '.')), 0);
  return [TESTA, `${righe[0][0]},,,"${it(iniziale)}",,Saldo iniziale`, ...righe.map(r => r.join(',')), `${righe[righe.length - 1][0]},,,"${it(iniziale + tot)}",,Saldo finale`].join('\r\n') + '\r\n';
}
const file = (testo, name = 'ListaMovimenti.csv') => ({ name, mimeType: 'text/csv', buffer: Buffer.from(testo, 'utf8') });
async function telefono(browser, ora = '2026-11-20T10:00:00+01:00') {
  const d = await nuovoDispositivo(browser, { drive: new DriveFinto(), ora });
  await d.page.waitForFunction(() => window.Entrate && window.Stip15 && window.Archivio && Archivio.avviata && window.Banca && window.Copia);
  return d;
}
const base = page => page.evaluate(() => {
  const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Ditta Esempio'; l.dal = '2026-01-01'; D().lavori[l.id] = l;
  const fx = (nome, importo) => ({ id: uid(), cat: 'utenze', nome, importo, giorno: '5', dal: '2026-10', al: '', rate: '', nota: '', updatedAt: 1 });
  const a = fx('Luce', '40'), b = fx('Streaming', '12.99'); D().fissi = { [a.id]: a, [b.id]: b };
  DB.meta.skipWelcome = true; changed(); render(); return { lid: l.id, luce: a.id, stream: b.id };
});
const righe = page => page.locator('#bcList .bcrow').evaluateAll(R => R.map(r => ({
  data: r.querySelector('.bcd').textContent, scelta: r.querySelector('select')?.value ?? null, scelte: [...(r.querySelector('select')?.options || [])].map(o => o.value),
  info: r.querySelector('.bcinfo').textContent.trim(), avviso: r.querySelector('.bcavv')?.textContent ?? null, on: r.querySelector('input[type=checkbox]').checked })));

test.describe('24c.12', () => {
  test('D-155: spese importate prima della regola (origine "banca", senza meseConto) e stipendio entrato il 09/11 → l’1-8/11 contano in ottobre; senza stipendio dopo restano; quelle a mano non si toccano; niente si riscrive', async ({ browser }) => {
    const { page, errori } = await telefono(browser, '2026-12-20T10:00:00+01:00');
    const { lid } = await base(page);
    await page.evaluate(() => { const s = (id, data, importo, o = {}) => ({ id, data, importo, cat: 'altro', nota: '', created: 1, updatedAt: 1, ...o });
      D().fissi = {};
      D().spesePers = { a: s('a', '2026-11-01', 4.5, { origine: 'banca' }), b: s('b', '2026-11-08', 20, { origine: 'banca' }), c: s('c', '2026-11-12', 30, { origine: 'banca' }),
        m: s('m', '2026-11-02', 7), x: s('x', '2026-11-03', 9, { origine: 'banca', meseConto: '2026-11' }), d: s('d', '2026-12-03', 11, { origine: 'banca' }) };
      changed(); });
    const sp = () => page.evaluate(() => ['2026-10', '2026-11', '2026-12'].map(m => contiMese(m).sp));
    expect(await sp()).toEqual([0, 70.5, 11]); // nessuno stipendio segnato: tutto nel mese della data
    const prima = await page.evaluate(() => JSON.stringify(D().spesePers));
    await page.evaluate(lid => { (D().entrate || (D().entrate = {}))[`lav|${lid}|2026-10`] = { entrato: true, data: '2026-11-09', importo: 1500, updatedAt: 1 }; changed(); render(); }, lid);
    // 1/11 e 8/11 → ottobre; 12/11 resta; a mano (2/11) resta; meseConto esplicito (3/11, 24c.12) resta; dicembre senza stipendio dopo resta
    expect(await sp()).toEqual([24.5, 46, 11]);
    expect(await page.evaluate(() => JSON.stringify(D().spesePers))).toBe(prima); // niente riscritto (D-117)
    // stipendio segnato con una data nel futuro: non conta
    await page.evaluate(lid => { D().entrate[`lav|${lid}|2026-11`] = { entrato: true, data: '2026-12-25', importo: 1500, updatedAt: 1 }; changed(); }, lid);
    expect(await sp()).toEqual([24.5, 46, 11]);
    // la sezione D-151 e la pagina delle spese usano lo stesso mese
    expect(await page.evaluate(() => { vaiA('dsp'); cur = '2026-10'; rieMode = 'mese'; render(); return document.querySelector('#rieSpese .kv.big b')?.textContent; })).toBe('24,50 €');
    expect(errori).toEqual([]);
  });

  test('D-155: un’importazione nuova salva sempre il mese in cui conta (anche senza stipendio nella lista): uno stipendio segnato dopo a mano non la sposta', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    const { lid } = await base(page);
    await page.setInputFiles('#bcFile', file(lista([carta('03/11/2026', '02/11/2026', -6, 'BAR ESEMPIO')])));
    await page.click('#bcImporta').then(() => page.click('#bcFatto'));
    expect(await page.evaluate(() => Object.values(D().spesePers).map(s => s.meseConto))).toEqual(['2026-11']);
    await page.evaluate(lid => { (D().entrate || (D().entrate = {}))[`lav|${lid}|2026-10`] = { entrato: true, data: '2026-11-09', importo: 1500, updatedAt: 1 }; changed(); }, lid);
    expect(await page.evaluate(() => [contiMese('2026-10').sp, contiMese('2026-11').sp])).toEqual([0, 6]);
    expect(errori).toEqual([]);
  });

  test('D-157: "Inizia i conti da" = il secondo mese → al terzo "Rimasti dai mesi prima" −30, totale 20; nel mese scelto e prima niente sezione; vuoto = come prima', async ({ browser }) => {
    const { page, errori } = await telefono(browser, '2026-10-20T10:00:00+02:00');
    await page.evaluate(() => {
      const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Ditta Esempio'; l.dal = '2026-01-01'; D().lavori[l.id] = l;
      D().entrate = { [`lav|${l.id}|2026-07`]: { entrato: true, data: '2026-08-10', importo: 100, updatedAt: 1 }, [`lav|${l.id}|2026-09`]: { entrato: true, data: '2026-10-10', importo: 50, updatedAt: 1 } };
      const id = uid(); D().spesePers = { [id]: { id, data: '2026-09-15', cat: 'altro', importo: 30, nota: '', created: 1, updatedAt: 1 } };
      DB.meta.skipWelcome = true; changed(); tab = 'pro'; render(); });
    // la scelta in Impostazioni → Aspetto
    await page.evaluate(() => { const d = document.getElementById('contiDa').closest('details'); if (d) d.open = true; });
    await page.locator('#contiDa').fill('2026-09'); await page.locator('#contiDa').dispatchEvent('change');
    expect(await page.evaluate(() => impost().contiDa)).toBe('2026-09');
    const vedi = ym => page.evaluate(ym => { tab = 'rie'; rieMode = 'mese'; cur = ym; render(); }, ym);
    await vedi('2026-10');
    await page.locator('#rieRim summary').click();
    expect(await page.locator('#rieRim .kv').evaluateAll(K => K.map(k => [...k.children].map(c => c.textContent.trim()).join(' '))))
      .toEqual(['Rimasti dai mesi prima −30,00 €', 'Soldi rimanenti di ottobre 50,00 €', 'Totale 20,00 €']);
    await expect(page.locator('#rieRim p')).toHaveText('Solo settembre 2026, come scelto in Impostazioni → Aspetto. Il numero grande in alto resta solo di ottobre.');
    await vedi('2026-09'); await expect(page.locator('#rieRim')).toHaveCount(0); // nel mese scelto
    await vedi('2026-08'); await expect(page.locator('#rieRim')).toHaveCount(0); // prima
    expect(await page.evaluate(() => [contiMese('2026-08').rimanenti, Object.keys(D().spesePers).length])).toEqual([100, 1]); // i dati restano
    // vuoto = dal primo mese con dati
    await page.evaluate(() => { tab = 'pro'; render(); const d = document.getElementById('contiDa').closest('details'); if (d) d.open = true; }); await page.locator('#contiDa').fill(''); await page.locator('#contiDa').dispatchEvent('change');
    expect(await page.evaluate(() => [impost().contiDa, rimastiPrima('2026-10')])).toEqual([undefined, 70]);
    // un valore rovinato da Drive vale vuoto
    expect(await page.evaluate(() => { impost().contiDa = '2026-13'; return rimastiPrima('2026-10'); })).toBe(70);
    expect(errori).toEqual([]);
  });

  test('MB5, MB6, MB18, MB12, MB14: reso sulla carta, abbonamento con la carta, addebito di uguale importo, pensione, data insolita', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    const id = await base(page);
    await page.evaluate(() => { D().pensione = { profilo: { lordoMese: '1200', dal: '2020-01', updatedAt: 1 } }; changed(); });
    expect(await page.evaluate(() => !!Pensione.profilo())).toBe(true);
    const prima = await page.evaluate(() => [contiMese('2026-10'), contiMese('2026-11')]);
    await page.setInputFiles('#bcFile', file(lista([
      carta('03/11/2026', '02/11/2026', 20, 'NEGOZIO ESEMPIO'),                         // MB5: reso
      carta('04/11/2026', '02/11/2026', -12.99, 'PAYPAL *STREAMING ESEMPIO'),           // MB6
      sdd('05/11/2026', -40, 'ENERGIA ESEMPIO SPA'),                                     // MB18: stesso importo di "Luce", nome diverso
      sdd('06/11/2026', -41, 'ENERGIA ESEMPIO SPA'),                                     // importo diverso e nome diverso → spesa
      stip('10/11/2026', 1100, 'OTTOBRE 2026', 'INPS', 'Rata pensione'),                 // MB12
      stip('27/10/2026', 1500, 'NOVEMBRE 2026'),                                         // MB14: arrivato prima del mese
    ])));
    const R = await righe(page);
    expect(R[0]).toEqual({ data: '02/11', scelta: 'no', scelte: ['no'], info: 'Carta: reso del 02/11 (in banca il 03/11). Soldi restituiti sulla carta: non è una spesa.', avviso: null, on: false });
    expect(R[1]).toMatchObject({ scelta: 'fx:' + id.stream, info: "Carta: acquisto del 02/11 (in banca il 04/11). Sembra l'uscita fissa «Streaming», che conta già nel mese.", on: true });
    expect(R[2]).toMatchObject({ scelta: 'fx:' + id.luce, info: "Addebito diretto: sembra l'uscita fissa «Luce», che conta già nel mese." });
    expect(R[3]).toMatchObject({ scelta: 'sp:casa', info: 'Addebito diretto: nessuna uscita fissa simile. Conta in ottobre.' }); // prima della pensione del 10/11 (D-152)
    expect(R[4]).toMatchObject({ scelta: 'en:pen|2026-10', info: "Pensione di ottobre 2026: si segna «È entrata», non un'entrata in più." });
    expect(R[5]).toMatchObject({ scelta: `en:lav|${id.lid}|2026-11`, avviso: '⚠ Data insolita: è prima di novembre 2026, il mese dello stipendio. Se è giusta, importa pure.' });
    await expect(page.locator('#bcTipi')).toHaveText('1 spesa · 1 stipendio e 1 pensione entrati · 2 uscite fisse già contate');
    await page.click('#bcImporta');
    await expect(page.locator('#bcDopo .bcfatti')).toHaveText('✓ Importati 5 movimenti: 1 spesa, 2 entrate segnate, 2 uscite fisse già contate.'); // 24c.17 (D-160): in cima alla finestra
    await page.click('#bcFatto');
    const dopo = await page.evaluate(() => [contiMese('2026-10'), contiMese('2026-11')]);
    // il reso non toglie niente; Streaming e Luce contano una volta; la spesa da 41 conta in ottobre
    expect([dopo[0].sp, dopo[1].sp, dopo[0].fTot, dopo[1].fTot]).toEqual([prima[0].sp + 41, prima[1].sp, prima[0].fTot, prima[1].fTot]);
    expect(await page.evaluate(() => Object.values(D().spesePers).map(s => s.importo))).toEqual([41]);
    expect(errori).toEqual([]);
  });

  test('P1: le impronte passano dalla copia di sicurezza (Sostituisci tutto e Unisci): lo stesso file resta "Già importato"; solo codici validi', async ({ browser }) => {
    const L = lista([carta('03/11/2026', '02/11/2026', -6, 'BAR ESEMPIO'), carta('05/11/2026', '04/11/2026', -9, 'NEGOZIO ESEMPIO')]);
    const A = await telefono(browser);
    await A.page.evaluate(() => { DB.meta.skipWelcome = true; });
    await A.page.setInputFiles('#bcFile', file(L)); await A.page.click('#bcImporta').then(() => A.page.click('#bcFatto'));
    const copia = Buffer.from(await A.page.evaluate(async () => [...await Copia.crea(null)]));
    for (const modo of ['sostituisci', 'unisci']) {
      const { page, errori } = await telefono(browser);
      await page.evaluate(() => { DB.meta.skipWelcome = true; tab = 'pro'; render(); (e => { for (let d = e && e.closest('details'); d; d = d.parentElement.closest('details')) d.open = true; })($('cpBox')); document.querySelector('#cpBox [data-cp=riprendi]').click(); });
      await page.setInputFiles('#cpFile', { name: 'c.soldirini', mimeType: 'application/octet-stream', buffer: copia });
      await page.click(`#cpBody .cpopt[data-modo=${modo}]`); await page.click('[data-cp=usa]');
      if (modo === 'sostituisci') await page.click('[data-cp=sostituisci]');
      await expect(page.locator('#toast')).toContainText('✓');
      expect(await page.evaluate(() => Object.keys(D().bancaImpronte || {}).length)).toBe(2);
      await page.setInputFiles('#bcFile', file(L));
      expect((await righe(page)).every(r => r.info.startsWith('Già importato'))).toBe(true);
      await expect(page.locator('#bcList .bcnote')).toHaveText('Tutti i movimenti di questo file sono già in Soldirini: non c\'è niente di nuovo da importare.');
      await expect(page.locator('#bcAnn')).toHaveText('Chiudi'); await expect(page.locator('#bcImporta')).toBeDisabled(); await expect(page.locator('#bcTot')).toHaveText('Niente da importare');
      expect(await page.evaluate(() => Object.keys(D().spesePers).length)).toBe(2);
      expect(errori).toEqual([]);
    }
    // nella copia si accettano solo impronte valide (64 caratteri 0-9a-f) e solo {updatedAt, deleted}
    await A.page.evaluate(() => { Object.assign(D().bancaImpronte, { ['a'.repeat(64)]: { updatedAt: 5, extra: 'x' }, ['Z'.repeat(64)]: { updatedAt: 1 }, corto: { updatedAt: 1 } }); changed(); });
    const copia2 = Buffer.from(await A.page.evaluate(async () => [...await Copia.crea(null)]));
    const C = await telefono(browser);
    await C.page.evaluate(() => { DB.meta.skipWelcome = true; tab = 'pro'; render(); (e => { for (let d = e && e.closest('details'); d; d = d.parentElement.closest('details')) d.open = true; })($('cpBox')); document.querySelector('#cpBox [data-cp=riprendi]').click(); });
    await C.page.setInputFiles('#cpFile', { name: 'c.soldirini', mimeType: 'application/octet-stream', buffer: copia2 });
    await C.page.click('#cpBody .cpopt[data-modo=unisci]'); await C.page.click('[data-cp=usa]');
    await expect(C.page.locator('#toast')).toContainText('✓');
    const I = await C.page.evaluate(() => D().bancaImpronte);
    expect(Object.keys(I).length).toBe(3); expect(Object.keys(I).every(k => /^[0-9a-f]{64}$/.test(k))).toBe(true);
    expect(I['a'.repeat(64)]).toEqual({ updatedAt: 5 });
  });

  test('P3, C.11 di 03: nomi "=1+1", "<img …>", U+061C e U+202E nella finestra solo come testo; E11: apostrofo nelle celle del CSV esportato; informativa', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    expect(await page.evaluate(() => Banca.pulisci('a؜b‮c'))).toBe('a b c');
    await page.setInputFiles('#bcFile', file(lista([carta('03/11/2026', '02/11/2026', -1, '=1+1'), carta('04/11/2026', '03/11/2026', -2, '<img src=x onerror=alert(1)>'), carta('05/11/2026', '04/11/2026', -3, 'BAR‮OIPMESE')])));
    expect(await page.locator('#bcList .bcn').allTextContents()).toEqual(['=1+1', '<img src=x onerror=alert(1)>', 'BAR OIPMESE']);
    expect(await page.locator('#bcList img').count()).toBe(0);
    // E11
    expect(await page.evaluate(() => ['=1+1', '+39 333', '-12,5', '-Bar', '@SOMMA', '\tx', 'Bar', '12,5', ''].map(cellaSicura)))
      .toEqual(["'=1+1", "'+39 333", '-12,5', "'-Bar", "'@SOMMA", "'\tx", 'Bar', '12,5', '']);
    const csv = await page.evaluate(() => { const p = nuovoProgetto(); p.nome = '=HYPERLINK("x")'; p.ore.attivo = true; D().progetti[p.id] = p; const e = uid();
      D().eventi[e] = { id: e, pid: p.id, data: '2026-03-10', tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '50', rimborso: false, spese: [], created: 1, updatedAt: 1 };
      D().pagamenti[`${p.id}|2026-03|o`] = { pagato: true, data: '2026-04-05', updatedAt: 1 }; changed(); return csvAnno('2026'); });
    expect(csv).toContain('"\'=HYPERLINK(""x"")"'); expect(csv).not.toMatch(/;"=HYPERLINK/);
    // informativa (03, tornata 49 §5)
    const pr = await page.evaluate(async () => (await fetch('privacy.html')).text());
    // 24c.13 (D-165): il nome di chi manda il bonifico si salva solo per le entrate da confermare (v24c13.spec.js)
    expect(pr).toContain('né i nomi di chi riceve un tuo bonifico.'); // 24c.14: testo definitivo di 03 (v24c14.spec.js)
    expect(pr).toContain('Se la causale di un tuo bonifico contiene un nome, puoi cambiarla prima di importare.');
    expect(pr).toMatch(/versione 24c\.\d+/);
    expect(errori).toEqual([]);
  });

  test('testi di 02: scheda, saldi, errori sotto il pulsante (anche in Nuova attività), "Non importare", "Conta in …", piede', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await base(page);
    await page.evaluate(() => vaiA('dsp'));
    await expect(page.locator('#v-dsp .bcimp h3')).toHaveText('🏦 Movimenti della banca');
    await expect(page.locator('#v-dsp .bcimp')).toContainText('Scegli la lista movimenti della tua banca in CSV o Excel (per ora solo ING). Soldirini legge il file solo sul telefono. Ne tiene una copia solo se, alla fine, scegli «Archivia su Drive».'); // 24c.17 (D-160), testo provvisorio per 02
    // errore sotto il pulsante della pagina
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#v-dsp [data-bcimp]')]);
    await fc.setFiles(file('Data;Importo\r\n01/11/2026;-1\r\n', 'altra.csv'));
    await expect(page.locator('#bcErr')).toHaveText('Questo file non è la lista movimenti di ING in CSV o Excel, l\'unica che Soldirini sa leggere per ora. Non è stato importato niente.');
    await expect(page.locator('#bcErr')).toHaveAttribute('role', 'alert');
    // in Nuova attività: sotto il suo pulsante; la scelta di un altro file lo toglie
    await page.evaluate(() => { openEv(['2026-11-20']); document.getElementById('secSpese').open = true; });
    const [fc2] = await Promise.all([page.waitForEvent('filechooser'), page.click('#evSpP [data-bcimp]')]);
    await fc2.setFiles(file(TESTA + '\r\n'));
    await expect(page.locator('#evSpP .bcerr')).toHaveText('Nel file non ci sono movimenti: controlla il periodo scelto in banca.');
    await expect(page.locator('#bcErr')).toBeHidden();
    const [fc3] = await Promise.all([page.waitForEvent('filechooser'), page.click('#evSpP [data-bcimp]')]);
    await fc3.setFiles(file(lista([carta('02/11/2026', '31/10/2026', -2, 'EDICOLA ESEMPIO'), stip('09/11/2026', 1500, 'OTTOBRE 2026'), bonUsc('10/11/2026', -100, 'Regalo'), ['11/11/2026', '11/11/2026', '"-50,00"', '', 'Giroconto', 'Giroconto da voi disposto N. 0000000000 Note: Risparmi']])));
    await expect(page.locator('#evSpP .bcerr')).toBeHidden();
    await expect(page.locator('#bcOk')).toHaveText('✓ Lettura completa: i saldi del file tornano.');
    const R = await righe(page);
    expect(R.map(r => r.info)).toEqual(['Carta: acquisto del 31/10 (in banca il 02/11). Conta in ottobre.', "Stipendio di ottobre 2026: si segna «È entrato» sul lavoro, non un'entrata in più.",
      'Bonifico fatto, con la nota «Regalo».', 'Giroconto: soldi spostati su un tuo conto, non è una spesa.']);
    expect(R[3].scelte[0]).toBe('no'); await expect(page.locator('#bcList .bcrow').nth(3).locator('option').first()).toHaveText('Non importare (soldi tuoi)');
    await expect(page.locator('#bcList .bcrow').nth(2).locator('option[value=no]')).toHaveText('Non importare');
    await expect(page.locator('#bcList .bcrow').first().locator('.bccampo span')).toHaveText('Nome della spesa');
    await expect(page.locator('#bcTipi')).toHaveText('2 spese · 1 stipendio entrato');
    expect(errori).toEqual([]);
  });
});
