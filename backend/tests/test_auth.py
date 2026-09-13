def test_register_creates_user_and_returns_token(client):
    resp = client.post("/api/auth/register", json={
        "name": "Asha Verma", "email": "asha@example.com", "password": "secure123",
        "roles": ["Practitioner"], "preferred_language": "hi",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["token"]
    assert body["user"]["email"] == "asha@example.com"
    assert body["user"]["role"] == "Practitioner"
    assert body["user"]["roles"] == ["Practitioner"]
    assert "password" not in body["user"]
    assert "password_hash" not in body["user"]


def test_register_duplicate_email_rejected(client):
    payload = {"name": "A", "email": "dup@example.com", "password": "secure123", "roles": ["Researcher"]}
    first = client.post("/api/auth/register", json=payload)
    assert first.status_code == 200
    second = client.post("/api/auth/register", json=payload)
    assert second.status_code == 409


def test_register_short_password_rejected(client):
    resp = client.post("/api/auth/register", json={
        "name": "A", "email": "short@example.com", "password": "123", "roles": ["Researcher"],
    })
    assert resp.status_code == 422


def test_login_success(client):
    client.post("/api/auth/register", json={
        "name": "Login Test", "email": "login@example.com", "password": "secure123", "roles": ["Expert"],
    })
    resp = client.post("/api/auth/login", json={"email": "login@example.com", "password": "secure123"})
    assert resp.status_code == 200
    assert resp.json()["user"]["role"] == "Expert"


def test_login_wrong_password_rejected(client):
    client.post("/api/auth/register", json={
        "name": "Login Test 2", "email": "login2@example.com", "password": "secure123", "roles": ["Expert"],
    })
    resp = client.post("/api/auth/login", json={"email": "login2@example.com", "password": "wrongpass"})
    assert resp.status_code == 401


def test_login_unknown_email_rejected(client):
    resp = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "whatever1"})
    assert resp.status_code == 401


def test_me_requires_valid_token(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401

    resp2 = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert resp2.status_code == 401


def test_me_returns_current_user(client, auth_headers):
    resp = client.get("/api/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "researcher@example.com"


def test_add_role_and_switch_active_role(client, auth_headers):
    added = client.post("/api/auth/roles", json={"role": "Expert"}, headers=auth_headers)
    assert added.status_code == 200
    assert "Expert" in added.json()["roles"]
    assert "Researcher" in added.json()["roles"]  # original role retained

    switched = client.post("/api/auth/active-role", json={"role": "Expert"}, headers=auth_headers)
    assert switched.status_code == 200
    assert switched.json()["role"] == "Expert"


def test_switch_to_role_not_held_rejected(client, auth_headers):
    resp = client.post("/api/auth/active-role", json={"role": "Admin"}, headers=auth_headers)
    assert resp.status_code == 400
