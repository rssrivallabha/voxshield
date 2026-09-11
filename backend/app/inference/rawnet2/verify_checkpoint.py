import torch
import hashlib
import os
from backend.app.inference.rawnet2.model import RawNet2Model

def verify_checkpoint():
    # Checkpoint path
    checkpoint_path = 'backend/models/synthetic_speech/best.pt'
    
    # Verify checkpoint exists
    if not os.path.exists(checkpoint_path):
        raise FileNotFoundError(f"Checkpoint not found at {checkpoint_path}")
    
    # Verify SHA256
    with open(checkpoint_path, 'rb') as f:
        checkpoint_hash = hashlib.sha256(f.read()).hexdigest()
    
    expected_hash = '0efd17340fd8de49c36ae907458deca54dad23bb502158643e49b7dda5064df8'
    if checkpoint_hash != expected_hash:
        raise ValueError(f"Checkpoint SHA256 mismatch. Expected {expected_hash}, got {checkpoint_hash}")
    
    # Load checkpoint
    checkpoint = torch.load(checkpoint_path, map_location='cpu')
    
    # Model configuration
    config = {
        "sinc_filters": 128,
        "sinc_filter_length": 129,
        "sample_rate": 16000,
        "sinc_scale": "linear",
        "learnable_sinc": False,
        "first_block_channels": 128,
        "second_block_channels": 512,
        "num_first_blocks": 2,
        "num_second_blocks": 4,
        "gru_hidden": 1024,
        "embedding_dim": 1024,
        "class_weights": [8.837, 1.0],
    }
    
    # Instantiate model
    model = RawNet2Model(config)
    
    # Load state dict
    model.load_state_dict(checkpoint['model_state_dict'], strict=True)
    model.eval()
    
    # Create test waveform
    waveform = torch.randn(1, 64000, dtype=torch.float32)
    
    # Run inference
    with torch.no_grad():
        output = model(waveform)
    
    # Verify output shape
    logits = output['logits']
    if logits.shape != (1, 2):
        raise ValueError(f"Expected logits shape (1, 2), got {logits.shape}")
    
    # Calculate probabilities
    probs = torch.softmax(logits, dim=-1)
    
    # Verify probabilities
    if not torch.isfinite(probs).all():
        raise ValueError("Probabilities contain non-finite values")
    
    if not torch.allclose(probs.sum(), torch.tensor(1.0), atol=1e-6):
        raise ValueError(f"Probabilities do not sum to 1. Sum: {probs.sum().item()}")
    
    # Measure latency
    start_time = torch.cuda.Event(enable_timing=True)
    end_time = torch.cuda.Event(enable_timing=True)
    
    start_time.record()
    with torch.no_grad():
        _ = model(waveform)
    end_time.record()
    
    torch.cuda.synchronize()
    latency_ms = start_time.elapsed_time(end_time)
    
    print(f"Checkpoint verification successful")
    print(f"Logits shape: {logits.shape}")
    print(f"Probabilities: {probs}")
    print(f"Inference latency: {latency_ms:.2f} ms")

if __name__ == "__main__":
    verify_checkpoint()
