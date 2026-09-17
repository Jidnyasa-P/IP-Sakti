"""
Extracts plain text from official source documents (PDF / HTML / TXT).

Deliberately conservative: this module never fetches or scrapes TKDL — only
local files you place in `data/documents/` are processed. If you have
authorized TKDL API access, write a separate connector and feed its output
through `chunker.py` directly rather than dropping raw TKDL text on disk.

Some official documents (especially older brochures/gazette scans) have no
text layer at all — pypdf silently returns empty strings for these rather
than raising an error, which would otherwise cause a document to vanish from
the corpus with no warning. This module detects that case and falls back to
OCR (pytesseract) rather than silently producing zero chunks.
"""
from __future__ import annotations

from pathlib import Path

# Below this many extracted characters per page (on average), treat the PDF
# as having no usable text layer and fall back to OCR.
_MIN_CHARS_PER_PAGE_THRESHOLD = 20


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
    pages_text = [page.extract_text() or "" for page in reader.pages]
    text = "\n\n".join(pages_text)

    avg_chars_per_page = len(text) / max(len(pages_text), 1)
    if avg_chars_per_page < _MIN_CHARS_PER_PAGE_THRESHOLD:
        print(
            f"[extract] '{file_path.name}' has no usable text layer "
            f"({avg_chars_per_page:.0f} chars/page) — falling back to OCR. "
            "This is slower; expect ~a few seconds per page."
        )
        return _ocr_pdf(file_path)

    return text


def _ocr_pdf(file_path: Path) -> str:
    try:
        import pytesseract
        from pdf2image import convert_from_path
    except ImportError as exc:
        raise RuntimeError(
            f"'{file_path.name}' appears to be a scanned/image-only PDF with no "
            "text layer, but OCR dependencies (pytesseract, pdf2image) are not "
            "installed. Install them (`pip install pytesseract pdf2image`, plus "
            "the `tesseract-ocr` and `poppler-utils` system packages), or "
            "manually re-source a text-layer version of this document."
        ) from exc

    images = convert_from_path(str(file_path), dpi=200)
    page_texts = [pytesseract.image_to_string(img) for img in images]
    return "\n\n".join(page_texts)


def _extract_html(file_path: Path) -> str:
    from bs4 import BeautifulSoup

    html = file_path.read_text(encoding="utf-8", errors="ignore")
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    return soup.get_text(separator="\n\n")
