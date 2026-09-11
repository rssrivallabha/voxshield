from pydantic import BaseModel
from typing import Optional, List

class IdentityCreate(BaseModel):
    name: str
    description: str = ""
    enrollment_audio_duration_s: float = 3.0

class IdentityEnrollment(BaseModel):
    audio_samples: List[float]
    sample_rate: int = 16000

class IdentityStatus(BaseModel):
    identity_id: str
    name: str
    enrollment_status: str
    enrollment_count: int
    has_embedding: bool
    last_enrollment_at: Optional[float] = None
    enrollment_audio_duration_s: float = 3.0