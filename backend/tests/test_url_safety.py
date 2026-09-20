import pytest

from app.core.errors import AppError
from app.services import url_fetch_service as uf


@pytest.mark.parametrize("ip,ok", [
    ("8.8.8.8", True), ("93.184.216.34", True), ("2606:4700:4700::1111", True),
    ("127.0.0.1", False), ("10.1.2.3", False), ("172.16.0.1", False), ("192.168.1.1", False),
    ("169.254.169.254", False), ("100.64.0.1", False), ("0.0.0.0", False), ("224.0.0.1", False),
    ("::1", False), ("fe80::1", False), ("fc00::1", False), ("::ffff:127.0.0.1", False), ("::ffff:10.0.0.1", False),
])
def test_is_public_ip(ip, ok):
    assert uf.is_public_ip(ip) is ok


def test_validate_url_rejects_dns_pointing_at_private(monkeypatch):
    monkeypatch.setattr(uf, "_resolve_host", lambda h, p: ["93.184.216.34", "10.0.0.1"])  # one bad address is enough
    with pytest.raises(AppError):
        uf.validate_url("https://evil.example.com/")


def test_validate_url_accepts_public(monkeypatch):
    monkeypatch.setattr(uf, "_resolve_host", lambda h, p: ["93.184.216.34"])
    norm, host, port, ips = uf.validate_url("https://example.org/a?b=1#frag")
    assert host == "example.org" and port == 443 and "#" not in norm


@pytest.mark.parametrize("url", ["", "javascript:alert(1)", "http://", "https://exa mple.com", "http://a.local/", "http://x.internal/"])
def test_validate_url_rejects_garbage(url):
    with pytest.raises(AppError):
        uf.validate_url(url)
