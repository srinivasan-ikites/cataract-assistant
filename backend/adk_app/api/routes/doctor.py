"""
Doctor/Admin routes for uploads, extractions, and reviews.

All patient data is read from and written to Supabase (source of truth).
Local JSON files are optional (controlled by SAVE_EXTRACTION_JSON env var)
and exist only for debugging/recovery purposes.

SECURITY: All routes require authentication and validate clinic access.
"""
from __future__ import annotations

import json
import os
import shutil
import traceback
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks

from adk_app.core.config import UPLOAD_ROOT, REVIEW_ROOT, MAX_UPLOAD_FILES, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB
from adk_app.core.dependencies import AgentRuntime, get_runtime
from adk_app.core.normalization import normalize_extracted_data
from adk_app.core.schema_utils import ensure_dir, load_schema, apply_schema_template, read_json_or_404
from adk_app.models.requests import ReviewedPatientPayload, ReviewedClinicPayload
from adk_app.services.extraction_service import (
    build_extraction_prompt,
    vision_extract,
    generate_clinical_alerts,
)
# Use Supabase data loader for patient and clinic data
from adk_app.utils.supabase_data_loader import (
    get_patient_data,
    clear_patient_cache,
    update_patient_from_reviewed,
    update_clinic_from_reviewed,
    save_extraction_to_patient,
)
# Module generation service
from adk_app.services.module_service import (
    generate_modules_background,
    has_diagnosis_changed,
    should_generate_diagnosis_module,
)
# Supabase service for storage and database operations
from adk_app.services.supabase_service import SupabaseService, get_supabase_admin_client
# Authentication middleware
from adk_app.api.middleware.auth import (
    AuthenticatedUser,
    require_clinic_user,
    validate_clinic_access,
)

# Storage bucket name for patient documents
PATIENT_DOCUMENTS_BUCKET = "patient-documents"

router = APIRouter(prefix="/doctor", tags=["Doctor"])


def _to_schema_format(patient: dict, clinic_id: str) -> dict:
    """
    Remap get_patient_data() output (frontend format) to schema format
    that the doctor portal's PatientOnboarding.tsx expects.

    Only 2 fields differ:
      - frontend: name.first/last    → schema: patient_identity.first_name/last_name
      - frontend: medications         → schema: medications_plan
    """
    name = patient.get("name", {})
    return {
        "patient_identity": {
            "first_name": name.get("first", ""),
            "last_name": name.get("last", ""),
            "dob": patient.get("dob", ""),
            "gender": patient.get("gender", ""),
            "patient_id": patient.get("patient_id", ""),
            "clinic_ref_id": clinic_id,
        },
        "medical_profile": patient.get("medical_profile", {}),
        "clinical_context": patient.get("clinical_context", {}),
        "lifestyle_profile": patient.get("lifestyle_profile", {}),
        "surgical_plan": patient.get("surgical_plan", {}),
        "medications_plan": patient.get("medications", {}),
        "module_content": patient.get("module_content", {}),
        "chat_history": patient.get("chat_history", []),
        "forms": patient.get("forms", {}),
    }


# -------------------------------
# Upload endpoints
# -------------------------------

@router.post("/uploads/patient")
async def doctor_upload_patient_docs(
    clinic_id: str = Form(...),
    patient_id: str = Form(...),
    files: List[UploadFile] = File(...),
    model: str | None = Form(None),
    runtime: AgentRuntime = Depends(get_runtime),
    user: AuthenticatedUser = Depends(require_clinic_user),  # AUTHENTICATION REQUIRED
) -> dict:
    """
    Upload EMR/biometry images for a patient and extract structured data to patient schema.

    Requires authentication. User can only upload to their own clinic.
    """
    # Validate clinic access - user can only upload to their own clinic
    validate_clinic_access(user, clinic_id)

    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
    if len(files) > MAX_UPLOAD_FILES:
        raise HTTPException(status_code=400, detail=f"Too many files. Max {MAX_UPLOAD_FILES}.")

    _ = runtime  # currently unused; kept for symmetry/config logging
    env_model = os.getenv("VISION_MODEL", "gemini-1.5-pro-latest")
    vision_model = model if model and model != "string" else env_model
    print(f"[Doctor Upload Patient] clinic={clinic_id} patient={patient_id} model={vision_model} env_model={env_model} files={len(files)}")

    # Read files into memory (no local storage - files go directly to Supabase bucket)
    images: list[dict] = []
    for idx, file in enumerate(files):
        content = await file.read()
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"File {file.filename} exceeds {MAX_UPLOAD_MB}MB limit",
            )
        content_type = file.content_type or "image/png"
        images.append({"bytes": content, "mime_type": content_type, "desc": file.filename or f"file_{idx}"})

    try:
        # Use extraction_schema_v2.json (clinical data only - no surgical/medications)
        schema = load_schema("extraction_schema_v2.json")
        prompt = build_extraction_prompt(schema, scope="Patient")
        extraction = vision_extract(images, prompt, vision_model)

        # Auto-generate clinical alerts from extracted data
        if "clinical_context" not in extraction:
            extraction["clinical_context"] = {}
        extraction["clinical_context"]["clinical_alerts"] = generate_clinical_alerts(extraction)

        # Normalize extracted data for consistency and fill any missing keys using schema template
        extraction = normalize_extracted_data(extraction)
        extraction = apply_schema_template("extraction_schema_v2.json", extraction)

        # Save extraction to Supabase patients table (primary storage)
        try:
            save_extraction_to_patient(clinic_id, patient_id, extraction)
            print(f"[Doctor Upload Patient] Extraction saved to Supabase for {clinic_id}/{patient_id}")
        except Exception as db_err:
            print(f"[Doctor Upload Patient] WARNING: Failed to save extraction to Supabase: {db_err}")
            traceback.print_exc()

        # Optional: Save extraction JSON locally for debugging/recovery (disabled in production)
        extracted_path = None
        if os.getenv("SAVE_EXTRACTION_JSON", "true").lower() == "true":
            base_dir = ensure_dir(UPLOAD_ROOT / clinic_id / patient_id)
            extracted_path = base_dir / "extracted_patient.json"
            with open(extracted_path, "w", encoding="utf-8") as f:
                json.dump(extraction, f, ensure_ascii=False, indent=2)

        # Upload files to Supabase Storage (primary storage)
        storage_paths = []
        storage_errors = []
        print(f"[Doctor Upload Patient] Starting Supabase Storage upload for {len(images)} files...")
        try:
            supabase_service = SupabaseService(use_admin=True)
            for idx, img in enumerate(images):
                # Create storage path: clinic_id/patient_id/filename
                original_filename = img.get("desc", f"file_{idx}")
                storage_path = f"{clinic_id}/{patient_id}/{original_filename}"

                print(f"[Doctor Upload Patient] Uploading file {idx+1}/{len(images)}: {storage_path}")
                uploaded_path = supabase_service.upload_file(
                    bucket=PATIENT_DOCUMENTS_BUCKET,
                    path=storage_path,
                    file_data=img["bytes"],
                    content_type=img["mime_type"]
                )
                if uploaded_path:
                    storage_paths.append(uploaded_path)
                    print(f"[Doctor Upload Patient] SUCCESS: {storage_path}")
                else:
                    storage_errors.append(storage_path)
                    print(f"[Doctor Upload Patient] FAILED: {storage_path}")
        except Exception as storage_err:
            print(f"[Doctor Upload Patient] Storage upload exception: {storage_err}")
            traceback.print_exc()
            storage_errors.append(f"Exception: {str(storage_err)}")

        if storage_errors:
            print(f"[Doctor Upload Patient] WARNING: {len(storage_errors)} files failed to upload to Supabase Storage")
        print(f"[Doctor Upload Patient] Storage upload complete: {len(storage_paths)} succeeded, {len(storage_errors)} failed")

        return {
            "status": "ok",
            "model_used": vision_model,
            "files_uploaded": len(storage_paths),
            "extracted_path": str(extracted_path) if extracted_path else None,
            "extracted": extraction,
            "storage_paths": storage_paths,
            "files": [img["desc"] for img in images],  # File names for recent uploads display
        }
    except Exception as exc:
        print(f"[Doctor Upload Patient Error] model={vision_model} err={exc}")
        traceback.print_exc()
        raise


@router.post("/uploads/clinic")
async def doctor_upload_clinic_docs(
    clinic_id: str = Form(...),
    files: List[UploadFile] = File(...),
    model: str | None = Form(None),
    runtime: AgentRuntime = Depends(get_runtime),
    user: AuthenticatedUser = Depends(require_clinic_user),  # AUTHENTICATION REQUIRED
) -> dict:
    """
    Upload clinic-level documents (one-time) and extract structured data to clinic schema.

    Requires authentication. User can only upload to their own clinic.
    """
    # Validate clinic access
    validate_clinic_access(user, clinic_id)

    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
    if len(files) > MAX_UPLOAD_FILES:
        raise HTTPException(status_code=400, detail=f"Too many files. Max {MAX_UPLOAD_FILES}.")

    _ = runtime  # currently unused; kept for symmetry/config logging
    env_model = os.getenv("VISION_MODEL", "gemini-1.5-pro-latest")
    vision_model = model if model and model != "string" else env_model
    print(f"[Doctor Upload Clinic] clinic={clinic_id} model={vision_model} env_model={env_model} files={len(files)}")

    # Read files into memory (no local storage)
    images: list[dict] = []
    for idx, file in enumerate(files):
        content = await file.read()
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"File {file.filename} exceeds {MAX_UPLOAD_MB}MB limit",
            )
        content_type = file.content_type or "image/png"
        images.append({"bytes": content, "mime_type": content_type, "desc": file.filename or f"file_{idx}"})

    try:
        schema = load_schema("clinic_schema.json")
        prompt = build_extraction_prompt(schema, scope="Clinic")
        extraction = vision_extract(images, prompt, vision_model)
        # Normalize extracted data for consistency and fill any missing keys using schema template
        extraction = normalize_extracted_data(extraction)
        extraction = apply_schema_template("clinic_schema.json", extraction)

        # Optional: Save extraction JSON locally for debugging/recovery
        extracted_path = None
        if os.getenv("SAVE_EXTRACTION_JSON", "true").lower() == "true":
            base_dir = ensure_dir(UPLOAD_ROOT / clinic_id / "clinic")
            extracted_path = base_dir / "extracted_clinic.json"
            with open(extracted_path, "w", encoding="utf-8") as f:
                json.dump(extraction, f, ensure_ascii=False, indent=2)

        return {
            "status": "ok",
            "model_used": vision_model,
            "files_processed": len(images),
            "extracted_path": str(extracted_path) if extracted_path else None,
            "extracted": extraction,
        }
    except Exception as exc:
        print(f"[Doctor Upload Clinic Error] model={vision_model} err={exc}")
        traceback.print_exc()
        raise


# -------------------------------
# Extraction retrieval endpoints
# -------------------------------

@router.get("/extractions/patient")
async def get_extracted_patient(
    clinic_id: str,
    patient_id: str,
    user: AuthenticatedUser = Depends(require_clinic_user),  # AUTHENTICATION REQUIRED
) -> dict:
    """Get extracted patient data from Supabase. Requires authentication."""
    validate_clinic_access(user, clinic_id)

    try:
        patient = get_patient_data(patient_id, clinic_id=clinic_id)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found in clinic '{clinic_id}'")

    # Remap from frontend format to schema format (doctor portal expects patient_identity, medications_plan)
    data = _to_schema_format(patient, clinic_id)
    return {"status": "ok", "extracted": data}


@router.get("/extractions/clinic")
async def get_extracted_clinic(
    clinic_id: str,
    user: AuthenticatedUser = Depends(require_clinic_user),  # AUTHENTICATION REQUIRED
) -> dict:
    """Get extracted clinic data from uploads. Requires authentication."""
    validate_clinic_access(user, clinic_id)
    path = UPLOAD_ROOT / clinic_id / "clinic" / "extracted_clinic.json"
    data = read_json_or_404(path, "Extracted clinic JSON")
    return {"status": "ok", "extracted_path": str(path), "extracted": data}


# -------------------------------
# Patient files endpoints
# -------------------------------

@router.get("/patient-files")
async def list_patient_files(
    clinic_id: str,
    patient_id: str,
    user: AuthenticatedUser = Depends(require_clinic_user),  # AUTHENTICATION REQUIRED
) -> dict:
    """
    List all uploaded files for a patient from Supabase Storage.

    Returns file names, sizes, and metadata for display in "Recent Uploads" section.
    Requires authentication. User can only list files from their own clinic.
    """
    validate_clinic_access(user, clinic_id)

    try:
        supabase_service = SupabaseService(use_admin=True)
        storage_path = f"{clinic_id}/{patient_id}"
        files = supabase_service.list_files(
            bucket=PATIENT_DOCUMENTS_BUCKET,
            path=storage_path
        )

        return {
            "status": "ok",
            "clinic_id": clinic_id,
            "patient_id": patient_id,
            "files": files,
            "count": len(files),
        }
    except Exception as exc:
        print(f"[List Patient Files Error] clinic={clinic_id} patient={patient_id} err={exc}")
        traceback.print_exc()
        return {
            "status": "error",
            "clinic_id": clinic_id,
            "patient_id": patient_id,
            "files": [],
            "count": 0,
            "error": str(exc),
        }


# -------------------------------
# Reviewed data endpoints
# -------------------------------

@router.get("/reviewed/patient")
async def get_reviewed_patient(
    clinic_id: str,
    patient_id: str,
    user: AuthenticatedUser = Depends(require_clinic_user),  # AUTHENTICATION REQUIRED
) -> dict:
    """Get reviewed patient data from Supabase. Requires authentication."""
    validate_clinic_access(user, clinic_id)

    try:
        patient = get_patient_data(patient_id, clinic_id=clinic_id)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found in clinic '{clinic_id}'")

    # Remap from frontend format to schema format (doctor portal expects patient_identity, medications_plan)
    data = _to_schema_format(patient, clinic_id)
    return {"status": "ok", "reviewed": data}


@router.get("/reviewed/clinic")
async def get_reviewed_clinic(
    clinic_id: str,
    user: AuthenticatedUser = Depends(require_clinic_user),  # AUTHENTICATION REQUIRED
) -> dict:
    """
    Get reviewed clinic data. Requires authentication.

    Now reads from Supabase instead of local JSON for consistency with doctor-context endpoint.
    Falls back to local JSON if Supabase fails (for backwards compatibility).
    """
    validate_clinic_access(user, clinic_id)

    # Try Supabase first (source of truth)
    try:
        from adk_app.utils.supabase_data_loader import get_clinic_data
        clinic_data = get_clinic_data(clinic_id)
        if clinic_data:
            print(f"[Get Reviewed Clinic] Loaded from Supabase: {clinic_id}")
            return {"status": "ok", "reviewed_path": "supabase", "reviewed": clinic_data}
    except Exception as e:
        print(f"[Get Reviewed Clinic] Supabase failed, falling back to local: {e}")

    # Fallback to local JSON
    path = REVIEW_ROOT / clinic_id / "reviewed_clinic.json"
    data = read_json_or_404(path, "Reviewed clinic JSON")
    return {"status": "ok", "reviewed_path": str(path), "reviewed": data}


@router.post("/review/patient")
async def save_reviewed_patient(
    payload: ReviewedPatientPayload,
    background_tasks: BackgroundTasks,
    runtime: AgentRuntime = Depends(get_runtime),
    user: AuthenticatedUser = Depends(require_clinic_user),  # AUTHENTICATION REQUIRED
) -> dict:
    """
    Save reviewed patient data (v2 schema).

    Requires authentication. User can only save to their own clinic.
    Primary storage: Supabase. Local JSON is optional (for debugging only).

    Expected payload.data structure:
    - Extraction data (patient_identity, medical_profile, clinical_context, lifestyle_profile)
    - Doctor-entered data (surgical_plan, medications_plan)
    """
    # Validate clinic access
    validate_clinic_access(user, payload.clinic_id)
    payload_data = payload.data if isinstance(payload.data, dict) else {}

    # Load existing patient data from Supabase BEFORE saving (to check for diagnosis changes)
    existing_data = None
    try:
        patient = get_patient_data(payload.patient_id, clinic_id=payload.clinic_id)
        if patient:
            existing_data = _to_schema_format(patient, payload.clinic_id)
            # Also carry over chat_history and module_content from DB
            existing_data["chat_history"] = patient.get("chat_history", [])
            existing_data["module_content"] = patient.get("module_content", {})
    except Exception as e:
        print(f"[Save Reviewed Patient] Could not load existing data for comparison: {e}")

    # Auto-generate clinical alerts if not already present or if data changed
    if "clinical_context" in payload_data:
        payload_data["clinical_context"]["clinical_alerts"] = generate_clinical_alerts(payload_data)

    # Apply normalization (handles both v1 and v2 schemas)
    reviewed = normalize_extracted_data(payload_data)

    # Apply final_schema_v2.json template to ensure all fields present
    reviewed = apply_schema_template("final_schema_v2.json", reviewed)

    # Preserve chat_history and module_content from existing DB data
    if existing_data:
        if existing_data.get("chat_history"):
            reviewed["chat_history"] = existing_data["chat_history"]
        if existing_data.get("module_content"):
            reviewed["module_content"] = existing_data["module_content"]

    # Ensure legacy/convenience fields are populated (using the adapter)
    from adk_app.utils.data_adapter import normalize_patient, denormalize_patient
    full_normalized = normalize_patient(reviewed)

    # Denormalize to strip legacy convenience fields and 'extra' duplication for storage
    to_save = denormalize_patient(full_normalized)

    # Save to Supabase (primary storage)
    try:
        updated_patient = update_patient_from_reviewed(
            clinic_id=payload.clinic_id,
            patient_id=payload.patient_id,
            reviewed_data=full_normalized
        )
        print(f"[Save Reviewed Patient] Saved to Supabase: {payload.clinic_id}/{payload.patient_id}")
    except Exception as sync_err:
        print(f"[Save Reviewed Patient] Supabase save FAILED: {sync_err}")
        traceback.print_exc()
        raise HTTPException(
            status_code=503,
            detail=f"Failed to save patient data. Please try again. Error: {str(sync_err)}"
        )

    # Optional: Save local JSON for debugging (disabled in production)
    if os.getenv("SAVE_EXTRACTION_JSON", "true").lower() == "true":
        try:
            base_dir = ensure_dir(REVIEW_ROOT / payload.clinic_id / payload.patient_id)
            target = base_dir / "reviewed_patient.json"
            with open(target, "w", encoding="utf-8") as f:
                json.dump(to_save, f, ensure_ascii=False, indent=2)
            print(f"[Save Reviewed Patient] Local JSON saved (debug): {target}")
        except Exception as local_err:
            print(f"[Save Reviewed Patient] Local JSON save failed (non-critical): {local_err}")

    # Invalidate cache
    clear_patient_cache()

    # Determine if we need to generate the "My Diagnosis" module
    should_generate = False
    if existing_data is None:
        should_generate = True
        print(f"[Save Reviewed Patient] First save - will generate diagnosis module")
    elif should_generate_diagnosis_module(full_normalized):
        should_generate = True
        print(f"[Save Reviewed Patient] Diagnosis module missing - will generate")
    elif has_diagnosis_changed(existing_data, full_normalized):
        should_generate = True
        print(f"[Save Reviewed Patient] Diagnosis changed - will regenerate module")
    else:
        print(f"[Save Reviewed Patient] Diagnosis unchanged - skipping module generation")

    # Trigger background generation if needed
    if should_generate:
        background_tasks.add_task(
            generate_modules_background,
            patient_id=payload.patient_id,
            config=runtime.config,
            old_patient=existing_data,
            force=False,
            clinic_id=payload.clinic_id
        )
        print(f"[Save Reviewed Patient] Queued background module generation for: {payload.clinic_id}/{payload.patient_id}")

    return {"status": "ok", "reviewed": full_normalized}


@router.delete("/patient")
async def delete_patient_data(
    clinic_id: str,
    patient_id: str,
    user: AuthenticatedUser = Depends(require_clinic_user),  # AUTHENTICATION REQUIRED
) -> dict:
    """
    Delete all stored data for a patient (uploads and reviewed).

    Requires authentication. User can only delete from their own clinic.
    """
    # Validate clinic access
    validate_clinic_access(user, clinic_id)
    upload_dir = UPLOAD_ROOT / clinic_id / patient_id
    reviewed_dir = REVIEW_ROOT / clinic_id / patient_id

    # Fallback to resolve correct folders if direct ones don't exist
    try:
        patient = get_patient_data(patient_id, clinic_id=clinic_id)
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


@router.post("/review/clinic")
async def save_reviewed_clinic(
    payload: ReviewedClinicPayload,
    user: AuthenticatedUser = Depends(require_clinic_user),  # AUTHENTICATION REQUIRED
) -> dict:
    """Save reviewed clinic data. Requires authentication."""
    # Validate clinic access
    validate_clinic_access(user, payload.clinic_id)
    base_dir = ensure_dir(REVIEW_ROOT / payload.clinic_id)
    payload_data = payload.data if isinstance(payload.data, dict) else {}
    reviewed = normalize_extracted_data(payload_data)
    reviewed = apply_schema_template("clinic_schema.json", reviewed)
    target = base_dir / "reviewed_clinic.json"
    with open(target, "w", encoding="utf-8") as f:
        json.dump(reviewed, f, ensure_ascii=False, indent=2)

    print(f"[Save Reviewed Clinic] Saved clinic config: {payload.clinic_id}")

    # Sync to Supabase clinic tables (required for chatbot to work)
    try:
        updated_clinic = update_clinic_from_reviewed(
            clinic_id=payload.clinic_id,
            reviewed_data=reviewed
        )
        print(f"[Save Reviewed Clinic] Synced to Supabase: {payload.clinic_id}")
    except Exception as sync_err:
        print(f"[Save Reviewed Clinic] Supabase sync FAILED: {sync_err}")
        traceback.print_exc()
        raise HTTPException(
            status_code=503,
            detail=f"Data saved locally but cloud sync failed. Please try again. Error: {str(sync_err)}"
        )

    return {"status": "ok", "reviewed_path": str(target), "reviewed": reviewed}
