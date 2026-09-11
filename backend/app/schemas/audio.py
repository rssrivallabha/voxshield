from pydantic import BaseModel, Field
from typing import Literal, Optional
import time
import uuid

class AudioChunkMessage(BaseModel):
    type: Literal["audio.chunk"] = "audio.chunk"
    session_id: str
    sequence_number: int
    timestamp_ms: float = Field(default_factory=lambda: time.time() * 1000)
    sample_rate: int = 16000
    channels: int = 1
    encoding: Literal["pcm_f32le", "pcm_s16le", "pcm_u8"] = "pcm_f32le"
    payload_b64: str
    chunk_duration_ms: float = 100.0

class StartSessionMessage(BaseModel):
    type: Literal["session.start"] = "session.start"
    session_id: str = Field(default_factory=lambda: f"sess_{uuid.uuid4().hex[:12]}")
    sample_rate: int = 16000
    channels: int = 1
    identity_id: Optional[str] = None

class StopSessionMessage(BaseModel):
    type: Literal["session.stop"] = "session.stop"
    session_id: str

class TelemetryUpdate(BaseModel):
    type: Literal["telemetry.update"] = "telemetry.update"
    session_id: str
    timestamp_ms: float
    sequence_ack: int
    audio_quality: dict
    acoustic_metrics: dict

class InferenceUpdate(BaseModel):
    type: Literal["inference.update"] = "inference.update"
    session_id: str
    timestamp_ms: float
    speaker_verification: Optional[dict] = None
    synthetic_speech: Optional[dict] = None
    acoustic_analysis: Optional[dict] = None
    raw_synthetic_probability: Optional[float] = None
    accumulated_synthetic_evidence: Optional[float] = None
    speaker_verification_evidence: Optional[float] = None

class RiskUpdate(BaseModel):
    type: Literal["risk.update"] = "risk.update"
    session_id: str
    timestamp_ms: float
    risk_state: str
    fused_risk_score: Optional[float] = None
    confidence: str
    evidence: list[dict]
    policy: Optional[dict] = None
    recommended_action: Optional[dict] = None
    final_risk_state: Optional[str] = None

class ErrorEvent(BaseModel):
    type: Literal["error"] = "error"
    session_id: str
    code: str
    message: str