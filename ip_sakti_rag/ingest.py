"""
One-time / occasional batch job — NOT run inside the live web service.
Run this locally (or as a GitHub Action / manual `python -m ingest`)
whenever the statutory corpus changes, then redeploy or just let the
live service read the freshly-upserted Qdrant collection + BM25 pickle.

Input: data/documents/manifest.json — you (or a separate prep script)
produce this from your source PDFs/HTML. Shape:

{
  "chunks": [
    {
      "_id": "chunk-CGPDTM-02",
      "document_id": "DOC-CGPDTM-TK-GUIDELINES",
      "title": "CGPDTM Guidelines — Patentability of Herbal Extraction ...",
      "authority": "CGPDTM, DPIIT",
      "section": "Chapter 5: Process Claims & Standardization",
      "source": "Guidelines for Examination of Patent Applications ...",
      "full_text": "<<< THE COMPLETE CHUNK TEXT — used for BM25 + embeddings >>>",
      "display_excerpt": "<<< short quote for UI citations, < 15 words >>>",
      "page": 15,
      "language": "en",
      "effective_date": "2012-12-18"
    },
    ...
  ]
}

I don't have your source documents (the Acts/Guidelines/PDFs themselves),
so this script assumes manifest.json already exists — see SETUP_GUIDE.md
"What I still need from you" for how to produce it.
"""
import json
import os
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from pymongo import MongoClient
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct
from bm25_index import build_index
from embeddings import EMBED_DIM, embed_text

MANIFEST_PATH = Path(__file__).parent / "data" / "documents" / "manifest.json"
COLLECTION = os.environ.get("QDRANT_COLLECTION", "legal_corpus_chunks")


def load_manifest() -> list[dict]:
    # Read the raw dictionary structure from your JSON file
    raw_data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    
    chunks = []
    for filename, doc_info in raw_data.items():
        # Skip the comment field if it exists
        if filename == "_comment":
            continue
            
        # 1. Map the dictionary item into the structure your script expects
        chunk = {
            "_id": doc_info["id"],                  # Uses "DOC-PATENTS-ACT-1970", etc. as the ID
            "document_id": doc_info["id"],
            "title": doc_info["title"],
            "authority": doc_info.get("authority"),
            "section": "General Overview",          # Default section placeholder
            "source": doc_info.get("source"),
            "language": doc_info.get("language", "en"),
            "effective_date": str(doc_info.get("effective_date")),
            
            # 2. Add required ingestion text properties
            # Since this manifest holds metadata, we combine title/summary to create text to embed
            "full_text": f"Title: {doc_info['title']}. Summary: {doc_info.get('summary', '')}",
            "display_excerpt": doc_info.get('summary', '')[:50]  # Short quote for UI citations
        }
        chunks.append(chunk)
        
    return chunks

def run() -> None:
    chunks = load_manifest()
    if not chunks:
        raise SystemExit(f"No chunks found in {MANIFEST_PATH} — nothing to ingest.")

    mongo = MongoClient(os.environ["MONGODB_URI"])[
        os.environ.get("MONGODB_DB_NAME", "ip_sakti")
    ]
    qdrant = QdrantClient(
        url=os.environ["QDRANT_URL"], api_key=os.environ.get("QDRANT_API_KEY")
    )

    points = []
    for c in chunks:
        vector = embed_text(c["full_text"])
        c["embedding_model"] = "models/text-embedding-004"
        c["embedding_dim"] = EMBED_DIM
        c["qdrant_point_id"] = c["_id"]

        points.append(
            PointStruct(
                id=c["_id"],
                vector=vector,
                payload={
                    "document_id": c["document_id"],
                    "authority": c.get("authority"),
                    "language": c.get("language", "en"),
                    "section": c.get("section"),
                },
            )
        )
        mongo.legal_corpus_chunks.replace_one({"_id": c["_id"]}, c, upsert=True)
        print(f"  embedded + upserted {c['_id']}")

    qdrant.upsert(collection_name=COLLECTION, points=points)
    build_index(chunks)
    print(f"Done: {len(chunks)} chunks -> Mongo + Qdrant + BM25 index.")


if __name__ == "__main__":
    run()
