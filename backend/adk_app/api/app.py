from __future__ import annotations

from dataclasses import dataclass
import os

import litellm
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from adk_app.config import ModelConfig
from adk_app.orchestration.pipeline import ContextPackage, prepare_context
from adk_app.utils.data_loader import get_patient_data, get_all_patients, save_patient_chat_history
litellm.drop_params = True  # Avoid unsupported parameter errors on certain models


@dataclass
class AgentRuntime:
    config: ModelConfig


class AskRequest(BaseModel):
    patient_id: str = Field(..., description="Patient identifier from patient JSON.")
    question: str = Field(..., description="User's natural language question.")


class AskResponse(BaseModel):
    answer: str
    suggestions: list[str] = []
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173",
    "https://cataract-hr18i1t73-srinivas831s-projects.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
def health() -> dict:
    return {"status": "ok"}


@app.get("/patients")
def list_patients() -> list[dict]:
    """Return a list of all patients for the selection screen."""
    return get_all_patients()


@app.get("/patients/{patient_id}")
def get_patient(patient_id: str) -> dict:
    """Return full details for a specific patient, including chat history."""
    try:
        return get_patient_data(patient_id)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err))


@app.post("/ask", response_model=AskResponse)
def ask_endpoint(
    payload: AskRequest,
    runtime: AgentRuntime = Depends(get_runtime),
) -> AskResponse:
    try:
        patient = get_patient_data(payload.patient_id)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err

    # Extract last 10 chat messages for conversational context
    # This allows the LLM to remember recent conversation history
    chat_history = patient.get("chat_history", [])
    recent_history = chat_history[-10:] if len(chat_history) > 10 else chat_history
    
    print(f"[Chat Context] Loaded {len(recent_history)} previous messages (total history: {len(chat_history)})")

    clinic_id = patient.get("clinic_id")
    context_package: ContextPackage = prepare_context(
        question=payload.question,
        clinic_id=clinic_id,
        patient_id=payload.patient_id,
    )

    # Generate answer with conversation history for context
    answer = _generate_answer_with_history(
        context_prompt=context_package.prompt,
        chat_history=recent_history,
        config=runtime.config
    )

    print(
        "[Answer Summary] patient="
        f"{payload.patient_id} has_general={bool(context_package.general_context)} "
        f"has_clinic={bool(context_package.clinic_context)} "
        f"has_patient={bool(context_package.patient_context)}"
    )

    # Generate suggestions (heuristic or LLM based)
    # For now, we'll use a simple heuristic based on topics
    suggestions = _generate_suggestions(context_package.router_summary.get("topics", []))

    # Persist history
    save_patient_chat_history(
        payload.patient_id,
        payload.question,
        answer,
        suggestions
    )

    return AskResponse(
        answer=answer,
        suggestions=suggestions,
        router_summary=context_package.router_summary,
        context_sources={
            "has_general": bool(context_package.general_context),
            "has_clinic": bool(context_package.clinic_context),
            "has_patient": bool(context_package.patient_context),
        },
    )


def _generate_suggestions(topics: list[str]) -> list[str]:
    """Generate follow-up questions based on topics."""
    suggestions = []
    if "SURGERY" in topics:
        suggestions.extend(["Is it painful?", "How long does it take?"])
    if "LENSES" in topics:
        suggestions.extend(["What is the best lens?", "Do I need glasses after?"])
    if "INSURANCE" in topics:
        suggestions.extend(["Is it covered by insurance?", "What is the cost?"])
    if "RECOVERY" in topics:
        suggestions.extend(["When can I drive?", "Can I watch TV?"])
    
    # Defaults if no specific topics or few suggestions
    if len(suggestions) < 2:
        suggestions.extend(["Tell me more.", "What are the risks?"])
    
    return list(set(suggestions))[:3]


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
                    "content": """You are a cataract surgery counselling assistant for patients. 

TONE: Warm, reassuring, conversational
LANGUAGE: Simple terms (8th grade reading level)
LENGTH: Concise - answer in 2-4 paragraphs (50-200 words)
STRUCTURE: Use natural paragraphs. Bullet points are fine for lists of items (risks, steps, options). Avoid section headers like 'Short answer:' or 'Next steps:'
CITATIONS: When citing facts, use simple source tags like [General Knowledge] or [Your Record]. Avoid technical IDs like "Chunk 3".

Be honest about information gaps, but don't offer unrequested tasks like drafting questions.""",
                }
                ,
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






def _generate_answer_with_history(
    context_prompt: str,
    chat_history: list[dict],
    config: ModelConfig
) -> str:
    """Generate answer with conversation history for contextual understanding.
    
    Args:
        context_prompt: The RAG-enhanced prompt with retrieved context
        chat_history: Last 10 messages from patient's chat history
        config: Model configuration
    
    Returns:
        Generated answer as string
    """
    model_ref = (
        f"{config.provider}/{config.model}" if config.provider != "gemini" else f"gemini/{config.model}"
    )
    
    # Build messages array with system prompt
    messages = [
        {
            "role": "system",
            "content": """You are a cataract surgery counselling assistant for patients. 

TONE: Warm, reassuring, conversational
LANGUAGE: Simple terms (8th grade reading level)
LENGTH: Concise - answer in 2-4 paragraphs (50-200 words)
STRUCTURE: Use natural paragraphs. Bullet points are fine for lists of items (risks, steps, options). Avoid section headers like 'Short answer:' or 'Next steps:'
CITATIONS: When citing facts, use simple source tags like [General Knowledge] or [Your Record]. Avoid technical IDs like \"Chunk 3\".

Be honest about information gaps, but don't offer unrequested tasks like drafting questions.""",
        }
    ]
    
    # Add conversation history (map "bot" role to "assistant" for LLM)
    for entry in chat_history:
        if entry["role"] == "user":
            messages.append({"role": "user", "content": entry["text"]})
        elif entry["role"] == "bot":
            # LLM APIs use "assistant" role, not "bot"
            messages.append({"role": "assistant", "content": entry["text"]})
    
    # Add current question with RAG context
    messages.append({"role": "user", "content": context_prompt})
    
    # Log for debugging
    history_count = len([m for m in messages if m["role"] in ["user", "assistant"]])
    print(f"[LLM Call] Sending {history_count} conversation messages (including current)")
    
    try:
        response = litellm.completion(
            model=model_ref,
            messages=messages,
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
