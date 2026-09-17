"""Structured logging configuration.

Never logs secrets, API keys, or full user PII (Section 38).
"""
import logging
import sys
from app.core.config import get_settings


def setup_logging() -> logging.Logger:
    settings = get_settings()
    logger = logging.getLogger("ip_sakti")
    if logger.handlers:
        return logger

    logger.setLevel(getattr(logging, settings.log_level.upper(), logging.INFO))
    handler = logging.StreamHandler(sys.stdout)
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.propagate = False
    return logger


logger = setup_logging()


def redact(value: str, keep: int = 4) -> str:
    """Redact a secret-like string for safe logging."""
    if not value:
        return ""
    if len(value) <= keep:
        return "*" * len(value)
    return value[:keep] + "*" * (len(value) - keep)
