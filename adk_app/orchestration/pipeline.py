from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional

from adk_app.prompting.prompt_builder import build_prompt_block, parse_router_payload
from adk_app.tools.context_tools import clinic_context_tool, patient_context_tool
from adk_app.tools.general_kb_tool import general_kb_search_tool
from adk_app.tools.router_tool import router_tool
from adk_app.utils.data_loader import get_patient_data


@dataclass
class ContextPackage:
    question: str
    prompt: str
    router_summary: Dict
    general_context: Optional[str]
    clinic_context: Optional[str]
    patient_context: Optional[str]


def prepare_context(
    question: str,
    clinic_id: Optional[str] = None,
    patient_id: Optional[str] = None,
) -> ContextPackage:
    """Run the full RAG orchestration pipeline for a question."""
    print(f"\n[Pipeline] question='{question}' clinic={clinic_id} patient={patient_id}")

    patient_record = None
    derived_clinic_id = clinic_id
    if patient_id:
        try:
            patient_record = get_patient_data(patient_id)
            if not derived_clinic_id:
                derived_clinic_id = patient_record.get("clinic_id")
        except ValueError as exc:
            print(f"[Pipeline] patient lookup failed: {exc}")

    router_output = router_tool(
        question=question,
        clinic_id=derived_clinic_id,
        patient_id=patient_id,
    )
    summary = parse_router_payload(router_output)
    print(
        "[Router Decision] general="
        f"{summary.needs_general_kb} clinic={summary.needs_clinic_kb} "
        f"patient={summary.needs_patient_data} topics={list(summary.topics)} "
        f"emergency={summary.is_emergency}"
    )

    general_context = None
    if summary.needs_general_kb:
        general_context = general_kb_search_tool(query=question, topics=list(summary.topics))

    clinic_context_parts: list[str] = []
    if summary.needs_clinic_kb and derived_clinic_id:
        try:
            if {"INSURANCE"} & set(summary.topics):
                clinic_context_parts.append(
                    clinic_context_tool(clinic_id=derived_clinic_id, info_type="insurance")
                )
            if {"LENSES"} & set(summary.topics):
                clinic_context_parts.append(
                    clinic_context_tool(clinic_id=derived_clinic_id, info_type="packages")
                )
            if not clinic_context_parts:
                clinic_context_parts.append(
                    clinic_context_tool(clinic_id=derived_clinic_id, info_type="overview")
                )
        except Exception as exc:
            print(f"[Pipeline] clinic context failed for {derived_clinic_id}: {exc}")
    clinic_context = "\n\n".join(clinic_context_parts) if clinic_context_parts else None

    patient_context_parts: list[str] = []
    if summary.needs_patient_data and patient_id:
        try:
            patient_context_parts.append(
                patient_context_tool(patient_id=patient_id, info_type="summary")
            )
            if {"LENSES", "SURGERY"} & set(summary.topics):
                patient_context_parts.append(
                    patient_context_tool(patient_id=patient_id, info_type="lens_plan")
                )
            if {"INSURANCE"} & set(summary.topics):
                patient_context_parts.append(
                    patient_context_tool(patient_id=patient_id, info_type="insurance")
                )
        except Exception as exc:
            print(f"[Pipeline] patient context failed for {patient_id}: {exc}")
    patient_context = "\n\n".join(patient_context_parts) if patient_context_parts else None

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
        patient_context=patient_context,
    )

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
    )



