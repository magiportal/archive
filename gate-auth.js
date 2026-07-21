// ── SHARED GATE AUTH ──────────────────────────────────────────────
// Every page that asks for a cohort password checks it through here, so the
// passwords themselves live in exactly one place — as hashes, never plaintext.
//
// WHAT THIS DOES AND DOESN'T BUY US
// This is a static site: there is no server, so anything needed to check a
// password has to ship to the browser. That means a determined visitor can
// always attack whatever we put here. Storing raw SHA-256 would be no real
// obstacle — our passwords are a guessable shape (a word plus the year), so a
// short wordlist would crack them in milliseconds. PBKDF2 at 600k iterations
// makes each guess cost ~150ms of real CPU instead, turning an instant crack
// into hours for a targeted attacker and stopping casual view-source reading
// outright. It is a speed bump, not a lock. The actual protection for the
// data lives in the Supabase RLS policies, not here.
(function () {

  // Changing SALT or ITERATIONS invalidates the hashes below — both would have
  // to be re-derived. See the note at the bottom of this file.
  // 600k matches current OWASP guidance for PBKDF2-SHA256, and still lands
  // around 150ms — imperceptible for a once-per-session gate.
  const SALT       = 'magi-portal-gate-v1';
  const ITERATIONS = 600000;

  // PBKDF2-HMAC-SHA256, 32 bytes, hex.
  // Rotated 2026-07-21: the previous pair is recoverable from git history and
  // was retired for that reason.
  const HASHES = {
    magi:  'c82361f137ff206a4784d281cbc3cc0a1d5e9f128e1da90c8076c616aeb874de',
    sound: 'c7292e782a71818943e606b802bcdff92666b8c9369a9b3578af839e0f09522c',
  };

  // Session keys, unchanged from before so existing unlocked sessions survive.
  // The two tiers are deliberately NOT equivalent: MAGI reaches the Sound
  // Collab, Archive and Board; sound reaches the Sound Collab only.
  const MAGI_KEY  = 'magi-studio-auth';
  const SOUND_KEY = 'magi-sound-auth';

  const enc = new TextEncoder();
  const toHex = (buf) =>
    Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');

  // crypto.subtle only exists in a secure context — HTTPS or localhost. On the
  // live site (GitHub Pages, HTTPS) it's always there; opening a page straight
  // off disk with file:// is the one case where it isn't, and the gates report
  // that specifically rather than lying with "Incorrect password".
  const available = !!(window.crypto && window.crypto.subtle);

  async function derive(password) {
    const material = await crypto.subtle.importKey(
      'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode(SALT), iterations: ITERATIONS, hash: 'SHA-256' },
      material, 256
    );
    return toHex(bits);
  }

  // Resolves to 'magi', 'sound', or null. Rejects only when the browser can't
  // hash at all, so callers can tell "wrong password" apart from "can't check".
  async function verify(password) {
    if (!available) throw new Error('gate-auth: crypto.subtle unavailable (needs HTTPS or localhost)');
    if (!password) return null;
    const h = await derive(password);
    if (h === HASHES.magi)  return 'magi';
    if (h === HASHES.sound) return 'sound';
    return null;
  }

  // Convenience: verify and set the matching session key in one step.
  // Resolves to the tier that was unlocked, or null.
  async function unlock(password) {
    const tier = await verify(password);
    if (tier === 'magi')  { try { sessionStorage.setItem(MAGI_KEY,  '1'); } catch (e) {} }
    if (tier === 'sound') { try { sessionStorage.setItem(SOUND_KEY, '1'); } catch (e) {} }
    return tier;
  }

  window.MAGIGate = { verify, unlock, available, MAGI_KEY, SOUND_KEY };

  // ── ROTATING A PASSWORD ──
  // Run this in Node, then paste the hex into HASHES above:
  //
  //   node -e "console.log(require('crypto').pbkdf2Sync(
  //     'the-new-password', 'magi-portal-gate-v1', 600000, 32, 'sha256').toString('hex'))"

})();
