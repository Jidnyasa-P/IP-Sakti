from tests.conftest import register, verified_user, emails_to


def test_notifications_require_auth(client):
    assert client.get("/api/notifications").status_code == 401


def test_registration_creates_welcome_notification_and_unread_count(client):
    body = register(client, "n1@example.com")
    h = {"Authorization": f"Bearer {body['token']}"}
    r = client.get("/api/notifications", headers=h).json()
    assert r["unread_count"] == 1 and r["items"][0]["type"] == "welcome" and r["items"][0]["is_read"] is False
    assert client.get("/api/notifications/unread-count", headers=h).json() == {"unread_count": 1}


def test_mark_read_and_read_all(client):
    h, _ = verified_user(client, "n2@example.com")  # welcome + email_verified notifications
    items = client.get("/api/notifications", headers=h).json()["items"]
    assert len(items) == 2
    r = client.patch(f"/api/notifications/{items[0]['id']}/read", headers=h)
    assert r.status_code == 200 and r.json()["is_read"] is True and r.json()["read_at"]
    assert client.get("/api/notifications?unread_only=true", headers=h).json()["unread_count"] == 1
    r = client.post("/api/notifications/read-all", headers=h)
    assert r.json() == {"success": True, "marked_read": 1}
    assert client.get("/api/notifications/unread-count", headers=h).json()["unread_count"] == 0


def test_cannot_read_or_mark_other_users_notification(client):
    h1, _ = verified_user(client, "n3@example.com")
    h2, _ = verified_user(client, "n4@example.com")
    nid = client.get("/api/notifications", headers=h1).json()["items"][0]["id"]
    assert client.patch(f"/api/notifications/{nid}/read", headers=h2).status_code == 404
    assert all(i["id"] != nid for i in client.get("/api/notifications", headers=h2).json()["items"])
    assert client.get("/api/notifications/unread-count", headers=h1).json()["unread_count"] == 2


def test_pagination_validation(client):
    h, _ = verified_user(client, "n5@example.com")
    assert client.get("/api/notifications?limit=0", headers=h).status_code == 422
    assert client.get("/api/notifications?limit=1", headers=h).json()["items"].__len__() == 1


def test_escalation_update_notifies_asker_by_email_and_bell(client):
    asker_h, asker = verified_user(client, "asker@example.com")
    expert_h, _ = verified_user(client, "expert@example.com", roles=("Expert",))
    conv = client.post("/api/conversations", json={"title": "q"}, headers=asker_h).json()["id"]
    esc = client.post("/api/expert-escalation", json={"query": "help", "conversation_id": conv}, headers=asker_h).json()["escalation_id"]
    r = client.patch(f"/api/expert-escalations/{esc}?status=assigned", headers=expert_h)
    assert r.status_code == 200
    types = [i["type"] for i in client.get("/api/notifications", headers=asker_h).json()["items"]]
    assert "escalation_update" in types
    assert emails_to("asker@example.com", "notification")
