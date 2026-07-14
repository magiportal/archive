-- ============================================================
--  Sound Collab — Supabase setup
--  Run this in your Supabase project's SQL Editor
--  (same project as the Community Board: hzzhuikzvdfcizkuelte)
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

-- ── OWNERSHIP (lets a post's original browser edit/delete it) ──
-- owner_token is a random id generated client-side when a listing is posted,
-- cached in that browser's localStorage, and compared on edit/delete.
-- It is readable by anyone (RLS is open, same as everything else here) — it is
-- a convenience marker, not real access control. See soundcollab.html notes.
alter table public.sound_projects  add column if not exists owner_token text;
alter table public.sound_designers add column if not exists owner_token text;

-- ── MEDIA (gameplay / reference video for a project) ─────────
-- A YouTube or Vimeo link so sound designers can see the project before volunteering.
alter table public.sound_projects add column if not exists media_url text;

-- ── ROW LEVEL SECURITY (open / trust-based, same as studio_cards) ──
alter table public.sound_projects    enable row level security;
alter table public.sound_designers   enable row level security;
alter table public.sound_assignments enable row level security;

-- drop-then-create so this script is safe to re-run
drop policy if exists "sc_projects_all"    on public.sound_projects;
drop policy if exists "sc_designers_all"   on public.sound_designers;
drop policy if exists "sc_assignments_all" on public.sound_assignments;

create policy "sc_projects_all"    on public.sound_projects    for all using (true) with check (true);
create policy "sc_designers_all"   on public.sound_designers   for all using (true) with check (true);
create policy "sc_assignments_all" on public.sound_assignments for all using (true) with check (true);

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
drop policy if exists "sc_storage_upload" on storage.objects;
drop policy if exists "sc_storage_read"   on storage.objects;

create policy "sc_storage_upload" on storage.objects
  for insert to anon with check (bucket_id = 'sound-collab');
create policy "sc_storage_read" on storage.objects
  for select to anon using (bucket_id = 'sound-collab');
