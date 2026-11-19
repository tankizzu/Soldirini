// Ore del lavoro a turni (tornata 29, punto 0): controllo di tutti i casi con dati inventati.
// stipcalc.js è senza interfaccia: lo carico direttamente in Node, senza browser.
// 24c.1: i 3 difetti trovati sono corretti con la regola R-TURNI-1 di 04 e le scelte D-110; sotto anche i casi P1-P16 di 04.
const path = require('path');
const { test, expect } = require('./helpers/prova');
require(path.join(__dirname, '..', 'soldirini', 'stipcalc.js'));
const C = globalThis.StipCalc;

const TIPI = [
  { id: 'M', nome: 'Mattina', cat: 'lavoro', da: '06:00', a: '14:00', pausa: '', ore: '' },
  { id: 'P', nome: 'Pomeriggio', cat: 'lavoro', da: '14:00', a: '22:00', pausa: '', ore: '' },
  { id: 'N', nome: 'Notte', cat: 'lavoro', da: '22:00', a: '06:00', pausa: '', ore: '' },
  { id: 'R', nome: 'Riposo', cat: 'riposo' },
  { id: 'F', nome: 'Ferie', cat: 'ferie', pausa: '', ore: '' },
  { id: 'Pe', nome: 'Permesso', cat: 'permesso', pausa: '', ore: '' },
  { id: 'Ma', nome: 'Malattia', cat: 'malattia', pausa: '', ore: '' },
  { id: 'X', nome: 'Rientro', cat: 'lavoro', aggiunta: true, da: '', a: '', pausa: '', ore: '' }];
const lavoro = (x = {}) => Object.assign({ modo: 'turni', paga: { tipo: 'oraria', importo: 10 },
  magg: { stra: '25', nott: '20', fest: '30', dom: '15' }, nott: { da: '22:00', a: '06:00' }, tipi: TIPI }, x);
let n = 0;
const turno = (data, tipo, x = {}) => Object.assign({ id: 't' + (n++), data, tipo }, x);
const mese = (lv, turni, ym) => C.calcolaMese(lv, turni, ym).T;
const ore = T => ({ lav: T.lav, ord: T.ord, stra: T.stra, nott: T.nott, fest: T.fest, dom: T.dom, pagate: T.pagate });

test.describe('ore del lavoro a turni: casi che oggi tornano', () => {
  test('pausa, "Orario diverso", turno con le sole ore, rientro nello stesso giorno, due turni scelti dalla foto', () => {
    expect(ore(mese(lavoro(), [turno('2026-11-02', 'M', { pausa: '30' })], '2026-11'))).toMatchObject({ lav: 7.5, nott: 0 });
    expect(mese(lavoro(), [turno('2026-11-02', null, { da: '09:00', a: '17:00' })], '2026-11').lav).toBe(8);
    const conOre = lavoro({ tipi: TIPI.concat([{ id: 'G', nome: 'Giornata', cat: 'lavoro', ore: '8' }]) });
    expect(mese(conOre, [turno('2026-11-02', 'G')], '2026-11').lav).toBe(8);
    expect(mese(lavoro(), [turno('2026-11-02', 'M'), turno('2026-11-02', 'X', { da: '14:00', a: '16:00' })], '2026-11').lav).toBe(10);
    // "📷 Turni da foto" con due turni nello stesso giorno: mattina e pomeriggio, 16 ore (voluto)
    expect(mese(lavoro(), [turno('2026-11-02', 'M'), turno('2026-11-02', 'P')], '2026-11').lav).toBe(16);
  });

  test('notte: le 8 ore contano tutte nel giorno di inizio, anche a cavallo di due mesi', () => {
    const t = [turno('2026-11-30', 'N')];
    expect(ore(mese(lavoro(), t, '2026-11'))).toMatchObject({ lav: 8, nott: 8 });
    expect(mese(lavoro(), t, '2026-12').lav).toBe(0);
  });

  test('straordinario con oreMese: oltre 168 ore nel mese; festivo lavorato con la sua maggiorazione', () => {
    const molti = []; for (let d = 1; d <= 26; d++) molti.push(turno(`2026-11-${String(d).padStart(2, '0')}`, 'M', { a: '16:00' })); // 26 giorni da 10 ore
    expect(ore(mese(lavoro({ oreMese: '168' }), molti, '2026-11'))).toMatchObject({ lav: 260, ord: 168, stra: 92 });
    expect(ore(mese(lavoro(), [turno('2026-12-08', 'M')], '2026-12'))).toMatchObject({ lav: 8, fest: 8 });
    expect(ore(mese(lavoro(), [turno('2026-11-01', 'M')], '2026-11'))).toMatchObject({ fest: 8, dom: 0 }); // domenica e Ognissanti: vale il festivo
  });

  test('paga mensile e a giornata: ferie e malattia sono pagate anche senza ore', () => {
    const F = [turno('2026-11-04', 'F'), turno('2026-11-05', 'Ma')];
    expect(C.calcolaMese(lavoro({ paga: { tipo: 'mensile', importo: 1680, divisore: 168 } }), F, '2026-11').lordo).toBe(1680);
    expect(C.calcolaMese(lavoro({ paga: { tipo: 'giornaliera', importo: 80 } }), F, '2026-11').lordo).toBe(160);
  });
});

test.describe('ore del lavoro a turni: i 3 difetti della tornata 29, corretti nella 24c.1 (R-TURNI-1 di 04, D-110)', () => {
  test('ferie e malattia senza ore scritte valgono le "Ore di una giornata" (Mattina + Notte + Ferie + Malattia)', () => {
    const T = mese(lavoro({ oreGiorno: '8' }), [turno('2026-11-02', 'M'), turno('2026-11-03', 'N'), turno('2026-11-04', 'F'), turno('2026-11-05', 'Ma')], '2026-11');
    expect(T).toMatchObject({ lav: 16, pagate: 16, ferieOre: 8, mal: 8, senzaOre: 0 });
  });

  test('ferie scritte "dalle 06:00 alle 14:00": contano 8 ore, anche senza il campo', () => {
    expect(mese(lavoro(), [turno('2026-11-04', 'F', { da: '06:00', a: '14:00' })], '2026-11').ferieOre).toBe(8);
  });

  test('ferie in ore: due giorni di ferie senza ore tolgono 2 giornate dal saldo', () => {
    const s = C.saldi(lavoro({ oreGiorno: '8', ferie: { unita: 'ore', anno: '160' } }), [turno('2026-11-04', 'F'), turno('2026-11-05', 'F')], {}, '2026-11');
    expect(s.ferie.saldo).toBe(144);
  });
});

// Casi P1-P16 di 04 (report tornata 29 §3), con P8 e P9 cambiati da D-110 punto 2. Novembre 2026: 21 giorni lun-ven non festivi.
test.describe('R-TURNI-1: casi P1-P16 di 04', () => {
  const quattro = () => [turno('2026-11-02', 'M'), turno('2026-11-03', 'N'), turno('2026-11-04', 'F'), turno('2026-11-05', 'Ma')];
  const atteso = { lav: 16, pagate: 16, ferieOre: 8, mal: 8 };
  test('P1 campo 8 · P2 campo vuoto e oreMese 168 (168 ÷ 21 = 8)', () => {
    const M1 = C.calcolaMese(lavoro({ oreGiorno: '8' }), quattro(), '2026-11');
    expect(M1.T).toMatchObject(atteso); expect(M1.E).toMatchObject({ base: 320, nott: 16 }); expect(M1.lordo).toBe(336);
    const M2 = C.calcolaMese(lavoro({ oreMese: '168' }), quattro(), '2026-11');
    expect(M2.T).toMatchObject(atteso); expect(M2.lordo).toBe(336);
  });
  test('P3 febbraio 2027: 20 giorni lun-ven → 8,40 ore · P4 niente: 0 ore e avviso', () => {
    expect(mese(lavoro({ oreMese: '168' }), [turno('2027-02-01', 'F')], '2027-02').ferieOre).toBe(8.4);
    expect(mese(lavoro(), [turno('2026-11-04', 'F')], '2026-11')).toMatchObject({ ferieOre: 0, senzaOre: 1 });
  });
  test('P5 "dalle–alle" vince sul campo · P6 ore del turno · P7 ore del tipo', () => {
    expect(mese(lavoro({ oreGiorno: '7' }), [turno('2026-11-04', 'F', { da: '06:00', a: '14:00' })], '2026-11').ferieOre).toBe(8);
    expect(mese(lavoro({ oreGiorno: '8' }), [turno('2026-11-04', 'F', { ore: '4' })], '2026-11').ferieOre).toBe(4);
    const tipi = TIPI.map(t => t.id === 'F' ? Object.assign({}, t, { ore: '7,5' }) : t);
    expect(mese(lavoro({ oreGiorno: '8', tipi }), [turno('2026-11-04', 'F')], '2026-11').ferieOre).toBe(7.5);
  });
  test('P8 e P9 (D-110 punto 2): un\'assenza senza ore annulla i turni di lavoro del giorno e vale la giornata intera', () => {
    const lv = lavoro({ oreGiorno: '8' });
    const P8 = C.calcolaMese(lv, [turno('2026-11-04', 'M', { pausa: '120' }), turno('2026-11-04', 'F')], '2026-11');
    expect(P8.T).toMatchObject({ lav: 0, ferieOre: 8, pagate: 8, giorniLav: 0, giorniPag: 1 });
    expect(P8.giorni[3].voci.find(v => v.cat === 'lavoro').annullato).toBe(true);
    expect(mese(lv, [turno('2026-11-04', 'M'), turno('2026-11-04', 'P'), turno('2026-11-04', 'F')], '2026-11')).toMatchObject({ lav: 0, nott: 0, ferieOre: 8 });
    // con le ore scritte resta come prima: lavoro e assenza parziale
    expect(mese(lv, [turno('2026-11-04', 'M'), turno('2026-11-04', 'Pe', { ore: '2' })], '2026-11')).toMatchObject({ lav: 8, perm: 2 });
    // il turno di notte del giorno prima resta nel suo giorno
    expect(mese(lv, [turno('2026-11-03', 'N'), turno('2026-11-04', 'F')], '2026-11')).toMatchObject({ lav: 8, nott: 8, ferieOre: 8 });
  });
  test('P10 saldo ferie in ore 160 → 144 · P11 saldo permessi 40 → 32', () => {
    const lv = lavoro({ oreGiorno: '8', ferie: { unita: 'ore', anno: '160' }, perm: { unita: 'ore', anno: '40' } });
    const s = C.saldi(lv, [turno('2026-11-04', 'F'), turno('2026-11-05', 'F'), turno('2026-11-06', 'Pe')], {}, '2026-11');
    expect(s.ferie.saldo).toBe(144); expect(s.rol.saldo).toBe(32);
  });
  test('P12 paga mensile con ferie e malattia: stipendio uguale · P13 assenza non pagata senza ore: −80 € · P14 a giornata', () => {
    const mens = { paga: { tipo: 'mensile', importo: 1680, divisore: 168 }, oreGiorno: '8' };
    const P12 = C.calcolaMese(lavoro(mens), [turno('2026-11-04', 'F'), turno('2026-11-05', 'Ma')], '2026-11');
    expect(P12.lordo).toBe(1680); expect(P12.T).toMatchObject({ ferieOre: 8, mal: 8 });
    const tipi = TIPI.concat([{ id: 'NR', nome: 'Assenza non pagata', cat: 'nonretr', pausa: '', ore: '' }]);
    const P13 = C.calcolaMese(lavoro(Object.assign({ tipi }, mens)), [turno('2026-11-04', 'NR')], '2026-11');
    expect(P13.T.nonretr).toBe(8); expect(P13.E.base).toBe(1600);
    expect(C.calcolaMese(lavoro({ paga: { tipo: 'giornaliera', importo: 80 }, oreGiorno: '8' }), [turno('2026-11-04', 'F'), turno('2026-11-05', 'Ma')], '2026-11').E.base).toBe(160);
  });
  test('P15 orario fisso: Permesso "08:00–10:00" → permesso 2, lavoro 6 · P16 orario fisso, Ferie senza ore → 8', () => {
    const fisso = { modo: 'fisso', dal: '2026-01-01', tipi: TIPI };
    fisso.settimana = {}; for (const d of [1, 2, 3, 4, 5]) fisso.settimana[d] = { da: '08:00', a: '17:00', pausa: '60' };
    const lv = lavoro(fisso);
    expect(mese(lv, [turno('2026-11-04', 'Pe', { da: '08:00', a: '10:00' })], '2026-11')).toMatchObject({ perm: 2 });
    const g = C.calcolaMese(lv, [turno('2026-11-04', 'Pe', { da: '08:00', a: '10:00' })], '2026-11').giorni[3];
    expect(g.min).toBe(360);
    const F = C.calcolaMese(lv, [turno('2026-11-04', 'F')], '2026-11');
    expect(F.T.ferieOre).toBe(8); expect(F.giorni[3].min).toBe(0);
    // l'orario fisso non usa le "Ore di una giornata" e un turno aggiunto resta (D-110 solo a turni)
    expect(mese(lavoro(Object.assign({ oreGiorno: '5' }, fisso)), [turno('2026-11-04', 'F')], '2026-11').ferieOre).toBe(8);
  });
});

// Casi P17-P28 di 04 (report tornata 30), con D-114: una giornata sola per lavoro e per giorno (la malattia prende la giornata);
// Ferie + notte che inizia lo stesso giorno → la notte si annulla tutta. Turni scritti direttamente nei dati (§2 di 04).
test.describe('D-110 e D-114: assenza e turni nello stesso giorno (P17-P28 di 04)', () => {
  const lv = (x = {}) => lavoro(Object.assign({ oreGiorno: '8' }, x));
  test('P17 notte del giorno prima resta · P18 Ferie + notte dello stesso giorno: la notte si annulla tutta', () => {
    const P17 = C.calcolaMese(lv(), [turno('2026-11-03', 'N'), turno('2026-11-04', 'F')], '2026-11');
    expect(P17.T).toMatchObject({ lav: 8, nott: 8, ferieOre: 8 }); expect(P17.E.base).toBe(160); expect(P17.lordo).toBe(176);
    const P18 = C.calcolaMese(lv(), [turno('2026-11-03', 'N'), turno('2026-11-03', 'F')], '2026-11');
    expect(P18.T).toMatchObject({ lav: 0, nott: 0, ferieOre: 8 }); expect(P18.lordo).toBe(80);
    expect(C.calcolaMese(lv(), [turno('2026-11-03', 'N'), turno('2026-11-03', 'F')], '2026-12').T.lav).toBe(0); // e niente a dicembre
  });
  test('P19 ferie con le ore nel tipo · P20 permesso con le ore scritte · P21 Riposo non annulla', () => {
    const tipi = TIPI.map(t => t.id === 'F' ? Object.assign({}, t, { ore: '7,5' }) : t);
    const P19 = C.calcolaMese(lv({ tipi }), [turno('2026-11-04', 'M'), turno('2026-11-04', 'F')], '2026-11');
    expect(P19.T).toMatchObject({ lav: 8, ferieOre: 7.5 }); expect(P19.E.base).toBe(155);
    const P20 = C.calcolaMese(lv(), [turno('2026-11-04', 'M'), turno('2026-11-04', 'Pe', { ore: '4' })], '2026-11');
    expect(P20.T).toMatchObject({ lav: 8, perm: 4 }); expect(P20.E.base).toBe(120);
    expect(C.calcolaMese(lv(), [turno('2026-11-04', 'M'), turno('2026-11-04', 'R')], '2026-11').E.base).toBe(80);
  });
  test('P22 domenica: Mattina + Malattia → niente maggiorazione · P23 la giornata annullata non entra nella soglia', () => {
    const P22 = C.calcolaMese(lv(), [turno('2026-11-08', 'M'), turno('2026-11-08', 'Ma')], '2026-11');
    expect(P22.T).toMatchObject({ lav: 0, dom: 0, mal: 8 }); expect(P22.lordo).toBe(80);
    const P23 = mese(lv({ oreMese: '16' }), [turno('2026-11-02', 'M'), turno('2026-11-03', 'M'), turno('2026-11-03', 'F'), turno('2026-11-04', 'M')], '2026-11');
    expect(P23).toMatchObject({ lav: 16, stra: 0, ferieOre: 8 });
  });
  test('P24 paga a giornata · P25 paga mensile con assenza non pagata · P26 saldo ferie in ore', () => {
    expect(C.calcolaMese(lv({ paga: { tipo: 'giornaliera', importo: 80 } }), [turno('2026-11-04', 'M'), turno('2026-11-04', 'F')], '2026-11').E.base).toBe(80);
    const tipi = TIPI.concat([{ id: 'NR', nome: 'Assenza non pagata', cat: 'nonretr', pausa: '', ore: '' }]);
    const P25 = C.calcolaMese(lv({ tipi, paga: { tipo: 'mensile', importo: 1680, divisore: 168 } }), [turno('2026-11-04', 'M'), turno('2026-11-04', 'NR')], '2026-11');
    expect(P25.T).toMatchObject({ lav: 0, nonretr: 8 }); expect(P25.E.base).toBe(1600);
    expect(C.saldi(lv({ ferie: { unita: 'ore', anno: '160' } }), [turno('2026-11-04', 'M'), turno('2026-11-04', 'F')], {}, '2026-11').ferie.saldo).toBe(152);
  });
  test('P27 Ferie + Malattia senza ore: una giornata sola, alla malattia (saldo ferie invariato) · P28 Mattina + Permesso 2 + Ferie → 2 + 6', () => {
    const P27 = C.calcolaMese(lv(), [turno('2026-11-04', 'F'), turno('2026-11-04', 'Ma')], '2026-11');
    expect(P27.T).toMatchObject({ lav: 0, mal: 8, ferieOre: 0, ferie: 0, pagate: 8, giorniPag: 1 }); expect(P27.lordo).toBe(80);
    expect(C.saldi(lv({ ferie: { unita: 'ore', anno: '160' } }), [turno('2026-11-04', 'F'), turno('2026-11-04', 'Ma')], {}, '2026-11').ferie.saldo).toBe(160);
    expect(C.saldi(lv({ ferie: { unita: 'giorni', anno: '26' } }), [turno('2026-11-04', 'F'), turno('2026-11-04', 'Ma')], {}, '2026-11').ferie.saldo).toBe(26);
    const P28 = C.calcolaMese(lv(), [turno('2026-11-04', 'M'), turno('2026-11-04', 'Pe', { ore: '2' }), turno('2026-11-04', 'F')], '2026-11');
    expect(P28.T).toMatchObject({ lav: 0, perm: 2, ferieOre: 6, pagate: 8 }); expect(P28.E.base).toBe(80);
    // orario fisso: niente di tutto questo (D-110 e D-114 solo a turni)
    const fisso = lavoro({ modo: 'fisso', dal: '2026-01-01', settimana: { 3: { da: '08:00', a: '16:00', pausa: '' } } });
    expect(mese(fisso, [turno('2026-11-04', 'F'), turno('2026-11-04', 'Ma')], '2026-11')).toMatchObject({ ferieOre: 8, mal: 8 });
  });
});

// Tornata 32 (04, tornata 31 §1a): P29, P30 e l'ordine della giornata con due assenze senza ore
test.describe('D-114: ordine della giornata con due assenze senza ore (P29-P30 di 04)', () => {
  const tipi = TIPI.concat([{ id: 'NR', nome: 'Assenza non pagata', cat: 'nonretr', pausa: '', ore: '' }, { id: 'AR', nome: 'Altra assenza pagata', cat: 'retribuita', pausa: '', ore: '' }]);
  const lv = (x = {}) => lavoro(Object.assign({ oreGiorno: '8', tipi }, x));
  test('P29 Permesso "10" + Ferie senza ore → permesso 10, ferie 0 (mai meno di 0) · P30 Ferie + Assenza non pagata → ferie 8, non pagate 0', () => {
    const P29 = C.calcolaMese(lv(), [turno('2026-11-04', 'Pe', { ore: '10' }), turno('2026-11-04', 'F')], '2026-11');
    expect(P29.T).toMatchObject({ perm: 10, ferieOre: 0, ferie: 0 }); expect(P29.lordo).toBe(100);
    expect(C.saldi(lv({ ferie: { unita: 'giorni', anno: '26' } }), [turno('2026-11-04', 'Pe', { ore: '10' }), turno('2026-11-04', 'F')], {}, '2026-11').ferie.saldo).toBe(26);
    for (const ordine of [['F', 'NR'], ['NR', 'F']]) { // l'ordine in cui sono scritte non conta
      const P30 = C.calcolaMese(lv(), ordine.map(id => turno('2026-11-04', id)), '2026-11');
      expect(P30.T).toMatchObject({ ferieOre: 8, ferie: 1, nonretr: 0 }); expect(P30.lordo).toBe(80);
    }
  });
  test('ordine malattia → ferie → permesso → altra assenza pagata → assenza non pagata', () => {
    const giornata = ids => C.calcolaMese(lv(), ids.map(id => turno('2026-11-04', id)), '2026-11').T;
    expect(giornata(['NR', 'AR', 'Pe', 'F', 'Ma'])).toMatchObject({ mal: 8, ferieOre: 0, perm: 0, nonretr: 0, pagate: 8 });
    expect(giornata(['NR', 'AR', 'Pe', 'F'])).toMatchObject({ ferieOre: 8, perm: 0, nonretr: 0, pagate: 8 });
    expect(giornata(['NR', 'AR', 'Pe'])).toMatchObject({ perm: 8, nonretr: 0, pagate: 8 });
    expect(giornata(['NR', 'AR'])).toMatchObject({ nonretr: 0, pagate: 8 });
  });
});

// Tornata 32: casi F1-F12 e T1-T10 del libro dei casi di 04 (consegne/04-libro-casi-ore-paga.md), dati inventati copiati dal libro
test.describe('libro dei casi di 04 · ore e paga (F1-F12, T1-T10)', () => {
  const G9 = { da: '09:00', a: '18:00', pausa: 60 };
  const LF = (x = {}) => Object.assign({ modo: 'fisso', dal: '2026-01-01', locali: '', paga: { tipo: 'oraria', importo: 10 },
    settimana: { 1: G9, 2: G9, 3: G9, 4: G9, 5: G9 }, magg: { stra: '25', nott: '20', fest: '50', dom: '30' }, nott: { da: '22:00', a: '06:00' },
    tipi: [{ id: 'st', nome: 'Straordinario', cat: 'lavoro', aggiunta: true }, { id: 'fe', nome: 'Ferie', cat: 'ferie' }, { id: 'pe', nome: 'Permesso', cat: 'permesso' },
      { id: 'nr', nome: 'Assenza non pagata', cat: 'nonretr' }] }, x);
  const LT = (x = {}) => Object.assign({ modo: 'turni', locali: '', oreMese: 160, paga: { tipo: 'oraria', importo: 10 },
    magg: { stra: '25', nott: '20', fest: '50', dom: '30' }, nott: { da: '22:00', a: '06:00' },
    tipi: [{ id: 'M', cat: 'lavoro', da: '06:00', a: '14:00' }, { id: 'P', cat: 'lavoro', da: '14:00', a: '22:00' }, { id: 'N', cat: 'lavoro', da: '22:00', a: '06:00' },
      { id: 'Mp', cat: 'lavoro', da: '06:00', a: '14:00', pausa: 30 }, { id: 'V', cat: 'variabile' }] }, x);
  const t1 = (data, tipo, x = {}) => [Object.assign({ id: 1, data, tipo }, x)];
  const feriali = [2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 16, 17, 18, 19, 20, 23, 24, 25, 26, 27, 30];
  const tutteM = giorni => giorni.map((g, i) => ({ id: i + 1, data: '2026-11-' + String(g).padStart(2, '0'), tipo: 'M' }));

  test('F1 mese pieno, paga oraria · F2 paga mensile · F3 straordinario dopo l\'orario', () => {
    const F1 = C.calcolaMese(LF(), [], '2026-11');
    expect(F1.T).toMatchObject({ lav: 168, ord: 168, stra: 0, giorniLav: 21 }); expect(F1.E.base).toBe(1680); expect(F1.lordo).toBe(1680);
    const F2 = C.calcolaMese(LF({ paga: { tipo: 'mensile', importo: 1680, divisore: 168 } }), [], '2026-11');
    expect(F2.T.lav).toBe(168); expect(F2.E.base).toBe(1680); expect(F2.lordo).toBe(1680);
    const F3 = C.calcolaMese(LF(), t1('2026-11-03', 'st', { da: '18:00', a: '20:00' }), '2026-11');
    expect(F3.T).toMatchObject({ lav: 170, ord: 168, stra: 2 }); expect(F3.E.stra).toBe(25); expect(F3.lordo).toBe(1705);
  });
  test('F4 straordinario di notte · F5 domenica in aggiunta · F6 dicembre con due feste · F7 festa lavorata', () => {
    const F4 = C.calcolaMese(LF(), t1('2026-11-03', 'st', { da: '22:00', a: '23:00' }), '2026-11');
    expect(F4.T).toMatchObject({ stra: 1, nott: 1 }); expect(F4.E).toMatchObject({ stra: 12.5, nott: 2 }); expect(F4.lordo).toBe(1694.5);
    const F5 = C.calcolaMese(LF(), t1('2026-11-08', 'st', { da: '09:00', a: '13:00' }), '2026-11');
    expect(F5.T).toMatchObject({ lav: 172, stra: 4, dom: 4, giorniLav: 22 }); expect(F5.E).toMatchObject({ stra: 50, dom: 12 }); expect(F5.lordo).toBe(1742);
    const F6 = C.calcolaMese(LF(), [], '2026-12'); expect(F6.T.lav).toBe(168); expect(F6.lordo).toBe(1680); // ⚠ R10: festa non lavorata a ore non pagata (da riproporre, D-110 punto 4)
    expect(C.calcolaMese(LF({ paga: { tipo: 'mensile', importo: 1680, divisore: 168 } }), [], '2026-12').lordo).toBe(1680); // F6m
    const F7 = C.calcolaMese(LF(), t1('2026-12-08', 'st', { da: '09:00', a: '18:00', pausa: 60 }), '2026-12');
    expect(F7.T).toMatchObject({ lav: 176, stra: 8, fest: 8 }); expect(F7.E).toMatchObject({ stra: 100, fest: 40 }); expect(F7.lordo).toBe(1820);
  });
  test('F8 un giorno di ferie senza ore · F9 permesso di 2 ore · F11 assenza non pagata, paga mensile · F12 paga a giornata', () => {
    const F8 = C.calcolaMese(LF(), t1('2026-11-04', 'fe'), '2026-11');
    expect(F8.T).toMatchObject({ lav: 160, pagate: 8, ferie: 1, ferieOre: 8, giorniLav: 20, giorniPag: 1 }); expect(F8.lordo).toBe(1680);
    const F9 = C.calcolaMese(LF(), t1('2026-11-04', 'pe', { ore: 2 }), '2026-11');
    expect(F9.T).toMatchObject({ lav: 166, perm: 2, pagate: 2 }); expect(F9.lordo).toBe(1680);
    const F11 = C.calcolaMese(LF({ paga: { tipo: 'mensile', importo: 1680, divisore: 168 } }), t1('2026-11-04', 'nr'), '2026-11');
    expect(F11.T).toMatchObject({ nonretr: 8, lav: 160 }); expect(F11.E.base).toBe(1600); expect(F11.lordo).toBe(1600);
    const gio = LF({ paga: { tipo: 'giornaliera', importo: 80, divisore: 8 } });
    expect(C.calcolaMese(gio, [], '2026-11').lordo).toBe(1680); // F12a
    expect(C.calcolaMese(gio, t1('2026-11-04', 'fe'), '2026-11').lordo).toBe(1680); // F12b
  });
  test('F10 ferie "dalle 09:00 alle 18:00" senza pausa: comportamento della 24c.1, in attesa della decisione dell\'utente (domanda 20)', () => {
    // non cambiato: oggi vale 9 ore (punto 2 di R-TURNI-1). Se l'utente sceglie la A di 04, l'attesa diventa 8 ore e 1680
    const F10 = C.calcolaMese(LF(), t1('2026-11-04', 'fe', { da: '09:00', a: '18:00' }), '2026-11');
    expect(F10.T).toMatchObject({ pagate: 9, ferieOre: 9 }); expect(F10.lordo).toBe(1690);
  });
  test('T1 sotto la soglia · T2 oltre la soglia · T3 una notte · T4 notte e domenica (giorno di inizio)', () => {
    const T1 = C.calcolaMese(LT(), tutteM(feriali.filter(g => g !== 27 && g !== 30)), '2026-11');
    expect(T1.T).toMatchObject({ lav: 152, stra: 0 }); expect(T1.lordo).toBe(1520);
    const T2 = C.calcolaMese(LT(), tutteM(feriali), '2026-11');
    expect(T2.T).toMatchObject({ lav: 168, ord: 160, stra: 8 }); expect(T2.E).toMatchObject({ base: 1600, stra: 100 }); expect(T2.lordo).toBe(1700);
    const T3 = C.calcolaMese(LT(), t1('2026-11-03', 'N'), '2026-11');
    expect(T3.T).toMatchObject({ lav: 8, nott: 8 }); expect(T3.E.nott).toBe(16); expect(T3.lordo).toBe(96);
    const T4a = C.calcolaMese(LT(), t1('2026-11-07', 'N'), '2026-11'); expect(T4a.T.dom).toBe(0); expect(T4a.lordo).toBe(96);
    const T4b = C.calcolaMese(LT(), t1('2026-11-08', 'N'), '2026-11'); expect(T4b.T.dom).toBe(8); expect(T4b.E.dom).toBe(24); expect(T4b.lordo).toBe(120);
  });
  test('T5 pomeriggio in una festa · T6 notte a cavallo dei mesi · T7 straordinario di notte · T8 senza oreMese · T9 pausa nel tipo · T10 ore scritte', () => {
    const T5 = C.calcolaMese(LT(), t1('2026-12-08', 'P'), '2026-12'); expect(T5.T).toMatchObject({ fest: 8, nott: 0 }); expect(T5.lordo).toBe(120);
    const T6 = t1('2026-11-30', 'N');
    const nov = C.calcolaMese(LT(), T6, '2026-11'); expect(nov.T).toMatchObject({ lav: 8, nott: 8 }); expect(nov.lordo).toBe(96);
    const dic = C.calcolaMese(LT(), T6, '2026-12'); expect(dic.T.lav).toBe(0); expect(dic.lordo).toBe(0);
    const T7 = C.calcolaMese(LT({ oreMese: 16 }), [{ id: 1, data: '2026-11-02', tipo: 'M' }, { id: 2, data: '2026-11-03', tipo: 'M' }, { id: 3, data: '2026-11-04', tipo: 'N' }], '2026-11');
    expect(T7.T).toMatchObject({ lav: 24, ord: 16, stra: 8, nott: 8 }); expect(T7.lordo).toBe(276);
    const T8 = C.calcolaMese(LT({ oreMese: null }), tutteM(feriali.concat([7])), '2026-11'); expect(T8.T).toMatchObject({ lav: 176, stra: 0 }); expect(T8.lordo).toBe(1760);
    const T9 = C.calcolaMese(LT(), t1('2026-11-03', 'Mp'), '2026-11'); expect(T9.T.lav).toBe(7.5); expect(T9.lordo).toBe(75);
    const T10 = C.calcolaMese(LT(), t1('2026-11-03', 'V', { ore: 5 }), '2026-11'); expect(T10.T).toMatchObject({ lav: 5, variab: 5 }); expect(T10.lordo).toBe(50);
  });
});
