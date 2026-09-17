def test_chat_requires_authentication(client):
    resp = client.post("/api/chat", json={"query": "Can I patent this?"})
    assert resp.status_code == 401


def test_chat_creates_conversation_and_answer(client, auth_headers):
    resp = client.post("/api/chat", json={"query": "Can I patent a classical Ayurvedic formulation?"}, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["conversation_id"].startswith("conv-")
    assert body["message"]["role"] == "assistant"
    assert len(body["message"]["citations"]) > 0
    assert body["message"]["confidence"]["level"] in ("High", "Moderate", "Low", "Insufficient evidence")


def test_chat_requires_query(client, auth_headers):
    resp = client.post("/api/chat", json={"query": ""}, headers=auth_headers)
    assert resp.status_code == 400


def test_conversation_roundtrip(client, auth_headers):
    create = client.post("/api/conversations", json={"title": "Test session"}, headers=auth_headers)
    conv_id = create.json()["id"]

    chat_resp = client.post("/api/chat", json={"conversation_id": conv_id, "query": "What is Section 6 of the Biological Diversity Act?"}, headers=auth_headers)
    assert chat_resp.status_code == 200

    fetched = client.get(f"/api/conversations/{conv_id}", headers=auth_headers)
    assert fetched.status_code == 200
    assert len(fetched.json()["messages"]) == 2

    deleted = client.delete(f"/api/conversations/{conv_id}", headers=auth_headers)
    assert deleted.status_code == 200
    assert client.get(f"/api/conversations/{conv_id}", headers=auth_headers).status_code == 404


def test_conversation_not_visible_to_other_users(client, auth_headers):
    """Section 7: user data isolation — a second user must not be able to
    read the first user's conversation."""
    create = client.post("/api/conversations", json={"title": "Private session"}, headers=auth_headers)
    conv_id = create.json()["id"]

    other = client.post("/api/auth/register", json={
        "name": "Other User", "email": "other@example.com", "password": "testpass123", "roles": ["Researcher"],
    })
    other_headers = {"Authorization": f"Bearer {other.json()['token']}"}

    resp = client.get(f"/api/conversations/{conv_id}", headers=other_headers)
    assert resp.status_code == 403

    listing = client.get("/api/conversations", headers=other_headers)
    assert all(c["id"] != conv_id for c in listing.json())


def test_query_canonical_endpoint_shape(client, auth_headers):
    resp = client.post("/api/query", json={"query": "biological diversity act NBA approval"}, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    for key in ["answer", "classification", "jurisdiction", "citations", "confidence", "expert_escalation"]:
        assert key in body


def test_query_no_evidence_abstains_safely(client, auth_headers):
    resp = client.post("/api/query", json={"query": "asdkjhaslkdjh completely unrelated gibberish xyzzy"}, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    # Should not claim high confidence when nothing relevant is retrieved.
    assert body["confidence_detail"]["level"] in ("Low", "Insufficient evidence")
