// ── LOGO ↔ SPECIALISATION SYSTEM ─────────────────

const logoWrap  = document.getElementById('logo-wrap');
const letters   = logoWrap.querySelectorAll('.logo-letter');
const letterM   = document.getElementById('letter-m');
const letterG   = document.getElementById('letter-g');
const panels    = document.querySelectorAll('.spec-panel');
const cards     = document.querySelectorAll('.sel-card, .work-card:not(.ghost)');
const listRows  = document.querySelectorAll('#view-list .list-row:not(.head)');

function activate(spec) {
  logoWrap.setAttribute('data-active', spec);
  letters.forEach(l => {
    l.classList.toggle('is-active', l.dataset.spec === spec);
  });
  document.body.setAttribute('data-spec', spec);
  panels.forEach(p => p.classList.toggle('is-lit', p.dataset.spec === spec));
  cards.forEach(c => c.classList.toggle('dimmed', c.dataset.spec !== spec));
  listRows.forEach(r => r.classList.toggle('dimmed', r.dataset.spec !== spec));
}

function deactivate() {
  logoWrap.removeAttribute('data-active');
  letters.forEach(l => l.classList.remove('is-active'));
  document.body.removeAttribute('data-spec');
  panels.forEach(p => p.classList.remove('is-lit'));
  cards.forEach(c => c.classList.remove('dimmed'));
  listRows.forEach(r => r.classList.remove('dimmed'));
}

// All letters — full spec activation (I handled separately below)
letters.forEach(letter => {
  if (!letter.dataset.spec) return;
  if (letter.id === 'letter-i') return;
  letter.addEventListener('mouseenter', () => activate(letter.dataset.spec));
  letter.addEventListener('mouseleave', deactivate);
});

// ── M — ORIGAMI PAPER FOLD-OUT ────────────────────

const mStage = document.getElementById('m-stage');
const mFold  = document.getElementById('m-fold');

// The M-logo is a 4-column × 3-row grid. Only 10 cells contain logo
// (the bottom-middle is the empty gap between the legs). We unfold one
// panel at a time, each hinged to the previous along this snake path.
// Coords are [col, row], 0-indexed, row 0 = top.
const M_PATH = [
  [0, 2],  // col1 row3 — bottom-left (anchor)
  [0, 1],  // col1 row2  ↑
  [0, 0],  // col1 row1  ↑
  [1, 0],  // col2 row1  →
  [1, 1],  // col2 row2  ↓
  [2, 1],  // col3 row2  →
  [2, 0],  // col3 row1  ↑
  [3, 0],  // col4 row1  →
  [3, 1],  // col4 row2  ↓
  [3, 2],  // col4 row3  ↓  end (bottom-right)
];

const M_COLS  = 4;
const M_ROWS  = 3;
const M_STEP  = 150;   // ms between each panel flipping
const M_DUR   = 340;   // ms each flip takes (matches CSS transition)

let mPanels = [];      // nested chain, index matches M_PATH order

// (re)build the nested, hinged panel chain sized to the rendered M
function buildMFold() {
  if (!mStage || !mFold || !letterM) return;
  const w = letterM.clientWidth;
  const h = letterM.clientHeight;
  if (!w || !h) return;

  const cellW = w / M_COLS;
  const cellH = h / M_ROWS;

  mFold.innerHTML = '';
  mPanels = [];

  let parent = mFold;

  M_PATH.forEach(([col, row], i) => {
    const el = document.createElement('div');
    el.className = 'm-panel';

    el.style.width  = cellW + 'px';
    el.style.height = cellH + 'px';

    const bgX = -col * cellW;
    const bgY = -row * cellH;
    el.style.backgroundSize     = `${w}px ${h}px`;
    el.style.backgroundPosition = `${bgX}px ${bgY}px`;

    // silhouette mask so the crease shading follows the curves
    el.style.setProperty('--m-bg-w', `${w}px`);
    el.style.setProperty('--m-bg-h', `${h}px`);
    el.style.setProperty('--m-bg-x', `${bgX}px`);
    el.style.setProperty('--m-bg-y', `${bgY}px`);

    if (i === 0) {
      // anchor — placed at its real cell inside the fold layer
      el.style.left = (col * cellW) + 'px';
      el.style.top  = (row * cellH) + 'px';
      el.style.transform = 'none';
    } else {
      const [pCol, pRow] = M_PATH[i - 1];
      const dCol = col - pCol;
      const dRow = row - pRow;

      // position relative to the parent panel (the previous cell)
      el.style.left = (dCol * cellW) + 'px';
      el.style.top  = (dRow * cellH) + 'px';

      // hinge on the edge shared with the parent + the folded-up transform
      if (dCol === 1) {                 // child is to the RIGHT of parent
        el.style.transformOrigin = `0px ${cellH / 2}px`;
        el.dataset.fold = 'rotateY(-180deg)';
      } else if (dCol === -1) {         // LEFT
        el.style.transformOrigin = `${cellW}px ${cellH / 2}px`;
        el.dataset.fold = 'rotateY(180deg)';
      } else if (dRow === 1) {          // BELOW
        el.style.transformOrigin = `${cellW / 2}px 0px`;
        el.dataset.fold = 'rotateX(180deg)';
      } else {                          // ABOVE (dRow === -1)
        el.style.transformOrigin = `${cellW / 2}px ${cellH}px`;
        el.dataset.fold = 'rotateX(-180deg)';
      }
      el.style.transform = 'none';      // start flat (full M at rest)
    }

    parent.appendChild(el);
    mPanels.push(el);
    parent = el;                        // nest the next panel inside this one
  });
}

let mTimers = [];
let mFolding = false;

function clearMTimers() {
  mTimers.forEach(clearTimeout);
  mTimers = [];
}

function playMFold() {
  if (!mPanels.length) buildMFold();
  if (!mPanels.length || mFolding) return;
  mFolding = true;
  clearMTimers();

  // swap the resting <img> for the panel layer for the duration of the fold
  mStage.classList.add('folding');

  const last = mPanels.length - 1;

  // PHASE A — fold up into the bottom-left, deepest panel first
  for (let i = last; i >= 1; i--) {
    const el = mPanels[i];
    const order = last - i;               // 0,1,2… in fold-in sequence
    mTimers.push(setTimeout(() => {
      el.classList.add('is-creasing');
      el.style.transform = el.dataset.fold;
    }, order * M_STEP));
    mTimers.push(setTimeout(() => el.classList.remove('is-creasing'),
                            order * M_STEP + M_DUR));
  }

  const foldInTime = (last - 1) * M_STEP + M_DUR + 120;  // +gap before unfolding

  // PHASE B — unfold one by one along the path, anchor outward
  for (let i = 1; i <= last; i++) {
    const el = mPanels[i];
    const order = i - 1;
    mTimers.push(setTimeout(() => {
      el.classList.add('is-creasing');
      el.style.transform = 'none';
    }, foldInTime + order * M_STEP));
    mTimers.push(setTimeout(() => el.classList.remove('is-creasing'),
                            foldInTime + order * M_STEP + M_DUR));
  }

  const total = foldInTime + (last - 1) * M_STEP + M_DUR + 40;
  mTimers.push(setTimeout(() => {
    mFolding = false;
    mStage.classList.remove('folding');   // back to the crisp resting <img>
  }, total));
}

if (mStage) {
  if (letterM.complete) buildMFold();
  else letterM.addEventListener('load', buildMFold);

  let mResize;
  window.addEventListener('resize', () => {
    if (mFolding) return;               // don't rebuild mid-animation
    clearTimeout(mResize);
    mResize = setTimeout(buildMFold, 150);
  });

  mStage.addEventListener('click', playMFold);
}

// ── G — DRAGGABLE WITH PHYSICS ────────────────────

let gX = 0, gY = 0;
let gVX = 0, gVY = 0;
let gTargetX = 0, gTargetY = 0;
let isDragging = false;
let dragStartX = 0, dragStartY = 0;
let rafId = null;
let gHovered = false;

const DRAG_LERP   = 0.055;
const SPRING_K    = 0.055;
const DAMPING     = 0.82;
const SNAP_THRESH = 0.4;

function applyG() {
  const tilt = Math.max(-22, Math.min(22, gVX * 3.5));
  const hoverX = (!isDragging && gHovered) ? 5 : 0;
  letterG.style.transform = `translate(${gX + hoverX}px, ${gY}px) rotate(${tilt}deg)`;
}

function dragLoop() {
  if (!isDragging) return;
  const dx = gTargetX - gX;
  const dy = gTargetY - gY;
  gVX = dx * DRAG_LERP;
  gVY = dy * DRAG_LERP;
  gX += gVX;
  gY += gVY;
  applyG();
  rafId = requestAnimationFrame(dragLoop);
}

function snapLoop() {
  const forceX = -gX * SPRING_K;
  const forceY = -gY * SPRING_K;
  gVX = (gVX + forceX) * DAMPING;
  gVY = (gVY + forceY) * DAMPING;
  gX += gVX;
  gY += gVY;
  applyG();

  const stillMoving = Math.abs(gX) > SNAP_THRESH || Math.abs(gY) > SNAP_THRESH
                   || Math.abs(gVX) > 0.05 || Math.abs(gVY) > 0.05;

  if (stillMoving) {
    rafId = requestAnimationFrame(snapLoop);
  } else {
    gX = 0; gY = 0; gVX = 0; gVY = 0;
    letterG.style.transform = '';
    letterG.classList.remove('is-dragging');
    letterG.style.transition = '';
  }
}

letterG.addEventListener('mouseenter', () => { gHovered = true; });
letterG.addEventListener('mouseleave', () => {
  gHovered = false;
  if (isDragging) return;
});

letterG.addEventListener('mousedown', e => {
  e.preventDefault();
  isDragging = true;
  cancelAnimationFrame(rafId);
  dragStartX = e.clientX - gX;
  dragStartY = e.clientY - gY;
  letterG.classList.add('is-dragging');
  letterG.style.transition = 'filter 0.25s ease, opacity 0.25s ease';
  activate('games');
  dragLoop();
});

document.addEventListener('mousemove', e => {
  if (!isDragging) return;
  gTargetX = e.clientX - dragStartX;
  gTargetY = e.clientY - dragStartY;
});

document.addEventListener('mouseup', () => {
  if (!isDragging) return;
  isDragging = false;
  cancelAnimationFrame(rafId);
  deactivate();
  rafId = requestAnimationFrame(snapLoop);
});

// ── LETTER I — TITTLE INTERACTION ────────────────

const letterI       = document.getElementById('letter-i');
const letterIWrap   = document.getElementById('letter-i-wrap');
const iContainer    = letterIWrap.querySelector('.letter-i-container');
const scoreEl       = document.getElementById('tittle-score');
const hero          = document.querySelector('.hero');

let tittle          = null;
let tittleActive    = false;
let tittleX         = 0;
let tittleY         = 0;
let tittleVX        = 0;
let tittleVY        = 0;
let tittleRaf       = null;
let score           = 0;
let hasHitFloor     = false;

const GRAVITY       = 0.35;
const BOUNCE        = 0.62;
const FRICTION      = 0.985;

function updateScore(n, lost) {
  score = n;
  if (lost) {
    scoreEl.textContent = score > 0 ? `${score} ✕` : '';
    scoreEl.classList.add('visible', 'lost');
  } else if (score > 0) {
    scoreEl.textContent = score.toString();
    scoreEl.classList.add('visible');
    scoreEl.classList.remove('lost');
  } else {
    scoreEl.classList.remove('visible', 'lost');
  }
}

function resetScore() {
  score = 0;
  hasHitFloor = false;
  scoreEl.textContent = '';
  scoreEl.classList.remove('visible', 'lost');
}

function spawnTittle() {
  const isFirstSpawn = !tittle;

  if (!tittle) {
    tittle = document.createElement('div');
    tittle.className = 'tittle-ball';
    document.body.appendChild(tittle);

    // only the ball itself bounces on click
    tittle.addEventListener('click', e => {
      e.stopPropagation();
      if (!tittleActive) return;
      // only score if ball hasn't hit the floor since last bounce
      if (!hasHitFloor) {
        updateScore(score + 1, false);
      } else {
        // hit floor already — reset streak and start fresh
        hasHitFloor = false;
        updateScore(1, false);
      }
      cancelAnimationFrame(tittleRaf);
      tittleVX = (Math.random() - 0.5) * 12;
      tittleVY = -(7 + Math.random() * 6);
      tittleActive = true;
      bounceTittle();
    });
  }

  // always start from the I when hidden (first spawn or after retract)
  if (isFirstSpawn || tittle.style.display === 'none') {
    const iRect = letterI.getBoundingClientRect();
    tittleX = iRect.left + iRect.width * 0;
    tittleY = iRect.top  - 10;
    tittle.style.left = tittleX + 'px';
    tittle.style.top  = tittleY + 'px';
  }

  tittle.style.display = 'block';

  // initial kick from I
  tittleVX = (Math.random() - 0.5) * 8;
  tittleVY = -(6 + Math.random() * 5);
  tittleActive = true;

  cancelAnimationFrame(tittleRaf);
  bounceTittle();
}

function retractTittle() {
  if (!tittle) return;
  cancelAnimationFrame(tittleRaf);
  tittleActive = false;

  const SPRING          = 0.022;
  const RETRACT_DAMPING = 0.88;

  function retractLoop() {
    const iRect   = letterI.getBoundingClientRect();
    const targetX = iRect.left + iRect.width * 0;
    const targetY = iRect.top  - 10;

    // spring force toward I
    tittleVX += (targetX - tittleX) * SPRING;
    tittleVY += (targetY - tittleY) * SPRING;

    // damping
    tittleVX *= RETRACT_DAMPING;
    tittleVY *= RETRACT_DAMPING;

    tittleX += tittleVX;
    tittleY += tittleVY;

    tittle.style.left = tittleX + 'px';
    tittle.style.top  = tittleY + 'px';

    const dist = Math.sqrt(
      (targetX - tittleX) ** 2 + (targetY - tittleY) ** 2
    );
    const speed = Math.sqrt(tittleVX ** 2 + tittleVY ** 2);

    if (dist < 1.5 && speed < 0.5) {
      tittle.style.display = 'none';
      tittleX = targetX;
      tittleY = targetY;
      tittleVX = 0;
      tittleVY = 0;
      iContainer.classList.remove('decapitated');
      resetScore();
      return;
    }

    tittleRaf = requestAnimationFrame(retractLoop);
  }

  tittleRaf = requestAnimationFrame(retractLoop);
}

function bounceTittle() {
  if (!tittleActive) return;

  // refresh hero bounds each frame in case of scroll
  const heroRect = hero.getBoundingClientRect();
  const tw = tittle.offsetWidth  || 52;
  const th = tittle.offsetHeight || 52;

  const minX = heroRect.left;
  const maxX = heroRect.right  - tw;
  const minY = heroRect.top;
  const maxY = heroRect.bottom - th;

  tittleVY += GRAVITY;
  tittleVX *= FRICTION;

  tittleX += tittleVX;
  tittleY += tittleVY;

  // floor bounce
  if (tittleY >= maxY) {
    tittleY  = maxY;
    tittleVY = -Math.abs(tittleVY) * BOUNCE;
    tittleVX *= 0.9;
    if (Math.abs(tittleVY) < 0.8) tittleVY = 0;
    // hitting the floor loses the streak
    if (!hasHitFloor && score > 0) {
      hasHitFloor = true;
      updateScore(score, true);
    }
  }

  // ceiling
  if (tittleY <= minY) {
    tittleY  = minY;
    tittleVY = Math.abs(tittleVY) * BOUNCE;
  }

  // left wall
  if (tittleX <= minX) {
    tittleX  = minX;
    tittleVX = Math.abs(tittleVX) * BOUNCE;
  }

  // right wall
  if (tittleX >= maxX) {
    tittleX  = maxX;
    tittleVX = -Math.abs(tittleVX) * BOUNCE;
  }

  tittle.style.left = tittleX + 'px';
  tittle.style.top  = tittleY + 'px';

  tittleRaf = requestAnimationFrame(bounceTittle);
}

// click the I — first click decapitates, subsequent clicks retract the ball back
iContainer.addEventListener('click', e => {
  e.stopPropagation();

  if (!iContainer.classList.contains('decapitated')) {
    // first click — decapitate and launch
    iContainer.classList.add('decapitated');
    spawnTittle();
  } else {
    // already decapitated — retract ball back to I
    retractTittle();
  }
});

// keep hover/spec activation on the img itself
letterI.addEventListener('mouseenter', () => activate('interactivity'));
letterI.addEventListener('mouseleave', deactivate);

// ── LOGO INTERACTION HINTS ────────────────────────
// subtle "click me" / "drag me" nudges so users discover each letter's trick

const hintConfig = [
  { el: letterM,                              text: 'click me!' },
  { el: document.getElementById('letter-a'),  text: 'hover me!' },
  { el: letterG,                              text: 'drag me!'  },
  { el: letterI,                              text: 'click me!' },
].filter(item => item.el);

let hintsStopped  = false;
let hintTimeoutId = null;
const hintEls     = new Map();   // wrap -> { el, timer }

function getHintEl(wrap) {
  let entry = hintEls.get(wrap);
  if (!entry) {
    const el = document.createElement('div');
    el.className = 'logo-hint';
    wrap.appendChild(el);
    entry = { el, timer: null };
    hintEls.set(wrap, entry);
  }
  return entry;
}

function showHint(item, duration = 2800) {
  if (hintsStopped || !item.el) return;
  const wrap = item.el.closest('.letter-wrap');
  if (!wrap) return;
  const entry = getHintEl(wrap);
  entry.el.textContent = item.text;
  entry.el.classList.remove('show');
  void entry.el.offsetWidth;          // restart the pop/bob
  entry.el.classList.add('show');
  clearTimeout(entry.timer);
  entry.timer = setTimeout(() => entry.el.classList.remove('show'), duration);
}

function stopHints() {
  if (hintsStopped) return;
  hintsStopped = true;
  clearTimeout(hintTimeoutId);
  hintEls.forEach(entry => {
    clearTimeout(entry.timer);
    entry.el.classList.remove('show');
  });
}

// the moment the user engages the logo, they've got it — stop nudging
logoWrap.addEventListener('pointerdown', stopHints);
hintConfig.forEach(item => {
  // hide a letter's own hint as soon as it's hovered
  item.el.addEventListener('mouseenter', () => {
    const wrap = item.el.closest('.letter-wrap');
    const entry = wrap && hintEls.get(wrap);
    if (entry) { clearTimeout(entry.timer); entry.el.classList.remove('show'); }
  });
});

// gentle recurring nudge on a random letter, every now and then
function scheduleNextHint(delay) {
  hintTimeoutId = setTimeout(() => {
    if (hintsStopped) return;
    if (!document.hidden) {
      const item = hintConfig[Math.floor(Math.random() * hintConfig.length)];
      showHint(item);
    }
    scheduleNextHint(11000 + Math.random() * 9000);   // ~11–20s apart
  }, delay);
}

// first-time visitors get a one-by-one intro across the letters
function introHints() {
  hintConfig.forEach((item, i) => {
    setTimeout(() => showHint(item, 3200), 1400 + i * 1700);
  });
}

(function initHints() {
  if (!hintConfig.length) return;
  let firstTime = true;
  try { firstTime = !localStorage.getItem('magi_logo_hinted'); } catch (e) {}

  if (firstTime) {
    introHints();
    try { localStorage.setItem('magi_logo_hinted', '1'); } catch (e) {}
    scheduleNextHint(1400 + hintConfig.length * 1700 + 6000);
  } else {
    scheduleNextHint(7000);
  }
})();

// ── GALLERY RANDOMISE ─────────────────────────────

const galleryPool = [
  { src: 'media/4178055-saros.webp',                              label: 'Research',     title: 'Saros',                              student: 'Student Name — 2025' },
  { src: 'media/s3588979-days-days.webp',                         label: 'Animation',    title: 'Days Days',                          student: 'Student Name — 2025' },
  { src: 'media/s3606172-edwin-earstwhile-medical-examiner.webp', label: 'Animation',    title: 'Edwin Earnswhile, Medical Examiner', student: 'Student Name — 2025' },
  { src: 'media/s3634079-remnants-of-our-days.webp',              label: 'Games',        title: 'Remnants of Our Days',               student: 'Student Name — 2026' },
  { src: 'media/s3836345-bleaching.webp',                         label: 'Animation',    title: 'Bleaching',                          student: 'Student Name — 2025' },
  { src: 'media/s3836345-no-glisten.webp',                        label: 'Animation',    title: 'No Glisten',                         student: 'Student Name — 2025' },
  { src: 'media/S3902619-planet-body.webp',                       label: 'Interactivity',title: 'Planet Body',                        student: 'Student Name — 2025' },
  { src: 'media/s4017090-love-in-the-form-of-an-egg.webp',        label: 'Animation',    title: 'Love in the Form of an Egg',         student: 'Student Name — 2025' },
  { src: 'media/S4078320-tethered-thoughts.webp',                 label: 'Interactivity',title: 'Tethered Thoughts',                  student: 'Student Name — 2025' },
  { src: 'media/s4120309-te-hkoi.webp',                           label: 'Animation',    title: 'Te Hkoi',                            student: 'Student Name — 2025' },
  { src: 'media/S4125361-bunny-flip.webp',                        label: 'Animation',    title: 'Bunny Flip',                         student: 'Student Name — 2025' },
  { src: 'media/s4148098-a-late-bloomer.webp',                    label: 'Animation',    title: 'A Late Bloomer',                     student: 'Student Name — 2025' },
  { src: 'media/s4148098-hidden-joy.webp',                        label: 'Animation',    title: 'Hidden Joy',                         student: 'Student Name — 2025' },
  { src: 'media/s4148738-mind-tilt.webp',                         label: 'Games',        title: 'Mind Tilt',                          student: 'Student Name — 2025' },
  { src: 'media/s4155379-sleep-paralysis.webp',                   label: 'Animation',    title: 'Sleep Paralysis',                    student: 'Student Name — 2025' },
  { src: 'media/s4160763-other-names-for-zombies-art-book.webp',  label: 'Animation',    title: 'Other Names for Zombies',            student: 'Student Name — 2025' },
  { src: 'media/s4160763-thick-hands.webp',                       label: 'Interactivity',title: 'Thick Hands',                        student: 'Student Name — 2025' },
  { src: 'media/S4160839-heyyou.webp',                            label: 'Interactivity',title: 'Hey You',                            student: 'Student Name — 2025' },
  { src: 'media/s4174970-notrealpizza.webp',                      label: 'Games',        title: 'Not Real Pizza',                     student: 'Student Name — 2025' },
  { src: 'media/S4183453-state-of-mind.webp',                     label: 'Animation',    title: 'State of Mind',                      student: 'Student Name — 2025' },
  { src: 'media/s4210724-natures-influence.webp',                 label: 'Research',     title: "Nature's Influence",                 student: 'Student Name — 2025' },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

(function buildGallery() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;
  const picked = shuffle(galleryPool).slice(0, 8);
  picked.forEach((item, i) => {
    const el = document.createElement('div');
    el.className = 'gallery-item' + (i === 7 ? ' gallery-item-full' : '');
    el.innerHTML = `
      <img src="${item.src}" alt="${item.title}" />
      <div class="gallery-overlay">
        <div class="gallery-item-label">${item.label}</div>
        <div class="gallery-item-title">${item.title}</div>
        <div class="gallery-item-student">${item.student}</div>
      </div>`;
    grid.appendChild(el);
  });

  // track which images are currently shown
  const shown = new Set(picked.map(i => i.src));

  function swapRandomItem() {
    const items = grid.querySelectorAll('.gallery-item');
    // pick a random non-full-width slot to swap
    const candidates = Array.from(items).filter(el => !el.classList.contains('gallery-item-full'));
    const target = candidates[Math.floor(Math.random() * candidates.length)];

    // pick a random image not currently shown
    const available = galleryPool.filter(i => !shown.has(i.src));
    if (!available.length) return;
    const next = available[Math.floor(Math.random() * available.length)];

    // fade out
    target.style.transition = 'opacity 0.8s ease';
    target.style.opacity = '0';

    setTimeout(() => {
      // update shown set
      const oldSrc = target.querySelector('img').src.split('/').pop();
      shown.delete(target.querySelector('img').getAttribute('src'));

      // swap content
      target.querySelector('img').src = next.src;
      target.querySelector('img').alt = next.title;
      target.querySelector('.gallery-item-label').textContent = next.label;
      target.querySelector('.gallery-item-title').textContent = next.title;
      target.querySelector('.gallery-item-student').textContent = next.student;
      shown.add(next.src);

      // fade back in
      target.style.opacity = '1';

      // schedule next swap — between 8 and 18 seconds
      scheduleSwap();
    }, 800);
  }

  function scheduleSwap() {
    const delay = 8000 + Math.random() * 10000;
    setTimeout(swapRandomItem, delay);
  }

  // kick off the first swap after an initial delay
  scheduleSwap();
})();

// ── FILTER TABS ───────────────────────────────────

const filterBtns = document.querySelectorAll('.filter-btn');

filterBtns.forEach(btn => {
  btn.addEventListener('click', function () {
    filterBtns.forEach(b => b.classList.remove('active'));
    this.classList.add('active');

    const filter = this.dataset.filter;

    cards.forEach(c => {
      const match = filter === 'all' || c.dataset.spec === filter;
      c.style.display = match ? '' : 'none';
    });

    listRows.forEach(r => {
      const match = filter === 'all' || r.dataset.spec === filter;
      r.style.display = match ? '' : 'none';
    });
  });
});

// ── NAV TABS ──────────────────────────────────────

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', function () {
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    this.classList.add('active');
  });
});