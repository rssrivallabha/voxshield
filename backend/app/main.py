import structlog
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from .websocket.handler import VoiceAnalysisManager
from .inference.ml_adapters import (
    RawNet2SyntheticDetector,
    ECAPATDNNSpeakerVerifier,
    ImprovedAcousticAnalyzer,
)

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
)

app = FastAPI(
    title="VoxShield Backend",
    description="Real-time voice security inference backend",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

synthetic_detector = RawNet2SyntheticDetector()
speaker_verifier = ECAPATDNNSpeakerVerifier()
acoustic_analyzer = ImprovedAcousticAnalyzer()

manager = VoiceAnalysisManager(
    synthetic_detector=synthetic_detector,
    speaker_verifier=speaker_verifier,
    acoustic_analyzer=acoustic_analyzer,
)

@app.get("/api/v1/health")
async def health():
    return {
        "status": "healthy",
        "adapters": {
            "synthetic_speech": synthetic_detector.__class__.__name__,
            "speaker_verification": speaker_verifier.__class__.__name__,
            "acoustic_analysis": acoustic_analyzer.__class__.__name__,
        },
        "ml_available": {
            "synthetic_detector": synthetic_detector.model_available,
            "speaker_verifier": speaker_verifier.model_available,
        },
    }

@app.websocket("/ws/v1/voice-analysis/{session_id}")
async def voice_analysis_ws(websocket: WebSocket, session_id: str):
    await manager.handle_websocket(websocket)