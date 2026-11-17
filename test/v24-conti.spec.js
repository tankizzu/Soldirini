// v24 "conta quando entra" (D-009, D-051, D-052, D-066, D-067, D-071, D-072): i casi di prova di 04
// (report 04-fisco-d009-conta-quando-entra e 04-fisco-revisione-piano-v24). Numeri inventati.
// Orologio fisso al 17/11/2026; i casi con date di gennaio 2027 usano un telefono con l'orologio al 20/01/2027 (revisione di 04, 2.1).
const { test, expect } = require('./helpers/prova');
const { DriveFinto, nuovoDispositivo } = require('./helpers/app');

const OGGI = '2026-11-17T10:00:00+01:00', GENNAIO = '2027-01-20T10:00:00+01:00';

// aiuti nella pagina: dati vuoti, lavoro, busta, entrate, progetti, uscite fisse di esempio, spese, cedolini
async function aiuti(page) {
  await page.evaluate(() => {
    window.__H = {
      reset() { DB.data = emptyData(); DB.meta.seq++; },
      lavoro(nome = 'Reparto', o = {}) { const l = Stip15.nuovoLavoro('fisso'); l.nome = nome; l.dal = o.dal || '2026-01-01';
        for (const d of [1, 2, 3, 4, 5]) l.settimana[d] = { da: '09:00', a: '17:00', pausa: '60' };
        l.paga = { tipo: 'mensile', importo: o.paga ?? '2000', divisore: '' }; l.tratt = o.tratt ?? '26'; (D().lavori || (D().lavori = {}))[l.id] = l; return l; },
      busta(l, ym, netto, lordo = '') { (D().buste || (D().buste = {}))[`${l.id}|${ym}`] = { lid: l.id, mese: ym, lordo: String(lordo), trattenute: '', netto: String(netto), updatedAt: 1 }; },
      entra(key, data, importo) { (D().entrate || (D().entrate = {}))[key] = { entrato: true, data, importo, updatedAt: Date.now() }; },
      progetto(nome = 'Squadra', ritardo = 0) { const p = nuovoProgetto(); p.nome = nome; p.ore.attivo = true; p.ore.categoria = 'occasionale';
        p.rimborso.attivo = true; p.rimborso.tariffa = 0.45; p.pagamento = { ritardo }; D().progetti[p.id] = p; return p; },
      compenso(p, data, netto) { const id = uid(); D().eventi[id] = { id, pid: p.id, data, tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: String(netto / 0.8), rimborso: false, spese: [], created: 1, updatedAt: 1 }; },
      rimborso(p, data, euro) { const id = uid(); D().eventi[id] = { id, pid: p.id, data, tipo: 'allenamento', titolo: '', ore: false, fasce: [], rimborso: true, km: euro / 0.45, spese: [], created: 1, updatedAt: 1 }; },
      pagato(p, ym, t, data, importo) { const g = { pagato: true, data, updatedAt: Date.now() }; if (importo != null) g.importo = importo; pagamenti()[`${p.id}|${ym}|${t}`] = g; },
      fissiEsempio(dal = '2026-10') { D().fissi = {};
        for (const [nome, imp, g] of [['Affitto', 450, 3], ['Netflix', 13, 27], ['Assicurazione', 107, 30]]) { const id = uid(); D().fissi[id] = { id, nome, cat: 'altro', importo: String(imp), giorno: String(g), dal, al: '', rate: '', updatedAt: 1 }; } },
      fisso(nome, imp, g, dal, o = {}) { const id = uid(); (D().fissi || (D().fissi = {}))[id] = Object.assign({ id, nome, cat: 'altro', importo: String(imp), giorno: String(g), dal, al: '', rate: '', updatedAt: 1 }, o); return D().fissi[id]; },
      spesa(data, imp) { const id = uid(); (D().spesePers || (D().spesePers = {}))[id] = { id, data, cat: 'bar', importo: String(imp), nota: '', created: 1, updatedAt: 1 }; return id; },
      cedolino(ym, netto) { (D().cedolini || (D().cedolini = {}))[ym] = { mese: ym, pensioneLorda: '1400', netto: String(netto), updatedAt: 1 }; },
      c(ym) { const x = contiMese(ym); return { lav: x.lav.v, pen: x.pen.v, prog: x.prog, fTot: x.fTot, sp: x.sp, entrate: x.entrate, usciti: x.usciti, rimanenti: x.rimanenti }; },
    };
  });
}
async function telefono(browser, ora = OGGI) {
  const d = await nuovoDispositivo(browser, { drive: new DriveFinto(), ora });
  await d.page.waitForFunction(() => window.Entrate && window.Stip15);
  await aiuti(d.page); return d;
}
const run = (page, fn, arg) => page.evaluate(([src, a]) => { __H.reset(); return (0, eval)('(' + src + ')')(__H, a); }, [fn.toString(), arg]);

test.describe('v24 · stipendio (T-S)', () => {
  let page; test.beforeAll(async ({ browser }) => { ({ page } = await telefono(browser)); });
  test('T-S1 busta di ottobre entrata il 10/11: ottobre 0, novembre 1.500', async () => {
    expect(await run(page, H => { const l = H.lavoro(); H.busta(l, '2026-10', 1500); H.entra(`lav|${l.id}|2026-10`, '2026-11-10', 1500); return [H.c('2026-10').lav, H.c('2026-11').lav]; })).toEqual([0, 1500]);
  });
  test('T-S2 novembre senza busta: 0 e "in arrivo 1.480 (stima)"', async () => {
    const r = await run(page, H => { const l = H.lavoro('Reparto', { dal: '2026-11-01' }); const v = Entrate.voci('2026-11').find(x => x.key === `lav|${l.id}|2026-11`);
      return [H.c('2026-11').lav, v.ent, v.pr.imp, v.pr.fonte]; });
    expect(r).toEqual([0, null, 1480, 'stima']);
  });
  test('T-S4 busta di novembre 1.450 entrata il 17/11: novembre 1.450', async () => {
    expect(await run(page, H => { const l = H.lavoro(); H.busta(l, '2026-11', 1450); H.entra(`lav|${l.id}|2026-11`, '2026-11-17', 1450); return H.c('2026-11').lav; })).toBe(1450);
  });
  test('T-S5 due lavori: ottobre di A (1.200, il 10/11) + novembre di B (800, il 17/11) = 2.000 a novembre', async () => {
    expect(await run(page, H => { const a = H.lavoro('A'), b = H.lavoro('B'); H.entra(`lav|${a.id}|2026-10`, '2026-11-10', 1200); H.entra(`lav|${b.id}|2026-11`, '2026-11-17', 800); return H.c('2026-11').lav; })).toBe(2000);
  });
  test('T-S6 importo proposto 1.480, scritto 1.452: conta 1.452', async () => {
    expect(await run(page, H => { const l = H.lavoro(); H.entra(`lav|${l.id}|2026-11`, '2026-11-17', 1452); return H.c('2026-11').lav; })).toBe(1452);
  });
  test('T-S8 T-S1 poi "Non entrato": novembre 0, ottobre torna in attesa', async () => {
    const r = await run(page, H => { const l = H.lavoro(); H.busta(l, '2026-10', 1500); const k = `lav|${l.id}|2026-10`; H.entra(k, '2026-11-10', 1500);
      D().entrate[k] = { entrato: false, data: '', updatedAt: Date.now() }; return [H.c('2026-11').lav, Entrate.voce(k).ent]; });
    expect(r).toEqual([0, null]);
  });
  test('T-S10 stipendio di dicembre con data 15/11: conta a novembre', async () => {
    expect(await run(page, H => { const l = H.lavoro(); H.entra(`lav|${l.id}|2026-12`, '2026-11-15', 1500); return [H.c('2026-11').lav, H.c('2026-12').lav]; })).toEqual([1500, 0]);
  });
  test('T-S11 solo il lordo: importo proposto vuoto e niente somma', async () => {
    const r = await run(page, H => { const l = H.lavoro('Reparto', { tratt: '' }); const v = Entrate.voce(`lav|${l.id}|2026-11`); return [v.pr.imp, v.pr.fonte, v.pr.lordo, H.c('2026-11').lav]; });
    expect(r).toEqual([null, 'lordo', 2000, 0]);
  });
});

test.describe('v24 · progetti (T-P)', () => {
  let page; test.beforeAll(async ({ browser }) => { ({ page } = await telefono(browser)); });
  test('T-P1 compensi di ottobre 300, ritardo 1 mese, non entrati: novembre 0, in arrivo "previsti a novembre", Tasse 2026 300', async () => {
    const r = await run(page, H => { const p = H.progetto('Squadra', 1); H.compenso(p, '2026-10-12', 300);
      const v = Entrate.voci('2026-11').find(x => x.tipo === 'prog'); return [H.c('2026-11').prog, H.c('2026-10').prog, v.pr.imp, v.previsto, aggrega('2026').tot.netto]; });
    expect(r).toEqual([0, 0, 300, '2026-11', 300]);
  });
  test('T-P4 rimborso di ottobre 45 entrato il 20/10: ottobre 45', async () => {
    expect(await run(page, H => { const p = H.progetto(); H.rimborso(p, '2026-10-08', 45); H.pagato(p, '2026-10', 'r', '2026-10-20'); return H.c('2026-10').prog; })).toBe(45);
  });
  test('T-P5 compensi di ottobre 300 entrati il 05/11 e rimborso 45 il 28/10: ottobre 45, novembre 300', async () => {
    expect(await run(page, H => { const p = H.progetto(); H.compenso(p, '2026-10-12', 300); H.rimborso(p, '2026-10-08', 45);
      H.pagato(p, '2026-10', 'o', '2026-11-05', 300); H.pagato(p, '2026-10', 'r', '2026-10-28', 45); return [H.c('2026-10').prog, H.c('2026-11').prog]; })).toEqual([45, 300]);
  });
  test('T-P6 confermati 300, poi la tariffa cambia (calcolato 320): i soldi restano 300, le Tasse seguono la regola fiscale', async () => {
    const r = await run(page, H => { const p = H.progetto(); H.compenso(p, '2026-10-12', 300); H.pagato(p, '2026-10', 'o', '2026-11-05', 300);
      const e = Object.values(D().eventi)[0]; e.fisso = String(320 / 0.8); return [H.c('2026-11').prog, aggrega('2026').tot.netto]; });
    expect(r).toEqual([300, 320]);
  });
  test('progetto segnato "Entrati" da un telefono non aggiornato (senza importo): vale l\'importo calcolato', async () => {
    expect(await run(page, H => { const p = H.progetto(); H.compenso(p, '2026-10-12', 300); H.pagato(p, '2026-10', 'o', '2026-11-05'); return H.c('2026-11').prog; })).toBe(300);
  });
});

test.describe('v24 · pensione (T-N)', () => {
  let page; test.beforeAll(async ({ browser }) => { ({ page } = await telefono(browser)); });
  test('T-N1 cedolino di novembre 1.224,50 entrato il 02/11: novembre 1.224,50', async () => {
    expect(await run(page, H => { H.cedolino('2026-11', 1224.5); H.entra('pen|2026-11', '2026-11-02', 1224.5); return H.c('2026-11').pen; })).toBe(1224.5);
  });
  test('T-N4 novembre senza cedolino: 0 e in arrivo con la stima', async () => {
    const r = await run(page, H => { D().pensione = { profilo: { lordoMese: '1400', dal: '2026-01', annoNascita: '1958', anniContributi: '40', prima: 'dipendente', updatedAt: 1 } };
      const v = Entrate.voci('2026-11').find(x => x.key === 'pen|2026-11'); return [H.c('2026-11').pen, v.ent, v.pr.fonte, v.pr.imp > 0]; });
    expect(r).toEqual([0, null, 'stima', true]);
  });
  test('T-N5 luglio con quattordicesima, netto 1.867,50 entrato l\'01/07: luglio 1.867,50 (una sola voce)', async () => {
    expect(await run(page, H => { H.cedolino('2026-07', 1867.5); H.entra('pen|2026-07', '2026-07-01', 1867.5); return H.c('2026-07').pen; })).toBe(1867.5);
  });
});

test.describe('v24 · cavallo d\'anno (orologio al 20/01/2027)', () => {
  let page; test.beforeAll(async ({ browser }) => { ({ page } = await telefono(browser, GENNAIO)); });
  test('T-S3 busta di dicembre 1.700 entrata il 12/01/2027: dicembre 0, gennaio 1.700', async () => {
    expect(await run(page, H => { const l = H.lavoro(); H.busta(l, '2026-12', 1700); H.entra(`lav|${l.id}|2026-12`, '2027-01-12', 1700); return [H.c('2026-12').lav, H.c('2027-01').lav]; })).toEqual([0, 1700]);
  });
  test('T-P2 compensi di ottobre entrati il 03/12/2026: dicembre 300, Tasse 2026 300', async () => {
    expect(await run(page, H => { const p = H.progetto('Squadra', 1); H.compenso(p, '2026-10-12', 300); H.pagato(p, '2026-10', 'o', '2026-12-03', 300);
      return [H.c('2026-12').prog, aggrega('2026').tot.netto]; })).toEqual([300, 300]);
  });
  test('T-P3 compensi di dicembre 2026 entrati l\'08/01/2027: soldi gennaio 2027, Tasse 2027, soglie 2026 senza questi', async () => {
    expect(await run(page, H => { const p = H.progetto(); H.compenso(p, '2026-12-10', 250); H.pagato(p, '2026-12', 'o', '2027-01-08', 250);
      return [H.c('2027-01').prog, H.c('2026-12').prog, aggrega('2027').tot.netto, aggrega('2026').tot.lordo]; })).toEqual([250, 0, 250, 0]);
  });
  test('T-N3 rata di gennaio 2027 entrata il 04/01/2027: gennaio 1.240, nulla nel 2026', async () => {
    expect(await run(page, H => { H.cedolino('2027-01', 1240); H.entra('pen|2027-01', '2027-01-04', 1240); return [H.c('2027-01').pen, contiAnno('2026').pen]; })).toEqual([1240, 0]);
  });
  test('T-R3 contiAnno(2026) non comprende 1.700 né 250; contiAnno(2027) sì', async () => {
    const r = await run(page, H => { const l = H.lavoro(); H.busta(l, '2026-12', 1700); H.entra(`lav|${l.id}|2026-12`, '2027-01-12', 1700);
      const p = H.progetto(); H.compenso(p, '2026-12-10', 250); H.pagato(p, '2026-12', 'o', '2027-01-08', 250);
      const a = contiAnno('2026'), b = contiAnno('2027'); return [a.lav, a.prog, b.lav, b.prog, a.mesi, b.mesi]; });
    expect(r).toEqual([0, 0, 1700, 250, 12, 1]);
  });
});

test.describe('v24 · riquadro e uscite fisse (T-R, T-U, T-D)', () => {
  let page; test.beforeAll(async ({ browser }) => { ({ page } = await telefono(browser)); });
  const novembre = H => { const l = H.lavoro(); H.entra(`lav|${l.id}|2026-10`, '2026-11-10', 1500); const p = H.progetto(); H.compenso(p, '2026-10-12', 300); H.pagato(p, '2026-10', 'o', '2026-11-05', 300);
    H.fissiEsempio(); H.spesa('2026-11-04', 50); H.spesa('2026-11-12', 30); return l; };
  test('T-R1 novembre: entrati 1.800, uscite fisse 570, spese 80, usciti 650, rimanenti 1.150', async () => {
    const r = await run(page, (H, src) => { (0, eval)('(' + src + ')')(H); return H.c('2026-11'); }, novembre.toString());
    expect(r).toEqual({ lav: 1500, pen: 0, prog: 300, fTot: 570, sp: 80, entrate: 1800, usciti: 650, rimanenti: 1150 });
  });
  test('T-R2 come T-R1 con lo stipendio di novembre in attesa: rimanenti invariati', async () => {
    const r = await run(page, (H, src) => { const l = (0, eval)('(' + src + ')')(H); H.busta(l, '2026-11', 1480);
      return [H.c('2026-11').rimanenti, Entrate.voci('2026-11').find(v => v.key === `lav|${l.id}|2026-11`).pr.imp]; }, novembre.toString());
    expect(r).toEqual([1150, 1480]);
  });
  test('T-U1 Netflix (il 27) non ancora addebitata conta già: uscite fisse di novembre 570', async () => {
    expect(await run(page, H => { H.fissiEsempio(); return H.c('2026-11').fTot; })).toBe(570);
  });
  test('T-U2 palestra 30 dal 2026-11, giorno 20: ottobre no, novembre sì (600)', async () => {
    expect(await run(page, H => { H.fissiEsempio(); H.fisso('Palestra', 30, 20, '2026-11'); return [H.c('2026-10').fTot, H.c('2026-11').fTot]; })).toEqual([570, 600]);
  });
  test('T-U3 rata 100 dal 2026-09 per 3 rate (o fino al 2026-11): settembre-novembre 100, dicembre 0', async () => {
    expect(await run(page, H => { H.fisso('Rata', 100, 5, '2026-09', { rate: '3' }); const a = ['09', '10', '11', '12'].map(m => H.c('2026-' + m).fTot);
      D().fissi = {}; H.fisso('Rata', 100, 5, '2026-09', { al: '2026-11' }); return a.concat(['09', '10', '11', '12'].map(m => H.c('2026-' + m).fTot)); }))
      .toEqual([100, 100, 100, 0, 100, 100, 100, 0]);
  });
  test('T-U4 giorno 31 nei mesi corti: febbraio 2027 il 28, febbraio 2028 il 29, aprile il 30, gennaio il 31; conta per intero', async () => {
    const r = await run(page, H => { H.fisso('Abbonamento', 10, 31, '2026-11'); return ['2027-02', '2028-02', '2027-04', '2027-01'].map(ym => [fissiDel(ym)[0].data.slice(8), H.c(ym).fTot]); });
    expect(r).toEqual([['28', 10], ['29', 10], ['30', 10], ['31', 10]]);
  });
  test('T-U5 mese passato (ottobre): uscite fisse 570, usciti 770, rimanenti 730', async () => {
    const r = await run(page, H => { const l = H.lavoro(); H.entra(`lav|${l.id}|2026-09`, '2026-10-10', 1500); H.fissiEsempio(); H.spesa('2026-10-15', 200); return H.c('2026-10'); });
    expect([r.fTot, r.usciti, r.rimanenti]).toEqual([570, 770, 730]);
  });
  test('T-U6 mese futuro (dicembre), niente entrato: rimanenti −570', async () => {
    const r = await run(page, H => { H.fissiEsempio(); return H.c('2026-12'); });
    expect([r.entrate, r.fTot, r.usciti, r.rimanenti]).toEqual([0, 570, 570, -570]);
  });
  test('T-U7 vista Anno 2026: fino a novembre 1.880, "ancora da addebitare entro dicembre" 570; 2025 tutti i 12 mesi', async () => {
    const r = await run(page, (H, src) => { (0, eval)('(' + src + ')')(H); H.entra(`lav|${Object.keys(D().lavori)[0]}|2026-09`, '2026-10-10', 1500); H.spesa('2026-10-15', 200);
      const a = contiAnno('2026'), b = contiAnno('2025'); return [a.rimanenti, a.fResto, a.mesi, b.mesi, b.fResto]; }, novembre.toString());
    expect(r).toEqual([1880, 570, 11, 12, 0]);
  });
  test('T-D1 300 di spese dimenticate a ottobre: ottobre 430, novembre 1.150 invariato', async () => {
    const r = await run(page, (H, src) => { (0, eval)('(' + src + ')')(H); H.entra(`lav|${Object.keys(D().lavori)[0]}|2026-09`, '2026-10-10', 1500); H.spesa('2026-10-15', 200);
      const prima = [H.c('2026-10').rimanenti, H.c('2026-11').rimanenti]; H.spesa('2026-10-20', 300); return prima.concat([H.c('2026-10').rimanenti, H.c('2026-11').rimanenti]); }, novembre.toString());
    expect(r).toEqual([730, 1150, 430, 1150]);
  });
  test('T-D2 ottobre senza entrate (−570): novembre 1.150 invariato', async () => {
    const r = await run(page, (H, src) => { (0, eval)('(' + src + ')')(H); return [H.c('2026-10').rimanenti, H.c('2026-11').rimanenti]; }, novembre.toString());
    expect(r).toEqual([-570, 1150]);
  });
  test('T-D3 spesa di 50 spostata dal 31/10 all\'01/11: ottobre +50, novembre −50, settembre invariato', async () => {
    const r = await run(page, H => { const id = H.spesa('2026-10-31', 50); const a = ['09', '10', '11'].map(m => H.c('2026-' + m).rimanenti);
      D().spesePers[id].data = '2026-11-01'; return a.concat(['09', '10', '11'].map(m => H.c('2026-' + m).rimanenti)); });
    expect(r).toEqual([0, -50, 0, 0, 0, -50]);
  });
});
