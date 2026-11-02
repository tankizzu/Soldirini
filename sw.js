// Soldirini funziona anche senza rete.
// Quando cambi i file su GitHub, aumenta il numero di versione qui sotto.
const VERSIONE = 'soldirini-7';
const FILE = ['./', 'index.html', 'app.js', 'plus.js', 'tasse.js', 'xlsx.js', 'modelli.js', 'docs.js', 'fonts.css', 'manifest.json',
  'soldirini-tonda-192.png', 'soldirini-tonda-512.png', 'soldirini-quadrata-192.png', 'soldirini-quadrata-512.png', 'logo-bulldogs.jpg',
  'lib/jszip.min.js', 'lib/jspdf.umd.min.js', 'lib/html2canvas.min.js', 'tpl/ricevuta.xlsx', 'tpl/nota.xlsx', 'tpl/ore.xlsx', 'tpl/esempio-polisportiva.xlsx'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSIONE).then(c => c.addAll(FILE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('soldirini-') && k !== VERSIONE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Prima la rete (così prendi sempre l'ultima versione), se non c'è rete la copia salvata
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method === 'GET' && /fontshare\.com$/.test(new URL(req.url).hostname)) {
    e.respondWith(caches.open('font-soldirini').then(c => c.match(req).then(r => r || fetch(req).then(res => { c.put(req, res.clone()); return res; }))));
    return;
  }
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSIONE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});

// Promemoria anche ad app chiusa (Chrome con app installata): controllo le attività previste di oggi
async function controllaPromemoria() {
  const c = await caches.open('promemoria-soldirini');
  const r = await c.match('promemoria.json'); if (!r) return;
  const p = await r.json(); if (!p.on) return;
  const n = new Date(); const oggi = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  const [hh, mm] = (p.ora || '21:00').split(':').map(Number); if (n.getHours() * 60 + n.getMinutes() < hh * 60 + mm) return;
  const L = (p.eventi || []).filter(e => e.data === oggi); if (!L.length) return;
  if (await c.match('notificato-' + oggi)) return;
  await c.put('notificato-' + oggi, new Response('1'));
  await self.registration.showNotification('Soldirini', { body: L.map(e => e.testo).join('\n') + '\nL’hai fatta? Tocca per confermare.', icon: 'soldirini-tonda-192.png', tag: 'conferma-' + oggi });
}
self.addEventListener('periodicsync', e => { if (e.tag === 'soldirini-promemoria') e.waitUntil(controllaPromemoria()); });
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => cs.length ? cs[0].focus() : self.clients.openWindow('./?conferma=1')));
});
