import uuid

from fastapi import APIRouter, Depends, HTTPException, Response

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.product import COLLECTION as PRODUCTS_COLLECTION, new_product_analysis, to_dict as product_to_dict
from app.models.tk_abs_analysis import COLLECTION as TK_ABS_COLLECTION, new_tk_abs_analysis, to_dict as tk_abs_to_dict
from app.schemas.domain import ProductAnalyzeRequest, IPRNavigatorRequest, TKABSRequest
from app.retrieval.hybrid_retrieval import get_retriever
from app.services import decision_engines, pdf_service

router = APIRouter()


def _pdf_response(pdf_bytes: bytes, filename: str) -> Response:
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _evidence_for(query_text: str, top_k: int = 5) -> list[dict]:
    retrieval = get_retriever().retrieve(query_text, top_k=top_k)
    return retrieval.citations


@router.post("/api/products/analyze")
def analyze_product(body: ProductAnalyzeRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    product = body.as_product_dict()
    search_text = f"{product.get('product_type', '')} {product.get('ingredients', '')} {product.get('claims', '')} {product.get('classical_reference', '')}"
    citations = _evidence_for(search_text)
    result = decision_engines.analyze_product(product, citations, user_id=current_user["id"])

    db[PRODUCTS_COLLECTION].insert_one(new_product_analysis(
        id=result["id"],
        user_id=result["user_id"],
        product_information=result["product_information"],
        likely_category=result["likely_category"],
        category_reasoning=result["category_reasoning"],
        confidence=result["confidence"],
        regulatory_considerations=result["regulatory_considerations"],
        ipr_considerations=result["ipr_considerations"],
        traditional_knowledge_abs_flags=result["traditional_knowledge_abs_flags"],
        recommended_next_steps=result["recommended_next_steps"],
        evidence=result["evidence"],
    ))
    return result


@router.get("/api/products")
def list_products(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    is_admin = "Admin" in current_user.get("roles", [])
    query = {} if is_admin else {"user_id": current_user["id"]}
    rows = db[PRODUCTS_COLLECTION].find(query).sort("created_at", -1)
    return [product_to_dict(r) for r in rows]


@router.get("/api/products/{product_id}")
def get_product(product_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    row = db[PRODUCTS_COLLECTION].find_one({"_id": product_id})
    if not row:
        raise HTTPException(status_code=404, detail="Product analysis not found.")
    is_admin = "Admin" in current_user.get("roles", [])
    if not is_admin and row.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="You do not have access to this product analysis.")
    return product_to_dict(row)


@router.get("/api/products/{product_id}/pdf")
def download_product_pdf(product_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Exports an already-generated Product Analyzer result as a PDF.
    Prefers the persisted result (written by POST /api/products/analyze)
    rather than re-running the analysis. Same ownership rule as
    GET /api/products/{product_id}: a normal user may only export their own
    result; Admins may export any."""
    row = db[PRODUCTS_COLLECTION].find_one({"_id": product_id})
    if not row:
        raise HTTPException(status_code=404, detail="Product analysis not found.")
    is_admin = "Admin" in current_user.get("roles", [])
    if not is_admin and row.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="You do not have access to this product analysis.")

    pdf_bytes = pdf_service.generate_product_analysis_pdf(product_to_dict(row))
    return _pdf_response(pdf_bytes, f"{product_id}-product-analysis.pdf")


@router.post("/api/ipr/analyze")
def analyze_ipr(body: IPRNavigatorRequest, current_user: dict = Depends(get_current_user)):
    citations = _evidence_for(f"{body.asset_type} {body.description or ''}")
    return decision_engines.evaluate_ipr(body.asset_type, citations)


@router.get("/api/ipr/overview")
def ipr_overview(current_user: dict = Depends(get_current_user)):
    """Read-only, structured data for the IPR Navigator "at a glance"
    popup — reuses the existing decision-engine table and document corpus
    rather than duplicating them (Section: IPR Navigator at-a-glance)."""
    return decision_engines.ipr_overview()


def _handle_abs(body: TKABSRequest, user_id: str, db) -> dict:
    search_text = f"{body.biological_resource} {body.plant_material} {body.traditional_use}"
    citations = _evidence_for(search_text)
    result = decision_engines.evaluate_tk_abs(body.model_dump(), citations)

    # Minimal persistence (Section: TK-ABS PDF export) so the result can be
    # re-exported as a PDF later without re-running the analysis. Reuses
    # the existing MongoDB architecture; does not touch any other
    # collection. The original response shape below is unchanged — only an
    # additive "id" key is included so the frontend can request the PDF.
    record_id = f"TKABS-{uuid.uuid4().hex[:10]}"
    db[TK_ABS_COLLECTION].insert_one(new_tk_abs_analysis(
        id=record_id, user_id=user_id, request=body.model_dump(), result=result,
    ))
    return {**result, "id": record_id}


@router.post("/api/abs/analyze")
def analyze_abs(body: TKABSRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    return _handle_abs(body, current_user["id"], db)


@router.post("/api/tk-abs/analyze")
def analyze_tk_abs(body: TKABSRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    return _handle_abs(body, current_user["id"], db)


@router.get("/api/tk-abs/{analysis_id}")
def get_tk_abs_analysis(analysis_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    row = db[TK_ABS_COLLECTION].find_one({"_id": analysis_id})
    if not row:
        raise HTTPException(status_code=404, detail="TK/ABS analysis not found.")
    is_admin = "Admin" in current_user.get("roles", [])
    if not is_admin and row.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="You do not have access to this TK/ABS analysis.")
    return tk_abs_to_dict(row)


@router.get("/api/tk-abs/{analysis_id}/pdf")
def download_tk_abs_pdf(analysis_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    row = db[TK_ABS_COLLECTION].find_one({"_id": analysis_id})
    if not row:
        raise HTTPException(status_code=404, detail="TK/ABS analysis not found.")
    is_admin = "Admin" in current_user.get("roles", [])
    if not is_admin and row.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="You do not have access to this TK/ABS analysis.")

    pdf_bytes = pdf_service.generate_tk_abs_pdf(tk_abs_to_dict(row))
    return _pdf_response(pdf_bytes, f"{analysis_id}-tk-abs-analysis.pdf")
