from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from ..auth import require_authenticated_user
from .service import incident_service

router = APIRouter(prefix="/api/v1/incidents", tags=["incidents"])

class IncidentStatusUpdate(BaseModel):
    status: str

@router.get("", response_model=List[dict])
def list_incidents(
    session_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user: dict = Depends(require_authenticated_user)
):
    return incident_service.list(session_id, status, limit, offset)

@router.get("/{incident_id}", response_model=dict)
def get_incident(incident_id: str, user: dict = Depends(require_authenticated_user)):
    inc = incident_service.get(incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    return inc

@router.patch("/{incident_id}", response_model=dict)
def update_incident(incident_id: str, payload: IncidentStatusUpdate, user: dict = Depends(require_authenticated_user)):
    try:
        inc = incident_service.update_status(incident_id, payload.status, actor_id=user["id"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    return inc