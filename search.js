// ── SITE SEARCH ──────────────────────────────────────────────
// Searches both halves of the site from the nav search box:
//
//   • Front-facing (static)  — Staff, Alumni, Partners, News & Events.
//     Rather than hand-maintaining an index (there's no build step here),
//     we fetch those pages once and read their cards out of the DOM, so the
//     results can never drift out of sync with the actual pages.
//
//   • Back-facing (Supabase) — Media Database, Sound Collab, Board.
//     Queried over the PostgREST endpoint directly, so pages that don't
//     already load the supabase-js library don't need to.
//
// GATING: the back-facing tables are student-only, and there are two tiers —
// the MAGI password reaches everything, the Sound Collab one reaches only the
// sound tables. Search has to mirror that exactly, or it becomes a way to read
// gated content the gate itself would refuse. So each table is queried only
// under the tier that owns it. Visitors get a note about what's excluded.
(function () {
  const wrap  = document.getElementById('nav-search');
  const input = document.getElementById('nav-search-input');
  if (!wrap || !input) return;

  const SUPA_URL = 'https://hzzhuikzvdfcizkuelte.supabase.co';
  const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6emh1aWt6dmRmY2l6a3VlbHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NDgxOTUsImV4cCI6MjA5MjMyNDE5NX0.jYE-ruAQ9c-5Q2en9G5jKcV1xWEcGsCQhSPuB5wy8d0';
  const MAGI_KEY  = 'magi-studio-auth';   // Archive + Board + Sound Collab
  const SOUND_KEY = 'magi-sound-auth';    // Sound Collab only
  const MIN_CHARS = 2;

  const has = (k) => { try { return sessionStorage.getItem(k) === '1'; } catch (e) { return false; } };
  const magiUnlocked  = () => has(MAGI_KEY);
  const soundUnlocked = () => has(MAGI_KEY) || has(SOUND_KEY);   // MAGI implies sound
  const anyUnlocked   = () => soundUnlocked();
  const esc = (s) => (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  // ── RESULTS PANEL (built here so the 9 pages don't each carry the markup) ──
  const panel = document.createElement('div');
  // `no-page-fade` opts this out of the global page fade-in (it manages its own
  // opacity). It used to borrow `modal-overlay` for that, which collided on the
  // Board — studio.html styles that class as a real dark modal backdrop, and
  // its inline <style> wins on source order, so the results panel came out
  // translucent-black and vertically centred instead of a full white sheet.
  panel.className = 'search-results no-page-fade';
  panel.id = 'search-results';
  panel.innerHTML =
    '<div class="search-results-inner">' +
      '<h1 class="search-results-title" id="sr-title"></h1>' +
      '<div class="search-tabs" id="sr-tabs"></div>' +
      '<div class="search-note" id="sr-note"></div>' +
      '<div class="search-groups" id="sr-groups"></div>' +
    '</div>';
  document.body.appendChild(panel);

  const titleEl  = panel.querySelector('#sr-title');
  const tabsEl   = panel.querySelector('#sr-tabs');
  const noteEl   = panel.querySelector('#sr-note');
  const groupsEl = panel.querySelector('#sr-groups');

  const showPanel = (on) => {
    panel.classList.toggle('open', on);
    document.body.classList.toggle('search-open', on);
  };

  // ── STATIC SOURCES ────────────────────────────────────────
  // Each page is fetched once, then read via DOMParser. `pick` maps a card
  // element to a normalised result.
  const STATIC = [
    {
      group: 'Staff', page: 'staff.html', sel: '.staff-card',
      pick: (el) => {
        const name = txt(el, '.staff-name');
        // Staff without a photo already get a hand-computed "UN"-style tile
        // on their own page (.staff-initials) — reuse that exact value
        // instead of re-deriving it, so it stays consistent with what's
        // actually shown there.
        return {
          title: name,
          kind:  txt(el, '.staff-role') || 'Staff',
          desc:  txt(el, '.staff-desc'),
          extra: [...el.querySelectorAll('.staff-tags .tag')].map(t => t.textContent).join(' '),
          thumb: src(el, '.staff-photo'),
          initials: txt(el, '.staff-initials') || initials(name),
          href:  'staff.html'
        };
      }
    },
    {
      group: 'Alumni', page: 'alumni.html', sel: '.alum',
      pick: (el) => {
        const title = txt(el, '.alum-panel-name');
        return {
          title,
          kind:  txt(el, '.alum-panel-meta') || 'Alum',
          desc:  txt(el, '.alum-panel-role'),
          // The collapsed detail (bio, roles, showcases) is in the DOM even
          // when closed, so it's searchable — someone can find an alum by a
          // project or studio name without it cluttering the result row.
          extra: txt(el, '.alum-detail-inner'),
          thumb: src(el, '.alum-hero-img'),
          initials: initials(title),
          href:  'alumni.html' + (el.id ? '#' + el.id : '')
        };
      }
    },
    {
      group: 'News & Events', page: 'latest.html', sel: 'article.article',
      pick: (el) => {
        const title = txt(el, '.article-title');
        return {
          title,
          kind:  txt(el, '.article-tag') || 'Article',
          desc:  txt(el, '.article-lead') || txt(el, '.article-body p'),
          extra: txt(el, '.article-date'),
          thumb: null,
          initials: initials(title),
          href:  'latest.html' + (el.id ? '#' + el.id : '')
        };
      }
    },
    {
      // Featured works on the home page. Only `.sel-card-btn` cards are
      // indexed — those are the ones with a real artist and write-up behind
      // them; the remaining placeholder cards would just add noise.
      group: 'Selected Works', page: 'index.html', sel: '.sel-card-btn',
      pick: (el) => {
        const title = txt(el, '.sel-title');
        // The write-up lives in a sibling panel, not inside the card, so it's
        // reached through aria-controls rather than a descendant selector.
        const panel = el.ownerDocument.getElementById(el.getAttribute('aria-controls') || '');
        return {
          title,
          kind:  txt(el, '.sel-badge') || 'Selected Work',
          desc:  panel ? txt(panel, '.sel-detail-bio') : '',
          // The row is titled by the work, so the artist and year go in extra
          // — that way searching a student's name still finds their piece.
          extra: txt(el, '.sel-student'),
          thumb: src(el, '.sel-thumb img'),
          initials: initials(title),
          href:  'index.html' + (el.id ? '#' + el.id : '#archive')
        };
      }
    },
    {
      group: 'Partners', page: 'sponsors.html', sel: '.partner',
      pick: (el) => {
        const title = txt(el, '.partner-name');
        return {
          title,
          kind:  txt(el, '.partner-kind') || 'Partner',
          desc:  txt(el, '.partner-desc'),
          extra: '',
          thumb: src(el, 'img'),
          initials: initials(title),
          href:  'sponsors.html'
        };
      }
    }
  ];

  const txt = (el, s) => { const n = el.querySelector(s); return n ? n.textContent.trim() : ''; };
  const src = (el, s) => { const n = el.querySelector(s); return n ? n.getAttribute('src') : null; };

  // Fallback for results with no photo — e.g. Uyen Nguyen on the Staff page,
  // who already gets a "UN" initials tile there instead of a picture. First
  // letter of each of the first two words, e.g. "Uyen Nguyen" → "UN",
  // "Melbourne Design Week" → "MD".
  function initials(str) {
    const words = (str || '').trim().split(/\s+/).filter(w => /^[A-Za-z]/.test(w));
    if (!words.length) return '?';
    return words.slice(0, 2).map(w => w[0].toUpperCase()).join('');
  }

  let staticCache = null;
  async function loadStatic() {
    if (staticCache) return staticCache;
    const out = [];
    await Promise.all(STATIC.map(async (srcDef) => {
      try {
        const res = await fetch(srcDef.page, { cache: 'no-cache' });
        if (!res.ok) return;
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        doc.querySelectorAll(srcDef.sel).forEach(el => {
          const item = srcDef.pick(el);
          if (item.title) out.push({ ...item, group: srcDef.group });
        });
      } catch (e) { /* a page that won't load just contributes nothing */ }
    }));
    staticCache = out;
    return out;
  }

  // ── SUPABASE SOURCES (gated) ──────────────────────────────
  const rest = async (table, cols, orFilter) => {
    const url = SUPA_URL + '/rest/v1/' + table +
      '?select=' + cols +
      '&or=' + encodeURIComponent('(' + orFilter + ')') +
      '&limit=25';
    const res = await fetch(url, { headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY } });
    if (!res.ok) throw new Error(table + ' ' + res.status);
    return res.json();
  };

  // PostgREST parses `or=(a.ilike.*x*,b.ilike.*x*)` structurally, so commas,
  // parens, dots and wildcards inside the term itself would break the filter
  // (and `&` would break the URL). Strip them — they're not meaningful search
  // input anyway — and collapse the leftover whitespace.
  const clean = (q) => q.replace(/[(),.*&%"'\\]/g, ' ').replace(/\s+/g, ' ').trim();

  const like = (q, fields) => fields.map(f => f + '.ilike.*' + q + '*').join(',');

  // Same provider-thumbnail derivation the Archive and Recent Media use.
  function archiveThumb(row) {
    const url = row.media_url || '';
    if (row.type === 'image' && url) return url;
    const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
    if (yt) return 'https://img.youtube.com/vi/' + yt[1] + '/hqdefault.jpg';
    const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vm) return 'https://vumbnail.com/' + vm[1] + '.jpg';
    return null;
  }

  async function loadLive(raw) {
    if (!anyUnlocked()) return [];
    const q = clean(raw);
    if (!q) return [];   // term was nothing but punctuation
    const out = [];

    // MAGI-only tables. A sound-design student holds SOUND_KEY alone, so these
    // stay out of their results entirely — matching what the Archive and Board
    // pages themselves would do if they walked over to them.
    const magiJobs = !magiUnlocked() ? [] : [
      rest('archive_items', '*', like(q, ['title', 'authors', 'abstract', 'source', 'spec']))
        .then(rows => rows.forEach(r => out.push({
          group: 'Media Database',
          title: r.title || 'Untitled',
          kind:  r.spec || r.type || 'Item',
          desc:  r.abstract || '',
          extra: [r.authors, r.year].filter(Boolean).join(' · '),
          thumb: archiveThumb(r),
          initials: initials(r.title),
          href:  'research.html#' + r.id
        }))),
      rest('studio_cards', '*', like(q, ['title', 'body', 'author', 'tags']))
        .then(rows => rows.forEach(r => out.push({
          group: 'Community Board',
          title: r.title || 'Untitled',
          kind:  r.type || 'Card',
          desc:  r.body || '',
          extra: [r.author, r.date].filter(Boolean).join(' · '),
          thumb: null,
          initials: initials(r.title),
          href:  'studio.html'
        })))
    ];

    // Sound tables — reachable on either tier.
    const soundJobs = [
      rest('sound_projects', '*', like(q, ['title', 'description', 'author', 'sounds_needed']))
        .then(rows => rows.forEach(r => out.push({
          group: 'Sound Collab',
          title: r.title || 'Untitled',
          kind:  'Project seeking sound',
          desc:  r.description || '',
          extra: [r.author, r.sounds_needed].filter(Boolean).join(' · '),
          thumb: r.image_url || null,
          initials: initials(r.title),
          href:  'soundcollab.html'
        }))),
      rest('sound_designers', '*', like(q, ['name', 'bio']))
        .then(rows => rows.forEach(r => out.push({
          group: 'Sound Collab',
          title: r.name || 'Untitled',
          kind:  'Sound designer',
          desc:  r.bio || '',
          extra: '',
          initials: initials(r.name),
          thumb: r.avatar_url || null,
          href:  'soundcollab.html'
        })))
    ];

    const jobs = [...magiJobs, ...soundJobs];
    // One failing table (e.g. not created yet) shouldn't sink the whole search.
    await Promise.allSettled(jobs);
    return out;
  }

  // ── MATCHING ──────────────────────────────────────────────
  // Supabase already filtered its rows server-side; this scores everything so
  // title hits outrank body hits, and filters the static half.
  // Lowercase AND strip accents, so "capicu" finds "Capicú" and "moshkina"
  // still works if someone types it with a diacritic. Names and work titles
  // here carry accents that visitors won't necessarily reproduce.
  const fold = (s) => (s == null ? '' : String(s))
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  function score(item, q) {
    const t = fold(item.title);
    const d = fold(item.desc);
    const k = fold(item.kind);
    const x = fold(item.extra);
    if (t.startsWith(q)) return 100;
    if (t.includes(q))   return 80;
    if (k.includes(q))   return 50;
    if (x.includes(q))   return 40;
    if (d.includes(q))   return 20;
    return 0;
  }

  // Doubles as a whitelist — the render and tab code both filter through it, so
  // a group missing from this list never reaches the results at all.
  const GROUP_ORDER = ['Media Database', 'News & Events', 'Selected Works', 'Alumni', 'Staff', 'Sound Collab', 'Community Board', 'Partners'];

  const CHEV = '<svg class="sr-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>';

  function rowHtml(it) {
    const label = esc(it.initials || initials(it.title));
    // data-initials lets wireThumbFallbacks() (below) swap a *broken* image
    // URL for the same tile a missing one gets — same underlying problem
    // (empty-looking thumbnail), same fix.
    const thumb = it.thumb
      ? '<div class="sr-thumb" data-initials="' + label + '"><img src="' + esc(it.thumb) + '" alt="" loading="lazy" /></div>'
      : '<div class="sr-thumb sr-thumb-initials">' + label + '</div>';
    return (
      '<a class="sr-row" href="' + esc(it.href) + '">' +
        thumb +
        '<div class="sr-body">' +
          '<div class="sr-title">' + esc(it.title) + '</div>' +
          '<div class="sr-kind">' + esc(it.kind) + '</div>' +
          (it.desc ? '<div class="sr-desc">' + esc(it.desc) + '</div>' : '') +
        '</div>' +
        CHEV +
      '</a>'
    );
  }

  let lastResults = [];
  let lastQuery = '';
  let activeTab = 'All';

  const grouped = () => {
    const g = {};
    lastResults.forEach(it => { (g[it.group] = g[it.group] || []).push(it); });
    return g;
  };

  // Groups only. Kept separate from render() so switching tabs never rebuilds
  // the tab row — see the note in the tab click handler.
  function renderGroups() {
    if (!lastResults.length) {
      groupsEl.innerHTML = '<div class="search-empty">No results for &ldquo;' + esc(lastQuery) + '&rdquo;.</div>';
      return;
    }
    const groups = grouped();
    const show = GROUP_ORDER.filter(g => groups[g] && groups[g].length)
                            .filter(g => activeTab === 'All' || g === activeTab);
    groupsEl.innerHTML = show.map(g =>
      '<section class="search-group">' +
        '<div class="search-group-head">' + esc(g) + '</div>' +
        groups[g].map(rowHtml).join('') +
      '</section>').join('');
    wireThumbFallbacks();
  }

  // A thumb URL that 404s (stale Storage link, provider still processing a
  // just-uploaded video, etc.) shouldn't leave a broken-image icon sitting in
  // the results — same fallback tile a missing thumb gets.
  function wireThumbFallbacks() {
    groupsEl.querySelectorAll('.sr-thumb img').forEach(img => {
      img.addEventListener('error', () => {
        const box = img.closest('.sr-thumb');
        if (!box) return;
        box.classList.add('sr-thumb-initials');
        box.textContent = box.dataset.initials || '?';
      }, { once: true });
    });
  }

  function render(q) {
    lastQuery = q;
    titleEl.innerHTML = 'Search results for &ldquo;' + esc(q) + '&rdquo;';

    const groups = grouped();
    const present = GROUP_ORDER.filter(g => groups[g] && groups[g].length);

    // Tabs — All + whichever groups actually matched.
    if (!present.includes(activeTab)) activeTab = 'All';
    tabsEl.innerHTML = ['All', ...present].map(g =>
      '<button class="search-tab' + (g === activeTab ? ' is-active' : '') + '" type="button" data-tab="' + esc(g) + '">' +
        esc(g) + (g === 'All' ? '' : ' <span class="search-tab-n">' + groups[g].length + '</span>') +
      '</button>').join('');

    // Three states, since access now has two tiers: fully open (MAGI), sound
    // tier only, and locked out. Each says exactly what's missing and where
    // to unlock it, rather than a generic "some things are hidden".
    const note =
      magiUnlocked()  ? '' :
      soundUnlocked() ? 'Showing public pages and Sound Collab. The Media Database and Board are ' +
                        'MAGI-only — <a href="research.html">enter the MAGI password</a> to include them.'
                      : 'Showing public pages only. The Media Database, Sound Collab and Board are ' +
                        'student-only — <a href="research.html">enter the password</a> to include them in search.';
    noteEl.innerHTML = note;
    noteEl.style.display = note ? '' : 'none';

    renderGroups();
  }

  tabsEl.addEventListener('click', (e) => {
    const b = e.target.closest('.search-tab');
    if (!b) return;

    // Rebuilding the tab row here would detach the button mid-click. Once
    // detached, `closest('#search-results')` in the document-level dismiss
    // handlers returns null — they'd read this as a click outside the panel
    // and close it. So flip the active class in place, redraw only the
    // groups, and don't let the click reach those handlers at all.
    e.stopPropagation();

    activeTab = b.dataset.tab;
    tabsEl.querySelectorAll('.search-tab').forEach(t =>
      t.classList.toggle('is-active', t.dataset.tab === activeTab));
    renderGroups();
  });

  // ── DRIVE IT ──────────────────────────────────────────────
  let seq = 0;
  async function run(q) {
    const mine = ++seq;
    const ql = fold(q);   // must match how score() folds the item fields

    groupsEl.innerHTML = '<div class="search-empty">Searching…</div>';
    titleEl.innerHTML = 'Search results for &ldquo;' + esc(q) + '&rdquo;';
    showPanel(true);

    const [stat, live] = await Promise.all([loadStatic(), loadLive(q)]);
    if (mine !== seq) return; // a newer keystroke already superseded this run

    const hits = [];
    stat.forEach(it => { const s = score(it, ql); if (s) hits.push({ ...it, _s: s }); });
    live.forEach(it => hits.push({ ...it, _s: score(it, ql) || 60 })); // already matched server-side
    hits.sort((a, b) => b._s - a._s);

    lastResults = hits;
    render(q);
  }

  let timer = null;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < MIN_CHARS) { showPanel(false); return; }
    timer = setTimeout(() => run(q), 220);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') showPanel(false);
  });

  // nav-toggle.js owns collapsing the box (its button, outside-click, Escape)
  // and clears the query when it does. Rather than duplicate all three paths
  // here — and risk them drifting apart — just follow that one piece of state:
  // box closed ⇒ results closed.
  new MutationObserver(() => {
    if (!wrap.classList.contains('open')) showPanel(false);
  }).observe(wrap, { attributes: true, attributeFilter: ['class'] });

  // Clicking the page behind the results (not the panel, not the box) dismisses.
  document.addEventListener('click', (e) => {
    if (panel.classList.contains('open') && !panel.contains(e.target) && !wrap.contains(e.target)) showPanel(false);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') showPanel(false); });
})();
