#!/usr/bin/env python3
"""
Runs every query in tests/sample_queries.json through the full RAG pipeline
and pretty-prints the structured JSON response — useful both as a smoke test
and as a reference for exactly what your FastAPI backend will receive.

Usage:
    python scripts/test_queries.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.pipeline import IPSaktiRAG  # noqa: E402


def main():
    queries_path = Path(__file__).resolve().parent.parent / "tests" / "sample_queries.json"
    queries = json.loads(queries_path.read_text(encoding="utf-8"))

    print("Loading RAG pipeline (embedding model + Qdrant + BM25)...")
    rag = IPSaktiRAG()

    if not rag.retriever.chunks:
        print(
            "\n⚠️  No indexed chunks found. Run `python scripts/ingest.py` first "
            "after placing real source documents + manifest.json in data/documents/.\n"
            "Continuing anyway — the pipeline will correctly return "
            "'Insufficient evidence' / needs_clarification=true for every query.\n"
        )

    for item in queries:
        print("\n" + "=" * 100)
        print(f"QUERY ({item.get('language', 'en')}): {item['query']}")
        print("=" * 100)
        result = rag.answer_query(query=item["query"], language=item.get("language"))
        print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
