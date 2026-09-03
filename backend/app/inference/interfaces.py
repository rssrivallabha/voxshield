from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional
import time

@dataclass
class SyntheticSpeechResult:
    probability: float
    confidence: float
    model_id: str
    model_version: str
    inference_latency_ms: float
    status: str
    metadata: dict = field(default_factory=dict)

@dataclass
class SpeakerVerificationResult:
    similarity_score: Optional[float]
    confidence: Optional[float]
    identity_id: str
    status: str
    inference_latency_ms: float
    metadata: dict = field(default_factory=dict)

@dataclass
class AcousticAnalysisResult:
    spectral_anomaly_score: float
    voice_activity_detected: bool
    audio_quality_score: float
    quality_status: str
    clipping_detected: bool
    sample_rate_hz: int
    channels: int
    estimated_noise_margin_db: float
    inference_latency_ms: float
    metadata: dict = field(default_factory=dict)

class SyntheticSpeechDetector(ABC):
    @abstractmethod
    def detect(self, audio_samples: list[float], sample_rate: int) -> SyntheticSpeechResult:
        ...

class SpeakerVerifier(ABC):
    @abstractmethod
    def verify(
        self, audio_samples: list[float], sample_rate: int, identity_id: Optional[str]
    ) -> SpeakerVerificationResult:
        ...

class AcousticAnalyzer(ABC):
    @abstractmethod
    def analyze(
        self, audio_samples: list[float], sample_rate: int
    ) -> AcousticAnalysisResult:
        ...