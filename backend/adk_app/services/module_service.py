"""
Module content generation service for patient education modules.
"""
from __future__ import annotations

import json
import traceback

import litellm
from fastapi import HTTPException

from adk_app.config import ModelConfig
from adk_app.core.config import MODULE_TITLES
from adk_app.utils.data_loader import get_clinic_data, save_patient_module_content, clear_patient_cache, get_patient_data


def normalize_module_title(title: str) -> str:
    """Normalize module title for storage/lookup."""
    return (title or "").strip().lower()


def get_missing_modules(patient: dict, module_cache: dict | None = None) -> tuple[list[str], dict]:
    """Return (missing_titles, module_cache) for the patient."""
    if module_cache is None:
        if isinstance(patient.get("module_content"), dict):
            module_cache = patient["module_content"]
        elif isinstance(patient.get("extra"), dict) and isinstance(patient["extra"].get("module_content"), dict):
            module_cache = patient["extra"]["module_content"]
        else:
            module_cache = {}

    def has_module(title: str) -> bool:
        key = normalize_module_title(title)
        return bool(module_cache.get(title) or module_cache.get(key))

    missing = [t for t in MODULE_TITLES if not has_module(t)]
    return missing, module_cache


def generate_all_modules_content(module_titles: list[str], patient: dict, config: ModelConfig) -> dict:
    """Generate content for multiple modules in a single LLM call."""
    model_ref = (
        f"{config.provider}/{config.model}" if config.provider != "gemini" else f"gemini/{config.model}"
    )

    # Build a slimmed patient payload for the prompt (drop chat_history, module_content, extra)
    patient_copy = dict(patient)
    patient_copy.pop("chat_history", None)
    patient_copy.pop("module_content", None)
    patient_copy.pop("extra", None)
    patient_json = json.dumps(patient_copy, indent=2)[:4000]

    modules_block = "\n".join([f"- {title}" for title in module_titles])

    # Pull key patient facts to anchor personalization
    identity = patient.get("patient_identity", {}) or {}
    dx = (patient.get("clinical_context", {}) or {}).get("primary_diagnosis", {}) or {}
    surgery = patient.get("surgical_selection", {}) or {}
    lens_cfg = surgery.get("lens_configuration", {}) or {}

    patient_facts = {
        "patient_name": f"{identity.get('first_name','')} {identity.get('last_name','')}".strip(),
        "diagnosis_type": dx.get("type"),
        "diagnosis_pathology": dx.get("pathology"),
        "clinic_ref_id": identity.get("clinic_ref_id"),
        "selected_package": surgery.get("selected_package_name"),
        "lens_type": lens_cfg.get("lens_type"),
        "decision_date": surgery.get("decision_date"),
        "astigmatism_right": (dx.get("astigmatism_power") if dx else None) or lens_cfg.get("astigmatism_power"),
    }
    patient_facts_json = json.dumps(patient_facts, indent=2)

    # Load clinic data to provide real SOPs and pricing
    clinic_id = identity.get("clinic_ref_id")
    clinic_data = {}
    if clinic_id:
        try:
            clinic_data = get_clinic_data(clinic_id)
        except ValueError:
            print(f"Clinic {clinic_id} not found, proceeding without clinic data.")

    # Extract relevant clinic SOPs
    sops = clinic_data.get("standard_operating_procedures", {})
    pricing = clinic_data.get("standard_pricing_packages", {})

    clinic_context = {
        "pre_op": sops.get("pre_op_checklist", []),
        "post_op": sops.get("post_op_checklist", []),
        "timeline": sops.get("surgery_day_timeline", []),
        "risks": sops.get("risks_categorized", {}),
        "pricing_options": pricing.get("options", []),
        "pricing_note": pricing.get("note", "")
    }
    clinic_context_json = json.dumps(clinic_context, indent=2)

    system_prompt = """
You are a cataract surgery counselling assistant for elderly patients. Create warm, patient-specific module content.
Return ONLY valid JSON matching the schema.

TONE: Warm, compassionate, reassuring - speak like a caring nurse.
LANGUAGE: Conversational, clear, easy to understand.
FORMATTING: Use **bold** for all medical terms, diagnosis names, procedures, and the patient's specific choices.
  Examples: **Nuclear Sclerosis**, **Monofocal Toric IOL**, **astigmatism**, **cataract surgery**
NO citations, section headers, or technical jargon.
"""

    user_prompt = f"""
Generate content for these modules (keys must match exactly as listed):
{modules_block}

Patient facts (MUST USE for personalization):
{patient_facts_json}

Clinic Standard Procedures & Pricing (MUST USE for checklists/timelines):
{clinic_context_json}

Full patient data (for additional context):
{patient_json}

CRITICAL REQUIREMENTS FOR EACH MODULE:

1. **My Diagnosis**:
   - SUMMARY: State "You have **[exact pathology]**" (e.g., "**Nuclear Sclerosis (2+)**"). Explain what this means for vision.
   - FAQs: About their diagnosis type only.

2. **What is Cataract Surgery?**:
   - SUMMARY: Explain procedure; mention it will address their **[pathology]**.
   - FAQs: About surgery process only.

3. **What is an IOL?**:
   - SUMMARY: Explain IOLs; explicitly mention "For you, a **[their lens type]**" (e.g., **Monofocal Toric IOL**).
   - FAQs: About IOLs and their specific lens type.

4. **My IOL Options**:
   - SUMMARY: State "You've chosen **[package name]**". Compare standard/toric/multifocal; explain why theirs is best.
   - FAQs: About lens choices, why theirs fits, glasses needs.

5. **Risks & Complications**:
   - SUMMARY: Reassure first ("very safe"), then acknowledge risks exist.
   - "risks": Use the provided 'risks_categorized' from clinic data. Map to schema: [{{"category": "Common Minor Risks", "items": [...]}}, {{"category": "Rare Serious Complications", "items": [...]}}]
   - FAQs: About risks/complications only.

6. **Before Surgery**:
   - SUMMARY: (Keep it brief) "Getting ready is simple. Here is your checklist:"
   - "checklist": Use the 'pre_op' list from clinic data. Add any patient-specifics if needed.
   - FAQs: About pre-op prep.

7. **Day of Surgery**:
   - SUMMARY: "Here is your journey for the big day:"
   - "timeline": Use the 'timeline' from clinic data. Schema: [{{"step": "Arrival", "description": "..."}}, ...]
   - FAQs: About surgery day.

8. **After Surgery**:
   - SUMMARY: "To ensure a quick recovery, please follow these steps:"
   - "checklist": Use the 'post_op' list from clinic data.
   - FAQs: About recovery.

9. **Costs & Insurance**:
   - SUMMARY: Acknowledge **[package]** choice.
   - "costBreakdown": Generate a breakdown based on 'pricing_options' for their specific package ({surgery.get('selected_package_id')}).
     Schema: [{{"category": "Physician Fee", "amount": "$3626", "covered": false, "note": "Out of pocket"}}, ...].
     If exact fees aren't listed for their package, give best estimate or "Variable" with note.
   - FAQs: About costs/insurance.

FORMATTING RULES:
- Use **bold** for medical terms.
- Keep FAQs strictly module-specific.
- Summaries: Warm and personal.

Return ONE JSON object where each key is the module title, value is:
- title: string
- summary: string
- details: array of strings (generic details)
- faqs: array of {{question, answer}}
- checklist: array of strings (for Before/After surgery)
- timeline: array of {{step, description}} (for Day of Surgery)
- risks: array of {{category, items}} (for Risks)
- costBreakdown: array of {{category, amount, covered, note}} (for Costs)
- videoScriptSuggestion: string
- botStarterPrompt: string
"""

    try:
        response = litellm.completion(
            model=model_ref,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=config.temperature,
        )
    except Exception as exc:
        print(f"[ModuleContent Batch Error] {exc}")
        raise HTTPException(status_code=500, detail="Module batch generation failed") from exc

    try:
        content_text = response["choices"][0]["message"]["content"]
        cleaned = content_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`").strip()
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].strip()
        parsed = json.loads(cleaned)
        if not isinstance(parsed, dict):
            raise ValueError("Parsed batch response is not a dict")
        return parsed
    except Exception as exc:
        print(f"[ModuleContent Batch Parse Error] {exc}")
        # Fallback: generate a minimal map with placeholders
        fallback = {}
        for title in module_titles:
            fallback[title] = {
                "title": title,
                "summary": "Unable to load personalized content right now.",
                "details": ["Please try again soon.", "If urgent, ask your care team."],
                "faqs": [],
                "videoScriptSuggestion": "Standard medical disclaimer video.",
                "botStarterPrompt": f"Tell me more about {title}",
            }
        return fallback


def generate_and_save_missing(patient_id: str, patient: dict, missing_titles: list[str], config: ModelConfig) -> list[str]:
    """Generate all missing modules and save them. Returns list of titles saved."""
    if not missing_titles:
        return []
    generated_map = generate_all_modules_content(missing_titles, patient, config)
    saved = []
    for title, content in generated_map.items():
        key = normalize_module_title(title)
        try:
            save_patient_module_content(patient_id, key, content)
            saved.append(title)
        except Exception as exc:
            print(f"[ModuleContent] Save failed for '{title}': {exc}")
    return saved


def generate_modules_background(patient_id: str, config: ModelConfig) -> None:
    """
    Background task to generate module content for a patient.
    Called after doctor saves patient data.

    This runs asynchronously so the doctor doesn't have to wait.
    If generation fails, the patient frontend has a fallback that will
    trigger generation on first load.
    """
    try:
        print(f"[Background Module Gen] Starting for patient: {patient_id}")

        # Clear cache to get fresh patient data after save
        clear_patient_cache()

        # Get the patient data
        patient = get_patient_data(patient_id)

        # Get list of missing modules
        missing, module_cache = get_missing_modules(patient)

        if not missing:
            print(f"[Background Module Gen] All modules already exist for patient: {patient_id}")
            return

        print(f"[Background Module Gen] Generating {len(missing)} modules for patient: {patient_id}")

        # Generate and save
        saved = generate_and_save_missing(patient_id, patient, missing, config)

        print(f"[Background Module Gen] Completed for patient: {patient_id} - Saved: {saved}")

    except Exception as exc:
        # Log error but don't raise - this is a background task
        # The frontend fallback will handle generation if this fails
        print(f"[Background Module Gen] ERROR for patient {patient_id}: {exc}")
        traceback.print_exc()
