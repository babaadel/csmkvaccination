/* Service worker – Suivi vaccination Kankossa
   Met en cache l'application pour qu'elle s'ouvre sans Internet.
   Les données (Firestore) ont leur propre cache hors ligne dans la page ; elles ne passent pas par ici.
   À chaque nouvelle version de la plateforme, changer VERSION pour renouveler le cache. */
const VERSION = 'v2-2026-11-27';
const CACHE = 'kv-app-' + VERSION;
const SDK = 'https://www.gstatic.com/firebasejs/13.4.0/';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png'
];
const LIBS = [SDK + 'firebase-app.js', SDK + 'firebase-auth.js', SDK + 'firebase-firestore.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c =>
    // fichiers de l'application : obligatoires ; bibliothèque Firebase : si disponible (sinon mise en cache au premier usage)
    c.addAll(SHELL).then(() => Promise.all(LIBS.map(u => c.add(u).catch(() => null))))
  ).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('kv-app-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Page de l'application : réseau d'abord (pour recevoir les mises à jour), cache si hors ligne
  if (req.mode === 'navigate' && url.origin === location.origin) {
    e.respondWith(
      fetch(req)
        .then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return r; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Fichiers de l'application et bibliothèque Firebase (versionnée) : cache d'abord
  if (url.origin === location.origin || req.url.startsWith(SDK)) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(r => {
        if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return r;
      }))
    );
  }
  // Tout le reste (Firestore, authentification) : non intercepté
});
