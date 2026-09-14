#!/usr/bin/env python3
"""
Run the full ingestion pipeline:
    data/documents/*.pdf|.html|.txt + manifest.json
    -> extraction -> legal-aware chunking -> metadata/versioning
    -> multilingual embeddings -> Qdrant upsert -> processed/*.jsonl

Usage:
    python scripts/ingest.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.ingestion.embed_and_index import run_ingestion  # noqa: E402


def main():
    docs, chunks = run_ingestion()
    print(f"\nSummary: {len(docs)} documents, {len(chunks)} chunks.")
    if not docs:
        print(
            "\nNo documents were ingested. To get started:\n"
            "  1. cp data/documents/manifest.example.json data/documents/manifest.json\n"
            "  2. Place the real source PDFs/HTML/TXT files listed in the manifest into data/documents/\n"
            "  3. Fill in accurate metadata (title/authority/jurisdiction/dates/url) for each\n"
            "  4. Re-run: python scripts/ingest.py\n"
        )


if __name__ == "__main__":
    main()
