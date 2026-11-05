'use strict';
/* Contenu commun aux trois univers : rangs, objets à débloquer, badges, missions, icônes. */
window.Abysse = window.Abysse || {};
(() => {
  const A = window.Abysse;

  // Limite de temps de jeu quotidienne par défaut (secondes) — réglable dans l'Espace parent
  A.DAILY_LIMIT = 30 * 60;
  // Adresse publique du jeu (GitHub Pages) : utilisée par le bouton « Partager » et le QR code (qr.png)
  A.PUBLIC_URL = 'https://said4020.github.io/jeuxTDAH/';
  A.LIMIT_RANGE = { min: 10, max: 90, step: 5 }; // minutes
  A.MIN_DIVE = 20; // en dessous, on ne lance plus de partie

  // XP cumulée nécessaire pour chaque rang (~300 XP par partie de 3 min)
  A.RANKS = [
    { xp: 0, name: 'Recrue' },
    { xp: 600, name: 'Cadet' },
    { xp: 1500, name: 'Pilote' },
    { xp: 3000, name: 'Pilote confirmé' },
    { xp: 5000, name: 'Lieutenant' },
    { xp: 8000, name: 'Commandant' },
    { xp: 12000, name: 'Capitaine' },
    { xp: 17000, name: 'Amiral' },
    { xp: 24000, name: 'Légende' },
  ];

  // Paliers de progression communs (les noms viennent de l'univers choisi)
  A.MAX_DEPTH = 10935;
  A.ZONE_STEPS = [0, 200, 1000, 4000, 6000, 10935];

  // ----- Personnalisation (noms des avatars et sillages : voir themes.js) -----
  A.HULLS = [
    { id: 'eclaireur', unlock: { type: 'default' } },
    { id: 'manta', unlock: { type: 'rank', rank: 2 } },
    { id: 'orque', unlock: { type: 'badge', badge: 'zone_midnight' } },
    { id: 'bathy', unlock: { type: 'badge', badge: 'zone_abyss' } },
    { id: 'spectre', unlock: { type: 'rank', rank: 5 } },
  ];
  A.LIVERIES = [
    { id: 'corail', name: 'Corail', colors: { hi: '#ffd27a', main: '#f39a2e', lo: '#b5601a', accent: '#e8892a' }, unlock: { type: 'default' } },
    { id: 'arctique', name: 'Arctique', colors: { hi: '#ffffff', main: '#d3e2ee', lo: '#7f97aa', accent: '#aebfcd' }, unlock: { type: 'rank', rank: 1 } },
    { id: 'abysse', name: 'Bleu nuit', colors: { hi: '#79bcff', main: '#2a6fd1', lo: '#123a78', accent: '#1f5bb0' }, unlock: { type: 'badge', badge: 'streak3' } },
    { id: 'toxique', name: 'Toxique', colors: { hi: '#ecff8f', main: '#a8e01c', lo: '#557f0b', accent: '#8cc214' }, unlock: { type: 'badge', badge: 'combo25' } },
    { id: 'carbone', name: 'Carbone', colors: { hi: '#5f6b77', main: '#2c343d', lo: '#12171d', accent: '#40f0d6' }, unlock: { type: 'badge', badge: 'zeroimp' } },
    { id: 'magma', name: 'Magma', colors: { hi: '#ff9e80', main: '#e0402a', lo: '#7a1a10', accent: '#ff7a3d' }, unlock: { type: 'badge', badge: 'det95' } },
    { id: 'or', name: 'Or', colors: { hi: '#fff3b0', main: '#e6b422', lo: '#86600f', accent: '#ffd84a' }, unlock: { type: 'badge', badge: 'trench' } },
  ];
  A.TRAILS = [
    { id: 'bulles', unlock: { type: 'default' } },
    { id: 'plancton', unlock: { type: 'badge', badge: 'nav100' } },
    { id: 'etincelles', name: 'Étincelles', desc: 'Un sillage de braises.', unlock: { type: 'rank', rank: 4 } },
    { id: 'neon', name: 'Néon', desc: 'Un ruban de lumière continu.', unlock: { type: 'badge', badge: 'streak7' } },
    { id: 'comete', name: 'Comète', desc: 'Une traînée dorée.', unlock: { type: 'badge', badge: 'lvl10' } },
  ];
  A.KINDS = [
    { kind: 'hull', list: A.HULLS },
    { kind: 'livery', list: A.LIVERIES },
    { kind: 'trail', list: A.TRAILS },
  ];

  // ----- Badges (zone = indice du palier : nom et texte fournis par l'univers) -----
  A.BADGES = [
    { id: 'first', name: 'Baptême', desc: 'Termine ta première partie.', icon: 'dive' },
    { id: 'zone_twilight', zone: 1, icon: 'depth' },
    { id: 'zone_midnight', zone: 2, icon: 'depth' },
    { id: 'zone_abyss', zone: 3, icon: 'depth' },
    { id: 'zone_hadal', zone: 4, icon: 'depth' },
    { id: 'trench', zone: 5, icon: 'depth' },
    { id: 'combo25', name: 'En rythme', desc: 'Enchaîne une série de 25.', icon: 'combo' },
    { id: 'combo60', name: 'Imperturbable', desc: 'Enchaîne une série de 60.', icon: 'combo' },
    { id: 'nav100', name: 'Trajectoire parfaite', desc: 'Réussis 100 % des passages sur une partie (40 min.).', icon: 'nav' },
    { id: 'det95', name: 'Œil de lynx', desc: 'Capte au moins 95 % des cibles sur une partie (12 cibles min.).', icon: 'detect' },
    { id: 'ctl100', name: 'Sang-froid', desc: 'Ne capture aucun leurre sur une partie (15 leurres min., 70 % de détection).', icon: 'control' },
    { id: 'zeroimp', name: 'Zéro impulsion', desc: 'Aucune capture dans le vide sur une partie (70 % de détection min.).', icon: 'control' },
    { id: 'lvl6', name: 'Double expertise', desc: 'Atteins le niveau 6 en pilotage et en détection.', icon: 'level' },
    { id: 'lvl10', name: 'Élite', desc: 'Atteins le niveau 10 en pilotage ou en détection.', icon: 'level' },
    { id: 'streak3', name: 'Régulier', desc: 'Joue 3 jours d\'affilée.', icon: 'streak' },
    { id: 'streak7', name: 'Discipline', desc: 'Joue 7 jours d\'affilée.', icon: 'streak' },
    { id: 'dives10', name: 'Habitué', desc: 'Termine 10 parties.', icon: 'dive' },
    { id: 'dives30', name: 'Vétéran', desc: 'Termine 30 parties.', icon: 'dive' },
  ];

  // ----- Missions du jour (3 tirées chaque jour) -----
  A.MISSION_XP = 100;
  A.MISSIONS = [
    { id: 'nav80', text: 'Termine une partie avec au moins 80 % en pilotage', test: d => d.nav >= 80 },
    { id: 'det80', text: 'Termine une partie avec au moins 80 % en détection', test: d => d.det >= 80 },
    { id: 'ctl85', text: 'Ignore au moins 85 % des leurres sur une partie', test: d => d.ctl >= 85 && d.det >= 60 },
    { id: 'imp2', text: 'Pas plus de 2 captures dans le vide sur une partie', test: d => d.imp <= 2 && d.det >= 60 },
    { id: 'combo20', text: 'Enchaîne une série de 20', test: d => d.combo >= 20 },
    { id: 'lvlup', text: 'Gagne un niveau pendant une partie', test: d => d.navL > d.startNav || d.discL > d.startDisc },
    { id: 'gain600', text: () => `${A.theme().travel} ${A.fmtProg(600)} en une seule partie`, test: d => d.gain >= 600 },
    { id: 'two', text: 'Fais 2 parties aujourd\'hui', test: (d, c) => c.divesToday >= 2 },
  ];

  // ----- Icônes (SVG 24×24, trait) -----
  A.ICONS = {
    dive: 'M12 3v11M7.5 9.5L12 14l4.5-4.5M3 19c2 0 2-1.5 4.5-1.5S9.5 19 12 19s2.5-1.5 4.5-1.5S19 19 21 19',
    depth: 'M12 3v17M8 16l4 4 4-4M4 6h4M4 10h6M4 14h4',
    combo: 'M13 2L4.5 13.5H11L10 22l8.5-11.5H12L13 2z',
    nav: 'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20zM16 8l-2.5 5.5L8 16l2.5-5.5L16 8z',
    detect: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6z',
    control: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z',
    level: 'M6 20l6-6 6 6M6 14l6-6 6 6M6 8l6-6 6 6',
    streak: 'M12 22c4 0 7-3 7-7 0-3-2-5.5-3.5-7-.3 2-1.5 3-2.5 3 0-3-1.5-6-4-8 .5 3-1 5-3 7.5C4.8 12.3 5 14 5 15c0 4 3 7 7 7z',
    lock: 'M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20zM12 6.5V12l3.5 2.5',
  };
})();
