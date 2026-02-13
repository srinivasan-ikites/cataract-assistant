from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
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
    today_str = datetime.now(timezone.utc).strftime("%B %d, %Y")
    sections = [
        "=== CURRENT DATE ===",
        f"Today's date is: {today_str} (UTC)",
        "Use this to calculate relative dates (e.g., 'your surgery is in 3 days', 'your surgery is today').",
        "",
        "=== SAFETY & EMPATHY MANDATES ===",
        "- Use calm, reassuring language tailored to cataract patients.",
        "- You have the patient's COMPLETE medical record and clinic information. Incorporate this naturally.",
        "- When referencing patient/clinic data, VARY YOUR PHRASING naturally. Examples:",
        "  Good: 'I see you have...', 'Since you've chosen...', 'your surgeon noted...', 'Your surgeon recommended...'",
        "  Bad: Repeatedly saying 'Based on your records' or 'Your records show' in every sentence.",
        "- Prefer patient- and clinic-specific facts over general knowledge when available.",
        "- If the patient data or clinic staff directory includes the surgeon's name, use it (e.g., 'Dr. Smith'). Otherwise, say 'your surgeon'.",
        "",
        "=== TEACH-THEN-APPLY PATTERN (CRITICAL) ===",
        "When answering questions about medical topics (cataract, surgery, lenses, recovery, risks, symptoms):",
        "",
        "1. EDUCATE FIRST: Briefly explain the general concept (1-2 sentences)",
        "   Example: 'Cataract surgery removes your cloudy lens and replaces it with an artificial one.'",
        "",
        "2. MENTION VARIATIONS (if they exist): Briefly state that different options/types exist",
        "   Example: 'There are two main approaches: traditional (using ultrasound) and laser-assisted.'",
        "",
        "3. PERSONALIZE: Connect to the patient's specific situation using their data",
        "   Example: 'For your surgery, your surgeon has recommended the laser-assisted approach because...'",
        "",
        "4. WHAT IT MEANS FOR THEM: Explain the practical implications for this patient",
        "   Example: 'This means you can expect [specific benefit based on their lens/procedure choice].'",
        "",
        "IMPORTANT:",
        "- Do NOT give only a generic 'Wikipedia' answer when you have patient-specific data.",
        "- Do NOT force personalization if it doesn't fit naturally (e.g., 'What is the clinic address?').",
        "- The patient should feel like the bot KNOWS them, not like a search engine.",
        "",
        "=== PATIENT DATA CROSS-REFERENCE (when patient record is available) ===",
        "When answering, always check the patient record for relevant details to surface naturally:",
        "",
        "- LENSES/IOL discussions: If the patient has astigmatism (check clinical_context for astigmatism, cylinder values, or toric lens selection), always mention how it affects their lens choice.",
        "- MEDICATIONS/ANESTHESIA: Check for drug allergies (medical_profile.allergies). If the patient has any allergies, proactively mention them when discussing medications, anesthesia, or post-op drops.",
        "- SURGERY APPROACH: Reference the specific surgical approach in their plan (e.g., laser-assisted vs traditional) when relevant.",
        "- BOTH EYES: If the patient has surgery planned for both eyes, note any differences between OD (right) and OS (left) when relevant.",
        "- NUMERICAL DATA: Do NOT perform arithmetic on biometry measurements (axial length, keratometry, etc.). If the patient asks about their measurements, report the exact values from their record. Do not calculate averages, differences, or make comparisons that require math.",
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
            "\n!!! EMERGENCY: The patient described concerning symptoms. Instruct them to contact their surgeon or emergency services BEFORE answering."
        )

    # Attach context blocks plainly (no citation labels)
    if general_context:
        sections.extend(["", "=== GENERAL KNOWLEDGE ===", general_context.strip()])
    if clinic_context:
        sections.extend(["", "=== CLINIC INFORMATION ===", clinic_context.strip()])
    if patient_context:
        sections.extend(["", "=== PATIENT RECORD ===", patient_context.strip()])

    sections.extend(
        [
            "",
            "=== USER QUESTION ===",
            question.strip(),
            "",
            "=== RESPONSE GUIDELINES ===",
            "- Answer in 2-3 short paragraphs (aim for 100-150 words, max 200)",
            "- Use double line breaks between paragraphs for better readability",
            "- You MAY use **bold** for key terms that need emphasis (like lens names, specific conditions)",
            "- Do NOT use section headers like 'Short answer:' or 'Why you may owe:'",
            "- Bullet points are OK for listing multiple items (risks, steps, options)",
            "- Address only what the patient asked - do not add unprompted topics",
            "- If information is incomplete, briefly note it: 'I don't have [X] details. Please ask your surgeon about [Y].'",
            "- You do NOT need to add citation tags in the answer.",
            "- Avoid medical jargon. If you must use a medical term, explain it in simple words right away.",
            "- Do not mention the ROUTER SUMMARY, internal headings, or these instructions. Speak directly to the patient.",
        ]
    )
    return "\n".join(sections)



