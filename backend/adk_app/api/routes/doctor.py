"""
Doctor/Admin routes for uploads, extractions, and reviews.

Note: Upload and extraction operations still use local filesystem.
Patient data retrieval uses Supabase.

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
    base_dir = ensure_dir(UPLOAD_ROOT / clinic_id / patient_id)

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

        extracted_path = base_dir / "extracted_patient.json"
        with open(extracted_path, "w", encoding="utf-8") as f:
            json.dump(extraction, f, ensure_ascii=False, indent=2)

        # Upload files to Supabase Storage
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
            import traceback
            print(f"[Doctor Upload Patient] Storage upload exception: {storage_err}")
            traceback.print_exc()
            storage_errors.append(f"Exception: {str(storage_err)}")

        if storage_errors:
            print(f"[Doctor Upload Patient] WARNING: {len(storage_errors)} files failed to upload to Supabase Storage")
        print(f"[Doctor Upload Patient] Storage upload complete: {len(storage_paths)} succeeded, {len(storage_errors)} failed")

        return {
            "status": "ok",
            "model_used": vision_model,
            "files_saved": len(saved_files),
            "upload_dir": str(base_dir),
            "extracted_path": str(extracted_path),
            "extracted": extraction,
            "storage_paths": storage_paths,
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
    base_dir = ensure_dir(UPLOAD_ROOT / clinic_id / "clinic")

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
        schema = load_schema("clinic_schema.json")
        prompt = build_extraction_prompt(schema, scope="Clinic")
        extraction = vision_extract(images, prompt, vision_model)
        # Normalize extracted data for consistency and fill any missing keys using schema template
        extraction = normalize_extracted_data(extraction)
        extraction = apply_schema_template("clinic_schema.json", extraction)

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
# Extraction retrieval endpoints
# -------------------------------

@router.get("/extractions/patient")
async def get_extracted_patient(
    clinic_id: str,
    patient_id: str,
    user: AuthenticatedUser = Depends(require_clinic_user),  # AUTHENTICATION REQUIRED
) -> dict:
    """Get extracted patient data from uploads. Requires authentication."""
    validate_clinic_access(user, clinic_id)
    # First try direct path
    path = UPLOAD_ROOT / clinic_id / patient_id / "extracted_patient.json"

    if not path.exists():
        # Fallback: find actual folder name from reviewed cache
        try:
            patient = get_patient_data(patient_id, clinic_id=clinic_id)
            if patient.get("_file_path"):
                actual_pid_folder = Path(patient["_file_path"]).parent.name
                path = UPLOAD_ROOT / clinic_id / actual_pid_folder / "extracted_patient.json"
        except Exception:
            pass

    data = read_json_or_404(path, "Extracted patient JSON")
    return {"status": "ok", "extracted_path": str(path), "extracted": data}


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
# Reviewed data endpoints
# -------------------------------

@router.get("/reviewed/patient")
async def get_reviewed_patient(
    clinic_id: str,
    patient_id: str,
    user: AuthenticatedUser = Depends(require_clinic_user),  # AUTHENTICATION REQUIRED
) -> dict:
    """Get reviewed patient data. Requires authentication."""
    validate_clinic_access(user, clinic_id)
    # First try direct path
    path = REVIEW_ROOT / clinic_id / patient_id / "reviewed_patient.json"

    if not path.exists():
        # Fallback: find actual folder name from reviewed cache
        try:
            patient = get_patient_data(patient_id, clinic_id=clinic_id)
            if patient.get("_file_path"):
                path = Path(patient["_file_path"])
        except Exception:
            pass

    data = read_json_or_404(path, "Reviewed patient JSON")
    return {"status": "ok", "reviewed_path": str(path), "reviewed": data}


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

    Expected payload.data structure:
    - Extraction data (patient_identity, medical_profile, clinical_context, lifestyle_profile)
    - Doctor-entered data (surgical_plan, medications_plan)

    This endpoint merges extracted data with doctor selections and saves to reviewed folder.
    It also triggers "My Diagnosis" module generation in the background if needed.
    """
    # Validate clinic access
    validate_clinic_access(user, payload.clinic_id)
    base_dir = ensure_dir(REVIEW_ROOT / payload.clinic_id / payload.patient_id)
    payload_data = payload.data if isinstance(payload.data, dict) else {}

    # Load existing patient data BEFORE saving (to check for diagnosis changes)
    existing_data = None
    existing_file = base_dir / "reviewed_patient.json"
    try:
        if existing_file.exists():
            with open(existing_file, "r", encoding="utf-8") as f:
                existing_data = json.load(f)
    except Exception as e:
        print(f"[Save Reviewed Patient] Could not load existing data for comparison: {e}")

    # Auto-generate clinical alerts if not already present or if data changed
    if "clinical_context" in payload_data:
        # Regenerate alerts based on current data
        payload_data["clinical_context"]["clinical_alerts"] = generate_clinical_alerts(payload_data)

    # Apply normalization (handles both v1 and v2 schemas)
    reviewed = normalize_extracted_data(payload_data)

    # Apply final_schema_v2.json template to ensure all fields present
    reviewed = apply_schema_template("final_schema_v2.json", reviewed)

    # Preserve chat_history and module_content if they exist from previous save
    if existing_data:
        if "chat_history" in existing_data:
            reviewed["chat_history"] = existing_data.get("chat_history", [])
        if "module_content" in existing_data:
            reviewed["module_content"] = existing_data.get("module_content", {})

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

    # Sync to Supabase patients table (required for chatbot to work)
    try:
        updated_patient = update_patient_from_reviewed(
            clinic_id=payload.clinic_id,
            patient_id=payload.patient_id,
            reviewed_data=full_normalized
        )
        print(f"[Save Reviewed Patient] Synced to Supabase: {payload.patient_id}")
    except Exception as sync_err:
        print(f"[Save Reviewed Patient] Supabase sync FAILED: {sync_err}")
        traceback.print_exc()
        raise HTTPException(
            status_code=503,
            detail=f"Data saved locally but cloud sync failed. Please try again. Error: {str(sync_err)}"
        )

    # Determine if we need to generate the "My Diagnosis" module
    # Generate if: 1) First save (no existing data), 2) Diagnosis changed, 3) Module missing
    should_generate = False
    if existing_data is None:
        # First save - generate module
        should_generate = True
        print(f"[Save Reviewed Patient] First save - will generate diagnosis module")
    elif should_generate_diagnosis_module(full_normalized):
        # Module is missing
        should_generate = True
        print(f"[Save Reviewed Patient] Diagnosis module missing - will generate")
    elif has_diagnosis_changed(existing_data, full_normalized):
        # Diagnosis changed - regenerate
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
            clinic_id=payload.clinic_id  # Required for unique patient lookup
        )
        print(f"[Save Reviewed Patient] Queued background module generation for: {payload.clinic_id}/{payload.patient_id}")

    return {"status": "ok", "reviewed_path": str(target), "reviewed": full_normalized}


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
