// v21b: font e licenze. I font dei documenti non usano più i nomi originali (riservati dalle licenze),
// Nunito è dentro l'app (niente Fontshare), Privacy e Licenze sono raggiungibili e funzionano anche offline.
const { test, expect } = require('./helpers/prova');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { DriveFinto, nuovoDispositivo, accedi } = require('./helpers/app');
const { SITO } = require('./helpers/google-finto');

// --- lettura minima di un file WOFF2: tabelle 'name' e 'CFF ' (specifica W3C WOFF2, §5) ---
const TAG = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];
function tabelleWoff2(buf) {
  if (buf.toString('latin1', 0, 4) !== 'wOF2') throw new Error('non è un WOFF2');
  const num = buf.readUInt16BE(12), compressa = buf.readUInt32BE(20);
  let p = 48; const dir = [];
  const base128 = () => { let v = 0; for (let i = 0; i < 5; i++) { const b = buf[p++]; v = v * 128 + (b & 0x7f); if (!(b & 0x80)) return v; } throw new Error('UIntBase128'); };
  for (let i = 0; i < num; i++) {
    const flags = buf[p++]; let tag = TAG[flags & 0x3f];
    if ((flags & 0x3f) === 63) { tag = buf.toString('latin1', p, p + 4); p += 4; }
    const ver = (flags >> 6) & 3; const orig = base128();
    const trasf = (tag === 'glyf' || tag === 'loca') ? ver === 0 : ver !== 0;
    dir.push({ tag, len: trasf ? base128() : orig });
  }
  const dati = zlib.brotliDecompressSync(buf.subarray(p, p + compressa));
  const out = {}; let o = 0; for (const t of dir) { out[t.tag] = dati.subarray(o, o + t.len); o += t.len; }
  return out;
}
function nomi(name) {
  const n = name.readUInt16BE(2), base = name.readUInt16BE(4), r = [];
  for (let i = 0; i < n; i++) {
    const q = 6 + i * 12, pid = name.readUInt16BE(q), id = name.readUInt16BE(q + 6), len = name.readUInt16BE(q + 8), off = name.readUInt16BE(q + 10);
    const raw = name.subarray(base + off, base + off + len);
    r.push({ id, testo: pid === 3 || pid === 0 ? Buffer.from(raw).swap16().toString('utf16le') : raw.toString('latin1') });
  }
  return r;
}
const fontDocumenti = () => [...fs.readFileSync(path.join(SITO, 'fonts.css'), 'utf8').matchAll(/font-family:'(\w+)';src:url\(data:font\/woff2;base64,([^)]+)\)[^}]*font-weight:(\d+);font-style:(\w+)/g)]
  .map(m => ({ fam: m[1], peso: m[3], stile: m[4], buf: Buffer.from(m[2], 'base64') }));

test('font dei documenti: nessun nome originale riservato (Carlito, Liberation, Tinos, TeX Gyre)', () => {
  const F = fontDocumenti();
  expect(F).toHaveLength(8);
  for (const f of F) {
    const t = tabelleWoff2(f.buf); const N = nomi(t.name);
    // restano col nome originale solo il copyright (0), il marchio (7) e la descrizione (10), che deve dire
    // da quale font deriva la versione modificata e dove trovare l'originale (LPPL 6d); tutti i NOMI devono essere nuovi
    const daControllare = N.filter(x => ![0, 7, 10].includes(x.id)).map(x => x.testo).join(' | ');
    expect(N.find(x => x.id === 10).testo).toMatch(/^Versione ridotta di .+ per Soldirini/);
    for (const vietato of ['Carlito', 'Liberation', 'Tinos', 'TeX Gyre', 'TeXGyre']) expect(daControllare, `${f.fam} ${f.peso} ${f.stile}`).not.toContain(vietato);
    expect(N.find(x => x.id === 1).testo).toBe(f.fam);
    expect(N.find(x => x.id === 0).testo).toMatch(/[Cc]opyright/);
    expect(N.find(x => x.id === 14).testo).toMatch(/^https:\/\//);
    if (t['CFF ']) for (const vietato of ['Pagella', 'Carlito', 'Liberation']) expect(t['CFF '].toString('latin1')).not.toContain(vietato);
  }
});

test('Nunito: file nell\'app con copyright e licenza, nessuna richiesta a Fontshare', async ({ browser }) => {
  const N = nomi(tabelleWoff2(fs.readFileSync(path.join(SITO, 'nunito.woff2'))).name);
  expect(N.find(x => x.id === 1).testo).toBe('Nunito');
  expect(N.find(x => x.id === 0).testo).toMatch(/Nunito Project Authors/);
  expect(N.find(x => x.id === 13).testo).toMatch(/Open Font License/);
  const { ctx, page, errori } = await nuovoDispositivo(browser);
  const richieste = []; ctx.on('request', r => richieste.push(r.url()));
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('600 15px Nunito') && getComputedStyle(document.body).fontFamily.startsWith('Nunito'))).toBe(true);
  expect(richieste.filter(u => /fontshare/.test(u))).toEqual([]);
  expect(richieste.some(u => u.endsWith('/nunito.woff2'))).toBe(true);
  expect(errori).toEqual([]);
});

test('Impostazioni: piede con Privacy e Licenze (tocco ≥ 44 px), versione e nota d\'autore', async ({ browser }) => {
  const drive = new DriveFinto();
  const { page } = await nuovoDispositivo(browser, { drive });
  await accedi(page);
  await page.click('nav [data-tab=pro]');
  const piede = page.locator('#appVer');
  await expect(piede).toContainText(await page.evaluate(() => 'Soldirini · versione ' + APP_VERSIONE));
  await expect(piede).toContainText('© 2026 Stefano Tanca · Ideato da Stefano Tanca');
  for (const [testo, dove] of [['Privacy', 'privacy.html'], ['Licenze', 'licenze/']]) {
    const a = piede.getByRole('link', { name: testo });
    expect(await a.getAttribute('href')).toBe(dove);
    expect(await a.getAttribute('target')).toBeNull();
    // il piede viene ridisegnato a ogni aggiornamento della pagina: misuro quando l'elemento è stabile
    await expect.poll(async () => (await a.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  await piede.getByRole('link', { name: 'Licenze' }).click();
  await expect(page.locator('h1')).toHaveText('Soldirini – Licenze');
  await page.getByRole('link', { name: '← Torna a Soldirini' }).click();
  await expect(page.locator('#sync')).toBeVisible();
});

test('schermata di benvenuto: "Privacy" accanto alla nota d\'autore, prima di "Accedi con Google"', async ({ browser }) => {
  const { page } = await nuovoDispositivo(browser);
  const a = page.locator('#welcome a.lnkw');
  await expect(a).toHaveText('Privacy');
  expect(await a.getAttribute('href')).toBe('privacy.html');
  await expect.poll(async () => (await a.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await a.click();
  await expect(page.locator('h1')).toContainText('Informativa sulla privacy');
  await expect(page.locator('body')).toContainText('Impostazioni → Account → Esci');
});

test('pagina Licenze: ogni collegamento ai testi delle licenze porta a un file esistente', () => {
  const html = fs.readFileSync(path.join(SITO, 'licenze', 'index.html'), 'utf8');
  const locali = [...html.matchAll(/href="([^"#:]+)"/g)].map(m => m[1]).filter(h => !h.startsWith('../'));
  expect(locali.length).toBeGreaterThanOrEqual(10);
  for (const h of locali) expect(fs.existsSync(path.join(SITO, 'licenze', h)), h).toBe(true);
});

test('uso offline: ogni file della lista del service worker esiste, compresi Nunito, Privacy e Licenze', () => {
  const sw = fs.readFileSync(path.join(SITO, 'sw.js'), 'utf8');
  const lista = JSON.parse('[' + /const FILE = \[([\s\S]*?)\];/.exec(sw)[1].replace(/'/g, '"') + ']');
  for (const f of ['nunito.woff2', 'privacy.html', 'licenze/index.html', 'licenze/OFL-Nunito.txt']) expect(lista).toContain(f);
  for (const f of lista) { const p = f === './' ? 'index.html' : f.endsWith('/') ? f + 'index.html' : f; expect(fs.existsSync(path.join(SITO, p)), f).toBe(true); }
  expect(sw).not.toMatch(/fontshare/);
});

test('temi chiaro e scuro: i colori restano quelli di prima (controllo dopo il cambio di font)', async ({ browser }) => {
  const { page } = await nuovoDispositivo(browser);
  // il colore di sfondo cambia con una breve transizione: aspetto il valore finale
  const sfondo = async (t, atteso) => { await page.evaluate(t => { document.documentElement.dataset.theme = t; }, t);
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(atteso); };
  await sfondo('light', 'rgb(241, 240, 238)');
  await sfondo('dark', 'rgb(15, 16, 17)');
});
