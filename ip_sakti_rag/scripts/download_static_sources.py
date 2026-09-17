#!/usr/bin/env python3
"""
Helper for downloading STATIC official documents (Acts/Rules/Regulations
published as PDFs) into data/documents/. This is deliberately narrow:

- It only ever fetches from `INDEX_PAGES` below — confirmed-live official
  listing/index pages, not guessed direct-PDF URLs (those rotate/break).
- It does NOT scrape dynamic search portals (patent/trademark search
  databases, court databases) — see docs/SOURCE_ACQUISITION_GUIDE.md for why.
- It does NOT touch TKDL in any way.

This is not guaranteed to work end-to-end unattended: several Indian
government sites block generic user-agents, require a session/cookie from a
real browser visit, or serve PDFs behind a JS-rendered listing. When that
happens, this script prints the index page URL and tells you to open it in a
browser and download manually — that manual step is the source of truth, not
a script bug to chase.

Usage:
    python scripts/download_static_sources.py
"""
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Only confirmed-live index/listing pages go here — never a guessed PDF path.
INDEX_PAGES: dict[str, str] = {
    "IP India — Patents Acts (Patents Act 1970 + amendments)": "https://ipindia.gov.in/Patents/acts_patents",
    "National Biodiversity Authority — home/downloads": "https://nbaindia.org",
}

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data" / "documents"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; IP-SAKTI-research-bot/1.0)"}


def check_index_pages_reachable() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for label, url in INDEX_PAGES.items():
        host = urlparse(url).netloc
        print(f"\n[{label}]")
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            if resp.status_code == 200:
                print(f"  Reachable: {url}")
                print(f"  -> Open this in a browser, find the current PDF link for the")
                print(f"     document you need, download it manually into {OUTPUT_DIR}/,")
                print(f"     and add a matching entry to data/documents/manifest.json.")
            else:
                print(f"  Got HTTP {resp.status_code} for {url} — this host may block")
                print(f"  non-browser requests. Open {url} directly in a browser instead.")
        except requests.RequestException as exc:
            print(f"  Could not reach {host} from this script ({exc}).")
            print(f"  Open {url} directly in a browser instead.")
        time.sleep(1)  # be polite between requests


def main():
    print(
        "This script only checks reachability of a small set of confirmed official\n"
        "index pages and tells you where to click next — it deliberately does not\n"
        "auto-download or guess PDF URLs (see docs/SOURCE_ACQUISITION_GUIDE.md).\n"
        "For every other source in that guide (Trade Marks Act, Designs Act, GI Act,\n"
        "Copyright Act, PPV&FR Act, FSSAI, WIPO treaties, CBD, MeitY), go to the site\n"
        "listed in the guide directly — there wasn't a single confirmed stable index\n"
        "URL I could verify for all of them from here."
    )
    check_index_pages_reachable()
    print(
        f"\nOnce you've manually downloaded files into {OUTPUT_DIR}/, fill in\n"
        f"{OUTPUT_DIR}/manifest.json (copy manifest.example.json as a starting point),\n"
        "then run: python scripts/ingest.py"
    )


if __name__ == "__main__":
    main()
