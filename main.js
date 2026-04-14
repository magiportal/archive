// ── LOGO ↔ SPECIALISATION SYSTEM ─────────────────
//
// Each letter has data-spec="animation|games|interactivity"
// On hover:
//   1. Logo: dim all letters, brighten the hovered one(s)
//   2. Panels: fade out non-matching, tint-highlight match
//   3. Archive cards: dim non-matching spec
// On leave: reset everything

const logoWrap  = document.getElementById('logo-wrap');
const letters   = logoWrap.querySelectorAll('.logo-letter');
const letterM   = document.getElementById('letter-m');
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

// M — colour reveal only, no spec activation
letterM.addEventListener('mouseenter', () => {
  letterM.style.filter = 'grayscale(0) brightness(1)';
});
letterM.addEventListener('mouseleave', () => {
  letterM.style.filter = '';
});

// A, G, I — full spec activation
letters.forEach(letter => {
  if (!letter.dataset.spec) return;
  letter.addEventListener('mouseenter', () => activate(letter.dataset.spec));
  letter.addEventListener('mouseleave', deactivate);
});

// ── G — DRAGGABLE WITH PHYSICS ────────────────────

const letterG = document.getElementById('letter-g');

let gX = 0, gY = 0;
let gVX = 0, gVY = 0;
let gTargetX = 0, gTargetY = 0;
let isDragging = false;
let dragStartX = 0, dragStartY = 0;
let rafId = null;
let gHovered = false;

const DRAG_LERP   = 0.055;  // heavier lag — lower = more sluggish
const SPRING_K    = 0.055;  // softer spring — slower pull back
const DAMPING     = 0.82;   // higher = more overshoot and slosh
const SNAP_THRESH = 0.4;

function applyG() {
  const tilt = Math.max(-22, Math.min(22, gVX * 3.5));
  // preserve the hover translateX(5px) when not dragging
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
    // restore CSS transition so hover animation works again
    letterG.style.transition = '';
  }
}

letterG.addEventListener('mouseenter', () => { gHovered = true; });
letterG.addEventListener('mouseleave', () => {
  gHovered = false;
  if (isDragging) return; // don't deactivate spec while dragging
});

letterG.addEventListener('mousedown', e => {
  e.preventDefault();
  isDragging = true;
  cancelAnimationFrame(rafId);
  dragStartX = e.clientX - gX;
  dragStartY = e.clientY - gY;
  letterG.classList.add('is-dragging');
  letterG.style.transition = 'filter 0.25s ease, opacity 0.25s ease';
  // lock highlight on for the drag
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