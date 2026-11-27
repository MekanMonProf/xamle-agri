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
