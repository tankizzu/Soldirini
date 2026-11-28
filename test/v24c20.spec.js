// 24c.20: Impostazioni più leggere (D-182, D-190), scelte proprie (D-180), testi definitivi del salvadanaio, residui della tornata 60.
// Solo dati inventati (D-089).
const { test, expect } = require('./helpers/prova');
const { DriveFinto, nuovoDispositivo, dopoAvvio } = require('./helpers/app');

async function telefono(browser, ora = '2026-12-20T10:00:00+01:00') {
  const d = await nuovoDispositivo(browser, { drive: new DriveFinto(), ora, telefono: true });
  await d.page.waitForFunction(() => window.Scelte && window.Risparmi && Archivio.avviata);
  await d.page.evaluate(() => { DB.meta.skipWelcome = true; changed(); render(); });
  await dopoAvvio(d.page);
  return d;
}
// apre una sezione (e quelle che la contengono) toccando i titoli, come una persona
const apriSez = async (page, sel) => {
  const n = await page.locator(sel).evaluate(e => { const L = []; for (let d = e.closest('details'); d; d = d.parentElement.closest('details')) L.unshift(d); return L.map(d => { d.dataset.zz = Math.random().toString(36).slice(2); return d.dataset.zz; }); });
  for (const z of n) { const d = page.locator(`details[data-zz="${z}"]`); if (!(await d.getAttribute('open') !== null)) await d.locator(':scope > summary').click(); }
};
const vuota = x => x === undefined || (x !== null && typeof x === 'object' && !Array.isArray(x) && !Object.keys(x).length);
const diversiDa = (page, prima) => page.evaluate(prima => { const a = JSON.parse(prima), b = D();
  const v = x => x === undefined || (x !== null && typeof x === 'object' && !Array.isArray(x) && !Object.keys(x).length);
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => !(v(a[k]) && v(b[k])) && JSON.stringify(a[k]) !== JSON.stringify(b[k])); }, prima);

test.describe('24c.20 · D-182 Impostazioni più leggere', () => {
  test('colonna di destra: Account, Aspetto, Blocco, «Dati e copie di sicurezza»; Google Calendar e Promemoria dentro Account, separati; copia, cestino e storico in una sezione; tutto chiuso', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(() => vaiA('pro'));
    const tit = await page.locator('#v-pro .two > .stack:last-child > details.fold > summary .st').allTextContents();
    expect(tit.map(t => t.trim())).toEqual(['👤Account', '🎨Aspetto', '🔒Blocco dell’app', '💾Dati e copie di sicurezza']);
    expect(await page.evaluate(() => [...document.querySelectorAll('#v-pro details')].filter(d => d.open).length)).toBe(0);
    // Account: i tuoi dati, firma, poi Google Calendar e Promemoria (sorelle, non una dentro l'altra)
    const acc = page.locator('#v-pro details.fold', { has: page.locator('summary', { hasText: 'Account' }) });
    expect((await acc.locator('details.subfold > summary').allTextContents()).map(t => t.trim())).toEqual(['🪪 I tuoi dati (per le ricevute)', '✍️ La tua firma', '📅 Google Calendar', '🔔 Promemoria']);
    await expect(page.locator('#accCal #gcalBody')).toHaveCount(1);
    await expect(page.locator('#accCal #accProm')).toHaveCount(0);
    await expect(page.locator('#accProm #promem')).toHaveCount(1);
    await expect(page.locator('#accProm > p').first()).toHaveText('I promemoria funzionano anche con Google Calendar spento.');
    const dati = page.locator('#v-pro details.fold', { has: page.locator('summary', { hasText: 'Dati e copie di sicurezza' }) });
    await expect(dati.locator('.fbody > p').first()).toHaveText('Copie di sicurezza, cestino e storico delle modifiche.');
    expect((await dati.locator('details.subfold > summary').allTextContents()).map(t => t.trim())).toEqual(['🛟 Copia di sicurezza', '🗑️ Cestino', '🕘 Storico modifiche']);
    await expect(page.locator('#datCopia #cpBox')).toHaveCount(1);
    await expect(page.locator('#datCopia #emApri')).toHaveCount(1);
    await expect(page.locator('#datCest #cestBox')).toHaveCount(1);
    await expect(page.locator('#datStor #storBox')).toHaveCount(1);
    // niente sezioni a sé con i vecchi nomi
    for (const t of ['Google Calendar', 'Promemoria', 'Cestino', 'Storico modifiche', 'Copia di sicurezza'])
      await expect(page.locator('#v-pro details.fold > summary .st', { hasText: new RegExp('^\\W*' + t + '$') })).toHaveCount(0);
    // si apre fino a «Elimina i dati di un mese…» toccando i titoli
    await apriSez(page, '#emApri');
    await expect(page.locator('#emApri')).toBeVisible();
    // cambiando pagina e tornando: tutto chiuso (D-010)
    await page.evaluate(() => { vaiA('rie'); vaiA('pro'); });
    expect(await page.evaluate(() => [...document.querySelectorAll('#v-pro details')].filter(d => d.open).length)).toBe(0);
    expect(errori).toEqual([]);
  });

  test('percorsi nuovi nell\'informativa e nei testi dell\'app; nessun «Impostazioni → Copia di sicurezza» rimasto', async ({ browser }) => {
    const { page } = await telefono(browser);
    const leggi = f => page.evaluate(f => fetch(f).then(r => r.text()), f);
    const p = await leggi('privacy.html');
    expect(p).toContain('Impostazioni → Dati e copie di sicurezza → Copia di sicurezza → «Elimina i dati di un mese…»');
    expect(p).toContain('Impostazioni → Dati e copie di sicurezza → Copia di sicurezza → Salva una copia');
    expect(p).toContain('Impostazioni → Dati e copie di sicurezza → Copia di sicurezza → Riprendi da una copia');
    expect(p).toContain('Impostazioni → Account → Google Calendar di copiarli per esteso');
    expect(p).toContain('Impostazioni → Account → Esci');
    expect(p).toContain('le scelte che crei tu per le spese e le uscite fisse (il nome, l’icona e, se li scrivi, l’importo e il giorno di solito),');
    expect(p).toContain('Le scelte che hai creato tu per le spese e le uscite fisse non si cancellano con un mese: le togli dal loro elenco.');
    expect(p).toContain('versione 24c.20');
    for (const f of ['privacy.html', 'index.html', 'copia.js', 'gcal.js']) {
      const t = await leggi(f);
      expect(t, f).not.toContain('Impostazioni → Copia di sicurezza');
      expect(t, f).not.toMatch(/Impostazioni → Google Calendar/);
    }
    const ix = await leggi('index.html');
    expect(ix).toContain('Puoi riprendere la copia anche da Impostazioni → Dati e copie di sicurezza → Copia di sicurezza.');
    expect(ix).toContain('Impostazioni → Account → Google Calendar → Disattiva');
  });
});

test.describe('24c.20 · D-180 scelte proprie', () => {
  test('uscite fisse: niente Netflix e Disney+ tra le pronte; «Altro» apre «Nuova scelta» con gli errori di 02; la scelta salvata è già selezionata e compila nome, importo e giorno', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(() => Soldi18.apriFisso(null));
    const chips = page.locator('#fxCats [data-fxc]');
    expect((await chips.allTextContents()).map(t => t.trim())).toEqual(['🏠 Mutuo', '💳 Rata', '📱 Abbonamento', '💡 Utenze', '• Altro']);
    await expect(page.locator('#fxNome')).toHaveAttribute('placeholder', 'es. Bolletta della luce');
    await expect(page.locator('#fxCats .chip.on')).toHaveCount(0);
    await page.click('#fxCats [data-fxc="altro"]');
    await expect(page.locator('#scModal')).toBeVisible();
    await expect(page.locator('#scTit')).toHaveText('Nuova scelta');
    await expect(page.locator('#scFrase')).toHaveText('La scelta resta tra quelle delle uscite fisse e la puoi togliere quando vuoi.');
    await expect(page.locator('#scGiornoL')).toBeVisible();
    await expect(page.locator('#scIco [data-scico]')).toHaveCount(24);
    expect(await page.locator('#scIco [data-scico]').evaluateAll(L => L.every(b => b.getBoundingClientRect().width >= 44 && b.getBoundingClientRect().height >= 44))).toBe(true);
    await expect(page.locator('#scIco [aria-pressed="true"]')).toHaveAttribute('aria-label', 'Nessuna icona');
    // errori
    await page.click('#scSave'); await expect(page.locator('#scNomeErr')).toHaveText('Scrivi un nome per la scelta.');
    await page.fill('#scNome', 'mUtUo'); await page.locator('#scNome').blur(); await expect(page.locator('#scNomeErr')).toHaveText('C’è già una scelta con questo nome. Scrivine un altro.');
    await page.fill('#scNome', 'Abbonamento allo streaming tv'); await page.locator('#scNome').blur(); await expect(page.locator('#scNomeErr')).toHaveText('Il nome può avere al massimo 24 lettere.');
    await page.fill('#scNome', 'Netflix'); await expect(page.locator('#scNomeErr')).toBeHidden();
    await page.fill('#scGiorno', '40'); await page.locator('#scGiorno').blur(); await expect(page.locator('#scGiornoErr')).toHaveText('Scrivi il giorno di addebito (1–31).');
    await page.fill('#scGiorno', '15'); await page.fill('#scImp', '12,99');
    await page.click('#scIco [aria-label="Musica"]'); await expect(page.locator('#scIco [aria-label="Musica"]')).toHaveAttribute('aria-pressed', 'true');
    await page.click('#scSave');
    await expect(page.locator('#scModal')).toBeHidden();
    await expect(page.locator('#toast')).toHaveText('✓ Scelta salvata: Netflix.');
    await expect(page.locator('#fxCats .chip.on')).toHaveText('🎵 Netflix');
    expect((await chips.allTextContents()).map(t => t.trim())).toEqual(['🏠 Mutuo', '💳 Rata', '📱 Abbonamento', '💡 Utenze', '🎵 Netflix', '• Altro']);
    await expect(page.locator('#fxNome')).toHaveValue('Netflix'); await expect(page.locator('#fxImp')).toHaveValue('12,99'); await expect(page.locator('#fxGiorno')).toHaveValue('15');
    await expect(page.locator('#fxCats [data-scmod]')).toHaveText('✏️ Modifica «Netflix»');
    await expect(page.locator('#fxCats [data-sctogli]')).toHaveText('Togli dalle scelte');
    await page.click('#fxSave');
    await page.evaluate(() => vaiA('pro'));
    const f = await page.evaluate(() => Object.values(D().fissi)[0]);
    const sc = await page.evaluate(() => Object.values(D().scelte));
    expect(sc).toHaveLength(1);
    expect(sc[0]).toMatchObject({ lista: 'fissi', nome: 'Netflix', ico: '🎵', importo: '12.99', giorno: '15', deleted: false });
    expect(f).toMatchObject({ cat: 'sc:' + sc[0].id, nome: 'Netflix', importo: '12.99', giorno: '15', catNome: 'Netflix', catIco: '🎵' });
    await expect(page.locator('#fixList .fxr').first()).toContainText('🎵');
    expect(errori).toEqual([]);
  });

  test('spese giornaliere: lista a parte; rinominando le voci seguono il nome nuovo; togliendo la scelta le voci restano con l\'ultimo nome; limite di 12', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(() => openEv(['2026-12-18']));
    await apriSez(page, '#evSpP');
    await page.click('#spPCats [data-spc="altro"]');
    await expect(page.locator('#scFrase')).toHaveText('La scelta resta tra quelle delle spese giornaliere e la puoi togliere quando vuoi.');
    await expect(page.locator('#scGiornoL')).toBeHidden();
    await page.fill('#scNome', 'Bar Rossi'); await page.fill('#scImp', '2,50'); await page.click('#scIco [aria-label="Tazza"]'); await page.click('#scSave');
    await expect(page.locator('#spPCats .chip.on')).toHaveText('☕ Bar Rossi');
    await expect(page.locator('#spPImp')).toHaveValue('2,50');
    await page.click('#spPAdd'); await page.click('#evSave');
    await expect(page.locator('#evModal')).toBeHidden();
    const s = await page.evaluate(() => Object.values(D().spesePers).find(x => x.data === '2026-12-18'));
    expect(s).toMatchObject({ importo: 2.5, catNome: 'Bar Rossi', catIco: '☕' });
    expect(s.cat).toMatch(/^sc:/);
    // la scelta non c'è tra le uscite fisse
    await page.evaluate(() => Soldi18.apriFisso(null));
    await expect(page.locator('#fxCats')).not.toContainText('Bar Rossi');
    await page.evaluate(() => { $('fxModal').hidden = true; });
    // Riepilogo, pagina Spese: riga per categoria con il nome della scelta
    await page.evaluate(() => { tab = 'rie'; rieMode = 'mese'; cur = '2026-12'; render(); });
    await expect(page.locator('#rieSpese')).toContainText('☕ Bar Rossi');
    // rinominata: le voci seguono il nome nuovo
    const id = s.cat.slice(3);
    await page.evaluate(id => { const x = D().scelte[id]; x.nome = 'Caffè Rossi'; x.updatedAt = Date.now(); changed(); render(); }, id);
    await expect(page.locator('#rieSpese')).toContainText('☕ Caffè Rossi');
    // tolta (dalla finestra della spesa): conferma di 02, la spesa resta con l'ultimo nome
    await page.evaluate(id => Att16.apriSpesa(id), s.id);
    await expect(page.locator('#spmCats .chip.on')).toHaveText('☕ Caffè Rossi');
    await page.click('#spmCats [data-sctogli]');
    await expect(page.locator('#dlgMsg')).toContainText('Togliere «Caffè Rossi» dalle scelte?');
    await expect(page.locator('#dlgMsg')).toContainText('Le spese già segnate con «Caffè Rossi» restano dove sono, con il loro nome. Non si cancella niente.');
    expect(await page.locator('#dlgBtns button').allTextContents()).toEqual(['Annulla', 'Togli la scelta']);
    await page.click('#dlgBtns button:has-text("Togli la scelta")');
    await expect(page.locator('#toast')).toHaveText('✓ Scelta tolta.');
    await expect(page.locator('#spmCats')).not.toContainText('Caffè Rossi');
    await expect(page.locator('#spmCats .chip.on')).toHaveCount(0);
    await page.click('#spmAnnulla');
    await page.evaluate(() => render());
    await expect(page.locator('#rieSpese')).toContainText('☕ Caffè Rossi');
    expect(await page.evaluate(id => [D().scelte[id].deleted, D().scelte[id].nome], id)).toEqual([true, 'Caffè Rossi']);
    // limite: 12 scelte per elenco
    await page.evaluate(() => { for (let i = 0; i < 12; i++) { const id = 'x' + i; D().scelte[id] = { id, lista: 'spese', nome: 'Voce ' + i, ico: '•', creata: i, updatedAt: 1 }; } changed(); });
    await page.evaluate(() => openEv(['2026-12-19'])); await apriSez(page, '#evSpP');
    await page.click('#spPCats [data-spc="altro"]');
    await expect(page.locator('#scMax')).toBeVisible();
    await expect(page.locator('#scMax')).toContainText('Hai già 12 scelte tue.');
    await expect(page.locator('#scSave')).toBeDisabled();
    expect(errori).toEqual([]);
  });

  test('dati vecchi (D-117): uscite «netflix» e «disney» si vedono come prima e niente si riscrive; nome con HTML mostrato come testo; scelte unite voce per voce e nella copia', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(() => {
      D().fissi = { f1: { id: 'f1', cat: 'netflix', nome: 'Netflix', importo: '12.99', giorno: '5', dal: '2026-01', updatedAt: 1 }, f2: { id: 'f2', cat: 'disney', nome: 'Disney+', importo: '8.99', giorno: '9', dal: '2026-01', updatedAt: 1 },
        f3: { id: 'f3', cat: 'sc:sparita', nome: 'Palestra', catNome: 'Palestra', catIco: '🏋️', importo: '30', giorno: '1', dal: '2026-01', updatedAt: 1 } };
      D().scelte = { h: { id: 'h', lista: 'fissi', nome: '<img src=x onerror=1>', ico: '•', creata: 1, updatedAt: 1 } };
      changed(); vaiA('pro'); });
    const prima = await page.evaluate(() => JSON.stringify(D()));
    await expect(page.locator('#fixList')).toContainText('🎬'); await expect(page.locator('#fixList')).toContainText('✨'); await expect(page.locator('#fixList')).toContainText('🏋️');
    await page.evaluate(() => { tab = 'rie'; rieMode = 'mese'; cur = '2026-12'; render(); vaiA('dsp'); });
    await expect(page.locator('#v-dsp')).toContainText('🎬 Netflix');
    // aprendo e salvando senza toccare la categoria resta 'netflix'
    await page.evaluate(() => Soldi18.apriFisso(D().fissi.f1));
    await expect(page.locator('#fxCats .chip.on')).toHaveCount(0);
    await expect(page.locator('#fxCats img')).toHaveCount(0);
    await expect(page.locator('#fxCats')).toContainText('<img src=x onerror=1>');
    await page.evaluate(() => { $('fxModal').hidden = true; });
    expect(await diversiDa(page, prima)).toEqual([]);
    await page.evaluate(() => Soldi18.apriFisso(D().fissi.f1)); await page.click('#fxSave');
    expect(await page.evaluate(() => D().fissi.f1.cat)).toBe('netflix');
    // unione voce per voce (come gli altri elenchi): vince la più recente
    const u = await page.evaluate(() => mergeData({ v: 1, scelte: { a: { id: 'a', nome: 'A', updatedAt: 1 }, b: { id: 'b', nome: 'B', updatedAt: 5 } } }, { v: 1, scelte: { a: { id: 'a', nome: 'A2', updatedAt: 3 }, c: { id: 'c', nome: 'C', updatedAt: 1 } } }).scelte);
    expect(Object.fromEntries(Object.entries(u).map(([k, v]) => [k, v.nome]))).toEqual({ a: 'A2', b: 'B', c: 'C' });
    expect(await page.evaluate(() => fetch('copia.js').then(r => r.text()))).toMatch(/RACCOLTE = \[[^\]]*'scelte'\]/);
    expect(errori).toEqual([]);
  });
});

test.describe('24c.20 · residui della tornata 60', () => {
  test('salvadanaio con i testi definitivi di 02: pulsanti, finestra, errori, «Conta nei soldi di», toast, righe dei movimenti, frasi vuote, data non vera (T1)', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(() => { D().risparmi = {}; changed(); vaiA('ris'); });
    await expect(page.locator('#risBody')).toContainText('Nessun obiettivo per ora. Un obiettivo ti fa vedere quanto manca a qualcosa che vuoi comprare.');
    await expect(page.locator('#risBody')).toContainText('Non hai ancora segnato niente. Quando metti da parte dei soldi, o ne prelevi, tocca i pulsanti qui sopra.');
    await apriSez(page, '#rsMv');
    await expect(page.locator('#rsMv')).toHaveText('+ Ho messo da parte'); await expect(page.locator('#rsPrel')).toHaveText('Ho prelevato');
    await page.click('#rsMv');
    await expect(page.locator('#mvTit')).toHaveText('Ho messo da parte'); await expect(page.locator('#mvSave')).toHaveText('Segna come messi da parte');
    await expect(page.locator('#mvImp')).toHaveAttribute('placeholder', 'es. 50,00');
    await expect(page.locator('#mvObL')).toBeHidden(); // nessun obiettivo
    await expect(page.locator('#mvConta')).toBeHidden(); // scelta D-169 spenta
    await page.click('#mvSave'); await expect(page.locator('#mvImpErr')).toHaveText('Scrivi un importo più grande di 0.');
    await page.fill('#mvImp', '50'); await expect(page.locator('#mvImpErr')).toBeHidden();
    await page.fill('#mvData', ''); await page.locator('#mvData').blur(); await expect(page.locator('#mvDataErr')).toHaveText('Scegli un giorno.');
    await page.fill('#mvData', '2026-12-05'); await page.click('#mvSave');
    await expect(page.locator('#toast')).toHaveText('✓ Segnati 50,00 € messi da parte.');
    await page.click('#rsPrel');
    await expect(page.locator('#mvTit')).toHaveText('Ho prelevato'); await expect(page.locator('#mvSave')).toHaveText('Segna come prelevati');
    await page.fill('#mvImp', '80'); await page.fill('#mvData', '2026-12-15'); await page.click('#mvSave');
    await expect(page.locator('#toast')).toHaveText('✓ Segnati 80,00 € prelevati.');
    // prelevato più di quanto messo: «Presi dai risparmi in tutto», senza segno
    await expect(page.locator('#risBody .hero small').first()).toHaveText('Presi dai risparmi in tutto');
    await expect(page.locator('#risBody .hero b')).toHaveText('30,00 €');
    await apriSez(page, '[data-mved] >> nth=0');
    const righe = page.locator('#risBody .fxr');
    await expect(righe.nth(0).locator('.tx b')).toHaveText('15 dicembre · Prelevato'); await expect(righe.nth(0).locator('.rsimp')).toHaveText('80,00 €');
    await expect(righe.nth(1).locator('.tx b')).toHaveText('5 dicembre · Messo da parte');
    await expect(righe.nth(1)).toHaveAttribute('aria-label', 'Messo da parte, 50 euro, 5 dicembre');
    await expect(righe.nth(1).locator('[data-mved]')).toHaveAttribute('aria-label', 'Modifica il movimento del 5 dicembre, 50 euro');
    // con la scelta accesa, sotto il giorno
    await apriSez(page, '#rsTogli'); await page.locator('#rsTogli').check();
    await apriSez(page, '#rsMv'); await page.click('#rsMv');
    await expect(page.locator('#mvConta')).toHaveText('Conta nei soldi di dicembre.');
    await page.fill('#mvData', '2027-01-02'); await expect(page.locator('#mvConta')).toHaveText('Conta nei soldi di gennaio 2027.');
    await page.click('#mvAnn');
    // T1 (04, SV57): un giorno che non esiste non compare
    await page.evaluate(() => { D().risparmi['mv:z'] = { data: '2026-02-30', importo: '40', updatedAt: 1 }; changed(); render(); });
    await expect(page.locator('#risBody .hero b')).toHaveText('30,00 €');
    expect(await page.evaluate(() => Risparmi.totale())).toBe(-30);
    expect(errori).toEqual([]);
  });

  test('cerchi dei turni da foto non scelti tratteggiati, 44 px e 8 px tra uno e l\'altro; «#sync» con lo stato per il lettore di schermo; Risparmi con 📊 e 📒', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    const st = await page.evaluate(() => { const c = document.createElement('div'); c.className = 'ftc'; c.innerHTML = '<button class="chip"><span class="ic">🌅</span></button><button class="chip on"><span class="ic">🌙</span></button>'; $('ftModal').appendChild(c);
      const [a, b] = c.querySelectorAll('.chip'), A = getComputedStyle(a), B = getComputedStyle(b);
      const r = { spentoBordo: A.borderTopStyle, spentoLarg: A.borderTopWidth, spentoIcona: getComputedStyle(a.querySelector('.ic')).opacity, accesoBordo: B.borderTopStyle, gap: getComputedStyle(c).columnGap, w: A.minWidth, h: A.minHeight };
      c.remove(); return r; });
    expect(['1px', '1.5px']).toContain(st.spentoLarg); delete st.spentoLarg; // Chromium arrotonda il bordo ai pixel dello schermo
    expect(st).toEqual({ spentoBordo: 'dashed', spentoIcona: '0.6', accesoBordo: 'solid', gap: '8px', w: '44px', h: '44px' });
    expect(await page.locator('#sync').getAttribute('aria-label')).toMatch(/^Google Drive: /);
    await page.evaluate(() => { D().risparmi = {}; changed(); vaiA('ris'); });
    expect(await page.locator('#risBody > details.fold > summary .st').allTextContents()).toEqual(['🐷 Metti da parte o preleva', '🎯 Obiettivi', '📊 Andamento 2026', '📒 Movimenti']);
    expect(errori).toEqual([]);
  });

  test('banca: un render() mentre la finestra è aperta non toglie il riquadro «Controlla» della finestra (prova v24c17 instabile, anche sulla 24c.19)', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(() => { $('bcModal').hidden = false; $('bcDopo').innerHTML = '<div class="note dcnote" role="status"><span>Nella lista c’è 1 entrata da confermare.</span><button type="button" class="btn sm" data-bccontrolla>Controlla</button></div>';
      tab = 'rie'; render(); render(); });
    await expect(page.locator('#bcDopo [data-bccontrolla]')).toHaveCount(1);
    await page.evaluate(() => { $('bcDopo').innerHTML = ''; $('bcModal').hidden = true; });
    expect(errori).toEqual([]);
  });

  test('«Elimina i dati di un mese»: testi definitivi della casella delle attività incassate e delle impronte, riga «torna in arrivo»; frase della scheda della banca; riga sotto «Foto scontrino» solo con l\'accesso', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(() => {
      const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Ufficio di prova'; l.dal = '2026-01-01'; l.paga = { tipo: 'mensile', importo: '1500', divisore: 168 }; D().lavori = { [l.id]: l };
      D().entrate = { [`lav|${l.id}|2026-11`]: { entrato: true, data: '2026-11-27', importo: '1200', updatedAt: 1 } };
      D().spesePers = { s1: { id: 's1', data: '2026-11-28', cat: 'spesa', importo: 20, nota: '', origine: 'banca', updatedAt: 1 } };
      changed(); });
    await page.evaluate(() => { cur = '2026-11'; tab = 'pro'; render(); });
    await apriSez(page, '#emApri'); await page.click('#emApri');
    for (const c of ['en', 'sp']) await page.locator(`#emBody [data-em="${c}"]`).check();
    await page.click('#emCont');
    await expect(page.locator('#emBody .vcavv')).toContainText('Lo stipendio di novembre torna «in arrivo».');
    await expect(page.locator('#emBody .emimp')).toHaveText('1 spesa importata dalla banca resta «Già importato». Se reimporti la lista, non torna: aggiungila a mano.');
    await page.evaluate(() => { $('emModal').hidden = true; document.body.classList.remove('noscroll'); });
    expect(await page.evaluate(() => fetch('index.html').then(r => r.text()))).toContain('Soldirini legge il file solo sul telefono. Ne tiene una copia solo se, alla fine, scegli «Archivia su Drive».');
    // riga sotto «📷 Foto scontrino» delle spese dei progetti: senza accesso non c'è
    await page.evaluate(() => { const p = nuovoProgetto({ nome: 'Progetto di prova' }); D().progetti = { [p.id]: p }; changed(); openEv(['2026-12-18']); });
    await expect(page.locator('#spFotoNota')).toBeHidden();
    await page.evaluate(() => { DB.meta.account = { email: 'prova@esempio.it' }; renderSpese(); });
    await expect(page.locator('#spFotoNota')).toHaveText('La foto va nella cartella del progetto su Drive, per la nota spese.');
    await expect(page.locator('#spFotoNota')).not.toHaveAttribute('hidden', '');
    expect(errori).toEqual([]);
  });
});
