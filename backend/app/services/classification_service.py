"""
Classification-First engine (Section 5).

Deterministic, rule-based, keyword/feature scoring over the user's query or
product description. Never guesses when critical information is missing —
below CONFIDENCE_THRESHOLD it returns needs_clarification=True with concrete
follow-up questions instead of picking a category.
"""
from dataclasses import dataclass, field

CONFIDENCE_THRESHOLD = 0.55

CATEGORY_KEYWORDS = {
    "classical_ayurvedic": [
        "classical", "charaka", "sushruta", "ashtanga hridaya", "first schedule",
        "authoritative text", "traditional formulation", "bhavaprakasha",
    ],
    "proprietary_ayurvedic": [
        "proprietary", "new formulation", "rule 158", "combination", "modified formulation",
    ],
    "food_nutraceutical": [
        "food", "aahar", "nutraceutical", "dietary", "supplement", "nutrition",
    ],
    "cosmetic": ["cosmetic", "skin cream", "hair oil cosmetic", "soap", "shampoo", "skincare"],
}

CLARIFYING_QUESTIONS = [
    "Is the formulation based entirely on a classical Ayurvedic reference (e.g. Charaka Samhita, Sushruta Samhita)?",
    "Is the product intended to be marketed as a medicine, a food/dietary product, or a cosmetic?",
    "Does the product involve any newly-combined ingredients not described together in a classical text?",
    "Is the product intended for the domestic Indian market, export, or both?",
]


@dataclass
class ClassificationResult:
    category: str
    confidence: float
    reasoning_summary: str
    needs_clarification: bool
    clarification_questions: list[str] = field(default_factory=list)


def classify(text: str) -> ClassificationResult:
    q = (text or "").lower()
    scores: dict[str, float] = {}
    for category, keywords in CATEGORY_KEYWORDS.items():
        hits = [k for k in keywords if k in q]
        if hits:
            # Score scales with number and specificity of matched keywords, capped at 0.97.
            scores[category] = min(0.97, 0.5 + 0.12 * len(hits))

    if not scores:
        return ClassificationResult(
            category="uncertain",
            confidence=0.0,
            reasoning_summary="No product-category signal (classical/proprietary/food/cosmetic) was found in the text.",
            needs_clarification=True,
            clarification_questions=CLARIFYING_QUESTIONS,
        )

    best_category, best_score = max(scores.items(), key=lambda kv: kv[1])

    if best_score < CONFIDENCE_THRESHOLD:
        return ClassificationResult(
            category="uncertain",
            confidence=round(best_score, 2),
            reasoning_summary=f"Weak signal toward '{best_category}' but below the confidence threshold ({CONFIDENCE_THRESHOLD}).",
            needs_clarification=True,
            clarification_questions=CLARIFYING_QUESTIONS,
        )

    reasoning = f"Matched terminology associated with '{best_category.replace('_', ' ')}' in the submitted text."
    return ClassificationResult(
        category=best_category,
        confidence=round(best_score, 2),
        reasoning_summary=reasoning,
        needs_clarification=False,
        clarification_questions=[],
    )
