"""Bande-son originale (sans paroles, sans échantillon externe) : lifestyle / voyage, 120 BPM, La mineur.
Pads, pluck type marimba avec delay, basse, groove doux, ambiance océan très discrète.
Lit out/timeline.json (coupes du montage) -> écrit out/music.wav (stéréo 48 kHz).
Chaque coupe reçoit un « whoosh » d'air + une note cristalline pour que le son suive les mouvements de caméra.
"""
import json
import os

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, fftconvolve

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
SR = 48000
tl = json.load(open(os.path.join(OUT, 'timeline.json')))
TOTAL = tl['total']
CUTS = tl['cuts'][1:]                    # centres des fondus enchaînés
BEAT = 60.0 / tl['bpm']
BAR = 4 * BEAT
N = int(TOTAL * SR)
rng = np.random.default_rng(5)


def mid2f(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tv(n):
    return np.arange(n) / SR


def filt(x, kind, fc, order=2):
    return sosfilt(butter(order, fc, btype=kind, fs=SR, output='sos'), x, axis=-1)


def bus():
    return np.zeros((2, N))


def add(b, start, sig, gain=1.0, pan=0.0):
    i = int(round(start * SR))
    if i >= N or i + len(sig) <= 0:
        return
    if i < 0:
        sig, i = sig[-i:], 0
    seg = sig[: N - i]
    th = (pan + 1) * np.pi / 4
    b[0, i:i + len(seg)] += seg * gain * np.cos(th)
    b[1, i:i + len(seg)] += seg * gain * np.sin(th)


# ---------------------------------------------------------------- harmonie (2 mesures par accord)
# Am7 - Fmaj7 - Cmaj7 - G6, puis résolution Fmaj7 -> Cmaj7 sur le dernier plan
PROG = [0, 1, 2, 3, 0, 1, 2, 3, 1, 2]
PAD = {0: [57, 60, 64, 67], 1: [53, 57, 60, 64], 2: [55, 59, 64, 67], 3: [55, 59, 62, 64]}
ROOT = {0: 45, 1: 41, 2: 48, 3: 43}
ARP = {0: [64, 67, 69, 72, 76], 1: [65, 69, 72, 76, 81], 2: [64, 67, 71, 74, 76], 3: [67, 71, 74, 76, 79]}
BLOCK = 2 * BAR


def chord_at(t):
    return PROG[min(int(t // BLOCK), len(PROG) - 1)]


# ---------------------------------------------------------------- instruments
def pad_note(m, dur, detune_cents):
    n = int(dur * SR)
    t = tv(n)
    f = mid2f(m) * 2 ** (detune_cents / 1200)
    s = np.zeros(n)
    for k in range(1, 11):
        if f * k > 5000:
            break
        s += np.sin(2 * np.pi * f * k * t + k) / k
    att, rel = 0.9, 1.3
    env = np.clip(t / att, 0, 1) ** 1.6 * np.clip((dur - t) / rel, 0, 1) ** 1.3
    return s * env


def pluck(m, dur=1.6, bright=1.0):
    n = int(dur * SR)
    t = tv(n)
    f = mid2f(m)
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t * 3.4)
         + 0.42 * bright * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t * 11)
         + 0.14 * bright * np.sin(2 * np.pi * 10.1 * f * t) * np.exp(-t * 26))
    s *= np.minimum(t / 0.004, 1)
    s += filt(rng.normal(0, 1, n), 'bandpass', [1200, 3800]) * np.exp(-t * 140) * 0.05
    return s


def glass(m, dur):
    n = int(dur * SR)
    t = tv(n)
    f = mid2f(m)
    vib = 1 + 0.0035 * np.sin(2 * np.pi * 5.2 * t) * np.clip(t / 0.5, 0, 1)
    ph = 2 * np.pi * f * np.cumsum(vib) / SR
    s = np.sin(ph) + 0.22 * np.sin(2 * ph) + 0.06 * np.sin(3 * ph)
    env = np.minimum(t / 0.03, 1) * np.exp(-t * 1.5) * np.clip((dur - t) / 0.25, 0, 1)
    return s * env


def kick():
    n = int(0.5 * SR)
    t = tv(n)
    tau = 0.03
    ph = 2 * np.pi * (50 * t + 120 * tau * (1 - np.exp(-t / tau)))
    s = np.sin(ph) * np.exp(-t / 0.16) * np.minimum(t / 0.002, 1)
    s += filt(rng.normal(0, 1, n), 'lowpass', 3500) * np.exp(-t * 600) * 0.25
    return np.tanh(s * 1.4) * 0.9


def hat(dec=0.035, hp=7000):
    n = int(0.16 * SR)
    t = tv(n)
    return filt(rng.normal(0, 1, n), 'highpass', hp, 4) * np.exp(-t / dec)


def clap():
    n = int(0.45 * SR)
    t = tv(n)
    x = filt(rng.normal(0, 1, n), 'bandpass', [900, 3600])
    env = np.exp(-t / 0.13) * 0.6
    for o in (0.0, 0.011, 0.022):
        env += np.where(t >= o, np.exp(-(t - o) / 0.012), 0) * 0.5
    return x * env * np.minimum(t / 0.001, 1)


def bass_note(m, dur):
    n = int(dur * SR)
    t = tv(n)
    f = mid2f(m)
    s = np.tanh(2.0 * np.sin(2 * np.pi * f * t)) * 0.7
    env = np.minimum(t / 0.01, 1) * np.clip((dur - t) / 0.09, 0, 1)
    return filt(s * env, 'lowpass', 800)


def whoosh(dur=1.1, up=True):
    n = int(dur * SR)
    t = tv(n)
    x = rng.normal(0, 1, n)
    out = np.zeros(n)
    # balayage de bande passante : on mélange 3 tranches filtrées avec des enveloppes décalées
    for lo, hi, c in ((250, 700, 0.15), (700, 1800, 0.45), (1800, 5200, 0.8)):
        band = filt(x, 'bandpass', [lo, hi])
        env = np.exp(-((t / dur - c) ** 2) / (2 * 0.16 ** 2))
        out += band * env
    out *= np.clip(t / (dur * 0.85), 0, 1) ** 1.5 * np.clip((dur - t) / 0.12, 0, 1)
    return out


def thump():
    n = int(0.9 * SR)
    t = tv(n)
    return np.sin(2 * np.pi * (46 + 40 * np.exp(-t / 0.05)) * t) * np.exp(-t / 0.33) * 0.9


def ocean(seconds):
    n = int(seconds * SR)
    x = filt(rng.normal(0, 1, n), 'lowpass', 900)
    t = tv(n)
    swell = 0.55 + 0.45 * np.sin(2 * np.pi * 0.11 * t + 1.0) ** 2
    y = x * swell
    return np.stack([y, np.roll(y, int(0.013 * SR)) * 0.9])


# ---------------------------------------------------------------- partition
b_pad, b_bass, b_arp, b_mel, b_kick, b_hat, b_clap, b_fx, b_amb = (bus() for _ in range(9))
kick_times = []

# nappes
for blk in range(int(np.ceil(TOTAL / BLOCK))):
    t0 = blk * BLOCK
    dur = BLOCK + 1.5
    for j, m in enumerate(PAD[PROG[blk]]):
        for det, pan in ((-7, -0.55), (0, 0.0), (7, 0.55)):
            add(b_pad, t0 - 0.35 if blk else t0, pad_note(m, dur, det), 0.050, pan)
b_pad = filt(b_pad, 'lowpass', 2400)

# basse (dès 3 s : tenues ; dès 7 s : motif rythmique)
PATTERN = [(0.0, 1.5, 0), (1.5, 0.5, 12), (2.5, 0.75, 0), (3.5, 0.5, 7)]
for bar in range(int(TOTAL / BAR)):
    tb = bar * BAR
    if tb < 3.0 or tb > 37.5:
        continue
    root = ROOT[chord_at(tb)]
    if tb < 7.0 or 32.0 <= tb < 34.0:
        add(b_bass, tb, bass_note(root, BAR * 0.95), 0.22)
    else:
        for off, ln, semi in PATTERN:
            add(b_bass, tb + off * BEAT, bass_note(root + semi, ln * BEAT * 0.95), 0.25)

# kick : demi-temps 3-7 s, quatre temps 7-34 s, demi-temps 34-38 s
K = kick()
nbeats = int(TOTAL / BEAT)
for k in range(nbeats):
    t = k * BEAT
    if 3.0 <= t < 7.0 and k % 2 == 0:
        on = True
    elif 7.0 <= t < 32.0:
        on = True
    elif 34.0 <= t < 38.0 and k % 2 == 0:
        on = True
    else:
        on = False
    if on:
        add(b_kick, t, K, 0.32 if t < 7 else 0.38)
        kick_times.append(t)

# hats / shaker / clap
H = hat()
H2 = hat(0.05, 5500)
for k in range(nbeats * 2):
    t = k * BEAT / 2
    if t < 3.0 or t >= 38.0 or 32.0 <= t < 34.0:
        continue
    if k % 2 == 1:                                            # contretemps
        add(b_hat, t, H, 0.34 if t >= 7 else 0.20, 0.25)
    elif 7.0 <= t < 32.0:
        add(b_hat, t, H2, 0.08, -0.2)                      # petit shaker sur les temps
CL = clap()
for k in range(nbeats):
    t = k * BEAT
    if 11.0 <= t < 32.0 and k % 4 in (1, 3):
        add(b_clap, t, CL, 0.40, 0.0)

# arpège pluck (noires jusqu'à 7 s, croches ensuite) + écho
PAT8 = [0, 2, 3, 2, 1, 3, 4, 3]
PAT4 = [0, 2, 3, 1]
t = 0.4
step = 0
while t < TOTAL - 1.5:
    ch = chord_at(t)
    dense = t >= 7.0
    idx = (PAT8 if dense else PAT4)[step % (8 if dense else 4)]
    vel = (1.0 if step % (8 if dense else 4) == 0 else 0.72) * (0.85 + 0.15 * rng.random())
    add(b_arp, t, pluck(ARP[ch][idx], bright=1.25), 0.30 * vel, pan=(-0.45 if step % 2 else 0.45))
    t += BEAT / 2 if dense else BEAT
    step += 1

# mélodie « verre » : motif pentatonique, entre à 14 s, très présent sur la fin
MOTIF = [(0, 76, 2), (3, 79, 1), (4, 81, 3), (8, 79, 1), (9, 76, 1), (10, 74, 2), (12, 72, 3)]
for blk in range(int(np.ceil(TOTAL / (BLOCK)))):
    t0 = blk * BLOCK
    if t0 < 14.0 or t0 >= 38.0:
        continue
    for pos, m, ln in MOTIF:
        add(b_mel, t0 + pos * BEAT / 2, glass(m, ln * BEAT / 2 + 0.6), 0.24 if t0 >= 34.0 else 0.17, 0.1)

# transitions : whoosh qui monte vers la coupe + impact doux + note cristalline
for i, c in enumerate(CUTS):
    wd = 1.1
    w = whoosh(wd)
    add(b_fx, c - wd + 0.12, w, 0.28, pan=-0.5 if i % 2 else 0.5)
    add(b_fx, c - 0.01, thump(), 0.20)
    add(b_fx, c, pluck(88 if i % 2 else 84, 2.2, 0.9), 0.17, pan=0.3)
# impact d'ouverture sur le hook
add(b_fx, 0.0, thump(), 0.38)
add(b_fx, 0.0, filt(rng.normal(0, 1, int(1.6 * SR)), 'lowpass', 1800) * np.exp(-tv(int(1.6 * SR)) / 0.5), 0.10)
# montée vers le dernier plan
w = whoosh(2.0)
add(b_fx, 34.0 - 2.0 + 0.2, w, 0.30, pan=0.4)
add(b_fx, 34.0 - 0.01, thump(), 0.34)

# ambiance océan
amb = ocean(TOTAL)
b_amb += amb * 0.040
b_amb *= np.clip(tv(N) / 1.5, 0, 1)

# ---------------------------------------------------------------- sidechain (pompage doux sur kick)
duck = np.ones(N)
for kt in kick_times:
    i = int(kt * SR)
    seg = min(int(0.30 * SR), N - i)
    if seg > 0:
        duck[i:i + seg] *= 1 - 0.45 * np.exp(-tv(seg) / 0.11)
for b in (b_pad, b_bass, b_arp):
    b *= duck


# ---------------------------------------------------------------- réverb synthétique
def reverb_ir(rt60=2.3, seconds=2.8):
    n = int(seconds * SR)
    t = tv(n)
    ir = []
    for _ in range(2):
        x = rng.normal(0, 1, n) * np.exp(-6.9 * t / rt60)
        x = filt(x, 'lowpass', 6500)
        x = filt(x, 'highpass', 180)
        x[: int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
        ir.append(x)
    ir = np.stack(ir)
    return ir / np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True)) * 1.0


IR = reverb_ir()


def reverb(b):
    return np.stack([fftconvolve(b[0], IR[0])[:N], fftconvolve(b[1], IR[1])[:N]])


def pingpong(b, d=0.75 * BEAT, fb=0.38, reps=5):
    """Delay en croche pointée, les répétitions alternent gauche / droite."""
    mono = filt(b[0] + b[1], 'lowpass', 4200) * 0.5
    out = np.zeros_like(b)
    for r in range(1, reps + 1):
        sh = int(r * d * SR)
        g = fb ** (r - 1) * 0.6
        side = r % 2
        out[side, sh:] += mono[: N - sh] * g
        out[1 - side, sh:] += mono[: N - sh] * g * 0.25
    return out


arp_wet = pingpong(b_arp)
mel_wet = pingpong(b_mel, fb=0.45)
sends = (b_pad * 0.35 + b_arp * 0.30 + arp_wet * 0.5 + b_mel * 0.55 + mel_wet * 0.6 +
         b_clap * 0.55 + b_fx * 0.45 + b_hat * 0.08)
wet = reverb(sends)

mix = (b_pad + b_bass * 1.0 + b_arp + arp_wet * 0.75 + b_mel + mel_wet * 0.8 + b_kick + b_hat + b_clap +
       b_fx + b_amb + wet * 0.9)

# ---------------------------------------------------------------- master
mix = filt(mix, 'highpass', 28)
fade_in = np.clip(tv(N) / 0.05, 0, 1)
fade_out = np.clip((TOTAL - tv(N)) / 2.2, 0, 1) ** 1.6
mix = mix * fade_in * fade_out
mix = np.tanh(mix * 0.5) / np.tanh(0.5)      # saturation très douce, sans écraser la dynamique
peak = np.max(np.abs(mix))
mix = mix / peak * 0.89
wavfile.write(os.path.join(OUT, 'music.wav'), SR, (mix.T * 32767).astype(np.int16))
print('ok music.wav', round(TOTAL, 2), 's, pic avant normalisation', round(float(peak), 3))
