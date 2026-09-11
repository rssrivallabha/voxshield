from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, List
import time

@dataclass
class SpeakerIdentity:
    id: str
    name: str
    description: str
    enrollment_status: str
    created_at: float
    updated_at: float
    enrollment_audio_duration_s: float = 1.5
    enrollment_count: int = 0
    last_enrollment_at: Optional[float] = None

class IdentityRepository(ABC):
    @abstractmethod
    def create_identity(self, identity: SpeakerIdentity) -> SpeakerIdentity:
        pass

    @abstractmethod
    def get_identity(self, identity_id: str) -> Optional[SpeakerIdentity]:
        pass

    @abstractmethod
    def list_identities(self) -> List[SpeakerIdentity]:
        pass

    @abstractmethod
    def update_identity(self, identity: SpeakerIdentity) -> SpeakerIdentity:
        pass

    @abstractmethod
    def delete_identity(self, identity_id: str) -> bool:
        pass

class InMemoryIdentityRepository(IdentityRepository):
    def __init__(self):
        self._identities: dict[str, SpeakerIdentity] = {}

    def create_identity(self, identity: SpeakerIdentity) -> SpeakerIdentity:
        if identity.id in self._identities:
            raise ValueError(f"Identity {identity.id} already exists")
        self._identities[identity.id] = identity
        return identity

    def get_identity(self, identity_id: str) -> Optional[SpeakerIdentity]:
        return self._identities.get(identity_id)

    def list_identities(self) -> List[SpeakerIdentity]:
        return list(self._identities.values())

    def update_identity(self, identity: SpeakerIdentity) -> SpeakerIdentity:
        if identity.id not in self._identities:
            raise ValueError(f"Identity {identity.id} not found")
        self._identities[identity.id] = identity
        return identity

    def delete_identity(self, identity_id: str) -> bool:
        if identity_id in self._identities:
            del self._identities[identity_id]
            return True
        return False

identity_repository = InMemoryIdentityRepository()