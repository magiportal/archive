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
  nav.querySelectorAll('.nav-links a, .nav-right a').forEach(a =>
    a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
})();

// ── EXPO DROPDOWN (previous years) ──────────────────
// Hover already reveals it on desktop (CSS). The caret button makes it
// click-toggleable too (desktop and — on mobile, where hover doesn't exist —
// it's the only way in, expanding as an accordion row under EXPO).
(function () {
  document.querySelectorAll('.nav-expo').forEach(wrap => {
    const caret = wrap.querySelector('.nav-expo-caret');
    if (!caret) return;
    const setOpen = (open) => {
      wrap.classList.toggle('open', open);
      caret.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    caret.addEventListener('click', (e) => {
      e.preventDefault();
      setOpen(!wrap.classList.contains('open'));
    });
    document.addEventListener('click', (e) => {
      if (wrap.classList.contains('open') && !wrap.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  });
})();
