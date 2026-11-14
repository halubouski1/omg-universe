// ========================================
// Tracking page — lookup mode tabs and validation
// ========================================
// "Order Details" asks for order ID + e-mail, "Tracking Number" for the number
// alone; the bar under the tabs slides to the active one. The lookup and the
// result panel work in WordPress only (see createLookup below).
const initTracking = (form) => {
  const card = form.closest('.tracking-card');
  const tabs = [...card.querySelectorAll('[data-track-mode]')];
  const bar = card.querySelector('.tracking-card__progress-bar');
  const groups = [...form.querySelectorAll('[data-track-fields]')];
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let mode = 'order';

  // Bar runs from just before the active tab to 20px past it. Layout offsets,
  // not getBoundingClientRect, so the card's zoom-in entrance can't skew it.
  const moveBar = (tab) => {
    const track = bar.parentElement;
    const left = Math.max(tab.offsetLeft - track.offsetLeft - 12, 0);
    const right = Math.min(tab.offsetLeft + tab.offsetWidth - track.offsetLeft + 20, track.offsetWidth);
    bar.style.left = `${left}px`;
    bar.style.width = `${right - left}px`;
  };

  const setMode = (next) => {
    if (next === mode) return;
    mode = next;
    tabs.forEach((tab) => {
      const isActive = tab.dataset.trackMode === next;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
      if (isActive) moveBar(tab);
    });
    groups.forEach((group) => {
      const show = group.dataset.trackFields === next;
      group.hidden = !show;
      if (show && !prefersReducedMotion) {
        group.animate(
          [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
          { duration: 450, easing: 'cubic-bezier(.22, 1, .36, 1)' },
        );
      }
    });
  };

  tabs.forEach((tab) => tab.addEventListener('click', () => setMode(tab.dataset.trackMode)));
  window.addEventListener('resize', () => moveBar(tabs.find((t) => t.classList.contains('is-active'))));
  moveBar(tabs[0]);
  // Tab widths change once the web font loads
  document.fonts?.ready.then(() => moveBar(tabs.find((t) => t.classList.contains('is-active'))));

  const isValid = (input) => input.value.trim() !== '' && input.checkValidity();

  form.querySelectorAll('.tracking-card__input').forEach((input) => {
    input.addEventListener('input', () => {
      if (input.classList.contains('is-invalid')) input.classList.toggle('is-invalid', !isValid(input));
    });
  });

  // The lookup itself lives on the server (WordPress: REST omg/v1/track,
  // settings in window.omgTracking). The static page has no backend, so
  // without omgTracking the form validates and stops, as before.
  const config = window.omgTracking;
  const onTrack = config ? createLookup(form, card, config, () => mode) : () => {};

  // ?number=… (link from the "on its way" e-mail): switch to the number tab
  // and look the parcel up straight away.
  if (config?.number) {
    setMode('number');
    form.querySelector('#track-number').value = config.number;
    onTrack();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const fields = [...form.querySelectorAll(`[data-track-fields="${mode}"] .tracking-card__input`)];
    const invalid = fields.filter((input) => !isValid(input));
    fields.forEach((input) => {
      const bad = invalid.includes(input);
      input.classList.toggle('is-invalid', bad);
      input.setAttribute('aria-invalid', String(bad));
    });
    if (invalid.length) {
      invalid[0].focus();
      return;
    }
    onTrack();
  });
};

// ========================================
// Tracking result (WordPress only) — carrier, status, event timeline
// ========================================
// The result panel sits under the card. It is created up front (empty) so
// the role="status" live region exists before its text changes and screen
// readers announce the result.
const createLookup = (form, card, config, getMode) => {
  const text = config.text || {};
  const submit = form.querySelector('.tracking-card__submit');
  const result = document.createElement('div');
  result.className = 'tracking-result';
  result.setAttribute('role', 'status');
  result.setAttribute('aria-live', 'polite');
  result.hidden = true;
  card.after(result);

  const el = (tag, className, content) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content != null) node.textContent = content;
    return node;
  };

  const show = (nodes, state) => {
    result.className = `tracking-result${state ? ` tracking-result--${state}` : ''}`;
    result.replaceChildren(...nodes);
    result.hidden = false;
  };

  const message = (copy, state) => show([el('p', 'tracking-result__message', copy)], state);

  const carrierLink = (data) => {
    if (!data.url) return null;
    const link = el('a', 'tracking-result__link');
    link.href = data.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.append(
      (text.link || '{carrier}').replace('{carrier}', data.carrier_name),
      card.querySelector('.tracking-card__arrow').cloneNode(true),
    );
    return link;
  };

  const facts = (data) => {
    const list = el('dl', 'tracking-result__facts');
    const add = (label, value) => {
      if (!value) return;
      const row = el('div', 'tracking-result__fact');
      row.append(el('dt', 'tracking-result__label', label), el('dd', 'tracking-result__value', value));
      list.append(row);
    };
    add(text.order, data.order ? `#${data.order.number}` : '');
    add(text.carrier, data.carrier_name);
    add(text.number, data.number);
    return list;
  };

  const render = (data) => {
    const status = data.status;
    if (status === 'rate_limited') return message(text.rateLimited, 'error');
    if (status === 'order_not_found') return message(text.orderNotFound, 'empty');
    if (status === 'not_found' && !data.carrier) return message(text.notFound, 'empty');
    if (status === 'error' && !data.carrier) return message(text.error, 'error');

    if (status === 'pending') {
      const head = el('div', 'tracking-result__head');
      head.append(el('p', 'tracking-result__status', data.order.status), facts(data));
      return show([head, el('p', 'tracking-result__message', text.pending)], 'pending');
    }

    const state = status === 'ok' ? data.state : 'unknown';
    const head = el('div', 'tracking-result__head');
    const badge = el('p', `tracking-result__status tracking-result__status--${state}`, (config.states || {})[state] || data.status_text);
    head.append(badge, facts(data));
    const nodes = [head];

    if (status === 'ok') {
      if (data.status_text && data.status_text !== badge.textContent) {
        nodes.push(el('p', 'tracking-result__summary', data.status_text));
      }
      nodes.push(el('p', 'tracking-result__title', text.history));
      if (data.events.length) {
        const list = el('ol', 'tracking-result__events');
        data.events.forEach((event) => {
          const item = el('li', 'tracking-result__event');
          const time = el('time', 'tracking-result__date', event.date_text);
          if (event.date) time.dateTime = event.date;
          item.append(time, el('p', 'tracking-result__desc', event.description));
          if (event.location) item.append(el('p', 'tracking-result__place', event.location));
          list.append(item);
        });
        nodes.push(list);
      } else {
        nodes.push(el('p', 'tracking-result__message', text.noEvents));
      }
    } else {
      const copy = { unavailable: text.unavailable, not_found: text.notFound }[status] || text.error;
      nodes.push(el('p', 'tracking-result__message', copy));
    }

    const link = carrierLink(data);
    if (link) nodes.push(link);
    return show(nodes, status === 'ok' ? state : status);
  };

  let request = null;

  return async () => {
    const payload = getMode() === 'number'
      ? { number: form.querySelector('#track-number').value.trim() }
      : { order: form.querySelector('#track-order-id').value.trim(), email: form.querySelector('#track-email').value.trim() };

    request?.abort();
    const current = new AbortController();
    request = current;
    message(text.loading, 'loading');
    result.setAttribute('aria-busy', 'true');
    submit.disabled = true;

    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': config.nonce },
        body: JSON.stringify(payload),
        credentials: 'same-origin',
        signal: current.signal,
      });
      const data = await response.json().catch(() => ({ status: 'error' }));
      render(response.status === 429 ? { status: 'rate_limited' } : data);
    } catch (error) {
      if (error.name === 'AbortError') return;
      render({ status: 'error' });
    } finally {
      if (request === current) {
        result.removeAttribute('aria-busy');
        submit.disabled = false;
      }
    }
    result.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
};

document.querySelectorAll('[data-tracking-form]').forEach(initTracking);
