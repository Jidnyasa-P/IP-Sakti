from datetime import datetime, timezone

COLLECTION = "product_analyses"


def new_product_analysis(
    id: str,
    user_id: str,
    product_information: dict,
    likely_category: str,
    category_reasoning: str,
    confidence: dict,
    regulatory_considerations: list,
    ipr_considerations: list,
    traditional_knowledge_abs_flags: list,
    recommended_next_steps: list,
    evidence: list,
) -> dict:
    return {
        "_id": id,
        "user_id": user_id,
        "product_information": product_information,
        "likely_category": likely_category,
        "category_reasoning": category_reasoning,
        "confidence": confidence,
        "regulatory_considerations": regulatory_considerations,
        "ipr_considerations": ipr_considerations,
        "traditional_knowledge_abs_flags": traditional_knowledge_abs_flags,
        "recommended_next_steps": recommended_next_steps,
        "evidence": evidence,
        "created_at": datetime.now(timezone.utc),
    }


def to_dict(r: dict) -> dict:
    return {
        "id": r["_id"],
        "user_id": r.get("user_id"),
        "product_information": r.get("product_information"),
        "likely_category": r.get("likely_category"),
        "category_reasoning": r.get("category_reasoning"),
        "confidence": r.get("confidence"),
        "regulatory_considerations": r.get("regulatory_considerations"),
        "ipr_considerations": r.get("ipr_considerations"),
        "traditional_knowledge_abs_flags": r.get("traditional_knowledge_abs_flags"),
        "recommended_next_steps": r.get("recommended_next_steps"),
        "evidence": r.get("evidence"),
        "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
    }
