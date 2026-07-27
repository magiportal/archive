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

// ── TOUCH: tap a letter to light its specialisation ───────────────
// Touch devices have no hover, so the whole logo↔spec system felt dead on
// mobile. Tapping a letter now toggles its spec (and dims the rest); tapping
// again, or anywhere outside the logo, clears it. Additive — the existing
// flourish handlers (M-fold, A-shatter, I-game) still fire on tap too.
if (window.matchMedia('(hover: none)').matches) {
  letters.forEach(letter => {
    if (!letter.dataset.spec) return;
    letter.addEventListener('click', () => {
      const active = logoWrap.getAttribute('data-active');
      if (active === letter.dataset.spec) deactivate();
      else activate(letter.dataset.spec);
    });
  });
  document.addEventListener('click', (e) => {
    if (logoWrap.hasAttribute('data-active') && !e.target.closest('#logo-wrap')) deactivate();
  });
}

// ── A — SHATTER INTO A 3×3 JENGA STACK ───────────
const letterA = document.getElementById('letter-a');
let aShattered = false;

if (letterA) {
  letterA.style.cursor = 'pointer';
  letterA.addEventListener('click', shatterA);
}

function shatterA() {
  if (aShattered) return;
  if (typeof Matter === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const hero = document.querySelector('.hero');
  if (!hero) return;
  aShattered = true;

  const { Engine, Runner, Bodies, Body, Composite, Mouse, MouseConstraint } = Matter;

  const heroRect = hero.getBoundingClientRect();
  const aRect    = letterA.getBoundingClientRect();
  const W  = heroRect.width;
  const Hh = heroRect.height;
  const pieceW = aRect.width / 3;
  const pieceH = aRect.height / 3;
  const ax = aRect.left - heroRect.left;
  const ay = aRect.top  - heroRect.top;

  // land on the same floor the I-logo ball drops to (the hero's bottom edge)
  const groundY = Hh;

  // playground layer inside the hero
  const layer = document.createElement('div');
  layer.className = 'a-shatter-layer';
  hero.appendChild(layer);

  // hide the original A but keep its slot in the wordmark
  letterA.style.opacity = '0';

  const engine = Engine.create();
  engine.gravity.y = 1;

  const pieces = [];
  const bodies = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (r === 1 && c === 1) continue; // center tile is empty in the A
      const cx = ax + c * pieceW + pieceW / 2;
      const cy = ay + r * pieceH + pieceH / 2;

      const piece = document.createElement('div');
      piece.className = 'a-piece';
      piece.style.width  = pieceW + 'px';
      piece.style.height = pieceH + 'px';
      piece.style.backgroundImage = "url('A-logo.png')";
      piece.style.backgroundSize  = aRect.width + 'px ' + aRect.height + 'px';
      piece.style.backgroundPosition = (-c * pieceW) + 'px ' + (-r * pieceH) + 'px';
      layer.appendChild(piece);
      pieces.push(piece);

      const body = Bodies.rectangle(cx, cy, pieceW, pieceH, {
        restitution: 0.2,
        friction: 0.8,
        frictionStatic: 3,
        density: 0.002
      });
      // little outward "break" impulse
      Body.setVelocity(body, { x: (c - 1) * 1.8 + (Math.random() - 0.5), y: -2 - Math.random() * 2 });
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.14);
      bodies.push(body);
    }
  }

  const wall = { isStatic: true };
  const ground = Bodies.rectangle(W / 2, groundY + 30, W * 2, 60, wall);
  const leftW  = Bodies.rectangle(-30, Hh / 2, 60, Hh * 3, wall);
  const rightW = Bodies.rectangle(W + 30, Hh / 2, 60, Hh * 3, wall);
  Composite.add(engine.world, [...bodies, ground, leftW, rightW]);

  // drag-to-stack
  const mouse = Mouse.create(layer);
  const mc = MouseConstraint.create(engine, {
    mouse,
    constraint: { stiffness: 0.2, render: { visible: false } }
  });
  Composite.add(engine.world, mc);
  // let the page keep scrolling over the hero
  if (mouse.mousewheel) {
    layer.removeEventListener('wheel', mouse.mousewheel);
    layer.removeEventListener('mousewheel', mouse.mousewheel);
    layer.removeEventListener('DOMMouseScroll', mouse.mousewheel);
  }

  // reset hotspot where the A used to be
  const hotspot = document.createElement('div');
  hotspot.className = 'a-reset-hotspot';
  hotspot.style.left   = ax + 'px';
  hotspot.style.top    = ay + 'px';
  hotspot.style.width  = aRect.width + 'px';
  hotspot.style.height = aRect.height + 'px';
  hotspot.innerHTML = '<span>↺</span>';
  hotspot.title = 'Put the A back';
  layer.appendChild(hotspot);

  const runner = Runner.create();
  Runner.run(runner, engine);

  let rafId;
  (function sync() {
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      pieces[i].style.transform =
        'translate(' + (b.position.x - pieceW / 2) + 'px,' + (b.position.y - pieceH / 2) + 'px) rotate(' + b.angle + 'rad)';
    }
    rafId = requestAnimationFrame(sync);
  })();

  hotspot.addEventListener('click', () => {
    cancelAnimationFrame(rafId);
    Runner.stop(runner);
    Composite.clear(engine.world, false);
    Engine.clear(engine);
    layer.remove();
    letterA.style.opacity = '';
    aShattered = false;
  });
}

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
  { el: letterA,                              text: 'click me!' },
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

  // Now that hover can trigger this directly, sweeping the cursor across a
  // couple of letters quickly could otherwise leave two bubbles up at once —
  // only the letter under the cursor should ever be showing.
  hintEls.forEach((otherEntry, otherWrap) => {
    if (otherWrap === wrap) return;
    clearTimeout(otherEntry.timer);
    otherEntry.el.classList.remove('show');
  });

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

// Feedback: people were hovering the letters and not realising they were
// interactive at all — the ambient nudge above is a random letter every
// 11–20s, so it easily never lands on the one someone's actually looking at.
// Hovering now shows that letter's own hint immediately instead of waiting
// for its turn in the queue. Clicking still dismisses everything via
// stopHints() above (pointerdown is on the whole logoWrap, so it fires
// regardless of which letter — no separate handling needed here).
hintConfig.forEach(item => {
  item.el.addEventListener('mouseenter', () => showHint(item));
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

// w/h are each file's real pixel dimensions. They're written onto the <img> as
// width/height attributes so the browser can reserve the right space before the
// picture downloads — without them a masonry column starts at zero height and
// visibly reflows as each image arrives. They do NOT constrain the display size
// (the CSS is width:100% / height:auto), they only establish the ratio.
// If you swap a file for one of different proportions, update these too.
const galleryPool = [
  { src: 'media/4178055-saros.webp'                             , w: 1194, h:  670, label: 'Research',      title: 'Saros',                              student: 'Sofia Moshkina',          year: 2025, url: 'https://www.behance.net/gallery/235390509/Animation-Portfolio' },
  { src: 'media/s3588979-days-days.webp'                        , w: 1920, h: 1080, label: 'Animation',     title: 'Days & Days',                        student: 'Olivia Sagona',           year: 2025, url: 'https://YIBBLET.com' },
  { src: 'media/s3606172-edwin-earstwhile-medical-examiner.webp', w: 1879, h: 1056, label: 'Animation',     title: 'Edwin Earstwhile: Medical Examiner', student: 'Callum Page',             year: 2025, url: 'https://store.steampowered.com/app/2277090/DAEMON_MASQUERADE/' },
  { src: 'media/s3634079-remnants-of-our-days.webp'             , w: 1920, h: 1080, label: 'Games',         title: 'Remnants of Our Days',               student: 'Linh Thảo Trần (Thea)',   year: 2025, url: 'https://readymag.website/u2780171938/5437788/' },
  { src: 'media/s3836345-bleaching.webp'                        , w: 1920, h: 1080, label: 'Animation',     title: 'Bleaching',                          student: 'Nguyen Thao Nguyen',      year: 2025, url: 'https://www.itsnhim.com/' },
  { src: 'media/s3836345-no-glisten.webp'                       , w: 3840, h: 2160, label: 'Animation',     title: 'No Glisten',                         student: 'Nguyen Thao Nguyen',      year: 2025, url: 'https://www.itsnhim.com/' },
  // Submitted portfolio https://Thereselah.com is dead (Squarespace subscription
  // expired — the domain resolves but every path 404s), so this one stays
  // credited but unlinked until a working URL turns up.
  { src: 'media/S3902619-planet-body.webp'                      , w: 1600, h:  900, label: 'Interactivity', title: 'Planet Body',                        student: 'Holly Therese',           year: 2025, url: '' },
  { src: 'media/s4017090-love-in-the-form-of-an-egg.webp'       , w: 1890, h: 1074, label: 'Animation',     title: 'Love in the Form of an Egg',         student: 'Connie Hsueh',            year: 2025, url: 'https://hsuehconnie.wixsite.com/cononoanimation' },
  { src: 'media/S4078320-tethered-thoughts.webp'                , w:  915, h:  515, label: 'Interactivity', title: 'Tethered Thoughts',                  student: 'Felicia Xiao',            year: 2025, url: 'https://www.fx-arts.com' },
  { src: 'media/s4120309-te-hkoi.webp'                          , w: 1526, h:  858, label: 'Animation',     title: 'Te Hīkoi',                           student: 'Lewis Brewer',            year: 2025, url: 'https://www.lewisbrewer.com' },
  { src: 'media/S4125361-bunny-flip.webp'                       , w: 2880, h: 1620, label: 'Animation',     title: 'Bunny Flip',                         student: 'Patricia Abigail Wijaya', year: 2025, url: 'https://www.artstation.com/reinnx7' },
  { src: 'media/s4148098-a-late-bloomer.webp'                   , w: 1920, h: 1080, label: 'Animation',     title: 'A Late Bloomer',                     student: 'Jit Thong (Jade) Ng',     year: 2025, url: 'https://www.behance.net/gallery/207650239/Animation-Artworks-Portfolio-Ng-Jit-Thong' },
  { src: 'media/s4148098-hidden-joy.webp'                       , w:  800, h:  450, label: 'Animation',     title: 'Hidden Joy',                         student: 'Jit Thong (Jade) Ng',     year: 2025, url: 'https://www.behance.net/gallery/207650239/Animation-Artworks-Portfolio-Ng-Jit-Thong' },
  { src: 'media/s4148738-mind-tilt.webp'                        , w: 1778, h: 1000, label: 'Games',         title: 'Mind Tilt',                          student: 'Zhefeng Wang (Daniel)',   year: 2025, url: 'https://www.linkedin.com/in/zhefeng-wang-61171b220/' },
  { src: 'media/s4155379-sleep-paralysis.webp'                  , w: 2750, h: 1547, label: 'Animation',     title: 'Sleep Paralysis',                    student: 'Jahanvi Borkar',          year: 2025, url: 'https://janhviborkar8.artstation.com/' },
  { src: 'media/s4160763-other-names-for-zombies-art-book.webp' , w: 1845, h: 1029, label: 'Animation',     title: 'Other Names for Zombies',            student: 'Rachel Roberts',          year: 2025, url: 'https://www.youtube.com/@sixofcloversanimation' },
  { src: 'media/s4160763-thick-hands.webp'                      , w: 1845, h: 1029, label: 'Interactivity', title: 'Thick Hands',                        student: 'Rachel Roberts',          year: 2025, url: 'https://www.youtube.com/@sixofcloversanimation' },
  { src: 'media/S4160839-heyyou.webp'                           , w: 1920, h: 1080, label: 'Interactivity', title: 'HeyYou!',                            student: 'Henry Voon',              year: 2025, url: 'https://henryvoon.artstation.com/' },
  { src: 'media/s4174970-notrealpizza.webp'                     , w: 1920, h: 1080, label: 'Games',         title: '#NotRealPizza',                      student: 'Pannita Khanngern',       year: 2025, url: 'https://www.instagram.com/okpitato/' },
  { src: 'media/S4183453-state-of-mind.webp'                    , w: 1920, h: 1080, label: 'Animation',     title: 'State of Mind',                      student: 'Cheren Hurst',            year: 2025, url: 'https://www.instagram.com/cherenhurst/' },
  // Submitted portfolio https://suffixx.portfoliobox.net no longer exists
  // ("The website was not found" from Portfoliobox), so unlinked for now.
  { src: 'media/s4210724-natures-influence.webp'                , w: 4080, h: 3072, label: 'Research',      title: "Nature's Influence",                 student: 'Sarah Cohen',             year: 2025, url: '' },
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

  const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const escText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const ratioOf = (item) => (item.w && item.h) ? item.w / item.h : null;
  const creditOf = (item) => [item.student, item.year].filter(Boolean).join(' — ');

  // 9 fills three masonry columns evenly; the tail is uneven at 8.
  const picked = shuffle(galleryPool).slice(0, 9);

  // Drives the label chip's colour in CSS — same four values the rest of the
  // site keys its category colours off (see .gallery-item[data-spec] there).
  const specOf = (item) => String(item.label || '').toLowerCase();

  // Points a tile at a work's portfolio, or makes it inert if that work has
  // none. Always an <a>: an anchor without href behaves like plain text and
  // isn't focusable, and keeping the element type fixed means a swap can add
  // or remove the link without rebuilding the tile.
  function applyLink(el, item) {
    if (item.url) {
      el.href = item.url;
      el.target = '_blank';
      // noopener stops the opened tab reaching back through window.opener.
      el.rel = 'noopener noreferrer';
      el.setAttribute('aria-label', `${item.title} by ${item.student} — opens portfolio in a new tab`);
    } else {
      el.removeAttribute('href');
      el.removeAttribute('target');
      el.removeAttribute('rel');
      el.removeAttribute('aria-label');
    }
  }

  picked.forEach((item, i) => {
    const el = document.createElement('a');
    el.className = 'gallery-item';
    el.dataset.spec = specOf(item);
    applyLink(el, item);
    // The first few are above the fold on most screens, so only lazy-load the
    // rest — lazy-loading everything delays the images that are visible
    // immediately.
    const loading = i < 3 ? 'eager' : 'lazy';
    el.innerHTML = `
      <div class="gallery-item-media">
        <img src="${escAttr(item.src)}" alt="${escAttr(item.title)}"
             width="${item.w || ''}" height="${item.h || ''}" loading="${loading}" decoding="async" />
      </div>
      <div class="gallery-item-label">${escText(item.label)}</div>
      <div class="gallery-item-title">${escText(item.title)}</div>
      <div class="gallery-item-student">${escText(creditOf(item))}</div>`;
    grid.appendChild(el);
  });

  // Which pool entry each tile is currently showing, so a swap can compare
  // proportions and so the same picture never appears twice at once.
  const current = new Map();
  [...grid.querySelectorAll('.gallery-item')].forEach((el, i) => current.set(el, picked[i]));
  const shown = new Set(picked.map(i => i.src));

  function swapRandomItem() {
    const items = [...grid.querySelectorAll('.gallery-item')];
    const target = items[Math.floor(Math.random() * items.length)];
    const outgoing = current.get(target);

    // Heights are natural now, so an incoming picture with different
    // proportions would resize the tile and shove everything below it down
    // the column. Prefer a replacement shaped like the one it replaces;
    // only fall back to any unused image if nothing close exists.
    const unused = galleryPool.filter(i => !shown.has(i.src));
    if (!unused.length) return;

    const outRatio = ratioOf(outgoing);
    const sameShape = outRatio
      ? unused.filter(i => {
          const r = ratioOf(i);
          return r && Math.abs(r - outRatio) / outRatio < 0.06;
        })
      : [];
    const pickFrom = sameShape.length ? sameShape : unused;
    const next = pickFrom[Math.floor(Math.random() * pickFrom.length)];

    const img = target.querySelector('img');
    target.style.transition = 'opacity 0.8s ease';
    target.style.opacity = '0';

    setTimeout(() => {
      shown.delete(outgoing.src);

      img.src = next.src;
      img.alt = next.title;
      // Keep the intrinsic size in step with the new file, or the browser
      // reserves space using the previous image's proportions.
      if (next.w && next.h) { img.width = next.w; img.height = next.h; }
      else { img.removeAttribute('width'); img.removeAttribute('height'); }

      // Recolour the chip with the incoming work's category, or it keeps the
      // outgoing one's colour — and repoint the link, or the tile would still
      // open the previous student's portfolio.
      target.dataset.spec = specOf(next);
      applyLink(target, next);
      target.querySelector('.gallery-item-label').textContent = next.label;
      target.querySelector('.gallery-item-title').textContent = next.title;
      target.querySelector('.gallery-item-student').textContent = creditOf(next);

      shown.add(next.src);
      current.set(target, next);

      target.style.opacity = '1';
      scheduleSwap();
    }, 800);
  }

  function scheduleSwap() {
    const delay = 8000 + Math.random() * 10000;
    setTimeout(swapRandomItem, delay);
  }

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

// ── SPEC CATEGORY REVEAL (mobile) ─────────────────
// On mobile the four specialisations show as a compact logo row; tapping a
// logo reveals that category's description in the shared area below the row
// (and highlights it). Tapping the same one again closes it. Inert on desktop,
// where the reveal element is display:none and each panel shows its desc inline.
(function () {
  const specs  = document.querySelector('.specs');
  const reveal = document.getElementById('spec-mreveal');
  if (!specs || !reveal) return;
  const panels = [...specs.querySelectorAll('.spec-panel')];
  panels.forEach(panel => {
    panel.addEventListener('click', (e) => {
      const wasOpen = panel.classList.contains('is-open');
      panels.forEach(p => p.classList.remove('is-open'));
      if (wasOpen) { reveal.classList.remove('show'); reveal.innerHTML = ''; return; }
      panel.classList.add('is-open');
      const inner = panel.querySelector('.spec-inner');
      reveal.innerHTML = inner ? inner.innerHTML : '';
      reveal.classList.add('show');
    });
  });
})();