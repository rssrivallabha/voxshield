from typing import Optional
from .interfaces import (
    SyntheticSpeechDetector,
    SpeakerVerifier,
    AcousticAnalyzer,
    SyntheticSpeechResult,
    SpeakerVerificationResult,
    AcousticAnalysisResult,
)

class DevSyntheticSpeechDetector(SyntheticSpeechDetector):
    def detect(self, audio_samples: list[float], sample_rate: int) -> SyntheticSpeechResult:
        return SyntheticSpeechResult(
            probability=0.0,
            confidence=0.0,
            model_id="dev_stub_v0",
            model_version="0.0.0-dev",
            inference_latency_ms=0.0,
            status="MODEL_UNAVAILABLE",
            metadata={"message": "No real synthetic speech detector connected. Install ONNX/Torch model for production inference."},
        )

class DevSpeakerVerifier(SpeakerVerifier):
    def verify(
        self, audio_samples: list[float], sample_rate: int, identity_id: Optional[str]
    ) -> SpeakerVerificationResult:
        return SpeakerVerificationResult(
            similarity_score=None,
            confidence=None,
            identity_id=identity_id or "unknown",
            status="NO_ENROLLED_IDENTITY" if not identity_id else "MODEL_UNAVAILABLE",
            inference_latency_ms=0.0,
            metadata={"message": "No real speaker verification model connected. Install ECAPA-TDNN / x-vector model for production inference."},
        )

class DevAcousticAnalyzer(AcousticAnalyzer):
    def analyze(
        self, audio_samples: list[float], sample_rate: int
    ) -> AcousticAnalysisResult:
        if not audio_samples:
            return AcousticAnalysisResult(
                spectral_anomaly_score=0.0,
                voice_activity_detected=False,
                audio_quality_score=0.0,
                quality_status="SILENT",
                clipping_detected=False,
                sample_rate_hz=sample_rate,
                channels=1,
                estimated_noise_margin_db=0.0,
                inference_latency_ms=0.0,
            )
        
        sum_sq = sum(s * s for s in audio_samples)
        rms = (sum_sq / len(audio_samples)) ** 0.5
        peak = max(abs(s) for s in audio_samples)
        
        import math
        rms_dbfs = 20 * math.log10(rms) if rms > 1e-10 else -96.0
        peak_dbfs = 20 * math.log10(peak) if peak > 1e-10 else -96.0
        noise_margin = max(0.0, rms_dbfs - (-60.0))
        
        voice_active = rms_dbfs > -45.0
        clipping = peak >= 0.98
        
        if rms_dbfs <= -50:
            quality = "SILENT"
            quality_score = 0.0
        elif clipping or rms_dbfs > -1:
            quality = "DEGRADED"
            quality_score = 0.3
        elif rms_dbfs < -35:
            quality = "WARN"
            quality_score = 0.7
        else:
            quality = "PASS"
            quality_score = 1.0
        
        return AcousticAnalysisResult(
            spectral_anomaly_score=0.0,
            voice_activity_detected=voice_active,
            audio_quality_score=quality_score,
            quality_status=quality,
            clipping_detected=clipping,
            sample_rate_hz=sample_rate,
            channels=1,
            estimated_noise_margin_db=round(noise_margin, 1),
            inference_latency_ms=0.0,
        )