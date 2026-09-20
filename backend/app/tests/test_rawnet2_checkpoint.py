import unittest
import torch
import hashlib
import os
from app.inference.rawnet2.model import RawNet2Model

class TestRawNet2Checkpoint(unittest.TestCase):
    def setUp(self):
        self.checkpoint_path = os.path.join(os.path.dirname(__file__), '..', '..', 'models', 'synthetic_speech', 'best.pt')
        self.expected_hash = '0efd17340fd8de49c36ae907458deca54dad23bb502158643e49b7dda5064df8'
        
        self.config = {
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
        
    def test_checkpoint_exists(self):
        self.assertTrue(os.path.exists(self.checkpoint_path), f"Checkpoint not found at {self.checkpoint_path}")
        
    def test_checkpoint_sha256(self):
        with open(self.checkpoint_path, 'rb') as f:
            checkpoint_hash = hashlib.sha256(f.read()).hexdigest()
        self.assertEqual(checkpoint_hash, self.expected_hash, f"Checkpoint SHA256 mismatch. Expected {self.expected_hash}, got {checkpoint_hash}")
        
    def test_model_instantiation(self):
        model = RawNet2Model(self.config)
        self.assertIsInstance(model, RawNet2Model)
        
    def test_state_dict_loading(self):
        checkpoint = torch.load(self.checkpoint_path, map_location='cpu')
        model = RawNet2Model(self.config)
        model.load_state_dict(checkpoint['model_state_dict'], strict=True)
        
    def test_forward_pass(self):
        checkpoint = torch.load(self.checkpoint_path, map_location='cpu')
        model = RawNet2Model(self.config)
        model.load_state_dict(checkpoint['model_state_dict'], strict=True)
        model.eval()
        
        waveform = torch.randn(1, 64000, dtype=torch.float32)
        
        with torch.no_grad():
            output = model({"waveform": waveform})
        
        logits = output['logits']
        self.assertEqual(logits.shape, (1, 2), f"Expected logits shape (1, 2), got {logits.shape}")
        
        probs = torch.softmax(logits, dim=-1)
        self.assertTrue(torch.isfinite(probs).all(), "Probabilities contain non-finite values")
        self.assertTrue(torch.allclose(probs.sum(), torch.tensor(1.0), atol=1e-6), f"Probabilities do not sum to 1. Sum: {probs.sum().item()}")

if __name__ == '__main__':
    unittest.main()
