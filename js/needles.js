// ========================================
// Needles page — count-up of the diameter values
// ========================================
// Each [data-count-to] counts from 0 up to its value (keeping its decimals)
// the first time its list scrolls into view.
const COUNT_DURATION_MS = 1600;

const easeOutCubic = (t) => 1 - (1 - t) ** 3;

const countUp = (el) => {
  const target = parseFloat(el.dataset.countTo);
  const decimals = (el.dataset.countTo.split('.')[1] || '').length;
  const start = performance.now();
  const tick = (now) => {
    const progress = Math.min((now - start) / COUNT_DURATION_MS, 1);
    el.textContent = (target * easeOutCubic(progress)).toFixed(decimals);
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

document.querySelectorAll('[data-counter]').forEach((list) => {
  const values = [...list.querySelectorAll('[data-count-to]')];
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  values.forEach((el) => { el.textContent = (0).toFixed((el.dataset.countTo.split('.')[1] || '').length); });
  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();
    values.forEach((el, index) => setTimeout(() => countUp(el), index * 150));
  }, { threshold: 0.4 });
  observer.observe(list);
});



// ========================================
// Comparison table — "Scroll →" hint (≤1025px)
// ========================================
// A tap scrolls the table right by most of its visible width (smoothly); the
// hint fades once the end is reached and hides when the table fits as is.
document.querySelectorAll('[data-table-scroll]').forEach((hint) => {
  const panel = hint.nextElementSibling;
  if (!panel) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const update = () => {
    const room = panel.scrollWidth - panel.clientWidth;
    hint.hidden = room < 2;
    hint.classList.toggle('is-at-end', panel.scrollLeft >= room - 2);
  };

  hint.addEventListener('click', () => {
    const room = panel.scrollWidth - panel.clientWidth;
    const atEnd = panel.scrollLeft >= room - 2;
    panel.scrollTo({
      left: atEnd ? 0 : panel.scrollLeft + panel.clientWidth * 0.7,
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  });
  panel.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
});
