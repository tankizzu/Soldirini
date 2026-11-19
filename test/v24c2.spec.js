// 24c.2 (campagna calcoli, prima parte): D-118 nell'interfaccia. A turni Permesso e Assenza non pagata si salvano
// anche senza ore, nella finestra del turno e in Nuova attività, con il testo 1e; a orario fisso le ore restano obbligatorie.
// Orologio fisso al 17/11/2026. Dati inventati.
const { test, expect } = require('./helpers/prova');
const { DriveFinto, nuovoDispositivo, accedi } = require('./helpers/app');

const OGGI = '2026-11-17T10:00:00+01:00';
async function telefono(browser) {
  const d = await nuovoDispositivo(browser, { drive: new DriveFinto(), ora: OGGI }); await accedi(d.page);
  await d.page.waitForFunction(() => window.Entrate && window.Stip15 && window.Pensione); return d;
}
// due lavori: "lt" a turni (Ore di una giornata 8, con l'Assenza non pagata) e "lf" a orario fisso
const LAVORI = page => page.evaluate(() => {
  const lt = Stip15.nuovoLavoro('turni'); lt.id = 'lt'; lt.nome = 'Reparto'; lt.oreGiorno = '8';
  lt.tipi.push({ id: 'nr', nome: 'Assenza non pagata', sigla: 'NP', icona: '', cat: 'nonretr', colore: '#8a8f98', pausa: '', ore: '' });
  const lf = Stip15.nuovoLavoro('fisso'); lf.id = 'lf'; lf.nome = 'Ufficio'; lf.ordine = 1;
  D().lavori = { lt, lf }; D().turni = {}; changed();
});
const turniDel = (page, lid) => page.evaluate(lid => Object.values(D().turni || {}).filter(t => t.lid === lid && !t.deleted)
  .map(t => ({ data: t.data, cat: D().lavori[lid].tipi.find(x => x.id === t.tipo)?.cat, ore: t.ore })), lid);
const idTipo = (page, lid, cat) => page.evaluate(([lid, cat]) => D().lavori[lid].tipi.find(x => x.cat === cat).id, [lid, cat]);

test.describe('24c.2 · D-118: Permesso e Assenza non pagata senza ore a turni', () => {
  test('finestra del turno: a turni si salvano senza ore con il testo 1e; a orario fisso il permesso chiede ancora le ore', async ({ browser }) => {
    const { page, errori } = await telefono(browser); await LAVORI(page);
    const RIGA = 'Se scrivi le ore o «dalle–alle», conta solo quella parte e i turni di lavoro restano.';
    for (const [cat, data] of [['permesso', '2026-11-04'], ['nonretr', '2026-11-05']]) {
      const tid = await idTipo(page, 'lt', cat);
      await page.evaluate(([data, tid]) => { Stip15.apriTurno([data], 'lt'); document.querySelector(`[data-tut="${tid}"]`).click(); }, [data, tid]);
      expect(await page.locator('#tuHint').innerText()).toBe('Lascia vuoto per contare una giornata intera: 8 ore. In quel caso i turni di lavoro di questo giorno non contano.\n' + RIGA);
      await page.click('#tuSave'); await expect(page.locator('#tuModal')).toBeHidden();
      await expect(page.locator('#toast')).not.toHaveClass(/err/);
    }
    expect(await turniDel(page, 'lt')).toEqual([{ data: '2026-11-04', cat: 'permesso', ore: '' }, { data: '2026-11-05', cat: 'nonretr', ore: '' }]);
    const M = await page.evaluate(() => StipCalc.calcolaMese(D().lavori.lt, Object.values(D().turni), '2026-11').T);
    expect(M).toMatchObject({ perm: 8, nonretr: 8, senzaOre: 0 });
    // orario fisso: come prima, le ore servono
    const tf = await idTipo(page, 'lf', 'permesso');
    await page.evaluate(tf => { Stip15.apriTurno(['2026-11-06'], 'lf'); document.querySelector(`[data-tut="${tf}"]`).click(); }, tf);
    await expect(page.locator('#tuHint')).toHaveText('Scrivi le ore (oppure dalle–alle).');
    await page.click('#tuSave'); await expect(page.locator('#toast')).toHaveText('Scrivi quante ore (oppure dalle–alle).');
    await expect(page.locator('#tuModal')).toBeVisible();
    expect(await turniDel(page, 'lf')).toEqual([]);
    expect(errori).toEqual([]);
  });

  test('Nuova attività: a turni il Permesso senza ore si salva, con "Lascia vuote le ore…"; a orario fisso no', async ({ browser }) => {
    const { page, errori } = await telefono(browser); await LAVORI(page);
    const apri = async (data, lid) => {
      await page.evaluate(([data, lid]) => { openEv([data]); const s = document.getElementById('secLav'); if (s) s.open = true; }, [data, lid]);
      if (lid === 'lf') await page.selectOption('#evLavSel', 'lf');
      await page.locator('#evLav [data-lt]').filter({ hasText: 'Permesso' }).first().click();
    };
    await apri('2026-11-04', 'lt');
    await expect(page.locator('#evLav p.muted.sm').last()).toHaveText(/^Lascia vuote le ore per contare una giornata intera: 8 ore\. In quel caso i turni di lavoro di questo giorno non contano\./);
    await page.click('#evSave'); await expect(page.locator('#evModal')).toBeHidden();
    expect(await turniDel(page, 'lt')).toEqual([{ data: '2026-11-04', cat: 'permesso', ore: '' }]);
    await apri('2026-11-06', 'lf');
    await expect(page.locator('#evLav p.muted.sm').last()).toHaveText('Scrivi le ore (oppure dalle–alle).');
    await page.click('#evSave'); await expect(page.locator('#toast')).toHaveText('Lavoro: scrivi quante ore.');
    expect(await turniDel(page, 'lf')).toEqual([]);
    expect(errori).toEqual([]);
  });

  test('note grafiche (D-106): importi con il punto delle migliaia; "· lavoro dipendente" accanto al nome, non su una riga a sé', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(() => { const lf = Stip15.nuovoLavoro('fisso'); lf.id = 'lf'; lf.nome = 'Ospedale civile di prova, reparto'; lf.paga = { tipo: 'mensile', importo: '1680', divisore: 168 };
      for (const d of [1, 2, 3, 4, 5]) lf.settimana[d] = { da: '09:00', a: '18:00', pausa: '60' }; D().lavori = { lf }; changed();
      cur = '2026-11'; rieMode = 'mese'; tab = 'rie'; render(); vaiA('dlav'); });
    expect(await page.evaluate(() => [eur(1500), eur(15000), eur(950), eur(-1234.5)])).toEqual(['1.500,00 €', '15.000,00 €', '950,00 €', '-1.234,50 €']);
    const sm = page.locator('#rieLav details.lavcard > summary');
    await expect(sm.locator('.sum')).toHaveText('1.680,00 €');
    const pos = await sm.locator('.st').evaluate(st => { const n = st.querySelector(':scope > span'), s = n.querySelector('small'); const r = n.getClientRects(), q = s.getClientRects();
      const u = r[r.length - 1], e = q[q.length - 1]; return { dentro: !!s, stessaRiga: e.top >= u.top - 1 && e.bottom <= u.bottom + 1, righe: r.length }; });
    expect(pos.dentro).toBe(true);
    expect(pos.stessaRiga).toBe(true); // l'etichetta chiude il testo del nome, sulla sua ultima riga
    const pallino = await sm.locator('.st').evaluate(st => { const i = st.querySelector(':scope > i').getBoundingClientRect(), n = st.querySelector(':scope > span').getClientRects()[0];
      return i.right <= n.left && i.bottom > n.top; });
    expect(pallino).toBe(true); // il pallino resta a sinistra del nome, non su una riga a sé
    await expect(page.locator('#rieLav details.lavcard')).toContainText('Lordo stimato1.680,00 €');
    expect(errori).toEqual([]);
  });
});
