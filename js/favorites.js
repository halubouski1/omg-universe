// ========================================
// Favourites page — lists the products saved by the hearts (main.js keeps
// them in localStorage). Each card is the catalog card with an "Add to cart"
// button under it; removing the heart here takes the card away, and the
// empty state comes back once the list is empty.
// ========================================
const CART_ICON = `<img src="${themeAsset('icons/btn-cart.svg')}" alt="" width="21" height="21">`;

// WordPress: products saved with their id are drawn by the server (the same
// card template as the catalog, with today's price and photo). Returns
// id → <li>; empty when there is no server or the request fails.
const fetchFavCards = async (ids) => {
  const ajaxUrl = window.omgFavorites?.ajaxUrl;
  if (!ajaxUrl || !ids.length) return new Map();
  try {
    const response = await fetch(`${ajaxUrl}?action=omg_favorites_cards&ids=${ids.join(',')}`, { credentials: 'same-origin' });
    const json = await response.json();
    const template = document.createElement('template');
    template.innerHTML = json?.data?.html || '';
    return new Map([...template.content.children].map((li) => [li.dataset.favId, li]));
  } catch {
    return new Map();
  }
};

const initFavorites = () => {
  const list = document.querySelector('[data-favorites-list]');
  const grid = document.querySelector('[data-favorites-grid]');
  const empty = document.querySelector('[data-favorites-empty]');
  if (!list || !grid || !empty) return;

  // Built with DOM methods: the stored text never goes in as HTML
  const renderCard = (product) => {
    const li = document.createElement('li');
    li.className = 'product favorites__item';
    li.innerHTML = `
      <article class="product__card">
        <div class="product__media">
          <img class="product__image" alt="" width="461" height="622" loading="lazy">
          <button class="product__add" type="button"></button>
          <button class="product__fav is-active" type="button" aria-pressed="true"></button>
        </div>
        <div class="product__info">
          <div class="product__meta">
            <span class="product__size"></span>
            <h2 class="product__name"><a class="product__link"></a></h2>
          </div>
          <p class="product__price"></p>
        </div>
      </article>
      <button class="favorites__cart" type="button">Add to cart ${CART_ICON}</button>`;
    li.querySelector('.product__image').src = product.image;
    li.querySelector('.product__size').textContent = product.size;
    const link = li.querySelector('.product__link');
    link.textContent = product.name;
    link.href = product.href;
    li.querySelector('.product__price').textContent = product.price;
    li.querySelector('.product__add').setAttribute('aria-label', `Add ${product.name} to cart`);
    li.querySelector('.product__fav').setAttribute('aria-label', `Remove ${product.name} from favorites`);
    li.dataset.favId = product.id;
    // the big button does what the card's "+" does
    li.querySelector('.favorites__cart').addEventListener('click', () => li.querySelector('.product__add').click());
    return li;
  };

  const sortMenu = document.querySelector('[data-sort-menu]');
  const sortButton = sortMenu?.querySelector('.sort__button');

  const sync = () => {
    const hasItems = grid.children.length > 0;
    list.hidden = !hasItems;
    empty.hidden = hasItems;
    // Sort by works only while there is something to sort
    if (sortButton) {
      sortButton.disabled = !hasItems;
      if (!hasItems) sortMenu.classList.remove('is-open');
    }
  };

  // data-order keeps the order products were added in ("Recommended"),
  // data-price the number for the price sorts
  const render = (serverCards) => {
    readFavs().forEach((product, index) => {
      let li;
      if (product.productId && window.omgFavorites) {
        // a product removed from the shop has no card any more: skip it
        li = serverCards.get(String(product.productId));
        if (!li) return;
        li.querySelector('.favorites__cart')?.addEventListener('click', () => li.querySelector('.product__add')?.click());
        const heart = li.querySelector('.product__fav');
        if (heart) setFavButton(heart, true); // the server draws hearts off
      } else {
        li = renderCard(product);
      }
      li.dataset.order = String(index);
      li.dataset.price ||= String(parseFloat(product.price.replace(/[^\d.,]/g, '').replace(',', '.')) || 0);
      grid.append(li);
    });
    sync();
    revealFavCards(grid);
  };

  const serverIds = window.omgFavorites ? readFavs().map((f) => f.productId).filter(Boolean) : [];
  if (serverIds.length) {
    empty.hidden = true; // no "empty" flash while the cards load
    fetchFavCards(serverIds).then(render);
  } else {
    render(new Map());
  }

  initFavSort(grid);

  // Heart switched off here: the card fades out, then the grid closes up
  document.addEventListener('favorites:change', ({ detail }) => {
    if (detail.isActive) return;
    const item = [...grid.children].find((li) => li.dataset.favId === detail.id);
    if (!item) return;
    const done = () => { item.remove(); sync(); };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { done(); return; }
    item.animate(
      [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.96)' }],
      { duration: 350, easing: 'ease-in', fill: 'forwards' },
    ).finished.then(done, done);
  });
};

// Sort by — the same dropdown and keys as the catalog's (catalog.js):
// Recommended (order added), price low → high, high → low. The cards
// fade out, reorder and rise back in.
const initFavSort = (grid) => {
  const sortMenu = document.querySelector('[data-sort-menu]');
  if (!sortMenu) return;
  const sortButton = sortMenu.querySelector('.sort__button');
  const options = [...sortMenu.querySelectorAll('[data-sort]')];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let activeSort = 'recommended';

  const setOpen = (isOpen, { focusButton = false } = {}) => {
    if (sortButton.disabled) isOpen = false;
    sortMenu.classList.toggle('is-open', isOpen);
    sortButton.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) (options.find((option) => option.classList.contains('is-selected')) || options[0]).focus();
    else if (focusButton) sortButton.focus();
  };

  const reorder = () => {
    const byOrder = (a, b) => a.dataset.order - b.dataset.order;
    const byPrice = (a, b) => a.dataset.price - b.dataset.price;
    const compare = {
      recommended: byOrder,
      'price-asc': (a, b) => byPrice(a, b) || byOrder(a, b),
      'price-desc': (a, b) => byPrice(b, a) || byOrder(a, b),
    }[activeSort];
    const items = [...grid.children];
    if (reduced) { items.sort(compare).forEach((li) => grid.append(li)); return; }
    Promise.all(items.map((li) => li.animate(
      [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(16px)' }],
      { duration: 250, easing: 'ease-in', fill: 'forwards' },
    ).finished.catch(() => {}))).then(() => {
      items.sort(compare).forEach((li) => grid.append(li));
      items.forEach((li) => li.getAnimations().forEach((a) => a.cancel()));
      [...grid.children].forEach((li, i) => li.animate(
        [{ opacity: 0, transform: 'translateY(40px)' }, { opacity: 1, transform: 'none' }],
        { duration: 700, delay: Math.min(i, 8) * 60, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'backwards' },
      ));
    });
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
    reorder();
  };

  sortButton.addEventListener('click', () => setOpen(!sortMenu.classList.contains('is-open')));
  options.forEach((option) => option.addEventListener('click', () => choose(option)));

  sortMenu.addEventListener('keydown', (event) => {
    const index = options.indexOf(document.activeElement);
    if (event.key === 'Escape') {
      setOpen(false, { focusButton: true });
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!sortMenu.classList.contains('is-open')) { setOpen(true); return; }
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

// Entrance: like the catalog, each card rises in (40px, fading) as it comes
// into view, one after another within a row
const revealFavCards = (grid) => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const items = [...grid.children];
  items.forEach((li) => { li.style.opacity = 0; });
  const observer = new IntersectionObserver((entries) => {
    const entering = entries.filter((e) => e.isIntersecting).map((e) => e.target);
    entering.forEach((li, i) => {
      observer.unobserve(li);
      li.animate(
        [{ opacity: 0, transform: 'translateY(40px)' }, { opacity: 1, transform: 'none' }],
        { duration: 700, delay: Math.min(i, 8) * 60, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'backwards' },
      ).finished.then(() => { li.style.opacity = ''; }, () => { li.style.opacity = ''; });
    });
  }, { rootMargin: '0px 0px -60px 0px' });
  items.forEach((li) => observer.observe(li));
};

initFavorites();
