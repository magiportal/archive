-- ============================================================
--  Community Board (studio_cards) — Supabase setup
--  Run in the SQL Editor of the same project as the Archive / Sound Collab.
--  Safe to re-run.
-- ============================================================

create table if not exists public.studio_cards (
  id      text primary key,
  type    text,           -- wip | technique | scrap | reference
  title   text,
  text    text,
  author  text,
  date    text,
  tags    text,           -- comma-joined
  x       double precision,
  y       double precision,
  pinned  boolean default false,
  img     text
);

-- ── WHY THIS ONE IS DIFFERENT ────────────────────────────────
-- The Sound Collab and the Archive have per-post owners, so their rows can be
-- locked to the browser that made them. The Board can't work that way: it's a
-- shared canvas where the whole point is that anyone in the cohort can drag,
-- retitle and tidy anyone's card. There is no "owner" to check against.
--
-- Without real accounts there is no way to tell a student tidying the board
-- from a stranger vandalising it — both are just the anon key. So rather than
-- pretend otherwise, this schema gives up on preventing edits and makes them
-- all REVERSIBLE instead:
--
--   • DELETE is revoked outright — there is no delete policy, so nothing can
--     actually be destroyed through the API. "Delete" in the UI sets
--     deleted_at, and the row stays.
--   • Every update and soft-delete copies the previous version into
--     studio_cards_history, which anon cannot read or write at all.
--
-- Net effect: a malicious wipe is an inconvenience you can undo from the
-- Supabase dashboard, not a loss. Closing the hole properly — actually
-- stopping the edit — needs Supabase Auth and per-user policies.

alter table public.studio_cards add column if not exists deleted_at timestamptz;

create table if not exists public.studio_cards_history (
  history_id  bigserial primary key,
  changed_at  timestamptz default now(),
  operation   text,
  card_id     text,
  snapshot    jsonb      -- the row as it looked BEFORE the change
);

create index if not exists studio_cards_history_card_idx
  on public.studio_cards_history (card_id, changed_at desc);

create or replace function public.studio_cards_snapshot()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.studio_cards_history (operation, card_id, snapshot)
  values (tg_op, old.id, to_jsonb(old));
  return new;
end $$;

drop trigger if exists studio_cards_audit on public.studio_cards;
create trigger studio_cards_audit
  before update on public.studio_cards
  for each row execute function public.studio_cards_snapshot();

-- ── RLS ──────────────────────────────────────────────────────
alter table public.studio_cards         enable row level security;
alter table public.studio_cards_history enable row level security;

drop policy if exists "studio_cards_all"    on public.studio_cards;
drop policy if exists "studio_cards_read"   on public.studio_cards;
drop policy if exists "studio_cards_insert" on public.studio_cards;
drop policy if exists "studio_cards_update" on public.studio_cards;

create policy "studio_cards_read"   on public.studio_cards for select to anon using (true);
create policy "studio_cards_insert" on public.studio_cards for insert to anon with check (true);
create policy "studio_cards_update" on public.studio_cards for update to anon using (true) with check (true);
-- deliberately no delete policy: see the note above.

-- studio_cards_history gets NO policies at all, so with RLS on, anon can
-- neither read the history nor tamper with it. The trigger writes to it as the
-- definer, which is why that still works. Read it from the SQL Editor.

-- ── REALTIME ─────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'studio_cards'
  ) then
    alter publication supabase_realtime add table public.studio_cards;
  end if;
end $$;

-- ── RECOVERING A VANDALISED BOARD ────────────────────────────
-- Undo a single card (most recent version before the last change):
--
--   update public.studio_cards c set
--     title = h.snapshot->>'title', text = h.snapshot->>'text',
--     x = (h.snapshot->>'x')::float8, y = (h.snapshot->>'y')::float8,
--     deleted_at = null
--   from (select distinct on (card_id) * from public.studio_cards_history
--         where card_id = 'THE-ID' order by card_id, changed_at desc) h
--   where c.id = h.card_id;
--
-- Or just bring back everything soft-deleted in the last day:
--
--   update public.studio_cards set deleted_at = null
--   where deleted_at > now() - interval '1 day';
