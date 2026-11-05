'use strict';
/* Univers NATURE : rivière en forêt vue de dessus, animaux, feuilles / libellules / poissons.
 * La lumière passe du matin à la nuit au fil de la progression. */
(() => {
  const A = window.Abysse;
  const U = A.artUtil;
  const { rand, clamp } = U;

  const WATER = [
    { d: 0, top: [64, 170, 182], bot: [36, 128, 150] },
    { d: 1000, top: [44, 138, 150], bot: [26, 100, 122] },
    { d: 4000, top: [62, 112, 128], bot: [40, 76, 100] },
    { d: 6000, top: [30, 62, 88], bot: [16, 38, 62] },
    { d: 10935, top: [12, 28, 48], bot: [6, 14, 30] },
  ];
  const streaks = Array.from({ length: 90 }, () => ({ x: Math.random() * 2400, y: Math.random() * 720, z: rand(0.4, 1), l: rand(10, 34) }));
  const flies = Array.from({ length: 26 }, () => ({ x: Math.random() * 2400, y: rand(20, 700), p: Math.random() * 6 }));
  const canopy = Array.from({ length: 40 }, (_, i) => ({ off: i * 75 + rand(-20, 20), r: rand(34, 62), dy: rand(-14, 10), shade: rand(0, 1) }));

  function bank(c, e, top, light) {
    const span = 40 * 75;
    for (const t of canopy) {
      const x = (((t.off - e.dist) % span) + span) % span - 80;
      if (x > e.VW + 80) continue;
      const y = top ? t.dy - 6 : e.VH - t.dy + 6;
      const L = (18 + 14 * t.shade) * light;
      c.fillStyle = `hsl(${118 + t.shade * 30},45%,${L}%)`;
      c.beginPath(); c.arc(x, y, t.r, 0, Math.PI * 2); c.fill();
      c.fillStyle = `hsla(${100 + t.shade * 30},50%,${L + 10}%,0.6)`;
      c.beginPath(); c.arc(x - t.r * 0.25, y + (top ? -t.r * 0.2 : t.r * 0.2), t.r * 0.55, 0, Math.PI * 2); c.fill();
    }
  }

  function background(c, e) {
    const col = U.stopColors(WATER, e.prog);
    const g = c.createLinearGradient(0, 0, 0, e.VH);
    g.addColorStop(0, col.bot); g.addColorStop(0.5, col.top); g.addColorStop(1, col.bot);
    c.fillStyle = g;
    c.fillRect(0, 0, e.VW, e.VH);

    // reflets du courant
    const night = clamp((e.prog - 4000) / 5000, 0, 1);
    for (const s of streaks) {
      s.x -= (e.speed * 1.1 + 40) * s.z * e.dt;
      if (s.x < -40) { s.x += e.VW + 80; s.y = Math.random() * e.VH; }
      if (s.x > e.VW + 40) s.x = Math.random() * e.VW;
      c.strokeStyle = `rgba(235,250,255,${(0.08 + 0.18 * s.z) * (1 - night * 0.6)})`;
      c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x + s.l * s.z, s.y); c.stroke();
    }

    // berges boisées en haut et en bas
    const light = 1 - night * 0.65;
    bank(c, e, true, light);
    bank(c, e, false, light);

    // teinte de coucher de soleil
    const sunset = clamp(1 - Math.abs(e.prog - 4500) / 2500, 0, 1);
    if (sunset > 0.01) {
      c.fillStyle = `rgba(255,140,60,${0.12 * sunset})`;
      c.fillRect(0, 0, e.VW, e.VH);
    }
    // lucioles la nuit
    if (night > 0.05) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (const f of flies) {
        f.x -= e.speed * 0.3 * e.dt;
        if (f.x < -10) { f.x += e.VW + 20; f.y = rand(20, e.VH - 20); }
        if (f.x > e.VW + 10) f.x = Math.random() * e.VW;
        const a = night * (0.3 + 0.5 * Math.max(0, Math.sin(e.t * 2 + f.p)));
        c.fillStyle = `hsla(70,100%,65%,${a})`;
        c.beginPath(); c.arc(f.x + Math.sin(e.t + f.p) * 6, f.y + Math.cos(e.t * 0.8 + f.p) * 5, 2.2, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    }
  }

  // passage entre deux rochers
  function rock(c, x, y, r, tint) {
    const g = c.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.2, x, y, r);
    g.addColorStop(0, '#b9c0c4'); g.addColorStop(1, '#5b666e');
    c.fillStyle = g;
    c.beginPath(); c.ellipse(x, y, r, r * 0.85, 0.3, 0, Math.PI * 2); c.fill();
    if (tint) { c.fillStyle = tint; c.beginPath(); c.ellipse(x, y, r, r * 0.85, 0.3, 0, Math.PI * 2); c.fill(); }
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(x, y, r + 4, r * 0.85 + 4, 0.3, Math.PI * 0.9, Math.PI * 1.6); c.stroke();
  }
  function gate(c, g, x, e) {
    const ry = g.h / 2;
    const a = g.state === 3 ? 0.4 : 1;
    const tint = g.state === 2 ? `rgba(255,60,80,${clamp(0.6 - g.age, 0, 0.6)})` : g.state === 1 ? `rgba(120,255,170,${clamp(0.5 - g.age, 0, 0.5)})` : null;
    c.save();
    c.globalAlpha = a;
    // repère du passage
    const mark = g.state === 0 ? 'rgba(255,255,255,0.28)' : g.state === 1 ? `rgba(140,255,180,${clamp(0.6 - g.age, 0, 0.6)})` : 'rgba(255,255,255,0)';
    c.strokeStyle = mark; c.lineWidth = 2; c.setLineDash([6, 8]);
    c.beginPath(); c.moveTo(x, g.y - ry + 6); c.lineTo(x, g.y + ry - 6); c.stroke();
    c.setLineDash([]);
    rock(c, x, g.y - ry - 16, 18, tint);
    rock(c, x + 10, g.y - ry - 42, 14, tint);
    rock(c, x - 4, g.y + ry + 16, 18, tint);
    rock(c, x + 8, g.y + ry + 42, 13, tint);
    c.restore();
  }

  function creature(c, sp, hue, x, y, s, alpha, t) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.globalAlpha = alpha;
    const main = `hsl(${hue},90%,58%)`, light = `hsl(${hue},100%,80%)`, dark = `hsl(${hue},75%,30%)`;
    c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 8; c.shadowOffsetY = 4;
    if (sp === 'feuille') {
      c.rotate(Math.sin(t * 1.3) * 0.5);
      const gr = c.createLinearGradient(-26, 0, 26, 0);
      gr.addColorStop(0, dark); gr.addColorStop(0.5, main); gr.addColorStop(1, light);
      c.fillStyle = gr;
      c.beginPath();
      c.moveTo(-28, 0); c.quadraticCurveTo(-4, -22, 28, 0); c.quadraticCurveTo(-4, 22, -28, 0);
      c.fill();
      c.shadowColor = 'transparent';
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(-30, 0); c.lineTo(24, 0);
      for (let i = -14; i <= 12; i += 9) { c.moveTo(i, 0); c.lineTo(i + 7, -8); c.moveTo(i, 0); c.lineTo(i + 7, 8); }
      c.stroke();
    } else if (sp === 'libellule') {
      const flap = 0.6 + 0.4 * Math.abs(Math.sin(t * 22));
      c.fillStyle = `hsla(${hue},100%,85%,0.55)`;
      c.strokeStyle = `hsla(${hue},100%,70%,0.9)`; c.lineWidth = 1;
      for (const [wx, ang] of [[6, -1], [6, 1], [-4, -1], [-4, 1]]) {
        c.beginPath(); c.ellipse(wx, ang * 14 * flap, 7, 17 * flap, ang * (wx > 0 ? 0.25 : -0.25), 0, Math.PI * 2); c.fill(); c.stroke();
      }
      c.shadowColor = 'transparent';
      c.fillStyle = main;
      c.beginPath(); c.ellipse(-8, 0, 20, 3.5, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(10, 0, 6, 5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = dark;
      c.beginPath(); c.arc(15, -3, 2.5, 0, Math.PI * 2); c.arc(15, 3, 2.5, 0, Math.PI * 2); c.fill();
    } else {
      const wag = Math.sin(t * 7) * 0.35;
      c.fillStyle = main;
      c.save(); c.translate(-20, 0); c.rotate(wag);
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-14, -14, -20, -10); c.quadraticCurveTo(-12, 0, -20, 10); c.quadraticCurveTo(-14, 14, 0, 0); c.fill();
      c.restore();
      c.beginPath(); c.ellipse(4, -10, 7, 3, -0.6, 0, Math.PI * 2); c.ellipse(4, 10, 7, 3, 0.6, 0, Math.PI * 2); c.fill();
      const gr = c.createLinearGradient(0, -12, 0, 12);
      gr.addColorStop(0, dark); gr.addColorStop(0.5, light); gr.addColorStop(1, dark);
      c.fillStyle = gr;
      c.beginPath(); c.ellipse(0, 0, 24, 10, 0, 0, Math.PI * 2); c.fill();
      c.shadowColor = 'transparent';
      c.fillStyle = 'rgba(255,255,255,0.8)';
      c.beginPath(); c.arc(-4, -2, 4, 0, Math.PI * 2); c.arc(8, 3, 3, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#10202a';
      c.beginPath(); c.arc(17, -5, 1.8, 0, Math.PI * 2); c.arc(17, 5, 1.8, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  // ---------- Animaux (vue de dessus, tête à droite) ----------
  const paddle = (c, t, xs, ys, col, r = 5) => {
    c.fillStyle = col;
    xs.forEach((x, i) => {
      const k = Math.sin(t * 9 + i * Math.PI) * 4;
      c.beginPath(); c.ellipse(x + k, ys, r + 1, r * 0.7, 0, 0, Math.PI * 2); c.ellipse(x - k, -ys, r + 1, r * 0.7, 0, 0, Math.PI * 2); c.fill();
    });
  };
  const eyes = (c, x, dy, r = 2) => {
    c.fillStyle = '#10161c';
    c.beginPath(); c.arc(x, -dy, r, 0, Math.PI * 2); c.arc(x, dy, r, 0, Math.PI * 2); c.fill();
  };
  const body = (c, col, rx, ry) => {
    const g = c.createLinearGradient(0, -ry, 0, ry);
    g.addColorStop(0, col.lo); g.addColorStop(0.5, col.main); g.addColorStop(1, col.lo);
    c.fillStyle = g;
    c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); c.fill();
  };
  const shadow = (c, rx, ry) => {
    c.fillStyle = 'rgba(0,30,40,0.25)';
    c.beginPath(); c.ellipse(4, 6, rx, ry, 0, 0, Math.PI * 2); c.fill();
  };

  const avatars = {
    eclaireur(c, col, t) { // renard
      shadow(c, 40, 14);
      const sw = Math.sin(t * 4) * 0.2;
      c.save(); c.translate(-22, 0); c.rotate(sw);
      c.fillStyle = col.main; c.beginPath(); c.ellipse(-16, 0, 20, 9, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff6ea'; c.beginPath(); c.ellipse(-30, 0, 7, 6, 0, 0, Math.PI * 2); c.fill();
      c.restore();
      paddle(c, t, [12, -12], 12, col.lo);
      body(c, col, 24, 11);
      c.fillStyle = col.main; c.beginPath(); c.arc(24, 0, 10, 0, Math.PI * 2); c.fill();
      c.fillStyle = col.lo;
      c.beginPath(); c.moveTo(18, -6); c.lineTo(16, -17); c.lineTo(26, -8); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(18, 6); c.lineTo(16, 17); c.lineTo(26, 8); c.closePath(); c.fill();
      c.fillStyle = '#fff6ea'; c.beginPath(); c.moveTo(28, -6); c.lineTo(40, 0); c.lineTo(28, 6); c.closePath(); c.fill();
      c.fillStyle = '#10161c'; c.beginPath(); c.arc(40, 0, 2.2, 0, Math.PI * 2); c.fill();
      eyes(c, 28, 4);
    },
    manta(c, col, t) { // loutre
      shadow(c, 46, 10);
      const sw = Math.sin(t * 5) * 0.25;
      c.save(); c.translate(-28, 0); c.rotate(sw);
      c.fillStyle = col.lo; c.beginPath(); c.moveTo(0, -6); c.quadraticCurveTo(-18, -3, -26, 0); c.quadraticCurveTo(-18, 3, 0, 6); c.fill();
      c.restore();
      paddle(c, t, [14, -16], 9, col.lo, 4);
      body(c, col, 30, 9);
      c.fillStyle = col.main; c.beginPath(); c.arc(30, 0, 8.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = col.hi; c.beginPath(); c.ellipse(34, 0, 5, 5.5, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(37, -2); c.lineTo(46, -6); c.moveTo(37, 2); c.lineTo(46, 6); c.stroke();
      c.fillStyle = '#10161c'; c.beginPath(); c.arc(39, 0, 1.8, 0, Math.PI * 2); c.fill();
      eyes(c, 30, 4, 1.8);
    },
    orque(c, col, t) { // castor
      shadow(c, 42, 16);
      const sw = Math.sin(t * 3) * 0.15;
      c.save(); c.translate(-24, 0); c.rotate(sw);
      c.fillStyle = '#3b2a22'; c.beginPath(); c.ellipse(-14, 0, 15, 9, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.15)'; c.lineWidth = 1;
      c.beginPath(); for (let i = -24; i < -4; i += 5) { c.moveTo(i, -8); c.lineTo(i + 4, 8); } c.stroke();
      c.restore();
      paddle(c, t, [10, -12], 15, col.lo, 5);
      body(c, col, 24, 15);
      c.fillStyle = col.main; c.beginPath(); c.arc(24, 0, 10, 0, Math.PI * 2); c.fill();
      c.fillStyle = col.lo; c.beginPath(); c.arc(20, -9, 3.5, 0, Math.PI * 2); c.arc(20, 9, 3.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff6ea'; c.fillRect(32, -2.5, 4, 5);
      eyes(c, 27, 4);
    },
    bathy(c, col, t) { // tortue
      shadow(c, 30, 22);
      const k = Math.sin(t * 6);
      c.fillStyle = col.lo;
      [[12, -1], [12, 1], [-14, -1], [-14, 1]].forEach(([x, s], i) => {
        c.save(); c.translate(x, s * 16); c.rotate(s * (0.5 + (i < 2 ? k : -k) * 0.4));
        c.beginPath(); c.ellipse(s * 0, s * 6, 5, 10, 0, 0, Math.PI * 2); c.fill();
        c.restore();
      });
      c.beginPath(); c.moveTo(-22, -3); c.lineTo(-32, 0); c.lineTo(-22, 3); c.fill();
      c.fillStyle = col.main; c.beginPath(); c.ellipse(30, 0, 8, 6.5, 0, 0, Math.PI * 2); c.fill();
      eyes(c, 33, 3.5, 1.6);
      body(c, col, 25, 20);
      c.strokeStyle = col.lo; c.lineWidth = 1.8;
      c.beginPath();
      for (const [hx, hy] of [[0, 0], [-12, -9], [-12, 9], [12, -9], [12, 9]]) {
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          c[i ? 'lineTo' : 'moveTo'](hx + Math.cos(a) * 7, hy + Math.sin(a) * 7);
        }
        c.closePath();
      }
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.ellipse(-4, -8, 12, 5, -0.3, 0, Math.PI * 2); c.fill();
    },
    spectre(c, col, t) { // loup
      shadow(c, 44, 14);
      const sw = Math.sin(t * 4) * 0.18;
      c.save(); c.translate(-26, 0); c.rotate(sw);
      c.fillStyle = col.lo; c.beginPath(); c.ellipse(-14, 0, 18, 7, 0, 0, Math.PI * 2); c.fill();
      c.restore();
      paddle(c, t, [14, -14], 12, col.lo);
      body(c, col, 28, 12);
      c.fillStyle = col.hi; c.beginPath(); c.ellipse(4, 0, 18, 5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = col.main; c.beginPath(); c.arc(28, 0, 11, 0, Math.PI * 2); c.fill();
      c.fillStyle = col.lo;
      c.beginPath(); c.moveTo(22, -7); c.lineTo(20, -18); c.lineTo(29, -9); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(22, 7); c.lineTo(20, 18); c.lineTo(29, 9); c.closePath(); c.fill();
      c.fillStyle = col.main; c.beginPath(); c.moveTo(32, -6); c.lineTo(46, -2); c.lineTo(46, 2); c.lineTo(32, 6); c.closePath(); c.fill();
      c.fillStyle = '#10161c'; c.beginPath(); c.arc(46, 0, 2.4, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#f4e27a'; c.beginPath(); c.arc(32, -4.5, 2, 0, Math.PI * 2); c.arc(32, 4.5, 2, 0, Math.PI * 2); c.fill();
    },
  };

  A.ART.nature = {
    background, creature, avatars, gate,
    geom: {
      eclaireur: { front: 42, back: -58 }, manta: { front: 40, back: -54 }, orque: { front: 36, back: -56 },
      bathy: { front: 38, back: -32 }, spectre: { front: 48, back: -58 },
    },
    lamp: false, beam: false, defaultTrail: 'remous', glowHue: 70,
  };
})();
