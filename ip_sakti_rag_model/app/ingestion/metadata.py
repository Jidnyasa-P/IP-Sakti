"""
Document metadata registry.

Every document you ingest MUST have an entry here (or in a `manifest.json` you
maintain alongside `data/documents/`) supplying authority/jurisdiction/dates/
source URL. This is what lets you update the knowledge base when a law changes
— bump `version` / set `effective_date` / point `superseded_by` at the new
document id — without retraining anything.

You (the project owner) are responsible for filling in accurate, real values
here — this module never invents URLs, dates, or authorities.
"""
from __future__ import annotations

import json
from pathlib import Path

from app.schemas import DocumentMetadata


def load_manifest(documents_dir: Path) -> dict[str, DocumentMetadata]:
    """
    Loads `documents_dir/manifest.json`, a dict keyed by filename:

    {
      "patents_act_1970.pdf": {
        "id": "DOC-PATENTS-ACT-1970",
        "title": "The Patents Act, 1970 (Act No. 39 of 1970)",
        "source": "India Code",
        "authority": "Office of the Controller General of Patents, Designs & Trade Marks (CGPDTM)",
        "url": "https://www.indiacode.nic.in/...",
        "document_type": "Act",
        "jurisdiction": "India",
        "publication_date": "1970-09-19",
        "effective_date": "1972-04-20",
        "topic": "IPR",
        "summary": "..."
      },
      ...
    }

    Raises a clear error (rather than guessing) if a file in `documents_dir`
    has no manifest entry — we do not invent metadata for legal sources.
    """
    manifest_path = documents_dir / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(
            f"No manifest.json found in {documents_dir}. Create one describing "
            "every source document's title/authority/jurisdiction/dates/url "
            "before running ingestion — metadata must never be guessed for "
            "legal/regulatory sources."
        )
    raw = json.loads(manifest_path.read_text(encoding="utf-8"))
    return {filename: DocumentMetadata(**meta) for filename, meta in raw.items()}


def save_processed_documents(documents: list[DocumentMetadata], out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        for doc in documents:
            f.write(doc.model_dump_json() + "\n")


def load_processed_documents(path: Path) -> list[DocumentMetadata]:
    if not path.exists():
        return []
    docs = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                docs.append(DocumentMetadata(**json.loads(line)))
    return docs
