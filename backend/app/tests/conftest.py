import pytest
from ..inference.ml_adapters import (
    RawNet2SyntheticDetector,
    ECAPATDNNSpeakerVerifier,
    ImprovedAcousticAnalyzer,
)
from ..websocket.handler import VoiceAnalysisManager

@pytest.fixture
def synthetic_detector():
    return RawNet2SyntheticDetector(model_path="/nonexistent/path.onnx")

@pytest.fixture
def speaker_verifier():
    return ECAPATDNNSpeakerVerifier(model_path="/nonexistent/path.onnx")

@pytest.fixture
def acoustic_analyzer():
    return ImprovedAcousticAnalyzer()

@pytest.fixture
def manager(synthetic_detector, speaker_verifier, acoustic_analyzer):
    return VoiceAnalysisManager(
        synthetic_detector=synthetic_detector,
        speaker_verifier=speaker_verifier,
        acoustic_analyzer=acoustic_analyzer,
    )