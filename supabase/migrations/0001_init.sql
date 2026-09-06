-- =============================================================================
-- Foster Care Compliance AI — initial schema
-- =============================================================================
-- Run this once in the Supabase SQL editor. See docs/supabase-setup.md.
--
-- The point of this file is ISOLATION ENFORCED BY THE DATABASE. Every policy
-- below is `auth.uid() = owner_user_id`, so a route handler that forgets to
-- filter by user still cannot return another caseworker's cases — Postgres
-- refuses. Application-level filtering is belt-and-braces on top of this.
--
-- CLAUDE.md hard boundary #3: synthetic records only. Nothing here is built to
-- hold a real family's data, and this schema has had no privacy review.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- profiles — the caseworker record, 1:1 with auth.users
-- ----------------------------------------------------------------------------
-- Supabase owns auth.users (email, password hash, confirmation state). Product
-- fields live here so we never write to the auth schema directly.

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  name         text        not null default '',
  email        text        not null,
  agency       text        not null default '',
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "caseworker reads own profile" on public.profiles;
create policy "caseworker reads own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "caseworker updates own profile" on public.profiles;
create policy "caseworker updates own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- Profile row is created by trigger, not by the app
-- ----------------------------------------------------------------------------
-- Doing this in application code means a crash between signUp() and the insert
-- leaves an auth user with no profile. A trigger makes both happen in one
-- transaction or neither.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, agency)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'agency', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Docket numbers — ICPC-2026-0231
-- ----------------------------------------------------------------------------
-- A sequence, not a random slug: a caseworker reads this number over the phone
-- to another state's ICPC office and writes it on a physical folder. Sequential
-- allocation from Postgres also means two caseworkers opening a case in the
-- same second cannot collide.
--
-- Numbers are never reused, including after a delete. That is correct for a
-- docket: a gap means a case was withdrawn, and reusing the number would make
-- two different placements share an identifier in someone's paper file.

create sequence if not exists public.case_seq start with 231;

create or replace function public.next_case_id()
returns text
language sql
volatile
as $$
  select 'ICPC-'
      || extract(year from now())::int::text
      || '-'
      || lpad(nextval('public.case_seq')::text, 4, '0');
$$;

grant execute on function public.next_case_id() to authenticated;

-- ----------------------------------------------------------------------------
-- cases
-- ----------------------------------------------------------------------------

create table if not exists public.cases (
  id                  text        primary key,
  owner_user_id       uuid        not null references auth.users (id) on delete cascade,

  label               text        not null,
  sending_state       text        not null,
  receiving_state     text        not null,
  relationship        text        not null,
  children_count      integer     not null check (children_count between 1 and 12),
  placement_type      text        not null,

  -- Starts the 180-day ICPC decision window (ICPC Regulations, AAICPC).
  window_start        date        not null,

  -- PLACEHOLDER until /engines/graph.ts lands. Derived then from the
  -- GraphModel as verified nodes / total nodes, and this column goes away.
  completion_pct      integer     not null default 0
                                  check (completion_pct between 0 and 100),
  next_deadline       date        not null,
  next_deadline_label text        not null default 'Initial packet assembly',

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- ICPC is interstate by definition. A case whose sending and receiving
  -- jurisdictions match is a data-entry error, and the database should say so
  -- rather than composing a nonsense workflow from it.
  constraint cases_interstate check (sending_state <> receiving_state)
);

create index if not exists cases_owner_idx on public.cases (owner_user_id);
create index if not exists cases_owner_updated_idx
  on public.cases (owner_user_id, updated_at desc);

alter table public.cases enable row level security;

-- One policy per verb rather than FOR ALL, so a future read-only or supervisor
-- role can be granted select without inheriting write.

drop policy if exists "caseworker reads own cases" on public.cases;
create policy "caseworker reads own cases"
  on public.cases for select
  using (auth.uid() = owner_user_id);

drop policy if exists "caseworker opens own cases" on public.cases;
create policy "caseworker opens own cases"
  on public.cases for insert
  with check (auth.uid() = owner_user_id);

drop policy if exists "caseworker updates own cases" on public.cases;
create policy "caseworker updates own cases"
  on public.cases for update
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

drop policy if exists "caseworker deletes own cases" on public.cases;
create policy "caseworker deletes own cases"
  on public.cases for delete
  using (auth.uid() = owner_user_id);

-- ----------------------------------------------------------------------------
-- updated_at maintained by the database
-- ----------------------------------------------------------------------------
-- Leaving this to the client means any caller that forgets breaks the caseload
-- ordering, which sorts on it.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cases_touch_updated_at on public.cases;
create trigger cases_touch_updated_at
  before update on public.cases
  for each row execute function public.touch_updated_at();
