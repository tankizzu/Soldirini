// Calcoli: casi di prova T1–T22 del report 04 (Fisco & Calcoli, 13/11/2026), applicati alle funzioni dell'app.
// T21 (D-009, stipendio contato quando entra) non è ancora nel codice: è segnato come "da fare".
// Tutti i dati sono inventati.
const { test, expect } = require('./helpers/prova');
const { nuovoDispositivo } = require('./helpers/app');

let page;
test.beforeAll(async ({ browser }) => { ({ page } = await nuovoDispositivo(browser, { telefono: false })); });

// Prepara nel telefono finto dei dati vuoti e un aiuto per creare progetti e compensi.
async function conDati(fn, arg) {
  return page.evaluate(([src, a]) => {
    DB.data = emptyData(); DB.meta.seq = (DB.meta.seq || 0) + 1;
    const H = {
      progetto(nome, cat = 'occasionale', extra = {}) {
        const p = nuovoProgetto(); p.nome = nome; p.ore.attivo = true; p.ore.categoria = cat; Object.assign(p.ore, extra); D().progetti[p.id] = p; return p;
      },
      compenso(p, data, campi) {
        const id = uid(); D().eventi[id] = Object.assign({ id, pid: p.id, data, tipo: 'altro', titolo: '', ore: true, fasce: [], rimborso: false, spese: [], created: Date.now(), updatedAt: Date.now() }, campi);
        DB.meta.seq++; return D().eventi[id];
      }
    };
    return (0, eval)('(' + src + ')')(H, a);
  }, [fn.toString(), arg]);
}

test.describe('ritenuta e compensi', () => {
  test('T1 ritenuta occasionale 20%', async () => {
    const s = await conDati(H => { const p = H.progetto('Occasionale'); return soldiOre(H.compenso(p, '2026-03-10', { fisso: '1000' })); });
    expect([s.lordo, s.rit, s.netto]).toEqual([1000, 200, 800]);
  });
  test('T2 compenso a ore 3 h 30 min × 13,75 €', async () => {
    const s = await conDati(H => { const p = H.progetto('A ore', 'occasionale', { tariffa: '13.75' }); return soldiOre(H.compenso(p, '2026-03-10', { fasce: [{ da: '15:00', a: '18:30' }] })); });
    expect([s.ore, s.lordo, s.rit, s.netto]).toEqual([3.5, 48.13, 9.63, 38.5]);
  });
});

test.describe('compensi sportivi (soglia 15.000 €)', () => {
  const caso = (gia, nuovo) => conDati((H, [g, n]) => {
    const p = H.progetto('Sport', 'sportivo');
    if (g) H.compenso(p, '2026-02-01', { fisso: String(g) });
    const e = H.compenso(p, '2026-05-01', { fisso: String(n) });
    return soldiOre(e);
  }, [gia, nuovo]);
  test('T3 sotto soglia', async () => { const s = await caso(9000, 1000); expect([s.rit, s.netto]).toEqual([0, 1000]); });
  test('T4 a cavallo della soglia', async () => { const s = await caso(14500, 1000); expect([s.rit, s.netto]).toEqual([100, 900]); });
  test('T5 oltre soglia', async () => { const s = await caso(16000, 1000); expect(s.rit).toBe(200); });
  test('T6 due società: la soglia è unica', async () => {
    const r = await conDati(H => {
      const a = H.progetto('Società A', 'sportivo'), b = H.progetto('Società B', 'sportivo');
      H.compenso(a, '2026-02-01', { fisso: '10000' }); H.compenso(b, '2026-04-01', { fisso: '6000' });
      return stimaTasse('2026').sportEcc;
    });
    expect(r).toBe(1000);
  });
});

test.describe('IRPEF e stima tasse', () => {
  test('T7 IRPEF 2026 su 30.000', async () => { expect(await page.evaluate(() => irpef(30000, '2026'))).toBeCloseTo(7100, 2); });
  test('T8 IRPEF 2025 su 30.000', async () => { expect(await page.evaluate(() => irpef(30000, '2025'))).toBeCloseTo(7140, 2); });
  test('T9 IRPEF 2026 su 60.000', async () => { expect(await page.evaluate(() => irpef(60000, '2026'))).toBeCloseTo(18000, 2); });
  test('T10 stima con altri redditi 25.000', async () => {
    const S = await conDati(H => {
      impost().tasse = { 2026: { altri: '25000', add: 2.5 } };
      const p = H.progetto('Occasionale'); H.compenso(p, '2026-03-10', { fisso: '5000' }); return stimaTasse('2026');
    });
    expect([S.irp, S.add, S.rit, S.saldo]).toEqual([1350, 125, 1000, 475]);
  });
  test('T11 stima senza altri redditi', async () => {
    const S = await conDati(H => {
      impost().tasse = { 2026: { altri: '', add: 2.5 } };
      const p = H.progetto('Occasionale'); H.compenso(p, '2026-03-10', { fisso: '3000' }); return stimaTasse('2026');
    });
    expect([S.irp, S.add, S.rit, S.saldo]).toEqual([690, 75, 600, 165]);
  });
  test('T22 conteggio per cassa: dicembre pagato a gennaio conta nell\'anno dopo', async () => {
    const r = await conDati(H => {
      const p = H.progetto('Occasionale'); H.compenso(p, '2026-12-10', { fisso: '400' });
      pagamenti()[`${p.id}|2026-12|o`] = { pagato: true, data: '2027-01-15', updatedAt: Date.now() }; DB.meta.seq++;
      return [aggrega('2026').tot.lordo, aggrega('2027').tot.lordo];
    });
    expect(r).toEqual([0, 400]);
  });
});

test.describe('contributo INPS sulla ricevuta', () => {
  const caso = gia => conDati((H, g) => {
    const p = H.progetto('Occasionale'); p.docTpl = { kind: 'pdf', inpsPct: 11.24 };
    if (g) H.compenso(p, '2026-02-10', { fisso: String(g) });
    H.compenso(p, '2026-06-10', { fisso: '1000' });
    return valoriWord(p.id, ['2026-06'])._n;
  }, gia);
  test('T12 oltre la soglia di 5.000 €', async () => { const n = await caso(4500); expect([n.inps, n.rit, n.netto]).toEqual([56.2, 200, 743.8]); });
  test('T13 sotto la soglia', async () => { const n = await caso(2000); expect(n.inps).toBe(0); });
});

test('T14 rimborso km: 100 km × 0,40 € + pedaggi 12,30 €', async () => {
  const d = await conDati(H => {
    const p = H.progetto('Trasferte'); p.rimborso.tariffa = 0.40; p.rimborso.origine = 'Paese Inventato';
    H.compenso(p, '2026-04-07', { ore: false, rimborso: true, km: 100, luogo: 'Palestra di prova', tipo: 'allenamento' });
    D().mesi[meseKey(p.id, '2026-04')] = { pedaggi: 12.30, updatedAt: Date.now() };
    return docData(p.id, '2026-04');
  });
  expect([d.km, d.kmEur, d.pedaggi, d.tot]).toEqual([100, 40, 12.3, 52.3]);
});

test.describe('lavoro dipendente (stipcalc)', () => {
  test('T15 festività del 4 ottobre solo dal 2026', async () => {
    expect(await page.evaluate(() => [!!StipCalc.festivo('2026-10-04'), StipCalc.festivo('2025-10-04')])).toEqual([true, null]);
  });
  test('T16 Pasqua e Lunedì dell\'Angelo', async () => {
    const r = await page.evaluate(() => [2026, 2027].map(y => { const d = StipCalc.pasqua(y); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })
      .concat([!!StipCalc.festivo('2026-04-06'), !!StipCalc.festivo('2027-03-29')]));
    expect(r).toEqual(['2026-04-05', '2027-03-28', true, true]);
  });
  const fisso = () => { const W = {}; for (const d of [1, 2, 3, 4, 5]) W[d] = { da: '09:00', a: '18:00', pausa: 60 };
    return { modo: 'fisso', dal: '2026-01-01', paga: { tipo: 'mensile', importo: 1680, divisore: 168 }, settimana: W,
      tipi: [{ id: 'st', nome: 'Straordinario', cat: 'lavoro', aggiunta: true }], magg: { stra: '25' }, nott: { da: '22:00', a: '06:00' }, locali: '' }; };
  test('T17 paga oraria 1.680 € ÷ 168', async () => {
    const M = await page.evaluate(lv => StipCalc.calcolaMese(lv, [], '2026-11'), fisso());
    expect(M.lordo).toBe(1680);
    expect(await page.evaluate(lv => StipCalc.calcolaMese(lv, [{ id: 1, data: '2026-11-03', tipo: 'st', da: '18:00', a: '19:00' }], '2026-11').E.stra, fisso())).toBe(12.5);
  });
  test('T18 straordinario a orario fisso: un giorno 9-20', async () => {
    const M = await page.evaluate(lv => StipCalc.calcolaMese(lv, [{ id: 1, data: '2026-11-03', tipo: 'st', da: '18:00', a: '20:00' }], '2026-11'), fisso());
    expect([M.T.stra, M.E.stra, M.lordo]).toEqual([2, 25, 1705]);
  });
  test('T19 notturno 22-06 con +15%', async () => {
    const M = await page.evaluate(() => StipCalc.calcolaMese({ modo: 'turni', paga: { tipo: 'oraria', importo: 10 }, oreMese: 200,
      tipi: [{ id: 'n', nome: 'Notte', cat: 'lavoro', da: '22:00', a: '06:00' }], magg: { nott: '15' }, nott: { da: '22:00', a: '06:00' } },
      [{ id: 1, data: '2026-11-03', tipo: 'n' }], '2026-11'));
    expect([M.T.nott, M.E.nott]).toEqual([8, 12]);
  });
  test('T20 trattenute dalla busta: lordo 2.000, netto 1.500', async () => {
    const p = await page.evaluate(() => StipCalc.trattenute({}, { a: { mese: '2026-10', lordo: '2000', netto: '1500' } }).p);
    expect(Math.round(p * 100)).toBe(25);
  });
  test('T21 D-009: stipendio di ottobre accreditato a novembre conta a novembre', async () => {
    const r = await conDati(() => {
      const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Ditta di prova'; D().lavori = { [l.id]: l };
      D().entrate = { [`lav|${l.id}|2026-10`]: { entrato: true, data: '2026-11-10', importo: 1500, updatedAt: 1 } };
      return [contiMese('2026-10').lav.v, contiMese('2026-11').lav.v];
    });
    expect(r).toEqual([0, 1500]);
  });
});

// v24 (D-009, E-2): lo stipendio conta solo quando è segnato "Entrato", nel mese della data di entrata.
// Prima della v24 questa prova si aspettava lav 1.500 e rimanenti 1.485,50 senza nessuna voce entrata.
test('soldi rimanenti del mese: lo stipendio conta quando entra (v24, D-009)', async () => {
  const c = await conDati(() => {
    const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Ditta di prova'; l.paga.importo = '1500'; l.dal = '2026-01-01';
    for (const d of [1, 2, 3, 4, 5]) l.settimana[d] = { da: '09:00', a: '17:00', pausa: '60' };
    (D().lavori || (D().lavori = {}))[l.id] = l;
    const s = uid(); (D().spesePers || (D().spesePers = {}))[s] = { id: s, data: '2026-03-03', cat: 'bar', importo: '4.5', nota: '', created: 1, updatedAt: Date.now() };
    const f = uid(); D().fissi = D().fissi || {}; D().fissi['fx:' + f] = { nome: 'Abbonamento', cat: 'altro', importo: '10', giorno: '5', dal: '2026-01', updatedAt: Date.now() };
    DB.meta.seq++;
    const prima = contiMese('2026-03');
    D().entrate = { [`lav|${l.id}|2026-03`]: { entrato: true, data: '2026-03-27', importo: 1500, updatedAt: Date.now() } };
    const r = contiMese('2026-03');
    return { prima: [prima.lav.v, prima.entrate, prima.rimanenti], lav: r.lav.v, sp: r.sp, fTot: r.fTot, entrate: r.entrate, rimanenti: r.rimanenti };
  });
  expect(c.prima).toEqual([0, 0, -14.5]); // in attesa: non conta (E-2); uscite fisse e spese sì
  expect(c.lav).toBe(1500);
  expect(c.sp).toBe(4.5);
  expect(c.fTot).toBe(10);
  expect(c.entrate).toBe(1500);
  expect(c.rimanenti).toBe(1485.5); // segnato "Entrato" a marzo: come prima della v24
});
