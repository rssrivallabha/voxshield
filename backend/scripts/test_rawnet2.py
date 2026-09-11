import argparse
import os
import sys
import time
from typing import Tuple

import numpy as np
import torch

import os
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, REPO_ROOT)

from app.audio.preprocessor import prepare_for_rawnet2
from app.inference.rawnet2.model import RawNet2Model


def _sha256(path: str) -> str:
    import hashlib

    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _load_wav_mono_float32(wav_path: str) -> Tuple[np.ndarray, int, int]:
    try:
        import scipy.io.wavfile as wavfile
    except Exception as e:
        raise RuntimeError("scipy is required to load wav files") from e

    if not os.path.exists(wav_path):
        raise FileNotFoundError(wav_path)

    sr, data = wavfile.read(wav_path)
    if data is None or getattr(data, "size", 0) == 0:
        raise ValueError("Empty audio")

    channels = 1
    if data.ndim == 1:
        channels = 1
        x = data
    elif data.ndim == 2:
        channels = int(data.shape[1])
        x = data
    else:
        raise ValueError("Unsupported WAV dimensionality")

    if np.issubdtype(x.dtype, np.integer):
        if x.dtype == np.int16:
            x_f = x.astype(np.float32) / 32768.0
        elif x.dtype == np.int32:
            x_f = x.astype(np.float32) / 2147483648.0
        elif x.dtype == np.uint8:
            x_f = (x.astype(np.float32) - 128.0) / 128.0
        else:
            info = np.iinfo(x.dtype)
            denom = max(abs(info.min), abs(info.max))
            x_f = x.astype(np.float32) / float(denom)
    else:
        x_f = x.astype(np.float32)

    x_f = np.clip(x_f, -1.0, 1.0)
    return x_f, int(sr), channels


def _to_interleaved_list(x_f: np.ndarray) -> list[float]:
    if x_f.ndim == 1:
        return x_f.tolist()
    if x_f.ndim == 2:
        return np.reshape(x_f, (-1,), order="C").astype(np.float32).tolist()
    raise ValueError("Unsupported waveform shape")


def _measure_latency_ms(model: torch.nn.Module, waveform: torch.Tensor) -> dict:
    model.eval()
    with torch.no_grad():
        _ = model({"waveform": waveform})

    lat = []
    with torch.no_grad():
        for _i in range(5):
            t0 = time.perf_counter()
            _ = model({"waveform": waveform})
            t1 = time.perf_counter()
            lat.append((t1 - t0) * 1000.0)

    return {
        "warm_lat_ms": lat,
        "warm_avg_ms": float(np.mean(lat)),
        "warm_min_ms": float(np.min(lat)),
        "warm_max_ms": float(np.max(lat)),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("wav_path", type=str)
    args = parser.parse_args()

    model_ckpt_path = "models/synthetic_speech/best.pt"
    expected_ckpt_sha256 = "0efd17340fd8de49c36ae907458deca54dad23bb502158643e49b7dda5064df8"

    if not os.path.exists(model_ckpt_path):
        print(f"Missing checkpoint: {model_ckpt_path}", file=sys.stderr)
        return 2

    ck_sha = _sha256(model_ckpt_path)
    if ck_sha != expected_ckpt_sha256:
        print(f"Checkpoint SHA256 mismatch. expected={expected_ckpt_sha256} got={ck_sha}", file=sys.stderr)
        return 3

    x_f, sr, channels = _load_wav_mono_float32(args.wav_path)

    duration_s = float(x_f.shape[0]) / float(sr) if x_f.ndim == 1 else float(x_f.shape[0]) / float(sr)

    samples_interleaved = _to_interleaved_list(x_f)

    prepared = prepare_for_rawnet2(
        samples=samples_interleaved,
        sample_rate=sr,
        channels=channels,
        target_sample_rate=16000,
        target_samples=64000,
    )

    waveform = torch.tensor(prepared, dtype=torch.float32).unsqueeze(0)

    cfg = {
        "sinc_filters": 128,
        "sinc_filter_length": 129,
        "sample_rate": 16000,
        "sinc_scale": "linear",
        "learnable_sinc": False,
        "first_block_channels": 128,
        "second_block_channels": 512,
        "num_first_blocks": 2,
        "num_second_blocks": 4,
        "gru_hidden": 1024,
        "embedding_dim": 1024,
        "class_weights": [8.837, 1.0],
    }

    checkpoint = torch.load(model_ckpt_path, map_location="cpu", weights_only=False)
    if "model_state_dict" not in checkpoint:
        print("Checkpoint missing model_state_dict", file=sys.stderr)
        return 4

    model = RawNet2Model(cfg)
    model.load_state_dict(checkpoint["model_state_dict"], strict=True)
    model.eval()

    inference_latency = None
    try:
        t0 = time.perf_counter()
        with torch.no_grad():
            out = model({"waveform": waveform})
        t1 = time.perf_counter()
        logits = out["logits"]
        probs = torch.softmax(logits, dim=-1)
        inference_latency = _measure_latency_ms(model, waveform)
    except Exception as e:
        print(f"Inference failed: {e}", file=sys.stderr)
        return 5

    pred = int(torch.argmax(probs, dim=-1).item())

    spoof_prob = float(probs[0, 0].item())
    bonafide_prob = float(probs[0, 1].item())

    print(f"source_sample_rate_hz: {sr}")
    print(f"source_channels: {channels}")
    print(f"source_duration_s: {duration_s}")
    print(f"prepared_sample_count: {waveform.shape[1]}")
    print(f"inference_warm_avg_latency_ms: {inference_latency['warm_avg_ms']}")

    print(f"logits: {logits.detach().cpu().numpy().tolist()}")
    print(f"spoof_probability: {spoof_prob}")
    print(f"bonafide_probability: {bonafide_prob}")
    print(f"prediction: {'SPOOF' if pred == 0 else 'BONAFIDE'}")

    if not torch.isfinite(logits).all().item():
        return 6
    if not torch.isfinite(probs).all().item():
        return 7
    if not torch.allclose(probs.sum(dim=-1), torch.ones(1), atol=1e-5):
        return 8

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
