"""
Loads the curated authoritative-document corpus shipped with the project.

This corpus (backend/data/authoritative_documents.json) was ported verbatim
from the existing frontend project's server/data/authoritative_documents.ts —
real, human-curated statutory text and metadata, not generated content. It
covers the Patents Act 1970, Biological Diversity Act 2002/2023, Drugs and
Cosmetics Act 1940, FSSAI Ayurveda Aahar Regulations 2022, Trade Marks Act
1999, Designs Act 2000, and PPV&FR Act 2001 (18 chunks / 8 documents).

Document ingestion (Section 10) adds further documents at runtime via
/api/documents/ingest; those are merged in here so retrieval sees the full
corpus. The retriever singleton is rebuilt after ingestion (see rag/ingest.py).
"""
import json
import os
import threading
from functools import lru_cache

_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "authoritative_documents.json")
_lock = threading.Lock()
_runtime_metadata: list[dict] = []
_runtime_chunks: list[dict] = []


@lru_cache
def _load_base_corpus() -> dict:
    with open(_DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def get_metadata() -> list[dict]:
    return _load_base_corpus()["AUTHORITATIVE_METADATA"] + _runtime_metadata


def get_chunks() -> list[dict]:
    return _load_base_corpus()["AUTHORITATIVE_CHUNKS"] + _runtime_chunks


def add_document(metadata: dict, chunks: list[dict]) -> None:
    """Register a newly-ingested document + its chunks (Section 10)."""
    with _lock:
        _runtime_metadata.append(metadata)
        _runtime_chunks.extend(chunks)


def source_authority_level(authority: str, document_type: str) -> str:
    """Section 11: source authority ranking.

    Official government/statutory sources (Acts, Rules, official Guidelines
    issued by CGPDTM/NBA/AYUSH/FSSAI) rank highest; anything else defaults to
    a lower tier so it is never silently treated as equally authoritative.
    """
    official_markers = ["CGPDTM", "NBA", "AYUSH", "FSSAI", "IP India", "Ministry", "Ministry of AYUSH", "Registry", "Authority", "Office"]
    if document_type in ("Act", "Rules", "Notification"):
        return "official"
    if any(m.lower() in authority.lower() for m in official_markers):
        return "official"
    if document_type in ("Guidelines", "Regulation", "Treaty"):
        return "institutional"
    return "secondary"
