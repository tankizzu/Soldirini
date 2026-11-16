// v22 · Pensione nell'app: busta paga (campi per la pensione, T-C6), pagina Pensione, "La mia pensione",
// fondo pensione, cedolino (a mano e da PDF), archivio su Drive, Riepilogo e soldi rimanenti, compatibilità con la v21.
// Tutti i dati sono inventati (nessuna busta o cedolino reale).
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

// La v21 pubblicata (commit 0d04c94) serve alla prova di compatibilità. La si prende dal repository:
// se il commit non c'è (su GitHub Actions il checkout scarica solo l'ultimo), lo si scarica da origin.
// Si può anche indicare una copia già pronta con SOLDIRINI_V21. Se non si riesce, la prova viene saltata con il motivo.
const V21 = '0d04c94b9cac9d9b03c3aac515a49984a35f7d0e';
function sitoV21() {
  if (process.env.SOLDIRINI_V21) return { sito: path.resolve(process.env.SOLDIRINI_V21) };
  const dir = path.join(os.tmpdir(), 'soldirini-v21-' + V21.slice(0, 7));
  if (fs.existsSync(path.join(dir, 'soldirini', 'index.html'))) return { sito: path.join(dir, 'soldirini') };
  const git = (...a) => execFileSync('git', a, { cwd: __dirname, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });
  try {
    const radice = git('rev-parse', '--show-toplevel').toString().trim(); // l'archivio vuole i percorsi dalla radice del repository
    try { git('cat-file', '-e', V21 + '^{commit}'); } catch (e) { git('fetch', '--quiet', '--depth=1', 'origin', V21); }
    const tar = execFileSync('git', ['archive', '--format=tar', V21, 'soldirini'], { cwd: radice, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000, maxBuffer: 256 * 1024 * 1024 });
    fs.mkdirSync(dir, { recursive: true });
    execFileSync('tar', ['-x', '-C', dir], { input: tar, timeout: 60000 });
    return { sito: path.join(dir, 'soldirini') };
  } catch (e) {
    return { motivo: 'impossibile prendere la v21 (commit 0d04c94) dal repository git: ' + String(e.stderr || e.message).trim().split('\n')[0] };
  }
}
const { DriveFinto, nuovoDispositivo, accedi, accediEsistente, sincronizza } = require('./helpers/app');

const anno = new Date().getFullYear();
const mesePassato = (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();

// pezzi di testo con le posizioni, come li restituisce la lettura di un PDF (una riga per voce, importo a destra)
const pezzi = righe => righe.flatMap(([testo, importo], i) => { const y = 40 + i * 20; let x = 20;
  const out = testo.split(' ').map(t => { const p = { t, x0: x, x1: x + t.length * 6, y0: y, y1: y + 10 }; x += t.length * 6 + 4; return p; });
  if (importo) out.push({ t: importo, x0: 400, x1: 450, y0: y, y1: y + 10 }); return out; });

async function profilo(page, o = {}) {
  await page.evaluate(o => { D().pensione = D().pensione || {}; D().pensione.profilo = Object.assign({ lordoMese: '1000', dal: '2020-01', annoNascita: '1956', anniContributi: '30', prima: 'dipendente', updatedAt: Date.now() }, o); changed(); render(); }, o);
}

test('T-C6: l\'imponibile previdenziale non è più usato come lordo; i campi della pensione si leggono', async ({ browser }) => {
  const { page } = await nuovoDispositivo(browser, { telefono: false });
  const r = await page.evaluate(p => Buste.analizzaBusta(p), pezzi([['CEDOLINO PAGA OTTOBRE 2026'], ['IMPONIBILE PREVIDENZIALE', '2.400,00'], ['CONTRIBUTI PREVIDENZIALI', '220,56'], ['GG INPS', '26'], ['NETTO DEL MESE', '1.800,00']]));
  expect(r.lordo).toBeNull();
  expect([r.imponibilePrev, r.contribLav, r.giorniInps, r.netto, r.mese]).toEqual([2400, 220.56, 26, 1800, '2026-10']);
  // con il totale competenze il lordo resta quello di prima
  const r2 = await page.evaluate(p => Buste.analizzaBusta(p), pezzi([['TOTALE COMPETENZE', '2.500,00'], ['IMPONIBILE PREVIDENZIALE', '2.400,00'], ['NETTO DEL MESE', '1.800,00']]));
  expect([r2.lordo, r2.imponibilePrev]).toEqual([2500, 2400]);
});

test('busta paga: gruppo "Per la pensione", controllo C-2 sotto il campo, contributi nell\'archivio e nella pagina Pensione', async ({ browser }) => {
  const { page, errori } = await nuovoDispositivo(browser, { drive: new DriveFinto() });
  await accedi(page);
  const lid = await page.evaluate(() => { const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Ditta di prova'; l.dal = '2026-01-01'; l.settimana[1] = { da: '09:00', a: '17:00', pausa: '' };
    D().lavori[l.id] = l; changed(); return l.id; });
  await page.evaluate(lid => Stip15.apriBusta(lid, '2026-10'), lid);
  await page.click('#bpManuale');
  await expect(page.locator('#bpModal h3.bpgr')).toHaveText('Per la pensione');
  await page.fill('#bp-netto', '1800'); await page.fill('#bp-imponibilePrev', '2500'); await page.fill('#bp-contribLav', '400');
  await expect(page.locator('#bpC2')).toHaveText('⚠ Sembra alto (16% dell’imponibile, di solito 9–10%). Controlla il valore sulla busta.');
  await page.fill('#bp-contribLav', '229,75');
  await expect(page.locator('#bpC2')).toBeHidden();
  await page.click('#bpSave');
  const b = await page.evaluate(lid => (D().buste || (D().buste = {}))[lid + '|2026-10'], lid);
  expect([b.imponibilePrev, b.contribLav, b.daControllare]).toEqual(['2500', '229.75', undefined]);
  await page.evaluate(lid => Stip15.apriArchivio(lid), lid);
  await expect(page.locator('#baBody .bacon')).toContainText('Contributi 2026: 229,75 € · 1 busta');
  await page.click('#baBody .bacon a');
  await expect(page.locator('#v-pen')).toBeVisible();
  await expect(page.locator('[data-sez=contributi]')).toHaveAttribute('open', '');
  await expect(page.locator('[data-sez=contributi] .yr').first()).toContainText('1 busta, ne mancano 11');
  // dipendente non pensionato: contributi, fondo, pensione futura; niente "La mia pensione"
  await expect(page.locator('#penBody details')).toHaveCount(3);
  await expect(page.locator('[data-sez=futura] a').first()).toHaveAttribute('href', /inps\.it.*la-mia-pensione-futura/);
  expect(errori).toEqual([]);
});

test('busta vecchia: campi vuoti con "Non letto"; valori letti in automatico "da controllare" finché non si salva', async ({ browser }) => {
  const { page } = await nuovoDispositivo(browser, { drive: new DriveFinto() });
  await accedi(page);
  const lid = await page.evaluate(() => { const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Ditta'; l.settimana[1] = { da: '09:00', a: '17:00', pausa: '' }; D().lavori[l.id] = l;
    (D().buste || (D().buste = {}))[l.id + '|2026-03'] = { lid: l.id, mese: '2026-03', lordo: '2000', netto: '1500', updatedAt: 1 };
    (D().buste || (D().buste = {}))[l.id + '|2026-04'] = { lid: l.id, mese: '2026-04', lordo: '2000', netto: '1500', imponibilePrev: '2000', contribLav: '183.8', daControllare: ['imponibilePrev', 'contribLav'], updatedAt: 1 };
    changed(); return l.id; });
  await page.evaluate(lid => Stip15.apriBusta(lid, '2026-03', true), lid);
  await expect(page.locator('#bpPenNota')).toHaveText('Non letto: scrivilo se vuoi contarlo nei contributi.');
  await page.click('#bpClose');
  await page.evaluate(lid => Stip15.apriBusta(lid, '2026-04', true), lid);
  await expect(page.locator('#bpPenNota')).toBeHidden();
  await expect(page.locator('[data-dc=contribLav]')).toBeVisible();
  await page.fill('#bp-contribLav', '184');
  await expect(page.locator('[data-dc=contribLav]')).toBeHidden();
  await expect(page.locator('[data-dc=imponibilePrev]')).toBeVisible();
  await page.click('#bpSave');
  expect(await page.evaluate(lid => (D().buste || (D().buste = {}))[lid + '|2026-04'].daControllare, lid)).toBeUndefined();
});

test('"La mia pensione": errori accanto al campo, stima mentre scrivi, sezione in Impostazioni', async ({ browser }) => {
  const { page, errori } = await nuovoDispositivo(browser, { drive: new DriveFinto() });
  await accedi(page);
  await page.click('nav [data-tab=pro]');
  await page.locator('#foldPen summary').click();
  await page.click('#penImp [data-penedit]');
  await page.click('#penSave');
  await expect(page.locator('#penLordoErr')).toHaveText('Scrivi la pensione lorda al mese.');
  await expect(page.locator('#penLordo')).toHaveAttribute('aria-invalid', 'true');
  await page.fill('#penLordo', '1000');
  await expect(page.locator('#penLive')).toContainText('Netto stimato al mese 898,11 €');
  await expect(page.locator('#penLive')).toContainText('senza addizionali · stima con le regole 2026');
  await expect(page.locator('#penAddSum')).toHaveText('non indicate');
  await page.fill('#penNascita', '56');
  await page.click('#penSave');
  await expect(page.locator('#penNascitaErr')).toBeVisible();
  await page.fill('#penNascita', '1956'); await page.fill('#penDal', '2020-01');
  await page.locator('#penAddBox summary').click(); await page.fill('#penAddReg', '1,23');
  await expect(page.locator('#penAddSum')).toHaveText('reg. 1,23%');
  await expect(page.locator('#penLive')).toContainText('con addizionali');
  await page.click('#penSave');
  await expect(page.locator('#penModal')).toBeHidden();
  expect(await page.evaluate(() => D().pensione.profilo.addReg)).toBe('1,23');
  await expect(page.locator('#foldPenSum')).toHaveText('898,11 €/mese');
  expect(errori).toEqual([]);
});

test('anno del pensionamento con un lavoro: si chiede quale detrazione e si scrive "stima prudente" (D-039)', async ({ browser }) => {
  const { page } = await nuovoDispositivo(browser, { drive: new DriveFinto() });
  await accedi(page);
  await page.evaluate(() => { const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Ditta'; l.dal = '2010-01-01'; l.settimana[1] = { da: '09:00', a: '17:00', pausa: '' }; D().lavori[l.id] = l; changed(); });
  await page.evaluate(() => Pensione.apriProfilo());
  await page.fill('#penLordo', '1000'); await page.fill('#penDal', `${anno}-01`);
  await expect(page.locator('#penDetrBox')).toBeHidden();
  await page.fill('#penDal', `${anno}-07`);
  await expect(page.locator('#penDetrBox')).toBeVisible();
  await expect(page.locator('[name=penDetr][value=pensione]')).toBeChecked();
  await expect(page.locator('#penLive')).toContainText('stima prudente');
});

test('pagina Pensione: stato vuoto, poi per il pensionato le sezioni, chiuse a ogni apertura', async ({ browser }) => {
  const { page } = await nuovoDispositivo(browser, { drive: new DriveFinto() });
  await accedi(page);
  await page.evaluate(() => { tab = 'rie'; render(); });
  await page.click('[data-goto=pen]');
  await expect(page.locator('#penTitle')).toHaveText('Pensione ' + anno);
  await expect(page.locator('#penBody .pempty')).toContainText('Qui vedi i contributi letti dalle buste paga');
  await profilo(page);
  await expect(page.locator('#penBody details')).toHaveCount(2);
  await expect(page.locator('[data-sez=mia] summary .sum')).toHaveText('898,11 €/mese');
  for (const d of await page.locator('#penBody details').all()) await expect(d).not.toHaveAttribute('open', '');
  await page.locator('[data-sez=mia] summary').click();
  await expect(page.locator('[data-sez=mia]')).toHaveAttribute('open', '');
  await page.evaluate(() => render()); // un aggiornamento dentro la pagina non richiude la sezione
  await expect(page.locator('[data-sez=mia]')).toHaveAttribute('open', '');
  await expect(page.locator('[data-sez=mia] .yr.manca').first()).toContainText('Manca il cedolino');
  await expect(page.locator('[data-sez=mia]')).toContainText('Quattordicesima probabile: 504,00 €, a luglio. La decide l’INPS.');
  await page.click('#v-pen .back');
  await page.click('[data-goto=pen]');
  await expect(page.locator('[data-sez=mia]')).not.toHaveAttribute('open', '');
});

test('cedolino scritto a mano: bastano mese, lorda e netto; K-3 blocca; K-8 chiede se sostituire', async ({ browser }) => {
  const { page, errori } = await nuovoDispositivo(browser, { drive: new DriveFinto() });
  await accedi(page); await profilo(page);
  await page.evaluate(m => Pensione.apriCedolino(m, false), mesePassato);
  await page.click('#cdManuale');
  await page.fill('#cd-pensioneLorda', '1000'); await page.fill('#cd-netto', '1100');
  await expect(page.locator('[data-msg=netto] .k-errore')).toHaveText('Il netto non può essere più alto del lordo: controlla il valore letto.');
  await page.click('#cdSave');
  await expect(page.locator('#cdModal')).toBeVisible();
  expect(await page.evaluate(m => D().cedolini?.[m], mesePassato)).toBeUndefined();
  await page.fill('#cd-netto', '898');
  // trattenute scritte che non tornano: avviso K-1 (mai una correzione)
  await page.locator('#cdTrBox summary').click(); await page.fill('#cd-irpef', '50');
  await expect(page.locator('[data-msg=netto] .warn')).toContainText('I numeri non tornano');
  await page.fill('#cd-irpef', '102');
  await expect(page.locator('[data-msg=netto] .warn')).toHaveCount(0);
  await page.fill('#cd-altreTrattenute', '0'); await page.fill('#cd-altreTrattenute', '');
  await page.click('#cdSave');
  await expect(page.locator('#cdModal')).toBeHidden();
  const c = await page.evaluate(m => D().cedolini[m], mesePassato);
  expect([c.pensioneLorda, c.irpef, c.netto, c.lettura]).toEqual(['1000', '102', '898', { manuale: true }]);
  // secondo cedolino dello stesso mese: domanda
  await page.evaluate(m => Pensione.apriCedolino(m, false), mesePassato);
  await page.click('#cdManuale'); await page.fill('#cdMese', mesePassato); await page.fill('#cd-pensioneLorda', '1000'); await page.fill('#cd-netto', '900');
  await page.click('#cdSave');
  const nomeMese = await page.evaluate(m => MESI[+m.slice(5) - 1], mesePassato);
  await expect(page.locator('#dlgMsg')).toHaveText(`Hai già il cedolino di ${nomeMese}. Lo sostituisco con questo?`);
  await page.getByRole('button', { name: 'Sostituisci' }).click();
  await expect.poll(() => page.evaluate(m => D().cedolini[m].netto, mesePassato)).toBe('900');
  expect(errori).toEqual([]);
});

test('cedolino da PDF: voci lette "da controllare", altre trattenute senza descrizione, file su Drive in Soldirini/Pensione/<anno>', async ({ browser }) => {
  const drive = new DriveFinto();
  const { page, errori } = await nuovoDispositivo(browser, { drive });
  await accedi(page); await profilo(page);
  // PDF inventato creato nel browser con jsPDF (lo stesso dell'app)
  const b64 = await page.evaluate(() => { const doc = new jspdf.jsPDF(); doc.setFontSize(10);
    const r = [['INPS - Rata di luglio 2026', ''], ['Pensione lorda', '1.450,00'], ['Somma aggiuntiva - c.d. quattordicesima l. n. 127/2007', '655,00'],
      ['Importo lordo del pagamento', '2.105,00'], ['Trattenute IRPEF', '195,00'], ['Addizionale IRPEF regionale a debito del pensionato anno 2025', '22,00'],
      ['Addizionale IRPEF comunale a debito del pensionato anno 2025', '8,50'], ['Contributo associativo', '12,00'], ['Importo netto del pagamento', '1.867,50']];
    r.forEach(([a, b], i) => { doc.text(a, 15, 20 + i * 8); if (b) doc.text(b, 170, 20 + i * 8); });
    return doc.output('datauristring').split(',')[1]; });
  await page.evaluate(() => Pensione.apriCedolino(cur, false));
  await page.setInputFiles('#cdFile', { name: 'cedolino-prova.pdf', mimeType: 'application/pdf', buffer: Buffer.from(b64, 'base64') });
  await expect(page.locator('#cdStep2')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#cdMese')).toHaveValue('2026-07');
  await expect(page.locator('#cd-pensioneLorda')).toHaveValue('1450');
  await expect(page.locator('#cd-netto')).toHaveValue('1867.5');
  await expect(page.locator('#cd-altreTrattenute')).toHaveValue('12');
  await expect(page.locator('[data-cdc=netto]')).toBeVisible();
  await expect(page.locator('#cdCrediti select')).toHaveValue('14');
  await expect(page.locator('#cdModal .cdmsg p')).toHaveCount(0); // T-C1: tutto torna, nessun avviso
  await page.click('#cdSave');
  await expect.poll(() => page.evaluate(() => D().cedolini['2026-07']?.file?.name)).toBe('Cedolino pensione luglio 2026.pdf');
  const c = await page.evaluate(() => D().cedolini['2026-07']);
  expect(c.altreNota).toBe('');
  expect(JSON.stringify(c)).not.toMatch(/associativo|INPS - Rata/i); // solo numeri, nessun testo del PDF
  const f = Object.values(drive.file);
  const pen = f.find(x => x.name === 'Pensione' && x.appProperties?.soldirini === 'pensione');
  const a26 = f.find(x => x.name === '2026' && (x.parents || []).includes(pen.id));
  expect(f.find(x => x.name === 'Cedolino pensione luglio 2026.pdf').parents).toEqual([a26.id]);
  await page.evaluate(() => Pensione.apriArchivio());
  await expect(page.locator('#caBody .bai')).toContainText('Luglio');
  await expect(page.locator('#caBody .bai')).toContainText('su Drive');
  expect(errori).toEqual([]);
});

test('Riepilogo: riga "Pensione · mese" con la stima, poi il netto del cedolino; conta nei soldi rimanenti (D-040)', async ({ browser }) => {
  const { page } = await nuovoDispositivo(browser, { drive: new DriveFinto() });
  await accedi(page); await profilo(page);
  await page.evaluate(m => { cur = m; rieMode = 'mese'; tab = 'rie'; render(); }, mesePassato);
  const card = page.locator('#riePen .pencard');
  await expect(card.locator('summary')).toContainText('898,11 €');
  await expect(card.locator('summary')).toContainText('stima');
  expect(await page.evaluate(m => contiMese(m).entrate, mesePassato)).toBe(898.11);
  await expect(page.locator('#rieTot .hero')).toContainText('Pensione (stima)');
  await page.evaluate(m => { D().cedolini = { [m]: { mese: m, pensioneLorda: '1000', irpef: '95', netto: '905', updatedAt: Date.now() } }; changed(); render(); }, mesePassato);
  await expect(card.locator('summary')).toContainText('905,00 €');
  await expect(card.locator('summary')).not.toContainText('stima');
  expect(await page.evaluate(m => contiMese(m).rimanenti, mesePassato)).toBe(905);
});

test('L\'anno in breve: 12 barre con la linea della stima; confronto solo con 12 cedolini', async ({ browser }) => {
  const { page } = await nuovoDispositivo(browser, { drive: new DriveFinto() });
  await accedi(page); await profilo(page);
  await page.evaluate(() => { D().cedolini = {}; for (let m = 1; m <= 12; m++) { const k = `2025-${String(m).padStart(2, '0')}`;
    D().cedolini[k] = { mese: k, pensioneLorda: '1000', netto: m === 12 ? '1800' : '890', crediti: m === 12 ? [{ tipo: '13', importo: '1000' }] : [], updatedAt: 1 }; } changed(); });
  await page.evaluate(() => { tab = 'pen'; render(); });
  await page.click('#penPrev');
  await page.locator('[data-sez=anno] summary').click();
  await expect(page.locator('[data-sez=anno] .pb span')).toHaveCount(12);
  await expect(page.locator('[data-sez=anno] svg polyline')).toHaveCount(1);
  await expect(page.locator('[data-sez=anno]')).toContainText('Stima dell’anno');
  // 11 × 890 + 1.800 = 11.590 contro 11.675,38: −85,38 € (−0,7%) → nessun avviso
  await expect(page.locator('[data-sez=anno]')).toContainText('Differenza-85,38 €');
  await expect(page.locator('[data-sez=anno] .warn')).toHaveCount(0);
  await expect(page.locator('[data-sez=anno]')).toContainText('Dicembre: tredicesima, niente addizionali.');
});

test('fondo pensione: limite 5.300 €, oltre il limite, risparmio "stima", reddito proposto dalle buste "da controllare"', async ({ browser }) => {
  const { page } = await nuovoDispositivo(browser, { drive: new DriveFinto() });
  await accedi(page);
  await page.evaluate(() => { const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Ditta'; l.settimana[1] = { da: '09:00', a: '17:00', pausa: '' }; D().lavori[l.id] = l;
    for (let m = 1; m <= 12; m++) (D().buste || (D().buste = {}))[`${l.id}|2026-${String(m).padStart(2, '0')}`] = { lid: l.id, mese: `2026-${String(m).padStart(2, '0')}`, lordo: '2500', netto: '1900', updatedAt: 1 };
    changed(); Pensione.apriFondo(2026); });
  await expect(page.locator('#fpReddito')).toHaveValue('30000');
  await expect(page.locator('#fpRedDc')).toBeVisible();
  await page.fill('#fpPropri', '1200'); await page.fill('#fpDatore', '600'); await page.fill('#fpTfr', '1800');
  await expect(page.locator('#fpLive')).toContainText('Deducibile 1800,00 € su 5300,00 €');
  await expect(page.locator('#fpLive')).toContainText('Risparmio stimato 594,00 €');
  await page.fill('#fpPropri', '5000'); await page.fill('#fpDatore', '800');
  await expect(page.locator('#fpLive .warn')).toHaveText('500,00 € oltre il limite: non si deducono. Comunicalo al tuo fondo.');
  await page.click('#fpSave');
  expect(await page.evaluate(() => D().fondi['2026'].propri)).toBe('5000');
});

test('compatibilità: un telefono con la v21 sincronizza senza perdere i dati della pensione', async ({ browser }) => {
  const v21 = sitoV21();
  test.skip(!v21.sito, v21.motivo);
  const drive = new DriveFinto();
  const A = await nuovoDispositivo(browser, { drive });
  await accedi(A.page); await profilo(A.page);
  await A.page.evaluate(() => { D().cedolini = { '2026-10': { mese: '2026-10', pensioneLorda: '1000', netto: '898', updatedAt: Date.now() } };
    D().fondi = { 2026: { anno: '2026', propri: '1000', updatedAt: Date.now() } }; changed(); });
  await sincronizza(A.page);
  const B = await nuovoDispositivo(browser, { drive, sito: v21.sito });
  await accediEsistente(B.page);
  expect(await B.page.evaluate(() => typeof window.PenCalc)).toBe('undefined'); // è davvero la v21
  await B.page.evaluate(() => { const id = uid(); D().spesePers = D().spesePers || {}; D().spesePers[id] = { id, data: '2026-10-03', cat: 'bar', importo: '2', nota: '', created: 1, updatedAt: Date.now() }; changed(); });
  await sincronizza(B.page);
  const J = drive.datiJson();
  expect(J.pensione.profilo.lordoMese).toBe('1000');
  expect(J.cedolini['2026-10'].netto).toBe('898');
  expect(J.fondi['2026'].propri).toBe('1000');
  await sincronizza(A.page);
  expect(await A.page.evaluate(() => [D().pensione.profilo.lordoMese, Object.keys(D().spesePers).length])).toEqual(['1000', 1]);
});
