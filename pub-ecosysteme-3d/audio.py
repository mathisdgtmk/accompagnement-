"""Bande-son de la pub 3D (sans échantillon externe, sans paroles) : tension d'horloge pendant la liste « à faire »,
chute à 4,0 s (impact), puis pouls, nappes, basse et arpège ; bruitages d'interface calés sur l'image (frappes de clavier,
coches qui montent, carte qui se dresse, trait de lumière) ; résolution quand le logo s'allume.
Lit out/timeline.json -> écrit out/audio.wav (stéréo 44,1 kHz, -14 LUFS)."""
import json, subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, sosfilt_zi, fftconvolve

SR = 44100
tl = json.load(open('out/timeline.json'))
TOTAL = tl['total']; N = int((TOTAL + 0.6) * SR)
rng = np.random.default_rng(41); tt = np.arange(N) / SR
EV = tl['events']; BEAT = 0.5; BAR = 2.0
DROP = 4.3; LOGO = tl['logo'][0]; BTN = tl['button']


def bus(): return np.zeros((2, N))
def put(b, start, sig, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= N or i < 0: return
    seg = sig[: N - i]; b[0, i:i + len(seg)] += seg * gain * np.cos((pan + 1) * np.pi / 4); b[1, i:i + len(seg)] += seg * gain * np.sin((pan + 1) * np.pi / 4)
def filt(x, kind, fc, order=2): return sosfilt(butter(order, fc, btype=kind, fs=SR, output='sos'), x, axis=-1)
def tvec(n): return np.arange(n) / SR
def midi(m): return 440.0 * 2 ** ((m - 69) / 12)


def pluck(f, dur=1.4, bright=3800):
    n = int(dur * SR); t = tvec(n)
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t * 3.2) + 0.5 * np.sin(4 * np.pi * f * t) * np.exp(-t * 5.0) + 0.25 * np.sin(6 * np.pi * f * t) * np.exp(-t * 7.5) + 0.12 * np.sign(np.sin(2 * np.pi * f * t)) * np.exp(-t * 14))
    return filt(s, 'lowpass', bright) * np.minimum(t / 0.004, 1)
def bell(f, dur=2.6):
    n = int(dur * SR); t = tvec(n)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t * 1.7) + 0.5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 3.0) + 0.25 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 5.5)
    return s * np.minimum(t / 0.003, 1)
def kick(vol=1.0):
    n = int(0.36 * SR); t = tvec(n); f = 44 + 120 * np.exp(-t / 0.03)
    return np.tanh((np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16) + 0.3 * rng.standard_normal(n) * np.exp(-t / 0.004)) * 1.4) * vol
def hat(open_=False):
    n = int((0.16 if open_ else 0.05) * SR); t = tvec(n); return filt(rng.standard_normal(n), 'high', 8000) * np.exp(-t / (0.06 if open_ else 0.012))
def clap():
    n = int(0.3 * SR); t = tvec(n); x = filt(filt(rng.standard_normal(n), 'high', 900), 'low', 5200); env = np.exp(-t / 0.08)
    for k in (0.011, 0.022): env += 0.4 * np.exp(-np.clip(t - k, 0, None) / 0.07) * (t >= k)
    return x * env * 0.8
def noise_sweep(dur, f0, f1, shape=1.5):
    n = int(dur * SR); x = np.zeros(n); noise = rng.standard_normal(n); chunk = 512; zi = None
    for i in range(0, n, chunk):
        fc = f0 * (f1 / f0) ** (i / n); sos = butter(2, [fc * 0.7, min(fc * 1.6, SR / 2 - 200)], btype='bandpass', fs=SR, output='sos')
        if zi is None: zi = sosfilt_zi(sos) * 0
        y, zi = sosfilt(sos, noise[i:i + chunk], zi=zi); x[i:i + chunk] = y
    return x * np.sin(np.pi * np.clip(np.arange(n) / n, 0, 1)) ** shape
def pop(f0=620):
    n = int(0.22 * SR); t = tvec(n); f = f0 + 520 * (1 - np.exp(-t / 0.03)); ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-t / 0.06) + 0.3 * np.sin(2 * ph) * np.exp(-t / 0.03)) * np.minimum(t / 0.002, 1)
def impact(vol=1.0):
    n = int(2.2 * SR); t = tvec(n); f = 36 + 130 * np.exp(-t / 0.07)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.6) * 1.2 + filt(rng.standard_normal(n), 'low', 1600) * np.exp(-t / 0.3) * 0.5 + filt(rng.standard_normal(n), 'high', 4500) * np.exp(-t / 0.8) * 0.2
    return np.tanh(x * 1.3) * vol
def type_click():
    L = int(0.03 * SR); t = tvec(L); return filt(rng.standard_normal(L), 'bandpass', [2400, 7000]) * np.exp(-t / 0.006) + np.sin(2 * np.pi * (2600 + 400 * rng.random()) * t) * np.exp(-t / 0.005) * 0.5
def tick():
    L = int(0.12 * SR); t = tvec(L); return filt(rng.standard_normal(L), 'bandpass', [1800, 6500]) * np.exp(-t / 0.02) + np.sin(2 * np.pi * 1700 * t) * np.exp(-t / 0.03) * 0.5
def clock(n):
    L = int(0.14 * SR); t = tvec(L); f = 2050.0 if n % 2 == 0 else 1550.0
    return (filt(rng.standard_normal(L), 'bandpass', [2200 if n % 2 == 0 else 1600, 6500]) * np.exp(-t * 160) * 0.9 + np.sin(2 * np.pi * f * t) * np.exp(-t * 85) * 0.7 + np.sin(np.pi * f * t) * np.exp(-t * 60) * 0.35) * np.minimum(t / 0.0006, 1)
def scratch():
    L = int(0.20 * SR); t = tvec(L); x = filt(rng.standard_normal(L), 'bandpass', [2500, 8000]) * np.sin(np.pi * np.clip(t / 0.2, 0, 1)) ** 0.7
    return x * 0.8 + np.sin(2 * np.pi * 180 * t) * np.exp(-t / 0.05) * 0.5
def tap():
    L = int(0.09 * SR); t = tvec(L); return filt(rng.standard_normal(L), 'bandpass', [900, 3200]) * np.exp(-t / 0.014) + np.sin(2 * np.pi * 220 * t) * np.exp(-t / 0.03) * 0.6
def zing(dur=0.9):
    L = int(dur * SR); t = tvec(L); f = 380 * (2600 / 380) ** (t / dur); ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) + 0.5 * np.sin(2 * ph + 0.4)) * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.2 * 0.5
def punch(n=0):
    L = int(0.5 * SR); t = tvec(L); f = (70 + 12 * n) + 90 * np.exp(-t / 0.04)
    return np.tanh((np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.14) + 0.45 * filt(rng.standard_normal(L), 'bandpass', [1500, 6000]) * np.exp(-t / 0.02)) * 1.3)
PENTA = [72, 74, 76, 79, 81, 84, 86]


tens_b, pad_b, bass_b, arp_b, drum_b, fx_b, send_b, clock_b = (bus() for _ in range(8))
# ---- tension : drone grave + frottement + montée jusqu'à la chute
env_up = np.clip(tt / DROP, 0, 1) ** 1.6 * (tt < DROP + 0.04)
drone = sum(a * np.sin(2 * np.pi * f * tt + rng.uniform(0, 6.28)) for f, a in ((55.0, 1.0), (55.9, 0.8), (82.41, 0.35), (116.5, 0.18), (123.5, 0.16)))
tens = filt(sum(a * np.sin(2 * np.pi * f * tt + rng.uniform(0, 6.28)) for f, a in ((146.83, 1.0), (155.56, 0.9), (220.0, 0.8), (233.08, 0.75), (329.63, 0.3))), 'lowpass', 1200)
rumble = filt(rng.standard_normal(N), 'lowpass', 220)
tens_b += np.stack([drone * env_up * 0.10 + rumble * env_up * 0.05 + tens * env_up * 0.045] * 2)
# horloge : tic-tac irrégulier qui s'accélère (procrastination qui tourne en rond)
for k, t_ in enumerate(np.arange(0.5, DROP - 0.2, 0.5)): put(clock_b, t_, clock(k), 0.38 * (0.5 + 0.5 * t_ / DROP), 0.0)
# ---- groove à partir de la chute
PADS = [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 64, 67], [55, 59, 62, 64]]; ROOTS = [33, 29, 36, 31]
END_GROOVE = LOGO - 0.1
nbar = int(np.ceil((TOTAL - DROP) / BAR)) + 1
for b in range(nbar):
    ts = DROP + b * BAR; n = int((BAR + 1.6) * SR); t = tvec(n); e = np.clip(t / 0.9, 0, 1) ** 1.4 * np.clip((BAR + 1.6 - t) / 1.2, 0, 1)
    soft = 0.6 if ts >= END_GROOVE else 1.0
    for m in PADS[b % 4]:
        f = midi(m)
        for d in (-0.004, 0.004): put(pad_b, ts, (np.sin(2 * np.pi * f * (1 + d) * t) + 0.3 * np.sin(4 * np.pi * f * (1 + d) * t)) * e, 0.035 * soft, rng.uniform(-0.7, 0.7))
    for k in range(4):
        tb = ts + k * BEAT
        if tb >= TOTAL: break
        nb = int(BEAT * 0.9 * SR); tv_ = tvec(nb); f = midi(ROOTS[b % 4] + (12 if k == 3 else 0))
        put(bass_b, tb, (np.sin(2 * np.pi * f * tv_) + 0.35 * np.sin(4 * np.pi * f * tv_)) * np.exp(-tv_ / 0.28) * np.minimum(tv_ / 0.006, 1), 0.22 * soft, 0.0)
pad_b = filt(pad_b, 'lowpass', 1800)
ARPN = [[69, 72, 76, 79, 81, 79, 76, 72], [65, 69, 72, 76, 77, 76, 72, 69], [67, 72, 76, 79, 83, 79, 76, 72], [67, 71, 74, 79, 81, 79, 74, 71]]
k = 0
while True:
    t0 = DROP + k * BEAT / 2
    if t0 > TOTAL - 0.6: break
    b = int((t0 - DROP) // BAR) % 4; swell = min(1.0, 0.4 + (t0 - DROP) / 4.0) * (0.75 if t0 > END_GROOVE else 1.0); g = 0.11 * swell * (1.0 if k % 4 == 0 else 0.7)
    s = pluck(midi(ARPN[b][k % 8])); put(arp_b, t0, s, g, 0.4 * (1 if k % 2 else -1)); put(send_b, t0, s, g * 0.9, -0.4 * (1 if k % 2 else -1)); k += 1
kick_times = []
t = DROP
while t < END_GROOVE - 0.2: put(drum_b, t, kick(0.8), 0.7); kick_times.append(t); t += BEAT
t = DROP + BAR
while t < END_GROOVE - 0.4: put(drum_b, t - 0.0 + BEAT, clap(), 0.25, 0.1); t += BAR
t = DROP + BEAT / 2
while t < END_GROOVE - 0.4: put(drum_b, t, hat(), 0.09, 0.2); t += BEAT
t = 12.0
while t < END_GROOVE - 0.4: put(drum_b, t + BEAT / 4, hat(), 0.05, -0.2); put(drum_b, t + 3 * BEAT / 4, hat(), 0.05, 0.2); t += BEAT
# un seul coup de grosse caisse par mesure dans le final
t = END_GROOVE + 0.3
while t < TOTAL - 1.0: put(drum_b, t, kick(0.5), 0.5); kick_times.append(t); t += BAR

# ---- événements d'interface
for e in EV:
    ty, t_, n = e['type'], e['t'], e.get('n', 0); pan = float(np.clip(rng.normal(0, 0.25), -0.5, 0.5))
    if ty == 'pop': put(fx_b, t_, pop(560 + 40 * (int(t_ * 10) % 5)), 0.34, pan)
    elif ty == 'tick': put(fx_b, t_, tick(), 0.18, pan)
    elif ty == 'strike': put(fx_b, t_, scratch(), 0.30, pan); put(fx_b, t_ + 0.18, tap(), 0.16, pan)
    elif ty == 'impact':
        put(fx_b, t_, impact(), 0.85, 0.0)
        for j, m in enumerate((81, 84, 88)): put(send_b, t_ + 0.02 * j, bell(midi(m), 3.0), 0.05, (-0.4, 0, 0.4)[j])
    elif ty == 'shimmer':
        for j, m in enumerate((88, 91, 95, 100, 103)):
            put(fx_b, t_ + 0.06 * j, bell(midi(m), 2.2), 0.05, (-0.6, -0.2, 0.2, 0.5, 0.0)[j]); put(send_b, t_ + 0.06 * j, bell(midi(m), 2.2), 0.06, (0.6, 0.2, -0.2, -0.5, 0.0)[j])
        put(fx_b, t_, impact(0.9), 0.55, 0.0)
    elif ty == 'whoosh': put(fx_b, t_, noise_sweep(0.55, 400, 4200), 0.24, pan)
    elif ty == 'zing': put(fx_b, t_, zing(), 0.22, 0.0); put(send_b, t_, bell(midi(96), 1.6), 0.05, 0.3)
    elif ty == 'type': put(fx_b, t_, type_click(), 0.20, pan)
    elif ty == 'check':
        m = PENTA[min(n, len(PENTA) - 1)]; s = bell(midi(m), 1.6); put(fx_b, t_, s * 0.9, 0.10, pan); put(send_b, t_, s, 0.08, -pan); put(fx_b, t_, tick(), 0.12, pan)
    elif ty == 'press': put(fx_b, t_, tap(), 0.42, 0.0)
    elif ty == 'ding':
        s = bell(midi(PENTA[min(n, len(PENTA) - 1)] + 12), 2.6); put(fx_b, t_, s, 0.12, pan); put(send_b, t_, s, 0.10, -pan)
    elif ty == 'cardpop':
        put(fx_b, t_ - 0.12, noise_sweep(0.3, 600, 5000, 0.9), 0.14, 0.0); put(fx_b, t_, punch(2), 0.5, 0.0)
        for j, m in enumerate((76, 79, 83)): put(send_b, t_ + 0.05 * j, bell(midi(m), 2.0), 0.07, (-0.3, 0.0, 0.3)[j])
for a, b_ in tl.get('risers', []): put(fx_b, a, noise_sweep(b_ - a, 300, 7000, 2.2) * np.linspace(0.2, 1, int((b_ - a) * SR)) ** 1.6, 0.20, 0.0)
# accord final de résolution quand le logo s'allume
for m, pn in zip((57, 60, 64, 69, 72, 76), (-0.4, -0.2, 0, 0.2, 0.4, 0.0)): put(arp_b, LOGO, pluck(midi(m), 3.0, 3200), 0.10, pn); put(send_b, LOGO, pluck(midi(m), 3.0, 3200), 0.12, -pn)
put(bass_b, LOGO, np.sin(2 * np.pi * midi(33) * tvec(int(3.2 * SR))) * np.exp(-tvec(int(3.2 * SR)) / 1.2), 0.30, 0.0)

# ---- compression par le pouls et mixage
g = np.ones(N)
for kt in kick_times:
    i = int(kt * SR); seg = np.exp(-np.arange(min(N - i, int(0.32 * SR))) / (SR * 0.10)); g[i:i + len(seg)] = np.minimum(g[i:i + len(seg)], 1 - 0.38 * seg)
pad_b *= g; bass_b *= g; arp_b *= (0.5 + 0.5 * g)
irn = int(2.6 * SR); irt = tvec(irn); wet = np.zeros((2, N))
for c in range(2):
    ir = filt(rng.standard_normal(irn), 'lowpass', 6000) * np.exp(-irt * 2.3); ir[: int(0.015 * SR)] *= np.linspace(0, 1, int(0.015 * SR))
    wet[c] = fftconvolve(pad_b[c] * 0.5 + arp_b[c] * 0.8 + fx_b[c] * 0.5 + send_b[c] * 1.2 + clock_b[c] * 0.2, ir)[:N] * 0.012
mix = tens_b + clock_b + pad_b + bass_b + arp_b + drum_b + fx_b + send_b * 0.5 + wet
mix *= np.clip(tt / 0.15, 0, 1) * np.clip((TOTAL + 0.5 - tt) / 1.6, 0, 1)
mix = np.tanh(filt(mix, 'high', 24) * 1.1); mix *= 0.8 / max(np.abs(mix).max(), 1e-6)
wavfile.write('out/audio_brut.wav', SR, (mix.T * 32767).astype(np.int16))
m = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', 'out/audio_brut.wav', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
j = json.loads(m[m.rindex('{'):])
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', 'out/audio_brut.wav', '-af', f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true", '-ar', str(SR), 'out/audio.wav'], check=True)
print(f"audio.wav : {TOTAL + 0.6:.1f} s, mesuré {float(j['input_i']):.1f} LUFS -> -14 LUFS")
