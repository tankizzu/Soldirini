// v23b (D-047 e logo): pdf.js senza codice generato dai font (CVE-2024-4367) e logo "@bulldogs" copiato nei dati del progetto.
// Tutti i dati sono inventati: il PDF è creato nella prova con jsPDF.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('./helpers/prova');
const { DriveFinto, nuovoDispositivo, accedi, sincronizza } = require('./helpers/app');

const APP = path.resolve(process.env.SOLDIRINI_SITO || path.join(__dirname, '..', 'soldirini')); // come helpers/google-finto.js

test.describe('23b · pdf.js con isEvalSupported:false', () => {
  test('nel codice dell\'app ogni getDocument passa isEvalSupported:false', () => {
    const chiamate = [];
    for (const f of fs.readdirSync(APP).filter(f => f.endsWith('.js'))) {
      const righe = fs.readFileSync(path.join(APP, f), 'utf8').split('\n');
      righe.forEach((r, i) => { if (/getDocument\(/.test(r)) chiamate.push([`${f}:${i + 1}`, /isEvalSupported:false/.test(r)]); });
    }
    expect(chiamate.map(c => c[0]).sort()).toEqual(['buste.js:23', 'buste.js:185', 'pdfdoc.js:11', 'tasse.js:133'].sort());
    expect(chiamate.filter(c => !c[1])).toEqual([]);
  });

  test('le 4 letture di PDF (busta, documento, PDF di riferimento, CU) passano l\'opzione e leggono ancora il testo', async ({ browser }) => {
    const { page, errori } = await nuovoDispositivo(browser, { drive: new DriveFinto() });
    await accedi(page);
    const r = await page.evaluate(async () => {
      const doc = new jspdf.jsPDF(); doc.setFontSize(12); for (let i = 0; i < 6; i++) doc.text(`Prova di lettura PDF inventata riga ${i + 1} importo 1.234,56`, 15, 20 + i * 8); // più di 15 parole: non è una scansione
      const b64 = doc.output('datauristring').split(',')[1];
      const file = () => new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], 'prova.pdf', { type: 'application/pdf' });
      // la libreria non permette di cambiare le sue funzioni: la avvolgo in un Proxy che registra le opzioni di getDocument
      const L = await pdfJs(); const opz = [], dove = [];
      const spia = function (o) { opz.push(o && o.isEvalSupported); dove.push((new Error().stack.split('\n')[2] || '').trim()); return L.getDocument.apply(L, arguments); };
      window.pdfjsLib = new Proxy(L, { get: (t, k) => k === 'getDocument' ? spia : Reflect.get(t, k) });
      const visti = new WeakSet(); const testo = (x, d = 0) => typeof x === 'string' ? x : (x && typeof x === 'object' && d < 6 && !visti.has(x) && (visti.add(x), true)) ? Object.values(x).map(v => testo(v, d + 1)).join(' ') : '';
      const testi = [];
      try {
        testi.push(testo(await Buste.testoBusta(file())));        // buste.js:23
        testi.push(testo(await Buste.testoDocumento(file())));    // buste.js:185
        testi.push(testo(await pdfLeggi(b64)));                   // pdfdoc.js:11
        testi.push(testo(await leggiCU(file())));                 // tasse.js:133 (una CU vera non c'è: basta che apra il file)
      } finally { window.pdfjsLib = L; }
      return { opz, dove, letti: testi.map(t => /lettura/.test(t)) };
    });
    // ogni apertura passa l'opzione (testoDocumento a volte richiama anche testoBusta: le aperture possono essere più di 4)
    expect(r.opz.length).toBeGreaterThanOrEqual(4);
    expect(r.opz.every(v => v === false)).toBe(true);
    const punti = [...new Set(r.dove.map(d => (d.match(/(\w+\.js:\d+)/) || [])[1]))].sort();
    expect(punti).toEqual(['buste.js:185', 'buste.js:23', 'pdfdoc.js:11', 'tasse.js:133']);
    expect(r.letti.slice(0, 3)).toEqual([true, true, true]);
    expect(errori).toEqual([]);
  });
});

test.describe('23b · logo del progetto nei dati', () => {
  test('"@bulldogs" diventa una volta sola l\'immagine salvata, si sincronizza e i documenti restano identici', async ({ browser }) => {
    const drive = new DriveFinto();
    const { page, errori } = await nuovoDispositivo(browser, { drive });
    await accedi(page);
    // progetto come lo hanno i telefoni fino alla v23 (logo che rimanda al file pubblico)
    const prima = await page.evaluate(async () => {
      const p = Object.assign(nuovoProgetto(), { nome: 'Squadra di prova' }); p.rimborso.logo = '@bulldogs'; p.updatedAt = 1000;
      D().progetti[p.id] = p; persist();
      return { id: p.id, src: await logoSrc(p) };
    });
    expect(prima.src).toMatch(/^data:image\/jpeg;base64,/);
    // riapro l'app: all'avvio il logo viene copiato nel progetto
    await page.reload();
    await page.waitForFunction(id => (D().progetti[id].rimborso.logo || '').startsWith('data:'), prima.id);
    const dopo = await page.evaluate(async id => { const p = D().progetti[id]; return { logo: p.rimborso.logo, upd: p.updatedAt, src: await logoSrc(p) }; }, prima.id);
    expect(dopo.logo).toBe(prima.src);   // stessa immagine di prima, byte per byte
    expect(dopo.src).toBe(prima.src);    // i documenti ricevono lo stesso logo
    expect(dopo.upd).toBeGreaterThan(1000);
    // una volta sola: un secondo passaggio non cambia niente
    expect(await page.evaluate(async id => { const n = await migraLogo(); return [n, D().progetti[id].updatedAt]; }, prima.id)).toEqual([0, dopo.upd]);
    // arriva su Drive con i dati
    await sincronizza(page);
    expect(drive.datiJson().progetti[prima.id].rimborso.logo).toBe(prima.src);
    expect(errori).toEqual([]);
  });

  test('ricevute (Excel) e logo del PDF: stesso risultato con "@bulldogs" e con il logo salvato', async ({ browser }) => {
    const { page, errori } = await nuovoDispositivo(browser, { drive: new DriveFinto() });
    await accedi(page);
    const r = await page.evaluate(async () => {
      const p = Object.assign(nuovoProgetto(), { nome: 'Squadra di prova' }); p.rimborso.logo = '@bulldogs';
      const conBull = await logoSrc(p);
      const xls1 = new Uint8Array(await MODELLI.ricevute(await tpl('ricevuta.xlsx'), [], conBull));
      p.rimborso.logo = conBull; // come dopo la copia
      const conDati = await logoSrc(p);
      const xls2 = new Uint8Array(await MODELLI.ricevute(await tpl('ricevuta.xlsx'), [], conDati));
      const senza = new Uint8Array(await MODELLI.ricevute(await tpl('ricevuta.xlsx'), [], null));
      // lo zip dell'Excel contiene l'ora di creazione: confronto il contenuto di ogni parte del file
      const parti = async b => { const z = await JSZip.loadAsync(b); const o = {}; for (const n of Object.keys(z.files).sort()) o[n] = [...await z.files[n].async('uint8array')].join(','); return JSON.stringify(o); };
      const ug = async (a, b) => (await parti(a)) === (await parti(b));
      return { stessoLogo: conBull === conDati, stessoExcel: await ug(xls1, xls2), conLogo: !(await ug(senza, xls1)), dim: xls1.length };
    });
    expect(r.stessoLogo).toBe(true);
    expect(r.stessoExcel).toBe(true);
    expect(r.conLogo).toBe(true); // il logo è davvero dentro il file
    expect(r.dim).toBeGreaterThan(1000);
    expect(errori).toEqual([]);
  });

  test('senza il file del logo (rete o file mancante) il progetto resta com\'era e si riprova dopo', async ({ browser }) => {
    const { page } = await nuovoDispositivo(browser, { drive: new DriveFinto() });
    await accedi(page);
    await page.route('**/logo-bulldogs.jpg', r => r.fulfill({ status: 404, body: 'no' }));
    const r = await page.evaluate(async () => {
      LOGO_BULLDOGS = null;
      const p = Object.assign(nuovoProgetto(), { nome: 'Squadra di prova' }); p.rimborso.logo = '@bulldogs'; p.updatedAt = 1000; D().progetti[p.id] = p;
      const n = await migraLogo(); return [n, p.rimborso.logo, p.updatedAt]; });
    expect(r).toEqual([0, '@bulldogs', 1000]);
  });
});
