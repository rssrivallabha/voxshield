#!/usr/bin/env python3
"""
Empirical diagnosis script for VoxShield detection pipeline.
Loads a WAV file, runs the exact preprocessing and RawNet2 inference
as the production WebSocket path, and prints per-window diagnostics.
"""

import sys
import os
import time
import math
import numpy as np
import torchaudio

# Ensure backend modules are importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.inference.ml_adapters import RawNet2SyntheticDetector

# Constants matching production
SAMPLE_RATE = 16000
WINDOW_SAMPLES = 64000
STRIDE_SAMPLES = 16000
DECAY = 0.9
GAIN = 0.2

def rms_peak(samples: np.ndarray):
    if samples.size == 0:
        return 0.0, 0.0
    rms = float(np.sqrt(np.mean(samples.astype(np.float64) ** 2)))
    peak = float(np.max(np.abs(samples)))
    return rms, peak

def zero_fraction(samples: np.ndarray, threshold=1e-6):
    if samples.size == 0:
        return 0.0
    return float(np.mean(np.abs(samples) < threshold))

def load_audio_16k_mono(path: str) -> np.ndarray:
    waveform, sr = torchaudio.load(path)
    # waveform shape: (channels, samples)
    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)
    if sr != SAMPLE_RATE:
        waveform = torchaudio.transforms.Resample(sr, SAMPLE_RATE)(waveform)
    # mono, 16k
    audio = waveform.squeeze(0).numpy().astype(np.float32)
    return audio

def main(wav_path: str):
    print(f"Loading {wav_path} ...")
    audio = load_audio_16k_mono(wav_path)
    print(f"Total samples: {len(audio)} ({len(audio)/SAMPLE_RATE:.2f}s)")

    detector = RawNet2SyntheticDetector()
    if not detector.model_available:
        print("ERROR: RawNet2 model not available", file=sys.stderr)
        sys.exit(1)

    # Sliding windows
    n_windows = max(1, (len(audio) - WINDOW_SAMPLES) // STRIDE_SAMPLES + 1)
    print(f"Will process {n_windows} windows (stride {STRIDE_SAMPLES} samples = {STRIDE_SAMPLES/SAMPLE_RATE:.2f}s)")

    temporal_evidence = 0.0
    print("\nwindow | raw_spoof | raw_bonafide | temporal_evidence | padded | rms | peak | zero_frac | latency_ms")
    for i in range(n_windows):
        start = i * STRIDE_SAMPLES
        end = start + WINDOW_SAMPLES
        if end > len(audio):
            # pad with zeros
            window = np.zeros(WINDOW_SAMPLES, dtype=np.float32)
            window[:len(audio)-start] = audio[start:]
            padded = True
        else:
            window = audio[start:end]
            padded = False

        rms, peak = rms_peak(window)
        zf = zero_fraction(window)

        # inference
        t0 = time.perf_counter()
        result = detector.detect(window.tolist(), SAMPLE_RATE)
        latency_ms = (time.perf_counter() - t0) * 1000

        if result.status == "AVAILABLE":
            raw_spoof = result.probability
            raw_bonafide = result.metadata.get("bonafide_prob", 1.0 - raw_spoof)
        else:
            raw_spoof = None
            raw_bonafide = None

        # temporal EMA
        if raw_spoof is not None:
            temporal_evidence = max(0.0, min(1.0,
                temporal_evidence * DECAY + (raw_spoof - 0.5) * GAIN))
        # else unavailable -> raw_prob = 0.5 -> no change (only decay)
        else:
            temporal_evidence = max(0.0, min(1.0, temporal_evidence * DECAY))

        print(f"{i:5d} | {raw_spoof if raw_spoof is not None else 'NA':9} | "
              f"{raw_bonafide if raw_bonafide is not None else 'NA':12} | "
              f"{temporal_evidence:18.4f} | {str(padded):6} | "
              f"{rms:.6f} | {peak:.6f} | {zf:.3f} | {latency_ms:9.1f}")

    # Summary stats for available windows
    spoofs = [r for r in [None]*n_windows]  # placeholder
    # We'll recompute quickly
    spoofs = []
    for i in range(n_windows):
        start = i * STRIDE_SAMPLES
        end = start + WINDOW_SAMPLES
        window = audio[start:end] if end <= len(audio) else np.pad(audio[start:], (0, end - len(audio)))
        result = detector.detect(window.tolist(), SAMPLE_RATE)
        if result.status == "AVAILABLE":
            spoofs.append(result.probability)
    if spoofs:
        arr = np.array(spoofs)
        print("\n--- Human recording summary ---")
        print(f"Windows with AVAILABLE: {len(spoofs)}")
        print(f"Mean raw spoof: {arr.mean():.4f}")
        print(f"Median raw spoof: {np.median(arr):.4f}")
        print(f"Max raw spoof: {arr.max():.4f}")
        print(f"% >0.5: {(arr>0.5).mean()*100:.1f}%")
        print(f"% >0.7: {(arr>0.7).mean()*100:.1f}%")
        print(f"Final temporal evidence: {temporal_evidence:.4f}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python empirical_diagnosis.py <path_to_wav>")
        sys.exit(1)
    main(sys.argv[1])