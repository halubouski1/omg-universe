// Account pages on the static site: a demo of
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

  const params = new URLSearchParams(location.search);
  const partner = params.get('account') === 'partner';
  const accountPath = partner ? 'partner-account.html' : 'account.html';

  if (root.hasAttribute('data-auth-page')) {
    const tab = params.get('tab');
    root.querySelectorAll('[data-auth-link]').forEach((link) => {
      const url = new URL(link.href);
      if (partner) url.searchParams.set('account', 'partner');
      if (tab) url.searchParams.set('tab', tab);
      link.href = url.href;
    });
    if (partner) {
      document.querySelector('.header__brand').href = accountPath;
      root.querySelector('[data-auth-label]').textContent = 'Partner account';
      const register = root.querySelector('[data-auth-register]');
      const partnerLink = root.querySelector('[data-auth-partner]');
      if (register) register.hidden = true;
      if (partnerLink) partnerLink.hidden = false;
    }

    root.querySelector('[data-acc-login]')?.addEventListener('submit', (event) => {
      event.preventDefault();
      store.set('in', true);
      location.replace(tab && /^[a-z-]+$/.test(tab) ? accountPath + '#' + tab : accountPath);
    });

    root.querySelector('[data-acc-lost]')?.addEventListener('submit', (event) => {
      event.preventDefault();
      event.currentTarget.reset();
      event.currentTarget.hidden = true;
      root.querySelector('[data-acc-lost-intro]').hidden = true;
      const result = root.querySelector('[data-acc-lost-done]');
      result.hidden = false;
      result.focus();
    });
    return;
  }

  const loginURL = new URL('login.html', location.href);
  if (location.pathname.endsWith('/partner-account.html')) loginURL.searchParams.set('account', 'partner');
  const goToLogin = () => location.replace(loginURL);

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

  root.querySelectorAll('[data-acc-logout]').forEach((button) => button.addEventListener('click', () => {
    store.set('in', false);
    goToLogin();
  }));

  root.querySelectorAll('[data-acc-login]').forEach((form) => form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (valid(form)) {
      history.replaceState(null, '', location.pathname);
      logIn();
    }
  }));

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

  if (store.get('in')) {
    logIn();
    window.addEventListener('hashchange', () => showTab(location.hash.slice(1), false));
  } else if (params.get('view') === 'register' && views.some((view) => view.dataset.accView === 'register')) {
    showView('register');
  } else {
    const tab = location.hash.slice(1);
    if (tabs.some((button) => button.dataset.accTab === tab)) loginURL.searchParams.set('tab', tab);
    goToLogin();
  }
})();
