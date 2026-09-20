import argparse
import os
import sys
import time
import numpy as np
import torch

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, REPO_ROOT)

from app.audio.preprocessor import prepare_for_rawnet2
from app.inference.rawnet2.model import RawNet2Model


def load_model(model_ckpt_path: str) -> RawNet2Model:
    ckpt = torch.load(model_ckpt_path, map_location='cpu', weights_only=False)
    config = {
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
    model = RawNet2Model(config)
    model.load_state_dict(ckpt["model_state_dict"], strict=True)
    model.eval()
    return model


def warmup_infer(model: torch.nn.Module, waveform: torch.Tensor, iters: int) -> None:
    with torch.inference_mode():
        for _ in range(iters):
            _ = model({"waveform": waveform})


def measure_infer(model: torch.nn.Module, waveform: torch.Tensor, iters: int) -> list[float]:
    lats = []
    with torch.inference_mode():
        for _ in range(iters):
            t0 = time.perf_counter()
            _ = model({"waveform": waveform})
            t1 = time.perf_counter()
            lats.append((t1 - t0) * 1000.0)
    return lats


def summarize(lats: list[float]) -> dict:
    arr = np.array(lats, dtype=np.float64)
    return {
        'median_ms': float(np.median(arr)),
        'mean_ms': float(arr.mean()),
        'p95_ms': float(np.percentile(arr, 95)),
        'min_ms': float(arr.min()),
        'max_ms': float(arr.max()),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--wav', required=True)
    ap.add_argument('--threads', type=int, required=True)
    ap.add_argument('--inter_threads', type=int, default=None)
    ap.add_argument('--warmup', type=int, default=30)
    ap.add_argument('--iters', type=int, default=10)
    args = ap.parse_args()

    model_ckpt_path = os.path.join(REPO_ROOT, 'models', 'synthetic_speech', 'best.pt')
    if not os.path.exists(model_ckpt_path):
        raise FileNotFoundError(model_ckpt_path)

    if args.inter_threads is not None:
        torch.set_num_interop_threads(args.inter_threads)

    torch.set_num_threads(args.threads)

    num_threads = torch.get_num_threads()
    num_interop = torch.get_num_interop_threads()

    import scipy.io.wavfile as wavfile
    sr, data = wavfile.read(args.wav)
    if data.ndim == 2:
        data = data[:, 0]
    if np.issubdtype(data.dtype, np.integer):
        if data.dtype == np.int16:
            data = data.astype(np.float32) / 32768.0
        else:
            data = data.astype(np.float32)
    x_f = np.clip(data.astype(np.float32), -1.0, 1.0)

    samples = prepare_for_rawnet2(list(x_f), sr, 1)
    waveform = torch.tensor(samples, dtype=torch.float32).unsqueeze(0)

    model = load_model(model_ckpt_path)

    warmup_infer(model, waveform, args.warmup)
    lats = measure_infer(model, waveform, args.iters)
    stats = summarize(lats)

    print('threads', num_threads, 'interop', num_interop)
    print('stats', stats)


if __name__ == '__main__':
    main()
