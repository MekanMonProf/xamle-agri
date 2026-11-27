/* =====================================================================
 * XAMLE AGRI — lecture des contenus depuis Supabase
 * Les contenus (opportunités, annuaire, guides, stocks B2B) viennent de la
 * base Supabase. Une copie est gardée dans le téléphone pour le hors-ligne.
 * Si la base ne répond pas, l'application garde les données de assets/data.js.
 * ===================================================================== */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://clusojatwxulsstxlggr.supabase.co';
  // Clé publique (publishable) : faite pour être visible dans l'application.
  // La sécurité repose sur les règles d'accès (RLS) de chaque table.
  var SUPABASE_KEY = 'sb_publishable_NjGgpWh0QLjZ0Q9TrdQUMQ_pGonbzh9';
  var CACHE_KEY = 'xamle_remote_v1';

  function get(path) {
    return fetch(SUPABASE_URL + '/rest/v1/' + path, {
      headers: { apikey: SUPABASE_KEY, Accept: 'application/json' }
    }).then(function (r) {
      if (!r.ok) throw new Error('Supabase ' + r.status + ' sur ' + path.split('?')[0]);
      return r.json();
    });
  }

  function mapOpportunity(o) {
    return {
      id: o.id, type: o.type, status: o.statut, title: o.titre, org: o.organisme,
      regions: o.regions || [], filieres: o.filieres || [], amount: o.montant || '', deadline: o.date_limite || '',
      conditions: o.conditions || [], docs: o.pieces || [], link: o.lien || '#', source: o.source || ''
    };
  }
  function mapStructure(s) {
    return {
      id: s.id, acronym: s.sigle, name: s.nom, category: s.categorie, tag: s.etiquette || '',
      desc: s.description || '', eligibility: s.conditions || '', docs: s.pieces || [], contact: s.contact || ''
    };
  }
  function mapGuide(g) {
    return { id: g.id, title: g.titre, steps: g.etapes || [], cost: g.cout || '' };
  }
  function mapStock(p) {
    return {
      id: p.id, category: p.filiere, title: p.produit, seller: p.vendeur, region: p.region || '',
      stock: p.quantite, unit: p.unite, price: p.prix, formalized: p.formalise,
      availability: p.disponibilite || '', icon: p.icone || 'sprout',
      badgeBg: p.couleur || 'bg-xamle-greenPale text-xamle-green'
    };
  }

  function cached() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (e) { return null; }
  }

  function load() {
    return Promise.all([
      get('opportunites?select=*&publie=eq.true&order=ordre.asc'),
      get('structures?select=*&publie=eq.true&order=ordre.asc'),
      get('guides?select=*&publie=eq.true&order=ordre.asc'),
      get('stocks?select=*&publie=eq.true&order=demo.asc,cree_le.desc')
    ]).then(function (res) {
      var data = {
        opportunities: res[0].map(mapOpportunity),
        sae: res[1].map(mapStructure),
        guides: res[2].map(mapGuide),
        products: res[3].map(mapStock),
        loadedAt: new Date().toISOString()
      };
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) {}
      return data;
    });
  }

  window.XamleRemote = { url: SUPABASE_URL, key: SUPABASE_KEY, load: load, cached: cached };
})();
