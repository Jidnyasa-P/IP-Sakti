"""
Bhashini (ULCA) NMT client — synchronous, to match the synchronous
TranslationProvider.translate() seam in app/language.py.

Used ONLY for translating fixed UI/template strings when the offline
fallback path is used (see app/generation/llm_client.py's
offline_grounded_synthesis) or for any other short static string you want
localized. It is NOT used for retrieval or for the main LLM-generated
answer — the Gemini prompt already generates directly in the requested
language (see app/generation/prompts.py), which is more reliable for legal
terminology than a generic NMT round-trip.

CAVEAT: I could only read the Bhashini docs' table of contents, not the
full request/response payload examples, so the exact field names below
(pipelineId, response JSON paths) are a best-effort reconstruction of the
standard ULCA two-step pattern (config call -> inference call). Verify
against a real response once you have credentials — paste it back and this
gets corrected.
"""
from __future__ import annotations

import httpx

from app.config import settings

_CONFIG_URL = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline"
_PIPELINE_ID = "64392f96daac500b55c543cd"  # Bhashini's standard public pipeline ID
_LANG_CODE = {"en": "en", "hi": "hi", "mr": "mr"}


def bhashini_translate(text: str, source_lang: str, target_lang: str, timeout: float = 15.0) -> str:
    if source_lang == target_lang:
        return text
    if not settings.bhashini_api_key or not settings.bhashini_user_id:
        raise RuntimeError("BHASHINI_API_KEY / BHASHINI_USER_ID are not set.")

    headers = {
        "userID": settings.bhashini_user_id,
        "ulcaApiKey": settings.bhashini_api_key,
        "Content-Type": "application/json",
    }
    config_payload = {
        "pipelineTasks": [
            {
                "taskType": "translation",
                "config": {
                    "language": {
                        "sourceLanguage": _LANG_CODE[source_lang],
                        "targetLanguage": _LANG_CODE[target_lang],
                    }
                },
            }
        ],
        "pipelineRequestConfig": {"pipelineId": _PIPELINE_ID},
    }

    with httpx.Client(timeout=timeout) as client:
        config_resp = client.post(_CONFIG_URL, headers=headers, json=config_payload)
        config_resp.raise_for_status()
        config = config_resp.json()

        compute_url = config["pipelineInferenceAPIEndPoint"]["callbackUrl"]
        inference_key = config["pipelineInferenceAPIEndPoint"]["inferenceApiKey"]
        service_id = config["pipelineResponseConfig"][0]["config"][0]["serviceId"]

        compute_headers = {
            inference_key["name"]: inference_key["value"],
            "Content-Type": "application/json",
        }
        compute_payload = {
            "pipelineTasks": [
                {
                    "taskType": "translation",
                    "config": {
                        "language": {
                            "sourceLanguage": _LANG_CODE[source_lang],
                            "targetLanguage": _LANG_CODE[target_lang],
                        },
                        "serviceId": service_id,
                    },
                }
            ],
            "inputData": {"input": [{"source": text}]},
        }
        compute_resp = client.post(compute_url, headers=compute_headers, json=compute_payload)
        compute_resp.raise_for_status()
        result = compute_resp.json()
        return result["pipelineResponse"][0]["output"][0]["target"]
