import os
import time
import numpy as np
import scipy.io.wavfile as wavfile

import os
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, REPO_ROOT)

from app.audio.preprocessor import prepare_for_rawnet2
from app.inference.ml_adapters import ECAPATDNNSpeakerVerifier


def main() -> int:
    wav_path = 'test_audio/human.wav'
    sr, data = wavfile.read(wav_path)

    x = data[:, 0]
    x_f = (x.astype(np.float32) / 32768.0).clip(-1, 1)
    mono = x_f.tolist()

    prepared = prepare_for_rawnet2(
        samples=mono,
        sample_rate=int(sr),
        channels=1,
        target_sample_rate=16000,
        target_samples=64000,
    )

    verifier = ECAPATDNNSpeakerVerifier(
        model_path='models/speaker_verification/ecapa_tdnn_best.onnx'
    )

    print('model_available', verifier.model_available)

    identity_id = 'test-human-001'

    ok = verifier.enroll(prepared, 16000, identity_id)
    print('enroll_ok', ok)

    res = verifier.verify(prepared, 16000, identity_id)
    print(
        'verify_status',
        res.status,
        'similarity_score',
        res.similarity_score,
        'confidence',
        res.confidence,
        'latency_ms',
        res.inference_latency_ms,
        'metadata',
        res.metadata,
    )

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
