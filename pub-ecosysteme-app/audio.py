"""Bande-son de la pub « animation d'application » (sans échantillon externe, sans paroles).
Montée de tension avant l'éclatement de la marque, puis pouls doux, nappes, arpège feutré, et des bruitages d'interface
calés sur l'animation : pops de pastilles, clics de frappe, coches qui montent en hauteur, cloches de verre, impacts.
Lit out/timeline.json -> écrit out/audio.wav (stéréo 44,1 kHz, -14 LUFS)."""
import json, subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, sosfilt_zi, fftconvolve

SR = 44100
tl = json.load(open('out/timeline.json'))
TOTAL = tl['total']
N = int((TOTAL + 0.6) * SR)
rng = np.random.default_rng(31)
tt = np.arange(N) / SR
EV = tl['events']
SH = tl.get('shift', 0.0)                                   # durée de l'ouverture « Arrête de procrastiner »
BURST, END = tl.get('burst', 1.78), tl.get('end', 17.85)
BPM = 120; BEAT = 60.0 / BPM


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


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# ------------------------------------------------------------ sons de base
def pluck(f, dur=1.4, bright=3800):
    n = int(dur * SR); t = tvec(n)
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t * 3.2) + 0.5 * np.sin(4 * np.pi * f * t) * np.exp(-t * 5.0)
         + 0.25 * np.sin(6 * np.pi * f * t) * np.exp(-t * 7.5) + 0.12 * np.sign(np.sin(2 * np.pi * f * t)) * np.exp(-t * 14))
    s = filt(s, 'lowpass', bright)
    return s * np.minimum(t / 0.004, 1)


def bell(f, dur=2.6):
    n = int(dur * SR); t = tvec(n)
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t * 1.7) + 0.5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 3.0)
         + 0.25 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 5.5))
    return s * np.minimum(t / 0.003, 1)


def kick(vol=1.0):
    n = int(0.36 * SR); t = tvec(n)
    f = 44 + 120 * np.exp(-t / 0.03)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16) + 0.3 * rng.standard_normal(n) * np.exp(-t / 0.004)
    return np.tanh(x * 1.4) * vol


def hat():
    n = int(0.05 * SR); t = tvec(n)
    return filt(rng.standard_normal(n), 'high', 8000) * np.exp(-t / 0.012)


def noise_sweep(dur, f0, f1, shape=1.5):
    n = int(dur * SR); x = np.zeros(n); noise = rng.standard_normal(n); chunk = 512; zi = None
    for i in range(0, n, chunk):
        fc = f0 * (f1 / f0) ** (i / n)
        sos = butter(2, [fc * 0.7, min(fc * 1.6, SR / 2 - 200)], btype='bandpass', fs=SR, output='sos')
        if zi is None:
            zi = sosfilt_zi(sos) * 0
        y, zi = sosfilt(sos, noise[i:i + chunk], zi=zi); x[i:i + chunk] = y
    return x * np.sin(np.pi * np.clip(np.arange(n) / n, 0, 1)) ** shape


def pop(f0=620):
    n = int(0.22 * SR); t = tvec(n)
    f = f0 + 520 * (1 - np.exp(-t / 0.03))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.06) + 0.3 * np.sin(4 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.03)
    return s * np.minimum(t / 0.002, 1)


def impact(vol=1.0):
    n = int(2.2 * SR); t = tvec(n)
    f = 36 + 130 * np.exp(-t / 0.07)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.6)
    nz = filt(rng.standard_normal(n), 'low', 1600) * np.exp(-t / 0.3)
    hi = filt(rng.standard_normal(n), 'high', 4500) * np.exp(-t / 0.8) * 0.2
    return np.tanh((x * 1.2 + nz * 0.5 + hi) * 1.3) * vol


def punch(n):
    L = int(0.5 * SR); t = tvec(L)
    f = (70 + 12 * n) + 90 * np.exp(-t / 0.04)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.14)
    x += 0.45 * filt(rng.standard_normal(L), 'bandpass', [1500, 6000]) * np.exp(-t / 0.02)
    return np.tanh(x * 1.3)


def type_click():
    L = int(0.03 * SR); t = tvec(L)
    return (filt(rng.standard_normal(L), 'bandpass', [2400, 7000]) * np.exp(-t / 0.006) + np.sin(2 * np.pi * (2600 + 400 * rng.random()) * t) * np.exp(-t / 0.005) * 0.5)


def tick():
    L = int(0.12 * SR); t = tvec(L)
    return filt(rng.standard_normal(L), 'bandpass', [1800, 6500]) * np.exp(-t / 0.02) + np.sin(2 * np.pi * 1700 * t) * np.exp(-t / 0.03) * 0.5


def tap():
    L = int(0.09 * SR); t = tvec(L)
    return filt(rng.standard_normal(L), 'bandpass', [900, 3200]) * np.exp(-t / 0.014) + np.sin(2 * np.pi * 220 * t) * np.exp(-t / 0.03) * 0.6


PENTA = [72, 74, 76, 79, 81, 84, 86]            # Do Ré Mi Sol La do Ré : les coches montent


# ------------------------------------------------------------ montée avant l'éclatement + nappes de tension
tens_b = bus()
a0, a1 = 0.0, BURST
env = np.clip(tt / BURST, 0, 1) ** 1.7 * (tt < BURST + 0.05)
sub = np.sin(2 * np.pi * 55 * tt) + 0.7 * np.sin(2 * np.pi * 82.4 * tt) + 0.5 * np.sin(2 * np.pi * 110 * tt) + 0.4 * np.sin(2 * np.pi * 220 * tt * (1 + 0.5 * tt / BURST))
tens_b += np.stack([sub * env * 0.10, sub * env * 0.10])

# ------------------------------------------------------------ nappes, basse, arpège à partir de l'éclatement
pad_b, bass_b, arp_b, drum_b, fx_b, send_b = bus(), bus(), bus(), bus(), bus(), bus()
PADS = [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 64, 67], [55, 59, 62, 64]]       # Am7 Fmaj7 Cmaj7 G6
ROOTS = [33, 29, 36, 31]
BAR = 4 * BEAT
t0 = BURST
nbar = int(np.ceil((TOTAL - t0) / BAR)) + 1
for b in range(nbar):
    ts = t0 + b * BAR
    n = int((BAR + 1.6) * SR); t = tvec(n); e = np.clip(t / 0.9, 0, 1) ** 1.4 * np.clip((BAR + 1.6 - t) / 1.2, 0, 1)
    quiet = 0.55 if (ts > END - 1) else 1.0
    for m in PADS[b % 4]:
        f = midi(m)
        for d in (-0.004, 0.004):
            s = np.sin(2 * np.pi * f * (1 + d) * t) + 0.3 * np.sin(4 * np.pi * f * (1 + d) * t)
            put(pad_b, ts, s * e, 0.035 * quiet, rng.uniform(-0.7, 0.7))
    for k in range(8):
        tb = ts + k * BEAT / 2
        if tb < 3.3 + SH or tb > TOTAL:
            continue
        nb = int(BEAT * 0.9 * SR); tv_ = tvec(nb); f = midi(ROOTS[b % 4] + (12 if k in (3, 7) else 0))
        s = np.sin(2 * np.pi * f * tv_) + 0.35 * np.sin(4 * np.pi * f * tv_)
        put(bass_b, tb, s * np.exp(-tv_ / 0.28) * np.minimum(tv_ / 0.006, 1), 0.20, 0.0)
pad_b = filt(pad_b, 'lowpass', 1800)

ARPN = [[69, 72, 76, 79, 81, 79, 76, 72], [65, 69, 72, 76, 77, 76, 72, 69], [67, 72, 76, 79, 83, 79, 76, 72], [67, 71, 74, 79, 81, 79, 74, 71]]
k = 0
while True:
    tt0 = 3.3 + SH + k * BEAT / 2
    if tt0 > END + 3.2:
        break
    b = int((tt0 - BURST) // BAR) % 4
    note = ARPN[b][k % 8]
    swell = min(1.0, (tt0 - 3.3 - SH) / 3.0) * (0.8 if tt0 > END - 0.5 else 1.0)
    g = 0.11 * swell * (1.0 if k % 4 == 0 else 0.7)
    s = pluck(midi(note))
    put(arp_b, tt0, s, g, 0.4 * (1 if k % 2 else -1))
    put(send_b, tt0, s, g * 0.9, -0.4 * (1 if k % 2 else -1))
    k += 1

# batterie douce : pouls de la carte jusqu'à la fin de la démo
kick_times = []
t = 3.3 + SH
while t < END - 0.2:
    put(drum_b, t, kick(0.8), 0.7); kick_times.append(t)
    t += BEAT
t = 5.15 + SH + BEAT / 2
while t < END - 0.5:
    put(drum_b, t, hat(), 0.09, 0.2); t += BEAT


# ------------------------------------------------------------ événements d'interface
for e in EV:
    ty, t_, n = e['type'], e['t'], e.get('n', 0)
    pan = float(np.clip(rng.normal(0, 0.25), -0.5, 0.5))
    if ty == 'pop':
        put(fx_b, t_, pop(560 + 40 * (int(t_ * 10) % 5)), 0.34, pan)
    elif ty == 'swish':
        put(fx_b, t_, noise_sweep(0.3, 800, 6500), 0.14, pan)
    elif ty == 'impact':
        put(fx_b, t_, impact(), 0.80, 0.0)
        for j, m in enumerate((81, 84, 88)):
            put(send_b, t_ + 0.02 * j, bell(midi(m), 3.0), 0.05, (-0.4, 0, 0.4)[j])
    elif ty == 'shimmer':
        for j, m in enumerate((88, 91, 95, 100, 103)):
            put(fx_b, t_ + 0.06 * j, bell(midi(m), 2.2), 0.045, (-0.6, -0.2, 0.2, 0.5, 0.0)[j])
            put(send_b, t_ + 0.06 * j, bell(midi(m), 2.2), 0.05, (0.6, 0.2, -0.2, -0.5, 0.0)[j])
    elif ty == 'whoosh':
        put(fx_b, t_, noise_sweep(0.55, 400, 4200), 0.20, pan)
    elif ty == 'sweep':
        L = int(0.9 * SR); tv_ = tvec(L); f = 300 * (1400 / 300) ** (tv_ / 0.9)
        put(fx_b, t_, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * np.clip(tv_ / 0.9, 0, 1)) ** 1.5 * 0.5, 0.16, 0.0)
    elif ty == 'hit':
        put(fx_b, t_, punch(0), 0.55, 0.0)
    elif ty == 'punch':
        put(fx_b, t_, punch(n), 0.60, 0.0)
        put(fx_b, t_ - 0.02, noise_sweep(0.35, 500, 5000, 0.9), 0.10, 0.0)
    elif ty == 'type':
        put(fx_b, t_, type_click(), 0.20, pan)
    elif ty == 'check':
        m = PENTA[min(n, len(PENTA) - 1)]
        s = bell(midi(m), 1.6); put(fx_b, t_, s * 0.9, 0.10, pan); put(send_b, t_, s, 0.08, -pan)
        put(fx_b, t_, tick(), 0.12, pan)
    elif ty == 'press':
        put(fx_b, t_, tap(), 0.40, 0.0)
    elif ty == 'ding':
        m = PENTA[min(n, len(PENTA) - 1)] + 12
        s = bell(midi(m), 2.6); put(fx_b, t_, s, 0.12, pan); put(send_b, t_, s, 0.10, -pan)
    elif ty == 'tick':
        put(fx_b, t_, tick(), 0.30, 0.0)
        put(fx_b, t_, bell(midi(PENTA[n + 2]), 1.2), 0.06, 0.0)
for a, b_ in tl.get('risers', []):
    put(fx_b, a, noise_sweep(b_ - a, 300, 7000, 2.2) * np.linspace(0.2, 1, int((b_ - a) * SR)) ** 1.6, 0.18, 0.0)

# ------------------------------------------------------------ compression par le pouls (sidechain) sur les nappes / basse / arpège
g = np.ones(N)
for kt in kick_times:
    i = int(kt * SR); seg = np.exp(-np.arange(min(N - i, int(0.32 * SR))) / (SR * 0.10))
    g[i:i + len(seg)] = np.minimum(g[i:i + len(seg)], 1 - 0.38 * seg)
pad_b *= g; bass_b *= g; arp_b *= (0.5 + 0.5 * g)

# ------------------------------------------------------------ reverb plaque
irn = int(2.6 * SR); irt = tvec(irn)
wet = np.zeros((2, N))
for c in range(2):
    ir = filt(rng.standard_normal(irn), 'lowpass', 6000) * np.exp(-irt * 2.3)
    ir[: int(0.015 * SR)] *= np.linspace(0, 1, int(0.015 * SR))
    src = pad_b[c] * 0.5 + arp_b[c] * 0.8 + fx_b[c] * 0.5 + send_b[c] * 1.2
    wet[c] = fftconvolve(src, ir)[:N] * 0.012

mix = tens_b + pad_b + bass_b + arp_b + drum_b + fx_b + send_b * 0.5 + wet
mix *= np.clip(tt / 0.15, 0, 1) * np.clip((TOTAL + 0.5 - tt) / 1.6, 0, 1)
mix = filt(mix, 'high', 24)
mix = np.tanh(mix * 1.1)
mix *= 0.8 / max(np.abs(mix).max(), 1e-6)
wavfile.write('out/audio_brut.wav', SR, (mix.T * 32767).astype(np.int16))

# niveau final : -14 LUFS, crête -1,5 dB (mesure puis application linéaire)
m = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', 'out/audio_brut.wav', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
j = json.loads(m[m.rindex('{'):])
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', 'out/audio_brut.wav', '-af',
                f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true",
                '-ar', str(SR), 'out/audio.wav'], check=True)
print(f"audio.wav : {TOTAL + 0.6:.1f} s, mesuré {float(j['input_i']):.1f} LUFS -> -14 LUFS")
