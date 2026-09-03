import base64
import struct
from ..audio.preprocessor import decode_audio, preprocess_chunk

def _encode_pcm_f32le(samples: list[float]) -> str:
    raw = struct.pack(f"<{len(samples)}f", *samples)
    return base64.b64encode(raw).decode()

def test_decode_pcm_f32le():
    samples = [0.1, 0.2, -0.3, 0.0]
    b64 = _encode_pcm_f32le(samples)
    decoded = decode_audio(b64, "pcm_f32le", 16000, 1)
    assert len(decoded) == 4
    assert abs(decoded[0] - 0.1) < 1e-6

def test_preprocess_returns_metrics():
    import math
    samples = [0.3 * math.sin(2 * math.pi * 440 * i / 16000) for i in range(3200)]
    b64 = _encode_pcm_f32le(samples)
    result = preprocess_chunk(b64, "pcm_f32le", 16000, 1, 200.0)
    assert result is not None
    assert result.sample_rate == 16000
    assert result.channels == 1
    assert result.duration_ms == 200.0
    assert result.rms_dbfs > -50

def test_preprocess_empty_payload():
    result = preprocess_chunk("", "pcm_f32le", 16000, 1, 100.0)
    assert result is None

def test_preprocess_silence():
    samples = [0.00001] * 1600
    b64 = _encode_pcm_f32le(samples)
    result = preprocess_chunk(b64, "pcm_f32le", 16000, 1, 100.0)
    assert result is not None
    assert result.is_silence is True