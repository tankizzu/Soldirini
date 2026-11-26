// 24c.7 (D-140, D-142): tastiera giusta per ogni campo (regola §11 di 02), "1.680" scritto adesso negli importi della busta
// letto come migliaia con "Letto come 1.680,00 €", pagamenti con la data dopo oggi "non ancora entrati" anche in Tasse e ricevute.
// Solo dati inventati.
const { test, expect } = require('./helpers/prova');
const { DriveFinto, nuovoDispositivo, accedi } = require('./helpers/app');

const OGGI = '2026-11-17T10:00:00+01:00';
async function telefono(browser, ora = OGGI) {
  const d = await nuovoDispositivo(browser, { drive: new DriveFinto(), ora });
  await d.page.waitForFunction(() => window.Entrate && window.Stip15 && window.Archivio && Archivio.avviata);
  return d;
}

// Campi di TESTO (tastiera normale, regola §11): nomi, descrizioni, note, sigle, codici, date scritte a parole o con "/" e "-".
// Un campo nuovo che non è qui deve avere type="number" o inputmode decimal/numeric: altrimenti la prova si ferma e lo nomina.
const TESTO = new Set([
  'pf-cognome', 'pf-nome', 'pf-natoA', 'pf-residenza', 'pf-via', 'pf-cf', 'pf-modello', 'pf-targa',
  'evTitolo', 'evNewLuogoN', 'spNota', 'evNote', 'evFixNome', 'pjNome', 'pjR-origine', 'pjR-squadra', 'pjR-occasione', 'pjR-mansione',
  'pjR-tariffaData', 'pjA-riga1', 'pjA-nomeBig', 'pjA-nome', 'pjA-via', 'pjA-citta', 'pjA-cf', 'lvNome', 'lvLocali', 'lvContratto', 'tuNota',
  'fpNome', 'cd-altreNota', 'ftNome', 'fxNome', 'fxNota', 'obNome', 'mvNota', 'cuComm', 'cuCaus', 'wTit',
  'data-li=nome', 'data-pf=nome', 'data-lk=nota', 'data-tm=nome', 'tnNome', 'spPNota', 'data-x=altroDesc', 'data-x=tariffaData',
  'data-k=icona', 'data-k=nome', 'data-k=sigla',
  'evExNota', 'xeNota', // 24c.13 (D-074): nota dell'entrata extra
  'spmNota', // 24c.15 (D-171): nota della spesa giornaliera nella sua finestra
]);
const SALTA = ['checkbox', 'radio', 'date', 'month', 'time', 'color', 'file', 'hidden', 'range', 'search', 'email', 'password', 'button', 'submit'];
const campi = page => page.evaluate(SALTA => [...document.querySelectorAll('input')].filter(i => !SALTA.includes(i.type)).map(i => {
    return {
    chiave: i.id || (() => { const k = ['data-k', 'data-x', 'data-lk', 'data-tm'].find(n => i.hasAttribute(n)); if (k) return `${k}=${i.getAttribute(k)}`;
      const n = ['data-li', 'data-pf'].find(n => i.hasAttribute(n)); return n ? `${n}=${i.getAttribute('data-k')}` : '?'; })(),
    type: i.type, im: i.getAttribute('inputmode') || '', ph: i.getAttribute('placeholder') || '' };
}), SALTA);

test.describe('24c.7 · D-140: la tastiera giusta per ogni campo', () => {
  test('ogni campo di numeri ha inputmode decimal o numeric (anche i type="number"); i campi di testo sono quelli dell\'elenco', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await accedi(page);
    // dati inventati per far disegnare anche i campi creati da JavaScript: progetto con rimborso, ore, luoghi e fasce;
    // lavoro a turni con i tipi; un'attività del mese per la scheda dei rimborsi
    await page.evaluate(() => {
      const p = nuovoProgetto({ nome: 'Squadra di prova' }); p.rimborso.luoghi = [{ nome: 'Palestra', km: '12' }]; p.ore.attivo = true; p.ore.fasce = [{ nome: 'Allenamento', da: '17:00', a: '19:00' }];
      p.turni = [{ id: 'tp1', nome: 'Allenamento', da: '17:00', a: '19:00' }]; D().progetti[p.id] = p;
      D().eventi = { e1: { id: 'e1', pid: p.id, data: '2026-11-10', tipo: 'km', km: '12', luogo: 'Palestra', updatedAt: 1 } };
      const l = Stip15.nuovoLavoro('turni'); l.nome = 'Reparto'; l.dal = '2026-01-01'; D().lavori[l.id] = l; changed(); window.__pid = p.id; window.__lav = l;
    });
    const visti = new Map();
    const raccogli = async () => { for (const c of await campi(page)) if (!visti.has(c.chiave)) visti.set(c.chiave, c); };
    await raccogli(); // tutte le finestre di index.html sono già nella pagina
    await page.evaluate(() => openProj(window.__pid)); await raccogli(); await page.evaluate(() => document.querySelectorAll('.modal:not([hidden])').forEach(m => m.hidden = true));
    await page.evaluate(() => { document.querySelectorAll('.modal:not([hidden])').forEach(m => m.hidden = true); tab = 'pro'; render(); document.querySelector(`[data-lav="${window.__lav.id}"]`).click(); });
    await expect(page.locator('#lvModal')).toBeVisible(); await raccogli();
    await page.evaluate(() => { document.querySelectorAll('.modal:not([hidden])').forEach(m => m.hidden = true); tab = 'rie'; cur = '2026-11'; render(); vaiA('drim'); });
    await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true)); await raccogli();
    await page.evaluate(() => { tab = 'cal'; render(); openEv(['2026-11-12']); }); await raccogli();
    const lista = [...visti.values()];
    expect(lista.length).toBeGreaterThan(80);
    // i campi da JavaScript del compito ci sono davvero
    for (const k of ['data-k=pausa', 'data-k=ore', 'data-x=pernN', 'data-x=pastiN', 'data-x=allegati', 'data-x=tariffaData']) expect(visti.has(k), k).toBe(true);
    const senza = lista.filter(c => !TESTO.has(c.chiave) && !['decimal', 'numeric'].includes(c.im)).map(c => `${c.chiave} (${c.type})`);
    expect(senza, 'campi di numeri senza tastierino').toEqual([]);
    const numeriInTesto = lista.filter(c => TESTO.has(c.chiave) && c.im).map(c => c.chiave);
    expect(numeriInTesto, 'campi di testo con il tastierino numerico').toEqual([]);
    // i casi del compito
    expect(visti.get('data-k=pausa').im).toBe('numeric'); expect(visti.get('data-k=ore').im).toBe('decimal');
    for (const k of ['data-x=pernN', 'data-x=pastiN', 'data-x=allegati']) expect(visti.get(k).im).toBe('numeric');
    expect(visti.get('data-x=tariffaData')).toMatchObject({ type: 'text', im: '', ph: 'es. gennaio 2026' });
    expect(await page.evaluate(() => ['pf-cf', 'pf-targa', 'pjA-cf'].map(id => document.getElementById(id).getAttribute('autocapitalize')))).toEqual(['characters', 'characters', 'characters']);
    expect(errori).toEqual([]);
  });
});

const LAVORO = () => { const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Ditta di prova'; l.dal = '2026-01-01';
  for (const d of [1, 2, 3, 4, 5]) l.settimana[d] = { da: '09:00', a: '17:00', pausa: '60' };
  l.paga = { tipo: 'mensile', importo: '2000', divisore: '' }; D().lavori[l.id] = l; changed(); return l.id; };

test.describe('24c.7 · D-142: "1.680" scritto adesso nella busta', () => {
  test('"1.680" nel netto si salva 1680 con "Letto come 1.680,00 €"; "1.260,00" e "1 260" mostrano come sono stati letti; "1260" niente', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await accedi(page);
    const lid = await page.evaluate(LAVORO);
    await page.evaluate(lid => Stip15.apriBusta(lid, '2026-10'), lid); await page.click('#bpManuale');
    const letto = page.locator('#bpL-netto');
    await page.fill('#bp-netto', '1.680'); await page.locator('#bp-netto').blur();
    await expect(letto).toBeVisible(); await expect(letto).toHaveText('Letto come 1.680,00 €');
    await expect(page.locator('#bp-netto')).not.toHaveClass(/nonvale/); await expect(page.locator('#bpNum')).toBeHidden();
    await page.fill('#bp-lordo', '1 260'); await expect(page.locator('#bpL-lordo')).toHaveText('Letto come 1.260,00 €');
    await page.fill('#bp-lordo', '2.400,50'); await expect(page.locator('#bpL-lordo')).toHaveText('Letto come 2.400,50 €');
    await page.fill('#bp-lordo', '2400'); await expect(page.locator('#bpL-lordo')).toBeHidden();
    await page.fill('#bp-contribLav', '1.234'); await expect(page.locator('#bpL-contribLav')).toHaveText('Letto come 1.234,00 €');
    // nei saldi (non sono euro) "1.680" resta da riscrivere
    await page.fill('#bp-ferie', '1.680'); await page.locator('#bp-ferie').blur();
    await expect(page.locator('#bp-ferie')).toHaveClass(/nonvale/);
    await page.fill('#bp-ferie', '12');
    await page.click('#bpSave'); await expect(page.locator('#bpModal')).toBeHidden();
    expect(await page.evaluate(lid => { const b = D().buste[lid + '|2026-10']; return [b.netto, b.lordo, b.contribLav, b.ferie]; }, lid)).toEqual(['1680', '2400', '1234', '12']);
    expect(errori).toEqual([]);
  });

  test('un "1.680" salvato da una versione vecchia resta come nella 24c.6: campo vuoto con il bordo rosso, niente "Letto come", Drive non cambia', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await accedi(page);
    const lid = await page.evaluate(LAVORO);
    await page.evaluate(lid => { D().buste = { [lid + '|2026-10']: { lid, mese: '2026-10', lordo: '', trattenute: '', netto: '1.680', updatedAt: 1 } }; changed(); }, lid);
    await page.evaluate(lid => Stip15.apriBusta(lid, '2026-10', true), lid);
    await expect(page.locator('#bp-netto')).toHaveValue(''); await expect(page.locator('#bp-netto')).toHaveClass(/nonvale/);
    await expect(page.locator('#bpL-netto')).toBeHidden();
    await expect(page.locator('#bpNum')).toContainText('Netto: qui c\'era «1.680»');
    await page.click('#bpSave');
    expect(await page.evaluate(lid => D().buste[lid + '|2026-10'].netto, lid)).toBe('1.680');
    expect(errori).toEqual([]);
  });
});

test.describe('24c.7 · D-142: pagamenti con la data dopo oggi anche in Tasse e ricevute', () => {
  test('oggi 3/11, compenso di novembre segnato "entrato il 5/12": Tasse "previsto" a novembre e niente a dicembre; dal 5/12 conta a dicembre', async ({ browser }) => {
    for (const [ora, atteso] of [['2026-11-03T10:00:00+01:00', { mi: '2026-11', data: null, pagOk: false, dic: 0, dicTasse: 0, novTasse: 40 }], ['2026-12-05T10:00:00+01:00', { mi: '2026-12', data: '2026-12-05', pagOk: true, dic: 1, dicTasse: 40, novTasse: 0 }]]) {
      const { page, errori } = await telefono(browser, ora);
      const v = await page.evaluate(() => {
        const p = nuovoProgetto({ nome: 'Squadra' }); p.ore.attivo = true; p.ore.tariffa = '20'; p.ore.fasce = [{ nome: 'Allenamento', da: '17:00', a: '19:00' }]; D().progetti[p.id] = p;
        D().eventi = { e1: { id: 'e1', pid: p.id, data: '2026-11-02', tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '40', rimborso: false, spese: [], created: 1, updatedAt: 1 } };
        const k = `${p.id}|2026-11|o`; pagamenti()[k] = { pagato: true, data: '2026-12-05', importo: 40, updatedAt: 1 }; changed();
        const el = elencoPagamenti('2026').filter(i => i.pid === p.id && i.tp === 'o');
        const A = aggrega('2026');
        return { dicTasse: A.mesi[11].lordo, novTasse: A.mesi[10].lordo, n: el.length, mi: el[0] && el[0].mi, data: el[0] ? el[0].data : undefined, pagOk: pagOk(pagamenti()[k]), dic: el.filter(i => i.mi === '2026-12' && i.data).length,
          incasso: meseIncasso(p.id, '2026-11', 'o') };
      });
      expect(v).toMatchObject({ n: 1, ...atteso, incasso: atteso.mi });
      expect(errori).toEqual([]);
    }
  });
});
