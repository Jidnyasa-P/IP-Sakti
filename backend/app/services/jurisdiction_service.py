"""
Jurisdiction-Aware routing engine (Section 8).

Distinguishes Indian/domestic requirements from international/export
requirements. The corpus currently only has deep coverage for India; for any
other jurisdiction the engine explicitly says coverage is unavailable instead
of fabricating foreign law (Section 8: "Do NOT pretend to have complete
regulatory coverage for every country").
"""
from dataclasses import dataclass, field

SUPPORTED_JURISDICTIONS = {"India"}
KNOWN_EXPORT_MARKETS = {
    "european union": "European Union",
    "eu": "European Union",
    "united states": "United States",
    "usa": "United States",
    "us": "United States",
    "uk": "United Kingdom",
    "united kingdom": "United Kingdom",
    "japan": "Japan",
    "canada": "Canada",
    "australia": "Australia",
    "uae": "United Arab Emirates",
}

EXPORT_SIGNAL_WORDS = ["export", "international", "foreign", "overseas", "abroad", "global market"]


@dataclass
class JurisdictionResult:
    country: str
    type: str  # domestic | international | unspecified
    coverage_available: bool
    notes: list[str] = field(default_factory=list)


def detect_jurisdiction(text: str, target_market: str | None = None) -> JurisdictionResult:
    q = (text or "").lower()

    explicit_market = None
    for key, label in KNOWN_EXPORT_MARKETS.items():
        if key in q:
            explicit_market = label
            break

    is_export_signal = any(w in q for w in EXPORT_SIGNAL_WORDS)

    if target_market:
        tm = target_market.strip().lower()
        # Two vocabularies reach this function with the same meaning:
        #   - ProductInformation.target_market: "Domestic (India)" | "Export" | "Both"
        #   - the former navbar Indian/International toggle (now request-level
        #     only, see frontend/src/context/JurisdictionContext.tsx): "India" | "International"
        # Both are normalised here rather than adding a second field.
        if tm in ("india", "domestic", "national", "indian") or ("domestic" in tm and "export" not in tm and "both" not in tm):
            return JurisdictionResult(country="India", type="domestic", coverage_available=True, notes=[])
        if ("export" in tm or "international" in tm) and "domestic" not in tm and "both" not in tm:
            if explicit_market:
                return JurisdictionResult(
                    country=explicit_market,
                    type="international",
                    coverage_available=explicit_market in SUPPORTED_JURISDICTIONS,
                    notes=[f"Detailed statutory coverage for {explicit_market} is not yet indexed in this deployment's knowledge base."],
                )
            return JurisdictionResult(
                country="Unspecified export market",
                type="international",
                coverage_available=False,
                notes=["Target market marked as Export/International with no specific destination named. Ask the user which destination market applies."],
            )
        if "both" in tm:
            return JurisdictionResult(
                country="India + export market(s)",
                type="international",
                coverage_available=True,
                notes=["Domestic (India) guidance is fully covered. Export-market guidance is general only — see note above."],
            )

    if explicit_market:
        return JurisdictionResult(
            country=explicit_market,
            type="international",
            coverage_available=explicit_market in SUPPORTED_JURISDICTIONS,
            notes=[f"Detailed statutory coverage for {explicit_market} is not yet indexed in this deployment's knowledge base."],
        )

    if is_export_signal:
        return JurisdictionResult(
            country="Unspecified export market",
            type="international",
            coverage_available=False,
            notes=["Export/international intent detected but no specific country named. Ask the user which destination market applies."],
        )

    return JurisdictionResult(country="India", type="domestic", coverage_available=True, notes=[])
