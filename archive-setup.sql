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
  owner_token text,          -- lets the posting browser delete its own item
  created_at  timestamptz default now()
);

-- ── RLS (open / trust-based, same posture as the rest of the site) ──
alter table public.archive_items enable row level security;
drop policy if exists "archive_all" on public.archive_items;
create policy "archive_all" on public.archive_items for all using (true) with check (true);

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
