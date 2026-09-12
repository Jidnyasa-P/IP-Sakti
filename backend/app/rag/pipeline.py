"""
The full pipeline: Query -> Preprocessing -> Classification -> Jurisdiction ->
Contextualization -> Query Expansion -> Retrieval -> Metadata Filtering ->
Evidence Ranking -> LLM Reasoning -> Citation Extraction -> Citation
Validation -> Confidence Evaluation -> Safe Response (Section 9).

Used by both /api/query (the SIH-spec canonical endpoint) and /api/chat (the
endpoint the existing frontend calls), so both surfaces run the identical,
real pipeline rather than two divergent implementations.
"""
import time
from dataclasses import asdict

from app.retrieval.hybrid_retrieval import get_retriever
from app.services import classification_service, jurisdiction_service, llm_service, expert_escalation_service
from app.validation.citation_validation import validate_citation, detect_conflicts
from app.knowledge_graph.graph_service import get_graph_service


async def run_pipeline(query: str, language: str | None = None, target_market: str | None = None) -> dict:
    t0 = time.time()

    # 1. Classification-first
    classification = classification_service.classify(query)

    # 2. Jurisdiction routing
    jurisdiction = jurisdiction_service.detect_jurisdiction(query, target_market)

    # 3. Retrieval (hybrid BM25 + semantic, with intent/jurisdiction-aware boosting)
    retriever = get_retriever()
    retrieval = retriever.retrieve(query, language=language, top_k=5)
    t_retrieval = time.time()

    # 4. Knowledge graph context (structured relationships, not just flat text)
    kg_context = None
    if classification.category != "uncertain":
        category_label = {
            "classical_ayurvedic": "Classical Ayurvedic Product",
            "proprietary_ayurvedic": "Proprietary Ayurvedic Product",
            "food_nutraceutical": "Food / Nutraceutical",
            "cosmetic": "Cosmetic",
        }.get(classification.category)
        if category_label:
            kg_context = get_graph_service().path_context(category_label)

    # 5. Conflict detection across retrieved evidence
    conflicts = detect_conflicts(retrieval.top_chunks)

    # 6. Reasoning (LLM if configured, else demo synthesis) — grounded strictly in retrieval.top_chunks
    grounded = await llm_service.generate_grounded_response(query, retrieval.detected_language, retrieval.top_chunks)
    t_reasoning = time.time()

    # 7. Citation extraction + validation
    validations = [validate_citation(grounded.answer, c["chunk_id"]) for c in retrieval.citations]
    all_verified = all(v.validation_status == "verified" for v in validations) if validations else False
    overall_validation_status = "verified" if all_verified else ("failed" if validations else "unverifiable")

    warnings: list[str] = []
    for v in validations:
        warnings.extend(v.warnings)
    if conflicts:
        warnings.append(f"{len(conflicts)} potentially conflicting source pair(s) detected on this topic — see 'conflicts'.")
    if not retrieval.top_chunks:
        warnings.append("No evidence retrieved from the indexed corpus for this query.")
    if jurisdiction.notes:
        warnings.extend(jurisdiction.notes)

    # 8. Safe abstention: if there's truly no evidence, don't let the answer imply otherwise
    confidence = asdict(retrieval.confidence)
    if not retrieval.top_chunks:
        confidence = {"level": "Insufficient evidence", "score": 0.0, "reasons": ["No matching statutory provisions were retrieved."]}

    # 9. Expert escalation
    escalation = expert_escalation_service.evaluate_escalation(
        query=query,
        confidence_level=confidence["level"],
        has_conflicts=bool(conflicts),
        jurisdiction_coverage_available=jurisdiction.coverage_available,
    )

    latency_ms = {
        "retrieval_ms": int((t_retrieval - t0) * 1000),
        "reasoning_ms": int((t_reasoning - t_retrieval) * 1000),
        "total_ms": int((time.time() - t0) * 1000),
    }

    return {
        "answer": grounded.answer,
        "relevant_considerations": grounded.relevant_considerations,
        "recommended_next_steps": grounded.recommended_next_steps,
        "citations": retrieval.citations,
        "classification": asdict(classification),
        "jurisdiction": asdict(jurisdiction),
        "knowledge_graph_context": kg_context,
        "conflicts": conflicts,
        "confidence": confidence,
        "warnings": warnings,
        "validation_status": overall_validation_status,
        "validations": [asdict(v) for v in validations],
        "expert_escalation": asdict(escalation),
        "demo_mode": grounded.demo_mode,
        "model_used": grounded.model_used,
        "detected_intent": retrieval.detected_intent,
        "detected_language": retrieval.detected_language,
        "latency_ms": latency_ms,
    }
