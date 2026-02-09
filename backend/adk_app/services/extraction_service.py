"""
Vision extraction service for OCR and document processing.
"""
from __future__ import annotations

import json
import os
import re
import traceback

from fastapi import HTTPException
from google import genai
from google.genai import types as genai_types

from adk_app.core.schema_utils import load_schema


# Global vision client
_VISION_CLIENT: genai.Client | None = None


def init_vision_client() -> None:
    """Initialize Google AI Studio client for vision extraction (GOOGLE_API_KEY)."""
    global _VISION_CLIENT
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("[Vision] Missing GOOGLE_API_KEY; vision extraction will fail until provided.")
        return
    if _VISION_CLIENT is None:
        _VISION_CLIENT = genai.Client(api_key=api_key)
        print("[Vision] Global vision client ready.")


def build_extraction_prompt(schema: dict, scope: str = "cataract_surgery_onboarding") -> str:
    """Build the extraction prompt for vision models."""
    schema_json = json.dumps(schema, indent=2)

    # Clinic extraction prompt
    if scope.lower() == "clinic":
        return f"""
ROLE:
You are an operations/data assistant for an ophthalmology clinic. Extract structured data for clinic setup and pricing. Stay within the provided schema and do not add keys.

INSTRUCTIONS:
- Identify document sections: clinic identity, staff, packages/pricing, SOPs, scheduling, billing, FAQs/forms.
- Extract ONLY fields present in the target schema. If missing, leave as empty string/null/empty list.
- Do NOT hallucinate values. If unsure, leave blank.
- Preserve all arrays; if no items, keep them empty (e.g., [], [{{}}] with empty strings).
- Dates: use ISO 8601 (YYYY-MM-DD) when available.
- Currency: keep as shown (e.g., "$", "USD", or the text provided).
- Lens/package names: keep exact names from the document; do not rename.
- Phone/URL: copy exactly as shown.
- Keep the exact key structure of the schema.

OUTPUT:
Return ONLY valid JSON matching the target schema below.

Target Schema:
{schema_json}
"""

    # Patient extraction prompt (default) - V2 Schema (Clinical Data Only)
    return f"""
ROLE:
You are a medical data extraction assistant. Extract ONLY clinical data directly observable in EMR documents.

TARGET SCHEMA: extraction_schema_v2.json

CRITICAL RULES:
1. ONLY extract data directly observable in the EMR documents
2. DO NOT infer surgical recommendations, medications, or treatment plans
3. Leave fields empty if data is not present in documents
4. DO NOT hallucinate values - if unsure, leave blank

INPUT CONTEXT:
1. **EMR Visit Notes:** Patient demographics, medical history, diagnosis
2. **Biometry Reports:** IOL Master / Lenstar / Pentacam measurements
3. **Patient Questionnaires:** Lifestyle, hobbies, visual priorities, personality traits

EXTRACTION SECTIONS (ONLY THESE):
✅ patient_identity (name, DOB, gender)
✅ medical_profile (systemic conditions, medications_systemic, allergies, surgical history)
✅ clinical_context (pathology, visual acuity, biometry per eye, ocular comorbidities)
✅ lifestyle_profile (occupation, hobbies, visual goals, personality traits, symptoms)

❌ DO NOT EXTRACT (these are added by doctor later):
- surgical_plan (EXCEPT surgery_date if found in documents)
- medications_plan

✅ EXTRACT IF FOUND:
- surgical_plan.operative_logistics.od_right.surgery_date: If a scheduled surgery date for right eye is mentioned
- surgical_plan.operative_logistics.os_left.surgery_date: If a scheduled surgery date for left eye is mentioned

FIELD-SPECIFIC INSTRUCTIONS:

**patient_identity:**
- Extract middle_name if present
- Dates: ISO 8601 format (YYYY-MM-DD)
- Gender: "Male", "Female", or "Other" (capitalize)

**medical_profile:**
- systemic_conditions: Extract conditions like diabetes, hypertension, autoimmune diseases, etc.
- medications_systemic: Look for systemic medications like Tamsulosin, Flomax, alpha-blockers, blood pressure meds
- allergies: Extract drug allergies (e.g., "codeine", "sulfa", "penicillin")
- review_of_systems: Extract Review of Systems (ROS) items - typically documented as checkboxes or lists including:
  * Constitutional (fever, fatigue, weight changes)
  * Cardiovascular (chest pain, palpitations)
  * Respiratory (shortness of breath, cough)
  * GI (nausea, diarrhea, constipation)
  * Neurological (headaches, dizziness)
  * Include both positive and negative findings (e.g., "No Fever", "No Artificial Joints", "No Insomnia")
- surgical_history.ocular: Extract prior eye surgeries (LASIK, PRK, retinal repair, glaucoma surgery)
- surgical_history.non_ocular: Extract relevant non-eye surgeries (appendectomy, C-section, etc.)
- Include "pertinent negatives" (e.g., "No diabetes", "No glaucoma")

**clinical_context:**
- pathology: Extract graded severity (e.g., "2+ Nuclear Sclerosis", "1+ Cortical Spoking")
- primary_cataract_type: REQUIRED - Based on the pathology text, classify into ONE of these exact values:
  * "nuclear_sclerosis" - if primarily nuclear sclerosis/nuclear cataract is mentioned
  * "cortical" - if primarily cortical cataract/cortical spoking is mentioned
  * "posterior_subcapsular" - if primarily PSC/posterior subcapsular cataract is mentioned
  * "combined" - if BOTH nuclear sclerosis AND cortical are present together
  * "congenital" - if congenital/infantile/pediatric cataract is mentioned
  IMPORTANT: Output one of these exact strings only. If pathology shows both nuclear AND cortical changes, use "combined".
- visual_acuity: Extract BCVA if available (e.g., "20/40", "20/25"). UCVA is optional.
- biometry.iol_master: REQUIRED - Extract all IOL Master fields
  * source: Device name (e.g., "IOL Master 700")
  * axial_length_mm, acd_mm, wtw_mm: As floats
  * cct_um: Central Corneal Thickness in micrometers (e.g., 495, 521)
  * flat_k_k1, steep_k_k2: Keratometry readings as floats
  * astigmatism_power: CRITICAL - Preserve the sign! If IOL Master shows negative (e.g., -2.72), use negative. If positive, use positive. The sign is critical for axis calculation.
  * axis: As integer (degrees)
  * k_type: "TK" (Total Keratometry), "STEEP_K", or "FLAT_K"
- biometry.pentacam_topography: OPTIONAL - If Pentacam/Topography data is present
  * source: "Oculus Pentacam" or device name
  * astigmatism_power: If labeled "steep", use positive value. If labeled "flat", use negative value.
  * axis: As integer (degrees)
  * cct_um: Central Corneal Thickness from Pentacam (labeled as "pachy thin" or "pachymetry") in micrometers
  * belin_ambrosio_score: If available
- ocular_comorbidities: Dry eye, glaucoma suspect, macular degeneration, etc.

**lifestyle_profile:**
- occupation: From patient questionnaire
- hobbies: ONLY activities explicitly written or circled (e.g., "Reading", "Golf", "Night Driving")
- visual_goals.primary_zone: "Distance", "Intermediate", "Near", or "All"
- visual_goals.spectacle_independence_desire: "Low", "Medium", or "High"
- personality_traits.perfectionism_score: If questionnaire mentions perfectionist score, extract as 1-10
- personality_traits.risk_tolerance: "Low", "Medium", or "High"
- symptoms_impact: Extract boolean flags
  * night_driving_difficulty: true if mentioned
  * glare_halos: true if mentioned

DATA STANDARDIZATION:
- Dates: YYYY-MM-DD format
- Gender: Capitalize first letter
- Hobbies: Capitalize first letter
- All measurements as floats/integers (not strings)

OUTPUT FORMAT:
Return ONLY a valid JSON object matching the schema below.

Target Schema:
{schema_json}
"""


def vision_extract(images: list[dict], prompt: str, model: str) -> dict:
    """
    Use Google AI Studio client for vision extraction.
    images: list of {"bytes": bytes, "mime_type": str, "desc": str}
    """
    init_vision_client()
    if _VISION_CLIENT is None:
        raise HTTPException(status_code=500, detail="Vision client not initialized (missing GOOGLE_API_KEY)")

    # Normalize model name (defensive)
    clean_model = (model or "").strip()
    if not clean_model:
        raise HTTPException(status_code=400, detail="Vision model is required")

    # Explicit JSON mode + higher token cap to avoid truncation on large extracts
    gen_config = genai_types.GenerateContentConfig(
        temperature=0.0,
        max_output_tokens=8192,
        response_mime_type="application/json",
        safety_settings=[
            genai_types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="BLOCK_NONE"),
            genai_types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="BLOCK_NONE"),
            genai_types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_NONE"),
            genai_types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_NONE"),
        ],
    )

    parts: list[genai_types.Part] = [genai_types.Part.from_text(text=prompt)]
    for img in images:
        parts.append(genai_types.Part.from_bytes(data=img["bytes"], mime_type=img["mime_type"]))

    try:
        response = _VISION_CLIENT.models.generate_content(
            model=clean_model,
            contents=[genai_types.Content(role="user", parts=parts)],
            config=gen_config,
        )
        finish_reason = getattr(response, "finish_reason", None)
        raw = (response.text or "").strip()
        print(f"[Vision Extract] model={clean_model} finish_reason={finish_reason} chars={len(raw)}")
        # Debug: print raw response to diagnose JSON parsing issues
        print(f"[Vision Extract DEBUG] Raw response:\n{raw[:2000]}")
        if not raw:
            raise ValueError("Empty response from vision model")

        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.strip("`").strip()
            if raw.lower().startswith("json"):
                raw = raw[4:].strip()

        # Find JSON block
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            raw = match.group(0)

        # Try parsing JSON directly first
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass

        # Fix common Gemini JSON issues: trailing commas before } or ]
        cleaned = re.sub(r",\s*([}\]])", r"\1", raw)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        # Fix missing commas between fields: }\n" or ]\n" patterns
        cleaned = re.sub(r'("\s*)\n(\s*")', r'\1,\n\2', raw)
        cleaned = re.sub(r"([\]}])\s*\n(\s*\")", r"\1,\n\2", cleaned)
        # Also fix trailing commas in this cleaned version
        cleaned = re.sub(r",\s*([}\]])", r"\1", cleaned)
        return json.loads(cleaned)
    except Exception as exc:
        print(f"[Vision Extract Error] model={model} err={exc}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Vision extraction failed: {exc}")


def generate_clinical_alerts(data: dict) -> list[dict]:
    """
    Auto-generate clinical alerts from extracted patient data based on trigger rules.

    Trigger Rules:
    1. Tamsulosin/Flomax → IFIS risk
    2. Prior LASIK/PRK → Special IOL calculation formulas needed
    3. High astigmatism (>2.0D) → Toric IOL recommended
    4. Pentacam/IOL Master discrepancy (>0.75D) → Consider intraoperative aberrometry
    """
    alerts = []

    # Rule 1: Tamsulosin → IFIS risk (Intraoperative Floppy Iris Syndrome)
    systemic_meds = data.get("medical_profile", {}).get("medications_systemic", [])
    for med in systemic_meds:
        med_lower = med.lower() if isinstance(med, str) else ""
        if "tamsulosin" in med_lower or "flomax" in med_lower or "alpha blocker" in med_lower:
            alerts.append({
                "trigger": "Tamsulosin",
                "alert_msg": "Risk of IFIS (Intraoperative Floppy Iris Syndrome) - Special surgical techniques required"
            })
            break  # Only add alert once

    # Rule 2: Prior LASIK → Special IOL calculation formulas
    ocular_history = data.get("medical_profile", {}).get("surgical_history", {}).get("ocular", [])
    for surgery in ocular_history:
        surgery_lower = surgery.lower() if isinstance(surgery, str) else ""
        if "lasik" in surgery_lower or "prk" in surgery_lower or "refractive surgery" in surgery_lower:
            alerts.append({
                "trigger": "Prior Refractive Surgery",
                "alert_msg": "Use post-refractive IOL power calculation formulas (Barrett True-K, Haigis-L)"
            })
            break

    # Rule 3: High astigmatism → Toric IOL recommendation
    for eye_name, eye_key in [("OD (Right)", "od_right"), ("OS (Left)", "os_left")]:
        biometry = data.get("clinical_context", {}).get(eye_key, {}).get("biometry", {})
        iol_master = biometry.get("iol_master", {})
        astig = iol_master.get("astigmatism_power")

        if astig is not None and astig > 2.0:
            alerts.append({
                "trigger": f"{eye_name} Astigmatism > 2.0D",
                "alert_msg": f"Toric IOL recommended for {eye_name} astigmatism correction ({astig}D)"
            })

    # Rule 4: Pentacam/IOL Master discrepancy → Intraoperative aberrometry consideration
    for eye_name, eye_key in [("OD (Right)", "od_right"), ("OS (Left)", "os_left")]:
        biometry = data.get("clinical_context", {}).get(eye_key, {}).get("biometry", {})
        iol_astig = biometry.get("iol_master", {}).get("astigmatism_power")
        pentacam_astig = biometry.get("pentacam_topography", {}).get("astigmatism_power") if biometry.get("pentacam_topography") else None

        if iol_astig is not None and pentacam_astig is not None:
            discrepancy = abs(iol_astig - pentacam_astig)
            if discrepancy > 0.75:
                alerts.append({
                    "trigger": f"{eye_name} Biometry Discrepancy",
                    "alert_msg": f"IOL Master ({iol_astig}D) vs Pentacam ({pentacam_astig}D) differ by {discrepancy:.2f}D - Consider intraoperative aberrometry"
                })

    print(f"[Clinical Alerts] Generated {len(alerts)} alerts: {[a['trigger'] for a in alerts]}")
    return alerts
