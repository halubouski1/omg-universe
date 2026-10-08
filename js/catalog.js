// ========================================
// Catalog — category filters, sorting and card animations
// ========================================
const CATALOG_EASE = 'cubic-bezier(.22, 1, .36, 1)';
const CARD_STAGGER_MS = 60;
const CARD_STAGGER_MAX = 8; // later cards share the last delay

const initCatalog = (catalog) => {
  const grid = catalog.querySelector('[data-catalog-grid]');
  const title = catalog.querySelector('[data-catalog-title]');
  const filters = [...catalog.querySelectorAll('[data-filter]')];
  const cards = [...grid.querySelectorAll('.product')];
  const sortMenu = catalog.querySelector('[data-sort-menu]');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let activeFilter = 'all';
  let activeSort = 'recommended';
  let transitionId = 0; // a newer filter/sort change cancels an older one

  const animate = (el, keyframes, options) => (
    prefersReducedMotion ? null : el.animate(keyframes, { easing: CATALOG_EASE, fill: 'both', ...options })
  );

  const finished = (animations) => Promise.all(
    animations.filter(Boolean).map((animation) => animation.finished.catch(() => {})),
  );

  // Entrances replace whatever was running (e.g. a fade-out held at 0) and,
  // once done, leave the element on its plain CSS state
  const animateIn = (el, keyframes, options) => {
    el.getAnimations().forEach((animation) => animation.cancel());
    const animation = animate(el, keyframes, { ...options, fill: 'backwards' });
    const settle = () => { el.style.opacity = ''; };
    if (animation) animation.finished.then(settle, () => {});
    else settle();
  };

  // --- Card reveal ---------------------------------------------------------
  const revealCards = (list) => list.forEach((card, index) => {
    animateIn(card, [
      { opacity: 0, transform: 'translateY(40px)' },
      { opacity: 1, transform: 'none' },
    ], { duration: 700, delay: Math.min(index, CARD_STAGGER_MAX) * CARD_STAGGER_MS });
  });

  // First load: each card rises in as it scrolls into view
  const observer = new IntersectionObserver((entries) => {
    const entering = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target);
    entering.forEach((card) => observer.unobserve(card));
    revealCards(entering);
  }, { rootMargin: '0px 0px -60px 0px' });

  if (!prefersReducedMotion) {
    cards.forEach((card) => {
      card.style.opacity = 0;
      observer.observe(card);
    });
  }

  // --- Filter + sort -------------------------------------------------------
  const matches = (card) => activeFilter === 'all' || card.dataset.category === activeFilter;

  const sortCards = () => {
    const byOrder = (a, b) => a.dataset.order - b.dataset.order;
    const byPrice = (a, b) => a.dataset.price - b.dataset.price;
    const compare = {
      recommended: byOrder,
      'price-asc': (a, b) => byPrice(a, b) || byOrder(a, b),
      'price-desc': (a, b) => byPrice(b, a) || byOrder(a, b),
    }[activeSort];
    [...cards].sort(compare).forEach((card) => grid.append(card));
  };

  // Outgoing cards and title fade away, the grid is rebuilt, then the title
  // slides back in and the new cards rise in one after another
  const updateGrid = async (newTitle) => {
    const id = ++transitionId;
    const visible = cards.filter((card) => !card.hidden);

    const outgoing = visible.map((card) => animate(card, [
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: 'translateY(16px)' },
    ], { duration: 250, easing: 'ease-in' }));
    if (newTitle) {
      outgoing.push(animate(title, [
        { opacity: 1, transform: 'none' },
        { opacity: 0, transform: 'translateY(-24px)' },
      ], { duration: 250, easing: 'ease-in' }));
    }
    await finished(outgoing);
    if (id !== transitionId) return;

    sortCards();
    cards.forEach((card) => {
      card.hidden = !matches(card);
      observer.unobserve(card); // the grid change replaces the scroll reveal
    });

    if (newTitle) {
      title.textContent = newTitle;
      animateIn(title, [
        { opacity: 0, transform: 'translateY(32px)' },
        { opacity: 1, transform: 'none' },
      ], { duration: 650 });
    }
    revealCards(cards.filter((card) => !card.hidden));
  };

  filters.forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.filter === activeFilter) return;
      activeFilter = button.dataset.filter;
      filters.forEach((item) => {
        const isActive = item === button;
        item.classList.toggle('is-active', isActive);
        item.setAttribute('aria-pressed', String(isActive));
      });
      updateGrid(button.dataset.title);
    });
  });

  // --- Sort dropdown -------------------------------------------------------
  if (!sortMenu) return;
  const sortButton = sortMenu.querySelector('.sort__button');
  const options = [...sortMenu.querySelectorAll('[data-sort]')];

  const setOpen = (isOpen, { focusButton = false } = {}) => {
    sortMenu.classList.toggle('is-open', isOpen);
    sortButton.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) (options.find((option) => option.classList.contains('is-selected')) || options[0]).focus();
    else if (focusButton) sortButton.focus();
  };

  const choose = (option) => {
    setOpen(false, { focusButton: true });
    if (option.dataset.sort === activeSort) return;
    activeSort = option.dataset.sort;
    options.forEach((item) => {
      const isSelected = item === option;
      item.classList.toggle('is-selected', isSelected);
      item.setAttribute('aria-selected', String(isSelected));
    });
    updateGrid();
  };

  sortButton.addEventListener('click', () => setOpen(!sortMenu.classList.contains('is-open')));
  options.forEach((option) => option.addEventListener('click', () => choose(option)));

  sortMenu.addEventListener('keydown', (event) => {
    const index = options.indexOf(document.activeElement);
    if (event.key === 'Escape') {
      setOpen(false, { focusButton: true });
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!sortMenu.classList.contains('is-open')) {
        setOpen(true);
        return;
      }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      options[(index + step + options.length) % options.length].focus();
    } else if ((event.key === 'Enter' || event.key === ' ') && index !== -1) {
      event.preventDefault();
      choose(options[index]);
    }
  });

  document.addEventListener('click', (event) => {
    if (!sortMenu.contains(event.target)) setOpen(false);
  });
};

document.querySelectorAll('.catalog').forEach(initCatalog);
