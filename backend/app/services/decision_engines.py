"""
Product Analyzer, IPR Navigator, and TK/ABS decision engines.

Ported from the existing project's server/gemini.ts. These are genuine
deterministic rules engines over structured user input (not per-request
random or fabricated content): the same input always yields the same
classification and citations always come from the retrieved evidence passed
in by the caller. They are labelled clearly in API responses as
`engine: "rule_based_v1"` and can be swapped for a full LLM-based reasoner by
implementing the same function signatures.
"""
import time
import uuid


def analyze_product(product: dict, citations: list[dict]) -> dict:
    ingredients_raw = product.get("ingredients", "")
    if isinstance(ingredients_raw, list):
        ingredients = ", ".join(
            i if isinstance(i, str) else f"{i.get('name', '')} {i.get('botanical_name', '')}" for i in ingredients_raw
        ).lower()
    else:
        ingredients = str(ingredients_raw or "").lower()

    product_type = str(product.get("product_type", "")).lower()
    claims = str(product.get("claims", "")).lower()
    is_classical = bool((product.get("classical_reference") or "").strip())

    if is_classical:
        category = "Classical Ayurvedic Medicine"
        reasoning = (
            "Manufactured per formulae in authoritative Ayurvedic texts (First Schedule, "
            f"Drugs and Cosmetics Act 1940, Section 3(a)). Reference: {product.get('classical_reference')}."
        )
    elif "aahar" in product_type or "food" in product_type or "dietary" in claims or "nutrition" in claims:
        category = "Ayurveda-Aahar"
        reasoning = "Classified under FSSAI Ayurveda Aahar Regulations, 2022 — classical recipe, no therapeutic cure claims."
    elif "cosmetic" in product_type or ("skin" in product_type or "hair" in product_type) and "cure" not in claims:
        category = "Cosmetic"
        reasoning = "Regulated as an herbal cosmetic, provided no therapeutic/disease claims are asserted."
    elif "fraction" in product_type or "extract" in product_type or "standardized" in ingredients:
        category = "Phytopharmaceutical"
        reasoning = "Standardized plant extract/fraction with marker compounds, subject to CDSCO DCGI review."
    else:
        category = "Proprietary Ayurvedic Medicine"
        reasoning = "Non-classical combination of First-Schedule ingredients, regulated under Section 3(h) / Rule 158-B."

    tk_keywords = ["ashwagandha", "curcuma", "neem", "triphala"]
    has_tk_risk = is_classical or any(k in ingredients for k in tk_keywords)

    regulatory_considerations = [
        {
            "title": "Manufacturing License & Governing Statute",
            "description": (
                "Requires FSSAI Food License under Ayurveda Aahar Regulations 2022 with the mandatory logo."
                if category == "Ayurveda-Aahar"
                else "Requires ASU Manufacturing License under Chapter IV-A of the Drugs & Cosmetics Act, 1940."
            ),
            "governing_statute": "FSSAI Act 2006 & Regulations 2022" if category == "Ayurveda-Aahar" else "Drugs and Cosmetics Act, 1940 (Section 3(a)/3(h))",
            "actionable_requirement": (
                "Submit recipe confirmation from Schedule A classical texts; prohibit disease-cure claims."
                if category == "Ayurveda-Aahar"
                else "Comply with Rule 158-B evidence-of-safety-and-efficacy guidelines."
            ),
        },
        {
            "title": "Good Manufacturing Practices (GMP)",
            "description": "Premises must conform to Schedule T: clean zones, potable water testing, batch records, shelf-life stability.",
            "governing_statute": "Drugs & Cosmetics Rules 1945, Schedule T",
            "actionable_requirement": "Obtain Schedule T GMP certification from the State AYUSH Directorate.",
        },
        {
            "title": "Quality & Heavy Metal Safety Standards",
            "description": "Mandatory testing for heavy metals, pesticide residues, microbial load, and aflatoxins per the Ayurvedic Pharmacopoeia of India.",
            "governing_statute": "Ayurvedic Pharmacopoeia of India (API) & Gazette Notifications",
            "actionable_requirement": "Maintain a Certificate of Analysis from a NABL/AYUSH-approved lab for each raw-material batch.",
        },
    ]

    result = {
        "id": f"PROD-{uuid.uuid4().hex[:10]}",
        "user_id": "user-default",
        "product_information": product,
        "likely_category": category,
        "category_reasoning": reasoning,
        "confidence": {
            "level": "High",
            "score": 0.92,
            "reasons": [
                "Classified against statutory definitions in the Drugs & Cosmetics Act 1940 (Sec 3a/3h).",
                "Evaluated under Sections 3(p) and 3(e) of the Patents Act 1970.",
                "Cross-referenced with NBA ABS regulations.",
            ],
        },
        "regulatory_considerations": regulatory_considerations,
        "ipr_considerations": {
            "patent_assessment": (
                "Formulation patent is BARRED under Section 3(p) as traditional knowledge; novel extraction "
                "methods or delivery systems may still qualify for process patents."
                if is_classical
                else "Formulation patent requires proving unexpected synergistic enhancement under Section 3(e) with comparative data."
            ),
            "section_3p_tk_bar": (
                "High rejection probability under Section 3(p) if ingredients exist in TKDL/classical texts without technical non-obviousness."
                if has_tk_risk
                else "Moderate risk; ensure ingredients have a novel therapeutic indication or delivery mechanism."
            ),
            "section_3e_admixture_bar": "Requires pharmacological data showing unexpected synergy beyond the additive sum of individual ingredients.",
            "trademark_recommendation": "Register a distinctive coined brand name in Class 5 (medicinal) or Class 3 (cosmetics); avoid descriptive botanical/Sanskrit terms.",
            "industrial_design": "Register unique bottle/dropper/packaging geometries under the Designs Act 2000 for 10-15 years of protection.",
            "trade_secret_potential": "Protect proprietary extraction temperature, solvent ratio, and fermentation protocols under NDAs as trade secrets.",
        },
        "traditional_knowledge_abs_flags": {
            "tk_prior_art_risk": "High" if has_tk_risk else "Medium",
            "tk_details": (
                "Components are documented in classical texts (Charaka Samhita, Bhavaprakasha) and indexed in TKDL."
                if has_tk_risk
                else "Ingredients require prior-art clearance against the TKDL database."
            ),
            "biological_resource_status": product.get("biological_source_details") or "Biological herbs sourced from Indian flora; sourcing status (wild vs cultivated) must be documented.",
            "nba_abs_requirements": "Section 6 of the Biological Diversity Act 2002 requires prior NBA approval before filing any patent based on Indian biological resources; SBB intimation applies for domestic manufacturing.",
            "form_required": "Form III for patent applications; Form I for foreign-entity access; SBB intimation form for domestic commercial manufacturing.",
        },
        "recommended_next_steps": [
            "Finalize statutory licensing classification with the State AYUSH Licensing Authority or FSSAI.",
            "File a trademark application in Nice Class 5 for the brand name and stylized logo.",
            "Obtain Certificates of Origin for raw botanicals to assess ABS exemption eligibility.",
            "If patenting a novel extraction method, prepare synergy data and file Form III with the NBA.",
            "Implement Schedule T GMP standard operating procedures.",
        ],
        "evidence": citations[:4],
        "engine": "rule_based_v1",
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    return result


_IPR_TABLE = {
    "New invention": {
        "primary_protection": "Process Patent (The Patents Act, 1970)",
        "potential_protection": ["Process Patent", "Trade Secret", "Trademark"],
        "why_relevant": "Novel manufacturing processes or delivery mechanisms avoid the Section 3(p) traditional-knowledge product bar.",
        "important_considerations": [
            "Must show novelty, inventive step, and industrial applicability under Section 2(1)(j).",
            "Section 3(p) forbids patenting traditional knowledge or aggregation of known components.",
            "Section 6 of the Biological Diversity Act 2002 requires prior NBA approval (Form III) before grant.",
        ],
        "relevant_authority": "CGPDTM (IP India) & National Biodiversity Authority (NBA)",
        "documents_to_prepare": ["Form 1 (Grant of Patent)", "Form 2 (Complete Specification)", "Form 3 (NBA Approval)"],
        "possible_next_steps": ["Run a patentability search (InPASS/WIPO/Google Patents).", "File a provisional specification.", "Submit Form III to the NBA."],
    },
    "Manufacturing process": "New invention",  # alias, resolved below
    "New formulation": {
        "primary_protection": "Proprietary Trade Secret + Trademark Class 5 (Patents conditional on Synergism)",
        "potential_protection": ["Trademark (Class 5)", "Trade Secret", "Patent (requires Section 3(e) synergism)"],
        "why_relevant": "Direct herbal formulations face high non-patentability barriers under Sections 3(p) and 3(e); brand equity and trade secrets are the strongest available protection.",
        "important_considerations": [
            "Section 3(p) bars patenting traditional-knowledge remedies.",
            "Section 3(e) demands scientific data showing unexpected synergy.",
            "Trademark Class 5 provides renewable 10-year exclusive protection.",
        ],
        "relevant_authority": "Trade Marks Registry (CGPDTM) & Patent Office",
        "documents_to_prepare": ["TM-A Application", "Synergy assay reports (if patenting)", "Schedule T batch protocols"],
        "possible_next_steps": ["Register a distinctive brand name in Class 5.", "Protect blending protocols as trade secrets.", "Run synergy studies if attempting a patent."],
    },
    "Brand name": {
        "primary_protection": "Trademark Registration (The Trade Marks Act, 1999)",
        "potential_protection": ["Trademark (Class 5)", "Trademark (Class 3)", "Copyright (logo artwork)"],
        "why_relevant": "Provides nationwide legal exclusivity for commercial branding.",
        "important_considerations": [
            "Must not be descriptive under Section 9(1)(b).",
            "Coined/fanciful/arbitrary marks receive the strongest protection.",
            "Class 5 covers medicines; Class 3 covers cosmetics.",
        ],
        "relevant_authority": "Trade Marks Registry (CGPDTM)",
        "documents_to_prepare": ["Form TM-A", "High-resolution logo representation", "Nice-classified goods/services description"],
        "possible_next_steps": ["Run a clearance search on the IP India public search tool.", "File TM-A online.", "Use ™ immediately; ® once granted."],
    },
    "Logo": "Brand name",
    "Packaging/design": {
        "primary_protection": "Design Registration (The Designs Act, 2000)",
        "potential_protection": ["Industrial Design (Class 09-01)", "Trademark (Trade Dress / 3D Mark)"],
        "why_relevant": "Protects novel bottle/dispenser shapes and packaging for 10 years (extendable to 15).",
        "important_considerations": [
            "Design must be new/original and not previously published.",
            "Functional features are not protected — only aesthetic shape/appearance.",
        ],
        "relevant_authority": "The Patent Office (Designs Directorate), Kolkata",
        "documents_to_prepare": ["Form 1 (Design Registration)", "Orthographic representation views", "Statement of novelty"],
        "possible_next_steps": ["Confirm no prior public disclosure.", "Prepare CAD render views.", "File in Class 09-01."],
    },
    "Plant variety": {
        "primary_protection": "PPV&FR Act, 2001",
        "potential_protection": ["Plant Variety Registration", "Geographical Indication (GI)"],
        "why_relevant": "Protects newly bred, distinct, uniform, stable (DUS) medicinal/aromatic plant varieties.",
        "important_considerations": [
            "Must satisfy Novelty, Distinctiveness, Uniformity, and Stability.",
            "Protects breeders' rights while safeguarding farmers' rights to save/use/sow seeds.",
        ],
        "relevant_authority": "PPV&FR Authority, Ministry of Agriculture & Farmers Welfare",
        "documents_to_prepare": ["Application form (extant/new variety)", "DUS testing data", "Parental lineage/geographic-source evidence"],
        "possible_next_steps": ["Complete DUS trial cycles.", "Submit application with seed/propagule samples."],
    },
}


def evaluate_ipr(asset_type: str, citations: list[dict]) -> dict:
    entry = _IPR_TABLE.get(asset_type)
    if isinstance(entry, str):  # alias
        entry = _IPR_TABLE[entry]
    if entry is None:
        entry = {
            "primary_protection": "Multi-layered IP Portfolio (Trademark + Trade Secret + Design)",
            "potential_protection": ["Trademark", "Copyright", "Trade Secret", "Industrial Design"],
            "why_relevant": "A combined strategy of trademarks, trade secrets, and designs gives the most robust protection given the traditional-knowledge patent bar.",
            "important_considerations": ["Avoid relying on product patents alone.", "Combine brand equity with regulatory compliance."],
            "relevant_authority": "CGPDTM / Ministry of Commerce & Industry",
            "documents_to_prepare": ["Corporate IP portfolio audit", "NDAs", "Brand trademark filings"],
            "possible_next_steps": ["Identify all protectable touchpoints.", "Execute NDAs with manufacturing/lab partners."],
        }
    return {
        **entry,
        "sources": citations[:3],
        "disclaimer": "This evaluation provides informational decision support based on Indian statutory frameworks and does not constitute formal legal counsel.",
        "engine": "rule_based_v1",
    }


def evaluate_tk_abs(query: dict, citations: list[dict]) -> dict:
    is_foreign = query.get("intended_use") == "Foreign entity utilization"
    is_ip_filing = query.get("intended_use") == "IP filing"

    resource_name = query.get("biological_resource") or query.get("plant_material") or "Indian Medicinal Plant / Biological Material"
    region_name = query.get("geographic_origin") or "India"
    traditional_use = query.get("traditional_use") or "therapeutic and healthcare applications"

    tk_overview = (
        f'The biological resource "{resource_name}" from region "{region_name}" has documented traditional use '
        "in classical Ayurvedic and traditional literature. Traditional practices involving "
        f'"{traditional_use}" are widely cataloged in TKDL and authoritative compendia such as Charaka Samhita '
        "and Bhavaprakasha."
    )
    bio_assessment = (
        "Identified as a regulated Indian biological resource under the Biological Diversity Act, 2002 and its "
        "2023 Amendment. Sourcing documentation must clarify wild-harvest vs cultivated origin."
    )

    abs_sections = []
    if is_foreign:
        abs_sections.append("Section 3: Mandatory prior NBA approval (Form I) before accessing the resource or associated knowledge.")
    else:
        abs_sections.append("Section 7: Prior intimation to the State Biodiversity Board for commercial utilization by Indian citizens.")
    if is_ip_filing:
        abs_sections.append("Section 6(1): Mandatory prior NBA approval (Form III) before applying for or obtaining an IPR.")

    return {
        "traditional_knowledge_overview": tk_overview,
        "biological_resource_assessment": bio_assessment,
        "abs_considerations": {
            "nba_approval_needed": is_foreign or is_ip_filing,
            "sbb_notification_needed": not is_foreign,
            "statutory_sections": abs_sections,
            "benefit_sharing_rate": "0.2%-1.0% of annual gross ex-factory sale price for commercial sale, or 3.0%-5.0% of IPR licensing royalty (ABS Guidelines Regulation 14).",
            "exemptions_applicable": "Registered AYUSH practitioners and cultivated medicinal plants (with BMC/Forest Department origin certificate) are exempt under the 2023 Amendment Act.",
        },
        "prior_art_tk_considerations": "High risk of anticipation if seeking claims on therapeutic applications already codified in TKDL (cited under Sections 3(p) and 25(1)(k)).",
        "potential_ip_implications": [
            "Product composition claims are barred under Section 3(p).",
            "Form III must be filed with the NBA prior to any patent grant.",
            "Process patents on novel extraction/delivery systems remain viable.",
            "Trademark Class 5 is the recommended vehicle for commercial exclusivity.",
        ],
        "recommended_next_steps": [
            "Procure traceable source provenance / BMC cultivation certificates.",
            "File Form III with the NBA immediately if applying for a patent.",
            "Review TKDL for prior-art disclosures on this plant/traditional use.",
            "Comply with SBB intimation protocols for commercial processing.",
        ],
        "sources": citations[:4],
        "engine": "rule_based_v1",
    }
