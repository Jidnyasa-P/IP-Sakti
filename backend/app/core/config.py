"""
Central application configuration.

Every external-service setting is optional. When it is missing, the relevant
service module below falls back to a clearly-labelled local/demo implementation
instead of pretending to be a live integration (see Section 21 of the project
brief: DEMO MODE must never pretend to be live regulatory intelligence).
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Application
    app_env: str = "development"
    app_port: int = 8000
    frontend_origin: str = "http://localhost:3000"
    log_level: str = "INFO"

    # Database
    db_backend: str = "sqlite"  # sqlite | mongodb
    sqlite_path: str = "./data/ip_sakti.db"
    mongodb_uri: str = ""
    mongodb_db_name: str = "ip_sakti"

    # LLM
    llm_provider: str = "gemini"
    llm_api_key: str = ""
    llm_model: str = "gemini-2.0-flash"

    # Embeddings
    embedding_provider: str = ""
    embedding_model: str = ""

    # Vector store
    qdrant_url: str = ""
    qdrant_api_key: str = ""
    qdrant_collection: str = "ip_sakti_chunks"

    # Knowledge graph
    neo4j_uri: str = ""
    neo4j_user: str = ""
    neo4j_password: str = ""

    # Translation
    translation_provider: str = "bhashini"
    bhashini_api_key: str = ""
    bhashini_user_id: str = ""
    bhashini_ulca_api_key: str = ""

    # Security
    jwt_secret: str = "change-me-in-production"

    @property
    def llm_configured(self) -> bool:
        return bool(self.llm_api_key and not self.llm_api_key.startswith("MY_"))

    @property
    def qdrant_configured(self) -> bool:
        return bool(self.qdrant_url)

    @property
    def neo4j_configured(self) -> bool:
        return bool(self.neo4j_uri)

    @property
    def mongodb_configured(self) -> bool:
        return bool(self.mongodb_uri) and self.db_backend == "mongodb"

    @property
    def bhashini_configured(self) -> bool:
        return bool(self.bhashini_api_key and self.bhashini_user_id)


@lru_cache
def get_settings() -> Settings:
    return Settings()
