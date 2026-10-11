// ========================================
// Catalog — category filters, sorting and card animations
// ========================================
const CATALOG_EASE = 'cubic-bezier(.22, 1, .36, 1)';
const CARD_STAGGER_MS = 60;
const CARD_STAGGER_MAX = 8; // later cards share the last delay
const CATALOG_PAGE_SIZE = 12; // products shown at first and per "Load more"

const initCatalog = (catalog) => {
  const grid = catalog.querySelector('[data-catalog-grid]');
  const title = catalog.querySelector('[data-catalog-title]');
  const filters = [...catalog.querySelectorAll('[data-filter]')];
  const cards = [...grid.querySelectorAll('.product')];
  const sortMenu = catalog.querySelector('[data-sort-menu]');
  const moreButton = catalog.querySelector('[data-catalog-more]');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let activeFilter = 'all';
  let activeSort = 'recommended';
  let transitionId = 0; // a newer filter/sort change cancels an older one
  let shownCount = CATALOG_PAGE_SIZE;

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

  // Shows the first shownCount matching products in grid order and hides
  // the rest; "Load more" stays while anything is left. Returns the cards
  // that have just appeared.
  const applyVisibility = () => {
    const ordered = [...grid.querySelectorAll('.product')];
    const matching = ordered.filter(matches);
    const appeared = [];
    ordered.forEach((card) => {
      const isShown = matching.indexOf(card) > -1 && matching.indexOf(card) < shownCount;
      if (isShown && card.hidden) appeared.push(card);
      card.hidden = !isShown;
    });
    if (moreButton) moreButton.parentElement.hidden = matching.length <= shownCount;
    return appeared;
  };

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
    applyVisibility();
    cards.forEach((card) => observer.unobserve(card)); // the grid change replaces the scroll reveal

    if (newTitle) {
      title.textContent = newTitle;
      animateIn(title, [
        { opacity: 0, transform: 'translateY(32px)' },
        { opacity: 1, transform: 'none' },
      ], { duration: 650 });
    }
    revealCards(cards.filter((card) => !card.hidden));
  };

  // First load: only the first page; "Load more" reveals the next one
  applyVisibility();
  moreButton?.addEventListener('click', () => {
    shownCount += CATALOG_PAGE_SIZE;
    const appeared = applyVisibility();
    appeared.forEach((card) => observer.unobserve(card));
    revealCards(appeared);
  });

  filters.forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.filter === activeFilter) return;
      activeFilter = button.dataset.filter;
      shownCount = CATALOG_PAGE_SIZE;
      filters.forEach((item) => {
        const isActive = item === button;
        item.classList.toggle('is-active', isActive);
        item.setAttribute('aria-pressed', String(isActive));
      });
      updateGrid(button.dataset.title);
    });
  });

  // --- Filter row on phones: arrows + scroll --------------------------------
  // The arrows pick the previous/next category; whichever category becomes
  // active is scrolled into the visible part of the row
  const filterList = catalog.querySelector('.catalog__filter-list');
  const prevFilter = catalog.querySelector('[data-filter-prev]');
  const nextFilter = catalog.querySelector('[data-filter-next]');

  const scrollFilterIntoView = (button) => {
    const item = button.parentElement;
    const left = item.offsetLeft - (filterList.clientWidth - item.offsetWidth) / 2;
    filterList.scrollTo({ left, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  };

  const updateFilterRow = () => {
    const index = filters.findIndex((button) => button.dataset.filter === activeFilter);
    if (prevFilter) prevFilter.disabled = index <= 0;
    if (nextFilter) nextFilter.disabled = index >= filters.length - 1;
    const atEnd = filterList.scrollLeft + filterList.clientWidth >= filterList.scrollWidth - 2;
    filterList.classList.toggle('is-at-end', atEnd);
  };

  const stepFilter = (step) => {
    const index = filters.findIndex((button) => button.dataset.filter === activeFilter);
    filters[index + step]?.click();
  };

  filters.forEach((button) => {
    button.addEventListener('click', () => {
      scrollFilterIntoView(button);
      updateFilterRow();
    });
  });
  prevFilter?.addEventListener('click', () => stepFilter(-1));
  nextFilter?.addEventListener('click', () => stepFilter(1));
  filterList.addEventListener('scroll', updateFilterRow, { passive: true });
  window.addEventListener('resize', updateFilterRow);
  updateFilterRow();

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
    shownCount = CATALOG_PAGE_SIZE;
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
