"""Incremental ingestion: extract -> chunk -> embed -> immediately persist.

Each document is processed independently and each embedding batch is written to
Qdrant before the next batch is requested. Progress is stored on disk so a Gemini
quota failure or process restart resumes from the last successfully persisted batch.
"""
from __future__ import annotations

import json
from pathlib import Path

from app.config import settings
from app.embeddings import embed_texts, get_embedding_dimension
from app.ingestion.chunker import legal_aware_chunk
from app.ingestion.extract import extract_text
from app.ingestion.metadata import load_manifest, save_processed_documents
from app.schemas import DocumentChunk, DocumentMetadata


PROGRESS_FILE = settings.processed_dir / "ingestion_progress.json"


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

    # Deterministic IDs are essential: rerunning the same PDF overwrites the
    # same Qdrant points instead of creating a second copy.
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


def _load_progress() -> dict[str, int]:
    if not PROGRESS_FILE.exists():
        return {}
    try:
        data = json.loads(PROGRESS_FILE.read_text(encoding="utf-8"))
        return {str(k): int(v) for k, v in data.items()}
    except (json.JSONDecodeError, TypeError, ValueError):
        print("[ingest] WARNING: invalid ingestion_progress.json; starting progress tracking again.")
        return {}


def _save_progress(progress: dict[str, int]) -> None:
    PROGRESS_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = PROGRESS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(progress, indent=2), encoding="utf-8")
    tmp.replace(PROGRESS_FILE)


def _load_processed_chunks() -> dict[str, dict]:
    path = settings.processed_chunks_file
    if not path.exists():
        return {}
    result: dict[str, dict] = {}
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                item = json.loads(line)
                if item.get("chunk_id"):
                    result[item["chunk_id"]] = item
            except json.JSONDecodeError:
                continue
    return result


def _save_processed_chunks(chunks_by_id: dict[str, dict]) -> None:
    path = settings.processed_chunks_file
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        for item in chunks_by_id.values():
            f.write(json.dumps(item, ensure_ascii=False) + "\n")
    tmp.replace(path)


def _remove_document_chunks(chunks_by_id: dict[str, dict], document_id: str) -> None:
    for chunk_id in [
        cid for cid, item in chunks_by_id.items() if item.get("document_id") == document_id
    ]:
        del chunks_by_id[chunk_id]


def run_ingestion(force: bool = False) -> tuple[list[DocumentMetadata], list[DocumentChunk]]:
    from app.retrieval.vector_index import VectorIndex

    docs_dir = settings.documents_dir
    docs_dir.mkdir(parents=True, exist_ok=True)
    settings.processed_dir.mkdir(parents=True, exist_ok=True)

    manifest = load_manifest(docs_dir)
    progress = _load_progress()
    processed_chunks = _load_processed_chunks()
    index = VectorIndex(vector_size=get_embedding_dimension())

    all_docs: list[DocumentMetadata] = []
    all_chunks: list[DocumentChunk] = []

    for filename, meta in manifest.items():
        file_path = docs_dir / filename
        if not file_path.exists():
            print(f"[ingest] WARNING: manifest references '{filename}' but the file is missing — skipping.")
            continue

        print(f"[ingest] Processing/resuming: {filename} -> {meta.id}")
        chunks = build_chunks_for_document(file_path, meta)
        meta.chunk_count = len(chunks)

        completed = 0 if force else min(progress.get(meta.id, 0), len(chunks))
        if force:
            _remove_document_chunks(processed_chunks, meta.id)
            progress.pop(meta.id, None)
            _save_processed_chunks(processed_chunks)

        if completed:
            print(f"[ingest] Resuming after {completed} completed chunks.")

        meta.status = "Processing" if completed < len(chunks) else "Indexed"
        all_docs.append(meta)

        while completed < len(chunks):
            batch_end = min(completed + 80, len(chunks))
            batch = chunks[completed:batch_end]
            print(
                f"[ingest] Embedding {len(batch)} chunks "
                f"({completed + 1}-{batch_end} / {len(chunks)} pending)"
            )

            # 1. Generate vectors. Nothing is marked complete yet.
            vectors = embed_texts([c.chunk_text for c in batch])
            if len(vectors) != len(batch):
                raise RuntimeError(
                    f"Embedding count mismatch for {meta.id}: "
                    f"got {len(vectors)} vectors for {len(batch)} chunks."
                )

            # 2. Persist this batch immediately to Qdrant.
            index.upsert(batch, vectors)

            # 3. Persist this batch to the BM25 source file immediately.
            for chunk in batch:
                processed_chunks[chunk.chunk_id] = chunk.model_dump()
            _save_processed_chunks(processed_chunks)

            # 4. Only now advance the progress marker.
            completed = batch_end
            progress[meta.id] = completed
            _save_progress(progress)
            print(f"[ingest] Saved progress: {completed}/{len(chunks)} chunks.")

        meta.status = "Indexed"

        # Save document metadata after this PDF is completely indexed.
        save_processed_documents(all_docs, settings.processed_documents_file)
        print(f"[ingest] Completed: {filename} ({len(chunks)} chunks).")

        all_chunks.extend(chunks)

    # Re-save the complete metadata list at the end as well.
    save_processed_documents(all_docs, settings.processed_documents_file)
    total_chunks = len(processed_chunks)
    print(f"[ingest] Done. {len(all_docs)} documents processed; {total_chunks} persisted chunks available.")
    return all_docs, all_chunks
