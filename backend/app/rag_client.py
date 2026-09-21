"""
Thin HTTP client for the sibling `ip_sakti_rag` FastAPI service.

Every RAG-backed operation (chat, product/IPR/TK-ABS analysis, research
search, document listing, telemetry, feedback) is delegated here instead of
being computed locally. This module owns the only place that knows the RAG
service's base URL and shared-secret header -- callers just get plain
dicts back, matching ip_sakti_rag/app/schemas.py's response shapes
(see ip_sakti_rag/README.md).

Raises RagServiceError (a thin HTTPException wrapper) on any failure so
route handlers can surface a clean 502 rather than leaking a raw httpx
traceback to the client.
"""
import httpx
from fastapi import HTTPException

from app.core.config import get_settings
from app.core.logging import logger

settings = get_settings()


class RagServiceError(HTTPException):
    def __init__(self, detail: str):
        super().__init__(status_code=502, detail=detail)


def _headers() -> dict:
    if settings.rag_service_shared_secret:
        return {"X-Internal-Secret": settings.rag_service_shared_secret}
    return {}


async def _request(method: str, path: str, **kwargs) -> dict:
    """Call the RAG service with retries for Render cold starts."""
    import asyncio

    url = f"{settings.rag_service_url.rstrip('/')}{path}"
    delays = (0, 5, 15)

    for attempt, delay in enumerate(delays, start=1):
        if delay:
            await asyncio.sleep(delay)

        try:
            async with httpx.AsyncClient(timeout=settings.rag_service_timeout_seconds) as client:
                resp = await client.request(method, url, headers=_headers(), **kwargs)

            if resp.status_code in (502, 503, 504) and attempt < len(delays):
                logger.warning(
                    f"RAG service {method} {path} returned {resp.status_code}; "
                    f"retrying ({attempt}/{len(delays)})"
                )
                continue

            resp.raise_for_status()
            return resp.json()

        except httpx.RequestError as exc:
            logger.warning(
                f"RAG service {method} {path} unreachable on attempt "
                f"{attempt}/{len(delays)}: {exc}"
            )
            if attempt == len(delays):
                raise RagServiceError(
                    f"RAG service is unreachable at {settings.rag_service_url}. "
                    "The service may be waking from Render sleep."
                )
        except httpx.HTTPStatusError as exc:
            logger.error(
                f"RAG service {method} {path} -> "
                f"{exc.response.status_code}: {exc.response.text}"
            )
            raise RagServiceError(
                f"RAG service error ({exc.response.status_code}) on {path}."
            )

    raise RagServiceError(f"RAG service unavailable on {path}.")


async def health() -> dict:
    return await _request("GET", "/api/health")


async def chat(query: str, language: str | None = None, conversation_id: str | None = None, jurisdiction: str | None = None) -> dict:
    return await _request("POST", "/api/chat", json={
        "query": query, "language": language, "conversation_id": conversation_id, "jurisdiction": jurisdiction,
    })


async def analyze_product(product_info: dict) -> dict:
    return await _request("POST", "/api/products/analyze", json=product_info)


async def analyze_ipr(ipr_query: dict) -> dict:
    return await _request("POST", "/api/ipr/analyze", json=ipr_query)


async def analyze_tk_abs(tk_query: dict) -> dict:
    return await _request("POST", "/api/tk-abs/analyze", json=tk_query)


async def search_documents(
    query: str = "", topic: str | None = None, authority: str | None = None, document_type: str | None = None
) -> dict:
    params = {"q": query}
    if topic:
        params["topic"] = topic
    if authority:
        params["authority"] = authority
    if document_type:
        params["document_type"] = document_type
    return await _request("GET", "/api/research/search", params=params)


async def list_documents() -> list[dict]:
    return await _request("GET", "/api/rag/documents")


async def get_document(document_id: str) -> dict | None:
    try:
        return await _request("GET", f"/api/documents/{document_id}")
    except RagServiceError:
        return None


async def get_document_source_bytes(document_id: str) -> tuple[bytes, str, str] | None:
    """
    NEW: proxies the actual source PDF from ip_sakti_rag, for the
    CitationModal's "View Source PDF" link. Returns (content, media_type,
    filename) or None if not found -- separate from _request() since that
    helper always calls .json(), which would choke on binary PDF bytes.
    """
    url = f"{settings.rag_service_url.rstrip('/')}/api/documents/{document_id}/source"
    try:
        async with httpx.AsyncClient(timeout=settings.rag_service_timeout_seconds) as client:
            resp = await client.get(url, headers=_headers())
        resp.raise_for_status()
        content_disposition = resp.headers.get("content-disposition", "")
        filename = content_disposition.split("filename=")[-1].strip('"') if "filename=" in content_disposition else f"{document_id}.pdf"
        return resp.content, resp.headers.get("content-type", "application/pdf"), filename
    except (httpx.HTTPStatusError, httpx.RequestError) as exc:
        logger.error(f"RAG service source fetch for {document_id} failed: {exc}")
        return None


async def get_telemetry() -> dict:
    return await _request("GET", "/api/rag/telemetry")


async def submit_feedback(conversation_id: str, message_id: str, feedback: str, notes: str | None = None) -> dict:
    return await _request("POST", f"/api/conversations/{conversation_id}/feedback", json={
        "message_id": message_id, "feedback": feedback, "notes": notes,
    })
