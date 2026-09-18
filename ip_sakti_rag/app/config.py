"""
Centralised, env-driven configuration.
Nothing here is hard-coded secrets — everything sensitive comes from `.env`.

CHANGED: removed `embedding_model` (was a sentence-transformers model path —
embeddings now come from the Gemini API via LLM_API_KEY, see
app/embeddings.py) and `reranker_enabled`/`reranker_model` (reranking is now
Reciprocal Rank Fusion, a pure algorithm with no model/setting to configure —
see app/retrieval/hybrid.py). If your existing .env still has
EMBEDDING_MODEL / RERANKER_ENABLED / RERANKER_MODEL lines, they're now
harmless no-ops (extra="ignore" below) — fine to leave or remove.

CHANGED AGAIN: embeddings moved off the Gemini API onto a local fastembed
model (see app/embeddings.py for why — Gemini's free-tier daily request cap
was blocking full-corpus ingestion). Added `fastembed_cache_dir` so the
downloaded ONNX model file has a predictable, configurable location instead
of fastembed's own default (which varies by OS). LLM_API_KEY is now used
for generation (and the Gemini-mode reranker, if enabled) only — no longer
for embeddings.
"""
from __future__ import annotations

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # LLM (generation + optional Gemini-mode reranker). No longer used for
    # embeddings — see app/embeddings.py (local fastembed model instead).
    LLM_API_KEY: str | None = None
    # gemini-2.0-flash was shut down 2026-06-01 — see .env.example for the
    # current recommended model and its own shutdown-date caveat. This
    # default is only used if LLM_MODEL isn't set in .env/Render env vars.
    LLM_MODEL: str = "gemini-3.1-flash-lite"

    # Embeddings (local, free, unlimited — see app/embeddings.py)
    fastembed_cache_dir: str = "./.fastembed_cache"

    # Qdrant
    qdrant_local_path: str = "./data/qdrant_local"
    qdrant_collection: str = "ip_sakti_chunks"
    qdrant_url: str | None = None
    qdrant_api_key: str | None = None

    # TKDL (placeholder — see app/retrieval/tkdl_connector.py)
    tkdl_enabled: bool = False

    # Neo4j
    neo4j_enabled: bool = True
    neo4j_uri: str | None = None
    neo4j_username: str | None = None
    neo4j_password: str | None = None

    # MongoDB application data
    mongodb_uri: str | None = None
    mongodb_db_name: str = "ip_sakti"

    # Retrieval tuning
    top_k: int = 5

    # Safety thresholds
    confidence_high_threshold: float = 0.45
    confidence_moderate_threshold: float = 0.28
    confidence_low_threshold: float = 0.15
    min_chunks_for_high_confidence: int = 3
    abstain_below_score: float = 0.15

    # Translation (Bhashini) — see app/translation/bhashini_client.py
    translation_provider: str = "none"  # none | bhashini
    bhashini_api_key: str | None = None
    bhashini_user_id: str | None = None

    # Shared secret for callers of the FastAPI service.
    rag_service_shared_secret: str | None = None

    @property
    def documents_dir(self) -> Path:
        return BASE_DIR / "data" / "documents"

    @property
    def processed_dir(self) -> Path:
        return BASE_DIR / "data" / "processed"

    @property
    def processed_chunks_file(self) -> Path:
        return self.processed_dir / "chunks.jsonl"

    @property
    def processed_documents_file(self) -> Path:
        return self.processed_dir / "documents.jsonl"

    @property
    def ingestion_state_file(self) -> Path:
        return self.processed_dir / "ingestion_state.json"


settings = Settings()

# Allow-list of authorities that may back a cited claim. Anything outside this list
# gets flagged by the citation validator as low-trust (see safety/citation_validator.py).
AUTHORITATIVE_SOURCES_ALLOWLIST = {
    "ip india", "cgpdtm", "office of the controller general of patents",
    "ministry of ayush", "ayush", "cdsco",
    "national biodiversity authority", "nba", "state biodiversity board", "sbb",
    "fssai", "food safety and standards authority of india",
    "wipo", "world intellectual property organization", "pct",
    "india code", "gazette of india",
    "trade marks registry", "designs office",
    "protection of plant varieties authority", "ppv&fr",
    "tkdl", "csir-tkdl",  # only via authorized access — see ingestion notes
}

DISCLAIMER_TEXT = (
    "This is informational, decision-support guidance generated from indexed official "
    "sources — it is not legal advice. For patent filings, regulatory submissions, or "
    "ABS applications, please consult a registered patent agent, advocate, or qualified "
    "regulatory affairs specialist."
)
