def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["database"] == "connected"


def test_protected_endpoint_rejects_missing_token(client):
    resp = client.post("/api/classify", json={"text": "anything"})
    assert resp.status_code == 401


def test_classify_high_confidence(client, auth_headers):
    resp = client.post("/api/classify", json={"text": "This is a classical formulation from Charaka Samhita"}, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["category"] == "classical_ayurvedic"
    assert body["needs_clarification"] is False


def test_classify_uncertain_triggers_clarification(client, auth_headers):
    resp = client.post("/api/classify", json={"text": "hello there"}, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["needs_clarification"] is True
    assert len(body["clarification_questions"]) > 0


def test_search_returns_results(client, auth_headers):
    resp = client.post("/api/search", json={"query": "Section 3(p) traditional knowledge patent", "top_k": 3}, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["results"]) > 0


def test_sources_endpoint(client, auth_headers):
    resp = client.get("/api/sources", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()["sources"]) >= 8


def test_validate_known_chunk_exists(client, auth_headers):
    resp = client.post("/api/validate", json={"claim": "Traditional knowledge cannot be patented under Section 3(p)", "chunk_id": "CHUNK-PAT-01"}, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["source_exists"] is True


def test_validate_unknown_chunk_fails_safely(client, auth_headers):
    resp = client.post("/api/validate", json={"claim": "Some claim", "chunk_id": "CHUNK-DOES-NOT-EXIST"}, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["source_exists"] is False
    assert body["validation_status"] == "failed"


def test_admin_endpoint_rejects_non_admin(client, auth_headers):
    resp = client.get("/api/admin/telemetry", headers=auth_headers)
    assert resp.status_code == 403


def test_admin_endpoint_allows_admin(client, admin_auth_headers):
    resp = client.get("/api/admin/telemetry", headers=admin_auth_headers)
    assert resp.status_code == 200
