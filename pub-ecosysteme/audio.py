"""Bande-son de la pub « écosystème » (sans échantillon externe, sans paroles).
Acte 1-2 : tension — tic-tac d'horloge, drone grave, traits de rature (« swish »).
Acte 3-4 : le son s'ouvre — mêmes piano feutré et nappes que la vidéo promo, carillons de verre, résolution finale.
Lit out/timeline.json -> écrit out/audio.wav (stéréo 44,1 kHz)."""
import json
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
tl = json.load(open('out/timeline.json'))
TOTAL = tl['total']
N = int((TOTAL + 0.5) * SR)
rng = np.random.default_rng(23)
tt = np.arange(N) / SR
ev = tl['events']
OPEN = min(e['t'] for e in ev if e['type'] == 'open')          # moment où le son « s'ouvre »


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


# ------------------------------------------------------------ tension : drone grave qui monte, puis s'efface à l'ouverture
drone = np.zeros(N)
env_up = np.clip(tt / (OPEN - 0.3), 0, 1) ** 1.6
env_dn = np.clip((OPEN + 1.6 - tt) / 1.6, 0, 1)
for f, a in ((55.0, 1.0), (55.9, 0.8), (82.41, 0.35), (116.5, 0.18), (123.5, 0.16)):      # La grave, quinte, et un frottement (Si♭ / Si) qui inquiète
    drone += a * np.sin(2 * np.pi * f * tt + rng.uniform(0, 6.28))
drone *= env_up * env_dn * (0.75 + 0.25 * np.sin(2 * np.pi * tt / 3.1))
rumble = filt(rng.normal(0, 1, N), 'lowpass', 220) * env_up * env_dn
# couche médium (Ré / Mi♭ / La / Si♭ : demi-tons qui frottent) pour que la tension s'entende aussi sur un haut-parleur de téléphone
tens = np.zeros(N)
for f, a in ((146.83, 1.0), (155.56, 0.9), (220.0, 0.8), (233.08, 0.75), (329.63, 0.35), (349.23, 0.3)):
    tens += a * np.sin(2 * np.pi * f * tt + rng.uniform(0, 6.28)) * (0.8 + 0.2 * np.sin(2 * np.pi * tt * rng.uniform(0.1, 0.3) + rng.uniform(0, 6.28)))
tens = filt(tens, 'lowpass', 1200) * env_up * env_dn
drone_b = np.stack([drone * 0.10 + rumble * 0.06 + tens * 0.060, drone * 0.10 + rumble * 0.06 + tens * 0.060])


# ------------------------------------------------------------ ouverture : nappes + piano (identiques à la vidéo promo, à partir de OPEN)
BAR = 4.0
bass = [55.0, 43.65, 65.41, 49.0]
pads = [[110.0, 164.81, 246.94, 261.63], [130.81, 174.61, 220.0, 329.63], [196.0, 246.94, 293.66, 329.63], [146.83, 196.0, 246.94, 293.66]]
tones = [[329.63, 440.0, 493.88, 523.25, 659.25], [261.63, 349.23, 440.0, 523.25, 659.25], [329.63, 392.0, 493.88, 587.33, 659.25], [293.66, 392.0, 440.0, 493.88, 587.33]]
pad_b, bass_b, pluck_b, fx_b = bus(), bus(), bus(), bus()

nb_bars = int(np.ceil((TOTAL - OPEN) / BAR)) + 1
for b in range(nb_bars):
    t0 = OPEN + b * BAR - 0.4
    n = int((BAR + 2.6) * SR)
    t = tvec(n)
    e = np.clip(t / 1.8, 0, 1) ** 1.5 * np.clip((BAR + 2.6 - t) / 2.0, 0, 1)
    for f in pads[b % 4]:
        for det in (-0.004, 0.004):
            s = np.sin(2 * np.pi * f * (1 + det) * t) + 0.25 * np.sin(4 * np.pi * f * (1 + det) * t)
            put(pad_b, t0, s * e, 0.05, rng.uniform(-0.7, 0.7))
    nb = int((BAR + 2.0) * SR)
    tb = tvec(nb)
    eb = np.clip(tb / 1.4, 0, 1) ** 1.3 * np.clip((BAR + 2.0 - tb) / 1.8, 0, 1)
    put(bass_b, OPEN + b * BAR - 0.2, np.sin(2 * np.pi * bass[b % 4] * tb) * eb * 0.7, 0.22)
pad_b = filt(pad_b, 'lowpass', 1500)


def pluck(f, dur=3.0):
    n = int(dur * SR)
    t = tvec(n)
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t * 1.4) + 0.45 * np.sin(4 * np.pi * f * t) * np.exp(-t * 2.4)
         + 0.2 * np.sin(6 * np.pi * f * t) * np.exp(-t * 3.8) + 0.08 * np.sin(8.02 * np.pi * f * t) * np.exp(-t * 6.0))
    s *= np.minimum(t / 0.008, 1)
    s += filt(rng.normal(0, 1, n), 'bandpass', [900, 3000]) * np.exp(-t * 90) * 0.05
    return s


pattern = [0, 2, 1, 3, 2, 4, 3, 1]
k = 0
while True:
    t0 = OPEN + 0.25 + k * 0.5
    if t0 > TOTAL - 1.2:
        break
    b = int((t0 - OPEN) // BAR)
    note = tones[b % 4][pattern[k % 8]]
    swell = min(1.0, (t0 - OPEN) / 4.0)
    vel = (0.55 + 0.35 * rng.random()) * (0.4 + 0.6 * swell) * (1.0 if k % 8 == 0 else 0.8)
    put(pluck_b, t0 + rng.uniform(0, 0.012), pluck(note), 0.085 * vel, 0.35 * (1 if k % 2 else -1))
    if k % 8 == 0:
        put(pluck_b, t0, pluck(note / 2, 3.6), 0.055 * vel, -0.1)
    k += 1
pluck_b = filt(pluck_b, 'lowpass', 4200)

air = filt(rng.normal(0, 1, (2, N)), 'bandpass', [600, 3200])
air *= (0.004 + 0.003 * np.sin(2 * np.pi * tt / 9.0 + 1.0)) * np.clip((tt - OPEN + 1.0) / 2.0, 0, 1)


# ------------------------------------------------------------ événements
CH = [880.0, 987.77, 1174.66, 1318.51, 1567.98, 1760.0]


def chime(n, dur=3.0):
    f = CH[n % len(CH)]
    L = int(dur * SR); t = tvec(L)
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t * 1.5) + 0.5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 2.8)
         + 0.25 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 5.0))
    return s * np.minimum(t / 0.004, 1)


def tap():
    L = int(0.09 * SR); t = tvec(L)
    return filt(rng.normal(0, 1, L), 'bandpass', [1800, 5200]) * np.exp(-t * 70) * 0.6 + np.sin(2 * np.pi * 1400 * t) * np.exp(-t * 55) * 0.4


def clock_tick(n):
    """Tic / tac d'horloge : clic sec de bois + résonance courte (le « tac » est plus grave)."""
    L = int(0.14 * SR); t = tvec(L)
    f = 2050.0 if n % 2 == 0 else 1550.0
    click = filt(rng.normal(0, 1, L), 'bandpass', [2200 if n % 2 == 0 else 1600, 6500]) * np.exp(-t * 160)
    body = np.sin(2 * np.pi * f * t) * np.exp(-t * 85) * 0.7 + np.sin(2 * np.pi * f * 0.5 * t) * np.exp(-t * 60) * 0.35
    return (click * 0.9 + body) * np.minimum(t / 0.0006, 1)


def swish(dur=0.30):
    """Trait de rature : souffle filtré qui file de gauche à droite."""
    L = int(dur * SR); t = tvec(L)
    x = np.zeros(L); noise = rng.normal(0, 1, L); chunk = 512
    for i in range(0, L, chunk):
        fc = 700 * (6000 / 700) ** (i / L)
        x[i:i + chunk] = sosfilt(butter(2, [fc * 0.7, min(fc * 1.5, 9000)], btype='bandpass', fs=SR, output='sos'), noise[i:i + chunk])
    return x * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5


def low_note(f, dur=3.4):
    L = int(dur * SR); t = tvec(L)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t * 1.1) + 0.8 * np.sin(4 * np.pi * f * t) * np.exp(-t * 1.6) + 0.55 * np.sin(6 * np.pi * f * t) * np.exp(-t * 2.2) + 0.25 * np.sin(8 * np.pi * f * t) * np.exp(-t * 3.0)
    return s * np.minimum(t / 0.01, 1)


def breath(dur=1.6):
    L = int(dur * SR); t = tvec(L)
    return filt(rng.normal(0, 1, L), 'bandpass', [400, 2600]) * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2


tick_b = bus()
for e in ev:
    ty, t0, n = e['type'], e['t'], e.get('n', 0)
    if ty == 'tick':
        put(tick_b, t0, clock_tick(n), 0.55, rng.uniform(-0.15, 0.15))
    elif ty == 'swish':
        put(fx_b, t0, swish(), 0.13, rng.uniform(-0.3, 0.3))
    elif ty == 'low':
        put(fx_b, t0, low_note(110.0 if n == 0 else 82.41), 0.20, 0.0)
    elif ty == 'chime':
        put(fx_b, t0, chime(n), 0.10, rng.uniform(-0.3, 0.3))
    elif ty == 'tap':
        put(fx_b, t0, tap(), 0.05, rng.uniform(-0.4, 0.4))
    elif ty == 'open':
        put(fx_b, t0 - 0.5, breath(1.8), 0.09, 0.0)                    # grande inspiration juste avant l'ouverture
    elif ty == 'resolve':
        for j, nn in enumerate((0, 2, 3, 5)):                             # accord de carillons qui résout la tension
            put(fx_b, t0 + 0.04 * j, chime(nn, 4.0), 0.085, (-0.5, -0.15, 0.2, 0.5)[j])
        put(fx_b, t0, low_note(110.0, 4.5), 0.12, 0.0)
for sc in tl['scenes'][1:]:
    put(fx_b, sc['t0'] - 0.9, breath(1.4), 0.04, 0.0)

# ------------------------------------------------------------ reverb longue (plaque douce)
irn = int(3.4 * SR); irt = tvec(irn)
wet = np.zeros((2, N))
for c in range(2):
    ir = filt(rng.normal(0, 1, irn), 'lowpass', 5200) * np.exp(-irt * 1.9)
    ir[: int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
    src = pad_b[c] * 0.6 + pluck_b[c] * 1.0 + fx_b[c] * 1.2 + tick_b[c] * 0.15 + drone_b[c] * 0.2
    wet[c] = fftconvolve(src, ir)[:N] * 0.0062

mix = drone_b + tick_b + pad_b * 0.9 + bass_b + pluck_b * 0.85 + fx_b + wet + air
mix *= np.clip(tt / 0.5, 0, 1) * np.clip((TOTAL + 0.3 - tt) / 2.6, 0, 1)
mix = np.tanh(mix * 1.05)
mix *= 0.8 / max(np.abs(mix).max(), 1e-6)
wavfile.write('out/audio_brut.wav', SR, (mix.T * 32767).astype(np.int16))

# niveau final : -14 LUFS (réseaux sociaux), crête -1,5 dB — mesure puis application linéaire
import subprocess, re
m = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', 'out/audio_brut.wav', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
j = json.loads(m[m.rindex('{'):])
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', 'out/audio_brut.wav', '-af',
                f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true",
                '-ar', str(SR), 'out/audio.wav'], check=True)
print(f"audio.wav : {TOTAL + 0.5:.1f} s, ouverture à {OPEN:.1f} s, mesuré {float(j['input_i']):.1f} LUFS -> -14 LUFS")
