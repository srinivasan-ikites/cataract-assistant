"""
Forms & Documents routes.

Handles:
- Clinic-level form template management (blank PDFs uploaded once, shared across patients)
- Per-patient signed form uploads (doctor uploads signed copy per patient per eye)
- Patient form downloads (blank templates + signed copies via signed URLs)

All files stored in the existing 'patient-documents' Supabase Storage bucket
under: {clinic_id}/forms/templates/ and {clinic_id}/{patient_id}/forms/

SECURITY: All routes require authentication.
"""
from __future__ import annotations

import traceback
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Header

from adk_app.services.supabase_service import SupabaseService, get_supabase_admin_client
from adk_app.api.middleware.auth import (
    AuthenticatedUser,
    require_clinic_user,
    validate_clinic_access,
)
from adk_app.api.routes.patient_auth import verify_patient_token

# Storage bucket (same as patient documents)
BUCKET = "patient-documents"

# The 3 standard form types
VALID_FORM_TYPES = ["medical_clearance", "iol_selection", "consent"]

FORM_TYPE_LABELS = {
    "medical_clearance": "Medical Clearance",
    "iol_selection": "IOL Selection",
    "consent": "Consent Form",
}

VALID_EYES = ["od_right", "os_left"]

# Max file size: 10MB
MAX_FORM_SIZE = 10 * 1024 * 1024

router = APIRouter(prefix="/forms", tags=["Forms"])


# ─────────────────────────────────────────────
# Helper functions
# ─────────────────────────────────────────────

def _get_clinic_uuid(client, clinic_id: str) -> str:
    """Look up clinic UUID from slug. Raises HTTPException if not found."""
    result = client.table("clinics").select("id").eq("clinic_id", clinic_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail=f"Clinic '{clinic_id}' not found")
    return result.data["id"]


def _get_form_templates(client, clinic_uuid: str) -> dict:
    """Get form_templates from clinic_config. Returns empty dict if none."""
    result = client.table("clinic_config").select("form_templates").eq("clinic_id", clinic_uuid).execute()
    if result.data and len(result.data) > 0:
        return result.data[0].get("form_templates") or {}
    return {}


def _save_form_templates(client, clinic_uuid: str, templates: dict):
    """Save form_templates to clinic_config."""
    result = client.table("clinic_config").select("id").eq("clinic_id", clinic_uuid).execute()
    if result.data and len(result.data) > 0:
        client.table("clinic_config").update({"form_templates": templates}).eq("id", result.data[0]["id"]).execute()
    else:
        client.table("clinic_config").insert({"clinic_id": clinic_uuid, "form_templates": templates}).execute()


def _get_patient_forms(client, clinic_uuid: str, patient_id: str) -> tuple[str, dict]:
    """Get patient UUID and forms JSONB. Returns (patient_uuid, forms_dict)."""
    result = client.table("patients").select("id, forms").eq("clinic_id", clinic_uuid).eq("patient_id", patient_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found")
    return result.data["id"], result.data.get("forms") or {}


def _save_patient_forms(client, patient_uuid: str, forms: dict):
    """Save forms JSONB to patients table."""
    client.table("patients").update({"forms": forms}).eq("id", patient_uuid).execute()


# ─────────────────────────────────────────────
# CLINIC-LEVEL: Form Template Management
# ─────────────────────────────────────────────

@router.post("/templates/upload")
async def upload_form_template(
    clinic_id: str = Form(...),
    form_type: str = Form(...),
    file: UploadFile = File(...),
    user: AuthenticatedUser = Depends(require_clinic_user),
) -> dict:
    """
    Upload a blank form template for the clinic.
    One per form type — re-uploading replaces the previous version.
    """
    validate_clinic_access(user, clinic_id)

    if form_type not in VALID_FORM_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid form_type. Must be one of: {VALID_FORM_TYPES}")

    # Read and validate file
    content = await file.read()
    if len(content) > MAX_FORM_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 10MB limit")

    content_type = file.content_type or "application/pdf"
    original_filename = file.filename or f"{form_type}.pdf"

    # Determine storage path
    storage_path = f"{clinic_id}/forms/templates/{form_type}_{original_filename}"

    try:
        client = get_supabase_admin_client()
        clinic_uuid = _get_clinic_uuid(client, clinic_id)

        # Upload to Supabase Storage
        storage = SupabaseService(use_admin=True)
        uploaded_path = storage.upload_file(
            bucket=BUCKET,
            path=storage_path,
            file_data=content,
            content_type=content_type,
        )

        if not uploaded_path:
            raise HTTPException(status_code=500, detail="Failed to upload file to storage")

        # Update clinic_config.form_templates
        templates = _get_form_templates(client, clinic_uuid)
        templates[form_type] = {
            "file_path": storage_path,
            "file_name": original_filename,
            "content_type": content_type,
            "file_size": len(content),
            "uploaded_by": user.name or user.email,
            "uploaded_at": "now()",
        }
        _save_form_templates(client, clinic_uuid, templates)

        print(f"[Forms] Template uploaded: {clinic_id}/{form_type} -> {storage_path}")

        return {
            "status": "ok",
            "form_type": form_type,
            "file_name": original_filename,
            "storage_path": storage_path,
        }

    except HTTPException:
        raise
    except Exception as exc:
        print(f"[Forms] Template upload error: {exc}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(exc)}")


@router.get("/templates")
async def get_form_templates(
    clinic_id: str,
    user: AuthenticatedUser = Depends(require_clinic_user),
) -> dict:
    """Get all form templates for a clinic."""
    validate_clinic_access(user, clinic_id)

    try:
        client = get_supabase_admin_client()
        clinic_uuid = _get_clinic_uuid(client, clinic_id)
        templates = _get_form_templates(client, clinic_uuid)

        # Build response with all 3 form types (showing which are uploaded)
        result = {}
        for form_type in VALID_FORM_TYPES:
            if form_type in templates:
                result[form_type] = {
                    **templates[form_type],
                    "label": FORM_TYPE_LABELS[form_type],
                    "uploaded": True,
                }
            else:
                result[form_type] = {
                    "label": FORM_TYPE_LABELS[form_type],
                    "uploaded": False,
                }

        return {"status": "ok", "templates": result}

    except HTTPException:
        raise
    except Exception as exc:
        print(f"[Forms] Get templates error: {exc}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/templates/{form_type}")
async def delete_form_template(
    form_type: str,
    clinic_id: str,
    user: AuthenticatedUser = Depends(require_clinic_user),
) -> dict:
    """Delete a form template (removes file from storage + clears metadata)."""
    validate_clinic_access(user, clinic_id)

    if form_type not in VALID_FORM_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid form_type. Must be one of: {VALID_FORM_TYPES}")

    try:
        client = get_supabase_admin_client()
        clinic_uuid = _get_clinic_uuid(client, clinic_id)
        templates = _get_form_templates(client, clinic_uuid)

        if form_type not in templates:
            raise HTTPException(status_code=404, detail=f"No template found for '{form_type}'")

        # Remove from storage
        file_path = templates[form_type].get("file_path")
        if file_path:
            try:
                storage = SupabaseService(use_admin=True)
                storage._client.storage.from_(BUCKET).remove([file_path])
                print(f"[Forms] Deleted template file: {file_path}")
            except Exception as storage_err:
                print(f"[Forms] WARNING: Could not delete file from storage: {storage_err}")

        # Remove from metadata
        del templates[form_type]
        _save_form_templates(client, clinic_uuid, templates)

        return {"status": "ok", "deleted": form_type}

    except HTTPException:
        raise
    except Exception as exc:
        print(f"[Forms] Delete template error: {exc}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))


# ─────────────────────────────────────────────
# PATIENT-LEVEL: Signed Form Management
# ─────────────────────────────────────────────

@router.post("/signed/upload")
async def upload_signed_form(
    clinic_id: str = Form(...),
    patient_id: str = Form(...),
    form_type: str = Form(...),
    eye: str = Form(...),
    file: UploadFile = File(...),
    user: AuthenticatedUser = Depends(require_clinic_user),
) -> dict:
    """
    Upload a signed form for a specific patient + eye.
    Re-uploading replaces the previous signed copy.
    """
    validate_clinic_access(user, clinic_id)

    if form_type not in VALID_FORM_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid form_type. Must be one of: {VALID_FORM_TYPES}")
    if eye not in VALID_EYES:
        raise HTTPException(status_code=400, detail=f"Invalid eye. Must be one of: {VALID_EYES}")

    content = await file.read()
    if len(content) > MAX_FORM_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 10MB limit")

    content_type = file.content_type or "application/pdf"
    original_filename = file.filename or f"{form_type}_{eye}_signed.pdf"

    # Storage path for signed forms: {clinic_id}/{patient_id}/forms/{form_type}_{eye}_signed_{filename}
    storage_path = f"{clinic_id}/{patient_id}/forms/{form_type}_{eye}_signed_{original_filename}"

    try:
        client = get_supabase_admin_client()
        clinic_uuid = _get_clinic_uuid(client, clinic_id)

        # Upload to storage
        storage = SupabaseService(use_admin=True)
        uploaded_path = storage.upload_file(
            bucket=BUCKET,
            path=storage_path,
            file_data=content,
            content_type=content_type,
        )

        if not uploaded_path:
            raise HTTPException(status_code=500, detail="Failed to upload file to storage")

        # Update patients.forms JSONB
        patient_uuid, forms = _get_patient_forms(client, clinic_uuid, patient_id)

        if form_type not in forms:
            forms[form_type] = {}

        from datetime import datetime, timezone
        forms[form_type][eye] = {
            "status": "signed",
            "signed_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "file_path": storage_path,
            "file_name": original_filename,
            "content_type": content_type,
            "uploaded_by": user.name or user.email,
        }

        _save_patient_forms(client, patient_uuid, forms)

        print(f"[Forms] Signed form uploaded: {clinic_id}/{patient_id}/{form_type}/{eye}")

        return {
            "status": "ok",
            "form_type": form_type,
            "eye": eye,
            "patient_id": patient_id,
            "storage_path": storage_path,
        }

    except HTTPException:
        raise
    except Exception as exc:
        print(f"[Forms] Signed upload error: {exc}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(exc)}")


@router.get("")
async def get_patient_forms(
    clinic_id: str,
    patient_id: str,
    user: AuthenticatedUser = Depends(require_clinic_user),
) -> dict:
    """
    Get complete form status for a patient.
    Combines clinic templates (blank availability) + patient form status (signed copies).
    """
    validate_clinic_access(user, clinic_id)

    try:
        client = get_supabase_admin_client()
        clinic_uuid = _get_clinic_uuid(client, clinic_id)

        # Get clinic templates
        templates = _get_form_templates(client, clinic_uuid)

        # Get patient form statuses
        patient_uuid, patient_forms = _get_patient_forms(client, clinic_uuid, patient_id)

        # Build combined response
        result = {}
        for form_type in VALID_FORM_TYPES:
            has_template = form_type in templates
            patient_form_data = patient_forms.get(form_type, {})

            eyes = {}
            for eye in VALID_EYES:
                eye_data = patient_form_data.get(eye, {})

                if eye_data.get("status") == "signed":
                    # Signed copy exists
                    eyes[eye] = {
                        "status": "signed",
                        "signed_date": eye_data.get("signed_date"),
                        "file_name": eye_data.get("file_name"),
                    }
                elif has_template:
                    # Blank template available but not signed
                    eyes[eye] = {"status": "ready"}
                else:
                    # No template uploaded by clinic
                    eyes[eye] = {"status": "not_available"}

            result[form_type] = {
                "label": FORM_TYPE_LABELS[form_type],
                "has_template": has_template,
                "eyes": eyes,
            }

        return {"status": "ok", "forms": result}

    except HTTPException:
        raise
    except Exception as exc:
        print(f"[Forms] Get patient forms error: {exc}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))


# ─────────────────────────────────────────────
# PATIENT-FACING: Download forms
# ─────────────────────────────────────────────

@router.get("/download/{form_type}")
async def download_form(
    form_type: str,
    clinic_id: str,
    patient_id: Optional[str] = None,
    doc_type: str = Query("blank", description="'blank' for template, 'signed' for signed copy"),
    eye: Optional[str] = None,
    user: AuthenticatedUser = Depends(require_clinic_user),
) -> dict:
    """
    Generate a signed download URL for a form.

    For blank templates: doc_type=blank (no patient_id or eye needed)
    For signed copies: doc_type=signed, patient_id and eye required
    """
    validate_clinic_access(user, clinic_id)

    if form_type not in VALID_FORM_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid form_type. Must be one of: {VALID_FORM_TYPES}")

    try:
        client = get_supabase_admin_client()
        clinic_uuid = _get_clinic_uuid(client, clinic_id)
        storage = SupabaseService(use_admin=True)

        if doc_type == "blank":
            # Download blank template
            templates = _get_form_templates(client, clinic_uuid)
            if form_type not in templates:
                raise HTTPException(status_code=404, detail=f"No template for '{form_type}'")

            file_path = templates[form_type]["file_path"]

        elif doc_type == "signed":
            # Download signed copy
            if not patient_id or not eye:
                raise HTTPException(status_code=400, detail="patient_id and eye required for signed forms")
            if eye not in VALID_EYES:
                raise HTTPException(status_code=400, detail=f"Invalid eye. Must be one of: {VALID_EYES}")

            patient_uuid, forms = _get_patient_forms(client, clinic_uuid, patient_id)
            eye_data = forms.get(form_type, {}).get(eye, {})

            if eye_data.get("status") != "signed" or not eye_data.get("file_path"):
                raise HTTPException(status_code=404, detail="No signed form found")

            file_path = eye_data["file_path"]

        else:
            raise HTTPException(status_code=400, detail="doc_type must be 'blank' or 'signed'")

        # Generate signed URL (1 hour expiry)
        url = storage.get_file_url(bucket=BUCKET, path=file_path, expires_in=3600)
        if not url:
            raise HTTPException(status_code=500, detail="Failed to generate download URL")

        return {"status": "ok", "url": url, "form_type": form_type}

    except HTTPException:
        raise
    except Exception as exc:
        print(f"[Forms] Download error: {exc}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))


# ─────────────────────────────────────────────
# PATIENT-FACING: View forms & download
# ─────────────────────────────────────────────

def _verify_patient_auth(authorization: str) -> dict:
    """Verify patient JWT and return payload. Raises HTTPException on failure."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = authorization.replace("Bearer ", "")
    payload = verify_patient_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload


@router.get("/patient-view")
async def get_patient_forms_view(
    authorization: str = Header(None, alias="Authorization"),
) -> dict:
    """
    Patient-facing: get combined form status (templates + signed copies).
    Uses patient JWT auth.
    """
    payload = _verify_patient_auth(authorization)

    try:
        client = get_supabase_admin_client()
        patient_uuid = payload["sub"]
        clinic_id = payload["clinic_id"]

        # Get clinic UUID
        clinic_uuid = _get_clinic_uuid(client, clinic_id)

        # Get clinic templates
        templates = _get_form_templates(client, clinic_uuid)

        # Get patient data (patient_id needed)
        patient_result = client.table("patients").select("patient_id, forms").eq("id", patient_uuid).single().execute()
        if not patient_result.data:
            raise HTTPException(status_code=404, detail="Patient not found")

        patient_forms = patient_result.data.get("forms") or {}

        # Build combined response
        result = {}
        for form_type in VALID_FORM_TYPES:
            has_template = form_type in templates
            patient_form_data = patient_forms.get(form_type, {})

            eyes = {}
            for eye in VALID_EYES:
                eye_data = patient_form_data.get(eye, {})

                if eye_data.get("status") == "signed":
                    eyes[eye] = {
                        "status": "signed",
                        "signed_date": eye_data.get("signed_date"),
                        "file_name": eye_data.get("file_name"),
                    }
                elif has_template:
                    eyes[eye] = {"status": "ready"}
                else:
                    eyes[eye] = {"status": "not_available"}

            result[form_type] = {
                "label": FORM_TYPE_LABELS[form_type],
                "has_template": has_template,
                "eyes": eyes,
            }

        return {"status": "ok", "forms": result}

    except HTTPException:
        raise
    except Exception as exc:
        print(f"[Forms] Patient view error: {exc}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/patient-download/{form_type}")
async def patient_download_form(
    form_type: str,
    doc_type: str = Query("blank", description="'blank' for template, 'signed' for signed copy"),
    eye: Optional[str] = None,
    authorization: str = Header(None, alias="Authorization"),
) -> dict:
    """
    Patient-facing: generate a signed download URL for a form.
    For blank templates: doc_type=blank
    For signed copies: doc_type=signed, eye required
    """
    payload = _verify_patient_auth(authorization)

    if form_type not in VALID_FORM_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid form_type")

    try:
        client = get_supabase_admin_client()
        patient_uuid = payload["sub"]
        clinic_id = payload["clinic_id"]
        clinic_uuid = _get_clinic_uuid(client, clinic_id)
        storage = SupabaseService(use_admin=True)

        if doc_type == "blank":
            templates = _get_form_templates(client, clinic_uuid)
            if form_type not in templates:
                raise HTTPException(status_code=404, detail="No template available")
            file_path = templates[form_type]["file_path"]

        elif doc_type == "signed":
            if not eye or eye not in VALID_EYES:
                raise HTTPException(status_code=400, detail="Valid eye required for signed forms")

            patient_result = client.table("patients").select("patient_id, forms").eq("id", patient_uuid).single().execute()
            if not patient_result.data:
                raise HTTPException(status_code=404, detail="Patient not found")

            forms = patient_result.data.get("forms") or {}
            eye_data = forms.get(form_type, {}).get(eye, {})

            if eye_data.get("status") != "signed" or not eye_data.get("file_path"):
                raise HTTPException(status_code=404, detail="No signed form found")
            file_path = eye_data["file_path"]
        else:
            raise HTTPException(status_code=400, detail="doc_type must be 'blank' or 'signed'")

        url = storage.get_file_url(bucket=BUCKET, path=file_path, expires_in=3600)
        if not url:
            raise HTTPException(status_code=500, detail="Failed to generate download URL")

        return {"status": "ok", "url": url, "form_type": form_type}

    except HTTPException:
        raise
    except Exception as exc:
        print(f"[Forms] Patient download error: {exc}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))
