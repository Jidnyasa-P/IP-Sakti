"""
Jurisdiction detection: identifies which regulatory regime(s) a query touches —
India (always the baseline for an India-domiciled formulation), specific export
destinations, or international treaty mechanisms (PCT/WIPO/EPO/USPTO).

This does not itself contain country-specific IP law — it only tags jurisdiction
so retrieval can filter for the right chunks and generation can be explicit
about "India requirement vs [country] requirement" instead of blending them.
"""
from __future__ import annotations

import re

_COUNTRY_PATTERNS: dict[str, list[str]] = {
    "Germany": ["germany", "german market", "epo germany", "dpma"],
    "European Union": ["european union", " eu ", "epo", "europe"],
    "United States": ["usa", "u.s.", "united states", "uspto", "america"],
    "United Kingdom": ["uk", "united kingdom", "britain", "ipo uk"],
    "Japan": ["japan", "jpo"],
    "Australia": ["australia", "ip australia"],
    "Canada": ["canada", "cipo"],
}

_INTERNATIONAL_MECHANISM_PATTERNS = ["pct", "wipo", "international patent application", "madrid protocol"]

_EXPORT_SIGNAL_PATTERNS = ["export", "exporting", "sell abroad", "overseas market", "foreign buyer"]


def detect_jurisdiction(text: str) -> list[str]:
    """
    Returns an ordered list of jurisdiction tags. 'India' is included whenever the
    query concerns an India-based formulation/applicant (the default assumption
    for this platform), plus any explicitly named destination country/mechanism.
    """
    q = text.lower()
    jurisdictions: list[str] = ["India"]

    for country, patterns in _COUNTRY_PATTERNS.items():
        if any(re.search(re.escape(p), q) for p in patterns):
            jurisdictions.append(country)

    if any(p in q for p in _INTERNATIONAL_MECHANISM_PATTERNS):
        jurisdictions.append("International (PCT/WIPO)")

    if len(jurisdictions) == 1 and any(p in q for p in _EXPORT_SIGNAL_PATTERNS):
        jurisdictions.append("Export (destination unspecified)")

    return jurisdictions


def is_export_query(jurisdictions: list[str]) -> bool:
    return len(jurisdictions) > 1
