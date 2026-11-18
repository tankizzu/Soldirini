// 24.2 (D-081, D-086): lettura di una busta paga con una struttura a tabella simile a quelle TeamSystem.
// SOLO DATI INVENTATI (D-084): la busta reale dell'utente non è nel repository né nelle prove, e nessun suo valore è usato qui,
// nemmeno nei commenti. Importi, date e nomi sono di fantasia e scelti apposta diversi da quelli reali.
// Parte 1: "pezzi" di testo con le posizioni costruiti qui (come li darebbe la lettura): vale anche su GitHub.
// Parte 2: busta finta disegnata e letta con Tesseract (solo in locale, con i pacchetti in test/.tesseract).
const { test, expect } = require('./helpers/prova');
const { nuovoDispositivo } = require('./helpers/app');
const { serviTesseract, mancanti } = require('./helpers/tesseract');
const { disegnaBustaFinta, fileDa, ATTESI } = require('./helpers/busta-finta');

// riga di pezzi: [[testo, x], ...] alla riga y (altezza 20, larghezza 11 per carattere)
const riga = (y, celle) => celle.flatMap(([t, x]) => { let xx = x; return t.split(' ').filter(Boolean).map(w => { const p = { t: w, x0: xx, x1: xx + w.length * 11, y0: y, y1: y + 20 }; xx += w.length * 11 + 6; return p; }); });
// importo allineato a destra che finisce in xr; "2. 318, 75" resta in più pezzi, come lo stampa la busta
const dx = (t, xr) => { const w = t.length * 11; return [t, xr - w]; };
function busta({ mese = 'nome', netto = '2. 318, 75', totali = ['2.904,15', '585,40'], rol = '26,50' } = {}) {
  return [
    ...riga(40, [['COOPERATIVA SOCIALE ESEMPIO', 40], ['CEDOLINO PAGA', 900]]),
    ...riga(80, [['DIPENDENTE ROSSI MARIO', 40], ['LIVELLO B2', 520], ['PART-TIME 60%', 760]]),
    ...riga(120, [...(mese === 'nome' ? [['MESE RETRIBUZIONE', 40], ['OTTOBRE 2026', 300]] : mese === 'numero' ? [['MESE RETRIBUZIONE', 40], ['10/2026', 300]] :
      mese === 'periodo' ? [['PERIODO DAL 01/10/2026 AL 31/10/2026', 40]] : []), ['DATA TERMINE TD 31/08/2028', 520], ['DATA ASS. CONV. 12/05/2025', 860]]),
    ...riga(170, [['VOCE', 40], ['DESCRIZIONE', 120], ['ORE-GIORNI', 520], ['BASE', 650], ['DATI STATISTICI', 760], ['COMPETENZE', 920], ['TRATTENUTE', 1070]]),
    ...riga(205, [['0001', 40], ['RETRIBUZIONE ORDINARIA', 120], dx('140,00', 560), dx('18,64893', 700), dx('2.610,85', 1040)]),
    ...riga(239, [['0050', 40], ['SCATTI ANZIANITA', 120], dx('293,30', 1040)]),
    ...riga(273, [['0510', 40], ['CONTRIBUTI IVS', 120], dx('2.904,00', 700), dx('266,72', 1190)]),
    ...riga(307, [['0700', 40], ['IRPEF', 120], dx('318,68', 1190)]),
    ...riga(490, [['TOTALI', 120], dx(totali[0], 1040), dx(totali[1], 1190)]),
    ...riga(545, [['IMPONIBILE IRPEF', 40], dx('2.637,28', 400), ['NETTO BUSTA', 860], ...(() => { // netto in pezzi, con gli spazi
      const parti = netto.split(' '); let x = 1190 - netto.length * 11; return parti.map(t => { const c = [t, x]; x += t.length * 11 + 11; return c; }); })()]),
    ...riga(579, [['IRPEF NETTA', 40], dx('318,68', 400)]),
    ...riga(645, [['ANNO PREC.', 260], ['MATURATO', 420], ['GODUTO', 580], ['RESIDUO', 720], ['PROIEZIONE', 860]]),
    ...riga(680, [['FERIE h', 40], dx('18,00', 370), dx('92,40', 520), dx('40,00', 660), dx('70,40', 810), dx('110,00', 980)]),
    ...riga(714, [['PERMESSI', 40], dx('0,00', 370), dx('6,00', 520), dx('6,00', 660), dx('0,00', 810), dx('0,00', 980)]),
    ...riga(748, [['R.O.L.', 40], dx('12,00', 370), dx('22,50', 520), dx('8,00', 660), dx(rol, 810), dx('36,00', 980)]),
    ...riga(782, [['EX FEST. h', 40], dx('0,00', 370), dx('14,00', 520), dx('4,00', 660), dx('10,00', 810), dx('18,00', 980)]),
    ...riga(870, [['IMPONIBILE CONTR. MESE', 40], dx('2.904,00', 480), ['CONTRIBUTI INPS', 600], dx('266,72', 980)]),
  ];
}
const ATT = { lordo: 2904.15, trattenute: 585.4, netto: 2318.75, ferie: 70.4, unita: 'ore', rol: 26.5, exfest: 10, unitaPermessi: 'ore', imponibilePrev: 2904, contribLav: 266.72 };
const leggi = (page, pezzi) => page.evaluate(p => { const r = Buste.analizzaBusta(p); delete r.testo; return r; }, pezzi);

test.describe('24.2 · busta TeamSystem (pezzi inventati)', () => {
  test('tutte le voci: importo spezzato "2. 318, 75", TOTALI, RESIDUO in ore, R.O.L., EX FEST., IMPONIBILE CONTR. MESE, CONTRIBUTI INPS', async ({ browser }) => {
    const { page, errori } = await nuovoDispositivo(browser, { telefono: false });
    const r = await leggi(page, busta());
    expect(r).toEqual(expect.objectContaining({ mese: '2026-10', ...ATT }));
    expect(errori).toEqual([]);
  });
  test('mese: mai dalle date con il giorno (DATA ASS. 12/05/2025, DATA TERMINE 31/08/2028): "10/2026" vicino a MESE vale, altrimenti vuoto', async ({ browser }) => {
    const { page } = await nuovoDispositivo(browser, { telefono: false });
    expect((await leggi(page, busta({ mese: 'numero' }))).mese).toBe('2026-10');
    expect((await leggi(page, busta({ mese: 'nessuno' }))).mese).toBeNull(); // nella v24: "2025-05" (o "2028-08") da una data
    expect((await leggi(page, busta({ mese: 'periodo' }))).mese).toBeNull(); // "PERIODO DAL 01/10/2026": è una data con il giorno
    // due nomi di mese diversi e nessuna etichetta: non si sceglie a caso
    expect((await leggi(page, [...riga(40, [['CEDOLINO OTTOBRE 2026', 40]]), ...riga(80, [['CONGUAGLIO SETTEMBRE 2026', 40]])])).mese).toBeNull();
    // le buste di prima (nome del mese da qualche parte, una volta sola) si leggono come prima
    expect((await leggi(page, riga(40, [['CEDOLINO PAGA OTTOBRE 2026', 40]]))).mese).toBe('2026-10');
  });
  test('netto: senza centesimi o che non torna con TOTALI non vale; lordo e trattenute dai TOTALI e netto ricalcolato (regola della 24.0.2)', async ({ browser }) => {
    const { page } = await nuovoDispositivo(browser, { telefono: false });
    // "41": un pezzo letto a metà, senza centesimi → non vale; il netto viene dai TOTALI (2.904,15 − 585,40)
    let r = await leggi(page, busta({ netto: '41' }));
    expect([r.netto, r.lordo, r.trattenute]).toEqual([2318.75, 2904.15, 585.4]);
    // "41,00" con i centesimi ma che non torna con i TOTALI: non vale, il netto è ricalcolato dai TOTALI (come nella 24.0.2)
    r = await leggi(page, busta({ netto: '41,00' }));
    expect([r.netto, r.lordo, r.trattenute]).toEqual([2318.75, 2904.15, 585.4]);
    // tolleranza di 1 € per l'arrotondamento
    r = await leggi(page, busta({ netto: '2. 319, 50' }));
    expect([r.netto, r.lordo, r.trattenute]).toEqual([2319.5, 2904.15, 585.4]);
    // netto molto più piccolo delle trattenute, senza lordo per controllarlo: vuoto
    r = await leggi(page, [...riga(40, [['TOTALE TRATTENUTE', 40], dx('585,40', 600)]), ...riga(80, [['NETTO BUSTA', 40], dx('41,00', 600)])]);
    expect([r.netto, r.trattenute]).toEqual([null, 585.4]);
    // TOTALI con la virgola persa ("2.90415", come "1.23520" nelle foto finte): non vale come lordo, resta vuoto; il netto stampato resta
    r = await leggi(page, busta({ totali: ['2.90415', '585,40'] }));
    expect([r.lordo, r.netto]).toEqual([null, 2318.75]);
  });
  test('ferie/permessi: un valore senza decimali in una riga che li ha (es. "2650" per 26,50) resta vuoto', async ({ browser }) => {
    const { page } = await nuovoDispositivo(browser, { telefono: false });
    const r = await leggi(page, busta({ rol: '2650' }));
    expect([r.rol, r.ferie, r.exfest]).toEqual([null, 70.4, 10]);
  });
  test('24.2b: colonna RESIDUO non trovata: con 3 o più numeri il campo resta vuoto; con 1 o 2 numeri vale la regola di prima', async ({ browser }) => {
    const { page } = await nuovoDispositivo(browser, { telefono: false });
    // tabella inventata senza intestazione leggibile (le colonne MATURATO / GODUTO / RESIDUO / PROIEZIONE non ci sono)
    const r = await leggi(page, [
      ...riga(680, [['FERIE h', 40], dx('18,00', 370), dx('92,40', 520), dx('40,00', 660), dx('70,40', 810), dx('110,00', 980)]), // 5 numeri: vuoto
      ...riga(748, [['R.O.L.', 40], dx('26,50', 370)]),                                                                             // 1 numero: quello
      ...riga(782, [['EX FEST. h', 40], dx('4,00', 370), dx('10,00', 520)]),                                                        // 2 numeri vicini: l'ultimo del gruppo
    ]);
    expect([r.ferie, r.rol, r.exfest]).toEqual([null, 26.5, 10]);
    // con l'intestazione leggibile la colonna RESIDUO vale come prima (anche con 5 numeri)
    expect((await leggi(page, busta())).ferie).toBe(70.4);
  });
});

test.describe('24b.1 · contributi letti male (D-095)', () => {
  test('contributi molto più piccoli del 9% circa dell\'imponibile (o del lordo, se manca) → vuoti; quelli giusti restano', async ({ browser }) => {
    const { page, errori } = await nuovoDispositivo(browser, { telefono: false });
    const conContributi = (c, imponibile = true) => busta().map(p => p.t === '266,72' ? { ...p, t: c } : p)
      .filter(p => imponibile || !['IMPONIBILE', 'CONTR.', 'MESE', '2.904,00'].includes(p.t));
    let r = await leggi(page, conContributi('66,72')); // prima cifra persa: 2,3% dell'imponibile
    expect([r.contribLav, r.dubbi, r.imponibilePrev]).toEqual([null, ['contribLav'], 2904]);
    r = await leggi(page, conContributi('266,72')); // 9,2%: giusto
    expect([r.contribLav, r.dubbi]).toEqual([266.72, []]);
    r = await leggi(page, conContributi('170,00')); // 5,9% (per esempio un apprendista): resta
    expect([r.contribLav, r.dubbi]).toEqual([170, []]);
    r = await leggi(page, conContributi('66,72', false)); // senza imponibile: confronto con il lordo (2,3% < 3%)
    expect([r.imponibilePrev, r.contribLav, r.dubbi]).toEqual([null, null, ['contribLav']]);
    expect(errori).toEqual([]);
  });
  test('finestra della busta: contributi scartati → campo vuoto con il bordo rosso; riaprendo il bordo non resta', async ({ browser }) => {
    const { page, errori } = await nuovoDispositivo(browser);
    const lid = await page.evaluate(() => { const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Cooperativa di prova'; l.dal = '2026-01-01'; D().lavori[l.id] = l;
      D().entrate = { 'v24|risposta': { risposta: 'no', updatedAt: 1 } }; changed();
      // lettura finta: solo per provare la finestra (il lettore è provato sopra)
      Buste.testoBusta = async () => []; Buste.analizzaBusta = () => ({ mese: '2026-10', lordo: 2904.15, trattenute: 585.4, netto: 2318.75, imponibilePrev: 2904, contribLav: null, dubbi: ['contribLav'] });
      return l.id; });
    await page.evaluate(lid => Stip15.apriBusta(lid, '2026-11'), lid);
    await page.locator('#bpFile').setInputFiles({ name: 'busta.png', mimeType: 'image/png', buffer: Buffer.from('finta') });
    await expect(page.locator('#bp-contribLav')).toHaveClass(/manca/);
    await expect(page.locator('#bp-contribLav')).toHaveValue('');
    await expect(page.locator('#bp-imponibilePrev')).not.toHaveClass(/manca/);
    await page.locator('#bpClose').click();
    await page.evaluate(lid => Stip15.apriBusta(lid, '2026-11'), lid);
    await expect(page.locator('#bp-contribLav')).not.toHaveClass(/manca/);
    expect(errori).toEqual([]);
  });
});

test.describe('24.2 · busta finta letta da immagine (Tesseract, solo in locale)', () => {
  test('immagine pulita e "foto": voci giuste, e nelle foto nessun valore sbagliato (vuoto se non si legge)', async ({ browser }) => {
    const manca = mancanti();
    test.skip(manca.length > 0, 'pacchetti di Tesseract non scaricati (vedi test/LEGGIMI.md): ' + manca.join(', '));
    test.setTimeout(240000);
    const { ctx, page, errori } = await nuovoDispositivo(browser, { telefono: false }); await serviTesseract(ctx);
    const casi = [[{ mese: 'nome' }, true], [{ mese: 'numero' }, true], [{ mese: 'nessuno' }, true],
      [{ mese: 'numero', foto: true, scala: 0.56, sfoca: 0.7 }, false], [{ mese: 'nessuno', foto: true, scala: 0.7, sfoca: 0.5 }, false], [{ mese: 'nome', foto: true, scala: 0.62, sfoca: 0.6 }, false]];
    for (const [opz, tutte] of casi) {
      const r = await page.evaluate(async ([a, b, opz]) => { eval(a); eval(b);
        const x = Buste.analizzaBusta(await Buste.testoBusta(fileDa(disegnaBustaFinta(opz), opz.foto ? 'b.jpg' : 'b.png'))); delete x.testo; return x; },
      [disegnaBustaFinta.toString(), fileDa.toString(), opz]);
      const nome = JSON.stringify(opz);
      expect(r.mese, nome).toBe(opz.mese === 'nessuno' ? null : '2026-10');
      if (tutte) expect(r, nome).toEqual(expect.objectContaining(ATTESI));
      else { // mai un valore sbagliato, tranne il caso noto qui sotto
        // 24b.1 (D-095): nella foto al 56% sfocata Tesseract legge i contributi con la prima cifra persa; il controllo
        // "contributi molto più piccoli del 9% circa" li lascia vuoti (prima: il ✗ della 24.2b). Nessun caso noto: mai valori sbagliati.
        if (opz.scala === 0.56) expect([r.contribLav, r.dubbi], nome).toEqual([null, ['contribLav']]);
        for (const k of Object.keys(ATTESI)) if (r[k] != null) expect(r[k], `${nome} ${k}`).toBe(ATTESI[k]);
        expect(r.netto, nome).toBe(ATTESI.netto); }
    }
    expect(errori).toEqual([]);
  });
  test('finestra della busta: mese non trovato → campo vuoto con il bordo rosso; si salva solo dopo averlo scelto', async ({ browser }) => {
    const manca = mancanti();
    test.skip(manca.length > 0, 'pacchetti di Tesseract non scaricati (vedi test/LEGGIMI.md): ' + manca.join(', '));
    test.setTimeout(180000);
    const { ctx, page } = await nuovoDispositivo(browser); await serviTesseract(ctx);
    const lid = await page.evaluate(() => { const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Cooperativa di prova'; l.dal = '2026-01-01'; D().lavori[l.id] = l;
      D().entrate = { 'v24|risposta': { risposta: 'no', updatedAt: 1 } }; changed(); return l.id; });
    await page.evaluate(lid => Stip15.apriBusta(lid, '2026-11'), lid);
    // il file si passa alla finestra come farebbe la scelta del telefono
    const png = await page.evaluate(([a]) => { eval(a); return disegnaBustaFinta({ mese: 'nessuno' }).split(',')[1]; }, [disegnaBustaFinta.toString()]);
    await page.locator('#bpFile').setInputFiles({ name: 'busta.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await expect(page.locator('#bpStep2')).toBeVisible({ timeout: 120000 });
    await expect(page.locator('#bpMese')).toHaveValue('');
    await expect(page.locator('#bpMese')).toHaveClass(/manca/);
    await expect(page.locator('#bp-netto')).toHaveValue('1004.44');
    await expect(page.locator('#bpNote')).toContainText('✗ mese');
    await page.locator('#bpSave').click();
    await expect(page.locator('#toast')).toHaveText('Indica il mese della busta.');
    await page.locator('#bpMese').fill('2026-10');
    await expect(page.locator('#bpMese')).not.toHaveClass(/manca/);
  });
});
