import io

from tests.conftest import register, verified_user, emails_to

PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"
FORM = {"certificate_type": "CGPDTM Registered Patent Agent", "certificate_number": "IN/PA/3842",
        "issuing_authority": "CGPDTM", "holder_name": "Dr Expert One"}


def _submit(client, headers, data=PDF, name="cert.pdf", **over):
    return client.post("/api/expert-certificates", data={**FORM, **over},
                       files={"file": (name, io.BytesIO(data), "application/pdf")}, headers=headers)


def _expert(client, email="e1@example.com", name="Dr Expert One"):
    return verified_user(client, email, roles=("Expert",), name=name)


def _admin(client, email="adm@example.com"):
    return verified_user(client, email, roles=("Admin",), name="Admin User")


def test_requires_auth_verified_email_and_expert_role(client):
    assert _submit(client, {}).status_code == 401
    body = register(client, "u@example.com", roles=("Expert",))          # not verified
    assert _submit(client, {"Authorization": f"Bearer {body['token']}"}).status_code == 403
    h, _ = verified_user(client, "prac@example.com", roles=("Practitioner",))
    r = _submit(client, h)
    assert r.status_code == 403 and r.json()["code"] == "not_an_expert"


def test_submit_starts_pending_never_auto_verified(client):
    h, _ = _expert(client)
    r = _submit(client, h)
    assert r.status_code == 201
    c = r.json()
    assert c["status"] == "pending" and c["verified_at"] is None
    assert any(k["name"] == "external_registry" and k["result"] == "skipped" for k in c["checks"])  # honest: no source connected
    assert emails_to("e1@example.com", "notification")


def test_validation_errors(client):
    h, _ = _expert(client)
    assert _submit(client, h, certificate_number="!!").status_code == 422
    assert _submit(client, h, issue_date="not-a-date").status_code == 422
    assert _submit(client, h, issue_date="2999-01-01").status_code == 422
    assert _submit(client, h, issue_date="2020-01-01", expiry_date="2019-01-01").status_code == 422
    assert _submit(client, h, data=b"MZ\x90\x00 exe", name="x.pdf").status_code == 415   # content != extension
    assert _submit(client, h, data=PDF, name="x.exe").status_code == 415
    assert _submit(client, h, data=b"").status_code == 400


def test_oversize_rejected(client):
    h, _ = _expert(client)
    assert _submit(client, h, data=PDF + b"0" * (5 * 1024 * 1024 + 10)).status_code == 413


def test_expired_by_stated_date(client):
    h, _ = _expert(client)
    r = _submit(client, h, issue_date="2010-01-01", expiry_date="2011-01-01")
    assert r.json()["status"] == "expired"


def test_name_mismatch_flagged(client):
    h, _ = _expert(client)
    c = _submit(client, h, holder_name="Completely Different Person").json()
    assert c["status"] == "pending"
    assert any(k["name"] == "holder_matches_account" and k["result"] == "fail" for k in c["checks"])


def test_owner_cannot_verify_own_and_non_admin_cannot_review(client):
    h, _ = _expert(client)
    cid = _submit(client, h).json()["id"]
    r = client.post(f"/api/admin/expert-certificates/{cid}/review", json={"decision": "verify"}, headers=h)
    assert r.status_code == 403
    h2, _ = _expert(client, "e2@example.com", "Dr Other")
    r = client.post(f"/api/admin/expert-certificates/{cid}/review", json={"decision": "verify"}, headers=h2)
    assert r.status_code == 403


def test_admin_verify_reject_flow_and_notifications(client):
    h, _ = _expert(client)
    ah, _ = _admin(client)
    cid = _submit(client, h).json()["id"]
    assert client.get(f"/api/admin/expert-certificates?status=pending", headers=ah).json()["certificates"]
    r = client.post(f"/api/admin/expert-certificates/{cid}/review", json={"decision": "reject"}, headers=ah)
    assert r.status_code == 422                                   # reason required
    r = client.post(f"/api/admin/expert-certificates/{cid}/review", json={"decision": "verify", "reason": "Checked register"}, headers=ah)
    assert r.status_code == 200 and r.json()["status"] == "verified" and r.json()["verification_method"] == "admin_review"
    assert r.json()["verified_by"]
    assert client.get("/api/expert-certificates/status", headers=h).json()["has_verified_certificate"] is True
    types = [i["type"] for i in client.get("/api/notifications", headers=h).json()["items"]]
    assert "certificate_status" in types
    assert client.delete(f"/api/expert-certificates/{cid}", headers=h).status_code == 409   # verified is locked


def test_other_user_cannot_read_or_download_certificate(client):
    h, _ = _expert(client)
    h2, _ = _expert(client, "e3@example.com", "Dr Third")
    cid = _submit(client, h).json()["id"]
    assert client.get(f"/api/expert-certificates/{cid}", headers=h2).status_code == 404
    assert client.get(f"/api/expert-certificates/{cid}/file", headers=h2).status_code == 404
    assert client.post(f"/api/expert-certificates/{cid}/verify", headers=h2).status_code == 404
    assert client.delete(f"/api/expert-certificates/{cid}", headers=h2).status_code == 404
    r = client.get(f"/api/expert-certificates/{cid}/file", headers=h)
    assert r.status_code == 200 and r.content == PDF and "attachment" in r.headers["content-disposition"]


def test_duplicate_registration_number_flagged_and_blocks_second_verification(client):
    h1, _ = _expert(client)
    h2, _ = _expert(client, "e4@example.com", "Dr Expert One")
    ah, _ = _admin(client)
    c1 = _submit(client, h1).json()["id"]
    c2 = _submit(client, h2, data=PDF + b"\n%different").json()
    assert any(k["name"] == "duplicate_registration_number" and k["result"] == "fail" for k in c2["checks"])
    assert client.post(f"/api/admin/expert-certificates/{c1}/review", json={"decision": "verify"}, headers=ah).status_code == 200
    r = client.post(f"/api/admin/expert-certificates/{c2['id']}/review", json={"decision": "verify"}, headers=ah)
    assert r.status_code == 409 and r.json()["code"] == "duplicate_verified"


def test_external_provider_can_verify_but_local_flags_block_it(client):
    from app.core.config import get_settings
    from app.services import certificate_verifiers as cv

    class Ok(cv.CertificateVerifier):
        name = "fake_registry_for_test"
        def verify(self, cert):
            return cv.ProviderResult("verified", "record found")

    cv.register_verifier("fake_registry_for_test", Ok)
    s = get_settings()
    s.cert_verification_provider = "fake_registry_for_test"
    try:
        h, _ = _expert(client)
        assert _submit(client, h).json()["status"] == "verified"
        h2, _ = _expert(client, "e5@example.com", "Dr Two")
        c = _submit(client, h2, certificate_number="IN/PA/9999", holder_name="Somebody Else").json()
        assert c["status"] == "pending"          # registry OK but name mismatch -> human review
    finally:
        s.cert_verification_provider = "none"


def test_escalation_gate_optional(client):
    from app.core.config import get_settings
    h, _ = _expert(client)
    assert client.get("/api/expert-escalations", headers=h).status_code == 200
    s = get_settings(); s.require_verified_expert_certificate = True
    try:
        r = client.get("/api/expert-escalations", headers=h)
        assert r.status_code == 403 and r.json()["code"] == "certificate_not_verified"
    finally:
        s.require_verified_expert_certificate = False
