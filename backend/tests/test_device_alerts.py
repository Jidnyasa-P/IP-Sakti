from tests.conftest import register, verified_user, emails_to

CHROME_WIN = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36"}
SAFARI_IPHONE = {"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile Safari/604.1"}
LOGIN = {"password": "testpass123"}


def _login(client, email, headers):
    r = client.post("/api/auth/login", json={"email": email, **LOGIN}, headers=headers)
    assert r.status_code == 200, r.text
    return r


def test_same_device_login_sends_no_security_email(client):
    register(client, "d1@example.com", headers=CHROME_WIN)
    _login(client, "d1@example.com", CHROME_WIN)
    assert not emails_to("d1@example.com", "new_device_alert")
    assert not emails_to("d1@example.com", "new_signin_alert")


def test_new_device_triggers_exactly_one_alert(client):
    register(client, "d2@example.com", headers=CHROME_WIN)
    _login(client, "d2@example.com", SAFARI_IPHONE)
    assert len(emails_to("d2@example.com", "new_device_alert")) == 1
    assert not emails_to("d2@example.com", "new_signin_alert")  # no duplicate for the same sign-in
    _login(client, "d2@example.com", SAFARI_IPHONE)              # now known -> no second new-device alert
    assert len(emails_to("d2@example.com", "new_device_alert")) == 1


def test_alert_email_masks_ip_and_has_no_secrets(client):
    register(client, "d3@example.com", headers=CHROME_WIN)
    _login(client, "d3@example.com", SAFARI_IPHONE)
    msg = emails_to("d3@example.com", "new_device_alert")[0]
    assert "testpass123" not in msg["text"]
    assert ".x" in msg["text"] or "unknown" in msg["text"]


def test_concurrent_other_device_signin_alert_once_per_cooldown(client):
    register(client, "d4@example.com", headers=CHROME_WIN)
    _login(client, "d4@example.com", SAFARI_IPHONE)   # new device alert
    _login(client, "d4@example.com", CHROME_WIN)      # known device, other device active -> new_signin
    assert len(emails_to("d4@example.com", "new_signin_alert")) == 1
    _login(client, "d4@example.com", CHROME_WIN)      # within cooldown -> silent
    assert len(emails_to("d4@example.com", "new_signin_alert")) == 1


def test_explicit_device_id_header_distinguishes_devices(client):
    register(client, "d5@example.com", headers={**CHROME_WIN, "X-Device-Id": "a" * 24})
    _login(client, "d5@example.com", {**CHROME_WIN, "X-Device-Id": "b" * 24})  # same UA, different device id
    assert len(emails_to("d5@example.com", "new_device_alert")) == 1


def test_devices_list_and_revoke(client):
    body = register(client, "d6@example.com", headers=CHROME_WIN)
    h = {"Authorization": f"Bearer {body['token']}"}
    devs = client.get("/api/auth/devices", headers=h).json()["devices"]
    assert len(devs) == 1 and "ip_hash" not in devs[0]
    assert client.delete(f"/api/auth/devices/{devs[0]['id']}", headers=h).status_code == 200
    _login(client, "d6@example.com", CHROME_WIN)
    assert len(emails_to("d6@example.com", "new_device_alert")) == 1


def test_cannot_revoke_other_users_device(client):
    b1 = register(client, "d7@example.com", headers=CHROME_WIN)
    b2 = register(client, "d8@example.com", headers=CHROME_WIN)
    h1 = {"Authorization": f"Bearer {b1['token']}"}
    h2 = {"Authorization": f"Bearer {b2['token']}"}
    dev = client.get("/api/auth/devices", headers=h1).json()["devices"][0]["id"]
    assert client.delete(f"/api/auth/devices/{dev}", headers=h2).status_code == 404


def test_wrong_password_sends_no_alert(client):
    register(client, "d9@example.com", headers=CHROME_WIN)
    r = client.post("/api/auth/login", json={"email": "d9@example.com", "password": "wrong-pass"}, headers=SAFARI_IPHONE)
    assert r.status_code == 401 and not emails_to("d9@example.com", "new_device_alert")
