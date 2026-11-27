-- =====================================================================
-- XAMLE AGRI — installation complète de la base (structure + données)
-- Supabase > SQL Editor > New query > coller TOUT ce fichier > Run
-- Relançable sans danger.
-- =====================================================================

-- =====================================================================
-- XAMLE AGRI — structure de la base (Supabase / PostgreSQL)
-- À exécuter une fois dans Supabase : SQL Editor > New query > coller > Run.
-- Le script peut être relancé sans danger (il ne recrée pas ce qui existe).
-- =====================================================================

-- ---------- Contenus gérés par l'équipe (lecture publique) ----------

create table if not exists public.opportunites (
  id          text primary key,
  type        text not null,               -- Subvention, Programme, Concours, Incubation…
  statut      text not null default 'En cours',  -- En cours | Clôturé
  titre       text not null,
  organisme   text not null,
  regions     text[] not null default '{}',
  filieres    text[] not null default '{}',
  montant     text,
  date_limite text,
  conditions  text[] not null default '{}',
  pieces      text[] not null default '{}',
  lien        text,
  source      text,
  ordre       int  not null default 100,
  publie      boolean not null default true,
  maj_le      timestamptz not null default now()
);

create table if not exists public.structures (
  id          text primary key,
  sigle       text not null,
  nom         text not null,
  categorie   text not null,               -- FORMALISATION, FINANCEMENT, ENCADREMENT, NORMES_EXPORT, FONCIER_IMPOTS
  etiquette   text,
  description text,
  conditions  text,
  pieces      text[] not null default '{}',
  contact     text,
  ordre       int  not null default 100,
  publie      boolean not null default true,
  maj_le      timestamptz not null default now()
);

create table if not exists public.guides (
  id          text primary key,
  titre       text not null,
  etapes      jsonb not null default '[]',  -- [{"t": "Titre de l'étape", "d": "Détail"}]
  cout        text,
  ordre       int  not null default 100,
  publie      boolean not null default true,
  maj_le      timestamptz not null default now()
);

-- ---------- Données des utilisateurs ----------

create table if not exists public.profils (
  id          uuid primary key references auth.users(id) on delete cascade,
  nom         text not null,
  telephone   text,
  type        text not null,               -- PRODUCTEUR, GIE, COOPERATIVE, ACHETEUR
  structure   text,
  region      text not null,
  filieres    text[] not null default '{}',
  langue      text not null default 'FR',
  cree_le     timestamptz not null default now(),
  maj_le      timestamptz not null default now()
);

create table if not exists public.stocks (
  id          uuid primary key default gen_random_uuid(),
  vendeur_id  uuid references auth.users(id) on delete cascade default auth.uid(),
  filiere     text not null,
  produit     text not null,
  vendeur     text not null,
  region      text,
  quantite    int  not null check (quantite > 0),
  unite       text not null default 'Kg',
  prix        int  not null check (prix > 0),
  formalise   boolean not null default false,
  disponibilite text,
  icone       text default 'sprout',
  couleur     text default 'bg-xamle-greenPale text-xamle-green',
  publie      boolean not null default true,
  demo        boolean not null default false,   -- true = annonce fictive de démonstration
  cree_le     timestamptz not null default now()
);

create table if not exists public.progression (
  utilisateur_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  guide_id       text not null references public.guides(id) on delete cascade,
  etape          int  not null default 0,
  maj_le         timestamptz not null default now(),
  primary key (utilisateur_id, guide_id)
);

-- ---------- Sécurité : Row Level Security ----------
-- Contenus : tout le monde peut lire ce qui est publié ; l'équipe modifie
-- depuis le tableau Supabase (Table Editor), qui n'est pas soumis à ces règles.
-- Utilisateurs : chacun ne voit et ne modifie que ses propres données.

alter table public.opportunites enable row level security;
alter table public.structures   enable row level security;
alter table public.guides       enable row level security;
alter table public.profils      enable row level security;
alter table public.stocks       enable row level security;
alter table public.progression  enable row level security;

drop policy if exists "lecture publique" on public.opportunites;
create policy "lecture publique" on public.opportunites for select using (publie);

drop policy if exists "lecture publique" on public.structures;
create policy "lecture publique" on public.structures for select using (publie);

drop policy if exists "lecture publique" on public.guides;
create policy "lecture publique" on public.guides for select using (publie);

drop policy if exists "mon profil : lire" on public.profils;
create policy "mon profil : lire" on public.profils for select to authenticated using (id = auth.uid());
drop policy if exists "mon profil : créer" on public.profils;
create policy "mon profil : créer" on public.profils for insert to authenticated with check (id = auth.uid());
drop policy if exists "mon profil : modifier" on public.profils;
create policy "mon profil : modifier" on public.profils for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "stocks : lecture publique" on public.stocks;
create policy "stocks : lecture publique" on public.stocks for select using (publie);
drop policy if exists "stocks : publier" on public.stocks;
create policy "stocks : publier" on public.stocks for insert to authenticated with check (vendeur_id = auth.uid() and demo = false);
drop policy if exists "stocks : modifier les miens" on public.stocks;
create policy "stocks : modifier les miens" on public.stocks for update to authenticated using (vendeur_id = auth.uid()) with check (vendeur_id = auth.uid() and demo = false);
drop policy if exists "stocks : supprimer les miens" on public.stocks;
create policy "stocks : supprimer les miens" on public.stocks for delete to authenticated using (vendeur_id = auth.uid());

drop policy if exists "ma progression" on public.progression;
create policy "ma progression" on public.progression for all to authenticated
  using (utilisateur_id = auth.uid()) with check (utilisateur_id = auth.uid());

-- Droits d'accès par l'API (clé publishable = rôle anon ; utilisateur connecté = authenticated)
grant usage on schema public to anon, authenticated;
grant select on public.opportunites, public.structures, public.guides, public.stocks to anon, authenticated;
grant select, insert, update on public.profils to authenticated;
grant insert, update, delete on public.stocks to authenticated;
grant select, insert, update, delete on public.progression to authenticated;

-- Date de mise à jour automatique
create or replace function public.touch_maj_le() returns trigger language plpgsql as $$
begin new.maj_le = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['opportunites','structures','guides','profils','progression'] loop
    execute format('drop trigger if exists trg_maj_le on public.%I', t);
    execute format('create trigger trg_maj_le before update on public.%I for each row execute function public.touch_maj_le()', t);
  end loop;
end $$;

-- XAMLE AGRI — données de départ (issues du prototype).
-- À exécuter APRÈS schema.sql. Relançable : met à jour les lignes existantes.

insert into public.opportunites (id,type,statut,titre,organisme,regions,filieres,montant,date_limite,conditions,pieces,lien,source,ordre) values
  ('campagne-2026','Programme','En cours','Intrants subventionnés — campagne agricole 2026-2027','État du Sénégal (ministère de l''Agriculture, de la Souveraineté alimentaire et de l''Élevage)',array['Toutes régions']::text[],array['Arachide','Riz','Mil','Élevage','Maraîchage']::text[],'Enveloppe nationale de 130 milliards FCFA','Selon le calendrier de la campagne',array['Être enrôlé au Registre national unique (distribution numérique des intrants)','Au moins 30 % des intrants réservés aux femmes et aux jeunes','Riz : contractualisation entre producteurs, riziers et distributeurs','Élevage : intrants d''ensilage de maïs fournis gratuitement (5 000 ha)']::text[],array['Pièce d''identité','Informations sur la parcelle (géolocalisation lors de l''enrôlement)']::text[],'https://lesoleil.sn/actualites/economie/campagne-agricole-2026-2027-letat-mobilise-130-milliards-de-fcfa/','Le Soleil, juillet 2026',10),
  ('investo-2026','Subvention','Clôturé','Investo in Senegal — subventions ESS (agriculture, élevage, transformation)','Projet Investo in Senegal (Coopération italienne AICS, AMREF, E4Impact)',array['Louga','Matam','Saint-Louis','Thiès']::text[],array['Maraîchage','Arachide','Riz','Mil','Élevage','Aviculture','Pisciculture','Transformation']::text[],'4 000 à 20 000 € (≈ 2,6 à 13,1 millions FCFA)','16 août 2026',array['Coopératives, GIE, associations, entreprises sociales (formalisés en priorité)','Équipe de 2 à 5 personnes','Chiffre d''affaires annuel ≥ 50 % du montant demandé et capacité de cofinancement','Exclus : simple achat-revente et immobilier']::text[],array['Formulaire en ligne (adresse Gmail obligatoire)','Justificatifs d''éligibilité (NINEA, récépissé…)']::text[],'https://investoinsenegal.eu/','Lignes directrices Investo in Senegal, juillet 2026',20),
  ('papes-2026','Subvention','Clôturé','PAPeS — petites subventions pour l''agroécologie (cycle 2)','IED Afrique',array['Dakar','Thiès','Louga','Diourbel','Fatick','Kaffrine','Kaolack','Matam','Saint-Louis']::text[],array['Maraîchage','Arachide','Mil','Élevage','Transformation','Pisciculture','Apiculture']::text[],'Jusqu''à 3 000 000 FCFA','10 mai 2026',array['Organisation communautaire formalisée (pas d''individus)','Pratiques agroécologiques déjà en place (pas de nouveau lancement)','Compte bancaire et expérience de petits projets','Activités terminées en 8 mois ; jeunes et femmes encouragés']::text[],array['Formulaire de demande','NINEA, registre de commerce ou récépissé','Factures proforma pour le décaissement']::text[],'https://www.iedafrique.org/','Appel à projets PAPeS 2026, IED Afrique',30),
  ('ayute-2026','Concours','Clôturé','AYuTe Africa Challenge Sénégal — 5e édition (agritech jeunes)','Heifer International Sénégal, avec le ministère de l''Agriculture',array['Toutes régions']::text[],array['Maraîchage','Élevage','Aviculture','Transformation','Riz','Mil','Arachide']::text[],'Subventions et accompagnement (montant de l''édition non précisé)','15 janvier 2026',array['Jeunes agripreneurs porteurs d''une solution agritech','Impact sur l''emploi des jeunes et des femmes rurales']::text[],array['Dossier de candidature en ligne']::text[],'https://www.lejecos.com/Lancement-de-la-5%E1%B5%89-edition-du-AYuTe-Africa-Challenge-Senegal-La-jeunesse-au-coeur-de-la-revolution-agricole_a29905.html','Lejecos / AllAfrica, novembre 2025',40),
  ('vitagro-2026','Incubation','Clôturé','Incubation VITAGRO / NOVAGRI 2026','VITAGRO (centre d''excellence NOVAGRI)',array['Dakar']::text[],array['Maraîchage','Élevage','Pisciculture','Transformation']::text[],'Hébergement, équipements, formation, mentorat (pas de subvention en numéraire)','30 novembre 2025',array['Startups, jeunes, coopératives, PME en démarrage','Structure formalisée ou en cours de formalisation']::text[],array['Présentation du projet','Modèle économique','Description de l''équipe']::text[],'https://vitagro.sn/incubation-dentreprises-candidature/','Guindima, octobre 2025',50)
on conflict (id) do update set type=excluded.type,statut=excluded.statut,titre=excluded.titre,organisme=excluded.organisme,regions=excluded.regions,filieres=excluded.filieres,montant=excluded.montant,date_limite=excluded.date_limite,conditions=excluded.conditions,pieces=excluded.pieces,lien=excluded.lien,source=excluded.source,ordre=excluded.ordre;

insert into public.structures (id,sigle,nom,categorie,etiquette,description,conditions,pieces,contact,ordre) values
  ('apix','APIX','Agence de Promotion des Investissements et Grands Travaux','FORMALISATION','Création d''entreprise','Guichet de création d''entreprise et formalités administratives (BCE).','Toute personne ou groupement souhaitant créer une structure formelle.',array['CNI valide','Statuts (pour un GIE ou une société)']::text[],'Dakar • Tél. : à confirmer',10),
  ('der','DER/FJ','Délégation Générale à l''Entreprenariat Rapide','FINANCEMENT','Financement & Amorçage','Financement direct à taux préférentiel sans garantie réelle pour les jeunes et femmes entrepreneurs agricoles.','Citoyen sénégalais (18-40 ans hommes, sans limite femmes). Projet agricole ou de transformation.',array['CNI valide','NINEA ou Récépissé GIE','Devis équipement ou compte d''exploitation']::text[],'Antenne régionale • Tél. : à confirmer',20),
  ('3fa','3FA','Financement agricole','FINANCEMENT','Financement agricole','[Description à confirmer par l''équipe]','[À confirmer]',array['[À confirmer]']::text[],'Tél. : à confirmer',30),
  ('adepme','ADEPME','Agence de Développement et d''Encadrement des PME','ENCADREMENT','Encadrement & Conseil','Accompagnement technique, structuration comptable, mise à niveau et facilitation d''accès au crédit.','Entreprise formalisée (RCCM + NINEA) avec activité avérée.',array['Registre de Commerce (RCCM)','Attestation NINEA','États financiers simplifiés']::text[],'Dakar / Thiès / Kaolack • Tél. : à confirmer',40),
  ('fongip','FONGIP','Fonds de Garantie des Investissements Prioritaires','FINANCEMENT','Garantie Bancaire','Couvre une partie de la garantie exigée par les banques et institutions de microfinance.','PME ou GIE formalisé disposant d''un projet bancable.',array['Dossier de crédit','NINEA & RCCM','Quitus fiscal']::text[],'Dakar • Tél. : à confirmer',50),
  ('asepex','ASEPEX','Agence Sénégalaise de Promotion des Exportations','NORMES_EXPORT','Export & Marchés','Appui à l''exportation des produits horticoles (mangues, haricots verts, melons) et mise en relation internationale.','Producteur ou exportateur formalisé respectant les normes phytosanitaires.',array['Carte Import-Export','Certificat phytosanitaire (DPV)','NINEA']::text[],'Dakar • Tél. : à confirmer',60),
  ('ita','ITA','Institut de Technologie Alimentaire','ENCADREMENT','Transformation & R&D','Formulation de produits transformés locaux (céréales, fruits, lait, halieutique), analyses et contrôle qualité.','Transformateurs, GIE féminins et unités agroalimentaires.',array['Échantillon produit','Demande d''assistance technique']::text[],'Dakar • Tél. : à confirmer',70),
  ('asn','ASN','Association Sénégalaise de Normalisation','NORMES_EXPORT','Normes & Certification','Certification aux normes sénégalaises (NS), homologation des emballages et labellisation.','Toute unité de production ou de conditionnement agroalimentaire.',array['Fiche technique produit','RCCM & NINEA']::text[],'Dakar • Tél. : à confirmer',80),
  ('semig','SEMIG','Marché d''Intérêt National & Gare Gros Porteurs','NORMES_EXPORT','Logistique & Stockage','Chambres froides, entrepôts de stockage et carreaux de vente en gros à Diamniadio.','Grossistes, coopératives agricoles et logisticiens formalisés.',array['RCCM','NINEA','Demande d''attribution d''espace']::text[],'Diamniadio • Tél. : à confirmer',90),
  ('anida','ANIDA','Agence Nationale d''Insertion et de Développement Agricole','FONCIER_IMPOTS','Foncier & Fermes','Aménagement de fermes agricoles modernes clé en main avec maîtrise de l''eau (forage/solaire).','Jeunes et ruraux regroupés en GIE formalisé.',array['Statuts du GIE','Liste des membres avec CNI','Demande d''affectation']::text[],'Dakar • Tél. : à confirmer',100),
  ('fndasp','FNDASP','Fonds National de Développement Agro-Sylvo-Pastoral','FINANCEMENT','Subventions & Conseil','Financement des organisations de producteurs pour le conseil agricole, la recherche appliquée et les semences.','Organisations professionnelles agricoles (OPA) et coopératives reconnues.',array['Récépissé de reconnaissance','Plan d''action annuel']::text[],'Dakar • Tél. : à confirmer',110),
  ('bmn','BMN','Bureau de Mise à Niveau des Entreprises','ENCADREMENT','Compétitivité & Primes','Primes d''investissement matérielles (équipements) et immatérielles (logiciels, certifications) pour les PME.','PME agro-industrielles formalisées.',array['RCCM & NINEA','Bilans comptables']::text[],'Dakar • Tél. : à confirmer',120),
  ('dpme','DPME','Direction des Petites et Moyennes Entreprises','ENCADREMENT','Politiques & Marchés Publics','Accès aux marchés publics réservés aux PME et labellisation PME sénégalaise.','Toute PME ou GIE immatriculé au Sénégal.',array['NINEA','RCCM','Attestation de régularité fiscale']::text[],'Diamniadio • Tél. : à confirmer',130),
  ('dgid','DGID / DOUANES','Impôts, Domaines & Douanes Sénégalaises','FONCIER_IMPOTS','Fiscalité & Exonérations','Régime fiscal simplifié et exonérations possibles sur certains matériels et intrants agricoles.','Acteurs immatriculés au NINEA.',array['Attestation NINEA','Facture proforma matériel agricole']::text[],'Centre des Services Fiscaux régional',140)
on conflict (id) do update set sigle=excluded.sigle,nom=excluded.nom,categorie=excluded.categorie,etiquette=excluded.etiquette,description=excluded.description,conditions=excluded.conditions,pieces=excluded.pieces,contact=excluded.contact,ordre=excluded.ordre;

insert into public.guides (id,titre,etapes,cout,ordre) values
  ('gie','Créer un GIE','[{"t":"Réunir les membres","d":"Au moins 2 personnes."},{"t":"Rédiger les statuts","d":"Modèle disponible dans l''app."},{"t":"Tenir l''assemblée constitutive","d":"Procès-verbal signé par les membres."},{"t":"Déposer le dossier au greffe","d":"Tribunal de votre région."},{"t":"Demander le NINEA","d":"Voir le guide NINEA."}]'::jsonb,'[Coût et délai à renseigner par l''équipe]',10),
  ('ninea','Obtenir le NINEA','[{"t":"[Étape 1 à renseigner]","d":"Contenu à valider par l''équipe."},{"t":"[Étape 2 à renseigner]","d":"Contenu à valider par l''équipe."},{"t":"[Étape 3 à renseigner]","d":"Contenu à valider par l''équipe."},{"t":"[Étape 4 à renseigner]","d":"Contenu à valider par l''équipe."}]'::jsonb,'[Coût et délai à renseigner par l''équipe]',20),
  ('rccm','S''immatriculer au RCCM','[{"t":"[Étape 1 à renseigner]","d":"Contenu à valider par l''équipe."},{"t":"[Étape 2 à renseigner]","d":"Contenu à valider par l''équipe."},{"t":"[Étape 3 à renseigner]","d":"Contenu à valider par l''équipe."},{"t":"[Étape 4 à renseigner]","d":"Contenu à valider par l''équipe."}]'::jsonb,'[Coût et délai à renseigner par l''équipe]',30),
  ('cartepro','Carte professionnelle','[{"t":"[Étape 1 à renseigner]","d":"Contenu à valider par l''équipe."},{"t":"[Étape 2 à renseigner]","d":"Contenu à valider par l''équipe."},{"t":"[Étape 3 à renseigner]","d":"Contenu à valider par l''équipe."}]'::jsonb,'[Coût et délai à renseigner par l''équipe]',40)
on conflict (id) do update set titre=excluded.titre,etapes=excluded.etapes,cout=excluded.cout,ordre=excluded.ordre;

-- Annonces B2B de démonstration (fictives, sans vendeur réel)
delete from public.stocks where demo;
insert into public.stocks (vendeur_id,filiere,produit,vendeur,region,quantite,unite,prix,formalise,disponibilite,icone,couleur,demo) values
  (null,'Maraîchage','Piments Forts F1 sous serre','Coopérative Niayes Vertes (fictif)','Notto Gouye Diama (Thiès)',1200,'Kg',1400,true,'Stock immédiat • Chambre froide','flame','bg-red-50 text-red-700',true),
  (null,'Pisciculture','Tilapia Frais Calibré (450g+)','Ferme Piscicole Walo Aqua (fictif)','Richard-Toll (Saint-Louis)',850,'Kg',2300,true,'Récolte planifiable sous 5j','fish','bg-sky-50 text-sky-700',true),
  (null,'Aviculture','Poulets de Chair Prêts à Cuire','Aviculture Moderne (fictif)','Dakar / Rufisque',600,'Sujets',3200,true,'Abattage agréé • Hôtels & Restos','bird','bg-amber-50 text-amber-700',true),
  (null,'Apiculture','Miel Brut de Casamance (Fleurs sauvages)','GIE Apicole Kolda (fictif)','Kolda',300,'Litres',4500,false,'Stock disponible • Fûts alimentaires','droplet','bg-yellow-50 text-yellow-800',true),
  (null,'Transformation','Sankhal & Thiéré Séché Conditionné','GIE Femmes Transformatrices (fictif)','Fatick',900,'Kg',1100,true,'Sachet 1kg/5kg','wheat','bg-emerald-50 text-emerald-800',true);
