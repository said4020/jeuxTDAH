'use strict';
/* Profil du joueur : sauvegarde, XP et rangs, badges, déblocages, missions, série de jours. */
(() => {
  const A = window.Abysse;
  const KEY = 'abysse.profile.v2';
  const OLD_KEY = 'abysse.profile.v1';

  const fresh = () => ({
    version: 2, callsign: '', theme: 'ocean', xp: 0,
    navLevel: 1, discLevel: 1, maxNav: 1, maxDisc: 1,
    totalDepth: 0, bestScore: 0, bestCombo: 0,
    dives: [], duration: 180, sound: true, daily: {},
    badges: {}, equipped: { hull: 'eclaireur', livery: 'corail', trail: 'bulles' },
    missions: null, seen: [],
    parent: freshParent(),
  });
  // Réglages parent : code (haché), limite quotidienne, limite week-end, bonus du jour, anti-essais
  function freshParent() {
    return { pin: null, salt: null, limit: A.DAILY_LIMIT, weekend: null, bonus: null, fails: 0, lockUntil: 0 };
  }

  A.dayKey = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  function load() {
    let p = null;
    try { p = JSON.parse(localStorage.getItem(KEY)); } catch (e) { p = null; }
    if (!p) {
      try {
        const old = JSON.parse(localStorage.getItem(OLD_KEY));
        if (old) {
          // reprise de la v1 : on estime l'XP à partir du nombre de plongées
          p = Object.assign({}, old, { version: 2, xp: (old.dives || []).length * 250 });
          p.maxNav = Math.max(1, ...(old.dives || []).map(d => d.navL || 1));
          p.maxDisc = Math.max(1, ...(old.dives || []).map(d => d.discL || 1));
        }
      } catch (e) { p = null; }
    }
    const base = fresh();
    const out = Object.assign(base, p || {});
    out.equipped = Object.assign(fresh().equipped, (p && p.equipped) || {});
    out.badges = out.badges || {};
    out.parent = Object.assign(freshParent(), (p && p.parent) || {});
    out.seen = out.seen || [];
    return out;
  }

  A.save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(A.profile)); } catch (e) { /* stockage indisponible */ }
  };

  A.reset = () => {
    // le temps de jeu du jour est conservé : effacer la progression ne contourne pas la limite
    const p = A.profile;
    const keep = { sound: p.sound, duration: p.duration, callsign: p.callsign, theme: p.theme, daily: p.daily, parent: p.parent };
    A.profile = Object.assign(fresh(), keep);
    A.markSeen();
    A.save();
  };

  // ----- Rangs -----
  A.rankOf = xp => {
    let i = 0;
    while (i < A.RANKS.length - 1 && xp >= A.RANKS[i + 1].xp) i++;
    const cur = A.RANKS[i], next = A.RANKS[i + 1] || null;
    const progress = next ? (xp - cur.xp) / (next.xp - cur.xp) : 1;
    return { index: i, name: cur.name, cur, next, progress };
  };

  // ----- Temps de jeu quotidien -----
  A.playedToday = () => A.profile.daily[A.dayKey()] || 0;
  // limite du jour : limite normale ou week-end, + bonus accordé par un parent pour ce jour-là
  A.dailyLimit = (d = new Date()) => {
    const pa = A.profile.parent;
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    let base = weekend && pa.weekend != null ? pa.weekend : pa.limit;
    if (pa.bonus && pa.bonus.date === A.dayKey(d)) base += pa.bonus.sec;
    return base;
  };
  A.remainingToday = () => Math.max(0, A.dailyLimit() - A.playedToday());
  A.logPlayTime = sec => {
    const p = A.profile, k = A.dayKey();
    p.daily[k] = (p.daily[k] || 0) + sec;
    const days = Object.keys(p.daily).sort();
    while (days.length > 60) delete p.daily[days.shift()];
    A.save();
  };

  // ----- Série de jours consécutifs -----
  A.streak = () => {
    const d = new Date();
    let n = 0;
    if (!(A.profile.daily[A.dayKey(d)] > 0)) d.setDate(d.getDate() - 1);
    while (A.profile.daily[A.dayKey(d)] > 0) { n++; d.setDate(d.getDate() - 1); }
    return n;
  };
  A.divesToday = () => {
    const k = A.dayKey();
    return A.profile.dives.filter(d => A.dayKey(new Date(d.date)) === k).length;
  };

  // ----- Missions du jour (tirage déterministe à partir de la date) -----
  function seeded(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  }
  A.todayMissions = () => {
    const k = A.dayKey();
    if (!A.profile.missions || A.profile.missions.date !== k) {
      const rnd = seeded(`abysse-${k}`);
      const pool = A.MISSIONS.map(m => m.id);
      const ids = [];
      while (ids.length < 3) ids.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
      A.profile.missions = { date: k, ids, done: {} };
    }
    const m = A.profile.missions;
    return m.ids.map(id => {
      const def = A.MISSIONS.find(x => x.id === id);
      return { id, text: A.missionText(def), done: !!m.done[id] };
    });
  };

  // ----- Déblocages -----
  A.findItem = (kind, id) => A.KINDS.find(k => k.kind === kind).list.find(x => x.id === id);
  A.isUnlocked = item => {
    const u = item.unlock;
    if (u.type === 'default') return true;
    if (u.type === 'rank') return A.rankOf(A.profile.xp).index >= u.rank;
    if (u.type === 'badge') return !!A.profile.badges[u.badge];
    return false;
  };
  A.unlockLabel = item => {
    const u = item.unlock;
    if (u.type === 'rank') return `Rang ${A.RANKS[u.rank].name}`;
    if (u.type === 'badge') {
      const b = A.BADGES.find(x => x.id === u.badge);
      return `Badge « ${A.badgeView(b).name} »`;
    }
    return '';
  };
  const unlockedKeys = () => {
    const out = [];
    A.KINDS.forEach(k => k.list.forEach(it => { if (A.isUnlocked(it)) out.push(`${k.kind}:${it.id}`); }));
    return out;
  };
  A.newUnlockCount = () => unlockedKeys().filter(k => !A.profile.seen.includes(k)).length;
  A.isNew = (kind, id) => !A.profile.seen.includes(`${kind}:${id}`);
  A.markSeen = () => { A.profile.seen = unlockedKeys(); A.save(); };
  A.equip = (kind, id) => {
    const it = A.findItem(kind, id);
    if (!it || !A.isUnlocked(it)) return false;
    A.profile.equipped[kind] = id;
    A.save();
    return true;
  };
  A.look = () => {
    const e = A.profile.equipped;
    const liv = A.findItem('livery', e.livery) || A.LIVERIES[0];
    return { theme: A.theme().id, hull: e.hull, colors: liv.colors, trail: e.trail };
  };

  // ----- Badges -----
  function award(id, list) {
    if (A.profile.badges[id]) return;
    A.profile.badges[id] = Date.now();
    list.push(id);
  }
  function globalBadges(list) {
    const p = A.profile;
    if (p.dives.length >= 1) award('first', list);
    if (p.totalDepth >= 200) award('zone_twilight', list);
    if (p.totalDepth >= 1000) award('zone_midnight', list);
    if (p.totalDepth >= 4000) award('zone_abyss', list);
    if (p.totalDepth >= 6000) award('zone_hadal', list);
    if (p.totalDepth >= A.MAX_DEPTH) award('trench', list);
    if (p.dives.length >= 10) award('dives10', list);
    if (p.dives.length >= 30) award('dives30', list);
    if (p.maxNav >= 6 && p.maxDisc >= 6) award('lvl6', list);
    if (p.maxNav >= 10 || p.maxDisc >= 10) award('lvl10', list);
    if (p.bestCombo >= 25) award('combo25', list);
    if (p.bestCombo >= 60) award('combo60', list);
    const s = A.streak();
    if (s >= 3) award('streak3', list);
    if (s >= 7) award('streak7', list);
  }
  function diveBadges(r, list) {
    if (r.gates >= 40 && r.nav === 100) award('nav100', list);
    if (r.targets >= 12 && r.det >= 95) award('det95', list);
    if (r.lures >= 15 && r.ctl === 100 && r.det >= 70) award('ctl100', list);
    if (r.imp === 0 && r.det >= 70 && r.dur >= 110) award('zeroimp', list);
  }

  // ----- Enregistrement d'une plongée -----
  // r : { dur, nav, det, ctl, imp, rt, navL, discL, startNav, startDisc, maxNav, maxDisc,
  //       score, gain, combo, gates, targets, lures, endDepth }
  A.recordDive = r => {
    const p = A.profile;
    const before = new Set(unlockedKeys());
    const rankBefore = A.rankOf(p.xp);
    const xpBefore = p.xp;

    const record = Object.assign({ date: Date.now() }, r);
    p.dives.push(record);
    if (p.dives.length > 300) p.dives = p.dives.slice(-300);
    p.totalDepth = Math.round(Math.min(A.MAX_DEPTH, r.endDepth));
    p.navLevel = r.navL; p.discLevel = r.discL;
    p.maxNav = Math.max(p.maxNav, r.maxNav);
    p.maxDisc = Math.max(p.maxDisc, r.maxDisc);
    p.bestScore = Math.max(p.bestScore, r.score);
    p.bestCombo = Math.max(p.bestCombo, r.combo);
    // (le temps de jeu est déjà enregistré en continu par le moteur via A.logPlayTime)

    // missions
    const missions = A.todayMissions();
    const ctx = { divesToday: A.divesToday() };
    const missionsDone = [];
    missions.forEach(m => {
      if (m.done) return;
      const def = A.MISSIONS.find(x => x.id === m.id);
      if (def.test(r, ctx)) { p.missions.done[m.id] = true; missionsDone.push(A.missionText(def)); }
    });

    // XP : l'effort et la régularité comptent autant que la performance
    const scores = [r.nav, r.det, r.ctl].filter(v => v != null);
    const quality = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const xp = [
      { label: 'Temps de jeu', v: Math.round(r.dur) },
      { label: 'Précision', v: Math.round(quality * 1.2) },
      { label: 'Niveaux atteints', v: (r.navL + r.discL) * 5 },
    ];
    if (ctx.divesToday === 1) xp.push({ label: 'Première partie du jour', v: 50 });
    if (missionsDone.length) xp.push({ label: `Missions (${missionsDone.length})`, v: missionsDone.length * A.MISSION_XP });
    const xpTotal = xp.reduce((a, b) => a + b.v, 0);
    p.xp += xpTotal;
    record.xp = xpTotal;

    const newBadges = [];
    diveBadges(r, newBadges);
    globalBadges(newBadges);

    const newUnlocks = [];
    A.KINDS.forEach(kd => kd.list.forEach(it => {
      const key = `${kd.kind}:${it.id}`;
      if (A.isUnlocked(it) && !before.has(key)) newUnlocks.push({ kind: kd.kind, item: it });
    }));

    A.save();
    return {
      record, xp, xpTotal, xpBefore, xpAfter: p.xp,
      rankBefore, rankAfter: A.rankOf(p.xp),
      newBadges: newBadges.map(id => A.badgeView(A.BADGES.find(b => b.id === id))),
      newUnlocks, missionsDone,
    };
  };

  A.profile = load();
  // rattrapage silencieux des badges globaux (ex. après migration v1)
  const silent = [];
  globalBadges(silent);
  if (!A.profile.seen.length) A.profile.seen = unlockedKeys();
  A.save();
})();
