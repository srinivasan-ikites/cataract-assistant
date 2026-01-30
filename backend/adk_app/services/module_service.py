"""
Module content generation service for patient education modules.

OPTIMIZED: Only generates "My Diagnosis" module via LLM.
Other modules use static content or templates with dynamic data insertion.

Updated to use Supabase instead of JSON files.
"""
from __future__ import annotations

import json
import os
import traceback
from typing import Optional

import litellm
from fastapi import HTTPException

from adk_app.config import ModelConfig
# Note: MODULE_TITLES kept for reference but only "My Diagnosis" is LLM-generated
from adk_app.core.config import MODULE_TITLES
# Use Supabase data loader
from adk_app.utils.supabase_data_loader import save_patient_module_content, clear_patient_cache, get_patient_data


# The only module that requires LLM generation
DIAGNOSIS_MODULE_TITLE = "My Diagnosis"


def normalize_module_title(title: str) -> str:
    """Normalize module title for storage/lookup."""
    return (title or "").strip().lower()


def get_diagnosis_fields(patient: dict) -> dict:
    """
    Extract diagnosis-related fields from patient data.

    The v2 schema stores pathology per-eye:
    - clinical_context.od_right.pathology
    - clinical_context.os_left.pathology
    """
    clinical_context = patient.get("clinical_context", {}) or {}

    # Extract per-eye pathology (v2 schema)
    od_right = clinical_context.get("od_right", {}) or {}
    os_left = clinical_context.get("os_left", {}) or {}

    od_pathology = od_right.get("pathology", "")
    os_pathology = os_left.get("pathology", "")

    # Also check legacy single-field locations
    legacy_diagnosis = clinical_context.get("diagnosis", {}) or {}
    if not legacy_diagnosis:
        legacy_diagnosis = clinical_context.get("primary_diagnosis", {}) or {}

    return {
        "od_pathology": od_pathology,
        "os_pathology": os_pathology,
        "type": legacy_diagnosis.get("type", ""),
        "pathology": legacy_diagnosis.get("pathology", ""),
    }


def has_diagnosis_changed(old_patient: dict, new_patient: dict) -> bool:
    """
    Check if diagnosis fields have changed between old and new patient data.

    Checks per-eye pathology (v2 schema) and legacy fields.
    """
    old_diagnosis = get_diagnosis_fields(old_patient)
    new_diagnosis = get_diagnosis_fields(new_patient)

    # Check per-eye pathology (primary fields in v2 schema)
    od_changed = old_diagnosis.get("od_pathology") != new_diagnosis.get("od_pathology")
    os_changed = old_diagnosis.get("os_pathology") != new_diagnosis.get("os_pathology")

    # Also check legacy fields
    type_changed = old_diagnosis.get("type") != new_diagnosis.get("type")
    pathology_changed = old_diagnosis.get("pathology") != new_diagnosis.get("pathology")

    if od_changed or os_changed or type_changed or pathology_changed:
        print(f"[ModuleService] Diagnosis changed: OD={od_changed}, OS={os_changed}, type={type_changed}, pathology={pathology_changed}")
        print(f"[ModuleService] Old: {old_diagnosis}")
        print(f"[ModuleService] New: {new_diagnosis}")
        return True

    return False


def should_generate_diagnosis_module(patient: dict, force: bool = False) -> bool:
    """
    Determine if "My Diagnosis" module should be generated.

    Returns True if:
    - force=True (explicit regeneration request)
    - module_content is empty or missing
    - "My Diagnosis" module is missing
    """
    if force:
        return True

    module_content = patient.get("module_content", {})
    if not isinstance(module_content, dict) or not module_content:
        return True

    # Check if "My Diagnosis" exists (try both normalized and original keys)
    diagnosis_key = normalize_module_title(DIAGNOSIS_MODULE_TITLE)
    has_diagnosis = (
        DIAGNOSIS_MODULE_TITLE in module_content or
        diagnosis_key in module_content
    )

    return not has_diagnosis


def get_missing_modules(patient: dict, module_cache: dict | None = None) -> tuple[list[str], dict]:
    """
    Return (missing_titles, module_cache) for the patient.

    NOTE: This now only checks for "My Diagnosis" module since other modules
    are static and don't need LLM generation.
    """
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

    # Only check for "My Diagnosis" - other modules are static
    missing = []
    if not has_module(DIAGNOSIS_MODULE_TITLE):
        missing.append(DIAGNOSIS_MODULE_TITLE)

    return missing, module_cache


def generate_diagnosis_module_content(patient: dict, config: ModelConfig) -> dict:
    """
    Generate content for "My Diagnosis" module only.

    This is the only module that requires LLM generation.
    Passes full patient context sections as JSON for personalization.
    Returns a dict with the module content.
    """
    model_ref = (
        f"{config.provider}/{config.model}" if config.provider != "gemini" else f"gemini/{config.model}"
    )

    # Get the main sections directly - pass as JSON to LLM
    patient_identity = patient.get("patient_identity", {}) or {}
    medical_profile = patient.get("medical_profile", {}) or {}
    clinical_context = patient.get("clinical_context", {}) or {}
    lifestyle_profile = patient.get("lifestyle_profile", {}) or {}

    # Also check for 'name' field (legacy format)
    name_obj = patient.get("name", {}) or {}

    # Get first name for fallback reference (LLM will use JSON data primarily)
    first_name = (
        patient_identity.get("first_name") or
        name_obj.get("first") or
        patient.get("first_name") or
        ""
    ).strip()

    # Get pathology for logging and fallback
    od_right = clinical_context.get("od_right", {}) or {}
    os_left = clinical_context.get("os_left", {}) or {}
    od_pathology = od_right.get("pathology", "")
    os_pathology = os_left.get("pathology", "")

    print(f"[ModuleService] Generating diagnosis module")
    print(f"[ModuleService] Patient identity: {json.dumps(patient_identity)}")
    print(f"[ModuleService] Name object: {json.dumps(name_obj)}")
    print(f"[ModuleService] First name extracted: '{first_name}'")
    print(f"[ModuleService] OD pathology: {od_pathology}")
    print(f"[ModuleService] OS pathology: {os_pathology}")

    # Convert sections to JSON strings for the prompt
    patient_identity_json = json.dumps(patient_identity, indent=2)
    medical_profile_json = json.dumps(medical_profile, indent=2)
    clinical_context_json = json.dumps(clinical_context, indent=2)
    lifestyle_profile_json = json.dumps(lifestyle_profile, indent=2)

    # Also include legacy name field if present
    name_json = json.dumps(name_obj, indent=2) if name_obj else "{}"

    system_prompt = """You are a cataract surgery counselling assistant helping elderly patients understand their diagnosis.

CRITICAL RULES:
- Be direct and specific - patients already know they have cataracts, explain the TYPE
- Find the patient's first name from patient_identity.first_name OR name.first
- Only use data actually present in the provided context
- Use **bold** for medical terms
- Keep language simple and easy to understand

CATARACT TYPES (identify from pathology):
- Nuclear Sclerosis: Yellowing/hardening of lens center
- Cortical Cataract: Spoke-like opacities from lens edge
- Posterior Subcapsular: Clouding at back of lens
- Combined/Senile Cataract: Multiple types present
- Congenital Cataract: Present from birth

Return ONLY valid JSON matching the exact schema."""

    user_prompt = f"""Generate structured diagnosis content for the patient.

=== PATIENT IDENTITY ===
{patient_identity_json}

=== PATIENT NAME (ALTERNATE FORMAT) ===
{name_json}

=== MEDICAL PROFILE ===
{medical_profile_json}

=== CLINICAL CONTEXT ===
{clinical_context_json}

=== LIFESTYLE PROFILE ===
{lifestyle_profile_json}

=== TASK ===

Analyze the pathology for each eye (od_right.pathology and os_left.pathology) and generate:

1. **primary_diagnosis_type**: Determine the overall diagnosis type:
   - If patient has multiple cataract types → "Combined form of senile cataract"
   - If only nuclear sclerosis → "Nuclear Sclerosis"
   - If only cortical → "Cortical Cataract"
   - If only posterior subcapsular → "Posterior Subcapsular Cataract"
   - Match to patient's actual condition

2. **cataract_types**: Array of specific cataract types found (for display as tags)
   - e.g., ["Nuclear sclerosis", "Cortical"] or ["Posterior subcapsular"]

3. **eyes_same_condition**: Boolean - true if both eyes have similar conditions, false if different

4. **right_eye** and **left_eye**: Per-eye details
   - Only include if that eye has a condition
   - Include: condition name, severity if mentioned, brief description

5. **summary**: Direct, concise explanation (2-3 sentences max)
   - Address patient by first name
   - State the specific diagnosis type
   - Briefly explain what it means for their vision
   - NO fluff like "I want to gently explain..."

6. **additional_conditions**: Array of non-cataract conditions (separate from main diagnosis)
   - e.g., ["Dry Eye Syndrome", "Myopia", "Glaucoma"]
   - Extract from ocular_comorbidities and pathology text

7. **faqs**: 3-4 questions specific to THEIR cataract type

Return JSON in this EXACT format:
{{
  "title": "My Diagnosis",
  "primary_diagnosis_type": "Combined form of senile cataract",
  "cataract_types": ["Nuclear sclerosis", "Cortical"],
  "eyes_same_condition": false,
  "right_eye": {{
    "condition": "2+ nuclear sclerosis, 1+ cortical",
    "description": "Your right eye has moderate nuclear sclerosis (yellowing in the center of the lens) and mild cortical cataract (clouding around the edges)."
  }},
  "left_eye": {{
    "condition": "1+ nuclear sclerosis, 2+ cortical",
    "description": "Your left eye has mild nuclear sclerosis and moderate cortical cataract."
  }},
  "summary": "You have **Combined form of senile cataract**, [Name]. Specifically, you have both **nuclear sclerosis** and **cortical** cataracts affecting your eyes. This means the natural lenses in your eyes have become cloudy in multiple areas, causing blurred vision, faded colors, and difficulty with glare.",
  "additional_conditions": ["Dry Eye Syndrome", "Myopia"],
  "faqs": [
    {{"question": "What is nuclear sclerosis?", "answer": "Nuclear sclerosis is when the center of your eye's lens gradually yellows and hardens. This is the most common type of age-related cataract and can make colors appear faded or yellowish."}},
    {{"question": "What is a cortical cataract?", "answer": "Cortical cataracts form as white, wedge-shaped opacities that start at the outer edge of your lens and work their way inward. They can cause glare and difficulty with contrast."}},
    {{"question": "Why do I have multiple types?", "answer": "It's common to have more than one type of cataract, especially as we age. This is called a combined or senile cataract. The good news is that surgery effectively treats all types at once."}},
    {{"question": "Will surgery fix both types?", "answer": "Yes! During cataract surgery, the entire cloudy lens is removed and replaced with a clear artificial lens. This treats all types of cataract in that eye at once."}}
  ],
  "videoScriptSuggestion": "Video explaining combined cataracts and how surgery helps",
  "botStarterPrompt": "Tell me more about my cataract diagnosis"
}}"""

    try:
        print(f"[ModuleContent] Calling LLM: model={model_ref}, temperature={config.temperature}")
        response = litellm.completion(
            model=model_ref,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=config.temperature,
        )
        print(f"[ModuleContent] LLM call successful")
    except Exception as exc:
        error_type = type(exc).__name__
        print(f"[ModuleContent] Diagnosis generation FAILED: {error_type}: {exc}")
        # Check for common API key issues
        error_str = str(exc).lower()
        if "api key" in error_str or "authentication" in error_str or "unauthorized" in error_str:
            print(f"[ModuleContent] This looks like an API KEY issue - check environment variables!")
        elif "timeout" in error_str:
            print(f"[ModuleContent] This looks like a TIMEOUT issue - LLM call took too long")
        elif "rate limit" in error_str or "quota" in error_str:
            print(f"[ModuleContent] This looks like a RATE LIMIT issue")
        raise HTTPException(status_code=500, detail=f"Failed to generate diagnosis content: {error_type}") from exc

    try:
        content_text = response["choices"][0]["message"]["content"]
        cleaned = content_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`").strip()
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].strip()
        parsed = json.loads(cleaned)

        # Ensure required fields exist
        if not isinstance(parsed, dict):
            raise ValueError("Parsed response is not a dict")

        # Add defaults for any missing fields
        friendly_name = first_name or "there"
        parsed.setdefault("title", DIAGNOSIS_MODULE_TITLE)
        parsed.setdefault("summary", f"Hello {friendly_name}, you have **{od_pathology or os_pathology or 'cataracts'}**. This is a treatable condition.")
        parsed.setdefault("details", [])
        parsed.setdefault("faqs", [])
        parsed.setdefault("videoScriptSuggestion", "")
        parsed.setdefault("botStarterPrompt", "Tell me more about my diagnosis")

        return parsed

    except Exception as exc:
        print(f"[ModuleContent] Diagnosis parse error: {exc}")
        # Return fallback content with personalization
        friendly_name = first_name or "there"
        primary_pathology = od_pathology or os_pathology or "cataract"

        diagnosis_desc = f"{od_pathology} (right eye)" if od_pathology else ""
        if os_pathology:
            diagnosis_desc += f" and {os_pathology} (left eye)" if diagnosis_desc else f"{os_pathology} (left eye)"
        if not diagnosis_desc:
            diagnosis_desc = "cataracts"

        return {
            "title": DIAGNOSIS_MODULE_TITLE,
            "summary": f"Hello {friendly_name}, you have **{diagnosis_desc}**. This is a type of cataract that affects your vision. The good news is that cataract surgery can restore your clear vision.",
            "details": [
                f"Your diagnosis: {diagnosis_desc}",
                "Cataracts cause the lens in your eye to become cloudy",
                "Surgery replaces the cloudy lens with a clear artificial lens",
                "Most patients see significant improvement after surgery"
            ],
            "faqs": [
                {
                    "question": f"What is {primary_pathology}?",
                    "answer": f"{primary_pathology} is a type of cataract where the lens of your eye becomes cloudy, making your vision blurry or hazy."
                },
                {
                    "question": "Is cataract surgery safe?",
                    "answer": "Yes, cataract surgery is one of the most common and safest procedures performed. Millions of people have this surgery every year with excellent results."
                }
            ],
            "videoScriptSuggestion": f"Video explaining {primary_pathology}",
            "botStarterPrompt": "Tell me more about my diagnosis"
        }


def generate_and_save_diagnosis(patient_id: str, patient: dict, config: ModelConfig, clinic_id: str = None) -> bool:
    """
    Generate and save the "My Diagnosis" module for a patient.

    Returns True if successfully generated and saved, False otherwise.
    """
    try:
        print(f"[ModuleService] Generating diagnosis module for patient: {patient_id}, clinic: {clinic_id}")

        # Generate the diagnosis content
        content = generate_diagnosis_module_content(patient, config)

        # Save with normalized key - pass clinic_id for unique lookup
        key = normalize_module_title(DIAGNOSIS_MODULE_TITLE)
        save_patient_module_content(patient_id, key, content, clinic_id=clinic_id)

        print(f"[ModuleService] Saved diagnosis module for patient: {patient_id}")
        return True

    except Exception as exc:
        print(f"[ModuleService] Failed to generate/save diagnosis module: {exc}")
        traceback.print_exc()
        return False


def generate_diagnosis_if_needed(
    patient_id: str,
    patient: dict,
    config: ModelConfig,
    old_patient: dict = None,
    force: bool = False,
    clinic_id: str = None
) -> bool:
    """
    Generate "My Diagnosis" module if needed.

    Generates if:
    - force=True
    - Module doesn't exist
    - Diagnosis fields changed (if old_patient provided)

    Returns True if generation was triggered, False if skipped.
    """
    # Check if module exists
    needs_generation = should_generate_diagnosis_module(patient, force=force)

    # If module exists and we have old data, check if diagnosis changed
    if not needs_generation and old_patient is not None:
        if has_diagnosis_changed(old_patient, patient):
            print(f"[ModuleService] Diagnosis changed, will regenerate module")
            needs_generation = True

    if not needs_generation:
        print(f"[ModuleService] Diagnosis module exists and unchanged, skipping generation")
        return False

    return generate_and_save_diagnosis(patient_id, patient, config, clinic_id=clinic_id)


def validate_llm_api_keys(config: ModelConfig) -> tuple[bool, str]:
    """
    Validate that the required API key is set for the configured provider.
    Returns (is_valid, error_message).
    """
    provider = config.provider.lower()

    if provider == "gemini":
        key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not key:
            return False, "GOOGLE_API_KEY or GEMINI_API_KEY not set"
    elif provider == "openai":
        key = os.getenv("OPENAI_API_KEY")
        if not key:
            return False, "OPENAI_API_KEY not set"
    elif provider == "claude" or provider == "anthropic":
        key = os.getenv("ANTHROPIC_API_KEY")
        if not key:
            return False, "ANTHROPIC_API_KEY not set"
    else:
        return False, f"Unknown provider: {provider}"

    return True, ""


def generate_modules_background(
    patient_id: str,
    config: ModelConfig,
    old_patient: dict = None,
    force: bool = False,
    clinic_id: str = None
) -> None:
    """
    Background task to generate "My Diagnosis" module for a patient.
    Called after doctor saves patient data.

    Only generates if:
    - Module is missing
    - Diagnosis fields changed (if old_patient provided)
    - force=True

    This runs asynchronously so the doctor doesn't have to wait.
    """
    try:
        print(f"[Background Module Gen] Starting for patient: {patient_id}, clinic: {clinic_id}")
        print(f"[Background Module Gen] Config: provider={config.provider}, model={config.model}")

        # Validate API keys before attempting generation
        is_valid, error_msg = validate_llm_api_keys(config)
        if not is_valid:
            print(f"[Background Module Gen] CRITICAL ERROR: {error_msg}")
            print(f"[Background Module Gen] Module generation will FAIL - please set environment variables")
            # Don't return - let it fail with a clear error so logs show the issue

        # Clear cache to get fresh patient data after save
        clear_patient_cache()

        # Get the patient data - use clinic_id for unique lookup
        patient = get_patient_data(patient_id, clinic_id=clinic_id)

        if not patient:
            print(f"[Background Module Gen] ERROR: Could not load patient data for {patient_id}")
            return

        # Generate diagnosis module if needed - pass clinic_id
        generated = generate_diagnosis_if_needed(
            patient_id=patient_id,
            patient=patient,
            config=config,
            old_patient=old_patient,
            force=force,
            clinic_id=clinic_id
        )

        if generated:
            print(f"[Background Module Gen] SUCCESS - Completed for patient: {patient_id}")
        else:
            print(f"[Background Module Gen] Skipped for patient: {patient_id} (already exists)")

    except Exception as exc:
        # Log error with full details - this is critical for debugging production issues
        print(f"[Background Module Gen] EXCEPTION for patient {patient_id}: {type(exc).__name__}: {exc}")
        traceback.print_exc()
        # Also log the config for debugging
        print(f"[Background Module Gen] Config was: provider={config.provider}, model={config.model}")


# Legacy function for backward compatibility with existing endpoints
def generate_and_save_missing(patient_id: str, patient: dict, missing_titles: list[str], config: ModelConfig) -> list[str]:
    """
    Generate missing modules and save them.

    NOTE: Now only generates "My Diagnosis" module. Other modules are static.
    """
    if not missing_titles:
        return []

    saved = []

    # Only generate "My Diagnosis" if it's in the missing list
    if DIAGNOSIS_MODULE_TITLE in missing_titles:
        if generate_and_save_diagnosis(patient_id, patient, config):
            saved.append(DIAGNOSIS_MODULE_TITLE)

    return saved
