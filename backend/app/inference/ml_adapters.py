import os
import time
import json
from typing import Optional
from pathlib import Path
import numpy as np

try:
    import onnxruntime as ort
except ImportError:
    ort = None

try:
    import librosa
except ImportError:
    librosa = None

from .interfaces import (
    SyntheticSpeechDetector,
    SpeakerVerifier,
    AcousticAnalyzer,
    SyntheticSpeechResult,
    SpeakerVerificationResult,
    AcousticAnalysisResult,
)


class RawNet2SyntheticDetector(SyntheticSpeechDetector):
    """ONNX-based RawNet2 synthetic speech detector for raw waveform input."""
    
    def __init__(self, model_path: Optional[str] = None, threshold: float = 0.5):
        self.threshold = threshold
        self.model_path = model_path or os.path.join(
            Path(__file__).parent.parent.parent, "models", "synthetic_speech", "rawnet2_best.onnx"
        )
        self.session = None
        self.model_available = False
        self._init_session()
    
    def _init_session(self) -> None:
        if not ort:
            return
        if not os.path.exists(self.model_path):
            return
        try:
            self.session = ort.InferenceSession(
                self.model_path,
                providers=['CPUExecutionProvider']
            )
            self.model_available = True
        except Exception:
            pass
    
    def detect(self, audio_samples: list[float], sample_rate: int) -> SyntheticSpeechResult:
        """Detect synthetic speech using RawNet2 ONNX model."""
        start_time = time.perf_counter()
        
        if sample_rate != 16000:
            return SyntheticSpeechResult(
                probability=0.0, confidence=0.0, model_id="rawnet2_onnx", model_version="1.0.0",
                inference_latency_ms=0.0, status="MODEL_UNAVAILABLE",
                metadata={"reason": f"Expected 16000 Hz, got {sample_rate}"},
            )
        
        min_samples = int(16000 * 1.0)
        if len(audio_samples) < min_samples:
            return SyntheticSpeechResult(
                probability=0.0, confidence=0.0, model_id="rawnet2_onnx", model_version="1.0.0",
                inference_latency_ms=0.0, status="INSUFFICIENT_AUDIO",
                metadata={"reason": f"Need >= 1.0s ({min_samples} samples), got {len(audio_samples)}"},
            )
        
        if not self.model_available or not self.session:
            return SyntheticSpeechResult(
                probability=0.0, confidence=0.0, model_id="rawnet2_onnx", model_version="1.0.0",
                inference_latency_ms=0.0, status="MODEL_UNAVAILABLE",
                metadata={"reason": "ONNX model artifact not found or runtime unavailable"},
            )
        
        try:
            audio_array = np.array(audio_samples, dtype=np.float32)
            
            if np.any(np.isnan(audio_array)) or np.any(np.isinf(audio_array)):
                return SyntheticSpeechResult(
                    probability=0.0, confidence=0.0, model_id="rawnet2_onnx", model_version="1.0.0",
                    inference_latency_ms=0.0, status="MODEL_UNAVAILABLE",
                    metadata={"reason": "Audio contains NaN or Inf"},
                )
            
            audio_array = audio_array.reshape(1, -1)
            input_name = self.session.get_inputs()[0].name
            outputs = self.session.run(None, {input_name: audio_array})
            
            logit = float(outputs[0][0][0])
            probability = 1.0 / (1.0 + np.exp(-logit))
            probability = float(np.clip(probability, 0.0, 1.0))
            confidence = abs(probability - 0.5) * 2.0
            confidence = float(np.clip(confidence, 0.0, 1.0))
            
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            
            return SyntheticSpeechResult(
                probability=round(probability, 4), confidence=round(confidence, 4),
                model_id="rawnet2_onnx", model_version="1.0.0",
                inference_latency_ms=round(elapsed_ms, 2), status="AVAILABLE",
                metadata={"logit": round(logit, 4), "audio_duration_s": round(len(audio_samples) / sample_rate, 2)},
            )
        except Exception as e:
            return SyntheticSpeechResult(
                probability=0.0, confidence=0.0, model_id="rawnet2_onnx", model_version="1.0.0",
                inference_latency_ms=0.0, status="MODEL_UNAVAILABLE",
                metadata={"reason": f"Inference error: {str(e)}"},
            )


class ECAPATDNNSpeakerVerifier(SpeakerVerifier):
    """ONNX-based ECAPA-TDNN speaker verification with enrollment support."""
    
    def __init__(self, model_path: Optional[str] = None, threshold: float = 0.6, enrollment_store: Optional[dict] = None):
        self.threshold = threshold
        self.model_path = model_path or os.path.join(
            Path(__file__).parent.parent.parent, "models", "speaker_verification", "ecapa_tdnn_best.onnx"
        )
        self.session = None
        self.model_available = False
        self.enrollment_store = enrollment_store or {}
        self._init_session()
    
    def _init_session(self) -> None:
        if not ort:
            return
        if not os.path.exists(self.model_path):
            return
        try:
            self.session = ort.InferenceSession(self.model_path, providers=['CPUExecutionProvider'])
            self.model_available = True
        except Exception:
            pass
    
    def _extract_mfcc(self, audio_samples: list[float], sample_rate: int) -> Optional[np.ndarray]:
        """Extract MFCC features for speaker embedding."""
        if not librosa:
            return None
        try:
            audio_array = np.array(audio_samples, dtype=np.float32)
            mfcc = librosa.feature.mfcc(
                y=audio_array, sr=sample_rate, n_mfcc=12, n_fft=512, hop_length=160,
                fmin=50, fmax=8000,
            )
            return mfcc.T
        except Exception:
            return None
    
    def _cosine_similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """Compute cosine similarity between two embeddings."""
        norm1 = np.linalg.norm(embedding1)
        norm2 = np.linalg.norm(embedding2)
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return float(np.dot(embedding1, embedding2) / (norm1 * norm2))
    
    def enroll(self, audio_samples: list[float], sample_rate: int, identity_id: str) -> bool:
        """Enroll a speaker (server-authoritative, backend-owned)."""
        if not self.model_available or not self.session or not librosa:
            return False
        if sample_rate != 16000:
            return False
        min_samples = int(16000 * 1.5)
        if len(audio_samples) < min_samples:
            return False
        try:
            mfcc = self._extract_mfcc(audio_samples, sample_rate)
            if mfcc is None:
                return False
            mfcc = np.expand_dims(mfcc, axis=0).astype(np.float32)
            input_name = self.session.get_inputs()[0].name
            embedding = self.session.run(None, {input_name: mfcc})[0]
            embedding = embedding.reshape(-1)
            self.enrollment_store[identity_id] = {"embedding": embedding.tolist(), "timestamp": time.time()}
            return True
        except Exception:
            return False
    
    def verify(
        self, audio_samples: list[float], sample_rate: int, identity_id: Optional[str]
    ) -> SpeakerVerificationResult:
        """Verify speaker identity using ECAPA-TDNN ONNX model."""
        start_time = time.perf_counter()
        
        if not identity_id:
            return SpeakerVerificationResult(
                similarity_score=None, confidence=None, identity_id="unknown",
                status="NO_ENROLLED_IDENTITY", inference_latency_ms=0.0,
                metadata={"reason": "No identity provided"},
            )
        
        if sample_rate != 16000:
            return SpeakerVerificationResult(
                similarity_score=None, confidence=None, identity_id=identity_id,
                status="MODEL_UNAVAILABLE", inference_latency_ms=0.0,
                metadata={"reason": f"Expected 16000 Hz, got {sample_rate}"},
            )
        
        min_samples = int(16000 * 1.5)
        if len(audio_samples) < min_samples:
            return SpeakerVerificationResult(
                similarity_score=None, confidence=None, identity_id=identity_id,
                status="INSUFFICIENT_AUDIO", inference_latency_ms=0.0,
                metadata={"reason": f"Need >= 1.5s ({min_samples} samples), got {len(audio_samples)}"},
            )
        
        if identity_id not in self.enrollment_store:
            return SpeakerVerificationResult(
                similarity_score=None, confidence=None, identity_id=identity_id,
                status="NO_ENROLLED_IDENTITY", inference_latency_ms=0.0,
                metadata={"reason": f"No enrollment found for {identity_id}"},
            )
        
        if not self.model_available or not self.session or not librosa:
            return SpeakerVerificationResult(
                similarity_score=None, confidence=None, identity_id=identity_id,
                status="MODEL_UNAVAILABLE", inference_latency_ms=0.0,
                metadata={"reason": "ONNX model artifact or librosa not available"},
            )
        
        try:
            audio_array = np.array(audio_samples, dtype=np.float32)
            
            if np.any(np.isnan(audio_array)) or np.any(np.isinf(audio_array)):
                return SpeakerVerificationResult(
                    similarity_score=None, confidence=None, identity_id=identity_id,
                    status="MODEL_UNAVAILABLE", inference_latency_ms=0.0,
                    metadata={"reason": "Audio contains NaN or Inf"},
                )
            
            mfcc = self._extract_mfcc(audio_samples, sample_rate)
            if mfcc is None:
                return SpeakerVerificationResult(
                    similarity_score=None, confidence=None, identity_id=identity_id,
                    status="MODEL_UNAVAILABLE", inference_latency_ms=0.0,
                    metadata={"reason": "MFCC extraction failed"},
                )
            
            mfcc = np.expand_dims(mfcc, axis=0).astype(np.float32)
            input_name = self.session.get_inputs()[0].name
            test_embedding = self.session.run(None, {input_name: mfcc})[0]
            test_embedding = test_embedding.reshape(-1)
            
            enrolled_embedding = np.array(self.enrollment_store[identity_id]["embedding"], dtype=np.float32)
            similarity = self._cosine_similarity(test_embedding, enrolled_embedding)
            similarity = float(np.clip(similarity, 0.0, 1.0))
            confidence = 1.0 - abs(similarity - self.threshold) / self.threshold
            confidence = float(np.clip(confidence, 0.0, 1.0))
            
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            
            return SpeakerVerificationResult(
                similarity_score=round(similarity, 4), confidence=round(confidence, 4),
                identity_id=identity_id, status="AVAILABLE",
                inference_latency_ms=round(elapsed_ms, 2),
                metadata={
                    "threshold": self.threshold,
                    "audio_duration_s": round(len(audio_samples) / sample_rate, 2),
                    "match": similarity > self.threshold,
                },
            )
        except Exception as e:
            return SpeakerVerificationResult(
                similarity_score=None, confidence=None, identity_id=identity_id,
                status="MODEL_UNAVAILABLE", inference_latency_ms=0.0,
                metadata={"reason": f"Verification error: {str(e)}"},
            )


class ImprovedAcousticAnalyzer(AcousticAnalyzer):
    """Enhanced acoustic analysis with real signal processing (no ML required)."""
    
    def analyze(self, audio_samples: list[float], sample_rate: int) -> AcousticAnalysisResult:
        """Analyze acoustic characteristics of audio signal."""
        start_time = time.perf_counter()
        
        if not audio_samples:
            return AcousticAnalysisResult(
                spectral_anomaly_score=0.0, voice_activity_detected=False,
                audio_quality_score=0.0, quality_status="SILENT", clipping_detected=False,
                sample_rate_hz=sample_rate, channels=1, estimated_noise_margin_db=0.0,
                inference_latency_ms=0.0,
            )
        
        try:
            audio_array = np.array(audio_samples, dtype=np.float32)
            
            sum_sq = np.sum(audio_array ** 2)
            rms = np.sqrt(sum_sq / len(audio_array))
            peak = np.max(np.abs(audio_array))
            
            import math
            rms_dbfs = 20 * math.log10(rms) if rms > 1e-10 else -96.0
            peak_dbfs = 20 * math.log10(peak) if peak > 1e-10 else -96.0
            noise_margin = max(0.0, rms_dbfs - (-60.0))
            
            voice_active = rms_dbfs > -45.0
            clipping = bool(peak >= 0.98)
            
            if rms_dbfs <= -50:
                quality, quality_score = "SILENT", 0.0
            elif clipping or rms_dbfs > -1:
                quality, quality_score = "DEGRADED", 0.3
            elif rms_dbfs < -35:
                quality, quality_score = "WARN", 0.7
            else:
                quality, quality_score = "PASS", 1.0
            
            spectral_anomaly = 0.8 if clipping else (0.5 if (voice_active and rms_dbfs > -10) else 0.0)
            
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            
            return AcousticAnalysisResult(
                spectral_anomaly_score=round(spectral_anomaly, 2),
                voice_activity_detected=voice_active,
                audio_quality_score=quality_score,
                quality_status=quality,
                clipping_detected=clipping,
                sample_rate_hz=sample_rate,
                channels=1,
                estimated_noise_margin_db=round(noise_margin, 1),
                inference_latency_ms=round(elapsed_ms, 2),
            )
        except Exception:
            return AcousticAnalysisResult(
                spectral_anomaly_score=0.0, voice_activity_detected=False,
                audio_quality_score=0.0, quality_status="SILENT", clipping_detected=False,
                sample_rate_hz=sample_rate, channels=1, estimated_noise_margin_db=0.0,
                inference_latency_ms=0.0,
            )
