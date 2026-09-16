"""Product Analyzer PDF export and TK-ABS PDF export (Section: PDF export)."""

_PRODUCT_BODY = {
    "product_name": "Ashwagandha Rasayana Tablets",
    "product_type": "Classical Formulation",
    "dosage_form": "Tablet",
    "ingredients": "Ashwagandha, Triphala",
    "classical_reference": "Charaka Samhita",
    "manufacturing_info": "Standard Ayurvedic process",
    "intended_use": "General wellness",
    "claims": "Supports vitality",
    "target_market": "Domestic (India)",
}

_TK_ABS_BODY = {
    "biological_resource": "Ashwagandha",
    "plant_material": "Root",
    "geographic_origin": "India",
    "traditional_use": "Rasayana / rejuvenation",
    "source_community_info": "Documented in classical texts",
    "intended_use": "Domestic commercial utilization",
}


def test_product_pdf_download(client, auth_headers):
    analyze = client.post("/api/products/analyze", json=_PRODUCT_BODY, headers=auth_headers)
    assert analyze.status_code == 200
    product_id = analyze.json()["id"]

    # Existing JSON endpoint must still work unchanged.
    fetched = client.get(f"/api/products/{product_id}", headers=auth_headers)
    assert fetched.status_code == 200

    pdf_resp = client.get(f"/api/products/{product_id}/pdf", headers=auth_headers)
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert "attachment" in pdf_resp.headers["content-disposition"]
    assert pdf_resp.content[:4] == b"%PDF"
    assert len(pdf_resp.content) > 500


def test_product_pdf_requires_auth(client):
    resp = client.get("/api/products/PROD-doesnotexist/pdf")
    assert resp.status_code == 401


def test_product_pdf_missing_product_404(client, auth_headers):
    resp = client.get("/api/products/PROD-doesnotexist/pdf", headers=auth_headers)
    assert resp.status_code == 404


def test_product_pdf_not_accessible_to_other_user(client, auth_headers):
    analyze = client.post("/api/products/analyze", json=_PRODUCT_BODY, headers=auth_headers)
    product_id = analyze.json()["id"]

    other = client.post("/api/auth/register", json={
        "name": "Other User", "email": "otherprod@example.com", "password": "testpass123", "roles": ["Researcher"],
    })
    other_headers = {"Authorization": f"Bearer {other.json()['token']}"}

    resp = client.get(f"/api/products/{product_id}/pdf", headers=other_headers)
    assert resp.status_code == 403


def test_product_pdf_visible_to_admin(client, auth_headers, admin_auth_headers):
    analyze = client.post("/api/products/analyze", json=_PRODUCT_BODY, headers=auth_headers)
    product_id = analyze.json()["id"]

    resp = client.get(f"/api/products/{product_id}/pdf", headers=admin_auth_headers)
    assert resp.status_code == 200
    assert resp.content[:4] == b"%PDF"


def test_tk_abs_analyze_returns_id_and_json_unchanged(client, auth_headers):
    resp = client.post("/api/tk-abs/analyze", json=_TK_ABS_BODY, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    # Existing keys from decision_engines.evaluate_tk_abs must still be present.
    for key in ["traditional_knowledge_overview", "biological_resource_assessment", "abs_considerations", "recommended_next_steps"]:
        assert key in body
    assert body["id"].startswith("TKABS-")


def test_tk_abs_pdf_download(client, auth_headers):
    analyze = client.post("/api/tk-abs/analyze", json=_TK_ABS_BODY, headers=auth_headers)
    analysis_id = analyze.json()["id"]

    fetched = client.get(f"/api/tk-abs/{analysis_id}", headers=auth_headers)
    assert fetched.status_code == 200

    pdf_resp = client.get(f"/api/tk-abs/{analysis_id}/pdf", headers=auth_headers)
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert pdf_resp.content[:4] == b"%PDF"


def test_tk_abs_pdf_missing_analysis_404(client, auth_headers):
    resp = client.get("/api/tk-abs/TKABS-doesnotexist/pdf", headers=auth_headers)
    assert resp.status_code == 404


def test_tk_abs_pdf_not_accessible_to_other_user(client, auth_headers):
    analyze = client.post("/api/abs/analyze", json=_TK_ABS_BODY, headers=auth_headers)
    analysis_id = analyze.json()["id"]

    other = client.post("/api/auth/register", json={
        "name": "Other User 2", "email": "othertkabs@example.com", "password": "testpass123", "roles": ["Researcher"],
    })
    other_headers = {"Authorization": f"Bearer {other.json()['token']}"}

    resp = client.get(f"/api/tk-abs/{analysis_id}/pdf", headers=other_headers)
    assert resp.status_code == 403


def test_pdf_handles_missing_optional_fields_gracefully(client, auth_headers):
    """Minimal input — most optional fields blank — must not break PDF generation."""
    resp = client.post("/api/products/analyze", json={"product_name": "Minimal Product"}, headers=auth_headers)
    assert resp.status_code == 200
    product_id = resp.json()["id"]
    pdf_resp = client.get(f"/api/products/{product_id}/pdf", headers=auth_headers)
    assert pdf_resp.status_code == 200
    assert pdf_resp.content[:4] == b"%PDF"
