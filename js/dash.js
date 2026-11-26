// ========================================
// Account dashboard (account.html, partner-account.html and the WordPress
// «My account»): greeting with today's date, the dotted ring of the last
// order, dot-matrix month charts and the activity filter.
// ========================================
(() => {
  const root = document.querySelector('.dash');
  if (!root) return;

  // --- Greeting: "Good morning, Maria" + "Here’s your account on Wednesday, 26 November."
  const now = new Date();
  const hour = now.getHours();
  const hello = root.querySelector('[data-dash-hello]');
  if (hello) hello.textContent = hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dateLine = root.querySelector('[data-dash-date]');
  if (dateLine) {
    const weekday = now.toLocaleDateString('en-GB', { weekday: 'long' });
    const day = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
    dateLine.textContent = `Here’s your account on ${weekday}, ${day}.`;
  }

  const SVG = 'http://www.w3.org/2000/svg';

  // --- Ring of dots: the outer ring fills up with the order steps
  // (placed → paid → shipped → delivered), inner rings are texture
  root.querySelectorAll('[data-dash-ring]').forEach((ring) => {
    const done = Number(ring.dataset.dashRing) || 0;
    const steps = Number(ring.dataset.dashRingSteps) || 4;
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 200 200');
    svg.setAttribute('class', 'dash-ring__svg');
    [{ r: 92, n: 64 }, { r: 76, n: 52 }, { r: 60, n: 40 }, { r: 44, n: 28 }].forEach(({ r, n }, ringIndex) => {
      for (let i = 0; i < n; i++) {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        const dot = document.createElementNS(SVG, 'circle');
        dot.setAttribute('cx', (100 + r * Math.cos(angle)).toFixed(2));
        dot.setAttribute('cy', (100 + r * Math.sin(angle)).toFixed(2));
        dot.setAttribute('r', ringIndex === 0 ? 2.6 : 1.6);
        const share = i / n;
        let cls = 'is-empty';
        if (ringIndex === 0 && share < done / steps) cls = share < (done / steps) * 0.55 ? 'is-done' : 'is-fresh';
        dot.setAttribute('class', cls);
        svg.append(dot);
      }
    });
    const end = (done / steps) * Math.PI * 2 - Math.PI / 2;
    const marker = document.createElementNS(SVG, 'circle');
    marker.setAttribute('cx', (100 + 92 * Math.cos(end)).toFixed(2));
    marker.setAttribute('cy', (100 + 92 * Math.sin(end)).toFixed(2));
    marker.setAttribute('r', 5.5);
    marker.setAttribute('class', 'is-now');
    svg.append(marker);
    ring.prepend(svg);
  });

  // --- Dot-matrix columns: one column per month, dots stacked to the value;
  // the best month is drawn brighter, empty months keep one base dot
  root.querySelectorAll('[data-dash-dots]').forEach((chart) => {
    const values = chart.dataset.dashDots.split(',').map(Number);
    const labels = (chart.dataset.dashLabels || '').split(',');
    const ROWS = 12;
    const max = Math.max(...values, 1);
    const top = values.indexOf(Math.max(...values));
    values.forEach((value, col) => {
      const column = document.createElement('span');
      column.className = 'dash-dots__col';
      if (col === top && value > 0) column.classList.add('is-top');
      const filled = value > 0 ? Math.max(2, Math.round((value / max) * ROWS)) : 1;
      for (let row = 0; row < ROWS; row++) {
        const dot = document.createElement('i');
        if (row < filled) {
          dot.className = value > 0 ? 'is-on' : 'is-base';
          dot.style.setProperty('--k', (row / (ROWS - 1)).toFixed(2));
        }
        column.append(dot);
      }
      if (labels[col]) column.title = `${labels[col]}: ${value.toFixed(2).replace('.', ',')}€`;
      chart.append(column);
    });
  });

  // --- Activity filter (All / Orders / Returns / Promo)
  root.querySelectorAll('.dash-feed').forEach((feed) => {
    const buttons = [...feed.querySelectorAll('[data-dash-filter]')];
    const rows = [...feed.querySelectorAll('.dash-row')];
    buttons.forEach((button) => button.addEventListener('click', () => {
      const kind = button.dataset.dashFilter;
      buttons.forEach((b) => {
        b.classList.toggle('is-active', b === button);
        b.setAttribute('aria-pressed', String(b === button));
      });
      rows.forEach((row) => { row.hidden = kind !== 'all' && row.dataset.kind !== kind; });
    }));
  });

  // --- Phones/tablets: the menu is one scrolling row; keep the active link in view
  const nav = root.querySelector('.dash__nav');
  const showActive = () => {
    if (!nav || nav.scrollWidth <= nav.clientWidth) return;
    const active = nav.querySelector('.is-active');
    if (!active) return;
    const offset = active.getBoundingClientRect().left - nav.getBoundingClientRect().left;
    nav.scrollTo({ left: nav.scrollLeft + offset - (nav.clientWidth - active.offsetWidth) / 2, behavior: 'smooth' });
  };
  showActive();
  // web fonts change the link widths after the first layout
  document.fonts?.ready.then(() => requestAnimationFrame(showActive));
  window.addEventListener('load', showActive);
  nav?.addEventListener('click', () => requestAnimationFrame(showActive));
  window.addEventListener('hashchange', () => requestAnimationFrame(showActive));

  // --- Buttons that open another tab ("All orders", "Add code", ↗)
  root.querySelectorAll('button[data-acc-go]').forEach((button) => button.addEventListener('click', () => {
    root.querySelector(`[data-acc-tab="${button.dataset.accGo}"]`)?.click();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
})();
