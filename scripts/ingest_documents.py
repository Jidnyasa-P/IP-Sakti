#!/usr/bin/env python3
"""
IP-SAKTI Sahayak — Document Ingestion CLI (Section 10).

A thin, real client for the running backend's POST /api/documents/ingest
endpoint (backend/app/rag/ingest.py performs the actual text-cleaning,
chunking, embedding, and vector-store indexing). This script does not
duplicate that logic — it just lets you batch-ingest local .txt files
without hand-writing curl commands.

Usage:
    python scripts/ingest_documents.py path/to/file.txt \
        --title "Some Notification" \
        --source "Gazette of India" \
        --authority "Ministry of AYUSH" \
        --topic AYUSH \
        --document-type Notification \
        --api-base http://localhost:8000

Ingest every .txt file in a folder:
    python scripts/ingest_documents.py path/to/folder/ --authority "IP India" --topic IPR
"""
import argparse
import json
import os
import sys
import urllib.request
import urllib.error


def ingest_file(file_path: str, api_base: str, **metadata) -> dict:
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        raw_text = f.read()

    default_title = os.path.splitext(os.path.basename(file_path))[0].replace("_", " ").title()
    payload = {
        "title": metadata.get("title") or default_title,
        "source": metadata.get("source") or "User-provided document",
        "authority": metadata.get("authority") or "Unspecified",
        "url": metadata.get("url"),
        "document_type": metadata.get("document_type") or "Guidelines",
        "jurisdiction": metadata.get("jurisdiction") or "India",
        "topic": metadata.get("topic") or "AYUSH",
        "summary": metadata.get("summary") or "",
        "raw_text": raw_text,
    }

    req = urllib.request.Request(
        f"{api_base.rstrip('/')}/api/documents/ingest",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("path", help="Path to a .txt file, or a folder of .txt files.")
    parser.add_argument("--title")
    parser.add_argument("--source")
    parser.add_argument("--authority")
    parser.add_argument("--url")
    parser.add_argument("--document-type", dest="document_type")
    parser.add_argument("--jurisdiction", default="India")
    parser.add_argument("--topic", default="AYUSH")
    parser.add_argument("--summary")
    parser.add_argument("--api-base", default="http://localhost:8000")
    args = parser.parse_args()

    meta = {k: v for k, v in vars(args).items() if k not in ("path", "api_base") and v is not None}

    files = []
    if os.path.isdir(args.path):
        files = [os.path.join(args.path, f) for f in sorted(os.listdir(args.path)) if f.endswith(".txt")]
    elif os.path.isfile(args.path):
        files = [args.path]
    else:
        print(f"Path not found: {args.path}", file=sys.stderr)
        sys.exit(1)

    if not files:
        print("No .txt files found to ingest.", file=sys.stderr)
        sys.exit(1)

    for fp in files:
        print(f"[ingest] {fp} ...")
        try:
            result = ingest_file(fp, args.api_base, **meta)
            doc = result.get("document", {})
            print(f"  -> {doc.get('id')} | {doc.get('chunk_count')} chunks | status={doc.get('status')}")
        except urllib.error.URLError as exc:
            print(f"  ERROR: could not reach backend at {args.api_base} ({exc}). Is `uvicorn app.main:app` running?", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    main()
