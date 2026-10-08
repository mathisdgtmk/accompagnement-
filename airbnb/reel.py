"""Reel immobilier vertical (9:16) à partir de photos fixes — mouvements de caméra simulés.

  python3 reel.py stills 0.5 3 9.2     -> PNG de contrôle dans out/stills/
  python3 reel.py render               -> out/video_9x16_sans_son.mp4

Principes de fidélité : aucun élément n'est ajouté ni modifié. Seuls le cadrage, un léger étalonnage
(exposition/contraste), la profondeur apparente du mouvement et les transitions sont travaillés.
"""
import json
import os
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
PHOTOS = os.path.join(HERE, 'photos')
OUT = os.path.join(HERE, 'out')
W, H, FPS = 1080, 1920, 30
ASPECT = W / H
BPM = 120.0
BEAT = 60.0 / BPM
DISSOLVE = 0.7          # durée des fondus enchaînés (s)
MARGIN = 24             # px rognés sur chaque bord : supprime les coins arrondis des captures d'écran

# ---------------------------------------------------------------------------------------------
# Storyboard : une entrée par plan. Durées en temps musicaux (le montage tombe sur les temps).
#   z   : zoom (1 = cadrage 9:16 maximal dans la photo)       cx, cy : centre du cadre (fraction de la photo)
#   c   : intensité du « travelling avant » (déformation radiale autour du point de fuite vp)
#   ease: 'inout' (doux) | 'out' (départ plus vif, pour le hook)
# ---------------------------------------------------------------------------------------------
SHOTS = [
    dict(name='hook_jacuzzi_vue', img='02_jacuzzi_vue', beats=6, z=(1.00, 1.15), cx=(0.50, 0.47), cy=(0.50, 0.43),
         c=(0.0, 0.10), vp=(0.43, 0.31), ease='out'),
    dict(name='arrivee_terrasse', img='09_terrasse_fauteuils', beats=8, z=(1.00, 1.13), cx=(0.52, 0.45), cy=(0.50, 0.47),
         c=(0.0, 0.16), vp=(0.38, 0.40)),
    dict(name='salon', img='07_salon', beats=8, z=(1.00, 1.10), cx=(0.52, 0.46), cy=(0.50, 0.48),
         c=(0.0, 0.18), vp=(0.40, 0.42)),
    dict(name='salon_vue', img='08_salon_vers_terrasse', beats=6, z=(1.00, 1.12), cx=(0.52, 0.45), cy=(0.50, 0.45),
         c=(0.0, 0.20), vp=(0.42, 0.36)),
    dict(name='cuisine', img='06_cuisine', beats=8, z=(1.17, 1.25), cx=(0.43, 0.58), cy=(0.40, 0.45),
         c=(0.0, 0.0), vp=(0.5, 0.4)),
    dict(name='chambre', img='05_chambre', beats=8, z=(1.00, 1.14), cx=(0.47, 0.56), cy=(0.50, 0.52),
         c=(0.0, 0.12), vp=(0.78, 0.42)),
    dict(name='salle_de_bain', img='04_salle_de_bain', beats=8, z=(1.10, 1.28), cx=(0.52, 0.40), cy=(0.40, 0.50),
         c=(0.0, 0.0), vp=(0.5, 0.4)),
    dict(name='jacuzzi', img='01_jacuzzi_chambre', beats=6, z=(1.00, 1.20), cx=(0.50, 0.50), cy=(0.45, 0.62),
         c=(0.0, 0.08), vp=(0.5, 0.33)),
    dict(name='terrasse_pano', img='03_terrasse_panorama', beats=10, z=(1.00, 1.04), cx=(0.70, 0.434), cy=(0.50, 0.50),
         c=(0.0, 0.0), vp=(0.5, 0.4)),
    dict(name='final_vue_mer', img='10_terrasse_vue_mer', beats=12, z=(1.00, 1.13), cx=(0.50, 0.46), cy=(0.50, 0.46),
         c=(0.0, 0.12), vp=(0.50, 0.30)),
]

# Textes : (début s, fin s, style, lignes)
TEXTS = [
    dict(t0=0.45, t1=2.95, style='caps', lines=['BIENVENUE EN MARTINIQUE'], y=250),
    dict(t0=3.9, t1=6.9, style='italic', lines=['Votre prochaine escapade'], y=1380),
    dict(t0=35.2, t1=39.3, style='caps', lines=['RÉSERVEZ VOTRE SÉJOUR'], y=1380),
]
FADE_OUT = 0.9          # fondu final au noir (s)


def timeline():
    t = 0.0
    cuts = []
    for s in SHOTS:
        cuts.append(t)
        t += s['beats'] * BEAT
    return cuts, t


CUTS, TOTAL = timeline()


# ------------------------------------------------------------------ préparation des images
def smoothstep(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def grade_source(im, target=0.47, contrast=0.30, sat=1.06):
    f = im.astype(np.float32) / 255.0
    lum = float(np.mean(0.114 * f[..., 0] + 0.587 * f[..., 1] + 0.299 * f[..., 2]))
    g = float(np.clip(np.log(target) / np.log(max(lum, 1e-3)), 0.84, 1.0))   # on éclaircit seulement, jamais d'assombrissement
    f = np.power(f, g)
    f = (1 - contrast) * f + contrast * smoothstep(f)
    L = (0.114 * f[..., 0] + 0.587 * f[..., 1] + 0.299 * f[..., 2])[..., None]
    f = np.clip(L + (f - L) * sat, 0, 1)
    return (f * 255 + 0.5).astype(np.uint8)


def load_photo(name):
    im = cv2.imread(os.path.join(PHOTOS, name + '.jpg'), cv2.IMREAD_COLOR)
    h, w = im.shape[:2]
    im = im[MARGIN:h - MARGIN, MARGIN:w - MARGIN]
    return grade_source(im)


# ------------------------------------------------------------------ caméra
U = (np.arange(W, dtype=np.float32) + 0.5) / W - 0.5
V = (np.arange(H, dtype=np.float32) + 0.5) / H - 0.5
UU, VV = np.meshgrid(U, V)


def ease(tau, kind='inout'):
    tau = float(np.clip(tau, 0, 1))
    if kind == 'out':
        return 1 - (1 - tau) ** 2.2
    return 0.5 * tau + 0.5 * (tau * tau * (3 - 2 * tau))


def lerp(a, b, e):
    return a + (b - a) * e


def camera_frame(src, shot, tau):
    hs, ws = src.shape[:2]
    if ws / hs > ASPECT:
        wh0, ww0 = float(hs), hs * ASPECT
    else:
        ww0, wh0 = float(ws), ws / ASPECT
    e = ease(tau, shot.get('ease', 'inout'))
    z = lerp(*shot['z'], e)
    ww, wh = ww0 / z, wh0 / z
    cx = lerp(*shot['cx'], e) * ws
    cy = lerp(*shot['cy'], e) * hs
    cx = float(np.clip(cx, ww / 2, ws - ww / 2))     # le cadre ne sort jamais de la photo
    cy = float(np.clip(cy, wh / 2, hs - wh / 2))
    sx = cx + UU * ww
    sy = cy + VV * wh
    c = lerp(*shot['c'], e)
    if c > 1e-4:
        vx, vy = shot['vp'][0] * ws, shot['vp'][1] * hs
        dx, dy = sx - vx, sy - vy
        rho = np.sqrt(dx * dx + dy * dy) / (hs * 0.5)
        f = 1.0 / (1.0 + c * rho)
        sx = vx + dx * f
        sy = vy + dy * f
    return cv2.remap(src, sx.astype(np.float32), sy.astype(np.float32), cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


# ------------------------------------------------------------------ texte
def font(style, size):
    p = '/usr/share/fonts/opentype/inter/'
    return ImageFont.truetype(p + ('InterDisplay-LightItalic.otf' if style == 'italic' else 'InterDisplay-Light.otf'), size)


def render_text(style, lines):
    """Retourne (alpha_texte, alpha_ombre) float32 sur toute la largeur, hauteur ajustée."""
    size, track = (62, 0.0) if style == 'italic' else (44, 0.26)
    f = font(style, size)
    ss = 2
    fs = font(style, size * ss)
    line_h = int(size * 1.55)
    canvas = Image.new('L', (W * ss, line_h * ss * len(lines) + 40 * ss), 0)
    d = ImageDraw.Draw(canvas)
    for i, line in enumerate(lines):
        adv = [fs.getlength(ch) + track * size * ss for ch in line]
        total = sum(adv) - track * size * ss if track else fs.getlength(line)
        x = (W * ss - total) / 2
        y = 20 * ss + i * line_h * ss
        if track:
            for ch, a in zip(line, adv):
                d.text((x, y), ch, font=fs, fill=255)
                x += a
        else:
            d.text((x, y), line, font=fs, fill=255)
    canvas = canvas.resize((W, canvas.height // ss), Image.LANCZOS)
    a = np.asarray(canvas, dtype=np.float32) / 255.0
    sh = np.asarray(canvas.filter(ImageFilter.GaussianBlur(9)), dtype=np.float32) / 255.0
    return a, np.clip(sh * 1.6, 0, 1)


class TextOverlay:
    def __init__(self, spec):
        self.spec = spec
        self.a, self.sh = render_text(spec['style'], spec['lines'])
        self.h = self.a.shape[0]
        # voile doux derrière le texte pour la lisibilité (très léger)
        yy = (np.arange(self.h * 3, dtype=np.float32) - self.h * 1.5) / (self.h * 1.5)
        xx = (np.arange(W, dtype=np.float32) - W / 2) / (W * 0.46)
        self.veil = np.clip(1 - (xx[None, :] ** 2 + yy[:, None] ** 2), 0, 1) ** 1.2

    def opacity(self, t):
        s = self.spec
        fi, fo = 0.7, 0.6
        return float(smoothstep((t - s['t0']) / fi) * smoothstep((s['t1'] - t) / fo))

    def apply(self, frame, t):
        op = self.opacity(t)
        if op <= 0.002:
            return
        s = self.spec
        drift = (1 - smoothstep((t - s['t0']) / 1.2)) * 16
        y0 = int(round(s['y'] - self.h / 2 + drift))
        vh = self.veil.shape[0]
        vy0 = y0 - self.h
        ya, yb = max(vy0, 0), min(vy0 + vh, H)
        if yb > ya:
            reg = frame[ya:yb].astype(np.float32)
            m = self.veil[ya - vy0:yb - vy0, :, None] * 0.30 * op
            frame[ya:yb] = np.clip(reg * (1 - m), 0, 255).astype(np.uint8)
        ya, yb = max(y0, 0), min(y0 + self.h, H)
        if yb <= ya:
            return
        reg = frame[ya:yb].astype(np.float32)
        a = self.a[ya - y0:yb - y0, :, None] * op
        sh = self.sh[ya - y0:yb - y0, :, None] * 0.40 * op
        reg = reg * (1 - sh)
        reg = reg * (1 - a) + 247.0 * a
        frame[ya:yb] = np.clip(reg, 0, 255).astype(np.uint8)


# ------------------------------------------------------------------ finition image
_rng = np.random.default_rng(7)
GRAIN = [(_rng.normal(0, 1, (H, W)).astype(np.float32) * 2.6) for _ in range(6)]
_r2 = (UU / 0.5) ** 2 * 0.55 + (VV / 0.5) ** 2 * 0.45
VIGNETTE = (1 - 0.20 * np.clip(_r2, 0, 1.4) ** 1.4).astype(np.float32)[..., None]


def finish(frame, fidx):
    blur = cv2.GaussianBlur(frame, (0, 0), 1.3)
    frame = cv2.addWeighted(frame, 1.35, blur, -0.35, 0)            # netteté douce
    f = frame.astype(np.float32) * VIGNETTE
    f += GRAIN[fidx % len(GRAIN)][..., None]
    return np.clip(f, 0, 255).astype(np.uint8)


# ------------------------------------------------------------------ montage
class Reel:
    def __init__(self):
        self.srcs = {s['img']: load_photo(s['img']) for s in SHOTS}
        self.texts = [TextOverlay(t) for t in TEXTS]
        n = len(SHOTS)
        self.span = []
        for i, s in enumerate(SHOTS):
            start = CUTS[i] - (DISSOLVE / 2 if i > 0 else 0)
            end = (CUTS[i + 1] if i + 1 < n else TOTAL) + (DISSOLVE / 2 if i + 1 < n else 0)
            self.span.append((start, end))

    def shot_frame(self, i, t):
        a, b = self.span[i]
        return camera_frame(self.srcs[SHOTS[i]['img']], SHOTS[i], (t - a) / (b - a))

    def frame(self, t, fidx):
        n = len(SHOTS)
        idx = max(k for k in range(n) if t >= CUTS[k] - (DISSOLVE / 2 if k > 0 else 0))
        fr = self.shot_frame(idx, t)
        if idx + 1 < n:
            ts, te = CUTS[idx + 1] - DISSOLVE / 2, CUTS[idx + 1] + DISSOLVE / 2
            if t >= ts:
                w = float(smoothstep((t - ts) / (te - ts)))
                nxt = self.shot_frame(idx + 1, t)
                fr = cv2.addWeighted(fr, 1 - w, nxt, w, 0)
        fr = finish(fr, fidx)
        for ov in self.texts:
            ov.apply(fr, t)
        fo = float(smoothstep((TOTAL - t) / FADE_OUT))
        if fo < 1:
            fr = (fr.astype(np.float32) * fo).astype(np.uint8)
        return fr


def encode_proc(path):
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(FPS),
           '-i', '-', '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p',
           '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-profile:v', 'high', '-level', '4.2',
           '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
           '-movflags', '+faststart', path]
    return subprocess.Popen(cmd, stdin=subprocess.PIPE)


def main():
    os.makedirs(OUT, exist_ok=True)
    mode = sys.argv[1] if len(sys.argv) > 1 else 'render'
    reel = Reel()
    json.dump({'cuts': CUTS, 'total': TOTAL, 'bpm': BPM, 'dissolve': DISSOLVE,
               'shots': [s['name'] for s in SHOTS], 'fps': FPS}, open(os.path.join(OUT, 'timeline.json'), 'w'), indent=2)
    if mode == 'stills':
        d = os.path.join(OUT, 'stills')
        os.makedirs(d, exist_ok=True)
        for a in sys.argv[2:]:
            t = float(a)
            cv2.imwrite(os.path.join(d, f'{t:06.2f}.png'), reel.frame(t, int(t * FPS)))
        return
    nframes = int(round(TOTAL * FPS))
    out = os.path.join(OUT, 'video_9x16_sans_son.mp4')
    p = encode_proc(out)
    for k in range(nframes):
        p.stdin.write(reel.frame(k / FPS, k).tobytes())
        if k % 60 == 0:
            print(f'{k}/{nframes}', flush=True)
    p.stdin.close()
    p.wait()
    print('ok', out, 'durée', TOTAL)


if __name__ == '__main__':
    main()
