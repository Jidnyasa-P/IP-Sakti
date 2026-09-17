"""
TKDL (Traditional Knowledge Digital Library) connector — placeholder.

TKDL is NOT a public/scrapeable database: access is restricted to patent
offices and parties with a bilateral access agreement with CSIR
(see docs/SOURCE_ACQUISITION_GUIDE.md). This module never attempts to
scrape, guess at, or fabricate TKDL content. With TKDL_ENABLED unset
(default) it just returns a clear, honest note that an authorized-access
TKDL search still needs to happen manually — which `app/pipeline.py`
(`analyze_tk_abs`) surfaces to the user rather than silently omitting it.

When you have authorized access, wire the real lookup into
`check_prior_art()` below — the call site in pipeline.py doesn't need to
change.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.config import settings


@dataclass
class TKDLCheckResult:
    checked: bool
    note: str


class TKDLConnector:
    def __init__(self):
        self.enabled = settings.tkdl_enabled

    def check_prior_art(self, query: str) -> TKDLCheckResult:
        if not self.enabled:
            return TKDLCheckResult(
                checked=False,
                note=(
                    "TKDL was not queried automatically — TKDL access is restricted to "
                    "authorized channels (patent office access / bilateral CSIR agreement), "
                    "not a public API. A manual, authorized-access TKDL search is still "
                    "required before relying on this for a patentability opinion."
                ),
            )
        return TKDLCheckResult(
            checked=False,
            note=(
                "TKDL_ENABLED is set, but no authorized TKDL API integration has been "
                "implemented yet in check_prior_art() — this is a placeholder. A manual "
                "TKDL search is still required."
            ),
        )
