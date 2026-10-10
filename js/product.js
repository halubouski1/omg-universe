// ========================================
// Product page — gallery and quantity
// ========================================
const PRODUCT_EASE = 'cubic-bezier(.22, 1, .36, 1)';
const prefersReducedMotionProduct = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Gallery: hovering or clicking a thumbnail cross-fades its full image into
// the main frame. The new image is laid over the old one, fades and settles
// from a slight zoom, then replaces it.
const initGallery = (gallery) => {
  const main = gallery.querySelector('.gallery__main');
  const thumbs = [...gallery.querySelectorAll('.gallery__thumb')];
  let current = main.querySelector('.gallery__image');
  let activeThumb = thumbs.find((thumb) => thumb.classList.contains('is-active'));

  const show = (thumb) => {
    if (thumb === activeThumb) return;
    activeThumb = thumb;
    thumbs.forEach((item) => {
      const isActive = item === thumb;
      item.classList.toggle('is-active', isActive);
      item.setAttribute('aria-pressed', String(isActive));
    });

    const next = current.cloneNode();
    next.src = thumb.dataset.full;
    main.append(next);

    const previous = current;
    current = next;
    if (prefersReducedMotionProduct) {
      previous.remove();
      return;
    }
    next.animate(
      [{ opacity: 0, transform: 'scale(1.04)' }, { opacity: 1, transform: 'none' }],
      { duration: 700, easing: PRODUCT_EASE },
    ).finished.then(() => previous.remove(), () => {});
  };

  // Arrows (tablet/phone) step through the thumbnails, wrapping around
  const step = (direction) => {
    const index = thumbs.indexOf(activeThumb);
    show(thumbs[(index + direction + thumbs.length) % thumbs.length]);
  };
  gallery.querySelector('[data-gallery-prev]')?.addEventListener('click', () => step(-1));
  gallery.querySelector('[data-gallery-next]')?.addEventListener('click', () => step(1));

  thumbs.forEach((thumb) => {
    thumb.addEventListener('click', () => show(thumb));
    thumb.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') show(thumb);
    });
  });
};

// Quantity: typed or stepped with the chevrons, kept between min and max;
// each change nudges the number in the direction it moved
const initQuantity = (box) => {
  const input = box.querySelector('.qty__input');
  const steps = [...box.querySelectorAll('[data-qty-step]')];
  const min = Number(input.min) || 1;
  const max = Number(input.max) || 99;

  const clamp = (value) => Math.min(Math.max(Math.round(value) || min, min), max);

  const sync = () => {
    steps.forEach((button) => {
      const step = Number(button.dataset.qtyStep);
      button.disabled = (step < 0 && Number(input.value) <= min) || (step > 0 && Number(input.value) >= max);
    });
  };

  const set = (value) => {
    const previous = Number(input.value);
    const next = clamp(value);
    input.value = next;
    sync();
    if (next === previous || prefersReducedMotionProduct) return;
    const direction = next > previous ? 1 : -1;
    input.animate(
      [{ opacity: 0, transform: `translateY(${8 * direction}px)` }, { opacity: 1, transform: 'none' }],
      { duration: 350, easing: PRODUCT_EASE },
    );
  };

  steps.forEach((button) => {
    button.addEventListener('click', () => set(Number(input.value) + Number(button.dataset.qtyStep)));
  });
  input.addEventListener('change', () => set(input.value));
  sync();
};

document.querySelectorAll('[data-gallery]').forEach(initGallery);
document.querySelectorAll('[data-qty]').forEach(initQuantity);
