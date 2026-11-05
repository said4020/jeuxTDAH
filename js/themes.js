'use strict';
/* Les trois univers : textes, noms des zones, avatars, espèces. Le dessin est dans js/art/. */
(() => {
  const A = window.Abysse;
  const dec1 = v => v.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  A.THEMES = {
    ocean: {
      id: 'ocean', label: 'Océan', brand: 'ABYSSE',
      pitch: 'Pilote un sous-marin dans les courants des grands fonds et capte les bonnes espèces.',
      progressLabel: 'Profondeur atteinte', travel: 'Descends de',
      fmt: v => `${Math.round(v).toLocaleString('fr-FR')} m`,
      zones: ['Zone éclairée', 'Zone crépusculaire', 'Zone de minuit', 'Zone abyssale', 'Zone hadale', 'Fosse des Mariannes'],
      zoneBadges: ['', 'Crépuscule', 'Minuit', 'Abysses', 'Hadal', 'Challenger'],
      endText: 'Tu as atteint le point le plus profond des océans',
      avatarLabel: 'Sous-marins', liveryLabel: 'Livrées', trailLabel: 'Sillages',
      avatars: {
        eclaireur: ['Éclaireur', 'Compact et fiable. Le classique.'],
        manta: ['Manta', 'Profil plat inspiré des raies manta.'],
        orque: ['Orque', 'Long et effilé, taillé pour la vitesse.'],
        bathy: ['Bathysphère', 'Sphère blindée pour les grandes profondeurs.'],
        spectre: ['Spectre', 'Furtif, angles vifs, presque invisible.'],
      },
      trails: { bulles: ['Bulles', 'Le sillage standard.'], plancton: ['Plancton', 'Particules bioluminescentes.'] },
      species: [{ id: 'meduse', name: 'méduse', f: true }, { id: 'poisson', name: 'poisson' }, { id: 'nautile', name: 'nautile' }],
      gates: 'les portes lumineuses', creatures: 'créatures',
    },
    space: {
      id: 'space', label: 'Espace', brand: 'NÉBULA',
      pitch: 'Pilote un vaisseau à travers les nébuleuses et capte seulement les bons astres.',
      progressLabel: 'Distance parcourue', travel: 'Parcours',
      fmt: v => `${dec1(v / 100)} AL`,
      zones: ['Orbite terrestre', 'Ceinture d\'astéroïdes', 'Nuage d\'Oort', 'Nébuleuse d\'Orion', 'Bras galactique', 'Cœur de la galaxie'],
      zoneBadges: ['', 'Astéroïdes', 'Nuage d\'Oort', 'Orion', 'Bras galactique', 'Cœur galactique'],
      endText: 'Tu as atteint le cœur de la galaxie',
      avatarLabel: 'Vaisseaux', liveryLabel: 'Peintures', trailLabel: 'Traînées',
      avatars: {
        eclaireur: ['Navette', 'Polyvalente et fiable. La classique.'],
        manta: ['Delta', 'Aile delta, très maniable.'],
        orque: ['Croiseur', 'Long, lourd et puissant.'],
        bathy: ['Sonde', 'Sphère scientifique à panneaux solaires.'],
        spectre: ['Furtif', 'Angles vifs, invisible aux radars.'],
      },
      trails: { bulles: ['Réacteur', 'La propulsion standard.'], plancton: ['Poussière d\'étoiles', 'Des particules scintillantes.'] },
      species: [{ id: 'etoile', name: 'étoile', f: true }, { id: 'planete', name: 'planète', f: true }, { id: 'cristal', name: 'cristal' }],
      gates: 'les anneaux d\'énergie', creatures: 'objets célestes',
    },
    nature: {
      id: 'nature', label: 'Nature', brand: 'SYLVA',
      pitch: 'Dévale une rivière en forêt avec ton animal et attrape seulement ce qu\'on te demande.',
      progressLabel: 'Distance parcourue', travel: 'Parcours',
      fmt: v => `${dec1(v / 100)} km`,
      zones: ['Source de montagne', 'Torrent', 'Forêt profonde', 'Gorges', 'Marais', 'Embouchure'],
      zoneBadges: ['', 'Torrent', 'Forêt profonde', 'Gorges', 'Marais', 'Embouchure'],
      endText: 'Tu as descendu la rivière jusqu\'à la mer',
      avatarLabel: 'Animaux', liveryLabel: 'Pelages', trailLabel: 'Sillages',
      avatars: {
        eclaireur: ['Renard', 'Rusé et agile. Le classique.'],
        manta: ['Loutre', 'Nageuse hors pair.'],
        orque: ['Castor', 'Robuste, il ne craint pas le courant.'],
        bathy: ['Tortue', 'Lente ? Pas sur l\'eau.'],
        spectre: ['Loup', 'Silencieux, regard perçant.'],
      },
      trails: { bulles: ['Remous', 'Le sillage standard.'], plancton: ['Lucioles', 'Des petites lumières qui dansent.'] },
      species: [{ id: 'feuille', name: 'feuille', f: true }, { id: 'libellule', name: 'libellule', f: true }, { id: 'koi', name: 'poisson' }],
      gates: 'les passages entre les rochers', creatures: 'éléments',
    },
  };
  A.THEME_IDS = Object.keys(A.THEMES);

  A.theme = () => A.THEMES[A.profile && A.profile.theme] || A.THEMES.ocean;
  A.fmtProg = v => A.theme().fmt(v);
  A.zones = () => A.ZONE_STEPS.map((d, i) => ({ d, name: A.theme().zones[i] }));
  A.zoneOf = d => A.zones().filter(z => d >= z.d).pop();
  A.nextZone = d => A.zones().find(z => z.d > d) || null;

  A.kindLabel = kind => {
    const t = A.theme();
    return { hull: t.avatarLabel, livery: t.liveryLabel, trail: t.trailLabel }[kind];
  };
  A.itemView = (kind, item) => {
    const t = A.theme();
    if (kind === 'hull') return { name: t.avatars[item.id][0], desc: t.avatars[item.id][1] };
    if (kind === 'trail' && t.trails[item.id]) return { name: t.trails[item.id][0], desc: t.trails[item.id][1] };
    return { name: item.name, desc: item.desc || '' };
  };
  A.badgeView = b => {
    if (b.zone == null) return { name: b.name, desc: b.desc };
    const t = A.theme();
    return { name: t.zoneBadges[b.zone], desc: `Atteins : ${t.zones[b.zone]} (${t.fmt(A.ZONE_STEPS[b.zone])}).` };
  };
  A.missionText = m => (typeof m.text === 'function' ? m.text() : m.text);
})();
