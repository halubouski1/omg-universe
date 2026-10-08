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

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
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
