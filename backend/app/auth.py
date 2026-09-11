import time
import secrets
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict

# Dev users and token store
_DEV_USERS = {
    "operator": {
        "id": "usr_op_01",
        "email": "operator@voxshield.sec",
        "name": "Sarah Connor",
        "role": "operator",
        "department": "SOC Tier 1",
    },
    "analyst": {
        "id": "usr_an_01",
        "email": "analyst@voxshield.sec",
        "name": "Alex Vance",
        "role": "analyst",
        "department": "Fraud Investigation Unit",
    },
    "admin": {
        "id": "usr_adm_01",
        "email": "admin@voxshield.sec",
        "name": "Chief Security Officer",
        "role": "admin",
        "department": "Executive Security",
    },
    "system": {
        "id": "usr_sys_01",
        "email": "system@voxshield.sec",
        "name": "Automated Gateway Agent",
        "role": "system",
        "department": "Infrastructure",
    },
}

_active_tokens: Dict[str, dict] = {}

_bearer_scheme = HTTPBearer(auto_error=False)


def _make_session(user: dict) -> dict:
    token = f"dev_jwt_{user['role']}_{secrets.token_hex(16)}"
    expires_at = time.strftime(
        "%Y-%m-%dT%H:%M:%S.000Z",
        time.gmtime(time.time() + 8 * 3600),
    )
    _active_tokens[token] = user
    return {"user": user, "token": token, "expiresAt": expires_at}


def _resolve_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> Optional[dict]:
    if credentials is None:
        return None
    return _active_tokens.get(credentials.credentials)


async def require_authenticated_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> dict:
    user = _resolve_token(credentials)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return user


async def require_admin(user: dict = Depends(require_authenticated_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


# expose for main endpoints
__all__ = [
    "_DEV_USERS",
    "_active_tokens",
    "_make_session",
    "_resolve_token",
    "require_authenticated_user",
    "require_admin",
]