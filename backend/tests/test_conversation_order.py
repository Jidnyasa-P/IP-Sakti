"""Chat conversation ordering and jurisdiction/market context (Sections:
chatbot message order; International + National chat split)."""


def test_conversation_messages_are_chronological(client, auth_headers):
    conv = client.post("/api/conversations", json={"title": "Ordering test"}, headers=auth_headers).json()
    conv_id = conv["id"]

    client.post("/api/chat", json={"conversation_id": conv_id, "query": "First question about patents"}, headers=auth_headers)
    client.post("/api/chat", json={"conversation_id": conv_id, "query": "Second question about trademarks"}, headers=auth_headers)

    fetched = client.get(f"/api/conversations/{conv_id}", headers=auth_headers)
    assert fetched.status_code == 200
    messages = fetched.json()["messages"]
    assert len(messages) == 4

    # user -> assistant -> user -> assistant, in that order.
    assert [m["role"] for m in messages] == ["user", "assistant", "user", "assistant"]
    assert "First question" in messages[0]["content"]
    assert "Second question" in messages[2]["content"]

    # sequence is strictly increasing and matches array order.
    sequences = [m["sequence"] for m in messages]
    assert sequences == sorted(sequences)
    assert len(set(sequences)) == len(sequences)


def test_conversation_list_includes_messages_in_order(client, auth_headers):
    conv = client.post("/api/conversations", json={"title": "List ordering"}, headers=auth_headers).json()
    conv_id = conv["id"]
    client.post("/api/chat", json={"conversation_id": conv_id, "query": "Q1"}, headers=auth_headers)
    client.post("/api/chat", json={"conversation_id": conv_id, "query": "Q2"}, headers=auth_headers)

    listing = client.get("/api/conversations", headers=auth_headers)
    match = next(c for c in listing.json() if c["id"] == conv_id)
    assert [m["role"] for m in match["messages"]] == ["user", "assistant", "user", "assistant"]


def test_chat_accepts_target_market_domestic(client, auth_headers):
    resp = client.post("/api/chat", json={"query": "Can I patent this formulation?", "target_market": "India"}, headers=auth_headers)
    assert resp.status_code == 200
    conv_id = resp.json()["conversation_id"]
    fetched = client.get(f"/api/conversations/{conv_id}", headers=auth_headers).json()
    jurisdiction = fetched["messages"][-1]["jurisdiction"]
    assert jurisdiction["type"] == "domestic"
    assert jurisdiction["country"] == "India"


def test_chat_accepts_target_market_international(client, auth_headers):
    resp = client.post("/api/chat", json={"query": "Can I patent this formulation?", "target_market": "International"}, headers=auth_headers)
    assert resp.status_code == 200
    conv_id = resp.json()["conversation_id"]
    fetched = client.get(f"/api/conversations/{conv_id}", headers=auth_headers).json()
    jurisdiction = fetched["messages"][-1]["jurisdiction"]
    assert jurisdiction["type"] == "international"


def test_chat_still_works_without_target_market(client, auth_headers):
    """Backward compatibility: existing frontend requests with no
    target_market field must keep working exactly as before."""
    resp = client.post("/api/chat", json={"query": "Can I patent a classical Ayurvedic formulation?"}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["message"]["role"] == "assistant"


def test_chat_message_alias_still_works(client, auth_headers):
    resp = client.post("/api/chat", json={"message": "Legacy message field query about trademarks"}, headers=auth_headers)
    assert resp.status_code == 200
