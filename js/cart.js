// ========================================
// Cart — remove items and keep the totals in sync
// ========================================
const BAG_EASE = 'cubic-bezier(.22, 1, .36, 1)';
const DELIVERY_PRICE = 0;

const formatUsd = (value) => `$${value.toLocaleString('en-US')} USD`;

const initBag = (bag) => {
  const list = bag.querySelector('[data-bag-list]');
  const empty = bag.querySelector('[data-bag-empty]');
  const subtotal = document.querySelector('[data-bag-subtotal]');
  const total = document.querySelector('[data-bag-total]');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const updateTotals = () => {
    const items = [...list.querySelectorAll('[data-bag-item]')];
    const sum = items.reduce((acc, item) => acc + Number(item.dataset.price || 0), 0);
    if (subtotal) subtotal.textContent = formatUsd(sum);
    if (total) total.textContent = formatUsd(sum + (items.length ? DELIVERY_PRICE : 0));
    list.hidden = items.length === 0;
    empty.hidden = items.length !== 0;
  };

  // Siblings that move up/left when an item leaves glide into place (FLIP)
  const glideSiblings = (before) => {
    if (prefersReducedMotion) return;
    before.forEach(({ el, rect }) => {
      const now = el.getBoundingClientRect();
      const dx = rect.left - now.left;
      const dy = rect.top - now.top;
      if (!dx && !dy) return;
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
        { duration: 600, easing: BAG_EASE },
      );
    });
  };

  const removeItem = async (item) => {
    if (item.dataset.removing) return;
    item.dataset.removing = 'true';

    if (!prefersReducedMotion) {
      await item.animate(
        [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.96)' }],
        { duration: 350, easing: 'ease-in', fill: 'forwards' },
      ).finished;
    }

    const others = [...list.querySelectorAll('[data-bag-item]')].filter((el) => el !== item);
    const before = others.map((el) => ({ el, rect: el.getBoundingClientRect() }));
    item.remove();
    glideSiblings(before);
    updateTotals();

    // Keep keyboard focus in the list after the button disappears
    const next = list.querySelector('[data-bag-remove]');
    if (next) next.focus({ preventScroll: true });
  };

  list.addEventListener('click', (event) => {
    const button = event.target.closest('[data-bag-remove]');
    if (button) removeItem(button.closest('[data-bag-item]'));
  });

  updateTotals();
};

document.querySelectorAll('[data-bag]').forEach(initBag);
