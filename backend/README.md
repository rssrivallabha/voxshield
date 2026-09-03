# VoxShield Backend — M3B Vertical Slice

Real-time voice security inference backend with WebSocket transport, audio preprocessing, ML adapter interfaces, evidence fusion, risk engine, and policy engine.

## Architecture Overview

```
Browser Mic → WebSocket → FastAPI → AudioPreprocess → [InferenceAdapters] → EvidenceFusion → RiskEngine → PolicyEngine → WebSocket → Browser
```

## Quick Start

### Prerequisites
- Python 3.11+
- pip

### Installation
```powershell
cd C:\Users\vrmus\Documents\GLM\VoxShield\backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

### Run Backend
```powershell
.\venv\Scripts\activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Run Tests
```powershell
.\venv\Scripts\activate
pytest -q
```

### Health Check
```bash
curl http://127.0.0.1:8000/api/v1/health
```

## WebSocket Protocol

### Endpoint
```
ws://127.0.0.1:8000/ws/v1/voice-analysis/{session_id}
```

### Client → Server Messages

**Start Session**
```json
{
  "type": "session.start",
  "session_id": "sess_abc123",
  "sample_rate": 16000,
  "channels": 1,
  "identity_id": "optional_enrolled_identity"
}
```

**Audio Chunk**
```json
{
  "type": "audio.chunk",
  "session_id": "sess_abc123",
  "sequence_number": 1,
  "timestamp_ms": 1700000000000,
  "sample_rate": 16000,
  "channels": 1,
  "encoding": "pcm_f32le",
  "payload_b64": "AAAAAAA...",
  "chunk_duration_ms": 100.0
}
```

**Stop Session**
```json
{
  "type": "session.stop",
  "session_id": "sess_abc123"
}
```

### Server → Client Events

**Session Started**
```json
{
  "type": "session.started",
  "session_id": "sess_abc123",
  "timestamp_ms": 1700000000000,
  "message": "Voice analysis session initialized"
}
```

**Telemetry Update** (per audio chunk)
```json
{
  "type": "telemetry.update",
  "session_id": "sess_abc123",
  "timestamp_ms": 1700000000000,
  "sequence_ack": 1,
  "audio_quality": {
    "status": "PASS",
    "rms_dbfs": -18.4,
    "peak_dbfs": -6.2,
    "is_silence": false,
    "clipping": false,
    "noise_margin_db": 41.6
  },
  "acoustic_metrics": {
    "duration_ms": 100.0,
    "sample_rate": 16000,
    "total_samples": 1600,
    "preprocessing_latency_ms": 0.12
  }
}
```

**Inference Update** (every ~10 chunks)
```json
{
  "type": "inference.update",
  "session_id": "sess_abc123",
  "timestamp_ms": 1700000000000,
  "speaker_verification": {
    "similarity_score": null,
    "confidence": null,
    "status": "MODEL_UNAVAILABLE",
    "identity_id": "user_01",
    "latency_ms": 0.0
  },
  "synthetic_speech": {
    "probability": 0.0,
    "confidence": 0.0,
    "status": "MODEL_UNAVAILABLE",
    "model_id": "dev_stub_v0",
    "latency_ms": 0.0
  },
  "acoustic_analysis": {
    "quality_status": "PASS",
    "quality_score": 1.0,
    "voice_activity": true,
    "spectral_anomaly": 0.0,
    "clipping": false,
    "latency_ms": 0.0
  }
}
```

**Risk Update** (server-authoritative)
```json
{
  "type": "risk.update",
  "session_id": "sess_abc123",
  "timestamp_ms": 1700000000000,
  "risk_state": "INSUFFICIENT_EVIDENCE",
  "fused_risk_score": null,
  "confidence": "NONE",
  "evidence": [
    {
      "signal": "Neural Synthetic Speech Detector",
      "points": null,
      "status": "UNAVAILABLE",
      "description": "Model unavailable: MODEL_UNAVAILABLE",
      "severity": "low"
    },
    {
      "signal": "Speaker Embedding Verification",
      "points": null,
      "status": "UNAVAILABLE",
      "description": "Model unavailable: MODEL_UNAVAILABLE",
      "severity": "low"
    },
    {
      "signal": "Acoustic / Spectral Analysis",
      "points": 0.0,
      "status": "ACTIVE",
      "description": "Quality: PASS | VAD: Active | SNR margin: 41.6dB",
      "severity": "low"
    }
  ],
  "policy": null,
  "recommended_action": {
    "type": "MONITOR",
    "title": "Awaiting Backend Decision",
    "description": "The backend is processing audio. No risk decision has been received yet.",
    "requires_intervention": false
  }
}
```

## ML Adapter Interfaces

### SyntheticSpeechDetector
```python
detect(audio_samples: list[float], sample_rate: int) -> SyntheticSpeechResult
```
Returns: probability, confidence, model_id, model_version, inference_latency_ms, status

### SpeakerVerifier
```python
verify(audio_samples: list[float], sample_rate: int, identity_id: Optional[str]) -> SpeakerVerificationResult
```
Returns: similarity_score, confidence, identity_id, status

### AcousticAnalyzer
```python
analyze(audio_samples: list[float], sample_rate: int) -> AcousticAnalysisResult
```
Returns: spectral_anomaly_score, voice_activity_detected, audio_quality_score, quality_status, clipping_detected, sample_rate_hz, channels, estimated_noise_margin_db, inference_latency_ms

## Evidence Fusion

Server-authoritative fusion combines signals:

| Signal | Weight | Max Points |
|--------|--------|------------|
| Synthetic Speech | probability × 50 | 50 |
| Speaker Mismatch | (1-similarity) × 40 | 40 |
| Acoustic Anomaly | score × 20 | 20 |

**Unavailable signals = null, not zero** — they don't contribute to fused score.

If no ML signals available: `fused_risk_score = null`, `confidence = "NONE"`

## Risk Engine

| Fused Score | Risk State | Description |
|-------------|------------|-------------|
| None (no ML) | INSUFFICIENT_EVIDENCE | No neural models connected |
| 0-19 | TRUSTED | No indicators of manipulation |
| 20-39 | MONITOR | Minor anomalies observed |
| 40-59 | SUSPICIOUS | Anomalous indicators detected |
| 60-79 | HIGH_RISK | Verification required |
| 80-100 | CRITICAL | Strong evidence of manipulation |

**CRITICAL**: Model unavailable MUST NOT become TRUSTED.

## Policy Engine

| Risk State | Policy Action |
|------------|---------------|
| CRITICAL | TERMINATE_SESSION |
| HIGH_RISK | REQUIRE_STEP_UP_VERIFICATION |
| SUSPICIOUS | ROUTE_TO_ANALYST |

Policies are configurable in `app/policy/engine.py`.

## Frontend Integration

The dashboard now has **three operating modes**:

1. **SIMULATION** — Deterministic synthetic scenarios (Voice Clone Attack / Trusted Call)
2. **LIVE INPUT** — Real microphone + local acoustic telemetry (ML unavailable)
3. **BACKEND** — Real microphone → WebSocket → Backend → ML inference → Server-authoritative risk → Dashboard

### Start Full Stack Demo

**Terminal 1 (Backend):**
```powershell
cd C:\Users\vrmus\Documents\GLM\VoxShield\backend
.\venv\Scripts\activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 (Frontend):**
```powershell
cd C:\Users\vrmus\Documents\GLM\VoxShield\web
npm run dev
```

Open http://localhost:3000/dashboard

### Dashboard Controls by Mode

**SIMULATION:**
- [VOICE CLONE ATTACK] / [TRUSTED CALL] scenario selector
- [START] / [PAUSE] / [RESET] timeline controls

**LIVE INPUT:**
- [ENABLE MICROPHONE] / [STOP MICROPHONE] — real local audio
- Shows live acoustic telemetry (signal level, VAD, clipping, etc.)
- ML fields show "AWAITING ML INFERENCE"

**BACKEND:**
- [CONNECT BACKEND] / [DISCONNECT] — WebSocket to FastAPI
- Streams real microphone audio to backend
- Receives telemetry, inference, and risk updates
- Shows server-authoritative risk state, policy triggers, recommended actions
- **Badge: "BACKEND • LIVE INFERENCE"**

## Development Notes

### Audio Format
- Sample rate: 16 kHz (configurable)
- Channels: 1 (mono)
- Encoding: PCM float32 little-endian (pcm_f32le)
- Base64 encoded in JSON messages

### Latency Targets
| Stage | Target |
|-------|--------|
| Audio capture | ~10 ms |
| Preprocessing | < 1 ms |
| ML inference | Model-dependent |
| Fusion + Risk + Policy | < 5 ms |
| WebSocket round-trip | Network-dependent |

### Model Integration

Replace dev adapters in `app/main.py`:

```python
from app.inference.dev_adapters import DevSyntheticSpeechDetector

# Replace with:
from app.inference.onnx_adapters import OnnxSyntheticSpeechDetector
synthetic_detector = OnnxSyntheticSpeechDetector(model_path="models/synthetic.onnx")
```

## Tests

```powershell
cd backend
.\venv\Scripts\activate
pytest -q
```

21 tests covering:
- Inference adapters (model unavailable behavior)
- Evidence fusion (unavailable signals, available synthetic)
- Risk engine (score thresholds, unavailable ≠ trusted)
- Policy engine (risk triggers, recommended actions)
- Audio preprocessing (decode, silence, metrics)

## Limitations & Known Issues

1. **No real ML models** — dev adapters return MODEL_UNAVAILABLE
2. **No GPU acceleration** — CPU-only inference
3. **No persistence** — sessions in memory only
4. **No authentication on WebSocket** — integrates with M2 auth abstraction
5. **Single process** — not horizontally scalable
5. **Audio buffer threshold** — inference runs at ~10 chunks (1 second)

## Next Milestone (M3C / M4)

1. **Real ML models** — ONNX synthetic detector (AASIST/RawNet2) + speaker embeddings (ECAPA-TDNN)
2. **Enrollment API** — reference identity management
3. **WebSocket auth** — JWT token validation
4. **GPU acceleration** — CUDA/ORT inference
5. **Horizontal scaling** — Redis session state, multiple workers
6. **Observability** — structured logging, metrics, tracing

## License

Internal VoxShield prototype — not for production use without security review.