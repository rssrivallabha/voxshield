from fastapi import APIRouter, Depends, Query
from typing import Optional, List
from ..auth import require_authenticated_user
from .service import audit_service

router = APIRouter(prefix="/api/v1/audit", tags=["audit"])

@router.get("", response_model=List[dict])
def list_audit(
    actor_id: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user: dict = Depends(require_authenticated_user)
):
    return audit_service.list(actor_id, resource_type, limit, offset)