"""Pub laser tag verticale (9:16, 1080x1920, 15 s) construite à partir de photos produit fixes + logo.

Photo carrée au centre (mouvement de caméra simulé), fond flou aux couleurs de la photo, textes français animés,
coins de viseur, traits laser à chaque coupe, carte finale avec le logo.

    python3 pub.py stills 0.5 2.5 7 13     # images de contrôle dans out/stills/
    python3 pub.py render                  # out/video_sans_son.mp4 + out/timeline.json
Dépendances : ffmpeg, opencv-python-headless, pillow, numpy.
"""
import json, os, subprocess, sys
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
PH = os.path.join(HERE, 'photos'); OUT = os.path.join(HERE, 'out')
W, H, FPS = 1080, 1920, 30
TOTAL = 15.0
BPM = 120; BEAT = 60.0 / BPM
BG = np.array([11, 13, 18], np.float32)           # fond du logo
LIME = (198, 255, 61); WHITE = (255, 255, 255)
YEL = (255, 226, 0); BLU = (70, 140, 255); GRN = (80, 255, 70); RED = (255, 60, 60)
F_BLACK = '/usr/share/fonts/opentype/inter/Inter-Black.otf'
F_XB = '/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf'
WIN_Y, WIN = 420, 1080                              # fenêtre carrée de la photo

# ------------------------------------------------------------------ plan de montage
# z : zoom début/fin ; c : centre (x,y) début/fin en proportion de la photo
SCENES = [
    dict(id='hero',  photo='quatre', t0=0.0,  t1=2.0,  z=(1.00, 1.06), c=((.50, .50), (.50, .52)), accent=LIME),
    dict(id='jaune', photo='jaune',  t0=2.0,  t1=3.0,  z=(1.06, 1.20), c=((.50, .56), (.55, .50)), accent=YEL),
    dict(id='bleu',  photo='bleu',   t0=3.0,  t1=4.0,  z=(1.06, 1.20), c=((.50, .56), (.45, .52)), accent=BLU),
    dict(id='vert',  photo='vert',   t0=4.0,  t1=5.0,  z=(1.06, 1.20), c=((.50, .56), (.55, .52)), accent=GRN),
    dict(id='rouge', photo='rouge',  t0=5.0,  t1=6.0,  z=(1.06, 1.20), c=((.50, .56), (.45, .52)), accent=RED),
    dict(id='duo',   photo='duo',    t0=6.0,  t1=9.0,  z=(1.00, 1.14), c=((.50, .55), (.50, .60)), accent=BLU),
    dict(id='touche', photo='quatre', t0=9.0, t1=12.0, z=(1.22, 1.48), c=((.52, .64), (.36, .70)), accent=LIME),
    dict(id='fin',   photo=None,     t0=12.0, t1=15.0, z=(1, 1), c=((.5, .5), (.5, .5)), accent=LIME),
]
# éléments de texte : zone, lignes de runs (texte, couleur, échelle), taille de base, centre y, entrée/sortie (s), animation
TEXTS = [
    dict(lines=[[('LE LASER TAG', WHITE, 1)], [('À LA MAISON', LIME, 1)]], size=122, y=250, t=(0.12, 2.0), anim='pop', font='black', glow=LIME),
    dict(lines=[[('4 couleurs. 1 seul gagnant.', (240, 240, 240), 1)]], size=58, y=1640, t=(0.70, 2.0), anim='slide', font='xb'),
    dict(lines=[[('JAUNE', YEL, 1)]], size=200, y=250, t=(2.02, 3.0), anim='pop', font='black', glow=YEL),
    dict(lines=[[('BLEU', BLU, 1)]], size=200, y=250, t=(3.02, 4.0), anim='pop', font='black', glow=BLU),
    dict(lines=[[('VERT', GRN, 1)]], size=200, y=250, t=(4.02, 5.0), anim='pop', font='black', glow=GRN),
    dict(lines=[[('ROUGE', RED, 1)]], size=200, y=250, t=(5.02, 6.0), anim='pop', font='black', glow=RED),
    dict(lines=[[('CHOISIS TA COULEUR', WHITE, 1)]], size=62, y=1640, t=(2.10, 6.0), anim='slide', font='xb'),
    dict(lines=[[('BLEUS', BLU, 1.0)], [('contre ', WHITE, 0.5), ('ROUGES', RED, 1.0)]], size=150, y=250, t=(6.05, 9.0), anim='pop', font='black'),
    dict(lines=[[('QUI SERA LE DERNIER DEBOUT ?', WHITE, 1)]], size=60, y=1640, t=(7.20, 9.0), anim='slide', font='xb'),
    dict(lines=[[('CHAQUE TOUCHE', WHITE, 1)], [('COMPTE.', LIME, 1)]], size=122, y=250, t=(9.05, 12.0), anim='pop', font='black', glow=LIME),
    dict(lines=[[('Pistolet + capteur lumineux', (240, 240, 240), 1)]], size=58, y=1640, t=(10.0, 12.0), anim='slide', font='xb'),
]
# bruitages et accents (lus par music.py)
HITS = [dict(t=0.0, k='impact'), dict(t=2.0, k='pew', f=1700), dict(t=3.0, k='pew', f=1300), dict(t=4.0, k='pew', f=1000),
        dict(t=5.0, k='pew', f=1500), dict(t=6.0, k='boom'), dict(t=7.2, k='tick'), dict(t=9.0, k='zap'),
        dict(t=12.0, k='impact'), dict(t=12.45, k='sparkle')]
RISERS = [(5.0, 6.0), (8.0, 9.0), (11.0, 12.0)]
CUTS = [s['t0'] for s in SCENES]


def smooth(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)
def out_cubic(x): x = np.clip(x, 0, 1); return 1 - (1 - x) ** 3
def out_back(x, s=1.9): x = np.clip(x, 0, 1); return 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2


# ------------------------------------------------------------------ éléments graphiques
def load_photos():
    d = {}
    for n in ('quatre', 'jaune', 'bleu', 'vert', 'rouge', 'duo'):
        d[n] = np.array(Image.open(os.path.join(PH, n + '.webp')).convert('RGB'))
    return d


def blurred_bg(img):
    """Fond plein cadre : photo recadrée en 9:16, très floue, assombrie."""
    S = img.shape[0]
    w = int(S * 9 / 16)
    crop = img[:, (S - w) // 2:(S + w) // 2]
    small = cv2.resize(crop, (108, 192), interpolation=cv2.INTER_AREA)
    small = cv2.GaussianBlur(small, (0, 0), 3.2)
    big = cv2.resize(small, (W, H), interpolation=cv2.INTER_CUBIC).astype(np.float32)
    return np.clip(big * 0.50 + BG * 0.35, 0, 255)


def window(img, z, cx, cy):
    S = img.shape[0]; L = S / z
    cxp = np.clip(cx * S, L / 2, S - L / 2); cyp = np.clip(cy * S, L / 2, S - L / 2)
    s = WIN / L
    M = np.float32([[s, 0, -(cxp - L / 2) * s], [0, s, -(cyp - L / 2) * s]])
    return cv2.warpAffine(img, M, (WIN, WIN), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def font_for(kind, size):
    return ImageFont.truetype(F_BLACK if kind == 'black' else F_XB, int(size))


def render_text(el, maxw=960):
    """Rend un bloc de texte en RGBA (alpha droit) avec ombre portée et halo optionnel."""
    size = el['size']
    while True:
        widths = []
        for line in el['lines']:
            widths.append(sum(font_for(el['font'], size * sc).getlength(t) for t, _, sc in line))
        if max(widths) <= maxw or size <= 24: break
        size -= 2
    lead = 1.06
    heights = [size * max(sc for _, _, sc in line) * lead for line in el['lines']]
    pad = 70
    cw, ch = int(max(widths)) + 2 * pad, int(sum(heights)) + 2 * pad
    fill = Image.new('RGBA', (cw, ch), (0, 0, 0, 0)); d = ImageDraw.Draw(fill)
    y = pad
    for line, lw, lh in zip(el['lines'], widths, heights):
        x = (cw - lw) / 2
        base = y + lh * 0.80
        for t, col, sc in line:
            f = font_for(el['font'], size * sc)
            d.text((x, base), t, font=f, fill=col + (255,), anchor='ls')
            x += f.getlength(t)
        y += lh
    a = np.array(fill)[..., 3]
    shadow = Image.fromarray(a).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(8))
    sh = np.zeros((ch, cw, 4), np.uint8); sh[..., 3] = (np.array(shadow) * 0.65).astype(np.uint8)
    layer = Image.alpha_composite(Image.fromarray(sh), fill)
    if el.get('glow'):
        g = Image.fromarray(a).filter(ImageFilter.GaussianBlur(22))
        gl = np.zeros((ch, cw, 4), np.uint8); gl[..., :3] = el['glow']; gl[..., 3] = (np.array(g) * 0.75).astype(np.uint8)
        layer = Image.alpha_composite(Image.fromarray(gl), layer)
    return np.array(layer)


def blend(frame, rgba, cx, cy, op=1.0, scale=1.0):
    """Pose un calque RGBA (alpha droit) centré en (cx,cy) avec opacité et échelle."""
    if op <= 0.003: return
    if abs(scale - 1) > 1e-3:
        rgba = cv2.resize(rgba, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA if scale < 1 else cv2.INTER_CUBIC)
    h, w = rgba.shape[:2]
    x0, y0 = int(round(cx - w / 2)), int(round(cy - h / 2))
    xa, ya, xb, yb = max(0, x0), max(0, y0), min(W, x0 + w), min(H, y0 + h)
    if xa >= xb or ya >= yb: return
    sub = rgba[ya - y0:yb - y0, xa - x0:xb - x0].astype(np.float32)
    al = sub[..., 3:4] / 255.0 * op
    frame[ya:yb, xa:xb] = frame[ya:yb, xa:xb] * (1 - al) + sub[..., :3] * al


def brackets(frame, x0, y0, x1, y1, col, op, ln=84, th=8):
    lay = np.zeros((H, W, 3), np.float32); m = np.zeros((H, W), np.float32)
    for (px, py, dx, dy) in ((x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)):
        cv2.line(m, (px, py), (px + dx * ln, py), 1.0, th, cv2.LINE_AA)
        cv2.line(m, (px, py), (px, py + dy * ln), 1.0, th, cv2.LINE_AA)
    m = m[..., None] * op
    frame[:] = frame * (1 - m) + np.array(col, np.float32) * m


def beam(frame, y, p, col, direction=1):
    """Trait laser lumineux qui traverse l'écran (p de 0 à 1)."""
    if not (0 <= p <= 1): return
    head = p * (W + 600) - 300
    xs = np.arange(W, dtype=np.float32)
    d = (head - xs) if direction > 0 else (xs - (W - head))
    prof = np.where((d >= 0) & (d <= 420), 1 - d / 420.0, 0.0) ** 1.5
    rows = np.arange(max(0, y - 40), min(H, y + 40), dtype=np.float32)
    v = np.exp(-((rows - y) ** 2) / (2 * 6.0 ** 2)) + 0.35 * np.exp(-((rows - y) ** 2) / (2 * 22.0 ** 2))
    add = (v[:, None] * prof[None, :])[..., None] * np.array(col, np.float32) * 1.1
    frame[rows[0].astype(int):rows[-1].astype(int) + 1] += add + 140 * (v[:, None, None] * prof[None, :, None]) * (v[:, None, None] > 0.9)


class Renderer:
    def __init__(self):
        self.ph = load_photos()
        self.bgs = {n: blurred_bg(im) for n, im in self.ph.items()}
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        r = np.sqrt(((xx - W / 2) / (W * 0.75)) ** 2 + ((yy - H / 2) / (H * 0.62)) ** 2)
        self.vig = (1 - 0.55 * np.clip(r - 0.35, 0, 1) ** 1.3)[..., None].astype(np.float32)
        fa = np.ones(WIN, np.float32); ramp = smooth(np.arange(170) / 170.0); fa[:170] = ramp; fa[-170:] = ramp[::-1]
        self.fa = fa[:, None, None]
        self.texts = []
        for el in TEXTS:
            self.texts.append((el, render_text(el)))
        # logo : alpha reconstruit depuis le canal vert (fond (11,13,18) -> lime (198,255,61))
        lg = cv2.cvtColor(cv2.imread(os.path.join(PH, 'logo.png')), cv2.COLOR_BGR2RGB).astype(np.float32)
        a = np.clip((lg[..., 1] - 13) / (255 - 13), 0, 1)
        self.logo = np.dstack([np.full(a.shape + (3,), LIME, np.float32), a * 255]).astype(np.uint8)
        yy2, xx2 = np.mgrid[0:H, 0:W].astype(np.float32)
        self.glow_end = np.exp(-(((xx2 - W / 2) ** 2 + (yy2 - 830) ** 2) / (2 * 430.0 ** 2)))[..., None].astype(np.float32)
        self.cta = self._cta()

    def _cta(self):
        pw, ph_ = 800, 150
        im = Image.new('RGBA', (pw + 120, ph_ + 120), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        d.rounded_rectangle((60, 60, 60 + pw, 60 + ph_), radius=ph_ // 2, fill=LIME + (255,))
        f = font_for('black', 66)
        d.text((60 + pw / 2, 60 + ph_ / 2 + 2), 'Commente « LASER »', font=f, fill=(11, 13, 18, 255), anchor='mm')
        a = np.array(im)[..., 3]
        g = Image.fromarray(a).filter(ImageFilter.GaussianBlur(26))
        gl = np.zeros(a.shape + (4,), np.uint8); gl[..., :3] = LIME; gl[..., 3] = (np.array(g) * 0.55).astype(np.uint8)
        return np.array(Image.alpha_composite(Image.fromarray(gl), im))

    def scene_at(self, t):
        for s in SCENES:
            if s['t0'] <= t < s['t1']: return s
        return SCENES[-1]

    def frame(self, t):
        sc = self.scene_at(t)
        f = np.empty((H, W, 3), np.float32)
        tt = t - sc['t0']; dur = sc['t1'] - sc['t0']
        if sc['id'] == 'fin':
            pulse = 0.85 + 0.15 * np.cos(2 * np.pi * (t - 12) / BEAT)
            f[:] = BG + np.array(LIME, np.float32) * 0.17 * self.glow_end * pulse
            # logo : arrivée avec dépassement
            k = out_back(tt / 0.6)
            blend(f, self.logo, W / 2, 830, op=min(1, tt / 0.25), scale=0.82 * (0.4 + 0.6 * k))
            brackets(f, 216, 506, 864, 1154, LIME, smooth(tt / 0.4) * (0.7 + 0.3 * np.cos(2 * np.pi * (t - 12) / BEAT)))
            beam(f, 830, tt / 0.3, LIME, 1)
            fl = 0.55 * (1 - smooth(tt / 0.30)) ** 2
            f += np.array(LIME, np.float32) * fl * 0.5
        else:
            bg = self.bgs[sc['photo']]
            f[:] = bg
            u = smooth(tt / dur)
            z = sc['z'][0] + (sc['z'][1] - sc['z'][0]) * u
            cx = sc['c'][0][0] + (sc['c'][1][0] - sc['c'][0][0]) * u
            cy = sc['c'][0][1] + (sc['c'][1][1] - sc['c'][0][1]) * u
            z *= 1 + 0.10 * (1 - out_cubic(tt / 0.40)) ** 2          # « punch » à chaque coupe
            w = window(self.ph[sc['photo']], z, cx, cy).astype(np.float32)
            reg = f[WIN_Y:WIN_Y + WIN]
            f[WIN_Y:WIN_Y + WIN] = reg * (1 - self.fa) + w * self.fa
            if tt < 0.30:
                fl = (1 - tt / 0.30) ** 2 * 0.55
                f[WIN_Y:WIN_Y + WIN] += np.array(sc['accent'], np.float32) * fl * 0.6
            brackets(f, 70, WIN_Y + 50, 1010, WIN_Y + WIN - 50, sc['accent'], 0.85 * (0.72 + 0.28 * np.cos(2 * np.pi * t / BEAT)))
            if sc['t0'] > 0:
                idx = SCENES.index(sc)
                beam(f, 640 + (idx * 137) % 520, tt / 0.26, sc['accent'], 1 if idx % 2 == 0 else -1)
        f *= self.vig
        # textes
        for el, rgba in self.texts:
            a, b = el['t']
            if not (a <= t < b + 1e-6): continue
            k = (t - a)
            if el['anim'] == 'pop':
                e = out_back(k / 0.30); sc_ = 0.55 + 0.45 * e; op = min(1, k / 0.12); dy = 0
            else:
                e = out_cubic(k / 0.35); sc_ = 1.0; op = e; dy = (1 - e) * 46
            blend(f, rgba, W / 2, el['y'] + dy, op=op, scale=sc_)
        if sc['id'] == 'fin':
            tt = t - 12
            tl = render_text(dict(lines=[[('PRÊT À JOUER ?', WHITE, 1)]], size=104, font='black', glow=LIME)) if not hasattr(self, '_pret') else self._pret
            self._pret = tl
            e = out_cubic((tt - 0.15) / 0.4); blend(f, tl, W / 2, 330 + (1 - e) * 40, op=e)
            e = out_back((tt - 0.55) / 0.45); blend(f, self.cta, W / 2, 1330, op=min(1, (tt - 0.55) / 0.15), scale=0.6 + 0.4 * e)
            if not hasattr(self, '_sub'):
                self._sub = render_text(dict(lines=[[('pour recevoir le lien', (235, 235, 235), 1)]], size=58, font='xb'))
            e = out_cubic((tt - 0.9) / 0.4); blend(f, self._sub, W / 2, 1470 + (1 - e) * 30, op=e)
        # ouverture et fermeture en fondu
        if t < 0.25: f *= smooth(t / 0.25)
        if t > TOTAL - 0.30: f *= smooth((TOTAL - t) / 0.30)
        return np.clip(f, 0, 255).astype(np.uint8)


def timeline():
    return dict(total=TOTAL, bpm=BPM, cuts=CUTS, hits=HITS, risers=RISERS)


def main():
    os.makedirs(OUT, exist_ok=True)
    mode = sys.argv[1] if len(sys.argv) > 1 else 'render'
    R = Renderer()
    if mode == 'stills':
        d = os.path.join(OUT, 'stills'); os.makedirs(d, exist_ok=True)
        for a in sys.argv[2:]:
            t = float(a); Image.fromarray(R.frame(t)).save(os.path.join(d, f't_{t:05.2f}.png'))
        return
    json.dump(timeline(), open(os.path.join(OUT, 'timeline.json'), 'w'), indent=1)
    out = os.path.join(OUT, 'video_sans_son.mp4')
    wr = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                           '-vf', 'scale=out_color_matrix=bt709:out_range=limited,format=yuv420p',
                           '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-profile:v', 'high',
                           '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
                           '-movflags', '+faststart', out], stdin=subprocess.PIPE)
    n = int(TOTAL * FPS)
    for i in range(n):
        wr.stdin.write(R.frame(i / FPS).tobytes())
        if i % 60 == 0: print(f'{i}/{n}', flush=True)
    wr.stdin.close(); wr.wait()
    print('ok', out)


if __name__ == '__main__':
    main()
