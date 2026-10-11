"""Voix off française (Piper « siwis » via sherpa-onnx). Garde la meilleure prise sur 5 en comparant la retranscription Whisper au texte voulu.
Nécessite les modèles vits-piper-fr_FR-siwis-medium et sherpa-onnx-whisper-small (voir README). Les WAV générés sont fournis dans voix/."""
import sys, re, difflib, wave
import numpy as np, sherpa_onnx
M = sys.argv[1]            # dossier des modèles (contenant tts/ et asr/)
OUT = sys.argv[2]          # dossier de sortie
D = f'{M}/tts/vits-piper-fr_FR-siwis-medium'
tts = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
    vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=f'{D}/fr_FR-siwis-medium.onnx', tokens=f'{D}/tokens.txt', data_dir=f'{D}/espeak-ng-data',
                                               noise_scale=0.667, noise_scale_w=0.8, length_scale=1.0), num_threads=4, provider='cpu')))
A = f'{M}/asr/sherpa-onnx-whisper-small'
rec = sherpa_onnx.OfflineRecognizer.from_whisper(encoder=f'{A}/small-encoder.int8.onnx', decoder=f'{A}/small-decoder.int8.onnx',
                                                 tokens=f'{A}/small-tokens.txt', language='fr', task='transcribe', num_threads=4)
LINES = {
    'hook':  ("Le laser tag... à la maison.", "le laser tag à la maison"),
    'jaune': ("Du jaune.", "du jaune"), 'bleu': ("Du bleu.", "du bleu"), 'vert': ("Du vert.", "du vert"), 'rouge': ("Du rouge.", "du rouge"),
    'duo':   ("Bleus contre rouges.", "bleus contre rouges"),
    'qui':   ("Qui sera le dernier debout ?", "qui sera le dernier debout"),
    'touche': ("Chaque touche compte.", "chaque touche compte"),
    'cta':   ("Commente laser pour recevoir le lien.", "commente laser pour recevoir le lien"),
}
def norm(s):
    s = s.lower()
    for a, b in (('é', 'e'), ('è', 'e'), ('ê', 'e'), ('à', 'a'), ('ç', 'c'), ('ô', 'o')): s = s.replace(a, b)
    return re.sub(r'[^a-z0-9]', '', s)
def save(path, x, sr):
    w = wave.open(path, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
for k, (text, expect) in LINES.items():
    best = None
    for _ in range(5):
        a = tts.generate(text, sid=0, speed=1.05); x = np.array(a.samples, np.float32); sr = a.sample_rate
        s = rec.create_stream(); s.accept_waveform(sr, np.concatenate([x, np.zeros(int(sr * .6), np.float32)])); rec.decode_stream(s)
        sc = difflib.SequenceMatcher(None, norm(s.result.text), norm(expect)).ratio()
        if best is None or sc > best[0]: best = (sc, s.result.text.strip(), x, sr)
    save(f'{OUT}/{k}.wav', best[2], best[3]); print(k, round(best[0], 2), repr(best[1]), round(len(best[2]) / best[3], 2), flush=True)
