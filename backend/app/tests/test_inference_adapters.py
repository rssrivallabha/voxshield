import pytest
from ..inference.dev_adapters import (
    DevSyntheticSpeechDetector,
    DevSpeakerVerifier,
    DevAcousticAnalyzer,
)

def test_dev_synthetic_detector_returns_model_unavailable():
    det = DevSyntheticSpeechDetector()
    result = det.detect([0.1] * 1000, 16000)
    assert result.status == "MODEL_UNAVAILABLE"
    assert result.probability == 0.0
    assert result.model_id == "dev_stub_v0"

def test_dev_speaker_verifier_no_identity():
    ver = DevSpeakerVerifier()
    result = ver.verify([0.1] * 1000, 16000, None)
    assert result.status == "NO_ENROLLED_IDENTITY"
    assert result.similarity_score is None

def test_dev_speaker_verifier_with_identity():
    ver = DevSpeakerVerifier()
    result = ver.verify([0.1] * 1000, 16000, "user_01")
    assert result.status == "MODEL_UNAVAILABLE"
    assert result.identity_id == "user_01"

def test_dev_acoustic_analyzer_with_silence():
    ana = DevAcousticAnalyzer()
    result = ana.analyze([], 16000)
    assert result.quality_status == "SILENT"
    assert result.voice_activity_detected is False

def test_dev_acoustic_analyzer_with_voice():
    import math
    samples = [0.3 * math.sin(2 * math.pi * 440 * i / 16000) for i in range(8000)]
    ana = DevAcousticAnalyzer()
    result = ana.analyze(samples, 16000)
    assert result.quality_status in ("PASS", "WARN")
    assert result.voice_activity_detected is True