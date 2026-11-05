# Abysse / Nébula / Sylva — document de conception

Jeu web d'entraînement de l'attention pour ados (13-17 ans) avec TDAH. Projet perso/famille.
**Ce n'est pas un dispositif médical** : pas d'allégation de traitement. On parle d'« entraînement ».

## Principe
Inspiré de la recherche sur l'entraînement à l'interférence (NeuroRacer, Anguera et al., *Nature* 2013),
le même principe qui sous-tend les jeux de type EndeavorRx. Univers, mécaniques et visuels originaux.

| Tâche | Ce qu'on fait | Fonction ciblée |
|---|---|---|
| Pilotage | Passer dans les passages du courant | attention soutenue, contrôle visuo-moteur |
| Détection | Capturer seulement la cible (go/no-go, 35 % de cibles) | attention sélective, inhibition |
| Changement de cible | Nouvelle cible toutes les 40 s (dès le niveau 5 de détection) | flexibilité cognitive |

## Trois univers (même mécanique, même progression)
| | Océan (ABYSSE) | Espace (NÉBULA) | Nature (SYLVA) |
|---|---|---|---|
| Vue | de côté | de côté | de dessus (rivière) |
| Avatar | sous-marins | vaisseaux | animaux (renard, loutre, castor, tortue, loup) |
| Passages | anneaux lumineux | anneaux d'énergie | entre deux rochers |
| Cibles | méduse, poisson, nautile | étoile, planète, cristal | feuille, libellule, poisson |
| Progression | profondeur (m) | distance (AL) | distance (km), du matin à la nuit |

La progression est **commune** : changer d'univers ne remet rien à zéro. Les objets débloqués
correspondent aux mêmes emplacements dans chaque univers (le 2ᵉ avatar = Manta / Delta / Loutre).
Textes : `js/themes.js`. Dessins : `js/art/<univers>.js`.

## Temps de jeu
- **Limite : 30 min de jeu par jour par défaut**, réglable dans l'**Espace parent** (js/parent.js).
- Espace parent : lien discret en bas de l'onglet Jouer, protégé par un code à 4 chiffres.
  - Le code est haché (SHA-256 + sel), donc jamais stocké en clair.
  - Après 5 erreurs, l'accès est bloqué 5 min.
  - Réglages : limite de 10 à 90 min, limite différente le week-end (optionnelle), bonus du jour (+10, +15 ou +30 min, valable seulement aujourd'hui).
  - On y trouve aussi l'historique du temps joué sur 7 jours, le changement de code et l'effacement de la progression (déplacé ici).
  - Code oublié : il faut effacer les données du site, ce qui efface aussi la progression.
  - Limite connue : un ado qui sait vider les données du navigateur peut tout remettre à zéro.
- La dernière partie est raccourcie pour ne jamais dépasser la limite. Ensuite, le bouton Jouer est bloqué jusqu'au lendemain.
- Le temps est enregistré **toutes les 5 s pendant la partie** : abandonner, recharger la page ou effacer la progression ne contourne pas la limite.
- **Pause** : bouton ⏸ en haut à droite, touche Échap ou P, et pause automatique si l'onglet est quitté. Le temps de pause n'est pas compté.

## Difficulté adaptative (js/game.js)
- Deux niveaux indépendants (1 à 12), réévalués toutes les 20 s : réussite ≥ 85 % → +1 ; pilotage < 60 % ou détection < 65 % → -1.
- Chaque partie commence un niveau en dessous du dernier atteint.
- **La précision reste stable, ce sont les niveaux qui montrent le progrès** (expliqué dans l'onglet Progression).

## Progression et motivation
- XP : temps joué + précision + niveaux + 1ʳᵉ partie du jour (+50) + missions (+100). 9 rangs (Recrue → Légende).
- Profondeur/distance : +2 par passage, +5 par cible, +1 par leurre ignoré. Environ 30 à 40 parties pour arriver au bout.
- 3 missions du jour, série de jours consécutifs, 18 badges, 14 objets à débloquer.

## Fichiers
- `index.html`, `css/style.css`
- `js/data.js` (contenu commun), `js/themes.js` (univers), `js/profile.js` (sauvegarde, XP, limite de temps)
- `js/art/common.js` (sillages, outils), `js/art/ocean.js`, `js/art/space.js`, `js/art/nature.js`
- `js/charts.js`, `js/game.js` (moteur), `js/ui.js` (interface)

Mode dev : `index.html#theme=space&sim=180&n=5&tab=progress` (bot ; ajouter `&limit` pour respecter les 30 min,
`&pause` pour s'arrêter sur l'écran pause, `#onboard` pour revoir l'écran d'accueil).
⚠️ Ce mode écrit dans la vraie sauvegarde : à utiliser dans un profil de navigateur de test.

## Pistes pour la suite
- [ ] Mode daltonien (motifs en plus des couleurs)
- [ ] Événements « distraction » à ignorer
- [ ] Musique d'ambiance par univers
- [ ] Version PWA installable sur tablette (hors ligne)
- [ ] Export des stats (CSV/PDF) pour un professionnel
