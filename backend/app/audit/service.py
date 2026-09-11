from .repository import AuditRepository

class AuditService:
    def __init__(self):
        self.repo = AuditRepository()

    def log(self, actor_id: str, action: str, resource_type: str, resource_id: str = None, metadata: dict = None):
        self.repo.log(actor_id, action, resource_type, resource_id, metadata)

    def list(self, actor_id=None, resource_type=None, limit=100, offset=0):
        return self.repo.list(actor_id, resource_type, limit, offset)

audit_service = AuditService()