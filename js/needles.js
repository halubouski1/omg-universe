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

