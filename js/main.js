// ========================================
// Lenis smooth scroll
// ========================================
let lenis = null;
if (typeof Lenis !== 'undefined') {
  lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });

  const lenisRaf = (time) => {
    lenis.raf(time);
    requestAnimationFrame(lenisRaf);
  };
  requestAnimationFrame(lenisRaf);
}

// ========================================
// AOS init
// ========================================
if (typeof AOS !== 'undefined') {
  AOS.init({
    duration: 900,
    once: true,
    offset: 80,
    easing: 'ease-out-cubic',
    disable: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  });
  if (lenis) lenis.on('scroll', AOS.refresh);
}

// ========================================
// Hero slider — opacity cross-fade
// ========================================
const HERO_AUTOPLAY_DELAY_MS = 4000;

const initHeroSlider = (hero) => {
  const slides = hero.querySelectorAll('.hero__slide');
  const indicators = hero.querySelectorAll('.hero__indicator');
  if (slides.length < 2) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let activeIndex = 0;
  let autoplayTimer = null;

  const goToSlide = (nextIndex) => {
    if (nextIndex === activeIndex) return;

    slides.forEach((slide) => slide.classList.remove('is-prev'));
    slides[activeIndex].classList.replace('is-active', 'is-prev');
    slides[nextIndex].classList.add('is-active');

    indicators[activeIndex]?.classList.remove('is-active');
    indicators[activeIndex]?.removeAttribute('aria-current');
    indicators[nextIndex]?.classList.add('is-active');
    indicators[nextIndex]?.setAttribute('aria-current', 'true');

    activeIndex = nextIndex;
  };

  const restartAutoplay = () => {
    if (prefersReducedMotion) return;
    clearInterval(autoplayTimer);
    autoplayTimer = setInterval(() => {
      if (!document.hidden) goToSlide((activeIndex + 1) % slides.length);
    }, HERO_AUTOPLAY_DELAY_MS);
  };

  indicators.forEach((indicator, index) => {
    indicator.addEventListener('click', () => {
      goToSlide(index);
      restartAutoplay();
    });
  });

  restartAutoplay();
};

document.querySelectorAll('[data-hero-slider]').forEach(initHeroSlider);

// Hero heading width — Safari doesn't always recompute a cqw font-size on
// resize, so the content-box width is passed to CSS as --hero-w instead
if (typeof ResizeObserver !== 'undefined') {
  const heroWidthObserver = new ResizeObserver((entries) => {
    entries.forEach((entry) => {
      entry.target.style.setProperty('--hero-w', `${entry.contentRect.width}px`);
    });
  });
  document.querySelectorAll('.hero__inner').forEach((inner) => heroWidthObserver.observe(inner));
}

// ========================================
// Events list — expand on hover
// ========================================
// Toggling .is-active swaps the row between two layouts, which CSS can't
// interpolate. Each changed row is measured before and after the swap; its
// height is animated from old to new and the date/city fade in at their spot.
const EVENT_ANIMATION = {
  duration: 750,
  // ease-in-out: the row and the page start and settle gently together
  easing: 'cubic-bezier(.65, 0, .35, 1)', // same curve as easeInOutCubic below
};
// Date and city re-appear at their new spot instead of sliding across the row
const EVENT_HEAD_TARGETS = '.event__date, .event__city';
const EVENT_HEAD_REVEAL = {
  duration: 650,
  easing: 'cubic-bezier(.22, 1, .36, 1)',
  fill: 'backwards',
};
// Head waits for the row to start opening, then date and city follow in turn
const EVENT_HEAD_DELAY = 120;
const EVENT_HEAD_STAGGER = 80;

const initEventsList = (list) => {
  const items = [...list.querySelectorAll('[data-event]')];
  if (!items.length) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let activeItem = items.find((item) => item.classList.contains('is-active')) ?? null;
  let isAnimating = false;

  // Positions are taken relative to the row, so a row that slides because a
  // sibling above it resizes doesn't count as movement of its children.
  const measure = (item) => {
    const base = item.getBoundingClientRect();
    return {
      height: base.height,
      marginTop: getComputedStyle(item).marginTop,
      children: [...item.querySelectorAll(EVENT_HEAD_TARGETS)].map((el) => {
        const rect = el.getBoundingClientRect();
        return { el, x: rect.left - base.left, y: rect.top - base.top };
      }),
    };
  };

  const animateFromSnapshot = (item, before, after) => {
    item.animate(
      [
        { height: `${before.height}px`, marginTop: before.marginTop },
        { height: `${after.height}px`, marginTop: after.marginTop },
      ],
      EVENT_ANIMATION,
    );

    // Only elements whose spot in the row changed are re-revealed
    before.children.forEach(({ el, x, y }, index) => {
      if (x === after.children[index].x && y === after.children[index].y) return;
      el.animate(
        [
          { opacity: 0, transform: 'translateY(10px)' },
          { opacity: 1, transform: 'none' },
        ],
        { ...EVENT_HEAD_REVEAL, delay: EVENT_HEAD_DELAY + index * EVENT_HEAD_STAGGER },
      );
    });
  };

  // Where the window must be scrolled for the row, in its final layout, to sit
  // in the middle of the viewport (clamped to the scrollable range).
  const getCenteredScroll = (item) => {
    const rect = item.getBoundingClientRect();
    const target = window.scrollY + rect.top + rect.height / 2 - window.innerHeight / 2;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    return Math.min(Math.max(target, 0), maxScroll);
  };

  const scrollToInstantly = (y) => {
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
  };

  // Driven per frame with the same duration and curve as the row animation,
  // so the resize and the scroll read as one movement.
  const easeInOutCubic = (t) => (t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

  const scrollInSync = (targetY) => {
    const startY = window.scrollY;
    const distance = targetY - startY;
    if (Math.abs(distance) < 1) return;
    // Timed from the first frame: rAF timestamps can predate this call
    let startTime = null;

    const step = (now) => {
      startTime ??= now;
      const progress = Math.min(Math.max((now - startTime) / EVENT_ANIMATION.duration, 0), 1);
      scrollToInstantly(startY + distance * easeInOutCubic(progress));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const setActive = (nextItem) => {
    if (!nextItem || nextItem === activeItem) return;

    const changed = [activeItem, nextItem].filter(Boolean);
    const before = changed.map(measure);

    activeItem?.classList.remove('is-active');
    nextItem.classList.add('is-active');
    activeItem = nextItem;

    // Read the final layout before any animation pulls it back to the start
    const after = changed.map(measure);
    const targetScroll = getCenteredScroll(nextItem);

    if (prefersReducedMotion) {
      scrollToInstantly(targetScroll);
      return;
    }

    changed.forEach((item, index) => animateFromSnapshot(item, before[index], after[index]));
    scrollInSync(targetScroll);

    // Rows move under a still cursor while animating; ignoring the pointer
    // meanwhile stops that from activating rows the user never aimed at.
    isAnimating = true;
    setTimeout(() => { isAnimating = false; }, EVENT_ANIMATION.duration);
  };

  // pointermove rather than pointerenter: after a resize the cursor can end up
  // over a new row without moving, and that alone shouldn't expand it.
  list.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || isAnimating) return;
    setActive(event.target.closest('[data-event]'));
  });

  // Touch has no hover: a tap expands the row
  list.addEventListener('click', (event) => {
    setActive(event.target.closest('[data-event]'));
  });

  list.addEventListener('focusin', (event) => {
    setActive(event.target.closest('[data-event]'));
  });
};

document.querySelectorAll('[data-events]').forEach(initEventsList);


// ========================================
// Deck — stacking cards on scroll
// ========================================
// Each card is sticky; as the next card scrolls up over it, the covered card's
// --deck-progress goes 0 → 1, which CSS turns into a slight shrink and a
// fade of its content.
const initDeck = (list) => {
  const items = [...list.querySelectorAll('[data-deck-item]')];
  if (items.length < 2) return;

  let frame = null;

  const update = () => {
    frame = null;
    items.slice(0, -1).forEach((item, index) => {
      const current = item.getBoundingClientRect();
      const next = items[index + 1].getBoundingClientRect();
      // The next card starts one card-height-plus-gap below and ends on top
      const span = current.height + parseFloat(getComputedStyle(list).rowGap);
      const progress = Math.min(Math.max(1 - (next.top - current.top) / span, 0), 1);
      item.style.setProperty('--deck-progress', progress.toFixed(3));
    });
  };

  const requestUpdate = () => {
    if (frame === null) frame = requestAnimationFrame(update);
  };

  // Cards taller than the screen can't pin centred: they stick with their
  // bottom on the bottom of the screen (negative top) so all of them is seen
  const fitSticky = () => {
    items.forEach((item) => {
      const overflow = window.innerHeight - item.offsetHeight;
      if (overflow < 0) item.style.setProperty('--deck-sticky-top', `${overflow}px`);
      else item.style.removeProperty('--deck-sticky-top');
    });
  };

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', () => { fitSticky(); requestUpdate(); });
  window.addEventListener('load', fitSticky);
  fitSticky();
  update();
};

document.querySelectorAll('[data-deck]').forEach(initDeck);


// ========================================
// Background videos — respect reduced motion
// ========================================
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll('video[autoplay]').forEach((video) => {
    video.removeAttribute('autoplay');
    video.pause();
  });
}


// ========================================
// Back to top
// ========================================
document.querySelectorAll('[data-scroll-top]').forEach((button) => {
  button.addEventListener('click', () => {
    if (lenis) lenis.scrollTo(0);
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});


// ========================================
// Expandable text (e.g. tariff descriptions)
// ========================================
// The block's collapsed height comes from CSS; opening animates the height to
// the full content, closing animates it back. aria-expanded on the toggle is
// the source of truth.
document.querySelectorAll('[data-expand-toggle]').forEach((toggle) => {
  const target = document.getElementById(toggle.getAttribute('aria-controls'));
  if (!target) return;

  // Measures the CSS (collapsed) height with transitions off, so the
  // measurement itself doesn't start an animation
  const getCollapsedHeight = () => {
    const current = target.style.height;
    target.style.transition = 'none';
    target.style.height = '';
    const height = target.offsetHeight;
    target.style.height = current;
    target.offsetHeight; // commit before transitions come back
    target.style.transition = '';
    return height;
  };

  toggle.addEventListener('click', () => {
    const willExpand = toggle.getAttribute('aria-expanded') !== 'true';
    const startHeight = target.offsetHeight;
    const endHeight = willExpand ? target.scrollHeight : getCollapsedHeight();

    // Fix the current height in px (it may be 'auto'), then animate to the end
    target.style.transition = 'none';
    target.style.height = `${startHeight}px`;
    target.offsetHeight;
    target.style.transition = '';
    target.style.height = `${endHeight}px`;

    // Opening: drop the fade straight away. Closing: keep the text unfaded
    // until it has finished closing.
    if (willExpand) target.classList.add('is-expanded');

    target.addEventListener('transitionend', function settle(event) {
      if (event.propertyName !== 'height') return;
      target.removeEventListener('transitionend', settle);
      if (toggle.getAttribute('aria-expanded') === 'true') {
        target.style.height = 'auto'; // let the open text reflow on resize
      } else {
        target.classList.remove('is-expanded');
        target.style.height = '';
      }
    });

    toggle.setAttribute('aria-expanded', String(willExpand));
    // Icon-only toggles carry an aria-label; text toggles keep their text
    if (toggle.hasAttribute('aria-label')) {
      toggle.setAttribute('aria-label', willExpand ? 'Hide full description' : 'Show full description');
    }
  });
});

// ========================================
// Popups — [data-popup-open="<id>"] opens #<id>; the overlay, the close
// button and Esc close it. Page scroll is locked while one is open.
// ========================================
const POPUP_FADE_MS = 400;
let openPopup = null;
let popupTrigger = null;

const closePopup = () => {
  if (!openPopup) return;
  openPopup.classList.remove('is-open');
  document.body.classList.remove('is-popup-open');
  lenis?.start();
  popupTrigger?.focus({ preventScroll: true });
  openPopup = null;
  popupTrigger = null;
};

const showPopup = (popup, trigger) => {
  if (openPopup) closePopup();
  openPopup = popup;
  popupTrigger = trigger;
  popup.classList.add('is-open');
  document.body.classList.add('is-popup-open');
  lenis?.stop();
  // after the fade has started, so focusing doesn't jump the page
  setTimeout(() => (popup.querySelector('input') ?? popup.querySelector('button'))?.focus({ preventScroll: true }), POPUP_FADE_MS / 2);
};

document.querySelectorAll('[data-popup-open]').forEach((trigger) => {
  const popup = document.getElementById(trigger.dataset.popupOpen);
  if (!popup) return;
  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    showPopup(popup, trigger);
  });
});

document.querySelectorAll('[data-popup]').forEach((popup) => {
  popup.querySelectorAll('[data-popup-close]').forEach((el) => el.addEventListener('click', closePopup));
  // Links inside (the menu): close first, so an in-page anchor such as
  // #contacts scrolls the page instead of staying under the open menu
  popup.querySelectorAll('a[href]').forEach((link) => link.addEventListener('click', () => {
    closePopup();
    const hash = link.getAttribute('href');
    if (hash.startsWith('#') && hash.length > 1 && lenis) {
      const target = document.querySelector(hash);
      if (target) lenis.scrollTo(target, { offset: -100 });
    }
  }));
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closePopup();
});


// ========================================
// Favourites — the heart on product cards (every page with cards)
// ========================================
// The heart toggles on click (state only for now — nothing is
// stored yet); switching it on plays the pop and ring once
// Notifications — "added to / removed from favorites", "added to / removed
// from cart". Each action adds its own plate on top of a stack (10px apart,
// at most FAV_TOAST_MAX; the oldest gives way); each hides on its own timer
// (paused while the pointer is over it) or with its cross, sliding out and
// collapsing so the plates below glide up.
const FAV_TOAST_MS = 4000;
const FAV_TOAST_MAX = 4;
let favStack = null;

const TOAST_MODES = {
  added: { text: 'Product added to favorites', icon: 'assets/icons/favorites-notifictaion.svg', link: 'Go to favorites', href: 'favorites.html' },
  removed: { text: 'Product removed from favorites', short: true },
  cart: { text: 'Product added to cart', icon: 'assets/icons/cart.svg', link: 'Go to cart', href: 'cart.html', cart: true },
  cartRemoved: { text: 'Product removed from cart', short: true },
};

const ARROW_SVG = '<svg viewBox="0 0 16 14" aria-hidden="true"><path d="M8.94978 0L7.27172 1.67806L11.1872 5.59354L0 5.59361V7.83103L11.1872 7.83096L7.27172 11.7464L8.94978 13.4245L15.662 6.71225L8.94978 0Z" fill="currentColor"/></svg>';

const hideFavToast = (toast) => {
  if (toast.dataset.leaving) return;
  toast.dataset.leaving = 'true';
  clearTimeout(toast.timer);
  toast.classList.remove('is-visible');
  // after the slide-out, collapse its height so the stack closes up smoothly
  setTimeout(() => {
    const h = toast.offsetHeight;
    const collapse = toast.animate(
      [{ height: `${h}px`, marginBottom: '0px' }, { height: '0px', marginBottom: `-${parseFloat(getComputedStyle(favStack).rowGap) || 0}px`, paddingTop: '0px', paddingBottom: '0px' }],
      { duration: 280, easing: 'ease-in-out' },
    );
    collapse.finished.then(() => toast.remove(), () => toast.remove());
  }, 400);
};

const startFavTimer = (toast, ms) => {
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => hideFavToast(toast), ms);
};

const showFavToast = (card, mode = 'added') => {
  const m = TOAST_MODES[mode];
  if (!favStack) {
    favStack = document.createElement('div');
    favStack.className = 'fav-stack';
    favStack.setAttribute('aria-live', 'polite');
    document.body.append(favStack);
  }

  const toast = document.createElement('div');
  toast.className = `fav-toast${m.short ? ' fav-toast--removed' : ''}${m.cart ? ' fav-toast--cart' : ''}`;
  toast.setAttribute('role', 'status');
  const photo = card?.querySelector('.product__image');
  toast.innerHTML = `
    ${!m.short && photo ? `<img class="fav-toast__image" src="${photo.currentSrc || photo.src}" alt="" width="110" height="110">` : ''}
    <div class="fav-toast__body">
      <p class="fav-toast__title">${m.icon ? `<img class="fav-toast__heart" src="${m.icon}" alt="" width="14" height="13">` : ''}<span class="fav-toast__text">${m.text}</span></p>
      ${m.link ? `<a class="fav-toast__link" href="${m.href}">${m.link}${ARROW_SVG}</a>` : ''}
    </div>
    <button class="fav-toast__close" type="button" aria-label="Close notification">
      <img src="assets/icons/close.svg" alt="" width="16" height="16">
    </button>`;
  toast.querySelector('.fav-toast__close').addEventListener('click', () => hideFavToast(toast));
  toast.addEventListener('pointerenter', () => clearTimeout(toast.timer));
  toast.addEventListener('pointerleave', () => startFavTimer(toast, FAV_TOAST_MS / 2));

  favStack.prepend(toast);
  // too many on screen: the oldest that is not already leaving gives way
  const live = [...favStack.children].filter((t) => !t.dataset.leaving);
  live.slice(FAV_TOAST_MAX).forEach(hideFavToast);

  void toast.offsetWidth; // start from the hidden state, then slide in
  toast.classList.add('is-visible');
  startFavTimer(toast, FAV_TOAST_MS);
};

// ========================================
// Favourites store — kept in localStorage so the hearts stay on across
// pages and visits, and favorites.html can list them. A product is
// identified by its name, photo and price (the placeholder cards have no ids).
// ========================================
const FAV_KEY = 'omg-favorites';

const readFavs = () => {
  try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; } catch { return []; }
};

const writeFavs = (list) => {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(list)); } catch { /* private mode: state stays per page */ }
};

const productFromCard = (card) => {
  const image = card.querySelector('.product__image');
  const name = card.querySelector('.product__name')?.textContent.trim() || '';
  const price = card.querySelector('.product__price')?.textContent.trim() || '';
  const src = image?.getAttribute('src') || '';
  return {
    id: `${name}|${src}|${price}`,
    name,
    price,
    size: card.querySelector('.product__size')?.textContent.trim() || '',
    image: src,
    href: card.querySelector('.product__link')?.getAttribute('href') || 'catalog.html',
  };
};

// One heart's on/off state (class, pressed state, label)
const setFavButton = (button, isActive) => {
  button.classList.toggle('is-active', isActive);
  button.setAttribute('aria-pressed', String(isActive));
  const label = button.getAttribute('aria-label') || '';
  button.setAttribute('aria-label', isActive
    ? label.replace('Add', 'Remove').replace(' to favorites', ' from favorites')
    : label.replace('Remove', 'Add').replace(' from favorites', ' to favorites'));
};

// Hearts of products already in favourites start on
const markFavs = (root = document) => {
  const ids = new Set(readFavs().map((f) => f.id));
  root.querySelectorAll('.product__card').forEach((card) => {
    const button = card.querySelector('.product__fav');
    if (button) setFavButton(button, ids.has(productFromCard(card).id));
  });
};
markFavs();

// Delegated, so cards rendered later (favorites.html) work too
document.addEventListener('click', (event) => {
  const fav = event.target.closest('.product__fav');
  if (fav) {
    const card = fav.closest('.product__card');
    const isActive = !fav.classList.contains('is-active');
    setFavButton(fav, isActive);
    fav.classList.remove('is-popping');
    if (isActive) {
      void fav.offsetWidth; // restart the animation on quick re-clicks
      fav.classList.add('is-popping');
    }
    const product = productFromCard(card);
    const list = readFavs().filter((f) => f.id !== product.id);
    if (isActive) list.push(product);
    writeFavs(list);
    showFavToast(card, isActive ? 'added' : 'removed');
    document.dispatchEvent(new CustomEvent('favorites:change', { detail: { id: product.id, isActive, card } }));
    return;
  }

  // "+" toggles like the heart (cart not stored yet): green while in the cart
  const add = event.target.closest('.product__card .product__add');
  if (add) {
    const isActive = add.classList.toggle('is-active');
    add.setAttribute('aria-pressed', String(isActive));
    add.setAttribute('aria-label', (add.getAttribute('aria-label') || '')
      .replace(isActive ? 'Add' : 'Remove', isActive ? 'Remove' : 'Add')
      .replace(isActive ? ' to cart' : ' from cart', isActive ? ' from cart' : ' to cart'));
    showFavToast(add.closest('.product__card'), isActive ? 'cart' : 'cartRemoved');
  }
});

document.addEventListener('animationend', (event) => {
  if (event.pseudoElement === '::after' && event.target.classList?.contains('product__fav')) {
    event.target.classList.remove('is-popping');
  }
});
