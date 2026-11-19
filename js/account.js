// Accounts on the static site (account.html, partner-account.html): a demo of
// the WordPress «My account» — log in / register / reset password, tabs
// (#orders, #returns …), forms that confirm instead of saving. On WordPress
// the same tabs are real WooCommerce account pages and this file isn't loaded.
(() => {
  const root = document.querySelector('[data-acc]');
  if (!root) return;

  const views = [...root.querySelectorAll('[data-acc-view]')];
  const tabs = [...root.querySelectorAll('[data-acc-tab]')];
  const panels = [...root.querySelectorAll('[data-acc-panel]')];
  const KEY = 'omg-demo-account';

  const store = {
    get: (name) => { try { return JSON.parse(sessionStorage.getItem(KEY) || '{}')[name]; } catch { return undefined; } },
    set: (name, value) => {
      try {
        const data = JSON.parse(sessionStorage.getItem(KEY) || '{}');
        data[name] = value;
        sessionStorage.setItem(KEY, JSON.stringify(data));
      } catch { /* private mode: the demo just forgets */ }
    },
  };

  const showView = (name) => {
    views.forEach((view) => { view.hidden = view.dataset.accView !== name; });
    window.scrollTo({ top: 0 });
  };

  const showTab = (name, push = true) => {
    const tab = tabs.find((t) => t.dataset.accTab === name) || tabs[0];
    if (!tab) return;
    tabs.forEach((t) => t.classList.toggle('is-active', t === tab));
    panels.forEach((p) => { p.hidden = p.dataset.accPanel !== tab.dataset.accTab; });
    if (push) history.replaceState(null, '', `#${tab.dataset.accTab}`);
  };

  const logIn = () => {
    store.set('in', true);
    showView('cabinet');
    showTab(location.hash.slice(1), false);
  };

  const valid = (form) => {
    const fields = [...form.querySelectorAll('[required]')];
    fields.forEach((f) => f.classList.toggle('is-invalid', !f.checkValidity()));
    const bad = fields.find((f) => !f.checkValidity());
    bad?.focus();
    return !bad;
  };

  root.addEventListener('input', (e) => e.target.classList?.remove('is-invalid'));
  root.addEventListener('change', (e) => e.target.classList?.remove('is-invalid'));

  tabs.forEach((tab) => tab.addEventListener('click', () => showTab(tab.dataset.accTab)));

  root.querySelectorAll('[data-acc-show]').forEach((button) => button.addEventListener('click', () => {
    root.querySelector('[data-acc-lost-done]').hidden = true;
    root.querySelector('[data-acc-lost]').hidden = false;
    showView(button.dataset.accShow);
  }));

  root.querySelectorAll('[data-acc-logout]').forEach((button) => button.addEventListener('click', () => {
    store.set('in', false);
    history.replaceState(null, '', location.pathname);
    showView('auth');
  }));

  root.querySelectorAll('[data-acc-login]').forEach((form) => form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (valid(form)) logIn();
  }));

  root.querySelector('[data-acc-lost]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!valid(e.target)) return;
    e.target.hidden = true;
    root.querySelector('[data-acc-lost-done]').hidden = false;
  });

  // Orders: «View» opens the line with the order details
  root.querySelectorAll('[data-acc-toggle]').forEach((button) => button.addEventListener('click', () => {
    const row = document.getElementById(button.dataset.accToggle);
    row.hidden = !row.hidden;
    button.textContent = row.hidden ? 'View' : 'Hide';
  }));

  // Return request → confirmation + a new line in «Your return requests»
  root.querySelector('[data-acc-return]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    if (!valid(form)) return;
    const order = form.order.value;
    const list = root.querySelector('[data-acc-return-list]');
    const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const row = document.createElement('tr');
    row.innerHTML = `<td>R-${1022 + list.children.length}</td><td>#${order}</td><td>${date}</td><td></td><td><span class="acc__badge acc__badge--requested">Requested</span></td>`;
    row.children[3].textContent = form.reason.value;
    list.prepend(row);
    root.querySelector('[data-acc-return-order]').textContent = `#${order}`;
    root.querySelector('[data-acc-return-done]').hidden = false;
    form.reset();
  });

  // Promo code → saved (shown on the dashboard too)
  const savedCode = root.querySelector('[data-acc-saved-code]');
  const showSaved = (code) => { if (savedCode && code) savedCode.textContent = code; };
  showSaved(store.get('code'));
  root.querySelector('[data-acc-promo]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    if (!valid(form)) return;
    const code = form.promo_code.value.trim().toUpperCase();
    store.set('code', code);
    showSaved(code);
    root.querySelector('[data-acc-promo-code]').textContent = code;
    root.querySelector('[data-acc-promo-done]').hidden = false;
    form.reset();
  });

  // Addresses / account details: confirm the save; new passwords must match
  root.querySelectorAll('[data-acc-save]').forEach((form) => form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!valid(form)) return;
    const p1 = form.password_1;
    const p2 = form.password_2;
    if (p1 && p1.value !== p2.value) {
      p2.classList.add('is-invalid');
      p2.focus();
      return;
    }
    const done = form.parentElement.querySelector('[data-acc-form-done]');
    if (done) done.hidden = false;
    if (p1) { p1.value = ''; p2.value = ''; form.password_current.value = ''; }
  }));

  // Copy code / link (partner)
  root.querySelectorAll('[data-copy]').forEach((button) => button.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(button.dataset.copy); } catch { return; }
    const label = button.textContent;
    button.textContent = 'Copied';
    button.classList.add('is-copied');
    setTimeout(() => { button.textContent = label; button.classList.remove('is-copied'); }, 1600);
  }));

  // Opened with #orders etc. or already logged in during this visit → straight to the account
  if (store.get('in') || location.hash.length > 1) logIn();
  // A link to another tab on the same page (account.html#returns)
  window.addEventListener('hashchange', () => { if (location.hash.length > 1) logIn(); });
})();
