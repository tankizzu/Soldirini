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

// v24 (D-049): il file logo-bulldogs.jpg è tolto e con lui la copia della 23b (migraLogo).
// Le prove sul logo sono ora in v24.spec.js ("'@bulldogs' rimasto → nessun logo, nessun errore").
