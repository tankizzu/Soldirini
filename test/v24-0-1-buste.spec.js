// v24.0.1 (D-081): lettura delle buste con tabelle caricate come immagine o PDF.
// Tutti i dati sono inventati: nessuna busta reale è usata nelle prove.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('./helpers/prova');
const { nuovoDispositivo } = require('./helpers/app');

// Pezzi di testo con le posizioni, come li restituisce la lettura (PDF o foto).
// Ogni riga: [[testo, x], ...]; le parole di un testo diventano pezzi separati, come nella lettura vera.
const pezzi = righe => righe.flatMap((celle, i) => { const y = 40 + i * 20;
  return celle.flatMap(([testo, x0]) => { let x = x0;
    return testo.split(' ').map(t => { const p = { t, x0: x, x1: x + t.length * 6, y0: y, y1: y + 10 }; x += t.length * 6 + 4; return p; }); }); });

// Busta finta: date con il giorno in alto, colonne COMPETENZE/TRATTENUTE, riga TOTALI, netto stampato con spazi ("1. 234, 50").
const BUSTA = [
  [['DATA TERMINE TD', 20], ['15/03/2028', 140], ['DATA ASS. CONV.', 260], ['01/04/2025', 380]],
  [['VOCE', 20], ['DESCRIZIONE', 60], ['ORE/GIORNI', 200], ['BASE', 280], ['COMPETENZE', 400], ['TRATTENUTE', 500]],
  [['0001', 20], ['RETRIBUZIONE ORDINARIA', 60], ['120,00', 200], ['12,6033', 280], ['1.512,40', 400]],
  [['CONTRIBUTI INPS', 60], ['140,22', 500]],
  [['IRPEF NETTA', 60], ['137,68', 500]],
  [['TOTALI', 60], ['1.512,40', 400], ['277,90', 500]],
  [['NETTO BUSTA', 300], ['1.', 400], ['234,', 416], ['50', 444]],
  [['IMPONIBILE IRPEF', 20], ['1.372,18', 140]],
  [['IMPONIBILE CONTR. MESE', 20], ['1.510,00', 200]],
];

test.describe('24.0.1 · buste con tabelle', () => {
  test('importo spezzato, lordo e trattenute dalla riga TOTALI, imponibile da "IMPONIBILE CONTR. MESE", mese mai da una data con il giorno', async ({ browser }) => {
    const { page, errori } = await nuovoDispositivo(browser, { telefono: false });
    const r = await page.evaluate(p => Buste.analizzaBusta(p), pezzi(BUSTA));
    expect([r.netto, r.lordo, r.trattenute, r.imponibilePrev, r.contribLav]).toEqual([1234.5, 1512.4, 277.9, 1510, 140.22]);
    expect(r.mese).toBeNull(); // né aprile 2025 né marzo 2028: meglio vuoto che sbagliato
    expect(errori).toEqual([]);
  });

  test('il mese si legge ancora dal nome o da "mm/aaaa" isolato', async ({ browser }) => {
    const { page } = await nuovoDispositivo(browser, { telefono: false });
    const conNome = await page.evaluate(p => Buste.analizzaBusta(p), pezzi([[['PERIODO DI PAGA', 20], ['OTTOBRE 2026', 140]], ...BUSTA]));
    const conNumeri = await page.evaluate(p => Buste.analizzaBusta(p), pezzi([[['MESE', 20], ['10/2026', 80]], ...BUSTA]));
    expect([conNome.mese, conNumeri.mese]).toEqual(['2026-10', '2026-10']);
  });

  test('netto non credibile: si scarta e, se ci sono i totali, si ricalcola da lordo − trattenute; senza totali resta vuoto', async ({ browser }) => {
    const { page } = await nuovoDispositivo(browser, { telefono: false });
    const conNetto = n => BUSTA.map(r => r[0][0] === 'NETTO BUSTA' ? [['NETTO BUSTA', 300], [n, 400]] : r);
    const leggi = async righe => (await page.evaluate(p => Buste.analizzaBusta(p), pezzi(righe))).netto;
    // solo un pezzo del netto ("50", più piccolo dei contributi) o un netto che non torna (oltre 1 €): vale lordo − trattenute
    expect(await leggi(conNetto('50'))).toBe(1234.5);
    expect(await leggi(conNetto('1.134,50'))).toBe(1234.5);
    // arrotondamento di pochi centesimi: il netto letto resta
    expect(await leggi(conNetto('1.235,00'))).toBe(1235);
    // senza riga TOTALI: un netto più piccolo dei contributi resta vuoto
    const senzaTotali = conNetto('50').filter(r => r[0][0] !== 'TOTALI');
    expect(await leggi(senzaTotali)).toBeNull();
  });

  test('due importi vicini ma separati non vengono uniti', async ({ browser }) => {
    const { page } = await nuovoDispositivo(browser, { telefono: false });
    const r = await page.evaluate(p => Buste.analizzaBusta(p), pezzi([[['TOTALE COMPETENZE', 20], ['1.000,00', 200], ['250,00', 260]], [['TOTALE TRATTENUTE', 20], ['250,00', 200]], [['NETTO DEL MESE', 20], ['750,00', 200]]]));
    expect([r.lordo, r.trattenute, r.netto]).toEqual([1000, 250, 750]);
  });

  // Tabella ferie e permessi come la legge una foto (24.0.2): pezzi con le posizioni esatte.
  const cella = (t, x, y) => { const out = []; let xx = x; for (const w of t.split(' ')) { out.push({ t: w, x0: xx, x1: xx + w.length * 6, y0: y, y1: y + 10 }); xx += w.length * 6 + 4; } return out; };
  const TABELLA = ({ ferie = 'FERIE', rolLontano = false } = {}) => [
    ...cella('ANNO PREC.', 60, 100), ...cella('MATURATO', 140, 100), ...cella('GODUTO', 220, 100), ...cella('RESIDUO', 300, 100), ...cella('PROIEZIONE', 380, 100),
    ...(ferie ? cella(ferie, 0, 120) : []), ...cella('90,50', 140, 120), ...cella('30,00', 220, 120), ...cella('60,50', 300, 120), ...cella('75,00', 380, 120), ...cella('555,55', 900, 120),
    ...cella('PERMESSI', 0, 140),
    ...cella('R.O.L.', 0, 160), ...(rolLontano ? cella('1', 900, 160) : []),
    ...cella('EX FEST.', 0, 180), ...cella('12,40', 140, 189), ...cella('12,40', 300, 189), ...cella('15,20', 380, 189), // numeri mezza riga sotto l'etichetta
  ];

  test('24.0.2 · ferie ed ex festività dalla colonna RESIDUO; permessi e ROL vuoti restano vuoti', async ({ browser }) => {
    const { page } = await nuovoDispositivo(browser, { telefono: false });
    const leggi = async t => { const r = await page.evaluate(p => Buste.analizzaBusta(p), t); return [r.ferie, r.rol, r.exfest]; };
    expect(await leggi(TABELLA())).toEqual([60.5, null, 12.4]);
    // etichetta "FERIE" persa nella lettura: la prima riga sotto le intestazioni è quella delle ferie
    expect(await leggi(TABELLA({ ferie: 'I)' }))).toEqual([60.5, null, 12.4]);
    expect(await leggi(TABELLA({ ferie: null }))).toEqual([60.5, null, 12.4]);
    // un numero di un'altra tabella sulla riga del ROL non diventa un saldo
    expect(await leggi(TABELLA({ rolLontano: true }))).toEqual([60.5, null, 12.4]);
  });

  test('immagine: le linee sottili delle tabelle diventano bianche, il testo e i riquadri scuri pieni restano', async ({ browser }) => {
    const { page } = await nuovoDispositivo(browser, { telefono: false });
    const r = await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 1200; c.height = 800; const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, 1200, 800); g.fillStyle = '#000';
      g.fillRect(50, 100, 1100, 2);   // linea orizzontale
      g.fillRect(600, 100, 2, 600);   // linea verticale
      g.fillRect(50, 300, 500, 60);   // riquadro scuro pieno (intestazione)
      g.font = 'bold 30px Arial'; g.fillText('NETTO BUSTA', 700, 500); // barre di "TT" unite: non sono una linea
      const scuri = (x, y, w, h) => { const d = g.getImageData(x, y, w, h).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 128) n++; return n; };
      const prima = scuri(690, 460, 300, 60);
      Buste.senzaLinee(c);
      return { linea: scuri(50, 100, 1100, 2), colonna: scuri(600, 100, 2, 600), riquadro: scuri(50, 300, 500, 60), testo: [prima, scuri(690, 460, 300, 60)] };
    });
    expect(r.linea).toBe(0);
    expect(r.colonna).toBe(0);
    expect(r.riquadro).toBe(500 * 60);
    expect(r.testo[1]).toBe(r.testo[0]);
  });

  // Solo in locale, con i file di Tesseract 5.1.1 (vedi test/LEGGIMI.md): una busta finta disegnata con le linee della tabella.
  const TESS = path.join(__dirname, '.tesseract');
  const pacchetto = n => path.join(TESS, n, 'package');
  test('immagine finta con tabella: Tesseract legge netto, totali e contributi', async ({ browser }) => {
    const manca = ['tesseract.js-5.1.1', 'tesseract.js-core-5.1.1', 'tesseract.js-data-eng-1.0.0'].filter(n => !fs.existsSync(pacchetto(n)));
    test.skip(manca.length > 0, 'pacchetti di Tesseract non scaricati (vedi test/LEGGIMI.md): ' + manca.join(', '));
    test.setTimeout(240000);
    const { ctx, page } = await nuovoDispositivo(browser, { telefono: false });
    const TIPI = { '.js': 'text/javascript', '.wasm': 'application/wasm', '.gz': 'application/gzip' };
    await ctx.route('https://cdn.jsdelivr.net/npm/**', r => {
      const u = new URL(r.request().url()).pathname;
      const mappa = [[/^\/npm\/tesseract\.js@v?5\.1\.1\//, 'tesseract.js-5.1.1'], [/^\/npm\/tesseract\.js-core@v5\.1\.1\//, 'tesseract.js-core-5.1.1'], [/^\/npm\/@tesseract\.js-data\/eng\//, 'tesseract.js-data-eng-1.0.0']];
      const m = mappa.find(([re]) => re.test(u)); const f = m && path.join(pacchetto(m[1]), u.replace(m[0], ''));
      if (!f || !fs.existsSync(f)) return r.fulfill({ status: 404, body: 'non trovato' });
      r.fulfill({ status: 200, contentType: TIPI[path.extname(f)] || 'application/octet-stream', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(f) });
    });
    const r = await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 1400; c.height = 700; const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, 1400, 700); g.fillStyle = '#000'; g.font = '26px Arial';
      const riga = (y, celle) => celle.forEach(([t, x]) => g.fillText(t, x, y));
      riga(60, [['DATA TERMINE TD 15/03/2028', 40], ['DATA ASS. CONV. 01/04/2025', 700]]);
      riga(140, [['VOCE', 40], ['DESCRIZIONE', 160], ['COMPETENZE', 820], ['TRATTENUTE', 1100]]);
      riga(200, [['0001', 40], ['RETRIBUZIONE ORDINARIA', 160], ['1.512,40', 840]]);
      riga(250, [['CONTRIBUTI INPS', 160], ['140,22', 1120]]);
      riga(300, [['IRPEF NETTA', 160], ['137,68', 1120]]);
      riga(380, [['TOTALI', 160], ['1.512,40', 840], ['277,90', 1120]]);
      riga(470, [['NETTO BUSTA', 600], ['1. 234, 50', 840]]);
      riga(560, [['IMPONIBILE CONTR. MESE', 40], ['1.510,00', 420]]);
      // linee della tabella, come nelle buste vere
      [100, 160, 330, 400, 420, 500].forEach(y => g.fillRect(20, y, 1360, 2));
      [140, 800, 1080].forEach(x => g.fillRect(x, 100, 2, 300));
      [20, 1378].forEach(x => g.fillRect(x, 100, 2, 400));
      const blob = await new Promise(ok => c.toBlob(ok, 'image/png'));
      const p = await Buste.testoBusta(new File([blob], 'busta-finta.png', { type: 'image/png' }));
      return Buste.analizzaBusta(p);
    });
    expect([r.netto, r.lordo, r.trattenute, r.contribLav, r.imponibilePrev]).toEqual([1234.5, 1512.4, 277.9, 140.22, 1510]);
    expect(r.mese).toBeNull();
  });
});
