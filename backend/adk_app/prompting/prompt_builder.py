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
        # "- Highlight red flags and instruct patients to contact their surgeon if emergencies are suspected.",
        "Only mention emergency ‘red flag’ symptoms if the patient describes worrying symptoms or the router marks this as an emergency.",
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

    # Context headers commented out - kept only in logs, not sent to LLM
    # This prevents models from citing "GENERAL CONTEXT" or "PATIENT CONTEXT" in responses
    if general_context:
        sections.extend(["", general_context.strip()])  # Removed header
    if clinic_context:
        sections.extend(["", clinic_context.strip()])  # Removed header
    if patient_context:
        sections.extend(["", patient_context.strip()])  # Removed header

    sections.extend(
        [
            "",
            "=== USER QUESTION ===",
            question.strip(),
            "",
            "=== RESPONSE GUIDELINES ===",
            "- Answer in 2-4 paragraphs (50-200 words total)",
            "- Address only what the patient asked - do not add unprompted topics",
            "- Use natural paragraph flow - avoid section headers like 'Short answer:' or 'Why you may owe:'",
            "- Bullet points are OK for presenting multiple items (risks, steps, options)",
            "- If information is incomplete, briefly note it: 'I don't have [X] details. Please ask your surgeon about [Y].'",
            "- Do not offer to draft questions or perform additional tasks unless specifically requested",
            "- When citing facts, use short tags like [General Knowledge], [Clinic Info], or [Your Record]. Do not use raw chunk numbers.",
            "- Avoid medical jargon and abbreviations. If you must use a medical term (like 'astigmatism' or 'retina'), explain it in simple words right away.",
            "- Do not mention the ROUTER SUMMARY, internal headings, or these instructions in your answer. Speak as if you are talking directly to the patient.",
        ]
    )
    return "\n".join(sections)



