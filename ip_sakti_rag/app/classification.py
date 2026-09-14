"""
Product classification: routes a user query or product description into one of
the five categories the brief requires. This is a lightweight rule-based
classifier (fast, explainable, zero-cost) that also emits a reasoning string
and feeds classification into retrieval filters (topicFilter/authorityFilter).

For a stronger classifier later, swap `classify_product` to call the grounded
LLM with the retrieved evidence in context — the interface is unchanged.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.schemas import ProductCategory


@dataclass
class ClassificationResult:
    category: ProductCategory
    reasoning: str
    confidence: float  # 0..1, heuristic — not the same as retrieval confidence


_RULES: list[tuple[ProductCategory, list[str], str]] = [
    (
        "Food / Ayurveda-Aahar",
        ["aahar", "food", "supplement drink", "herbal tea", "nutraceutical food",
         "functional food", "fssai"],
        "References food/nutraceutical framing rather than a therapeutic claim; "
        "evaluated under FSSAI Ayurveda-Aahar Regulations, 2022 rather than the "
        "Drugs and Cosmetics Act.",
    ),
    (
        "Cosmetic",
        ["cosmetic", "cream", "lotion", "skincare", "hair oil for cosmetic",
         "soap", "shampoo", "face pack", "beauty"],
        "Described as a topical/cosmetic-use product without a disease-treatment "
        "claim; likely falls under Cosmetic classification rather than an "
        "Ayurvedic drug.",
    ),
    (
        "Phytopharmaceutical",
        ["phytopharmaceutical", "standardized extract", "purified fraction",
         "isolated phytoconstituent", "new drug extract", "clinical trial extract"],
        "Involves a standardized/purified plant extract or isolated fraction with "
        "a defined therapeutic claim — this fits the 'phytopharmaceutical drug' "
        "category (distinct from classical/proprietary Ayurvedic medicine) under "
        "Indian drug regulation.",
    ),
    (
        "Classical",
        ["classical formulation", "classical text", "charaka", "sushruta",
         "sharangadhara", "bhaishajya ratnavali", "as per classical reference",
         "textual reference", "authoritative books of ayurveda"],
        "Formulation is prepared strictly per a formula/method described in the "
        "authoritative (classical) texts of Ayurveda listed under the Drugs and "
        "Cosmetics Act — this points to a 'Classical' Ayurvedic medicine.",
    ),
    (
        "Proprietary",
        ["proprietary", "patent or proprietary", "new formulation", "novel combination",
         "modified formulation", "own formulation"],
        "Formulation is a new/modified combination not verbatim from classical texts "
        "— this points to a 'Proprietary' (patent or proprietary) Ayurvedic medicine "
        "under Section 3(h) of the Drugs and Cosmetics Act.",
    ),
]


def classify_product(text: str) -> ClassificationResult:
    q = text.lower()
    for category, keywords, reasoning in _RULES:
        if any(kw in q for kw in keywords):
            return ClassificationResult(category=category, reasoning=reasoning, confidence=0.7)

    return ClassificationResult(
        category="Other / Needs Further Review",
        reasoning=(
            "The description did not contain clear signals for Classical, Proprietary, "
            "Phytopharmaceutical, Food/Ayurveda-Aahar, or Cosmetic classification. "
            "Provide more detail on formulation source (classical text vs. new "
            "combination), intended use/claims, and dosage form for a confident "
            "classification, or escalate to a regulatory affairs expert."
        ),
        confidence=0.2,
    )
