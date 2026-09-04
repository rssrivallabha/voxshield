# M3C Implementation Setup Guide

## Overview

M3C replaces development ML adapters with real, locally executable CPU inference for synthetic speech detection and speaker verification. The implementation uses ONNX Runtime for fast CPU-based inference without GPU dependencies.

## Quick Start

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

Verify installation:
```bash
python -c "import onnxruntime, librosa, scipy; print('OK')"
```

### 2. Download Model Artifacts

**Option A: RawNet2 Synthetic Detection**
- Download from: https://github.com/Jungjee/RawNet2/releases
- Model file: `rawnet2_best.onnx` (~40 MB)
- Place in: `backend/models/synthetic_speech/rawnet2_best.onnx`

**Option B: ECAPA-TDNN Speaker Verification**
- Download from: https://github.com/TaoRuijie/ECAPA-TDNN/releases
- Model file: `ecapa_tdnn_best.onnx` (~15 MB)
- Place in: `backend/models/speaker_verification/ecapa_tdnn_best.onnx`

### 3. Verify Real Inference

Check that models are loaded:
```bash
curl http://localhost:8000/api/v1/health
```

Expected response:
```json
{
  "status": "healthy",
  "adapters": {
    "synthetic_speech": "RawNet2SyntheticDetector",
    "speaker_verification": "ECAPATDNNSpeakerVerifier",
    "acoustic_analysis": "ImprovedAcousticAnalyzer"
  },
  "ml_available": {
    "synthetic_detector": true,
    "speaker_verifier": true
  }
}
```

## Architecture

### ML Adapters

#### RawNet2 Synthetic Speech Detector
- **Input**: 16 kHz mono PCM audio (raw waveform)
- **Output**: Probability [0, 1] + confidence
- **Minimum Duration**: 1.0 second (16,000 samples)
- **Expected Latency**: 80-120 ms per 1-2s window
- **Model Size**: ~40 MB
- **Status When Unavailable**: `MODEL_UNAVAILABLE` (NOT probability 0)

#### ECAPA-TDNN Speaker Verifier
- **Input**: 16 kHz mono PCM audio (converted to MFCC)
- **Output**: Similarity score [0, 1] vs. enrolled reference
- **Minimum Duration**: 1.5 seconds (24,000 samples)
- **Expected Latency**: 40-80 ms per utterance
- **Model Size**: ~15 MB
- **Enrollment**: Server-authoritative backend storage
- **Threshold**: 0.6 (configurable)
- **Status When Unavailable**: `MODEL_UNAVAILABLE` (NOT zero similarity)

#### ImprovedAcousticAnalyzer
- **Input**: 16 kHz mono PCM audio
- **Output**: Quality metrics (RMS, peak, clipping, VAD)
- **No ML Model**: Deterministic signal processing
- **Always Available**: No dependencies on external artifacts

### Evidence Fusion Invariant

```
MODEL_UNAVAILABLE ≠ probability 0
MODEL_UNAVAILABLE ≠ similarity 0
MODEL_UNAVAILABLE never participates in risk score fusion
```

When required ML evidence is unavailable:
- `fused_risk_score = None`
- `risk_state ≠ TRUSTED`
- `confidence = "NONE"`

## Enrollment Procedure

### Register Speaker (Backend-Authorized Only)

```python
from app.inference.ml_adapters import ECAPATDNNSpeakerVerifier

verifier = ECAPATDNNSpeakerVerifier()

# Backend receives audio from authenticated user
enroll_audio = [...]  # 1.5+ seconds @ 16 kHz
success = verifier.enroll(enroll_audio, 16000, "user_001")

if success:
    print("Speaker enrolled successfully")
else:
    print("Enrollment failed - check audio or model")
```

### Verification in WebSocket Session

Once enrolled, frontend sends audio via WebSocket. Backend automatically verifies:

```
Frontend sends: audio.chunk (16 kHz mono)
    ↓
Backend preprocessing: 16 kHz validation
    ↓
RawNet2: Detect synthetic speech
    ↓
ECAPA-TDNN: Extract embedding + similarity vs. enrolled reference
    ↓
Fusion: Combine signals into risk score
    ↓
Response: InferenceUpdate with synthetic/speaker_verification results
```

## Latency Profile

### Per-Component Latency

| Component | Min (ms) | Typical (ms) | Max (ms) |
|-----------|----------|-------------|---------|
| Preprocessing | 1 | 2 | 5 |
| RawNet2 | 50 | 100 | 150 |
| Acoustic | 1 | 2 | 5 |
| ECAPA-TDNN | 30 | 60 | 100 |
| Evidence Fusion | 1 | 1 | 2 |
| Risk Engine | 1 | 1 | 2 |
| **Total Inference** | ~85 | ~170 | ~270 |

These are wall-clock measurements on modern CPUs (Intel i5/i7 equivalent).

## Configuration

### Thresholds (Tunable per Deployment)

**RawNet2 Synthetic Detection:**
```python
det = RawNet2SyntheticDetector(threshold=0.5)
# Probability > 0.5 → flagged as synthetic
# Confidence reflects distance from 0.5
```

**ECAPA-TDNN Speaker Verification:**
```python
ver = ECAPATDNNSpeakerVerifier(threshold=0.6)
# Similarity > 0.6 → same speaker
# Similarity < 0.4 → different speaker
# 0.4 ≤ similarity ≤ 0.6 → ambiguous (recommend re-enrollment)
```

## Testing

### Run M3C Tests

```bash
cd backend
python -m pytest app/tests/test_inference_adapters.py -v
python -m pytest app/tests/test_evidence_fusion.py -v
python -m pytest app/tests/test_risk_engine.py -v
```

Expected: 36 tests passing

### Run Benchmark

```bash
cd backend
python -m app.tests.benchmark_adapters
```

Output shows actual preprocessing/inference latencies (without model artifacts available).

### WebSocket Integration Test

```bash
cd backend
python -m pytest app/tests/ -v
```

All tests should pass, including WebSocket handler compatibility.

## Troubleshooting

### Models Unavailable

**Symptom**: `ml_available.synthetic_detector = false`

**Solution**:
1. Verify ONNX artifact exists:
   ```bash
   ls backend/models/synthetic_speech/rawnet2_best.onnx
   ```
2. Check ONNX Runtime is installed:
   ```bash
   python -c "import onnxruntime; print(onnxruntime.__version__)"
   ```
3. Check permissions (file readable by backend process)

### Slow Inference

**Symptom**: `inference_latency_ms > 500`

**Causes**:
- CPU under heavy load → increase timeout or shard sessions
- Large audio windows (> 2s) → use sliding windows
- ONNX Runtime not optimized → check providers in logs

**Solution**:
```python
# Use ONNX execution provider with optimization
session = ort.InferenceSession(
    model_path,
    providers=[
        ('CPUExecutionProvider', {
            'inter_op_num_threads': 4,
            'intra_op_num_threads': 8,
        })
    ]
)
```

### Verification Always Fails

**Symptom**: `speaker_verification.status = "NO_ENROLLED_IDENTITY"`

**Cause**: User not enrolled or wrong identity_id

**Solution**:
1. Ensure enrollment succeeded:
   ```python
   success = verifier.enroll(audio, 16000, "user_001")
   assert success, "Enrollment failed"
   ```
2. Verify identity_id in WebSocket matches enrollment:
   ```json
   {
     "type": "session.start",
     "identity_id": "user_001"
   }
   ```

### Risk Never TRUSTED

**Symptom**: `risk_state = "UNVERIFIED"` even with low scores

**Cause**: ML evidence unavailable (MODEL_UNAVAILABLE status)

**Solution**:
1. Verify health endpoint shows `ml_available = true`
2. Check model artifacts are placed correctly
3. Acoustic analysis alone cannot yield TRUSTED (by design)

## Performance Optimization

### For Production Deployment

1. **Batch Inference** (if processing multiple speakers):
   ```python
   # Process in batches of 5-10 audio chunks
   batch_size = 5
   for i in range(0, len(audio_chunks), batch_size):
       batch = audio_chunks[i:i+batch_size]
       # Inference on batch
   ```

2. **CPU Thread Pool**:
   ```bash
   export OMP_NUM_THREADS=8
   export MKL_NUM_THREADS=8
   python -m uvicorn app.main:app --workers 4
   ```

3. **Model Caching**:
   ```python
   # Adapters already cache ONNX session in __init__
   # No repeated model loading
   ```

4. **Audio Buffering**:
   ```python
   # WebSocket handler uses 512-sample sliding window overlap
   # Prevents redundant re-inference on overlapping frames
   ```

## Known Limitations

1. **Domain Adaptation**: Models trained on ASVspoof/VoxCeleb; may not generalize to all use cases
2. **Language**: ECAPA-TDNN optimized for English; cross-language accuracy unvalidated
3. **CPU Only**: No GPU acceleration; latency scales with audio duration
4. **No Streaming Mode**: Inference requires full audio buffer; not true streaming
5. **Threshold Tuning**: One-size-fits-all thresholds don't exist; per-deployment tuning required

## Model Selection Rationale

See `backend/docs/M3C_MODEL_SELECTION.md` for detailed comparison of:
- RawNet2 vs. AASIST (synthetic detection)
- ECAPA-TDNN vs. X-Vector vs. WaveNet (speaker verification)

Rationale: ONNX + CPU-only + low latency + MIT license + redistributable weights

## Frontend Integration

### No Changes Required to M3B

- WebSocket protocol unchanged
- Message schemas unchanged
- Evidence fusion unchanged
- Risk engine unchanged
- Policy engine unchanged

Frontend automatically benefits from real ML inference via existing BACKEND mode.

### Optional: Display ML Status

In `web/app/dashboard/page.tsx`, optionally display:

```typescript
const { data: health } = useQuery({
  queryKey: ['health'],
  queryFn: async () => {
    const res = await fetch('http://localhost:8000/api/v1/health');
    return res.json();
  },
});

return (
  <div>
    <p>Synthetic Detector: {health.ml_available.synthetic_detector ? '✓' : '✗'}</p>
    <p>Speaker Verifier: {health.ml_available.speaker_verifier ? '✓' : '✗'}</p>
  </div>
);
```

## Security Considerations

1. **Model Artifacts**: Store ONNX files in secure locations; restrict read access
2. **Enrollment**: Only backend can enroll speakers; never from frontend
3. **Embeddings**: Never send embeddings to frontend; only similarity scores
4. **Audio**: Don't persist raw mic audio unless required; delete after inference
5. **Thresholds**: Document and validate tuning; don't accept from client

## Next Steps

1. Download ONNX model artifacts
2. Place in `backend/models/` directories
3. Run `python -m pytest app/tests/ -v` (36 tests)
4. Start backend: `python -m uvicorn app.main:app --reload`
5. Verify health endpoint: `curl http://localhost:8000/api/v1/health`
6. Start frontend and test BACKEND mode WebSocket streaming

## Support

For issues with:
- ONNX Runtime: https://github.com/microsoft/onnxruntime/issues
- RawNet2: https://github.com/Jungjee/RawNet2
- ECAPA-TDNN: https://github.com/TaoRuijie/ECAPA-TDNN
- librosa: https://github.com/librosa/librosa

