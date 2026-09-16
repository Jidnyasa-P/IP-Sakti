"""
Lexical (BM25) half of the hybrid retriever.

Pure-Python rank_bm25 — no compiled/binary deps, trivial to install on
Render's free tier. Fine for corpora up to tens of thousands of chunks;
the whole index lives in one pickle file loaded into memory at startup.
"""
import pickle
import re
from pathlib import Path

from rank_bm25 import BM25Okapi

INDEX_PATH = Path(__file__).parent / "data" / "bm25_index.pkl"
_TOKEN_RE = re.compile(r"[a-zA-Z0-9\u0900-\u097F]+")  # latin + devanagari


def _tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


def build_index(chunks: list[dict]) -> None:
    """chunks: list of {"_id": ..., "full_text": ...}"""
    INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    corpus = [_tokenize(c["full_text"]) for c in chunks]
    bm25 = BM25Okapi(corpus)
    with open(INDEX_PATH, "wb") as f:
        pickle.dump({"bm25": bm25, "chunk_ids": [c["_id"] for c in chunks]}, f)


_cache: dict | None = None


def _load_index() -> dict:
    global _cache
    if _cache is None:
        with open(INDEX_PATH, "rb") as f:
            _cache = pickle.load(f)
    return _cache


def search(query: str, top_k: int = 30) -> list[tuple[str, float]]:
    data = _load_index()
    scores = data["bm25"].get_scores(_tokenize(query))
    ranked = sorted(zip(data["chunk_ids"], scores), key=lambda x: x[1], reverse=True)
    return ranked[:top_k]
