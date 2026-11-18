// 24.2: riquadro del Riepilogo riducibile (D-085) e id del progetto protetto con esc() in tutti gli attributi (D-086 punto 3, prova di 03).
// Orologio fisso al 17/11/2026. Dati inventati.
const { test, expect } = require('./helpers/prova');
const { DriveFinto, nuovoDispositivo } = require('./helpers/app');

const OGGI = '2026-11-17T10:00:00+01:00';
const pronto = page => page.waitForFunction(() => window.Entrate && window.Stip15 && window.FissaEv);
async function telefono(browser, o = {}) { const d = await nuovoDispositivo(browser, { drive: new DriveFinto(), ora: OGGI, ...o }); await pronto(d.page); return d; }
const vaiRie = (page, ym = '2026-11', modo = 'mese') => page.evaluate(([ym, modo]) => { cur = ym; rieMode = modo; tab = 'rie'; render(); }, [ym, modo]);

// un lavoro (busta di ottobre 1.500, entrata il 10/11), un progetto con un compenso di 300 entrato il 05/11, tre uscite fisse e due spese
const DATI = () => {
  const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Reparto'; l.dal = '2026-11-01';
  for (const d of [1, 2, 3, 4, 5]) l.settimana[d] = { da: '09:00', a: '17:00', pausa: '60' };
  l.paga = { tipo: 'mensile', importo: '2000', divisore: '' }; l.tratt = '26'; D().lavori = { [l.id]: l };
  D().buste = { [`${l.id}|2026-10`]: { lid: l.id, mese: '2026-10', lordo: '', trattenute: '', netto: '1500', updatedAt: 1 } };
  D().fissi = {}; for (const [nome, imp, g] of [['Affitto', 450, 3], ['Netflix', 13, 27], ['Assicurazione', 107, 30]]) { const id = uid(); D().fissi[id] = { id, nome, cat: 'altro', importo: String(imp), giorno: String(g), dal: '2026-10', al: '', rate: '', updatedAt: 1 }; }
  D().spesePers = {}; for (const [d, i] of [['2026-11-04', 50], ['2026-11-12', 30]]) { const id = uid(); D().spesePers[id] = { id, data: d, cat: 'bar', importo: String(i), nota: '', created: 1, updatedAt: 1 }; }
  D().entrate = { 'v24|risposta': { risposta: 'no', updatedAt: 1 }, [`lav|${l.id}|2026-10`]: { entrato: true, data: '2026-11-10', importo: 1500, updatedAt: 1 } };
  const p = nuovoProgetto(); p.nome = 'Squadra'; p.ore.attivo = true; D().progetti = { [p.id]: p }; const id = uid();
  D().eventi = { [id]: { id, pid: p.id, data: '2026-10-12', tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '375', rimborso: false, spese: [], created: 1, updatedAt: 1 } };
  D().pagamenti = { [`${p.id}|2026-10|o`]: { pagato: true, data: '2026-11-05', importo: 300, updatedAt: 1 } };
  changed();
};
const caselle = page => page.locator('#heroDet > * > small:first-child').allTextContents();

test.describe('24.2 · riquadro del Riepilogo riducibile (D-085)', () => {
  test('chiuso all\'avvio: "Soldi rimanenti", importo, "Entrate · Uscite"; un tocco apre le caselle (Uscite fisse e Spese giornaliere prima), un altro le chiude', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(DATI); await vaiRie(page);
    const hero = page.locator('#rieTot .hero'), rim = hero.locator('button.rim'), det = page.locator('#heroDet');
    const conti = await page.evaluate(() => contiMese('2026-11'));
    expect([conti.entrate, conti.usciti, conti.rimanenti]).toEqual([1800, 650, 1150]); // il calcolo non cambia (stessi numeri della v24, T-R1)
    // chiuso
    await expect(rim.locator('.tit')).toHaveText('Soldi rimanenti');
    await expect(rim).not.toContainText('del mese');
    await expect(rim).not.toContainText(':');
    await expect(rim.locator('b')).toHaveText('1150,00 €');
    await expect(rim.locator('.det')).toHaveText('Entrate 1800,00 € · Uscite 650,00 €');
    await expect(det).toBeHidden();
    await expect(rim).toHaveAttribute('aria-expanded', 'false');
    await expect(rim).toHaveAttribute('aria-controls', 'heroDet');
    await expect(rim.locator('.vh')).toHaveText(', dettagli'); // 24.2b (02): testo fisso, lo stato è solo aria-expanded
    await expect(rim.locator('.hchev')).toHaveCount(0); // 24b.1 (D-098 punto 2): niente freccia, si tocca la parte grande
    await expect(page.locator('#rieTot .hero button:visible')).toHaveCount(1); // un solo pulsante visibile (il riquadro) finché è chiuso
    const box = await rim.boundingBox(); expect(box.height).toBeGreaterThanOrEqual(44);
    // aperto
    await rim.click();
    await expect(det).toBeVisible();
    await expect(rim).toHaveAttribute('aria-expanded', 'true');
    await expect(rim.locator('.vh')).toHaveText(', dettagli');
    expect(await rim.evaluate(b => b.getAttribute('aria-label'))).toBeNull(); // il nome letto è il testo visibile
    expect(await caselle(page)).toEqual(['Uscite fisse', 'Spese giornaliere', 'Lavoro dipendente', 'Rimborsi spese', 'Ritenuta d’acconto', 'Ancora da incassare']);
    await expect(det.locator('> *').nth(0).locator('b')).toHaveText('570,00 €');
    await expect(det.locator('> *').nth(1).locator('b')).toHaveText('80,00 €');
    await expect(hero).not.toContainText('Lavorato nei progetti');
    // "Uscite fisse" e "Spese giornaliere" grandi come "Lavoro dipendente"
    const dim = await page.evaluate(() => [...document.querySelectorAll('#heroDet > *')].map(d => [getComputedStyle(d.querySelector('b')).fontSize, Math.round(d.getBoundingClientRect().height)]));
    expect(new Set(dim.map(d => d[0])).size).toBe(1);
    expect(dim[0]).toEqual(dim[2]); expect(dim[1]).toEqual(dim[2]);
    // 24b.1 (D-098 punto 3): ogni casella porta alla sua pagina di dettaglio, con "‹ Riepilogo"
    const pagine = await page.evaluate(() => [...document.querySelectorAll('#heroDet > *')].map(c => [c.tagName, c.dataset.vai]));
    expect(pagine).toEqual([['BUTTON', 'dfx'], ['BUTTON', 'dsp'], ['BUTTON', 'dlav'], ['BUTTON', 'drim'], ['BUTTON', 'drit'], ['BUTTON', 'dinc']]);
    await det.locator('> *').nth(2).click();
    await expect(page.locator('#v-dlav')).toBeVisible(); await expect(page.locator('#v-rie')).toBeHidden();
    await expect(page.locator('#v-dlav h2')).toHaveText('Lavoro dipendente'); await expect(page.locator('#v-dlav .pgper')).toHaveText('novembre 2026');
    await page.locator('#v-dlav .back').click();
    await expect(page.locator('#v-rie')).toBeVisible();
    // un tocco sul riquadro (non su una casella) lo richiude
    await rim.click();
    await expect(det).toBeHidden();
    // da tastiera
    await rim.focus(); await page.keyboard.press('Enter');
    await expect(det).toBeVisible();
    await page.keyboard.press('Space');
    await expect(det).toBeHidden();
    // resta come l'ha lasciato l'utente cambiando mese; si richiude riaprendo l'app (D-010)
    await rim.click(); await page.evaluate(() => $('rNext').click());
    await expect(page.locator('#heroDet')).toBeVisible();
    await page.reload(); await pronto(page); await vaiRie(page);
    await expect(page.locator('#heroDet')).toBeHidden();
    await expect(page.locator('#rieTot .hero button.rim')).toHaveAttribute('aria-expanded', 'false');
    expect(errori).toEqual([]);
  });

  test('vista Anno (D-092): "Soldi rimanenti" con "somma dei mesi da gennaio a novembre"; aperto "Incassato dai progetti" dopo Pensione e la riga di dicembre con la nota', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(DATI); await vaiRie(page, '2026-11', 'anno');
    const rim = page.locator('#rieTot .hero button.rim');
    await expect(rim.locator('.tit')).toHaveText('Soldi rimanenti');
    await expect(rim.locator('.dm')).toHaveText('somma dei mesi da gennaio a novembre');
    await expect(page.locator('#heroDet')).toBeHidden();
    await rim.click();
    expect(await caselle(page)).toEqual(['Uscite fisse', 'Spese giornaliere', 'Lavoro dipendente', 'Incassato dai progetti', 'Rimborsi spese', 'Ritenuta d’acconto', 'Ancora da incassare', 'Uscite fisse ancora da addebitare entro dicembre']);
    await expect(page.locator('#heroDet > .lungo small.nota')).toHaveText('Non contate nei soldi rimanenti: dicembre non è ancora iniziato.');
    await expect(page.locator('#heroDet > .lungo b')).toHaveText('570,00 €');
    expect(errori).toEqual([]);
  });

  test('soldi rimanenti sotto zero: importo in rosso anche a riquadro chiuso; senza uscite fisse niente casella "Uscite fisse"', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(() => { D().fissi = {}; const id = uid(); D().spesePers = { [id]: { id, data: '2026-11-04', cat: 'bar', importo: '90', nota: '', created: 1, updatedAt: 1 } };
      D().entrate = { 'v24|risposta': { risposta: 'no', updatedAt: 1 } }; changed(); });
    await vaiRie(page);
    const rim = page.locator('#rieTot .hero button.rim');
    await expect(rim).toHaveClass(/neg/);
    await expect(rim.locator('b')).toHaveText('−90,00 €'); // segno "−" (02)
    expect(await rim.locator('b').evaluate(b => getComputedStyle(b).color)).toBe('rgb(255, 180, 171)'); // #ffb4ab
    await rim.click();
    expect(await caselle(page)).toEqual(['Spese giornaliere', 'Rimborsi spese', 'Ritenuta d’acconto', 'Ancora da incassare']);
    // numero pari di caselle: nessuna su tutta la larghezza; con un lavoro diventano 5 e l'ultima occupa tutta la riga (02)
    await expect(page.locator('#heroDet > .dispari')).toHaveCount(0);
    await page.evaluate(() => { const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Reparto'; D().lavori = { [l.id]: l }; changed(); render(); }); // resta aperto
    const w = await page.evaluate(() => { const c = [...document.querySelectorAll('#heroDet > *')]; return [c.length, c.at(-1).classList.contains('dispari'), Math.round(c.at(-1).getBoundingClientRect().width), Math.round(c[0].getBoundingClientRect().width)]; });
    expect(w[0]).toBe(5); expect(w[1]).toBe(true); expect(w[2]).toBeGreaterThan(w[3] * 1.8);
    expect(errori).toEqual([]);
  });
});

test.describe('24.2 · id del progetto con HTML (D-086 punto 3, prova di 03)', () => {
  test('l\'id compare intero come testo negli attributi di Documenti, menu, filtri, Progetti, Cestino e Certificazioni; nessun elemento aggiunto nella pagina', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    const ID = 'p"><b id="iniettato">x</b><a href="https://esempio.invalid">y</a>';
    await page.evaluate(ID => {
      D().entrate = { 'v24|risposta': { risposta: 'no', updatedAt: 1 } };
      const p = nuovoProgetto(); p.id = ID; p.nome = 'Squadra'; p.ore.attivo = true; p.rimborso.attivo = true;
      p.docTpl = { file: 'finto', kind: 'docx', titolo: 'Ricevuta', map: [] };
      const q = nuovoProgetto(); q.nome = 'Altro'; q.ore.attivo = false; q.rimborso.attivo = false;
      const c = nuovoProgetto(); c.id = ID + 'c'; c.nome = 'Eliminato'; c.deleted = true; c.deletedAt = Date.now() - 1000;
      D().progetti = { [p.id]: p, [q.id]: q, [c.id]: c };
      D().eventi = { e1: { id: 'e1', pid: ID, data: '2026-10-12', tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '375', rimborso: true, km: '12', spese: [], created: 1, updatedAt: 1 } };
      changed();
    }, ID);
    const pagine = [
      () => { cur = '2026-10'; tab = 'cal'; render(); $('calBtn').click(); },                    // filtri del calendario: data-f e radio "cf"
      () => { $('calBtn').click(); cur = '2026-10'; tab = 'doc'; render(); },                    // Documenti: data-pid, data-pdf, data-inv, data-pdfp, data-invo, data-fid, data-wmese, data-wdata, data-wdoc, data-winv
      () => { tab = 'pro'; render(); },                                                          // Progetti e Cestino: data-proj, data-rip
      () => { tab = 'tas'; render(); openCU(null); },                                            // Certificazioni: menu cuPid
      () => { openEv(['2026-10-12'], D().eventi.e1); },                                         // finestra attività: data-pid
    ];
    const attr = ['data-f', 'data-pid', 'data-proj', 'data-xcust', 'data-pdf', 'data-inv', 'data-pdfp', 'data-invo', 'value', 'data-rip', 'data-fid', 'data-wmese', 'data-wdata', 'data-wdoc', 'data-winv', 'data-wdrive', 'data-fold'];
    const visti = new Set();
    for (const f of pagine) {
      const r = await page.evaluate(([f, ID, attr]) => { (0, eval)('(' + f + ')')();
        const out = { estranei: document.querySelectorAll('#iniettato, a[href="https://esempio.invalid"]').length, trovati: [] };
        for (const a of attr) for (const el of document.querySelectorAll(`[${a}]`)) { const v = el.getAttribute(a); if (v.includes('iniettato')) out.trovati.push([a, v.replace(ID, '{ID}')]); }
        return out; }, [f.toString(), ID, attr]);
      expect(r.estranei).toBe(0);
      for (const [a, v] of r.trovati) { expect(['{ID}', '{ID}c', 'doc:word-{ID}', '{ID}|2026-10']).toContain(v); visti.add(a); }
    }
    // data-f (renderCal) è sostituito subito dal filtro di soldi.js (radio "cf", value); data-fid diventa data-fold con foldify (dataset, senza HTML)
    expect([...visti].sort()).toEqual(['data-fold', 'data-inv', 'data-invo', 'data-pdf', 'data-pdfp', 'data-pid', 'data-proj', 'data-rip', 'data-wdata', 'data-wdoc', 'data-winv', 'data-wmese', 'value']);
    // le ricerche con l'id (data del documento, sezioni aperte in Documenti) trovano l'elemento invece di andare in errore
    const ricerche = await page.evaluate(ID => { document.querySelectorAll('.modal:not([hidden])').forEach(m => m.hidden = true); cur = '2026-10'; tab = 'doc'; render();
      const d = document.querySelector(`#docList details[data-pid="${CSS.escape(ID)}"]`); d.open = true; renderDocSoft();
      return [!!document.querySelector(`[data-wdata="${CSS.escape(ID)}"]`), document.querySelector(`#docList details[data-pid="${CSS.escape(ID)}"]`).open]; }, ID);
    expect(ricerche).toEqual([true, true]);
    expect(errori).toEqual([]);
  });
});

test.describe('24.2b · id delle altre voci con HTML (D-091 punto 3)', () => {
  test('lavori, tipi di turno, turni, uscite fisse, eventi, fasce, obiettivi, movimenti, spese e CU: id interi come testo negli attributi, nessun elemento aggiunto', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    const X = n => `x${n}"><b id="inj${n}">y</b><a href="https://esempio.invalid">z</a>`;
    const ID = { lav: X('L'), tipo: X('T'), turno: X('V'), fisso: X('F'), ev: X('E'), evDel: X('D'), fascia: X('A'), ob: X('O'), mv: X('M'), sp: X('S'), cu: X('C') };
    await page.evaluate(ID => {
      D().entrate = { 'v24|risposta': { risposta: 'no', updatedAt: 1 } };
      const l = Stip15.nuovoLavoro('turni'); l.id = ID.lav; l.nome = 'Reparto'; l.dal = '2026-01-01'; l.tipi[0].id = ID.tipo; D().lavori = { [l.id]: l };
      D().turni = { [ID.turno]: { id: ID.turno, lid: ID.lav, data: '2026-11-10', tipo: ID.tipo, updatedAt: 1 } };
      D().fissi = { [ID.fisso]: { id: ID.fisso, nome: 'Affitto', cat: 'altro', importo: '450', giorno: '3', dal: '2026-10', al: '', rate: '', updatedAt: 1 } };
      const p = nuovoProgetto(); p.nome = 'Squadra'; p.ore.attivo = true; p.ore.fasce = [{ id: ID.fascia, nome: 'Sera', da: '18:00', a: '20:00' }]; D().progetti = { [p.id]: p };
      const ev = (id, o) => Object.assign({ id, pid: p.id, data: '2026-11-10', tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '50', rimborso: false, spese: [], created: 1, updatedAt: 1 }, o);
      D().eventi = { [ID.ev]: ev(ID.ev, { stato: 'previsto' }), [ID.evDel]: ev(ID.evDel, { deleted: true, deletedAt: Date.now() - 1000 }) };
      D().risparmi = { ['ob:' + ID.ob]: { nome: 'Viaggio', target: '500', entro: '', updatedAt: 1 }, ['mv:' + ID.mv]: { data: '2026-11-01', importo: '10', ob: ID.ob, nota: '', updatedAt: 1 } };
      D().spesePers = { [ID.sp]: { id: ID.sp, data: '2026-11-10', cat: 'bar', importo: '4', nota: '', created: 1, updatedAt: 1 } };
      D().cu = { [ID.cu]: { id: ID.cu, tipo: 'autonomo', anno: 2026, comm: 'Società', pid: '', updatedAt: 1 } };
      changed();
    }, ID);
    const passi = [
      () => { tab = 'pro'; render(); },                                             // lavori, uscite fisse, cestino
      () => { tab = 'tas'; cur = '2026-11'; render(); },                            // CU
      () => { tab = 'rie'; cur = '2026-11'; rieMode = 'mese'; render(); },          // scheda del lavoro
      () => { tab = 'ris'; render(); },                                             // obiettivi e movimenti
      () => { tab = 'cal'; cur = '2026-11'; render(); $('calBtn').click(); },       // filtro del calendario (lavori)
      () => { $('calBtn').click(); apriGiorno('2026-11-10'); },                     // giorno: turni, spese, attività
      () => { document.querySelectorAll('.modal').forEach(m => m.hidden = true); renderConfermare && renderConfermare(); }, // da confermare
      () => { openEv(['2026-11-10'], Object.values(D().eventi).find(e => e.stato === 'previsto')); }, // finestra attività: fasce
    ];
    const visti = new Set();
    for (const f of passi) {
      const r = await page.evaluate(([f, ids]) => { (0, eval)('(' + f + ')')();
        const out = { estranei: document.querySelectorAll('[id^="inj"], a[href="https://esempio.invalid"]').length, sbagliati: [], attr: [] };
        for (const el of document.querySelectorAll('*')) for (const a of el.attributes) if (a.value.includes('inj')) {
          out.attr.push(a.name); if (!ids.some(i => a.value.includes(i))) out.sbagliati.push(a.name + '=' + a.value); }
        return out; }, [f.toString(), Object.values(ID)]);
      expect(r.estranei, f.toString()).toBe(0);
      expect(r.sbagliati, f.toString()).toEqual([]);
      r.attr.forEach(a => visti.add(a));
    }
    for (const a of ['data-lav', 'data-fx', 'data-rip', 'data-cuedit', 'data-fold', 'data-bpnew', 'data-bparch', 'data-obed', 'data-mved', 'data-cv', 'data-tued', 'data-spdel', 'data-ev', 'data-cok', 'data-cno', 'data-fa'])
      expect([...visti], a).toContain(a);
    expect(errori).toEqual([]);
  });
});
