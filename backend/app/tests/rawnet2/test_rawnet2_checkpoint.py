import hashlib
import os
import time

import numpy as np
import pytest
import torch

from app.audio.preprocessor import prepare_for_rawnet2
from app.inference.rawnet2.model import RawNet2Model


def _sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _cfg():
    return {
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


def _load_model_and_checkpoint():
    ckpt_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "models", "synthetic_speech", "best.pt")
    expected = "0efd17340fd8de49c36ae907458deca54dad23bb502158643e49b7dda5064df8"
    assert os.path.exists(ckpt_path)
    assert _sha256(ckpt_path) == expected

    checkpoint = torch.load(ckpt_path, map_location="cpu", weights_only=False)
    assert "model_state_dict" in checkpoint

    model = RawNet2Model(_cfg())
    model.load_state_dict(checkpoint["model_state_dict"], strict=True)
    model.eval()
    return model


def test_rawnet2_checkpoint_strict_load_and_forward_cpu():
    model = _load_model_and_checkpoint()

    waveform = torch.randn(1, 64000, dtype=torch.float32)
    with torch.no_grad():
        out = model({"waveform": waveform})

    logits = out["logits"]
    probs = torch.softmax(logits, dim=-1)

    assert logits.shape == (1, 2)
    assert torch.isfinite(logits).all().item()
    assert torch.isfinite(probs).all().item()
    assert torch.allclose(probs.sum(dim=-1), torch.ones(1), atol=1e-5)


def test_preprocess_44k_stereo_to_16k_mono_64000(monkeypatch):
    sr = 44100
    channels = 2
    n = 44100 * 2
    x = np.random.uniform(-1.0, 1.0, size=(n * channels,)).astype(np.float32).tolist()

    prepared = prepare_for_rawnet2(
        samples=x,
        sample_rate=sr,
        channels=channels,
        target_sample_rate=16000,
        target_samples=64000,
    )

    assert len(prepared) == 64000


def test_preprocess_short_audio_padding():
    sr = 16000
    channels = 1
    x = np.random.uniform(-0.1, 0.1, size=(8000,)).astype(np.float32).tolist()
    prepared = prepare_for_rawnet2(
        samples=x,
        sample_rate=sr,
        channels=channels,
        target_sample_rate=16000,
        target_samples=64000,
    )
    assert len(prepared) == 64000


def test_preprocess_long_audio_truncation():
    sr = 16000
    channels = 1
    x = np.random.uniform(-0.1, 0.1, size=(80000,)).astype(np.float32).tolist()
    prepared = prepare_for_rawnet2(
        samples=x,
        sample_rate=sr,
        channels=channels,
        target_sample_rate=16000,
        target_samples=64000,
    )
    assert len(prepared) == 64000


def test_preprocess_empty_raises():
    with pytest.raises(ValueError):
        _ = prepare_for_rawnet2(samples=[], sample_rate=16000, channels=1)
