from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Dict, Optional


@dataclass(frozen=True)
class RouterSummary:
    needs_general_kb: bool = True
    needs_clinic_kb: bool = False
    needs_patient_data: bool = False
    topics: tuple[str, ...] = ("GENERAL",)
    is_emergency: bool = False
    rationale: str = "No rationale supplied."


def parse_router_payload(router_output: str | Dict) -> RouterSummary:
    """Normalize router output (string or dict) into RouterSummary."""
    if isinstance(router_output, dict):
        data = router_output
    else:
        data = {}
        if router_output:
            try:
                start = router_output.find("{")
                if start != -1:
                    data = json.loads(router_output[start:])
            except json.JSONDecodeError:
                pass
    return RouterSummary(
        needs_general_kb=bool(data.get("needs_general_kb", True)),
        needs_clinic_kb=bool(data.get("needs_clinic_kb")),
        needs_patient_data=bool(data.get("needs_patient_data")),
        topics=tuple(str(topic).upper() for topic in data.get("topics", []) or ["GENERAL"]),
        is_emergency=bool(data.get("is_emergency")),
        rationale=data.get("rationale") or data.get("reasoning") or "No rationale supplied.",
    )


def build_prompt_block(
    question: str,
    router_output: str | Dict,
    general_context: Optional[str] = None,
    clinic_context: Optional[str] = None,
    patient_context: Optional[str] = None,
) -> str:
    """Builds a formatted context block for the agent to reference."""
    summary = parse_router_payload(router_output)
    sections = [
        "=== SAFETY & EMPATHY MANDATES ===",
        "- Use calm, reassuring language tailored to cataract patients.",
        "- Highlight red flags and instruct patients to contact their surgeon if emergencies are suspected.",
        "- Respect privacy: only mention clinic or patient details already provided.",
        "- Cite the relevant context section when giving factual answers.",
        "",
        "=== ROUTER SUMMARY ===",
        f"- needs_general_kb: {summary.needs_general_kb}",
        f"- needs_clinic_kb: {summary.needs_clinic_kb}",
        f"- needs_patient_data: {summary.needs_patient_data}",
        f"- topics: {', '.join(summary.topics)}",
        f"- is_emergency: {summary.is_emergency}",
        f"- rationale: {summary.rationale}",
    ]

    if summary.is_emergency:
        sections.append(
            "\n!!! Emergency detected: instruct the user to contact emergency services or their surgeon immediately."
        )

    if general_context:
        sections.extend(["", "=== GENERAL CONTEXT ===", general_context.strip()])
    if clinic_context:
        sections.extend(["", "=== CLINIC CONTEXT ===", clinic_context.strip()])
    if patient_context:
        sections.extend(["", "=== PATIENT CONTEXT ===", patient_context.strip()])

    sections.extend(
        [
            "",
            "=== USER QUESTION ===",
            question.strip(),
            "",
            "Use the above context to answer empathetically. If information is missing, say so explicitly.",
        ]
    )
    return "\n".join(sections)



