"""
Chat and module content routes for the patient assistant.

Updated to use Supabase instead of JSON files.
"""
import re
import time

from fastapi import APIRouter, Depends, HTTPException


def normalize_input_text(text: str) -> str:
    """Normalize special Unicode characters to ASCII equivalents."""
    replacements = {
        "\u201c": '"', "\u201d": '"',  # smart double quotes
        "\u2018": "'", "\u2019": "'",  # smart single quotes / apostrophes
        "\u2014": "-", "\u2013": "-",  # em dash, en dash
        "\u2026": "...",               # ellipsis
        "\u00a0": " ",                 # non-breaking space
        "\u200b": "",                  # zero-width space
        "\u200c": "", "\u200d": "",    # zero-width non-joiner/joiner
        "\ufeff": "",                  # BOM
    }
    for char, replacement in replacements.items():
        text = text.replace(char, replacement)
    # Collapse multiple spaces
    text = re.sub(r" {2,}", " ", text)
    return text.strip()

# New Relic for custom attributes (patient tracking in chat)
try:
    import newrelic.agent
    NEWRELIC_AVAILABLE = True
except ImportError:
    NEWRELIC_AVAILABLE = False

from adk_app.core.dependencies import AgentRuntime, get_runtime
from adk_app.models.requests import AskRequest, ModuleContentRequest, PreGenerateModulesRequest
from adk_app.models.responses import AskResponse, ModuleContentResponse
from adk_app.orchestration.pipeline import ContextPackage, prepare_context
from adk_app.services.chat_service import generate_answer_with_history
from adk_app.services.module_service import (
    normalize_module_title,
    get_missing_modules,
    generate_and_save_missing,
    generate_diagnosis_if_needed,
    should_generate_diagnosis_module,
    DIAGNOSIS_MODULE_TITLE,
)
# Use Supabase data loader instead of JSON-based one
from adk_app.utils.supabase_data_loader import (
    get_patient_data,
    save_patient_chat_history,
)

router = APIRouter(tags=["Chat"])


@router.post("/ask", response_model=AskResponse)
def ask_endpoint(
    payload: AskRequest,
    runtime: AgentRuntime = Depends(get_runtime),
) -> AskResponse:
    """Process a patient question and return an AI-generated answer."""
    t_start = time.perf_counter()

    # Add custom attributes to New Relic for chat tracking
    if NEWRELIC_AVAILABLE:
        try:
            newrelic.agent.add_custom_attribute('patient_id', payload.patient_id)
            newrelic.agent.add_custom_attribute('clinic_id', payload.clinic_id)
            newrelic.agent.add_custom_attribute('user_role', 'patient')
            newrelic.agent.add_custom_attribute('request_type', 'chat')
        except Exception as e:
            print(f"[Chat] New Relic attribute error (non-fatal): {e}")

    # Normalize input to handle smart quotes, special chars, etc.
    question = normalize_input_text(payload.question)

    try:
        # Use clinic_id for unique patient lookup (required when multiple clinics exist)
        patient = get_patient_data(payload.patient_id, clinic_id=payload.clinic_id)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err
    t_after_patient = time.perf_counter()
    print(f"####### timing ask.load_patient_ms={(t_after_patient - t_start)*1000:.1f}")

    # Extract last 6 chat messages for conversational context
    chat_history = patient.get("chat_history", [])
    recent_history = chat_history[-6:] if len(chat_history) > 6 else chat_history

    print(f"[Chat Context] Loaded {len(recent_history)} previous messages (total history: {len(chat_history)})")

    clinic_id = patient.get("clinic_id")
    t_context_start = time.perf_counter()
    context_package: ContextPackage = prepare_context(
        question=question,
        clinic_id=clinic_id,
        patient_id=payload.patient_id,
    )
    t_after_context = time.perf_counter()
    print(f"####### timing ask.prepare_context_ms={(t_after_context - t_context_start)*1000:.1f}")

    # Generate answer with conversation history for context
    t_answer_start = time.perf_counter()
    answer, suggestions, blocks = generate_answer_with_history(
        context_prompt=context_package.prompt,
        chat_history=recent_history,
        config=runtime.config,
        topics=context_package.router_summary.get("topics", []),
        question=question,
    )
    t_after_answer = time.perf_counter()
    print(f"####### timing ask.generate_answer_ms={(t_after_answer - t_answer_start)*1000:.1f}")

    print(
        "[Answer Summary] patient="
        f"{payload.patient_id} has_general={bool(context_package.general_context)} "
        f"has_clinic={bool(context_package.clinic_context)} "
        f"has_patient={bool(context_package.patient_context)}"
    )

    # Persist history
    t_save_start = time.perf_counter()
    save_patient_chat_history(
        payload.patient_id,
        question,
        answer,
        suggestions,
        blocks,
        clinic_id=payload.clinic_id
    )
    t_after_save = time.perf_counter()
    print(f"####### timing ask.save_history_ms={(t_after_save - t_save_start)*1000:.1f}")
    print(f"####### timing ask.total_ms={(time.perf_counter() - t_start)*1000:.1f}")

    return AskResponse(
        answer=answer,
        blocks=blocks,
        suggestions=suggestions,
        router_summary=context_package.router_summary,
        context_sources={
            "has_general": bool(context_package.general_context),
            "has_clinic": bool(context_package.clinic_context),
            "has_patient": bool(context_package.patient_context),
        },
        media=context_package.media or [],
        sources=context_package.sources or [],
    )


@router.post("/module-content", response_model=ModuleContentResponse)
def module_content_endpoint(
    payload: ModuleContentRequest,
    runtime: AgentRuntime = Depends(get_runtime),
) -> ModuleContentResponse:
    """
    Get or generate personalized module content for a patient.

    NOTE: Only "My Diagnosis" module is LLM-generated.
    Other modules return a minimal response - the frontend uses static content for those.
    """
    raw_title = payload.module_title or ""
    key = normalize_module_title(raw_title)
    diagnosis_key = normalize_module_title(DIAGNOSIS_MODULE_TITLE)

    print(f"[ModuleContent] REQUEST - module_title='{raw_title}' patient_id={payload.patient_id} clinic_id={payload.clinic_id}")

    try:
        # Use clinic_id for unique patient lookup
        patient = get_patient_data(payload.patient_id, clinic_id=payload.clinic_id)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err

    # Get module cache
    module_content_top = patient.get("module_content")
    extra = patient.get("extra")

    module_cache = None
    if isinstance(module_content_top, dict):
        module_cache = module_content_top
    elif isinstance(extra, dict) and isinstance(extra.get("module_content"), dict):
        module_cache = extra.get("module_content")
    else:
        module_cache = {}

    # Check for cached content first
    cached = module_cache.get(raw_title) or module_cache.get(key)
    if cached:
        print(f"[ModuleContent] ✓ CACHE HIT - Found content for '{raw_title}'")
        return ModuleContentResponse(**cached)

    # Only generate if this is the "My Diagnosis" module
    is_diagnosis_module = (key == diagnosis_key or raw_title == DIAGNOSIS_MODULE_TITLE)

    if not is_diagnosis_module:
        # For non-diagnosis modules, return minimal response
        # Frontend will use static content
        print(f"[ModuleContent] Static module '{raw_title}' - returning minimal response")
        return ModuleContentResponse(
            title=raw_title,
            summary="",
            details=[],
            faqs=[],
            videoScriptSuggestion="",
            botStarterPrompt=f"Tell me more about {raw_title}"
        )

    # Generate "My Diagnosis" module
    print(f"[ModuleContent] Generating diagnosis module for patient={payload.patient_id}, clinic={payload.clinic_id}")
    generated = generate_diagnosis_if_needed(
        patient_id=payload.patient_id,
        patient=patient,
        config=runtime.config,
        force=False,
        clinic_id=payload.clinic_id
    )

    if generated:
        # Reload to get the newly saved content
        patient = get_patient_data(payload.patient_id, clinic_id=payload.clinic_id)
        module_cache = patient.get("module_content", {})
        cached = module_cache.get(raw_title) or module_cache.get(key)
        if cached:
            print(f"[ModuleContent] ✓ Generated and returning diagnosis content")
            return ModuleContentResponse(**cached)

    print(f"[ModuleContent] ✗ Failed to generate diagnosis content")
    raise HTTPException(status_code=500, detail="Failed to generate diagnosis content")


@router.post("/pregenerate-modules")
def pregenerate_modules_endpoint(
    payload: PreGenerateModulesRequest,
    runtime: AgentRuntime = Depends(get_runtime),
) -> dict:
    """
    Pre-generate module content for a patient.

    NOTE: Only generates "My Diagnosis" module via LLM.
    Other modules use static content and don't need pre-generation.
    """
    try:
        # Use clinic_id for unique patient lookup
        patient = get_patient_data(payload.patient_id, clinic_id=payload.clinic_id)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err

    # Check if diagnosis module needs generation
    if not should_generate_diagnosis_module(patient):
        print(f"[ModuleContent] Pregen skipped - diagnosis module exists for patient={payload.patient_id}")
        return {
            "status": "ok",
            "generated": 0,
            "message": "Diagnosis module already exists",
            "module": DIAGNOSIS_MODULE_TITLE
        }

    print(f"[ModuleContent] Pregen start patient={payload.patient_id}, clinic={payload.clinic_id}")

    # Generate diagnosis module
    generated = generate_diagnosis_if_needed(
        patient_id=payload.patient_id,
        patient=patient,
        config=runtime.config,
        force=False,
        clinic_id=payload.clinic_id
    )

    if generated:
        print(f"[ModuleContent] Pregen done patient={payload.patient_id}")
        return {
            "status": "ok",
            "generated": 1,
            "saved": [DIAGNOSIS_MODULE_TITLE],
            "module": DIAGNOSIS_MODULE_TITLE
        }
    else:
        return {
            "status": "ok",
            "generated": 0,
            "message": "Generation skipped or failed",
            "module": DIAGNOSIS_MODULE_TITLE
        }
