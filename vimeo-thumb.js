// ── VIMEO THUMBNAILS ─────────────────────────────────────────
// Resolves a Vimeo still from Vimeo's own oEmbed API.
//
// WHY THIS EXISTS
// The Archive, Recent Media and site search all used to build Vimeo stills as
// `https://vumbnail.com/<id>.jpg` — an unofficial third-party proxy. It went
// unreachable (connection failure, not a 404), so every Vimeo thumbnail on the
// site broke at once with nothing on our side having changed. Anything that
// depends on a free proxy with no uptime guarantee can do that again, so this
// goes to Vimeo directly instead.
//
// The trade-off: oEmbed is a JSON lookup per video, not a URL you can drop
// straight into src=. So callers render their placeholder tile first and let
// hydrate() swap a real image in when it arrives — the list is never blocked
// waiting on thumbnails, and if Vimeo is unreachable the placeholder simply
// stays, which is the correct degraded state.
//
// YouTube is untouched: img.youtube.com is Google's own endpoint and has none
// of this problem.
(function () {
  const CACHE_KEY = 'magi-vimeo-thumbs';
  const ENDPOINT  = 'https://vimeo.com/api/oembed.json';

  // sessionStorage, so moving between the Archive and the home page doesn't
  // re-request stills that were already resolved this visit. Wrapped because
  // storage throws outright in some privacy modes.
  let cache = {};
  try { cache = JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}'); } catch (e) { cache = {}; }
  const save = () => {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (e) { /* full or blocked */ }
  };

  // In-flight requests, so ten rows sharing a video don't fire ten lookups.
  const pending = new Map();

  function idFrom(url) {
    const m = String(url || '').match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return m ? m[1] : null;
  }

  function urlFor(id, width) {
    if (cache[id]) return Promise.resolve(cache[id]);
    if (pending.has(id)) return pending.get(id);

    const api = ENDPOINT + '?url=' + encodeURIComponent('https://vimeo.com/' + id)
              + (width ? '&width=' + width : '');

    const p = fetch(api)
      .then(r => { if (!r.ok) throw new Error('oembed ' + r.status); return r.json(); })
      .then(j => {
        if (!j || !j.thumbnail_url) throw new Error('no thumbnail_url');
        cache[id] = j.thumbnail_url;
        save();
        return j.thumbnail_url;
      })
      .finally(() => pending.delete(id));

    pending.set(id, p);
    return p;
  }

  // Finds tiles marked data-vimeo="<id>" under `root` and fills each with the
  // real still. `opts.width` asks Vimeo for an appropriately-sized crop.
  // A failure is deliberately swallowed: the placeholder the caller already
  // rendered is the fallback, so there's nothing to undo.
  function hydrate(root, opts) {
    opts = opts || {};
    const scope = root || document;
    scope.querySelectorAll('[data-vimeo]').forEach(box => {
      const id = box.getAttribute('data-vimeo');
      if (!id || box.dataset.vimeoDone) return;
      box.dataset.vimeoDone = '1';         // never request the same tile twice

      urlFor(id, opts.width).then(src => {
        const img = new Image();
        // Only swap once the bytes are actually decoded — replacing the
        // placeholder first would flash an empty tile if the image 404s.
        img.onload = () => {
          box.innerHTML = '';
          if (opts.placeholderClass) box.classList.remove(opts.placeholderClass);
          img.alt = '';
          box.appendChild(img);
        };
        img.onerror = () => { /* keep the placeholder */ };
        img.src = src;
      }).catch(() => { /* keep the placeholder */ });
    });
  }

  window.MAGIVimeoThumb = { idFrom, urlFor, hydrate };
})();
