// ========================================
// Pigments page — pigment lines slider
// ========================================
// Swiper with slides at their CSS width (1078px). Autoplay drives the active
// pagination bar's fill (--progress); the round button pauses/resumes it.
const PIGMENTS_AUTOPLAY_MS = 4000;

const initPigmentsSlider = (root) => {
  if (typeof Swiper === 'undefined') return;
  const section = root.closest('.pigments-range');
  const pagination = section.querySelector('[data-pigments-pagination]');
  const playButton = section.querySelector('[data-pigments-play]');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const swiper = new Swiper(root, {
    slidesPerView: 'auto',
    spaceBetween: 35,
    // After the last slide it carries straight on to the first; with 'auto'
    // widths Swiper needs a couple of extra slides ready on each side
    loop: true,
    loopAdditionalSlides: 2,
    speed: 600,
    grabCursor: true,
    keyboard: { enabled: true },
    autoplay: prefersReducedMotion ? false : {
      delay: PIGMENTS_AUTOPLAY_MS,
      disableOnInteraction: false,
      pauseOnMouseEnter: true,
    },
    pagination: {
      el: pagination,
      clickable: true,
      renderBullet: (index, className) => (
        `<button type="button" class="${className}" aria-label="Slide ${index + 1}"></button>`
      ),
    },
    on: {
      autoplayTimeLeft(s, time, progress) {
        const bar = pagination.querySelector('.swiper-pagination-bullet-active');
        if (bar) bar.style.setProperty('--progress', String(1 - progress));
      },
      slideChange() {
        pagination.querySelectorAll('.swiper-pagination-bullet').forEach((b) => b.style.removeProperty('--progress'));
      },
    },
  });

  const setPlaying = (playing) => {
    playButton.classList.toggle('is-playing', playing);
    playButton.setAttribute('aria-label', playing ? 'Pause slideshow' : 'Play slideshow');
  };

  if (!swiper.params.autoplay || prefersReducedMotion) setPlaying(false);

  playButton.addEventListener('click', () => {
    if (swiper.autoplay.running && !swiper.autoplay.paused) {
      swiper.autoplay.stop();
      setPlaying(false);
    } else {
      if (!swiper.params.autoplay) swiper.params.autoplay = { delay: PIGMENTS_AUTOPLAY_MS, disableOnInteraction: false };
      swiper.autoplay.start();
      setPlaying(true);
    }
  });
};

document.querySelectorAll('[data-pigments-slider]').forEach(initPigmentsSlider);


// ========================================
// Bundle cards slider — fixed-width cards, arrows only
// ========================================
const initBundleSlider = (root) => {
  if (typeof Swiper === 'undefined') return;
  const section = root.closest('.bundle-slider');
  // eslint-disable-next-line no-new
  new Swiper(root, {
    slidesPerView: 'auto', // cards keep their CSS width
    spaceBetween: 20,
    speed: 600,
    loop: true,
    grabCursor: true,
    navigation: {
      prevEl: section.querySelector('[data-bundle-prev]'),
      nextEl: section.querySelector('[data-bundle-next]'),
    },
  });
};

document.querySelectorAll('[data-bundle-slider]').forEach(initBundleSlider);


// ========================================
// Cover-up products slider — four cards in view, arrows only
// ========================================
const initCoverSlider = (root) => {
  if (typeof Swiper === 'undefined') return;
  const section = root.closest('.cover-up');
  // Phones (≤570px) show the cards as a plain 2-column grid (media-pigments.css),
  // so the slider only runs above that and is taken down when the screen narrows
  const isPhone = window.matchMedia('(max-width: 570px)');
  let swiper = null;

  const sync = () => {
    if (isPhone.matches) {
      swiper?.destroy(true, true);
      swiper = null;
      return;
    }
    if (swiper) return;
    // Up to 1025px the cards keep a fixed CSS width (media-pigments.css) and
    // the row scrolls; wider screens show four at a time
    swiper = new Swiper(root, {
      slidesPerView: 'auto',
      spaceBetween: 16,
      speed: 600,
      loop: true,
      grabCursor: true,
      breakpoints: {
        1026: { slidesPerView: 4 },
      },
      navigation: {
        prevEl: section.querySelector('[data-cover-prev]'),
        nextEl: section.querySelector('[data-cover-next]'),
      },
    });
  };

  isPhone.addEventListener('change', sync);
  sync();
};

document.querySelectorAll('[data-cover-slider]').forEach(initCoverSlider);


// ========================================
// Tips — skin type detail (every width: a row of three, on phones photo |
// tone panel over the white card — see media-pigments.css)
// ========================================
// "Learn more" on a card swaps the grid for that type's detail: a copy of
// the photo grows from the card into the 531px frame, then the white card
// and the tone panel slide in. The close button, a click on the photo or Esc
// play it back into the card. Content comes from the card's data-* attributes.
const TIPS_GROW_MS = 750;
const TIPS_EASE = 'cubic-bezier(.22, 1, .36, 1)';

const initTips = (stage) => {
  const detail = stage.querySelector('[data-tips-detail]');
  const photo = detail.querySelector('.tips-detail__photo');
  const image = detail.querySelector('[data-tips-image]');
  const closeButton = detail.querySelector('[data-tips-close]');
  const field = (name) => detail.querySelector(`[data-tips-${name}]`);
  const swatches = [...detail.querySelectorAll('[data-tips-swatch]')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let openCard = null;
  let busy = false;

  const rectIn = (el) => {
    const r = el.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    return { left: r.left - s.left, top: r.top - s.top, width: r.width, height: r.height };
  };

  // A background-image copy that keeps the photo cropped (cover) while its
  // box moves and resizes between the card and the detail frame
  const fly = async (src, from, to) => {
    if (reducedMotion) return;
    const ghost = document.createElement('div');
    ghost.className = 'tips-ghost';
    ghost.style.backgroundImage = `url("${src}")`;
    stage.append(ghost);
    const frame = (r) => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    await ghost.animate([frame(from), frame(to)], { duration: TIPS_GROW_MS, easing: TIPS_EASE, fill: 'forwards' })
      .finished.catch(() => {});
    ghost.remove();
  };

  const fill = (card) => {
    const d = card.dataset;
    const type = card.querySelector('.skin-card__type');
    detail.style.setProperty('--tone', type.style.getPropertyValue('--tone'));
    detail.style.setProperty('--tone-ink', type.style.getPropertyValue('--tone-ink'));
    // Label, '+' and rule on the tone panel: white on the darker tones (III–VI)
    detail.style.setProperty('--tone-mark', type.style.getPropertyValue('--tone-mark') || '');
    // Close cross: black, turned white (invert) on the darkest tones (V, VI)
    detail.style.setProperty('--tone-close', type.style.getPropertyValue('--tone-close') || '');
    image.src = d.full;
    field('type').textContent = type.textContent.trim();
    field('title').textContent = d.title;
    field('text').textContent = d.text;
    field('eyes').textContent = d.eyes;
    field('hair').textContent = d.hair;
    field('skin').textContent = d.skin;
    field('label').textContent = d.label;
    (d.mix || '').split(',').forEach((color, i) => swatches[i]?.style.setProperty('--swatch', color.trim()));
  };

  // If the opened detail isn't fully on screen (e.g. a card from the second
  // row was tapped), glide the page so it sits in the middle of the screen,
  // or with its top 20px from the screen top when it is taller than that.
  // Runs alongside the photo's flight, which is measured inside the stage.
  const centerDetail = () => {
    const r = detail.getBoundingClientRect();
    if (r.top >= 0 && r.bottom <= window.innerHeight) return;
    const offset = r.height < window.innerHeight - 40 ? -(window.innerHeight - r.height) / 2 : -20;
    if (typeof lenis !== 'undefined' && lenis) {
      lenis.scrollTo(detail, { offset, duration: 0.9, immediate: reducedMotion });
    } else {
      window.scrollTo({ top: r.top + window.scrollY + offset, behavior: reducedMotion ? 'auto' : 'smooth' });
    }
  };

  const open = async (card) => {
    if (busy || openCard) return;
    busy = true;
    openCard = card;
    fill(card);
    await image.decode().catch(() => {});

    const from = rectIn(card.querySelector('.skin-card__media'));
    detail.hidden = false;
    stage.classList.add('is-open');
    photo.style.visibility = 'hidden';
    centerDetail();
    await fly(image.src, from, rectIn(photo));
    photo.style.visibility = '';
    detail.classList.add('is-shown');
    closeButton.focus({ preventScroll: true });
    busy = false;
  };

  const close = async () => {
    if (busy || !openCard) return;
    busy = true;
    const card = openCard;
    detail.classList.remove('is-shown');
    const from = rectIn(photo);
    const to = rectIn(card.querySelector('.skin-card__media'));
    photo.style.visibility = 'hidden';
    stage.classList.remove('is-open');
    await fly(image.src, from, to);
    detail.hidden = true;
    photo.style.visibility = '';
    openCard = null;
    card.querySelector('.skin-card__link').focus({ preventScroll: true });
    busy = false;
  };

  stage.querySelectorAll('.skin-card').forEach((card) => {
    card.querySelector('.skin-card__link').addEventListener('click', (event) => {
      event.preventDefault();
      open(card);
    });
  });
  closeButton.addEventListener('click', close);
  photo.addEventListener('click', close);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
};

document.querySelectorAll('[data-tips]').forEach(initTips);
