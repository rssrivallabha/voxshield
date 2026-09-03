import base64
import struct
from typing import Optional
from dataclasses import dataclass

@dataclass
class PreprocessedAudio:
    pcm_float32: list[float]
    sample_rate: int
    channels: int
    duration_ms: float
    rms_dbfs: float
    peak_dbfs: float
    is_silence: bool
    clipping_detected: bool
    estimated_noise_floor_margin_db: float

TARGET_SAMPLE_RATE = 16000

def decode_audio(
    payload_b64: str,
    encoding: str = "pcm_f32le",
    sample_rate: int = 16000,
    channels: int = 1,
) -> list[float]:
    raw = base64.b64decode(payload_b64)
    
    if encoding == "pcm_f32le":
        count = len(raw) // 4
        samples = struct.unpack(f"<{count}f", raw[:count * 4])
        return list(samples)
    elif encoding == "pcm_s16le":
        count = len(raw) // 2
        raw_samples = struct.unpack(f"<{count}h", raw[:count * 2])
        return [s / 32768.0 for s in raw_samples]
    elif encoding == "pcm_u8":
        return [(b - 128) / 128.0 for b in raw]
    else:
        raise ValueError(f"Unsupported encoding: {encoding}")

def preprocess_chunk(
    payload_b64: str,
    encoding: str = "pcm_f32le",
    sample_rate: int = 16000,
    channels: int = 1,
    chunk_duration_ms: float = 100.0,
) -> Optional[PreprocessedAudio]:
    if not payload_b64:
        return None
    
    samples = decode_audio(payload_b64, encoding, sample_rate, channels)
    if not samples:
        return None
    
    sum_sq = sum(s * s for s in samples)
    rms = (sum_sq / len(samples)) ** 0.5
    peak = max(abs(s) for s in samples)
    
    rms_dbfs = 20 * __import__("math").log10(rms) if rms > 1e-10 else -96.0
    peak_dbfs = 20 * __import__("math").log10(peak) if peak > 1e-10 else -96.0
    
    noise_floor_dbfs = -60.0
    estimated_noise_margin = max(0.0, rms_dbfs - noise_floor_dbfs)
    
    is_silence = rms_dbfs < -50.0
    clipping = peak >= 0.98
    
    return PreprocessedAudio(
        pcm_float32=samples,
        sample_rate=sample_rate,
        channels=channels,
        duration_ms=chunk_duration_ms,
        rms_dbfs=round(rms_dbfs, 1),
        peak_dbfs=round(peak_dbfs, 1),
        is_silence=is_silence,
        clipping_detected=clipping,
        estimated_noise_floor_margin_db=round(estimated_noise_margin, 1),
    )