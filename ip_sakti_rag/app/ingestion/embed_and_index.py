"""
Incremental and resume-safe legal-corpus ingestion.

Pipeline:
  documents -> extraction -> legal-aware chunks -> Gemini embeddings -> Qdrant
  -> processed JSONL for BM25.

Unchanged documents are never re-embedded. Changed documents are embedded in
small batches and progress is persisted after every successful batch, so a
quota error, network failure, or interrupted process can resume later.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from app.config import settings
from app.embeddings import EMBED_DIM, _BATCH_SIZE, embed_texts
from app.ingestion.chunker import legal_aware_chunk
from app.ingestion.extract import extract_text
from app.ingestion.metadata import load_manifest, save_processed_documents
from app.schemas import DocumentChunk, DocumentMetadata


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def _load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")


def build_chunks_for_document(file_path: Path, meta: DocumentMetadata) -> list[DocumentChunk]:
    text = extract_text(file_path)
    bare_label = {
        "Act": "Section",
        "Rules": "Rule",
        "Regulation": "Regulation",
        "Notification": "Clause",
        "Guidelines": "Clause",
        "Treaty": "Article",
    }.get(meta.document_type, "Section")
    raw_chunks = legal_aware_chunk(text, bare_label=bare_label)

    return [
        DocumentChunk(
            chunk_id=f"{meta.id}-CHUNK-{i:04d}",
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
        for i, rc in enumerate(raw_chunks)
    ]


def _load_processed_chunks() -> list[DocumentChunk]:
    path = settings.processed_chunks_file
    if not path.exists():
        return []
    chunks: list[DocumentChunk] = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                chunks.append(DocumentChunk(**json.loads(line)))
    return chunks


def _persist_processed(
    docs: list[DocumentMetadata],
    chunks_by_doc: dict[str, list[DocumentChunk]],
) -> None:
    all_chunks = [c for doc in docs for c in chunks_by_doc.get(doc.id, [])]
    settings.processed_dir.mkdir(parents=True, exist_ok=True)
    with settings.processed_chunks_file.open("w", encoding="utf-8") as f:
        for c in all_chunks:
            f.write(c.model_dump_json() + "\n")
    save_processed_documents(docs, settings.processed_documents_file)


def run_ingestion(force: bool = False) -> tuple[list[DocumentMetadata], list[DocumentChunk]]:
    from app.retrieval.vector_index import VectorIndex

    docs_dir = settings.documents_dir
    docs_dir.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest(docs_dir)
    previous_state = _load_json(settings.ingestion_state_file)
    previous_chunks = _load_processed_chunks()
    progress_path = settings.processed_dir / "embedding_progress.json"
    progress = _load_json(progress_path)

    chunks_by_doc: dict[str, list[DocumentChunk]] = {}
    for chunk in previous_chunks:
        chunks_by_doc.setdefault(chunk.document_id, []).append(chunk)

    index = VectorIndex(vector_size=EMBED_DIM)
    all_docs: list[DocumentMetadata] = []
    new_state: dict[str, dict] = {}

    for filename, meta in manifest.items():
        file_path = docs_dir / filename
        if not file_path.exists():
            print(f"[ingest] WARNING: missing file: {filename} — skipping.")
            continue

        digest = _sha256(file_path)
        old = previous_state.get(meta.id, {})
        unchanged = (
            not force
            and old.get("filename") == filename
            and old.get("sha256") == digest
            and old.get("version") == meta.version
            and bool(chunks_by_doc.get(meta.id))
            and meta.id not in progress
        )

        if unchanged:
            chunks = chunks_by_doc[meta.id]
            meta.chunk_count = len(chunks)
            meta.status = "Indexed"
            all_docs.append(meta)
            new_state[meta.id] = {
                "filename": filename,
                "sha256": digest,
                "version": meta.version,
                "chunk_count": len(chunks),
            }
            print(f"[ingest] SKIP unchanged: {filename}")
            continue

        print(f"[ingest] Processing/resuming: {filename} -> {meta.id}")
        chunks = build_chunks_for_document(file_path, meta)
        meta.chunk_count = len(chunks)
        meta.status = "Indexing"

        old_progress = progress.get(meta.id, {})
        can_resume = (
            not force
            and old_progress.get("filename") == filename
            and old_progress.get("sha256") == digest
            and old_progress.get("version") == meta.version
        )

        if not can_resume:
            if index.collection_exists():
                index.delete_document(meta.id)
            old_progress = {
                "filename": filename,
                "sha256": digest,
                "version": meta.version,
                "completed_chunk_ids": [],
            }
            progress[meta.id] = old_progress
            _save_json(progress_path, progress)
            completed_ids: set[str] = set()
        else:
            completed_ids = set(old_progress.get("completed_chunk_ids", []))
            print(f"[ingest] Resuming after {len(completed_ids)} completed chunks.")

        pending = [c for c in chunks if c.chunk_id not in completed_ids]

        for start in range(0, len(pending), _BATCH_SIZE):
            batch = pending[start : start + _BATCH_SIZE]
            print(
                f"[ingest] Embedding {len(batch)} chunks "
                f"({start + 1}-{min(start + len(batch), len(pending))} / {len(pending)} pending)"
            )
            vectors = embed_texts([c.chunk_text for c in batch])
            if len(vectors) != len(batch):
                raise RuntimeError("Embedding count does not match chunk count; progress not advanced.")

            index.upsert(batch, vectors)

            completed_ids.update(c.chunk_id for c in batch)
            old_progress["completed_chunk_ids"] = sorted(completed_ids)
            _save_json(progress_path, progress)
            print(f"[ingest] Saved progress: {len(completed_ids)}/{len(chunks)} chunks.")

        # The document is fully indexed only after every batch succeeded.
        meta.status = "Indexed"
        chunks_by_doc[meta.id] = chunks
        all_docs.append(meta)
        new_state[meta.id] = {
            "filename": filename,
            "sha256": digest,
            "version": meta.version,
            "chunk_count": len(chunks),
        }

        progress.pop(meta.id, None)
        _save_json(progress_path, progress)
        _persist_processed(all_docs, chunks_by_doc)

    # Remove documents no longer present in the manifest.
    active_ids = {d.id for d in all_docs}
    for old_id in set(chunks_by_doc) - active_ids:
        if index.collection_exists():
            index.delete_document(old_id)
        chunks_by_doc.pop(old_id, None)
        new_state.pop(old_id, None)

    _persist_processed(all_docs, chunks_by_doc)
    _save_json(settings.ingestion_state_file, new_state)

    all_chunks = [c for doc in all_docs for c in chunks_by_doc.get(doc.id, [])]
    print(f"[ingest] Done. {len(all_docs)} documents, {len(all_chunks)} chunks.")
    return all_docs, all_chunks
