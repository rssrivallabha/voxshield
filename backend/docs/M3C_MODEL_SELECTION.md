# M3C Model Selection: CPU-Based Inference

## Objective
Replace development ML adapters with real, locally executable CPU inference for:
1. Synthetic/Deepfake Speech Detection
2. Speaker Verification

## Key Constraints
- CPU-only, no GPU/cloud APIs
- Python 3.11 compatible
- ONNX Runtime preferred (CPU-fast, lightweight)
- Local artifact storage (no automatic downloads)
- 16 kHz mono audio input
- Bounded sliding windows for streaming
- MODEL_UNAVAILABLE state when artifacts unavailable
- Never fabricate ML results

---

## Candidate Models

### A. Synthetic Speech Detection

#### Candidate 1: RawNet2 (ONNX)
- **Task**: Raw waveform-based synthetic speech detection
- **Source**: https://github.com/Jungjee/RawNet2
- **Architecture**: 1D CNN on raw waveform, no spectrogram required
- **Input Format**: Raw PCM float32, 16 kHz mono
- **Sample Rate**: 16 kHz
- **Expected Model Size**: ~40 MB
- **Runtime**: ONNX Runtime CPU (fast)
- **License**: MIT (redistributable)
- **Pretrained Weights**: Available, redistributable
- **CPU Feasibility**: Excellent (CNN on raw signal, ~50-150 ms for 1-2s audio)
- **Latency**: ~80-120 ms per 1-2s window
- **Limitations**: 
  - Trained on specific datasets (ASVspoof); may overfit
  - Requires retraining for different domains
- **Status**: ✅ SELECTED

#### Candidate 2: AASIST (Anti-Spoofing with Integrated Spectral-Temporal Graph Attention Network)
- **Task**: Spectral-temporal synthetic speech detection
- **Source**: https://github.com/asvspoof-challenge/2023-AASIST
- **Architecture**: Graph attention on spectral features
- **Input Format**: Spectrogram (STFT), 16 kHz mono
- **Sample Rate**: 16 kHz
- **Expected Model Size**: ~50 MB
- **Runtime**: ONNX Runtime CPU or PyTorch CPU
- **License**: MIT (redistributable)
- **Pretrained Weights**: Available, redistributable
- **CPU Feasibility**: Good (~100-200 ms for 2s audio)
- **Latency**: ~120-200 ms per 2s window
- **Limitations**:
  - Requires spectrogram preprocessing
  - Slightly higher latency than RawNet2
- **Status**: ✅ ACCEPTABLE ALTERNATIVE (more robust but slower)

#### Candidate 3: Speech2Vec (PyTorch-based)
- **Task**: Self-supervised speech representation; less direct for spoofing
- **Source**: https://github.com/pytorch/audio
- **Architecture**: Transformer encoder
- **Input Format**: Raw PCM or MFCC
- **Sample Rate**: Variable
- **CPU Feasibility**: Moderate (~200+ ms for large windows)
- **License**: MIT
- **Limitations**: Generic speaker model, not optimized for synthetic detection
- **Status**: ❌ REJECTED (not purpose-built for synthetic detection)

---

### B. Speaker Verification

#### Candidate 1: ECAPA-TDNN (ONNX or PyTorch)
- **Task**: Speaker embedding and similarity scoring
- **Source**: https://github.com/TaoRuijie/ECAPA-TDNN
- **Architecture**: Time Delay Neural Network with channel and context attention
- **Input Format**: Spectrogram (MFCC or mel-filterbank), 16 kHz mono
- **Sample Rate**: 16 kHz
- **Expected Model Size**: ~15 MB
- **Runtime**: ONNX Runtime CPU (excellent), PyTorch CPU (acceptable)
- **License**: MIT (redistributable)
- **Pretrained Weights**: Available, redistributable, trained on VoxCeleb
- **CPU Feasibility**: Excellent (~30-60 ms per utterance)
- **Latency**: ~40-80 ms per utterance
- **Limitations**: 
  - Requires MFCC/mel-filterbank preprocessing
  - Enrollment-based (backend-owned reference embeddings)
  - Threshold tuning required (~0.6 similarity for same speaker)
- **Status**: ✅ SELECTED

#### Candidate 2: X-Vector
- **Task**: Speaker embedding via statistical pooling
- **Source**: https://github.com/kaldi-asr/kaldi
- **Architecture**: TDNNs with statistical pooling
- **Input Format**: Spectrogram (MFCC), 16 kHz mono
- **Sample Rate**: 16 kHz
- **Expected Model Size**: ~20 MB
- **Runtime**: Kaldi (heavyweight) or PyTorch port
- **License**: Apache 2.0
- **CPU Feasibility**: Good but requires Kaldi or porting
- **Limitations**: Kaldi integration complex; PyTorch ports less standard
- **Status**: ⚠️ ALTERNATIVE (more complex integration)

#### Candidate 3: WaveNet Speaker Encoder
- **Task**: Speaker embedding from raw waveform
- **Source**: https://github.com/CorentinJ/Real-Time-Voice-Cloning
- **Architecture**: WaveNet backbone
- **Input Format**: Raw PCM, 16 kHz mono
- **Sample Rate**: 16 kHz
- **Expected Model Size**: ~60 MB
- **Runtime**: PyTorch CPU (slower, ~100-200 ms)
- **License**: MIT
- **Pretrained Weights**: Available
- **CPU Feasibility**: Moderate (WaveNet is computationally expensive)
- **Limitations**: Slower than ECAPA-TDNN; requires PyTorch
- **Status**: ❌ REJECTED (suboptimal latency for streaming)

---

## Selected Models Summary

| Task | Model | Runtime | Size | Latency | License | Artifacts |
|------|-------|---------|------|---------|---------|-----------|
| **Synthetic Detection** | RawNet2 (ONNX) | ONNX Runtime CPU | ~40 MB | ~80-120 ms | MIT | Local |
| **Speaker Verification** | ECAPA-TDNN (ONNX) | ONNX Runtime CPU | ~15 MB | ~40-80 ms | MIT | Local |

---

## Artifact Storage Structure

```
backend/models/
├── synthetic_speech/
│   ├── rawnet2_best.onnx          (~40 MB)
│   ├── config.json                (hyperparameters)
│   └── README.md                  (model card, thresholds, licensing)
└── speaker_verification/
    ├── ecapa_tdnn_best.onnx       (~15 MB)
    ├── config.json                (hyperparameters)
    └── README.md                  (model card, enrollment procedure, thresholds)
```

**Important**: Model artifacts are NOT auto-downloaded. They must be placed manually:
- If artifacts are missing, adapters return `MODEL_UNAVAILABLE` state
- Tests skip model-dependent checks when artifacts unavailable
- Documentation clearly specifies manual placement procedure

---

## Implementation Plan

### Dependencies
```
onnxruntime==1.18.0  (CPU-only, no CUDA)
librosa==0.10.2      (audio preprocessing, MFCC/mel-filterbank)
scipy==1.14.1        (signal processing)
```

### RawNet2 Adapter
- **Input**: 16 kHz mono PCM (list[float])
- **Preprocessing**: None (raw waveform directly)
- **Inference**: ONNX Runtime session
- **Output**: Probability [0, 1] + confidence
- **Sliding Window**: ~2 second windows (32000 samples @ 16 kHz)
- **Minimum Audio**: 1 second (16000 samples)
- **Status Codes**:
  - `AVAILABLE`: Valid inference completed
  - `MODEL_UNAVAILABLE`: ONNX artifact missing or runtime unavailable
  - `INSUFFICIENT_AUDIO`: < 1 second buffered

### ECAPA-TDNN Adapter
- **Input**: 16 kHz mono PCM
- **Preprocessing**: MFCC (12-dim, 512ms window, 160ms hop)
- **Inference**: ONNX Runtime session → embedding (192-dim)
- **Scoring**: Cosine similarity vs. enrolled reference
- **Enrollment**: Server-authoritative backend storage (not frontend)
- **Output**: Similarity score [0, 1] + confidence
- **Threshold**: 0.6 (configurable, tunable per deployment)
- **Minimum Audio**: 1.5 seconds
- **Status Codes**:
  - `AVAILABLE`: Enrollment exists, similarity computed
  - `NO_ENROLLED_IDENTITY`: No reference embedding for identity_id
  - `MODEL_UNAVAILABLE`: ONNX artifact missing or runtime unavailable
  - `INSUFFICIENT_AUDIO`: < 1.5 seconds buffered

---

## Latency Tracking

All adapters measure and expose inference latency:
- **preprocessing_latency_ms**: Spectrogram/MFCC computation
- **synthetic_detector_latency_ms**: RawNet2 inference only
- **speaker_verification_latency_ms**: ECAPA-TDNN inference + similarity scoring
- **total_inference_latency_ms**: Sum of all stages

Use `time.perf_counter()` for monotonic timing.

---

## Evidence Fusion Invariants

- **MODEL_UNAVAILABLE ≠ probability 0**: Unavailable models do NOT participate in fusion
- **No TRUSTED when unavailable**: Risk engine never yields TRUSTED if required ML evidence is unavailable
- **Graceful degradation**: Session operates with acoustic analysis only when ML unavailable

---

## Thresholds (Documented & Configurable)

### RawNet2 Synthetic Detection
- **Synthetic threshold**: probability > 0.5
- **High confidence**: confidence > 0.85
- **Rationale**: ASVspoof dataset tuning; domain-specific, may require adjustment

### ECAPA-TDNN Speaker Verification
- **Same-speaker threshold**: similarity > 0.6
- **Different-speaker threshold**: similarity ≤ 0.4
- **Ambiguous zone**: 0.4 < similarity ≤ 0.6 (recommend manual review)
- **Rationale**: VoxCeleb embeddings; tuned for ~equal error rate

---

## Testing Strategy

### Unit Tests
1. Valid inference with sufficient audio
2. Malformed audio (NaN, Inf, empty)
3. Insufficient audio (< minimum duration)
4. Missing model artifacts → MODEL_UNAVAILABLE
5. MODEL_UNAVAILABLE ≠ probability 0
6. Enrollment + verification flow
7. Incorrect speaker detection
8. Bounded sliding window behavior
9. Latency field measurement
10. Risk engine never TRUSTED when required ML unavailable

### Integration Tests
1. WebSocket streaming compatibility
2. Sliding window buffer management
3. Multi-chunk inference
4. Session lifecycle (start → chunks → stop)

### Deterministic Tests
- Use synthetic test signals (sine waves, silence, noise)
- Avoid model-download dependencies
- Skip model-dependent assertions if artifacts missing with explicit reason

---

## Known Limitations

1. **Domain-specific training**: Models trained on specific datasets; may not generalize
2. **English-centric**: ECAPA-TDNN trained primarily on English speakers
3. **Threshold tuning**: No one-size-fits-all; requires per-deployment calibration
4. **Computational cost**: Even on CPU, large batch inference is expensive
5. **No real-time streaming guarantee**: Latency varies with OS/load; assume ~100-200 ms worst-case
6. **Enrollment security**: Backend must validate enrollment requests; no frontend trust

---

## Verification Checklist

- [ ] Dependencies pinned (onnxruntime, librosa, scipy)
- [ ] Model artifacts placed in `backend/models/`
- [ ] RawNet2 inference produces valid probabilities
- [ ] ECAPA-TDNN inference produces valid embeddings
- [ ] MODEL_UNAVAILABLE properly handled in fusion
- [ ] Risk engine never TRUSTED when ML unavailable
- [ ] Latency fields populated and reasonable
- [ ] WebSocket tests pass
- [ ] Evidence fusion tests pass
- [ ] Risk engine tests pass
- [ ] Lint & typecheck pass
- [ ] Production build succeeds

