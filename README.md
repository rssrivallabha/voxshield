# VoxShield

## AI-Powered Real-Time Voice Security Gateway

VoxShield is a real-time voice security system designed to detect AI-generated voice cloning and impersonation attacks during live calls.

It combines synthetic speech detection, speaker verification, acoustic analysis, continuous risk assessment, and security response into a single security layer.

## Features

- Real-time voice analysis
- AI-generated voice detection using RawNet2
- Speaker verification using ECAPA-TDNN
- Acoustic and DSP analysis
- Continuous risk assessment
- Configurable security policies
- Incident management
- Audit logging
- Role-Based Access Control (RBAC)
- Voice identity enrollment
- Model training and version management
- Real-time WebSocket communication
- Privacy-aware bounded audio processing

## Architecture

    Live Call Audio
           ↓
    Audio Preprocessing
           ↓
     ┌───────────────┬─────────────────┬────────────────┐
     │    RawNet2    │   ECAPA-TDNN    │  Acoustic/DSP  │
     │ Clone Detect. │ Speaker Verify. │    Signals     │
     └───────────────┴─────────────────┴────────────────┘
           ↓
    Evidence Fusion
           ↓
    Risk Engine
           ↓
    Policy Engine
           ↓
    Security Response

## Tech Stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend

- Python
- FastAPI
- WebSockets
- SQLite

### AI / ML

- PyTorch
- RawNet2
- ECAPA-TDNN
- ONNX Runtime

## Project Structure

    VoxShield/
    ├── backend/
    │   ├── app/
    │   ├── models/
    │   ├── scripts/
    │   └── tests/
    │
    ├── web/
    │   ├── app/
    │   ├── components/
    │   ├── lib/
    │   └── types/
    │
    └── README.md

## Running Locally

### Backend

    cd backend
    uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

Backend runs at:

    http://127.0.0.1:8000

### Frontend

Open another terminal:

    cd web
    npm install
    npm run dev

Frontend runs at:

    http://localhost:3000

## Real-Time Analysis

VoxShield uses WebSockets for live voice analysis.

    ws://127.0.0.1:8000/api/v1/ws/voice-analysis/{session_id}

Incoming audio is processed as 16 kHz mono audio using bounded rolling buffers.

## Risk States

    TRUSTED
    MONITOR
    SUSPICIOUS
    HIGH_RISK
    CRITICAL
    UNVERIFIED
    INSUFFICIENT_EVIDENCE

The risk engine continuously updates the call's risk state using available evidence instead of relying on a single model prediction.

## Security Response

Depending on the configured risk level, VoxShield can trigger actions such as:

- Security alerts
- Step-up verification
- SOC escalation
- Incident creation
- Call termination

## Prototype Scope

VoxShield currently demonstrates the voice-security analysis and response layer.

Production integration with SIP/PBX systems, carrier infrastructure, WebRTC gateways, contact-center platforms, and enterprise communication systems can be added as deployment integrations.

## Smart India Hackathon 2026

**Problem Statement:** SIH26104  
**Theme:** Blockchain & Cybersecurity  
**Category:** Software  
**Team:** Out Of Scope

---

**VoxShield — Detect. Assess. Respond.**
