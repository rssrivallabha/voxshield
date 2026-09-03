from ..evidence.fusion import FusedEvidence, EvidenceSignal
from ..risk.engine import determine_risk_state

def test_insufficient_evidence_without_ml():
    fused = FusedEvidence(
        signals=[],
        fused_risk_score=None,
        confidence="NONE",
        available_signals=0,
        total_signals=3,
        has_any_ml_inference=False,
        summary="No ML",
    )
    result = determine_risk_state(fused)
    assert result["risk_state"] == "INSUFFICIENT_EVIDENCE"

def test_high_score_yields_critical():
    fused = FusedEvidence(
        signals=[],
        fused_risk_score=95.0,
        confidence="HIGH",
        available_signals=2,
        total_signals=3,
        has_any_ml_inference=True,
        summary="Critical",
    )
    result = determine_risk_state(fused)
    assert result["risk_state"] == "CRITICAL"

def test_low_score_yields_trusted():
    fused = FusedEvidence(
        signals=[],
        fused_risk_score=5.0,
        confidence="HIGH",
        available_signals=2,
        total_signals=3,
        has_any_ml_inference=True,
        summary="Low",
    )
    result = determine_risk_state(fused)
    assert result["risk_state"] == "TRUSTED"

def test_model_unavailable_not_trusted():
    """Model unavailable MUST NOT become TRUSTED."""
    fused = FusedEvidence(
        signals=[],
        fused_risk_score=None,
        confidence="NONE",
        available_signals=0,
        total_signals=3,
        has_any_ml_inference=False,
        summary="No ML",
    )
    result = determine_risk_state(fused)
    assert result["risk_state"] != "TRUSTED"