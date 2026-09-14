# Source Acquisition Guide

This is the step-by-step reference for §3.1 of the README: exactly what to fetch,
from where, for the full scope of the updated problem statement (national IP
regimes, ABS/biodiversity, AYUSH drug regulation, and the international layer).

**Ground rule for all rows below**: download only from the regulator's own
official site. If you can't find a document on the regulator's site, don't
substitute a third-party copy — note it as "not yet sourced" in your manifest
and keep the query abstaining (`needs_expert: true`) until you have the real
text. A missing document is safer than a wrong one.

---

## A. National — Intellectual Property

| Document | Authority | Where | Notes |
|---|---|---|---|
| Patents Act, 1970 (latest consolidated version) | CGPDTM / IP India | `ipindia.gov.in` → **Patents → Acts**. Confirmed live listing page: `ipindia.gov.in/Patents/acts_patents`. Pick the entry explicitly labelled "incorporating all amendments till [date]" — pick the most recent one. | Multiple historical versions are listed; always take the most recent consolidated one, and separately note the amendment date in `effective_date`/version notes. |
| Patents (Amendment) Rules, 2024 | CGPDTM / IP India | Same site → **Patents → Rules**. | Rules are versioned separately from the Act — don't conflate "Patents Act 1970" and "Patent Rules 2003 (as amended 2024)" into one manifest entry. |
| CGPDTM Guidelines for Examination of TK/Biological Material applications | CGPDTM / IP India | `ipindia.gov.in` → **Patents → Guidelines/Manuals**. | This is the practical examiner-facing document most useful for your Section 3(p)/3(e) reasoning. |
| Trade Marks Act, 1999 + Trade Marks Rules, 2017 | CGPDTM / Trade Marks Registry | `ipindia.gov.in` → **Trade Marks → Acts/Rules**. | |
| Designs Act, 2000 | CGPDTM / Designs Office | `ipindia.gov.in` → **Designs → Acts**. | |
| Geographical Indications of Goods (Registration & Protection) Act, 1999 | CGPDTM / GI Registry | `ipindia.gov.in` → **Geographical Indications → Acts**. | Relevant for community-linked Ayurvedic products (e.g. a GI-tagged medicinal plant/region). |
| Copyright Act, 1957 (as amended) | Copyright Office | `copyright.gov.in` → **Acts & Rules**. | Relevant mainly for labelling/packaging content and any published research/formulary text. |
| Protection of Plant Varieties and Farmers' Rights Act, 2001 | PPV&FR Authority | `plantauthority.gov.in` → **Acts/Rules**. | Relevant if the query concerns a new medicinal plant variety. |

## B. National — Biodiversity / Access & Benefit-Sharing

| Document | Authority | Where | Notes |
|---|---|---|---|
| Biological Diversity Act, 2002 | NBA | `nbaindia.org` → **Acts & Rules / Downloads**. | |
| Biological Diversity (Amendment) Act, 2023 | NBA / MoEFCC | Same site, or `egazette.gov.in` search "Biological Diversity Amendment Act 2023". | |
| Biological Diversity Rules, 2024 | NBA / MoEFCC | Confirmed: notified as G.S.R. 665(E), supersedes the 2004 Rules. Search `nbaindia.org` first; if not posted, search `egazette.gov.in` for "Biological Diversity Rules 2024". | This replaces the old 2004 Rules — if you already have the 2004 Rules text anywhere, mark it `superseded_by` the 2024 Rules entry in your manifest, don't just delete it (keeps version history honest). |
| NBA ABS Guidelines (Form I / Form III, benefit-sharing schedules) | NBA | `nbaindia.org` → **Guidelines/Forms**. | This is the one your existing seed corpus quotes a specific benefit-sharing percentage from — **verify the current rate directly from this document before trusting that number anywhere in your answers.** |

## C. National — AYUSH / Drug & Food Regulation

| Document | Authority | Where | Notes |
|---|---|---|---|
| Drugs and Cosmetics Act, 1940 + Rules, 1945 (Chapter IV-A, Schedule T, Rule 158-B) | CDSCO / Ministry of AYUSH | `cdsco.gov.in` and/or `ayush.gov.in` → **Acts & Rules**. | Core document for classical/proprietary/phytopharmaceutical classification logic. |
| New Drugs and Clinical Trials Rules, 2019 (phytopharmaceutical pathway) | CDSCO | `cdsco.gov.in` → **Rules**. | |
| Drugs and Magic Remedies (Objectionable Advertisements) Act, 1954 | — | `indiacode.nic.in` → search the Act name directly. | Governs what claims can be advertised — relevant to your "claims"/"intended use" fields in product analysis. |
| Food Safety and Standards (Ayurveda Aahar) Regulations, 2022 | FSSAI, with Ministry of AYUSH | `fssai.gov.in` → **Regulations** → search "Ayurveda Aahar". | |

## D. National — Data Protection (for your own compliance, not for RAG content)

| Document | Authority | Where | Notes |
|---|---|---|---|
| Digital Personal Data Protection Act, 2023 | MeitY | `meity.gov.in` → **Acts**. | You need this for your own system's privacy/audit posture (per the PS's DPDP-alignment requirement), not as a citation source for user answers. |

## E. International

| Document | Authority | Where | Notes |
|---|---|---|---|
| Patent Cooperation Treaty (PCT) + PCT Applicant's Guide | WIPO | `wipo.int/pct` → official text/guide pages. | |
| Madrid System (trademarks) overview/text | WIPO | `wipo.int/madrid`. | |
| Hague System (industrial designs) overview/text | WIPO | `wipo.int/hague`. | |
| Budapest Treaty (micro-organism deposits) | WIPO | `wipo.int/treaties` → Budapest Treaty page. | Relevant if a formulation involves a deposited microbial strain. |
| WIPO Treaty on IP, Genetic Resources and Associated TK (2024) | WIPO | `wipo.int/tk` → treaty's dedicated page. | Adopted May 2024 — confirm current ratification/entry-into-force status before stating it's "in force" for any specific country. |
| Nagoya Protocol (ABS) | CBD Secretariat | `cbd.int/abs` → official protocol text. | |
| TRIPS Agreement | WTO | `wto.org` → Legal texts → TRIPS. | |

## F. TKDL (read this before doing anything)

TKDL access is restricted to 14 patent offices worldwide under bilateral,
non-disclosure access agreements — search/examination use only, no
redistribution. A 2022 Cabinet decision approved a phased, **paid subscription**
model to widen access; there is still no public API or bulk-downloadable
dataset as of this writing.

**Do not** attempt to scrape `tkdl.res.in` or reconstruct TKDL entries from
secondary sources (blog posts, case-law citations quoting a TKDL record) and
feed them into `data/documents/` as if they were the TKDL corpus — that would
misrepresent secondhand paraphrase as the authoritative TKDL text, exactly the
kind of laundering the citation-authority allow-list is designed to catch.

Legitimate options, in order of how solid they are:
1. **If your institution has (or can get) authorized TKDL access** — implement
   the real client in `app/retrieval/tkdl_connector.py` (added below) and call
   it only for classification-support (e.g., surfacing that TK prior art likely
   exists), never for reproducing TKDL's translated text in a user-facing
   answer.
2. **Public-domain classical-text awareness layer** (optional, weaker) — build
   a small corpus from genuinely public-domain digitized classical texts (e.g.
   material published by NAMASTE / National Institute of Indian Medical
   Heritage, CCRAS publications) and use it only to flag "this may overlap
   with documented classical knowledge — verify against TKDL," never to claim
   a TKDL-equivalent search was performed.
3. **If neither is available** (the default for a student prototype) — keep
   doing exactly what the pipeline already does: state that TK prior-art needs
   verification via authorized TKDL access, and escalate to a human expert.

---

## Recording what you actually did

For every document you add, capture in `manifest.json`:
- The exact page URL you found it on (the *page*, not a guessed PDF path)
- The date you retrieved it
- The version/amendment date printed on the document itself
- The authority name exactly as printed on the document (don't paraphrase it)

This is what lets you legitimately update the corpus later — when a law
changes, you replace the entry, bump `version`, set `superseded_by`, and
re-run `python scripts/ingest.py`. No retraining, no guesswork about what
changed.
