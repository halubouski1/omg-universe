// ========================================
// Thank You page — order items list
// ========================================
// Up to two products show in full. Past two the list caps its height and
// scrolls; the bottom edge fades and a bouncing "+N more" hint sits over it
// until the end of the list is reached. Clicking the hint scrolls one product.
const ORDER_ITEMS_VISIBLE = 2;

const initOrderItems = (list) => {
  const items = list.querySelectorAll('.order-card__item');
  const isScrollable = items.length > ORDER_ITEMS_VISIBLE;
  list.classList.toggle('is-scrollable', isScrollable);
  // data-lenis-prevent hands the wheel to the list so it can scroll itself.
  // A list that doesn't scroll must not keep it: Lenis would skip the wheel
  // there and the page would jump natively instead of gliding (the page
  // stuttered whenever the cursor crossed the order card on phones).
  if (!isScrollable) {
    list.removeAttribute('data-lenis-prevent');
    return;
  }

  list.tabIndex = 0; // reachable by keyboard so arrow keys can scroll it
  list.setAttribute('aria-label', `${items.length} products, scrollable`);

  // "+N more" hint, added after the list so it can sit over its faded edge
  const hidden = items.length - ORDER_ITEMS_VISIBLE;
  const hint = document.createElement('button');
  hint.type = 'button';
  hint.className = 'order-card__more';
  hint.innerHTML = `<span>+${hidden} more</span><img src="assets/icons/options-chevron.svg" alt="" width="9" height="6">`;
  hint.setAttribute('aria-label', `Show ${hidden} more products`);
  list.after(hint);

  const step = () => items[0].offsetHeight + parseFloat(getComputedStyle(list).rowGap || 0);
  hint.addEventListener('click', () => list.scrollBy({ top: step(), behavior: 'smooth' }));

  const updateEnd = () => {
    const atEnd = list.scrollTop + list.clientHeight >= list.scrollHeight - 2;
    list.classList.toggle('is-at-end', atEnd);
    hint.classList.toggle('is-hidden', atEnd);
    hint.tabIndex = atEnd ? -1 : 0;
  };
  list.addEventListener('scroll', updateEnd, { passive: true });
  updateEnd();
};

document.querySelectorAll('[data-order-items]').forEach(initOrderItems);
