// ========================================
// Checkout — two steps (Shipping & Billing -> Payment) in one form
// ========================================
// Each step validates only its own visible fields. Switching steps fades the
// old block out and staggers the new one in, cross-fades the background
// figure, updates the step tabs and turns the summary button into a green
// "Checkout". Placing the order has no design yet: hook it in completeOrder().
const CHECKOUT_EASE = 'cubic-bezier(.22, 1, .36, 1)';

const initCheckout = (form) => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const steps = Object.fromEntries(
    [...form.querySelectorAll('[data-step]')].map((el) => [el.dataset.step, el]),
  );
  const tabs = [...document.querySelectorAll('[data-step-tab]')];
  const figures = [...document.querySelectorAll('[data-step-figure]')];
  const summary = document.querySelector('.checkout-summary');
  const summaryLabel = document.querySelector('[data-summary-label]');
  const cardFields = form.querySelector('[data-card-fields]');
  const panel = form.closest('.checkout-panel');
  let current = 'shipping';
  let isSwitching = false;

  const animate = (el, keyframes, options) => (
    prefersReducedMotion ? null : el.animate(keyframes, { easing: CHECKOUT_EASE, ...options })
  );
  const finished = (animations) => Promise.all(
    animations.filter(Boolean).map((a) => a.finished.catch(() => {})),
  );

  // --- Validation ----------------------------------------------------------
  const isPayingByCard = () => form.elements.payment?.value === 'card';

  const fieldsToCheck = (step) => [...steps[step].querySelectorAll('input[required]')]
    .filter((input) => !(input.matches('[data-card-input]') && !isPayingByCard()));

  const isValid = (input) => (
    input.type === 'checkbox' ? input.checked : input.value.trim() !== '' && input.checkValidity()
  );

  const markField = (input) => {
    const invalid = !isValid(input);
    input.classList.toggle('is-invalid', invalid);
    input.setAttribute('aria-invalid', String(invalid));
    return !invalid;
  };

  const shake = (el) => animate(el, [
    { transform: 'translateX(0)' },
    { transform: 'translateX(-6px)' },
    { transform: 'translateX(5px)' },
    { transform: 'translateX(-3px)' },
    { transform: 'translateX(0)' },
  ], { duration: 400, easing: 'ease-out' });

  // An error only shows once a field has been left or the step submitted
  form.querySelectorAll('input[required]').forEach((input) => {
    const recheck = () => { if (input.classList.contains('is-invalid')) markField(input); };
    input.addEventListener('blur', () => { if (input.value && input.type !== 'checkbox') markField(input); });
    input.addEventListener('input', recheck);
    input.addEventListener('change', recheck);
  });

  // --- Card input formatting -----------------------------------------------
  form.querySelectorAll('[data-format]').forEach((input) => {
    input.addEventListener('input', () => {
      const digits = input.value.replace(/\D/g, '');
      if (input.dataset.format === 'card') {
        input.value = digits.slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
      } else if (input.dataset.format === 'expiry') {
        input.value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2, 4)}` : digits;
      }
    });
  });

  // --- PayPal hides the card fields ----------------------------------------
  const setCardFields = (show) => {
    if (!cardFields) return;
    const from = cardFields.hidden ? 0 : cardFields.offsetHeight;
    cardFields.hidden = false;
    cardFields.style.height = '';
    const to = show ? cardFields.offsetHeight : 0;
    if (!show) cardFields.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
    const animation = animate(cardFields, [
      { height: `${from}px`, opacity: from ? 1 : 0 },
      { height: `${to}px`, opacity: show ? 1 : 0 },
    ], { duration: 500 });
    const settle = () => { cardFields.hidden = !show; };
    if (animation) animation.finished.then(settle, () => {});
    else settle();
  };

  form.querySelectorAll('input[name="payment"]').forEach((radio) => {
    radio.addEventListener('change', () => setCardFields(isPayingByCard()));
  });

  // --- Step switching --------------------------------------------------------
  const swapSummaryLabel = (text) => {
    if (!summaryLabel || summaryLabel.textContent === text) return;
    const out = animate(summaryLabel, [
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: 'translateY(-8px)' },
    ], { duration: 200, easing: 'ease-in' });
    if (!out) {
      summaryLabel.textContent = text;
      return;
    }
    out.finished.then(() => {
      summaryLabel.textContent = text;
      animate(summaryLabel, [
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'none' },
      ], { duration: 400 });
    }, () => {});
  };

  const updateChrome = (step) => {
    const order = ['shipping', 'payment'];
    tabs.forEach((tab) => {
      const isCurrent = tab.dataset.stepTab === step;
      const isDone = order.indexOf(tab.dataset.stepTab) < order.indexOf(step);
      tab.classList.toggle('is-active', isCurrent);
      tab.classList.toggle('is-done', isDone);
      tab.querySelector('button').disabled = !isDone;
      if (isCurrent) tab.setAttribute('aria-current', 'step');
      else tab.removeAttribute('aria-current');
    });

    figures.forEach((figure) => figure.classList.toggle('is-active', figure.dataset.stepFigure === step));

    const isPayment = step === 'payment';
    summary?.classList.toggle('is-payment', isPayment);
    swapSummaryLabel(isPayment ? 'Checkout' : 'Continue');
  };

  const goTo = async (step) => {
    if (step === current || isSwitching) return;
    isSwitching = true;
    const from = steps[current];
    const to = steps[step];
    updateChrome(step);

    await finished([animate(from, [
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: 'translateY(-16px)' },
    ], { duration: 300, easing: 'ease-in' })]);

    from.hidden = true;
    to.hidden = false;
    current = step;

    // Each block of the new step rises in after the previous one
    [...to.children].forEach((child, index) => animate(child, [
      { opacity: 0, transform: 'translateY(24px)' },
      { opacity: 1, transform: 'none' },
    ], { duration: 650, delay: index * 90, fill: 'backwards' }));

    if (panel && panel.getBoundingClientRect().top < 0) {
      panel.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }
    to.querySelector('input')?.focus({ preventScroll: true });
    isSwitching = false;
  };

  tabs.forEach((tab) => {
    tab.querySelector('button').addEventListener('click', () => goTo(tab.dataset.stepTab));
  });

  const completeOrder = () => {
    // No order confirmation design yet — place the real submit here.
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (isSwitching) return;
    const invalid = fieldsToCheck(current).filter((input) => !markField(input));
    if (invalid.length) {
      invalid.forEach((input) => shake(input.type === 'checkbox' ? input.closest('label') : input));
      invalid[0].focus();
      return;
    }
    if (current === 'shipping') goTo('payment');
    else completeOrder();
  });
};

document.querySelectorAll('[data-checkout-form]').forEach(initCheckout);
