"""Texture du bureau en bois (procédurale, reproductible) : lames de chêne chaud, fil du bois étiré, pores, joints.
    python3 make_textures.py  ->  textures/wood.jpg  (2048x2048, sRGB)   |  dépendances : numpy, scipy, pillow"""
import numpy as np
from scipy.ndimage import zoom, gaussian_filter
from PIL import Image

H = W = 2048
rng = np.random.default_rng(7)


def smooth_noise(h0, w0, seed):
    r = np.random.default_rng(seed).random((h0, w0))
    return zoom(r, (H / h0, W / w0), order=3, mode='grid-wrap', grid_mode=True)[:H, :W]


# fil du bois : bruit étiré dans le sens des lames (horizontal), plusieurs échelles
g = (0.38 * smooth_noise(160, 6, 1) + 0.26 * smooth_noise(420, 10, 2) + 0.2 * smooth_noise(900, 18, 3) + 0.16 * smooth_noise(1700, 30, 4))
g = (g - g.min()) / (g.max() - g.min())
# anneaux : ondulation lente le long du fil
yy = np.arange(H)[:, None] / H
warp = smooth_noise(24, 5, 5)
rings = 0.5 + 0.5 * np.sin(2 * np.pi * (yy * 70 + warp * 1.1))
grain = 0.62 * g + 0.38 * rings * (0.5 + 0.5 * g)

PLANKS = 8
ph = H // PLANKS
tone = 0.92 + 0.16 * rng.random(PLANKS)
tint = rng.random(PLANKS)
img = np.zeros((H, W, 3), np.float32)
dark = np.array([0.30, 0.150, 0.065])
mid = np.array([0.50, 0.275, 0.135])
light = np.array([0.64, 0.375, 0.195])
s = np.clip((grain - 0.05) / 0.95, 0, 1)
s = s * s * (3 - 2 * s)
base = np.where(s[..., None] < 0.5, dark + (mid - dark) * (s[..., None] * 2), mid + (light - mid) * ((s[..., None] - 0.5) * 2))
for j in range(PLANKS):
    sl = slice(j * ph, (j + 1) * ph)
    shift = (tint[j] - 0.5) * np.array([0.05, 0.03, 0.015])
    img[sl] = (base[sl] + shift) * tone[j]
    # chaque lame a son propre décalage de fil
    img[sl] = np.roll(img[sl], int(rng.integers(0, W)), axis=1)
# pores : petits traits sombres dans le sens du fil
pores = (rng.random((H, W)) > 0.9965).astype(np.float32)
pores = gaussian_filter(pores, (0.7, 7.0)) * 9
img *= (1 - np.clip(pores, 0, 0.55))[..., None]
# fines stries
streak = gaussian_filter(rng.random((H, W)), (0.6, 18.0))
streak = (streak - streak.mean()) / streak.std()
img *= (1 + 0.025 * streak)[..., None]
# joints entre lames et quelques joints d'about
for j in range(PLANKS):
    y = j * ph
    img[max(0, y - 2):y + 2] *= 0.5
    img[y + 2:y + 6] *= 0.86
    x = int(rng.integers(300, W - 300))
    img[y + 6:y + ph - 2, x:x + 3] *= 0.55
img = np.clip(img, 0, 1)
Image.fromarray((img ** (1 / 2.2) * 255).astype(np.uint8)).save('textures/wood.jpg', quality=90)
print('textures/wood.jpg')
