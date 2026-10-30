// Tiene l'app sul telefono: funziona anche senza rete.
// Quando cambi i file su GitHub, aumenta il numero di versione qui sotto.
const VERSIONE = 'rimborsi-v1';
const FILE = ['./', 'index.html', 'manifest.json', 'icona-192.png', 'icona-512.png', 'icona-tonda-192.png', 'icona-tonda-512.png',
  'lib/jspdf.umd.min.js', 'lib/html2canvas.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSIONE).then(c => c.addAll(FILE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSIONE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Prima la rete (così prendi sempre l'ultima versione), se non c'è rete la copia salvata
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(VERSIONE).then(c => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
