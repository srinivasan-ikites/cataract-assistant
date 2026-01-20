from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import List, Any
import time
import os
import json
import re
import traceback
import shutil

import litellm
from fastapi import Depends, FastAPI, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from adk_app.config import ModelConfig
from adk_app.orchestration.pipeline import ContextPackage, prepare_context
from adk_app.utils.data_loader import (
    get_patient_data,
    get_all_patients,
    save_patient_chat_history,
    save_patient_module_content,
    get_clinic_data,
    clear_patient_chat_history,
    clear_patient_cache,
)
from contextlib import asynccontextmanager

# Import initialization functions
from adk_app.services.qdrant_service import init_qdrant_client
from adk_app.tools.router_tool import init_router_client
from google import genai
from google.genai import types as genai_types

litellm.drop_params = True  # Avoid unsupported parameter errors on certain models

# Upload/extraction config
UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "data" / "uploads"
REVIEW_ROOT = Path(__file__).resolve().parents[2] / "data" / "reviewed"
MAX_UPLOAD_FILES = int(os.getenv("MAX_UPLOAD_FILES", "20"))
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "10"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

# Standardized controlled vocabularies for extraction consistency
STANDARD_LENS_OPTIONS = [
    "Monofocal",
    "Monofocal Toric",
    "EDOF (Extended Depth of Focus)",
    "EDOF Toric",
    "Multifocal",
    "Multifocal Toric",
    "Trifocal",
    "Trifocal Toric",
    "LAL (Light Adjustable Lens)",
    "LAL Toric"
]

STANDARD_GENDERS = ["Male", "Female", "Other"]

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


@dataclass
class AgentRuntime:
    config: ModelConfig


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Initialize heavy clients at startup to avoid latency on first request.
    """
    print("\n[Startup] Initializing Global Clients...")
    try:
        # 1. Warm up Router (Gemini)
        init_router_client()
        
        # 2. Warm up Vector DB (Qdrant)
        init_qdrant_client()

        # 3. Warm up Vision extraction (Google AI Studio)
        init_vision_client()
        
        print("[Startup] All clients ready.\n")
    except Exception as e:
        print(f"[Startup] Error initializing clients: {e}")
    
    yield
    
    # Cleanup if needed
    print("[Shutdown] Cleaning up...")


class AskRequest(BaseModel):
    patient_id: str = Field(..., description="Patient identifier from patient JSON.")
    question: str = Field(..., description="User's natural language question.")


class AskResponse(BaseModel):
    answer: str
    blocks: list[dict] = []
    suggestions: list[str] = []
    router_summary: dict
    context_sources: dict
    media: list[dict] = []  # Media items (images/videos) from retrieved chunks
    sources: list[dict] = []  # Source URLs/links from retrieved chunks


class ModuleContentRequest(BaseModel):
    patient_id: str
    module_title: str


class ModuleContentResponse(BaseModel):
    title: str
    summary: str
    details: list[str] = []
    faqs: list[dict] = []
    videoScriptSuggestion: str | None = None
    botStarterPrompt: str | None = None
    checklist: list[str] = []
    timeline: list[dict] = []
    risks: list[dict] = []
    costBreakdown: list[dict] = []


class PreGenerateModulesRequest(BaseModel):
    patient_id: str


class ReviewedPatientPayload(BaseModel):
    clinic_id: str
    patient_id: str
    data: dict


class ReviewedClinicPayload(BaseModel):
    clinic_id: str
    data: dict


def _normalize_module_title(title: str) -> str:
    return (title or "").strip().lower()


MODULE_TITLES = [
    "My Diagnosis",
    "What is Cataract Surgery?",
    "What is an IOL?",
    "My IOL Options",
    "Risks & Complications",
    "Before Surgery",
    "Day of Surgery",
    "After Surgery",
    "Costs & Insurance",
]


# -------------------------------
# Doctor upload / extraction helpers
# -------------------------------

def _ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def _load_schema(schema_filename: str) -> dict:
    # app.py is at backend/adk_app/api/app.py. Repo root is three levels up.
    schema_path = Path(__file__).resolve().parents[3] / "docs" / "schemas" / schema_filename
    if not schema_path.exists():
        raise HTTPException(status_code=500, detail=f"Schema file not found: {schema_filename}")
    with open(schema_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _fill_from_schema(template: Any, data: Any) -> Any:
    """
    Recursively fill missing keys from a schema template while preserving provided data.
    - For dicts: ensure all template keys exist; keep extra keys from data.
    - For lists: if data provides a list, use it; otherwise fall back to template list.
    - For primitives: prefer data when present, else template default.
    """
    if isinstance(template, dict):
        result: dict = {}
        data_obj = data if isinstance(data, dict) else {}
        for key, tmpl_val in template.items():
            result[key] = _fill_from_schema(tmpl_val, data_obj.get(key))
        # Preserve any extra keys present in data but not in template
        for key, val in data_obj.items():
            if key not in result:
                result[key] = val
        return result

    if isinstance(template, list):
        if isinstance(data, list):
            return data
        return template

    if data is None:
        return template
    return data


def _apply_schema_template(schema_name: str, data: dict) -> dict:
    """Load schema template and fill any missing keys on the provided data."""
    schema = _load_schema(schema_name)
    safe_data = data if isinstance(data, dict) else {}
    return _fill_from_schema(schema, safe_data)


def _normalize_extracted_data(data: dict) -> dict:
    """
    Post-process extracted data to ensure consistency (v2 schema support):
    - Standardize date formats to ISO 8601 (YYYY-MM-DD)
    - Normalize capitalization
    - Normalize pathology grading
    - Clean up whitespace

    Note: v2 schema separates extraction (clinical data) from doctor entry (surgical plan, medications)
    """
    # Helper: normalize date to YYYY-MM-DD
    def normalize_date(date_str: str) -> str:
        if not date_str:
            return ""
        # Remove extra whitespace
        date_str = date_str.strip()
        # Try common formats
        for fmt in ["%Y-%m-%d", "%m/%d/%Y", "%Y/%m/%d", "%d-%m-%Y", "%m-%d-%Y"]:
            try:
                from datetime import datetime
                dt = datetime.strptime(date_str, fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue
        return date_str  # Return as-is if no format matches

    # Normalize patient identity
    if "patient_identity" in data:
        identity = data["patient_identity"]
        if "dob" in identity:
            identity["dob"] = normalize_date(identity["dob"])
        if "gender" in identity and identity["gender"]:
            gender = str(identity["gender"]).strip()
            # Capitalize first letter
            identity["gender"] = gender.capitalize() if gender else ""

    # Normalize medical_profile (v2 schema)
    if "medical_profile" in data:
        profile = data["medical_profile"]

        # Capitalize systemic conditions
        if "systemic_conditions" in profile and isinstance(profile["systemic_conditions"], list):
            profile["systemic_conditions"] = [c.strip() for c in profile["systemic_conditions"] if c]

        # Capitalize medications_systemic
        if "medications_systemic" in profile and isinstance(profile["medications_systemic"], list):
            profile["medications_systemic"] = [m.strip() for m in profile["medications_systemic"] if m]

        # Capitalize allergies
        if "allergies" in profile and isinstance(profile["allergies"], list):
            profile["allergies"] = [a.strip() for a in profile["allergies"] if a]

    # Normalize clinical_context per-eye structure (v2 schema)
    if "clinical_context" in data:
        for eye_key in ["od_right", "os_left"]:
            if eye_key in data["clinical_context"]:
                eye_data = data["clinical_context"][eye_key]

                # Pathology is already graded (e.g., "2+ Nuclear Sclerosis")
                # No normalization needed - trust LLM extraction

                # Visual acuity - ensure strings (e.g., "20/40", "20/25")
                if "visual_acuity" in eye_data:
                    va = eye_data["visual_acuity"]
                    if "ucva" in va and va["ucva"]:
                        va["ucva"] = str(va["ucva"]).strip()
                    if "bcva" in va and va["bcva"]:
                        va["bcva"] = str(va["bcva"]).strip()

    # Normalize lifestyle_profile (v2 schema)
    if "lifestyle_profile" in data:
        lifestyle = data["lifestyle_profile"]

        # Capitalize hobbies
        if "hobbies" in lifestyle and isinstance(lifestyle["hobbies"], list):
            lifestyle["hobbies"] = [h.strip().capitalize() for h in lifestyle["hobbies"] if h]

        # Occupation - capitalize first letter
        if "occupation" in lifestyle and lifestyle["occupation"]:
            lifestyle["occupation"] = str(lifestyle["occupation"]).strip().capitalize()

    # Normalize surgical_plan dates (if present - added by doctor, not extraction)
    if "surgical_plan" in data:
        plan = data["surgical_plan"]

        # Normalize patient selection date
        if "patient_selection" in plan and "selection_date" in plan["patient_selection"]:
            plan["patient_selection"]["selection_date"] = normalize_date(plan["patient_selection"]["selection_date"])

        # Normalize operative logistics dates
        if "operative_logistics" in plan:
            for eye_key in ["od_right", "os_left"]:
                if eye_key in plan["operative_logistics"]:
                    logistics = plan["operative_logistics"][eye_key]
                    if "surgery_date" in logistics and logistics["surgery_date"]:
                        logistics["surgery_date"] = normalize_date(logistics["surgery_date"])

    return data


def _build_extraction_prompt(schema: dict, scope: str = "cataract_surgery_onboarding") -> str:
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
- surgical_plan
- medications_plan

FIELD-SPECIFIC INSTRUCTIONS:

**patient_identity:**
- Extract middle_name if present
- Dates: ISO 8601 format (YYYY-MM-DD)
- Gender: "Male", "Female", or "Other" (capitalize)

**medical_profile:**
- medications_systemic: Look for systemic medications like Tamsulosin, Flomax, alpha-blockers, blood pressure meds
- surgical_history.ocular: Extract prior eye surgeries (LASIK, PRK, retinal repair, glaucoma surgery)
- surgical_history.non_ocular: Extract relevant non-eye surgeries (appendectomy, C-section, etc.)
- Include "pertinent negatives" (e.g., "No diabetes", "No glaucoma")

**clinical_context:**
- pathology: Extract graded severity (e.g., "2+ Nuclear Sclerosis", "1+ Cortical Spoking")
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

def _vision_extract(images: list[dict], prompt: str, model: str) -> dict:
    """
    Use Google AI Studio client (same as router_tool.py).
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
        
        return json.loads(raw)
    except Exception as exc:
        print(f"[Vision Extract Error] model={model} err={exc}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Vision extraction failed: {exc}")


def _generate_clinical_alerts(data: dict) -> list[dict]:
    """
    Auto-generate clinical alerts from extracted patient data based on trigger rules.

    Trigger Rules:
    1. Tamsulosin/Flomax → IFIS risk
    2. Prior LASIK/PRK → Special IOL calculation formulas needed
    3. High astigmatism (>2.0D) → Toric IOL recommended
    4. Pentacam/IOL Master discrepancy (>0.75D) → Consider intraoperative aberrometry

    Args:
        data: Extracted patient data (v2 schema)

    Returns:
        List of alert dictionaries with 'trigger' and 'alert_msg' keys
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


def _save_uploaded_files(base_dir: Path, files: List[UploadFile]) -> list[Path]:
    saved_paths: list[Path] = []
    for idx, file in enumerate(files):
        suffix = Path(file.filename or f"upload_{idx}").suffix or ".img"
        target = base_dir / f"{idx:02d}{suffix}"
        contents = file.file.read()
        with open(target, "wb") as f:
            f.write(contents)
        saved_paths.append(target)
    return saved_paths


def get_runtime() -> AgentRuntime:
    config = ModelConfig.from_env()
    router_provider = os.getenv("ROUTER_PROVIDER", config.provider)
    router_model = os.getenv("MODEL_PROVIDER", config.model)
    print(
        "[Model Config] provider="
        f"{config.provider} model={config.model} temperature={config.temperature}"
    )
    print(f"[Router Config] provider={router_provider} model={router_model}")
    return AgentRuntime(config=config)


app = FastAPI(title="Cataract Counsellor API", lifespan=lifespan)

_DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://35.244.44.106:3000",
    "http://cataract-assistant.ikites.ai",  # <--- ADD THIS LINE
    "https://cataract-assistant.ikites.ai", # <--- Add this too (for future SSL)
    "https://cataract-p9pks1uzc-srinivas831s-projects.vercel.app",
    "https://cataract-8p61yr28h-srinivas831s-projects.vercel.app",
    "https://cataract-ui.vercel.app",
]

# Allow overriding via env to avoid code changes for each hostname/IP
env_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
allow_origins = env_origins or _DEFAULT_CORS_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
def health() -> dict:
    return {"status": "ok"}


@app.get("/patients")
def list_patients() -> list[dict]:
    """Return a list of all patients for the selection screen."""
    return get_all_patients()


@app.get("/patients/{patient_id}")
def get_patient(patient_id: str) -> dict:
    """Return full details for a specific patient, including chat history."""
    try:
        return get_patient_data(patient_id)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err))


@app.post("/patients/{patient_id}/chat/clear")
def clear_patient_chat(patient_id: str) -> dict:
    """
    Clear stored chat history for a patient in the JSON file.
    Does not remove any other patient data.
    """
    try:
        clear_patient_chat_history(patient_id)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err))
    return {"status": "ok"}


@app.get("/clinics/{clinic_id}")
def get_clinic(clinic_id: str) -> dict:
    """
    Return full details for a specific clinic.
    Priority: reviewed clinic data > base clinic data
    """
    # First check if there's reviewed clinic data
    reviewed_path = REVIEW_ROOT / clinic_id / "reviewed_clinic.json"
    if reviewed_path.exists():
        try:
            with open(reviewed_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[Clinic] Failed to load reviewed clinic: {e}")
    
    # Fall back to base clinic data
    try:
        clinic = get_clinic_data(clinic_id)
        # Return the original schema from 'extra' key
        return clinic.get("extra") or clinic
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err))


@app.get("/clinics/{clinic_id}/medications")
def get_clinic_medications(clinic_id: str) -> dict:
    """Get medications configuration for a clinic."""
    clinic_data = get_clinic(clinic_id)
    medications = clinic_data.get("medications", {})
    return {"status": "ok", "medications": medications}


@app.get("/clinics/{clinic_id}/packages")
def get_clinic_packages(clinic_id: str) -> dict:
    """Get surgical packages for a clinic."""
    clinic_data = get_clinic(clinic_id)
    packages = clinic_data.get("surgical_packages", [])
    return {"status": "ok", "packages": packages}


@app.get("/clinics/{clinic_id}/lens-inventory")
def get_clinic_lens_inventory(clinic_id: str, category: str = None) -> dict:
    """
    Get lens inventory for a clinic.
    Optionally filter by category (e.g., MONOFOCAL, EDOF, MULTIFOCAL)
    """
    clinic_data = get_clinic(clinic_id)
    inventory = clinic_data.get("lens_inventory", {})
    
    if category:
        # Return specific category
        cat_data = inventory.get(category, {})
        return {"status": "ok", "category": category, "data": cat_data}
    
    return {"status": "ok", "lens_inventory": inventory}


@app.get("/clinics/{clinic_id}/doctor-context")
def get_doctor_context(clinic_id: str) -> dict:
    """
    Get all clinic configuration needed for the Doctor's View in a single call.
    This provides medications, packages, staff, and lens inventory in one request,
    optimizing for frontend performance and making future PostgreSQL migration easier.
    """
    clinic_data = get_clinic(clinic_id)
    
    # Extract medications configuration
    raw_meds = clinic_data.get("medications", {})
    
    # Transform pre-op antibiotics to the format expected by frontend
    pre_op_antibiotics = []
    for i, ab in enumerate(raw_meds.get("pre_op", {}).get("antibiotics", [])):
        if isinstance(ab, dict):
            pre_op_antibiotics.append({
                "id": ab.get("id", i + 1),
                "name": ab.get("name", "")
            })
        elif isinstance(ab, str):
            pre_op_antibiotics.append({"id": i + 1, "name": ab})
    
    # Transform pre-op frequencies
    pre_op_frequencies = []
    for i, freq in enumerate(raw_meds.get("pre_op", {}).get("frequencies", [])):
        if isinstance(freq, dict):
            pre_op_frequencies.append({
                "id": freq.get("id", i + 1),
                "name": freq.get("name", ""),
                "times_per_day": freq.get("times_per_day", 4)
            })
        elif isinstance(freq, str):
            pre_op_frequencies.append({"id": i + 1, "name": freq, "times_per_day": 4})
    
    # Transform post-op antibiotics - preserve full object structure
    post_op_antibiotics = []
    for i, ab in enumerate(raw_meds.get("post_op", {}).get("antibiotics", [])):
        if isinstance(ab, dict):
            post_op_antibiotics.append({
                "id": ab.get("id", i + 1),
                "name": ab.get("name", ""),
                "default_frequency": ab.get("default_frequency", 4),
                "default_weeks": ab.get("default_weeks", 1),
                "allergy_note": ab.get("allergy_note", "")
            })
        elif isinstance(ab, str):
            post_op_antibiotics.append({
                "id": i + 1,
                "name": ab,
                "default_frequency": 4,
                "default_weeks": 1
            })

    # Transform NSAIDs with frequency info
    post_op_nsaids = []
    for i, nsaid in enumerate(raw_meds.get("post_op", {}).get("nsaids", [])):
        if isinstance(nsaid, dict):
            post_op_nsaids.append({
                "id": nsaid.get("id", i + 1),
                "name": nsaid.get("name", ""),
                "default_frequency": nsaid.get("default_frequency", 4),
                "frequency_label": nsaid.get("frequency_label", "4x Daily"),
                "default_weeks": nsaid.get("default_weeks", 4),
                "variable_frequency": nsaid.get("variable_frequency", False)
            })
        elif isinstance(nsaid, str):
            post_op_nsaids.append({
                "id": i + 1,
                "name": nsaid,
                "default_frequency": 4,
                "frequency_label": "4x Daily",
                "default_weeks": 4,
                "variable_frequency": False
            })

    # Transform steroids - preserve full object structure with taper info
    post_op_steroids = []
    for i, steroid in enumerate(raw_meds.get("post_op", {}).get("steroids", [])):
        if isinstance(steroid, dict):
            post_op_steroids.append({
                "id": steroid.get("id", i + 1),
                "name": steroid.get("name", ""),
                "default_taper": steroid.get("default_taper", [4, 3, 2, 1]),
                "default_weeks": steroid.get("default_weeks", 4)
            })
        elif isinstance(steroid, str):
            post_op_steroids.append({
                "id": i + 1,
                "name": steroid,
                "default_taper": [4, 3, 2, 1],
                "default_weeks": 4
            })

    # Transform glaucoma drops - preserve full object structure
    glaucoma_drops = []
    for i, drop in enumerate(raw_meds.get("post_op", {}).get("glaucoma_drops", [])):
        if isinstance(drop, dict):
            glaucoma_drops.append({
                "id": drop.get("id", i + 1),
                "name": drop.get("name", ""),
                "category": drop.get("category", "")
            })
        elif isinstance(drop, str):
            glaucoma_drops.append({
                "id": i + 1,
                "name": drop,
                "category": ""
            })

    # Transform combination drops - preserve full object structure
    combo_drops = []
    for i, combo in enumerate(raw_meds.get("post_op", {}).get("combination_drops", [])):
        if isinstance(combo, dict):
            combo_drops.append({
                "id": combo.get("id", i + 1),
                "name": combo.get("name", ""),
                "components": combo.get("components", [])
            })
        elif isinstance(combo, str):
            combo_drops.append({
                "id": i + 1,
                "name": combo,
                "components": []
            })
    
    # Dropless option
    dropless = raw_meds.get("post_op", {}).get("dropless_option", {})
    dropless_option = {
        "available": dropless.get("available", False),
        "description": dropless.get("description", ""),
        "medications": dropless.get("medications", [])
    }
    
    # Frequency options for general use
    frequency_options = []
    for i, opt in enumerate(raw_meds.get("frequency_options", [])):
        if isinstance(opt, dict):
            frequency_options.append({
                "id": opt.get("id", i + 1),
                "label": opt.get("label", ""),
                "times_per_day": opt.get("times_per_day", 4)
            })
    
    # Build medications response
    medications = {
        "pre_op": {
            "antibiotics": pre_op_antibiotics,
            "frequencies": pre_op_frequencies,
            "default_start_days": raw_meds.get("pre_op", {}).get("default_start_days_before_surgery", 3)
        },
        "post_op": {
            "antibiotics": post_op_antibiotics,
            "nsaids": post_op_nsaids,
            "steroids": post_op_steroids,
            "glaucoma_drops": glaucoma_drops,
            "combination_drops": combo_drops
        },
        "dropless_option": dropless_option,
        "frequency_options": frequency_options
    }
    
    # Extract staff directory
    staff = []
    for member in clinic_data.get("staff_directory", []):
        staff.append({
            "provider_id": member.get("provider_id", ""),
            "name": member.get("name", ""),
            "role": member.get("role", ""),
            "specialty": member.get("specialty", "")
        })
    
    # Extract surgical packages
    packages = []
    for pkg in clinic_data.get("surgical_packages", []):
        packages.append({
            "package_id": pkg.get("package_id", ""),
            "display_name": pkg.get("display_name", pkg.get("name", "")),
            "description": pkg.get("description", ""),
            "price_cash": pkg.get("price_cash", 0),
            "includes_laser": pkg.get("includes_laser", False),
            "allowed_lens_codes": pkg.get("allowed_lens_codes", [])
        })
    
    # Extract lens inventory categories
    lens_inventory = clinic_data.get("lens_inventory", {})
    lens_categories = list(lens_inventory.keys())
    
    return {
        "status": "ok",
        "clinic_id": clinic_id,
        "medications": medications,
        "staff": staff,
        "surgical_packages": packages,
        "lens_categories": lens_categories,
        "lens_inventory": lens_inventory
    }


@app.post("/ask", response_model=AskResponse)
def ask_endpoint(
    payload: AskRequest,
    runtime: AgentRuntime = Depends(get_runtime),
) -> AskResponse:
    t_start = time.perf_counter()
    try:
        patient = get_patient_data(payload.patient_id)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err
    t_after_patient = time.perf_counter()
    print(f"####### timing ask.load_patient_ms={(t_after_patient - t_start)*1000:.1f}")

    # Extract last 6 chat messages for conversational context
    # This allows the LLM to remember recent conversation history
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
    answer, suggestions, blocks = _generate_answer_with_history(
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


@app.post("/module-content", response_model=ModuleContentResponse)
def module_content_endpoint(
    payload: ModuleContentRequest,
    runtime: AgentRuntime = Depends(get_runtime),
) -> ModuleContentResponse:
    raw_title = payload.module_title or ""
    key = _normalize_module_title(raw_title)
    
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
    missing, module_cache = _get_missing_modules(patient, module_cache)
    print(f"[ModuleContent] GENERATING batch for missing={missing}")
    _generate_and_save_missing(payload.patient_id, patient, missing, runtime.config)

    # Reload cache for this patient after save
    patient = get_patient_data(payload.patient_id)
    module_cache = patient.get("module_content") if isinstance(patient.get("module_content"), dict) else {}

    cached = module_cache.get(raw_title) or module_cache.get(key)
    if cached:
        print(f"[ModuleContent] ✓ CACHE HIT after batch - Found content for '{raw_title}'")
        return ModuleContentResponse(**cached)

    print(f"[ModuleContent] ✗ CACHE MISS after batch for '{raw_title}' (unexpected)")
    raise HTTPException(status_code=500, detail="Failed to generate module content")


@app.post("/pregenerate-modules")
def pregenerate_modules_endpoint(
    payload: PreGenerateModulesRequest,
    runtime: AgentRuntime = Depends(get_runtime),
) -> dict:
    try:
        patient = get_patient_data(payload.patient_id)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err

    missing, module_cache = _get_missing_modules(patient)
    if not missing:
        return {"status": "ok", "generated": 0, "missing": [], "skipped": len(MODULE_TITLES)}

    print(f"[ModuleContent] Pregen start patient={payload.patient_id} missing={missing}")
    saved = _generate_and_save_missing(payload.patient_id, patient, missing, runtime.config)
    print(f"[ModuleContent] Pregen done patient={payload.patient_id} saved={saved}")
    return {"status": "ok", "generated": len(saved), "missing": missing, "saved": saved}


@app.post("/doctor/uploads/patient")
async def doctor_upload_patient_docs(
    clinic_id: str = Form(...),
    patient_id: str = Form(...),
    files: List[UploadFile] = File(...),
    model: str | None = Form(None),
    runtime: AgentRuntime = Depends(get_runtime),
) -> dict:
    """
    Upload EMR/biometry images for a patient and extract structured data to patient schema.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
    if len(files) > MAX_UPLOAD_FILES:
        raise HTTPException(status_code=400, detail=f"Too many files. Max {MAX_UPLOAD_FILES}.")

    _ = runtime  # currently unused; kept for symmetry/config logging
    env_model = os.getenv("VISION_MODEL", "gemini-1.5-pro-latest")
    vision_model = model if model and model != "string" else env_model
    print(f"[Doctor Upload Patient] clinic={clinic_id} patient={patient_id} model={vision_model} env_model={env_model} files={len(files)}")
    base_dir = _ensure_dir(UPLOAD_ROOT / clinic_id / patient_id)

    images: list[dict] = []
    saved_files: list[str] = []
    for idx, file in enumerate(files):
        content = await file.read()
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"File {file.filename} exceeds {MAX_UPLOAD_MB}MB limit",
            )
        content_type = file.content_type or "image/png"
        images.append({"bytes": content, "mime_type": content_type, "desc": file.filename or f"file_{idx}"})

        suffix = Path(file.filename or f"upload_{idx}").suffix or ".img"
        target = base_dir / f"{idx:02d}{suffix}"
        with open(target, "wb") as f:
            f.write(content)
        saved_files.append(str(target))

    try:
        # Use extraction_schema_v2.json (clinical data only - no surgical/medications)
        schema = _load_schema("extraction_schema_v2.json")
        prompt = _build_extraction_prompt(schema, scope="Patient")
        extraction = _vision_extract(images, prompt, vision_model)

        # Auto-generate clinical alerts from extracted data
        if "clinical_context" not in extraction:
            extraction["clinical_context"] = {}
        extraction["clinical_context"]["clinical_alerts"] = _generate_clinical_alerts(extraction)

        # Normalize extracted data for consistency and fill any missing keys using schema template
        extraction = _normalize_extracted_data(extraction)
        extraction = _apply_schema_template("extraction_schema_v2.json", extraction)

        extracted_path = base_dir / "extracted_patient.json"
        with open(extracted_path, "w", encoding="utf-8") as f:
            json.dump(extraction, f, ensure_ascii=False, indent=2)

        return {
            "status": "ok",
            "model_used": vision_model,
            "files_saved": len(saved_files),
            "upload_dir": str(base_dir),
            "extracted_path": str(extracted_path),
            "extracted": extraction,
        }
    except Exception as exc:
        print(f"[Doctor Upload Patient Error] model={vision_model} err={exc}")
        traceback.print_exc()
        raise


@app.post("/doctor/uploads/clinic")
async def doctor_upload_clinic_docs(
    clinic_id: str = Form(...),
    files: List[UploadFile] = File(...),
    model: str | None = Form(None),
    runtime: AgentRuntime = Depends(get_runtime),
) -> dict:
    """
    Upload clinic-level documents (one-time) and extract structured data to clinic schema.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
    if len(files) > MAX_UPLOAD_FILES:
        raise HTTPException(status_code=400, detail=f"Too many files. Max {MAX_UPLOAD_FILES}.")

    _ = runtime  # currently unused; kept for symmetry/config logging
    env_model = os.getenv("VISION_MODEL", "gemini-1.5-pro-latest")
    vision_model = model if model and model != "string" else env_model
    print(f"[Doctor Upload Clinic] clinic={clinic_id} model={vision_model} env_model={env_model} files={len(files)}")
    base_dir = _ensure_dir(UPLOAD_ROOT / clinic_id / "clinic")

    images: list[dict] = []
    saved_files: list[str] = []
    for idx, file in enumerate(files):
        content = await file.read()
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"File {file.filename} exceeds {MAX_UPLOAD_MB}MB limit",
            )
        content_type = file.content_type or "image/png"
        images.append({"bytes": content, "mime_type": content_type, "desc": file.filename or f"file_{idx}"})

        suffix = Path(file.filename or f"upload_{idx}").suffix or ".img"
        target = base_dir / f"{idx:02d}{suffix}"
        with open(target, "wb") as f:
            f.write(content)
        saved_files.append(str(target))

    try:
        schema = _load_schema("clinic_schema.json")
        prompt = _build_extraction_prompt(schema, scope="Clinic")
        extraction = _vision_extract(images, prompt, vision_model)
        # Normalize extracted data for consistency and fill any missing keys using schema template
        extraction = _normalize_extracted_data(extraction)
        extraction = _apply_schema_template("clinic_schema.json", extraction)

        extracted_path = base_dir / "extracted_clinic.json"
        with open(extracted_path, "w", encoding="utf-8") as f:
            json.dump(extraction, f, ensure_ascii=False, indent=2)

        return {
            "status": "ok",
            "model_used": vision_model,
            "files_saved": len(saved_files),
            "upload_dir": str(base_dir),
            "extracted_path": str(extracted_path),
            "extracted": extraction,
        }
    except Exception as exc:
        print(f"[Doctor Upload Clinic Error] model={vision_model} err={exc}")
        traceback.print_exc()
        raise


# -------------------------------
# Doctor extraction retrieval + reviewed save endpoints
# -------------------------------


def _read_json_or_404(path: Path, label: str) -> dict:
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"{label} not found")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/doctor/extractions/patient")
async def get_extracted_patient(clinic_id: str, patient_id: str) -> dict:
    # First try direct path
    path = UPLOAD_ROOT / clinic_id / patient_id / "extracted_patient.json"
    
    if not path.exists():
        # Fallback: find actual folder name from reviewed cache
        try:
            patient = get_patient_data(patient_id)
            if patient.get("_file_path"):
                actual_pid_folder = Path(patient["_file_path"]).parent.name
                path = UPLOAD_ROOT / clinic_id / actual_pid_folder / "extracted_patient.json"
        except Exception:
            pass

    data = _read_json_or_404(path, "Extracted patient JSON")
    return {"status": "ok", "extracted_path": str(path), "extracted": data}


@app.get("/doctor/extractions/clinic")
async def get_extracted_clinic(clinic_id: str) -> dict:
    path = UPLOAD_ROOT / clinic_id / "clinic" / "extracted_clinic.json"
    data = _read_json_or_404(path, "Extracted clinic JSON")
    return {"status": "ok", "extracted_path": str(path), "extracted": data}


@app.get("/doctor/reviewed/patient")
async def get_reviewed_patient(clinic_id: str, patient_id: str) -> dict:
    # First try direct path
    path = REVIEW_ROOT / clinic_id / patient_id / "reviewed_patient.json"
    
    if not path.exists():
        # Fallback: find actual folder name from reviewed cache
        try:
            patient = get_patient_data(patient_id)
            if patient.get("_file_path"):
                path = Path(patient["_file_path"])
        except Exception:
            pass

    data = _read_json_or_404(path, "Reviewed patient JSON")
    return {"status": "ok", "reviewed_path": str(path), "reviewed": data}


@app.get("/doctor/reviewed/clinic")
async def get_reviewed_clinic(clinic_id: str) -> dict:
    path = REVIEW_ROOT / clinic_id / "reviewed_clinic.json"
    data = _read_json_or_404(path, "Reviewed clinic JSON")
    return {"status": "ok", "reviewed_path": str(path), "reviewed": data}


@app.post("/doctor/review/patient")
async def save_reviewed_patient(
    payload: ReviewedPatientPayload,
    background_tasks: BackgroundTasks,
    runtime: AgentRuntime = Depends(get_runtime)
) -> dict:
    """
    Save reviewed patient data (v2 schema).

    Expected payload.data structure:
    - Extraction data (patient_identity, medical_profile, clinical_context, lifestyle_profile)
    - Doctor-entered data (surgical_plan, medications_plan)

    This endpoint merges extracted data with doctor selections and saves to reviewed folder.
    """
    base_dir = _ensure_dir(REVIEW_ROOT / payload.clinic_id / payload.patient_id)
    payload_data = payload.data if isinstance(payload.data, dict) else {}

    # Auto-generate clinical alerts if not already present or if data changed
    if "clinical_context" in payload_data:
        # Regenerate alerts based on current data
        payload_data["clinical_context"]["clinical_alerts"] = _generate_clinical_alerts(payload_data)

    # Apply normalization (handles both v1 and v2 schemas)
    reviewed = _normalize_extracted_data(payload_data)

    # Apply final_schema_v2.json template to ensure all fields present
    reviewed = _apply_schema_template("final_schema_v2.json", reviewed)

    # Preserve chat_history and module_content if they exist from previous save
    try:
        existing_file = base_dir / "reviewed_patient.json"
        if existing_file.exists():
            with open(existing_file, "r", encoding="utf-8") as f:
                existing_data = json.load(f)
                if "chat_history" in existing_data:
                    reviewed["chat_history"] = existing_data.get("chat_history", [])
                if "module_content" in existing_data:
                    reviewed["module_content"] = existing_data.get("module_content", {})
    except Exception as e:
        print(f"[Save Reviewed Patient] Could not load existing chat/module data: {e}")
        # Continue without existing data - will use defaults from schema

    # Ensure legacy/convenience fields are populated (using the adapter)
    from adk_app.utils.data_adapter import normalize_patient, denormalize_patient
    full_normalized = normalize_patient(reviewed)

    # Denormalize to strip legacy convenience fields and 'extra' duplication for storage
    to_save = denormalize_patient(full_normalized)

    target = base_dir / "reviewed_patient.json"
    with open(target, "w", encoding="utf-8") as f:
        json.dump(to_save, f, ensure_ascii=False, indent=2)

    print(f"[Save Reviewed Patient] Saved v2 schema patient: {payload.clinic_id}/{payload.patient_id}")

    # Invalidate cache
    clear_patient_cache()

    # Trigger background module generation
    # This ensures patient has content ready when they open the app
    # background_tasks.add_task(
    #     _generate_modules_background,
    #     payload.patient_id,
    #     runtime.config
    # )
    # print(f"[Save Reviewed Patient] Queued background module generation for patient: {payload.patient_id}")

    return {"status": "ok", "reviewed_path": str(target), "reviewed": full_normalized}


@app.delete("/doctor/patient")
async def delete_patient_data(clinic_id: str, patient_id: str) -> dict:
    """
    Delete all stored data for a patient (uploads and reviewed).
    """
    upload_dir = UPLOAD_ROOT / clinic_id / patient_id
    reviewed_dir = REVIEW_ROOT / clinic_id / patient_id
    
    # Fallback to resolve correct folders if direct ones don't exist
    try:
        patient = get_patient_data(patient_id)
        if patient.get("_file_path"):
            rev_path = Path(patient["_file_path"])
            reviewed_dir = rev_path.parent
            upload_dir = UPLOAD_ROOT / clinic_id / reviewed_dir.name
    except Exception:
        pass

    removed: list[str] = []

    for path in (upload_dir, reviewed_dir):
        if path.exists():
            try:
                shutil.rmtree(path, ignore_errors=False)
            except Exception as exc:
                print(f"[Delete Patient] Failed to remove {path}: {exc}")
                raise HTTPException(status_code=500, detail=f"Failed to remove {path.name}: {exc}") from exc
            removed.append(str(path))

    return {"status": "ok", "removed": removed}


@app.post("/doctor/review/clinic")
async def save_reviewed_clinic(payload: ReviewedClinicPayload) -> dict:
    base_dir = _ensure_dir(REVIEW_ROOT / payload.clinic_id)
    payload_data = payload.data if isinstance(payload.data, dict) else {}
    reviewed = _normalize_extracted_data(payload_data)
    reviewed = _apply_schema_template("clinic_schema.json", reviewed)
    target = base_dir / "reviewed_clinic.json"
    with open(target, "w", encoding="utf-8") as f:
        json.dump(reviewed, f, ensure_ascii=False, indent=2)
    return {"status": "ok", "reviewed_path": str(target), "reviewed": reviewed}


def _generate_suggestions(topics: list[str]) -> list[str]:
    """Generate follow-up questions based on topics."""
    suggestions = []
    if "SURGERY" in topics:
        suggestions.extend(["Is it painful?", "How long does it take?"])
    if "LENSES" in topics:
        suggestions.extend(["What is the best lens?", "Do I need glasses after?"])
    if "INSURANCE" in topics:
        suggestions.extend(["Is it covered by insurance?", "What is the cost?"])
    if "RECOVERY" in topics:
        suggestions.extend(["When can I drive?", "Can I watch TV?"])
    
    # Defaults if no specific topics or few suggestions
    if len(suggestions) < 2:
        suggestions.extend(["Tell me more.", "What are the risks?"])
    
    return list(set(suggestions))[:3]


def _generate_followup_questions(
    question: str,
    answer_text: str,
    topics: list[str],
    config: ModelConfig,
) -> list[str]:
    """Small LLM call to propose 3 tailored follow-ups."""
    model_ref = (
        f"{config.provider}/{config.model}" if config.provider != "gemini" else f"gemini/{config.model}"
    )
    prompt = f"""
You just answered a patient about cataract care.
User question: "{question}"
Your answer: "{answer_text[:500]}..."
Topics: {', '.join(topics) if topics else 'GENERAL'}

Propose 3 short, natural follow-up questions the patient might ask next.
RULES:
1. Do NOT repeat "{question}".
2. If the answer mentioned a specific risk or step, suggest a question about that.
3. Keep it simple (grade 8 reading level).
4. Max 10 words per question.

Return ONLY a JSON array of strings: ["Question 1", "Question 2", "Question 3"]
"""
    try:
        response = litellm.completion(
            model=model_ref,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=150,
        )
        raw = response["choices"][0]["message"]["content"].strip()
        if raw.startswith("```"):
            raw = raw.strip("`").strip()
            if raw.lower().startswith("json"):
                raw = raw[4:].strip()
        followups = json.loads(raw)
        if isinstance(followups, list):
            return [str(f).strip() for f in followups if str(f).strip()][:3]
    except Exception as exc:
        print(f"[Followup Gen Error] {exc}")
    return []


def _strip_embedded_suggestions(answer_text: str) -> str:
    """
    If the answer text still contains an embedded JSON snippet with "suggestions",
    strip it out so the user does not see raw JSON.
    """
    if not isinstance(answer_text, str):
        return answer_text
    if "suggestions" not in answer_text:
        return answer_text
    # Remove trailing suggestions array if present
    cleaned = re.sub(
        r'"?\s*,?\s*"?suggestions"?\s*:\s*\[.*?\]\s*\}?\s*$',
        "",
        answer_text,
        flags=re.IGNORECASE | re.DOTALL,
    ).strip()
    # If it's still a JSON-ish block with "answer", try to extract the answer
    if cleaned.startswith("{") and "\"answer\"" in cleaned:
        match = re.search(r'"answer"\s*:\s*"(.+)"', cleaned, flags=re.DOTALL)
        if match:
            cleaned = match.group(1).strip()
    return cleaned


def _generate_answer_from_prompt(prompt: str, config: ModelConfig) -> str:
    model_ref = (
        f"{config.provider}/{config.model}" if config.provider != "gemini" else f"gemini/{config.model}"
    )
    try:
        response = litellm.completion(
            model=model_ref,
            messages=[
                {
                    "role": "system",
                    "content": """You are a cataract surgery counselling assistant for patients. 

TONE: Warm, reassuring, conversational
LANGUAGE: Simple terms (8th grade reading level)
LENGTH: Concise - answer in 2-4 paragraphs (50-200 words)
STRUCTURE: Use natural paragraphs. Bullet points are fine for lists of items (risks, steps, options). Avoid section headers like 'Short answer:' or 'Next steps:'
CITATIONS: When citing facts, use simple source tags like [General Knowledge] or [Your Record]. Avoid technical IDs like "Chunk 3".

Be honest about information gaps, but don't offer unrequested tasks like drafting questions.""",
                }
                ,
                {"role": "user", "content": prompt},
            ],
            temperature=config.temperature,
        )
    except Exception as exc:
        print(f"[Answer Error] {exc}")
        raise HTTPException(status_code=500, detail="LLM generation failed") from exc

    try:
        answer_text = response["choices"][0]["message"]["content"]
        # print("[Final Answer]\n", answer_text, "\n")
        return answer_text
    except (KeyError, IndexError) as exc:
        print(f"[Answer Parse Error] {exc}")
        raise HTTPException(status_code=500, detail="LLM response parsing failed") from exc


def _generate_all_modules_content(module_titles: list[str], patient: dict, config: ModelConfig) -> dict:
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


def _get_missing_modules(patient: dict, module_cache: dict | None = None) -> tuple[list[str], dict]:
    """Return (missing_titles, module_cache) for the patient."""
    if module_cache is None:
        if isinstance(patient.get("module_content"), dict):
            module_cache = patient["module_content"]
        elif isinstance(patient.get("extra"), dict) and isinstance(patient["extra"].get("module_content"), dict):
            module_cache = patient["extra"]["module_content"]
        else:
            module_cache = {}

    def has_module(title: str) -> bool:
        key = _normalize_module_title(title)
        return bool(module_cache.get(title) or module_cache.get(key))

    missing = [t for t in MODULE_TITLES if not has_module(t)]
    return missing, module_cache


def _generate_and_save_missing(patient_id: str, patient: dict, missing_titles: list[str], config: ModelConfig) -> list[str]:
    """Generate all missing modules and save them. Returns list of titles saved."""
    if not missing_titles:
        return []
    generated_map = _generate_all_modules_content(missing_titles, patient, config)
    saved = []
    for title, content in generated_map.items():
        key = _normalize_module_title(title)
        try:
            save_patient_module_content(patient_id, key, content)
            saved.append(title)
        except Exception as exc:
            print(f"[ModuleContent] Save failed for '{title}': {exc}")
    return saved


def _generate_modules_background(patient_id: str, config: ModelConfig) -> None:
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
        missing, module_cache = _get_missing_modules(patient)
        
        if not missing:
            print(f"[Background Module Gen] All modules already exist for patient: {patient_id}")
            return
        
        print(f"[Background Module Gen] Generating {len(missing)} modules for patient: {patient_id}")
        
        # Generate and save
        saved = _generate_and_save_missing(patient_id, patient, missing, config)
        
        print(f"[Background Module Gen] Completed for patient: {patient_id} - Saved: {saved}")
        
    except Exception as exc:
        # Log error but don't raise - this is a background task
        # The frontend fallback will handle generation if this fails
        print(f"[Background Module Gen] ERROR for patient {patient_id}: {exc}")
        traceback.print_exc()




def _generate_answer_with_history(
    context_prompt: str,
    chat_history: list[dict],
    config: ModelConfig,
    topics: list[str] | None = None,
    question: str | None = None,
) -> tuple[str, list[str]]:
    """Generate answer and contextual follow-ups with conversation history.
    
    Returns:
        (answer_text, suggestions)
    """
    t_start = time.perf_counter()
    model_ref = (
        f"{config.provider}/{config.model}" if config.provider != "gemini" else f"gemini/{config.model}"
    )
    
    # Build messages array with system prompt
    messages = [
        {
            "role": "system",
            "content": """You are a cataract surgery counselling assistant for patients. You have access to the patient's complete medical record.

TONE: Warm, reassuring, conversational - speak like a caring nurse who KNOWS this patient
LANGUAGE: Simple terms (8th grade reading level)
LENGTH: Concise - aim for 100-150 words, max 200 words

ANSWER STRUCTURE (Teach-Then-Apply):
When answering medical questions, follow this pattern:
1. EDUCATE: Briefly explain the general concept (1-2 sentences)
2. VARIATIONS: If multiple types/options exist, mention them briefly
3. PERSONALIZE: Connect to THIS patient's specific situation (their lens choice, diagnosis type, surgery approach)
4. IMPLICATION: What this means for them specifically

Example for "How is cataract surgery performed?":
- General: "Cataract surgery removes your cloudy lens and replaces it with an artificial one."
- Variations: "There are two approaches: traditional (ultrasound) and laser-assisted."
- Personal: "For you, Dr. [Name] has recommended laser-assisted surgery..."
- Implication: "This precision helps position your trifocal toric lens accurately."

DO NOT give only generic answers when patient data is available. The patient should feel the bot KNOWS them.

FORMATTING: 
- Use double line breaks between paragraphs
- Use **bold** for key medical terms and the patient's specific choices
- Avoid section headers like 'Short answer:' or 'Next steps:'

CITATIONS: Do NOT add citation tags in the answer.

Be honest about information gaps, but don't offer unrequested tasks like drafting questions.""",
        }
    ]
    
#     CITATIONS: 
# - Cite major facts, not every sentence
# - Use ONE tag per claim: [General Knowledge], [Clinic Info], or [Your Record]
# - Avoid stacking citations like '[Your Record], [General Knowledge]'
    # Add conversation history (map "bot" role to "assistant" for LLM)
    for entry in chat_history:
        if entry["role"] == "user":
            messages.append({"role": "user", "content": entry["text"]})
        elif entry["role"] == "bot":
            # LLM APIs use "assistant" role, not "bot"
            messages.append({"role": "assistant", "content": entry["text"]})
    
    # Add current question with RAG context
    # Ask for structured JSON with blocks for elderly-friendly formatting
    messages.append(
        {
            "role": "user",
            "content": f"""{context_prompt}

Return a strict JSON object with:
- blocks: an array of content blocks. Each block must have a "type" field.
  
  BLOCK TYPES (choose the best fit for your answer):
  
  1. "text" - Standard paragraph (2-3 sentences max per block)
     Fields: "content" (string with **bold** for key medical terms)
     Use for: Explanations, definitions, background info
  
  2. "heading" - Section title to break up long answers
     Fields: "content" (string, keep short)
     Use for: When answer has multiple parts
  
  3. "list" - Bulleted list of items
     Fields: "title" (optional string), "items" (array of strings)
     Use for: Symptoms, benefits, risks, features, options
  
  4. "numbered_steps" - Step-by-step instructions
     Fields: "title" (optional string), "steps" (array of strings)
     Use for: Procedures, pre-op instructions, "how to" questions
  
  5. "callout" - Important information box
     Fields: "content" (string)
     Use for: Key takeaways, tips, things to remember
  
  6. "warning" - Alert/caution box
     Fields: "content" (string)
     Use for: Things to avoid, when to call doctor, urgent concerns
  
  7. "timeline" - Before/During/After flow
     Fields: "phases" (array of objects with "phase" and "description")
     Use for: Surgery timeline, recovery stages

FORMATTING RULES:
- Start with "text" block for context (1-2 sentences)
- Use "list" or "numbered_steps" for any items/steps (makes scanning easier)
- End with "callout" or "warning" if there's a key takeaway
- Keep text blocks SHORT (2-3 sentences max) - patients are 50+ years old
- Use **bold** for all medical terms and important phrases

EXAMPLE for "What are cataract symptoms?":
{{
  "blocks": [
    {{
      "type": "text",
      "content": "When you have a **cataract**, the clear lens inside your eye becomes cloudy. This causes several changes in your vision."
    }},
    {{
      "type": "list",
      "title": "Common Symptoms",
      "items": [
        "**Blurry or hazy vision**, especially for reading",
        "**Faded colors** that look yellowish or brownish",
        "**Difficulty seeing at night** or in dim light",
        "**Sensitivity to glare** from headlights or sunlight",
        "Seeing **halos** around lights"
      ]
    }},
    {{
      "type": "warning",
      "content": "If you notice **sudden vision loss** or **eye pain**, contact your eye doctor immediately. These may indicate other serious conditions."
    }}
  ],
  "suggestions": ["How is cataract surgery performed?", "What causes cataracts?", "How long is recovery?"]
}}

- suggestions: array of 3 short follow-up questions (5-10 words each)
  - Do NOT repeat the current question
  - Suggest logical next topics

JSON only, no prose, no markdown fences.""",
        }
    )
    
    # Log for debugging
    history_count = len([m for m in messages if m["role"] in ["user", "assistant"]])
    print(f"[LLM Call] Sending {history_count} conversation messages (including current)")
    
    try:
        t_llm_start = time.perf_counter()
        response = litellm.completion(
            model=model_ref,
            messages=messages,
            temperature=config.temperature,
        )
        print(f"####### timing llm.chat_ms={(time.perf_counter() - t_llm_start)*1000:.1f}")
    except Exception as exc:
        print(f"[Answer Error] {exc}")
        raise HTTPException(status_code=500, detail="LLM generation failed") from exc
    
    raw = ""
    parsed = {}
    json_parsed_successfully = False
    parse_start = time.perf_counter()
    blocks = []
    answer_text = ""
    suggestions = []
    
    def _sanitize_control_chars(text: str) -> str:
        # Replace unescaped control characters that break JSON parsing
        return re.sub(r"[\x00-\x1f\x7f]", " ", text)

    try:
        raw = response["choices"][0]["message"]["content"].strip()
        print(f"[LLM Raw Response Length] {len(raw)} chars")

        # Strip optional code fences
        if raw.startswith("```"):
            raw = raw.strip("`").strip()
            if raw.lower().startswith("json"):
                raw = raw[4:].strip()

        # Attempt direct JSON parse
        try:
            parsed = json.loads(raw)
            json_parsed_successfully = True
            print("[JSON Parse] Success - parsed as valid JSON")
        except json.JSONDecodeError:
            # Try sanitized control characters
            try:
                sanitized = _sanitize_control_chars(raw)
                parsed = json.loads(sanitized)
                json_parsed_successfully = True
                print("[JSON Parse] Success after sanitizing control chars")
            except Exception:
                # Try to extract the first JSON object in the text
                match = re.search(r"\{.*\}", raw, re.DOTALL)
                if match:
                    try:
                        parsed = json.loads(_sanitize_control_chars(match.group(0)))
                        json_parsed_successfully = True
                        print("[JSON Parse] Success - extracted JSON from text")
                    except Exception:
                        parsed = {}
                        print("[JSON Parse] Extracted JSON failed to parse after sanitize")
                else:
                    parsed = {}
                    print("[JSON Parse] Failed - no valid JSON found")
                
        # Extract blocks and suggestions from parsed JSON
        blocks = parsed.get("blocks", [])
        suggestions = parsed.get("suggestions") or parsed.get("followups") or []
        
        # For backward compatibility and logging, create answer_text from blocks
        answer_text = ""
        if blocks:
            parts = []
            for b in blocks:
                b_type = b.get("type", "")
                if b_type in ["text", "callout", "warning"]:
                    parts.append(b.get("content", ""))
                elif b_type == "heading":
                    parts.append(f"## {b.get('content', '')}")
                elif b_type == "list":
                    if b.get("title"):
                        parts.append(b.get("title"))
                    items = b.get("items", [])
                    parts.append("\n".join([f"- {item}" for item in items]))
                elif b_type == "numbered_steps":
                    if b.get("title"):
                        parts.append(b.get("title"))
                    steps = b.get("steps", [])
                    parts.append("\n".join([f"{i+1}. {step}" for i, step in enumerate(steps)]))
                elif b_type == "timeline":
                    phases = b.get("phases", [])
                    for phase in phases:
                        parts.append(f"{phase.get('phase', '')}: {phase.get('description', '')}")
            answer_text = "\n\n".join(filter(None, parts))
        else:
            # Fallback to old format if blocks not present
            answer_text = parsed.get("answer") or parsed.get("response") or parsed.get("text") or ""
        
        print(f"[Extraction] blocks count: {len(blocks)}, answer_text length: {len(answer_text)}, suggestions count: {len(suggestions)}")
        
    except Exception as exc:
        print(f"[Answer Parse Error] {exc}")
        answer_text = ""
        suggestions = []
        json_parsed_successfully = False
    finally:
        print(f"####### timing llm.parse_ms={(time.perf_counter() - parse_start)*1000:.1f}")

    # If JSON parse failed, attempt a regex extraction of answer/suggestions from messy text
    if not json_parsed_successfully and raw:
        regex_start = time.perf_counter()
        sanitized = _sanitize_control_chars(raw)
        if not answer_text:
            m = re.search(r'"answer"\s*:\s*"(.+?)"', sanitized, flags=re.DOTALL)
            if m:
                answer_text = m.group(1).strip().replace('\\"', '"')
                print("[Regex Extract] Pulled answer from messy JSON")
        if not suggestions:
            m = re.search(r'"suggestions"\s*:\s*\[(.*?)\]', sanitized, flags=re.DOTALL)
            if m:
                items = m.group(1)
                parts = re.findall(r'"(.*?)"', items, flags=re.DOTALL)
                suggestions = [p.strip() for p in parts if p.strip()]
                print(f"[Regex Extract] Pulled {len(suggestions)} suggestions from messy JSON")
        print(f"####### timing llm.regex_extract_ms={(time.perf_counter() - regex_start)*1000:.1f}")

    # Ensure we have at least one block if we have answer_text
    if not blocks and answer_text:
        blocks = [{"type": "text", "content": answer_text}]
        print("[Fallback] Created text block from answer_text")
    
    # Fallback for empty answer
    if not blocks:
        if json_parsed_successfully:
            # JSON parsed but blocks field was empty/missing
            answer_text = "I'm sorry, I couldn't format my response properly. Please try asking again."
            print("[Fallback] JSON parsed but blocks empty - using error message")
        else:
            # JSON parsing failed completely - try to use raw text if it looks like prose
            if raw and not raw.startswith("{"):
                answer_text = raw
                print("[Fallback] Using raw text as answer")
            else:
                answer_text = "I'm sorry, I couldn't compose a full answer just now. Please try again."
                print("[Fallback] Complete failure - using generic error")
        blocks = [{"type": "text", "content": answer_text}]
    # Remove any embedded suggestions JSON that might have leaked into answer_text
    answer_text = _strip_embedded_suggestions(answer_text)
    if not isinstance(suggestions, list):
        suggestions = []
    suggestions = [str(s).strip() for s in suggestions if str(s).strip()]
    
    print(f"[Suggestions] Raw from LLM: {suggestions}")
    
    # Build exclusion set: current question + recent questions from history
    exclusions = set()
    if question:
        exclusions.add(question.strip().lower())
    for msg in chat_history[-5:]:  # Last 5 user messages
        if msg.get("role") == "user":
            exclusions.add(msg.get("text", "").strip().lower())
    
    # Filter out suggestions that are too similar to exclusions
    def is_duplicate(suggestion: str) -> bool:
        s_lower = suggestion.lower().strip()
        for excl in exclusions:
            # Exact match or very high overlap
            if s_lower == excl or excl in s_lower or s_lower in excl:
                return True
        return False
    
    filtered = [s for s in suggestions if not is_duplicate(s)]
    print(f"[Suggestions] After filtering duplicates: {filtered}")
    
    # Only use fallbacks if we have fewer than 3 good suggestions
    if len(filtered) < 3:
        print("[Suggestions] Invoking fallback generator")
        fallback_start = time.perf_counter()
        fallback = _generate_followup_questions(
            question or "",
            answer_text,
            topics or [],
            config,
        )
        print(f"####### timing llm.fallback_followup_ms={(time.perf_counter() - fallback_start)*1000:.1f}")
        for f in fallback:
            if not is_duplicate(f) and f not in filtered:
                filtered.append(f)
    
    if len(filtered) < 3:
        print("[Suggestions] Invoking heuristic fallback")
        heuristic_start = time.perf_counter()
        heuristic = _generate_suggestions(topics or [])
        print(f"####### timing llm.heuristic_ms={(time.perf_counter() - heuristic_start)*1000:.1f}")
        for h in heuristic:
            if not is_duplicate(h) and h not in filtered:
                filtered.append(h)
    
    # Deduplicate within filtered and trim to 3
    dedup = []
    for s in filtered:
        if s and s not in dedup:
            dedup.append(s)
    final_suggestions = dedup[:3]

    # print("[Final Answer]\n", answer_text, "\n")
    print(f"[Blocks] Count: {len(blocks)}")
    print(f"[Suggestions] Final: {final_suggestions}")
    print(f"####### timing llm.total_ms={(time.perf_counter() - t_start)*1000:.1f}")
    return answer_text, final_suggestions, blocks
