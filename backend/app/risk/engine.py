from typing import Optional
from ..evidence.fusion import FusedEvidence

RISK_STATES = [
    "TRUSTED", "MONITOR", "SUSPICIOUS", "HIGH_RISK", 
    "CRITICAL", "UNVERIFIED", "INSUFFICIENT_EVIDENCE"
]

def determine_risk_state(fused_evidence: FusedEvidence) -> dict:
    if fused_evidence.fused_risk_score is None:
        if fused_evidence.has_any_ml_inference:
            risk_state = "UNVERIFIED"
            reason = "ML inference available but insufficient data for risk determination."
        else:
            risk_state = "INSUFFICIENT_EVIDENCE"
            reason = "No ML inference connected. Risk cannot be determined without neural speaker and synthetic speech models."
    else:
        score = fused_evidence.fused_risk_score
        if score >= 80:
            risk_state = "CRITICAL"
            reason = f"Fused risk score {score:.0f} exceeds critical threshold (80). Strong evidence of manipulation."
        elif score >= 60:
            risk_state = "HIGH_RISK"
            reason = f"Fused risk score {score:.0f} exceeds high-risk threshold (60). Verification required."
        elif score >= 40:
            risk_state = "SUSPICIOUS"
            reason = f"Fused risk score {score:.0f} exceeds suspicious threshold (40). Anomalous indicators detected."
        elif score >= 20:
            risk_state = "MONITOR"
            reason = f"Fused risk score {score:.0f} exceeds monitor threshold (20). Minor anomalies observed."
        else:
            risk_state = "TRUSTED"
            reason = f"Fused risk score {score:.0f} is below all alert thresholds. No indicators of manipulation."
    
    return {
        "risk_state": risk_state,
        "reason": reason,
        "fused_risk_score": fused_evidence.fused_risk_score,
        "confidence": fused_evidence.confidence,
    }