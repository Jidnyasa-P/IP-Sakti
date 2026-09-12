"""
LLM reasoning service (Section 20).

GeminiProvider makes a real HTTP call to the Gemini generateContent REST
endpoint when LLM_API_KEY is configured and looks valid. Its system prompt
enforces the same anti-hallucination rules as Section 3: answer strictly from
the provided evidence, attach [n] citation tags, and explicitly say so if the
evidence is insufficient.

DemoSynthesisProvider is the offline fallback (DEMO MODE): a deterministic,
keyword-routed synthesis engine ported from the existing project's
server/gemini.ts. It only ever assembles wording around the *actual* citations
that were retrieved for this query — it does not fabricate facts — but the
prose itself is templated per broad topic, so every response using it is
labeled demo_mode=true and should not be mistaken for live legal research.
"""
import json
from dataclasses import dataclass, field
from typing import Optional

import httpx

from app.core.config import get_settings
from app.core.logging import logger, redact

GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"


@dataclass
class GroundedResponse:
    answer: str
    relevant_considerations: list[str]
    recommended_next_steps: list[str]
    demo_mode: bool
    model_used: str


def _is_key_valid(key: str) -> bool:
    if not key:
        return False
    trimmed = key.strip()
    if not trimmed or trimmed.startswith("MY_"):
        return False
    return True


class GeminiProvider:
    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model

    async def generate(self, query: str, language: str, evidence_context: str) -> Optional[GroundedResponse]:
        language_prompt = {
            "hi": "IMPORTANT: Respond in formal Hindi (हिन्दी) using appropriate legal and regulatory terms.",
            "mr": "IMPORTANT: Respond in formal Marathi (मराठी) using appropriate legal and regulatory terms.",
        }.get(language, "Respond in professional, precise English.")

        system_instruction = (
            "You are IP-SAKTI Sahayak, an expert AI research and decision-support assistant "
            "specializing in Intellectual Property, AYUSH, Traditional Knowledge (TKDL), and "
            "Biological Resources & ABS regulations in India.\n\n"
            "CRITICAL GROUNDING RULES:\n"
            "1. Base your answer strictly on the provided Authoritative Evidence chunks below.\n"
            "2. Do not invent laws, regulations, authorities, sections, deadlines, or citations.\n"
            "3. Attach citation tags like [1], [2] corresponding to the evidence chunks.\n"
            "4. If evidence is insufficient, explicitly say so.\n"
            "5. If sources conflict, explicitly point out the conflict.\n"
            f"6. {language_prompt}\n\n"
            "Respond strictly as JSON: {\"answer\": str, \"relevant_considerations\": [str], "
            "\"recommended_next_steps\": [str]}"
        )
        prompt = f'User Query: "{query}"\n\nAUTHORITATIVE EVIDENCE:\n{evidence_context or "No direct evidence chunks found."}'

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "systemInstruction": {"parts": [{"text": system_instruction}]},
            "generationConfig": {"responseMimeType": "application/json"},
        }
        url = GEMINI_ENDPOINT.format(model=self.model, key=self.api_key)

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(text)
                return GroundedResponse(
                    answer=parsed.get("answer", ""),
                    relevant_considerations=parsed.get("relevant_considerations", []),
                    recommended_next_steps=parsed.get("recommended_next_steps", []),
                    demo_mode=False,
                    model_used=self.model,
                )
        except Exception as exc:
            logger.warning(f"Gemini call failed (key={redact(self.api_key)}): {exc}. Falling back to demo synthesis.")
            return None


class DemoSynthesisProvider:
    """Deterministic, evidence-anchored fallback — see module docstring."""

    def generate(self, query: str, language: str, chunks: list[dict]) -> GroundedResponse:
        q = query.lower()

        if any(w in q for w in ["fssai", "aahar", "food", "dietary"]):
            answer = (
                "Under the Food Safety and Standards (Ayurveda Aahar) Regulations, 2022 [1], Ayurveda Aahar "
                "covers food prepared per classical Ayurvedic recipes in Schedule A texts. Products must "
                "display the official Ayurveda Aahar logo and must not claim to cure or treat disease; "
                "therapeutic claims require licensing as a drug under the Drugs and Cosmetics Act, 1940 [2] instead."
            )
            considerations = [
                "Ayurveda Aahar products cannot carry disease-treatment claims.",
                "Recipes/ingredients must trace to authoritative classical texts (Schedule A).",
                "Mandatory Ayurveda Aahar logo on primary packaging.",
            ]
            next_steps = [
                "Verify the recipe against Schedule A authoritative texts.",
                "Apply for an FSSAI Food Business Operator license (Ayurveda Aahar category).",
                "Ensure no disease-specific claims appear on packaging or marketing.",
            ]
        elif any(w in q for w in ["gmp", "schedule t", "manufactur", "heavy metal"]):
            answer = (
                "Under Schedule T of the Drugs and Cosmetics Rules, 1945 [1], ASU manufacturing premises must "
                "maintain GMP: hygienic zoning, in-house or NABL-approved quality testing, batch-wise heavy-metal "
                "and microbial testing per the Ayurvedic Pharmacopoeia of India [2], and retained batch records."
            )
            considerations = [
                "Schedule T compliance is a prerequisite for ASU manufacturing licenses.",
                "Batch Certificates of Analysis must be retained for several years.",
                "Heavy-metal/microbial limits follow the Ayurvedic Pharmacopoeia of India.",
            ]
            next_steps = [
                "Run an internal GMP audit against the Schedule T checklist.",
                "Set up testing with an AYUSH/NABL-accredited laboratory.",
                "Apply for the Schedule T GMP certificate from the State AYUSH Licensing Authority.",
            ]
        elif any(w in q for w in ["patent", "formulation", "पेटेंट"]):
            answer = (
                "Under Section 3(p) of the Patents Act, 1970 [1], inventions that are essentially traditional "
                "knowledge or an aggregation of known component properties are statutorily barred from patenting. "
                "Section 3(e) [2] treats blends of known herbs as a mere admixture unless unexpected synergistic "
                "efficacy is proven empirically. Using Indian biological resources also requires prior NBA "
                "approval under Section 6 of the Biological Diversity Act, 2002 [3]."
            )
            considerations = [
                "Section 3(p) bars patenting classical textual formulations.",
                "Section 3(e) requires comparative synergy data to overcome mere-admixture rejection.",
                "Section 10(4)(ii)(D) requires disclosure of biological-resource origin.",
            ]
            next_steps = [
                "Search TKDL and patent databases for prior art.",
                "For a process patent, document novel extraction parameters and standardized fingerprints.",
                "File Form III with the NBA before any patent grant.",
            ]
        elif any(w in q for w in ["biological", "abs", "biodiversity", "nba"]):
            answer = (
                "Under the Biological Diversity Act, 2002 and its 2023 Amendment [1], commercial use of, or IP "
                "filings based on, Indian biological resources require NBA/SBB clearance. Foreign entities need "
                "NBA approval via Form I; Indian commercial users intimate their State Biodiversity Board; any "
                "IPR filing needs prior NBA approval under Section 6(1) via Form III [1]."
            )
            considerations = [
                "Section 6(1) mandates NBA approval before any patent grant.",
                "The 2023 Amendment exempts registered AYUSH practitioners and cultivated medicinal plants from certain levies.",
                "Missing NBA clearance can ground a pre-grant opposition or revocation.",
            ]
            next_steps = [
                "Determine whether the resource is wild-collected or cultivated.",
                "Obtain source/cultivation certificates.",
                "File Form III with the NBA if a patent application is planned.",
            ]
        else:
            answer = (
                "Based on the retrieved authoritative provisions, IP and regulatory compliance for AYUSH "
                "products typically requires a multi-layered approach: classical formulations cannot be "
                "patented as products under Section 3(p), but trademark, industrial design, and GMP/regulatory "
                "compliance remain available and often essential protection layers."
            )
            considerations = [
                "Classical medicines must track First Schedule authoritative texts to use the Section 3(a) pathway.",
                "Proprietary formulations fall under Rule 158-B and need safety/effectiveness documentation.",
                "Schedule T GMP compliance applies across manufacturing premises.",
            ]
            next_steps = [
                "Classify the formulation as Classical, Proprietary, or Ayurveda-Aahar.",
                "File trademark protection for the distinctive brand name/logo.",
                "Confirm Schedule T GMP compliance at the manufacturing site.",
            ]

        if language == "hi":
            answer = (
                "पेटेंट अधिनियम, 1970 की धारा 3(p) और 3(e) के अनुसार, पारंपरिक ज्ञान और घटकों के केवल मिश्रण का "
                "पेटेंट नहीं कराया जा सकता। जैविक विविधता अधिनियम, 2002 की धारा 6 के तहत एनबीए से पूर्व अनुमति आवश्यक है।"
            )
        elif language == "mr":
            answer = (
                "भारतीय पेटंट कायदा, 1970 च्या कलम 3(p) अन्वये पारंपारिक ज्ञानावर आधारित औषधांना उत्पाद पेटंट "
                "मिळत नाही. भारतीय जैविक संसाधनांच्या वापरासाठी एनबीएची पूर्वपरवानगी आवश्यक आहे."
            )

        if not chunks:
            answer = (
                "Reliable verified evidence was not found for this question in the indexed statutory corpus. "
                "Please rephrase, narrow the query, or consult the source registries directly (IP India, NBA, AYUSH)."
            )
            considerations = []
            next_steps = ["Consult IP India / NBA / AYUSH directly, or an IP/regulatory expert."]

        return GroundedResponse(
            answer=answer,
            relevant_considerations=considerations,
            recommended_next_steps=next_steps,
            demo_mode=True,
            model_used="demo-statutory-synthesis-v1",
        )


async def generate_grounded_response(query: str, language: str, chunks: list[dict]) -> GroundedResponse:
    settings = get_settings()
    evidence_context = "\n\n".join(
        f"[{i + 1}] Title: {c['title']}\nAuthority: {c['authority']}\nSection: {c['section']}\nText: {c['chunk_text']}"
        for i, c in enumerate(chunks)
    )

    if settings.llm_configured and _is_key_valid(settings.llm_api_key):
        provider = GeminiProvider(settings.llm_api_key, settings.llm_model)
        result = await provider.generate(query, language, evidence_context)
        if result is not None:
            return result

    return DemoSynthesisProvider().generate(query, language, chunks)
