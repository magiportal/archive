
(function () {

  const SALT       = 'magi-portal-gate-v1';
  const ITERATIONS = 600000;


  const HASHES = {
    magi:  'c82361f137ff206a4784d281cbc3cc0a1d5e9f128e1da90c8076c616aeb874de',
    sound: 'c7292e782a71818943e606b802bcdff92666b8c9369a9b3578af839e0f09522c',
  };


  const MAGI_KEY  = 'magi-studio-auth';
  const SOUND_KEY = 'magi-sound-auth';

  const enc = new TextEncoder();
  const toHex = (buf) =>
    Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');


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


  async function verify(password) {
    if (!available) throw new Error('gate-auth: crypto.subtle unavailable (needs HTTPS or localhost)');
    if (!password) return null;
    const h = await derive(password);
    if (h === HASHES.magi)  return 'magi';
    if (h === HASHES.sound) return 'sound';
    return null;
  }


  async function unlock(password) {
    const tier = await verify(password);
    if (tier === 'magi')  { try { sessionStorage.setItem(MAGI_KEY,  '1'); } catch (e) {} }
    if (tier === 'sound') { try { sessionStorage.setItem(SOUND_KEY, '1'); } catch (e) {} }
    return tier;
  }

  window.MAGIGate = { verify, unlock, available, MAGI_KEY, SOUND_KEY };


})();
