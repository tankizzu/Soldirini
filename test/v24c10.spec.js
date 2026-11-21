// 24c.10 (D-147): movimenti della banca dal CSV di ING. Solo dati inventati: l'esempio di consegne/00-formato-lista-movimenti-ing.md.
const { test, expect } = require('./helpers/prova');
const { DriveFinto, nuovoDispositivo } = require('./helpers/app');

const CSV = [
  'DATA CONTABILE,DATA VALUTA,USCITE,ENTRATE,CAUSALE,DESCRIZIONE OPERAZIONE',
  '01/11/2026,,,"+500,00",,Saldo iniziale',
  '03/11/2026,01/11/2026,"-4,50",,Pagamento Carta,Operazione Mastercard del 01/11/2026 alle ore 08:37 con Carta xxxxxxxxxxxx0000 Div=EUR Importo in divisa=4.5 / Importo in Euro=4.5 presso BAR ESEMPIO - Transazione C-less',
  '04/11/2026,02/11/2026,"-12,99",,Pagamento Carta,Operazione Mastercard del 02/11/2026 alle ore 03:10 con Carta xxxxxxxxxxxx0000 Div=EUR Importo in divisa=12.99 / Importo in Euro=12.99 presso PAYPAL *STREAMING ESEMPIO',
  '05/11/2026,05/11/2026,"-40,00",,Addebito Diretto,Addebito SDD CORE Scad. 05/11/2026 Imp. 40.00 Creditor id. IT00ZZZ0000000000000 LUCE ESEMPIO S P A Id Mandato 0000000000 Debitore MARIO ROSSI VIA ESEMPIO Rif. 000000000000',
  '06/11/2026,06/11/2026,,"+150,00",Accredito Bonifico,Bonifico N. 0000000000 BIC Ordinante XXXXITMMXXX Codifica Ordinante IT00X0000000000000000000000 Anagrafica Ordinante ASSOCIAZIONE ESEMPIO Note: Rimborso spese ottobre 2026',
  '10/11/2026,10/11/2026,,"+1.500,00",Accredito Stipendio/Pensione,Bonifico N. 0000000000 BIC Ordinante XXXXITMM Codifica Ordinante IT00X0000000000000000000000 Anagrafica Ordinante DITTA ESEMPIO S.R.L. Note: Accredito stipendi-emolumenti periodo OTTOBRE 2026',
  '10/11/2026,10/11/2026,"-300,00",,Bonifico In Uscita,Bonifico istantaneo da voi disposto N. 0000000000 A favore di Mario Rossi IBAN beneficiario IT00X0000000000000000000000 Note: Affitto',
  '10/11/2026,10/11/2026,"-100,00",,Giroconto,Giroconto da voi disposto N. 0000000000 A favore di Mario Rossi IBAN beneficiario IT00X0000000000000000000000 Note: Risparmi',
  '12/11/2026,,,"+1.692,51",,Saldo finale',
].join('\r\n') + '\r\n';
const file = (testo, name = 'ListaMovimenti.csv') => ({ name, mimeType: 'text/csv', buffer: Buffer.from(testo, 'utf8') });

async function telefono(browser) {
  const d = await nuovoDispositivo(browser, { drive: new DriveFinto(), ora: '2026-11-20T10:00:00+01:00' });
  await d.page.waitForFunction(() => window.Entrate && window.Stip15 && window.Archivio && Archivio.avviata && window.Banca);
  // lavoro, uscita fissa "Luce" e progetto con rimborsi di ottobre, tutti inventati
  const id = await d.page.evaluate(() => {
    const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Ditta Esempio'; l.dal = '2026-01-01'; D().lavori[l.id] = l;
    const f = { id: uid(), cat: 'utenze', nome: 'Luce', importo: '40', giorno: '5', dal: '2026-01', al: '', rate: '', nota: '', updatedAt: 1 }; (D().fissi || (D().fissi = {}))[f.id] = f;
    const p = nuovoProgetto(); p.nome = 'Associazione Esempio'; D().progetti[p.id] = p;
    const e = uid(); D().eventi[e] = { id: e, pid: p.id, data: '2026-10-15', tipo: 'altro', titolo: '', ore: false, fasce: [], rimborso: false, spese: [{ id: uid(), tipo: 'altro', importo: 150, nota: '' }], created: 1, updatedAt: 1 };
    DB.meta.skipWelcome = true; changed(); render(); return { lid: l.id, fid: f.id, pid: p.id };
  });
  return { ...d, id };
}
const righe = page => page.locator('#bcList .bcrow').evaluateAll(R => R.map(r => ({
  data: r.querySelector('.bcd').textContent, nome: r.querySelector('.bcn').textContent, imp: r.querySelector('.bci').textContent.replace(/\s/g, ' '),
  scelta: r.querySelector('select')?.value ?? null, on: r.querySelector('input[type=checkbox]').checked, gia: r.classList.contains('gia'),
  spento: r.querySelector('input[type=checkbox]').disabled })));

test.describe('24c.10 · D-147: movimenti della banca dal CSV', () => {
  test('CSV di esempio: 7 movimenti, saldo che torna, proposte per ogni causale, data dell’acquisto per le carte, nessuna richiesta di rete', async ({ browser }) => {
    const { page, errori, id } = await telefono(browser);
    const rete = []; page.on('request', r => rete.push(r.url()));
    await page.setInputFiles('#bcFile', file(CSV));
    await expect(page.locator('#bcModal')).toBeVisible();
    expect(rete).toEqual([]); // il file si legge solo sul telefono
    await expect(page.locator('#bcAvviso')).toBeHidden(); await expect(page.locator('#bcOk')).toBeVisible();
    await expect(page.locator('#bcSub')).toHaveText('Lista movimenti ING · dal 01/11/2026 al 12/11/2026 · 7 movimenti');
    expect(await righe(page)).toEqual([
      { data: '01/11', nome: 'BAR ESEMPIO', imp: '−4,50 €', scelta: 'sp:bar', on: true, gia: false, spento: false },
      { data: '02/11', nome: 'PAYPAL *STREAMING ESEMPIO', imp: '−12,99 €', scelta: 'sp:online', on: true, gia: false, spento: false },
      { data: '05/11', nome: 'LUCE ESEMPIO S P A', imp: '−40,00 €', scelta: 'fx:' + id.fid, on: true, gia: false, spento: false },
      { data: '06/11', nome: 'ASSOCIAZIONE ESEMPIO', imp: '+150,00 €', scelta: `pg:${id.pid}|2026-10|r`, on: true, gia: false, spento: false },
      { data: '10/11', nome: 'DITTA ESEMPIO S.R.L.', imp: '+1.500,00 €', scelta: `en:lav|${id.lid}|2026-10`, on: true, gia: false, spento: false },
      { data: '10/11', nome: 'Affitto', imp: '−300,00 €', scelta: 'sp:casa', on: true, gia: false, spento: false },
      { data: '10/11', nome: 'Giroconto', imp: '−100,00 €', scelta: 'no', on: false, gia: false, spento: false },
    ]);
    await expect(page.locator('#bcImporta')).toHaveText('Importa 6 movimenti');
    await expect(page.locator('#bcTot')).toHaveText('Uscite 357,49 € · Entrate 1.650,00 €');
    expect(await page.evaluate(() => Object.keys(D().spesePers || {}).length)).toBe(0); // niente si salva prima di "Importa"
    // il nome della spesa si può cambiare
    await page.locator('[data-bcnome="0"]').fill('Bar sotto casa');
    await page.click('#bcImporta');
    await expect(page.locator('#bcModal')).toBeHidden();
    const S = await page.evaluate(() => Object.values(D().spesePers).map(s => [s.data, s.cat, s.importo, s.nota, s.origine]).sort());
    expect(S).toEqual([['2026-11-01', 'bar', 4.5, 'Bar sotto casa', 'banca'], ['2026-11-02', 'online', 12.99, 'PAYPAL *STREAMING ESEMPIO', 'banca'], ['2026-11-10', 'casa', 300, 'Affitto', 'banca']]);
    expect(await page.evaluate(id => [D().entrate[`lav|${id.lid}|2026-10`], pagamenti()[`${id.pid}|2026-10|r`]].map(x => x && [x.data, x.importo, x.entrato ?? x.pagato]), id))
      .toEqual([['2026-11-10', 1500, true], ['2026-11-06', 150, true]]);
    expect(errori).toEqual([]);
  });

  test('soldi rimanenti di novembre giusti; l’addebito collegato all’uscita fissa non conta due volte; nei dati salvati niente IBAN, carte, codici, nomi delle persone, saldo', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    const prima = await page.evaluate(() => contiMese('2026-11'));
    expect([prima.entrate, prima.fTot, prima.sp, prima.rimanenti]).toEqual([0, 40, 0, -40]);
    await page.setInputFiles('#bcFile', file(CSV)); await page.click('#bcImporta');
    const dopo = await page.evaluate(() => contiMese('2026-11'));
    expect([dopo.lav.v, dopo.prog, dopo.fTot, dopo.sp, dopo.rimanenti]).toEqual([1500, 150, 40, 317.49, 1292.51]);
    // ottobre non cambia (lo stipendio di ottobre è entrato a novembre, D-009)
    expect(await page.evaluate(() => contiMese('2026-10').entrate)).toBe(0);
    const salvato = await page.evaluate(() => JSON.stringify(D()) + JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]))));
    for (const vietato of ['IT00X', 'IT00ZZZ', 'xxxx', 'XXXXITMM', 'Creditor', 'Mandato', 'Debitore', 'MARIO', 'Mario', 'Rossi', 'ROSSI', 'VIA ESEMPIO', '0000000000', 'Anagrafica', 'Ordinante', 'Rimborso spese ottobre', 'Mastercard', '1692.51', '1.692,51', 'Saldo'])
      expect(salvato, vietato).not.toContain(vietato);
    // le impronte sono solo codici SHA-256
    expect(await page.evaluate(() => Object.keys(D().bancaImpronte).every(k => /^[0-9a-f]{64}$/.test(k)) && Object.keys(D().bancaImpronte).length)).toBe(7);
    expect(errori).toEqual([]);
  });

  test('stesso file due volte: tutti “già importato” e spenti, niente si aggiunge', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.setInputFiles('#bcFile', file(CSV)); await page.click('#bcImporta');
    const n = await page.evaluate(() => JSON.stringify([D().spesePers, D().entrate, pagamenti()]));
    await page.setInputFiles('#bcFile', file(CSV));
    await expect(page.locator('#bcModal')).toBeVisible();
    const R = await righe(page);
    expect(R.length).toBe(7); expect(R.every(r => r.gia && r.spento && !r.on && r.scelta === null)).toBe(true);
    await expect(page.locator('#bcList .bcinfo').first()).toHaveText('Già importato');
    await expect(page.locator('#bcImporta')).toBeDisabled();
    await page.click('#bcAnn'); await expect(page.locator('#bcModal')).toBeHidden();
    expect(await page.evaluate(() => JSON.stringify([D().spesePers, D().entrate, pagamenti()]))).toBe(n);
    expect(errori).toEqual([]);
  });

  test('saldo che non torna → avviso; file di un’altra banca, rovinato o vuoto → messaggio e niente salvato; il pulsante c’è nelle spese', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.setInputFiles('#bcFile', file(CSV.replace('"+1.692,51"', '"+1.692,50"')));
    await expect(page.locator('#bcAvviso')).toBeVisible(); await expect(page.locator('#bcAvviso')).toHaveText('Il file sembra incompleto: controlla prima di importare.');
    await expect(page.locator('#bcOk')).toBeHidden();
    await page.click('#bcAnn');
    const casi = [
      [file('Data;Descrizione;Importo\r\n01/11/2026;Spesa;-4,50\r\n', 'altra-banca.csv'), 'Questo file non sembra la lista movimenti in CSV di ING: per ora Soldirini legge solo quella. Non ho importato niente.'],
      [file(CSV.replace('"-4,50"', '"-4,5x"')), 'Il file non si legge bene: non ho importato niente.'],
      [file(CSV.split('\r\n').slice(0, 1).join('\r\n') + '\r\n01/11/2026,,,"+500,00",,Saldo iniziale\r\n'), 'Nel file non ci sono movimenti.'],
      [file('DATA CONTABILE,DATA VALUTA,USCITE,ENTRATE,CAUSALE,DESCRIZIONE OPERAZIONE\r\n03/11/2026,01/11/2026,"-4,50,,Pagamento Carta,x\r\n'), 'Il file non si legge bene: non ho importato niente.'],
    ];
    for (const [f, msg] of casi) {
      await page.setInputFiles('#bcFile', f);
      await expect(page.locator('#toast')).toHaveText(msg);
      await expect(page.locator('#bcModal')).toBeHidden();
    }
    expect(await page.evaluate(() => [Object.keys(D().spesePers || {}).length, Object.keys(D().bancaImpronte || {}).length])).toEqual([0, 0]);
    // il pulsante nella pagina "Spese giornaliere" e in Nuova attività → Spese giornaliere apre la scelta del file
    for (const [apri, dove] of [[() => page.evaluate(() => vaiA('dsp')), '#v-dsp'], [() => page.evaluate(() => { openEv(['2026-11-20']); document.getElementById('secSpese').open = true; }), '#evSpP']]) {
      await apri();
      const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator(dove + ' [data-bcimp]').click()]);
      expect(fc.isMultiple()).toBe(false);
      await page.evaluate(() => { if (!document.getElementById('evModal').hidden) closeEv(); });
    }
    // lettore CSV: virgolette, "" e a capo dentro i campi, CRLF e LF
    expect(await page.evaluate(() => Banca.leggiCsv('a,"b,c","d ""e""",f\r\n"g\nh",i,,\n'))).toEqual([['a', 'b,c', 'd "e"', 'f'], ['g\nh', 'i', '', '']]);
    expect(errori).toEqual([]);
  });
});
