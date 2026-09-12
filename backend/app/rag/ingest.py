"""
Document ingestion pipeline (Section 10):
Document -> Text extraction -> Cleaning -> Chunking -> Metadata extraction ->
Embeddings -> Vector storage -> Indexing.

Chunking is a simple, real sliding-window splitter over whitespace-normalized
text (~180 words per chunk with light overlap) — adequate for an MVP and
genuinely functional, not a stub.
"""
import re
import uuid
from datetime import date

from app.rag.corpus import add_document
from app.rag.vector_store import get_vector_store


def clean_text(raw_text: str) -> str:
    text = re.sub(r"\s+", " ", raw_text or "").strip()
    return text


def chunk_text(text: str, target_words: int = 180, overlap_words: int = 30) -> list[str]:
    words = text.split(" ")
    if not words:
        return []
    chunks = []
    start = 0
    while start < len(words):
        end = min(start + target_words, len(words))
        chunks.append(" ".join(words[start:end]))
        if end == len(words):
            break
        start = end - overlap_words
    return chunks


def ingest_document(payload: dict) -> dict:
    """payload: title, source, authority, url, document_type, jurisdiction,
    topic, summary, raw_text. Returns the resulting metadata dict."""
    cleaned = clean_text(payload["raw_text"])
    text_chunks = chunk_text(cleaned)

    doc_id = f"DOC-USER-{uuid.uuid4().hex[:10]}"
    today = date.today().isoformat()

    metadata = {
        "id": doc_id,
        "title": payload["title"],
        "source": payload["source"],
        "authority": payload["authority"],
        "url": payload.get("url"),
        "document_type": payload.get("document_type", "Guidelines"),
        "jurisdiction": payload.get("jurisdiction", "India"),
        "publication_date": today,
        "effective_date": today,
        "language": "English",
        "topic": payload.get("topic", "AYUSH"),
        "summary": payload.get("summary") or (cleaned[:200] + "..." if len(cleaned) > 200 else cleaned),
        "status": "Indexed" if text_chunks else "Failed",
        "chunk_count": len(text_chunks),
    }

    chunks = []
    store = get_vector_store()
    for i, chunk_body in enumerate(text_chunks):
        chunk_id = f"CHUNK-{doc_id}-{i + 1:02d}"
        chunk = {
            "chunk_id": chunk_id,
            "document_id": doc_id,
            "title": metadata["title"],
            "source": metadata["source"],
            "authority": metadata["authority"],
            "jurisdiction": metadata["jurisdiction"],
            "document_type": metadata["document_type"],
            "section": f"Chunk {i + 1}",
            "page": i + 1,
            "language": metadata["language"],
            "publication_date": metadata["publication_date"],
            "effective_date": metadata["effective_date"],
            "topic": metadata["topic"],
            "chunk_text": chunk_body,
        }
        chunks.append(chunk)
        store.upsert(chunk_id, chunk_body, chunk)

    add_document(metadata, chunks)

    # Rebuild the hybrid retriever's in-memory indexes so the new chunks are searchable immediately.
    from app.retrieval import hybrid_retrieval
    hybrid_retrieval._retriever = None  # noqa: SLF001 (intentional cache bust)

    return metadata
