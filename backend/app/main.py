import time
import secrets
import structlog
from fastapi import FastAPI, WebSocket, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional

from .websocket.handler import VoiceAnalysisManager
from .inference.identity_service import identity_service
from .policy.engine import DEFAULT_POLICIES
from .schemas.identity import IdentityCreate, IdentityEnrollment, IdentityStatus
from .inference.ml_adapters import (
    RawNet2SyntheticDetector,
    ECAPATDNNSpeakerVerifier,
    ImprovedAcousticAnalyzer,
)
from .inference.identity_service import IdentityService
from .db import init_db
from .auth import require_admin, _DEV_USERS, _active_tokens, _make_session, _resolve_token, _bearer_scheme
from .admin.routes import router as admin_router
from .incident.routes import router as incident_router
from .audit.routes import router as audit_router
from .history.risk_routes import router as risk_history_router
from .history.inference_routes import router as inference_history_router
from .policy.routes import router as policy_router

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

@app.on_event("startup")
async def on_startup():
    init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin_router)
app.include_router(incident_router)
app.include_router(audit_router)
app.include_router(risk_history_router)
app.include_router(inference_history_router)
app.include_router(policy_router)

synthetic_detector = RawNet2SyntheticDetector()
speaker_verifier = ECAPATDNNSpeakerVerifier()
acoustic_analyzer = ImprovedAcousticAnalyzer()

identity_service = IdentityService(speaker_verifier)

manager = VoiceAnalysisManager(
    synthetic_detector=synthetic_detector,
    speaker_verifier=speaker_verifier,
    acoustic_analyzer=acoustic_analyzer,
)


class LoginCredentials(BaseModel):
    email: str
    password: str = ""
    roleOverride: Optional[str] = None


@app.post("/api/v1/auth/login")
async def auth_login(credentials: LoginCredentials):
    role = credentials.roleOverride or "admin"
    user = _DEV_USERS.get(role) or _DEV_USERS["admin"]
    return _make_session(user)


@app.post("/api/v1/auth/logout")
async def auth_logout(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
):
    if credentials and credentials.credentials in _active_tokens:
        del _active_tokens[credentials.credentials]
    return {}


@app.get("/api/v1/auth/me")
async def auth_me(user: Optional[dict] = Depends(_resolve_token)):
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    expires_at = time.strftime(
        "%Y-%m-%dT%H:%M:%S.000Z",
        time.gmtime(time.time() + 8 * 3600),
    )
    token = next(
        (t for t, u in _active_tokens.items() if u is user),
        "dev_token",
    )
    return {"user": user, "token": token, "expiresAt": expires_at}


# ---------------------------------------------------------------------------
# Health & WebSocket
# ---------------------------------------------------------------------------

@app.get("/api/v1/identities")
async def identities():
    return identity_service.list_identities()

@app.post("/api/v1/identities")
async def create_identity(identity: IdentityCreate):
    return identity_service.create_identity(
        name=identity.name,
        description=identity.description,
        enrollment_audio_duration_s=identity.enrollment_audio_duration_s,
    )

@app.post("/api/v1/identities/{identity_id}/enroll")
async def enroll_identity(identity_id: str, enrollment: IdentityEnrollment):
    success, result = identity_service.enroll_audio(
        identity_id=identity_id,
        audio_samples=enrollment.audio_samples,
        sample_rate=enrollment.sample_rate,
    )
    if not success:
        raise HTTPException(status_code=400, detail=result.metadata.get("reason", "Enrollment failed"))
    return result

@app.get("/api/v1/identities/{identity_id}/status")
async def get_identity_status(identity_id: str):
    return identity_service.get_enrollment_status(identity_id)

@app.delete("/api/v1/identities/{identity_id}")
async def delete_identity(identity_id: str):
    if not identity_service.delete_identity(identity_id):
        raise HTTPException(status_code=404, detail="Identity not found")
    return {"status": "deleted"}

@app.get("/api/v1/policies")
async def policies():
    return DEFAULT_POLICIES


@app.get("/api/v1/calls")
async def calls():
    return manager.get_active_sessions()


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


@app.websocket("/api/v1/ws/voice-analysis/{session_id}")
# NOTE: keep path in sync with frontend
async def voice_analysis_ws(websocket: WebSocket, session_id: str):
    await manager.handle_websocket(websocket)
