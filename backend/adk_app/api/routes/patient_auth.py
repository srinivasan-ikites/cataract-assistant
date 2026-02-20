"""
Patient Authentication routes using Phone OTP.

This module handles:
- Request OTP (send to phone)
- Verify OTP (login)
- Get current patient
- Logout

How it works:
1. Patient enters phone number
2. Backend generates 6-digit OTP, stores with 5-min expiration
3. In DEV mode: OTP is logged to console (no real SMS)
4. Patient enters OTP
5. Backend verifies and creates JWT session (7-day expiry)

Why OTP for patients?
- Simpler than passwords (many patients are elderly)
- No password to remember
- Phone is universal
"""

import os
import random
import string
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, status, Header, Request
from pydantic import BaseModel, Field
import jwt

from adk_app.services.supabase_service import get_supabase_admin_client
from adk_app.utils.supabase_data_loader import log_login_activity

# New Relic for custom attributes (patient tracking)
try:
    import newrelic.agent
    NEWRELIC_AVAILABLE = True
except ImportError:
    NEWRELIC_AVAILABLE = False

router = APIRouter(prefix="/api/patient/auth", tags=["Patient Authentication"])

# Configuration
OTP_LENGTH = 6
OTP_EXPIRY_MINUTES = 5
SESSION_EXPIRY_DAYS = 7
MAX_OTP_ATTEMPTS = 3
DEV_MODE = os.getenv("DEV_MODE", "true").lower() == "true"
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class RequestOTPRequest(BaseModel):
    """Request body for OTP request."""
    phone: str = Field(..., description="Patient phone number (10 digits)")
    clinic_id: str = Field(..., description="Clinic ID the patient belongs to")


class RequestOTPResponse(BaseModel):
    """Response after OTP is sent."""
    message: str
    phone: str
    expires_in_seconds: int
    dev_otp: Optional[str] = Field(None, description="OTP code (only in dev mode)")


class VerifyOTPRequest(BaseModel):
    """Request body for OTP verification."""
    phone: str
    otp: str
    clinic_id: str


class VerifyOTPResponse(BaseModel):
    """Response after successful OTP verification."""
    message: str
    access_token: str
    token_type: str = "bearer"
    expires_in_days: int
    patient: dict


class PatientProfileResponse(BaseModel):
    """Current patient profile response."""
    id: str
    patient_id: str
    name: dict
    phone: str
    clinic_id: str
    clinic_name: Optional[str]


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def generate_otp() -> str:
    """Generate a random 6-digit OTP."""
    return ''.join(random.choices(string.digits, k=OTP_LENGTH))


def create_patient_token(patient_id: str, patient_uuid: str, clinic_id: str) -> str:
    """Create a JWT token for the patient session."""
    payload = {
        "sub": patient_uuid,
        "patient_id": patient_id,
        "clinic_id": clinic_id,
        "type": "patient",
        "exp": datetime.utcnow() + timedelta(days=SESSION_EXPIRY_DAYS),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def verify_patient_token(token: str) -> Optional[dict]:
    """Verify and decode a patient JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        if payload.get("type") != "patient":
            return None
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.post("/request-otp", response_model=RequestOTPResponse)
async def request_otp(request: RequestOTPRequest):
    """
    Request an OTP for patient login.

    Steps:
    1. Validate phone number format
    2. Check if patient exists in the clinic
    3. Generate 6-digit OTP
    4. Store OTP with 5-minute expiration
    5. In DEV mode: Return OTP in response (no SMS)
    6. In PROD mode: Send SMS (not implemented yet)

    Rate limiting: Max 3 OTP requests per phone per 10 minutes
    """
    phone = request.phone.strip()
    clinic_id = request.clinic_id.strip()

    # Basic phone validation (10 digits)
    if not phone.isdigit() or len(phone) != 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid phone number. Please enter 10 digits."
        )

    client = get_supabase_admin_client()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection not available"
        )

    try:
        # Find the clinic by clinic_id (human-readable ID)
        clinic_result = client.table("clinics").select("id, name, status").eq(
            "clinic_id", clinic_id
        ).single().execute()

        if not clinic_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clinic not found"
            )

        clinic = clinic_result.data
        clinic_uuid = clinic["id"]

        # Check clinic is active
        if clinic.get("status") != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This clinic is not active. Please contact support."
            )

        # Find patient by phone in this clinic
        # Phone is stored as a direct field on patients table
        # Note: patients table uses first_name, last_name (not name)
        patient_result = client.table("patients").select("id, patient_id, first_name, last_name").eq(
            "clinic_id", clinic_uuid
        ).eq("phone", phone).execute()

        if not patient_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No patient found with this phone number in this clinic. Please contact your clinic."
            )

        patient = patient_result.data[0]
        patient_uuid = patient["id"]

        # Check rate limiting - max 3 OTPs in last 10 minutes
        ten_minutes_ago = (datetime.utcnow() - timedelta(minutes=10)).isoformat()
        recent_otps = client.table("otp_requests").select("id", count="exact").eq(
            "phone", phone
        ).gte("created_at", ten_minutes_ago).execute()

        if recent_otps.count and recent_otps.count >= 3:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many OTP requests. Please wait a few minutes and try again."
            )

        # Generate OTP
        otp_code = generate_otp()
        expires_at = (datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)).isoformat()

        # Store OTP in database
        otp_data = {
            "phone": phone,
            "otp_code": otp_code,
            "patient_id": patient_uuid,
            "expires_at": expires_at,
            "verified": False,
            "attempts": 0,
        }
        client.table("otp_requests").insert(otp_data).execute()

        # Log OTP in dev mode
        print(f"\n{'='*50}")
        print(f"[DEV MODE] OTP for {phone}: {otp_code}")
        print(f"[DEV MODE] Expires at: {expires_at}")
        print(f"{'='*50}\n")

        response = RequestOTPResponse(
            message="OTP sent successfully",
            phone=phone,
            expires_in_seconds=OTP_EXPIRY_MINUTES * 60,
        )

        # Include OTP in response for dev mode (frontend can show toast)
        if DEV_MODE:
            response.dev_otp = otp_code

        return response

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Patient Auth] Request OTP error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while sending OTP"
        )


@router.post("/verify-otp", response_model=VerifyOTPResponse)
async def verify_otp(request: VerifyOTPRequest, http_request: Request):
    """
    Verify OTP and create patient session.

    Steps:
    1. Find the latest unverified OTP for this phone
    2. Check if expired
    3. Check attempt count (max 3)
    4. Verify OTP matches
    5. Mark as verified
    6. Create JWT session token (7-day expiry)
    7. Return token and patient info
    """
    phone = request.phone.strip()
    otp = request.otp.strip()
    clinic_id = request.clinic_id.strip()

    if not otp.isdigit() or len(otp) != OTP_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid OTP format. Please enter {OTP_LENGTH} digits."
        )

    client = get_supabase_admin_client()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection not available"
        )

    try:
        # Find clinic
        clinic_result = client.table("clinics").select("id, name").eq(
            "clinic_id", clinic_id
        ).single().execute()

        if not clinic_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clinic not found"
            )

        clinic = clinic_result.data
        clinic_uuid = clinic["id"]
        clinic_name = clinic["name"]

        # Find the latest OTP for this phone (not verified, not expired)
        now = datetime.utcnow().isoformat()
        otp_result = client.table("otp_requests").select("*").eq(
            "phone", phone
        ).eq(
            "verified", False
        ).gte(
            "expires_at", now
        ).order(
            "created_at", desc=True
        ).limit(1).execute()

        if not otp_result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OTP expired or not found. Please request a new OTP."
            )

        otp_record = otp_result.data[0]
        otp_id = otp_record["id"]
        stored_otp = otp_record["otp_code"]
        attempts = otp_record.get("attempts", 0)
        patient_uuid = otp_record["patient_id"]

        # Check max attempts
        if attempts >= MAX_OTP_ATTEMPTS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Too many failed attempts. Please request a new OTP."
            )

        # Verify OTP
        if otp != stored_otp:
            # Increment attempt count
            client.table("otp_requests").update({
                "attempts": attempts + 1
            }).eq("id", otp_id).execute()

            remaining = MAX_OTP_ATTEMPTS - attempts - 1
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid OTP. {remaining} attempt(s) remaining."
            )

        # OTP is correct - mark as verified
        client.table("otp_requests").update({
            "verified": True
        }).eq("id", otp_id).execute()

        # Get patient details
        patient_result = client.table("patients").select("*").eq(
            "id", patient_uuid
        ).single().execute()

        if not patient_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found"
            )

        patient = patient_result.data

        # Create JWT token
        token = create_patient_token(
            patient_id=patient["patient_id"],
            patient_uuid=patient_uuid,
            clinic_id=clinic_id
        )

        print(f"[Patient Auth] Login successful for patient: {patient['patient_id']}")

        # Log login activity
        ip = http_request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (http_request.client.host if http_request.client else "unknown")
        log_login_activity(
            user_type="patient",
            phone=request.phone,
            user_name=f"{patient.get('first_name', '')} {patient.get('last_name', '')}".strip(),
            role="patient",
            clinic_id=clinic_id,
            clinic_name=clinic_name,
            ip_address=ip,
            user_agent=http_request.headers.get("user-agent"),
        )

        # Add custom attributes to New Relic transaction for patient tracking
        if NEWRELIC_AVAILABLE:
            try:
                newrelic.agent.add_custom_attribute('patient_id', patient["patient_id"])
                newrelic.agent.add_custom_attribute('patient_uuid', patient_uuid)
                newrelic.agent.add_custom_attribute('clinic_id', clinic_id)
                newrelic.agent.add_custom_attribute('clinic_name', clinic_name)
                newrelic.agent.add_custom_attribute('user_role', 'patient')
            except Exception as e:
                print(f"[Patient Auth] New Relic attribute error (non-fatal): {e}")

        return VerifyOTPResponse(
            message="Login successful",
            access_token=token,
            expires_in_days=SESSION_EXPIRY_DAYS,
            patient={
                "id": patient_uuid,
                "patient_id": patient["patient_id"],
                "name": {
                    "first": patient.get("first_name", ""),
                    "last": patient.get("last_name", ""),
                },
                "clinic_id": clinic_id,
                "clinic_name": clinic_name,
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Patient Auth] Verify OTP error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while verifying OTP"
        )


@router.get("/me", response_model=PatientProfileResponse)
async def get_current_patient(authorization: str = Header(None, alias="Authorization")):
    """
    Get the current logged-in patient's profile.

    Requires: Bearer token from verify-otp

    Used by frontend to:
    - Check if patient is still logged in
    - Get patient details for display
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )

    token = authorization.replace("Bearer ", "")
    payload = verify_patient_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token. Please login again."
        )

    client = get_supabase_admin_client()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection not available"
        )

    try:
        patient_uuid = payload["sub"]
        clinic_id = payload["clinic_id"]

        # Get patient details
        patient_result = client.table("patients").select(
            "*, clinics(name)"
        ).eq("id", patient_uuid).single().execute()

        if not patient_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found"
            )

        patient = patient_result.data
        clinic = patient.get("clinics", {})

        return PatientProfileResponse(
            id=patient_uuid,
            patient_id=patient["patient_id"],
            name={
                "first": patient.get("first_name", ""),
                "last": patient.get("last_name", ""),
            },
            phone=patient.get("phone", ""),
            clinic_id=clinic_id,
            clinic_name=clinic.get("name") if clinic else None,
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Patient Auth] Get profile error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while fetching profile"
        )


@router.get("/me/data")
async def get_patient_full_data(authorization: str = Header(None, alias="Authorization")):
    """
    Get the current patient's full data (including clinical context, module content, etc.)

    This is the patient-facing equivalent of /patients/{id} endpoint.
    Uses patient JWT auth instead of clinic user auth.

    Used by frontend to load patient data in the education portal.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )

    token = authorization.replace("Bearer ", "")
    payload = verify_patient_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token. Please login again."
        )

    # Add custom attributes to New Relic for patient tracking
    if NEWRELIC_AVAILABLE:
        try:
            newrelic.agent.add_custom_attribute('patient_id', payload.get('patient_id'))
            newrelic.agent.add_custom_attribute('clinic_id', payload.get('clinic_id'))
            newrelic.agent.add_custom_attribute('user_role', 'patient')
        except Exception as e:
            print(f"[Patient Auth] New Relic attribute error (non-fatal): {e}")

    client = get_supabase_admin_client()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection not available"
        )

    try:
        patient_uuid = payload["sub"]

        # Import here to avoid circular imports
        from adk_app.utils.supabase_data_loader import get_patient_by_uuid

        # Get full patient data
        patient_data = get_patient_by_uuid(patient_uuid)

        print(f"[Patient Auth] Returning full data for patient: {payload.get('patient_id')}")
        return patient_data

    except ValueError as err:
        print(f"[Patient Auth] Get patient data error: {err}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(err)
        )
    except Exception as e:
        print(f"[Patient Auth] Get patient data error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while fetching patient data"
        )


class UpdateMedicationProgressRequest(BaseModel):
    """Request body for updating medication progress."""
    medication_type: str = Field(..., description="'pre_op' or 'post_op'")
    progress: dict = Field(..., description="Progress data: {date: {med_id: bool}} for post_op or {date: [ids]} for pre_op")


@router.put("/me/medications")
async def update_medication_progress(
    request: UpdateMedicationProgressRequest,
    authorization: str = Header(None, alias="Authorization")
):
    """
    Update the current patient's medication progress.

    This allows patients to track their medication compliance (pre-op and post-op drops).

    Used by:
    - BeforeSurgeryModal (pre_op drops)
    - AfterSurgeryModal (post_op drops)

    Request body:
    {
        "medication_type": "pre_op" | "post_op",
        "progress": { "2026-01-26": ["morning", "noon"] }  // for pre_op
        "progress": { "2026-01-26": {"antibiotic_0": true, "nsaid_0": true} }  // for post_op
    }
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )

    token = authorization.replace("Bearer ", "")
    payload = verify_patient_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token. Please login again."
        )

    if request.medication_type not in ("pre_op", "post_op"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="medication_type must be 'pre_op' or 'post_op'"
        )

    client = get_supabase_admin_client()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection not available"
        )

    try:
        patient_uuid = payload["sub"]
        patient_id = payload.get("patient_id", "")

        print(f"[Patient Auth] Updating {request.medication_type} progress for patient UUID: {patient_uuid}")
        print(f"[Patient Auth] Progress data received: {request.progress}")

        # Get current patient medications_plan (this is the JSONB column in Supabase)
        patient_result = client.table("patients").select("medications_plan").eq(
            "id", patient_uuid
        ).single().execute()

        if not patient_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found"
            )

        # medications_plan stores the full medications structure
        medications_plan = patient_result.data.get("medications_plan", {}) or {}
        print(f"[Patient Auth] Current medications_plan: {medications_plan}")

        # Initialize medication type if needed
        if request.medication_type not in medications_plan:
            medications_plan[request.medication_type] = {}

        # Update the progress for this medication type
        medications_plan[request.medication_type]["progress"] = request.progress

        print(f"[Patient Auth] Updated medications_plan to save: {medications_plan}")

        # Save back to database
        update_result = client.table("patients").update({
            "medications_plan": medications_plan
        }).eq("id", patient_uuid).execute()

        print(f"[Patient Auth] Update result data: {update_result.data}")
        print(f"[Patient Auth] Update result count: {update_result.count}")

        # Check if update actually affected any rows
        if not update_result.data:
            print(f"[Patient Auth] WARNING: Update returned no data! Patient UUID might be wrong.")
            print(f"[Patient Auth] Attempted to update patient with UUID: {patient_uuid}")

        # VERIFY: Fetch the record again to confirm it was saved
        verify_result = client.table("patients").select("id, patient_id, medications_plan").eq(
            "id", patient_uuid
        ).single().execute()

        if verify_result.data:
            print(f"[Patient Auth] VERIFICATION SUCCESS - Found patient: {verify_result.data.get('patient_id')}")
            print(f"[Patient Auth] VERIFICATION - medications_plan.{request.medication_type}.progress: {verify_result.data.get('medications_plan', {}).get(request.medication_type, {}).get('progress')}")
        else:
            print(f"[Patient Auth] VERIFICATION FAILED - Could not find patient with UUID: {patient_uuid}")

        print(f"[Patient Auth] Updated {request.medication_type} progress for patient: {patient_id}")

        return {
            "status": "ok",
            "message": f"{request.medication_type} progress updated successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Patient Auth] Update medication progress error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while saving medication progress"
        )


@router.delete("/me/chat")
async def clear_my_chat(
    authorization: str = Header(None, alias="Authorization")
):
    """
    Clear the current patient's chat history.

    Used by the chatbot delete button in the patient portal.
    Requires patient JWT authentication.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )

    token = authorization.replace("Bearer ", "")
    payload = verify_patient_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token. Please login again."
        )

    client = get_supabase_admin_client()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection not available"
        )

    try:
        patient_uuid = payload["sub"]
        print(f"[Patient Auth] Clearing chat history for patient UUID: {patient_uuid}")

        result = client.table("patients").update({
            "chat_history": [],
        }).eq("id", patient_uuid).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found"
            )

        print(f"[Patient Auth] Chat history cleared for patient UUID: {patient_uuid}")
        return {"status": "ok", "message": "Chat history cleared"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Patient Auth] Clear chat error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while clearing chat history"
        )


@router.post("/logout")
async def logout():
    """
    Logout the current patient.

    Note: Since we use stateless JWTs, logout is mainly a frontend concern
    (clear the stored token). This endpoint exists for completeness.

    Future enhancement: Implement token blacklist for true logout.
    """
    return {"message": "Logged out successfully"}
