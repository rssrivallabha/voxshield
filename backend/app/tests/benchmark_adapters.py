import time
import math
import numpy as np
from ..inference.ml_adapters import (
    RawNet2SyntheticDetector,
    ECAPATDNNSpeakerVerifier,
    ImprovedAcousticAnalyzer,
)


def benchmark_synthetic_detector():
    """Benchmark RawNet2 synthetic detector (model unavailable scenario)."""
    print("\n=== RawNet2 Synthetic Detector Benchmark ===")
    det = RawNet2SyntheticDetector(model_path="/nonexistent/path.onnx")
    
    audio_1s = [0.1] * 16000
    audio_2s = [0.1] * 32000
    
    for duration_s, audio in [(1, audio_1s), (2, audio_2s)]:
        start = time.perf_counter()
        result = det.detect(audio, 16000)
        elapsed_ms = (time.perf_counter() - start) * 1000
        
        print(f"  {duration_s}s audio:")
        print(f"    Status: {result.status}")
        print(f"    Latency: {result.inference_latency_ms:.2f} ms")
        print(f"    Wall-clock: {elapsed_ms:.2f} ms")


def benchmark_speaker_verifier():
    """Benchmark ECAPA-TDNN speaker verifier (model unavailable scenario)."""
    print("\n=== ECAPA-TDNN Speaker Verifier Benchmark ===")
    ver = ECAPATDNNSpeakerVerifier(model_path="/nonexistent/path.onnx")
    
    audio_1_5s = [0.1] * 24000
    audio_2s = [0.1] * 32000
    
    for duration_s, audio in [(1.5, audio_1_5s), (2, audio_2s)]:
        start = time.perf_counter()
        result = ver.verify(audio, 16000, "user_001")
        elapsed_ms = (time.perf_counter() - start) * 1000
        
        print(f"  {duration_s}s audio:")
        print(f"    Status: {result.status}")
        print(f"    Latency: {result.inference_latency_ms:.2f} ms")
        print(f"    Wall-clock: {elapsed_ms:.2f} ms")


def benchmark_acoustic_analyzer():
    """Benchmark acoustic analyzer (real inference, no model required)."""
    print("\n=== Acoustic Analyzer Benchmark ===")
    ana = ImprovedAcousticAnalyzer()
    
    for duration_s in [1, 2, 5]:
        samples = [0.3 * math.sin(2 * math.pi * 440 * i / 16000) for i in range(duration_s * 16000)]
        
        start = time.perf_counter()
        result = ana.analyze(samples, 16000)
        elapsed_ms = (time.perf_counter() - start) * 1000
        
        print(f"  {duration_s}s audio:")
        print(f"    Quality: {result.quality_status}")
        print(f"    Voice active: {result.voice_activity_detected}")
        print(f"    Latency: {result.inference_latency_ms:.2f} ms")
        print(f"    Wall-clock: {elapsed_ms:.2f} ms")


if __name__ == "__main__":
    print("M3C ML Adapter Latency Benchmark")
    print("=" * 50)
    print("Note: Model artifacts unavailable; showing preprocessing latency only")
    
    benchmark_synthetic_detector()
    benchmark_speaker_verifier()
    benchmark_acoustic_analyzer()
    
    print("\n" + "=" * 50)
    print("Benchmark complete.")
    print("\nTo enable real model inference:")
    print("1. Download ONNX artifacts (RawNet2, ECAPA-TDNN)")
    print("2. Place in backend/models/{synthetic_speech,speaker_verification}/")
    print("3. Restart backend service")
    print("4. Re-run benchmark for actual inference latency")
