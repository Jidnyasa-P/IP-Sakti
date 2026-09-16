"""IPR Navigator "at a glance" overview and the Resources mini-tab
endpoint (Sections 9 and 11)."""


def test_ipr_overview_requires_auth(client):
    resp = client.get("/api/ipr/overview")
    assert resp.status_code == 401


def test_ipr_overview_shape(client, auth_headers):
    resp = client.get("/api/ipr/overview", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert "protection_categories" in body
    assert "statutory_sources" in body
    assert len(body["protection_categories"]) > 0
    assert len(body["statutory_sources"]) >= 8

    category = body["protection_categories"][0]
    for key in ["asset_type", "primary_protection", "potential_protection", "why_relevant", "key_considerations", "relevant_authority"]:
        assert key in category

    # No duplicate categories from _IPR_TABLE aliases (e.g. "Manufacturing
    # process" -> "New invention", "Logo" -> "Brand name").
    protections = [c["primary_protection"] for c in body["protection_categories"]]
    assert len(protections) == len(set(protections))


def test_ipr_overview_does_not_duplicate_analyze_endpoint(client, auth_headers):
    """The existing POST /api/ipr/analyze endpoint must be untouched."""
    resp = client.post("/api/ipr/analyze", json={"asset_type": "New invention"}, headers=auth_headers)
    assert resp.status_code == 200
    assert "primary_protection" in resp.json()


def test_resources_endpoint_requires_auth(client):
    resp = client.get("/api/resources")
    assert resp.status_code == 401


def test_resources_endpoint_shape(client, auth_headers):
    resp = client.get("/api/resources", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 8
    assert len(body["resources"]) == body["total"]

    resource = body["resources"][0]
    for key in ["id", "title", "source", "authority", "document_type", "jurisdiction", "topic", "url", "summary"]:
        assert key in resource

    # Internal indexing fields must not leak into the mini-tab payload.
    assert "status" not in resource
    assert "chunk_count" not in resource
