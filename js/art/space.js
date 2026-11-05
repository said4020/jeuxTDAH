'use strict';
/* Univers ESPACE : nébuleuses, vaisseaux, étoiles / planètes / cristaux. */
(() => {
  const A = window.Abysse;
  const U = A.artUtil;
  const { rand, clamp, rr, vgrad } = U;

  const STOPS = [
    { d: 0, top: [10, 18, 48], bot: [4, 6, 18] },
    { d: 1000, top: [24, 14, 58], bot: [6, 4, 22] },
    { d: 4000, top: [44, 12, 62], bot: [10, 3, 24] },
    { d: 6000, top: [8, 34, 58], bot: [2, 8, 18] },
    { d: 10935, top: [58, 20, 46], bot: [12, 3, 14] },
  ];
  const stars = Array.from({ length: 170 }, () => ({
    x: Math.random() * 2400, y: Math.random() * 720, z: rand(0.08, 1), r: rand(0.5, 1.9), tw: Math.random() * 6,
  }));
  const nebulas = Array.from({ length: 4 }, (_, i) => ({ off: i * 640 + rand(0, 200), y: rand(120, 600), r: rand(220, 360), h: i * 47 }));

  function background(c, e) {
    const col = U.stopColors(STOPS, e.prog);
    const g = c.createLinearGradient(0, 0, 0, e.VH);
    g.addColorStop(0, col.top); g.addColorStop(1, col.bot);
    c.fillStyle = g;
    c.fillRect(0, 0, e.VW, e.VH);

    // nébuleuses (teinte qui évolue avec la progression)
    c.save();
    c.globalCompositeOperation = 'lighter';
    const span = e.VW + 900;
    const baseHue = 200 + (e.prog / 10935) * 140;
    for (const n of nebulas) {
      const x = (((n.off - e.dist * 0.04) % span) + span) % span - 450;
      const rg = c.createRadialGradient(x, n.y, 0, x, n.y, n.r);
      rg.addColorStop(0, `hsla(${baseHue + n.h},80%,55%,0.16)`);
      rg.addColorStop(1, `hsla(${baseHue + n.h},80%,40%,0)`);
      c.fillStyle = rg;
      c.fillRect(x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    }
    c.restore();

    for (const s of stars) {
      s.x -= e.speed * s.z * 0.6 * e.dt;
      if (s.x < -10) { s.x += e.VW + 20; s.y = Math.random() * e.VH; }
      if (s.x > e.VW + 10) s.x = Math.random() * e.VW;
      const a = (0.25 + 0.6 * s.z) * (0.7 + 0.3 * Math.sin(e.t * 3 + s.tw));
      c.fillStyle = `rgba(235,240,255,${a})`;
      if (s.z > 0.75 && e.speed > 150) {
        c.fillRect(s.x, s.y - s.r / 2, s.r * 6 * s.z, s.r); // traînée de vitesse
      } else {
        c.beginPath(); c.arc(s.x, s.y, s.r, 0, Math.PI * 2); c.fill();
      }
    }

    // planète lointaine
    const px = (((e.VW * 0.85 - e.dist * 0.01) % (e.VW + 600)) + e.VW + 600) % (e.VW + 600) - 300;
    const pg = c.createRadialGradient(px - 60, e.VH + 40, 20, px, e.VH + 120, 240);
    pg.addColorStop(0, `hsla(${baseHue + 30},40%,35%,0.55)`);
    pg.addColorStop(1, `hsla(${baseHue + 30},40%,12%,0.55)`);
    c.fillStyle = pg;
    c.beginPath(); c.arc(px, e.VH + 120, 240, 0, Math.PI * 2); c.fill();
  }

  function starPath(c, r1, r2, n) {
    c.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 ? r2 : r1, a = (i * Math.PI) / n - Math.PI / 2;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
  }

  function creature(c, sp, hue, x, y, s, alpha, t) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.globalAlpha = alpha;
    const main = `hsl(${hue},95%,62%)`, light = `hsl(${hue},100%,86%)`, dark = `hsl(${hue},80%,32%)`;
    c.shadowColor = main;
    c.shadowBlur = 22;
    if (sp === 'etoile') {
      c.rotate(Math.sin(t * 1.5) * 0.25);
      const gr = c.createRadialGradient(0, 0, 2, 0, 0, 28);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, light); gr.addColorStop(1, main);
      c.fillStyle = gr;
      starPath(c, 28, 12, 5);
      c.fill();
    } else if (sp === 'planete') {
      c.lineWidth = 3;
      c.strokeStyle = `hsla(${hue},100%,85%,0.45)`;
      c.beginPath(); c.ellipse(0, 0, 36, 9, -0.35, Math.PI, Math.PI * 2); c.stroke(); // anneau arrière
      const gr = c.createRadialGradient(-8, -8, 3, 0, 0, 22);
      gr.addColorStop(0, light); gr.addColorStop(0.6, main); gr.addColorStop(1, dark);
      c.fillStyle = gr;
      c.beginPath(); c.arc(0, 0, 20, 0, Math.PI * 2); c.fill();
      c.shadowBlur = 0;
      c.strokeStyle = light;
      c.beginPath(); c.ellipse(0, 0, 36, 9, -0.35, 0, Math.PI); c.stroke(); // anneau avant
    } else {
      c.rotate(t * 0.8);
      const gr = c.createLinearGradient(-20, -26, 20, 26);
      gr.addColorStop(0, light); gr.addColorStop(0.5, main); gr.addColorStop(1, dark);
      c.fillStyle = gr;
      c.beginPath();
      c.moveTo(0, -28); c.lineTo(18, -8); c.lineTo(12, 22); c.lineTo(-12, 22); c.lineTo(-18, -8);
      c.closePath(); c.fill();
      c.shadowBlur = 0;
      c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(0, -28); c.lineTo(0, 22); c.moveTo(-18, -8); c.lineTo(0, 0); c.lineTo(18, -8); c.stroke();
    }
    c.restore();
  }

  // ---------- Vaisseaux ----------
  const cockpit = (c, x, y, rx, ry) => {
    c.fillStyle = 'rgba(14,28,60,0.95)';
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(150,210,255,0.6)';
    c.beginPath(); c.ellipse(x + rx * 0.25, y - ry * 0.35, rx * 0.45, ry * 0.3, 0, 0, Math.PI * 2); c.fill();
  };
  const nozzle = (c, x, y, h = 12) => { c.fillStyle = '#5a6472'; rr(c, x - 6, y - h / 2, 8, h, 2); c.fill(); };

  const avatars = {
    eclaireur(c, col, t) {
      U.flame(c, -40, t);
      nozzle(c, -36, 0);
      c.fillStyle = col.accent;
      c.beginPath(); c.moveTo(-4, -10); c.lineTo(-28, -28); c.lineTo(-32, -10); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(-4, 10); c.lineTo(-28, 28); c.lineTo(-32, 10); c.closePath(); c.fill();
      c.fillStyle = vgrad(c, -15, 15, col);
      c.beginPath();
      c.moveTo(40, 0); c.quadraticCurveTo(30, -14, 6, -14); c.lineTo(-34, -11); c.lineTo(-34, 11); c.lineTo(6, 14);
      c.quadraticCurveTo(30, 14, 40, 0); c.fill();
      cockpit(c, 16, -4, 10, 5);
    },
    manta(c, col, t) {
      U.flame(c, -26, t);
      nozzle(c, -22, 0, 10);
      c.fillStyle = vgrad(c, -32, 32, col);
      c.beginPath(); c.moveTo(42, 0); c.lineTo(-30, -32); c.lineTo(-20, 0); c.lineTo(-30, 32); c.closePath(); c.fill();
      c.strokeStyle = col.accent; c.lineWidth = 2;
      c.beginPath(); c.moveTo(38, 0); c.lineTo(-18, 0); c.stroke();
      c.beginPath(); c.moveTo(-6, -15); c.lineTo(-26, -28); c.moveTo(-6, 15); c.lineTo(-26, 28); c.stroke();
      cockpit(c, 14, 0, 9, 4.5);
    },
    orque(c, col, t) {
      c.save(); c.translate(0, -7); U.flame(c, -54, t, 0.8); c.restore();
      c.save(); c.translate(0, 7); U.flame(c, -54, t + 1, 0.8); c.restore();
      nozzle(c, -50, -7, 9); nozzle(c, -50, 7, 9);
      c.fillStyle = vgrad(c, -14, 14, col);
      c.beginPath();
      c.moveTo(52, 0); c.lineTo(36, -10); c.lineTo(-44, -13); c.lineTo(-50, -6); c.lineTo(-50, 6); c.lineTo(-44, 13); c.lineTo(36, 10);
      c.closePath(); c.fill();
      c.fillStyle = col.accent;
      rr(c, -20, -22, 30, 10, 3); c.fill();
      c.fillStyle = 'rgba(150,210,255,0.7)';
      for (let i = 0; i < 4; i++) c.fillRect(-14 + i * 6, -19, 3, 3);
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(-40, 0); c.lineTo(40, 0); c.stroke();
      cockpit(c, 34, -2, 7, 4);
    },
    bathy(c, col, t) {
      c.strokeStyle = '#8a96a6'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, -20); c.lineTo(0, -26); c.moveTo(0, 20); c.lineTo(0, 26); c.stroke();
      for (const sy of [-50, 26]) {
        c.fillStyle = '#1d3d7a';
        rr(c, -10, sy, 20, 24, 2); c.fill();
        c.strokeStyle = 'rgba(140,190,255,0.6)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(-10, sy + 8); c.lineTo(10, sy + 8); c.moveTo(-10, sy + 16); c.lineTo(10, sy + 16); c.moveTo(0, sy); c.lineTo(0, sy + 24); c.stroke();
      }
      const g = c.createRadialGradient(-6, -8, 3, 0, 0, 22);
      g.addColorStop(0, col.hi); g.addColorStop(0.6, col.main); g.addColorStop(1, col.lo);
      c.fillStyle = g;
      c.beginPath(); c.arc(0, 0, 20, 0, Math.PI * 2); c.fill();
      c.strokeStyle = col.accent; c.lineWidth = 2;
      c.beginPath(); c.moveTo(18, 0); c.lineTo(30, 0); c.stroke();
      c.beginPath(); c.arc(34, 0, 7, Math.PI * 0.6, Math.PI * 1.4, true); c.stroke();
      const p = 0.5 + 0.5 * Math.sin(t * 5);
      c.fillStyle = `rgba(255,90,90,${0.4 + 0.6 * p})`;
      c.beginPath(); c.arc(-6, -6, 2.5, 0, Math.PI * 2); c.fill();
      U.flame(c, -22, t, 0.6);
    },
    spectre(c, col, t) {
      U.flame(c, -46, t, 0.7);
      A.drawStealth(c, col, t);
    },
  };

  A.ART.space = {
    background, creature, avatars,
    gate: (c, g, x, e) => U.ringGate(c, g, x, e, 'hsl(275,95%,72%)'),
    geom: {
      eclaireur: { front: 40, back: -50 }, manta: { front: 42, back: -38 }, orque: { front: 52, back: -64 },
      bathy: { front: 41, back: -30 }, spectre: { front: 46, back: -56 },
    },
    lamp: false, beam: false, defaultTrail: 'reacteur', glowHue: 230,
  };
})();
