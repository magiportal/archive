-- ============================================================
--  Media Database (Archive) — Supabase setup
--  Run in the SQL Editor of the same project as the Board / Sound Collab.
--  Safe to re-run.
--
--  Light by design: only METADATA + small files live here.
--   • Video  → external LINK (Vimeo/YouTube)   — no blob stored
--   • Audio  → external LINK (SoundCloud, etc.) — no blob stored
--   • PDF / image → uploaded to Storage (small; a few MB each)
-- ============================================================

create table if not exists public.archive_items (
  id          text primary key,
  type        text,          -- recording | lecture | video | audio | document | image
  title       text,
  authors     text,
  source      text,
  abstract    text,
  year        int,
  spec        text,          -- sub-label, e.g. "Session Recording", "Exegesis"
  media_url   text,          -- video/audio LINK, or the Storage URL of a PDF/image
  duration    text,          -- optional, e.g. "4m 20s"
  created_at  timestamptz default now()
);

-- ── OWNERSHIP ────────────────────────────────────────────────
-- The posting browser keeps a random token in its own localStorage and stores
-- only SHA-256(token) here. Deletion goes through archive_delete() below,
-- which re-hashes the token you present and compares. The hash is safe to
-- expose in a publicly-readable row because the token is a random UUID; the
-- old plaintext owner_token was not, so it is dropped rather than migrated.
alter table public.archive_items add column if not exists owner_hash text;
alter table public.archive_items drop column if exists owner_token;

-- ── RLS ──────────────────────────────────────────────────────
-- Read and insert are open (browsing is public; uploading is gated on the
-- password client-side). There is deliberately no UPDATE or DELETE policy, so
-- RLS denies both — removal only happens via the owner-checked function below.
alter table public.archive_items enable row level security;
drop policy if exists "archive_all"    on public.archive_items;
drop policy if exists "archive_read"   on public.archive_items;
drop policy if exists "archive_insert" on public.archive_items;
create policy "archive_read"   on public.archive_items for select to anon using (true);
create policy "archive_insert" on public.archive_items for insert to anon with check (true);

-- Returns 1 if the token owned the row and it was deleted, else 0.
create or replace function public.archive_delete(p_id text, p_token text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.archive_items a
  where a.id = p_id
    and a.owner_hash is not null
    and a.owner_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
  get diagnostics n = row_count;
  return n;
end $$;

revoke all    on function public.archive_delete(text, text) from public;
grant execute on function public.archive_delete(text, text) to anon;

-- ── Realtime ────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'archive_items'
  ) then
    alter publication supabase_realtime add table public.archive_items;
  end if;
end $$;

-- ── Storage (PDFs + images only) ────────────────────────────
-- 1) Dashboard → Storage → New bucket → name it exactly:  archive
--    tick "Public bucket".
-- 2) Then run:
drop policy if exists "archive_upload" on storage.objects;
drop policy if exists "archive_read"   on storage.objects;
create policy "archive_upload" on storage.objects
  for insert to anon with check (bucket_id = 'archive');
create policy "archive_read" on storage.objects
  for select to anon using (bucket_id = 'archive');

-- ── Seed the one existing real item (Studio 3 Streaming Party) ──
insert into public.archive_items
  (id, type, title, authors, source, abstract, year, spec, media_url, duration)
values
  ('studio-3-streaming-party', 'video',
   'Studio 3 Streaming Party — Session Recording',
   'Recorded session — MAGI Studio',
   'Studio session · RMIT Melbourne, 3 Jun 2026',
   'Full capture of the Studio 3 streaming party from the MAGI Program studio sessions.',
   2026, 'Session Recording',
   'https://vimeo.com/1207762435', '4m 20s')
on conflict (id) do nothing;
