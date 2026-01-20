"""
Chat and module content routes for the patient assistant.
"""
import time

from fastapi import APIRouter, Depends, HTTPException

from adk_app.core.dependencies import AgentRuntime, get_runtime
from adk_app.models.requests import AskRequest, ModuleContentRequest, PreGenerateModulesRequest
from adk_app.models.responses import AskResponse, ModuleContentResponse
from adk_app.orchestration.pipeline import ContextPackage, prepare_context
from adk_app.services.chat_service import generate_answer_with_history
from adk_app.services.module_service import (
    normalize_module_title,
    get_missing_modules,
    generate_and_save_missing,
)
from adk_app.utils.data_loader import (
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
    try:
        patient = get_patient_data(payload.patient_id)
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
        question=payload.question,
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
        question=payload.question,
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
        payload.question,
        answer,
        suggestions,
        blocks
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
    """Get or generate personalized module content for a patient."""
    raw_title = payload.module_title or ""
    key = normalize_module_title(raw_title)

    print(f"[ModuleContent] REQUEST - module_title='{raw_title}' normalized_key='{key}' patient_id={payload.patient_id}")

    try:
        patient = get_patient_data(payload.patient_id)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err

    # Debug patient structure
    extra = patient.get("extra")
    module_content_top = patient.get("module_content")
    print(f"[ModuleContent] PATIENT EXTRA TYPE: {type(extra)} keys={list(extra.keys()) if isinstance(extra, dict) else 'n/a'}")
    print(f"[ModuleContent] PATIENT module_content type: {type(module_content_top)} keys={list(module_content_top.keys()) if isinstance(module_content_top, dict) else 'n/a'}")

    # Check for cached content
    print("[ModuleContent] CACHE CHECK - Looking for cached content...")
    print(f"[ModuleContent] CACHE CHECK - extra exists: {extra is not None and isinstance(extra, dict)}")

    # Prefer top-level module_content; fallback to extra.module_content
    module_cache = None
    if isinstance(module_content_top, dict):
        module_cache = module_content_top
        print("[ModuleContent] CACHE CHECK - using top-level module_content")
    elif isinstance(extra, dict) and isinstance(extra.get("module_content"), dict):
        module_cache = extra.get("module_content")
        print("[ModuleContent] CACHE CHECK - using extra.module_content")
    else:
        print(f"[ModuleContent] CACHE CHECK - module_content missing or not dict (top-level={isinstance(module_content_top, dict)}, extra_has={isinstance(extra, dict) and isinstance(extra.get('module_content'), dict)})")

    if isinstance(module_cache, dict):
        print(f"[ModuleContent] CACHE CHECK - Available keys in cache: {list(module_cache.keys())}")
        print(f"[ModuleContent] CACHE CHECK - Looking for key: '{raw_title}' or '{key}'")

        cached = module_cache.get(raw_title)
        if cached:
            print(f"[ModuleContent] ✓ CACHE HIT (raw_title) - Found content for '{raw_title}'")
            return ModuleContentResponse(**cached)

        cached = module_cache.get(key)
        if cached:
            print(f"[ModuleContent] ✓ CACHE HIT (normalized_key) - Found content for '{key}'")
            return ModuleContentResponse(**cached)

        print(f"[ModuleContent] ✗ CACHE MISS - No content found for '{raw_title}' or '{key}'")

    # If missing, batch-generate all missing modules to avoid duplicate calls
    missing, module_cache = get_missing_modules(patient, module_cache)
    print(f"[ModuleContent] GENERATING batch for missing={missing}")
    generate_and_save_missing(payload.patient_id, patient, missing, runtime.config)

    # Reload cache for this patient after save
    patient = get_patient_data(payload.patient_id)
    module_cache = patient.get("module_content") if isinstance(patient.get("module_content"), dict) else {}

    cached = module_cache.get(raw_title) or module_cache.get(key)
    if cached:
        print(f"[ModuleContent] ✓ CACHE HIT after batch - Found content for '{raw_title}'")
        return ModuleContentResponse(**cached)

    print(f"[ModuleContent] ✗ CACHE MISS after batch for '{raw_title}' (unexpected)")
    raise HTTPException(status_code=500, detail="Failed to generate module content")


@router.post("/pregenerate-modules")
def pregenerate_modules_endpoint(
    payload: PreGenerateModulesRequest,
    runtime: AgentRuntime = Depends(get_runtime),
) -> dict:
    """Pre-generate all module content for a patient."""
    from adk_app.core.config import MODULE_TITLES

    try:
        patient = get_patient_data(payload.patient_id)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err

    missing, module_cache = get_missing_modules(patient)
    if not missing:
        return {"status": "ok", "generated": 0, "missing": [], "skipped": len(MODULE_TITLES)}

    print(f"[ModuleContent] Pregen start patient={payload.patient_id} missing={missing}")
    saved = generate_and_save_missing(payload.patient_id, patient, missing, runtime.config)
    print(f"[ModuleContent] Pregen done patient={payload.patient_id} saved={saved}")
    return {"status": "ok", "generated": len(saved), "missing": missing, "saved": saved}
