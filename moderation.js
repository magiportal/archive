/* ============================================================
   MAGI Portal — content moderation (back-facing pages)
   ------------------------------------------------------------
   Shared, client-side profanity screen used by the Community
   Board, Sound Collab, and the Archive upload.

   Model (chosen): BLOCK & EMAIL. If a submission trips the
   filter it is NOT posted — the user is shown a notice and can
   email the moderator to have it reviewed/approved.

   HONEST LIMITS: this is a client-side deterrent, not airtight
   moderation. The word list is in page source and a determined
   user could call Supabase directly. It screens the normal path
   for a known cohort — consistent with the site's soft gates.

   To tune what gets held: edit WORDS below. To change where
   flagged posts route: edit MODERATOR_EMAIL below.
   ============================================================ */
window.MAGIModeration = (function () {
  'use strict';

  const MODERATOR_EMAIL = 'adrian.frichitthavong@rmit.edu.au';

  // Offensive-language list (roots + common variants). Matched as WHOLE WORDS
  // against a de-leetspeaked copy of the text, so "Scunthorpe", "class",
  // "assign", "peacock", "tycoon" etc. do NOT false-trigger.
  const WORDS = [
    // strong profanity
    'fuck','fucks','fucked','fucking','fuckin','fucker','fuckers','fuckface','fuckwit','clusterfuck',
    'motherfucker','motherfuckers','motherfucking',
    'shit','shits','shite','shitty','shitting','shithead','shithead','shithole','bullshit','dipshit','dumbshit',
    'cunt','cunts',
    'bitch','bitches','bitching','bitchy','sonofabitch',
    'bastard','bastards',
    'asshole','assholes','arsehole','arseholes','dumbass','jackass','smartass',
    'dick','dicks','dickhead','dickheads','dickface',
    'cock','cocks','cockhead','cocksucker','cocksuckers',
    'piss','pissed','pisses','pissing',
    'prick','pricks',
    'wank','wanker','wankers','wanking',
    'bollocks',
    'twat','twats',
    'slut','sluts','slutty',
    'whore','whores','whoring',
    'skank','skanks',
    'douche','douchebag','douchebags',
    'pussy','pussies',
    // slurs (racial / ethnic / homophobic / ableist)
    'nigger','niggers','nigga','niggas',
    'faggot','faggots','fag','fags',
    'dyke','dykes',
    'tranny','trannies',
    'chink','chinks',
    'spic','spics',
    'kike','kikes',
    'wetback','wetbacks',
    'coon','coons',
    'gook','gooks',
    'paki','pakis',
    'raghead','ragheads',
    'beaner','beaners',
    'retard','retards','retarded',
  ];

  // De-leetspeak + strip non-letters to spaces, so leet ("sh1t","f@g") is caught
  // and digits/punctuation can't create or hide a match.
  function deLeet(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/[@4]/g, 'a')
      .replace(/3/g, 'e')
      .replace(/[1!|]/g, 'i')
      .replace(/0/g, 'o')
      .replace(/[$5]/g, 's')
      .replace(/7/g, 't')
      .replace(/[^a-z\s]+/g, ' ');
  }

  const SOURCE = '\\b(' + WORDS.join('|') + ')\\b';

  function termsIn(text) {
    const norm = deLeet(text);
    const re = new RegExp(SOURCE, 'gi');
    const found = new Set();
    let m;
    while ((m = re.exec(norm)) !== null) found.add(m[1].toLowerCase());
    return [...found];
  }

  // fields: [{ label, value }] → returns the subset that tripped the filter.
  function scan(fields) {
    return (fields || [])
      .map(f => ({ label: f.label, value: f.value, terms: termsIn(f.value) }))
      .filter(f => f.terms.length > 0);
  }

  // ── BLOCK MODAL (built once, self-contained) ──────────────
  let overlay;
  function ensureUI() {
    if (overlay) return overlay;

    const style = document.createElement('style');
    style.textContent =
      '.mgmod-overlay{position:fixed;inset:0;z-index:9000;display:none;align-items:center;justify-content:center;background:rgba(10,10,10,0.55);padding:20px;}' +
      '.mgmod-overlay.open{display:flex;}' +
      '.mgmod-box{background:var(--white,#fff);border:1px solid var(--line,#ccc);width:100%;max-width:440px;box-shadow:0 24px 60px rgba(0,0,0,0.3);}' +
      '.mgmod-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 22px;border-bottom:1px solid var(--line,#ccc);}' +
      ".mgmod-title{font-family:'Satoshi',sans-serif;font-size:14px;font-weight:600;color:var(--black,#0a0a0a);}" +
      '.mgmod-close{background:none;border:none;font-size:20px;line-height:1;color:var(--faint,#999);cursor:pointer;}' +
      '.mgmod-close:hover{color:var(--black,#0a0a0a);}' +
      ".mgmod-body{padding:20px 22px;font-family:'Satoshi',sans-serif;font-size:13px;line-height:1.6;color:var(--muted,#555);}" +
      '.mgmod-flag{margin-top:12px;font-size:11px;letter-spacing:0.02em;color:var(--dim,#777);}' +
      '.mgmod-flag b{color:var(--black,#0a0a0a);font-weight:600;}' +
      '.mgmod-foot{display:flex;justify-content:flex-end;gap:10px;padding:16px 22px;border-top:1px solid var(--line,#ccc);flex-wrap:wrap;}' +
      ".mgmod-btn{font-family:'Satoshi',sans-serif;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;padding:10px 16px;border:1px solid var(--line,#ccc);background:none;color:var(--muted,#555);cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;}" +
      '.mgmod-btn.primary{background:var(--black,#0a0a0a);color:var(--white,#fff);border-color:var(--black,#0a0a0a);}' +
      '.mgmod-btn.primary:hover{background:#333;}';
    document.head.appendChild(style);

    overlay = document.createElement('div');
    // `no-page-fade` keeps it out of the site's page-load fade-in rule.
    // Not `modal-overlay`: studio.html styles that name as its own backdrop,
    // including opacity:0 / pointer-events:none, which this overlay never
    // overrides (it toggles `.open`, not `.is-open`) — so on the Board the
    // dialog opened invisible and unclickable.
    overlay.className = 'mgmod-overlay no-page-fade';
    overlay.innerHTML =
      '<div class="mgmod-box">' +
        '<div class="mgmod-head"><span class="mgmod-title">Held for review</span>' +
          '<button class="mgmod-close" type="button" aria-label="Close">&times;</button></div>' +
        '<div class="mgmod-body">' +
          '<div>Your submission contains language that’s flagged for moderation, so it hasn’t been posted. ' +
          'A moderator needs to approve it. You can email the moderator with your post below, or go back and reword it.</div>' +
          '<div class="mgmod-flag" id="mgmod-flag"></div>' +
        '</div>' +
        '<div class="mgmod-foot">' +
          '<button class="mgmod-btn" type="button" id="mgmod-back">Go back &amp; edit</button>' +
          '<a class="mgmod-btn primary" id="mgmod-email" href="#">Email the moderator</a>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    const close = () => overlay.classList.remove('open');
    overlay.querySelector('.mgmod-close').addEventListener('click', close);
    overlay.querySelector('#mgmod-back').addEventListener('click', close);
    overlay.querySelector('#mgmod-email').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    return overlay;
  }

  function showBlock(context, fields, hits) {
    ensureUI();
    const labels = hits.map(h => h.label).join(', ');
    overlay.querySelector('#mgmod-flag').innerHTML = 'Flagged in: <b>' + labels.replace(/[&<>]/g, '') + '</b>';

    const subject = 'MAGI Portal — post held for review (' + context + ')';
    const body =
      'This post was flagged by the profanity filter and held for moderator approval.\n\n' +
      (fields || []).map(f => f.label + ':\n' + (f.value || '(empty)')).join('\n\n') +
      '\n\n— Submitted from ' + location.href + '\n' + new Date().toLocaleString();
    overlay.querySelector('#mgmod-email').href =
      'mailto:' + MODERATOR_EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);

    overlay.classList.add('open');
  }

  // Main entry point. Returns true if the content is clean (caller proceeds),
  // false if it was blocked (caller aborts — the block modal is shown).
  function gate(opts) {
    const hits = scan(opts && opts.fields);
    if (!hits.length) return true;
    showBlock((opts && opts.context) || 'submission', opts.fields, hits);
    return false;
  }

  return { gate, scan, MODERATOR_EMAIL };
})();
