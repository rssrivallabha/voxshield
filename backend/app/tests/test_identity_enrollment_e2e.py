import base64
import json
import numpy as np
from fastapi.testclient import TestClient
import pytest

from ..main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _pcm_f32le_b64(samples: np.ndarray) -> str:
    return base64.b64encode(samples.astype(np.float32).tobytes()).decode()


def _send_audio_samples(ws, sid: str, seq_start: int, samples: np.ndarray, chunk_samples: int):
    seq = seq_start
    idx = 0
    while idx < len(samples):
        chunk = samples[idx:idx + chunk_samples]
        idx += chunk_samples
        payload = _pcm_f32le_b64(chunk)
        ws.send_json({
            'type':'audio.chunk','session_id':sid,'sequence_number':seq,'timestamp_ms':seq*100.0,
            'sample_rate':16000,'channels':1,'encoding':'pcm_f32le','payload_b64':payload,'chunk_duration_ms':chunk_samples/16000*1000,
        })
        yield ws.receive_json()
        seq += 1


def test_identity_create_list_get_delete(client: TestClient):
    created = client.post('/api/v1/identities', json={'name': 'Test Speaker', 'description': 'desc', 'enrollment_audio_duration_s': 3.0})
    assert created.status_code == 200
    identity = created.json()
    assert 'id' in identity

    listed = client.get('/api/v1/identities').json()
    assert isinstance(listed, list)
    assert any(i['id'] == identity['id'] for i in listed)

    got = client.get(f"/api/v1/identities/{identity['id']}")
    assert got.status_code == 200
    body = got.json()
    assert body['identity_id'] == identity['id']
    assert body['has_embedding'] is False

    deleted = client.delete(f"/api/v1/identities/{identity['id']}")
    assert deleted.status_code == 200

    gone = client.get(f"/api/v1/identities/{identity['id']}").status_code
    assert gone in (404, 405)


def test_enrollment_rejects_insufficient_audio(client: TestClient):
    created = client.post('/api/v1/identities', json={'name': 'Enroll Fail'})
    identity = created.json()

    samples = np.zeros(int(16000 * 1.0), dtype=np.float32)
    enroll = client.post(
        f"/api/v1/identities/{identity['id']}/enroll",
        json={'audio_samples': samples.tolist(), 'sample_rate': 16000},
    )
    assert enroll.status_code == 400


def test_ws_session_enforces_no_identity_for_rolling_window(client: TestClient):
    from ..websocket.handler import RAWNET2_WINDOW_SAMPLES

    sid = 'ws_identity_01'
    rng = np.random.default_rng(0)
    samples = (rng.standard_normal(RAWNET2_WINDOW_SAMPLES).astype(np.float32) * 0.1).astype(np.float32)
    chunk_samples = RAWNET2_WINDOW_SAMPLES // 4

    with client.websocket_connect(f"/api/v1/ws/voice-analysis/{sid}") as ws:
        ws.send_json({'type': 'session.start', 'session_id': sid, 'identity_id': None})
        ws.receive_json()

        for msg in _send_audio_samples(ws, sid, 1, samples, chunk_samples):
            assert msg['type'] == 'telemetry.update'

        inf = ws.receive_json()
        assert inf['type'] == 'inference.update'
        assert inf['speaker_verification']['status'] == 'NO_ENROLLED_IDENTITY'
        assert inf['speaker_verification']['similarity_score'] is None
        assert inf['speaker_verification']['confidence'] is None
        _ = ws.receive_json()
        ws.send_json({'type':'session.stop','session_id':sid})
        ws.receive_json()


def test_m4_e2e_enroll_and_verify_speaker_human_wav(client: TestClient):
    import os
    from ..tests.audio_prep import load_wav_as_float_mono_16k
    from ..websocket.handler import RAWNET2_WINDOW_SAMPLES

    human_path = os.path.join(os.path.dirname(__file__), '..', '..', 'test_audio', 'human.wav')
    human_path = os.path.abspath(human_path)

    y16, sr = load_wav_as_float_mono_16k(human_path)
    assert sr == 16000

    created = client.post('/api/v1/identities', json={'name': 'M4 E2E Speaker', 'description': 'm4', 'enrollment_audio_duration_s': 3.0})
    assert created.status_code == 200
    identity = created.json()

    min_enroll_samples = int(16000 * 3.0)
    enroll_samples = y16[:min_enroll_samples]
    assert len(enroll_samples) >= min_enroll_samples

    enroll = client.post(
        f"/api/v1/identities/{identity['id']}/enroll",
        json={'audio_samples': enroll_samples.astype(np.float32).tolist(), 'sample_rate': 16000},
    )
    assert enroll.status_code == 200

    status = client.get(f"/api/v1/identities/{identity['id']}/status").json()
    assert status['enrollment_status'] == 'VERIFIED'
    assert status['has_embedding'] is True

    sid = 'ws_identity_02'
    chunk_samples = 16000
    needed_samples = RAWNET2_WINDOW_SAMPLES
    stream_samples = y16[:needed_samples]

    with client.websocket_connect(f"/api/v1/ws/voice-analysis/{sid}") as ws:
        ws.send_json({'type': 'session.start', 'session_id': sid, 'identity_id': identity['id']})
        ws.receive_json()

        seq = 1
        inf = None
        risk = None
        for start in range(0, len(stream_samples), chunk_samples):
            chunk = stream_samples[start:start + chunk_samples]
            payload = _pcm_f32le_b64(chunk)
            ws.send_json({
                'type':'audio.chunk','session_id':sid,'sequence_number':seq,'timestamp_ms':seq*100.0,
                'sample_rate':16000,'channels':1,'encoding':'pcm_f32le','payload_b64':payload,'chunk_duration_ms':100.0
            })
            msg = ws.receive_json()
            assert msg['type'] == 'telemetry.update'
            if seq == 4:
                inf = ws.receive_json()
                risk = ws.receive_json()
            seq += 1

        assert inf is not None
        assert inf['type'] == 'inference.update'
        sv = inf['speaker_verification']
        assert sv['status'] == 'AVAILABLE'
        assert sv['similarity_score'] is not None
        assert isinstance(sv['similarity_score'], (int, float))
        assert np.isfinite(sv['similarity_score'])
        assert sv['confidence'] is not None
        assert isinstance(sv['confidence'], (int, float))
        assert np.isfinite(sv['confidence'])

        assert risk is not None
        assert risk['type'] == 'risk.update'
        evidence = risk['evidence']
        assert any(e['signal'] == 'speaker_verification' or 'speaker' in e['description'].lower() for e in evidence)

        ws.send_json({'type':'session.stop','session_id':sid})
        ws.receive_json()

