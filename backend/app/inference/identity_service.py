from typing import Optional
from .identity_repository import SpeakerIdentity, identity_repository
from .ml_adapters import ECAPATDNNSpeakerVerifier
from .interfaces import SpeakerVerificationResult
import time
import uuid

ENROLLMENT_STATUS_PENDING = "PENDING"
ENROLLMENT_STATUS_VERIFIED = "VERIFIED"
ENROLLMENT_STATUS_FAILED = "FAILED"
MIN_ENROLLMENT_AUDIO_DURATION_S = 3.0
REQUIRED_ENROLLMENT_COUNT = 1

class IdentityService:
    def __init__(self, speaker_verifier: ECAPATDNNSpeakerVerifier):
        self.speaker_verifier = speaker_verifier
        self.repository = identity_repository

    def create_identity(
        self,
        name: str,
        description: str = "",
        enrollment_audio_duration_s: float = MIN_ENROLLMENT_AUDIO_DURATION_S
    ) -> SpeakerIdentity:
        identity_id = f"id_{uuid.uuid4().hex[:12]}"
        identity = SpeakerIdentity(
            id=identity_id,
            name=name,
            description=description,
            enrollment_status=ENROLLMENT_STATUS_PENDING,
            created_at=time.time(),
            updated_at=time.time(),
            enrollment_audio_duration_s=enrollment_audio_duration_s,
        )
        return self.repository.create_identity(identity)

    def get_identity(self, identity_id: str) -> Optional[SpeakerIdentity]:
        return self.repository.get_identity(identity_id)

    def list_identities(self) -> list[SpeakerIdentity]:
        return self.repository.list_identities()

    def delete_identity(self, identity_id: str) -> bool:
        return self.repository.delete_identity(identity_id)

    def enroll_audio(
        self,
        identity_id: str,
        audio_samples: list[float],
        sample_rate: int
    ) -> tuple[bool, Optional[SpeakerVerificationResult]]:
        identity = self.repository.get_identity(identity_id)
        if not identity:
            return False, SpeakerVerificationResult(
                similarity_score=None, confidence=None, identity_id=identity_id,
                status="NO_ENROLLED_IDENTITY", inference_latency_ms=0.0,
                metadata={"reason": "Identity not found"}
            )

        if not self.speaker_verifier.model_available:
            return False, SpeakerVerificationResult(
                similarity_score=None, confidence=None, identity_id=identity_id,
                status="MODEL_UNAVAILABLE", inference_latency_ms=0.0,
                metadata={"reason": "Speaker verification model not available"}
            )

        success = self.speaker_verifier.enroll(
            audio_samples, sample_rate, identity_id,
            enrollment_audio_duration_s=identity.enrollment_audio_duration_s
        )

        if success:
            identity.enrollment_count += 1
            identity.last_enrollment_at = time.time()
            if identity.enrollment_count >= REQUIRED_ENROLLMENT_COUNT:
                identity.enrollment_status = ENROLLMENT_STATUS_VERIFIED
            identity.updated_at = time.time()
            self.repository.update_identity(identity)

            return True, SpeakerVerificationResult(
                similarity_score=1.0, confidence=1.0, identity_id=identity_id,
                status="AVAILABLE", inference_latency_ms=0.0,
                metadata={
                    "enrollment_count": identity.enrollment_count,
                    "enrollment_status": identity.enrollment_status,
                    "reason": "Enrollment successful"
                }
            )
        else:
            return False, SpeakerVerificationResult(
                similarity_score=None, confidence=None, identity_id=identity_id,
                status="INSUFFICIENT_AUDIO", inference_latency_ms=0.0,
                metadata={"reason": "Enrollment failed: insufficient or invalid audio"}
            )

    def verify_speaker(
        self,
        identity_id: str,
        audio_samples: list[float],
        sample_rate: int
    ) -> SpeakerVerificationResult:
        identity = self.repository.get_identity(identity_id)
        if not identity:
            return SpeakerVerificationResult(
                similarity_score=None, confidence=None, identity_id=identity_id,
                status="NO_ENROLLED_IDENTITY", inference_latency_ms=0.0,
                metadata={"reason": "Identity not found"}
            )

        if identity.enrollment_status != ENROLLMENT_STATUS_VERIFIED:
            return SpeakerVerificationResult(
                similarity_score=None, confidence=None, identity_id=identity_id,
                status="NO_ENROLLED_IDENTITY", inference_latency_ms=0.0,
                metadata={"reason": f"Identity enrollment status: {identity.enrollment_status}"}
            )

        return self.speaker_verifier.verify(audio_samples, sample_rate, identity_id)

    def get_enrollment_status(self, identity_id: str) -> dict:
        identity = self.repository.get_identity(identity_id)
        if not identity:
            return {"status": "NOT_FOUND", "reason": "Identity not found"}

        has_embedding = identity_id in self.speaker_verifier.enrollment_store
        return {
            "identity_id": identity.id,
            "name": identity.name,
            "enrollment_status": identity.enrollment_status,
            "enrollment_count": identity.enrollment_count,
            "has_embedding": has_embedding,
            "last_enrollment_at": identity.last_enrollment_at,
            "enrollment_audio_duration_s": identity.enrollment_audio_duration_s,
        }

identity_service: Optional[IdentityService] = None