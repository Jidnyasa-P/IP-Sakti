from datetime import datetime, timezone
from fastapi import APIRouter

from app.core.config import get_settings
from app.database.session import get_client, is_using_mock
import app.rag_client as rag_client

router = APIRouter()


@router.get("/api/health")
async def health():
    settings = get_settings()

    db_status = "connected"
    try:
        get_client().admin.command("ping")
    except Exception:
        db_status = "unavailable"

    try:
        rag_health = await rag_client.health()
        rag_status = f"connected ({rag_health.get('status', 'ok')})"
    except rag_client.RagServiceError:
        rag_status = f"unreachable at {settings.rag_service_url}"

    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": db_status,
        "database_backend": "mongodb (in-memory DEMO MODE)" if is_using_mock() else "mongodb",
        "rag_service": rag_status,
        "translation": "available (Bhashini configured)" if settings.bhashini_configured else "demo_mode (curated dictionary)",
    }
