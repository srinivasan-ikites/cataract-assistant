"""
Doctor/Admin routes for uploads, extractions, and reviews.
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
from adk_app.utils.data_loader import get_patient_data, clear_patient_cache

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


@router.post("/uploads/clinic")
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
async def get_extracted_patient(clinic_id: str, patient_id: str) -> dict:
    """Get extracted patient data from uploads."""
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

    data = read_json_or_404(path, "Extracted patient JSON")
    return {"status": "ok", "extracted_path": str(path), "extracted": data}


@router.get("/extractions/clinic")
async def get_extracted_clinic(clinic_id: str) -> dict:
    """Get extracted clinic data from uploads."""
    path = UPLOAD_ROOT / clinic_id / "clinic" / "extracted_clinic.json"
    data = read_json_or_404(path, "Extracted clinic JSON")
    return {"status": "ok", "extracted_path": str(path), "extracted": data}


# -------------------------------
# Reviewed data endpoints
# -------------------------------

@router.get("/reviewed/patient")
async def get_reviewed_patient(clinic_id: str, patient_id: str) -> dict:
    """Get reviewed patient data."""
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

    data = read_json_or_404(path, "Reviewed patient JSON")
    return {"status": "ok", "reviewed_path": str(path), "reviewed": data}


@router.get("/reviewed/clinic")
async def get_reviewed_clinic(clinic_id: str) -> dict:
    """Get reviewed clinic data."""
    path = REVIEW_ROOT / clinic_id / "reviewed_clinic.json"
    data = read_json_or_404(path, "Reviewed clinic JSON")
    return {"status": "ok", "reviewed_path": str(path), "reviewed": data}


@router.post("/review/patient")
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
    base_dir = ensure_dir(REVIEW_ROOT / payload.clinic_id / payload.patient_id)
    payload_data = payload.data if isinstance(payload.data, dict) else {}

    # Auto-generate clinical alerts if not already present or if data changed
    if "clinical_context" in payload_data:
        # Regenerate alerts based on current data
        payload_data["clinical_context"]["clinical_alerts"] = generate_clinical_alerts(payload_data)

    # Apply normalization (handles both v1 and v2 schemas)
    reviewed = normalize_extracted_data(payload_data)

    # Apply final_schema_v2.json template to ensure all fields present
    reviewed = apply_schema_template("final_schema_v2.json", reviewed)

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

    return {"status": "ok", "reviewed_path": str(target), "reviewed": full_normalized}


@router.delete("/patient")
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


@router.post("/review/clinic")
async def save_reviewed_clinic(payload: ReviewedClinicPayload) -> dict:
    """Save reviewed clinic data."""
    base_dir = ensure_dir(REVIEW_ROOT / payload.clinic_id)
    payload_data = payload.data if isinstance(payload.data, dict) else {}
    reviewed = normalize_extracted_data(payload_data)
    reviewed = apply_schema_template("clinic_schema.json", reviewed)
    target = base_dir / "reviewed_clinic.json"
    with open(target, "w", encoding="utf-8") as f:
        json.dump(reviewed, f, ensure_ascii=False, indent=2)
    return {"status": "ok", "reviewed_path": str(target), "reviewed": reviewed}
