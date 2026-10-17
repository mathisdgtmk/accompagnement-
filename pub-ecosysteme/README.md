# Pub « écosystème » — rejoindre MATHISDGTMK et arrêter de procrastiner

Vidéo verticale (9:16, 1080×1920, 25,6 s) dans la même identité que la vidéo promo (`../video/`) : noir et blanc éditorial,
Playfair Display en italique, Montserrat espacé, musique synthétisée. Rendu image par image dans Chromium, déterministe.

## Livrables (`out/`)
- `pub_ecosysteme_9x16.mp4` — version principale avec bande-son (≈ −14 LUFS)
- `pub_ecosysteme_9x16_sans_musique.mp4` — image seule, pour ajouter un son tendance ou sa propre voix sur TikTok / Instagram
- `storyboard.jpg` — planche des plans clés

## Déroulé et textes
| Temps | Acte | À l'écran | Son |
|---|---|---|---|
| 0–5,8 s | 1. Le cycle | « Tu te dis… » puis LUNDI → VENDREDI, chaque « demain. » est rayé · « Et la semaine recommence. » | tic-tac d'horloge, drone grave qui monte, traits de rature |
| 5,8–10,6 s | 2. Le constat | « Ce n'est pas l'envie qui te manque. *C'est un cadre.* » | notes graves, la tension retombe |
| 10,6–18,4 s | 3. L'écosystème | « Rejoins *l'écosystème.* » · 01 Des objectifs clairs · 02 Une méthode · 03 Un suivi | le son « s'ouvre » : piano feutré et nappes de la vidéo promo |
| 18,4–25,6 s | 4. Appel à agir | « ~~demain.~~ *Aujourd'hui.* » · bouton REJOINDRE L'ÉCOSYSTÈME · mathisdgtmk.com · mention légale | carillons de verre, résolution |

Les promesses reprennent uniquement ce qui est déjà sur le site (définition des objectifs, méthode e-commerce / B2B,
rendez-vous individuels et analyse des performances en formule Premium). Aucun prix, témoignage ni chiffre n'est affiché ;
la mention « aucun chiffre d'affaires ni résultat garanti » figure à la fin, comme dans la vidéo promo.

## Régénérer / changer les textes
Dépendances : `node` (≥ 18), `ffmpeg`, Chromium (`CHROME_PATH`, par défaut `/opt/pw-browsers/chromium`), `python3` avec `numpy` et `scipy`.

1. Textes : seul `content.js` est à modifier (`*mot*` = italique). Durées des actes et événements sonores : bloc « chronologie » de `engine.js`.
2. `npm install`
3. `node render.cjs --stills 1,5,12,20` — images de contrôle dans `out/stills/`
4. `PYTHON=python3 node render.cjs` — rend `out/pub_ecosysteme_9x16.mp4` et `…_sans_musique.mp4` (~1 min, `--workers 4`)
