from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.product import ProductAnalysis
from app.schemas.domain import ProductAnalyzeRequest, IPRNavigatorRequest, TKABSRequest
from app.retrieval.hybrid_retrieval import get_retriever
from app.services import decision_engines

router = APIRouter()


def _evidence_for(query_text: str, top_k: int = 5) -> list[dict]:
    retrieval = get_retriever().retrieve(query_text, top_k=top_k)
    return retrieval.citations


@router.post("/api/products/analyze")
def analyze_product(body: ProductAnalyzeRequest, db: Session = Depends(get_db)):
    product = body.as_product_dict()
    search_text = f"{product.get('product_type', '')} {product.get('ingredients', '')} {product.get('claims', '')} {product.get('classical_reference', '')}"
    citations = _evidence_for(search_text)
    result = decision_engines.analyze_product(product, citations)

    db.add(ProductAnalysis(
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
    db.commit()
    return result


@router.get("/api/products")
def list_products(db: Session = Depends(get_db)):
    rows = db.query(ProductAnalysis).order_by(ProductAnalysis.created_at.desc()).all()
    return [_product_to_dict(r) for r in rows]


@router.get("/api/products/{product_id}")
def get_product(product_id: str, db: Session = Depends(get_db)):
    row = db.get(ProductAnalysis, product_id)
    if not row:
        return {"error": "Product analysis not found."}
    return _product_to_dict(row)


def _product_to_dict(r: ProductAnalysis) -> dict:
    return {
        "id": r.id,
        "user_id": r.user_id,
        "product_information": r.product_information,
        "likely_category": r.likely_category,
        "category_reasoning": r.category_reasoning,
        "confidence": r.confidence,
        "regulatory_considerations": r.regulatory_considerations,
        "ipr_considerations": r.ipr_considerations,
        "traditional_knowledge_abs_flags": r.traditional_knowledge_abs_flags,
        "recommended_next_steps": r.recommended_next_steps,
        "evidence": r.evidence,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.post("/api/ipr/analyze")
def analyze_ipr(body: IPRNavigatorRequest):
    citations = _evidence_for(f"{body.asset_type} {body.description or ''}")
    return decision_engines.evaluate_ipr(body.asset_type, citations)


def _handle_abs(body: TKABSRequest):
    search_text = f"{body.biological_resource} {body.plant_material} {body.traditional_use}"
    citations = _evidence_for(search_text)
    return decision_engines.evaluate_tk_abs(body.model_dump(), citations)


@router.post("/api/abs/analyze")
def analyze_abs(body: TKABSRequest):
    return _handle_abs(body)


@router.post("/api/tk-abs/analyze")
def analyze_tk_abs(body: TKABSRequest):
    return _handle_abs(body)
