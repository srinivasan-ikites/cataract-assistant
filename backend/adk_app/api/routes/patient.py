"""
Patient routes for the patient UI.

Updated to use Supabase instead of JSON files.

SECURITY: All routes now require authentication.
Doctors can only access patients from their own clinic.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field

# Use Supabase data loader instead of JSON-based one
from adk_app.utils.supabase_data_loader import (
    get_patient_data,
    get_all_patients,
    clear_patient_chat_history,
    create_patient,
)
from adk_app.services.supabase_service import get_supabase_admin_client
# Authentication middleware
from adk_app.api.middleware.auth import (
    AuthenticatedUser,
    require_clinic_user,
    validate_clinic_access,
)

router = APIRouter(prefix="/patients", tags=["Patients"])


# =============================================================================
# REQUEST MODELS
# =============================================================================

class CreatePatientRequest(BaseModel):
    """Request body for creating a new patient."""
    clinic_id: str = Field(..., description="Clinic ID (slug like 'mclean-eye-clinic')")
    first_name: str = Field(..., description="Patient's first name")
    last_name: str = Field(..., description="Patient's last name")
    phone: str = Field(..., description="Patient's phone number (10 digits)")
    dob: Optional[str] = Field(None, description="Date of birth (YYYY-MM-DD)")
    gender: Optional[str] = Field(None, description="Gender")
    email: Optional[str] = Field(None, description="Email address")


def _get_clinic_uuid_from_slug(clinic_slug: str) -> Optional[str]:
    """Get clinic UUID from clinic_id (slug)."""
    client = get_supabase_admin_client()
    if not client:
        return None
    try:
        result = client.table("clinics").select("id").eq("clinic_id", clinic_slug).single().execute()
        return result.data.get("id") if result.data else None
    except Exception:
        return None


@router.get("")
def list_patients(
    clinic_id: Optional[str] = Query(None, description="Clinic ID (slug) to filter patients"),
    user: AuthenticatedUser = Depends(require_clinic_user),  # AUTHENTICATION REQUIRED
) -> list[dict]:
    """
    Return a list of all patients for the selection screen.

    Requires authentication. Users can only see patients from their own clinic.

    Args:
        clinic_id: Optional clinic slug (e.g., "mclean-eye-clinic") to filter patients.
                   If not provided, uses the user's clinic.
    """
    # Use user's clinic if not specified
    effective_clinic_id = clinic_id or user.clinic_id

    # Validate clinic access - users can only see their own clinic's patients
    if effective_clinic_id:
        validate_clinic_access(user, effective_clinic_id)

    print(f"[Patient API] GET /patients - Listing patients for clinic: {effective_clinic_id} (user: {user.email})")

    # Validate clinic exists before querying (get_all_patients expects the slug, not UUID)
    if effective_clinic_id:
        clinic_uuid = _get_clinic_uuid_from_slug(effective_clinic_id)
        if not clinic_uuid:
            print(f"[Patient API] Clinic not found: {effective_clinic_id}")
            raise HTTPException(status_code=404, detail=f"Clinic '{effective_clinic_id}' not found")

    # Pass the clinic slug - get_all_patients does its own UUID lookup internally
    patients = get_all_patients(clinic_id=effective_clinic_id)
    print(f"[Patient API] Returning {len(patients)} patients")
    return patients


@router.get("/{patient_id}")
def get_patient(
    patient_id: str,
    user: AuthenticatedUser = Depends(require_clinic_user),  # AUTHENTICATION REQUIRED
) -> dict:
    """
    Return full details for a specific patient, including chat history.

    Requires authentication. User can only access patients from their own clinic.
    """
    print(f"[Patient API] GET /patients/{patient_id} (user: {user.email})")
    try:
        patient = get_patient_data(patient_id, clinic_id=user.clinic_id)

        # Verify patient belongs to user's clinic
        patient_clinic = patient.get("_clinic_id") or patient.get("clinic_id")
        if patient_clinic and user.clinic_id and patient_clinic != user.clinic_id:
            print(f"[Patient API] Access denied: patient belongs to different clinic")
            raise HTTPException(status_code=403, detail="Access denied: patient belongs to different clinic")

        print(f"[Patient API] Found patient: {patient.get('name', {}).get('first')} {patient.get('name', {}).get('last')}")
        return patient
    except ValueError as err:
        print(f"[Patient API] Patient not found: {err}")
        raise HTTPException(status_code=404, detail=str(err))


@router.post("/{patient_id}/chat/clear")
def clear_patient_chat(
    patient_id: str,
    user: AuthenticatedUser = Depends(require_clinic_user),  # AUTHENTICATION REQUIRED
) -> dict:
    """
    Clear stored chat history for a patient.
    Does not remove any other patient data.

    Requires authentication.
    """
    print(f"[Patient API] POST /patients/{patient_id}/chat/clear (user: {user.email})")
    try:
        # Verify patient belongs to user's clinic before clearing
        patient = get_patient_data(patient_id, clinic_id=user.clinic_id)
        patient_clinic = patient.get("_clinic_id") or patient.get("clinic_id")
        if patient_clinic and user.clinic_id and patient_clinic != user.clinic_id:
            raise HTTPException(status_code=403, detail="Access denied: patient belongs to different clinic")

        clear_patient_chat_history(patient_id, clinic_id=user.clinic_id)
        print(f"[Patient API] Chat history cleared for patient {patient_id}")
    except ValueError as err:
        print(f"[Patient API] Error clearing chat: {err}")
        raise HTTPException(status_code=404, detail=str(err))
    return {"status": "ok"}


@router.post("")
def create_new_patient(
    request: CreatePatientRequest,
    user: AuthenticatedUser = Depends(require_clinic_user),  # AUTHENTICATION REQUIRED
) -> dict:
    """
    Create a new patient with basic information.

    Requires authentication. User can only create patients for their own clinic.

    This endpoint is used when registering a new patient from the doctor portal.
    The patient ID is auto-generated (sequential per clinic: 001, 002, etc.).

    Required fields:
    - clinic_id: The clinic slug (e.g., "mclean-eye-clinic")
    - first_name: Patient's first name
    - last_name: Patient's last name
    - phone: 10-digit phone number (required for patient OTP login)

    Optional fields:
    - dob: Date of birth
    - gender: Gender
    - email: Email address

    Returns the created patient data including the generated patient_id.
    """
    # Validate clinic access - users can only create patients for their own clinic
    validate_clinic_access(user, request.clinic_id)

    print(f"[Patient API] POST /patients - Creating patient for clinic: {request.clinic_id} (user: {user.email})")

    # Get clinic UUID from slug
    clinic_uuid = _get_clinic_uuid_from_slug(request.clinic_id)
    if not clinic_uuid:
        print(f"[Patient API] Clinic not found: {request.clinic_id}")
        raise HTTPException(status_code=404, detail=f"Clinic '{request.clinic_id}' not found")

    try:
        patient = create_patient(
            clinic_uuid=clinic_uuid,
            first_name=request.first_name,
            last_name=request.last_name,
            phone=request.phone,
            dob=request.dob,
            gender=request.gender,
            email=request.email,
        )
        print(f"[Patient API] Patient created: {patient.get('patient_id')} - {request.first_name} {request.last_name}")
        return {
            "status": "created",
            "patient": patient
        }
    except ValueError as err:
        error_msg = str(err)
        print(f"[Patient API] Error creating patient: {error_msg}")
        # Check for specific error types
        if "already exists" in error_msg.lower():
            raise HTTPException(status_code=409, detail=error_msg)
        elif "required" in error_msg.lower() or "must be" in error_msg.lower():
            raise HTTPException(status_code=400, detail=error_msg)
        else:
            raise HTTPException(status_code=500, detail=error_msg)
