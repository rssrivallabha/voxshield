import numpy as np

from app.evidence.fusion import fuse_evidence
from app.inference.interfaces import AcousticAnalysisResult, SpeakerVerificationResult, SyntheticSpeechResult
from app.risk.engine import determine_risk_state


def _acoustic_ok():
    return AcousticAnalysisResult(
        spectral_anomaly_score=0.9,
        voice_activity_detected=True,
        audio_quality_score=1.0,
        quality_status="PASS",
        clipping_detected=False,
        sample_rate_hz=16000,
        channels=1,
        estimated_noise_margin_db=10.0,
        inference_latency_ms=0.0,
    )


def _speaker_no_enrolled():
    return SpeakerVerificationResult(
        similarity_score=None,
        confidence=None,
        identity_id="id_x",
        status="NO_ENROLLED_IDENTITY",
        inference_latency_ms=0.0,
        metadata={"reason": "Identity enrollment status: VERIFIED"},
    )


def _synthetic(prob: float, status: str = "AVAILABLE"):
    prob = float(prob)
    conf = round(abs(prob - 0.5) * 2.0, 4)
    return SyntheticSpeechResult(
        probability=prob,
        confidence=conf,
        model_id="rawnet2_pytorch",
        model_version="1.0.0",
        inference_latency_ms=0.0,
        status=status,
        metadata={"reason": "test"},
    )


def _risk_for_sequence(probs: list[float]):
    acoustic = _acoustic_ok()
    speaker = _speaker_no_enrolled()
    history = []
    risk_states = []
    for p in probs:
        synth = _synthetic(p)
        history.append(synth.probability)
        fused = fuse_evidence(synth, speaker, acoustic, history_synthetic_probs=history)
        risk_states.append(determine_risk_state(fused)["risk_state"])
    return risk_states


def test_temporal_isolated_high_spoof_not_critical():
    # Single high spoof should be tempered by temporal aggregation window size (effective_prob average)
    states = _risk_for_sequence([0.95])
    assert states[-1] != "CRITICAL"


def test_temporal_repeated_high_spoof_escalates():
    states = _risk_for_sequence([0.95, 0.95, 0.95, 0.95])
    assert states[-1] in ("HIGH_RISK", "CRITICAL")


def test_temporal_repeated_low_spoof_deescalates():
    states = _risk_for_sequence([0.05, 0.05, 0.05, 0.05])
    assert states[-1] in ("TRUSTED", "MONITOR", "SUSPICIOUS")


def test_temporal_alternating_high_low_stays_uncertain():
    states = _risk_for_sequence([0.9, 0.1, 0.9, 0.1, 0.9])
    # should not jump straight to CRITICAL on alternation
    assert "CRITICAL" not in states


def test_unavailable_detector_never_trusted():
    acoustic = _acoustic_ok()
    speaker = _speaker_no_enrolled()
    synth = _synthetic(0.95, status="MODEL_UNAVAILABLE")
    fused = fuse_evidence(synth, speaker, acoustic, history_synthetic_probs=[0.95])
    risk = determine_risk_state(fused)["risk_state"]
    assert risk != "TRUSTED"


def test_insufficient_audio_keeps_unverified_like_states():
    acoustic = _acoustic_ok()
    speaker = _speaker_no_enrolled()
    synth = _synthetic(0.95, status="INSUFFICIENT_AUDIO")
    fused = fuse_evidence(synth, speaker, acoustic, history_synthetic_probs=[0.95])
    risk = determine_risk_state(fused)["risk_state"]
    assert risk in ("INSUFFICIENT_EVIDENCE", "UNVERIFIED")


def test_low_pitch_genuine_audio_one_high_spike_does_not_critialize():
    # Simulate low-pitch genuine by mixing mostly-low probabilities with one high spike.
    states = _risk_for_sequence([0.12, 0.12, 0.9, 0.12, 0.12])
    assert states[2] != "CRITICAL"
