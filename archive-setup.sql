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

-- ── FACET COLUMNS (Specialisation / Keywords) ────────────────
-- These back two of the four filter lists in the research.html sidebar. They
-- are optional: research.html hides those sections entirely while no row
-- carries a value, rather than showing an empty or made-up list.
--
--   spec_area — one of: Research | Animation | Games | Interactivity.
--               NOT the same as the existing `spec` column, which is a free
--               text sub-label ("Session Recording", "Exegesis", "Uploaded")
--               shown on the result row itself.
--   keywords  — comma-joined, e.g. 'Installation Art, Critical Design'.
--               Same convention as the Board's tags column.
alter table public.archive_items add column if not exists spec_area text;
alter table public.archive_items add column if not exists keywords  text;

-- ── COMPANION SLIDES ─────────────────────────────────────────
-- A second attachment alongside media_url, so a recording can carry the deck
-- that was presented with it. Exists because a session host couldn't screen
-- share the speaker's slides: the audio and the slides were captured
-- separately, and the listener needs both at once.
--
-- Accepts a PDF or a .pptx, and research.html picks the viewer from the file
-- extension:
--   .pdf   — straight into an iframe. Browsers render PDF natively, so it's
--            fast and depends on nothing external. Hyperlinks in the deck
--            survive the export and stay clickable, but EMBEDDED VIDEO does
--            not: PDF export flattens it to a still frame.
--   .pptx  — rendered through Microsoft's Office viewer
--            (view.officeapps.live.com), which runs the real PowerPoint, so
--            hyperlinks and embedded video both keep working. Needs the file
--            to be publicly reachable, which it is — the archive bucket is
--            public and has an anon select policy.
-- Use .pptx when the deck contains video, PDF otherwise.
--
-- Either way it's its own iframe rather than being baked into the recording,
-- which is what lets a viewer move through the deck at their own pace while
-- the audio keeps playing.
alter table public.archive_items add column if not exists slides_url text;

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

-- ── REMOVING AN ITEM (manual, via the dashboard) ─────────────
-- The page has no working delete control in practice: it only renders for the
-- browser holding that row's owner token, so removal happens here instead.
-- RLS backs this up — anon has no delete policy on the table, and the storage
-- bucket is insert/select only, so nothing can be destroyed with the public
-- key either way.
--
-- It's TWO steps. Deleting the row does not touch Storage, so any uploaded
-- file (a PDF/image in media_url, or a deck in slides_url) is left behind in
-- the bucket. Run this first to see what an item is holding:
--
--   select id, title, type, media_url, slides_url
--   from public.archive_items
--   where id = 'THE-ID';
--
-- Anything under .../storage/v1/object/public/archive/<path> is a file YOU
-- host — delete <path> from Storage → archive as well. External links
-- (Vimeo, YouTube, SoundCloud) need no cleanup; nothing was uploaded.
--
-- To list every self-hosted file still referenced, so you can tell a live
-- file from an orphan when tidying the bucket:
--
--   select id, title,
--          split_part(media_url,  '/public/archive/', 2) as media_path,
--          split_part(slides_url, '/public/archive/', 2) as slides_path
--   from public.archive_items
--   where media_url like '%/public/archive/%'
--      or slides_url like '%/public/archive/%';
--
-- Then: delete from public.archive_items where id = 'THE-ID';
