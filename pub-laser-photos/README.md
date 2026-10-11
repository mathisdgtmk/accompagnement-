# Pub laser tag — à partir des photos produit

Vidéo verticale (9:16, 1080×1920, 15 s) générée à partir de 6 photos fixes et du logo : mouvements de caméra simulés,
textes français animés qui suivent les coupes, coins de viseur, traits laser, carte finale avec le logo et l'appel à l'action.
Les photos ne sont ni retouchées ni modifiées : seuls le cadrage, le zoom et le mouvement sont travaillés.

## Livrables (`out/`)
- `pub_laser_photos_9x16.mp4` — version principale : musique, bruitages laser et voix off française
- `pub_laser_photos_9x16_sans_voix.mp4` — musique et bruitages seulement (pour ajouter un son tendance ou une autre voix)
- `storyboard.jpg` — planche des plans clés

## Montage (30 fps, 120 BPM, coupes sur les temps)
| Temps | Photo | Texte à l'écran | Voix off |
|---|---|---|---|
| 0–2 s | 4 pistolets + 4 capteurs | LE LASER TAG / À LA MAISON · « 4 couleurs. 1 seul gagnant. » | « Le laser tag… à la maison. » |
| 2–3 s | jaune | JAUNE · CHOISIS TA COULEUR | « Du jaune. » |
| 3–4 s | bleu | BLEU | « Du bleu. » |
| 4–5 s | vert | VERT | « Du vert. » |
| 5–6 s | rouge | ROUGE | « Du rouge. » |
| 6–9 s | duo bleu / rouge | BLEUS contre ROUGES · QUI SERA LE DERNIER DEBOUT ? | « Bleus contre rouges. Qui sera le dernier debout ? » |
| 9–12 s | zoom sur les capteurs | CHAQUE TOUCHE COMPTE. · Pistolet + capteur lumineux | « Chaque touche compte. » |
| 12–15 s | logo | PRÊT À JOUER ? · Commente « LASER » pour recevoir le lien | « Commente laser pour recevoir le lien. » |

Aucun prix, délai de livraison ni caractéristique technique chiffrée n'est affiché : à ajouter si besoin.
L'appel à l'action « Commente LASER » reprend celui des vidéos précédentes (à adapter au vrai lien / à la vraie offre).

## Régénérer (ou changer les textes, photos, rythme)
Dépendances : `ffmpeg`, `pip install opencv-python-headless scipy pillow numpy`. Police : Inter (installée sur le système).

1. Photos dans `photos/` (`.webp` carrées, plus `logo.png`) ; plan de montage, textes et bruitages : listes `SCENES`, `TEXTS`, `HITS` dans `pub.py`.
2. `python3 pub.py stills 0.5 2.5 7 13` — images de contrôle dans `out/stills/`.
3. `python3 pub.py render` — rend `out/video_sans_son.mp4` et écrit `out/timeline.json` (~2 min).
4. `python3 music.py` — musique et bruitages calés sur les coupes (`out/music.wav`).
5. `python3 assemble.py` — mixe la voix off (`voix/*.wav`), règle le volume (−14 LUFS) et produit les deux MP4.

Les voix (`voix/`) viennent d'une synthèse vocale française (Piper « siwis », via sherpa-onnx) ; `voix.py` les régénère
si on change les phrases (il faut alors télécharger les modèles `vits-piper-fr_FR-siwis-medium` et `sherpa-onnx-whisper-small`).
