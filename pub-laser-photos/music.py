"""Bande-son originale de la pub laser tag (sans échantillon externe, sans paroles) : synthwave 120 BPM, La mineur.
Kick / clap / hats, basse, pads, arpège, + bruitages calés sur le montage (tirs laser à chaque couleur, montées, impacts).
Lit out/timeline.json -> écrit out/music.wav (stéréo 48 kHz)."""
import json, os
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, sosfilt_zi, fftconvolve

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
SR = 48000
tl = json.load(open(os.path.join(OUT, 'timeline.json')))
TOTAL = tl['total']; BEAT = 60.0 / tl['bpm']; BAR = 4 * BEAT
N = int(TOTAL * SR)
rng = np.random.default_rng(11)


def mid2f(m): return 440.0 * 2 ** ((m - 69) / 12)
def tv(n): return np.arange(n) / SR
def filt(x, kind, fc, order=2):
    return sosfilt(butter(order, fc, btype=kind, fs=SR, output='sos'), x, axis=-1)
def bus(): return np.zeros((2, N))
def add(b, t, sig, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= N or i + len(sig) <= 0: return
    if i < 0: sig, i = sig[-i:], 0
    seg = sig[:N - i]; th = (pan + 1) * np.pi / 4
    b[0, i:i + len(seg)] += seg * gain * np.cos(th); b[1, i:i + len(seg)] += seg * gain * np.sin(th)
def saw(f, n, ph=0.0):
    return 2 * ((f * tv(n) + ph) % 1.0) - 1


# ------------------------------------------------------------------ harmonie : Am - F - C - G (1 mesure chacun)
PROG = [0, 1, 2, 3] * 3
PAD = {0: [57, 60, 64, 67], 1: [53, 57, 60, 64], 2: [55, 59, 64, 67], 3: [55, 59, 62, 64]}
ROOT = {0: 45, 1: 41, 2: 48, 3: 43}
ARP = {0: [69, 72, 76, 72, 81, 76, 72, 76], 1: [65, 69, 72, 69, 77, 72, 69, 72],
       2: [67, 72, 76, 72, 79, 76, 72, 76], 3: [67, 71, 74, 71, 79, 74, 71, 74]}


# ------------------------------------------------------------------ instruments
def kick(vol=1.0):
    n = int(0.42 * SR); t = tv(n)
    f = 46 + 130 * np.exp(-t / 0.035)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.20)
    x += 0.35 * rng.standard_normal(n) * np.exp(-t / 0.004)
    return np.tanh(x * 1.6) * vol


def clap():
    n = int(0.30 * SR); t = tv(n)
    x = rng.standard_normal(n)
    x = filt(filt(x, 'high', 900), 'low', 5200)
    env = np.exp(-t / 0.085)
    for k in (0.011, 0.022):
        env += 0.8 * np.exp(-np.clip(t - k, 0, None) / 0.07) * (t >= k) * 0.5
    return x * env * 0.8


def hat(open_=False):
    n = int((0.22 if open_ else 0.05) * SR); t = tv(n)
    return filt(rng.standard_normal(n), 'high', 7500) * np.exp(-t / (0.09 if open_ else 0.012))


def bass(m, dur):
    n = int(dur * SR); t = tv(n); f = mid2f(m)
    x = 0.6 * saw(f, n) + 0.5 * np.sin(2 * np.pi * f * t) + 0.9 * np.sin(np.pi * f * t)
    x = filt(x, 'low', 520)
    return np.tanh(x * 1.3) * np.exp(-t / (dur * 0.9)) * np.minimum(1, t / 0.006)


def pad(notes, dur):
    n = int(dur * SR); t = tv(n); x = np.zeros(n)
    for m in notes:
        f = mid2f(m)
        for d in (-0.006, 0.0, 0.006):
            x += saw(f * (1 + d), n, rng.random())
    x = filt(x / (3 * len(notes)), 'low', 1500)
    env = np.minimum(1, t / 0.5) * np.minimum(1, (dur - t) / 0.35)
    return x * env


def pluck(m, dur=0.3, bright=2600):
    n = int(dur * SR); t = tv(n); f = mid2f(m)
    x = saw(f, n) + 0.6 * saw(f * 1.006, n, 0.3) + 0.4 * ((saw(f, n) > 0) * 2 - 1)
    x = filt(x, 'low', bright)
    return x * np.exp(-t / 0.11) * np.minimum(1, t / 0.003)


def pew(f0, vol=1.0):
    n = int(0.42 * SR); t = tv(n)
    f = f0 * np.exp(-t / 0.075) + 160
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + 0.5 * np.sign(np.sin(ph * 1.003)) * 0.6 + 0.3 * np.sin(2 * ph)
    x = filt(x, 'high', 260) * np.exp(-t / 0.10) * np.minimum(1, t / 0.002)
    x += 0.5 * filt(rng.standard_normal(n), 'high', 3000) * np.exp(-t / 0.012)
    return x * 0.55 * vol


def zap():
    n = int(0.30 * SR); t = tv(n)
    f = 250 * np.exp(t / 0.09)
    x = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR))
    return filt(x, 'low', 6000) * np.exp(-t / 0.10) * 0.5


def tick():
    out = np.zeros(int(0.2 * SR))
    for k, f in enumerate((1760, 2349)):
        n = int(0.05 * SR); t = tv(n); i = int(k * 0.09 * SR)
        out[i:i + n] += np.sin(2 * np.pi * f * t) * np.exp(-t / 0.02) * 0.5
    return out


def impact(vol=1.0):
    n = int(2.0 * SR); t = tv(n)
    f = 38 + 120 * np.exp(-t / 0.06)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.55)
    nz = filt(rng.standard_normal(n), 'low', 1400) * np.exp(-t / 0.28)
    hi = filt(rng.standard_normal(n), 'high', 5000) * np.exp(-t / 0.7) * 0.25
    return np.tanh((x * 1.1 + nz * 0.55 + hi) * 1.3) * vol


def sparkle():
    n = int(1.4 * SR); out = np.zeros(n)
    for k, m in enumerate((88, 91, 95, 100, 103)):
        i = int(k * 0.05 * SR); nn = n - i; t = tv(nn)
        out[i:] += np.sin(2 * np.pi * mid2f(m) * t) * np.exp(-t / 0.35) * 0.18
    return out


def riser(a, b):
    n = int((b - a) * SR); x = np.zeros(n); noise = rng.standard_normal(n)
    chunk = 1024; zi = None
    for i in range(0, n, chunk):
        p = i / n; fc = 350 * (7500 / 350) ** p
        sos = butter(2, [fc * 0.7, min(fc * 1.6, SR / 2 - 100)], btype='band', fs=SR, output='sos')
        if zi is None: zi = sosfilt_zi(sos) * 0
        y, zi = sosfilt(sos, noise[i:i + chunk], zi=zi); x[i:i + chunk] = y
    p = np.linspace(0, 1, n)
    f = 200 * (3000 / 200) ** p
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25
    return (x * 1.2 + tone) * p ** 2.2 * 0.8


def reverb(x, length=1.7, decay=0.42):
    n = int(length * SR); t = tv(n)
    ir = np.stack([rng.standard_normal(n), rng.standard_normal(n)]) * np.exp(-t / decay)
    ir = filt(ir, 'high', 250); ir = filt(ir, 'low', 7000)
    return np.stack([fftconvolve(x[0], ir[0])[:N], fftconvolve(x[1], ir[1])[:N]]) * 0.045


# ------------------------------------------------------------------ construction
drums, tonal, sfx, send = bus(), bus(), bus(), bus()
kick_times = []
ENDC = 12.0
t = 0.0; beat = 0
while t < TOTAL - 0.01:
    if t < ENDC - 1e-6:
        add(drums, t, kick(), 0.95); kick_times.append(t)
        if beat % 2 == 1 and t >= 2.0 - 1e-6:
            add(drums, t, clap(), 0.42, 0.05)
    elif t < 14.0 - 1e-6 and beat % 4 == 0:
        add(drums, t, kick(0.8), 0.8); kick_times.append(t)
    t += BEAT; beat += 1
# hats : croches décalées dès 1,0 s ; double-croches de 6 à 12 s
t = 1.0 + BEAT / 2
while t < ENDC:
    add(drums, t, hat(open_=(int((t - 0.25) / BEAT) % 2 == 1)), 0.10, -0.2)
    t += BEAT
t = 6.0
while t < ENDC:
    add(drums, t + BEAT / 4, hat(), 0.05, 0.25); add(drums, t + 3 * BEAT / 4, hat(), 0.05, 0.25)
    t += BEAT

for bar in range(int(np.ceil(TOTAL / BAR))):
    t0 = bar * BAR; ch = PROG[bar % len(PROG)]
    quiet = t0 >= ENDC - 1e-6
    add(tonal, t0, pad(PAD[ch], BAR + 0.3), 0.20 if not quiet else 0.27, 0.0)
    for k in range(8):                                      # basse en croches
        tt = t0 + k * BEAT / 2
        if tt >= TOTAL: break
        m = ROOT[ch] + (12 if k in (3, 7) else 0)
        if quiet and k % 2: continue
        add(tonal, tt, bass(m, BEAT / 2 * 1.9), 0.34, 0.0)
    if t0 >= 1.0 - 1e-6 or bar >= 1:                        # arpège en doubles-croches
        notes = ARP[ch]
        for k in range(16):
            tt = t0 + k * BEAT / 4
            if tt < 1.0 or tt >= TOTAL: continue
            m = notes[k % len(notes)] + (12 if (k // 8) % 2 and bar % 2 else 0)
            g = (0.085 if not quiet else 0.06) * (1.0 if k % 4 == 0 else 0.7)
            pan = -0.5 if k % 2 else 0.5
            add(tonal, tt, pluck(m, 0.3, 2400 + 600 * (k % 4 == 0)), g, pan)
            add(send, tt, pluck(m, 0.3, 2400), g * 0.7, -pan)
# accord final (14,0 s) : La mineur ample + sparkle
for m in (57, 60, 64, 69, 72, 76):
    add(tonal, 14.0, pluck(m, 0.9, 3200) * 1.0, 0.11, 0.0); add(send, 14.0, pluck(m, 0.9, 3200), 0.16, 0.0)
add(tonal, 14.0, pad([57, 60, 64, 69], 1.0), 0.28, 0.0)
add(tonal, 14.0, bass(33, 1.0), 0.40, 0.0)

# bruitages
for h in tl['hits']:
    k = h['k']; tt = h['t']; pan = float(np.clip(rng.normal(0, 0.45), -0.8, 0.8))
    if k == 'impact': add(sfx, tt, impact(), 0.95)
    elif k == 'boom': add(sfx, tt, impact(0.8), 0.70)
    elif k == 'pew':
        s = pew(h['f']); add(sfx, tt, s, 0.9, pan)
        add(send, tt, s, 0.8, -pan)
        add(sfx, tt + 0.16, s, 0.18, -pan); add(sfx, tt + 0.32, s, 0.08, pan)
    elif k == 'zap': add(sfx, tt, zap(), 0.9, pan); add(sfx, tt, impact(0.6), 0.55)
    elif k == 'tick': add(sfx, tt, tick(), 0.6)
    elif k == 'sparkle': s = sparkle(); add(sfx, tt, s, 0.9); add(send, tt, s, 0.9)
for a, b in tl['risers']:
    s = riser(a, b); add(sfx, a, s, 0.55, 0.0)

# compression par le kick (sidechain) sur la partie tonale
g = np.ones(N)
tt = np.arange(N) / SR
for k in kick_times:
    i = int(k * SR); seg = np.exp(-np.arange(min(N - i, int(0.35 * SR))) / (SR * 0.11))
    g[i:i + len(seg)] = np.minimum(g[i:i + len(seg)], 1 - 0.50 * seg)
tonal *= g
mix = tonal * 1.0 + drums * 1.0 + sfx * 1.0 + reverb(send) + 0.9 * reverb(tonal * 0.25, 1.4, 0.35)
mix = filt(mix, 'high', 28)
# fondu de sortie sur les 0,7 dernières secondes
fo = np.clip((TOTAL - tt) / 0.7, 0, 1) ** 1.5
mix *= fo
mix = np.tanh(mix * 0.85) / np.tanh(0.85)
mix *= 0.89 / np.abs(mix).max()
os.makedirs(OUT, exist_ok=True)
wavfile.write(os.path.join(OUT, 'music.wav'), SR, (mix.T * 32767).astype(np.int16))
print('ok', os.path.join(OUT, 'music.wav'), round(float(np.sqrt((mix ** 2).mean())), 3))
