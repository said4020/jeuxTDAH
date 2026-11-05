'use strict';
/* Courbes SVG légères : légende, étiquettes directes, réticule + infobulle au survol. */
(() => {
  const A = window.Abysse;
  const NS = 'http://www.w3.org/2000/svg';
  const SURFACE = '#0a1b2e';

  // Palette catégorielle validée (fond sombre #0a1b2e, daltonisme OK sur toutes les paires)
  A.SERIES_COLORS = ['#3987e5', '#d95926', '#199e70'];

  const el = (name, attrs = {}, parent) => {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };

  /**
   * opts = {
   *   series: [{ label, color, values: [number|null] }],
   *   xLabels: [string], tipTitles: [string],
   *   yMin, yMax, yTicks: [number], fmt: v => string, height
   * }
   */
  function lineChart(host, opts) {
    host.__chart = opts;
    host.textContent = '';
    host.classList.add('chart');
    const n = opts.xLabels.length;

    const legend = document.createElement('div');
    legend.className = 'chart-legend';
    opts.series.forEach(s => {
      const item = document.createElement('span');
      const key = document.createElement('i');
      key.style.background = s.color;
      item.appendChild(key);
      item.appendChild(document.createTextNode(s.label));
      legend.appendChild(item);
    });
    host.appendChild(legend);

    const plot = document.createElement('div');
    plot.className = 'chart-plot';
    host.appendChild(plot);

    const W = Math.max(280, host.clientWidth || 600);
    const H = opts.height || 220;
    const m = { l: 36, r: 104, t: 10, b: 26 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const x = i => m.l + (n <= 1 ? pw / 2 : (i * pw) / (n - 1));
    const y = v => m.t + ph - ((v - opts.yMin) / (opts.yMax - opts.yMin)) * ph;
    const fmt = opts.fmt || (v => String(v));

    const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opts.aria || '' }, plot);

    // grille + axe Y
    opts.yTicks.forEach(v => {
      el('line', { x1: m.l, x2: m.l + pw, y1: y(v), y2: y(v), class: 'grid' }, svg);
      const t = el('text', { x: m.l - 8, y: y(v) + 4, class: 'tick', 'text-anchor': 'end' }, svg);
      t.textContent = fmt(v);
    });
    // axe X
    const step = Math.max(1, Math.ceil(n / 8));
    for (let i = 0; i < n; i += step) {
      const t = el('text', { x: x(i), y: H - 6, class: 'tick', 'text-anchor': 'middle' }, svg);
      t.textContent = opts.xLabels[i];
    }

    // séries
    const showDots = n <= 40;
    const ends = [];
    opts.series.forEach(s => {
      let d = '', pen = false;
      s.values.forEach((v, i) => {
        if (v == null) { pen = false; return; }
        d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
        pen = true;
      });
      if (d) el('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
      if (showDots) {
        s.values.forEach((v, i) => {
          if (v == null) return;
          el('circle', { cx: x(i), cy: y(v), r: 4, fill: s.color, stroke: SURFACE, 'stroke-width': 2 }, svg);
        });
      }
      for (let i = s.values.length - 1; i >= 0; i--) {
        if (s.values[i] != null) { ends.push({ s, i, y: y(s.values[i]), v: s.values[i] }); break; }
      }
    });

    // étiquettes directes en bout de courbe (anti-chevauchement)
    ends.sort((a, b) => a.y - b.y);
    for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 16) ends[k].y = ends[k - 1].y + 16;
    ends.forEach(e => {
      const lx = m.l + pw + 10;
      el('line', { x1: lx, x2: lx + 10, y1: e.y, y2: e.y, stroke: e.s.color, 'stroke-width': 2, 'stroke-linecap': 'round' }, svg);
      const t = el('text', { x: lx + 15, y: e.y + 4, class: 'dlabel' }, svg);
      t.textContent = `${e.s.label} ${fmt(e.v)}`;
    });

    // survol : réticule + infobulle listant toutes les séries
    const hair = el('line', { y1: m.t, y2: m.t + ph, class: 'hair', visibility: 'hidden' }, svg);
    const marks = opts.series.map(s => el('circle', { r: 5, fill: s.color, stroke: SURFACE, 'stroke-width': 2, visibility: 'hidden' }, svg));
    const tip = document.createElement('div');
    tip.className = 'chart-tip hidden';
    plot.appendChild(tip);
    const hit = el('rect', { x: m.l - 10, y: 0, width: pw + 20, height: H, fill: 'transparent' }, svg);

    const showAt = i => {
      const cx = x(i);
      hair.setAttribute('x1', cx); hair.setAttribute('x2', cx); hair.setAttribute('visibility', 'visible');
      tip.textContent = '';
      const h = document.createElement('div');
      h.className = 'tip-title';
      h.textContent = (opts.tipTitles || opts.xLabels)[i];
      tip.appendChild(h);
      opts.series.forEach((s, k) => {
        const v = s.values[i];
        if (v == null) { marks[k].setAttribute('visibility', 'hidden'); }
        else {
          marks[k].setAttribute('cx', cx); marks[k].setAttribute('cy', y(v)); marks[k].setAttribute('visibility', 'visible');
        }
        const row = document.createElement('div');
        row.className = 'tip-row';
        const key = document.createElement('i'); key.style.background = s.color;
        const val = document.createElement('b'); val.textContent = v == null ? '—' : fmt(v);
        const lab = document.createElement('span'); lab.textContent = s.label;
        row.append(key, val, lab);
        tip.appendChild(row);
      });
      tip.classList.remove('hidden');
      const tw = tip.offsetWidth;
      tip.style.left = `${Math.min(W - tw - 4, Math.max(4, cx + 14 + tw > W ? cx - tw - 14 : cx + 14))}px`;
      tip.style.top = `${m.t}px`;
    };
    const hide = () => {
      hair.setAttribute('visibility', 'hidden');
      marks.forEach(mk => mk.setAttribute('visibility', 'hidden'));
      tip.classList.add('hidden');
    };
    hit.addEventListener('pointermove', e => {
      const r = svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      const i = n <= 1 ? 0 : Math.round(((px - m.l) / pw) * (n - 1));
      showAt(Math.max(0, Math.min(n - 1, i)));
    });
    hit.addEventListener('pointerleave', hide);
  }

  // redessine à la volée quand la largeur change
  const ro = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(entries => entries.forEach(en => {
      const h = en.target;
      if (h.__chart && Math.abs((h.__w || 0) - h.clientWidth) > 4) { h.__w = h.clientWidth; lineChart(h, h.__chart); }
    }))
    : null;

  A.lineChart = (host, opts) => {
    lineChart(host, opts);
    host.__w = host.clientWidth;
    if (ro && !host.__observed) { ro.observe(host); host.__observed = true; }
  };
})();
