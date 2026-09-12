from datetime import datetime, timezone
from fastapi import APIRouter

from app.core.config import get_settings
from app.database.session import engine
from app.rag.vector_store import get_vector_store, LocalVectorStore
from app.knowledge_graph.graph_service import get_graph_service, InMemoryGraph

router = APIRouter()


@router.get("/api/health")
def health():
    settings = get_settings()

    db_status = "connected"
    try:
        with engine.connect():
            pass
    except Exception:
        db_status = "unavailable"

    vector_store = get_vector_store()
    vector_status = "ready (local TF-IDF index)" if isinstance(vector_store, LocalVectorStore) else "ready (Qdrant)"

    graph = get_graph_service()
    graph_status = "ready (in-memory NetworkX)" if isinstance(graph, InMemoryGraph) else "ready (Neo4j)"

    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": db_status,
        "database_backend": settings.db_backend,
        "vector_store": vector_status,
        "knowledge_graph": graph_status,
        "llm": "available (Gemini configured)" if settings.llm_configured else "demo_mode (rule-based synthesis)",
        "translation": "available (Bhashini configured)" if settings.bhashini_configured else "demo_mode (curated dictionary)",
    }
