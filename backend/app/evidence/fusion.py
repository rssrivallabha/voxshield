from dataclasses import dataclass, field
from typing import Optional
from ..inference.interfaces import (
    SyntheticSpeechResult,
    SpeakerVerificationResult,
    AcousticAnalysisResult,
)

@dataclass
class EvidenceSignal:
    signal_type: str
    name: str
    points: Optional[float]
    status: str
    description: str
    severity: str

@dataclass
class FusedEvidence:
    signals: list[EvidenceSignal]
    fused_risk_score: Optional[float]
    confidence: str
    available_signals: int
    total_signals: int
    has_any_ml_inference: bool
    summary: str

def fuse_evidence(
    synthetic: SyntheticSpeechResult,
    speaker: SpeakerVerificationResult,
    acoustic: AcousticAnalysisResult,
) -> FusedEvidence:
    signals: list[EvidenceSignal] = []
    has_any_ml = False
    
    if synthetic.status == "AVAILABLE":
        has_any_ml = True
        synth_points = synthetic.probability * 50
        signals.append(EvidenceSignal(
            signal_type="synthetic_speech",
            name="Neural Synthetic Speech Detector",
            points=round(synth_points, 1),
            status="ACTIVE",
            description=f"Synthetic probability: {synthetic.probability:.1%} (confidence: {synthetic.confidence:.1%})",
            severity="critical" if synthetic.probability > 0.8 else "high" if synthetic.probability > 0.5 else "low",
        ))
    else:
        signals.append(EvidenceSignal(
            signal_type="synthetic_speech",
            name="Neural Synthetic Speech Detector",
            points=None,
            status="UNAVAILABLE",
            description=f"Model unavailable: {synthetic.status}",
            severity="low",
        ))
    
    if speaker.status == "AVAILABLE" and speaker.similarity_score is not None:
        has_any_ml = True
        mismatch = 1.0 - speaker.similarity_score
        speaker_points = mismatch * 40
        signals.append(EvidenceSignal(
            signal_type="speaker_verification",
            name="Speaker Embedding Verification",
            points=round(speaker_points, 1),
            status="ACTIVE",
            description=f"Speaker similarity: {speaker.similarity_score:.1%} (mismatch: {mismatch:.1%})",
            severity="high" if mismatch > 0.3 else "medium" if mismatch > 0.15 else "low",
        ))
    elif speaker.status == "NO_ENROLLED_IDENTITY":
        signals.append(EvidenceSignal(
            signal_type="speaker_verification",
            name="Speaker Embedding Verification",
            points=None,
            status="INSUFFICIENT",
            description="No enrolled identity profile available for verification",
            severity="low",
        ))
    else:
        signals.append(EvidenceSignal(
            signal_type="speaker_verification",
            name="Speaker Embedding Verification",
            points=None,
            status="UNAVAILABLE",
            description=f"Model unavailable: {speaker.status}",
            severity="low",
        ))
    
    if acoustic.quality_status in ("SILENT",):
        signals.append(EvidenceSignal(
            signal_type="acoustic_analysis",
            name="Acoustic / Spectral Analysis",
            points=0.0,
            status="INSUFFICIENT",
            description="Audio quality insufficient for spectral analysis",
            severity="low",
        ))
    else:
        ac_points = acoustic.spectral_anomaly_score * 20
        signals.append(EvidenceSignal(
            signal_type="acoustic_analysis",
            name="Acoustic / Spectral Analysis",
            points=round(ac_points, 1),
            status="ACTIVE",
            description=f"Quality: {acoustic.quality_status} | VAD: {'Active' if acoustic.voice_activity_detected else 'Silent'} | SNR margin: {acoustic.estimated_noise_margin_db:.1f}dB",
            severity="high" if acoustic.spectral_anomaly_score > 0.7 else "medium" if acoustic.spectral_anomaly_score > 0.3 else "low",
        ))
    
    available_points = [s.points for s in signals if s.points is not None]
    
    if len(available_points) == 0 or not has_any_ml:
        fused_score = None
        confidence = "NONE"
        summary = "No ML inference available. Acoustic analysis only. Risk cannot be determined without backend neural models."
    else:
        fused_score = round(sum(available_points), 1)
        if has_any_ml:
            confidence = "HIGH"
        else:
            confidence = "MEDIUM"
        summary = f"{len(available_points)} signal(s) active. Fused risk score: {fused_score:.0f}"
    
    return FusedEvidence(
        signals=signals,
        fused_risk_score=fused_score,
        confidence=confidence,
        available_signals=len(available_points),
        total_signals=len(signals),
        has_any_ml_inference=has_any_ml,
        summary=summary,
    )