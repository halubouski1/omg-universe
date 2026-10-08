// ========================================
// Tracking page — lookup mode tabs and validation
// ========================================
// "Order Details" asks for order ID + e-mail, "Tracking Number" for the number
// alone; the bar under the tabs slides to the active one. Looking the order
// up has no design yet: hook it in onTrack().
const initTracking = (form) => {
  const card = form.closest('.tracking-card');
  const tabs = [...card.querySelectorAll('[data-track-mode]')];
  const bar = card.querySelector('.tracking-card__progress-bar');
  const groups = [...form.querySelectorAll('[data-track-fields]')];
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let mode = 'order';

  // Bar runs from just before the active tab to 20px past it. Layout offsets,
  // not getBoundingClientRect, so the card's zoom-in entrance can't skew it.
  const moveBar = (tab) => {
    const track = bar.parentElement;
    const left = Math.max(tab.offsetLeft - track.offsetLeft - 12, 0);
    const right = Math.min(tab.offsetLeft + tab.offsetWidth - track.offsetLeft + 20, track.offsetWidth);
    bar.style.left = `${left}px`;
    bar.style.width = `${right - left}px`;
  };

  const setMode = (next) => {
    if (next === mode) return;
    mode = next;
    tabs.forEach((tab) => {
      const isActive = tab.dataset.trackMode === next;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
      if (isActive) moveBar(tab);
    });
    groups.forEach((group) => {
      const show = group.dataset.trackFields === next;
      group.hidden = !show;
      if (show && !prefersReducedMotion) {
        group.animate(
          [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
          { duration: 450, easing: 'cubic-bezier(.22, 1, .36, 1)' },
        );
      }
    });
  };

  tabs.forEach((tab) => tab.addEventListener('click', () => setMode(tab.dataset.trackMode)));
  window.addEventListener('resize', () => moveBar(tabs.find((t) => t.classList.contains('is-active'))));
  moveBar(tabs[0]);
  // Tab widths change once the web font loads
  document.fonts?.ready.then(() => moveBar(tabs.find((t) => t.classList.contains('is-active'))));

  const isValid = (input) => input.value.trim() !== '' && input.checkValidity();

  form.querySelectorAll('.tracking-card__input').forEach((input) => {
    input.addEventListener('input', () => {
      if (input.classList.contains('is-invalid')) input.classList.toggle('is-invalid', !isValid(input));
    });
  });

  const onTrack = () => {
    // No tracking result design yet — place the real lookup here.
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const fields = [...form.querySelectorAll(`[data-track-fields="${mode}"] .tracking-card__input`)];
    const invalid = fields.filter((input) => !isValid(input));
    fields.forEach((input) => {
      const bad = invalid.includes(input);
      input.classList.toggle('is-invalid', bad);
      input.setAttribute('aria-invalid', String(bad));
    });
    if (invalid.length) {
      invalid[0].focus();
      return;
    }
    onTrack();
  });
};

document.querySelectorAll('[data-tracking-form]').forEach(initTracking);
