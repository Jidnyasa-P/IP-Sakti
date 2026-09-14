"""
Language detection (en / hi / mr) and intent classification.

This mirrors the logic already prototyped in `server/rag/retrieval.ts`
(`detectIntent`, `detectLanguage`) so behaviour is consistent with what the
frontend has already been designed/tested against, but implemented properly
in Python with a slightly larger keyword set.

Kept dependency-free (no heavy langdetect model) so it works on any free-tier
host without extra downloads. If you already run Anuvadini/BHASHINI language
ID, swap `detect_language` for a call into that service — the interface below
is intentionally the seam for that (see TranslationProvider stub at bottom).
"""
from __future__ import annotations

import re
from typing import Optional

from app.schemas import Language

_DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")

_MARATHI_MARKERS = {
    "आहे", "नाही", "कसे", "पेटंट", "झाले", "करणे", "औषध", "माहिती",
    "पारंपारिक", "आणि", "साठी", "यांचे",
}

INTENT_KEYWORDS: dict[str, list[str]] = {
    "IPR_PATENTABILITY": [
        "patent", "पेटेंट", "पेटंट", "3(p)", "3(e)", "admixture", "synerg",
        "novelty", "prior art bar", "patentability",
    ],
    "IPR_BRAND_DESIGN": [
        "trademark", "brand", "ट्रेडमार्क", "class 5", "class 3", "logo",
        "design", "packaging", "geographical indication", " gi ",
    ],
    "ABS_BIODIVERSITY": [
        "abs", "biological", "biodiversity", "nba", "sbb", "जैव विविधता",
        "जैविक संसाधन", "access and benefit sharing", "form i", "form iii",
        "benefit sharing",
    ],
    "TRADITIONAL_KNOWLEDGE": [
        "traditional knowledge", "tkdl", "पारंपरिक ज्ञान", "पारंपारिक",
        "prior art", "charaka", "sushruta", "classical text",
    ],
    "AYUSH_REGULATORY": [
        "classical", "proprietary", "ayush", "schedule t", "gmp",
        "rule 158", "aahar", "आयुष", "license", "cdsco", "drug license",
    ],
    "EXPORT_INTERNATIONAL": [
        "export", "germany", "usa", "eu", "european union", "pct", "wipo",
        "international filing", "foreign country", "abroad",
    ],
}


def detect_language(query: str, preferred: Optional[Language] = None) -> Language:
    if preferred and preferred != "en":
        return preferred
    if _DEVANAGARI_RE.search(query):
        has_marathi = any(w in query for w in _MARATHI_MARKERS)
        return "mr" if has_marathi else "hi"
    return preferred or "en"


def detect_intent(query: str) -> str:
    q = query.lower()
    # Export/international is a modifier that can co-occur with another intent;
    # check it only as a fallback tag, primary legal category wins first.
    for intent, keywords in INTENT_KEYWORDS.items():
        if intent == "EXPORT_INTERNATIONAL":
            continue
        if any(kw in q for kw in keywords):
            return intent
    if any(kw in q for kw in INTENT_KEYWORDS["EXPORT_INTERNATIONAL"]):
        return "EXPORT_INTERNATIONAL"
    return "GENERAL_AYUSH_IP_RESEARCH"


class TranslationProvider:
    """
    Modular seam for Anuvadini / BHASHINI integration. Left as a no-op by
    default (`TRANSLATION_PROVIDER=none`). Wire a real client in here without
    touching the rest of the pipeline.
    """

    def __init__(self, provider: str = "none"):
        self.provider = provider

    def translate(self, text: str, target_lang: str) -> str:
        if self.provider == "none":
            return text
        raise NotImplementedError(
            f"Translation provider '{self.provider}' is not wired up yet. "
            "Implement the API call here (Anuvadini / BHASHINI)."
        )
