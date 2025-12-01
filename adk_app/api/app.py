from __future__ import annotations

from dataclasses import dataclass
import os

import litellm
from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field

from adk_app.config import ModelConfig
from adk_app.orchestration.pipeline import ContextPackage, prepare_context
from adk_app.utils.data_loader import get_patient_data
litellm.drop_params = True  # Avoid unsupported parameter errors on certain models


@dataclass
class AgentRuntime:
    config: ModelConfig


class AskRequest(BaseModel):
    patient_id: str = Field(..., description="Patient identifier from patient JSON.")
    question: str = Field(..., description="User's natural language question.")


class AskResponse(BaseModel):
    answer: str
    router_summary: dict
    context_sources: dict


def get_runtime() -> AgentRuntime:
    config = ModelConfig.from_env()
    router_provider = os.getenv("ROUTER_PROVIDER", config.provider)
    router_model = os.getenv("ROUTER_MODEL", config.model)
    print(
        "[Model Config] provider="
        f"{config.provider} model={config.model} temperature={config.temperature}"
    )
    print(f"[Router Config] provider={router_provider} model={router_model}")
    return AgentRuntime(config=config)


app = FastAPI(title="Cataract Counsellor API")


@app.get("/healthz")
def health() -> dict:
    return {"status": "ok"}


@app.post("/ask", response_model=AskResponse)
def ask_endpoint(
    payload: AskRequest,
    runtime: AgentRuntime = Depends(get_runtime),
) -> AskResponse:
    try:
        patient = get_patient_data(payload.patient_id)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err

    clinic_id = patient.get("clinic_id")
    context_package: ContextPackage = prepare_context(
        question=payload.question,
        clinic_id=clinic_id,
        patient_id=payload.patient_id,
    )

    answer = _generate_answer_from_prompt(context_package.prompt, runtime.config)

    print(
        "[Answer Summary] patient="
        f"{payload.patient_id} has_general={bool(context_package.general_context)} "
        f"has_clinic={bool(context_package.clinic_context)} "
        f"has_patient={bool(context_package.patient_context)}"
    )

    return AskResponse(
        answer=answer,
        router_summary=context_package.router_summary,
        context_sources={
            "has_general": bool(context_package.general_context),
            "has_clinic": bool(context_package.clinic_context),
            "has_patient": bool(context_package.patient_context),
        },
    )


def _generate_answer_from_prompt(prompt: str, config: ModelConfig) -> str:
    model_ref = (
        f"{config.provider}/{config.model}" if config.provider != "gemini" else f"gemini/{config.model}"
    )
    try:
        response = litellm.completion(
            model=model_ref,
            messages=[
                {
                    "role": "system",
                    "content": "You are a cataract counselling assistant. Answer empathetically and cite context sections by name when relevant.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=config.temperature,
        )
    except Exception as exc:
        print(f"[Answer Error] {exc}")
        raise HTTPException(status_code=500, detail="LLM generation failed") from exc

    try:
        answer_text = response["choices"][0]["message"]["content"]
        print("[Final Answer]\n", answer_text, "\n")
        return answer_text
    except (KeyError, IndexError) as exc:
        print(f"[Answer Parse Error] {exc}")
        raise HTTPException(status_code=500, detail="LLM response parsing failed") from exc





