import os
import time
import json
import torch
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
    """PyTorch RawNet2 synthetic speech detector using best.pt checkpoint."""

    _RAWNET2_CONFIG = {
        "sinc_filters": 128,
        "sinc_filter_length": 129,
        "sample_rate": 16000,
        "sinc_scale": "linear",
        "learnable_sinc": False,
        "first_block_channels": 128,
        "second_block_channels": 512,
        "num_first_blocks": 2,
        "num_second_blocks": 4,
        "gru_hidden": 1024,
        "embedding_dim": 1024,
        "class_weights": [8.837, 1.0],
    }

    def __init__(self, model_path: Optional[str] = None, threshold: float = 0.5):
        from .rawnet2.model import RawNet2Model
        self.threshold = threshold
        self.model_path = model_path or str(
            Path(__file__).resolve().parent.parent.parent / "models" / "synthetic_speech" / "best.pt"
        )
        self.model: Optional[torch.nn.Module] = None
        self.model_available = False
        self.model_error: Optional[str] = None
        try:
            if not os.path.exists(self.model_path):
                self.model_error = f"Checkpoint not found: {self.model_path}"
                return
            net = RawNet2Model(self._RAWNET2_CONFIG)
            ckpt = torch.load(self.model_path, map_location="cpu", weights_only=False)
            net.load_state_dict(ckpt["model_state_dict"], strict=True)
            net.eval()
            self.model = net
            self.model_available = True
        except Exception as e:
            self.model_error = str(e)
            self.model = None
            self.model_available = False

    def detect(self, audio_samples: list[float], sample_rate: int) -> SyntheticSpeechResult:
        start_time = time.perf_counter()

        if sample_rate != 16000:
            return SyntheticSpeechResult(
                probability=0.0, confidence=0.0, model_id="rawnet2_pytorch", model_version="1.0.0",
                inference_latency_ms=0.0, status="MODEL_UNAVAILABLE",
                metadata={"reason": f"Expected 16000 Hz, got {sample_rate}"},
            )

        min_samples = int(16000 * 1.0)
        if len(audio_samples) < min_samples:
            return SyntheticSpeechResult(
                probability=0.0, confidence=0.0, model_id="rawnet2_pytorch", model_version="1.0.0",
                inference_latency_ms=0.0, status="INSUFFICIENT_AUDIO",
                metadata={"reason": f"Need >= 1.0s ({min_samples} samples), got {len(audio_samples)}"},
            )

        if not self.model_available or self.model is None:
            return SyntheticSpeechResult(
                probability=0.0, confidence=0.0, model_id="rawnet2_pytorch", model_version="1.0.0",
                inference_latency_ms=0.0, status="MODEL_UNAVAILABLE",
                metadata={"reason": self.model_error or "Model not loaded"},
            )

        try:
            audio_array = np.array(audio_samples, dtype=np.float32)
            if np.any(np.isnan(audio_array)) or np.any(np.isinf(audio_array)):
                return SyntheticSpeechResult(
                    probability=0.0, confidence=0.0, model_id="rawnet2_pytorch", model_version="1.0.0",
                    inference_latency_ms=0.0, status="MODEL_UNAVAILABLE",
                    metadata={"reason": "Audio contains NaN or Inf"},
                )

            x = torch.from_numpy(audio_array).unsqueeze(0)
            with torch.no_grad():
                output = self.model({"waveform": x})

            logits = output["logits"]
            probs = torch.softmax(logits, dim=1)[0]
            spoof_prob = float(probs[0].item())
            bonafide_prob = float(probs[1].item())
            probability = float(np.clip(spoof_prob, 0.0, 1.0))
            confidence = abs(probability - 0.5) * 2.0
            confidence = float(np.clip(confidence, 0.0, 1.0))

            elapsed_ms = (time.perf_counter() - start_time) * 1000

            return SyntheticSpeechResult(
                probability=round(probability, 4),
                confidence=round(confidence, 4),
                model_id="rawnet2_pytorch",
                model_version="1.0.0",
                inference_latency_ms=round(elapsed_ms, 2),
                status="AVAILABLE",
                metadata={
                    "spoof_prob": round(spoof_prob, 4),
                    "bonafide_prob": round(bonafide_prob, 4),
                    "audio_duration_s": round(len(audio_samples) / sample_rate, 2),
                },
            )
        except Exception as e:
            return SyntheticSpeechResult(
                probability=0.0, confidence=0.0, model_id="rawnet2_pytorch", model_version="1.0.0",
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
        self.model_error: Optional[str] = None
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
        """Extract 80-band log mel filterbank features for ECAPA-TDNN."""
        if not librosa:
            return None
        try:
            audio_array = np.array(audio_samples, dtype=np.float32)
            mel = librosa.feature.melspectrogram(
                y=audio_array, sr=sample_rate, n_mels=80, n_fft=512, hop_length=160,
                fmin=50, fmax=8000,
            )
            log_mel = librosa.power_to_db(mel, ref=np.max)
            return log_mel.T
        except Exception:
            return None
    
    def _cosine_similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """Compute cosine similarity between two embeddings."""
        norm1 = np.linalg.norm(embedding1)
        norm2 = np.linalg.norm(embedding2)
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return float(np.dot(embedding1, embedding2) / (norm1 * norm2))
    
    def enroll(self, audio_samples: list[float], sample_rate: int, identity_id: str, enrollment_audio_duration_s: float = 1.5) -> bool:
        """Enroll a speaker (server-authoritative, backend-owned)."""
        if not self.model_available or not self.session or not librosa:
            return False
        if sample_rate != 16000:
            return False
        min_samples = int(16000 * enrollment_audio_duration_s)
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
