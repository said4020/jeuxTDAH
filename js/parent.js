'use strict';
/* Espace parent : code à 4 chiffres (haché + salé), limite de temps quotidienne, week-end, bonus du jour,
 * historique 7 jours, changement de code, effacement de la progression. */
(() => {
  const A = window.Abysse;
  const $ = id => document.getElementById(id);
  const pa = () => A.profile.parent;
  const MAX_FAILS = 5;
  const LOCK_MS = 5 * 60 * 1000;

  let mode = 'login'; // setup | change | login

  // ---------- Code ----------
  const toHex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  const newSalt = () => toHex(crypto.getRandomValues(new Uint8Array(8)));
  async function hashPin(pin, salt) {
    const text = `abysse:${salt}:${pin}`;
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return toHex(new Uint8Array(buf));
    }
    // repli (contexte non sécurisé) : FNV-1a itéré
    let h = 2166136261;
    for (let r = 0; r < 2000; r++) for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i) + r; h = Math.imul(h, 16777619); }
    return `fnv${(h >>> 0).toString(16)}`;
  }

  // ---------- Écran code ----------
  const err = msg => { $('pa-err').textContent = msg || ''; };
  function lockedLeft() { return Math.max(0, pa().lockUntil - Date.now()); }

  function renderLock() {
    const setup = mode !== 'login';
    $('pa-lock').classList.remove('hidden');
    $('pa-panel').classList.add('hidden');
    $('pa-pin').value = '';
    $('pa-pin2').value = '';
    $('pa-pin2').classList.toggle('hidden', !setup);
    $('pa-forgot').classList.toggle('hidden', setup);
    $('pa-title').textContent = mode === 'setup' ? 'Crée le code parent' : mode === 'change' ? 'Nouveau code parent' : 'Accès protégé';
    $('pa-lock-text').textContent = setup
      ? 'Choisis un code à 4 chiffres et garde-le pour toi : il protège les réglages du temps de jeu.'
      : 'Entre le code parent à 4 chiffres.';
    err('');
    const left = lockedLeft();
    if (!setup && left) err(`Trop d'essais. Réessaie dans ${Math.ceil(left / 60000)} min.`);
    setTimeout(() => $('pa-pin').focus(), 50);
  }

  async function onSubmit(e) {
    e.preventDefault();
    const pin = $('pa-pin').value.trim();
    if (!/^\d{4}$/.test(pin)) { err('Le code doit contenir exactement 4 chiffres.'); return; }

    if (mode === 'setup' || mode === 'change') {
      if (pin !== $('pa-pin2').value.trim()) { err('Les deux codes ne correspondent pas.'); return; }
      const salt = newSalt();
      pa().salt = salt;
      pa().pin = await hashPin(pin, salt);
      pa().fails = 0; pa().lockUntil = 0;
      A.save();
      showPanel(mode === 'change' ? 'Code modifié.' : 'Code créé.');
      return;
    }

    const left = lockedLeft();
    if (left) { err(`Trop d'essais. Réessaie dans ${Math.ceil(left / 60000)} min.`); return; }
    const h = await hashPin(pin, pa().salt);
    if (h === pa().pin) {
      pa().fails = 0;
      A.save();
      showPanel();
    } else {
      pa().fails += 1;
      if (pa().fails >= MAX_FAILS) {
        pa().fails = 0;
        pa().lockUntil = Date.now() + LOCK_MS;
        err('Trop d\'essais. Réessaie dans 5 min.');
      } else {
        const r = MAX_FAILS - pa().fails;
        err(`Code incorrect. ${r} essai${r > 1 ? 's' : ''} restant${r > 1 ? 's' : ''}.`);
      }
      A.save();
      $('pa-pin').value = '';
    }
  }

  // ---------- Réglages ----------
  const fmtMin = sec => A.ui.fmtDuration(sec);
  function setupRange(el, valueSec) {
    const R = A.LIMIT_RANGE;
    el.min = R.min; el.max = R.max; el.step = R.step;
    el.value = Math.round(valueSec / 60);
  }

  function renderPanel() {
    const p = pa();
    setupRange($('pa-limit'), p.limit);
    $('pa-limit-val').textContent = fmtMin(p.limit);
    const we = p.weekend != null;
    $('pa-we-on').checked = we;
    $('pa-we-row').classList.toggle('hidden', !we);
    setupRange($('pa-we'), we ? p.weekend : p.limit);
    $('pa-we-val').textContent = fmtMin(we ? p.weekend : p.limit);

    const today = A.dayKey();
    const bonus = p.bonus && p.bonus.date === today ? p.bonus.sec : 0;
    $('pa-bonus-state').textContent = bonus
      ? `+${fmtMin(bonus)} · limite du jour ${fmtMin(A.dailyLimit())}`
      : `aucun · limite du jour ${fmtMin(A.dailyLimit())}`;
    $('pa-bonus-clear').disabled = !bonus;

    // historique 7 jours : barre = temps joué / limite de ce jour (étiquette en clair, pas seulement la couleur)
    const host = $('pa-week');
    host.textContent = '';
    let total = 0;
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const played = A.profile.daily[A.dayKey(d)] || 0;
      total += played;
      const limit = A.dailyLimit(d);
      const row = document.createElement('div');
      row.className = 'week-row';
      const label = document.createElement('span');
      label.className = 'wd';
      label.textContent = i === 0 ? 'Aujourd\'hui' : d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' });
      const track = document.createElement('span');
      track.className = 'wt';
      const fill = document.createElement('i');
      const ratio = limit ? Math.min(1, played / limit) : 0;
      fill.style.width = `${Math.round(ratio * 100)}%`;
      if (ratio >= 0.999) fill.className = 'full';
      track.appendChild(fill);
      const val = document.createElement('span');
      val.className = 'wv';
      val.textContent = played ? `${fmtMin(played)} / ${fmtMin(limit)}` : '—';
      row.append(label, track, val);
      host.appendChild(row);
    }
    $('pa-week-total').textContent = `${fmtMin(total)} au total`;
  }

  function showPanel(notice) {
    $('pa-lock').classList.add('hidden');
    $('pa-panel').classList.remove('hidden');
    $('pa-title').textContent = 'Réglages';
    renderPanel();
    if (notice) flash(notice);
  }

  let flashTimer = 0;
  function flash(text) {
    const t = $('pa-title');
    t.textContent = `Réglages · ${text}`;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { t.textContent = 'Réglages'; }, 2200);
  }

  // ---------- Ouverture / fermeture ----------
  function open() {
    if (A.game.isPlaying()) A.game.quit();
    mode = pa().pin ? 'login' : 'setup';
    A.ui.show('parent');
    renderLock();
  }
  function close() { A.ui.goHub('home'); }

  // ---------- Événements ----------
  $('btn-parent').addEventListener('click', open);
  $('pa-close').addEventListener('click', close);
  $('pa-lock').addEventListener('submit', onSubmit);
  ['pa-pin', 'pa-pin2'].forEach(id => $(id).addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
  }));

  $('pa-limit').addEventListener('input', e => {
    pa().limit = +e.target.value * 60;
    A.save(); renderPanel();
  });
  $('pa-we-on').addEventListener('change', e => {
    pa().weekend = e.target.checked ? pa().limit : null;
    A.save(); renderPanel();
  });
  $('pa-we').addEventListener('input', e => {
    pa().weekend = +e.target.value * 60;
    A.save(); renderPanel();
  });
  document.querySelectorAll('[data-bonus]').forEach(b => b.addEventListener('click', () => {
    const today = A.dayKey();
    const cur = pa().bonus && pa().bonus.date === today ? pa().bonus.sec : 0;
    pa().bonus = { date: today, sec: Math.min(cur + +b.dataset.bonus * 60, 120 * 60) };
    A.save(); renderPanel();
    flash(`+${b.dataset.bonus} min accordées`);
  }));
  $('pa-bonus-clear').addEventListener('click', () => {
    pa().bonus = null;
    A.save(); renderPanel();
  });
  $('pa-change').addEventListener('click', () => { mode = 'change'; renderLock(); });
  $('btn-reset').addEventListener('click', () => {
    if (!confirm('Effacer toute la progression (XP, badges, objets débloqués, historique) ?\nLe temps déjà joué aujourd\'hui et les réglages parent sont conservés.')) return;
    A.reset();
    flash('Progression effacée');
    renderPanel();
  });
  addEventListener('keydown', e => {
    if (e.code === 'Escape' && !$('parent').classList.contains('hidden')) close();
  });

  A.parentSpace = { open };
  if (new URLSearchParams(location.hash.slice(1)).has('parent')) open();
})();
