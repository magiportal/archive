// ── POST OWNERSHIP TOKENS ─────────────────────────────────────────
// Shared by the Sound Collab and the Archive. Lets the browser that posted
// something edit or delete it later, without anyone having to hold an account.
//
// HOW IT WORKS
// On posting we mint a random UUID (the token). The raw token stays in this
// browser's localStorage and is sent only as an argument to the database's
// owner-checked functions. What gets STORED on the row is SHA-256(token).
//
// Why the split: every row is publicly readable, so anything saved on the row
// is visible to anyone with the anon key. The old design stored the raw token
// there, which meant a reader could copy it and pose as the owner — the lock
// and the key in the same drawer. A hash gives the server something to compare
// against while leaving nothing useful on display, and it's safe to expose
// precisely because the token is a random UUID: no wordlist reaches it.
//
// We cache the hash locally alongside the token so ownership checks during
// render stay synchronous — hashing is async, and render loops are not.
(function () {

  const enc = new TextEncoder();

  const toHex = (buf) =>
    Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');

  async function sha256Hex(str) {
    if (!(window.crypto && window.crypto.subtle)) {
      throw new Error('owner-token: crypto.subtle unavailable (needs HTTPS or localhost)');
    }
    return toHex(await crypto.subtle.digest('SHA-256', enc.encode(str)));
  }

  const newToken = () =>
    (crypto.randomUUID ? crypto.randomUUID()
                       : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10));

  const keyFor = (prefix, id) => prefix + id;

  // Returns { token, hash } or null. Tolerates the old format (a bare token
  // string), which is now useless on its own — treated as absent.
  function get(prefix, id) {
    try {
      const raw = localStorage.getItem(keyFor(prefix, id));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return (parsed && parsed.token && parsed.hash) ? parsed : null;
    } catch (e) {
      return null;   // bare string from the pre-hash scheme, or storage blocked
    }
  }

  function remember(prefix, id, token, hash) {
    try { localStorage.setItem(keyFor(prefix, id), JSON.stringify({ token, hash })); } catch (e) {}
  }

  function forget(prefix, id) {
    try { localStorage.removeItem(keyFor(prefix, id)); } catch (e) {}
  }

  // Mint a token for a row we're about to create. Resolves to { token, hash };
  // send `hash` to the database, keep `token` for later edits.
  async function mint(prefix, id) {
    const token = newToken();
    const hash  = await sha256Hex(token);
    remember(prefix, id, token, hash);
    return { token, hash };
  }

  // Synchronous — safe to call from render. True when this browser holds the
  // token matching the row's stored hash.
  function isOwner(prefix, id, row) {
    if (!row || !row.owner_hash) return false;
    const held = get(prefix, id);
    return !!held && held.hash === row.owner_hash;
  }

  // The raw token to hand to an owner-checked database function.
  function tokenFor(prefix, id) {
    const held = get(prefix, id);
    return held ? held.token : null;
  }

  window.MAGIOwner = { sha256Hex, mint, get, remember, forget, isOwner, tokenFor };

})();
