// 24c.1: ritocchi di 02 (tornata 27, §1-4) e regola D-106 — oltre a testi e misure, la prova controlla colori e fondi
// delle parti nuove, nei due temi, confrontandoli con le parti dell'app che hanno accanto. Orologio fisso al 17/11/2026. Dati inventati.
const { test, expect } = require('./helpers/prova');
const { DriveFinto, nuovoDispositivo, accedi, sincronizza } = require('./helpers/app');

const OGGI = '2026-11-17T10:00:00+01:00';
const pronto = page => page.waitForFunction(() => window.Entrate && window.Stip15 && window.Pensione);
async function telefono(browser) { const d = await nuovoDispositivo(browser, { drive: new DriveFinto(), ora: OGGI }); await pronto(d.page); return d; }
const vai = (page, t, ym = '2026-11') => page.evaluate(([t, ym]) => { cur = ym; rieMode = 'mese'; tab = 'rie'; render(); if (t !== 'rie') vaiA(t); }, [t, ym]);
const apri = async page => { if (await page.locator('#heroDet').isHidden()) await page.locator('#rieTot .rim').click(); };
const tema = (page, t) => page.evaluate(t => { document.documentElement.dataset.theme = t; }, t);
const stile = (loc, ...p) => loc.evaluate((e, p) => { const s = getComputedStyle(e); return Object.fromEntries(p.map(k => [k, s[k]])); }, p);
const vare = (page, v) => page.evaluate(v => getComputedStyle(document.documentElement).getPropertyValue(v).trim(), v);
// contrasto WCAG tra due colori "rgb(…)" letti dal navigatore
const lum = c => { const f = c.startsWith('color(') ? 1 : 255; const v = c.match(/[\d.]+/g).slice(0, 3).map(x => { x = +x / f; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const contrasto = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
// stile di un elemento creato al volo nella pagina (classi vere dell'app), per le parti che nei dati di prova non compaiono
const provaStile = (page, html, sel, props) => page.evaluate(([html, sel, props]) => { const w = document.createElement('div'); w.innerHTML = html; document.querySelector('main, body').append(w);
  const e = w.querySelector(sel); const st = getComputedStyle(e); const r = Object.fromEntries(props.map(k => [k, st[k]])); w.remove(); return r; }, [html, sel, props]);
const colMix = (page, v, pct) => page.evaluate(([v, pct]) => { const e = document.createElement('i'); e.style.background = `color-mix(in srgb,var(${v}) ${pct}%,var(--card))`; document.body.append(e); const c = getComputedStyle(e).backgroundColor; e.remove(); return c; }, [v, pct]);
const PAGINE = ['dfx', 'dsp', 'dlav', 'drim', 'drit', 'dinc', 'pen', 'ris', 'tas'];
const rgb = hex => { let h = hex.slice(1); if (h.length === 3) h = h.replace(/./g, c => c + c); const n = parseInt(h, 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };

// un lavoro senza buste (stipendio di novembre "in arrivo", stima), un progetto con un compenso da incassare, una pensione
const DATI = () => {
  const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Reparto'; l.dal = '2026-11-01';
  for (const d of [1, 2, 3, 4, 5]) l.settimana[d] = { da: '09:00', a: '17:00', pausa: '60' };
  l.paga = { tipo: 'mensile', importo: '2000', divisore: '' }; l.tratt = '26'; D().lavori = { [l.id]: l }; D().buste = {};
  const p = nuovoProgetto(); p.nome = 'Squadra'; p.ore.attivo = true; D().progetti = { [p.id]: p };
  const id = uid(); D().eventi = { [id]: { id, pid: p.id, data: '2026-10-10', tipo: 'altro', titolo: '', ore: true, fasce: [], fisso: '120', rimborso: false, spese: [], created: 1, updatedAt: 1 } };
  D().pagamenti = {}; D().fissi = {}; D().spesePers = {};
  D().pensione = { profilo: { lordoMese: '1000', dal: '2026-10', annoNascita: '1956', anniContributi: '30', prima: 'dipendente', updatedAt: 1 } };
  D().entrate = { 'v24|risposta': { risposta: 'no', updatedAt: 1 } }; changed();
};

for (const t of ['light', 'dark']) {
  test.describe(`24c.1 · tema ${t === 'light' ? 'chiaro' : 'scuro'}`, () => {
    test('§1 frase "Mi dispiace che non hai entrate": non sembra una casella (niente fondo, bordo tratteggiato, stessa altezza e raggio)', async ({ browser }) => {
      const { page, errori } = await telefono(browser); await tema(page, t);
      await page.evaluate(() => { D().entrate = { 'v24|risposta': { risposta: 'no', updatedAt: 1 } }; const id = uid(); D().fissi = { [id]: { id, nome: 'Affitto', cat: 'altro', importo: '450', giorno: '3', dal: '2026-10', al: '', rate: '', updatedAt: 1 } }; changed(); });
      await vai(page, 'rie'); await apri(page);
      const f = page.locator('#heroDet > p.nient');
      await expect(f).toHaveText('🙁Mi dispiace che non hai entrate');
      await expect(f.locator('.em')).toHaveAttribute('aria-hidden', 'true');
      const s = await stile(f, 'backgroundColor', 'borderTopStyle', 'borderTopColor', 'borderRadius', 'minHeight', 'color', 'gridColumnStart', 'gridColumnEnd');
      expect(s).toEqual({ backgroundColor: 'rgba(0, 0, 0, 0)', borderTopStyle: 'dashed', borderTopColor: 'rgba(255, 255, 255, 0.28)', borderRadius: '11px', minHeight: '58px', color: 'rgba(255, 255, 255, 0.92)', gridColumnStart: '1', gridColumnEnd: '-1' });
      // la casella accanto è un pulsante con il fondo pieno del riquadro: le due si distinguono
      const c = await stile(page.locator('#heroDet > button.hcel').first(), 'backgroundColor', 'borderRadius', 'minHeight');
      expect(c).toEqual({ backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '11px', minHeight: '58px' });
      expect(errori).toEqual([]);
    });

    test('§2 "Compensi non ancora entrati": testa come i pulsanti Tasse e Risparmi, clessidra a linea, "in tutto", [Entrati] da 44 px con etichetta', async ({ browser }) => {
      const { page, errori } = await telefono(browser); await tema(page, t); await page.evaluate(DATI);
      await vai(page, 'rie');
      const sc = page.locator('#rieIn section.insub');
      await expect(sc).toHaveAttribute('aria-labelledby', 'inCmpT');
      await expect(sc.locator('#inCmpT')).toHaveText('Compensi non ancora entrati');
      await expect(sc.locator('.inhead small')).toHaveText('96,00 € in tutto · non contati nei soldi rimanenti');
      await expect(sc.locator('.inhead .ico svg')).toHaveCount(1); await expect(sc.locator('.inhead')).not.toContainText('⏳');
      await expect(sc).not.toContainText('›');
      // colori e fondi: la scheda ha il fondo, il bordo e il raggio delle altre schede; il quadrato ha il colore di "Ancora da incassare" e il disegno bianco come Tasse
      const card = await stile(sc, 'backgroundColor', 'borderTopColor', 'borderRadius');
      expect(card).toEqual({ backgroundColor: rgb(await vare(page, '--card')), borderTopColor: rgb(await vare(page, '--line')), borderRadius: (await stile(page.locator('.card').first(), 'borderRadius')).borderRadius });
      const ico = await stile(sc.locator('.inhead .ico'), 'backgroundColor', 'color', 'width', 'height', 'borderRadius');
      const tas = await stile(page.locator('.subnav button[data-goto="tas"] .ico'), 'color', 'width', 'height', 'borderRadius');
      expect(ico).toEqual({ backgroundColor: 'rgb(119, 106, 82)', ...tas });
      const riga = sc.locator('.ir').first();
      await expect(riga.locator('.tx b')).toHaveText('Compensi di ottobre'); await expect(riga.locator('.tx small')).toHaveText('Squadra · previsti a ottobre'); // "previsti a" c'era già: resta
      await expect(riga.locator('.imp')).toHaveText('96,00 €');
      const b = riga.locator('button');
      await expect(b).toHaveText('Entrati'); await expect(b).toHaveAttribute('aria-label', 'Segna come entrati i compensi di ottobre, Squadra');
      expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
      // [Entrati] è un pulsante "ghost" come gli altri dell'app: fondo trasparente, testo normale
      const ghost = await page.evaluate(() => { const x = document.createElement('button'); x.className = 'btn sm ghost'; document.body.append(x); const s = getComputedStyle(x); const r = [s.backgroundColor, s.color]; x.remove(); return r; });
      expect(await b.evaluate(e => [getComputedStyle(e).backgroundColor, getComputedStyle(e).color])).toEqual(ghost);
      expect(errori).toEqual([]);
    });

    test('§3 "In arrivo" in Lavoro dipendente e Pensione; §4 nota nella casella a 0,00 €', async ({ browser }) => {
      const { page, errori } = await telefono(browser); await tema(page, t); await page.evaluate(DATI);
      // §4: lo stipendio di novembre non è entrato → casella a 0,00 € con la nota, senza importo
      await vai(page, 'rie'); await apri(page);
      const cl = page.locator('#heroDet > button.hcel').filter({ hasText: 'Lavoro dipendente' });
      await expect(cl.locator('b')).toHaveText('0,00 €'); await expect(cl.locator('small.nota')).toHaveText('stipendio in arrivo');
      const cp = page.locator('#heroDet > button.hcel').filter({ hasText: 'Pensione' });
      await expect(cp.locator('small.nota')).toHaveText('pensione in arrivo');
      // §3: pagina Lavoro dipendente, subito sotto la testata
      await vai(page, 'dlav');
      expect(await page.evaluate(() => document.querySelector('#v-dlav .testa').nextElementSibling.id)).toBe('lavIn');
      const s = page.locator('#lavIn section.inarr');
      await expect(s.locator('h3')).toHaveText('In arrivo · non contato nei soldi rimanenti');
      expect((await stile(s.locator('h3 small'), 'color')).color).toBe(rgb(await vare(page, '--mut')));
      const r = s.locator('.ir').filter({ hasText: 'Stipendio di novembre' });
      await expect(r.locator('.tx small').first()).toHaveText('Reparto · stima');
      const b = r.locator('button');
      await expect(b).toHaveAttribute('aria-label', 'Stipendio di novembre, Reparto: è entrato');
      expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
      // pulsante pieno: stesso fondo e testo dei pulsanti principali dell'app (--pri / --pri-ink)
      expect(await stile(b, 'backgroundColor', 'color')).toEqual({ backgroundColor: rgb(await vare(page, '--pri')), color: rgb(await vare(page, '--pri-ink')) });
      // pagina Pensione
      await vai(page, 'pen');
      const p = page.locator('#penIn .ir').filter({ hasText: 'Pensione di novembre' });
      await expect(p.locator('.tx small').first()).toHaveText('stima');
      await expect(p.locator('button')).toHaveAttribute('aria-label', 'Pensione di novembre: è entrata');
      expect(errori).toEqual([]);
    });

    test('D-112: "Indietro" è un vero pulsante in tutte le pagine dei blocchi (fondo, bordo, ombra, raggio 11, 44 px, freccia a linea)', async ({ browser }) => {
      const { page, errori } = await telefono(browser); await tema(page, t);
      const ombra = await page.evaluate(() => { const e = document.createElement('i'); e.style.boxShadow = 'var(--shadow)'; document.body.append(e); const v = getComputedStyle(e).boxShadow; e.remove(); return v; });
      for (const p of PAGINE) {
        await vai(page, p);
        const b = page.locator(`#v-${p} > .back`);
        await expect(b).toBeVisible(); await expect(b).toHaveText('Indietro'); await expect(b).toHaveAttribute('aria-label', 'Indietro al Riepilogo');
        await expect(b.locator('svg[aria-hidden="true"] path')).toHaveCount(1); await expect(b).toHaveClass(/indietro/);
        expect(await b.locator('svg').evaluate(e => [e.getBoundingClientRect().width, e.querySelector('path').getAttribute('d')])).toEqual([20, 'M15 5l-7 7 7 7']);
        expect(await stile(b, 'paddingLeft', 'paddingRight', 'columnGap', 'fontSize', 'fontWeight', 'animationName')).toEqual({ paddingLeft: '10px', paddingRight: '14px', columnGap: '6px', fontSize: '15px', fontWeight: '650', animationName: 'none' });
        const s = await stile(b, 'backgroundColor', 'borderTopColor', 'borderTopWidth', 'borderRadius', 'boxShadow', 'color');
        expect(s).toEqual({ backgroundColor: rgb(await vare(page, '--card')), borderTopColor: rgb(await vare(page, '--line')), borderTopWidth: '1px', borderRadius: '11px', boxShadow: ombra, color: rgb(await vare(page, '--ink')) });
        const box = await b.boundingBox(); expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44);
        expect(contrasto(s.color, s.backgroundColor)).toBeGreaterThanOrEqual(4.5);
        await b.click(); await expect.poll(() => page.evaluate(() => tab)).toBe('rie');
      }
      expect(errori).toEqual([]);
    });

    test('02 A1: le caselle-pulsante del riquadro hanno lo stesso aspetto delle caselle <div> (colonna, fondo, raggio, misure)', async ({ browser }) => {
      const { page, errori } = await telefono(browser); await tema(page, t); await page.evaluate(DATI);
      await vai(page, 'rie'); await apri(page);
      const P = ['display', 'flexDirection', 'backgroundColor', 'borderRadius', 'minHeight', 'alignItems'];
      const bt = await stile(page.locator('#heroDet > button.hcel').first(), ...P);
      const dv = await page.evaluate(P => { const d = document.createElement('div'); d.innerHTML = '<small>Prova</small><b>1,00 €</b>'; $('heroDet').append(d); const s = getComputedStyle(d);
        const r = Object.fromEntries(P.map(k => [k, s[k]])); r.small = [getComputedStyle(d.querySelector('small')).fontSize, getComputedStyle(d.querySelector('small')).opacity]; r.b = getComputedStyle(d.querySelector('b')).fontSize; d.remove(); return r; }, P);
      expect(bt).toEqual(Object.fromEntries(P.map(k => [k, dv[k]])));
      expect(bt).toMatchObject({ flexDirection: 'column', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '11px', minHeight: '58px' });
      const c = page.locator('#heroDet > button.hcel').first();
      expect([await c.locator('small').first().evaluate(e => getComputedStyle(e).fontSize), await c.locator('small').first().evaluate(e => getComputedStyle(e).opacity)]).toEqual(dv.small);
      expect(await c.locator('b').evaluate(e => getComputedStyle(e).fontSize)).toBe(dv.b);
      // A4: frecce del Riepilogo con l'etichetta
      await expect(page.locator('#rPrev')).toHaveAttribute('aria-label', 'Periodo prima'); await expect(page.locator('#rNext')).toHaveAttribute('aria-label', 'Periodo dopo');
      expect(errori).toEqual([]);
    });

    test('02 A2, M1-M5: etichette delle buste, Rimborsi, Risparmi, barra in alto, errore e "Drive in pausa" con i colori del tema', async ({ browser }) => {
      const { page, errori } = await telefono(browser); await tema(page, t);
      const ok = rgb(await vare(page, '--ok')), warn = rgb(await vare(page, '--warn'));
      // A2
      const bok = await provaStile(page, '<span class="bdg ok">Letta</span>', '.bdg', ['color', 'backgroundColor']);
      const bwa = await provaStile(page, '<span class="bdg warn">Da controllare</span>', '.bdg', ['color', 'backgroundColor']);
      expect(bok).toEqual({ color: ok, backgroundColor: await colMix(page, '--ok', 14) }); expect(bwa).toEqual({ color: warn, backgroundColor: await colMix(page, '--warn', 14) });
      expect(contrasto(bok.color, bok.backgroundColor)).toBeGreaterThanOrEqual(4.5); expect(contrasto(bwa.color, bwa.backgroundColor)).toBeGreaterThanOrEqual(4.5);
      // M1: Rimborsi spese con il colore del Riepilogo
      await vai(page, 'drim'); expect(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--sez').trim())).toBe('#6e6079');
      // M2: barre dei Risparmi
      expect((await provaStile(page, '<div class="obp"><div class="bar"><span></span></div></div>', '.bar span', ['backgroundColor'])).backgroundColor).toBe(ok);
      expect((await provaStile(page, '<div class="rbar"><span class="neg"></span></div>', 'span', ['backgroundColor'])).backgroundColor).toBe(warn);
      expect((await provaStile(page, '<div class="rbar"><span></span></div>', 'span', ['backgroundColor'])).backgroundColor).toBe(ok);
      // M3: sincronizzazione in corso e errore
      expect((await provaStile(page, '<button class="chip sync busy">…</button>', 'button', ['backgroundColor'])).backgroundColor).toBe('rgb(243, 201, 105)');
      expect((await provaStile(page, '<button class="chip sync err">!</button>', 'button', ['color', 'backgroundColor']))).toEqual({ color: 'rgb(163, 58, 40)', backgroundColor: 'rgb(253, 226, 224)' });
      // M4: messaggio di errore
      const te = await provaStile(page, '<div class="toast err">x</div>', '.toast', ['color', 'backgroundColor']);
      expect(te).toEqual({ color: 'rgb(255, 255, 255)', backgroundColor: 'rgb(163, 58, 40)' }); expect(contrasto(te.color, te.backgroundColor)).toBeGreaterThanOrEqual(4.5);
      // M5: "Drive in pausa" resta alto 32 px, ma il tocco è di 44 px
      await accedi(page); await sincronizza(page);
      await page.evaluate(() => { DB.meta.drivePausa = { gen: 1, il: '2026-11-16' }; persist(); renderSync(); });
      const sy = page.locator('#sync'); await expect(sy).toHaveClass(/pausa/);
      const h = (await sy.boundingBox()).height; expect(h).toBeLessThan(44);
      const pr = await sy.evaluate(e => { const s = getComputedStyle(e, '::before'); return { content: s.content, position: s.position, top: s.top, bottom: s.bottom }; });
      expect(pr).toEqual({ content: '""', position: 'absolute', top: '-6px', bottom: '-6px' }); expect(h + 12).toBeGreaterThanOrEqual(44);
      expect(errori).toEqual([]);
    });

    test('D-110 (testi di 02, tornata 30): campo "Ore di una giornata" dopo i tipi di turno, riquadro arancio per lavoro, testo 1e a tre varianti', async ({ browser }) => {
      const { page, errori } = await telefono(browser); await tema(page, t);
      await page.evaluate(() => { const l = Stip15.nuovoLavoro('turni'); l.id = 'lt'; l.nome = 'Turni <b>A</b>'; l.paga.importo = '10';
        const f = Stip15.nuovoLavoro('fisso'); f.id = 'lf'; f.nome = 'Ufficio'; f.settimana = { 1: { da: '09:00', a: '17:00', pausa: '60' } };
        const fe = l.tipi.find(x => x.cat === 'ferie').id, ma = l.tipi.find(x => x.cat === 'malattia').id;
        D().lavori = { lt: l, lf: f }; D().turni = { t1: { id: 't1', lid: 'lt', data: '2026-11-04', tipo: fe, updatedAt: 1 }, t2: { id: 't2', lid: 'lt', data: '2026-11-05', tipo: ma, updatedAt: 1 } };
        D().entrate = { 'v24|risposta': { risposta: 'no', updatedAt: 1 } }; changed(); });
      // §2: riquadro arancio sopra l'elenco, uno per lavoro, con il numero di giorni e il pulsante
      await vai(page, 'dlav');
      const av = page.locator('#rieLav > .avvore');
      await expect(av).toHaveCount(1); await expect(av).toHaveAttribute('data-avvore', 'lt');
      await expect(av.locator('b')).toHaveText('⚠ 2 giorni di assenza contati 0 ore');
      await expect(av.locator('p')).toHaveText('Nel lavoro «Turni <b>A</b>» manca quante ore vale una giornata. Finché manca, ferie, malattia e altre assenze senza ore non entrano nella stima né nei saldi.');
      const st = await stile(av, 'backgroundColor', 'borderTopLeftRadius');
      expect(st).toEqual({ backgroundColor: await colMix(page, '--warn', 14), borderTopLeftRadius: '12px' });
      const bt = av.locator('button'); await expect(bt).toHaveText('Scrivi le ore di una giornata'); await expect(bt).toHaveAttribute('aria-label', 'Scrivi le ore di una giornata per il lavoro Turni <b>A</b>');
      expect((await bt.boundingBox()).height).toBeGreaterThanOrEqual(44);
      // il pulsante apre la finestra del lavoro con il fuoco sul campo, nella sezione dei tipi di turno
      await bt.click();
      await expect(page.locator('#lvModal')).toBeVisible(); await expect(page.locator('#lvOreGiorno')).toBeFocused();
      const box = page.locator('#lvOreGiornoBox');
      expect(await box.evaluate(e => [e.hidden, e.closest('details').querySelector('summary').textContent, !!e.previousElementSibling && e.previousElementSibling.id])).toEqual([false, 'Tipi di turno', 'lvTipiAdd']);
      await expect(box.locator('label')).toHaveText('Ore di una giornata'); await expect(box.locator('.unita')).toHaveText('ore');
      await expect(page.locator('#lvOreGiorno')).toHaveAttribute('inputmode', 'decimal'); await expect(page.locator('#lvOreGiorno')).toHaveAttribute('placeholder', 'es. 8');
      await expect(page.locator('#lvOreGiornoNota')).toHaveText(/^Quanto vale un giorno di ferie, malattia, permesso o altra assenza quando non scrivi le ore. In quel giorno i turni di lavoro non contano\./);
      await expect(page.locator('#lvOreGiornoVuoto')).toBeHidden();
      // seconda riga solo con il campo vuoto e le ore al mese
      await page.evaluate(() => { const d = $('lvTurniBox'); d.open = true; }); await page.fill('#lvOreMese', '168');
      await expect(page.locator('#lvOreGiornoVuoto')).toBeVisible(); await expect(page.locator('#lvOreGiornoVuoto')).toHaveText('Se lo lasci vuoto, Soldirini divide le «Ore al mese oltre le quali è straordinario» per i giorni dal lunedì al venerdì del mese, senza le feste.');
      // errore alla perdita del fuoco, si toglie con un valore giusto; la virgola va bene
      await page.fill('#lvOreGiorno', '30'); await page.locator('#lvOreGiorno').blur();
      const err = page.locator('#lvOreGiornoErr'); await expect(err).toBeVisible(); await expect(err).toHaveText('Scrivi un numero di ore tra 0,5 e 24, per esempio 8 o 7,5.');
      await expect(err).toHaveAttribute('role', 'alert'); expect((await stile(err, 'color')).color).toBe(rgb(await vare(page, '--err')));
      await page.click('#lvSave'); await expect(page.locator('#lvModal')).toBeVisible(); // non si salva con un valore sbagliato
      await page.fill('#lvOreGiorno', '7,5'); await expect(err).toBeHidden(); await expect(page.locator('#lvOreGiornoVuoto')).toBeHidden();
      await page.click('#lvSave');
      expect(await page.evaluate(() => [D().lavori.lt.oreGiorno, D().lavori.lt.oreMese])).toEqual(['7,5', '168']);
      // orario fisso: niente campo
      await page.evaluate(() => { tab = 'pro'; render(); document.querySelector('[data-lav="lf"]').click(); });
      expect(await page.locator('#lvOreGiornoBox').evaluate(e => e.hidden)).toBe(true);
      await page.click('#lvClose');
      // con le ore il riquadro sparisce e le ferie valgono 7,5
      await vai(page, 'dlav'); await expect(page.locator('#rieLav > .avvore')).toHaveCount(0);
      await expect(page.locator('#rieLav [data-fold$="-lt"]')).toContainText('1 giorno di ferie');
      // §3: testo 1e, tre varianti più la riga fissa; solo per le assenze
      const RIGA = 'Se scrivi le ore o «dalle–alle», conta solo quella parte e i turni di lavoro restano.';
      const hint = async (lid, cat, data) => { await page.evaluate(([lid, cat, data]) => { const l = D().lavori[lid]; Stip15.apriTurno([data], lid); document.querySelector(`[data-tut="${l.tipi.find(x => x.cat === cat).id}"]`).click(); }, [lid, cat, data]);
        return page.locator('#tuHint').innerText(); };
      expect(await hint('lt', 'ferie', '2026-11-06')).toBe('Lascia vuoto per contare una giornata intera: 7,5 ore. In quel caso i turni di lavoro di questo giorno non contano.\n' + RIGA);
      await page.evaluate(() => { D().lavori.lt.oreGiorno = ''; changed(); });
      expect(await hint('lt', 'malattia', '2027-02-01')).toBe('Lascia vuoto per contare una giornata intera: 8,4 ore a febbraio, calcolate dalle ore al mese del lavoro. In quel caso i turni di lavoro di questo giorno non contano.\n' + RIGA);
      await page.evaluate(() => { D().lavori.lt.oreMese = ''; changed(); });
      expect(await hint('lt', 'ferie', '2026-11-06')).toBe('Lascia vuoto per contare una giornata intera. Prima scrivi le «Ore di una giornata» nel lavoro: senza, il giorno conta 0 ore.\n' + RIGA);
      expect(await hint('lt', 'lavoro', '2026-11-06')).toContain('Orario del tipo'); // turni di lavoro: come prima
      // tornata 32: quarta variante di 04 (provvisoria) quando il tipo ha già le ore o "dalle–alle"; il nome del tipo è testo dell'utente
      const QUARTA = 'Lascia vuoto per usare le ore del tipo «Ferie <i>x</i>»: 7,5 ore. I turni di lavoro di questo giorno restano.';
      await page.evaluate(() => { const f = D().lavori.lt.tipi.find(x => x.cat === 'ferie'); f.nome = 'Ferie <i>x</i>'; f.ore = '7,5'; changed(); });
      expect(await hint('lt', 'ferie', '2026-11-06')).toBe(QUARTA);
      expect(await page.locator('#tuHint i').count()).toBe(0); await expect(page.locator('#tuOrari')).toBeVisible();
      await page.evaluate(() => { const f = D().lavori.lt.tipi.find(x => x.cat === 'ferie'); f.ore = ''; f.da = '08:00'; f.a = '16:00'; f.pausa = '30'; changed(); });
      expect(await hint('lt', 'ferie', '2026-11-06')).toBe(QUARTA); // 8 ore − 30 minuti = 7,5
      await expect(page.locator('#tuOrari')).toBeVisible(); // a turni "Lascia vuoto" ha il suo campo
      expect(await hint('lf', 'ferie', '2026-11-02')).toBe('Lascia vuoto per contare l’orario abituale del giorno.'); // orario fisso: come prima
      expect(errori).toEqual([]);
    });
  });
}

// 24c.1, punto 4b (richiesta dell'utente confermata il 19/11, varianti V1-V5 del disegno): prima le entrate, poi le uscite in fondo
test.describe('24c.1 · ordine delle caselle del riquadro', () => {
  test('entrate (Lavoro, Pensione, Ancora da incassare, Rimborsi, Ritenuta) poi Spese giornaliere e Uscite fisse; la frase prima delle uscite; l\'ultima sola a tutta larghezza', async ({ browser }) => {
    const { page, errori } = await telefono(browser); await page.evaluate(DATI);
    await page.evaluate(() => { const id = uid(); D().fissi = { [id]: { id, nome: 'Affitto', cat: 'altro', importo: '450', giorno: '3', dal: '2026-10', al: '', rate: '', updatedAt: 1 } };
      const s = uid(); D().spesePers = { [s]: { id: s, data: '2026-11-04', cat: 'bar', importo: '9', nota: '', created: 1, updatedAt: 1 } }; changed(); });
    await vai(page, 'rie'); await apri(page);
    const nomi = () => page.locator('#heroDet > * > small:first-child').allTextContents();
    expect(await nomi()).toEqual(['Lavoro dipendente', 'Pensione', 'Ancora da incassare', 'Spese giornaliere', 'Uscite fisse']);
    const larg = () => page.evaluate(() => [...document.querySelectorAll('#heroDet > *')].map(e => Math.round(e.getBoundingClientRect().width)));
    let w = await larg(); expect(w[4]).toBeGreaterThan(w[0] * 1.8); expect(w.slice(0, 4).every(x => x === w[0])).toBe(true); // 5 caselle: l'ultima sola occupa la riga
    // vista Anno: "Incassato dai progetti" tra le entrate; la riga di dicembre resta in fondo
    await vai(page, 'rie', '2026-11'); await page.evaluate(() => { rieMode = 'anno'; render(); }); await apri(page);
    const anno = await nomi(); expect(anno.indexOf('Spese giornaliere')).toBeGreaterThan(anno.indexOf('Ancora da incassare'));
    expect(anno.slice(-3)).toEqual(['Spese giornaliere', 'Uscite fisse', 'Uscite fisse ancora da addebitare entro dicembre']);
    // senza entrate (V4): la frase al posto delle entrate, prima delle uscite
    await page.evaluate(() => { D().lavori = {}; D().pensione = {}; D().progetti = {}; D().eventi = {}; changed(); });
    await vai(page, 'rie'); await apri(page);
    expect(await page.evaluate(() => [...document.querySelectorAll('#heroDet > *')].map(e => e.classList.contains('nient') ? 'frase' : e.querySelector('small').textContent))).toEqual(['frase', 'Spese giornaliere', 'Uscite fisse']);
    w = await larg(); expect(w[1]).toBe(w[2]); expect(w[0]).toBeGreaterThan(w[1] * 1.8);
    expect(errori).toEqual([]);
  });
});
