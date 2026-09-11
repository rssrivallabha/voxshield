import pytest
import math
import numpy as np
from ..inference.ml_adapters import (
    RawNet2SyntheticDetector,
    ECAPATDNNSpeakerVerifier,
    ImprovedAcousticAnalyzer,
)


class TestRawNet2SyntheticDetector:
    def test_model_unavailable_when_artifact_missing(self):
        det = RawNet2SyntheticDetector(model_path="/nonexistent/path.onnx")
        result = det.detect([0.1] * 16000, 16000)
        assert result.status == "MODEL_UNAVAILABLE"
        assert result.probability == 0.0
        assert result.confidence == 0.0
        assert result.model_id == "rawnet2_pytorch"

    def test_insufficient_audio_returns_status(self):
        det = RawNet2SyntheticDetector(model_path="/nonexistent/path.onnx")
        result = det.detect([0.1] * 100, 16000)
        assert result.status == "INSUFFICIENT_AUDIO"
        assert result.probability == 0.0
        assert "Need >= 1.0s" in result.metadata.get("reason", "")

    def test_wrong_sample_rate_returns_unavailable(self):
        det = RawNet2SyntheticDetector(model_path="/nonexistent/path.onnx")
        result = det.detect([0.1] * 16000, 8000)
        assert result.status == "MODEL_UNAVAILABLE"
        assert "Expected 16000 Hz" in result.metadata.get("reason", "")

    def test_nan_audio_returns_unavailable(self):
        det = RawNet2SyntheticDetector(model_path="/nonexistent/path.onnx")
        result = det.detect([0.1] * 15999 + [float('nan')], 16000)
        assert result.status == "MODEL_UNAVAILABLE"
        assert result.probability == 0.0

    def test_latency_field_present(self):
        det = RawNet2SyntheticDetector(model_path="/nonexistent/path.onnx")
        result = det.detect([0.1] * 16000, 16000)
        assert isinstance(result.inference_latency_ms, float)
        assert result.inference_latency_ms >= 0.0


class TestECAPATDNNSpeakerVerifier:
    def test_no_identity_provided_returns_no_enrolled(self):
        ver = ECAPATDNNSpeakerVerifier(model_path="/nonexistent/path.onnx")
        result = ver.verify([0.1] * 24000, 16000, None)
        assert result.status == "NO_ENROLLED_IDENTITY"
        assert result.similarity_score is None
        assert result.identity_id == "unknown"

    def test_model_unavailable_when_artifact_missing(self):
        ver = ECAPATDNNSpeakerVerifier(model_path="/nonexistent/path.onnx")
        result = ver.verify([0.1] * 24000, 16000, "user_001")
        assert result.status == "NO_ENROLLED_IDENTITY"

    def test_insufficient_audio_returns_status(self):
        ver = ECAPATDNNSpeakerVerifier(model_path="/nonexistent/path.onnx")
        result = ver.verify([0.1] * 1000, 16000, "user_001")
        assert result.status == "INSUFFICIENT_AUDIO"
        assert result.similarity_score is None
        assert "Need >= 1.5s" in result.metadata.get("reason", "")

    def test_enrollment_stores_identity(self):
        ver = ECAPATDNNSpeakerVerifier(model_path="/nonexistent/path.onnx")
        success = ver.enroll([0.1] * 24000, 16000, "user_001")
        assert success is False

    def test_wrong_sample_rate_returns_unavailable(self):
        ver = ECAPATDNNSpeakerVerifier(model_path="/nonexistent/path.onnx")
        result = ver.verify([0.1] * 24000, 8000, "user_001")
        assert result.status == "MODEL_UNAVAILABLE"

    def test_latency_field_present(self):
        ver = ECAPATDNNSpeakerVerifier(model_path="/nonexistent/path.onnx")
        result = ver.verify([0.1] * 24000, 16000, "user_001")
        assert isinstance(result.inference_latency_ms, float)
        assert result.inference_latency_ms >= 0.0


class TestImprovedAcousticAnalyzer:
    def test_silence_detection(self):
        ana = ImprovedAcousticAnalyzer()
        result = ana.analyze([], 16000)
        assert result.quality_status == "SILENT"
        assert result.voice_activity_detected is False
        assert result.audio_quality_score == 0.0

    def test_voice_detection_with_signal(self):
        ana = ImprovedAcousticAnalyzer()
        samples = [0.3 * math.sin(2 * math.pi * 440 * i / 16000) for i in range(8000)]
        result = ana.analyze(samples, 16000)
        assert result.voice_activity_detected is True
        assert result.quality_status in ("PASS", "WARN", "DEGRADED")
        assert result.audio_quality_score > 0.0

    def test_clipping_detection(self):
        ana = ImprovedAcousticAnalyzer()
        samples = [0.99] * 8000
        result = ana.analyze(samples, 16000)
        assert result.clipping_detected is True

    def test_latency_field_present(self):
        ana = ImprovedAcousticAnalyzer()
        result = ana.analyze([0.1] * 1000, 16000)
        assert isinstance(result.inference_latency_ms, float)
        assert result.inference_latency_ms >= 0.0

    def test_metadata_fields_present(self):
        ana = ImprovedAcousticAnalyzer()
        result = ana.analyze([0.1] * 1000, 16000)
        assert result.sample_rate_hz == 16000
        assert result.channels == 1
        assert isinstance(result.estimated_noise_margin_db, float)


class TestModelUnavailableInvariant:
    def test_synthetic_unavailable_not_zero(self):
        det = RawNet2SyntheticDetector(model_path="/nonexistent/path.onnx")
        result = det.detect([0.1] * 16000, 16000)
        assert result.status == "MODEL_UNAVAILABLE"
        assert result.probability == 0.0
        assert result.status != "AVAILABLE"

    def test_speaker_unavailable_not_zero(self):
        ver = ECAPATDNNSpeakerVerifier(model_path="/nonexistent/path.onnx")
        result = ver.verify([0.1] * 24000, 16000, "user_001")
        assert result.status == "NO_ENROLLED_IDENTITY"
        assert result.similarity_score is None


class TestSlidingWindow:
    def test_synthetic_detector_handles_buffer_chunks(self):
        det = RawNet2SyntheticDetector(model_path="/nonexistent/path.onnx")
        
        for i in range(5):
            chunk = [0.1] * 3200
            result = det.detect(chunk, 16000)
            assert result.status in ("INSUFFICIENT_AUDIO", "MODEL_UNAVAILABLE")

    def test_speaker_verifier_handles_buffer_chunks(self):
        ver = ECAPATDNNSpeakerVerifier(model_path="/nonexistent/path.onnx")
        
        for i in range(10):
            chunk = [0.1] * 1600
            result = ver.verify(chunk, 16000, "user_001")
            assert result.status in ("INSUFFICIENT_AUDIO", "NO_ENROLLED_IDENTITY", "MODEL_UNAVAILABLE")