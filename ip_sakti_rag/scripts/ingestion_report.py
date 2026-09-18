#!/usr/bin/env python3
"""
Run AFTER `python scripts/ingest.py` to verify:
  1. Every document in manifest.json actually produced chunks (nothing
     silently skipped/failed).
  2. A per-document, per-section breakdown of what's indexed — this is
     the "section-wise" view your frontend's citations rely on: every
     citation shown to a user is one DocumentChunk's `title` + `section`
     + `page` + `document_id`, so this report is the fastest way to
     confirm that data is correct and complete before you trust the live
     app's citations.
  3. That the number of chunks in Qdrant matches the number in
     data/processed/chunks.jsonl (catches a partial/interrupted upsert).

Usage:
    python scripts/ingestion_report.py
    python scripts/ingestion_report.py --document DOC-PATENTS-ACT-1970   # one doc, full section list
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402


def load_chunks() -> list[dict]:
    path = settings.processed_chunks_file
    if not path.exists():
        print(f"No {path} found — run `python scripts/ingest.py` first.")
        sys.exit(1)
    chunks = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                chunks.append(json.loads(line))
    return chunks


def load_documents() -> dict[str, dict]:
    path = settings.processed_documents_file
    docs = {}
    if path.exists():
        with path.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    d = json.loads(line)
                    docs[d["id"]] = d
    return docs


def load_manifest_filenames() -> dict[str, str]:
    """document_id -> filename, straight from manifest.json, to catch
    documents that are LISTED but produced zero chunks (a silent failure)."""
    manifest_path = settings.documents_dir / "manifest.json"
    if not manifest_path.exists():
        return {}
    raw = json.loads(manifest_path.read_text(encoding="utf-8"))
    
    # Safe parsing for both nested metadata dictionaries and flat string mappings
    result = {}
    for filename, meta in raw.items():
        if isinstance(meta, dict) and "id" in meta:
            result[meta["id"]] = filename
        elif isinstance(meta, str):
            result[meta] = filename
    return result


def qdrant_point_count() -> int | None:
    try:
        from qdrant_client import QdrantClient

        if settings.qdrant_url:
            client = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key)
        else:
            client = QdrantClient(path=settings.qdrant_local_path)
        if settings.qdrant_collection not in [c.name for c in client.get_collections().collections]:
            return 0
        return client.count(collection_name=settings.qdrant_collection).count
    except Exception as e:  # pragma: no cover — diagnostic script, fail soft
        print(f"  (couldn't check Qdrant point count: {e})")
        return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Section-wise ingestion verification report.")
    parser.add_argument("--document", help="Show the full section list for one document_id only.")
    args = parser.parse_args()

    chunks = load_chunks()
    docs = load_documents()
    manifest_ids = load_manifest_filenames()

    by_doc: dict[str, list[dict]] = defaultdict(list)
    for c in chunks:
        by_doc[c["document_id"]].append(c)

    if args.document:
        target = by_doc.get(args.document, [])
        if not target:
            print(f"No chunks found for document_id={args.document!r}. Known ids:")
            for did in sorted(by_doc):
                print(f"  {did}")
            return
        title = docs.get(args.document, {}).get("title", "(unknown title)")
        print(f"\n{args.document} — {title}")
        print(f"{len(target)} chunks:\n")
        for c in sorted(target, key=lambda c: (c.get("page", 0), c["chunk_id"])):
            print(f"  page {c.get('page', '?'):<4} | {c['section']:<40} | {c['chunk_id']}")
        return

    print("=" * 100)
    print(f"{'Document':<45} {'Chunks':>8} {'Sections':>10} {'Status':<12}")
    print("=" * 100)

    total_chunks = 0
    zero_chunk_docs = []
    for doc_id, filename in sorted(manifest_ids.items()):
        doc_chunks = by_doc.get(doc_id, [])
        n_sections = len({c["section"] for c in doc_chunks})
        title = docs.get(doc_id, {}).get("title", filename)
        status = "OK" if doc_chunks else "** ZERO CHUNKS **"
        print(f"{title[:44]:<45} {len(doc_chunks):>8} {n_sections:>10} {status:<12}")
        total_chunks += len(doc_chunks)
        if not doc_chunks:
            zero_chunk_docs.append((doc_id, filename))

    # Anything in chunks.jsonl but NOT in the current manifest (stale data
    # from a document since removed) is worth knowing about too.
    orphaned = set(by_doc) - set(manifest_ids)
    for doc_id in sorted(orphaned):
        print(f"{'(orphaned — not in manifest.json)':<45} {len(by_doc[doc_id]):>8} {'':>10} {'ORPHAN':<12}")

    print("=" * 100)
    print(f"Total: {len(manifest_ids)} documents in manifest, {total_chunks} chunks in chunks.jsonl")

    qcount = qdrant_point_count()
    if qcount is not None:
        match = "OK — matches chunks.jsonl" if qcount == total_chunks else "MISMATCH — see note below"
        print(f"Qdrant collection '{settings.qdrant_collection}': {qcount} points ({match})")
        if qcount != total_chunks:
            print(
                "  A mismatch usually means an interrupted upsert. Re-run "
                "`python scripts/ingest.py` — it resumes from "
                "data/processed/embedding_progress.json rather than starting over."
            )

    if zero_chunk_docs:
        print(f"\n{len(zero_chunk_docs)} document(s) produced ZERO chunks — check these first:")
        for doc_id, filename in zero_chunk_docs:
            file_path = settings.documents_dir / filename
            exists = "file exists" if file_path.exists() else "FILE MISSING from data/documents/"
            print(f"  {doc_id}  ({filename})  — {exists}")
    else:
        print("\nEvery document in manifest.json produced at least one chunk. Good.")

    print(
        "\nFor one document's full section-by-section breakdown (to sanity-check what a "
        "citation for it will actually show):\n"
        "  python scripts/ingestion_report.py --document <DOC-ID-FROM-THE-TABLE-ABOVE>"
    )


if __name__ == "__main__":
    main()
