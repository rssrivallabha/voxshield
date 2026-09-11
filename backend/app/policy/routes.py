from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict
from ..auth import require_authenticated_user, require_admin
from .persistence import get_policies_from_db, update_policy_in_db
from ..audit.service import audit_service

router = APIRouter(prefix="/api/v1/policies", tags=["policies"])

class PolicyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    risk_threshold: Optional[str] = None
    action: Optional[str] = None
    enabled: Optional[bool] = None

@router.get("", response_model=List[dict])
def list_policies(user: dict = Depends(require_authenticated_user)):
    return get_policies_from_db()

@router.patch("/{policy_id}", response_model=dict)
def patch_policy(policy_id: str, payload: PolicyUpdate, user: dict = Depends(require_admin)):
    updates = payload.dict(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updated = update_policy_in_db(policy_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Policy not found")
    # audit
    audit_service.log(
        actor_id=user["id"],
        action="POLICY_UPDATE",
        resource_type="policy",
        resource_id=policy_id,
        metadata={"changes": updates}
    )
    return updated