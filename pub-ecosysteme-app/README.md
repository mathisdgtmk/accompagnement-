# Pub « écosystème » — version animation d'application

Vidéo verticale (9:16, 1080×1920, 23 s) dans le style des « pubs d'appli » animées : marque qui éclate, téléphone en perspective 3D
dont l'écran change, mots-chocs, chiffres qui défilent, cartes qui se dessinent, signature avec slogan.
Rendu image par image dans Chromium (canvas), déterministe. Même moteur et mêmes polices (Playfair / Montserrat) que `../video/`.

## Livrables (`out/`)
- `pub_app_ecosysteme_9x16.mp4` — avec bande-son (musique synthétisée + bruitages d'interface, ≈ −14 LUFS)
- `pub_app_ecosysteme_9x16_sans_musique.mp4` — image seule, pour ajouter un son tendance ou sa propre voix
- `storyboard.jpg` — planche des plans clés

## Déroulé
| Temps | À l'écran | Son |
|---|---|---|
| 0–1,8 s | En-tête fixe « Arrête de procrastiner ⏰ » · pastille « Demain. » qui est rayée | montée de tension |
| 1,8–3,5 s | la marque MATHISDGTMK éclate en rayons | impact + éclat de cloches |
| 3,3–5 s | carte en points : arc lumineux de « Aujourd'hui » à « Ton objectif » | balayage |
| 5–8,6 s | **Fixe.** — écran « Ma semaine » : objectif tapé au clavier, 3 coches, bouton, pastille « Objectif défini » | clics de frappe, coches qui montent |
| 8,6–11,8 s | **Planifie.** — « Mon plan » : anneau 0 → 100 % et 4 étapes cochées (audit, offre, acquisition, optimisation) | cloches |
| 11,8–15 s | **Avance.** — « Cette semaine » : 2 rendez-vous individuels, courbe d'analyse, pastille « 2 rendez-vous / semaine · PREMIUM » | |
| 15,3–17,9 s | **Choisis ta formule.** — cartes Starter et Premium qui se dessinent | |
| 17,9–23 s | signature · « Ton cadre pour passer à l'action. » · bouton **RÉSERVE TON APPEL** · **Lien en bio ↑** · mention légale | impact final |

Les écrans de téléphone sont des **illustrations** du service (pas des captures d'une vraie appli). Ils reprennent uniquement ce qui est sur le site :
objectifs, aide au choix du produit, création de boutique / offre B2B, méthode étape par étape, rendez-vous individuels et analyse des performances en formule Premium.
Appel à l'action : « Réserve ton appel » + « Lien en bio » (textes `end.button` et `end.link` dans `content.js` ; l'adresse `mathisdgtmk.com` n'est plus affichée).
Aucun prix, chiffre d'affaires ni résultat n'est affiché ; la mention « aucun chiffre d'affaires ni résultat garanti » figure à la fin.

## Régénérer / changer les textes
Dépendances : `node` (≥ 18), `ffmpeg`, Chromium (`CHROME_PATH`, par défaut `/opt/pw-browsers/chromium`), `python3` avec `numpy` et `scipy`.

1. Textes : seul `content.js` est à modifier. Chronologie, animations et événements sonores : `engine.js` (bloc `T_` et liste `ev(...)`).
2. `npm install`
3. `node render.cjs --stills 1,5,9,15,20` — images de contrôle dans `out/stills/`
4. `PYTHON=python3 node render.cjs` — rend les deux MP4 (~1,5 min, `--workers 4`)
