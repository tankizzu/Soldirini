// 24c.6 (D-139): correzioni dei calcoli e dei dati. Casi dei libri di 04: FC-17 "Controlli delle buste" (KB, TR, CP),
// FC-2 "Saldi di ferie e permessi" (FS), "Conti del mese" (N2, N2b, CM21), regole R-D3, R-D5, R-D7, R-D9 di 03.
// Solo dati inventati. Orologio fisso al 17/11/2026 (CM21 anche al 5/12/2026).
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { test, expect } = require('./helpers/prova');
const { DriveFinto, nuovoDispositivo, accedi } = require('./helpers/app');

const SITO = path.join(__dirname, '..', 'soldirini');
require(path.join(SITO, 'numeri.js'));
require(path.join(SITO, 'stipcalc.js'));
const C = globalThis.StipCalc;
const P = (() => { const c = vm.createContext({ window: {} }); for (const f of ['numeri.js', 'pencalc.js']) vm.runInContext(fs.readFileSync(path.join(SITO, f), 'utf8'), c); return c.window.PenCalc; })();

const TIPI = [{ id: 'F', nome: 'Ferie', cat: 'ferie', pausa: '', ore: '' }, { id: 'Pe', nome: 'Permesso', cat: 'permesso', pausa: '', ore: '' },
  { id: 'Ma', nome: 'Malattia', cat: 'malattia', pausa: '', ore: '' }];
// LF del libro FC-2: orario fisso lun-ven 09-18 con un'ora di pausa = 8 ore al giorno
const LF = (x = {}) => Object.assign({ modo: 'fisso', dal: '2026-01-01', paga: { tipo: 'oraria', importo: 10 }, tipi: TIPI,
  settimana: Object.fromEntries([1, 2, 3, 4, 5].map(d => [d, { da: '09:00', a: '18:00', pausa: '60' }])) }, x);
let n = 0;
const turno = (data, tipo, x = {}) => Object.assign({ id: 't' + (n++), data, tipo }, x);
const eur = v => v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' }) + ' €';

test.describe('24c.6 · P2: numeri scritti all\'italiana (numeri.js)', () => {
  test('una sola lettura: "1.260,00", "1260,00", "1 260", "1260.5"; dati salvati "1.680.00"; "1.680" ambiguo; numeri normali come prima', () => {
    const L = globalThis.leggiNumero;
    expect(['1.260,00', '1260,00', '1 260', '1260.5'].map(v => L(v))).toEqual([1260, 1260, 1260, 1260.5]);
    expect([L('1.680.00'), L('1.680.000'), L('1.680'), L('1,68'), L('12,5'), L('-3'), L(''), L(null), L(12.5)]).toEqual([1680, 1680000, null, 1.68, 12.5, -3, null, null, 12.5]);
    expect(globalThis.capisciNumero('1.680', true).stato).toBe('ambiguo');
    expect([L('12abc', true), L('12 13', true), L('1.260,00 €', true)]).toEqual([null, null, 1260]);
    // numeri normali: uguali alla lettura di prima (parseFloat con la prima virgola cambiata in punto)
    const prima = v => { const x = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(x) ? null : x; };
    for (let i = 0; i < 20000; i++) { const x = Math.round((Math.random() - 0.2) * 1e7) / 100;
      for (const s of [String(x), x.toFixed(2), x.toFixed(2).replace('.', ','), String(Math.round(x))]) expect(L(s)).toBe(prima(s)); }
  });

  test('TR5: busta con il lordo salvato "1.680.00" usata per le trattenute (1680/1260 = 25%) · CP12: imponibile "2.000,00"', () => {
    const lv = LF();
    const B = { 'L|2026-09': { lid: 'L', mese: '2026-09', lordo: '2000', netto: '1500' }, 'L|2026-10': { lid: 'L', mese: '2026-10', lordo: '2000', netto: '1000', deleted: true },
      'L|2026-11': { lid: 'L', mese: '2026-11', lordo: '1.680.00', netto: '1260' } };
    expect(C.trattenute(lv, B)).toEqual({ p: 0.25, fonte: 'busta', mese: '2026-11' });
    expect(P.controlloContributi('2.000,00', '183,80', 2026)).toBeNull();
    expect(P.controlloContributi('2.000,00', '150', 2026).percentuale).toBe(7.5);
  });
});

test.describe('24c.6 rivista · campi type="number": il punto è il decimale', () => {
  test('paga "8.125", "10.500", "9.375" (come le salva il campo): stesso lordo della 24c.5; nessuna regola dell\'ambiguo per il lavoro e i turni', () => {
    const L = globalThis.leggiNumeroPunto;
    expect([L('8.125'), L('10.500'), L('9.375'), L('7,5'), L(''), L(null), L(12)]).toEqual([8.125, 10.5, 9.375, 7.5, null, null, 12]);
    // orario fisso lun-ven 9-18, novembre 2026: 21 giorni × 8 ore (lordi della 24c.5, fb565e5)
    for (const [paga, lordo] of [['8.125', 1365], ['10.500', 1764], ['9.375', 1575], ['9.37538', 1575.06], ['12.50', 2100]])
      expect(C.calcolaMese(LF({ paga: { tipo: 'oraria', importo: paga } }), [], '2026-11').lordo).toBe(lordo);
    // altri campi del lavoro e dei turni con tre decimali: ore al mese, maggiorazione, trattenute, ferie all'anno, ore del turno
    const lv = LF({ paga: { tipo: 'mensile', importo: '1500.000', divisore: '168.000' }, oreMese: '100.500', magg: { stra: '25.000' }, tratt: '12.125',
      ferie: { unita: 'ore', anno: '200.500', residuo: '8.250' } });
    expect(C.trattenute(lv, {})).toEqual({ p: 0.12125, fonte: 'impostazione' });
    expect(C.saldi(lv, [turno('2026-11-04', 'F', { ore: '4.125' })], {}, '2026-11').ferie.saldo).toBe(204.62); // come la 24c.5
    expect(C.calcolaMese(lv, [], '2026-11').lordo).toBe(1500);
  });
});

test.describe('24c.6 · P1: controlli della busta (KB12-KB16)', () => {
  test('lordo − trattenute ≠ netto oltre 1 €, netto più alto del lordo; mai una correzione', () => {
    expect(C.controlloBusta('2000', '500', '1500', eur)).toBeNull(); // KB12
    expect(C.controlloBusta('2000', '500', '1050', eur)).toEqual({ tipo: 'conti', testo: 'Lordo − trattenute = 1.500,00 €, ma il netto è 1.050,00 €. Controlla i valori.' }); // KB13
    expect(C.controlloBusta('2000', '500', '1500.40', eur)).toBeNull(); // KB14: entro 1 €
    expect(C.controlloBusta('1500', '', '2000', eur)).toEqual({ tipo: 'netto', testo: 'Il netto non può essere più alto del lordo: controlla i valori.' }); // KB15
    expect(C.controlloBusta('2000', '', '1500', eur)).toBeNull(); // KB16: manca un numero
  });
});

test.describe('24c.6 · P4: percentuale dei contributi con un decimale', () => {
  test('CP5 11,01% → "11,01%" (sul bordo: due decimali), CP7 7,05% → "7,1%", CP8 7,5% → "7,5%", CP9 0 → "0,0%"; CP1 nessun avviso', () => {
    const t = c => (P.controlloContributi('2000', c, 2026) || {}).testo;
    expect(t('220.20')).toBe('Sembra alto (11,01% dell’imponibile, di solito 9–10%). Controlla il valore sulla busta.');
    expect(t('141')).toBe('Sembra basso (7,1% dell’imponibile, di solito 9–10%). Controlla il valore sulla busta.');
    expect(t('150')).toBe('Sembra basso (7,5% dell’imponibile, di solito 9–10%). Controlla il valore sulla busta.');
    expect(t('183.80')).toBeUndefined();
    expect(t('0')).toBe('Sembra basso (0,0% dell’imponibile, di solito 9–10%). Controlla il valore sulla busta.');
    expect(t('159.90')).toBeUndefined(); // CP3: 7,995 → 8,00, dentro
  });
});

test.describe('24c.6 · saldi di ferie e permessi (FC-2)', () => {
  test('FS9 (T4): busta in ore con il lavoro in giorni → "88 ore" · FS33 (R-D7): unità non valida → unità del lavoro', () => {
    const lv = LF({ ferie: { unita: 'giorni', anno: '26' }, perm: { unita: 'ore', anno: '' } });
    const B = { 'L|2026-10': { lid: 'L', mese: '2026-10', ferie: '96', unitaFerie: 'ore', exfest: '32', unitaPerm: '<b>x</b>' } };
    const s = C.saldi(lv, [turno('2026-11-04', 'F')], B, '2026-11');
    expect(s.ferie).toMatchObject({ saldo: 88, unita: 'ore', fonte: 'busta' });
    expect(s.exfest).toMatchObject({ saldo: 32, unita: 'ore' });
    // stessa unità della busta e del lavoro: come prima (FS5)
    expect(C.saldi(lv, [turno('2026-10-20', 'F'), turno('2026-11-04', 'F')], { 'L|2026-10': { lid: 'L', mese: '2026-10', ferie: '12', unitaFerie: 'giorni' } }, '2026-11').ferie).toMatchObject({ saldo: 11, unita: 'giorni' });
  });

  test('FS17b, FS17c (T3): a orario fisso due ferie nello stesso giorno valgono una giornata sola', () => {
    const due = [turno('2026-11-04', 'F'), turno('2026-11-04', 'F')];
    expect(C.saldi(LF({ ferie: { unita: 'ore', anno: '208' } }), due, {}, '2026-11').ferie.saldo).toBe(200);
    expect(C.saldi(LF({ ferie: { unita: 'giorni', anno: '26' } }), due, {}, '2026-11').ferie.saldo).toBe(25);
    expect(C.calcolaMese(LF(), due, '2026-11').T).toMatchObject({ ferie: 1, ferieOre: 8 });
    // una ferie sola: come prima (anche il sabato senza orario, FS19b, che aspetta la decisione 3)
    expect(C.saldi(LF({ ferie: { unita: 'giorni', anno: '26' } }), [turno('2026-11-07', 'F')], {}, '2026-11').ferie.saldo).toBe(25);
  });

  test('FS34 (R-D9): un turno con la data non di testo si salta, senza errori, in saldi e calcoli', () => {
    const lv = LF({ ferie: { unita: 'giorni', anno: '26' }, perm: { unita: 'ore', anno: '72' } });
    const rotti = [turno(20261104, 'F'), turno(undefined, 'F'), turno('2026-13-01', 'F'), null];
    expect(C.saldi(lv, rotti, {}, '2026-11')).toMatchObject({ ferie: { saldo: 26 }, rol: { saldo: 72 } });
    expect(C.calcolaMese(lv, rotti, '2026-11').T.ferie).toBe(0);
  });
});

// ---------- nella pagina ----------
const OGGI = '2026-11-17T10:00:00+01:00';
async function telefono(browser, ora = OGGI) {
  const d = await nuovoDispositivo(browser, { drive: new DriveFinto(), ora });
  await d.page.waitForFunction(() => window.Entrate && window.Stip15 && window.Archivio && Archivio.avviata);
  return d;
}
const LAVORO = () => { const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Ditta di prova'; l.dal = '2026-01-01';
  for (const d of [1, 2, 3, 4, 5]) l.settimana[d] = { da: '09:00', a: '17:00', pausa: '60' };
  l.paga = { tipo: 'mensile', importo: '2000', divisore: '' }; l.tratt = '25'; (D().lavori || (D().lavori = {}))[l.id] = l; changed(); return l.id; };

test.describe('24c.6 · finestra della busta', () => {
  test('KB6, KB9, KB10: "1.260,00" e "1 260" si salvano come 1260; la pagina e "In arrivo" propongono 1.260,00; "È entrato" conta 1.260,00', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await accedi(page);
    const lid = await page.evaluate(LAVORO);
    for (const [netto, lordo] of [['1.260,00', '1.680,00'], ['1 260', '1 680']]) {
      await page.evaluate(lid => Stip15.apriBusta(lid, '2026-10'), lid); await page.click('#bpManuale');
      await page.fill('#bp-lordo', lordo); await page.fill('#bp-netto', netto); await page.click('#bpSave');
      await expect(page.locator('#bpModal')).toBeHidden();
      expect(await page.evaluate(lid => { const b = D().buste[lid + '|2026-10']; return [b.lordo, b.netto]; }, lid)).toEqual(['1680', '1260']);
    }
    await page.evaluate(() => { cur = '2026-10'; render(); vaiA('dlav'); });
    await expect(page.locator('#v-dlav .lavcard').first()).toContainText('netto 1.260,00 € · lordo 1.680,00 €');
    await page.evaluate(lid => Entrate.apri(`lav|${lid}|2026-10`), lid);
    await expect(page.locator('#enImp')).toHaveValue('1260');
    await expect(page.locator('#enImpNota')).toHaveText('Proposto dal netto della busta. Correggilo se in banca è diverso.');
    await page.locator('#enData').fill('2026-11-10'); await page.locator('#enSave').click();
    expect(await page.evaluate(() => contiMese('2026-11').lav.v)).toBe(1260);
    expect(errori).toEqual([]);
  });

  test('dati già salvati da una versione vecchia: "1.260.00" vale 1.260,00; "1.680" (ambiguo) non si indovina e resta com\'era finché non lo riscrivi', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await accedi(page);
    const lid = await page.evaluate(LAVORO);
    await page.evaluate(lid => { D().buste = { [lid + '|2026-09']: { lid, mese: '2026-09', lordo: '1.680.00', trattenute: '', netto: '1.260.00', updatedAt: 1 },
      [lid + '|2026-10']: { lid, mese: '2026-10', lordo: '', trattenute: '', netto: '1.680', updatedAt: 1 } }; changed(); }, lid);
    expect(await page.evaluate(lid => [Entrate.voce(`lav|${lid}|2026-09`).pr, Entrate.voce(`lav|${lid}|2026-10`).pr.fonte], lid)).toEqual([{ imp: 1260, fonte: 'busta' }, 'stima']);
    await page.evaluate(lid => Stip15.apriBusta(lid, '2026-10', true), lid);
    await expect(page.locator('#bp-netto')).toHaveValue('');
    await expect(page.locator('#bp-netto')).toHaveClass(/nonvale/);
    await expect(page.locator('#bpNum')).toHaveText('Netto: qui c\'era «1.680», che può essere 1.680,00 oppure 1,68. Controlla sulla busta e scrivilo con la virgola.');
    await page.click('#bpSave');
    expect(await page.evaluate(lid => D().buste[lid + '|2026-10'].netto, lid)).toBe('1.680'); // R-D6: non cambia da solo
    await page.evaluate(lid => Stip15.apriBusta(lid, '2026-10', true), lid);
    await page.fill('#bp-netto', '1.680,00'); await page.click('#bpSave');
    expect(await page.evaluate(lid => D().buste[lid + '|2026-10'].netto, lid)).toBe('1680');
    expect(errori).toEqual([]);
  });

  test('numeri che non si capiscono: bordo rosso, messaggio sotto i campi e Salva che non salva', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await accedi(page);
    const lid = await page.evaluate(LAVORO);
    await page.evaluate(lid => Stip15.apriBusta(lid, '2026-10'), lid); await page.click('#bpManuale');
    await page.fill('#bp-netto', '12abc'); await page.locator('#bp-netto').blur();
    await expect(page.locator('#bp-netto')).toHaveClass(/nonvale/); await expect(page.locator('#bp-netto')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#bpNum')).toHaveText('Netto: non capisco questo numero. Scrivilo così: 1.260,00 oppure 1260,00.');
    await page.fill('#bp-lordo', '1.680'); await page.locator('#bp-lordo').blur();
    await expect(page.locator('#bpNum')).toContainText('Lordo: «1.680» può essere 1.680,00 oppure 1,68. Scrivilo con la virgola, come sulla busta.');
    await page.click('#bpSave');
    await expect(page.locator('#toast')).toHaveText('Controlla i numeri con il bordo rosso.');
    await expect(page.locator('#bpModal')).toBeVisible();
    expect(await page.evaluate(lid => (D().buste || {})[lid + '|2026-10'], lid)).toBeUndefined();
    // corretti: l'errore sparisce e si salva
    await page.fill('#bp-netto', '1260,00'); await page.fill('#bp-lordo', '1680');
    await expect(page.locator('#bpNum')).toBeHidden(); await expect(page.locator('#bp-netto')).not.toHaveClass(/nonvale/);
    await page.click('#bpSave'); await expect(page.locator('#bpModal')).toBeHidden();
    expect(await page.evaluate(lid => D().buste[lid + '|2026-10'].netto, lid)).toBe('1260');
    expect(errori).toEqual([]);
  });

  test('P1 nella finestra: KB13 avviso, KB14 niente, KB15 netto più alto del lordo; Salva funziona lo stesso', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await accedi(page);
    const lid = await page.evaluate(LAVORO);
    await page.evaluate(lid => Stip15.apriBusta(lid, '2026-10'), lid); await page.click('#bpManuale');
    const p1 = page.locator('#bpP1');
    await page.fill('#bp-lordo', '2.000,00'); await page.fill('#bp-trattenute', '500'); await page.fill('#bp-netto', '1.050,00');
    await expect(p1).toHaveText('⚠ Lordo − trattenute = 1.500,00 €, ma il netto è 1.050,00 €. Controlla i valori.');
    await page.fill('#bp-netto', '1500,40'); await expect(p1).toBeHidden();
    await page.fill('#bp-lordo', '1500'); await page.fill('#bp-trattenute', ''); await page.fill('#bp-netto', '2000');
    await expect(p1).toHaveText('⚠ Il netto non può essere più alto del lordo: controlla i valori.');
    expect(await page.locator('#bp-netto').getAttribute('aria-describedby')).toContain('bpP1');
    await page.click('#bpSave'); await expect(page.locator('#bpModal')).toBeHidden();
    expect(await page.evaluate(lid => D().buste[lid + '|2026-10'].netto, lid)).toBe('2000'); // mai una correzione
    expect(errori).toEqual([]);
  });
});

test.describe('24c.6 rivista · campi type="number" nella pagina', () => {
  test('salvadanaio con la percentuale salvata "12.125" (campo type="number"): proposta 12,125% dei soldi rimasti, come la 24c.5', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    const r = await page.evaluate(() => { D().entrate = { 'pen|2026-10': { entrato: true, data: '2026-10-20', importo: 1000, updatedAt: 1 } };
      D().risparmi = { cfg: { perc: '12.125', updatedAt: 1 } }; changed(); tab = 'rie'; render(); vaiA('ris');
      const b = document.getElementById('rsSalv'); return { rim: contiMese('2026-10').rimanenti, v: b && b.dataset.v }; });
    expect(r.rim).toBe(1000); expect(+r.v).toBe(121.25);
    expect(errori).toEqual([]);
  });
});

test.describe('24c.6 · dati rovinati e entrate future nella pagina', () => {
  test('FS33: "Ex festività 32 ore" senza HTML · FS34: turno con la data numero, pagine disegnate senza errori', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    const lid = await page.evaluate(LAVORO);
    await page.evaluate(lid => { D().buste = { [lid + '|2026-10']: { lid, mese: '2026-10', netto: '1500', exfest: '32', unitaPerm: '<b>x</b>', unitaFerie: '<i>y</i>', ferie: '12', updatedAt: 1 } };
      D().turni = { t1: { id: 't1', lid, data: 20261104, tipo: 'F', updatedAt: 1 }, t2: { id: 't2', lid, tipo: 'F', updatedAt: 1 } }; changed(); }, lid);
    await page.evaluate(() => { cur = '2026-11'; tab = 'cal'; render(); });
    await page.evaluate(() => { tab = 'rie'; render(); vaiA('dlav'); });
    const card = page.locator('#v-dlav .lavcard').first();
    await expect(card).toContainText('Ex festività: 32 ore');
    await expect(card).toContainText('Ferie: 12 giorni');
    expect(await card.locator('b:text-is("x"), i:text-is("y")').count()).toBe(0);
    expect(errori).toEqual([]);
  });

  test('N2, N2b (R-D5): spesa con la data numero o senza data saltata nei conti, senza errori', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    const prima = await page.evaluate(() => { D().spesePers = { a: { id: 'a', data: '2026-11-10', cat: 'bar', importo: '33.20', created: 1, updatedAt: 1 } }; changed(); return contiMese('2026-11'); });
    const dopo = await page.evaluate(() => { D().spesePers.b = { id: 'b', data: 123, cat: 'bar', importo: '10', created: 2, updatedAt: 1 };
      D().spesePers.c = { id: 'c', cat: 'bar', importo: '10', created: 3, updatedAt: 1 }; changed(); return contiMese('2026-11'); });
    expect([dopo.sp, dopo.rimanenti]).toEqual([prima.sp, prima.rimanenti]); expect(dopo.sp).toBe(33.2);
    await page.evaluate(() => { tab = 'rie'; rieMode = 'anno'; render(); rieMode = 'mese'; render(); tab = 'cal'; render(); });
    await expect(page.locator('#rieTot')).toBeAttached();
    expect(errori).toEqual([]);
  });

  test('CM21 (R-D3): stipendio con la data dopo oggi vale "non ancora entrato" fino a quel giorno', async ({ browser }) => {
    for (const [ora, atteso] of [[OGGI, 0], ['2026-12-05T10:00:00+01:00', 1500]]) {
      const { page, errori } = await telefono(browser, ora);
      const v = await page.evaluate(() => { const lid = (() => { const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Ditta'; l.dal = '2026-01-01'; l.paga = { tipo: 'mensile', importo: '1500', divisore: '' }; D().lavori[l.id] = l; return l.id; })();
        D().entrate = { [`lav|${lid}|2026-11`]: { entrato: true, data: '2026-12-05', importo: 1500, updatedAt: 1 } };
        const p = nuovoProgetto(); p.nome = 'Squadra'; D().progetti[p.id] = p; pagamenti()[`${p.id}|2026-11|o`] = { pagato: true, data: '2026-12-05', importo: 200, updatedAt: 1 };
        changed(); const vo = Entrate.voce(`lav|${lid}|2026-11`);
        return { dic: contiMese('2026-12').lav.v, nov: contiMese('2026-11').lav.v, entrata: !!vo.ent, inArrivo: Entrate.voci('2026-12').some(x => x.key === vo.key && !x.ent) };
      });
      expect(v).toMatchObject({ dic: atteso, nov: 0, entrata: atteso > 0 });
      expect(errori).toEqual([]);
    }
  });
});
