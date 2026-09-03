import pytest
from ..inference.dev_adapters import (
    DevSyntheticSpeechDetector,
    DevSpeakerVerifier,
    DevAcousticAnalyzer,
)
from ..websocket.handler import VoiceAnalysisManager

@pytest.fixture
def dev_synthetic_detector():
    return DevSyntheticSpeechDetector()

@pytest.fixture
def dev_speaker_verifier():
    return DevSpeakerVerifier()

@pytest.fixture
def dev_acoustic_analyzer():
    return DevAcousticAnalyzer()

@pytest.fixture
def manager(dev_synthetic_detector, dev_speaker_verifier, dev_acoustic_analyzer):
    return VoiceAnalysisManager(
        synthetic_detector=dev_synthetic_detector,
        speaker_verifier=dev_speaker_verifier,
        acoustic_analyzer=dev_acoustic_analyzer,
    )