import pytest
from fastapi.testclient import TestClient

from ..main import app, _active_tokens


@pytest.fixture(autouse=True)
def clear_tokens():
    _active_tokens.clear()
    yield
    _active_tokens.clear()


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


class TestAuthLogin:
    def test_login_default_role_returns_admin_session(self, client):
        resp = client.post("/api/v1/auth/login", json={"email": "admin@voxshield.sec"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["user"]["role"] == "admin"
        assert body["token"].startswith("dev_jwt_admin_")
        assert "expiresAt" in body

    def test_login_role_override_operator(self, client):
        resp = client.post("/api/v1/auth/login", json={"email": "x", "roleOverride": "operator"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["user"]["role"] == "operator"
        assert body["user"]["id"] == "usr_op_01"

    def test_login_role_override_analyst(self, client):
        resp = client.post("/api/v1/auth/login", json={"email": "x", "roleOverride": "analyst"})
        assert resp.status_code == 200
        assert resp.json()["user"]["role"] == "analyst"

    def test_login_unknown_role_falls_back_to_admin(self, client):
        resp = client.post("/api/v1/auth/login", json={"email": "x", "roleOverride": "unknown_role"})
        assert resp.status_code == 200
        assert resp.json()["user"]["role"] == "admin"

    def test_login_token_stored_in_active_tokens(self, client):
        resp = client.post("/api/v1/auth/login", json={"email": "x", "roleOverride": "admin"})
        token = resp.json()["token"]
        assert token in _active_tokens


class TestAuthMe:
    def test_me_with_valid_token_returns_session(self, client):
        login = client.post("/api/v1/auth/login", json={"email": "x", "roleOverride": "analyst"})
        token = login.json()["token"]

        resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["user"]["role"] == "analyst"
        assert "token" in body
        assert "expiresAt" in body

    def test_me_without_token_returns_401(self, client):
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code == 401

    def test_me_with_invalid_token_returns_401(self, client):
        resp = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid_token_xyz"})
        assert resp.status_code == 401

    def test_me_regression_no_404_on_unauthenticated_probe(self, client):
        """Regression: GET /auth/me without token must return 401, not 404."""
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code != 404, "Endpoint must exist and return 401, not 404"
        assert resp.status_code == 401


class TestAuthLogout:
    def test_logout_invalidates_token(self, client):
        login = client.post("/api/v1/auth/login", json={"email": "x"})
        token = login.json()["token"]

        resp = client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200

        me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 401

    def test_logout_without_token_is_safe(self, client):
        resp = client.post("/api/v1/auth/logout")
        assert resp.status_code == 200

    def test_logout_with_invalid_token_is_safe(self, client):
        resp = client.post("/api/v1/auth/logout", headers={"Authorization": "Bearer bogus"})
        assert resp.status_code == 200


class TestAuthRoleFixtures:
    """All four role fixtures must be reachable."""

    @pytest.mark.parametrize("role,expected_id", [
        ("operator", "usr_op_01"),
        ("analyst", "usr_an_01"),
        ("admin", "usr_adm_01"),
        ("system", "usr_sys_01"),
    ])
    def test_role_fixture(self, client, role, expected_id):
        resp = client.post("/api/v1/auth/login", json={"email": "x", "roleOverride": role})
        assert resp.status_code == 200
        assert resp.json()["user"]["id"] == expected_id


class TestAuthDoesNotBreakExistingEndpoints:
    def test_health_still_works(self, client):
        resp = client.get("/api/v1/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"
