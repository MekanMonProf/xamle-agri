/* XAMLE AGRI — service worker : installation et fonctionnement hors connexion.
 * Changez VERSION à chaque mise à jour pour forcer le rafraîchissement du cache. */
var VERSION = 'xamle-v20261127a';
var CORE = [
  './', './index.html', './code.html', './profil.html', './app.html', './manifest.webmanifest',
  './assets/app.css', './assets/app.js', './assets/remote.js', './assets/auth.js', './assets/store.js', './assets/data.js', './assets/otp.js',
  './assets/vendor/lucide.min.js', './assets/logo-full.png', './assets/logo-mark.png', './assets/favicon.png',
  './assets/icon-192.png', './assets/icon-512.png',
  './assets/img/formalisation.jpg', './assets/img/assistance.jpg', './assets/img/b2b.jpg', './assets/img/opportunites.jpg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Pages : réseau d'abord (contenu à jour), cache si hors connexion.
// Fichiers statiques : cache d'abord (rapide), mis à jour en arrière-plan.
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  var url = new URL(req.url);
  var key = url.origin + url.pathname; // ignore ?v=... pour le cache

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(key, copy); });
      return res;
    }).catch(function () {
      return caches.match(key).then(function (r) { return r || caches.match('./index.html'); });
    }));
    return;
  }

  e.respondWith(caches.match(key).then(function (cached) {
    var network = fetch(req).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(key, copy); }); }
      return res;
    }).catch(function () { return cached; });
    return cached || network;
  }));
});
