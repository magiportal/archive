-- ============================================================
--  Sound Collab — Supabase setup
--  Run this in your Supabase project's SQL Editor
--  (same project as the Community Board: hzzhuikzvdfcizkuelte)
--  Safe to re-run.
-- ============================================================

-- ── TABLES ──────────────────────────────────────────────────
create table if not exists public.sound_projects (
  id            text primary key,
  title         text,
  project_type  text,          -- animation | games | interactivity | research
  sounds_needed text,          -- comma-joined: Soundscape,Ambient,SFX,...
  description   text,
  image_url     text,
  poster_url    text,          -- optional A4 upload
  contact       text,
  author        text,
  slots         int  default 1,
  status        text default 'open',
  created_at    timestamptz default now()
);

create table if not exists public.sound_designers (
  id           text primary key,
  name         text,
  website      text,
  bio          text,
  contact      text,
  avatar_url   text,
  poster_url   text,
  sample_urls  text,           -- comma-joined audio URLs (sound bites)
  created_at   timestamptz default now()
);

create table if not exists public.sound_assignments (
  id          text primary key,
  project_id  text references public.sound_projects(id)  on delete cascade,
  designer_id text references public.sound_designers(id) on delete cascade,
  status      text default 'assigned',
  created_at  timestamptz default now()
);

-- ── MEDIA (gameplay / reference video for a project) ─────────
-- A YouTube or Vimeo link so sound designers can see the project before volunteering.
alter table public.sound_projects add column if not exists media_url text;

-- ── OWNERSHIP ────────────────────────────────────────────────
-- When you post a listing the browser generates a random token, keeps the raw
-- token in its own localStorage, and sends only SHA-256(token) here. Edits and
-- deletes go through the functions at the bottom of this file, which re-hash
-- the token you present and compare.
--
-- Why the hash and not the token: every row is publicly readable (the site is
-- a public directory), so anything stored here is visible to anyone. Storing
-- the raw token would let a reader copy it and impersonate the owner — which
-- is exactly what the old open-RLS setup allowed. A hash is safe to expose
-- because the token is a random UUID: there is nothing to guess or reverse.
alter table public.sound_projects  add column if not exists owner_hash text;
alter table public.sound_designers add column if not exists owner_hash text;

-- The old plaintext column is retired. Any token in it is already public and
-- can't be trusted, so it goes rather than being migrated.
alter table public.sound_projects  drop column if exists owner_token;
alter table public.sound_designers drop column if exists owner_token;

-- ── ROW LEVEL SECURITY ───────────────────────────────────────
-- Anyone may read (public directory) and insert (posting is open to the
-- cohort, gated client-side by the password). Nobody may UPDATE or DELETE
-- directly: there is deliberately no policy for those, so RLS denies them.
-- All mutation happens through the security-definer functions below, which
-- check ownership first. This is what stops a passer-by with the anon key
-- from editing or wiping the directory.
alter table public.sound_projects    enable row level security;
alter table public.sound_designers   enable row level security;
alter table public.sound_assignments enable row level security;

-- drop-then-create so this script is safe to re-run
drop policy if exists "sc_projects_all"    on public.sound_projects;
drop policy if exists "sc_designers_all"   on public.sound_designers;
drop policy if exists "sc_assignments_all" on public.sound_assignments;
drop policy if exists "sc_projects_read"      on public.sound_projects;
drop policy if exists "sc_projects_insert"    on public.sound_projects;
drop policy if exists "sc_designers_read"     on public.sound_designers;
drop policy if exists "sc_designers_insert"   on public.sound_designers;
drop policy if exists "sc_assignments_read"   on public.sound_assignments;
drop policy if exists "sc_assignments_insert" on public.sound_assignments;

create policy "sc_projects_read"      on public.sound_projects    for select to anon using (true);
create policy "sc_projects_insert"    on public.sound_projects    for insert to anon with check (true);
create policy "sc_designers_read"     on public.sound_designers   for select to anon using (true);
create policy "sc_designers_insert"   on public.sound_designers   for insert to anon with check (true);
create policy "sc_assignments_read"   on public.sound_assignments for select to anon using (true);
create policy "sc_assignments_insert" on public.sound_assignments for insert to anon with check (true);

-- ── OWNERSHIP-CHECKED MUTATIONS ──────────────────────────────
-- These run as the definer, so they bypass RLS — which is the point: they are
-- the only write path, and each one proves ownership before touching a row.
-- `set search_path` is pinned so a hostile search_path can't redirect the
-- table references (standard practice for security definer functions).
--
-- sha256() is built into Postgres 15, so no pgcrypto extension is needed.

create or replace function public.sc_hash(p_token text)
returns text language sql immutable set search_path = public as $$
  select encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
$$;

-- Returns the number of rows changed: 1 = ok, 0 = wrong token / no such row.
create or replace function public.sc_update_project(p_id text, p_token text, p_patch jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.sound_projects p set
    title         = coalesce(p_patch->>'title',         p.title),
    project_type  = coalesce(p_patch->>'project_type',  p.project_type),
    sounds_needed = coalesce(p_patch->>'sounds_needed', p.sounds_needed),
    description   = coalesce(p_patch->>'description',   p.description),
    image_url     = coalesce(p_patch->>'image_url',     p.image_url),
    poster_url    = coalesce(p_patch->>'poster_url',    p.poster_url),
    media_url     = coalesce(p_patch->>'media_url',     p.media_url),
    contact       = coalesce(p_patch->>'contact',       p.contact),
    author        = coalesce(p_patch->>'author',        p.author),
    slots         = coalesce((p_patch->>'slots')::int,  p.slots),
    status        = coalesce(p_patch->>'status',        p.status)
  where p.id = p_id
    and p.owner_hash is not null
    and p.owner_hash = public.sc_hash(p_token);
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.sc_delete_project(p_id text, p_token text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.sound_projects p
  where p.id = p_id
    and p.owner_hash is not null
    and p.owner_hash = public.sc_hash(p_token);
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.sc_update_designer(p_id text, p_token text, p_patch jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.sound_designers d set
    name        = coalesce(p_patch->>'name',        d.name),
    website     = coalesce(p_patch->>'website',     d.website),
    bio         = coalesce(p_patch->>'bio',         d.bio),
    contact     = coalesce(p_patch->>'contact',     d.contact),
    avatar_url  = coalesce(p_patch->>'avatar_url',  d.avatar_url),
    poster_url  = coalesce(p_patch->>'poster_url',  d.poster_url),
    sample_urls = coalesce(p_patch->>'sample_urls', d.sample_urls)
  where d.id = p_id
    and d.owner_hash is not null
    and d.owner_hash = public.sc_hash(p_token);
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.sc_delete_designer(p_id text, p_token text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.sound_designers d
  where d.id = p_id
    and d.owner_hash is not null
    and d.owner_hash = public.sc_hash(p_token);
  get diagnostics n = row_count;
  return n;
end $$;

-- Un-claiming a volunteer slot. Either side of the pairing may undo it, so the
-- token is accepted if it matches the project's owner OR the designer's.
create or replace function public.sc_delete_assignment(p_id text, p_token text)
returns int language plpgsql security definer set search_path = public as $$
declare n int; h text;
begin
  h := public.sc_hash(p_token);
  delete from public.sound_assignments a
  where a.id = p_id
    and (
      exists (select 1 from public.sound_projects  p where p.id = a.project_id  and p.owner_hash = h)
      or
      exists (select 1 from public.sound_designers d where d.id = a.designer_id and d.owner_hash = h)
    );
  get diagnostics n = row_count;
  return n;
end $$;

-- "Manage this listing" from another device: prove you know the contact the
-- listing was posted with, and take ownership by installing a fresh hash.
-- p_kind is 'project' or 'designer'.
--
-- KNOWN LIMIT — the honest note on this one. `contact` is shown on the listing
-- and is in every row the site serves, so "knows the contact" is not a secret
-- and anyone who can read a listing can take it over one row at a time. That
-- was equally true before (the raw token sat in the same readable row), so
-- this is not a regression, and it no longer permits the thing that actually
-- mattered: a stranger with the anon key wiping the whole directory in one
-- call. Closing it properly means real accounts, or keeping contact details
-- out of a publicly-readable table. Until then this is a cohort convenience,
-- not a security boundary.
create or replace function public.sc_claim(p_kind text, p_id text, p_contact text, p_hash text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  -- Must look like a SHA-256 hex digest, so a caller can't park junk (or a
  -- value they'd find convenient) in the ownership column.
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then
    return 0;
  end if;
  if coalesce(btrim(p_contact), '') = '' then
    return 0;
  end if;
  if p_kind = 'project' then
    update public.sound_projects p set owner_hash = p_hash
    where p.id = p_id
      and p.contact is not null
      and lower(btrim(p.contact)) = lower(btrim(p_contact));
  elsif p_kind = 'designer' then
    update public.sound_designers d set owner_hash = p_hash
    where d.id = p_id
      and d.contact is not null
      and lower(btrim(d.contact)) = lower(btrim(p_contact));
  else
    return 0;
  end if;
  get diagnostics n = row_count;
  return n;
end $$;

-- Only these functions are callable by the public role.
revoke all on function public.sc_update_project(text, text, jsonb)   from public;
revoke all on function public.sc_delete_project(text, text)          from public;
revoke all on function public.sc_update_designer(text, text, jsonb)  from public;
revoke all on function public.sc_delete_designer(text, text)         from public;
revoke all on function public.sc_delete_assignment(text, text)       from public;
revoke all on function public.sc_claim(text, text, text, text)       from public;

grant execute on function public.sc_update_project(text, text, jsonb)  to anon;
grant execute on function public.sc_delete_project(text, text)         to anon;
grant execute on function public.sc_update_designer(text, text, jsonb) to anon;
grant execute on function public.sc_delete_designer(text, text)        to anon;
grant execute on function public.sc_delete_assignment(text, text)      to anon;
grant execute on function public.sc_claim(text, text, text, text)      to anon;

-- ── REALTIME (live updates on the page) ─────────────────────
-- Adding a table twice to the publication errors, so guard each one.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sound_projects'
  ) then
    alter publication supabase_realtime add table public.sound_projects;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sound_designers'
  ) then
    alter publication supabase_realtime add table public.sound_designers;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sound_assignments'
  ) then
    alter publication supabase_realtime add table public.sound_assignments;
  end if;
end $$;

-- ── STORAGE (images, A4 posters, sound bites) ───────────────
-- 1) Dashboard → Storage → New bucket → name it exactly:  sound-collab
--    tick "Public bucket" so uploaded files have public URLs.
-- 2) Then allow anonymous uploads to that bucket:
--    Note: insert-only. There is no update or delete policy, so an uploaded
--    file can't be swapped out or removed through the anon key.
drop policy if exists "sc_storage_upload" on storage.objects;
drop policy if exists "sc_storage_read"   on storage.objects;

create policy "sc_storage_upload" on storage.objects
  for insert to anon with check (bucket_id = 'sound-collab');
create policy "sc_storage_read" on storage.objects
  for select to anon using (bucket_id = 'sound-collab');
