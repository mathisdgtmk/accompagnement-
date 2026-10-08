"""Planche storyboard (JPG) à partir de images extraites de la vidéo finale.
   python3 storyboard.py <dossier_images> <sortie.jpg>   (images nommées t<secondes>.png, dans l'ordre des plans)"""
import glob
import os
import sys

from PIL import Image, ImageDraw, ImageFont

src, out = sys.argv[1], sys.argv[2]
frames = sorted(glob.glob(os.path.join(src, 't*.png')), key=lambda p: float(os.path.basename(p)[1:-4]))

PLANS = [
    ('0:00 – 0:03', 'HOOK', 'Jacuzzi + vue panoramique', 'Push-in vers la vue', '« Bienvenue en Martinique »'),
    ('0:03 – 0:07', 'ARRIVÉE', 'Terrasse salon', 'Travelling avant vers les baies', '« Votre prochaine escapade »'),
    ('0:07 – 0:11', 'SALON', 'Canapé, bar, cuisine ouverte', 'Travelling avant', ''),
    ('0:11 – 0:14', 'SALON → VUE', 'Baie vitrée sur la terrasse', 'Push-through vers la vue', ''),
    ('0:14 – 0:18', 'CUISINE', 'Plaque, four, plan en bois', 'Travelling latéral + push-in', ''),
    ('0:18 – 0:22', 'CHAMBRE', 'Lit, moustiquaire, vue', 'Push-in doux + latéral', ''),
    ('0:22 – 0:26', 'SALLE DE BAIN', 'Vasques pierre, miroir LED', 'Tilt + push sur les détails', ''),
    ('0:26 – 0:29', 'JACUZZI', 'Jacuzzi encastré', 'Tilt vers l\'eau', ''),
    ('0:29 – 0:34', 'TERRASSE', 'Fauteuils, balancelle, mer', 'Panoramique droite → gauche', ''),
    ('0:34 – 0:40', 'PLAN FINAL', 'Balancelle + vue mer', 'Push-in lent + fondu', '« Réservez votre séjour »'),
]
assert len(frames) == len(PLANS), (len(frames), len(PLANS))

F = '/usr/share/fonts/opentype/inter/'
f_title = ImageFont.truetype(F + 'InterDisplay-Light.otf', 54)
f_sub = ImageFont.truetype(F + 'Inter-Regular.otf', 22)
f_t = ImageFont.truetype(F + 'Inter-Medium.otf', 24)
f_b = ImageFont.truetype(F + 'Inter-Regular.otf', 21)
f_i = ImageFont.truetype(F + 'Inter-Italic.otf', 21)

TW, TH = 300, 533
PAD, GAP = 56, 28
COLS = 5
CW = TW
CH = TH + 150
Wd = PAD * 2 + COLS * CW + (COLS - 1) * GAP
Ht = 190 + 2 * CH + GAP + 60
im = Image.new('RGB', (Wd, Ht), (246, 243, 238))
d = ImageDraw.Draw(im)
d.text((PAD, 52), 'Storyboard — Reel Airbnb Martinique', font=f_title, fill=(30, 30, 28))
d.text((PAD, 124), '40 s · 9:16 · 1080 × 1920 · 10 plans à partir des 10 photos fournies · aucun élément ajouté ni modifié · étalonnage léger uniquement', font=f_sub, fill=(110, 105, 98))

for i, (p, (tc, name, what, move, txt)) in enumerate(zip(frames, PLANS)):
    r, c = divmod(i, COLS)
    x = PAD + c * (CW + GAP)
    y = 190 + r * (CH + GAP)
    th = Image.open(p).convert('RGB').resize((TW, TH), Image.LANCZOS)
    im.paste(th, (x, y))
    d.rectangle([x, y, x + TW - 1, y + TH - 1], outline=(215, 210, 202))
    d.text((x, y + TH + 14), f'{i + 1:02d}  {name}', font=f_t, fill=(30, 30, 28))
    d.text((x, y + TH + 46), tc, font=f_b, fill=(150, 120, 80))
    d.text((x, y + TH + 74), what, font=f_b, fill=(70, 66, 60))
    d.text((x, y + TH + 100), move, font=f_b, fill=(110, 105, 98))
    if txt:
        d.text((x, y + TH + 126), txt, font=f_i, fill=(150, 120, 80))
im.save(out, quality=92)
print(out, im.size)
