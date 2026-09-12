"""
SQLAlchemy engine/session for the default (zero-setup) SQLite backend.

This is the "real, working, local-equivalent" datastore referenced in the
architecture diagram's MongoDB box. If DB_BACKEND=mongodb is set with a real
MONGODB_URI, app/database/mongo.py provides an equivalent Motor-based
implementation of the same DatabaseService interface (app/services/db_service.py)
so the rest of the app is storage-backend agnostic.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import get_settings

settings = get_settings()

os.makedirs(os.path.dirname(settings.sqlite_path) or ".", exist_ok=True)

engine = create_engine(
    f"sqlite:///{settings.sqlite_path}",
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from app.models import (  # noqa: F401  (ensure models are registered)
        user, conversation, product, citation, classification,
        validation_result, feedback, expert_escalation, audit_log, document,
    )
    Base.metadata.create_all(bind=engine)
