import asyncio
import json
import time
from typing import Optional

import structlog
from fastapi import WebSocket, WebSocketDisconnect

from ..audio.preprocessor import preprocess_chunk
from ..evidence.fusion import fuse_evidence
from ..inference.interfaces import AcousticAnalyzer, SpeakerVerifier, SyntheticSpeechDetector
from ..inference.identity_service import identity_service
from ..policy.engine import evaluate_policies, get_recommended_action
from ..risk.engine import determine_risk_state
from ..schemas.protocol import (
    AudioChunkMessage,
    ErrorEvent,
    InferenceUpdate,
    RiskUpdate,
    StartSessionMessage,
    TelemetryUpdate,
)
from .telemetry_instrumentation import StageTiming, now_ms


logger = structlog.get_logger()

MAX_WS_MESSAGE_SIZE = 1 * 1024 * 1024
SESSION_IDLE_TIMEOUT_S = 60.0
RAWNET2_SAMPLE_RATE = 16000
RAWNET2_WINDOW_SAMPLES = 64000
RAWNET2_STRIDE_SAMPLES = 16000


def to_mono_16k(samples: list[float], sample_rate: int, channels: int) -> list[float]:
    if sample_rate <= 0 or channels <= 0:
        raise ValueError("Invalid audio format")
    if channels > 1:
        frame_count = len(samples) // channels
        samples = [
            sum(samples[index * channels:(index + 1) * channels]) / channels
            for index in range(frame_count)
        ]
    if not samples or sample_rate == RAWNET2_SAMPLE_RATE:
        return samples
    target_length = round(len(samples) * RAWNET2_SAMPLE_RATE / sample_rate)
    if target_length <= 0:
        return []
    if len(samples) == 1:
        return [samples[0]] * target_length
    scale = (len(samples) - 1) / (target_length - 1) if target_length > 1 else 0
    return [
        samples[int(position)] * (1.0 - (position - int(position)))
        + samples[min(int(position) + 1, len(samples) - 1)] * (position - int(position))
        for position in (index * scale for index in range(target_length))
    ]


class VoiceAnalysisSession:
    def __init__(self, session_id: str, identity_id: Optional[str] = None):
        self.session_id = session_id
        self.identity_id = identity_id
        self.created_at = time.time()
        self.last_activity_at = self.created_at
        self.chunk_count = 0
        self.last_sequence: Optional[int] = None
        self.risk_state = "INSUFFICIENT_EVIDENCE"
        self.fused_risk_score: Optional[float] = None
        self.confidence = "NONE"
        self.current_policy: Optional[dict] = None
        self.total_audio_samples = 0
        self.audio_buffer: list[float] = []
        self.samples_since_window = 0
        self.pending_window: Optional[list[float]] = None
        self.inference_task: Optional[asyncio.Task] = None
        self.send_lock = asyncio.Lock()
        self.active = True
        self.window_count = 0
        self.inference_count = 0
        self.history: list[dict] = []
        self.last_stage_timing: Optional[StageTiming] = None
        self.latest_pending_seq: Optional[int] = None
        self.last_inference_seq: Optional[int] = None
        self.active_inference_count = 0
        self.synthetic_prob_history: list[float] = []
        self.max_pending_depth = 0
        self.coalesced_dropped_windows = 0
        self.stale_windows_prevented = 0
        self.pending_depth = 0
        import os
        self._diagnostics_enabled = os.getenv("VOX_DIAGNOSTICS", "0") == "1"

        if identity_id and identity_service:
            identity = identity_service.get_identity(identity_id)
            if identity and identity.enrollment_status != "VERIFIED":
                self.identity_id = None
                self.risk_state = "NO_ENROLLED_IDENTITY"
                self.fused_risk_score = None
                self.confidence = "NONE"
                self.current_policy = None
                self.history.append({
                    "timestamp_ms": time.time() * 1000,
                    "fused_risk_score": None,
                    "risk_state": "NO_ENROLLED_IDENTITY",
                    "confidence": "NONE",
                })

    def summary(self) -> dict:
        return {
            "session_id": self.session_id,
            "identity_id": self.identity_id,
            "started_at_ms": round(self.created_at * 1000),
            "last_activity_at_ms": round(self.last_activity_at * 1000),
            "duration_ms": round((time.time() - self.created_at) * 1000),
            "chunk_count": self.chunk_count,
            "total_audio_samples": self.total_audio_samples,
            "buffered_samples": len(self.audio_buffer),
            "window_count": self.window_count,
            "inference_count": self.inference_count,
            "risk_state": self.risk_state,
            "fused_risk_score": self.fused_risk_score,
            "confidence": self.confidence,
            "policy": self.current_policy,
            "history": list(self.history),
        }


class VoiceAnalysisManager:
    def __init__(
        self,
        synthetic_detector: SyntheticSpeechDetector,
        speaker_verifier: SpeakerVerifier,
        acoustic_analyzer: AcousticAnalyzer,
        window_samples: int = RAWNET2_WINDOW_SAMPLES,
        stride_samples: int = RAWNET2_STRIDE_SAMPLES,
        inference_min_queue_samples: int = 0,
    ):
        if window_samples <= 0 or stride_samples <= 0 or stride_samples > window_samples:
            raise ValueError("Window and stride must be positive and stride must not exceed window")
        self.inference_min_queue_samples = max(0, inference_min_queue_samples)
        self.synthetic_detector = synthetic_detector
        self.speaker_verifier = speaker_verifier
        self.acoustic_analyzer = acoustic_analyzer
        self.window_samples = window_samples
        self.stride_samples = stride_samples
        self._sessions: dict[str, VoiceAnalysisSession] = {}

    def get_active_sessions(self) -> list[dict]:
        return [session.summary() for session in self._sessions.values() if session.active]

    def _queue_latest_window(
        self,
        session: VoiceAnalysisSession,
        samples: list[float],
        chunk_seq: int,
        ws: Optional[WebSocket] = None,
    ) -> None:
        if not samples:
            return
        session.latest_pending_seq = chunk_seq
        if session.last_stage_timing is None:
            session.last_stage_timing = StageTiming(chunk_seq=chunk_seq, t_capture_ms=now_ms(), t_ws_send_ms=0.0, t_ws_recv_ms=0.0,
                                                      t_preprocess_start_ms=0.0, t_preprocess_end_ms=0.0, t_window_ready_ms=0.0,
                                                      t_queue_depth=0)
        session.total_audio_samples += len(samples)
        session.audio_buffer.extend(samples)
        if len(session.audio_buffer) > self.window_samples:
            del session.audio_buffer[:-self.window_samples]
        if len(session.audio_buffer) < self.inference_min_queue_samples:
            return
        if len(session.audio_buffer) < self.window_samples:
            return
        if session.window_count == 0:
            session.window_count = 1
            session.samples_since_window = 0
            session.pending_window = list(session.audio_buffer)
        else:
            session.samples_since_window += len(samples)
            if session.samples_since_window >= self.stride_samples:
                session.window_count += session.samples_since_window // self.stride_samples
                session.samples_since_window %= self.stride_samples
                session.pending_window = list(session.audio_buffer)
                session.latest_pending_seq = chunk_seq
        if session.pending_window is not None:
            if session.inference_task is None or session.inference_task.done():
                session.inference_task = asyncio.create_task(self._inference_worker(session, ws))
            else:
                session.pending_window = list(session.audio_buffer[-self.window_samples:]) if len(session.audio_buffer) >= self.window_samples else list(session.audio_buffer)
                session.latest_pending_seq = chunk_seq
                session.coalesced_dropped_windows += 1
                session.stale_windows_prevented += 1
            session.pending_depth = 1
            session.max_pending_depth = max(session.max_pending_depth, session.pending_depth)


    def _run_inference(self, session_id: str, identity_id: Optional[str], window: list[float], history_synthetic_probs: Optional[list[float]] = None):
        started_at = time.perf_counter()
        acoustic_result = self.acoustic_analyzer.analyze(window, RAWNET2_SAMPLE_RATE)
        synth_result = self.synthetic_detector.detect(window, RAWNET2_SAMPLE_RATE)
        speaker_result = self.speaker_verifier.verify(window, RAWNET2_SAMPLE_RATE, identity_id)
        fused = fuse_evidence(synth_result, speaker_result, acoustic_result, history_synthetic_probs=history_synthetic_probs)
        risk_result = determine_risk_state(fused)
        policy_trigger = evaluate_policies(
            risk_result["risk_state"], risk_result["fused_risk_score"], session_id
        )
        recommended = get_recommended_action(risk_result["risk_state"], policy_trigger)
        return (
            acoustic_result,
            synth_result,
            speaker_result,
            fused,
            risk_result,
            policy_trigger,
            recommended,
            round((time.perf_counter() - started_at) * 1000, 2),
        )

    async def _send(self, ws: WebSocket, session: VoiceAnalysisSession, payload: str) -> None:
        async with session.send_lock:
            if session.active:
                await ws.send_text(payload)

    async def _inference_worker(self, session: VoiceAnalysisSession, ws: Optional[WebSocket] = None) -> None:
        processed_seq = None
        diagnostics_enabled = getattr(session, "_diagnostics_enabled", False)
        while session.active and session.pending_window is not None:

            if processed_seq is not None and session.latest_pending_seq is not None and session.latest_pending_seq != processed_seq:
                session.pending_window = None
                break
            window = session.pending_window
            session.pending_window = None
            processed_seq = session.latest_pending_seq
            session.last_inference_seq = processed_seq
            if session.last_stage_timing is not None:
                session.last_stage_timing.t_window_ready_ms = now_ms()
                session.last_stage_timing.t_queue_depth = len(session.audio_buffer)
            if session.last_stage_timing is not None:
                session.last_stage_timing.t_inference_start_ms = now_ms()
            try:
                result = await asyncio.to_thread(
                    self._run_inference, session.session_id, session.identity_id, window, session.synthetic_prob_history
                )
                if session.last_stage_timing is not None:
                    session.last_stage_timing.t_inference_end_ms = now_ms()
            except asyncio.CancelledError:
                raise
                raise
            except Exception as exc:
                logger.error("inference.error", session_id=session.session_id, error=str(exc))
                continue
            if not session.active:
                return
            (
                acoustic_result,
                synth_result,
                speaker_result,
                fused,
                risk_result,
                policy_trigger,
                recommended,
                total_inference_ms,
            ) = result
            
            session.synthetic_prob_history.append(synth_result.probability)
            if len(session.synthetic_prob_history) > 10:
                session.synthetic_prob_history.pop(0)

            session.inference_count += 1
            session.risk_state = risk_result["risk_state"]
            session.fused_risk_score = risk_result["fused_risk_score"]
            session.confidence = risk_result["confidence"]
            session.current_policy = policy_trigger
            session.history.append({
                "timestamp_ms": time.time() * 1000,
                "fused_risk_score": risk_result["fused_risk_score"],
                "risk_state": risk_result["risk_state"],
                "confidence": risk_result["confidence"],
            })
            if ws is None:
                continue
            
            # --- UPDATE FUSION CALL ---
            fused = fuse_evidence(synth_result, speaker_result, acoustic_result, history_synthetic_probs=session.synthetic_prob_history)
            risk_result = determine_risk_state(fused)
            # --------------------------
            inference_event = InferenceUpdate(
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
                    "total_inference_latency_ms": total_inference_ms,
                },
            )
            risk_event = RiskUpdate(
                session_id=session.session_id,
                timestamp_ms=time.time() * 1000,
                risk_state=risk_result["risk_state"],
                fused_risk_score=risk_result["fused_risk_score"],
                confidence=risk_result["confidence"],
                evidence=[{
                    "signal": signal.name,
                    "points": signal.points,
                    "status": signal.status,
                    "description": signal.description,
                    "severity": signal.severity,
                } for signal in fused.signals],
                policy=policy_trigger,
                recommended_action=recommended,
            )
            if session.last_stage_timing is not None:
                session.last_stage_timing.t_event_emitted_ms = now_ms()
                if diagnostics_enabled:
                    logger.info(
                        "ws.inference_diagnostic",
                    session_id=session.session_id,
                    latest_chunk_seq=session.latest_pending_seq,
                    window_ready_ms=session.last_stage_timing.t_window_ready_ms,
                    inference_start_ms=session.last_stage_timing.t_inference_start_ms,
                    inference_end_ms=session.last_stage_timing.t_inference_end_ms,
                    inference_latency_ms=(session.last_stage_timing.t_inference_end_ms - session.last_stage_timing.t_inference_start_ms)
                    if session.last_stage_timing.t_inference_end_ms is not None and session.last_stage_timing.t_inference_start_ms is not None
                    else None,
                    ws_event_emitted_ms=session.last_stage_timing.t_event_emitted_ms,
                    pending_state="PENDING_OR_STALE",
                    coalesced_dropped_count=session.coalesced_dropped_windows,
                    stale_windows_prevented=session.stale_windows_prevented,
                    max_pending_depth=session.max_pending_depth,
                )
            await self._send(ws, session, inference_event.model_dump_json())
            await self._send(ws, session, risk_event.model_dump_json())

    async def handle_websocket(self, ws: WebSocket) -> None:
        await ws.accept()
        session: Optional[VoiceAnalysisSession] = None
        try:
            while True:
                frame = await asyncio.wait_for(ws.receive(), timeout=SESSION_IDLE_TIMEOUT_S)
                if frame.get("type") == "websocket.disconnect":
                    break
                raw = frame.get("text", "").encode() if "text" in frame else frame.get("bytes")
                if raw is None:
                    continue
                if len(raw) > MAX_WS_MESSAGE_SIZE:
                    await ws.send_text(json.dumps(ErrorEvent(
                        session_id=session.session_id if session else "unknown",
                        code="MESSAGE_TOO_LARGE",
                        message=f"Message exceeds {MAX_WS_MESSAGE_SIZE} bytes",
                    ).model_dump()))
                    continue
                try:
                    msg_data = json.loads(raw)
                except json.JSONDecodeError:
                    if session:
                        await self._send(ws, session, ErrorEvent(
                            session_id=session.session_id, code="MALFORMED_MESSAGE", message="Invalid JSON"
                        ).model_dump_json())
                    continue
                msg_type = msg_data.get("type", "")
                if msg_type == "session.start":
                    session_model = StartSessionMessage(**msg_data)
                    session = VoiceAnalysisSession(session_model.session_id, session_model.identity_id)
                    self._sessions[session.session_id] = session
                    await self._send(ws, session, json.dumps({
                        "type": "session.started", "session_id": session.session_id,
                        "timestamp_ms": time.time() * 1000,
                        "message": "Voice analysis session initialized",
                    }))
                    logger.info("session.started", session_id=session.session_id, identity=session.identity_id)
                elif msg_type == "audio.chunk" and session:
                    chunk = AudioChunkMessage(**msg_data)
                    if session.last_sequence is not None and chunk.sequence_number <= session.last_sequence:
                        await self._send(ws, session, ErrorEvent(
                            session_id=session.session_id,
                            code="SEQUENCE_ERROR",
                            message=f"Out-of-order chunk: got {chunk.sequence_number}, expected > {session.last_sequence}",
                        ).model_dump_json())
                        continue
                    session.last_sequence = chunk.sequence_number
                    session.last_activity_at = time.time()
                    session.chunk_count += 1
                    started_at = time.perf_counter()
                    preprocessed = preprocess_chunk(
                        chunk.payload_b64, chunk.encoding, chunk.sample_rate, chunk.channels,
                        chunk.chunk_duration_ms,
                    )
                    preprocessing_ms = (time.perf_counter() - started_at) * 1000
                    if preprocessed is None:
                        await self._send(ws, session, ErrorEvent(
                            session_id=session.session_id,
                            code="PREPROCESSING_ERROR",
                            message="Failed to decode or preprocess audio chunk",
                        ).model_dump_json())
                        continue
                    normalized = to_mono_16k(
                        preprocessed.pcm_float32, preprocessed.sample_rate, preprocessed.channels
                    )
                    self._queue_latest_window(session, normalized, chunk.sequence_number, ws)
                    telemetry = TelemetryUpdate(
                        session_id=session.session_id,
                        timestamp_ms=time.time() * 1000,
                        sequence_ack=chunk.sequence_number,
                        audio_quality={
                            "status": "SILENT" if preprocessed.is_silence else "PASS",
                            "rms_dbfs": preprocessed.rms_dbfs,
                            "peak_dbfs": preprocessed.peak_dbfs,
                            "is_silence": preprocessed.is_silence,
                            "clipping": preprocessed.clipping_detected,
                            "noise_margin_db": preprocessed.estimated_noise_floor_margin_db,
                        },
                        acoustic_metrics={
                            "duration_ms": preprocessed.duration_ms,
                            "sample_rate": RAWNET2_SAMPLE_RATE,
                            "total_samples": session.total_audio_samples,
                            "buffered_samples": len(session.audio_buffer),
                            "preprocessing_latency_ms": round(preprocessing_ms, 2),
                        },
                    )
                    await self._send(ws, session, telemetry.model_dump_json())
                elif msg_type == "session.stop" and session:
                    await self._send(ws, session, json.dumps({
                        "type": "session.stopped", "session_id": session.session_id,
                        "timestamp_ms": time.time() * 1000, "total_chunks": session.chunk_count,
                    }))
                    break
        except WebSocketDisconnect:
            logger.info("ws.disconnect", session_id=session.session_id if session else None)
        except asyncio.TimeoutError:
            logger.warning("ws.timeout", session_id=session.session_id if session else None)
            if session:
                await self._send(ws, session, ErrorEvent(
                    session_id=session.session_id, code="SESSION_TIMEOUT",
                    message="Session timed out due to inactivity",
                ).model_dump_json())
        except Exception as exc:
            logger.error("ws.error", error=str(exc))
            if session:
                try:
                    await self._send(ws, session, ErrorEvent(
                        session_id=session.session_id, code="INTERNAL_ERROR", message=str(exc)
                    ).model_dump_json())
                except Exception:
                    pass
        finally:
            if session:
                session.active = False
                if session.inference_task and not session.inference_task.done():
                    session.inference_task.cancel()
                self._sessions.pop(session.session_id, None)
            try:
                await ws.close()
            except Exception:
                pass

