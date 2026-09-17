from app.retrieval.hybrid_retrieval import get_retriever, detect_intent, detect_language
from app.services import classification_service, jurisdiction_service
from app.validation.citation_validation import validate_citation, check_outdated
from app.rag.ingest import chunk_text, clean_text


def test_hybrid_retrieval_returns_relevant_chunks():
    retriever = get_retriever()
    result = retriever.retrieve("Section 3(p) traditional knowledge patent bar", top_k=3)
    assert len(result.top_chunks) > 0
    assert result.confidence.level in ("High", "Moderate", "Low", "Insufficient evidence")
    assert any("3(p)" in c["section"] for c in result.top_chunks)


def test_retrieval_insufficient_evidence_on_nonsense_query():
    retriever = get_retriever()
    result = retriever.retrieve("zzqxw flibbertigibbet nonword", top_k=3)
    assert result.confidence.level == "Insufficient evidence"


def test_intent_detection():
    assert detect_intent("Can I patent this formulation?") == "IPR_PATENTABILITY"
    assert detect_intent("Do I need NBA approval for biodiversity?") == "ABS_BIODIVERSITY"


def test_language_detection_devanagari():
    assert detect_language("मला पेटंट हवे आहे") == "mr"
    assert detect_language("मुझे जानकारी चाहिए") == "hi"
    assert detect_language("What is a patent?") == "en"


def test_classification_needs_clarification_when_ambiguous():
    result = classification_service.classify("I made a product")
    assert result.needs_clarification is True


def test_jurisdiction_detects_export_signal():
    result = jurisdiction_service.detect_jurisdiction("We want to export this to the European Union")
    assert result.type == "international"
    assert result.country == "European Union"


def test_jurisdiction_defaults_domestic():
    result = jurisdiction_service.detect_jurisdiction("What license do I need in India?")
    assert result.type == "domestic"
    assert result.coverage_available is True


def test_validate_citation_rejects_unknown_source():
    outcome = validate_citation("Some legal claim", "CHUNK-NOT-REAL")
    assert outcome.source_exists is False
    assert outcome.validation_status == "failed"


def test_check_outdated_flags_old_effective_date():
    warning = check_outdated({"effective_date": "1945-12-21"})
    assert warning is not None
    assert "1945-12-21" in warning


def test_check_outdated_ignores_recent_date():
    warning = check_outdated({"effective_date": "2023-08-03"})
    assert warning is None


def test_chunking_produces_bounded_chunks():
    text = clean_text(" ".join(["word"] * 500))
    chunks = chunk_text(text, target_words=180, overlap_words=30)
    assert len(chunks) >= 3
    for c in chunks:
        assert len(c.split(" ")) <= 180
