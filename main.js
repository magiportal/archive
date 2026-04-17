// ── LOGO ↔ SPECIALISATION SYSTEM ─────────────────

const logoWrap  = document.getElementById('logo-wrap');
const letters   = logoWrap.querySelectorAll('.logo-letter');
const letterM   = document.getElementById('letter-m');
const letterG   = document.getElementById('letter-g');
const panels    = document.querySelectorAll('.spec-panel');
const cards     = document.querySelectorAll('.work-card:not(.ghost)');
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
    tittleX = iRect.left + iRect.width * 0.3;
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

const viewGrid = document.getElementById('view-grid');
const viewList = document.getElementById('view-list');
const btnGrid  = document.getElementById('btn-grid');
const btnList  = document.getElementById('btn-list');

function setView(v) {
  if (v === 'grid') {
    viewGrid.style.display = '';
    viewList.style.display = 'none';
    btnGrid.classList.add('active');
    btnList.classList.remove('active');
  } else {
    viewGrid.style.display = 'none';
    viewList.style.display = '';
    btnGrid.classList.remove('active');
    btnList.classList.add('active');
  }
}

btnGrid.addEventListener('click', () => setView('grid'));
btnList.addEventListener('click', () => setView('list'));

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