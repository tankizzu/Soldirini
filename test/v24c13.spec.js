// 24c.13: D-165 (entrate trovate nella lista movimenti → "Entrate da confermare"), primo pezzo delle Entrate extra (D-074, D-078),
// cache di stipendiEntrati() svuotata in changed() (nota della verifica della 24c.12). Solo dati inventati.
const { test, expect } = require('./helpers/prova');
const { DriveFinto, nuovoDispositivo } = require('./helpers/app');
const r2 = x => Math.round(x * 100) / 100;

const TESTA = 'DATA CONTABILE,DATA VALUTA,USCITE,ENTRATE,CAUSALE,DESCRIZIONE OPERAZIONE';
const it = v => { const [i, d] = Math.abs(v).toFixed(2).split('.'); return (v < 0 ? '-' : '+') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d; };
const carta = (dc, acq, v, presso) => [dc, acq, v < 0 ? `"${it(v)}"` : '', v > 0 ? `"${it(v)}"` : '', 'Pagamento Carta', `Operazione Mastercard del ${acq} alle ore 10:00 con Carta xxxxxxxxxxxx0000 Div=EUR Importo in divisa=${Math.abs(v)} / Importo in Euro=${Math.abs(v)} presso ${presso}`];
const bonEnt = (dc, dv, v, chi, nota) => [dc, dv, '', `"${it(v)}"`, 'Accredito Bonifico', `Bonifico N. 0000000000 BIC Ordinante XXXXITMMXXX Codifica Ordinante IT00X0000000000000000000000 Anagrafica Ordinante ${chi} Note: ${nota}`];
const stip = (d, v, per) => [d, d, '', `"${it(v)}"`, 'Accredito Stipendio/Pensione', `Bonifico N. 0000000000 BIC Ordinante XXXXITMM Codifica Ordinante IT00X0000000000000000000000 Anagrafica Ordinante DITTA ESEMPIO S.R.L. Note: Accredito stipendi-emolumenti periodo ${per}`];
function lista(righe, iniziale = 500) {
  const tot = righe.reduce((a, r) => a + Number((r[2] || r[3]).replace(/"/g, '').replace(/\./g, '').replace(',', '.')), 0);
  return [TESTA, `${righe[0][0]},,,"${it(iniziale)}",,Saldo iniziale`, ...righe.map(r => r.join(',')), `${righe[righe.length - 1][0]},,,"${it(iniziale + tot)}",,Saldo finale`].join('\r\n') + '\r\n';
}
const file = (testo, name = 'ListaMovimenti.csv') => ({ name, mimeType: 'text/csv', buffer: Buffer.from(testo, 'utf8') });
async function telefono(browser, ora = '2026-11-20T10:00:00+01:00') {
  const d = await nuovoDispositivo(browser, { drive: new DriveFinto(), ora, telefono: true });
  await d.page.waitForFunction(() => window.Entrate && window.EntrateExtra && window.Archivio && Archivio.avviata && window.Banca && window.Copia);
  await d.page.evaluate(() => { DB.meta.skipWelcome = true; changed(); render(); });
  return d;
}
const L50 = lista([carta('03/11/2026', '02/11/2026', -4.5, 'BAR ESEMPIO'), bonEnt('06/11/2026', '05/11/2026', 50, 'RESTITUZIONE ESEMPIO', 'Parte della cena')]);
async function importa(page, testo = L50) {
  await page.evaluate(() => vaiA('dsp'));
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#v-dsp [data-bcimp]')]);
  await fc.setFiles(file(testo));
  await expect(page.locator('#bcModal')).toBeVisible();
}
const fisco = page => page.evaluate(() => JSON.stringify([aggrega('2026'), stimaTasse('2026'), dovuti()]));

test.describe('24c.13', () => {
  test('D-165: bonifico "RESTITUZIONE ESEMPIO" da 50 € → "Entrata da confermare", riquadro dopo l’importazione, voce con data e importo; finché non si sceglie i soldi del mese non cambiano', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    const prima = await page.evaluate(() => contiMese('2026-11'));
    await importa(page);
    const R = await page.locator('#bcList .bcrow').evaluateAll(R => R.map(r => ({ v: r.querySelector('select').value, info: r.querySelector('.bcinfo').textContent.trim() })));
    expect(R[1]).toEqual({ v: 'dc:', info: 'Bonifico ricevuto: non sembra uno stipendio né un compenso. Va tra le «Entrate da confermare», dove scegli cos’è. Finché non scegli, non conta.' });
    await expect(page.locator('#bcTipi')).toHaveText('1 spesa · 1 entrata da confermare');
    await page.click('#bcImporta');
    await expect(page.locator('#bcDopo .bcfatti')).toContainText('1 spesa, 1 entrata da confermare'); // 24c.17 (D-160)
    await page.click('#bcFatto');
    // riquadro sotto il pulsante usato
    const nota = page.locator('#v-dsp .dcnote');
    await expect(nota).toHaveText(/Nella lista c’è 1 entrata da confermare\. Finché non scegli cos’è, non conta nei soldi\.\s*Controlla/);
    // salvata con la data valuta, l'importo, il nome già pulito e l'impronta; niente IBAN o codici
    const V = await page.evaluate(() => Object.values(D().daConfermare));
    expect(V.length).toBe(1);
    expect(V[0]).toMatchObject({ data: '2026-11-05', importo: 50, nome: 'RESTITUZIONE ESEMPIO', meseConto: '2026-11', origine: 'banca' });
    expect(V[0].impronta).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(V)).not.toMatch(/IT00X|XXXXITMM|Parte della cena|Bonifico N/);
    // nessuna scelta → le entrate del mese non cambiano (conta solo la spesa)
    const dopo = await page.evaluate(() => contiMese('2026-11'));
    expect([dopo.entrate, dopo.ext, r2(prima.rimanenti - dopo.rimanenti)]).toEqual([prima.entrate, 0, 4.5]);
    // "Controlla" → pagina "Ancora da incassare" con l'elenco
    await nota.locator('button').click();
    await expect(page.locator('#v-dinc')).toBeVisible();
    await expect(page.locator('#dcCard .ir')).toHaveCount(1);
    await expect(page.locator('#dcCard .ir .tx')).toHaveText(/Da RESTITUZIONE ESEMPIO\s*05\/11\/2026 · dalla lista movimenti/);
    await expect(page.locator('#dcCard .ir .imp')).toHaveText('50,00 €');
    await expect(page.locator('.dcnote')).toHaveCount(0);
    // nel riquadro del Riepilogo "Ancora da incassare" c'è anche senza compensi da incassare, con il numero
    await page.evaluate(() => { tab = 'rie'; rieMode = 'mese'; cur = '2026-11'; render(); });
    await expect(page.locator('#heroDet [data-vai="dinc"]')).toContainText('Ancora da incassare');
    await expect(page.locator('#heroDet [data-vai="dinc"] .nota')).toHaveText('1 entrata da confermare');
    expect(errori).toEqual([]);
  });

  test('D-165 a): "Entrata extra" → +50 negli Entrati del mese giusto (anche con meseConto), niente nelle tasse; data futura rifiutata (D-078)', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    const f0 = await fisco(page);
    await importa(page);await page.click('#bcImporta').then(() => page.click('#bcFatto'));
    const prima = await page.evaluate(() => contiMese('2026-11'));
    await page.evaluate(() => vaiA('dinc'));
    await page.locator('#dcCard [data-dc]').click();
    await expect(page.locator('#xeModal')).toBeVisible();
    await expect(page.locator('#xeChi')).toHaveText('Da RESTITUZIONE ESEMPIO');
    await expect(page.locator('#xeQuando')).toHaveText('05/11/2026 · 50,00 € · dalla lista movimenti');
    await expect(page.locator('#xeOk')).toBeDisabled();
    await page.locator('#xeScelte input[value="extra"]').check();
    await expect(page.locator('#xeData')).toHaveValue('2026-11-05');
    await expect(page.locator('#xeImp')).toHaveValue('50');
    await expect(page.locator('#xeOk')).toHaveText('Salva l’entrata extra');
    // la tastiera giusta (D-140)
    expect(await page.locator('#xeImp').getAttribute('inputmode')).toBe('decimal');
    // vendita: la frase di 04; data futura: errore di 02
    await page.locator('#xeTipi [data-xt="vendita"]').click();
    await expect(page.locator('#xeVendita')).toBeVisible();
    await page.locator('#xeData').fill('2026-11-25');
    await page.click('#xeOk');
    await expect(page.locator('#xeErr')).toHaveText('La data non può essere nel futuro: i soldi devono essere già arrivati.');
    await page.locator('#xeData').fill('2026-11-05');
    await page.locator('#xeTipi [data-xt="restituzione"]').click();
    await page.locator('#xeNota').fill('Parte della cena');
    await page.click('#xeOk');
    await expect(page.locator('#xeModal')).toBeHidden();
    const dopo = await page.evaluate(() => contiMese('2026-11'));
    expect([r2(dopo.entrate - prima.entrate), dopo.ext, r2(dopo.rimanenti - prima.rimanenti)]).toEqual([50, 50, 50]);
    expect(await page.evaluate(() => contiMese('2026-10').ext)).toBe(0);
    // niente nelle tasse, nelle soglie, nei compensi
    expect(await fisco(page)).toBe(f0);
    // la voce da confermare resta solo come segno di cancellazione, senza il nome
    const dc = await page.evaluate(() => Object.values(D().daConfermare));
    expect(dc.map(x => Object.keys(x).sort())).toEqual([['deleted', 'esito', 'id', 'updatedAt']]);
    const ex = await page.evaluate(() => Object.values(D().entrateExtra));
    expect(ex[0]).toMatchObject({ data: '2026-11-05', importo: 50, tipo: 'restituzione', nota: 'Parte della cena', meseConto: '2026-11', origine: 'banca' });
    // pagina "Ancora da incassare": niente da confermare, l'entrata extra del mese; nel riquadro la casella "Entrate extra"
    await expect(page.locator('#dcCard')).toHaveCount(0);
    await expect(page.locator('#rieExtra .ir .tx b')).toHaveText('↩️ Restituzione');
    await expect(page.locator('#rieExtra .ir .tx small')).toHaveText('05/11/2026 · Parte della cena');
    await page.evaluate(() => { tab = 'rie'; render(); });
    await expect(page.locator('#heroDet [data-vai="dinc"]').first()).toContainText('Entrate extra50,00 €');
    // meseConto (D-152): un'entrata del 05/12 con lo stipendio di novembre arrivato il 10/12 conta in novembre
    const m = await page.evaluate(() => { const id = uid(); D().entrateExtra[id] = { id, data: '2026-11-03', meseConto: '2026-10', importo: 20, tipo: 'regalo', nota: '', created: 1, updatedAt: 1 }; changed(); return [contiMese('2026-10').ext, contiMese('2026-11').ext]; });
    expect(m).toEqual([20, 50]);
    expect(errori).toEqual([]);
  });

  test('D-165 b) e c): compenso di un progetto segnato "Entrati" con quella data; "Non è un’entrata" la toglie e reimportando non torna', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    // un progetto con attività di ottobre da incassare
    const k = await page.evaluate(() => { const p = nuovoProgetto(); p.nome = 'Squadra Azzurra'; p.ore.attivo = true; D().progetti = { [p.id]: p };
      D().eventi = { e1: { id: 'e1', pid: p.id, data: '2026-10-10', tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '120', rimborso: false, spese: [], created: 1, updatedAt: 1 } }; changed(); return dovuti().map(d => [d.key, d.imp]); });
    expect(k.length).toBe(1);
    const due = lista([bonEnt('06/11/2026', '05/11/2026', 50, 'RESTITUZIONE ESEMPIO', 'Parte della cena'), bonEnt('07/11/2026', '07/11/2026', 15, 'NEGOZIO ESEMPIO', 'Altro')]);
    await importa(page, due);
    const R = await page.locator('#bcList select').evaluateAll(S => S.map(s => s.value));
    expect(R).toEqual(['dc:', 'dc:']);
    await page.click('#bcImporta').then(() => page.click('#bcFatto'));
    await expect(page.locator('#v-dsp .dcnote')).toHaveText(/Nella lista ci sono 2 entrate da confermare\./);
    const f0 = await fisco(page);
    const prima = await page.evaluate(() => contiMese('2026-11'));
    await page.evaluate(() => vaiA('dinc'));
    // b) progetto
    await page.locator('#dcCard [data-dc]').first().click();
    await page.locator('#xeScelte input[value="prog"]').check();
    await expect(page.locator('#xePg option')).toHaveCount(1);
    await expect(page.locator('#xeOk')).toHaveText('Segna come entrati');
    await page.click('#xeOk');
    const pg = await page.evaluate(k => pagamenti()[k], k[0][0]);
    expect(pg).toMatchObject({ pagato: true, data: '2026-11-05', importo: 50, meseConto: '2026-11' });
    const dopo = await page.evaluate(() => contiMese('2026-11'));
    expect(r2(dopo.prog - prima.prog)).toBe(50);
    // c) non è un'entrata
    await page.locator('#dcCard [data-dc]').click();
    await page.locator('#xeScelte input[value="no"]').check();
    await expect(page.locator('#xeOk')).toHaveText('Togli dall’elenco');
    await page.click('#xeOk');
    await expect(page.locator('#dcCard')).toHaveCount(0);
    const fine = await page.evaluate(() => contiMese('2026-11'));
    expect(fine.entrate).toBe(dopo.entrate);
    // la scelta del progetto cambia "Ancora da incassare" ma non le tasse calcolate dai compensi (stesso conto di prima della scelta, a parte il pagato)
    expect(await page.evaluate(() => Object.values(D().daConfermare).every(x => x.deleted && !('nome' in x)))).toBe(true);
    // reimportando la stessa lista non torna niente
    await importa(page, due);
    expect(await page.locator('#bcList .bcrow.gia').count()).toBe(2);
    await page.click('#bcAnn');
    expect(await page.evaluate(() => EntrateExtra.daConf().length)).toBe(0);
    expect(f0.length > 0).toBe(true);
    expect(errori).toEqual([]);
  });

  test('D-074: "💶 Entrata extra" in Nuova attività; modifica ed eliminazione; dati rovinati da Drive ignorati; copia di sicurezza e unione voce per voce', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    const f0 = await fisco(page);
    await page.evaluate(() => openEv(['2026-11-12']));
    await expect(page.locator('#secExtra')).toBeVisible();
    await page.locator('#secExtra > summary').click();
    expect(await page.locator('#evExImp').getAttribute('inputmode')).toBe('decimal');
    await page.locator('#evExTipi [data-ext="vendita"]').click();
    await expect(page.locator('#evExVendita')).toBeVisible();
    await page.locator('#evExImp').fill('80');
    await expect(page.locator('#secExtraSum')).toHaveText('+ 80,00 €');
    await page.locator('#evExNota').fill('Bici vecchia');
    await page.click('#evSave');
    await expect(page.locator('#evModal')).toBeHidden();
    expect(await page.evaluate(() => [contiMese('2026-11').ext, Object.values(D().entrateExtra)[0].tipo])).toEqual([80, 'vendita']);
    // un giorno nel futuro: errore e niente salvato
    await page.evaluate(() => openEv(['2026-11-25']));
    await page.locator('#secExtra > summary').click();
    await page.locator('#evExImp').fill('10');
    await page.click('#evSave');
    await expect(page.locator('#evExErr')).toHaveText('La data non può essere nel futuro: i soldi devono essere già arrivati.');
    await page.evaluate(() => closeEv());
    expect(await page.evaluate(() => Object.keys(D().entrateExtra).length)).toBe(1);
    // modifica e poi elimina dalla pagina "Ancora da incassare"
    await page.evaluate(() => { vaiA('dinc'); cur = '2026-11'; render(); });
    await page.locator('#rieExtra [data-xe]').click();
    await expect(page.locator('#xeScelte')).toBeHidden();
    await page.locator('#xeImp').fill('75,50');
    await page.click('#xeOk');
    expect(await page.evaluate(() => contiMese('2026-11').ext)).toBe(75.5);
    await page.locator('#rieExtra [data-xe]').click();
    await page.click('#xeDel');
    await page.locator('#dlgBtns .btn.danger').click(); // 24c.14: stessa conferma dell'eliminazione di una spesa
    expect(await page.evaluate(() => [contiMese('2026-11').ext, Object.values(D().entrateExtra)[0].deleted])).toEqual([0, true]);
    // dati rovinati arrivati da Drive: ignorati, nessun errore, niente nella pagina
    await page.evaluate(() => { D().entrateExtra.x1 = { data: '2026-11-31', importo: 5, updatedAt: 1 }; D().entrateExtra.x2 = { data: '2026-11-02', importo: '<img src=x onerror=alert(1)>', updatedAt: 1 };
      D().entrateExtra.x3 = { data: '2026-11-02', importo: -3, updatedAt: 1 }; D().entrateExtra['<b>'] = { data: '2026-11-02', importo: 4, tipo: '<i>', nota: '<img src=x>', updatedAt: 1 };
      D().daConfermare.y1 = { data: '2026-11-02', importo: 7, nome: '<script>x</script>', updatedAt: 1 }; changed(); render(); });
    expect(await page.evaluate(() => contiMese('2026-11').ext)).toBe(4);
    expect(await page.locator('#v-dinc img, #v-dinc script, #v-dinc i').count()).toBe(0);
    await expect(page.locator('#rieExtra .ir .tx b')).toHaveText('• Altro');
    await expect(page.locator('#rieExtra .ir .tx small')).toHaveText('02/11/2026 · <img src=x>');
    // niente nelle tasse
    await page.evaluate(() => { for (const k of Object.keys(D().entrateExtra)) delete D().entrateExtra[k]; changed(); });
    expect(await fisco(page)).toBe(f0);
    // unione voce per voce (come Drive): vince la più recente, la cancellazione non torna indietro
    const u = await page.evaluate(() => { const a = { entrateExtra: { e: { id: 'e', data: '2026-11-02', importo: 9, tipo: 'regalo', updatedAt: 5 } }, daConfermare: { d: { id: 'd', deleted: true, esito: 'no', updatedAt: 9 } } };
      const b = { entrateExtra: { e: { id: 'e', deleted: true, updatedAt: 7 } }, daConfermare: { d: { id: 'd', data: '2026-11-02', importo: 7, nome: 'X', updatedAt: 3 } } };
      const m = mergeData(a, b); return [m.entrateExtra.e.deleted, m.daConfermare.d.deleted, 'nome' in m.daConfermare.d]; });
    expect(u).toEqual([true, true, false]);
    // copia di sicurezza: le due raccolte ci sono
    expect(await page.evaluate(() => { const d = Copia.pulisci({ entrateExtra: { e: { id: 'e', data: '2026-11-02', importo: 9, tipo: 'regalo', updatedAt: 1 } }, daConfermare: { d: { id: 'd', deleted: true, updatedAt: 1 } } });
      return [d.entrateExtra.e.importo, d.daConfermare.d.deleted]; })).toEqual([9, true]);
    expect(errori).toEqual([]);
  });

  test('cache di stipendiEntrati(): stipendio segnato e conto rifatto nello stesso giro → spese importate prima della regola già nel mese giusto', async ({ browser }) => {
    const { page, errori } = await telefono(browser, '2026-12-20T10:00:00+01:00');
    const r = await page.evaluate(() => { const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Ditta Esempio'; l.dal = '2026-01-01'; D().lavori[l.id] = l;
      D().spesePers = { a: { id: 'a', data: '2026-11-03', importo: 10, cat: 'altro', nota: '', origine: 'banca', created: 1, updatedAt: 1 } }; changed();
      const prima = [contiMese('2026-10').sp, contiMese('2026-11').sp];
      (D().entrate || (D().entrate = {}))[`lav|${l.id}|2026-10`] = { entrato: true, data: '2026-11-09', importo: 1000, updatedAt: Date.now() }; changed();
      const dopo = [contiMese('2026-10').sp, contiMese('2026-11').sp];
      return [prima, dopo]; });
    expect(r).toEqual([[0, 10], [10, 0]]);
    expect(errori).toEqual([]);
  });

  test('informativa 24c.13: nome di chi manda il bonifico solo per le entrate da confermare; entrate extra', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    const pr = await page.evaluate(async () => (await fetch('privacy.html')).text());
    // 24c.14: il testo provvisorio è sostituito da quello definitivo di 03 (v24c14.spec.js)
    expect(pr).toContain('il <b>nome di chi te li manda</b>');
    expect(pr).toContain('entrate extra (restituzioni, regali, vendite');
    expect(errori).toEqual([]);
  });
});
