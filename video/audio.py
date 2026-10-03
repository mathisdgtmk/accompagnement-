"""Bande-son d'ambiance, sans rythmique : piano doux, nappes, basse très discrète, reverb longue.
Lit out/timeline.json -> écrit out/audio.wav (stéréo 44,1 kHz)."""
import json
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
tl = json.load(open('out/timeline.json'))
TOTAL = tl['total']
N = int((TOTAL + 0.5) * SR)
rng = np.random.default_rng(11)
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

def filt(x, kind, fc, order=2):
    return sosfilt(butter(order, fc, btype=kind, fs=SR, output='sos'), x, axis=-1)

def tvec(n):
    return np.arange(n) / SR

BAR = 4.0
nbars = int(np.ceil(TOTAL / BAR)) + 1
# Am(add9) - Fmaj7 - Cmaj7(add9) - G(6/9)
bass = [55.0, 43.65, 65.41, 49.0]
pads = [[110.0, 164.81, 246.94, 261.63], [130.81, 174.61, 220.0, 329.63], [196.0, 246.94, 293.66, 329.63], [146.83, 196.0, 246.94, 293.66]]
tones = [[329.63, 440.0, 493.88, 523.25, 659.25], [261.63, 349.23, 440.0, 523.25, 659.25], [329.63, 392.0, 493.88, 587.33, 659.25], [293.66, 392.0, 440.0, 493.88, 587.33]]

pad_b, bass_b, pluck_b, fx_b = bus(), bus(), bus(), bus()

# ---- nappes : attaque lente, très douces ----
for b in range(nbars):
    t0 = b * BAR - 0.4
    n = int((BAR + 2.6) * SR)
    t = tvec(n)
    e = np.clip(t / 1.8, 0, 1) ** 1.5 * np.clip((BAR + 2.6 - t) / 2.0, 0, 1)
    for f in pads[b % 4]:
        for det in (-0.004, 0.004):
            s = np.sin(2 * np.pi * f * (1 + det) * t) + 0.25 * np.sin(4 * np.pi * f * (1 + det) * t)
            put(pad_b, max(t0, 0), s * e if t0 >= 0 else (s * e)[int(-t0 * SR):], 0.032, rng.uniform(-0.7, 0.7))
    # basse : sinus pur, très discret
    nb = int((BAR + 2.0) * SR)
    tb = tvec(nb)
    eb = np.clip(tb / 1.4, 0, 1) ** 1.3 * np.clip((BAR + 2.0 - tb) / 1.8, 0, 1)
    put(bass_b, max(b * BAR - 0.2, 0), np.sin(2 * np.pi * bass[b % 4] * tb) * eb * 0.7, 0.20)
pad_b = filt(pad_b, 'lowpass', 1500)

# ---- piano feutré : arpèges lents ----
def pluck(f, dur=3.0):
    n = int(dur * SR)
    t = tvec(n)
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t * 1.4) + 0.45 * np.sin(4 * np.pi * f * t) * np.exp(-t * 2.4)
         + 0.2 * np.sin(6 * np.pi * f * t) * np.exp(-t * 3.8) + 0.08 * np.sin(8.02 * np.pi * f * t) * np.exp(-t * 6.0))
    s *= np.minimum(t / 0.008, 1)
    s += filt(rng.normal(0, 1, n), 'bandpass', [900, 3000]) * np.exp(-t * 90) * 0.05
    return s

pattern = [0, 2, 1, 3, 2, 4, 3, 1]
start_arp = 1.0
for k in range(int((TOTAL - start_arp) / 0.5) + 1):
    t0 = start_arp + k * 0.5
    if t0 > TOTAL - 1.2:
        break
    b = int(t0 // BAR)
    note = tones[b % 4][pattern[k % 8]]
    swell = min(1.0, (t0 - start_arp) / 5.0)
    vel = (0.55 + 0.35 * rng.random()) * (0.45 + 0.55 * swell) * (1.0 if k % 8 == 0 else 0.8)
    put(pluck_b, t0 + rng.uniform(0, 0.012), pluck(note), 0.075 * vel, 0.35 * (1 if k % 2 else -1))
    # octave grave de temps en temps
    if k % 8 == 0:
        put(pluck_b, t0, pluck(note / 2, 3.6), 0.05 * vel, -0.1)
pluck_b = filt(pluck_b, 'lowpass', 4200)

# ---- air : souffle très léger ----
air = filt(rng.normal(0, 1, (2, N)), 'bandpass', [600, 3200])
air *= (0.004 + 0.003 * np.sin(2 * np.pi * tt / 9.0 + 1.0))

# ---- événements : cloches de verre (chime), petits tics (tap), souffles de transition ----
CH = [880.0, 987.77, 1174.66, 1318.51, 1567.98, 1760.0]
def chime(n):
    f = CH[n % len(CH)]
    L = int(3.0 * SR); t = tvec(L)
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t * 1.5) + 0.5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 2.8)
         + 0.25 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 5.0))
    return s * np.minimum(t / 0.004, 1)

def tap():
    L = int(0.09 * SR); t = tvec(L)
    return (filt(rng.normal(0, 1, L), 'bandpass', [1800, 5200]) * np.exp(-t * 70) * 0.6 + np.sin(2 * np.pi * 1400 * t) * np.exp(-t * 55) * 0.4)

def breath(dur=1.6):
    L = int(dur * SR); t = tvec(L)
    return filt(rng.normal(0, 1, L), 'bandpass', [400, 2600]) * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2

for ev in tl.get('events', []):
    ty = ev['type']
    if ty == 'chime':
        put(fx_b, ev['t'], chime(ev.get('n', 0)), 0.09, rng.uniform(-0.3, 0.3))
    elif ty == 'tap':
        put(fx_b, ev['t'], tap(), 0.05, rng.uniform(-0.4, 0.4))
for sc in tl['scenes'][1:]:
    put(fx_b, sc['t0'] - 1.0, breath(1.6), 0.05, 0.0)

# ---- reverb longue (plaque douce) ----
irn = int(3.4 * SR); irt = tvec(irn)
wet = np.zeros((2, N))
for c in range(2):
    ir = filt(rng.normal(0, 1, irn), 'lowpass', 5200) * np.exp(-irt * 1.9)
    ir[: int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
    src = pad_b[c] * 0.6 + pluck_b[c] * 1.0 + fx_b[c] * 1.2
    wet[c] = fftconvolve(src, ir)[:N] * 0.0062

mix = pad_b * 0.9 + bass_b + pluck_b * 0.85 + fx_b + wet + air
# fondu d'entrée/sortie
mix *= np.clip(tt / 1.5, 0, 1) * np.clip((TOTAL + 0.3 - tt) / 2.6, 0, 1)
mix = np.tanh(mix * 1.05)
mix *= 0.55 / max(np.abs(mix).max(), 1e-6)
wavfile.write('out/audio.wav', SR, (mix.T * 32767).astype(np.int16))
print(f'audio.wav : {TOTAL + 0.5:.1f} s, pic {np.abs(mix).max():.2f}')
