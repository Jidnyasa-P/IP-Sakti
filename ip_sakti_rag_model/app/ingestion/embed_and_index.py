"""
End-to-end ingestion: files in data/documents/ -> extracted text -> legal-aware
chunks -> DocumentChunk objects with metadata -> embeddings -> Qdrant upsert
-> persisted chunks.jsonl (used to rebuild the BM25 index fast at server start,
without re-embedding).
"""
from __future__ import annotations

import json
import uuid
from pathlib import Path

from app.config import settings
from app.ingestion.chunker import legal_aware_chunk
from app.ingestion.extract import extract_text
from app.ingestion.metadata import load_manifest, save_processed_documents
from app.schemas import DocumentChunk, DocumentMetadata

_embedder = None


def get_embedder():
    global _embedder
    if _embedder is None:
        from sentence_transformers import SentenceTransformer

        _embedder = SentenceTransformer(settings.embedding_model)
    return _embedder


def embed_texts(texts: list[str]) -> list[list[float]]:
    model = get_embedder()
    vectors = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    return [v.tolist() for v in vectors]


def build_chunks_for_document(file_path: Path, meta: DocumentMetadata) -> list[DocumentChunk]:
    text = extract_text(file_path)
    raw_chunks = legal_aware_chunk(text)

    chunks: list[DocumentChunk] = []
    for i, rc in enumerate(raw_chunks):
        chunks.append(
            DocumentChunk(
                chunk_id=f"{meta.id}-CHUNK-{i:04d}-{uuid.uuid4().hex[:6]}",
                document_id=meta.id,
                title=f"{meta.title} — {rc.section_label}",
                source=meta.source,
                authority=meta.authority,
                jurisdiction=meta.jurisdiction,
                document_type=meta.document_type,
                section=rc.section_label,
                page=(i // 3) + 1,
                paragraph=f"Block {i + 1}",
                language=meta.language,
                publication_date=meta.publication_date,
                effective_date=meta.effective_date,
                topic=meta.topic,
                chunk_text=rc.text,
            )
        )
    return chunks


def run_ingestion() -> tuple[list[DocumentMetadata], list[DocumentChunk]]:
    from app.retrieval.vector_index import VectorIndex

    docs_dir = settings.documents_dir
    docs_dir.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest(docs_dir)

    all_docs: list[DocumentMetadata] = []
    all_chunks: list[DocumentChunk] = []

    for filename, meta in manifest.items():
        file_path = docs_dir / filename
        if not file_path.exists():
            print(f"[ingest] WARNING: manifest references '{filename}' but the file is missing — skipping.")
            continue

        print(f"[ingest] Processing {filename} -> {meta.id}")
        chunks = build_chunks_for_document(file_path, meta)
        meta.chunk_count = len(chunks)
        meta.status = "Indexed"

        all_docs.append(meta)
        all_chunks.extend(chunks)

    if not all_chunks:
        print("[ingest] No chunks produced. Check data/documents/manifest.json and file paths.")
        return all_docs, all_chunks

    print(f"[ingest] Embedding {len(all_chunks)} chunks with '{settings.embedding_model}'...")
    vectors = embed_texts([c.chunk_text for c in all_chunks])

    print("[ingest] Upserting into Qdrant...")
    index = VectorIndex(vector_size=len(vectors[0]))
    index.upsert(all_chunks, vectors)

    print("[ingest] Persisting processed chunks/documents to disk for fast BM25 rebuild...")
    settings.processed_dir.mkdir(parents=True, exist_ok=True)
    with settings.processed_chunks_file.open("w", encoding="utf-8") as f:
        for c in all_chunks:
            f.write(c.model_dump_json() + "\n")
    save_processed_documents(all_docs, settings.processed_documents_file)

    print(f"[ingest] Done. {len(all_docs)} documents, {len(all_chunks)} chunks indexed.")
    return all_docs, all_chunks
