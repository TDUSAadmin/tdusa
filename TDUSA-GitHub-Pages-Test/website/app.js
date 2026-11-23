// Scroll-driven portal sequence. Frame requests are deduplicated and bounded,
// and completed frames trigger another paint even when the user stops scrolling.
const header = document.querySelector('.site-header');
const menuButton = document.querySelector('.menu-button');
const frame = document.querySelector('#portal-frame');
const sequence = document.querySelector('.portal-sequence');
const counter = document.querySelector('#frame-counter');
const frameCount = 182;
const compact = matchMedia('(max-width:900px),(pointer:coarse)').matches;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const stride = compact ? 2 : 1;
const frameURL = i => `public/portal-frames/optimized/frame_${String(i).padStart(3, '0')}_delay-0.055s.jpg`;
const cache = new Map();
const pending = new Set();
const queue = [];
let activeLoads = 0, displayed = -1, sequenceActive = false, rafId = null;
const maxLoads = 6;
function schedule() { if (rafId === null) rafId = requestAnimationFrame(tick); }
function load(i, priority = false) {
  if (i < 0 || i >= frameCount || cache.has(i)) return;
  if (pending.has(i)) {
    // A target already waiting in the background queue must not sit behind
    // obsolete prefetches when the visitor scrolls quickly.
    const position = queue.indexOf(i);
    if (priority && position > 0) { queue.splice(position, 1); queue.unshift(i); }
    return;
  }
  pending.add(i);
  if (priority) queue.unshift(i); else queue.push(i);
  pump();
}
function pump() {
  while (activeLoads < maxLoads && queue.length) {
    const i = queue.shift();
    activeLoads++;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      activeLoads--; pending.delete(i); cache.set(i, img);
      if (sequenceActive) schedule();
      pump();
    };
    img.onerror = () => { activeLoads--; pending.delete(i); pump(); };
    img.src = frameURL(i);
  }
}
function getScrollTarget() {
  const rect = sequence.getBoundingClientRect();
  const progress = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height - innerHeight)));
  const raw = Math.round(progress * (frameCount - 1));
  // Always allow the last frame, including on touch devices.
  return progress >= .999 ? frameCount - 1 : Math.min(frameCount - 1, Math.round(raw / stride) * stride);
}
function paint(target) {
  let idx = target;
  if (!cache.has(idx)) {
    let best = Infinity;
    for (const key of cache.keys()) {
      const distance = Math.abs(key - target);
      if (distance < best) { best = distance; idx = key; }
    }
  }
  if (!cache.has(idx) || idx === displayed) return;
  frame.src = cache.get(idx).src;
  if (counter) counter.textContent = String(idx + 1).padStart(2, '0') + ' / ' + frameCount;
  displayed = idx;
}
function preloadAround(target) {
  // Discard queued (not in-flight) work far from the current scroll position.
  // This leaves the next free connection for a frame the user can see.
  const radius = compact ? 16 : 24;
  for (let i = queue.length - 1; i >= 0; i--) {
    if (Math.abs(queue[i] - target) > radius) pending.delete(queue.splice(i, 1)[0]);
  }
  load(target, true);
  for (let d = stride; d <= (compact ? 8 : 14); d += stride) {
    load(target + d); load(target - d);
  }
}
function tick() {
  rafId = null;
  header.classList.toggle('is-scrolled', scrollY > 24);
  if (sequenceActive && !reducedMotion) {
    const target = getScrollTarget();
    paint(target); preloadAround(target);
  }
}
load(0, true);
if (!reducedMotion) {
  for (let i = stride; i <= (compact ? 8 : 12); i += stride) load(i);
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      sequenceActive = entries[0].isIntersecting;
      if (sequenceActive) schedule();
    }, { rootMargin: '50% 0px 50% 0px' });
    io.observe(sequence);
  } else sequenceActive = true;
}
addEventListener('scroll', schedule, { passive: true });
addEventListener('resize', schedule, { passive: true });
if (window.visualViewport) visualViewport.addEventListener('resize', schedule, { passive: true });

// ─── Header / nav ─────────────────────────────────────────────────────────────
menuButton.onclick = () => {
  const open = document.body.classList.toggle('menu-open');
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.textContent = open ? 'Close' : 'Menu';
};
document.querySelectorAll('nav a').forEach(a =>
  a.addEventListener('click', () => { document.body.classList.remove('menu-open'); menuButton.setAttribute('aria-expanded', 'false'); menuButton.textContent = 'Menu'; })
);

// ─── Contact form ─────────────────────────────────────────────────────────────
const contactForm = document.querySelector('form');
if (contactForm) {
  contactForm.onsubmit = e => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    location.href =
      'mailto:tdusasl@gmail.com?subject=TDUSA%20website%20enquiry&body=' +
      encodeURIComponent('Name: ' + (data.get('name') || '') + '\nEmail: ' + (data.get('email') || '') + '\n\n' + (data.get('message') || ''));
  };
}

// ─── Footer year ─────────────────────────────────────────────────────────────
const yearEl = document.querySelector('#year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ─── Event card & Gallery entrance animations ─────────────────────────────────
if ('IntersectionObserver' in window) {
  const evObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('ev-visible');
        evObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px 60px 0px' });
  document.querySelectorAll('.event-card').forEach(el => evObs.observe(el));

  const galObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('gal-visible');
        galObs.unobserve(e.target);
      }
    });
  }, { threshold: 0, rootMargin: '0px 0px 200px 0px' });
  document.querySelectorAll('.gallery-item').forEach(el => galObs.observe(el));
} else {
  document.querySelectorAll('.event-card, .gallery-item').forEach(el => {
    el.style.opacity = '1';
    el.style.transform = 'none';
  });
}

// ─── Animated counters ────────────────────────────────────────────────────────
const counts = document.querySelectorAll('.count');
if ('IntersectionObserver' in window) {
  const cntObs = new IntersectionObserver(entries =>
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el     = entry.target;
      const target = Number(el.dataset.target);
      const suffix = el.dataset.suffix || '';
      const start  = performance.now();
      function animCount(now) {
        const p    = Math.min(1, (now - start) / 1200);
        const ease = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * ease).toLocaleString() + suffix;
        if (p < 1) requestAnimationFrame(animCount);
      }
      requestAnimationFrame(animCount);
      cntObs.unobserve(el);
    }),
  { threshold: 0.55 });
  counts.forEach(el => cntObs.observe(el));
} else {
  counts.forEach(el =>
    el.textContent = Number(el.dataset.target).toLocaleString() + (el.dataset.suffix || '')
  );
}

// Fire header state immediately on load
schedule();
