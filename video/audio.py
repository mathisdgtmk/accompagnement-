"""Bande-son synthétique (sombre, house mélodique en la mineur) calée sur la chronologie de la vidéo.
Lit out/timeline.json -> écrit out/audio.wav (stéréo 44,1 kHz)."""
import json
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
tl = json.load(open('out/timeline.json'))
TOTAL, BPM = tl['total'], tl['bpm']
BEAT = 60 / BPM
N = int((TOTAL + 0.5) * SR)
rng = np.random.default_rng(5)
tt = np.arange(N) / SR

def bus():
    return np.zeros((2, N))

def put(b, start, sig, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= N or i < 0:
        return
    seg = sig[: N - i]
    b[0, i:i + len(seg)] += seg * gain * np.cos((pan + 1) * np.pi / 4)
    b[1, i:i + len(seg)] += seg * gain * np.sin((pan + 1) * np.pi / 4)

def filt(x, kind, fc, order=4):
    sos = butter(order, fc, btype=kind, fs=SR, output='sos')
    return sosfilt(sos, x, axis=-1)

def env_t(n):
    return np.arange(n) / SR

scene_starts = [s['t0'] for s in tl['scenes']]
brand_t = next(s['t0'] for s in tl['scenes'] if s['name'] == 'brand')
form_t = next((s['t0'] for s in tl['scenes'] if s['name'].startswith('formula')), brand_t)
cta_t = next(s['t0'] for s in tl['scenes'] if s['name'] == 'cta')

# ---- progression Am - F - C - G (1 accord par mesure de 4 temps) ----
roots = [55.0, 43.65, 65.41, 49.0]
chords = [[220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [261.63, 329.63, 392.0], [196.0, 246.94, 293.66]]
BAR = 4 * BEAT
nbars = int(np.ceil(TOTAL / BAR)) + 1

drums, music, fx = bus(), bus(), bus()

# ---- grosse caisse ----
def kick():
    t = env_t(int(0.4 * SR))
    f = 46 + 120 * np.exp(-t * 30)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * 7.5)
    s[: int(0.004 * SR)] += rng.normal(0, 0.5, int(0.004 * SR)) * 0.6
    return np.tanh(s * 1.8)

K = kick()
nb = int(TOTAL / BEAT) + 1
for k in range(nb):
    put(drums, k * BEAT, K, 0.95)

# ---- charleston ----
def hat(open_=False):
    n = int((0.35 if open_ else 0.07) * SR)
    t = env_t(n)
    s = filt(rng.normal(0, 1, n), 'highpass', 7500, 4) * np.exp(-t * (14 if open_ else 70))
    return s
H_C, H_O = hat(False), hat(True)
for k in range(nb * 2):
    t0 = k * BEAT / 2
    if k % 2 == 1:
        put(drums, t0, H_O, 0.20, 0.15)
    elif t0 >= brand_t:
        put(drums, t0, H_C, 0.07, -0.2)
if form_t < TOTAL:
    for k in range(int(TOTAL / (BEAT / 4)) + 1):
        t0 = k * BEAT / 4
        if t0 >= form_t and k % 2 == 1:
            put(drums, t0, H_C, 0.05 + 0.04 * (k % 4 == 3), 0.25)

# ---- clap (temps 2 et 4) à partir des formules ----
def clap():
    n = int(0.3 * SR)
    t = env_t(n)
    base = filt(rng.normal(0, 1, n), 'bandpass', [1100, 3800], 2)
    e = np.exp(-t * 16) + 0.6 * np.exp(-((t - 0.011) % 0.011) * 200) * (t < 0.03)
    return base * e
CL = clap()
for k in range(nb):
    t0 = k * BEAT
    if k % 2 == 1 and t0 >= form_t - BEAT * 2:
        put(drums, t0, CL, 0.5)

# ---- basse (croches décalées) ----
bass_saw, bass_sub = bus(), bus()
for k in range(nb * 2):
    t0 = k * BEAT / 2
    if k % 2 == 0:
        continue
    root = roots[int(t0 // BAR) % 4]
    n = int(BEAT * 0.45 * SR)
    t = env_t(n)
    e = np.minimum(t / 0.006, 1) * np.exp(-t * 4.5)
    saw = 2 * ((root * 2 * t) % 1) - 1
    put(bass_saw, t0, saw * e, 0.6)
    put(bass_sub, t0, np.sin(2 * np.pi * root * t) * e, 0.95)
music += filt(bass_saw, 'lowpass', 420, 4) * 0.55 + bass_sub * 0.55

# ---- nappe (accords) ----
pad = bus()
for b in range(nbars):
    t0 = b * BAR
    n = int((BAR + 0.5) * SR)
    t = env_t(n)
    e = np.minimum(t / 0.55, 1) * np.minimum((BAR + 0.5 - t) / 0.5, 1)
    for fnote in chords[b % 4]:
        for det in (-0.006, 0.0, 0.006):
            f = fnote * (1 + det)
            put(pad, t0, (2 * ((f * t) % 1) - 1) * e, 0.075, rng.uniform(-0.6, 0.6))
pad = filt(pad, 'lowpass', 1500, 2)
# la nappe s'ouvre vers le final
sweep = np.clip((tt - form_t) / max(cta_t - form_t, 1), 0, 1)
pad_hi = filt(pad, 'highpass', 900, 2)
pad = pad * 0.8 + pad_hi * (0.5 * sweep)
music += pad * 1.0

# ---- arpège (doubles croches) à partir de la scène marque ----
arp = bus()
pat = [0, 1, 2, 3, 4, 3, 2, 1]
for k in range(int(TOTAL / (BEAT / 4)) + 1):
    t0 = k * BEAT / 4
    if t0 < brand_t:
        continue
    ch = chords[int(t0 // BAR) % 4]
    tones = ch + [x * 2 for x in ch]
    f = tones[pat[k % 8]] * 2
    n = int(0.22 * SR)
    t = env_t(n)
    e = np.minimum(t / 0.003, 1) * np.exp(-t * 18)
    s = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.18 * (2 * ((f * t) % 1) - 1)) * e
    put(arp, t0, s, 0.11 if t0 < form_t else 0.14, 0.45 * (1 if k % 2 else -1))
# delay ping-pong
d = int(BEAT * 0.75 * SR)
for rep, g in enumerate((0.38, 0.2, 0.1), start=1):
    arp[0, rep * d:] += arp[1, :-rep * d] * g
    arp[1, rep * d:] += arp[0, :-rep * d] * g * 0.9
music += arp

# réverbération sur nappe + arp
ir_n = int(1.1 * SR)
ir_t = env_t(ir_n)
wet = np.zeros((2, N))
for c in range(2):
    ir = rng.normal(0, 1, ir_n) * np.exp(-ir_t * 3.6)
    wet[c] = fftconvolve(pad[c] + arp[c], ir)[:N] * 0.012
music += wet

# ---- sidechain ----
duck = 1 - 0.72 * np.exp(-((tt % BEAT) * 15))
music *= duck

# ---- transitions : montée + impact sur chaque coupe ----
def riser(dur):
    n = int(dur * SR)
    t = env_t(n)
    x = filt(rng.normal(0, 1, n), 'bandpass', [1800, 9000], 2)
    return x * (t / dur) ** 2.2

def impact():
    n = int(1.6 * SR)
    t = env_t(n)
    f = 38 + 70 * np.exp(-t * 8)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.6)
    nz = filt(rng.normal(0, 1, n), 'lowpass', 5000, 2) * np.exp(-t * 7)
    return np.tanh(sub * 1.6) * 0.9 + nz * 0.35

IM = impact()
for i, ts in enumerate(scene_starts):
    big = ts == cta_t or i == 0
    put(fx, ts, IM, 0.75 if big else 0.5)
    if i > 0:
        rd = BEAT * (4 if ts == cta_t else 2)
        put(fx, ts - rd, riser(rd), 0.22 if ts == cta_t else 0.14)
# petit "whoosh" d'entrée de mots pendant l'accroche
for k in range(3):
    put(fx, 0.1 + k * BEAT * 1.5, filt(rng.normal(0, 1, int(0.3 * SR)), 'bandpass', [400, 3000], 2) * np.exp(-env_t(int(0.3 * SR)) * 9), 0.18, -0.3 + 0.3 * k)

# ---- mixage final ----
mix = drums * 0.9 + music * 1.0 + fx * 1.0
mix = np.tanh(mix * 1.15) / np.tanh(1.15)
fade_out = np.clip((TOTAL + 0.3 - tt) / 1.1, 0, 1)
fade_in = np.clip(tt / 0.02, 0, 1)
mix *= fade_out * fade_in
mix *= 0.72 / max(np.abs(mix).max(), 1e-6)
wavfile.write('out/audio.wav', SR, (mix.T * 32767).astype(np.int16))
print(f'audio.wav : {TOTAL + 0.5:.1f} s, pic {np.abs(mix).max():.2f}')
