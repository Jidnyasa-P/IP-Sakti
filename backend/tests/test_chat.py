def test_chat_creates_conversation_and_answer(client):
    resp = client.post("/api/chat", json={"query": "Can I patent a classical Ayurvedic formulation?"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["conversation_id"].startswith("conv-")
    assert body["message"]["role"] == "assistant"
    assert len(body["message"]["citations"]) > 0
    assert body["message"]["confidence"]["level"] in ("High", "Moderate", "Low", "Insufficient evidence")


def test_chat_requires_query(client):
    resp = client.post("/api/chat", json={"query": ""})
    assert resp.status_code == 400


def test_conversation_roundtrip(client):
    create = client.post("/api/conversations", json={"title": "Test session"})
    conv_id = create.json()["id"]

    chat_resp = client.post("/api/chat", json={"conversation_id": conv_id, "query": "What is Section 6 of the Biological Diversity Act?"})
    assert chat_resp.status_code == 200

    fetched = client.get(f"/api/conversations/{conv_id}")
    assert fetched.status_code == 200
    assert len(fetched.json()["messages"]) == 2

    deleted = client.delete(f"/api/conversations/{conv_id}")
    assert deleted.status_code == 200
    assert client.get(f"/api/conversations/{conv_id}").status_code == 404


def test_query_canonical_endpoint_shape(client):
    resp = client.post("/api/query", json={"query": "biological diversity act NBA approval"})
    assert resp.status_code == 200
    body = resp.json()
    for key in ["answer", "classification", "jurisdiction", "citations", "confidence", "expert_escalation"]:
        assert key in body


def test_query_no_evidence_abstains_safely(client):
    resp = client.post("/api/query", json={"query": "asdkjhaslkdjh completely unrelated gibberish xyzzy"})
    assert resp.status_code == 200
    body = resp.json()
    # Should not claim high confidence when nothing relevant is retrieved.
    assert body["confidence_detail"]["level"] in ("Low", "Insufficient evidence")
