import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.product import COLLECTION as PRODUCTS_COLLECTION, new_product_analysis, to_dict as product_to_dict
from app.models.tk_abs_analysis import COLLECTION as TK_ABS_COLLECTION, new_tk_abs_analysis, to_dict as tk_abs_to_dict
from app.schemas.domain import ProductAnalyzeRequest, IPRNavigatorRequest, TKABSRequest
from app.services import pdf_service
import app.rag_client as rag_client

router = APIRouter()


def _pdf_response(pdf_bytes: bytes, filename: str) -> Response:
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/api/products/analyze")
async def analyze_product(body: ProductAnalyzeRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    product = body.as_product_dict()
    # ip_sakti_rag does classification, retrieval, and the full decision-engine
    # writeup in one call -- see ip_sakti_rag/app/pipeline.py::analyze_product.
    result = await rag_client.analyze_product(product)
    result["user_id"] = current_user["id"]
    # CHANGED: ip_sakti_rag's ProductAnalysisResult schema doesn't include
    # created_at (it's an ip_sakti_rag-internal model, not the persisted
    # Mongo document), but frontend/src/types.ts's ProductAnalysisResult
    # declares created_at as required. It was silently missing from every
    # response before this fix -- harmless if nothing reads it, but worth
    # having correct since new_product_analysis() below stores it in Mongo
    # anyway and callers may reasonably expect the API response to match
    # what list_products()/get_product() return later.
    result["created_at"] = datetime.now(timezone.utc).isoformat()

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
    row = db[PRODUCTS_COLLECTION].find_one({"_id": product_id})
    if not row:
        raise HTTPException(status_code=404, detail="Product analysis not found.")
    is_admin = "Admin" in current_user.get("roles", [])
    if not is_admin and row.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="You do not have access to this product analysis.")

    pdf_bytes = pdf_service.generate_product_analysis_pdf(product_to_dict(row))
    return _pdf_response(pdf_bytes, f"{product_id}-product-analysis.pdf")


@router.post("/api/ipr/analyze")
async def analyze_ipr(body: IPRNavigatorRequest, current_user: dict = Depends(get_current_user)):
    return await rag_client.analyze_ipr(body.model_dump())


@router.get("/api/ipr/overview")
async def ipr_overview(current_user: dict = Depends(get_current_user)):
    """Read-only overview for the IPR Navigator "at a glance" popup.
    Reuses the RAG service's document search rather than a local corpus."""
    docs = await rag_client.search_documents(query="IPR overview patent trademark design PPVFR")
    return {"documents": docs}


async def _handle_abs(body: TKABSRequest, user_id: str, db) -> dict:
    result = await rag_client.analyze_tk_abs(body.model_dump())

    record_id = f"TKABS-{uuid.uuid4().hex[:10]}"
    # CHANGED: same created_at gap as analyze_product above.
    created_at = datetime.now(timezone.utc).isoformat()
    db[TK_ABS_COLLECTION].insert_one(new_tk_abs_analysis(
        id=record_id, user_id=user_id, request=body.model_dump(), result=result,
    ))
    return {**result, "id": record_id, "user_id": user_id, "created_at": created_at}


@router.post("/api/abs/analyze")
async def analyze_abs(body: TKABSRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    return await _handle_abs(body, current_user["id"], db)


@router.post("/api/tk-abs/analyze")
async def analyze_tk_abs(body: TKABSRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    return await _handle_abs(body, current_user["id"], db)


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
