def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["database"] == "connected"


def test_classify_high_confidence(client):
    resp = client.post("/api/classify", json={"text": "This is a classical formulation from Charaka Samhita"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["category"] == "classical_ayurvedic"
    assert body["needs_clarification"] is False


def test_classify_uncertain_triggers_clarification(client):
    resp = client.post("/api/classify", json={"text": "hello there"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["needs_clarification"] is True
    assert len(body["clarification_questions"]) > 0


def test_search_returns_results(client):
    resp = client.post("/api/search", json={"query": "Section 3(p) traditional knowledge patent", "top_k": 3})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["results"]) > 0


def test_sources_endpoint(client):
    resp = client.get("/api/sources")
    assert resp.status_code == 200
    assert len(resp.json()["sources"]) >= 8


def test_validate_known_chunk_exists(client):
    resp = client.post("/api/validate", json={"claim": "Traditional knowledge cannot be patented under Section 3(p)", "chunk_id": "CHUNK-PAT-01"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["source_exists"] is True


def test_validate_unknown_chunk_fails_safely(client):
    resp = client.post("/api/validate", json={"claim": "Some claim", "chunk_id": "CHUNK-DOES-NOT-EXIST"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["source_exists"] is False
    assert body["validation_status"] == "failed"
