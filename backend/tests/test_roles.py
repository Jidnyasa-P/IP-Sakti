"""Role vocabulary validation (Section 5/7: Organization/Startup role
handling must be secure; do not blindly accept arbitrary role strings)."""


def test_register_rejects_unknown_role(client):
    resp = client.post("/api/auth/register", json={
        "name": "Bad Actor", "email": "badrole@example.com", "password": "testpass123",
        "roles": ["SuperAdmin"],
    })
    assert resp.status_code == 400


def test_register_accepts_organization_role(client):
    resp = client.post("/api/auth/register", json={
        "name": "Org User", "email": "orguser@example.com", "password": "testpass123",
        "roles": ["Organization"],
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["role"] == "Organization"
    assert "Organization" in body["user"]["roles"]


def test_register_accepts_startup_role(client):
    resp = client.post("/api/auth/register", json={
        "name": "Startup User", "email": "startupuser@example.com", "password": "testpass123",
        "roles": ["Startup"],
    })
    assert resp.status_code == 200
    assert resp.json()["user"]["role"] == "Startup"


def test_add_role_rejects_unknown_role(client, auth_headers):
    resp = client.post("/api/auth/roles", json={"role": "NotARealRole"}, headers=auth_headers)
    assert resp.status_code == 400


def test_add_role_accepts_known_role(client, auth_headers):
    resp = client.post("/api/auth/roles", json={"role": "Startup"}, headers=auth_headers)
    assert resp.status_code == 200
    assert "Startup" in resp.json()["roles"]


def test_cannot_activate_role_not_held(client, auth_headers):
    # auth_headers user only holds "Researcher".
    resp = client.post("/api/auth/active-role", json={"role": "Admin"}, headers=auth_headers)
    assert resp.status_code == 400


def test_admin_only_endpoint_still_enforced(client, auth_headers):
    resp = client.get("/api/admin/telemetry", headers=auth_headers)
    assert resp.status_code == 403


def test_expert_or_admin_endpoint_still_enforced(client, auth_headers):
    resp = client.get("/api/expert-escalations", headers=auth_headers)
    assert resp.status_code == 403
