from fastapi import APIRouter, Depends, Query
from typing import List
from ..auth import require_authenticated_user
from .inference_service import inference_history_service

router = APIRouter(prefix="/api/v1/history/inference", tags=["history"])

@router.get("", response_model=List[dict])
def get_inference_history(
    session_id: str = Query(...),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    user: dict = Depends(require_authenticated_user)
):
    return inference_history_service.get_session_history(session_id, limit, offset)