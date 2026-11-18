// Tesseract 5.1.1 in locale (pacchetti npm in test/.tesseract, vedi LEGGIMI.md) servito agli stessi indirizzi di jsDelivr.
// Se i pacchetti mancano (per esempio su GitHub) le prove che lo usano vengono saltate.
const fs = require('fs');
const path = require('path');
const TESS = path.join(__dirname, '..', '.tesseract');
const pacchetto = n => path.join(TESS, n, 'package');
const PACCHETTI = ['tesseract.js-5.1.1', 'tesseract.js-core-5.1.1', 'tesseract.js-data-eng-1.0.0'];
const mancanti = () => PACCHETTI.filter(n => !fs.existsSync(pacchetto(n)));
async function serviTesseract(ctx, richieste = []) {
  const TIPI = { '.js': 'text/javascript', '.wasm': 'application/wasm', '.gz': 'application/gzip' };
  await ctx.route('https://cdn.jsdelivr.net/npm/**', r => {
    const u = new URL(r.request().url()).pathname; richieste.push(u);
    const mappa = [[/^\/npm\/tesseract\.js@v?5\.1\.1\//, 'tesseract.js-5.1.1'], [/^\/npm\/tesseract\.js-core@v5\.1\.1\//, 'tesseract.js-core-5.1.1'], [/^\/npm\/@tesseract\.js-data\/eng\//, 'tesseract.js-data-eng-1.0.0']];
    const m = mappa.find(([re]) => re.test(u));
    const f = m && path.join(pacchetto(m[1]), u.replace(m[0], ''));
    if (!f || !fs.existsSync(f)) return r.fulfill({ status: 404, body: 'non trovato' });
    r.fulfill({ status: 200, contentType: TIPI[path.extname(f)] || 'application/octet-stream', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(f) });
  });
}
module.exports = { serviTesseract, mancanti };
