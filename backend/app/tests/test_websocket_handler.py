import base64
import json
import struct

import numpy as np
import pytest
from fastapi.testclient import TestClient

from ..main import app, synthetic_detector, speaker_verifier, manager


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _pcm_f32le_b64(n_samples: int = 1600, amplitude: float = 0.0) -> str:
    samples = np.full(n_samples, amplitude, dtype=np.float32)
    return base64.b64encode(samples.tobytes()).decode()


def _audio_chunk(session_id: str, seq: int, b64: str, sample_rate: int = 16000) -> dict:
    return {
        "type": "audio.chunk",
        "session_id": session_id,
        "sequence_number": seq,
        "timestamp_ms": seq * 100.0,
        "sample_rate": sample_rate,
        "channels": 1,
        "encoding": "pcm_f32le",
        "payload_b64": b64,
        "chunk_duration_ms": 100.0,
    }


class TestAppLevelAdapterInit:
    """Regression: app-level adapter instances used by WS must have model_available=True."""

    def test_synthetic_detector_app_instance_available(self):
        assert synthetic_detector.model_available is True, (
            f"RawNet2SyntheticDetector not available at app startup: {synthetic_detector.model_error}"
        )

    def test_synthetic_detector_model_error_is_none(self):
        assert synthetic_detector.model_error is None, (
            f"model_error set: {synthetic_detector.model_error}"
        )

    def test_manager_uses_same_synthetic_detector_instance(self):
        assert manager.synthetic_detector is synthetic_detector

    def test_speaker_verifier_app_instance_available(self):
        assert speaker_verifier.model_available is True, (
            f"ECAPATDNNSpeakerVerifier not available at app startup: {getattr(speaker_verifier, 'model_error', None)}"
        )

    def test_manager_uses_same_speaker_verifier_instance(self):
        assert manager.speaker_verifier is speaker_verifier

    def test_health_endpoint_reports_synthetic_detector_true(self, client):
        resp = client.get("/api/v1/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["ml_available"]["synthetic_detector"] is True, (
            f"Health endpoint reports synthetic_detector=False: {body}"
        )
        assert body["ml_available"]["speaker_verifier"] is True

    def test_synthetic_detector_inference_returns_available(self):
        samples = (np.random.default_rng(42).standard_normal(16000) * 0.1).tolist()
        result = synthetic_detector.detect(samples, 16000)
        assert result.status == "AVAILABLE", (
            f"Expected AVAILABLE, got {result.status}: {result.metadata}"
        )
        assert 0.0 <= result.probability <= 1.0
        assert result.model_id == "rawnet2_pytorch"


class TestWebSocketTextFrameProtocol:
    """Regression tests: handler must accept JSON text frames (not binary)."""

    def test_session_start_returns_session_started(self, client):
        with client.websocket_connect("/api/v1/ws/voice-analysis/reg_sess_01") as ws:
            ws.send_json({"type": "session.start", "session_id": "reg_sess_01", "sample_rate": 16000, "channels": 1})
            msg = ws.receive_json()
            assert msg["type"] == "session.started"
            assert msg["session_id"] == "reg_sess_01"
            ws.send_json({"type": "session.stop", "session_id": "reg_sess_01"})
            ws.receive_json()

    def test_audio_chunk_returns_telemetry_update(self, client):
        sid = "reg_sess_02"
        b64 = _pcm_f32le_b64(1600)
        with client.websocket_connect(f"/api/v1/ws/voice-analysis/{sid}") as ws:
            ws.send_json({"type": "session.start", "session_id": sid, "sample_rate": 16000, "channels": 1})
            ws.receive_json()

            ws.send_json(_audio_chunk(sid, 1, b64))
            msg = ws.receive_json()
            assert msg["type"] == "telemetry.update"
            assert msg["session_id"] == sid
            assert msg["sequence_ack"] == 1
            assert "audio_quality" in msg
            assert "acoustic_metrics" in msg

            ws.send_json({"type": "session.stop", "session_id": sid})
            ws.receive_json()

    def test_no_bytes_error_event_on_text_frame(self, client):
        """Regression: before fix, text frames caused {\"error\":\"'bytes'\"} immediately."""
        sid = "reg_sess_03"
        with client.websocket_connect(f"/api/v1/ws/voice-analysis/{sid}") as ws:
            ws.send_json({"type": "session.start", "session_id": sid, "sample_rate": 16000, "channels": 1})
            msg = ws.receive_json()
            assert msg.get("type") != "error", f"Got error on session.start: {msg}"
            ws.send_json({"type": "session.stop", "session_id": sid})
            ws.receive_json()

    def test_session_stop_returns_session_stopped(self, client):
        sid = "reg_sess_04"
        with client.websocket_connect(f"/api/v1/ws/voice-analysis/{sid}") as ws:
            ws.send_json({"type": "session.start", "session_id": sid})
            ws.receive_json()
            ws.send_json({"type": "session.stop", "session_id": sid})
            msg = ws.receive_json()
            assert msg["type"] == "session.stopped"
            assert msg["session_id"] == sid
            assert "total_chunks" in msg

    def test_malformed_json_returns_error(self, client):
        sid = "reg_sess_05"
        with client.websocket_connect(f"/api/v1/ws/voice-analysis/{sid}") as ws:
            ws.send_json({"type": "session.start", "session_id": sid})
            ws.receive_json()
            ws.send_text("not valid json {{{{")
            msg = ws.receive_json()
            assert msg["type"] == "error"
            assert msg["code"] == "MALFORMED_MESSAGE"
            ws.send_json({"type": "session.stop", "session_id": sid})
            ws.receive_json()

    def test_out_of_order_sequence_returns_error(self, client):
        sid = "reg_sess_06"
        b64 = _pcm_f32le_b64(1600)
        with client.websocket_connect(f"/api/v1/ws/voice-analysis/{sid}") as ws:
            ws.send_json({"type": "session.start", "session_id": sid})
            ws.receive_json()

            ws.send_json(_audio_chunk(sid, 5, b64))
            ws.receive_json()

            ws.send_json(_audio_chunk(sid, 3, b64))
            msg = ws.receive_json()
            assert msg["type"] == "error"
            assert msg["code"] == "SEQUENCE_ERROR"

            ws.send_json({"type": "session.stop", "session_id": sid})
            ws.receive_json()

    def test_multiple_chunks_accumulate_and_stop(self, client):
        sid = "reg_sess_07"
        b64 = _pcm_f32le_b64(1600, amplitude=0.1)
        with client.websocket_connect(f"/api/v1/ws/voice-analysis/{sid}") as ws:
            ws.send_json({"type": "session.start", "session_id": sid})
            ws.receive_json()

            received_types = []
            for seq in range(1, 41):
                ws.send_json(_audio_chunk(sid, seq, b64))
                msg = ws.receive_json()
                received_types.append(msg["type"])
                assert msg["type"] in ("telemetry.update", "inference.update", "risk.update", "error")
                if msg["type"] == "telemetry.update" and seq == 40:
                    for _ in range(2):
                        extra = ws.receive_json()
                        received_types.append(extra["type"])

            assert "telemetry.update" in received_types

            ws.send_json({"type": "session.stop", "session_id": sid})
            stopped = ws.receive_json()
            assert stopped["type"] == "session.stopped"
            assert stopped["total_chunks"] == 40

    def test_inference_update_contains_rawnet2_pytorch_status(self, client):
        """Regression: WS adapter must emit inference.update with rawnet2_pytorch AVAILABLE."""
        sid = "reg_sess_08"
        b64 = base64.b64encode(
            (np.random.default_rng(99).standard_normal(16000) * 0.1).astype(np.float32).tobytes()
        ).decode()
        with client.websocket_connect(f"/api/v1/ws/voice-analysis/{sid}") as ws:
            ws.send_json({"type": "session.start", "session_id": sid})
            ws.receive_json()

            # window is 64k @ 16kHz => 4 chunks of 16k samples
            for seq in range(1, 5):
                ws.send_json(_audio_chunk(sid, seq, b64, sample_rate=16000))
                msg = ws.receive_json()
                assert msg["type"] == "telemetry.update"
                if seq == 4:
                    inference = ws.receive_json()
                    assert inference["type"] == "inference.update"
                    synth = inference["synthetic_speech"]
                    assert synth["status"] == "AVAILABLE", (
                        f"Expected AVAILABLE, got {synth['status']}"
                    )
                    assert synth["model_id"] == "rawnet2_pytorch"
                    assert 0.0 <= synth["probability"] <= 1.0

                    ws.receive_json()  # risk.update

            ws.send_json({"type": "session.stop", "session_id": sid})
            ws.receive_json()

