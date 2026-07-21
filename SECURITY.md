# Access model — MAGI Portal

This is a static site (GitHub Pages) talking directly to Supabase. There is no
server of ours in between. That single fact shapes everything below.

## Deploying the database changes

Run these in the Supabase SQL Editor, in any order. All three are safe to re-run:

1. `soundcollab-setup.sql`
2. `archive-setup.sql`
3. `studio-setup.sql`

They are **breaking**: they drop the old `owner_token` columns. Anyone who
posted before will lose the ability to edit that post from their browser — the
"Manage this listing" flow (contact email) is how they get it back. This was
done deliberately rather than migrating the old tokens, because those tokens
were publicly readable and so can't be trusted.

After running them, check: posting still works, editing your own post works,
and editing from a different browser is refused.

## The two passwords

`gate-auth.js` holds them as PBKDF2-SHA256 hashes (600k iterations). Nothing
in the repo has them in plaintext.

To rotate one, derive a new hash and paste it into `HASHES` in that file:

```
node -e "console.log(require('crypto').pbkdf2Sync(
  'the-new-password', 'magi-portal-gate-v1', 600000, 32, 'sha256').toString('hex'))"
```

**Rotated 2026-07-21.** The previous pair (`magistu2026` / `magisound2026`) is
readable in git history at commits `5c4bfa2`, `e63a4f0` and `dd5a948`, so it is
permanently burned — don't reuse either, and don't assume deleting a file
retracts them.

The current passwords are deliberately **not written down in this repo**, only
their hashes in `gate-auth.js`. Share them with the cohort out-of-band. If they
ever end up in a commit, rotate again — history is forever.

A gate needs HTTPS or localhost — `crypto.subtle` doesn't exist on `file://`.
Opening a page by double-clicking it will show "Can't verify here".

## What the password gate is and isn't

It keeps casual visitors out of the posting UI. It is **not** access control:
the hash ships to every browser, and the passwords are a guessable shape (word
+ year), so a determined person gets through. Treat everything behind it as
readable by anyone.

## What actually protects the data

Row Level Security, not the password.

| Table | read | insert | update | delete |
|---|---|---|---|---|
| `sound_projects` | anyone | anyone | owner only¹ | owner only¹ |
| `sound_designers` | anyone | anyone | owner only¹ | owner only¹ |
| `sound_assignments` | anyone | anyone | — | either party¹ |
| `archive_items` | anyone | anyone | — | owner only¹ |
| `studio_cards` | anyone | anyone | anyone² | **never**² |
| `studio_cards_history` | nobody | nobody | nobody | nobody |

¹ No UPDATE/DELETE policy exists, so RLS denies them outright. All changes go
through `security definer` functions that re-hash the caller's token and
compare it to the row's stored hash.

² The Board is a shared canvas — there is no owner to check, and without real
accounts a student tidying up is indistinguishable from a stranger. So edits
stay open but are made reversible: DELETE is revoked entirely (the UI
soft-deletes via `deleted_at`), and every change snapshots the previous version
into `studio_cards_history`, which anon cannot read or write. Recovery queries
are at the bottom of `studio-setup.sql`.

### Ownership tokens

The posting browser keeps a random UUID in `localStorage`; the row stores only
`SHA-256(token)`. The hash is safe to expose in a public row because the token
is random — nothing to guess. The previous design stored the raw token on the
row, which meant any reader could copy it and pose as the owner.

## Known gaps

- **Listing takeover via contact email.** `sc_claim` lets someone adopt a
  listing by supplying its contact address — but that address is shown on the
  listing. So anyone who can read a listing can take it over, one row at a
  time. Fixing it properly means real accounts, or keeping contact details out
  of a publicly-readable table.
- **Board vandalism is possible, only reversible.** See ² above.
- **Storage uploads are open.** Anyone with the anon key can upload to the
  `archive` and `sound-collab` buckets. They can't overwrite or delete existing
  files (insert-only policies), but there's no quota on junk.
- **The anon key is public.** That's by design — it's meant to be shipped. It
  is not a secret and RLS is what makes that safe.

The single change that would close most of this is Supabase Auth with per-user
policies, which would also remove the shared passwords entirely.
