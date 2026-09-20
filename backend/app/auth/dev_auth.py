from fastapi.security import HTTPBearer

_bearer_scheme = HTTPBearer(auto_error=False)


def get_bearer_scheme():
    return _bearer_scheme
