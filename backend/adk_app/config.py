from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv


@dataclass(frozen=True)
class ModelConfig:
    """Runtime configuration for the ADK agent's backing LLM."""

    provider: str
    model: str
    temperature: float = 0.0

    @staticmethod
    def from_env() -> "ModelConfig":
        load_dotenv()
        provider = os.getenv("MODEL_PROVIDER", "gemini").strip().lower()
        model = os.getenv("MODEL_NAME") or {
            "gemini": "gemini-2.5-flash",
            # "openai": "gpt-5-mini",
            "openai": "gpt-4o",
            "claude": "claude-3-5-sonnet-20240620",
        }.get(provider, "gemini-2.5-flash")

        temperature = float(os.getenv("MODEL_TEMPERATURE", "0.2"))
        return ModelConfig(provider=provider, model=model, temperature=temperature)

