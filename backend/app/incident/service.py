from .repository import IncidentRepository
from ..audit.service import audit_service

class IncidentService:
    def __init__(self):
        self.repo = IncidentRepository()

    def create_from_policy(self, session_id: str, policy_trigger: dict, risk_state: str, risk_score, evidence):
        if not policy_trigger:
            return None
        # Only create incident for policies that have action requiring intervention
        action = policy_trigger.get("action")
        if action not in ("TERMINATE_SESSION", "REQUIRE_STEP_UP_VERIFICATION", "ROUTE_TO_ANALYST"):
            return None
        return self.repo.create(session_id, policy_trigger, risk_state, risk_score, evidence)

    def get(self, incident_id: str):
        return self.repo.get(incident_id)

    def list(self, session_id=None, status=None, limit=100, offset=0):
        return self.repo.list(session_id, status, limit, offset)

    def update_status(self, incident_id: str, new_status: str, actor_id: str = "system"):
        updated = self.repo.update_status(incident_id, new_status)
        if updated:
            audit_service.log(
                actor_id=actor_id,
                action="INCIDENT_STATUS_CHANGE",
                resource_type="incident",
                resource_id=incident_id,
                metadata={"new_status": new_status}
            )
        return updated

incident_service = IncidentService()