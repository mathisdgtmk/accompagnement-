"""Assemblage : vidéo sans son + musique/bruitages (+ voix off française) -> MP4 finaux (-14 LUFS).
    python3 assemble.py            # écrit out/pub_laser_photos_9x16.mp4 (avec voix) et ..._sans_voix.mp4"""
import os, subprocess, wave
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, resample_poly
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'out'); VOIX = os.path.join(HERE, 'voix')
SR = 48000
VO = [('hook', 0.15), ('jaune', 2.05), ('bleu', 3.05), ('vert', 4.05), ('rouge', 5.05), ('duo', 6.12), ('qui', 7.30),
      ('touche', 9.12), ('cta', 12.30)]
VOICE_RMS_DB = -15.0; DUCK_DB = -6.0; MUSIC_DB_WITH_VOICE = -5.0

def load_voice(name):
    w = wave.open(os.path.join(VOIX, name + '.wav')); sr = w.getframerate()
    x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    x = resample_poly(x, SR, sr).astype(np.float32)
    nz = np.where(np.abs(x) > 10 ** (-42 / 20) * np.abs(x).max())[0]
    x = x[max(0, nz[0] - int(0.01 * SR)):nz[-1] + int(0.04 * SR)]
    hp = butter(2, 80, 'high', fs=SR, output='sos'); x = sosfilt(hp, x)
    pres = sosfilt(butter(2, [2200, 4800], 'band', fs=SR, output='sos'), x); x = x + 0.45 * pres      # présence
    act = np.abs(x) > 0.05 * np.abs(x).max(); x *= 10 ** (VOICE_RMS_DB / 20) / np.sqrt((x[act] ** 2).mean())
    pk = np.abs(x).max(); x = x * (0.9 / pk) if pk > 0.9 else x
    f = int(0.01 * SR); x[:f] *= np.linspace(0, 1, f); x[-f:] *= np.linspace(1, 0, f)
    return x

def env(n, spans, att=0.08, rel=0.25):
    e = np.zeros(n, np.float32)
    for a, b in spans:
        ia, ib = max(0, int(a * SR)), min(n, int(b * SR)); seg = np.ones(ib - ia, np.float32)
        ra, rb = int(att * SR), int(rel * SR)
        seg[:ra] = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, ra)); seg[-rb:] = np.minimum(seg[-rb:], 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, rb)))
        e[ia:ib] = np.maximum(e[ia:ib], seg)
    return e

def loudnorm(raw, wav):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', raw, '-af',
                    'loudnorm=I=-14:TP=-1.5:LRA=9', '-ar', str(SR), wav], check=True)

def mux(video, wav, out):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '21',
                    '-maxrate', '9M', '-bufsize', '18M', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709',
                    '-color_trc', 'bt709', '-color_range', 'tv', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', out], check=True)

if __name__ == '__main__':
    sr, m = wavfile.read(os.path.join(OUT, 'music.wav')); m = m.astype(np.float32) / 32768; n = len(m)
    video = os.path.join(OUT, 'video_sans_son.mp4')
    # 1) sans voix
    m.astype(np.float32).tofile(os.path.join(OUT, '_sv.f32')); loudnorm(os.path.join(OUT, '_sv.f32'), os.path.join(OUT, 'audio_sans_voix.wav'))
    mux(video, os.path.join(OUT, 'audio_sans_voix.wav'), os.path.join(OUT, 'pub_laser_photos_9x16_sans_voix.mp4'))
    # 2) avec voix off
    voice = np.zeros(n, np.float32); spans = []
    for name, t in VO:
        v = load_voice(name); i = int(t * SR); voice[i:i + len(v)] += v[:n - i]; spans.append((t - 0.05, t + len(v) / SR + 0.10))
    duck = env(n, spans)
    bed = m * 10 ** (MUSIC_DB_WITH_VOICE / 20) * (1 - (1 - 10 ** (DUCK_DB / 20)) * duck)[:, None]
    mix = np.tanh((bed + voice[:, None]) * 0.9) / np.tanh(0.9)
    mix.astype(np.float32).tofile(os.path.join(OUT, '_v.f32')); loudnorm(os.path.join(OUT, '_v.f32'), os.path.join(OUT, 'audio_avec_voix.wav'))
    mux(video, os.path.join(OUT, 'audio_avec_voix.wav'), os.path.join(OUT, 'pub_laser_photos_9x16.mp4'))
    for f in ('_sv.f32', '_v.f32'): os.remove(os.path.join(OUT, f))
    print('ok')
