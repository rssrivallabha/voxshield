from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from ..auth_state import get_active_tokens
from ..auth.dev_auth import get_bearer_scheme


def require_authenticated_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(get_bearer_scheme),
) -> dict:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token_str = credentials.credentials
    user = get_active_tokens().get(token_str)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def require_admin(user: dict = Depends(require_authenticated_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    return user
