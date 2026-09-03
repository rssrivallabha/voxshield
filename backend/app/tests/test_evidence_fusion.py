from ..inference.interfaces import SyntheticSpeechResult, SpeakerVerificationResult, AcousticAnalysisResult
from ..evidence.fusion import fuse_evidence

def test_all_unavailable_yields_no_ml():
    synth = SyntheticSpeechResult(0.0, 0.0, "test", "0.0", 0.0, "MODEL_UNAVAILABLE")
    spk = SpeakerVerificationResult(None, None, "user", "MODEL_UNAVAILABLE", 0.0)
    ac = AcousticAnalysisResult(0.0, True, 1.0, "PASS", False, 16000, 1, 20.0, 0.0)
    
    result = fuse_evidence(synth, spk, ac)
    assert result.has_any_ml_inference is False
    assert result.fused_risk_score is None
    assert result.confidence == "NONE"

def test_available_synthetic_increases_score():
    synth = SyntheticSpeechResult(0.95, 0.9, "test", "1.0", 1.0, "AVAILABLE")
    spk = SpeakerVerificationResult(None, None, "user", "NO_ENROLLED_IDENTITY", 0.0)
    ac = AcousticAnalysisResult(0.1, True, 1.0, "PASS", False, 16000, 1, 20.0, 0.0)
    
    result = fuse_evidence(synth, spk, ac)
    assert result.has_any_ml_inference is True
    assert result.fused_risk_score is not None
    assert result.fused_risk_score > 0

def test_silence_is_insufficient():
    synth = SyntheticSpeechResult(0.0, 0.0, "test", "0.0", 0.0, "MODEL_UNAVAILABLE")
    spk = SpeakerVerificationResult(None, None, "user", "MODEL_UNAVAILABLE", 0.0)
    ac = AcousticAnalysisResult(0.0, False, 0.0, "SILENT", False, 16000, 1, 0.0, 0.0)
    
    result = fuse_evidence(synth, spk, ac)
    assert result.has_any_ml_inference is False
    assert result.fused_risk_score is None