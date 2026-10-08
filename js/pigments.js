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
  // eslint-disable-next-line no-new
  new Swiper(root, {
    slidesPerView: 4,
    spaceBetween: 16,
    speed: 600,
    loop: true,
    grabCursor: true,
    navigation: {
      prevEl: section.querySelector('[data-cover-prev]'),
      nextEl: section.querySelector('[data-cover-next]'),
    },
  });
};

document.querySelectorAll('[data-cover-slider]').forEach(initCoverSlider);
