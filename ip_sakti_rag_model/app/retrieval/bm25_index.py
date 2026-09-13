"""
BM25 lexical index — critical for exact legal terminology ("Section 3(p)",
"Schedule T", "Form III") where semantic embeddings alone can under-rank an
exact statutory reference.
"""
from __future__ import annotations

import re

from rank_bm25 import BM25Okapi

from app.schemas import DocumentChunk

_STOPWORDS = {
    "the", "is", "at", "which", "on", "and", "a", "an", "in", "to", "for", "of", "with",
    "as", "by", "from", "this", "that", "or", "be", "are", "was", "were", "it", "can",
    "का", "की", "के", "में", "और", "से", "पर", "को", "है", "हैं", "या", "एक", "ने", "हो",
    "आणि", "च्या", "चे", "ची", "मध्ये", "व", "आहे", "नाही", "यांचे", "त्यांचे", "करणे",
}

_TOKEN_RE = re.compile(r"[^\w\u0900-\u097F]+")


def tokenize(text: str) -> list[str]:
    tokens = _TOKEN_RE.sub(" ", text.lower()).split()
    return [t for t in tokens if len(t) > 1 and t not in _STOPWORDS]


class BM25Index:
    def __init__(self, chunks: list[DocumentChunk]):
        self.chunks = chunks
        corpus = [
            tokenize(f"{c.title} {c.section} {c.chunk_text} {c.topic} {c.authority}")
            for c in chunks
        ]
        self._corpus_empty = len(corpus) == 0
        self.bm25 = BM25Okapi(corpus) if corpus else None

    def score(self, query: str) -> list[float]:
        if self.bm25 is None:
            return []
        return list(self.bm25.get_scores(tokenize(query)))
