import os
import json
import hashlib
import time
import math
from pathlib import Path

import numpy as np
import pytest

from ..inference.ml_adapters import RawNet2SyntheticDetector, ECAPATDNNSpeakerVerifier


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def _model_path(relative: str) -> Path:
    return Path(__file__).resolve().parents[2] / 'models' / relative


def _detector_smoke_model_artifact() -> Path:
    return _model_path('synthetic_speech/rawnet2_best.onnx')


def _verifier_smoke_model_artifact() -> Path:
    return _model_path('speaker_verification/ecapa_tdnn_best.onnx')


def _deterministic_audio(samples: int, sr: int) -> list[float]:
    audio = [0.1 * math.sin(2 * math.pi * 440 * i / sr) for i in range(samples)]
    return audio


def _maybe_skip_if_missing(artifact: Path, which: str):
    if not artifact.exists():
        pytest.skip(f"{which} artifact missing: {artifact.as_posix()} (no auto-download).")


def test_smoke_rawnet2_onnx_inference():
    artifact = _detector_smoke_model_artifact()
    _maybe_skip_if_missing(artifact, 'RawNet2')

    result_sha = _sha256_file(artifact)
    det = RawNet2SyntheticDetector(model_path=str(artifact))
    assert det.model_available is True

    audio = _deterministic_audio(16000, 16000)
    t0 = time.perf_counter()
    out = det.detect(audio, 16000)
    wall_ms = (time.perf_counter() - t0) * 1000

    assert out.status == 'AVAILABLE'
    assert out.model_id == 'rawnet2_onnx'
    assert 0.0 <= out.probability <= 1.0
    assert 0.0 <= out.confidence <= 1.0
    assert out.inference_latency_ms >= 0.0

    print(json.dumps({
        'artifact': artifact.as_posix(),
        'sha256': result_sha,
        'probability': out.probability,
        'confidence': out.confidence,
        'latency_ms_adapter': out.inference_latency_ms,
        'latency_ms_wall': wall_ms,
    }, indent=2))


def test_smoke_ecapa_tdnnspeaker_verification_enrollment_and_verify():
    artifact = _verifier_smoke_model_artifact()
    _maybe_skip_if_missing(artifact, 'ECAPA-TDNN')

    result_sha = _sha256_file(artifact)
    ver = ECAPATDNNSpeakerVerifier(model_path=str(artifact))
    assert ver.model_available is True

    identity = 'user_smoke'
    enroll_audio = _deterministic_audio(24000, 16000)
    assert ver.enroll(enroll_audio, 16000, identity) is True

    verify_audio = _deterministic_audio(24000, 16000)
    out = ver.verify(verify_audio, 16000, identity)

    assert out.status == 'AVAILABLE'
    assert out.similarity_score is not None
    assert out.confidence is not None
    assert 0.0 <= out.similarity_score <= 1.0
    assert out.inference_latency_ms >= 0.0

    print(json.dumps({
        'artifact': artifact.as_posix(),
        'sha256': result_sha,
        'identity_id': identity,
        'similarity_score': out.similarity_score,
        'confidence': out.confidence,
        'latency_ms_adapter': out.inference_latency_ms,
    }, indent=2))
