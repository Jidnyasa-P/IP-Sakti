import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# No MONGODB_URI is set for tests -> app/database/session.py transparently
# falls back to mongomock (in-memory, pymongo-API compatible), so the suite
# exercises the exact same collection/index/query code that runs against a
# real MongoDB, without needing a live server in CI.
os.environ.setdefault("MONGODB_URI", "")
os.environ.setdefault("MONGODB_DB_NAME", "ip_sakti_test")

# New features: capture outgoing email in-process and keep uploads in a temp dir.
import tempfile

os.environ.setdefault("EMAIL_BACKEND", "memory")
os.environ.setdefault("UPLOAD_DIR", tempfile.mkdtemp(prefix="ipsakti-test-uploads-"))

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database.session import init_db, reset_db_for_tests


@pytest.fixture(scope="session", autouse=True)
def _init_test_db():
    init_db()
    yield


@pytest.fixture()
def client():
    reset_db_for_tests()
    from app.services import email_service
    from app.core.rate_limit import reset_rate_limits
    email_service.clear_outbox()
    reset_rate_limits()
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def auth_headers(client):
    """Registers a fresh Researcher user and returns an Authorization header
    for it. Most protected endpoints only need any authenticated user."""
    resp = client.post("/api/auth/register", json={
        "name": "Test Researcher",
        "email": "researcher@example.com",
        "password": "testpass123",
        "roles": ["Researcher"],
    })
    assert resp.status_code == 200, resp.text
    token = resp.json()["token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def admin_auth_headers(client):
    """Registers a fresh Admin user and returns an Authorization header for
    it — needed for /api/admin/* and document-ingestion endpoints."""
    resp = client.post("/api/auth/register", json={
        "name": "Test Admin",
        "email": "admin@example.com",
        "password": "testpass123",
        "roles": ["Admin"],
    })
    assert resp.status_code == 200, resp.text
    token = resp.json()["token"]
    return {"Authorization": f"Bearer {token}"}


# ---- helpers for the new feature tests ---------------------------------
import re as _re


def latest_otp(email: str) -> str:
    """Extract the most recent OTP sent to `email` from the in-memory outbox."""
    from app.services import email_service
    for msg in reversed(email_service.OUTBOX):
        if msg["to"] == email and msg["template"] == "otp_verification":
            return _re.search(r"code is: (\d+)", msg["text"]).group(1)
    raise AssertionError(f"no OTP email for {email}")


def emails_to(email: str, template: str | None = None) -> list[dict]:
    from app.services import email_service
    return [m for m in email_service.OUTBOX if m["to"] == email and (template is None or m["template"] == template)]


def register(client, email, roles=("Practitioner",), name="Test User", password="testpass123", headers=None):
    resp = client.post("/api/auth/register", json={"name": name, "email": email, "password": password,
                                                    "roles": list(roles)}, headers=headers or {})
    assert resp.status_code == 200, resp.text
    return resp.json()


def verified_user(client, email, roles=("Practitioner",), name="Test User"):
    """Register + complete OTP verification; returns (auth_headers, user)."""
    body = register(client, email, roles, name)
    r = client.post("/api/auth/verify-email", json={"email": email, "otp": latest_otp(email)})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {body['token']}"}, r.json()["user"]
