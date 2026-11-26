// Google finto per le prove: accesso (GIS), Drive e Calendar che vivono solo in memoria.
// Nessuna richiesta arriva al vero Google e non si usa nessun account reale.
'use strict';
const fs = require('fs');
const path = require('path');

// SOLDIRINI_SITO permette di provare un'altra copia del sito (es. la versione precedente)
const SITO = path.resolve(process.env.SOLDIRINI_SITO || path.join(__dirname, '..', '..', 'soldirini'));
const BASE = 'https://tankizzu.github.io/Soldirini/';
const TOKEN = 'token-finto';

const TIPI = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.xlsx': 'application/octet-stream', '.mjs': 'text/javascript', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

// Script che sostituisce https://accounts.google.com/gsi/client: dà sempre un token finto.
const GSI = `window.google=window.google||{};google.accounts={oauth2:{initTokenClient(c){return {requestAccessToken(o){
  window.__richiesteToken=(window.__richiesteToken||0)+1;
  // prove: window.__gsiRifiuto = 'popup_closed' (schermata di Google chiusa) oppure 'access_denied' (permesso negato)
  const r=window.__gsiRifiuto;if(r){setTimeout(()=>r==='popup_closed'?c.error_callback&&c.error_callback({type:'popup_closed'}):c.callback({error:r}),30);return;}
  setTimeout(()=>c.callback({access_token:'${TOKEN}',expires_in:3600,scope:(o&&o.scope)||c.scope}),30);}};},
  revoke(t,cb){cb&&cb();}},id:{initialize(){},renderButton(){},prompt(){}}};`;

function multipart(buf, ct) {
  const b = '--' + /boundary=(.+)$/.exec(ct)[1];
  const s = buf.toString('latin1');
  const parti = s.split(b).slice(1, -1);
  const meta = JSON.parse(Buffer.from(parti[0].split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, ''), 'latin1').toString('utf8'));
  const p = parti[1]; const i = p.indexOf('\r\n\r\n');
  const corpo = Buffer.from(p.slice(i + 4).replace(/\r\n$/, ''), 'latin1');
  return { meta, corpo };
}

// Un Drive in memoria. Si può usare da più "dispositivi" (più pagine) dello STESSO utente finto.
class DriveFinto {
  constructor() { this.file = {}; this.n = 0; this.registro = []; this.guasto = null; this.ritardo = null; this.dopoScrittura = null; }
  nuovoId() { return 'f' + (++this.n); }
  pubblico(f) { return { id: f.id, name: f.name, parents: f.parents, webViewLink: 'https://drive.google.com/finto/' + f.id, trashed: !!f.trashed,
    mimeType: f.mimeType, modifiedTime: new Date(f.mt).toISOString(), createdTime: new Date(f.ct || f.mt).toISOString(),
    headRevisionId: f.rev || null, appProperties: f.appProperties }; }
  // nuova revisione del contenuto (come headRevisionId di Drive: cambia solo quando cambia il contenuto)
  nuovaRevisione(f) { f.rev = 'rev' + (++this.n); }
  fileDati() { return Object.values(this.file).filter(f => !f.trashed && f.appProperties && f.appProperties.soldirini === 'dati'); }
  datiJson() { const f = this.fileDati()[0]; return f ? JSON.parse(f.corpo) : null; }
  async gestisci(route) {
    const req = route.request(); const u = new URL(req.url()); const m = req.method(); const p = u.pathname;
    const json = (o, st = 200) => route.fulfill({ status: st, contentType: 'application/json', body: JSON.stringify(o), headers: CORS });
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if ((req.headers()['authorization'] || '') !== 'Bearer ' + TOKEN) return json({ error: { message: 'non autorizzato' } }, 401);
    const voce = m + ' ' + p;
    this.registro.push(voce);
    if (this.ritardo) { const ms = this.ritardo(voce, req); if (ms) await new Promise(r => setTimeout(r, ms)); }
    if (this.guasto) { const st = this.guasto(voce, req); if (st) return typeof st === 'object' // 24c.17: anche il motivo di Google (es. storageQuotaExceeded)
      ? json({ error: { message: st.message || 'guasto simulato', errors: [{ reason: st.reason || '' }] } }, st.status) : json({ error: { message: 'guasto simulato' } }, st); }
    if (p === '/drive/v3/about') return json({ user: { displayName: 'Mario Rossi', emailAddress: 'mario.rossi@example.com' } });
    if (p === '/drive/v3/files' && m === 'GET') {
      const q = u.searchParams.get('q') || '';
      let L = Object.values(this.file).filter(f => !f.trashed);
      if (q.includes("value='dati'")) L = L.filter(f => f.appProperties && f.appProperties.soldirini === 'dati');
      const par = /'([^']+)' in parents/.exec(q); if (par) L = L.filter(f => (f.parents || []).includes(par[1]));
      const nome = /name\s*=\s*'([^']+)'/.exec(q); if (nome) L = L.filter(f => f.name === nome[1].replace(/\\'/g, "'"));
      L.sort((a, b) => b.mt - a.mt);
      return json({ files: L.map(f => this.pubblico(f)) });
    }
    if (p === '/drive/v3/files' && m === 'POST') {
      const b = JSON.parse(req.postData()); const f = { id: this.nuovoId(), ...b, mt: Date.now(), ct: Date.now() }; this.file[f.id] = f; return json(this.pubblico(f));
    }
    let x = /^\/drive\/v3\/files\/([^/]+)(\/copy)?$/.exec(p);
    if (x) {
      const f = this.file[x[1]]; if (!f) return json({ error: { message: 'non trovato' } }, 404);
      if (x[2] && m === 'POST') { const b = JSON.parse(req.postData() || '{}'); const c = { ...f, ...b, id: this.nuovoId(), mt: Date.now() }; this.file[c.id] = c; return json(this.pubblico(c)); }
      if (m === 'GET' && u.searchParams.get('alt') === 'media') return route.fulfill({ status: 200, contentType: f.mimeType === 'application/json' ? 'application/json' : 'application/octet-stream', body: f.corpo ?? '', headers: CORS });
      if (m === 'GET') return json(this.pubblico(f));
      if (m === 'PATCH') { Object.assign(f, JSON.parse(req.postData() || '{}')); f.mt = Date.now(); return json(this.pubblico(f)); }
      if (m === 'DELETE') { delete this.file[x[1]]; return route.fulfill({ status: 204, headers: CORS }); }
    }
    if (p === '/upload/drive/v3/files' && m === 'POST') {
      const { meta, corpo } = multipart(req.postDataBuffer(), req.headers()['content-type']);
      const f = { id: this.nuovoId(), ...meta, corpo: meta.mimeType === 'application/json' ? corpo.toString('utf8') : corpo, mt: Date.now(), ct: Date.now() };
      this.nuovaRevisione(f); this.file[f.id] = f; return json(this.pubblico(f));
    }
    x = /^\/upload\/drive\/v3\/files\/([^/]+)$/.exec(p);
    if (x && m === 'PATCH') {
      const f = this.file[x[1]]; if (!f) return json({ error: { message: 'non trovato' } }, 404);
      const { meta, corpo } = multipart(req.postDataBuffer(), req.headers()['content-type']);
      Object.assign(f, meta); f.corpo = f.mimeType === 'application/json' ? corpo.toString('utf8') : corpo; f.mt = Date.now(); this.nuovaRevisione(f);
      const risposta = this.pubblico(f);
      // per le prove: qualcosa che succede subito dopo una scrittura (es. un altro dispositivo che scrive a sua volta)
      if (this.dopoScrittura) { const fn = this.dopoScrittura; this.dopoScrittura = null; await fn(f); }
      return json(risposta);
    }
    return json({ error: { message: 'richiesta non prevista dal Drive finto: ' + voce } }, 400);
  }
}

class CalendarFinto {
  constructor() { this.cal = {}; this.n = 0; this.registro = []; }
  async gestisci(route) {
    const req = route.request(); const u = new URL(req.url()); const m = req.method(); const p = u.pathname.replace('/calendar/v3', '');
    const json = (o, st = 200) => route.fulfill({ status: st, contentType: 'application/json', body: JSON.stringify(o), headers: CORS });
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    this.registro.push(m + ' ' + p);
    const corpo = req.postData() ? JSON.parse(req.postData()) : null; let x;
    if (m === 'POST' && p === '/calendars') { const id = 'cal' + (++this.n) + '@finto'; this.cal[id] = { summary: corpo.summary, ev: {} }; return json({ id, summary: corpo.summary }); }
    if ((x = p.match(/^\/calendars\/([^/]+)$/))) { const id = decodeURIComponent(x[1]); if (!this.cal[id]) return json({ error: { message: 'Not Found' } }, 404);
      if (m === 'DELETE') { delete this.cal[id]; return route.fulfill({ status: 204, headers: CORS }); } return json({ id, summary: this.cal[id].summary }); }
    if ((x = p.match(/^\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/))) {
      const c = this.cal[decodeURIComponent(x[1])]; if (!c) return json({ error: { message: 'Not Found' } }, 404); const eid = x[2];
      if (m === 'POST') { c.ev[corpo.id] = corpo; return json(corpo); }
      if (m === 'PUT') { if (!c.ev[eid]) return json({ error: { message: 'Not Found' } }, 404); c.ev[eid] = corpo; return json(corpo); }
      if (m === 'DELETE') { if (!c.ev[eid]) return json({ error: { message: 'Gone' } }, 410); delete c.ev[eid]; return route.fulfill({ status: 204, headers: CORS }); }
      if (m === 'GET') return json({ items: Object.values(c.ev) });
    }
    return json({ error: { message: 'richiesta non prevista dal Calendar finto' } }, 400);
  }
}

// Collega a un contesto del browser: sito locale, Google finto, nessun'altra rete.
// v24csp: ogni blocco della politica di sicurezza (CSP) in qualsiasi pagina finisce qui; helpers/prova.js fa fallire la prova.
const blocchiCsp = [];
async function collega(ctx, { drive, calendar, sito = SITO } = {}) {
  await ctx.exposeBinding('__bloccoCsp', (fonte, b) => blocchiCsp.push(b));
  await ctx.addInitScript(() => document.addEventListener('securitypolicyviolation', e =>
    window.__bloccoCsp({ pagina: location.pathname, direttiva: e.effectiveDirective, bloccato: e.blockedURI, campione: e.sample })));
  await ctx.route('**/*', r => {
    const u = new URL(r.request().url());
    if (u.protocol === 'data:' || u.protocol === 'blob:') return r.continue();
    return r.fulfill({ status: 503, body: 'rete esterna bloccata durante le prove' });
  });
  await ctx.route('https://tankizzu.github.io/**', r => {
    const u = new URL(r.request().url());
    if (!u.pathname.startsWith('/Soldirini/')) return r.fulfill({ status: 404, body: 'non trovato' });
    let f = u.pathname.slice('/Soldirini/'.length) || 'index.html';
    const fp = path.join(sito, decodeURIComponent(f));
    // come GitHub Pages: una cartella (es. licenze/) serve il suo index.html
    const vero = fs.existsSync(fp) && fs.statSync(fp).isDirectory() ? path.join(fp, 'index.html') : fp;
    if (!fp.startsWith(sito) || !fs.existsSync(vero)) return r.fulfill({ status: 404, body: 'non trovato' });
    r.fulfill({ status: 200, contentType: TIPI[path.extname(vero)] || 'application/octet-stream', body: fs.readFileSync(vero) });
  });
  await ctx.route('https://accounts.google.com/gsi/client', r => r.fulfill({ contentType: 'text/javascript', body: GSI }));
  if (drive) await ctx.route(/https:\/\/www\.googleapis\.com\/(upload\/)?drive\//, r => drive.gestisci(r));
  if (calendar) await ctx.route(/https:\/\/www\.googleapis\.com\/calendar\//, r => calendar.gestisci(r));
}

module.exports = { BASE, SITO, TOKEN, DriveFinto, CalendarFinto, collega, blocchiCsp };
