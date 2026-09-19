"""
IP-SAKTI Sahayak — FastAPI backend entrypoint.

Run with:  uvicorn app.main:app --reload --port 8000
"""
import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.logging import logger
from app.database.session import init_db
from app.api.routes import health, chat, rag_routes, products, misc_routes, auth, experts

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info(f"IP-SAKTI backend starting | env={settings.app_env} | db=mongodb "
                f"| llm_configured={settings.llm_configured} | qdrant_configured={settings.qdrant_configured} "
                f"| neo4j_configured={settings.neo4j_configured} | bhashini_configured={settings.bhashini_configured}")
    yield
    logger.info("IP-SAKTI backend shutting down.")


app = FastAPI(
    title="IP-SAKTI Sahayak API",
    description=(
        "Multilingual, RAG-based, source-cited AI assistant for Intellectual Property and "
        "regulatory guidance in Ayurveda (SIH26045)."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Never leak stack traces, secrets, or internal details to the client (Section 29).

    CHANGED: manually attach the CORS header here too. CORSMiddleware only
    adds Access-Control-Allow-Origin to responses that come back out through
    the normal middleware chain — a response built by an exception handler
    can bypass that in some Starlette/FastAPI versions, which makes the
    browser report a *CORS* error even though the real problem is a 500
    happening server-side. Without this, you'd see "blocked by CORS policy"
    in the console for the exact same failures this handler is supposed to
    turn into a clean error message, which is confusing to debug from the
    frontend side alone.
    """
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}\n{traceback.format_exc()}")
    origin = request.headers.get("origin")
    headers = {}
    if origin and origin in (settings.frontend_origin, "http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000"):
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    return JSONResponse(status_code=500, content={"error": "Internal server error. Please try again."}, headers=headers)


app.include_router(health.router, tags=["health"])
app.include_router(auth.router, tags=["auth"])
app.include_router(chat.router, tags=["chat"])
app.include_router(rag_routes.router, tags=["rag"])
app.include_router(products.router, tags=["products"])
app.include_router(misc_routes.router, tags=["misc"])
app.include_router(experts.router, tags=["experts"])


@app.get("/")
@app.get("/api")
def root():
    return {"name": "IP-SAKTI Sahayak API", "docs": "/docs", "health": "/api/health"}


# --- Optional: serve the built frontend (frontend/dist) in production ---
# In development, run `npm run dev` (Vite on :3000, proxying /api to this
# server on :8000) instead of relying on this block.
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

_FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")
if os.path.isdir(_FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(_FRONTEND_DIST, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("docs") or full_path.startswith("redoc"):
            return JSONResponse(status_code=404, content={"error": "Not found."})
        candidate = os.path.join(_FRONTEND_DIST, full_path)
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(_FRONTEND_DIST, "index.html"))
