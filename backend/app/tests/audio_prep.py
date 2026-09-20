import base64
import io
from dataclasses import dataclass
from typing import Tuple

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly


def load_wav_as_float_mono_16k(path: str) -> Tuple[np.ndarray, int]:
    y, sr = sf.read(path, dtype="float32")
    if y.ndim == 2:
        y = y.mean(axis=1)
    y = y.astype(np.float32)
    if sr != 16000:
        frac = __import__("fractions").Fraction(16000, sr).limit_denominator()
        y = resample_poly(y, frac.numerator, frac.denominator).astype(np.float32)
        sr = 16000
    if y.size == 0:
        return y.astype(np.float32), sr
    return y, sr


def pcm_f32le_b64_from_float_samples(samples: np.ndarray) -> str:
    return base64.b64encode(samples.astype(np.float32).tobytes()).decode()
