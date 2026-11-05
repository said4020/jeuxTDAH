'use strict';
/*
 * Moteur de jeu (double tâche + difficulté adaptative), commun aux trois univers.
 *
 * Tâche 1 (pilotage)  : suivre un courant en passant dans des passages.
 * Tâche 2 (détection) : go/no-go — capturer uniquement la cible, ignorer les leurres.
 * Chaque tâche a son propre niveau (1..12), réajusté toutes les BLOCK secondes
 * pour garder une réussite d'environ 65-85 %.
 *
 * Temps de jeu : enregistré toutes les 5 s (A.logPlayTime) pour que la limite
 * quotidienne tienne même si la partie est abandonnée ou la page fermée.
 *
 * API : A.game.start() -> bool, togglePause(), quit(), simulate(sec), isPlaying(), isPaused()
 *       A.onDiveEnd(report) / A.onPauseChange(paused) / A.onPlayChange(playing) : fournis par ui.js
 */
(() => {
  const A = window.Abysse;
  const { rand, clamp, lerp } = A.artUtil;

  // ---------- Constantes ----------
  const VH = 720;
  const MAXL = 12;
  const BLOCK = 20;
  const GATE_SPACING = 400;
  const TARGET_RATE = 0.35;
  const LOG_EVERY = 5;

  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const fmt = n => Math.round(n).toLocaleString('fr-FR');
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);
  A.fmt = fmt;

  // ---------- Canvas ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let dpr = 1, scale = 1, VW = 1280;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    scale = canvas.height / VH;
    VW = canvas.width / scale;
  }
  addEventListener('resize', resize);
  resize();
  const SUBX = () => Math.min(300, VW * 0.22);

  // ---------- Audio ----------
  let actx = null;
  function tone(freq, dur, { type = 'sine', vol = 0.12, slide = 1, delay = 0 } = {}) {
    if (!A.profile.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const t0 = actx.currentTime + delay;
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (slide !== 1) o.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* audio indisponible */ }
  }
  const SFX = {
    hit() { tone(660, 0.18, { vol: 0.1 }); tone(990, 0.28, { vol: 0.08, delay: 0.07 }); },
    gate() { tone(420, 0.1, { type: 'triangle', vol: 0.05, slide: 1.3 }); },
    miss() { tone(220, 0.18, { type: 'triangle', vol: 0.06, slide: 0.8 }); },
    wrong() { tone(160, 0.25, { type: 'sawtooth', vol: 0.04, slide: 0.7 }); },
    empty() { tone(260, 0.08, { type: 'triangle', vol: 0.03 }); },
    up() { [523, 659, 784].forEach((f, i) => tone(f, 0.18, { vol: 0.07, delay: i * 0.08 })); },
    rule() { tone(330, 0.3, { type: 'triangle', vol: 0.08 }); tone(495, 0.35, { type: 'triangle', vol: 0.07, delay: 0.15 }); },
    tick() { tone(880, 0.08, { vol: 0.05 }); },
    unlock() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { vol: 0.07, delay: i * 0.09 })); },
    click() { tone(700, 0.05, { type: 'triangle', vol: 0.04 }); },
  };
  A.SFX = SFX;

  // ---------- Cibles ----------
  const HUES = [
    { h: 188, name: 'cyan' },
    { h: 318, name: 'magenta' },
    { h: 42, name: 'ambre' },
    { h: 130, name: 'vert' },
  ];

  // ---------- Paramètres adaptatifs ----------
  const navSpeed = L => 170 + 18 * L;
  const gateH = L => Math.max(80, 220 - 13 * L);
  const gateDelta = L => 50 + 22 * L;
  const discWindow = L => Math.max(0.65, 1.85 - 0.11 * L);
  const discGap = L => Math.max(0.35, 1.25 - 0.08 * L) + Math.random() * 0.7;

  function newRule(prev) {
    const sp = G.species;
    let r;
    do {
      const hueIdx = Math.floor(Math.random() * HUES.length);
      r = { species: pick(sp).id, hueIdx, hue: HUES[hueIdx].h };
    } while (prev && r.species === prev.species && r.hueIdx === prev.hueIdx);
    return r;
  }
  function ruleLabel(r) {
    const sp = G.species.find(s => s.id === r.species);
    const col = HUES[r.hueIdx].name;
    return `${sp.name} ${col === 'vert' && sp.f ? 'verte' : col}`;
  }

  function makeDistractor(L) {
    const r = G.rule;
    const otherSp = () => pick(G.species.filter(s => s.id !== r.species)).id;
    const otherHue = () => pick(HUES.filter((_, i) => i !== r.hueIdx)).h + rand(-6, 6);
    const sameHue = () => r.hue + rand(-6, 6);
    const x = Math.random();
    if (L >= 7) {
      const delta = Math.max(26, 64 - (L - 7) * 8);
      if (x < 0.5) return { species: r.species, hue: (r.hue + (Math.random() < 0.5 ? -1 : 1) * delta + 360) % 360 };
      if (x < 0.8) return { species: otherSp(), hue: sameHue() };
      return { species: r.species, hue: otherHue() };
    }
    const shareP = L <= 3 ? 0.3 : 0.8;
    if (x < shareP) {
      return Math.random() < 0.5 ? { species: r.species, hue: otherHue() } : { species: otherSp(), hue: sameHue() };
    }
    return { species: otherSp(), hue: otherHue() };
  }

  // ---------- État ----------
  let state = 'idle'; // idle | play
  let paused = false;
  let G = null;
  let dist = 0;
  const sub = { y: VH / 2, vy: 0, tilt: 0 };
  const input = { mode: 'keys', ty: null, steerId: null, touch: false };
  const keys = {};
  const trail = new A.Trail();

  function newGame(duration) {
    const p = A.profile;
    const theme = A.theme();
    G = {
      t: 0, run: 0, logged: 0, phase: 'countdown', cd: 3, duration,
      theme: theme.id, art: A.art(theme.id), species: theme.species,
      navLevel: Math.max(1, p.navLevel - 1),
      discLevel: Math.max(1, p.discLevel - 1),
      speed: 0, gates: [], nextGateX: dist + VW * 0.95, lastGateY: VH / 2,
      creature: null, nextSpawnAt: 0, sinceTarget: 0, lastResolve: -9,
      rule: null, nextRuleAt: 40, banner: null,
      fx: [], toasts: [], shake: 0,
      score: 0, combo: 0, bestCombo: 0, gain: 0, startDepth: p.totalDepth,
      stats: { gates: 0, passed: 0, hits: 0, misses: 0, fa: 0, faEmpty: 0, cr: 0, rts: [] },
      block: { gates: 0, passed: 0, trials: 0, correct: 0, start: 0 },
      look: A.look(),
    };
    G.rule = newRule(null);
    G.startNav = G.navLevel; G.startDisc = G.discLevel;
    G.maxNav = G.navLevel; G.maxDisc = G.discLevel;
    sub.y = VH / 2; sub.vy = 0;
    trail.reset();
  }
  const currentDepth = () => Math.min(A.MAX_DEPTH, G.startDepth + G.gain);
  const mult = () => 1 + Math.min(4, Math.floor(G.combo / 6)) * 0.5;
  function flushTime() {
    if (!G) return;
    const d = G.run - G.logged;
    if (d > 0) { A.logPlayTime(d); G.logged = G.run; }
  }

  // ---------- Entrées ----------
  addEventListener('keydown', e => {
    keys[e.code] = true;
    if (state !== 'play') return;
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) onAction(); }
    if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') e.preventDefault();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });

  const toVirtual = e => ({ x: (e.clientX * dpr) / scale, y: (e.clientY * dpr) / scale });
  canvas.addEventListener('pointerdown', e => {
    if (state !== 'play' || paused) return;
    const p = toVirtual(e);
    if (e.pointerType === 'mouse') {
      input.mode = 'pointer'; input.ty = p.y;
      if (e.button === 0) onAction();
      return;
    }
    input.touch = true;
    e.preventDefault();
    if (p.x < VW * 0.5) { input.steerId = e.pointerId; input.mode = 'pointer'; input.ty = p.y; }
    else onAction();
  });
  canvas.addEventListener('pointermove', e => {
    if (state !== 'play') return;
    const p = toVirtual(e);
    if (e.pointerType === 'mouse') { input.mode = 'pointer'; input.ty = p.y; }
    else if (e.pointerId === input.steerId) input.ty = p.y;
  });
  const endPointer = e => { if (e.pointerId === input.steerId) input.steerId = null; };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play' && !paused) togglePause(); });
  addEventListener('pagehide', flushTime);

  // ---------- Effets ----------
  const ring = (x, y, color, max = 60, dur = 0.5) => G.fx.push({ k: 'ring', x, y, color, max, dur, t0: G.t });
  const pop = (x, y, text, color) => G.fx.push({ k: 'pop', x, y, text, color, dur: 0.9, t0: G.t });
  const toast = text => G.toasts.push({ text, t0: G.t });

  // ---------- Logique ----------
  function onAction() {
    if (state !== 'play' || paused || !G || G.phase !== 'run') return;
    const c = G.creature;
    if (c && c.state === 'live') {
      G.block.trials++;
      c.end = G.t; G.lastResolve = G.t;
      if (c.isTarget) {
        c.state = 'caught';
        G.stats.hits++; G.block.correct++;
        G.stats.rts.push(G.t - c.born);
        G.combo++; G.bestCombo = Math.max(G.bestCombo, G.combo);
        const pts = Math.round((100 + G.discLevel * 15) * mult());
        G.score += pts; G.gain += 5;
        ring(c.x, c.y, 'hsla(172,100%,70%,', 80, 0.55);
        pop(c.x, c.y - 44, `+${pts}`, '#bffcf2');
        SFX.hit();
      } else {
        c.state = 'wrong';
        G.stats.fa++; G.combo = 0;
        G.score = Math.max(0, G.score - 40);
        ring(c.x, c.y, 'hsla(355,100%,65%,', 60, 0.45);
        pop(c.x, c.y - 44, 'leurre', '#ff9aa5');
        SFX.wrong();
      }
    } else if (G.t - G.lastResolve > 0.35) {
      G.stats.faEmpty++; G.block.trials++;
      ring(SUBX() + 40, sub.y, 'hsla(355,100%,65%,', 36, 0.35);
      SFX.empty();
    }
  }

  function updateSub(dt) {
    const up = keys.ArrowUp || keys.KeyW || keys.KeyZ;
    const down = keys.ArrowDown || keys.KeyS;
    const dir = (down ? 1 : 0) - (up ? 1 : 0);
    const MAXV = 560;
    let desired = 0;
    if (dir) { input.mode = 'keys'; desired = dir * MAXV; }
    else if (input.mode === 'pointer' && input.ty != null) desired = clamp((input.ty - sub.y) * 7, -MAXV, MAXV);
    sub.vy = lerp(sub.vy, desired, 1 - Math.exp(-9 * dt));
    sub.y = clamp(sub.y + sub.vy * dt, 34, VH - 34);
    sub.tilt = lerp(sub.tilt, clamp(sub.vy / 1600, -0.3, 0.3), 1 - Math.exp(-8 * dt));
  }

  function spawnGates() {
    while (G.nextGateX < dist + VW + 300) {
      const L = G.navLevel, h = gateH(L), m = h / 2 + 40;
      const y = clamp(G.lastGateY + rand(-1, 1) * gateDelta(L), m, VH - m);
      G.gates.push({ x: G.nextGateX, y, h, state: 0, tState: 0, age: 0 });
      G.lastGateY = y;
      G.nextGateX += GATE_SPACING;
    }
  }

  function checkGates() {
    const sx = SUBX();
    for (const g of G.gates) {
      g.age = G.t - g.tState;
      if (g.state !== 0 || g.x - dist > sx) continue;
      g.tState = G.t; g.age = 0;
      if (G.phase !== 'run') { g.state = 3; continue; }
      const ok = Math.abs(sub.y - g.y) <= g.h / 2 - 8;
      G.stats.gates++; G.block.gates++;
      if (ok) {
        g.state = 1;
        G.stats.passed++; G.block.passed++;
        G.combo++; G.bestCombo = Math.max(G.bestCombo, G.combo);
        G.score += Math.round((40 + G.navLevel * 6) * mult());
        G.gain += 2;
        SFX.gate();
      } else {
        g.state = 2; G.combo = 0; G.shake = 0.25;
        SFX.miss();
      }
    }
    G.gates = G.gates.filter(g => g.x - dist > -120);
  }

  function spawnCreature() {
    const L = G.discLevel;
    const isTarget = Math.random() < TARGET_RATE || G.sinceTarget >= 4;
    G.sinceTarget = isTarget ? 0 : G.sinceTarget + 1;
    const st = isTarget ? { species: G.rule.species, hue: G.rule.hue + rand(-6, 6) } : makeDistractor(L);
    G.creature = {
      ...st, isTarget,
      x: rand(VW * 0.5, VW * 0.86), y: rand(110, VH - 100),
      born: G.t, win: discWindow(L), state: 'live', end: 0, phase: Math.random() * 10,
    };
  }

  function updateCreature(dt) {
    const c = G.creature;
    if (c) {
      c.x -= G.speed * 0.12 * dt;
      if (c.state === 'live' && G.t - c.born > c.win) {
        c.state = 'gone'; c.end = G.t;
        G.block.trials++;
        if (c.isTarget) {
          G.stats.misses++; G.combo = 0;
          pop(c.x, c.y - 44, 'manqué', 'rgba(220,240,255,0.85)');
          SFX.miss();
        } else {
          G.stats.cr++; G.block.correct++; G.gain += 1;
        }
      }
      if (c.state !== 'live' && G.t - c.end > 0.45) {
        G.creature = null;
        G.nextSpawnAt = G.t + discGap(G.discLevel);
      }
    } else if (!G.banner && G.t >= G.nextSpawnAt) {
      spawnCreature();
    }
  }

  function maybeRuleSwitch() {
    if (G.banner) { if (G.t >= G.banner.until) G.banner = null; return; }
    if (G.discLevel >= 5 && G.run >= G.nextRuleAt && !G.creature) {
      G.rule = newRule(G.rule);
      G.banner = { until: G.t + 2.6 };
      G.nextRuleAt = G.run + 40;
      G.nextSpawnAt = G.t + 3;
      SFX.rule();
    }
  }

  function levelChange(kind, d) {
    const key = kind === 'nav' ? 'navLevel' : 'discLevel';
    const nv = clamp(G[key] + d, 1, MAXL);
    if (nv === G[key]) return;
    G[key] = nv;
    G.maxNav = Math.max(G.maxNav, G.navLevel);
    G.maxDisc = Math.max(G.maxDisc, G.discLevel);
    if (d > 0) { toast(`${kind === 'nav' ? 'Pilotage' : 'Détection'} · niveau ${nv}`); SFX.up(); }
  }

  function evalBlock() {
    const b = G.block;
    if (b.gates >= 3) {
      const a = b.passed / b.gates;
      if (a >= 0.85) levelChange('nav', +1); else if (a < 0.6) levelChange('nav', -1);
    }
    if (b.trials >= 4) {
      const a = b.correct / b.trials;
      if (a >= 0.85) levelChange('disc', +1); else if (a < 0.65) levelChange('disc', -1);
    }
    G.block = { gates: 0, passed: 0, trials: 0, correct: 0, start: G.run };
  }

  function update(dt) {
    G.t += dt;
    const target = navSpeed(G.navLevel);
    G.speed = G.speed ? lerp(G.speed, target, 1 - Math.exp(-0.8 * dt)) : target;
    dist += G.speed * dt;
    updateSub(dt);
    spawnGates();
    checkGates();

    if (G.phase === 'countdown') {
      const prev = Math.ceil(G.cd);
      G.cd -= dt;
      if (Math.ceil(G.cd) < prev && G.cd > 0) SFX.tick();
      if (G.cd <= 0) { G.phase = 'run'; G.nextSpawnAt = G.t + 1; }
    } else {
      G.run += dt;
      if (G.run - G.logged >= LOG_EVERY) flushTime();
      maybeRuleSwitch();
      updateCreature(dt);
      if (G.run - G.block.start >= BLOCK) evalBlock();
      if (G.run >= G.duration) { finish(); return; }
    }

    const back = A.avatarBack(G.look.hull, G.theme);
    trail.update(dt, G.speed, SUBX() + back * Math.cos(sub.tilt), sub.y + back * Math.sin(sub.tilt),
      A.trailStyle(G.look.trail, G.theme), G.art.glowHue);
    G.fx = G.fx.filter(f => G.t - f.t0 < f.dur);
    G.toasts = G.toasts.filter(f => G.t - f.t0 < 2.2);
    G.shake = Math.max(0, G.shake - dt);
  }

  // ---------- Dessin ----------
  function txt(s, x, y, size, color, align = 'left', weight = 600, ls = 0) {
    ctx.font = `${weight} ${size}px "Space Grotesk", system-ui, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${ls}px`;
    ctx.fillText(s, x, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
  // ombre portée légère pour garder le texte lisible sur les décors clairs (Nature)
  function hudText(...args) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,10,20,0.6)'; ctx.shadowBlur = 6;
    txt(...args);
    ctx.restore();
  }

  function drawCurrent() {
    const pts = G.gates.map(g => ({ x: g.x - dist, y: g.y }));
    if (pts.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.strokeStyle = 'rgba(160,240,255,0.06)'; ctx.lineWidth = 90; ctx.stroke();
    ctx.strokeStyle = 'rgba(200,245,255,0.16)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }

  function drawCreatureObj(c, t) {
    let a = clamp((G.t - c.born) / 0.18, 0, 1), s = 1.15, x = c.x, y = c.y;
    if (c.state !== 'live') {
      const k = clamp((G.t - c.end) / 0.4, 0, 1);
      a *= 1 - k;
      if (c.state === 'caught') { x = lerp(c.x, SUBX(), k * k); y = lerp(c.y, sub.y, k * k); s *= 1 - 0.7 * k; }
    } else {
      // anneau neutre : temps restant pour répondre (identique pour cibles et leurres)
      const rem = clamp(1 - (G.t - c.born) / c.win, 0, 1);
      ctx.save();
      ctx.strokeStyle = 'rgba(230,245,255,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 50, -Math.PI / 2, -Math.PI / 2 + rem * Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    G.art.creature(ctx, c.species, c.hue, x, y, s, a, t + c.phase);
  }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  }
  function drawRuleCard(cx, cy, s, t) {
    const label = `CAPTURE : ${ruleLabel(G.rule).toUpperCase()}`;
    ctx.font = '700 16px "Space Grotesk", system-ui, sans-serif';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '1.5px';
    const w = ctx.measureText(label).width + 92;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.fillStyle = 'rgba(4,16,30,0.7)';
    ctx.strokeStyle = 'rgba(160,220,255,0.2)';
    ctx.lineWidth = 1;
    rr(-w / 2, -26, w, 52, 26); ctx.fill(); ctx.stroke();
    G.art.creature(ctx, G.rule.species, G.rule.hue, -w / 2 + 36, 0, 0.62, 1, t);
    txt(label, -w / 2 + 68, 6, 16, '#e9f6ff', 'left', 700, 1.5);
    ctx.restore();
  }

  function drawCenterCard(eyebrow, big, t) {
    ctx.fillStyle = 'rgba(2,10,20,0.5)';
    ctx.fillRect(0, 0, VW, VH);
    txt(eyebrow, VW / 2, VH / 2 - 92, 15, 'rgba(160,250,235,0.9)', 'center', 600, 4);
    drawRuleCard(VW / 2, VH / 2 - 30, 1.5, t);
    txt('Laisse passer tout le reste', VW / 2, VH / 2 + 42, 17, 'rgba(220,240,255,0.8)', 'center', 500);
    if (big) txt(big, VW / 2, VH / 2 + 135, 68, '#ffffff', 'center', 700);
  }

  function drawHUD(t) {
    const rem = clamp(1 - G.run / G.duration, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, 0, VW, 4);
    ctx.fillStyle = 'hsl(172,90%,62%)'; ctx.fillRect(0, 0, VW * rem, 4);

    const depth = currentDepth();
    hudText(A.fmtProg(depth), 28, 52, 34, '#f2fbff', 'left', 700);
    hudText(A.zoneOf(depth).name.toUpperCase(), 30, 76, 12, 'rgba(225,240,255,0.85)', 'left', 600, 2);

    // à droite : score, série, temps restant (le bouton pause HTML occupe le coin)
    const rx = VW - 96;
    hudText(fmt(G.score), rx, 52, 30, '#f2fbff', 'right', 700);
    const m = mult();
    hudText(m > 1 ? `COMBO ×${m.toFixed(1).replace('.', ',')}` : `SÉRIE ${G.combo}`, rx, 76, 12,
      m > 1 ? 'hsl(42,100%,65%)' : 'rgba(225,240,255,0.85)', 'right', 600, 2);
    const left = Math.max(0, Math.ceil(G.duration - G.run));
    hudText(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, rx, 98, 13, 'rgba(225,240,255,0.85)', 'right', 600, 1);

    if (VW > 820) drawRuleCard(VW / 2, 50, 1, t);
    else drawRuleCard(VW / 2, 124, 0.85, t);

    const lv = [['PILOTAGE', G.navLevel], ['DÉTECTION', G.discLevel]];
    lv.forEach(([label, L], i) => {
      const y = VH - 46 + i * 22;
      hudText(label, 28, y + 4, 11, 'rgba(225,240,255,0.8)', 'left', 600, 2);
      for (let k = 0; k < MAXL; k++) {
        ctx.fillStyle = k < L ? 'rgba(64,240,214,0.9)' : 'rgba(225,240,255,0.22)';
        ctx.fillRect(118 + k * 9, y - 5, 6, 10);
      }
    });

    G.toasts.forEach((o, i) => {
      const age = G.t - o.t0;
      const a = clamp(Math.min(age / 0.2, (2.2 - age) / 0.4), 0, 1);
      ctx.save(); ctx.globalAlpha = a;
      hudText(`▲ ${o.text}`, VW / 2, 112 + i * 26 + (VW > 820 ? 0 : 60), 16, 'hsl(42,100%,68%)', 'center', 700, 1);
      ctx.restore();
    });

    if (input.touch) {
      ctx.save();
      ctx.strokeStyle = 'rgba(160,240,230,0.45)'; ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(4,16,30,0.35)';
      ctx.beginPath(); ctx.arc(VW - 96, VH - 96, 56, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      txt('CAPTURE', VW - 96, VH - 90, 14, 'rgba(220,255,250,0.9)', 'center', 700, 2);
      ctx.restore();
    }
  }

  function drawFx() {
    for (const f of G.fx) {
      const k = (G.t - f.t0) / f.dur;
      if (f.k === 'ring') {
        ctx.strokeStyle = `${f.color}${(1 - k).toFixed(3)})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(f.x, f.y, 10 + f.max * k, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.save(); ctx.globalAlpha = clamp(1 - k, 0, 1);
        hudText(f.text, f.x, f.y - k * 30, 18, f.color, 'center', 700);
        ctx.restore();
      }
    }
  }

  function render(t, dt) {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const playing = state === 'play' && G;
    if (playing && G.shake > 0) ctx.translate(rand(-1, 1) * G.shake * 16, rand(-1, 1) * G.shake * 16);
    const themeId = playing ? G.theme : A.theme().id;
    const art = A.art(themeId);
    const env = {
      VW, VH, dist, t, dt,
      prog: playing ? currentDepth() : A.profile.totalDepth,
      speed: playing ? (paused ? 0 : G.speed) : 60,
    };
    if (!playing) dist += 60 * dt;
    art.background(ctx, env);

    if (!playing) {
      // décor des menus : l'avatar du joueur se promène à gauche
      const look = A.look();
      const y = VH * 0.5 + Math.sin(t * 1.2) * 14;
      const back = A.avatarBack(look.hull, themeId);
      const style = A.trailStyle(look.trail, themeId);
      trail.update(dt, 60, VW * 0.14 + back, y, style, art.glowHue);
      trail.draw(ctx, style);
      A.drawAvatar(ctx, VW * 0.14, y, Math.cos(t * 1.2) * 0.05, t, look);
      return;
    }

    drawCurrent();
    for (const g of G.gates) {
      const x = g.x - dist;
      if (x > -80 && x < VW + 80) art.gate(ctx, g, x, env);
    }
    if (G.creature) drawCreatureObj(G.creature, t);
    trail.draw(ctx, A.trailStyle(G.look.trail, G.theme));
    A.drawAvatar(ctx, SUBX(), sub.y, sub.tilt, t, G.look);
    drawFx();
    drawHUD(t);

    if (G.phase === 'countdown') drawCenterCard('PRÉPARE-TOI', String(Math.max(1, Math.ceil(G.cd))), t);
    else if (G.banner) drawCenterCard('NOUVELLE CIBLE', null, t);
  }

  // ---------- Boucle ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state === 'play' && G && !paused) update(dt);
    render(now / 1000, paused ? 0 : dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---------- Contrôle de partie ----------
  function setPlaying(on) {
    state = on ? 'play' : 'idle';
    if (A.onPlayChange) A.onPlayChange(on);
  }

  // Renvoie false si la limite quotidienne est atteinte.
  function start() {
    const remaining = A.devNoLimit ? Infinity : A.remainingToday();
    if (remaining < A.MIN_DIVE) return false;
    tone(1, 0.01, { vol: 0.0001 }); // déverrouille l'audio sur action utilisateur
    newGame(Math.min(A.profile.duration, Math.floor(remaining)));
    paused = false;
    setPlaying(true);
    return true;
  }

  function togglePause() {
    if (state !== 'play') return;
    paused = !paused;
    if (paused) flushTime();
    if (A.onPauseChange) A.onPauseChange(paused);
  }

  function quit() {
    flushTime();
    paused = false;
    G = null;
    trail.reset();
    setPlaying(false);
  }

  function finish() {
    flushTime();
    const s = G.stats;
    const report = {
      dur: Math.round(G.run),
      nav: pct(s.passed, s.gates),
      det: pct(s.hits, s.hits + s.misses),
      ctl: pct(s.cr, s.cr + s.fa),
      imp: s.faEmpty,
      rt: s.rts.length ? Math.round((s.rts.reduce((a, b) => a + b, 0) / s.rts.length) * 1000) : null,
      navL: G.navLevel, discL: G.discLevel,
      startNav: G.startNav, startDisc: G.startDisc,
      maxNav: G.maxNav, maxDisc: G.maxDisc,
      score: G.score, combo: G.bestCombo,
      gain: Math.round(currentDepth() - G.startDepth),
      startDepth: G.startDepth, endDepth: currentDepth(),
      gates: s.gates, targets: s.hits + s.misses, lures: s.cr + s.fa,
      theme: G.theme,
    };
    G = null;
    trail.reset();
    setPlaying(false);
    if (A.onDiveEnd) A.onDiveEnd(report);
  }

  // Bot de test : pilote vers le passage suivant, capture les cibles (~15 % d'erreurs)
  function simulate(seconds) {
    if (!start()) return false;
    const dt = 1 / 60;
    const frames = (seconds + 3.5) * 60; // + décompte
    for (let i = 0; i < frames && state === 'play'; i++) {
      const next = G.gates.find(g => g.state === 0);
      input.mode = 'pointer';
      input.ty = next ? next.y + rand(-1, 1) * next.h * 0.3 : VH / 2;
      const c = G.creature;
      if (c && c.state === 'live' && G.t - c.born > 0.45 && Math.random() < 0.03) {
        if (c.isTarget ? Math.random() < 0.9 : Math.random() < 0.15) onAction();
      }
      update(dt);
    }
    return true;
  }

  A.game = {
    start, togglePause, quit, simulate,
    isPlaying: () => state === 'play',
    isPaused: () => paused,
  };
})();
