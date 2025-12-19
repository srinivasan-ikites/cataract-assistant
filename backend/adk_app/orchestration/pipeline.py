from __future__ import annotations

from dataclasses import dataclass
from time import perf_counter
from typing import Dict, Optional
import json

from adk_app.prompting.prompt_builder import build_prompt_block, parse_router_payload
from adk_app.tools.general_kb_tool import general_kb_search_tool
from adk_app.tools.router_tool import router_tool
from adk_app.utils.data_loader import get_patient_data, get_clinic_data


@dataclass
class ContextPackage:
    question: str
    prompt: str
    router_summary: Dict
    general_context: Optional[str]
    clinic_context: Optional[str]
    patient_context: Optional[str]
    media: Optional[list] = None
    sources: Optional[list] = None


def _log_latency(label: str, duration_ms: float, executed: bool = True) -> None:
    suffix = "" if executed else " (skipped)"
    print(f"[Latency] {label}: {duration_ms:.2f} ms{suffix}")


def prepare_context(
    question: str,
    clinic_id: Optional[str] = None,
    patient_id: Optional[str] = None,
) -> ContextPackage:
    """Run the full RAG orchestration pipeline for a question."""
    print(f"\n[Pipeline] question='{question}' clinic={clinic_id} patient={patient_id}")

    overall_start = perf_counter()
    patient_record = None
    derived_clinic_id = clinic_id
    patient_lookup_ms = 0.0
    if patient_id:
        lookup_start = perf_counter()
        try:
            patient_record = get_patient_data(patient_id)
            if not derived_clinic_id:
                derived_clinic_id = patient_record.get("clinic_id")
        except ValueError as exc:
            print(f"[Pipeline] patient lookup failed: {exc}")
        finally:
            patient_lookup_ms = (perf_counter() - lookup_start) * 1000
    _log_latency("patient_lookup_ms", patient_lookup_ms, executed=bool(patient_id))

    # --- Parallel Execution Start ---
    # Start Router and Optimistic Embedding in parallel to hide embedding latency.
    # We use ThreadPoolExecutor because the tools make synchronous API calls.
    import concurrent.futures
    from adk_app.services.embedding_service import embed_query

    router_start = perf_counter()
    router_output = None
    speculative_vector = None
    speculative_embedding_future = None
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        # 1. Start Router LLM
        router_future = executor.submit(
            router_tool,
            question=question,
            clinic_id=derived_clinic_id,
            patient_id=patient_id,
        )
        # 2. Start Embedding (Speculative) - most queries need KB anyway
        embedding_future = executor.submit(embed_query, question)
        
        # 3. Wait for Router first (it drives the logic)
        router_output = router_future.result()
        speculative_embedding_future = embedding_future # keep handle to wait later if needed

    router_ms = (perf_counter() - router_start) * 1000
    _log_latency("router_llm_ms", router_ms)

    summary = parse_router_payload(router_output)
    print(
        "[Router Decision] general="
        f"{summary.needs_general_kb} clinic={summary.needs_clinic_kb} "
        f"patient={summary.needs_patient_data} topics={list(summary.topics)} "
        f"emergency={summary.is_emergency}"
    )

    general_context = None
    media_items = []  # Collect media from general KB
    source_items = []
    general_ms = 0.0
    if summary.needs_general_kb:
        general_start = perf_counter()
        
        # Use the speculative embedding if ready, or wait for it
        try:
             speculative_vector = speculative_embedding_future.result()
             # print(f"[Pipeline] Speculative embedding used. Ready instantly? {speculative_embedding_future.done()}")
        except Exception as e:
             print(f"[Pipeline] Speculative embedding failed: {e}")
             speculative_vector = None

        result = general_kb_search_tool(
            query=question, 
            topics=list(summary.topics), 
            vector=speculative_vector # Pass pre-computed vector
        )
        if isinstance(result, dict):
            general_context = result.get("context_text")
        media_items = result.get("media", [])
        if "sources" in result:
            source_items = result.get("sources", [])
        else:
            # Backward safety: if tool returns a string
            general_context = str(result)
            media_items = []
        general_ms = (perf_counter() - general_start) * 1000
    _log_latency("general_kb_ms", general_ms, executed=summary.needs_general_kb)

    clinic_context = None
    clinic_ms = 0.0
    if summary.needs_clinic_kb and derived_clinic_id:
        clinic_start = perf_counter()
        try:
            clinic_record = get_clinic_data(derived_clinic_id)
            clinic_context = json.dumps(clinic_record.get("extra") or clinic_record, indent=2)
        except Exception as exc:
            print(f"[Pipeline] clinic context failed for {derived_clinic_id}: {exc}")
        finally:
            clinic_ms = (perf_counter() - clinic_start) * 1000
    _log_latency(
        "clinic_context_ms",
        clinic_ms,
        executed=bool(summary.needs_clinic_kb and derived_clinic_id),
    )

    patient_context = None
    patient_context_ms = 0.0
    if summary.needs_patient_data and patient_id:
        patient_context_start = perf_counter()
        try:
            if patient_record:
                patient_context = json.dumps(patient_record.get("extra") or patient_record, indent=2)
        except Exception as exc:
            print(f"[Pipeline] patient context failed for {patient_id}: {exc}")
        finally:
            patient_context_ms = (perf_counter() - patient_context_start) * 1000
    _log_latency(
        "patient_context_ms",
        patient_context_ms,
        executed=bool(summary.needs_patient_data and patient_id),
    )

    prompt_start = perf_counter()
    print("\n\n ###################################")
    print("\n[Pipeline] prompt_start")
    print("\n\n ###################################")
    prompt = build_prompt_block(
        question=question,
        router_output={"needs_general_kb": summary.needs_general_kb,
                       "needs_clinic_kb": summary.needs_clinic_kb,
                       "needs_patient_data": summary.needs_patient_data,
                       "topics": list(summary.topics),
                       "is_emergency": summary.is_emergency,
                       "rationale": summary.rationale},
        general_context=general_context,
        clinic_context=clinic_context,
        patient_context=patient_context
    )
    prompt_ms = (perf_counter() - prompt_start) * 1000
    _log_latency("prompt_builder_ms", prompt_ms)

    total_ms = (perf_counter() - overall_start) * 1000
    _log_latency("orchestration_total_ms", total_ms)

    return ContextPackage(
        question=question,
        prompt=prompt,
        router_summary={
            "needs_general_kb": summary.needs_general_kb,
            "needs_clinic_kb": summary.needs_clinic_kb,
            "needs_patient_data": summary.needs_patient_data,
            "topics": list(summary.topics),
            "is_emergency": summary.is_emergency,
            "rationale": summary.rationale,
        },
        general_context=general_context,
        clinic_context=clinic_context,
        patient_context=patient_context,
        media=media_items,
        sources=source_items,
    )
