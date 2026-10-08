# Reel Airbnb — Martinique

Vidéo verticale (9:16, 1080×1920, 40 s) générée à partir de photos fixes : mouvements de caméra simulés,
fondus enchaînés, texte minimal, musique originale. Aucun élément n'est ajouté ni modifié dans le logement :
seuls le cadrage, un léger étalonnage et le mouvement sont travaillés.

## Livrables (`out/`)
- `reel_airbnb_9x16.mp4` — version principale avec musique
- `reel_airbnb_9x16_sans_musique.mp4` — pour ajouter un son tendance sur Instagram / TikTok
- `reel_airbnb_16x9.mp4` — version horizontale (vidéo verticale centrée sur fond flouté)
- `storyboard.jpg` — planche des 10 plans, à montrer à l'hôte

## Régénérer (ou refaire pour un autre logement)
Dépendances : `ffmpeg`, `pip install opencv-python-headless scipy pillow numpy`.

1. Remplacer les photos dans `photos/` et adapter la liste `SHOTS` (photo, durée en temps, zoom, centre, point de fuite) et `TEXTS` dans `reel.py`.
2. `python3 reel.py stills 1.5 5 9` — images de contrôle dans `out/stills/`.
3. `python3 reel.py render` — rend `out/video_9x16_sans_son.mp4` (~4 min) et écrit `out/timeline.json`.
4. `python3 music.py` — musique calée sur les coupes (`out/music.wav`).
5. Assemblage : encoder en H.264 (CRF ~20, `-maxrate 10M`) et muxer `music.wav` en AAC 256k, `-af volume=-0.6dB` (≈ −14 LUFS).

Le grain de pellicule rend le rendu brut très lourd : toujours ré-encoder avant de partager.
