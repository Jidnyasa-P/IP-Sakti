"""TK/ABS analysis documents (tk_abs_analyses collection).

Added so a TK-ABS analysis result can be exported as a PDF after the fact
(GET /api/tk-abs/{analysis_id}/pdf) without re-running the analysis —
mirrors the existing product_analyses persistence pattern in
app/models/product.py. The evaluate_tk_abs(...) engine itself
(app/services/decision_engines.py) is unchanged; this only adds minimal
storage of its input + output, following the existing model style.
"""
from datetime import datetime, timezone

COLLECTION = "tk_abs_analyses"


def new_tk_abs_analysis(id: str, user_id: str, request: dict, result: dict) -> dict:
    return {
        "_id": id,
        "user_id": user_id,
        "request": request,
        "result": result,
        "created_at": datetime.now(timezone.utc),
    }


def to_dict(r: dict) -> dict:
    return {
        "id": r["_id"],
        "user_id": r.get("user_id"),
        "request": r.get("request"),
        "result": r.get("result"),
        "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
    }
