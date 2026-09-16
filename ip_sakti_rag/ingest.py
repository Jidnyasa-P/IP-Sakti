"""
One-time / occasional batch job — NOT run inside the live web service.
Run this locally (or as a GitHub Action / manual `python -m ingest`)
whenever the statutory corpus changes, then redeploy or just let the
live service read the freshly-upserted Qdrant collection + BM25 pickle.

Input:
  data/documents/manifest.json  — doc-level metadata you fill in by hand
                                   (title/authority/url/etc — see
                                   docs/SOURCE_ACQUISITION_GUIDE.md). Keys
                                   are filenames inside data/documents/.
  data/documents/<file>.pdf      — the actual source PDF for each entry.

This script extracts real text from each PDF (page by page), splits it
into overlapping chunks, embeds every chunk, and upserts into Mongo +
Qdrant + the BM25 index. If a PDF can't be extracted (e.g. a scanned,
image-only page with no text layer and no OCR configured), that one
document falls back to a single title+summary chunk so ingestion doesn't
abort — but it prints a warning so you know that document has no real
searchable content yet.
"""
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from pymongo import MongoClient
from pypdf import PdfReader
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

from bm25_index import build_index
from embeddings import EMBED_DIM, EMBED_MODEL, embed_text

DOCS_DIR = Path(__file__).parent / "data" / "documents"
MANIFEST_PATH = DOCS_DIR / "manifest.json"
COLLECTION = os.environ.get("QDRANT_COLLECTION", "legal_corpus_chunks")

CHUNK_CHARS = 1200
CHUNK_OVERLAP = 150


def _chunk_text(text: str, size: int = CHUNK_CHARS, overlap: int = CHUNK_OVERLAP) -> list[str]:
    text = " ".join(text.split())  # normalize whitespace
    if not text:
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = start + size
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start = end - overlap
    return chunks


def _extract_pdf_chunks(pdf_path: Path) -> list[tuple[int, str]]:
    """Returns [(page_number, chunk_text), ...]. Empty list if extraction fails."""
    if not pdf_path.exists():
        print(f"  !! PDF not found on disk: {pdf_path.name} — skipping extraction")
        return []
    try:
        reader = PdfReader(str(pdf_path))
    except Exception as exc:
        print(f"  !! Could not open {pdf_path.name}: {exc}")
        return []

    out = []
    for page_num, page in enumerate(reader.pages, start=1):
        try:
            page_text = page.extract_text() or ""
        except Exception as exc:
            print(f"  !! Failed extracting page {page_num} of {pdf_path.name}: {exc}")
            continue
        for chunk in _chunk_text(page_text):
            if len(chunk.strip()) >= 40:  # skip near-empty fragments (headers/footers)
                out.append((page_num, chunk))
    return out


def load_manifest() -> list[dict]:
    raw_data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))

    chunks: list[dict] = []
    for filename, doc_info in raw_data.items():
        if filename == "_comment":
            continue

        base = {
            "document_id": doc_info["id"],
            "title": doc_info["title"],
            "authority": doc_info.get("authority"),
            "source": doc_info.get("source"),
            "language": doc_info.get("language", "en"),
            "effective_date": str(doc_info.get("effective_date")),
            "section": "General Overview",
        }

        pdf_path = DOCS_DIR / filename
        pdf_chunks = _extract_pdf_chunks(pdf_path)

        if pdf_chunks:
            for i, (page_num, chunk_text) in enumerate(pdf_chunks):
                c = dict(base)
                c["_id"] = f"{doc_info['id']}-p{page_num}-c{i}"
                c["full_text"] = chunk_text
                c["display_excerpt"] = " ".join(chunk_text.split()[:15])
                c["page"] = page_num
                chunks.append(c)
            print(f"  {filename}: extracted {len(pdf_chunks)} chunks")
        else:
            # Fallback: index the manifest summary so the document is at
            # least discoverable, even though real section text is missing.
            c = dict(base)
            c["_id"] = doc_info["id"]
            c["full_text"] = f"Title: {doc_info['title']}. Summary: {doc_info.get('summary', '')}"
            c["display_excerpt"] = doc_info.get("summary", "")[:80]
            c["page"] = None
            chunks.append(c)
            print(f"  {filename}: WARNING — no extractable text, indexed summary only")

    return chunks


def _ensure_qdrant_collection(qdrant: QdrantClient) -> None:
    if not qdrant.collection_exists(COLLECTION):
        print(f"Creating Qdrant collection '{COLLECTION}' (dim={EMBED_DIM}, cosine)...")
        qdrant.create_collection(
            collection_name=COLLECTION,
            vectors_config=VectorParams(size=EMBED_DIM, distance=Distance.COSINE),
        )


def run() -> None:
    chunks = load_manifest()
    if not chunks:
        raise SystemExit(f"No chunks found from {MANIFEST_PATH} — nothing to ingest.")

    mongo = MongoClient(os.environ["MONGODB_URI"])[
        os.environ.get("MONGODB_DB_NAME", "ip_sakti")
    ]
    qdrant = QdrantClient(
        url=os.environ["QDRANT_URL"], api_key=os.environ.get("QDRANT_API_KEY")
    )
    _ensure_qdrant_collection(qdrant)

    points = []
    for idx, c in enumerate(chunks, start=1):
        try:
            vector = embed_text(c["full_text"])
        except Exception as exc:
            print(f"  !! embedding failed for {c['_id']}: {exc} — skipping this chunk")
            continue

        c["embedding_model"] = EMBED_MODEL
        c["embedding_dim"] = EMBED_DIM
        c["qdrant_point_id"] = c["_id"]

        points.append(
            PointStruct(
                id=c["_id"],
                vector=vector,
                payload={
                    "document_id": c["document_id"],
                    "title": c.get("title"),
                    "authority": c.get("authority"),
                    "source": c.get("source"),
                    "language": c.get("language", "en"),
                    "section": c.get("section"),
                    "page": c.get("page"),
                    "display_excerpt": c.get("display_excerpt"),
                },
            )
        )
        mongo.legal_corpus_chunks.replace_one({"_id": c["_id"]}, c, upsert=True)
        print(f"  [{idx}/{len(chunks)}] embedded + upserted {c['_id']}")

    if not points:
        raise SystemExit("Every chunk failed to embed — check LLM_API_KEY / quota. Aborting before BM25/Qdrant write.")

    # Qdrant free-tier clusters are small; upsert in batches to stay polite.
    BATCH = 100
    for i in range(0, len(points), BATCH):
        qdrant.upsert(collection_name=COLLECTION, points=points[i:i + BATCH])

    build_index(chunks)
    print(f"Done: {len(points)}/{len(chunks)} chunks -> Mongo + Qdrant + BM25 index.")


if __name__ == "__main__":
    sys.exit(run() or 0)
