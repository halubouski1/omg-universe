// Custom dropdowns for the <select>s of the account pages — the look of the
// catalog's sort menu (white list, soft shadow, green dot on the chosen
// option). The native <select> stays in the form (hidden) and keeps value,
// validation and the change event; the button and the list only drive it.
(() => {
  const enhance = (select) => {
    if (select.dataset.enhanced || select.multiple) return;
    select.dataset.enhanced = '1';

    const wrap = document.createElement('div');
    wrap.className = 'acc-select';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'acc-select__button';
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    const text = document.createElement('span');
    text.className = 'acc-select__text';
    const chevron = document.createElement('span');
    chevron.className = 'acc-select__chevron';
    chevron.setAttribute('aria-hidden', 'true');
    button.append(text, chevron);
    if (select.id) {
      button.id = `${select.id}-button`;
      const label = document.querySelector(`label[for="${select.id}"]`);
      if (label) { label.htmlFor = button.id; button.setAttribute('aria-label', label.textContent.trim()); }
    }

    const list = document.createElement('ul');
    list.className = 'acc-select__menu';
    list.setAttribute('role', 'listbox');

    const options = [...select.options].map((option, index) => {
      const li = document.createElement('li');
      li.className = 'acc-select__option';
      li.setAttribute('role', 'option');
      li.tabIndex = -1;
      li.textContent = option.textContent;
      li.dataset.index = String(index);
      if (!option.value) li.classList.add('is-placeholder');
      list.append(li);
      return li;
    });

    select.classList.add('acc-select__native');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    select.after(wrap);
    wrap.append(select, button, list);

    const sync = () => {
      const current = select.options[select.selectedIndex];
      text.textContent = current ? current.textContent : '';
      button.classList.toggle('is-placeholder', !current || !current.value);
      options.forEach((li, i) => {
        const on = i === select.selectedIndex && Boolean(select.options[i].value);
        li.classList.toggle('is-selected', on);
        li.setAttribute('aria-selected', String(on));
      });
    };

    const open = (state) => {
      wrap.classList.toggle('is-open', state);
      button.setAttribute('aria-expanded', String(state));
      if (state) (options.find((li) => li.classList.contains('is-selected')) || options.find((li) => !li.classList.contains('is-placeholder')))?.focus({ preventScroll: true });
    };

    const choose = (index) => {
      select.selectedIndex = index;
      select.classList.remove('is-invalid');
      select.dispatchEvent(new Event('change', { bubbles: true }));
      sync();
      open(false);
      button.focus({ preventScroll: true });
    };

    button.addEventListener('click', () => open(!wrap.classList.contains('is-open')));
    button.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(true); }
    });
    list.addEventListener('click', (e) => {
      const li = e.target.closest('.acc-select__option');
      if (li && !li.classList.contains('is-placeholder')) choose(Number(li.dataset.index));
    });
    list.addEventListener('keydown', (e) => {
      const usable = options.filter((li) => !li.classList.contains('is-placeholder'));
      const at = usable.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); usable[Math.min(at + 1, usable.length - 1)]?.focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); usable[Math.max(at - 1, 0)]?.focus(); }
      if ((e.key === 'Enter' || e.key === ' ') && at > -1) { e.preventDefault(); choose(Number(usable[at].dataset.index)); }
      if (e.key === 'Escape' || e.key === 'Tab') { open(false); button.focus(); }
    });
    document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) open(false); });
    select.addEventListener('change', sync);
    select.form?.addEventListener('reset', () => setTimeout(sync));
    // Validation marks the native select (is-invalid) — show it on the button
    new MutationObserver(() => wrap.classList.toggle('is-invalid', select.classList.contains('is-invalid')))
      .observe(select, { attributes: true, attributeFilter: ['class'] });

    sync();
  };

  // WooCommerce's country/state fields use their own search box (selectWoo)
  document.querySelectorAll('.acc select:not(.country_select):not(.state_select)').forEach(enhance);
})();
