import pytest
from fastapi.testclient import TestClient

from ..main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _login(client: TestClient, role: str):
    resp = client.post('/api/v1/auth/login', json={'email': 'x', 'roleOverride': role})
    assert resp.status_code == 200
    return resp.json()['token']


def test_admin_endpoint_requires_authentication(client: TestClient):
    resp = client.get('/api/v1/admin/_auth_test')
    assert resp.status_code == 401


def test_admin_endpoint_rejects_non_admin(client: TestClient):
    token = _login(client, 'analyst')
    resp = client.get('/api/v1/admin/_auth_test', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 403


def test_admin_endpoint_allows_admin(client: TestClient):
    token = _login(client, 'admin')
    resp = client.get('/api/v1/admin/_auth_test', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200
    assert resp.json()['ok'] is True
