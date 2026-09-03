import json
import time
import uuid
import base64
import struct
import asyncio
from typing import Optional

from fastapi import WebSocket, WebSocketDisconnect
import structlog

from ..schemas.protocol import (
    AudioChunkMessage,
    StartSessionMessage,
    TelemetryUpdate,
    InferenceUpdate,
    RiskUpdate,
    ErrorEvent,
)
from ..audio.preprocessor import preprocess_chunk, PreprocessedAudio
from ..inference.interfaces import SyntheticSpeechDetector, SpeakerVerifier, AcousticAnalyzer
from ..evidence.fusion import fuse_evidence, FusedEvidence
from ..risk.engine import determine_risk_state
from ..policy.engine import evaluate_policies, get_recommended_action

logger = structlog.get_logger()

MAX_WS_MESSAGE_SIZE = 1 * 1024 * 1024
SESSION_IDLE_TIMEOUT_S = 60.0

class VoiceAnalysisSession:
    def __init__(self, session_id: str, identity_id: Optional[str] = None):
        self.session_id = session_id
        self.identity_id = identity_id
        self.created_at = time.time()
        self.last_activity_at = time.time()
        self.chunk_count = 0
        self.last_sequence: Optional[int] = None
        self.risk_state = "INSUFFICIENT_EVIDENCE"
        self.fused_risk_score: Optional[float] = None
        self.confidence = "NONE"
        self.current_policy: Optional[dict] = None
        self.total_audio_samples = 0

class VoiceAnalysisManager:
    def __init__(
        self,
        synthetic_detector: SyntheticSpeechDetector,
        speaker_verifier: SpeakerVerifier,
        acoustic_analyzer: AcousticAnalyzer,
    ):
        self.synthetic_detector = synthetic_detector
        self.speaker_verifier = speaker_verifier
        self.acoustic_analyzer = acoustic_analyzer
        self._sessions: dict[str, VoiceAnalysisSession] = {}

    async def handle_websocket(self, ws: WebSocket) -> None:
        await ws.accept()
        
        session: Optional[VoiceAnalysisSession] = None
        audio_buffer: list[float] = []
        BUFFER_CHUNKS_FOR_INFERENCE = 10
        
        try:
            while True:
                raw = await asyncio.wait_for(ws.receive_bytes(), timeout=SESSION_IDLE_TIMEOUT_S)
                
                if len(raw) > MAX_WS_MESSAGE_SIZE:
                    await ws.send_bytes(
                        json.dumps(ErrorEvent(
                            session_id=session.session_id if session else "unknown",
                            code="MESSAGE_TOO_LARGE",
                            message=f"Message exceeds {MAX_WS_MESSAGE_SIZE} bytes",
                        ).model_dump()).encode()
                    )
                    continue
                
                try:
                    msg_data = json.loads(raw)
                except json.JSONDecodeError:
                    if session:
                        await ws.send_bytes(
                            json.dumps(ErrorEvent(
                                session_id=session.session_id,
                                code="MALFORMED_MESSAGE",
                                message="Invalid JSON",
                            ).model_dump()).encode()
                        )
                    continue
                
                msg_type = msg_data.get("type", "")
                
                if msg_type == "session.start":
                    session_model = StartSessionMessage(**msg_data)
                    session = VoiceAnalysisSession(
                        session_id=session_model.session_id,
                        identity_id=session_model.identity_id,
                    )
                    self._sessions[session.session_id] = session
                    audio_buffer = []
                    
                    await ws.send_bytes(json.dumps({
                        "type": "session.started",
                        "session_id": session.session_id,
                        "timestamp_ms": time.time() * 1000,
                        "message": "Voice analysis session initialized",
                    }).encode())
                    logger.info("session.started", session_id=session.session_id, identity=session.identity_id)
                    
                elif msg_type == "audio.chunk" and session:
                    chunk = AudioChunkMessage(**msg_data)
                    
                    if session.last_sequence is not None and chunk.sequence_number <= session.last_sequence:
                        await ws.send_bytes(json.dumps(ErrorEvent(
                            session_id=session.session_id,
                            code="SEQUENCE_ERROR",
                            message=f"Out-of-order chunk: got {chunk.sequence_number}, expected > {session.last_sequence}",
                        ).model_dump()).encode())
                        continue
                    
                    session.last_sequence = chunk.sequence_number
                    session.last_activity_at = time.time()
                    session.chunk_count += 1
                    
                    pre_start = time.time()
                    preprocessed = preprocess_chunk(
                        chunk.payload_b64,
                        chunk.encoding,
                        chunk.sample_rate,
                        chunk.channels,
                        chunk.chunk_duration_ms,
                    )
                    pre_ms = (time.time() - pre_start) * 1000
                    
                    if preprocessed is None:
                        await ws.send_bytes(json.dumps(ErrorEvent(
                            session_id=session.session_id,
                            code="PREPROCESSING_ERROR",
                            message="Failed to decode or preprocess audio chunk",
                        ).model_dump()).encode())
                        continue
                    
                    session.total_audio_samples += len(preprocessed.pcm_float32)
                    
                    audio_buffer.extend(preprocessed.pcm_float32)
                    
                    telemetry = TelemetryUpdate(
                        session_id=session.session_id,
                        timestamp_ms=time.time() * 1000,
                        sequence_ack=chunk.sequence_number,
                        audio_quality={
                            "status": preprocessed.is_silence and "SILENT" or "PASS",
                            "rms_dbfs": preprocessed.rms_dbfs,
                            "peak_dbfs": preprocessed.peak_dbfs,
                            "is_silence": preprocessed.is_silence,
                            "clipping": preprocessed.clipping_detected,
                            "noise_margin_db": preprocessed.estimated_noise_floor_margin_db,
                        },
                        acoustic_metrics={
                            "duration_ms": preprocessed.duration_ms,
                            "sample_rate": preprocessed.sample_rate,
                            "total_samples": session.total_audio_samples,
                            "preprocessing_latency_ms": round(pre_ms, 2),
                        },
                    )
                    await ws.send_bytes(telemetry.model_dump_json().encode())
                    
                    if len(audio_buffer) >= 2048:
                        inf_start = time.time()
                        
                        acoustic_result = self.acoustic_analyzer.analyze(
                            audio_buffer, preprocessed.sample_rate
                        )
                        
                        synth_result = self.synthetic_detector.detect(
                            audio_buffer, preprocessed.sample_rate
                        )
                        speaker_result = self.speaker_verifier.verify(
                            audio_buffer, preprocessed.sample_rate, session.identity_id
                        )
                        
                        inf_ms = (time.time() - inf_start) * 1000
                        
                        inf_event = InferenceUpdate(
                            session_id=session.session_id,
                            timestamp_ms=time.time() * 1000,
                            speaker_verification={
                                "similarity_score": speaker_result.similarity_score,
                                "confidence": speaker_result.confidence,
                                "status": speaker_result.status,
                                "identity_id": speaker_result.identity_id,
                                "latency_ms": speaker_result.inference_latency_ms,
                            },
                            synthetic_speech={
                                "probability": synth_result.probability,
                                "confidence": synth_result.confidence,
                                "status": synth_result.status,
                                "model_id": synth_result.model_id,
                                "latency_ms": synth_result.inference_latency_ms,
                            },
                            acoustic_analysis={
                                "quality_status": acoustic_result.quality_status,
                                "quality_score": acoustic_result.audio_quality_score,
                                "voice_activity": acoustic_result.voice_activity_detected,
                                "spectral_anomaly": acoustic_result.spectral_anomaly_score,
                                "clipping": acoustic_result.clipping_detected,
                                "latency_ms": acoustic_result.inference_latency_ms,
                            },
                        )
                        await ws.send_bytes(inf_event.model_dump_json().encode())
                        
                        fuse_start = time.time()
                        fused = fuse_evidence(synth_result, speaker_result, acoustic_result)
                        fuse_ms = (time.time() - fuse_start) * 1000
                        
                        risk_start = time.time()
                        risk_result = determine_risk_state(fused)
                        risk_ms = (time.time() - risk_start) * 1000
                        
                        policy_trigger = evaluate_policies(
                            risk_result["risk_state"],
                            risk_result["fused_risk_score"],
                            session.session_id,
                        )
                        recommended = get_recommended_action(
                            risk_result["risk_state"], policy_trigger
                        )
                        
                        session.risk_state = risk_result["risk_state"]
                        session.fused_risk_score = risk_result["fused_risk_score"]
                        session.confidence = risk_result["confidence"]
                        session.current_policy = policy_trigger
                        
                        risk_event = RiskUpdate(
                            session_id=session.session_id,
                            timestamp_ms=time.time() * 1000,
                            risk_state=risk_result["risk_state"],
                            fused_risk_score=risk_result["fused_risk_score"],
                            confidence=risk_result["confidence"],
                            evidence=[
                                {
                                    "signal": s.name,
                                    "points": s.points,
                                    "status": s.status,
                                    "description": s.description,
                                    "severity": s.severity,
                                }
                                for s in fused.signals
                            ],
                            policy=policy_trigger,
                            recommended_action=recommended,
                        )
                        await ws.send_bytes(risk_event.model_dump_json().encode())
                        
                        audio_buffer = audio_buffer[-512:]
                
                elif msg_type == "session.stop" and session:
                    await ws.send_bytes(json.dumps({
                        "type": "session.stopped",
                        "session_id": session.session_id,
                        "timestamp_ms": time.time() * 1000,
                        "total_chunks": session.chunk_count,
                    }).encode())
                    break
                
        except WebSocketDisconnect:
            logger.info("ws.disconnect", session_id=session.session_id if session else None)
        except asyncio.TimeoutError:
            logger.warn("ws.timeout", session_id=session.session_id if session else None)
            if session:
                await ws.send_bytes(json.dumps(ErrorEvent(
                    session_id=session.session_id,
                    code="SESSION_TIMEOUT",
                    message="Session timed out due to inactivity",
                ).model_dump()).encode())
        except Exception as e:
            logger.error("ws.error", error=str(e))
            if session:
                await ws.send_bytes(json.dumps(ErrorEvent(
                    session_id=session.session_id,
                    code="INTERNAL_ERROR",
                    message=str(e),
                ).model_dump()).encode())
        finally:
            if session and session.session_id in self._sessions:
                del self._sessions[session.session_id]
            try:
                await ws.close()
            except Exception:
                pass