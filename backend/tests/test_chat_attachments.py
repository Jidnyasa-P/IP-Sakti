import io
import zipfile

from tests.conftest import verified_user
from app.services import url_fetch_service as uf

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 50


def _docx(text):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        z.writestr("word/document.xml", f"<w:document><w:p><w:t>{text}</w:t></w:p></w:document>")
    return buf.getvalue()


def _up(client, h, kind, name, data, conv=None):
    return client.post(f"/api/chat-attachments/{kind}", files={"file": (name, io.BytesIO(data), "application/octet-stream")},
                       data={"conversation_id": conv} if conv else {}, headers=h)


def test_upload_requires_auth(client):
    assert client.post("/api/chat-attachments/documents", files={"file": ("a.txt", b"hi")}).status_code == 401


def test_text_document_creates_conversation_and_extracts(client):
    h, _ = verified_user(client, "a1@example.com")
    r = _up(client, h, "documents", "notes.txt", b"Neem is traditional knowledge.")
    assert r.status_code == 201
    att, conv = r.json()["attachment"], r.json()["conversation_id"]
    assert conv.startswith("conv-") and att["status"] == "processed" and att["extraction_method"] == "plain_text"
    c = client.get(f"/api/chat-attachments/{att['id']}/content", headers=h).json()
    assert "Neem" in c["extracted_text"]


def test_docx_extraction(client):
    h, _ = verified_user(client, "a2@example.com")
    r = _up(client, h, "documents", "d.docx", _docx("Turmeric patent"))
    assert "Turmeric" in client.get(f"/api/chat-attachments/{r.json()['attachment']['id']}/content", headers=h).json()["extracted_text"]


def test_rejects_bad_types_and_mismatches(client):
    h, _ = verified_user(client, "a3@example.com")
    assert _up(client, h, "documents", "x.exe", b"MZ....").status_code == 415
    assert _up(client, h, "documents", "x.pdf", b"not a pdf at all\x00\x01").status_code == 415
    assert _up(client, h, "documents", "x.svg", b"<svg onload=alert(1)/>").status_code == 415
    assert _up(client, h, "images", "x.png", b"plain text").status_code == 415
    assert _up(client, h, "documents", "e.txt", b"").status_code == 400


def test_oversize_rejected(client):
    h, _ = verified_user(client, "a4@example.com")
    assert _up(client, h, "documents", "big.txt", b"a" * (10 * 1024 * 1024 + 1)).status_code == 413


def test_path_traversal_filename_is_harmless(client):
    from app.services import storage_service as ss
    h, _ = verified_user(client, "a5@example.com")
    r = _up(client, h, "documents", "../../../etc/passwd.txt", b"hello")
    assert r.status_code == 201
    name = r.json()["attachment"]["original_filename"]
    assert "/" not in name and ".." not in name.replace("...", "")
    row = __import__("app.database.session", fromlist=["x"]).get_database()["chat_attachments"].find_one({})
    assert ss.resolve_path(row["stored_path"]).is_file() and ".." not in row["stored_path"]


def test_image_upload_stored_without_ocr_is_honest(client):
    h, _ = verified_user(client, "a6@example.com")
    r = _up(client, h, "images", "s.png", PNG)
    # Pillow (if installed) rejects a truncated PNG; without it the file is stored. Both are acceptable, never a crash.
    assert r.status_code in (201, 415)
    if r.status_code == 201:
        assert r.json()["attachment"]["kind"] == "image"


def test_isolation_between_users(client):
    h1, _ = verified_user(client, "b1@example.com")
    h2, _ = verified_user(client, "b2@example.com")
    r = _up(client, h1, "documents", "p.txt", b"private material")
    aid, conv = r.json()["attachment"]["id"], r.json()["conversation_id"]
    for path in (f"/api/chat-attachments/{aid}", f"/api/chat-attachments/{aid}/content", f"/api/chat-attachments/{aid}/file"):
        assert client.get(path, headers=h2).status_code == 404
    assert client.delete(f"/api/chat-attachments/{aid}", headers=h2).status_code == 404
    assert _up(client, h2, "documents", "q.txt", b"x", conv=conv).status_code == 403          # cannot attach to others' conversation
    assert client.get(f"/api/conversations/{conv}/attachment-context", headers=h2).status_code == 403
    assert client.get(f"/api/chat-attachments?conversation_id={conv}", headers=h2).status_code == 403
    assert client.get("/api/chat-attachments", headers=h2).json()["attachments"] == []
    assert client.get(f"/api/chat-attachments/{aid}/file", headers=h1).content == b"private material"


def test_context_selects_relevant_passages(client):
    h, _ = verified_user(client, "c1@example.com")
    text = ("Filler paragraph about weather. " * 40) + "\n\n" + "Curcumin turmeric patent revocation history. " * 5
    r = _up(client, h, "documents", "t.txt", text.encode())
    conv = r.json()["conversation_id"]
    ctx = client.get(f"/api/conversations/{conv}/attachment-context", params={"query": "turmeric patent"}, headers=h).json()
    assert "turmeric" in ctx["context_text"].lower() and "USER-PROVIDED MATERIAL" in ctx["context_text"]
    assert len(ctx["context_text"]) <= 6000 and ctx["attachment_ids"]


def test_chat_appends_context_but_stores_original_query(client, monkeypatch):
    import app.rag_client as rag_client
    seen = {}

    async def fake_chat(query, language=None, conversation_id=None):
        seen["query"] = query
        return {"answer": "ok", "citations": [], "confidence": {"level": "High", "score": 0.9}, "jurisdiction": ["India"]}

    monkeypatch.setattr(rag_client, "chat", fake_chat)
    h, _ = verified_user(client, "c2@example.com")
    conv = _up(client, h, "documents", "n.txt", b"Ashwagandha extract specification sheet").json()["conversation_id"]
    r = client.post("/api/chat", json={"conversation_id": conv, "query": "ashwagandha spec?"}, headers=h)
    assert r.status_code == 200 and r.json()["attachments_used"]
    assert "Ashwagandha extract" in seen["query"] and seen["query"].startswith("ashwagandha spec?")
    msgs = client.get(f"/api/conversations/{conv}", headers=h).json()["messages"]
    assert msgs[0]["content"] == "ashwagandha spec?"          # user's original wording stored


def test_chat_without_attachments_sends_unchanged_query(client, monkeypatch):
    import app.rag_client as rag_client
    seen = {}

    async def fake_chat(query, language=None, conversation_id=None):
        seen["query"] = query
        return {"answer": "ok", "citations": [], "confidence": {"level": "High"}, "jurisdiction": []}

    monkeypatch.setattr(rag_client, "chat", fake_chat)
    h, _ = verified_user(client, "c3@example.com")
    client.post("/api/chat", json={"query": "plain question"}, headers=h)
    assert seen["query"] == "plain question"


def test_delete_conversation_removes_attachments_and_files(client):
    from app.services import storage_service as ss
    from app.database.session import get_database
    h, _ = verified_user(client, "c4@example.com")
    r = _up(client, h, "documents", "z.txt", b"bye")
    conv = r.json()["conversation_id"]
    path = ss.resolve_path(get_database()["chat_attachments"].find_one({})["stored_path"])
    assert path.is_file()
    assert client.delete(f"/api/conversations/{conv}", headers=h).status_code == 200
    assert not path.exists() and get_database()["chat_attachments"].count_documents({}) == 0


def test_link_ingestion_uses_safe_fetcher(client, monkeypatch):
    h, _ = verified_user(client, "l1@example.com")
    monkeypatch.setattr(uf, "_resolve_host", lambda host, port: ["93.184.216.34"])
    monkeypatch.setattr(uf, "fetch_url", lambda url: uf.FetchResult(
        url, "text/html", b"<html><title>T</title><script>evil()</script><body><p>Visible text</p></body></html>"))
    r = client.post("/api/chat-attachments/links", json={"url": "https://example.org/page"}, headers=h)
    assert r.status_code == 201
    att = r.json()["attachment"]
    assert att["kind"] == "url" and att["title"] == "T"
    text = client.get(f"/api/chat-attachments/{att['id']}/content", headers=h).json()["extracted_text"]
    assert "Visible text" in text and "evil" not in text


def test_link_to_internal_addresses_rejected(client):
    h, _ = verified_user(client, "l2@example.com")
    for url in ("http://127.0.0.1/", "http://localhost/admin", "http://169.254.169.254/latest/meta-data/",
                "http://10.0.0.5/", "http://[::1]/", "http://2130706433/", "file:///etc/passwd", "ftp://example.com/",
                "http://user:pw@example.com/", "http://example.com:22/"):
        r = client.post("/api/chat-attachments/links", json={"url": url}, headers=h)
        assert r.status_code == 400, (url, r.status_code)
    assert client.get("/api/chat-attachments", headers=h).json()["attachments"] == []   # nothing recorded


def test_internal_endpoint_disabled_without_secret_and_scoped_with_it(client):
    from app.core.config import get_settings
    h, u = verified_user(client, "i1@example.com")
    conv = _up(client, h, "documents", "n.txt", b"scoped text").json()["conversation_id"]
    url = f"/api/internal/conversations/{conv}/attachment-context"
    assert client.get(url, params={"user_id": u["id"]}).status_code == 404
    s = get_settings(); s.rag_service_shared_secret = "s3cret"
    try:
        assert client.get(url, params={"user_id": u["id"]}, headers={"X-Internal-Secret": "wrong"}).status_code == 404
        ok = client.get(url, params={"user_id": u["id"]}, headers={"X-Internal-Secret": "s3cret"})
        assert ok.status_code == 200 and "scoped text" in ok.json()["context_text"]
        h2, u2 = verified_user(client, "i2@example.com")
        assert client.get(url, params={"user_id": u2["id"]}, headers={"X-Internal-Secret": "s3cret"}).status_code == 403
    finally:
        s.rag_service_shared_secret = ""
