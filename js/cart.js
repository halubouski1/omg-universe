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
    // Only a keyboard user (focus ring showing) needs focus moved on; after
    // a tap or click nothing should get focused
    const fromKeyboard = item.contains(document.activeElement)
      && document.activeElement.matches(':focus-visible');
    const nextItem = item.nextElementSibling || item.previousElementSibling;

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

    // Keep keyboard focus in the list after the button disappears: on the
    // item that took the removed one's place
    if (fromKeyboard) nextItem?.querySelector('[data-bag-remove]')?.focus({ preventScroll: true });
  };

  list.addEventListener('click', (event) => {
    const button = event.target.closest('[data-bag-remove]');
    if (button) removeItem(button.closest('[data-bag-item]'));
  });

  updateTotals();

  // Entrance: the items rise in one after another as they come into view
  // (40px, fading — the same as the catalog and favourites cards)
  if (!prefersReducedMotion) {
    const items = [...list.querySelectorAll('[data-bag-item]')];
    items.forEach((item) => { item.style.opacity = 0; });
    const observer = new IntersectionObserver((entries) => {
      entries.filter((e) => e.isIntersecting).forEach((entry, i) => {
        const item = entry.target;
        observer.unobserve(item);
        item.animate(
          [{ opacity: 0, transform: 'translateY(40px)' }, { opacity: 1, transform: 'none' }],
          { duration: 700, delay: Math.min(i, 8) * 80, easing: BAG_EASE, fill: 'backwards' },
        ).finished.then(() => { item.style.opacity = ''; }, () => { item.style.opacity = ''; });
      });
    }, { rootMargin: '0px 0px -60px 0px' });
    items.forEach((item) => observer.observe(item));
  }
};

document.querySelectorAll('[data-bag]').forEach(initBag);
