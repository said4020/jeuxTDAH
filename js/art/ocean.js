'use strict';
/* Univers OCÉAN : grands fonds, sous-marins, méduses / poissons / nautiles. */
(() => {
  const A = window.Abysse;
  const U = A.artUtil;
  const { rand, clamp, rr, vgrad } = U;

  const STOPS = [
    { d: 0, top: [30, 127, 176], bot: [11, 61, 102] },
    { d: 200, top: [15, 79, 122], bot: [6, 36, 63] },
    { d: 1000, top: [10, 39, 66], bot: [3, 15, 32] },
    { d: 4000, top: [5, 15, 31], bot: [1, 5, 12] },
    { d: 6000, top: [3, 7, 15], bot: [0, 2, 6] },
    { d: 10935, top: [2, 5, 12], bot: [0, 1, 4] },
  ];
  const snow = Array.from({ length: 140 }, (_, i) => ({
    x: Math.random() * 2400, y: Math.random() * 720, z: rand(0.15, 1), r: rand(0.6, 2.2), tw: Math.random() * 6, bio: i % 6 === 0,
  }));

  function ridge(c, e, f, base, amp, color) {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(0, e.VH);
    for (let x = 0; x <= e.VW + 20; x += 20) {
      const wx = x + e.dist * f;
      c.lineTo(x, base - amp * (0.55 + 0.3 * Math.sin(wx * 0.0031) + 0.15 * Math.sin(wx * 0.0117 + 1.3)));
    }
    c.lineTo(e.VW + 20, e.VH);
    c.closePath();
    c.fill();
  }

  function background(c, e) {
    const col = U.stopColors(STOPS, e.prog);
    const g = c.createLinearGradient(0, 0, 0, e.VH);
    g.addColorStop(0, col.top); g.addColorStop(1, col.bot);
    c.fillStyle = g;
    c.fillRect(0, 0, e.VW, e.VH);

    const rayA = clamp(1 - e.prog / 400, 0, 1) * 0.08;
    if (rayA > 0.004) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      const span = e.VW + 500;
      for (let i = 0; i < 5; i++) {
        const x0 = (((i * 337 - e.dist * 0.05) % span) + span) % span - 250;
        c.fillStyle = `rgba(180,230,255,${rayA * (0.6 + 0.4 * Math.sin(e.t * 0.5 + i))})`;
        c.beginPath();
        c.moveTo(x0, 0); c.lineTo(x0 + 90, 0); c.lineTo(x0 + 270, e.VH); c.lineTo(x0 + 130, e.VH);
        c.fill();
      }
      c.restore();
    }

    const bio = clamp(e.prog / 3000, 0, 1);
    for (const p of snow) {
      p.x -= e.speed * p.z * 0.5 * e.dt;
      if (p.x < -10) { p.x += e.VW + 20; p.y = Math.random() * e.VH; }
      if (p.x > e.VW + 10) p.x = Math.random() * e.VW;
      if (p.bio && bio > 0.05) {
        c.fillStyle = `hsla(${180 + p.tw * 12},100%,70%,${bio * (0.35 + 0.35 * Math.sin(e.t * 2 + p.tw))})`;
        c.beginPath(); c.arc(p.x, p.y, p.r + 1, 0, Math.PI * 2); c.fill();
      } else {
        c.fillStyle = `rgba(220,240,255,${0.1 + 0.3 * p.z})`;
        c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill();
      }
    }
    ridge(c, e, 0.25, e.VH - 30, 90, 'rgba(0,0,0,0.22)');
    ridge(c, e, 0.6, e.VH + 10, 60, 'rgba(0,0,0,0.38)');
  }

  function creature(c, sp, hue, x, y, s, alpha, t) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.globalAlpha = alpha;
    const main = `hsl(${hue},95%,62%)`, light = `hsl(${hue},100%,84%)`, dark = `hsl(${hue},80%,34%)`;
    c.shadowColor = main;
    c.shadowBlur = 20;
    if (sp === 'meduse') {
      c.strokeStyle = main; c.lineWidth = 2.5; c.lineCap = 'round';
      for (let i = -3; i <= 3; i++) {
        const bx = i * 6;
        c.beginPath(); c.moveTo(bx, 2);
        for (let k = 1; k <= 6; k++) c.lineTo(bx + Math.sin(t * 4 + k * 0.9 + i) * 4, 2 + k * 7);
        c.stroke();
      }
      const gr = c.createRadialGradient(0, -10, 2, 0, -4, 28);
      gr.addColorStop(0, light); gr.addColorStop(1, main);
      c.fillStyle = gr;
      c.beginPath();
      c.moveTo(-24, 4);
      c.bezierCurveTo(-24, -30, 24, -30, 24, 4);
      c.quadraticCurveTo(12, 0, 0, 5);
      c.quadraticCurveTo(-12, 0, -24, 4);
      c.fill();
    } else if (sp === 'poisson') {
      const wag = Math.sin(t * 8) * 5;
      c.fillStyle = main;
      c.beginPath();
      c.moveTo(20, 0); c.lineTo(40, -15 + wag); c.lineTo(35, 0); c.lineTo(40, 15 + wag);
      c.closePath(); c.fill();
      c.beginPath(); c.moveTo(-6, -13); c.quadraticCurveTo(4, -27, 13, -11); c.fill();
      const gr = c.createLinearGradient(0, -16, 0, 16);
      gr.addColorStop(0, light); gr.addColorStop(1, dark);
      c.fillStyle = gr;
      c.beginPath(); c.ellipse(0, 0, 26, 15, 0, 0, Math.PI * 2); c.fill();
      c.shadowBlur = 0;
      c.fillStyle = '#fff'; c.beginPath(); c.arc(-14, -3, 4.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#061325'; c.beginPath(); c.arc(-15, -3, 2.2, 0, Math.PI * 2); c.fill();
    } else {
      c.strokeStyle = main; c.lineWidth = 2.5; c.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        c.beginPath();
        c.moveTo(-16, i * 3 - 4);
        c.quadraticCurveTo(-30, i * 4 - 8 + Math.sin(t * 5 + i) * 4, -40, i * 5 - 10 + Math.sin(t * 5 + i) * 5);
        c.stroke();
      }
      const gr = c.createRadialGradient(-4, -6, 2, 0, 0, 24);
      gr.addColorStop(0, light); gr.addColorStop(1, dark);
      c.fillStyle = gr;
      c.beginPath(); c.arc(2, 0, 22, 0, Math.PI * 2); c.fill();
      c.shadowBlur = 0;
      c.strokeStyle = `hsla(${hue},100%,92%,0.8)`; c.lineWidth = 2;
      c.beginPath();
      for (let a = 0; a < Math.PI * 4; a += 0.2) {
        const r = 2 + a * 1.5;
        const px = 2 + Math.cos(a) * r, py = Math.sin(a) * r;
        if (a === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
    }
    c.restore();
  }

  // ---------- Sous-marins ----------
  function porthole(c, x, y, r) {
    c.fillStyle = '#0b2236';
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,240,210,0.85)'; c.lineWidth = 2.2; c.stroke();
    c.fillStyle = 'rgba(150,220,255,0.6)';
    c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.33, 0, Math.PI * 2); c.fill();
  }
  function propeller(c, x, t) {
    const p = Math.abs(Math.sin(t * 30));
    c.fillStyle = '#6b7c8c';
    c.beginPath(); c.ellipse(x, 0, 4, 14 * p + 3, 0, 0, Math.PI * 2); c.fill();
  }
  // coque furtive, réutilisée par l'univers Espace
  A.drawStealth = (c, col, t) => {
    c.save();
    c.shadowColor = col.accent; c.shadowBlur = 12;
    c.fillStyle = vgrad(c, -16, 16, col);
    c.globalAlpha *= 0.92;
    c.beginPath();
    c.moveTo(46, 0); c.lineTo(12, -14); c.lineTo(-30, -12); c.lineTo(-46, -4);
    c.lineTo(-46, 4); c.lineTo(-30, 12); c.lineTo(12, 14); c.closePath(); c.fill();
    c.restore();
    c.fillStyle = col.lo;
    c.beginPath(); c.moveTo(-12, -12); c.lineTo(-30, -26); c.lineTo(-22, -12); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-12, 12); c.lineTo(-30, 26); c.lineTo(-22, 12); c.closePath(); c.fill();
    c.save();
    c.strokeStyle = col.accent; c.lineWidth = 1.6; c.shadowColor = col.accent; c.shadowBlur = 10;
    c.beginPath(); c.moveTo(44, 0); c.lineTo(12, -13); c.lineTo(-30, -11); c.stroke();
    c.beginPath(); c.moveTo(34, -3); c.lineTo(14, -8); c.stroke();
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(-46, -3); c.lineTo(-46, 3); c.stroke();
    c.restore();
    const p = 0.5 + 0.5 * Math.sin(t * 6);
    c.fillStyle = `rgba(255,255,255,${0.2 + 0.3 * p})`;
    c.beginPath(); c.arc(-46, 0, 3, 0, Math.PI * 2); c.fill();
  };

  const avatars = {
    eclaireur(c, col, t) {
      propeller(c, -44, t);
      c.fillStyle = col.accent;
      c.beginPath(); c.moveTo(-28, -4); c.lineTo(-42, -18); c.lineTo(-22, -10); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(-28, 4); c.lineTo(-42, 18); c.lineTo(-22, 10); c.closePath(); c.fill();
      rr(c, -12, -28, 24, 14, 5); c.fill();
      c.strokeStyle = col.lo; c.lineWidth = 3;
      c.beginPath(); c.moveTo(4, -28); c.lineTo(4, -36); c.lineTo(11, -36); c.stroke();
      c.fillStyle = vgrad(c, -18, 18, col);
      c.beginPath(); c.ellipse(0, 0, 38, 17, 0, 0, Math.PI * 2); c.fill();
      porthole(c, 14, -1, 7.5);
    },
    manta(c, col, t) {
      propeller(c, -46, t);
      c.fillStyle = col.accent;
      c.beginPath(); c.moveTo(-30, 0); c.lineTo(-52, -3); c.lineTo(-52, 3); c.closePath(); c.fill();
      c.fillStyle = vgrad(c, -30, 30, col);
      c.beginPath();
      c.moveTo(36, 0);
      c.quadraticCurveTo(20, -10, 0, -12);
      c.quadraticCurveTo(-18, -30, -34, -28);
      c.quadraticCurveTo(-24, -12, -34, 0);
      c.quadraticCurveTo(-24, 12, -34, 28);
      c.quadraticCurveTo(-18, 30, 0, 12);
      c.quadraticCurveTo(20, 10, 36, 0);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(30, 0); c.lineTo(-26, 0); c.stroke();
      c.fillStyle = 'rgba(11,34,54,0.9)';
      c.beginPath(); c.ellipse(14, -5, 11, 5.5, -0.1, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(150,220,255,0.55)';
      c.beginPath(); c.ellipse(16, -7, 5, 2, -0.1, 0, Math.PI * 2); c.fill();
    },
    orque(c, col, t) {
      propeller(c, -56, t);
      c.fillStyle = col.lo;
      c.beginPath(); c.moveTo(-42, 0); c.lineTo(-58, -16); c.lineTo(-52, 0); c.lineTo(-58, 16); c.closePath(); c.fill();
      c.fillStyle = col.accent;
      c.beginPath(); c.moveTo(-6, -11); c.quadraticCurveTo(-12, -30, -20, -36); c.quadraticCurveTo(-4, -30, 8, -12); c.closePath(); c.fill();
      c.fillStyle = vgrad(c, -14, 14, col);
      c.beginPath(); c.ellipse(0, 0, 48, 13, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.22)';
      c.beginPath(); c.ellipse(4, 6, 34, 5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = col.accent;
      c.beginPath(); c.moveTo(6, 8); c.lineTo(-6, 20); c.lineTo(-10, 9); c.closePath(); c.fill();
      porthole(c, 26, -2, 6);
      porthole(c, 12, -2, 4.5);
    },
    bathy(c, col, t) {
      c.fillStyle = '#6b7c8c';
      rr(c, -36, -14, 10, 8, 2); c.fill();
      rr(c, -36, 6, 10, 8, 2); c.fill();
      c.strokeStyle = col.lo; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-10, -22); c.lineTo(-14, -34); c.moveTo(10, -22); c.lineTo(14, -34); c.stroke();
      c.fillStyle = col.accent;
      rr(c, -20, -42, 40, 10, 4); c.fill();
      const g = c.createRadialGradient(-8, -10, 4, 0, 0, 28);
      g.addColorStop(0, col.hi); g.addColorStop(0.6, col.main); g.addColorStop(1, col.lo);
      c.fillStyle = g;
      c.beginPath(); c.arc(0, 0, 25, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 2;
      c.beginPath(); c.ellipse(0, 0, 25, 7, 0, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.ellipse(0, 0, 9, 25, 0, 0, Math.PI * 2); c.stroke();
      porthole(c, 14, 0, 9);
      const p = Math.abs(Math.sin(t * 30));
      c.fillStyle = 'rgba(200,220,235,0.5)';
      c.beginPath(); c.ellipse(-38, -10, 2, 6 * p + 1, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(-38, 10, 2, 6 * p + 1, 0, 0, Math.PI * 2); c.fill();
    },
    spectre: (c, col, t) => A.drawStealth(c, col, t),
  };

  A.ART.ocean = {
    background, creature, avatars,
    gate: (c, g, x, e) => U.ringGate(c, g, x, e, 'hsl(172,90%,62%)'),
    geom: {
      eclaireur: { front: 37, back: -46 }, manta: { front: 34, back: -50 }, orque: { front: 47, back: -58 },
      bathy: { front: 30, back: -34 }, spectre: { front: 46, back: -48 },
    },
    lamp: true, beam: true, defaultTrail: 'bulles', glowHue: 185,
  };
})();
