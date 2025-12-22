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
from fastapi import Depends, FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from adk_app.config import ModelConfig
from adk_app.orchestration.pipeline import ContextPackage, prepare_context
from adk_app.utils.data_loader import get_patient_data, get_all_patients, save_patient_chat_history, save_patient_module_content, get_clinic_data
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
    Post-process extracted data to ensure consistency:
    - Standardize date formats to ISO 8601 (YYYY-MM-DD)
    - Normalize capitalization
    - Validate lens options against standard list
    - Clean up whitespace
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

    # Helper: normalize lens name to standard vocabulary
    def normalize_lens_name(lens_name: str) -> str:
        if not lens_name:
            return ""
        lens_name = lens_name.strip()
        # Fuzzy match to standard options
        lens_lower = lens_name.lower()
        for std_lens in STANDARD_LENS_OPTIONS:
            if std_lens.lower() in lens_lower or lens_lower in std_lens.lower():
                return std_lens
        return lens_name  # Return as-is if no match (doctor can override in UI)

    # Normalize patient identity
    if "patient_identity" in data:
        identity = data["patient_identity"]
        if "dob" in identity:
            identity["dob"] = normalize_date(identity["dob"])
        if "gender" in identity:
            gender = identity["gender"].strip()
            # Capitalize first letter
            identity["gender"] = gender.capitalize() if gender else ""
    
    # Normalize lifestyle (capitalize hobbies)
    if "lifestyle" in data:
        lifestyle = data["lifestyle"]
        if "hobbies" in lifestyle and isinstance(lifestyle["hobbies"], list):
            lifestyle["hobbies"] = [h.strip().capitalize() for h in lifestyle["hobbies"] if h]
    
    # Normalize surgical recommendations
    if "surgical_recommendations_by_doctor" in data:
        recs = data["surgical_recommendations_by_doctor"]
        
        # Normalize recommended lens options
        if "recommended_lens_options" in recs and isinstance(recs["recommended_lens_options"], list):
            for lens_option in recs["recommended_lens_options"]:
                if "name" in lens_option:
                    lens_option["name"] = normalize_lens_name(lens_option["name"])
        
        # Normalize scheduling dates
        if "scheduling" in recs:
            schedule = recs["scheduling"]
            for date_field in ["surgery_date", "pre_op_start_date", "post_op_visit_1", "post_op_visit_2"]:
                if date_field in schedule and schedule[date_field]:
                    schedule[date_field] = normalize_date(schedule[date_field])
    
    # Normalize document dates
    if "documents" in data and "signed_consents" in data["documents"]:
        for consent in data["documents"]["signed_consents"]:
            if "date" in consent and consent["date"]:
                consent["date"] = normalize_date(consent["date"])
    
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

    # Patient extraction prompt (default)
    return f"""
ROLE:
You are an expert Surgical Counselor. Your job is to extract *precise* medical data. You must prioritize **specificity** over generic terms.

INPUT CONTEXT:
1. **EMR Visit Notes:** Look for the "Assessment" or "Impression" section.
2. **Biometry:** Look for IOL Master / Lenstar reports.
3. **Questionnaire:** Look for patient-checked boxes.
4. **Surgical Recommendations:** Look for the "Surgical Recommendations" section.

CRITICAL EXTRACTION RULES (Must Follow):

1. **DIAGNOSIS SPECIFICITY (Patient-Facing Primary Type):**
   - **DO NOT** return just "Cataract" or "Senile Cataract" if a more specific type is visible.
   - **DO NOT** return the full bilateral breakdown (OD/OS with multiple components).
   - **EXTRACT:** The PRIMARY pathology type mentioned in the Plan/Counseling section for patient communication.
   - **LOOK FOR:** "Nuclear Sclerosis", "NS", "Cortical", "Posterior Subcapsular", "PSC", "Mature" in the counseling/plan text.
   - **Example:** If counseling says "Combined form of senile cataract... Nuclear Sclerosis 1-2+", extract ONLY "Nuclear Sclerosis (1-2+)".
   - **NOT:** "Nuclear Sclerosis (1-2+), Cortical (2+) OD; Cortical (1+)..."
   - If "Phakic" is mentioned under "Lens Status", map it to `anatomical_status`.

2. **LIFESTYLE & HOBBIES (Strict Source Mapping with Context):**
   - **DO NOT** guess hobbies (e.g., Golf, Tennis) unless they are explicitly circled or written.
   - **DO NOT** hallucinate scores (e.g., "7/10") from external knowledge. Only extract what is written.
   - **Visual Priorities:** Look for checkboxes AND associated activities (e.g., "Distance Vision" + "Driving, Golf, TV").
     - Extract as: "Distance Vision (Driving, Golf, TV)" if activities are listed
     - Extract as: "Distance Vision" if no specific activities are checked
   - **Hobbies:** Only include activities written in the "Hobbies" section (e.g., Reading, Music).

3. **MEDICAL HISTORY (Pertinent Negatives):**
   - You MUST extract "Negative" findings if they are clinically relevant.
   - **Example:** If EMR says "No Diabetes", "No Glaucoma", include these in `systemic_conditions` as "No diabetes", "No glaucoma". Do not ignore them.

4. **SURGICAL PREFERENCE (Ambiguity Handling):**
   - If multiple lens options are marked, include ALL of them in `recommended_lens_options`.
   - Only set `is_selected_preference: true` if there is a distinct indicator (Star, Signature, "Plan A"). If ambiguous, set to `null`.

5. **MEASUREMENTS:**
   - Extract `axial_length_mm` and `astigmatism_power` as floats.

6. **DATA STANDARDIZATION (Critical for UI Display):**
   - **Dates:** ALWAYS use ISO 8601 format: YYYY-MM-DD (e.g., "1956-01-20" not "01/20/1956")
   - **Gender:** Use "Male", "Female", or "Other" (capitalize first letter)
   - **Hobbies:** Capitalize first letter (e.g., "Reading", "Music", "Walking")
   - **Lens Options:** Use ONLY these standardized names when extracting recommended_lens_options:
     • "Monofocal"
     • "Monofocal Toric"
     • "EDOF (Extended Depth of Focus)"
     • "EDOF Toric"
     • "Multifocal"
     • "Multifocal Toric"
     • "Trifocal"
     • "Trifocal Toric"
     • "LAL (Light Adjustable Lens)"
     • "LAL Toric"
   - If a lens type doesn't exactly match, choose the closest standard name from the list above.

OUTPUT FORMAT:
Return ONLY a valid JSON object matching the schema.

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
    router_model = os.getenv("ROUTER_MODEL", config.model)
    print(
        "[Model Config] provider="
        f"{config.provider} model={config.model} temperature={config.temperature}"
    )
    print(f"[Router Config] provider={router_provider} model={router_model}")
    return AgentRuntime(config=config)


app = FastAPI(title="Cataract Counsellor API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173",
    "https://cataract-p9pks1uzc-srinivas831s-projects.vercel.app", 
    "https://cataract-8p61yr28h-srinivas831s-projects.vercel.app",
    "https://cataract-ui.vercel.app",
    "https://cataract-ebkhf3zpw-srinivas831s-projects.vercel.app"],
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


@app.get("/clinics/{clinic_id}")
def get_clinic(clinic_id: str) -> dict:
    """Return full details for a specific clinic."""
    try:
        clinic = get_clinic_data(clinic_id)
        # Prefer returning the original schema when available
        return clinic.get("extra") or clinic
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err))


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
        schema = _load_schema("patient_schema.json")
        prompt = _build_extraction_prompt(schema, scope="Patient")
        extraction = _vision_extract(images, prompt, vision_model)
        # Normalize extracted data for consistency and fill any missing keys using schema template
        extraction = _normalize_extracted_data(extraction)
        extraction = _apply_schema_template("patient_schema.json", extraction)

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
    path = UPLOAD_ROOT / clinic_id / patient_id / "extracted_patient.json"
    data = _read_json_or_404(path, "Extracted patient JSON")
    return {"status": "ok", "extracted_path": str(path), "extracted": data}


@app.get("/doctor/extractions/clinic")
async def get_extracted_clinic(clinic_id: str) -> dict:
    path = UPLOAD_ROOT / clinic_id / "clinic" / "extracted_clinic.json"
    data = _read_json_or_404(path, "Extracted clinic JSON")
    return {"status": "ok", "extracted_path": str(path), "extracted": data}


@app.get("/doctor/reviewed/patient")
async def get_reviewed_patient(clinic_id: str, patient_id: str) -> dict:
    path = REVIEW_ROOT / clinic_id / patient_id / "reviewed_patient.json"
    data = _read_json_or_404(path, "Reviewed patient JSON")
    return {"status": "ok", "reviewed_path": str(path), "reviewed": data}


@app.get("/doctor/reviewed/clinic")
async def get_reviewed_clinic(clinic_id: str) -> dict:
    path = REVIEW_ROOT / clinic_id / "reviewed_clinic.json"
    data = _read_json_or_404(path, "Reviewed clinic JSON")
    return {"status": "ok", "reviewed_path": str(path), "reviewed": data}


@app.post("/doctor/review/patient")
async def save_reviewed_patient(payload: ReviewedPatientPayload) -> dict:
    base_dir = _ensure_dir(REVIEW_ROOT / payload.clinic_id / payload.patient_id)
    payload_data = payload.data if isinstance(payload.data, dict) else {}
    reviewed = _normalize_extracted_data(payload_data)
    reviewed = _apply_schema_template("patient_schema.json", reviewed)
    target = base_dir / "reviewed_patient.json"
    with open(target, "w", encoding="utf-8") as f:
        json.dump(reviewed, f, ensure_ascii=False, indent=2)
    return {"status": "ok", "reviewed_path": str(target), "reviewed": reviewed}


@app.delete("/doctor/patient")
async def delete_patient_data(clinic_id: str, patient_id: str) -> dict:
    """
    Delete all stored data for a patient (uploads and reviewed).
    """
    upload_dir = UPLOAD_ROOT / clinic_id / patient_id
    reviewed_dir = REVIEW_ROOT / clinic_id / patient_id
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
        print("[Final Answer]\n", answer_text, "\n")
        return answer_text
    except (KeyError, IndexError) as exc:
        print(f"[Answer Parse Error] {exc}")
        raise HTTPException(status_code=500, detail="LLM response parsing failed") from exc


def _generate_module_content(module_title: str, patient: dict, config: ModelConfig) -> dict:
    """Generate patient-specific module content for the dashboard cards."""
    model_ref = (
        f"{config.provider}/{config.model}" if config.provider != "gemini" else f"gemini/{config.model}"
    )

    # Build a slimmed patient payload for the prompt (drop chat_history, module_content, extra)
    patient_copy = dict(patient)
    patient_copy.pop("chat_history", None)
    patient_copy.pop("module_content", None)
    patient_copy.pop("extra", None)
    patient_json = json.dumps(patient_copy, indent=2)[:4000]
    print(f"[ModuleContent] model={model_ref} temp={config.temperature} patient_json_len={len(patient_json)}")

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
Module: "{module_title}"

Patient facts (MUST USE for personalization):
{patient_facts_json}

Clinic Standard Procedures & Pricing (MUST USE for checklists/timelines):
{clinic_context_json}

Full patient data (for context):
{patient_json}

CRITICAL REQUIREMENTS:
1. SUMMARY: Must explicitly mention patient-specific details when relevant.
2. DETAILS: 3-5 bullet points.
3. FAQs: 3-4 questions STRICTLY about THIS module only.
4. Use **bold** for medical terms.

SPECIALIZED CONTENT:
- If Module is "Before Surgery" or "After Surgery":
  - Populate "checklist" field using clinic 'pre_op' or 'post_op' data.
- If Module is "Day of Surgery":
  - Populate "timeline" field using clinic 'timeline' data.
- If Module is "Risks & Complications":
  - Populate "risks" field using clinic 'risks' data.
- If Module is "Costs & Insurance":
  - Populate "costBreakdown" field using clinic 'pricing_options' for patient's package ({surgery.get('selected_package_id')}).

Return JSON with:
- title: string
- summary: 2-3 sentences
- details: array of strings
- faqs: array of {{question, answer}}
- checklist: array of strings (optional)
- timeline: array of {{step, description}} (optional)
- risks: array of {{category, items}} (optional)
- costBreakdown: array of {{category, amount, covered, note}} (optional)
- videoScriptSuggestion: short description string
- botStarterPrompt: a suggested question about this module
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
        print(f"[Module Content Error] {exc}")
        raise HTTPException(status_code=500, detail="Module content generation failed") from exc

    try:
        content_text = response["choices"][0]["message"]["content"]
        # print(f"[ModuleContent Raw]\n{content_text}\n")

        # Some providers may wrap JSON in code fences; strip if present
        cleaned = content_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`").strip()
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].strip()
        parsed = json.loads(cleaned)
        return parsed
    except Exception as exc:
        print(f"[Module Content Parse Error] {exc}")
        # Fallback minimal shape
        return {
            "title": module_title,
            "summary": "Unable to load personalized content right now.",
            "details": ["Please try again soon.", "If urgent, ask your care team."],
            "faqs": [],
            "videoScriptSuggestion": "Standard medical disclaimer video.",
            "botStarterPrompt": f"Tell me more about {module_title}",
        }


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
            "content": """You are a cataract surgery counselling assistant for patients. 

TONE: Warm, reassuring, conversational
LANGUAGE: Simple terms (8th grade reading level)
LENGTH: Concise - aim for 100-150 words, max 200 words
FORMATTING: 
- Use double line breaks between paragraphs
- You MAY use **bold** for emphasis on key terms
- Avoid section headers like 'Short answer:' or 'Next steps:'
CITATIONS:
- Do NOT add citation tags in the answer.

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

    print("[Final Answer]\n", answer_text, "\n")
    print(f"[Blocks] Count: {len(blocks)}")
    print(f"[Suggestions] Final: {final_suggestions}")
    print(f"####### timing llm.total_ms={(time.perf_counter() - t_start)*1000:.1f}")
    return answer_text, final_suggestions, blocks
