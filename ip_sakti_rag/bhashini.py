"""
Bhashini (ULCA) NMT wrapper — translates the final generated answer (and
any static UI strings you want localized) between English, Hindi and
Marathi. NOT used for retrieval: the corpus is embedded multilingually
(see embeddings.py), so queries in Hindi/Marathi are embedded directly
without a translation round-trip.

Bhashini's API is two-step:
  1. /pipeline/getModelPipeline (config call) — resolves which NMT model
     serviceId to use for a given source/target language pair.
  2. /pipeline/inference (compute call) — actually runs translation.
Both need BHASHINI_USER_ID + BHASHINI_API_KEY (from your Bhashini
onboarding) plus an inference key returned by the config call.
"""
import os

import httpx

CONFIG_URL = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline"
INFERENCE_URL_HEADER = "userID", "ulcaApiKey"

_LANG_CODE = {"en": "en", "hi": "hi", "mr": "mr"}


async def translate(text: str, source_lang: str, target_lang: str) -> str:
    if source_lang == target_lang:
        return text

    headers = {
        "userID": os.environ["BHASHINI_USER_ID"],
        "ulcaApiKey": os.environ["BHASHINI_API_KEY"],
        "Content-Type": "application/json",
    }
    payload = {
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
        "pipelineRequestConfig": {"pipelineId": "64392f96daac500b55c543cd"},
    }

    async with httpx.AsyncClient(timeout=15) as client:
        config_resp = await client.post(CONFIG_URL, headers=headers, json=payload)
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
        compute_resp = await client.post(
            compute_url, headers=compute_headers, json=compute_payload
        )
        compute_resp.raise_for_status()
        result = compute_resp.json()
        return result["pipelineResponse"][0]["output"][0]["target"]
