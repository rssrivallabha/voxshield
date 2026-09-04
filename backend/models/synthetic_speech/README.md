# RawNet2 Synthetic Speech Detector

## Model Card

- **Architecture**: RawNet2 (1D CNN on raw waveform)
- **Task**: Synthetic/Deepfake speech detection
- **Training Dataset**: ASVspoof 2019 LA (Logical Access)
- **Reference**: https://github.com/Jungjee/RawNet2
- **License**: MIT

## Input Specification

- **Sample Rate**: 16 kHz (required)
- **Channels**: 1 (mono)
- **Encoding**: PCM float32
- **Minimum Duration**: 1.0 second (16,000 samples)
- **Recommended Window**: 2.0 seconds (32,000 samples)
- **No Preprocessing**: Raw waveform input directly

## Output

- **Probability**: [0, 1] representing likelihood of synthetic speech
- **Confidence**: [0, 1] representing model confidence
- **Status**: `AVAILABLE` | `MODEL_UNAVAILABLE` | `INSUFFICIENT_AUDIO`

## Thresholds

- **Synthetic Decision Threshold**: probability > 0.5
- **High Confidence**: confidence > 0.85

## Performance

- **CPU Latency**: ~80-120 ms per 1-2s window (on modern CPU)
- **Model Size**: ~40 MB
- **Memory**: ~100-150 MB (with ONNX Runtime buffer)

## Limitations

1. **Domain-Specific Training**: Trained on ASVspoof 2019 LA; may not generalize to all spoofing methods
2. **Dataset Bias**: Performance varies by attack type (TTS, voice conversion, etc.)
3. **No Real-Time Guarantee**: Latency varies with OS scheduling and CPU load
4. **Enrollment Not Required**: But speaker verification recommended as complementary signal

## Model Availability

**IMPORTANT**: This model artifact is NOT auto-downloaded. To use real inference:

1. Download `rawnet2_best.onnx` from the RawNet2 repository (MIT license)
2. Place it in this directory
3. Restart the backend service
4. Verify inference in logs or via WebSocket inference updates

Without the artifact, the adapter returns `MODEL_UNAVAILABLE` status.

## Test Verification

Run backend tests to verify real inference:

```bash
cd backend
pytest app/tests/test_inference_adapters.py -v
pytest app/tests/test_evidence_fusion.py -v
```

If tests pass and status is `AVAILABLE`, real inference is active.
