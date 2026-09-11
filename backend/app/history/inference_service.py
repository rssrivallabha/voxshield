from .inference_repository import InferenceHistoryRepository

class InferenceHistoryService:
    def __init__(self):
        self.repo = InferenceHistoryRepository()

    def record(self, session_id: str, raw_prob: float, model_version: str, speaker_verification: dict = None, metadata: dict = None):
        self.repo.add(session_id, raw_prob, model_version, speaker_verification, metadata)

    def get_session_history(self, session_id: str, limit=200, offset=0):
        return self.repo.get_for_session(session_id, limit, offset)

inference_history_service = InferenceHistoryService()