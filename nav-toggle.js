// ── MOBILE NAV (hamburger) ──────────────────────────
// Shared across every page. Toggles #site-nav open/closed via #nav-toggle;
// closes on link tap or Escape. No-ops if the markup isn't present.
(function () {
  const nav = document.getElementById('site-nav');
  const btn = document.getElementById('nav-toggle');
  if (!nav || !btn) return;
  const setOpen = (open) => {
    nav.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  btn.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
  // The EXPO link manages its own dropdown state (see below) — never let this
  // generic "any link tap closes the menu" handler swallow that first tap.
  nav.querySelectorAll('.nav-links a:not(.nav-expo-link), .nav-right a').forEach(a =>
    a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
})();

// ── EXPO DROPDOWN (previous years) ──────────────────
// No caret — the "EXPO ↗" link itself is the trigger, and on hover-capable
// devices the dropdown already opens via CSS :hover. But the link's own href
// points at the current year, same as the "2025 · Orbits" row inside the
// tray — so a click used to navigate straight through, which both double-ups
// with that row AND meant clicking EXPO again could never close the tray
// (you'd just be relaunched to the same site instead). The button is now a
// pure open/close toggle on every device; the tray's own year rows are the
// one real way to navigate anywhere.
(function () {
  document.querySelectorAll('.nav-expo').forEach(wrap => {
    const link = wrap.querySelector('.nav-expo-link');
    if (!link) return;
    const setOpen = (open) => {
      wrap.classList.toggle('open', open);
      link.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    link.addEventListener('click', (e) => {
      e.preventDefault();
      setOpen(!wrap.classList.contains('open'));
    });
    document.addEventListener('click', (e) => {
      if (wrap.classList.contains('open') && !wrap.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  });
})();

// ── SEARCH (nav-right) ───────────────────────────────
// Clicking "Search" expands the input in place — since it's the last item in
// a right-pinned nav-right, growing it naturally pushes the earlier buttons
// (Sound Collab / Archive / Board) left as the row reflows, no JS needed for
// that part. The label crossfades to a search icon while open. Click
// anywhere outside, or Escape, collapses it back to the labelled button.
(function () {
  const wrap  = document.getElementById('nav-search');
  const btn   = document.getElementById('nav-search-btn');
  const input = document.getElementById('nav-search-input');
  if (!wrap || !btn || !input) return;

  const nav    = document.getElementById('site-nav');
  const navBtn = document.getElementById('nav-toggle');

  const setOpen = (open) => {
    wrap.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      // On mobile the search sits in the bar rather than inside the hamburger
      // panel, so both can be open at once — and the results would then cover
      // the menu. Opening one closes the other.
      if (nav) nav.classList.remove('open');
      if (navBtn) navBtn.setAttribute('aria-expanded', 'false');
      setTimeout(() => input.focus(), 30); // wait for the width transition to start
    } else {
      input.blur();
      input.value = '';
    }
  };

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    setOpen(!wrap.classList.contains('open'));
  });

  document.addEventListener('click', (e) => {
    if (!wrap.classList.contains('open')) return;
    if (wrap.contains(e.target)) return;
    // The results panel (search.js) lives outside this wrapper but is part of
    // the same interaction — clicking its tabs must not collapse the box and
    // wipe the query out from under it.
    if (e.target.closest('#search-results')) return;
    setOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && wrap.classList.contains('open')) setOpen(false);
  });

  // search.js owns the querying; just don't let Enter submit/reload anything.
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
})();
