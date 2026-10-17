# Pub « écosystème » — version 3D (film produit)

Vidéo verticale (9:16, 1080×1920, 21,4 s) : un téléphone posé sur un bureau en bois, une caméra qui alterne plans larges,
plans moyens et macros avec balayages rapides, un trait de lumière bleue qui court sur l'écran puis sur la table, une carte qui
se dresse hors de l'écran, et le logo qui s'allume sur le bois avec le bouton « Réserve ton appel ».
Vraie 3D (WebGL / three.js) : éclairage, ombres, flou de profondeur, flou de mouvement, halo lumineux, grain de film.
Rendu image par image, déterministe, sans carte graphique (SwiftShader).

## Livrables (`out/`)
- `pub_3d_ecosysteme_9x16.mp4` — avec bande-son (musique synthétisée + bruitages d'interface, ≈ −14 LUFS)
- `pub_3d_ecosysteme_9x16_sans_musique.mp4` — image seule, pour ajouter un son tendance ou sa propre voix
- `storyboard.jpg` — planche des plans clés

## Déroulé
| Temps | Plan | Bulle de texte |
|---|---|---|
| 0–2,2 s | plan large : le téléphone affiche la liste « À faire » ; chaque tâche est rayée et marquée « demain » | Arrête de procrastiner ⏰ |
| 2,2–4,3 s | la caméra plonge sur l'écran, le trait de lumière parcourt la liste, balayage | |
| 4,3–8,3 s | « Ma semaine » : objectif tapé au clavier, 3 coches, bouton « Définir mon objectif » | Fixe ton objectif 🎯 |
| 8,3–12,3 s | « Mon plan » : anneau 0 → 100 %, 4 étapes cochées ; carte « PLAN COMPLÉTÉ » qui se dresse | Planifie chaque étape 🧭 |
| 12,3–16 s | « Cette semaine » : 2 rendez-vous individuels, courbe ; le trait quitte l'écran et glisse sur la table | Avance avec un suivi chaque semaine 📈 |
| 16–21,4 s | le logo s'allume sur le bois, le bouton apparaît, mention légale | Réserve ton appel · lien en bio ☝️ |

Les écrans sont des **illustrations** du service (pas des captures d'une vraie appli) : ils reprennent uniquement ce qui est sur le site
(objectifs, aide au choix du produit, création de boutique / offre B2B, méthode étape par étape, rendez-vous individuels et analyse des
performances en formule Premium). Aucun prix, chiffre d'affaires ni résultat réel n'est affiché ; la carte « 4 / 4 étapes » illustre
l'avancement d'un plan, pas un résultat client. La mention « aucun chiffre d'affaires ni résultat garanti » est affichée en bas dans la partie finale.

## Régénérer / changer les textes
Dépendances : `node` (≥ 18), `ffmpeg`, Chromium (`CHROME_PATH`, par défaut `/opt/pw-browsers/chromium`), `python3` avec `numpy`, `scipy`, `pillow`.

1. Textes (bulles, écrans, bouton, mention légale) : `content.js` uniquement. Chronologie, caméra, lumières : `main.js` (blocs `TL`, `KEYS`, lumières).
2. `npm install` puis `python3 make_textures.py` (texture du bois, déjà fournie dans `textures/`).
3. Contrôle rapide : `node render.cjs --stills 1,5,9,15,18 --scale 0.5` (images dans `out/stills/`).
4. Cadrage d'un plan : `node probecam.cjs '[[[x,y,z],[cx,cy,cz],fov]]'` donne la position à l'écran du téléphone, du logo et du bouton.
5. Rendu final : `PYTHON=python3 node render.cjs --workers 4` (≈ 35 min sur 4 cœurs). Le fichier brut pèse ≈ 230 Mo à cause du grain :
   le ré-encoder avant publication : `ffmpeg -i brut.mp4 -c:v libx264 -preset slow -crf 23 -maxrate 9M -bufsize 18M -c:a copy -movflags +faststart sortie.mp4`.
