import os
import time
import base64
import numpy as np
import soundfile as sf
import torch

import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.inference.ml_adapters import RawNet2SyntheticDetector
from app.audio.preprocessor import prepare_for_rawnet2


def _load_wav_via_wave(wav_path: str):
    import wave
    import struct

    with wave.open(wav_path, 'rb') as wf:
        channels = wf.getnchannels()
        sr = wf.getframerate()
        nframes = wf.getnframes()
        sampwidth = wf.getsampwidth()
        raw = wf.readframes(nframes)

    if sampwidth == 2:
        fmt = '<' + 'h' * (nframes * channels)
        ints = struct.unpack(fmt, raw)
        y = np.array(ints, dtype=np.float32) / 32768.0
    elif sampwidth == 4:
        fmt = '<' + 'i' * (nframes * channels)
        ints = struct.unpack(fmt, raw)
        y = np.array(ints, dtype=np.float32) / 2147483648.0
    else:
        raise ValueError(f'Unsupported WAV sample width: {sampwidth}')

    if channels > 1:
        y = y.reshape(-1, channels).mean(axis=1)
    return y, sr


def _as_float_samples_16k_mono(wav_path: str) -> np.ndarray:
    try:
        y, sr = sf.read(wav_path, dtype="float32")
        if y.ndim == 2:
            y = y.mean(axis=1)
        channels = 1
    except Exception:
        y, sr = _load_wav_via_wave(wav_path)
        channels = 1

    # Use prepare_for_rawnet2 as source of truth for 16k mono + exact 64000
    return np.array(
        prepare_for_rawnet2(
            samples=y.astype(np.float32).tolist(),
            sample_rate=int(sr),
            channels=int(channels),
            target_sample_rate=16000,
            target_samples=64000,
        ),
        dtype=np.float32,
    )


def main():
    wav_path = os.path.join(
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..")),
        "test_audio",
        "human.wav",
    )

    print("wav_path=", wav_path)
    if os.path.exists(wav_path):
        print("wav_size_bytes=", os.path.getsize(wav_path))


    detector = RawNet2SyntheticDetector()
    assert detector.model_available and detector.model is not None

    x = _as_float_samples_16k_mono(wav_path)
    waveform = torch.from_numpy(x).unsqueeze(0)

    with torch.no_grad():
        t0 = time.perf_counter()
        output = detector.model({"waveform": waveform})
        latency_ms = (time.perf_counter() - t0) * 1000

    logits = output["logits"]
    probs = torch.softmax(logits, dim=1)[0]
    spoof_prob = float(probs[0].item())
    bonafide_prob = float(probs[1].item())

    print("preprocessed_shape=", tuple(waveform.shape))
    print("logits=", logits.detach().cpu().numpy())
    print("spoof_probability=", spoof_prob)
    print("bonafide_probability=", bonafide_prob)
    print("inference_latency_ms=", round(latency_ms, 2))


if __name__ == "__main__":
    main()
