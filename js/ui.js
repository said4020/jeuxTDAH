'use strict';
/* Interface : hub à onglets, choix d'univers, limite de temps, hangar, badges, progression, résultats. */
(() => {
  const A = window.Abysse;
  const $ = id => document.getElementById(id);
  const fmt = A.fmt;
  const P = () => A.profile;

  const SCREENS = ['hub', 'onboard', 'pause', 'results', 'parent', 'share'];
  const show = id => SCREENS.forEach(s => $(s).classList.toggle('hidden', s !== id));
  let currentTab = 'home';

  const PLAY_LABEL = { ocean: 'Plonger', space: 'Décoller', nature: 'C\'est parti' };
  const SINGULAR = {
    ocean: { hull: 'Sous-marin', livery: 'Livrée', trail: 'Sillage' },
    space: { hull: 'Vaisseau', livery: 'Peinture', trail: 'Traînée' },
    nature: { hull: 'Animal', livery: 'Pelage', trail: 'Sillage' },
  };

  const svgIcon = name => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', A.ICONS[name]);
    s.appendChild(p);
    return s;
  };
  const div = (cls, text) => {
    const d = document.createElement('div');
    if (cls) d.className = cls;
    if (text != null) d.textContent = text;
    return d;
  };
  const fmtDuration = sec => {
    const m = Math.round(sec / 60);
    return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;
  };
  const minLeft = sec => {
    if (sec >= 60) return `${Math.floor(sec / 60)} min`;
    return `${Math.max(0, Math.floor(sec))} s`;
  };
  const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;
  const canPlay = () => A.remainingToday() >= A.MIN_DIVE;

  // ---------- Univers ----------
  function applyTheme() {
    const t = A.theme();
    $('brand-name').textContent = t.brand;
    document.title = t.brand.charAt(0) + t.brand.slice(1).toLowerCase();
  }

  function drawWorldPreview(cv, themeId) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth || 200, h = cv.clientHeight || 90;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const c = cv.getContext('2d');
    const sc = (h / 720) * dpr;
    c.setTransform(sc, 0, 0, sc, 0, 0);
    const VW = (w * dpr) / sc;
    const art = A.art(themeId);
    art.background(c, { VW, VH: 720, dist: 400, prog: Math.min(P().totalDepth, 900), speed: 0, dt: 0, t: 1 });
    const look = Object.assign(A.look(), { theme: themeId });
    A.drawAvatar(c, VW * 0.42, 360, 0, 0.4, look, 3.2, true);
    art.creature(c, A.THEMES[themeId].species[0].id, 188, VW * 0.82, 300, 2.6, 1, 0.5);
  }

  function worldPicker(host, onPick) {
    host.textContent = '';
    const cvs = [];
    A.THEME_IDS.forEach(id => {
      const t = A.THEMES[id];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `world${P().theme === id ? ' on' : ''}`;
      b.setAttribute('aria-pressed', String(P().theme === id));
      const cv = document.createElement('canvas');
      cvs.push([cv, id]);
      const name = div('wname', t.label);
      const brand = document.createElement('span'); brand.className = 'wbrand'; brand.textContent = t.brand;
      name.appendChild(brand);
      b.append(cv, name, div('wpitch', t.pitch));
      b.addEventListener('click', () => {
        P().theme = id;
        A.save();
        A.SFX.click();
        applyTheme();
        onPick();
      });
      host.appendChild(b);
    });
    requestAnimationFrame(() => cvs.forEach(([cv, id]) => drawWorldPreview(cv, id)));
  }

  // ---------- Carte pilote ----------
  function refreshPilot() {
    const r = A.rankOf(P().xp);
    $('p-name').textContent = P().callsign || 'Pilote';
    $('p-rank').textContent = r.name;
    $('p-xpfill').style.width = `${Math.round(r.progress * 100)}%`;
    $('p-xp').textContent = r.next
      ? `${fmt(P().xp - r.cur.xp)} / ${fmt(r.next.xp - r.cur.xp)} XP · ${r.next.name}`
      : `${fmt(P().xp)} XP · rang maximum`;
    $('hangar-dot').classList.toggle('hidden', A.newUnlockCount() === 0);
  }

  // ---------- Accueil ----------
  function refreshTime() {
    const played = A.playedToday(), rem = A.remainingToday();
    const limit = A.dailyLimit();
    $('h-timefill').style.width = `${limit ? Math.min(100, Math.round((played / limit) * 100)) : 100}%`;
    $('h-timeleft').textContent = canPlay() ? `${minLeft(rem)} restantes` : 'Limite atteinte';
    const note = $('h-timenote');
    if (!canPlay()) note.textContent = `Tu as atteint ta limite du jour (${fmtDuration(limit)}). Bravo pour l'entraînement, reviens demain !`;
    else if (rem < P().duration) note.textContent = `Ta prochaine partie sera raccourcie à ${minLeft(rem)} pour respecter la limite.`;
    else note.textContent = `${fmtDuration(played)} jouées sur ${fmtDuration(limit)} autorisées aujourd'hui.`;

    const btn = $('btn-play');
    btn.disabled = !canPlay();
    btn.textContent = canPlay() ? PLAY_LABEL[A.theme().id] : 'Limite du jour atteinte';
    const msg = $('h-limitmsg');
    msg.classList.toggle('hidden', canPlay());
    msg.textContent = 'Le jeu se débloque demain. Tu peux quand même consulter ta progression, ton hangar et tes badges. Un parent peut accorder du temps en plus depuis l\'Espace parent.';
  }

  function refreshHome() {
    const p = P(), t = A.theme();
    const zone = A.zoneOf(p.totalDepth), next = A.nextZone(p.totalDepth);
    $('h-proglabel').textContent = t.progressLabel;
    $('h-depth').textContent = A.fmtProg(p.totalDepth);
    $('h-zone').textContent = zone.name;
    $('h-next').textContent = next ? `Prochaine : ${next.name} à ${A.fmtProg(next.d)}` : t.endText;
    $('h-zonefill').style.width = `${next ? Math.round(((p.totalDepth - zone.d) / (next.d - zone.d)) * 100) : 100}%`;
    document.querySelectorAll('#seg-duration button').forEach(b => b.classList.toggle('on', +b.dataset.v === p.duration));
    $('btn-sound').textContent = `Son : ${p.sound ? 'oui' : 'non'}`;
    refreshTime();

    const ul = $('h-missions');
    ul.textContent = '';
    A.todayMissions().forEach(m => {
      const li = document.createElement('li');
      if (m.done) li.className = 'done';
      const box = div('box');
      box.appendChild(svgIcon('check'));
      li.append(box, Object.assign(document.createElement('span'), { className: 'txt', textContent: m.text }));
      ul.appendChild(li);
    });
    A.save(); // les missions du jour viennent peut-être d'être tirées

    const s = A.streak();
    $('h-streak').textContent = s ? `Série de ${plural(s, 'jour')}` : 'Pas de série en cours';
    document.querySelector('.streak-card').classList.toggle('off', s === 0);
    $('h-today').textContent = `${plural(A.divesToday(), 'partie')} aujourd'hui`;

    worldPicker($('world-picker-home'), refreshHome);

    const how = $('howto-list');
    how.textContent = '';
    [
      ['Pilote', ' : flèches ↑ ↓ ou Z / S, ou la souris. Sur téléphone et tablette, glisse le doigt sur la moitié gauche.'],
      ['Passe dans ', `${t.gates} pour suivre le courant.`],
      ['Capture', ' : Espace ou clic sur ordinateur. Sur téléphone et tablette, touche directement l’objet, ou tape deux fois n’importe où (même à côté de ton avatar). Seulement la cible affichée en haut !'],
      ['Leurres', ' : tout le reste. Laisse-les passer.'],
      ['Pause', ' : bouton ⏸ en haut à droite, ou touche Échap. La pause ne compte pas dans ton temps de jeu.'],
      ['Limite', ` : ${fmtDuration(A.dailyLimit())} de jeu aujourd'hui (réglée par un parent).`],
    ].forEach(([b, rest]) => {
      const li = document.createElement('li');
      const strong = document.createElement('b'); strong.textContent = b;
      li.append(strong, document.createTextNode(rest));
      how.appendChild(li);
    });
    $('howto').open = p.dives.length === 0;
  }

  // ---------- Progression ----------
  function refreshProgress() {
    const p = P(), dives = p.dives;
    const tiles = $('pr-tiles');
    tiles.textContent = '';
    const totalSec = dives.reduce((a, d) => a + (d.dur || 0), 0);
    const first = dives[0], lastD = dives[dives.length - 1];
    const tile = (v, k, delta) => {
      const t = div('tile');
      const vv = div('v', v);
      if (delta) { const d = document.createElement('span'); d.className = 'd'; d.textContent = delta; vv.appendChild(d); }
      t.append(vv, div('k', k));
      tiles.appendChild(t);
    };
    const gain = (a, b) => (a != null && b != null && b - a > 0 ? `+${b - a}` : '');
    tile(String(dives.length), 'parties');
    tile(fmtDuration(totalSec), 'd\'entraînement');
    tile(`Niv. ${p.navLevel}`, `pilotage (max ${p.maxNav})`, first ? gain(first.navL, lastD.navL) : '');
    tile(`Niv. ${p.discLevel}`, `détection (max ${p.maxDisc})`, first ? gain(first.discL, lastD.discL) : '');

    const enough = dives.length >= 2;
    $('pr-empty').classList.toggle('hidden', enough);
    $('pr-charts').classList.toggle('hidden', !enough);
    if (enough) {
      const recent = dives.slice(-30);
      const offset = dives.length - recent.length;
      const xLabels = recent.map((_, i) => `#${offset + i + 1}`);
      const tipTitles = recent.map((d, i) => {
        const dt = new Date(d.date);
        return `Partie #${offset + i + 1} · ${dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ${dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
      });
      const C = A.SERIES_COLORS;
      A.lineChart($('chart-levels'), {
        xLabels, tipTitles, height: 200,
        yMin: 0, yMax: 12, yTicks: [0, 3, 6, 9, 12], fmt: v => String(v),
        aria: 'Niveau de pilotage et de détection en fin de partie',
        series: [
          { label: 'Pilotage', color: C[0], values: recent.map(d => d.navL) },
          { label: 'Détection', color: C[1], values: recent.map(d => d.discL) },
        ],
      });
      A.lineChart($('chart-acc'), {
        xLabels, tipTitles, height: 200,
        yMin: 0, yMax: 100, yTicks: [0, 25, 50, 75, 100], fmt: v => `${v} %`,
        aria: 'Précision par partie : pilotage, détection, contrôle',
        series: [
          { label: 'Pilotage', color: C[0], values: recent.map(d => d.nav) },
          { label: 'Détection', color: C[1], values: recent.map(d => d.det) },
          { label: 'Contrôle', color: C[2], values: recent.map(d => d.ctl) },
        ],
      });
    }

    const body = $('log-body');
    body.textContent = '';
    if (!dives.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 10; td.className = 'empty'; td.textContent = 'Aucune partie pour l\'instant.';
      tr.appendChild(td); body.appendChild(tr);
    }
    const pc = v => (v == null ? '—' : `${v} %`);
    [...dives].reverse().forEach(d => {
      const tr = document.createElement('tr');
      const dt = new Date(d.date);
      [
        `${dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ${dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
        (A.THEMES[d.theme] || A.THEMES.ocean).label,
        fmtDuration(d.dur), pc(d.nav), pc(d.det), pc(d.ctl),
        d.rt == null ? '—' : `${fmt(d.rt)} ms`, `${d.navL} / ${d.discL}`, fmt(d.score), d.xp != null ? `+${d.xp}` : '—',
      ].forEach(c => { const td = document.createElement('td'); td.textContent = c; tr.appendChild(td); });
      body.appendChild(tr);
    });
  }

  // ---------- Hangar ----------
  function drawThumb(cv, kind, item) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth || 150, h = cv.clientHeight || 72;
    cv.width = w * dpr; cv.height = h * dpr;
    const c = cv.getContext('2d');
    const sc = (h / 720) * dpr;
    c.setTransform(sc, 0, 0, sc, 0, 0);
    const VW = (w * dpr) / sc;
    const themeId = A.theme().id, art = A.art(themeId);
    art.background(c, { VW, VH: 720, dist: 200, prog: Math.min(P().totalDepth, 900), speed: 0, dt: 0, t: 1 });
    const base = A.look();
    const look = {
      theme: themeId,
      hull: kind === 'hull' ? item.id : base.hull,
      colors: kind === 'livery' ? item.colors : base.colors,
      trail: kind === 'trail' ? item.id : base.trail,
    };
    const s = 5.2, x = kind === 'trail' ? VW * 0.66 : VW * 0.5, y = 380;
    if (kind === 'trail') {
      const tr = new A.Trail();
      const style = A.trailStyle(look.trail, themeId);
      c.save(); c.translate(x, y); c.scale(s * 0.6, s * 0.6); c.translate(-x, -y);
      for (let i = 0; i < 70; i++) tr.update(1 / 60, 150, x + A.avatarBack(look.hull, themeId), y + Math.sin(i / 9) * 6, style, art.glowHue);
      tr.draw(c, style);
      c.restore();
    }
    A.drawAvatar(c, x, y, 0, 0.3, look, kind === 'trail' ? s * 0.6 : s, false);
  }

  let previewRAF = 0;
  function startPreview() {
    cancelAnimationFrame(previewRAF);
    const cv = $('hangar-preview');
    const tr = new A.Trail();
    let last = performance.now(), dist = 0;
    const loop = now => {
      if (currentTab !== 'hangar' || $('hub').classList.contains('hidden')) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      dist += 120 * dt;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const c = cv.getContext('2d');
      const sc = (h / 720) * dpr;
      c.setTransform(sc, 0, 0, sc, 0, 0);
      const VW = (w * dpr) / sc;
      const look = A.look(), art = A.art(look.theme);
      const t = now / 1000;
      art.background(c, { VW, VH: 720, dist, prog: Math.min(P().totalDepth, 900), speed: 0, dt: 0, t });
      const x = VW * 0.6, y = 400 + Math.sin(t * 1.4) * 40, tilt = Math.cos(t * 1.4) * 0.06, s = 4.2;
      const back = A.avatarBack(look.hull, look.theme) * s;
      const style = A.trailStyle(look.trail, look.theme);
      tr.update(dt, 600, x + back * Math.cos(tilt), y + back * Math.sin(tilt), style, art.glowHue);
      c.save(); c.translate(x, y); c.scale(s * 0.75, s * 0.75); c.translate(-x, -y);
      tr.draw(c, style);
      c.restore();
      A.drawAvatar(c, x, y, tilt, t, look, s, true);
      previewRAF = requestAnimationFrame(loop);
    };
    previewRAF = requestAnimationFrame(loop);
  }

  function refreshHangar() {
    const e = P().equipped;
    $('hg-current').textContent = [
      A.itemView('hull', A.findItem('hull', e.hull)).name,
      A.itemView('livery', A.findItem('livery', e.livery)).name,
      A.itemView('trail', A.findItem('trail', e.trail)).name,
    ].join(' · ');
    const host = $('hangar-sections');
    host.textContent = '';
    const thumbs = [];
    A.KINDS.forEach(kd => {
      const sec = document.createElement('section');
      const head = div('section-title');
      const h = document.createElement('h3'); h.textContent = A.kindLabel(kd.kind);
      const unlocked = kd.list.filter(A.isUnlocked).length;
      head.append(h, div('muted small-txt', `${unlocked} / ${kd.list.length}`));
      const grid = div('items');
      kd.list.forEach(item => {
        const ok = A.isUnlocked(item);
        const view = A.itemView(kd.kind, item);
        const equipped = e[kd.kind] === item.id;
        const b = document.createElement('button');
        b.className = `item${equipped ? ' equipped' : ''}${ok ? '' : ' locked'}`;
        b.type = 'button';
        const cv = document.createElement('canvas');
        b.appendChild(cv);
        thumbs.push([cv, kd.kind, item]);
        if (!ok) { const l = div('lock'); l.appendChild(svgIcon('lock')); b.appendChild(l); }
        if (ok && A.isNew(kd.kind, item.id) && item.unlock.type !== 'default') b.appendChild(div('new', 'NOUVEAU'));
        b.appendChild(div('name', view.name));
        b.appendChild(div('state', equipped ? 'Équipé' : ok ? (view.desc || 'Disponible') : `Débloqué avec : ${A.unlockLabel(item)}`));
        if (ok) b.addEventListener('click', () => { A.equip(kd.kind, item.id); A.SFX.click(); refreshHangar(); });
        else b.setAttribute('aria-disabled', 'true');
        grid.appendChild(b);
      });
      sec.append(head, grid);
      host.appendChild(sec);
    });
    requestAnimationFrame(() => thumbs.forEach(([cv, k, it]) => drawThumb(cv, k, it)));
    A.markSeen();
    refreshPilot();
  }

  // ---------- Badges ----------
  function refreshBadges() {
    const got = A.BADGES.filter(b => P().badges[b.id]).length;
    $('bd-count').textContent = `${got} / ${A.BADGES.length} badges`;
    const grid = $('badge-grid');
    grid.textContent = '';
    A.BADGES.forEach(b => {
      const when = P().badges[b.id];
      const v = A.badgeView(b);
      const card = div(`badge${when ? ' got' : ''}`);
      const ic = div('ic');
      ic.appendChild(svgIcon(b.icon));
      const body = div();
      body.append(div('bn', v.name), div('bd', v.desc));
      if (when) body.appendChild(div('bdate', `Obtenu le ${new Date(when).toLocaleDateString('fr-FR')}`));
      card.append(ic, body);
      grid.appendChild(card);
    });
  }

  // ---------- Navigation ----------
  function setTab(name) {
    currentTab = name;
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
    ['home', 'progress', 'hangar', 'badges'].forEach(t => $(`tab-${t}`).classList.toggle('hidden', t !== name));
    if (name === 'home') refreshHome();
    if (name === 'progress') refreshProgress();
    if (name === 'hangar') { refreshHangar(); startPreview(); }
    if (name === 'badges') refreshBadges();
  }
  function goHub(tab = currentTab) {
    if (A.game.isPlaying()) A.game.quit();
    applyTheme();
    show('hub');
    refreshPilot();
    setTab(tab);
  }

  // ---------- Résultats ----------
  function commentFor(r) {
    const scores = [['nav', r.nav], ['det', r.det], ['ctl', r.ctl]].filter(x => x[1] != null);
    if (!scores.length) return 'Partie courte : relance une partie complète pour voir tes stats.';
    const best = scores.reduce((a, b) => (b[1] > a[1] ? b : a));
    const worst = scores.reduce((a, b) => (b[1] < a[1] ? b : a));
    const praise = {
      nav: 'Trajectoire propre : tu as bien tenu le cap.',
      det: 'Bon œil : tu as repéré presque toutes les cibles.',
      ctl: 'Gros self-control : tu as laissé passer les leurres sans mordre à l\'hameçon.',
    };
    const tips = {
      nav: 'Astuce : regarde le passage suivant plutôt que ton avatar.',
      det: 'Astuce : garde un œil sur la zone de droite, c\'est là que les cibles apparaissent.',
      ctl: 'Astuce : vérifie la forme ET la couleur avant de capturer.',
    };
    let msg = scores.every(x => x[1] >= 85)
      ? 'Partie solide sur toute la ligne. Le niveau va monter, donc ça va se corser.'
      : praise[best[0]];
    if (r.imp >= 6) msg += ' Attends de voir la cible avant d\'appuyer : les captures dans le vide comptent comme des erreurs.';
    else if (worst[0] !== best[0] && worst[1] < 75) msg += ` ${tips[worst[0]]}`;
    return msg;
  }

  function chip(kind, label, cls = '') {
    const c = div(`chip ${cls}`);
    const k = document.createElement('span'); k.className = 'kind'; k.textContent = kind;
    c.append(k, document.createTextNode(label));
    return c;
  }

  function refreshLimitOnResults() {
    const msg = $('r-limitmsg');
    const again = $('btn-again');
    if (!canPlay()) {
      msg.textContent = `Tu as atteint ta limite du jour (${fmtDuration(A.dailyLimit())}). Bravo pour l'entraînement, à demain !`;
      msg.classList.remove('hidden');
      again.disabled = true;
      again.textContent = 'Limite du jour atteinte';
    } else {
      const rem = A.remainingToday();
      msg.classList.toggle('hidden', rem >= P().duration);
      msg.textContent = `Il te reste ${minLeft(rem)} de jeu aujourd'hui : la prochaine partie sera raccourcie.`;
      again.disabled = false;
      again.textContent = 'Rejouer';
    }
  }

  A.onDiveEnd = raw => {
    const rep = A.recordDive(raw);
    const r = rep.record;
    const t = A.theme();
    const zoneBefore = A.zoneOf(raw.startDepth).name, zoneNow = A.zoneOf(raw.endDepth).name;

    $('r-title').textContent = r.gain === 0 && raw.endDepth >= A.MAX_DEPTH ? 'Destination atteinte' : `+${A.fmtProg(r.gain)}`;
    $('r-zone').textContent = zoneNow !== zoneBefore
      ? `Nouvelle zone : ${zoneNow} · ${A.fmtProg(raw.endDepth)}`
      : `${zoneNow} · ${A.fmtProg(raw.endDepth)}`;
    $('r-score').textContent = fmt(r.score);
    $('r-record').classList.toggle('hidden', !(r.score > 0 && r.score >= P().bestScore && P().dives.length > 1));
    $('r-nav').textContent = r.nav == null ? '—' : `${r.nav} %`;
    $('r-det').textContent = r.det == null ? '—' : `${r.det} %`;
    $('r-ctl').textContent = r.ctl == null ? '—' : `${r.ctl} %`;
    $('r-rt').textContent = r.rt == null ? '—' : `${fmt(r.rt)} ms`;
    $('r-levels').textContent =
      `Pilotage niv. ${r.startNav} → ${r.navL} · Détection niv. ${r.startDisc} → ${r.discL} · meilleure série ${r.combo}`;

    // XP
    $('r-xp').textContent = `+${fmt(rep.xpTotal)} XP`;
    const ra = rep.rankAfter;
    $('r-rankline').textContent = ra.next
      ? `${ra.name} · encore ${fmt(ra.next.xp - rep.xpAfter)} XP pour ${ra.next.name}`
      : `${ra.name} · rang maximum`;
    const list = $('r-xplist');
    list.textContent = '';
    rep.xp.forEach(x => {
      const li = document.createElement('li');
      const b = document.createElement('b'); b.textContent = `+${x.v}`;
      li.append(document.createTextNode(x.label), b);
      list.appendChild(li);
    });
    const fill = $('r-xpfill');
    const rankedUp = ra.index > rep.rankBefore.index;
    fill.style.transition = 'none';
    fill.style.width = `${Math.round(rep.rankBefore.progress * 100)}%`;
    void fill.offsetWidth;
    fill.style.transition = '';
    setTimeout(() => {
      fill.style.width = rankedUp ? '100%' : `${Math.round(ra.progress * 100)}%`;
      if (rankedUp) {
        setTimeout(() => {
          fill.style.transition = 'none'; fill.style.width = '0%'; void fill.offsetWidth;
          fill.style.transition = ''; fill.style.width = `${Math.round(ra.progress * 100)}%`;
        }, 1200);
      }
    }, 250);

    // récompenses
    const chips = $('r-chips');
    chips.textContent = '';
    if (rankedUp) chips.appendChild(chip('Nouveau rang', ra.name, 'rank'));
    rep.newBadges.forEach(b => chips.appendChild(chip('Badge', b.name)));
    rep.newUnlocks.forEach(u => chips.appendChild(chip(SINGULAR[t.id][u.kind], A.itemView(u.kind, u.item).name)));
    rep.missionsDone.forEach(m => chips.appendChild(chip('Mission', m, 'rank')));
    [...chips.children].forEach((c, i) => { c.style.animationDelay = `${0.4 + i * 0.12}s`; });
    $('r-rewards').classList.toggle('hidden', chips.children.length === 0);
    $('btn-to-hangar').classList.toggle('hidden', rep.newUnlocks.length === 0);
    if (chips.children.length) setTimeout(() => A.SFX.unlock(), 400);

    $('r-comment').textContent = commentFor(r);
    refreshLimitOnResults();
    show('results');
  };

  A.onPauseChange = paused => {
    if (paused) {
      $('pause-info').textContent = `Il te reste ${minLeft(A.remainingToday())} de jeu aujourd'hui. Le temps de pause ne compte pas.`;
    }
    show(paused ? 'pause' : null);
  };
  A.onPlayChange = playing => $('btn-pause').classList.toggle('hidden', !playing);

  // ---------- Boutons ----------
  const startDive = () => {
    if (!A.game.start()) { goHub('home'); return; }
    show(null);
  };
  $('btn-play').addEventListener('click', startDive);
  $('btn-again').addEventListener('click', startDive);
  $('btn-pause').addEventListener('click', () => A.game.togglePause());
  $('btn-menu').addEventListener('click', () => goHub('home'));
  $('btn-to-hangar').addEventListener('click', () => goHub('hangar'));
  $('btn-resume').addEventListener('click', () => A.game.togglePause());
  $('btn-quit').addEventListener('click', () => { A.game.quit(); goHub('home'); });
  $('btn-sound').addEventListener('click', () => { P().sound = !P().sound; A.save(); refreshHome(); });
  document.querySelectorAll('#seg-duration button').forEach(b => b.addEventListener('click', () => {
    P().duration = +b.dataset.v; A.save(); refreshHome();
  }));
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  $('pilot-chip').addEventListener('click', openOnboard);
  function openOnboard() {
    $('callsign').value = P().callsign || '';
    show('onboard');
    const host = $('world-picker-onboard');
    const redraw = () => worldPicker(host, redraw); // redessine la sélection après chaque choix
    redraw();
    $('callsign').focus();
  }
  $('onboard-form').addEventListener('submit', e => {
    e.preventDefault();
    P().callsign = $('callsign').value.trim().slice(0, 16) || 'Pilote';
    A.save();
    goHub('home');
  });
  $('streak-path').setAttribute('d', A.ICONS.streak);
  A.ui = { show, goHub, fmtDuration };

  // ---------- Partager (QR code) ----------
  $('share-url').textContent = A.PUBLIC_URL;
  $('share-url').href = A.PUBLIC_URL;
  const shareCopy = $('share-copy');
  const canNativeShare = typeof navigator.share === 'function';
  $('share-native').classList.toggle('hidden', !canNativeShare);
  $('btn-share').addEventListener('click', () => {
    shareCopy.textContent = 'Copier le lien';
    show('share');
  });
  $('share-close').addEventListener('click', () => goHub());
  // QR code agrandi en plein écran (plus facile à scanner depuis un autre appareil)
  $('share-qr').addEventListener('click', () => $('qr-zoom').classList.remove('hidden'));
  $('qr-zoom').addEventListener('click', () => $('qr-zoom').classList.add('hidden'));
  shareCopy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(A.PUBLIC_URL);
      shareCopy.textContent = 'Lien copié ✓';
    } catch (e) {
      // presse-papiers indisponible (page locale, ancien navigateur) : on sélectionne le lien
      const r = document.createRange();
      r.selectNodeContents($('share-url'));
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      shareCopy.textContent = 'Lien sélectionné : fais Ctrl+C';
    }
  });
  $('share-native').addEventListener('click', () => {
    navigator.share({ title: 'Abysse', text: 'Un jeu pour entraîner son attention', url: A.PUBLIC_URL }).catch(() => {});
  });
  addEventListener('keydown', e => {
    if (e.code !== 'Escape') return;
    if (!$('qr-zoom').classList.contains('hidden')) $('qr-zoom').classList.add('hidden');
    else if (!$('share').classList.contains('hidden')) goHub();
  });

  // le temps restant affiché reste à jour (passage de minuit, autre onglet…)
  setInterval(() => {
    if (!$('hub').classList.contains('hidden') && currentTab === 'home') refreshTime();
  }, 15000);

  // ---------- Démarrage ----------
  // Mode dev : index.html#sim=180&n=6&tab=progress&theme=space  (n parties simulées par un bot)
  //            ajouter &limit pour respecter la limite quotidienne pendant la simulation
  const hp = new URLSearchParams(location.hash.slice(1));
  if (hp.has('theme') && A.THEMES[hp.get('theme')]) { P().theme = hp.get('theme'); A.save(); }
  applyTheme();
  if (hp.has('sim')) {
    if (!P().callsign) P().callsign = 'Testeur';
    A.devNoLimit = !hp.has('limit');
    const sec = +hp.get('sim'), n = +(hp.get('n') || 1);
    show(null);
    for (let i = 0; i < n; i++) if (!A.game.simulate(sec)) break;
    A.devNoLimit = false;
    if (hp.has('tab')) goHub(hp.get('tab'));
    else if (hp.has('pause') && A.game.isPlaying()) A.game.togglePause();
  } else if (hp.has('onboard') || !P().callsign) {
    openOnboard();
  } else {
    goHub('home');
  }
})();
