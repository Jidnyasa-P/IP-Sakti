"""
Multilingual / translation abstraction (Section 19).

DictionaryProvider (DEMO MODE fallback): the curated Hindi/Marathi statutory
terminology dictionaries ported verbatim from the existing frontend project
(src/context/translations.ts -> backend/data/translations.json). Covers UI
string translation instantly and offline.

BhashiniProvider: a real HTTP client against the Bhashini ULCA pipeline
compute API. Requires BHASHINI_API_KEY/BHASHINI_USER_ID; genuine client code,
not exercised live in this sandbox (no network path to Bhashini's endpoints
here), but written to the documented ULCA request/response contract so it can
be pointed at production credentials directly.

The provider is swappable via TRANSLATION_PROVIDER so no single vendor is
hard-coded into the rest of the app (Section 19: "must be replaceable").
"""
import json
import os
from abc import ABC, abstractmethod

import httpx

from app.core.config import get_settings
from app.core.logging import logger

_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "translations.json")

BHASHINI_PIPELINE_ENDPOINT = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"


def _load_dictionaries() -> dict:
    with open(_DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


class TranslationProvider(ABC):
    @abstractmethod
    async def translate_text(self, text: str, target_language: str) -> tuple[str, str]:
        """Returns (translated_text, source_label)."""

    @abstractmethod
    async def translate_strings(self, strings: dict[str, str], target_language: str) -> tuple[dict[str, str], str]:
        ...


class DictionaryProvider(TranslationProvider):
    """DEMO MODE: curated static dictionaries, no network calls."""

    def __init__(self):
        self._dicts = _load_dictionaries()

    def _dict_for(self, target_language: str) -> dict[str, str]:
        if target_language == "hi":
            return self._dicts.get("HINDI_STATUTORY_DICTIONARY", {})
        if target_language == "mr":
            return self._dicts.get("MARATHI_STATUTORY_DICTIONARY", {})
        return {}

    async def translate_text(self, text: str, target_language: str) -> tuple[str, str]:
        # No general-purpose MT offline; return the source text with a clear label
        # rather than fabricating a translation.
        return text, "demo_mode_no_translation_available"

    async def translate_strings(self, strings: dict[str, str], target_language: str) -> tuple[dict[str, str], str]:
        lookup = self._dict_for(target_language)
        translated = {k: lookup.get(k, v) for k, v in strings.items()}
        return translated, "demo_mode_curated_dictionary"


class BhashiniProvider(TranslationProvider):
    def __init__(self, api_key: str, user_id: str, ulca_key: str):
        self.api_key = api_key
        self.user_id = user_id
        self.ulca_key = ulca_key

    async def _call_pipeline(self, texts: list[str], target_language: str) -> list[str] | None:
        headers = {
            "userID": self.user_id,
            "ulcaApiKey": self.ulca_key,
            "Content-Type": "application/json",
        }
        payload = {
            "pipelineTasks": [{
                "taskType": "translation",
                "config": {"language": {"sourceLanguage": "en", "targetLanguage": target_language}},
            }],
            "inputData": {"input": [{"source": t} for t in texts]},
        }
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(BHASHINI_PIPELINE_ENDPOINT, json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                outputs = data["pipelineResponse"][0]["output"]
                return [o["target"] for o in outputs]
        except Exception as exc:
            logger.warning(f"Bhashini call failed: {exc}. Falling back to dictionary provider.")
            return None

    async def translate_text(self, text: str, target_language: str) -> tuple[str, str]:
        result = await self._call_pipeline([text], target_language)
        if result:
            return result[0], "bhashini_live"
        translated, source = await DictionaryProvider().translate_text(text, target_language)
        return translated, source

    async def translate_strings(self, strings: dict[str, str], target_language: str) -> tuple[dict[str, str], str]:
        keys = list(strings.keys())
        values = [strings[k] for k in keys]
        result = await self._call_pipeline(values, target_language)
        if result:
            return dict(zip(keys, result)), "bhashini_live"
        return await DictionaryProvider().translate_strings(strings, target_language)


_provider: TranslationProvider | None = None


def get_translation_provider() -> TranslationProvider:
    global _provider
    if _provider is None:
        settings = get_settings()
        if settings.translation_provider == "bhashini" and settings.bhashini_configured:
            _provider = BhashiniProvider(settings.bhashini_api_key, settings.bhashini_user_id, settings.bhashini_ulca_api_key)
            logger.info("Translation provider: Bhashini (live credentials configured).")
        else:
            _provider = DictionaryProvider()
    return _provider
