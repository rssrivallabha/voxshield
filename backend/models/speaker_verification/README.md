# ECAPA-TDNN Speaker Verification

## Model Card

- **Architecture**: ECAPA-TDNN (Emphasized Channel Attention, Propagation and Aggregation Time Delay Neural Network)
- **Task**: Speaker verification / speaker embeddings
- **Training Dataset**: VoxCeleb 1 + 2
- **Reference**: https://github.com/TaoRuijie/ECAPA-TDNN
- **License**: MIT

## Input Specification

- **Sample Rate**: 16 kHz (required)
- **Channels**: 1 (mono)
- **Encoding**: PCM float32
- **Minimum Duration**: 1.5 seconds (24,000 samples)
- **Preprocessing**: MFCC extraction required
  - **MFCC Dimension**: 12
  - **Window Size**: 512 samples (32 ms @ 16 kHz)
  - **Hop Length**: 160 samples (10 ms @ 16 kHz)
  - **Frequency Range**: 50 Hz - 8000 Hz

## Output

- **Speaker Embedding**: 192-dimensional vector
- **Similarity Score**: Cosine similarity [0, 1]
- **Confidence**: Model confidence in match
- **Status**: `AVAILABLE` | `NO_ENROLLED_IDENTITY` | `MODEL_UNAVAILABLE` | `INSUFFICIENT_AUDIO`

## Enrollment & Verification

### Enrollment (Server-Authoritative)

Enrollment must be performed through secure backend endpoints only. Never trust enrollment from frontend clients.

1. Backend receives audio from authenticated user
2. Extract MFCC, compute embedding via ONNX
3. Store embedding in backend enrollment store (database or in-memory)
4. Return enrollment confirmation (no embedding returned to client)

### Verification

1. Client sends test audio via WebSocket
2. Backend extracts MFCC, computes test embedding
3. Retrieves enrolled embedding for identity_id
4. Computes cosine similarity
5. Returns similarity_score and match decision

## Thresholds

- **Same-Speaker Threshold**: similarity > 0.6
- **Different-Speaker Threshold**: similarity ≤ 0.4
- **Ambiguous Zone**: 0.4 < similarity ≤ 0.6 (recommend manual review or re-enrollment)

**Rationale**: Tuned for approximately equal error rate (EER) on VoxCeleb test set. May require per-deployment calibration.

## Performance

- **CPU Latency**: ~40-80 ms per utterance (embedding + similarity)
- **Model Size**: ~15 MB
- **Memory**: ~50-100 MB (with ONNX Runtime buffer + enrollment store)

## Limitations

1. **English-Centric**: Trained primarily on English speakers; cross-language performance not guaranteed
2. **Short-Duration Sensitivity**: Very short utterances (<1.5s) may reduce accuracy
3. **Accent/Language Variation**: Strong accents or non-English speech may increase false-reject rate
4. **Spoofing Risk**: Vulnerable to voice conversion and TTS if speaker is synthetic (recommend using with synthetic detector)
5. **Enrollment Quality**: Enrollment audio quality directly impacts verification accuracy

## Security Considerations

- **Backend-Authoritative**: All enrollment decisions made server-side
- **No Client Enrollment**: Frontend cannot directly trigger enrollment
- **Embedding Storage**: Secured in backend (database, encrypted, access-controlled)
- **No Embedding Transmission**: Embeddings not sent to frontend; only similarity scores
- **Threshold Tuning**: Deployed thresholds must be documented and validated

## Model Availability

**IMPORTANT**: This model artifact is NOT auto-downloaded. To use real inference:

1. Download `ecapa_tdnn_best.onnx` from the ECAPA-TDNN repository (MIT license)
2. Place it in this directory
3. Configure backend enrollment store (in-memory or database)
4. Restart the backend service
5. Verify inference in logs

Without the artifact, the adapter returns `MODEL_UNAVAILABLE` status.

## Enrollment Setup

### In-Memory Enrollment (Development)

```python
from app.inference.ml_adapters import ECAPATDNNSpeakerVerifier

verifier = ECAPATDNNSpeakerVerifier()
# Enroll user
enroll_audio = [...]  # 1.5+ seconds @ 16 kHz
success = verifier.enroll(enroll_audio, 16000, "user_001")
```

### Database-Backed Enrollment (Production)

Store embeddings in secure database with:
- identity_id (primary key)
- embedding (vector field)
- enrollment_timestamp
- quality_score (optional)

Test Verification

Run backend tests to verify real inference:

```bash
cd backend
pytest app/tests/test_inference_adapters.py -v
pytest app/tests/test_evidence_fusion.py -v
```

If tests pass and status is `AVAILABLE`, real inference is active.
