// v22 · Pensione: tutti i casi di prova dei report 04 (15/11/2026) applicati al file dell'app soldirini/pencalc.js.
// Casi: T-P1…T-P9 e T-P7b, T-Q1…T-Q8, T-F1…T-F4, T-C1…T-C6 (contributi), T-K1…T-K11 e T-C1…T-C4 (cedolino).
// Numeri inventati. Il file si carica in Node così com'è (è lo stesso che usa il telefono).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { SITO } = require('./helpers/google-finto');

const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(SITO, 'pencalc.js'), 'utf8'), ctx);
const P = ctx.window.PenCalc;
const N = (R, giorni) => { const x = P.irpefNetta(R, 'pensione', giorni, 2026); return [x.lorda, x.detr, x.netta]; };

test.describe('pensionato: dal lordo al netto (P-1…P-5)', () => {
  test('T-P1 reddito 8.000 €, anno intero', () => expect(N(8000)).toEqual([1840, 1955, 0]));
  test('T-P2 1.000 € al mese → 13.000 €', () => {
    expect(N(13000)).toEqual([2990, 1665.38, 1324.62]);
    const S = P.stimaAnno({ lordoMese: '1000', dal: '2020-01' }, 2026);
    expect([S.reddito, S.irpef.netta, S.netto]).toEqual([13000, 1324.62, 11675.38]);
    expect(Math.round(S.nettoMese)).toBe(898); // esempio del mockup di 02
  });
  test('T-P3 27.000 € (con i 50 € in più)', () => expect(N(27000)).toEqual([6210, 814.36, 5395.64]));
  test('T-P4 28.000 € (confine)', () => expect(N(28000)).toEqual([6440, 750, 5690]));
  test('T-P5 40.000 €', () => expect(N(40000)).toEqual([10400, 318.18, 10081.82]));
  test('T-P6 60.000 € (oltre 50.000)', () => expect(N(60000)).toEqual([18000, 0, 18000]));
  test('T-P7 6.500 €, pensione dal 1° luglio (184 giorni)', () => {
    expect(N(6500, 184)).toEqual([1495, 985.53, 509.47]);
    expect(P.periodo({ dal: '2026-07' }, 2026).giorni).toBe(184);
  });
  test('T-P7b 3.000 €, 90 giorni: il minimo di 713 € vale dopo la proporzione', () => expect(N(3000, 90)).toEqual([690, 713, 0]));
  test('T-P8 addizionale regionale 1,23% su 13.000 €', () => {
    const A = P.addizionali(13000, { addReg: '1,23' });
    expect([A.regionale, A.rataReg]).toEqual([159.9, 14.54]);
  });
  test('T-P9 comunale 0,8% con soglia 12.000 e reddito 11.500 → 0 €', () => {
    expect(P.addizionali(11500, { addCom: '0.8', sogliaCom: '12000' }).comunale).toBe(0);
    expect(P.addizionali(13000, { addCom: '0.8', sogliaCom: '12000' }).comunale).toBe(104);
  });
  test('addizionali vuote: "senza addizionali" (D-033)', () => {
    const A = P.addizionali(13000, {}); expect([A.regionale, A.comunale, A.indicate]).toEqual([0, 0, false]);
  });
  test('anno del pensionamento con anche uno stipendio: una sola detrazione e "stima prudente" (D-039)', () => {
    const p = { lordoMese: '1000', dal: '2026-07', detrazione: 'pensione' };
    expect(P.stimaAnno(p, 2026).prudente).toBe(true);
    expect(P.stimaAnno({ ...p, detrazione: 'lavoro' }, 2026).irpef.detr).toBe(0);
    expect(P.stimaAnno({ lordoMese: '1000', dal: '2020-01' }, 2026).prudente).toBe(false);
  });
  test('anno senza tabella: si usano le regole 2026 e lo si dice', () => {
    expect(P.valori(2027).regole).toBe(2026);
    expect(P.valori(2026).regole).toBe(2026);
  });
});

test.describe('quattordicesima (P-7): solo stima', () => {
  const Q = o => P.quattordicesima({ anno: 2026, annoNascita: 1956, tipo: 'dipendente', ...o });
  test('T-Q1 70 anni, dipendente 30 anni, reddito 11.000 → 655 € a luglio', () => {
    expect(Q({ anniContributi: 30, reddito: 11000 })).toMatchObject({ importo: 655, mese: 7 });
  });
  // Il report 04 indicava 386,08 € (12.586,08 − 12.200). La tabella INPS "Somma aggiuntiva anno 2026"
  // (pagina INPS del cedolino di luglio 2026) dice che la fascia intermedia per chi ha più di 25 anni
  // finisce a 12.082,07 €: oltre, fino a 15.908,10 €, spetta l'importo della seconda fascia, 504 €.
  // Confermato da 04 il 16/11/2026 (report "04-fisco-conferme-v22-2026-11-16.md"): T-Q2 = 504 €.
  test('T-Q2 come Q1, reddito 12.200 → 504 € (corretto sulla tabella INPS)', () => {
    expect(Q({ anniContributi: 30, reddito: 12200 }).importo).toBe(504);
  });
  test('T-Q3 dipendente 20 anni, reddito 14.000 → 420 €', () => expect(Q({ anniContributi: 20, reddito: 14000 }).importo).toBe(420));
  test('T-Q4 dipendente 20 anni, reddito 16.000 → 328,10 €', () => expect(Q({ anniContributi: 20, reddito: 16000 }).importo).toBe(328.1));
  test('T-Q5 dipendente 20 anni, reddito 17.000 → 0 €', () => expect(Q({ anniContributi: 20, reddito: 17000 }).importo).toBe(0));
  test('T-Q6 autonomo 16 anni, reddito 11.000 → 437 €', () => expect(Q({ anniContributi: 16, tipo: 'autonomo', reddito: 11000 }).importo).toBe(437));
  test('T-Q7 64 anni compiuti a maggio 2026 → 8/12 di 655 €, a dicembre', () => {
    expect(Q({ annoNascita: 1962, meseCompleanno: 5, anniContributi: 30, reddito: 11000 })).toMatchObject({ importo: 436.67, ridotta: true, mese: 12 });
    // senza il mese di nascita l'app non può calcolare i dodicesimi
    expect(Q({ annoNascita: 1962, anniContributi: 30, reddito: 11000 })).toMatchObject({ importo: null, ridotta: true });
  });
  test('T-Q8 nato nel 1963 → 0 €', () => expect(Q({ annoNascita: 1963, anniContributi: 30, reddito: 11000 }).importo).toBe(0));
  test('pensione iniziata a luglio: in dodicesimi, a dicembre', () => {
    expect(Q({ anniContributi: 30, reddito: 6000, dal: '2026-07' })).toMatchObject({ importo: 327.5, mese: 12 });
  });
});

test.describe('fondo pensione (F-1…F-4)', () => {
  test('T-F1 propri 1.200 + datore 600 + TFR 1.800, reddito 30.000', () => {
    expect(P.fondo({ anno: 2026, propri: 1200, datore: 600, tfr: 1800, reddito: 30000 })).toMatchObject({ deducibile: 1800, oltre: 0, risparmio: 594, tfr: 1800 });
  });
  test('T-F2 propri 5.000 + datore 800 → deducibile 5.300, non deducibile 500', () => {
    expect(P.fondo({ anno: 2026, propri: 5000, datore: 800 })).toMatchObject({ deducibile: 5300, oltre: 500, risparmio: null });
  });
  test('T-F3 deduzione 2.000, reddito 20.000 → 460 €', () => expect(P.fondo({ anno: 2026, propri: 2000, reddito: 20000 }).risparmio).toBe(460));
  test('T-F4 stessi versamenti di F2 nel 2025 → 5.164,57', () => expect(P.fondo({ anno: 2025, propri: 5000, datore: 800 }).deducibile).toBe(5164.57));
});

test.describe('contributi dalle buste paga (C-1…C-4)', () => {
  const buste = (n, imp, con) => Array.from({ length: n }, (_, i) => ({ mese: `2026-${String(i + 1).padStart(2, '0')}`, imponibilePrev: imp, contribLav: con }));
  test('T-C1 12 buste: imponibile 2.500, contributi 229,75', () => {
    expect(P.contributiAnno(buste(12, '2500', '229,75'), 2026)).toMatchObject({ contributi: 2757, imponibile: 30000, settimane: 52, buste: 12, mancano: 0 });
  });
  test('T-C2 imponibile annuo 6.000, 52 settimane → 24 settimane stimate', () => {
    expect(P.contributiAnno(buste(12, '500', '45.95'), 2026).settimane).toBe(24);
  });
  test('T-C3 imponibile 2.500, contributi letti 400 → avviso (16%)', () => {
    const c = P.controlloContributi('2500', '400', 2026);
    expect(c.percentuale).toBe(16); expect(c.testo).toContain('Sembra alto (16%');
    expect(P.controlloContributi('2500', '229.75', 2026)).toBeNull();
    expect(P.controlloContributi('2500', '146', 2026)).toBeNull(); // apprendista, 5,84%
  });
  test('T-C4 imponibile annuo 60.000 → contributi attesi circa 5.551,76, nessun avviso se il dato è vicino', () => {
    expect(P.contributiAttesi(60000, 2026)).toBe(5551.76);
    expect(P.controlloContributi('60000', '5551.76', 2026)).toBeNull();
  });
  test('T-C5 11 buste: "mancano 1 busta", totale parziale', () => {
    expect(P.contributiAnno(buste(11, '2500', '229.75'), 2026)).toMatchObject({ buste: 11, mancano: 1, contributi: 2527.25 });
  });
  // T-C6 (lordo senza imponibile previdenziale) è provato sulla lettura vera delle buste in pensione-buste.spec.js
});

test.describe('cedolino della pensione: controlli K-1…K-8', () => {
  const base = { mese: '2026-06', pensioneLorda: '1450', crediti: [], irpef: '195', addReg: '22', addComSaldo: '8.5', netto: '1224.50' };
  const K = (c, o) => P.controlliCedolino(c, o).map(x => x.k);
  test('T-K1 numeri giusti → nessun avviso', () => expect(K(base)).toEqual([]));
  test('T-K2 netto letto 1.230 → avviso, differenza +5,50', () => {
    const r = P.controlliCedolino({ ...base, netto: '1230' });
    expect(r.map(x => x.k)).toEqual(['K-1']); expect(r[0].differenza).toBe(5.5);
  });
  const credito = { ...base, mese: '2026-05', crediti: [{ tipo: 'rimborso', descr: 'Conguaglio a credito IRPEF', importo: '120' }], lordoPagamento: '1570' };
  test('T-K3 pensione 1.450 + conguaglio a credito 120 = lordo 1.570 → ok', () => {
    expect(K({ ...credito, irpef: '', addReg: '', addComSaldo: '', netto: '' })).toEqual([]);
    expect(K({ ...credito, lordoPagamento: '1580', irpef: '', addReg: '', addComSaldo: '', netto: '' })).toEqual(['K-2']);
  });
  test('T-K4 come T-K3, trattenute 225,50, netto 1.344,50 → ok', () => expect(K({ ...credito, netto: '1344.50' })).toEqual([]));
  test('T-K5 lordo 1.450, netto 1.540 → errore', () => {
    const r = P.controlliCedolino({ mese: '2026-06', pensioneLorda: '1450', netto: '1540' });
    expect(r.map(x => [x.k, x.tipo])).toEqual([['K-3', 'errore']]);
  });
  const dic = { mese: '2026-12', pensioneLorda: '1450', crediti: [{ tipo: '13', descr: 'Tredicesima', importo: '1450' }], lordoPagamento: '2900', irpef: '600', netto: '2300' };
  test('T-K6 dicembre con tredicesima, niente addizionali → ok', () => expect(K(dic)).toEqual([]));
  test('T-K7 dicembre con addizionale regionale 22 → avviso "voce insolita"', () => {
    const r = P.controlliCedolino({ ...dic, addReg: '22', netto: '2278' });
    expect(r.map(x => x.k)).toEqual(['K-4']); expect(r[0].testo).toBe('Voce insolita per dicembre: di solito a dicembre non c’è.');
  });
  test('T-K8 febbraio con acconto comunale 10 → avviso', () => {
    expect(K({ mese: '2026-02', pensioneLorda: '1450', addComAcconto: '10', netto: '1440' })).toEqual(['K-4']);
  });
  test('T-K9 quattordicesima 655 a maggio → avviso', () => {
    expect(K({ mese: '2026-05', pensioneLorda: '1450', crediti: [{ tipo: '14', importo: '655' }], netto: '2105' })).toEqual(['K-5']);
    expect(K({ mese: '2026-07', pensioneLorda: '1450', crediti: [{ tipo: '14', importo: '655' }], netto: '2105' })).toEqual([]);
  });
  test('T-K10 gennaio: pensione lorda da 1.450 a 1.470 → solo nota "rivalutazione"', () => {
    const r = P.controlliCedolino({ mese: '2026-01', pensioneLorda: '1470', netto: '1250' }, { precedente: { mese: '2025-12', pensioneLorda: '1450' } });
    expect(r.map(x => [x.k, x.tipo, x.testo])).toEqual([['K-7', 'nota', 'A gennaio la pensione viene rivalutata.']]);
    expect(P.controlliCedolino({ mese: '2026-04', pensioneLorda: '1470', netto: '1250' }, { precedente: { pensioneLorda: '1450' } })[0].testo).toMatch(/^È diversa dal mese prima \(1\.?450,00 €\)\.$/); // il punto delle migliaia dipende dai dati della lingua di Node
  });
  test('T-K11 secondo cedolino di ottobre → domanda "sostituire?"', () => {
    const r = P.controlliCedolino({ mese: '2026-10', pensioneLorda: '1450', netto: '1250' }, { giaPresente: true });
    expect(r.map(x => [x.k, x.tipo, x.testo])).toEqual([['K-8', 'domanda', 'Hai già il cedolino di ottobre. Lo sostituisco con questo?']]);
  });
  test('tredicesima fuori da dicembre → avviso K-6', () => {
    expect(K({ mese: '2026-11', pensioneLorda: '1450', crediti: [{ tipo: '13', importo: '1450' }], netto: '2900' })).toEqual(['K-6']);
  });
});

test.describe('cedolino: confronto con la stima (04 §3)', () => {
  test('T-C1 luglio con quattordicesima e contributo associativo → confrontabile 1.224,50', () => {
    const c = { mese: '2026-07', pensioneLorda: '1450', crediti: [{ tipo: '14', importo: '655' }], irpef: '195', addReg: '22', addComSaldo: '8.5', altreTrattenute: '12', netto: '1867.50' };
    expect(P.nettoConfrontabile(c)).toBe(1224.5);
    expect(P.controlliCedolino(c)).toEqual([]);
  });
  // netti mensili in centesimi interi che sommano esattamente al totale dell'anno
  const anno = tot => { const c = Math.round(tot * 100), base = Math.floor(c / 12);
    return Array.from({ length: 12 }, (_, i) => ({ mese: `2026-${String(i + 1).padStart(2, '0')}`, pensioneLorda: '1000', netto: String((base + (i < c - base * 12 ? 1 : 0)) / 100) })); };
  const stima = P.stimaAnno({ lordoMese: '1000', dal: '2020-01' }, 2026).netto;
  test('T-C2 somma reale 11.600 contro stima 11.675,38 → −75,38 € (−0,6%), nessun avviso', () => {
    expect(stima).toBe(11675.38);
    expect(P.confrontoAnno(anno(11600), stima, 2026)).toMatchObject({ completo: true, differenza: -75.38, percentuale: -0.65, avviso: false });
  });
  test('T-C3 somma reale 11.400 → −275,38 € (oltre 100 €) → avviso', () => {
    expect(P.confrontoAnno(anno(11400), stima, 2026)).toMatchObject({ differenza: -275.38, avviso: true });
  });
  test('T-C4 9 cedolini → "mancano 3 mesi", nessun confronto annuo', () => {
    const r = P.confrontoAnno(anno(11600).slice(0, 9), stima, 2026);
    expect(r.completo).toBe(false); expect(r.mancano).toEqual(['2026-10', '2026-11', '2026-12']); expect(r.differenza).toBeUndefined();
  });
});

test.describe('andamento mese per mese (solo grafico)', () => {
  test('dicembre con tredicesima e senza addizionali; rate da gennaio e da marzo', () => {
    const p = { lordoMese: '1000', dal: '2020-01', addReg: '1.23' };
    const g = P.stimaMese(p, '2026-01'), d = P.stimaMese(p, '2026-12');
    expect(d).toBeCloseTo(2 * P.stimaAnno(p, 2026).nettoMese, 2);
    expect(g).toBeCloseTo(P.stimaAnno(p, 2026).nettoMese - 14.54, 2);
    expect(P.stimaMese({ lordoMese: '1000', dal: '2026-07' }, '2026-03')).toBeNull();
  });
});

// v22c: correzioni di 04 (report "04-fisco-conferme-v22-2026-11-16.md")
test.describe('v22c · conferme di 04', () => {
  test('addizionali con IRPEF netta zero: regionale e comunale stimate = 0', () => {
    // 615 € × 13 = 7.995 €: IRPEF lorda 1.838,85, detrazione 1.955 → IRPEF netta 0
    const S = P.stimaAnno({ lordoMese: '615', dal: '2020-01', addReg: '1,23', addCom: '0,8' }, 2026);
    expect(S.irpef.netta).toBe(0);
    expect([S.add.regionale, S.add.comunale, S.add.esenti]).toEqual([0, 0, true]);
    expect(S.netto).toBe(7995);
    expect(P.addizionali(8000, { addReg: '1,23' }, 0).regionale).toBe(0);
  });
  test('addizionali con IRPEF netta di pochi euro: sull\'intero reddito, con la soglia di esenzione del Comune', () => {
    const I = P.irpefNetta(8700, 'pensione', null, 2026);
    expect(I.netta).toBe(58.87);
    const A = P.addizionali(8700, { addReg: '1,23', addCom: '0,8', sogliaCom: '8000' }, I.netta);
    expect([A.regionale, A.comunale]).toEqual([107.01, 69.6]); // 1,23% e 0,8% di 8.700 €, non dei 58,87 €
    expect(P.addizionali(8700, { addCom: '0,8', sogliaCom: '9000' }, I.netta).comunale).toBe(0); // sotto la soglia del Comune
  });
  test('acconto comunale: 30% dell\'addizionale dell\'anno prima, in 9 rate da marzo, segnato "stima"', () => {
    const p = { lordoMese: '1000', dal: '2020-01', addCom: '0,8' };
    expect(P.accontoComunale(p, 2026)).toEqual({ importo: 31.2, rata: 3.47, stima: true }); // 30% di 104 € (0,8% di 13.000 €)
    expect(P.stimaAnno(p, 2026).acconto.importo).toBe(31.2);
    const N = P.stimaAnno(p, 2026).nettoMese;
    expect(P.stimaMese(p, '2026-02')).toBeCloseTo(N - 9.45, 2);        // febbraio: solo il saldo comunale
    expect(P.stimaMese(p, '2026-03')).toBeCloseTo(N - 9.45 - 3.47, 2); // da marzo anche l'acconto
  });
  test('acconto comunale zero se l\'anno prima l\'addizionale era zero (niente pensione o IRPEF zero) o non c\'è aliquota comunale', () => {
    expect(P.accontoComunale({ lordoMese: '1000', dal: '2026-01', addCom: '0,8' }, 2026).importo).toBe(0); // in pensione da quest'anno
    expect(P.accontoComunale({ lordoMese: '600', dal: '2020-01', addCom: '0,8' }, 2026).importo).toBe(0);   // IRPEF zero l'anno prima
    expect(P.accontoComunale({ lordoMese: '1000', dal: '2020-01', addReg: '1,23' }, 2026)).toEqual({ importo: 0, rata: 0, stima: false });
  });
  test('T-Q2b dipendente, 30 anni, reddito 12.000 € → 586,08 € (salvaguardia nella prima fascia)', () => {
    expect(P.quattordicesima({ anno: 2026, annoNascita: 1956, tipo: 'dipendente', anniContributi: 30, reddito: 12000 }).importo).toBe(586.08);
  });
});
