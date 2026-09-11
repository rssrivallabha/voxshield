from .risk_repository import RiskHistoryRepository

class RiskHistoryService:
    def __init__(self):
        self.repo = RiskHistoryRepository()

    def record(self, session_id: str, risk_state: str, fused_risk_score, evidence, policy):
        self.repo.add(session_id, risk_state, fused_risk_score, evidence, policy)

    def get_session_history(self, session_id: str, limit=200, offset=0):
        return self.repo.get_for_session(session_id, limit, offset)

risk_history_service = RiskHistoryService()