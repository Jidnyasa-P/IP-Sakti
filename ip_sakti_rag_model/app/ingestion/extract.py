"""
Extracts plain text from official source documents (PDF / HTML / TXT).

Deliberately conservative: this module never fetches or scrapes TKDL — only
local files you place in `data/documents/` are processed. If you have
authorized TKDL API access, write a separate connector and feed its output
through `chunker.py` directly rather than dropping raw TKDL text on disk.
"""
from __future__ import annotations

from pathlib import Path


def extract_text(file_path: Path) -> str:
    suffix = file_path.suffix.lower()
    if suffix == ".pdf":
        return _extract_pdf(file_path)
    if suffix in (".html", ".htm"):
        return _extract_html(file_path)
    if suffix == ".txt":
        return file_path.read_text(encoding="utf-8", errors="ignore")
    raise ValueError(f"Unsupported document type: {suffix} ({file_path.name})")


def _extract_pdf(file_path: Path) -> str:
    from pypdf import PdfReader

    reader = PdfReader(str(file_path))
    pages_text = []
    for page in reader.pages:
        pages_text.append(page.extract_text() or "")
    return "\n\n".join(pages_text)


def _extract_html(file_path: Path) -> str:
    from bs4 import BeautifulSoup

    html = file_path.read_text(encoding="utf-8", errors="ignore")
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    return soup.get_text(separator="\n\n")
