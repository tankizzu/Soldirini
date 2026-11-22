// 24c.11 (D-150, D-151, D-152, D-153): categoria "Online", "Rimasti dai mesi prima", il mese parte dallo stipendio nella lista
// movimenti, lista movimenti anche in Excel. Solo dati inventati (forma di consegne/00-formato-lista-movimenti-ing.md).
const { test, expect } = require('./helpers/prova');
const { DriveFinto, nuovoDispositivo } = require('./helpers/app');

const TESTA = 'DATA CONTABILE,DATA VALUTA,USCITE,ENTRATE,CAUSALE,DESCRIZIONE OPERAZIONE';
const it = v => { const [i, d] = Math.abs(v).toFixed(2).split('.'); return (v < 0 ? '-' : '+') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d; };
const carta = (dc, acq, v, presso) => [dc, acq, `"${it(v)}"`, '', 'Pagamento Carta', `Operazione Mastercard del ${acq} alle ore 10:00 con Carta xxxxxxxxxxxx0000 Div=EUR Importo in divisa=${Math.abs(v)} / Importo in Euro=${Math.abs(v)} presso ${presso}`];
const stip = (d, v, per) => [d, d, '', `"${it(v)}"`, 'Accredito Stipendio/Pensione', `Bonifico N. 0000000000 BIC Ordinante XXXXITMM Codifica Ordinante IT00X0000000000000000000000 Anagrafica Ordinante DITTA ESEMPIO S.R.L. Note: Accredito stipendi-emolumenti periodo ${per}`];
const sdd = (d, v, nome) => [d, d, `"${it(v)}"`, '', 'Addebito Diretto', `Addebito SDD CORE Scad. ${d} Imp. ${Math.abs(v)} Creditor id. IT00ZZZ0000000000000 ${nome} Id Mandato 0000000000 Debitore MARIO ROSSI VIA ESEMPIO Rif. 000000000000`];
const bonEnt = (d, v, chi, nota) => [d, d, '', `"${it(v)}"`, 'Accredito Bonifico', `Bonifico N. 0000000000 BIC Ordinante XXXXITMMXXX Codifica Ordinante IT00X0000000000000000000000 Anagrafica Ordinante ${chi} Note: ${nota}`];
// lista CSV con i saldi giusti
function lista(righe, iniziale = 500) {
  const tot = righe.reduce((a, r) => a + Number((r[2] || r[3]).replace(/"/g, '').replace(/\./g, '').replace(',', '.')), 0);
  const d0 = righe[0][0], d1 = righe[righe.length - 1][0];
  return [TESTA, `${d0},,,"${it(iniziale)}",,Saldo iniziale`, ...righe.map(r => r.join(',')), `${d1},,,"${it(iniziale + tot)}",,Saldo finale`].join('\r\n') + '\r\n';
}
const file = (testo, name = 'ListaMovimenti.csv') => ({ name, mimeType: 'text/csv', buffer: Buffer.from(testo, 'utf8') });

async function telefono(browser, ora = '2026-11-20T10:00:00+01:00') {
  const d = await nuovoDispositivo(browser, { drive: new DriveFinto(), ora });
  await d.page.waitForFunction(() => window.Entrate && window.Stip15 && window.Archivio && Archivio.avviata && window.Banca);
  return d;
}
const conLavoroELuce = page => page.evaluate(() => {
  const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Ditta Esempio'; l.dal = '2026-01-01'; D().lavori[l.id] = l;
  const f = { id: uid(), cat: 'utenze', nome: 'Luce', importo: '40', giorno: '5', dal: '2026-11', al: '', rate: '', nota: '', updatedAt: 1 }; (D().fissi || (D().fissi = {}))[f.id] = f;
  DB.meta.skipWelcome = true; changed(); render(); return { lid: l.id, fid: f.id };
});
const righe = page => page.locator('#bcList .bcrow').evaluateAll(R => R.map(r => ({
  data: r.querySelector('.bcd').textContent, scelta: r.querySelector('select')?.value ?? null,
  mese: r.querySelector('.bcmese')?.textContent.trim() ?? null, gia: r.classList.contains('gia') })));
const speseSalvate = page => page.evaluate(() => Object.values(D().spesePers).map(s => [s.data, s.importo, s.meseConto ?? null]).sort((a, b) => a[0].localeCompare(b[0])));

test.describe('24c.11', () => {
  test('D-150: categoria "Online" (stesso codice e stessa icona) in Nuova attività, nella finestra della banca e nel Riepilogo', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    expect(await page.evaluate(() => [window.CATS_SPESE[0], window.CATS_SPESE.some(c => /Amazon/.test(c[2]))])).toEqual([['online', '📦', 'Online'], false]);
    await page.evaluate(() => { const id = uid(); D().spesePers = { [id]: { id, data: '2026-11-03', cat: 'online', importo: 9.9, nota: '', created: 1, updatedAt: 1 } }; changed(); vaiA('dsp'); });
    await expect(page.locator('#rieSpese')).toContainText('📦 Online');
    await expect(page.locator('#rieSpese')).not.toContainText('Amazon');
    await page.setInputFiles('#bcFile', file(lista([carta('04/11/2026', '02/11/2026', -12.99, 'NEGOZIO ONLINE ESEMPIO')])));
    await expect(page.locator('#bcList select option[value="sp:online"]')).toHaveText('Spesa · 📦 Online');
    expect(await page.locator('#v-rie, #bcModal, #evModal').evaluateAll(E => E.some(e => /Amazon/.test(e.textContent)))).toBe(false);
    expect(errori).toEqual([]);
  });

  test('D-151: tre mesi +100, −30, +50 → al terzo "Rimasti dai mesi prima" 70, totale 120; sezione chiusa; primo mese senza sezione; numero grande solo del mese', async ({ browser }) => {
    const { page, errori } = await telefono(browser, '2026-10-20T10:00:00+02:00');
    await page.evaluate(() => {
      const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Ditta Esempio'; l.dal = '2026-01-01'; D().lavori[l.id] = l;
      D().entrate = { [`lav|${l.id}|2026-07`]: { entrato: true, data: '2026-08-10', importo: 100, updatedAt: 1 }, [`lav|${l.id}|2026-09`]: { entrato: true, data: '2026-10-10', importo: 50, updatedAt: 1 } };
      const id = uid(); D().spesePers = { [id]: { id, data: '2026-09-15', cat: 'altro', importo: 30, nota: '', created: 1, updatedAt: 1 } };
      DB.meta.skipWelcome = true; changed();
    });
    const vedi = ym => page.evaluate(ym => { tab = 'rie'; rieMode = 'mese'; cur = ym; render(); }, ym);
    expect(await page.evaluate(() => ['2026-08', '2026-09', '2026-10'].map(m => contiMese(m).rimanenti))).toEqual([100, -30, 50]);
    await vedi('2026-08'); await expect(page.locator('#rieRim')).toHaveCount(0); // primo mese con dati: niente sezione
    await vedi('2026-10');
    const sez = page.locator('#rieRim details');
    await expect(sez).toHaveCount(1); expect(await sez.evaluate(d => d.open)).toBe(false); // chiusa (D-010)
    await expect(page.locator('#rieTot .hero .rim b')).toHaveText('50,00 €'); // D-067: il numero grande resta del mese
    await expect(sez.locator('summary')).toContainText('Rimasti dai mesi prima'); await expect(sez.locator('summary .sum')).toHaveText('70,00 €');
    await sez.locator('summary').click();
    expect(await sez.locator('.kv').evaluateAll(K => K.map(k => [...k.children].map(c => c.textContent.trim()).join(' '))))
      .toEqual(['Rimasti dai mesi prima 70,00 €', 'Rimanenti del mese 50,00 €', 'Totale 120,00 €']);
    await vedi('2026-09'); // un mese negativo: −30 + 100
    await expect(page.locator('#rieRim details .sum')).toHaveText('100,00 €');
    expect(await page.evaluate(() => rimastiPrima('2026-12'))).toBe(120); // novembre senza dati conta 0
    await page.evaluate(() => { rieMode = 'anno'; render(); }); await expect(page.locator('#rieRim')).toHaveCount(0); // solo vista Mese
    // nessun dato nuovo salvato
    expect(await page.evaluate(() => JSON.stringify(D()).includes('rimast'))).toBe(false);
    expect(errori).toEqual([]);
  });

  test('D-152: stipendio il 09/11 → le spese dell’1-3/11 e il bonifico del 06/11 contano in ottobre, dal 09/11 in novembre; la data vera non cambia; uscita fissa invariata', async ({ browser }) => {
    const { page, errori, } = await telefono(browser);
    const { lid } = await conLavoroELuce(page);
    await page.evaluate(() => { const p = nuovoProgetto(); p.nome = 'Associazione Esempio'; D().progetti[p.id] = p; const e = uid();
      D().eventi[e] = { id: e, pid: p.id, data: '2026-10-15', tipo: 'altro', titolo: '', ore: false, fasce: [], rimborso: false, spese: [{ id: uid(), tipo: 'altro', importo: 80, nota: '' }], created: 1, updatedAt: 1 }; changed(); });
    const L = lista([carta('02/11/2026', '01/11/2026', -4.5, 'BAR ESEMPIO'), carta('04/11/2026', '03/11/2026', -20, 'SUPERMERCATO ESEMPIO'),
      sdd('05/11/2026', -40, 'LUCE ESEMPIO S P A'), bonEnt('06/11/2026', 80, 'ASSOCIAZIONE ESEMPIO', 'Rimborso spese ottobre 2026'),
      stip('09/11/2026', 1500, 'OTTOBRE 2026'), carta('09/11/2026', '09/11/2026', -7, 'BAR ESEMPIO'), carta('12/11/2026', '11/11/2026', -30, 'SUPERMERCATO ESEMPIO')]);
    const rete = []; page.on('request', r => rete.push(r.url()));
    await page.setInputFiles('#bcFile', file(L));
    await expect(page.locator('#bcOk')).toBeVisible();
    expect(await righe(page)).toEqual([
      { data: '01/11', scelta: 'sp:bar', mese: 'Conta in ottobre.', gia: false },
      { data: '03/11', scelta: 'sp:spesa', mese: 'Conta in ottobre.', gia: false },
      { data: '05/11', scelta: expect.stringMatching(/^fx:/), mese: null, gia: false }, // uscita fissa già contata: resta com'è
      { data: '06/11', scelta: expect.stringMatching(/\|2026-10\|r$/), mese: 'Conta in ottobre.', gia: false },
      { data: '09/11', scelta: `en:lav|${lid}|2026-10`, mese: null, gia: false },
      { data: '09/11', scelta: 'sp:bar', mese: null, gia: false }, // lo stesso giorno dello stipendio: novembre
      { data: '11/11', scelta: 'sp:spesa', mese: null, gia: false },
    ]);
    const prima = await page.evaluate(() => [contiMese('2026-10'), contiMese('2026-11')].map(c => [c.sp, c.prog, c.lav.v, c.fTot]));
    await page.click('#bcImporta');
    expect(rete).toEqual([]);
    expect(await speseSalvate(page)).toEqual([['2026-11-01', 4.5, '2026-10'], ['2026-11-03', 20, '2026-10'], ['2026-11-09', 7, '2026-11'], ['2026-11-11', 30, '2026-11']]);
    const dopo = await page.evaluate(() => [contiMese('2026-10'), contiMese('2026-11')].map(c => [c.sp, c.prog, c.lav.v, c.fTot]));
    expect(prima).toEqual([[0, 0, 0, 0], [0, 0, 0, 40]]);
    expect(dopo).toEqual([[24.5, 80, 0, 0], [37, 0, 1500, 40]]);
    // calendario e giorno: la data vera non cambia
    expect(await page.evaluate(() => { tab = 'cal'; cur = '2026-11'; render(); return !!document.querySelector('[data-day="2026-11-01"] .ev.sp'); })).toBe(true);
    // pagina Spese giornaliere: ottobre con le due spese, novembre senza
    expect(await page.evaluate(() => { vaiA('dsp'); cur = '2026-10'; rieMode = 'mese'; render(); return document.querySelector('#rieSpese .kv.big b')?.textContent; })).toBe('24,50 €');
    // nella finestra "Entrati" il mese resta, se la data non cambia
    const k = await page.evaluate(() => Object.keys(pagamenti()).find(k => k.endsWith('|2026-10|r')));
    await page.evaluate(k => Entrate.apri('prog|' + k), k); await page.click('#enSave');
    expect(await page.evaluate(k => pagamenti()[k].meseConto, k)).toBe('2026-10');
    expect(errori).toEqual([]);
  });

  test('D-152: due stipendi, nessuno stipendio, stipendio di ottobre già segnato a mano; un mese su Drive non valido si ignora', async ({ browser }) => {
    const { page, errori } = await telefono(browser, '2026-12-10T10:00:00+01:00');
    const { lid } = await conLavoroELuce(page);
    // due stipendi: 27/10 e 26/11
    await page.setInputFiles('#bcFile', file(lista([carta('21/10/2026', '20/10/2026', -5, 'BAR ESEMPIO'), stip('27/10/2026', 1500, 'OTTOBRE 2026'),
      carta('29/10/2026', '28/10/2026', -6, 'BAR ESEMPIO'), carta('16/11/2026', '15/11/2026', -7, 'BAR ESEMPIO'), stip('26/11/2026', 1500, 'NOVEMBRE 2026'),
      carta('01/12/2026', '30/11/2026', -8, 'BAR ESEMPIO'), carta('03/12/2026', '02/12/2026', -9, 'BAR ESEMPIO')])));
    expect((await righe(page)).map(r => [r.data, r.mese])).toEqual([['20/10', 'Conta in settembre.'], ['27/10', null], ['28/10', null],
      ['15/11', 'Conta in ottobre.'], ['26/11', null], ['30/11', 'Conta in novembre.'], ['02/12', 'Conta in novembre.']]); // 30/11: in banca l'1/12, conta nel mese dell'acquisto (02)
    await page.click('#bcAnn');
    // nessuno stipendio: niente cambia
    await page.setInputFiles('#bcFile', file(lista([carta('02/11/2026', '01/11/2026', -4.5, 'BAR ESEMPIO'), carta('12/11/2026', '11/11/2026', -30, 'SUPERMERCATO ESEMPIO')])));
    expect((await righe(page)).map(r => r.mese)).toEqual([null, null]);
    await page.click('#bcAnn');
    // stipendio di ottobre già segnato a mano (entrato il 10/11): la riga dello stipendio è "Ignora", ma il mese parte lo stesso dal 09/11
    await page.evaluate(lid => { D().entrate[`lav|${lid}|2026-10`] = { entrato: true, data: '2026-11-10', importo: 1480, updatedAt: 1 }; changed(); }, lid);
    await page.setInputFiles('#bcFile', file(lista([carta('04/11/2026', '03/11/2026', -20, 'SUPERMERCATO ESEMPIO'), stip('09/11/2026', 1500, 'OTTOBRE 2026')])));
    expect(await righe(page)).toEqual([{ data: '03/11', scelta: 'sp:spesa', mese: 'Conta in ottobre.', gia: false }, { data: '09/11', scelta: 'no', mese: null, gia: false }]);
    await expect(page.locator('#bcList .bcrow').nth(1).locator('.bcinfo').first()).toHaveText('Già segnato come entrato il 10/11.');
    await page.click('#bcImporta');
    expect(await page.evaluate(lid => D().entrate[`lav|${lid}|2026-10`], lid)).toMatchObject({ data: '2026-11-10', importo: 1480 }); // non cambia
    // meseConto non valido (non è il mese prima della data) o rovinato: conta la data, come prima
    expect(await page.evaluate(() => { const a = uid(), b = uid();
      Object.assign(D().spesePers, { [a]: { id: a, data: '2026-12-05', meseConto: '2026-08', cat: 'altro', importo: 11, created: 1, updatedAt: 1 }, [b]: { id: b, data: '2026-12-06', meseConto: { x: 1 }, cat: 'altro', importo: 12, created: 2, updatedAt: 1 } });
      return contiMese('2026-12').sp; })).toBe(23);
    expect(errori).toEqual([]);
  });

  test('D-153: la stessa lista in Excel → stessi movimenti, stesso saldo, stesse proposte; dopo il CSV è tutta "Già importato"; Excel di un’altra forma → messaggio', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await conLavoroELuce(page);
    const M = [carta('02/11/2026', '01/11/2026', -4.5, 'BAR ESEMPIO'), sdd('05/11/2026', -40, 'LUCE ESEMPIO S P A'), stip('09/11/2026', 1500, 'OTTOBRE 2026'),
      carta('12/11/2026', '11/11/2026', -1234.56, 'NEGOZIO ESEMPIO'), ['13/11/2026', '13/11/2026', '"-100,00"', '', 'Giroconto', 'Giroconto da voi disposto N. 0000000000 A favore di Mario Rossi IBAN beneficiario IT00X0000000000000000000000 Note: Risparmi']];
    const csv = lista(M);
    // Excel con la forma del file vero: testata nelle righe 2-10, intestazione in riga 12 dalla colonna B, date vere e importi numeri
    const xlsx = async (righe, testa = ['DATA CONTABILE', 'DATA VALUTA', 'CAUSALE', 'DESCRIZIONE OPERAZIONE', 'IMPORTO IN EURO']) => Buffer.from(await page.evaluate(async ({ righe, testa }) => {
      const S = [], si = t => { let i = S.indexOf(t); if (i < 0) { S.push(t); i = S.length - 1; } return i; };
      const esx = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      const ser = d => { const [g, m, y] = d.split('/').map(Number); return (Date.UTC(y, m - 1, g) - Date.UTC(1899, 11, 30)) / 86400000; };
      const col = i => String.fromCharCode(66 + i);
      const cella = (r, i, v) => typeof v === 'number' ? `<c r="${col(i)}${r}" s="1"><v>${v}</v></c>` : `<c r="${col(i)}${r}" t="s"><v>${si(v)}</v></c>`;
      const testata = [[2, 'LISTA MOVIMENTI CONTO CORRENTE ARANCIO'], [4, 'Intestatario: MARIO ROSSI · Conto: 000000000'], [6, 'Periodo: dal 01/11/2026 al 13/11/2026'], [8, 'Saldo iniziale: +500,00 EUR'], [9, `Saldo finale: ${righe.saldo} EUR`]];
      let rows = testata.map(([r, t]) => `<row r="${r}">${cella(r, 0, t)}</row>`).join('');
      rows += `<row r="12">${testa.map((h, i) => cella(12, i, h)).join('')}</row>`;
      righe.mov.forEach((m, k) => { const r = 13 + k; rows += `<row r="${r}">${[ser(m.dc), ser(m.dv), m.caus, m.desc, m.v].map((v, i) => cella(r, i, v)).join('')}</row>`; });
      const z = new JSZip();
      z.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
      z.file('xl/workbook.xml', '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="MovimentiContoCorrenteArancio" sheetId="1" r:id="rId1"/></sheets></workbook>');
      z.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
      z.file('xl/worksheets/sheet1.xml', `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`);
      z.file('xl/sharedStrings.xml', `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${S.map(t => `<si><t xml:space="preserve">${esx(t)}</t></si>`).join('')}</sst>`);
      return await z.generateAsync({ type: 'base64' });
    }, { righe, testa }), 'base64');
    const num = s => Number(s.replace(/"/g, '').replace(/\./g, '').replace(',', '.'));
    const mov = M.map(r => ({ dc: r[0], dv: r[1], caus: r[4], desc: r[5], v: num(r[2] || r[3]) }));
    const saldo = '+' + (500 + mov.reduce((a, m) => a + m.v, 0)).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/, '.');
    const XL = await xlsx({ mov, saldo });
    const xfile = b => ({ name: 'ListaMovimenti.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: b });
    const rete = []; page.on('request', r => rete.push(r.url()));
    await page.setInputFiles('#bcFile', xfile(XL));
    await expect(page.locator('#bcModal')).toBeVisible();
    expect(rete).toEqual([]);
    await expect(page.locator('#bcOk')).toBeVisible(); // stesso saldo
    await expect(page.locator('#bcSub')).toHaveText('Lista movimenti ING · dal 01/11/2026 al 13/11/2026 · 5 movimenti');
    const daXlsx = await page.locator('#bcList .bcrow').evaluateAll(R => R.map(r => r.textContent.replace(/\s+/g, ' ').trim() + ' | ' + (r.querySelector('select')?.value ?? '')));
    await page.click('#bcAnn');
    await page.setInputFiles('#bcFile', file(csv));
    const daCsv = await page.locator('#bcList .bcrow').evaluateAll(R => R.map(r => r.textContent.replace(/\s+/g, ' ').trim() + ' | ' + (r.querySelector('select')?.value ?? '')));
    expect(daXlsx).toEqual(daCsv); // stessi movimenti, stesse proposte, stesso "Conta nei soldi di ottobre"
    expect(daCsv.length).toBe(5); expect(daCsv[3]).toContain('−1.234,56 €');
    await page.click('#bcImporta');
    await page.setInputFiles('#bcFile', xfile(XL));
    expect((await righe(page)).every(r => r.gia)).toBe(true); // lo stesso movimento in CSV e in Excel: "Già importato"
    await page.click('#bcAnn');
    expect(await page.evaluate(() => JSON.stringify(D()))).not.toMatch(/MARIO|Intestatario|1\.734|IT00X|xxxx/);
    // un Excel con un'altra intestazione, uno rovinato
    await page.setInputFiles('#bcFile', xfile(await xlsx({ mov, saldo }, ['Data', 'Valuta', 'Causale', 'Descrizione', 'Importo'])));
    await expect(page.locator('#bcErr')).toHaveText('Questo file non è la lista movimenti di ING in CSV o Excel, l\'unica che Soldirini sa leggere per ora. Non è stato importato niente.');
    await page.setInputFiles('#bcFile', xfile(Buffer.from('PK\u0003\u0004 non è uno zip')));
    await expect(page.locator('#bcErr')).toHaveText('Questo file non è la lista movimenti di ING in CSV o Excel, l\'unica che Soldirini sa leggere per ora. Non è stato importato niente.');
    await expect(page.locator('#bcModal')).toBeHidden();
    expect(errori).toEqual([]);
  });
});
