"""
TKDL connector — placeholder, disabled by default.

TKDL access is currently restricted to 14 national/regional patent offices
under bilateral non-disclosure access agreements (search/examination use
only). A 2022 Cabinet decision approved a phased, paid-subscription model to
widen access; as of this writing there is no public API or bulk dataset.

THIS MODULE MUST NEVER:
- Scrape tkdl.res.in or any TKDL-derived secondary source (blog posts, case
  filings quoting a TKDL record) into a local corpus.
- Fabricate or simulate a "TKDL search result."
- Present the optional classical-text awareness fallback (below) as
  equivalent to an actual TKDL search.

If your institution obtains authorized TKDL access, implement the real API/
SDK call inside `TKDLConnector.check_prior_art()` below — everything else in
the pipeline (safety/abstention, citation validation) already treats this as
purely additive context, so no other file needs to change.

Until then, `TKDL_ENABLED=false` (default) means `check_prior_art()` always
returns a "not checked — requires authorized TKDL access" result, which the
pipeline surfaces honestly instead of guessing.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.config import settings


@dataclass
class TKDLCheckResult:
    checked: bool
    likely_tk_overlap: bool | None  # None = unknown/not checked
    note: str
    source: str  # "tkdl_authorized" | "public_domain_heuristic" | "not_checked"


class TKDLConnector:
    def __init__(self):
        self.enabled = getattr(settings, "tkdl_enabled", False)

    def check_prior_art(self, formulation_description: str) -> TKDLCheckResult:
        if self.enabled:
            # --- Wire your authorized TKDL client call here. ---
            # result = self._authorized_client.search(formulation_description)
            # return TKDLCheckResult(checked=True, likely_tk_overlap=result.hit, ...)
            raise NotImplementedError(
                "TKDL_ENABLED=true but no authorized client is wired up yet. "
                "Implement the real API call in TKDLConnector.check_prior_art() "
                "using your institution's authorized TKDL access — do not "
                "return synthetic/simulated results."
            )

        return TKDLCheckResult(
            checked=False,
            likely_tk_overlap=None,
            note=(
                "TKDL prior-art check was not performed — this deployment has no "
                "authorized TKDL access (TKDL_ENABLED=false). Verify traditional-"
                "knowledge prior art via authorized TKDL access or a qualified "
                "IP facilitator before relying on a patentability conclusion."
            ),
            source="not_checked",
        )

    def public_domain_heuristic_note(self) -> str:
        """
        Optional, weaker fallback: a reminder to check public-domain classical
        texts (e.g. NAMASTE/NIIMH, CCRAS publications) for obvious overlap.
        This is NOT a TKDL search and must always be labeled as such wherever
        it's surfaced to a user.
        """
        return (
            "No TKDL access is configured. As a much weaker interim check, "
            "review publicly available digitized classical texts (e.g. "
            "NAMASTE/National Institute of Indian Medical Heritage, CCRAS "
            "publications) for obvious textual overlap — this is not a "
            "substitute for an authorized TKDL search."
        )
