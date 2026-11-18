/* XAMLE AGRI (version statique) — écrans Connexion, Code et Profil */
(function () {
  'use strict';
  var S = window.XamleStore;
  var page = document.body.dataset.page;
  if (!S.guard(page)) return;
  var st = S.get();

  function showError(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('hidden', !msg);
  }

  /* ---------- Connexion ---------- */
  if (page === 'connexion') {
    var form = document.getElementById('login-form');
    var tel = document.getElementById('tel');
    var err = document.getElementById('tel-error');
    var lang = st.lang || 'FR';
    if (st.phone) tel.value = st.phone;

    function paintLang() {
      document.querySelectorAll('[data-lang]').forEach(function (b) {
        var on = b.dataset.lang === lang;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      document.getElementById('wo-note').classList.toggle('hidden', lang !== 'WO');
    }
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      b.addEventListener('click', function () { lang = b.dataset.lang; S.set({ lang: lang }); paintLang(); });
    });
    paintLang();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = tel.value.replace(/\D/g, '');
      if (d.length === 12 && d.indexOf('221') === 0) d = d.slice(3);
      if (!/^7[05678]\d{7}$/.test(d)) {
        tel.classList.add('border-red-500');
        showError(err, 'Entrez un numéro sénégalais valide (9 chiffres, commençant par 70, 75, 76, 77 ou 78).');
        tel.focus();
        return;
      }
      S.set({ phone: S.formatPhone(d), lang: lang, otp: String(Math.floor(100000 + Math.random() * 900000)), otpTime: Date.now(), otpAttempts: 0 });
      location.href = 'code.html';
    });
  }

  /* ---------- Code ---------- */
  if (page === 'code') {
    var otpEl = document.getElementById('otp-value');
    var phoneEl = document.getElementById('otp-phone');
    var errEl = document.getElementById('otp-error');
    var infoEl = document.getElementById('otp-info');
    var inputs = Array.prototype.slice.call(document.querySelectorAll('.otp-input'));
    otpEl.textContent = st.otp;
    phoneEl.textContent = st.phone || '';

    document.getElementById('resend').addEventListener('click', function () {
      st = S.set({ otp: String(Math.floor(100000 + Math.random() * 900000)), otpTime: Date.now(), otpAttempts: 0 });
      otpEl.textContent = st.otp;
      showError(errEl, '');
      showError(infoEl, 'Nouveau code généré.');
      inputs.forEach(function (i) { i.value = ''; });
      inputs[0].focus();
    });

    document.getElementById('otp-form').addEventListener('submit', function (e) {
      e.preventDefault();
      st = S.get();
      var code = inputs.map(function (i) { return i.value; }).join('');
      var attempts = (st.otpAttempts || 0) + 1;
      S.set({ otpAttempts: attempts });
      showError(infoEl, '');
      if (attempts > 5) { S.set({ otp: null }); location.replace('index.html'); return; }
      if (Date.now() - (st.otpTime || 0) > 600000) { showError(errEl, 'Code expiré. Demandez un nouveau code.'); return; }
      if (code === st.otp) {
        st = S.set({ verified: true, otp: null, otpAttempts: 0 });
        location.replace(st.profile ? 'app.html' : 'profil.html');
      } else {
        inputs.forEach(function (i) { i.classList.add('border-red-500'); });
        showError(errEl, 'Code incorrect. Vérifiez les 6 chiffres.');
      }
    });
  }

  /* ---------- Profil ---------- */
  if (page === 'profil') {
    var f = document.getElementById('profil-form');
    var p = st.profile;
    if (p) {
      f.name.value = p.name;
      f.org.value = p.org || '';
      f.region.value = p.region;
      f.querySelectorAll('input[name="type"]').forEach(function (r) { r.checked = r.value === p.type; });
      f.querySelectorAll('input[name="filieres[]"]').forEach(function (c) { c.checked = p.filieres.indexOf(c.value) !== -1; });
      document.getElementById('profil-submit').textContent = 'Enregistrer';
      document.getElementById('profil-back').setAttribute('href', 'app.html');
    }

    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = f.name.value.trim();
      var typeEl = f.querySelector('input[name="type"]:checked');
      var fil = Array.prototype.map.call(f.querySelectorAll('input[name="filieres[]"]:checked'), function (c) { return c.value; });
      var org = f.org.value.trim();
      var errors = {
        name: name.length < 2 || name.length > 60 ? 'Indiquez votre nom complet.' : '',
        type: typeEl ? '' : "Choisissez un type d'acteur.",
        filieres: fil.length ? '' : 'Choisissez au moins une filière.',
        org: org.length > 60 ? '60 caractères maximum.' : ''
      };
      Object.keys(errors).forEach(function (k) { showError(document.getElementById('err-' + k), errors[k]); });
      if (Object.keys(errors).some(function (k) { return errors[k]; })) return;

      var profile = { name: name, type: typeEl.value, org: org, region: f.region.value, filieres: fil, phone: st.phone || '', lang: st.lang || 'FR' };
      var cur = S.get();
      var state = cur.state || S.defaultState(profile);
      state.orgName = org || 'Votre structure';
      S.set({ profile: profile, state: state });
      location.replace('app.html');
    });
  }
})();
