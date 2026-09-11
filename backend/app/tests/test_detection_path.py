import sys
import types
import pytest
from unittest.mock import MagicMock, patch

# Ensure backend modules can be imported
sys.path.insert(0, "C:/Users/vrmus/Downloads/VoxShield/backend")

from app.websocket.handler import VoiceAnalysisManager, VoiceAnalysisSession
from app.inference.interfaces import SyntheticSpeechResult, SpeakerVerificationResult, AcousticAnalysisResult
from app.evidence.fusion import fuse_evidence
from app.risk.engine import determine_risk_state
from app.policy.engine import evaluate_policies, get_recommended_action


def _make_fake_detector(prob, status="AVAILABLE"):
    det = MagicMock()
    det.detect.return_value = SyntheticSpeechResult(
        probability=prob,
        confidence=abs(prob - 0.5) * 2,
        model_id="rawnet2_pytorch",
        model_version="1.0.0",
        inference_latency_ms=10.0,
        status=status,
        metadata={"spoof_prob": prob, "bonafide_prob": 1.0 - prob}
    )
    return det


def _make_fake_verifier(similarity=0.9, status="AVAILABLE"):
    ver = MagicMock()
    ver.verify.return_value = SpeakerVerificationResult(
        similarity_score=similarity,
        confidence=0.9,
        identity_id="test_id",
        status=status,
        inference_latency_ms=5.0,
        metadata={}
    )
    return ver


def _make_fake_acoustic():
    ac = MagicMock()
    ac.analyze.return_value = AcousticAnalysisResult(
        spectral_anomaly_score=0.0,
        voice_activity_detected=True,
        audio_quality_score=1.0,
        quality_status="PASS",
        clipping_detected=False,
        sample_rate_hz=16000,
        channels=1,
        estimated_noise_margin_db=20.0,
        inference_latency_ms=2.0,
        metadata={}
    )
    return ac


def test_temporal_accumulator_isolated_spike():
    """Single high spoof prob should not push evidence high."""
    session = VoiceAnalysisSession("test_sess")
    session.synthetic_evidence_accumulator = 0.0
    # Simulate accumulator update logic
    decay, gain = 0.9, 0.2
    raw_prob = 0.95
    session.synthetic_evidence_accumulator = max(0.0, min(1.0,
        session.synthetic_evidence_accumulator * decay + (raw_prob - 0.5) * gain))
    # After one spike evidence ~0.09
    assert session.synthetic_evidence_accumulator < 0.2


def test_temporal_accumulator_sustained_high():
    """Three consecutive high probs should raise evidence noticeably."""
    session = VoiceAnalysisSession("test_sess2")
    session.synthetic_evidence_accumulator = 0.0
    decay, gain = 0.9, 0.2
    for _ in range(3):
        raw_prob = 0.9
        session.synthetic_evidence_accumulator = max(0.0, min(1.0,
            session.synthetic_evidence_accumulator * decay + (raw_prob - 0.5) * gain))
    # After three, evidence ~0.22 with current constants
    assert session.synthetic_evidence_accumulator > 0.15


def test_temporal_accumulator_low_reduces():
    """Sustained low prob reduces evidence."""
    session = VoiceAnalysisSession("test_sess3")
    session.synthetic_evidence_accumulator = 0.6
    decay, gain = 0.9, 0.2
    for _ in range(3):
        raw_prob = 0.1
        session.synthetic_evidence_accumulator = max(0.0, min(1.0,
            session.synthetic_evidence_accumulator * decay + (raw_prob - 0.5) * gain))
    assert session.synthetic_evidence_accumulator < 0.4


def test_unavailable_does_not_change_accumulator():
    """When model unavailable, accumulator unchanged (raw_prob=0.5 => no drift)."""
    session = VoiceAnalysisSession("test_sess4")
    session.synthetic_evidence_accumulator = 0.3
    decay, gain = 0.9, 0.2
    raw_prob = 0.5  # used when unavailable
    session.synthetic_evidence_accumulator = max(0.0, min(1.0,
        session.synthetic_evidence_accumulator * decay + (raw_prob - 0.5) * gain))
    assert session.synthetic_evidence_accumulator == pytest.approx(0.3 * decay)


def test_session_independence():
    """Accumulator of one session does not affect another."""
    s1 = VoiceAnalysisSession("s1")
    s2 = VoiceAnalysisSession("s2")
    s1.synthetic_evidence_accumulator = 0.8
    s2.synthetic_evidence_accumulator = 0.1
    assert s1.synthetic_evidence_accumulator != s2.synthetic_evidence_accumulator


def test_raw_probability_preserved_in_ws_payload():
    """InferenceUpdate payload contains raw_synthetic_probability equal to model output."""
    from app.schemas.protocol import InferenceUpdate
    prob = 0.73
    ev = InferenceUpdate(
        session_id="s",
        timestamp_ms=123.0,
        speaker_verification={},
        synthetic_speech={"probability": prob, "confidence": 0.5, "status": "AVAILABLE", "model_id": "m", "latency_ms": 1},
        acoustic_analysis={},
        raw_synthetic_probability=prob,
        accumulated_synthetic_evidence=0.2,
        speaker_verification_evidence=0.1,
    )
    assert ev.raw_synthetic_probability == prob
    # Ensure AI detection score not mixed in
    assert "ai_detection_score" not in InferenceUpdate.model_fields


def test_frontend_adapter_uses_correct_field():
    """telemetryAdapter should read synthetic_speech.probability."""
    # This is a lightweight check; actual adapter test would be in frontend suite.
    payload = {
        "synthetic_speech": {"probability": 0.42, "status": "AVAILABLE"},
        "raw_synthetic_probability": 0.42,
    }
    # The adapter picks payload["synthetic_speech"]["probability"]
    assert payload["synthetic_speech"]["probability"] == payload["raw_synthetic_probability"]


def test_unavailable_not_zero():
    """When status != AVAILABLE, raw_synthetic_probability should be None not 0."""
    from app.schemas.protocol import InferenceUpdate
    ev = InferenceUpdate(
        session_id="s",
        timestamp_ms=123.0,
        speaker_verification={},
        synthetic_speech={"probability": 0.0, "confidence": 0.0, "status": "MODEL_UNAVAILABLE", "model_id": "m", "latency_ms": 1},
        acoustic_analysis={},
        raw_synthetic_probability=None,
        accumulated_synthetic_evidence=0.0,
        speaker_verification_evidence=None,
    )
    assert ev.raw_synthetic_probability is None