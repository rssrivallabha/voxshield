import argparse
import os
import sys
import time
import numpy as np
import torch

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, REPO_ROOT)

from app.audio.preprocessor import prepare_for_rawnet2
from app.inference.rawnet2.model import RawNet2Model, SincConv


def make_uncached_model_from_cached_model(model: RawNet2Model) -> RawNet2Model:
    """Clone architecture but patch SincConv._make_filters to always rebuild."""
    original_sinc = model.sinc

    def uncached_make_filters(self):
        eps = 1e-8
        low = self.low_hz_
        high = low + self.band_hz_
        n = self.n_axis
        filters = []
        for i in range(self.sinc_filters):
            l = low[i]
            h = high[i]
            sinc_band = torch.where(
                n == 0,
                2.0 * (h - l),
                (torch.sin(2.0 * torch.pi * h * n) - torch.sin(2.0 * torch.pi * l * n)) / (torch.pi * n + eps),
            )
            sinc_band = sinc_band.squeeze(0)
            sinc_band = sinc_band * self.window
            left = torch.flip(sinc_band, dims=[0])
            right = sinc_band
            center = (2.0 * (h - l)).reshape(1)
            filt = torch.cat([left, center, right], dim=0)
            filters.append(filt)
        return torch.stack(filters, dim=0)

    model = model
    model.sinc._make_filters = uncached_make_filters.__get__(model.sinc, type(model.sinc))
    return model


def load_model(ckpt_path: str) -> RawNet2Model:
    ckpt = torch.load(ckpt_path, map_location='cpu', weights_only=False)
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
    m = RawNet2Model(config)
    m.load_state_dict(ckpt["model_state_dict"], strict=True)
    m.eval()
    return m


def summarize(lats: list[float]) -> dict:
    arr = np.array(lats, dtype=np.float64)
    return {
        'median_ms': float(np.median(arr)),
        'mean_ms': float(arr.mean()),
        'p95_ms': float(np.percentile(arr, 95)),
        'min_ms': float(arr.min()),
        'max_ms': float(arr.max()),
    }


def run_cfg(model, waveform, warmup: int, iters: int) -> dict:
    with torch.inference_mode():
        for _ in range(warmup):
            _ = model({"waveform": waveform})
        lats = []
        for _ in range(iters):
            t0 = time.perf_counter()
            _ = model({"waveform": waveform})
            t1 = time.perf_counter()
            lats.append((t1 - t0) * 1000.0)
    return summarize(lats), lats


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--wav', required=True)
    ap.add_argument('--threads', type=int, default=8)
    ap.add_argument('--warmup', type=int, default=20)
    ap.add_argument('--iters', type=int, default=30)
    args = ap.parse_args()

    torch.set_num_threads(args.threads)
    torch.set_num_interop_threads(args.threads)
    threads = torch.get_num_threads()
    inter = torch.get_num_interop_threads()

    import scipy.io.wavfile as wavfile
    sr, data = wavfile.read(args.wav)
    if data.ndim == 2:
        data = data[:, 0]
    if np.issubdtype(data.dtype, np.integer):
        data = data.astype(np.float32) / 32768.0
    x_f = np.clip(data.astype(np.float32), -1.0, 1.0)

    samples = prepare_for_rawnet2(list(x_f), int(sr), 1)
    waveform = torch.tensor(samples, dtype=torch.float32).unsqueeze(0)

    ckpt_path = os.path.join(REPO_ROOT, 'models', 'synthetic_speech', 'best.pt')
    base_model = load_model(ckpt_path)

    print('threads', threads, 'interop', inter)

    results = {}
    for label, builder in [
        ('A_cached', lambda m: m),
        ('B_uncached', lambda m: make_uncached_model_from_cached_model(m)),
    ]:
        runs = []
        for r in range(3):
            # rebuild model for clean cache state
            m = load_model(ckpt_path)
            m = builder(m)
            stats, _lats = run_cfg(m, waveform, args.warmup, args.iters)
            runs.append(stats)
            print(label, 'run', r+1, stats)
        results[label] = runs

    def agg(stats_list):
        med = [s['median_ms'] for s in stats_list]
        p95 = [s['p95_ms'] for s in stats_list]
        return {
            'median_median_ms': float(np.median(med)),
            'mean_median_ms': float(np.mean(med)),
            'median_p95_ms': float(np.median(p95)),
        }

    A = agg(results['A_cached'])
    B = agg(results['B_uncached'])
    speedup = (A['median_median_ms'] - B['median_median_ms']) / B['median_median_ms'] * 100.0

    print('A_agg', A)
    print('B_agg', B)
    print('cache_speedup_percent_vs_uncached_median', speedup)


if __name__ == '__main__':
    main()
