/* =====================================================================
 * XAMLE AGRI — application (prototype de démonstration)
 * Version statique : les données viennent de assets/data.js et l'état
 * est sauvegardé dans le navigateur (localStorage) via assets/store.js.
 * ===================================================================== */
(function () {
  'use strict';

  var Store = window.XamleStore;
  if (!Store.guard('app')) return;
  var stored = Store.get();
  var D = window.XAMLE_DATA;
  var pr = stored.profile;
  var X = {
    profile: {
      name: pr.name, firstName: pr.name.trim().split(/\s+/)[0], type: D.profileTypes[pr.type] || pr.type,
      org: pr.org, region: pr.region, filieres: pr.filieres, phone: pr.phone
    },
    state: stored.state || Store.defaultState(pr),
    sae: D.sae, saeCategories: D.saeCategories, guides: D.guides, opportunities: D.opportunities,
    products: D.products, services: D.services, showcases: D.showcases, notifications: D.notifications
  };
  var P = X.profile;
  var saeData = X.sae;
  var guidesData = X.guides;
  var oppData = X.opportunities;
  var techServicesData = X.services;
  var showcasesData = X.showcases;

  var appState = X.state;
  appState.currentTab = 'accueil';
  appState.openGuide = null;
  var productsData = (appState.publishedProducts || []).concat(X.products);

  /* ---------------------------------------------------------------
   * Utilitaires
   * --------------------------------------------------------------- */
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fcfa(n) { return Number(n).toLocaleString('fr-FR') + ' FCFA'; }
  function $(id) { return document.getElementById(id); }
  function icons() { try { lucide.createIcons(); } catch (e) {} }

  var saveTimer = null;
  function saveState() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      var copy = {};
      Object.keys(appState).forEach(function (k) {
        if (k !== 'currentTab' && k !== 'openGuide') copy[k] = appState[k];
      });
      Store.set({ state: copy });
    }, 300);
  }

  function afterRender() { icons(); saveState(); }

  function closeBtn() {
    return '<button type="button" aria-label="Fermer" onclick="closeModal()" class="p-2 rounded-full bg-slate-100 text-slate-600"><i data-lucide="x" class="w-4 h-4"></i></button>';
  }

  /* ---------------------------------------------------------------
   * En-tête, navigation, toast, modale
   * --------------------------------------------------------------- */
  function renderHeader() {
    var isProducer = appState.userRole === 'PRODUCTEUR';
    $('header-user-label').textContent = isProducer
      ? P.name + ' • ' + (appState.orgName || P.type) + ' (' + P.region + ')'
      : P.name + ' • Acheteur professionnel (' + P.region + ')';
    $('role-switch-label').textContent = isProducer ? 'Mode Acheteur' : 'Mode Producteur';

    var badge = $('header-status-badge');
    if (appState.formalization.paid) {
      badge.className = 'status-badge is-formal';
      badge.innerHTML = '<i data-lucide="badge-check" class="w-3.5 h-3.5"></i><span>Formalisé</span>';
    } else {
      badge.className = 'status-badge is-informal';
      badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span><span>Informel</span>';
    }
    if (appState.notificationsRead) $('notif-dot').classList.add('hidden');
    icons();
  }

  function switchTab(tabName) {
    appState.currentTab = tabName;
    if (tabName !== 'formalisation') appState.openGuide = null;
    document.querySelectorAll('.nav-btn').forEach(function (btn) {
      var active = btn.dataset.tab === tabName;
      btn.classList.toggle('is-active', active);
      if (active) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current');
    });
    var main = $('main-content');
    main.scrollTop = 0;
    if (tabName === 'accueil') renderAccueil();
    else if (tabName === 'formalisation') renderFormalisation();
    else if (tabName === 'assistance') renderAssistance();
    else if (tabName === 'b2b') renderB2B();
    else if (tabName === 'opportunites') renderOpportunites();
    afterRender();
  }

  function toggleUserRole() {
    appState.userRole = appState.userRole === 'PRODUCTEUR' ? 'ACHETEUR' : 'PRODUCTEUR';
    renderHeader();
    showToast(appState.userRole === 'PRODUCTEUR' ? 'Profil basculé : Producteur / GIE' : 'Profil basculé : Acheteur professionnel B2B');
    switchTab(appState.currentTab);
  }

  function showToast(message) {
    $('toast-message').textContent = message;
    $('toast-box').classList.remove('hidden');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(function () { $('toast-box').classList.add('hidden'); }, 3500);
    saveState();
  }

  var lastFocus = null;
  function openModal(html) {
    lastFocus = document.activeElement;
    $('modal-container').innerHTML = html;
    $('modal-backdrop').classList.remove('hidden');
    icons();
    var first = $('modal-container').querySelector('button, input, select, textarea, a[href]');
    if (first) first.focus();
  }
  function closeModal() {
    $('modal-backdrop').classList.add('hidden');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  $('modal-backdrop').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('modal-backdrop').classList.contains('hidden')) closeModal();
  });

  function openNotificationsModal() {
    appState.notificationsRead = true;
    $('notif-dot').classList.add('hidden');
    saveState();
    openModal(
      '<div class="space-y-4">' +
        '<div class="flex items-center justify-between"><h2 class="text-base font-extrabold">Notifications</h2>' + closeBtn() + '</div>' +
        '<div class="space-y-2.5">' +
          X.notifications.map(function (n) {
            return '<div class="p-3 rounded-2xl ' + (n.unread ? 'bg-xamle-blueLight/60 border border-xamle-blue/25' : 'bg-slate-50 border border-slate-100') + ' space-y-1">' +
              '<div class="flex justify-between items-center gap-2"><span class="text-[13px] font-bold">' + esc(n.title) + '</span><span class="text-[11.5px] text-slate-500 shrink-0">' + esc(n.time) + '</span></div>' +
              '<p class="text-[12.5px] text-slate-600">' + esc(n.desc) + '</p></div>';
          }).join('') +
        '</div>' +
        '<button type="button" onclick="closeModal()" class="w-full py-3 rounded-xl bg-xamle-green text-white font-bold text-[13px]">Fermer</button>' +
      '</div>'
    );
  }

  /* ---------------------------------------------------------------
   * Opportunités correspondant au profil
   * --------------------------------------------------------------- */
  function matchesProfile(o) {
    var regionOk = o.regions.indexOf('Toutes régions') !== -1 || o.regions.indexOf(P.region) !== -1;
    var filOk = o.filieres.some(function (f) { return P.filieres.indexOf(f) !== -1; });
    return regionOk || filOk;
  }

  function statusPill(o) {
    var open = o.status !== 'Clôturé';
    return '<span class="inline-block px-2 py-0.5 rounded-lg text-[11.5px] font-bold ' + (open ? 'bg-emerald-100 text-xamle-green' : 'bg-slate-200 text-slate-700') + '">' + esc(o.status) + '</span>';
  }
  function byStatus(a, b) { return (a.status === 'Clôturé') - (b.status === 'Clôturé'); }

  function oppCard(o) {
    return '<button type="button" onclick="openOpportunity(\'' + o.id + '\')" class="card w-full text-left space-y-2 hover:border-xamle-green transition">' +
      '<span class="flex gap-1.5 flex-wrap"><span class="inline-block px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 text-[11.5px] font-bold">' + esc(o.type) + '</span>' + statusPill(o) + '</span>' +
      '<span class="block text-[14px] font-bold leading-snug">' + esc(o.title) + '</span>' +
      '<span class="block text-[12.5px] text-slate-600">' + esc(o.org) + ' • ' + esc(o.regions.join(', ')) + '</span>' +
      '<span class="flex items-center gap-1.5 text-[12.5px] text-slate-600"><i data-lucide="calendar" class="w-3.5 h-3.5"></i> Date limite : ' + esc(o.deadline) + '</span>' +
    '</button>';
  }

  /* ---------------------------------------------------------------
   * Onglet 1 : Accueil
   * --------------------------------------------------------------- */
  function renderAccueil() {
    var f = appState.formalization;
    var isFormalized = f.paid;
    var isProducer = appState.userRole === 'PRODUCTEUR';
    var gie = guidesData[0];
    var gieStep = appState.guideProgress[gie.id] || 0;
    var forYou = oppData.filter(matchesProfile).sort(byStatus).slice(0, 2);

    $('main-content').innerHTML =

      '<section>' +
        '<h2 class="section-title mb-2">Les 4 piliers XAMLE AGRI</h2>' +
        '<div class="grid grid-cols-2 gap-2.5">' +
          pillar('formalisation', 'formalisation', 'Formalisation', 'GIE, NINEA, RCCM, Carte pro') +
          pillar('assistance', 'assistance', 'Assistance', 'Annuaire des structures d\'appui') +
          pillar('b2b', 'b2b', 'B2B', 'Contrats, stocks & services') +
          pillar('opportunites', 'opportunites', 'Opportunités', 'Subventions, programmes, vitrines') +
        '</div>' +
      '</section>' +

      (isProducer ?
      '<section class="card space-y-2">' +
        '<div class="flex items-center justify-between"><h2 class="section-title">Mon dossier</h2><span class="text-[11.5px] font-bold text-xamle-green">' + (appState.activeOrders.length + 1) + ' suivis</span></div>' +
        '<button type="button" onclick="openGuide(\'gie\')" class="track-row w-full text-left">' +
          '<span class="track-icon bg-amber-100 text-amber-800"><i data-lucide="file-text" class="w-4 h-4"></i></span>' +
          '<span class="flex-1"><span class="block text-[13px] font-bold">Guide : ' + esc(gie.title) + '</span><span class="block text-[11.5px] text-slate-500">Étape ' + Math.min(gieStep + 1, gie.steps.length) + ' sur ' + gie.steps.length + '</span></span>' +
          '<span class="text-[11.5px] font-bold text-amber-800">Continuer →</span></button>' +
        '<button type="button" onclick="switchTab(\'formalisation\')" class="track-row w-full text-left">' +
          '<span class="track-icon ' + (isFormalized ? 'bg-emerald-100 text-xamle-green' : 'bg-amber-100 text-amber-800') + '"><i data-lucide="' + (isFormalized ? 'badge-check' : 'file-clock') + '" class="w-4 h-4"></i></span>' +
          '<span class="flex-1"><span class="block text-[13px] font-bold">Démarche en ligne BCE / APIX</span><span class="block text-[11.5px] text-slate-500">' + (isFormalized ? 'NINEA & RCCM disponibles (spécimen)' : 'Diagnostic prêt') + '</span></span>' +
          '<span class="text-[11.5px] font-bold ' + (isFormalized ? 'text-xamle-green' : 'text-amber-800') + '">' + (isFormalized ? 'Certificat →' : 'Continuer →') + '</span></button>' +
        appState.activeOrders.map(function (o) {
          return '<button type="button" onclick="switchTab(\'b2b\')" class="track-row w-full text-left">' +
            '<span class="track-icon bg-xamle-blueLight text-xamle-blue"><i data-lucide="truck" class="w-4 h-4"></i></span>' +
            '<span class="flex-1"><span class="block text-[13px] font-bold">' + esc(o.product) + ' (' + esc(o.qty) + ' ' + esc(o.unit) + ')</span><span class="block text-[11.5px] text-slate-500">' + esc(o.partner) + ' • Livr. ' + esc(o.deliveryDate) + '</span></span>' +
            '<span class="text-[11.5px] font-bold text-xamle-blue">' + esc(o.status) + '</span></button>';
        }).join('') +
      '</section>' : '') +

      '<section class="space-y-2.5">' +
        '<div class="flex items-baseline justify-between"><h2 class="section-title">Pour vous</h2><button type="button" onclick="switchTab(\'opportunites\')" class="text-[13px] font-semibold text-xamle-green">Tout voir</button></div>' +
        (forYou.length ? forYou.map(oppCard).join('') : '<p class="text-[13px] text-slate-500">Aucune opportunité pour votre profil pour le moment.</p>') +
      '</section>';
  }

  // Carte pilier : photo + libellé (images dans assets/img/)
  function pillar(tab, img, title, sub) {
    return '<button type="button" onclick="switchTab(\'' + tab + '\')" class="pillar-card group">' +
      '<span class="block overflow-hidden rounded-xl"><img src="assets/img/' + img + '.jpg?v=20261120c" alt="" class="w-full aspect-[4/3] object-cover transition duration-300 group-hover:scale-105"></span>' +
      '<span class="pillar-label">' + title + '</span>' +
      '<span class="block text-[11.5px] text-slate-600 leading-tight text-center px-1">' + sub + '</span></button>';
  }

  // Bandeau photo en haut d'un onglet
  function banner(img, title, sub) {
    return '<div class="relative h-32 rounded-2xl overflow-hidden bg-gradient-to-br from-xamle-green to-[#24595A]">' +
      '<img src="assets/img/' + img + '.jpg?v=20261120c" alt="" class="absolute right-0 top-0 h-full w-[58%] object-cover object-[center_20%]" style="-webkit-mask-image:linear-gradient(to right,transparent,#000 45%);mask-image:linear-gradient(to right,transparent,#000 45%)">' +
      '<div class="relative h-full w-[62%] p-3.5 flex flex-col justify-end text-white"><h1 class="text-[18px] font-extrabold leading-tight">' + title + '</h1><p class="text-[12.5px] text-white/90 leading-snug mt-0.5">' + sub + '</p></div></div>';
  }

  /* ---------------------------------------------------------------
   * Onglet 2 : Formaliser (guides V1 + démarche en ligne V2)
   * --------------------------------------------------------------- */
  function renderFormalisation() {
    if (appState.openGuide) return renderGuide(appState.openGuide);
    var sub = appState.formSubTab || 'GUIDES';
    $('main-content').innerHTML =
      '<div class="space-y-3.5">' +
        banner('formalisation', 'Formalisation', 'Guides pas à pas et démarche en ligne.') +
        segmented([['GUIDES', 'Guides pas à pas'], ['BCE', 'Démarche en ligne']], sub, 'setFormSubTab') +
        (sub === 'GUIDES' ? guidesList() : bceFlow()) +
      '</div>';
  }

  function segmented(items, current, fn) {
    return '<div class="grid grid-cols-' + items.length + ' bg-slate-200/80 p-1 rounded-xl" role="tablist">' +
      items.map(function (it) {
        var on = it[0] === current;
        return '<button type="button" role="tab" aria-selected="' + on + '" onclick="' + fn + '(\'' + it[0] + '\')" class="py-2 rounded-lg text-[13px] font-bold transition ' + (on ? 'bg-white text-xamle-green shadow-sm' : 'text-slate-600') + '">' + it[1] + '</button>';
      }).join('') + '</div>';
  }

  function setFormSubTab(v) { appState.formSubTab = v; renderFormalisation(); afterRender(); }

  function guidesList() {
    return '<p class="text-[13px] text-slate-600">Chaque guide explique les étapes, les pièces à fournir et où s\'adresser.</p>' +
      guidesData.map(function (g) {
        var done = appState.guideProgress[g.id] || 0;
        var status = done >= g.steps.length ? '<span class="pill bg-emerald-100 text-xamle-green">Terminé</span>'
          : done > 0 ? '<span class="pill bg-amber-200 text-amber-900">En cours · ' + done + '/' + g.steps.length + '</span>' : '';
        return '<button type="button" onclick="openGuide(\'' + g.id + '\')" class="card w-full flex items-center gap-3.5 text-left hover:border-xamle-green transition">' +
          '<span class="w-11 h-11 rounded-xl bg-xamle-greenPale text-xamle-green flex items-center justify-center shrink-0"><i data-lucide="file-text" class="w-5 h-5"></i></span>' +
          '<span class="flex-1 space-y-1"><span class="block text-[15px] font-bold">' + esc(g.title) + '</span><span class="flex items-center gap-2 text-[12.5px] text-slate-600 flex-wrap">' + g.steps.length + ' étapes · audio wolof ' + status + '</span></span>' +
          '<i data-lucide="chevron-right" class="w-5 h-5 text-slate-400"></i></button>';
      }).join('') +
      '<div class="flex gap-3 items-start p-3.5 rounded-2xl bg-xamle-greenPale text-[13px] text-xamle-green font-medium">' +
        '<i data-lucide="message-circle" class="w-5 h-5 shrink-0"></i><span>Besoin d\'aide pour votre dossier ? Un conseiller peut vous accompagner.</span></div>';
  }

  function openGuide(id) {
    appState.openGuide = id;
    if (appState.currentTab !== 'formalisation') {
      appState.currentTab = 'formalisation';
      document.querySelectorAll('.nav-btn').forEach(function (b) { b.classList.toggle('is-active', b.dataset.tab === 'formalisation'); });
    }
    $('main-content').scrollTop = 0;
    renderGuide(id);
    afterRender();
  }

  function closeGuide() { appState.openGuide = null; renderFormalisation(); afterRender(); }

  function renderGuide(id) {
    var g = guidesData.filter(function (x) { return x.id === id; })[0];
    if (!g) { appState.openGuide = null; return renderFormalisation(); }
    var done = appState.guideProgress[g.id] || 0;
    var pct = Math.round(done / g.steps.length * 100);
    $('main-content').innerHTML =
      '<div class="space-y-3.5">' +
        '<div class="flex items-center gap-1"><button type="button" onclick="closeGuide()" aria-label="Retour aux guides" class="p-2 -ml-2 rounded-full"><i data-lucide="chevron-left" class="w-5 h-5"></i></button><h1 class="text-[17px] font-extrabold">' + esc(g.title) + '</h1></div>' +
        '<div class="flex items-center gap-3 p-3 bg-xamle-green rounded-2xl text-white">' +
          '<button type="button" onclick="showToast(\'Audio wolof à enregistrer par l\\\'équipe.\')" aria-label="Écouter en wolof" class="w-11 h-11 rounded-full bg-amber-300 text-xamle-text flex items-center justify-center shrink-0"><i data-lucide="play" class="w-5 h-5"></i></button>' +
          '<span class="flex-1 text-[14px] font-semibold">Écouter en wolof</span><span class="text-[12px] opacity-90">audio à venir</span></div>' +
        '<div class="space-y-1.5"><div class="flex justify-between text-[13px] text-slate-600"><span>Progression</span><span class="font-semibold text-xamle-green">' + done + ' sur ' + g.steps.length + '</span></div>' +
          '<div class="h-2 rounded bg-slate-200" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><div class="h-2 rounded bg-xamle-green transition-all" style="width:' + pct + '%"></div></div></div>' +
        '<ol class="card !py-1">' +
          g.steps.map(function (s, i) {
            var state = i < done ? 'done' : i === done ? 'current' : 'todo';
            var bullet = state === 'done'
              ? '<span class="step-dot bg-xamle-green text-white"><i data-lucide="check" class="w-4 h-4"></i></span>'
              : '<span class="step-dot ' + (state === 'current' ? 'border-2 border-xamle-green text-xamle-green' : 'border border-slate-300 text-slate-500') + '">' + (i + 1) + '</span>';
            return '<li class="flex gap-3 items-start py-2.5' + (i ? ' border-t border-slate-100' : '') + '">' + bullet +
              '<span class="pt-1"><span class="block text-[14.5px] ' + (state === 'current' ? 'font-bold' : 'font-semibold') + '">' + esc(s.t) + '</span><span class="block text-[12.5px] text-slate-600">' + esc(s.d) + '</span></span></li>';
          }).join('') +
        '</ol>' +
        '<div class="p-3 rounded-xl bg-amber-50 text-amber-900 text-[13px] font-medium">' + esc(g.cost) + '</div>' +
        '<div class="grid grid-cols-2 gap-2.5 pt-1">' +
          '<button type="button" onclick="switchTab(\'assistance\')" class="btn-outline">Où s\'adresser</button>' +
          (done < g.steps.length
            ? '<button type="button" onclick="advanceGuide(\'' + g.id + '\')" class="btn-primary !min-h-[48px]">Étape suivante</button>'
            : '<button type="button" onclick="resetGuide(\'' + g.id + '\')" class="btn-primary !min-h-[48px]">Recommencer</button>') +
        '</div>' +
      '</div>';
  }

  function advanceGuide(id) {
    var g = guidesData.filter(function (x) { return x.id === id; })[0];
    appState.guideProgress[id] = Math.min((appState.guideProgress[id] || 0) + 1, g.steps.length);
    renderGuide(id); afterRender();
    showToast(appState.guideProgress[id] >= g.steps.length ? 'Guide terminé, bravo !' : 'Étape validée.');
  }
  function resetGuide(id) { appState.guideProgress[id] = 0; renderGuide(id); afterRender(); }

  function bceFlow() {
    var f = appState.formalization;
    return '' +
      '<div class="card">' +
        '<div class="flex items-center justify-between relative">' +
          '<div class="absolute top-3 left-4 right-4 h-0.5 bg-slate-200"></div>' +
          '<div class="absolute top-3 left-4 h-0.5 transition-all ' + (f.paid ? 'right-4 bg-xamle-green' : 'w-1/2 bg-xamle-blue') + '"></div>' +
          progressDot('1', 'Statut', true) + progressDot('2', 'Pièces', f.docs.cni && f.docs.residence) + progressDot('3', 'NINEA/RCCM', f.paid) +
        '</div>' +
        (f.paid ?
          '<div class="mt-3.5 p-3 rounded-xl bg-xamle-greenPale border border-xamle-green/30 flex items-center justify-between gap-2">' +
            '<div><p class="text-[13px] font-extrabold text-xamle-green">Formalisé • NINEA ' + esc(f.ninea) + '</p><p class="text-[11.5px] text-slate-600">RCCM : ' + esc(f.rccm) + '</p></div>' +
            '<button type="button" onclick="openCertificateModal()" class="bg-xamle-green text-white text-[12.5px] font-bold px-3 py-2 rounded-lg flex items-center gap-1 shrink-0"><i data-lucide="file-text" class="w-3.5 h-3.5"></i> Certificat</button>' +
          '</div>' : '') +
      '</div>' +

      '<div class="card space-y-2.5">' +
        '<div class="flex items-center justify-between"><h2 class="text-[13px] font-extrabold text-xamle-green">Étape 1 : Diagnostic juridique</h2><span class="pill bg-xamle-blueLight text-xamle-blue">Calcul auto</span></div>' +
        '<label class="block"><span class="field-label">Activité principale</span>' +
          select('activity', ['Maraîchage & Horticulture', 'Aviculture & Élevage', 'Transformation Agroalimentaire', 'Pisciculture & Aquaculture'], f.activity) + '</label>' +
        '<div class="grid grid-cols-2 gap-2">' +
          '<label class="block"><span class="field-label">Membres / associés</span>' +
            select('partners', [['Seul', 'Seul (1 pers.)'], ['Plusieurs associés (2 à 10)', '2 à 10 associés'], ['Coopérative (+10)', '+10 membres'], ['Société commerciale', 'Société / Export']], f.partners) + '</label>' +
          '<label class="block"><span class="field-label">Chiffre d\'affaires</span>' +
            select('revenue', [['Moins de 10 Millions FCFA / an', '< 10M FCFA/an'], ['10 à 50 Millions FCFA / an', '10M - 50M FCFA'], ['Plus de 50 Millions FCFA / an', '> 50M FCFA']], f.revenue) + '</label>' +
        '</div>' +
        '<div class="p-3 rounded-xl bg-xamle-blueLight/70 border border-xamle-blue/25 flex items-center justify-between gap-2">' +
          '<div><p class="text-[11px] font-bold uppercase text-xamle-blue">Statut recommandé</p><p class="text-[13px] font-extrabold">' + esc(f.recommendedEntity) + '</p></div>' +
          '<div class="text-right"><p class="text-[11px] text-slate-600">Frais (exemple)</p><p class="text-sm font-extrabold text-xamle-green">' + fcfa(f.fee) + '</p></div>' +
        '</div>' +
      '</div>' +

      '<div class="card space-y-2.5">' +
        '<h2 class="text-[13px] font-extrabold text-xamle-green">Étape 2 : Dépôt des pièces</h2>' +
        '<div class="grid grid-cols-2 gap-2.5">' + docButton('cni', 'CNI recto/verso', 'camera') + docButton('residence', 'Cert. résidence', 'file-up') + '</div>' +
      '</div>' +

      '<div class="card space-y-3">' +
        '<div class="flex items-center justify-between"><h2 class="text-[13px] font-extrabold text-xamle-green">Étape 3 : Paiement mobile</h2><span class="text-[11.5px] text-slate-500 flex items-center gap-1"><i data-lucide="shield-check" class="w-3.5 h-3.5 text-xamle-green"></i> Simulation</span></div>' +
        '<div class="grid grid-cols-3 gap-2">' +
          provider('WAVE', 'Wave', '<span class="inline-flex w-6 h-6 rounded-md bg-sky-400 text-white font-black text-[12px] items-center justify-center">W</span>') +
          provider('ORANGE_MONEY', 'Orange Money', '<span class="inline-flex w-6 h-6 rounded-md bg-black text-orange-500 font-black text-[10.5px] items-center justify-center">OM</span>') +
          provider('CARTE', 'Carte', '<i data-lucide="credit-card" class="w-5 h-5 mx-auto"></i>') +
        '</div>' +
        (f.selectedProvider === 'CARTE'
          ? '<p class="text-[12.5px] text-slate-600 bg-slate-50 rounded-xl p-2.5">Paiement par carte : redirection vers la page sécurisée du prestataire (non incluse dans la démo).</p>'
          : '<label class="block"><span class="field-label">Numéro Mobile Money</span><input type="tel" value="' + esc(f.phonePay) + '" oninput="setPhonePay(this.value)" class="field-sm"></label>') +
        '<button type="button" onclick="executeFormalizationPayment()" class="btn-primary w-full !min-h-[48px] flex items-center justify-center gap-2">' +
          '<span>' + (f.paid ? 'Démarche déjà effectuée' : 'Payer ' + fcfa(f.fee) + ' (simulation)') + '</span><i data-lucide="arrow-right" class="w-4 h-4"></i></button>' +
      '</div>';
  }

  function progressDot(n, label, done) {
    return '<div class="relative z-10 flex flex-col items-center"><span class="w-6 h-6 rounded-full ' + (done ? 'bg-xamle-green text-white' : 'bg-slate-200 text-slate-600') + ' flex items-center justify-center text-[12px] font-bold">' + n + '</span><span class="text-[11px] font-bold text-slate-700 mt-1">' + label + '</span></div>';
  }

  function select(key, options, current) {
    return '<select onchange="updateDiagnostic(\'' + key + '\', this.value)" class="field-sm">' +
      options.map(function (o) {
        var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o;
        return '<option value="' + esc(v) + '"' + (v === current ? ' selected' : '') + '>' + esc(l) + '</option>';
      }).join('') + '</select>';
  }

  function docButton(key, label, icon) {
    var ok = appState.formalization.docs[key];
    return '<button type="button" onclick="toggleDoc(\'' + key + '\')" aria-pressed="' + ok + '" class="p-3 rounded-xl border flex flex-col items-center text-center transition ' +
      (ok ? 'bg-xamle-greenPale border-xamle-green text-xamle-green' : 'bg-xamle-bg border-dashed border-slate-300 text-slate-600') + '">' +
      '<i data-lucide="' + (ok ? 'check-circle-2' : icon) + '" class="w-5 h-5 mb-1"></i>' +
      '<span class="text-[12.5px] font-bold">' + label + '</span><span class="text-[11px] mt-0.5">' + (ok ? 'Pièce ajoutée ✓' : 'Appuyer pour ajouter') + '</span></button>';
  }

  function provider(id, label, logo) {
    var on = appState.formalization.selectedProvider === id;
    return '<button type="button" aria-pressed="' + on + '" onclick="setProvider(\'' + id + '\')" class="p-2 rounded-xl border text-center transition ' +
      (on ? 'border-xamle-green bg-xamle-greenPale ring-1 ring-xamle-green' : 'border-slate-200 bg-xamle-bg') + '">' + logo +
      '<span class="block text-[11.5px] font-extrabold text-slate-800 mt-1">' + label + '</span></button>';
  }

  function setProvider(id) { appState.formalization.selectedProvider = id; renderFormalisation(); afterRender(); }
  function setPhonePay(v) { appState.formalization.phonePay = v; saveState(); }

  var DIAG = {
    'Seul': ['Entreprise Individuelle (EI)', 10000],
    'Plusieurs associés (2 à 10)': ["GIE (Groupement d'Intérêt Économique)", 15000],
    'Coopérative (+10)': ['Société Coopérative Simplifiée (SCOOPS)', 20000],
    'Société commerciale': ['SARL Agro-Industrielle', 35000]
  };
  function updateDiagnostic(key, val) {
    var f = appState.formalization;
    f[key] = val;
    var d = DIAG[f.partners] || DIAG['Société commerciale'];
    f.recommendedEntity = d[0]; f.fee = d[1];
    renderFormalisation(); afterRender();
  }

  function toggleDoc(k) {
    var docs = appState.formalization.docs;
    docs[k] = !docs[k];
    renderFormalisation(); afterRender();
    if (docs[k]) showToast('Pièce ajoutée et vérifiée (simulation).');
  }

  function executeFormalizationPayment() {
    var f = appState.formalization;
    if (!f.paid) {
      if (!f.docs.cni || !f.docs.residence) { showToast('Ajoutez d\'abord les deux pièces (étape 2).'); return; }
      f.paid = true;
      renderHeader();
    }
    renderFormalisation(); afterRender();
    openCertificateModal();
  }

  function openCertificateModal() {
    var f = appState.formalization;
    openModal(
      '<div class="space-y-4">' +
        '<div class="flex items-center justify-between"><span class="pill bg-xamle-greenPale text-xamle-green uppercase">Spécimen de démonstration</span>' + closeBtn() + '</div>' +
        '<div class="p-4 rounded-2xl bg-xamle-bg border-2 border-xamle-green/40 space-y-3">' +
          '<div class="flex items-center justify-between border-b border-slate-200 pb-2"><div><p class="text-[11px] font-bold uppercase text-slate-500">Exemple d\'attestation — sans valeur</p><h2 class="text-[13px] font-extrabold">ATTESTATION D\'IMMATRICULATION</h2></div><i data-lucide="qr-code" class="w-9 h-9 text-xamle-green"></i></div>' +
          '<dl class="space-y-1.5 text-[13px]">' +
            row('Dénomination', esc((appState.orgName || 'Votre structure').toUpperCase())) +
            row('Forme juridique', esc(f.recommendedEntity)) +
            row('NINEA', '<span class="text-xamle-green">' + esc(f.ninea) + '</span>') +
            row('RCCM', '<span class="text-xamle-blue">' + esc(f.rccm) + '</span>') +
          '</dl>' +
        '</div>' +
        '<button type="button" onclick="closeModal(); showToast(\'Téléchargement PDF : fonctionnalité prévue en V2.\')" class="btn-primary w-full !min-h-[48px] flex items-center justify-center gap-2"><i data-lucide="download" class="w-4 h-4"></i> Télécharger (V2)</button>' +
      '</div>'
    );
  }
  function row(k, v) { return '<div class="flex justify-between gap-3"><dt class="text-slate-600">' + k + ' :</dt><dd class="font-bold text-right">' + v + '</dd></div>'; }

  /* ---------------------------------------------------------------
   * Onglet 3 : Assistance (annuaire + assistant vocal)
   * --------------------------------------------------------------- */
  function renderAssistance() {
    var q = (appState.saeSearch || '').toLowerCase();
    var filtered = saeData.filter(function (s) {
      var cat = appState.saeFilter === 'TOUS' || s.category === appState.saeFilter;
      var txt = !q || (s.acronym + ' ' + s.name + ' ' + s.desc).toLowerCase().indexOf(q) !== -1;
      return cat && txt;
    });
    $('main-content').innerHTML =
      '<div class="space-y-3.5">' +
        banner('assistance', 'Assistance', 'Annuaire des ' + saeData.length + ' structures d\'appui et conseil.') +
        '<div class="flex items-center justify-end gap-2">' +
          '<button type="button" onclick="openVoiceModal()" class="bg-xamle-blue text-white text-[12.5px] font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shrink-0"><i data-lucide="mic" class="w-3.5 h-3.5"></i> Assistant vocal</button></div>' +
        '<div class="relative"><i data-lucide="search" class="w-4 h-4 text-slate-500 absolute left-3 top-3"></i>' +
          '<label for="sae-search" class="sr-only">Rechercher une structure</label>' +
          '<input id="sae-search" type="search" value="' + esc(appState.saeSearch) + '" placeholder="Rechercher APIX, DER/FJ, ITA…" class="field-sm !pl-9" oninput="setSaeSearch(this.value)"></div>' +
        '<div class="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">' +
          Object.keys(X.saeCategories).map(function (id) {
            var on = appState.saeFilter === id;
            return '<button type="button" aria-pressed="' + on + '" onclick="setSaeFilter(\'' + id + '\')" class="filter-chip ' + (on ? 'is-on' : '') + '">' + esc(X.saeCategories[id]) + '</button>';
          }).join('') +
        '</div>' +
        '<div id="sae-list" class="space-y-2.5">' + saeList(filtered) + '</div>' +
      '</div>';
  }

  function saeList(list) {
    if (!list.length) return '<p class="text-[13px] text-slate-500 text-center py-6">Aucune structure ne correspond.</p>';
    return list.map(function (s) {
      return '<button type="button" onclick="openSaeDetail(\'' + s.id + '\')" class="card w-full text-left hover:border-xamle-green transition">' +
        '<span class="flex items-start justify-between gap-2"><span class="flex items-center gap-2.5">' +
          '<span class="w-11 h-11 rounded-xl bg-xamle-greenPale text-xamle-green font-extrabold text-[11.5px] flex items-center justify-center shrink-0 text-center leading-tight">' + esc(s.acronym.split('/')[0].trim()) + '</span>' +
          '<span><span class="block text-[11px] font-bold text-xamle-blue uppercase">' + esc(s.tag) + '</span><span class="block text-[13px] font-extrabold leading-snug">' + esc(s.acronym) + ' — ' + esc(s.name) + '</span></span></span>' +
          '<i data-lucide="chevron-right" class="w-4 h-4 text-slate-400 shrink-0 mt-1"></i></span>' +
        '<span class="block text-[12.5px] text-slate-600 mt-2 line-clamp-2 leading-relaxed">' + esc(s.desc) + '</span></button>';
    }).join('');
  }

  // La recherche ne redessine que la liste (le champ garde le focus).
  function setSaeSearch(v) {
    appState.saeSearch = v;
    var q = v.toLowerCase();
    var filtered = saeData.filter(function (s) {
      var cat = appState.saeFilter === 'TOUS' || s.category === appState.saeFilter;
      return cat && (!q || (s.acronym + ' ' + s.name + ' ' + s.desc).toLowerCase().indexOf(q) !== -1);
    });
    $('sae-list').innerHTML = saeList(filtered);
    afterRender();
  }
  function setSaeFilter(id) { appState.saeFilter = id; renderAssistance(); afterRender(); }

  function openSaeDetail(id) {
    var s = saeData.filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    openModal(
      '<div class="space-y-4">' +
        '<div class="flex items-start justify-between gap-2"><div><span class="pill bg-xamle-blueLight text-xamle-blue uppercase">' + esc(s.tag) + '</span>' +
          '<h2 class="text-[17px] font-extrabold mt-1">' + esc(s.acronym) + '</h2><p class="text-[13px] text-slate-600">' + esc(s.name) + '</p></div>' + closeBtn() + '</div>' +
        '<p class="text-[13px] text-slate-700 leading-relaxed bg-xamle-bg p-3 rounded-xl border border-slate-200/60">' + esc(s.desc) + '</p>' +
        '<div class="space-y-1.5"><h3 class="text-[13px] font-bold text-xamle-green flex items-center gap-1.5"><i data-lucide="user-check" class="w-4 h-4"></i> Conditions</h3><p class="text-[13px] text-slate-700">' + esc(s.eligibility) + '</p></div>' +
        '<div class="space-y-1.5"><h3 class="text-[13px] font-bold text-xamle-green flex items-center gap-1.5"><i data-lucide="folder-check" class="w-4 h-4"></i> Pièces requises</h3><ul class="space-y-1">' +
          s.docs.map(function (d) { return '<li class="text-[13px] text-slate-700 flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-xamle-blue"></span>' + esc(d) + '</li>'; }).join('') + '</ul></div>' +
        '<div class="p-3 rounded-xl bg-xamle-greenPale/70 text-[13px] flex items-center gap-2"><i data-lucide="map-pin" class="w-4 h-4 text-xamle-green shrink-0"></i><span class="font-medium">' + esc(s.contact) + '</span></div>' +
        '<div class="grid grid-cols-2 gap-2.5">' +
          '<button type="button" onclick="showToast(\'Numéro à confirmer par l\\\'équipe.\')" class="btn-outline flex items-center justify-center gap-2"><i data-lucide="phone" class="w-4 h-4"></i> Appeler</button>' +
          '<button type="button" onclick="showToast(\'Contact WhatsApp à confirmer par l\\\'équipe.\')" class="btn-outline flex items-center justify-center gap-2"><i data-lucide="message-circle" class="w-4 h-4"></i> WhatsApp</button>' +
        '</div>' +
        '<button type="button" onclick="closeModal(); showToast(\'Demande de rendez-vous enregistrée (simulation).\')" class="btn-primary w-full !min-h-[48px]">Demander un rendez-vous</button>' +
      '</div>'
    );
  }

  // Assistant vocal (simulation) — textes FR / Wolof / Pulaar du prototype initial
  var VOICE = {
    FR: [
      { q: 'Comment financer un forage solaire pour mon GIE ?', a: 'Pour un forage solaire, je vous oriente vers la DER/FJ et l’ANIDA. Assurez-vous d’avoir votre NINEA dans l’onglet Formaliser.' },
      { q: 'Comment exporter mes mangues et piments ?', a: 'Contactez l’ASEPEX pour l’appui export et l’ASN pour les normes. Vous aurez besoin d’une carte Import-Export.' }
    ],
    WO: [
      { q: 'Naka laay def ba am ndimbal ngir pompe solaire ?', a: 'Mën nga jaar ci DER/FJ walla FONGIP. Bu njëkk, defaral sa këyitu NINEA ci Xamle Agri ngir bank yi ak nguur gi mën la jàppale.' },
      { q: 'Fan laay jaay sama meññeef ci marché B2B ?', a: 'Ubbil onglet B2B bi, bindal li nga am ci stock, hôtels yi ak grossistes yi dinañu la jëkkal command.' }
    ],
    PU: [
      { q: 'Holno mbaawmi heɓde ballal ngam gese am ?', a: 'Aɗa waawi jokkondirde e DER/FJ walla FNDASP. Adan fof, winndito ngam heɓde NINEA maa e nder Xamle Agri.' },
      { q: 'Holno mbaawmi soodde kuutorɗe ndema ?', a: 'Naat e B2B > Services Techniques ngam ɗaɓɓude devis e sosiyateeji forage e naange.' }
    ]
  };

  function openVoiceModal() {
    var list = VOICE[appState.voiceLang] || VOICE.FR;
    openModal(
      '<div class="text-center space-y-4">' +
        '<div class="flex justify-between items-center"><span class="pill bg-xamle-blueLight text-xamle-blue uppercase">Assistant vocal (démo)</span>' + closeBtn() + '</div>' +
        '<div class="flex justify-center gap-2" role="group" aria-label="Langue">' +
          [['FR', 'Français'], ['WO', 'Wolof'], ['PU', 'Pulaar']].map(function (l) {
            var on = appState.voiceLang === l[0];
            return '<button type="button" aria-pressed="' + on + '" onclick="setVoiceLang(\'' + l[0] + '\')" class="px-3.5 py-2 rounded-xl text-[13px] font-bold ' + (on ? 'bg-xamle-green text-white' : 'bg-slate-100 text-slate-700') + '">' + l[1] + '</button>';
          }).join('') +
        '</div>' +
        '<div class="relative w-20 h-20 mx-auto flex items-center justify-center"><div class="absolute inset-0 rounded-full bg-xamle-blue/25 voice-pulse"></div>' +
          '<button type="button" aria-label="Parler" onclick="showToast(\'Reconnaissance vocale prévue en V2 — choisissez une question ci-dessous.\')" class="relative w-14 h-14 rounded-full bg-gradient-to-tr from-xamle-green to-xamle-blue text-white flex items-center justify-center shadow-lg"><i data-lucide="mic" class="w-6 h-6"></i></button></div>' +
        '<div class="flex items-center justify-center gap-1 h-6" aria-hidden="true"><span class="w-1 bg-xamle-blue rounded-full eq-1"></span><span class="w-1 bg-xamle-green rounded-full eq-2"></span><span class="w-1 bg-xamle-blue rounded-full eq-3"></span><span class="w-1 bg-xamle-green rounded-full eq-4"></span><span class="w-1 bg-xamle-blue rounded-full eq-2"></span></div>' +
        '<div class="space-y-1.5 text-left"><p class="text-[11.5px] font-bold uppercase text-slate-500">Questions rapides :</p>' +
          list.map(function (it, i) { return '<button type="button" onclick="selectVoicePreset(' + i + ')" class="w-full text-left p-2.5 rounded-xl bg-xamle-bg hover:bg-xamle-blueLight/50 border border-slate-200 text-[13px] font-semibold">« ' + esc(it.q) + ' »</button>'; }).join('') +
        '</div>' +
        '<div class="bg-xamle-greenPale/70 p-3.5 rounded-2xl border border-xamle-green/25 text-left space-y-1.5" aria-live="polite"><p class="text-[11.5px] font-extrabold text-xamle-green uppercase">Réponse XAMLE AGRI :</p><p id="voice-answer-text" class="text-[13px] leading-relaxed">' + esc(list[0].a) + '</p></div>' +
      '</div>'
    );
  }
  function setVoiceLang(l) { appState.voiceLang = l; saveState(); openVoiceModal(); }
  function selectVoicePreset(i) {
    var list = VOICE[appState.voiceLang] || VOICE.FR;
    $('voice-answer-text').textContent = list[i].a;
  }

  /* ---------------------------------------------------------------
   * Onglet 4 : Marché B2B
   * --------------------------------------------------------------- */
  function renderB2B() {
    var isProducts = appState.b2bSubTab === 'PRODUITS';
    var list = productsData.filter(function (p) { return appState.b2bCategoryFilter === 'TOUS' || p.category === appState.b2bCategoryFilter; });
    $('main-content').innerHTML =
      '<div class="space-y-3.5">' +
        banner('b2b', 'Marché B2B', 'Contrats, stocks & services techniques.') +
        '<div class="flex items-center justify-end gap-2 empty:hidden">' +
          (isProducts && appState.userRole === 'PRODUCTEUR' ? '<button type="button" onclick="openPublishStockModal()" class="bg-xamle-blue text-white text-[12.5px] font-bold px-3 py-2 rounded-xl flex items-center gap-1 shrink-0"><i data-lucide="plus" class="w-3.5 h-3.5"></i> Publier</button>' : '') + '</div>' +
        segmented([['PRODUITS', 'Produits & récoltes'], ['SERVICES', 'Services techniques']], appState.b2bSubTab, 'setB2BSubTab') +
        (isProducts ?
          '<div class="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">' +
            ['TOUS', 'Maraîchage', 'Pisciculture', 'Aviculture', 'Apiculture', 'Transformation'].map(function (c) {
              var on = appState.b2bCategoryFilter === c;
              return '<button type="button" aria-pressed="' + on + '" onclick="setB2BCat(\'' + c + '\')" class="filter-chip ' + (on ? 'is-on' : '') + '">' + (c === 'TOUS' ? 'Toutes filières' : c) + '</button>';
            }).join('') +
          '</div>' +
          '<div class="space-y-2.5">' + list.map(productCard).join('') + '</div>'
        :
          '<div class="space-y-2.5"><p class="bg-xamle-blueLight/80 border border-xamle-blue/25 p-3 rounded-xl text-[12.5px]"><strong>Équipements & infrastructures :</strong> demandez des devis comparatifs (forages, solaire, serres, poulaillers, clôtures).</p>' +
            techServicesData.map(function (s) {
              return '<div class="card space-y-2.5"><div class="flex items-start gap-3"><span class="w-10 h-10 rounded-xl bg-xamle-greenPale text-xamle-green flex items-center justify-center shrink-0"><i data-lucide="' + s.icon + '" class="w-5 h-5"></i></span>' +
                '<div class="flex-1"><span class="pill bg-xamle-blueLight text-xamle-blue">' + esc(s.badge) + '</span><h2 class="text-[13px] font-extrabold mt-1">' + esc(s.title) + '</h2><p class="text-[12.5px] text-slate-600 font-medium">' + esc(s.provider) + '</p><p class="text-[11.5px] text-slate-500">Zone : ' + esc(s.zone) + '</p></div></div>' +
                '<div class="flex items-center justify-between pt-2 border-t border-slate-100"><span class="text-[12.5px] font-bold text-slate-700">' + esc(s.priceHint) + '</span>' +
                '<button type="button" onclick="openQuoteModal(\'' + s.id + '\')" class="bg-xamle-blue text-white text-[13px] font-bold px-3 py-2 rounded-xl">Demander devis</button></div></div>';
            }).join('') + '</div>') +
      '</div>';
  }

  function productCard(p) {
    return '<div class="card space-y-2.5"><div class="flex items-start gap-2.5"><span class="w-10 h-10 rounded-xl ' + p.badgeBg + ' flex items-center justify-center shrink-0"><i data-lucide="' + p.icon + '" class="w-5 h-5"></i></span>' +
      '<div class="flex-1"><div class="flex items-center gap-1.5 flex-wrap"><h2 class="text-[13px] font-extrabold">' + esc(p.title) + '</h2>' + (p.formalized ? '<span class="pill bg-xamle-greenPale text-xamle-green">Formalisé ✓</span>' : '') + '</div>' +
      '<p class="text-[12.5px] font-medium text-slate-600">' + esc(p.seller) + '</p><p class="text-[11.5px] text-slate-500 mt-0.5">' + esc(p.region) + '</p></div></div>' +
      '<div class="flex items-center justify-between bg-xamle-bg px-3 py-2 rounded-xl text-[13px]"><div><span class="text-[11px] text-slate-500 block">Stock</span><span class="font-bold">' + esc(p.stock) + ' ' + esc(p.unit) + '</span></div>' +
      '<div class="text-right"><span class="text-[11px] text-slate-500 block">Tarif B2B</span><span class="font-extrabold text-xamle-green">' + Number(p.price).toLocaleString('fr-FR') + ' FCFA/' + esc(p.unit) + '</span></div></div>' +
      '<div class="flex items-center justify-between gap-2"><span class="text-[11.5px] font-semibold text-xamle-blue">' + esc(p.availability) + '</span>' +
      '<button type="button" onclick="openContractModal(\'' + p.id + '\')" class="bg-xamle-green text-white text-[13px] font-bold px-3.5 py-2 rounded-xl shrink-0">Commander</button></div></div>';
  }

  function setB2BSubTab(v) { appState.b2bSubTab = v; renderB2B(); afterRender(); }
  function setB2BCat(v) { appState.b2bCategoryFilter = v; renderB2B(); afterRender(); }

  function openPublishStockModal() {
    var fil = P.filieres.filter(function (f) { return ['Maraîchage', 'Aviculture', 'Pisciculture', 'Transformation', 'Apiculture'].indexOf(f) !== -1; });
    var cats = fil.length ? fil : ['Maraîchage', 'Aviculture', 'Pisciculture', 'Transformation', 'Apiculture'];
    openModal(
      '<form class="space-y-4" onsubmit="publishNewProduct(event)">' +
        '<div class="flex items-center justify-between"><h2 class="text-base font-extrabold">Publier un stock</h2>' + closeBtn() + '</div>' +
        '<label class="block"><span class="field-label">Produit</span><input id="np-title" required maxlength="60" value="Oignons violets (triés)" class="field-sm"></label>' +
        '<div class="grid grid-cols-2 gap-2"><label class="block"><span class="field-label">Filière</span><select id="np-cat" class="field-sm">' + cats.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select></label>' +
          '<label class="block"><span class="field-label">Quantité (Kg)</span><input id="np-qty" type="number" min="1" required value="2500" class="field-sm"></label></div>' +
        '<label class="block"><span class="field-label">Prix B2B (FCFA / Kg)</span><input id="np-price" type="number" min="1" required value="450" class="field-sm"></label>' +
        '<button type="submit" class="btn-primary w-full !min-h-[48px]">Mettre en ligne</button>' +
      '</form>'
    );
  }

  function publishNewProduct(ev) {
    ev.preventDefault();
    var p = {
      id: 'mine-' + Date.now(), category: $('np-cat').value, title: $('np-title').value.trim() || 'Produit agricole',
      seller: (appState.orgName || P.name) + ' (votre offre)', region: P.region, stock: parseInt($('np-qty').value, 10) || 1,
      unit: 'Kg', price: parseInt($('np-price').value, 10) || 1, formalized: appState.formalization.paid,
      availability: 'Nouveau • Disponible', icon: 'sprout', badgeBg: 'bg-xamle-greenPale text-xamle-green'
    };
    appState.publishedProducts = [p].concat(appState.publishedProducts || []);
    productsData.unshift(p);
    closeModal();
    appState.b2bCategoryFilter = 'TOUS';
    renderB2B(); afterRender();
    showToast('Votre offre est visible par les acheteurs B2B.');
  }

  function openContractModal(id) {
    var p = productsData.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var qty = Math.min(150, p.stock);
    openModal(
      '<form class="space-y-4" onsubmit="confirmB2BContract(event, \'' + p.id + '\')">' +
        '<div class="flex items-center justify-between"><h2 class="text-base font-extrabold text-xamle-green">Contrat & facture proforma</h2>' + closeBtn() + '</div>' +
        '<div class="p-3 rounded-xl bg-xamle-bg border border-slate-200 text-[13px] space-y-1"><p class="font-bold">' + esc(p.title) + '</p><p class="text-slate-600">' + esc(p.seller) + ' • ' + Number(p.price).toLocaleString('fr-FR') + ' FCFA/' + esc(p.unit) + '</p></div>' +
        '<div class="grid grid-cols-2 gap-3"><label class="block"><span class="field-label">Quantité (' + esc(p.unit) + ')</span><input id="ct-qty" type="number" min="1" max="' + p.stock + '" value="' + qty + '" required oninput="updateContractTotal(' + p.price + ')" class="field-sm font-bold"></label>' +
          '<label class="block"><span class="field-label">Livraison</span><input id="ct-date" type="date" required value="2026-12-05" class="field-sm"></label></div>' +
        '<div class="p-3.5 rounded-xl bg-xamle-greenPale/70 border border-xamle-green/25"><div class="flex justify-between text-[13px]"><span class="text-slate-700">Montant total HT :</span><span id="ct-total" class="font-extrabold text-xamle-green">' + fcfa(qty * p.price) + '</span></div></div>' +
        '<button type="submit" class="btn-primary w-full !min-h-[48px]">Valider le contrat</button>' +
      '</form>'
    );
  }
  function updateContractTotal(price) { $('ct-total').textContent = fcfa((parseFloat($('ct-qty').value) || 0) * price); }
  function confirmB2BContract(ev, id) {
    ev.preventDefault();
    var p = productsData.filter(function (x) { return x.id === id; })[0];
    var qty = Math.max(1, Math.min(parseFloat($('ct-qty').value) || 1, p.stock));
    appState.activeOrders.unshift({
      id: 'CMD-2026-' + Math.floor(100 + Math.random() * 900), product: p.title, partner: p.seller,
      qty: qty, unit: p.unit, total: qty * p.price, deliveryDate: $('ct-date').value, status: 'Facture générée'
    });
    closeModal();
    showToast('Contrat ajouté à votre suivi : ' + fcfa(qty * p.price) + '.');
  }

  function openQuoteModal(id) {
    var s = techServicesData.filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    openModal(
      '<form class="space-y-4" onsubmit="event.preventDefault(); closeModal(); showToast(\'Demande envoyée aux prestataires (simulation).\')">' +
        '<div class="flex items-center justify-between"><h2 class="text-base font-extrabold">Demande de devis</h2>' + closeBtn() + '</div>' +
        '<p class="text-[13px] text-slate-700">Prestation : <strong>' + esc(s.title) + '</strong></p>' +
        '<label class="block"><span class="field-label">Superficie / capacité</span><input value="2 hectares" class="field-sm"></label>' +
        '<div class="grid grid-cols-2 gap-2"><label class="block"><span class="field-label">Commune / région</span><input value="' + esc(P.region) + '" class="field-sm"></label>' +
          '<label class="block"><span class="field-label">Budget estimatif</span><input placeholder="FCFA" class="field-sm"></label></div>' +
        '<button type="submit" class="w-full py-3 rounded-xl bg-xamle-blue text-white font-bold text-[13px]">Recevoir des devis</button>' +
      '</form>'
    );
  }

  /* ---------------------------------------------------------------
   * Onglet 5 : Opportunités (V1) + Vitrines (V2)
   * --------------------------------------------------------------- */
  function renderOpportunites() {
    var sub = appState.oppSubTab || 'OPPORTUNITES';
    var html = '<div class="space-y-3.5">' + banner('opportunites', 'Opportunités', 'Financements, programmes et partenaires.') +
      segmented([['OPPORTUNITES', 'Financements'], ['VITRINES', 'Vitrines']], sub, 'setOppSubTab');

    if (sub === 'OPPORTUNITES') {
      var types = ['TOUTES'].concat(oppData.map(function (o) { return o.type; }).filter(function (t, i, a) { return a.indexOf(t) === i; }));
      if (types.indexOf(appState.oppFilter) === -1) appState.oppFilter = 'TOUTES';
      var list = oppData.filter(function (o) { return appState.oppFilter === 'TOUTES' || o.type === appState.oppFilter; }).sort(byStatus);
      html += '<div class="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">' +
          types.map(function (t) { var on = appState.oppFilter === t; return '<button type="button" aria-pressed="' + on + '" onclick="setOppFilter(\'' + t + '\')" class="filter-chip ' + (on ? 'is-on' : '') + '">' + (t === 'TOUTES' ? 'Toutes' : t) + '</button>'; }).join('') +
        '</div>' +
        '<p class="text-[12.5px] text-slate-600 flex items-center gap-1.5"><i data-lucide="sliders-horizontal" class="w-3.5 h-3.5"></i> Votre profil : ' + esc(P.region) + ' · ' + esc(P.filieres.join(', ')) + '</p>' +
        list.map(function (o) {
          return oppCard(o).replace('class="card ', 'class="card ' + (matchesProfile(o) ? 'border-xamle-green/40 ' : ''));
        }).join('');
    } else {
      var filtered = showcasesData.filter(function (v) { return appState.showcaseFilter === 'TOUTES' || v.type === appState.showcaseFilter; });
      html += '<div class="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">' +
          [['TOUTES', 'Toutes'], ['EXPLOITATION', 'Exploitations'], ['INNOVATION', 'Innovations'], ['INSTITUTION', 'Banques & bailleurs']].map(function (f) {
            var on = appState.showcaseFilter === f[0];
            return '<button type="button" aria-pressed="' + on + '" onclick="setShowcaseFilter(\'' + f[0] + '\')" class="filter-chip ' + (on ? 'is-on' : '') + '">' + f[1] + '</button>';
          }).join('') +
        '</div><div class="space-y-3">' +
        filtered.map(function (v) {
          return '<button type="button" onclick="openShowcaseDetail(\'' + v.id + '\')" class="w-full text-left bg-white rounded-2xl border border-slate-200/80 overflow-hidden hover:border-xamle-green transition">' +
            '<span class="block bg-gradient-to-r ' + v.bannerBg + ' p-4 text-white"><span class="flex justify-between items-center mb-1 gap-2"><span class="text-[11px] font-bold uppercase bg-white/20 px-2 py-0.5 rounded">' + esc(v.typeLabel) + '</span><span class="text-[11px] font-semibold">' + esc(v.tag) + '</span></span>' +
            '<span class="block text-[14px] font-extrabold leading-snug">' + esc(v.title) + '</span><span class="block text-[12.5px] text-white/90 mt-0.5">' + esc(v.subtitle) + '</span></span>' +
            '<span class="p-3 flex items-center justify-between text-[12.5px]"><span class="text-slate-600 flex items-center gap-1"><i data-lucide="map-pin" class="w-3.5 h-3.5 text-xamle-blue"></i> ' + esc(v.location) + '</span><span class="font-bold text-xamle-green flex items-center gap-1">Ouvrir <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i></span></span></button>';
        }).join('') + '</div>';
    }
    $('main-content').innerHTML = html + '</div>';
  }

  function setOppSubTab(v) { appState.oppSubTab = v; renderOpportunites(); afterRender(); }
  function setOppFilter(v) { appState.oppFilter = v; renderOpportunites(); afterRender(); }
  function setShowcaseFilter(v) { appState.showcaseFilter = v; renderOpportunites(); afterRender(); }

  function openOpportunity(id) {
    var o = oppData.filter(function (x) { return x.id === id; })[0];
    if (!o) return;
    openModal(
      '<div class="space-y-4">' +
        '<div class="flex items-start justify-between gap-2"><div class="space-y-1.5"><span class="flex gap-1.5"><span class="pill bg-amber-100 text-amber-900">' + esc(o.type) + '</span>' + statusPill(o) + '</span><h2 class="text-[18px] font-extrabold leading-snug">' + esc(o.title) + '</h2><p class="text-[13px] text-slate-600">Proposé par ' + esc(o.org) + '</p></div>' + closeBtn() + '</div>' +
        '<div class="grid grid-cols-2 gap-2.5"><div class="p-3 rounded-xl bg-xamle-bg"><p class="text-[11.5px] text-slate-600">Montant</p><p class="text-[14px] font-bold">' + esc(o.amount) + '</p></div>' +
          '<div class="p-3 rounded-xl bg-xamle-bg"><p class="text-[11.5px] text-slate-600">Date limite</p><p class="text-[14px] font-bold">' + esc(o.deadline) + '</p></div></div>' +
        '<div class="space-y-1.5"><h3 class="text-[14px] font-bold">Qui peut postuler ?</h3><ul class="list-disc pl-5 text-[13px] leading-relaxed">' + o.conditions.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></div>' +
        '<div class="space-y-1.5"><h3 class="text-[14px] font-bold">Pièces à fournir</h3><ul class="list-disc pl-5 text-[13px] leading-relaxed">' + o.docs.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></div>' +
        (o.status === 'Clôturé' ? '<p class="text-[12.5px] text-slate-700 bg-slate-100 rounded-xl p-2.5">Cet appel est clôturé. Il est affiché à titre d\'exemple ; XAMLE AGRI vous alertera à la prochaine édition.</p>' : '') +
        '<a href="' + esc(o.link) + '" target="_blank" rel="noopener" class="btn-primary w-full !min-h-[48px] flex items-center justify-center gap-2"><i data-lucide="external-link" class="w-4 h-4"></i> ' + (o.status === 'Clôturé' ? 'Voir l\'annonce officielle' : 'En savoir plus') + '</a>' +
        '<p class="text-[11.5px] text-slate-500">Source : ' + esc(o.source) + '</p>' +
        '<a class="btn-outline w-full flex items-center justify-center gap-2" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent('XAMLE AGRI — ' + o.type + ' : ' + o.title) + '"><i data-lucide="share-2" class="w-4 h-4"></i> Partager sur WhatsApp</a>' +
      '</div>'
    );
  }

  function openShowcaseDetail(id) {
    var v = showcasesData.filter(function (x) { return x.id === id; })[0];
    if (!v) return;
    openModal(
      '<div class="space-y-4">' +
        '<div class="bg-gradient-to-r ' + v.bannerBg + ' -mx-5 -mt-5 p-5 text-white rounded-t-3xl"><div class="flex justify-between items-start"><span class="text-[11.5px] font-bold uppercase bg-white/20 px-2.5 py-0.5 rounded">' + esc(v.typeLabel) + '</span>' +
          '<button type="button" aria-label="Fermer" onclick="closeModal()" class="p-2 rounded-full bg-black/20 text-white"><i data-lucide="x" class="w-4 h-4"></i></button></div>' +
          '<h2 class="text-base font-extrabold mt-2">' + esc(v.title) + '</h2><p class="text-[13px] text-white/90 mt-1">' + esc(v.subtitle) + '</p></div>' +
        '<div class="space-y-1.5"><h3 class="text-[11.5px] font-extrabold text-xamle-green uppercase">Présentation</h3><p class="text-[13px] text-slate-700 leading-relaxed">' + esc(v.desc) + '</p></div>' +
        '<div class="p-3 rounded-xl bg-xamle-blueLight/70 border border-xamle-blue/25 space-y-1"><h3 class="text-[13px] font-bold text-xamle-blue">Offre</h3><p class="text-[13px]">' + esc(v.offer) + '</p></div>' +
        '<label class="block"><span class="field-label">Message au partenaire</span><textarea rows="3" class="field-sm">Bonjour, ' + esc(appState.orgName || P.name) + ' souhaite entrer en contact concernant votre offre.</textarea></label>' +
        '<button type="button" onclick="closeModal(); showToast(\'Message envoyé (simulation).\')" class="btn-primary w-full !min-h-[48px]">' + esc(v.cta) + '</button>' +
      '</div>'
    );
  }

  /* ---------------------------------------------------------------
   * Réinitialisation de la démo
   * --------------------------------------------------------------- */
  function resetDemo() {
    Store.set({ state: Store.defaultState(pr) });
    location.reload();
  }

  /* ---------------------------------------------------------------
   * Fonctions appelées depuis le HTML (onclick)
   * --------------------------------------------------------------- */
  var api = {
    switchTab: switchTab, toggleUserRole: toggleUserRole, showToast: showToast, openModal: openModal, closeModal: closeModal,
    openNotificationsModal: openNotificationsModal, setFormSubTab: setFormSubTab, openGuide: openGuide, closeGuide: closeGuide,
    advanceGuide: advanceGuide, resetGuide: resetGuide, setProvider: setProvider, setPhonePay: setPhonePay,
    updateDiagnostic: updateDiagnostic, toggleDoc: toggleDoc, executeFormalizationPayment: executeFormalizationPayment,
    openCertificateModal: openCertificateModal, setSaeSearch: setSaeSearch, setSaeFilter: setSaeFilter, openSaeDetail: openSaeDetail,
    openVoiceModal: openVoiceModal, setVoiceLang: setVoiceLang, selectVoicePreset: selectVoicePreset,
    setB2BSubTab: setB2BSubTab, setB2BCat: setB2BCat, openPublishStockModal: openPublishStockModal, publishNewProduct: publishNewProduct,
    openContractModal: openContractModal, updateContractTotal: updateContractTotal, confirmB2BContract: confirmB2BContract,
    openQuoteModal: openQuoteModal, setOppSubTab: setOppSubTab, setOppFilter: setOppFilter, setShowcaseFilter: setShowcaseFilter,
    openOpportunity: openOpportunity, openShowcaseDetail: openShowcaseDetail, resetDemo: resetDemo, logout: Store.logout
  };
  Object.keys(api).forEach(function (k) { window[k] = api[k]; });

  renderHeader();
  switchTab('accueil');
})();
