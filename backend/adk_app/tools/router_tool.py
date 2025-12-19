from __future__ import annotations

import json
import os
import re
from dataclasses import asdict, dataclass
from typing import List, Optional

from google.adk.tools import FunctionTool

from adk_app.config import ModelConfig


TOPIC_KEYWORDS = {
    "BASICS": ["what is", "definition", "types", "basics"],
    "SYMPTOMS": ["symptom", "blurry", "glare", "halo"],
    "DIAGNOSIS": ["test", "diagnos", "scan", "evaluation", "biometry"],
    "SURGERY": ["surgery", "operation", "phaco", "laser", "procedure"],
    "LENSES": ["lens", "iol", "toric", "multifocal", "premium"],
    "RECOVERY": ["recovery", "healing", "downtime", "rest"],
    "POST_OP": ["post-op", "post op", "day", "week", "drops", "pain"],
    "INSURANCE": ["insurance", "coverage", "cost", "price", "package"],
}

CLINIC_KEYWORDS = [
    "clinic",
    "package",
    "price",
    "insurance",
    "bayview",
    "maple",
    "surgeon",
]

PATIENT_KEYWORDS = [
    "my eye",
    "my drops",
    "my surgery",
    "medications",
    "follow-up",
    "follow up",
    "patient",
    "pt_",
]

EMERGENCY_KEYWORDS = [
    "emergency",
    "urgent",
    "severe pain",
    "vision loss",
    "flashes",
    "floaters",
    "bleeding",
]


@dataclass
class RouterDecision:
    needs_general_kb: bool
    needs_clinic_kb: bool
    needs_patient_data: bool
    topics: List[str]
    is_emergency: bool
    rationale: str


def router_tool(
    question: str,
    clinic_id: Optional[str] = None,
    patient_id: Optional[str] = None,
) -> str:
    """Router tool that classifies which knowledge bases should answer a question."""

    print(f"[Router] question='{question}' clinic={clinic_id} patient={patient_id}")
    decision = _route_question(question, clinic_id, patient_id)
    payload = {
        "question": question,
        "clinic_id": clinic_id,
        "patient_id": patient_id,
        **asdict(decision),
    }
    return "Router decision:\n" + json.dumps(payload, indent=2)


def _route_question(question: str, clinic_id: Optional[str], patient_id: Optional[str]) -> RouterDecision:
    config = ModelConfig.from_env()
    provider = os.getenv("ROUTER_PROVIDER", config.provider).lower()
    model = os.getenv("ROUTER_MODEL", config.model)
    prompt = _build_prompt(question, clinic_id, patient_id)
    print(f"[Router Config] provider={provider} model={model}")

    llm_output: Optional[str] = None
    if provider == "gemini":
        llm_output = _route_with_gemini(prompt, model)
    elif provider == "openai":
        llm_output = _route_with_openai(prompt, model)
    else:
        print(f"[Router] provider '{provider}' unsupported, falling back to heuristics")

    if llm_output:
        print(f"[Router] response captured from provider={provider} model={model}")
        decision = _parse_router_output(llm_output)
        if decision:
            print("[Router] LLM routing succeeded")
            return decision

    print("[Router] LLM routing failed, using heuristics")
    return _heuristic_decision(question, clinic_id, patient_id)


def _route_with_gemini(prompt: str, model: str) -> Optional[str]:
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("[Router] Missing GOOGLE_API_KEY for Gemini routing")
        return None

    try:
        from google import genai
        from google.genai import types as genai_types
        import time

        # Use global client if available, else init (lazy loading fallback)
        global _GEMINI_CLIENT
        if _GEMINI_CLIENT is None:
             t_client_start = time.perf_counter()
             _GEMINI_CLIENT = genai.Client(api_key=api_key)
             print(f"####### timing router.gemini_client_init_ms={(time.perf_counter() - t_client_start)*1000:.1f}")

        t_gen_start = time.perf_counter()
        response = _GEMINI_CLIENT.models.generate_content(
            model=model,
            contents=[
                genai_types.Content(
                    role="user",
                    parts=[genai_types.Part.from_text(text=prompt)],
                )
            ],
        )
        t_gen_end = time.perf_counter()
        
        print(f"####### timing router.gemini_generate_ms={(t_gen_end - t_gen_start)*1000:.1f}")

        text = response.text
        return text
    except Exception as exc:
        print(f"[Router] Gemini routing error: {exc}")
        return None

# Global client storage
_GEMINI_CLIENT = None

def init_router_client():
    """Explicitly initialize the Gemini client at startup."""
    global _GEMINI_CLIENT
    api_key = os.getenv("GOOGLE_API_KEY")
    if api_key:
        print("[Router] Initializing global Gemini client...")
        import time
        t_start = time.perf_counter()
        from google import genai
        _GEMINI_CLIENT = genai.Client(api_key=api_key)
        print(f"[Router] Global client ready. Init time: {(time.perf_counter() - t_start)*1000:.1f} ms")


def _route_with_openai(prompt: str, model: str) -> Optional[str]:
    api_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("[Router] Missing OPENAI_API_KEY for routing")
        return None

    try:
        from openai import OpenAI

        client = OpenAI()
        response = client.responses.create(
            model=model,
            input=[
                {"role": "system", "content": "Return ONLY valid JSON matching the router schema."},
                {"role": "user", "content": prompt},
            ],
        )
        text_chunks = []
        for item in response.output or []:
            for content in getattr(item, "content", []) or []:
                if content.type == "output_text":
                    text_chunks.append(content.text)
        text = "\n".join(text_chunks).strip() or getattr(response, "output_text", "")
        return text
    except Exception as exc:
        print(f"[Router] OpenAI routing error: {exc}")
        return None


def _parse_router_output(raw_text: str) -> Optional[RouterDecision]:
    if not raw_text:
        return None
    try:
        match = re.search(r"\{.*\}", raw_text, re.DOTALL)
        if not match:
            return None
        data = json.loads(match.group(0))
        return RouterDecision(
            needs_general_kb=bool(data.get("needs_general_kb", True)),
            needs_clinic_kb=bool(data.get("needs_clinic_kb")),
            needs_patient_data=bool(data.get("needs_patient_data")),
            topics=[str(t).upper() for t in data.get("topics", [])] or ["GENERAL"],
            is_emergency=bool(data.get("is_emergency")),
            rationale=data.get("rationale", data.get("reasoning", "")) or "No rationale provided.",
        )
    except Exception as exc:
        print(f"[Router] Failed to parse router JSON: {exc}")
        return None


def _heuristic_decision(question: str, clinic_id: Optional[str], patient_id: Optional[str]) -> RouterDecision:
    text = question.lower()
    topics = _infer_topics(text)
    needs_clinic = bool(clinic_id) or any(word in text for word in CLINIC_KEYWORDS)
    needs_patient = bool(patient_id) or any(word in text for word in PATIENT_KEYWORDS)
    is_emergency = any(word in text for word in EMERGENCY_KEYWORDS)
    rationale = (
        "Heuristic routing based on detected keywords and supplied identifiers."
    )
    return RouterDecision(
        needs_general_kb=True,
        needs_clinic_kb=needs_clinic,
        needs_patient_data=needs_patient,
        topics=topics,
        is_emergency=is_emergency,
        rationale=rationale,
    )


def _infer_topics(text: str) -> List[str]:
    detected: set[str] = set()
    for topic, keywords in TOPIC_KEYWORDS.items():
        if any(keyword in text for keyword in keywords):
            detected.add(topic)
    if not detected:
        detected.add("GENERAL")
    return sorted(detected)


def _build_prompt(question: str, clinic_id: Optional[str], patient_id: Optional[str]) -> str:
    hints = []
    if clinic_id:
        hints.append(f"The user is associated with clinic_id '{clinic_id}'.")
    if patient_id:
        hints.append(f"The user references patient_id '{patient_id}'.")
    hint_block = "\n".join(hints) or "No additional identifiers provided."
    return (
        "You are a routing assistant for a cataract counselling agent.\n"
        "Analyze the question and decide which knowledge sources are required.\n"
        "Multiple sources may be needed simultaneously: set each boolean independently instead of forcing a single choice.\n"
        "Mark a source as true whenever any part of the question would benefit from that knowledge base (General_KB, clinic JSON, patient JSON).\n"
        "Only set false when you are confident the source is irrelevant.\n"
        "\n"
        "EMERGENCY DETECTION: Mark is_emergency=true ONLY if the patient describes NEW or WORSENING physical symptoms:\n"
        "- Sudden vision loss or severe blurriness\n"
        "- Severe eye pain\n"
        "- Flashes of light or floaters\n"
        "- Eye bleeding or discharge\n"
        "- Recent injury to the eye\n"
        "DO NOT mark educational questions as emergencies (e.g., 'What is a cataract?', 'Do I have a disease?', 'When is my surgery?').\n"
        "\n"
        "Return strictly valid JSON with the following keys:\n"
        "needs_general_kb (bool), needs_clinic_kb (bool), needs_patient_data (bool),\n"
        "topics (array of uppercase strings), is_emergency (bool), rationale (string).\n"
        "topics should use the taxonomy: BASICS, SYMPTOMS, DIAGNOSIS, SURGERY, LENSES, "
        "RECOVERY, POST_OP, INSURANCE, GENERAL.\n"
        f"Hints:\n{hint_block}\n"
        f"Question: {question}\n"
        "JSON:"
    )


def build_router_tool() -> FunctionTool:
    return FunctionTool(router_tool)



