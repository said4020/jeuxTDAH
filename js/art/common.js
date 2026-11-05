'use strict';
/* Outils de dessin communs + sillages. Chaque univers s'enregistre dans A.ART[id] :
 *   background(c, env)            env = { VW, VH, dist, prog, speed, dt, t }
 *   gate(c, g, x, env)            g = { y, h, state (0 en attente, 1 réussi, 2 raté, 3 ignoré), age }
 *   creature(c, sp, hue, x, y, s, alpha, t)
 *   avatars[id](c, colors, t)     dessiné centré, orienté vers la droite
 *   geom[id] = { front, back }    avant / arrière (émission du sillage)
 *   lamp, beam                    projecteur avant (océan)
 *   defaultTrail, glowHue         style du sillage par défaut, teinte des particules lumineuses
 */
(() => {
  const A = window.Abysse;
  A.ART = {};

  const U = A.artUtil = {
    rand: (a, b) => a + Math.random() * (b - a),
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    rr(c, x, y, w, h, r) {
      c.beginPath();
      if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h);
    },
    vgrad(c, top, bottom, col) {
      const g = c.createLinearGradient(0, top, 0, bottom);
      g.addColorStop(0, col.hi); g.addColorStop(0.55, col.main); g.addColorStop(1, col.lo);
      return g;
    },
    // dégradé interpolé selon la progression : stops = [{ d, top:[r,g,b], bot:[r,g,b] }]
    stopColors(stops, d) {
      let i = 0;
      while (i < stops.length - 2 && d > stops[i + 1].d) i++;
      const a = stops[i], b = stops[i + 1];
      const t = U.clamp((d - a.d) / (b.d - a.d), 0, 1);
      const mix = (x, y) => `rgb(${x.map((v, k) => Math.round(U.lerp(v, y[k], t))).join(',')})`;
      return { top: mix(a.top, b.top), bot: mix(a.bot, b.bot) };
    },
    // anneau lumineux (océan, espace)
    ringGate(c, g, x, env, pending) {
      const ry = g.h / 2;
      const col = g.state === 2 ? 'hsl(355,90%,62%)' : g.state === 1 ? 'hsl(150,100%,75%)' : pending;
      const a = g.state === 0 ? 1 : g.state === 3 ? 0.3 : U.clamp(1 - g.age / 0.6, 0.25, 1);
      const grow = g.state === 1 ? Math.min(g.age, 0.6) * 40 : 0;
      c.save();
      c.globalAlpha = a;
      c.shadowColor = col; c.shadowBlur = 14;
      c.strokeStyle = col; c.lineWidth = 4;
      c.beginPath(); c.ellipse(x, g.y, 14 + grow, ry + grow, 0, 0, Math.PI * 2); c.stroke();
      c.fillStyle = col;
      for (const yy of [g.y - ry, g.y + ry]) {
        c.beginPath(); c.arc(x, yy, 6 + Math.sin(env.t * 4 + g.y) * 1.2, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    },
    flame(c, x, t, size = 1) {
      const f = 0.75 + 0.25 * Math.sin(t * 40) + Math.random() * 0.15;
      const g = c.createLinearGradient(x, 0, x - 26 * size * f, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.3, 'rgba(120,200,255,0.85)');
      g.addColorStop(1, 'rgba(80,120,255,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(x, -5 * size); c.quadraticCurveTo(x - 18 * size * f, 0, x, 5 * size);
      c.lineTo(x - 26 * size * f, 0); c.closePath();
      c.fill();
    },
  };

  A.art = (themeId) => A.ART[themeId || A.theme().id] || A.ART.ocean;

  // ---------- Avatar ----------
  A.drawAvatar = (c, x, y, tilt, t, look, s = 1, beam = true) => {
    const art = A.art(look.theme);
    const id = art.avatars[look.hull] ? look.hull : 'eclaireur';
    const geom = art.geom[id];
    c.save();
    c.translate(x, y);
    c.rotate(tilt);
    c.scale(s, s);
    if (beam && art.beam) {
      const b = c.createLinearGradient(geom.front - 4, 0, geom.front + 300, 0);
      b.addColorStop(0, 'rgba(255,240,200,0.24)');
      b.addColorStop(1, 'rgba(255,240,200,0)');
      c.fillStyle = b;
      c.beginPath();
      c.moveTo(geom.front - 3, -6); c.lineTo(geom.front + 300, -90); c.lineTo(geom.front + 300, 90); c.lineTo(geom.front - 3, 6);
      c.closePath(); c.fill();
    }
    art.avatars[id](c, look.colors, t);
    if (art.lamp) {
      c.shadowColor = '#fff3b0'; c.shadowBlur = 16;
      c.fillStyle = '#fff7d6';
      c.beginPath(); c.arc(geom.front, 0, 3.2, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  };
  A.avatarBack = (hull, themeId) => {
    const art = A.art(themeId);
    return (art.geom[hull] || art.geom.eclaireur).back;
  };
  // le sillage « bulles » est le style par défaut de chaque univers
  A.trailStyle = (trailId, themeId) => (trailId === 'bulles' ? A.art(themeId).defaultTrail : trailId);

  // ---------- Sillages ----------
  const { rand, lerp } = U;
  class Trail {
    constructor() { this.p = []; this.rib = []; this.acc = 0; }
    reset() { this.p = []; this.rib = []; }
    update(dt, speed, ex, ey, kind, glowHue = 185) {
      for (const q of this.p) {
        q.x += (q.vx - speed * 0.9) * dt;
        q.y += q.vy * dt;
        if (kind === 'etincelles') q.vy += 60 * dt;
        q.life += dt;
      }
      this.p = this.p.filter(q => q.life < q.max);
      for (const r of this.rib) r.x -= speed * dt;
      if (kind === 'neon') {
        this.rib.push({ x: ex, y: ey });
        while (this.rib.length > 50) this.rib.shift();
      } else this.rib.length = 0;

      const rate = { bulles: 0.05, reacteur: 0.012, remous: 0.11, plancton: 0.03, etincelles: 0.02, neon: 0.12, comete: 0.015 }[kind] || 0.05;
      this.acc += dt;
      while (this.acc >= rate) {
        this.acc -= rate;
        const q = { x: ex, y: ey + rand(-5, 5), vx: 0, vy: 0, life: 0, max: 1.4, r: rand(1.5, 4) };
        if (kind === 'bulles') q.vy = -30;
        else if (kind === 'reacteur') { q.y = ey + rand(-3, 3); q.vx = -rand(60, 140); q.vy = rand(-12, 12); q.max = 0.4; q.r = rand(2.5, 5); }
        else if (kind === 'remous') { q.y = ey; q.max = 1.3; q.r = 4; }
        else if (kind === 'plancton') { q.vy = rand(-14, 14); q.vx = rand(-20, 20); q.max = 1.6; q.r = rand(1.2, 2.8); q.h = glowHue + rand(-15, 15); }
        else if (kind === 'etincelles') { q.vx = rand(-60, 30); q.vy = rand(-70, 30); q.max = 0.8; q.r = rand(1, 2.4); q.h = rand(18, 48); }
        else if (kind === 'neon') { q.vy = rand(-10, 10); q.max = 0.6; q.r = rand(1, 2); q.h = rand(170, 320); }
        else if (kind === 'comete') { q.vx = rand(-20, 20); q.vy = rand(-20, 20); q.max = 1.0; q.r = rand(2, 5); }
        this.p.push(q);
      }
    }
    draw(c, kind) {
      c.save();
      if (kind === 'neon' && this.rib.length > 2) {
        c.globalCompositeOperation = 'lighter';
        const n = this.rib.length;
        for (let i = 1; i < n; i++) {
          const a = i / n;
          c.strokeStyle = `hsla(${lerp(320, 175, a)},100%,65%,${a * 0.85})`;
          c.lineWidth = 1 + a * 5;
          c.beginPath(); c.moveTo(this.rib[i - 1].x, this.rib[i - 1].y); c.lineTo(this.rib[i].x, this.rib[i].y); c.stroke();
        }
      }
      for (const q of this.p) {
        const k = 1 - q.life / q.max;
        if (kind === 'bulles') {
          c.strokeStyle = `rgba(220,240,255,${0.5 * k})`; c.lineWidth = 1.2;
          c.beginPath(); c.arc(q.x, q.y, q.r, 0, Math.PI * 2); c.stroke();
        } else if (kind === 'remous') {
          c.strokeStyle = `rgba(235,250,255,${0.45 * k})`; c.lineWidth = 1.5;
          c.beginPath(); c.ellipse(q.x, q.y, 6 + (1 - k) * 22, 4 + (1 - k) * 16, 0, 0, Math.PI * 2); c.stroke();
        } else {
          c.globalCompositeOperation = 'lighter';
          let col;
          if (kind === 'plancton') col = `hsla(${q.h},100%,70%,${k * (0.5 + 0.5 * Math.sin(q.life * 20))})`;
          else if (kind === 'etincelles') col = `hsla(${q.h},100%,62%,${k})`;
          else if (kind === 'comete') col = `hsla(45,100%,${60 + 20 * k}%,${k * 0.8})`;
          else if (kind === 'reacteur') col = k > 0.6 ? `hsla(205,100%,${60 + 30 * k}%,${k * 0.9})` : `hsla(${lerp(10, 35, k)},100%,58%,${k * 0.9})`;
          else col = `hsla(${q.h},100%,70%,${k * 0.6})`;
          c.fillStyle = col;
          const r = kind === 'comete' || kind === 'reacteur' ? q.r * (0.4 + k) : q.r;
          c.beginPath(); c.arc(q.x, q.y, r, 0, Math.PI * 2); c.fill();
        }
      }
      c.restore();
    }
  }
  A.Trail = Trail;
})();
