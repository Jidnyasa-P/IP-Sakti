import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# No MONGODB_URI is set for tests -> app/database/session.py transparently
# falls back to mongomock (in-memory, pymongo-API compatible), so the suite
# exercises the exact same collection/index/query code that runs against a
# real MongoDB, without needing a live server in CI.
os.environ.setdefault("MONGODB_URI", "")
os.environ.setdefault("MONGODB_DB_NAME", "ip_sakti_test")

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
