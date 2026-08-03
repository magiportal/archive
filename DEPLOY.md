# Deploying to DreamHost — rmitmagi.com

Static site, uploaded over SFTP. No build step: what's in this folder is what
runs.

---

## 1. Before the first upload

**Turn on HTTPS in the DreamHost panel** (Websites → Secure Certificate → add
the free Let's Encrypt cert for `rmitmagi.com`).

This is not cosmetic. The password gates and the archive's ownership tokens
use `crypto.subtle`, which browsers only expose on HTTPS. Over plain `http://`
every gate fails closed with *"Can't verify here — open this page over https"*
and nobody can unlock the Sound Collab, Archive or Board. The `.htaccess`
redirects http→https, so if the cert isn't issued yet visitors get a
certificate warning instead of the site. **Cert first, then upload.**

Also wait for DNS to finish propagating — the domain was still registering as
of setup. `nslookup rmitmagi.com` should return DreamHost's IP before you
bother testing.

---

## 2. Connecting with FileZilla

Get the SFTP user from DreamHost panel → Websites → Manage → FTP/SFTP users.

| Field | Value |
|---|---|
| Host | `sftp://rmitmagi.com` (or the server name, e.g. `iad1-shared-xx.dreamhost.com`) |
| Protocol | **SFTP — SSH File Transfer Protocol** (not plain FTP) |
| Port | 22 |
| User / Password | from the panel |

Use SFTP, not FTP. Plain FTP sends the password in the clear.

**Upload target:** `/home/<user>/rmitmagi.com/` — the contents of this folder go
*inside* that directory, so `index.html` lands at
`/home/<user>/rmitmagi.com/index.html`. Don't create a nested `MAGI_CENTRAL`
folder; the site would end up at `rmitmagi.com/MAGI_CENTRAL/`.

---

## 3. Do NOT upload these

FileZilla has no gitignore awareness — it uploads whatever you drag. Select
files deliberately, or delete these server-side afterwards.

| Skip | Why |
|---|---|
| `.git/` | **Most important.** ~299MB, and a served `.git` lets anyone reconstruct the full history — including the commits where the gate passwords were still in plaintext. |
| `*.sql` | `archive-setup.sql`, `soundcollab-setup.sql`, `studio-setup.sql`, `soundcollab-seed.sql` — these spell out the schema, the RLS policies and the ownership functions. |
| `SECURITY.md`, `DEPLOY.md`, `README.md` | Document the threat model, which passwords are burned, and how to reach the server. |
| `.claude/`, `.vscode/` | Editor/tooling config. |
| `media/workshop/week2.png` | 1.8MB, not referenced by any page. |
| `media/events/ACMI/kora2–kora5.jpg` | ~3.3MB, not referenced (the site uses `kora1` and `kora6`, both now WebP). Kept on disk in case they're wanted later — just don't upload them. |

`.htaccess` blocks the sensitive ones too, but that's a second line of
defence — the first is not putting them there.

**Upload size: ~13MB** with the unreferenced files skipped (18MB on disk).
Breakdown: 6MB EXPO trailer, 3MB gallery images, 3MB event/alumni images,
1MB logo + fonts.

**Do upload** `.htaccess`. FileZilla hides dotfiles by default:
Server → *Force showing hidden files*.

---

## 4. After uploading — check these

1. `https://rmitmagi.com` loads, and `http://` redirects to it.
2. `https://rmitmagi.com/.git/config` → 404 (not a file listing).
3. `https://rmitmagi.com/archive-setup.sql` → 403/404.
4. **Unlock a gate** (Sound Collab). If it says *"Can't verify here"*, HTTPS
   isn't actually active — recheck the cert.
5. Images load on the Media Gallery — filenames are **case-sensitive** on
   Linux. `S4125361-bunny-flip.webp` ≠ `s4125361-...`. A local Windows test
   won't catch a case bug; the live server will.
6. The EXPO trailer plays behind the Call for Works card.
7. Archive and Board load their Supabase data.

---

## 5. Updating later

Re-upload only the changed files. Because HTML is sent `Cache-Control:
no-cache`, edits appear on the next load. CSS/JS cache for an hour — hard
refresh (Ctrl+F5) if a style change doesn't show.

---

## Still worth doing

- **Rotate the gate passwords** if the GitHub repo is public. The current pair
  is fine, but the *old* one is recoverable from git history, and people reuse.
- ~~The big images~~ — **done.** All 18 oversized JPG/PNGs were re-encoded to
  WebP, long edge capped at 1600px, quality 82. The site went from 108MB to
  18MB; the biggest single win was the alumni hero at 7168×4032 (12MB → 220KB).
  Originals were deleted after every reference was verified — they remain in
  git history if one is ever needed again.
  If you add images later, run them through the same treatment:
  ```
  ffmpeg -i in.png -vf "scale='if(gt(iw,ih),min(1600,iw),-1)':'if(gt(iw,ih),-1,min(1600,ih))'" \
    -c:v libwebp -quality 82 -compression_level 6 -preset photo out.webp
  ```
- **Point Supabase at the domain.** Nothing breaks without it (the REST API
  accepts any origin), but setting Site URL to `https://rmitmagi.com` in
  Supabase → Settings keeps things tidy.
