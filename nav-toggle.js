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
