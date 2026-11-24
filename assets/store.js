/* =====================================================================
 * XAMLE AGRI (version statique) — stockage local et navigation
 * Tout est enregistré dans le navigateur du visiteur (localStorage).
 * ===================================================================== */
(function () {
  'use strict';
  var KEY = 'xamle_agri_demo_v1';
  var memory = {};

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return memory; }
  }
  function save(obj) {
    memory = obj;
    try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch (e) {}
  }

  var Store = {
    get: function () { return load(); },
    set: function (patch) { var s = load(); Object.keys(patch).forEach(function (k) { s[k] = patch[k]; }); save(s); return s; },
    clear: function () { memory = {}; try { localStorage.removeItem(KEY); } catch (e) {} },
    defaultState: function (profile) {
      var s = JSON.parse(JSON.stringify(window.XAMLE_DEFAULT_STATE));
      s.orgName = profile.org || 'Votre structure';
      s.formalization.phonePay = profile.phone || '77 000 00 00';
      s.userRole = profile.type === 'ACHETEUR' ? 'ACHETEUR' : 'PRODUCTEUR';
      s.voiceLang = profile.lang === 'WO' ? 'WO' : 'FR';
      return s;
    },
    formatPhone: function (d) {
      return d.length === 9 ? d.slice(0, 2) + ' ' + d.slice(2, 5) + ' ' + d.slice(5, 7) + ' ' + d.slice(7) : d;
    },
    /** Redirige selon l'étape du parcours. page = 'connexion' | 'code' | 'profil' | 'app' */
    guard: function (page) {
      var s = load();
      var go = function (u) { location.replace(u); return false; };
      if (page === 'connexion') {
        if (s.verified) return go(s.profile ? 'app.html' : 'profil.html');
      } else if (page === 'code') {
        if (s.verified) return go(s.profile ? 'app.html' : 'profil.html');
        if (!s.otp) return go('index.html');
      } else if (page === 'profil') {
        if (!s.verified) return go('index.html');
      } else if (page === 'app') {
        if (!s.verified) return go('index.html');
        if (!s.profile) return go('profil.html');
      }
      return true;
    },
    logout: function () { Store.clear(); location.replace('index.html'); }
  };

  window.XamleStore = Store;
})();

/* ---------- Application installable (PWA) ---------- */
(function () {
  'use strict';
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
  var deferred = null;
  function showInstall(show) {
    document.querySelectorAll('[data-install]').forEach(function (el) { el.classList.toggle('hidden', !show); });
  }
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    showInstall(true);
  });
  window.addEventListener('appinstalled', function () { deferred = null; showInstall(false); });
  window.installApp = function () {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.finally(function () { deferred = null; showInstall(false); });
  };
})();
