"""
Centralised, env-driven configuration.
Nothing here is hard-coded secrets — everything sensitive comes from `.env`.
"""
from __future__ import annotations

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # LLM
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.0-flash"

    # Embeddings
    embedding_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

    # Qdrant
    qdrant_local_path: str = "./data/qdrant_local"
    qdrant_collection: str = "ip_sakti_chunks"
    qdrant_url: str | None = None
    qdrant_api_key: str | None = None

    # Reranker
    reranker_enabled: bool = False
    reranker_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"

    # TKDL (placeholder — see app/retrieval/tkdl_connector.py)
    tkdl_enabled: bool = False

    # Neo4j
    neo4j_enabled: bool = False
    neo4j_uri: str | None = None
    neo4j_username: str | None = None
    neo4j_password: str | None = None

    # Retrieval tuning
    semantic_weight: float = 0.65
    keyword_weight: float = 0.35
    top_k: int = 5

    # Safety thresholds
    confidence_high_threshold: float = 0.45
    confidence_moderate_threshold: float = 0.28
    confidence_low_threshold: float = 0.15
    min_chunks_for_high_confidence: int = 3
    abstain_below_score: float = 0.15

    # Translation
    translation_provider: str = "none"

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
