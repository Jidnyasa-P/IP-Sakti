import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ.setdefault("SQLITE_PATH", os.path.join(tempfile.gettempdir(), "ip_sakti_test.db"))

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database.session import init_db


@pytest.fixture(scope="session", autouse=True)
def _init_test_db():
    init_db()
    yield


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c
