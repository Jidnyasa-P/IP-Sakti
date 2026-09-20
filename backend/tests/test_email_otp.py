from datetime import datetime, timedelta, timezone

from tests.conftest import latest_otp, emails_to, register, verified_user
from app.database.session import get_database


def test_register_sends_welcome_and_otp_emails_and_user_unverified(client):
    body = register(client, "otp1@example.com")
    assert body["user"]["email_verified"] is False
    assert body["email_verification"]["otp_sent"] is True
    assert len(emails_to("otp1@example.com", "registration")) == 1
    assert len(emails_to("otp1@example.com", "otp_verification")) == 1


def test_otp_stored_hashed_not_plaintext(client):
    register(client, "otp2@example.com")
    code = latest_otp("otp2@example.com")
    row = get_database()["email_otps"].find_one({"email": "otp2@example.com"})
    assert code not in str(row) and "code" not in row


def test_verify_success_activates_and_sends_confirmation(client):
    register(client, "otp3@example.com")
    r = client.post("/api/auth/verify-email", json={"email": "otp3@example.com", "otp": latest_otp("otp3@example.com")})
    assert r.status_code == 200 and r.json()["user"]["email_verified"] is True
    assert len(emails_to("otp3@example.com", "email_verified")) == 1


def test_wrong_code_counts_attempts_then_locks(client):
    register(client, "otp4@example.com")
    good = latest_otp("otp4@example.com")
    bad = "000000" if good != "000000" else "111111"
    for i in range(4):
        r = client.post("/api/auth/verify-email", json={"email": "otp4@example.com", "otp": bad})
        assert r.status_code == 400 and r.json()["code"] == "otp_invalid"
    r = client.post("/api/auth/verify-email", json={"email": "otp4@example.com", "otp": bad})
    assert r.status_code == 429 and r.json()["code"] == "otp_locked"
    # even the correct code no longer works once locked
    r = client.post("/api/auth/verify-email", json={"email": "otp4@example.com", "otp": good})
    assert r.status_code == 429


def test_code_is_single_use(client):
    register(client, "otp5@example.com")
    code = latest_otp("otp5@example.com")
    assert client.post("/api/auth/verify-email", json={"email": "otp5@example.com", "otp": code}).status_code == 200
    r = client.post("/api/auth/verify-email", json={"email": "otp5@example.com", "otp": code})
    assert r.status_code == 409  # account already verified


def test_expired_code_rejected(client):
    register(client, "otp6@example.com")
    code = latest_otp("otp6@example.com")
    get_database()["email_otps"].update_many({}, {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(seconds=1)}})
    r = client.post("/api/auth/verify-email", json={"email": "otp6@example.com", "otp": code})
    assert r.status_code == 400 and r.json()["code"] == "otp_expired"


def test_resend_cooldown_and_supersede(client):
    register(client, "otp7@example.com")
    first = latest_otp("otp7@example.com")
    r = client.post("/api/auth/resend-otp", json={"email": "otp7@example.com"})
    assert r.status_code == 429 and r.json()["code"] == "otp_resend_cooldown"
    # simulate cooldown elapsed
    get_database()["email_otps"].update_many({}, {"$set": {"created_at": datetime.now(timezone.utc) - timedelta(minutes=5)}})
    assert client.post("/api/auth/resend-otp", json={"email": "otp7@example.com"}).status_code == 200
    second = latest_otp("otp7@example.com")
    if first != second:
        r = client.post("/api/auth/verify-email", json={"email": "otp7@example.com", "otp": first})
        assert r.status_code == 400  # superseded / invalid
    assert client.post("/api/auth/verify-email", json={"email": "otp7@example.com", "otp": second}).status_code == 200


def test_resend_hourly_cap(client):
    register(client, "otp8@example.com")
    for _ in range(4):  # 1 from register + 4 = cap of 5
        get_database()["email_otps"].update_many({}, {"$set": {"created_at": datetime.now(timezone.utc) - timedelta(minutes=5)}})
        # keep them inside the last hour but past the cooldown
        assert client.post("/api/auth/resend-otp", json={"email": "otp8@example.com"}).status_code == 200
    get_database()["email_otps"].update_many({}, {"$set": {"created_at": datetime.now(timezone.utc) - timedelta(minutes=5)}})
    r = client.post("/api/auth/resend-otp", json={"email": "otp8@example.com"})
    assert r.status_code == 429 and r.json()["code"] == "otp_hourly_limit"


def test_resend_unknown_email_is_generic(client):
    r = client.post("/api/auth/resend-otp", json={"email": "nobody@example.com"})
    assert r.status_code == 200


def test_verify_unknown_email_gives_generic_error(client):
    r = client.post("/api/auth/verify-email", json={"email": "nobody@example.com", "otp": "123456"})
    assert r.status_code == 400 and r.json()["code"] == "otp_invalid"


def test_non_numeric_otp_rejected_by_validation(client):
    assert client.post("/api/auth/verify-email", json={"email": "a@example.com", "otp": "abcdef"}).status_code == 422


def test_login_still_works_unverified_by_default(client):
    register(client, "otp9@example.com")
    r = client.post("/api/auth/login", json={"email": "otp9@example.com", "password": "testpass123"})
    assert r.status_code == 200 and r.json()["user"]["email_verified"] is False


def test_require_verification_setting_blocks_login_and_api(client):
    from app.core.config import get_settings
    s = get_settings()
    body = register(client, "otp10@example.com")
    s.require_email_verification = True
    try:
        r = client.post("/api/auth/login", json={"email": "otp10@example.com", "password": "testpass123"})
        assert r.status_code == 403 and r.json()["code"] == "email_not_verified"
        h = {"Authorization": f"Bearer {body['token']}"}
        assert client.get("/api/notifications", headers=h).status_code == 403
        assert client.get("/api/auth/me", headers=h).status_code == 200  # still reachable
        client.post("/api/auth/verify-email", json={"email": "otp10@example.com", "otp": latest_otp("otp10@example.com")})
        assert client.get("/api/notifications", headers=h).status_code == 200
    finally:
        s.require_email_verification = False
