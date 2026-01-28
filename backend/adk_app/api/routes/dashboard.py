"""
Dashboard routes for clinic dashboard statistics.

Provides real-time statistics and data for the doctor's dashboard.
"""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException

from adk_app.services.supabase_service import get_supabase_admin_client
from adk_app.api.middleware.auth import (
    AuthenticatedUser,
    require_clinic_user,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
def get_dashboard_stats(
    user: AuthenticatedUser = Depends(require_clinic_user),
) -> dict:
    """
    Get dashboard statistics for the authenticated user's clinic.

    Returns:
    - total_patients: Total number of patients in the clinic
    - todays_surgeries: Number of surgeries scheduled for today
    - pending_review: Patients with status 'pending' or 'new'
    - alerts: Critical alerts (high-risk patients, overdue follow-ups, etc.)
    """
    client = get_supabase_admin_client()
    if not client:
        raise HTTPException(status_code=500, detail="Database connection not available")

    # Use clinic_uuid (database UUID) not clinic_id (human-readable like "abc-clinic")
    clinic_uuid = user.clinic_uuid
    if not clinic_uuid:
        raise HTTPException(status_code=400, detail="User not associated with a clinic")

    # Get today's date in YYYY-MM-DD format
    today = datetime.now().strftime("%Y-%m-%d")

    try:
        # 1. Total Patients Count
        total_result = client.table("patients").select("id", count="exact").eq(
            "clinic_id", clinic_uuid
        ).execute()
        total_patients = total_result.count or 0

        # 2. Fetch all patients with relevant columns
        # Actual columns: id, patient_id, first_name, last_name, status, surgical_plan, medications_plan, clinical_context
        all_patients = client.table("patients").select(
            "id, patient_id, first_name, last_name, status, surgical_plan, medications_plan, clinical_context"
        ).eq("clinic_id", clinic_uuid).execute()

        todays_surgeries = 0
        todays_surgery_list = []
        pending_review = 0
        alerts = 0

        for patient in (all_patients.data or []):
            # Check for pending review status
            status = patient.get("status", "")
            if status in ["pending", "new", "pending_review"]:
                pending_review += 1

            # Check surgical plan for today's surgeries
            # Structure: surgical_plan.operative_logistics.od_right/os_left.surgery_date
            surgical_plan = patient.get("surgical_plan") or {}
            operative_logistics = surgical_plan.get("operative_logistics") or {}

            # Check both eyes
            for eye_key in ["od_right", "os_left"]:
                eye_data = operative_logistics.get(eye_key) or {}
                surgery_date = eye_data.get("surgery_date")

                if surgery_date == today:
                    todays_surgeries += 1

                    # Get patient name from first_name and last_name columns
                    first_name = patient.get("first_name", "") or ""
                    last_name = patient.get("last_name", "") or ""
                    patient_name = f"{first_name} {last_name}".strip()

                    # Get arrival time
                    arrival_time = eye_data.get("arrival_time", "TBD") or "TBD"

                    # Determine readiness based on medications progress
                    # Check medications_plan.pre_op.progress or medications_plan.pre_op_schedule
                    meds = patient.get("medications_plan") or {}
                    pre_op = meds.get("pre_op") or meds.get("pre_op_schedule") or {}
                    pre_op_progress = {}
                    if isinstance(pre_op, dict):
                        pre_op_progress = pre_op.get("progress") or {}

                    # Simple readiness check - has any pre-op progress
                    is_ready = len(pre_op_progress) > 0 if isinstance(pre_op_progress, dict) else False

                    # Get lens info
                    lens_order = eye_data.get("lens_order") or {}
                    lens_info = lens_order.get("model_name") or "Not specified"
                    if not lens_info or lens_info == "":
                        lens_info = "Not specified"

                    todays_surgery_list.append({
                        "patient_id": patient.get("patient_id"),
                        "patient_uuid": patient.get("id"),
                        "patient_name": patient_name or "Unknown",
                        "eye": "OD" if eye_key == "od_right" else "OS",
                        "arrival_time": arrival_time if arrival_time else "TBD",
                        "surgery_type": "Phaco + IOL",
                        "lens": lens_info,
                        "is_ready": is_ready,
                        "status": "ready" if is_ready else "pending"
                    })

            # Check for alerts (critical conditions)
            # Structure: clinical_context.ocular_comorbidities or clinical_context.clinical_alerts
            clinical_context = patient.get("clinical_context") or {}
            ocular_comorbidities = clinical_context.get("ocular_comorbidities") or []
            clinical_alerts = clinical_context.get("clinical_alerts") or []

            # Check for high-risk conditions in ocular comorbidities
            high_risk_keywords = ["glaucoma", "diabetes", "macular", "high myopia", "pseudoexfoliation", "uveitis"]

            has_alert = False
            # Check ocular_comorbidities
            if isinstance(ocular_comorbidities, list):
                for condition in ocular_comorbidities:
                    condition_str = str(condition).lower() if condition else ""
                    if any(risk in condition_str for risk in high_risk_keywords):
                        has_alert = True
                        break

            # Check clinical_alerts
            if not has_alert and isinstance(clinical_alerts, list) and len(clinical_alerts) > 0:
                has_alert = True

            if has_alert:
                alerts += 1

        # Sort today's surgeries by arrival time
        def parse_time(time_str):
            if not time_str or time_str == "TBD":
                return datetime.max.time()
            try:
                # Try parsing various formats
                for fmt in ["%I:%M %p", "%H:%M", "%I:%M%p", "%I %p"]:
                    try:
                        return datetime.strptime(time_str, fmt).time()
                    except ValueError:
                        continue
                return datetime.max.time()
            except:
                return datetime.max.time()

        todays_surgery_list.sort(key=lambda x: parse_time(x.get("arrival_time", "")))

        return {
            "status": "ok",
            "clinic_id": user.clinic_id,  # Return human-readable ID for display
            "stats": {
                "total_patients": total_patients,
                "todays_surgeries": todays_surgeries,
                "pending_review": pending_review,
                "alerts": alerts,
            },
            "todays_surgery_schedule": todays_surgery_list,
            "generated_at": datetime.now().isoformat(),
        }

    except Exception as e:
        print(f"[Dashboard API] Error fetching stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch dashboard stats: {str(e)}")


@router.get("/upcoming-surgeries")
def get_upcoming_surgeries(
    days: int = 7,
    user: AuthenticatedUser = Depends(require_clinic_user),
) -> dict:
    """
    Get surgeries scheduled for the next N days.

    Args:
        days: Number of days to look ahead (default 7)
    """
    client = get_supabase_admin_client()
    if not client:
        raise HTTPException(status_code=500, detail="Database connection not available")

    # Use clinic_uuid (database UUID) not clinic_id (human-readable like "abc-clinic")
    clinic_uuid = user.clinic_uuid
    if not clinic_uuid:
        raise HTTPException(status_code=400, detail="User not associated with a clinic")

    # Calculate date range
    today = datetime.now().date()
    end_date = today + timedelta(days=days)

    try:
        all_patients = client.table("patients").select(
            "id, patient_id, first_name, last_name, surgical_plan, medications_plan"
        ).eq("clinic_id", clinic_uuid).execute()

        upcoming_surgeries = []

        for patient in (all_patients.data or []):
            surgical_plan = patient.get("surgical_plan") or {}
            operative_logistics = surgical_plan.get("operative_logistics") or {}

            for eye_key in ["od_right", "os_left"]:
                eye_data = operative_logistics.get(eye_key) or {}
                surgery_date_str = eye_data.get("surgery_date")

                if surgery_date_str:
                    try:
                        surgery_date = datetime.strptime(surgery_date_str, "%Y-%m-%d").date()

                        if today <= surgery_date <= end_date:
                            first_name = patient.get("first_name", "") or ""
                            last_name = patient.get("last_name", "") or ""
                            patient_name = f"{first_name} {last_name}".strip()

                            # Check readiness
                            meds = patient.get("medications_plan") or {}
                            pre_op = meds.get("pre_op") or meds.get("pre_op_schedule") or {}
                            pre_op_progress = {}
                            if isinstance(pre_op, dict):
                                pre_op_progress = pre_op.get("progress") or {}
                            is_ready = len(pre_op_progress) > 0 if isinstance(pre_op_progress, dict) else False

                            lens_order = eye_data.get("lens_order") or {}
                            lens_info = lens_order.get("model_name") or "Not specified"

                            upcoming_surgeries.append({
                                "patient_id": patient.get("patient_id"),
                                "patient_uuid": patient.get("id"),
                                "patient_name": patient_name or "Unknown",
                                "eye": "OD" if eye_key == "od_right" else "OS",
                                "surgery_date": surgery_date_str,
                                "arrival_time": eye_data.get("arrival_time") or "TBD",
                                "lens": lens_info,
                                "is_ready": is_ready,
                            })
                    except ValueError:
                        continue

        # Sort by surgery date
        upcoming_surgeries.sort(key=lambda x: x.get("surgery_date", ""))

        return {
            "status": "ok",
            "clinic_id": user.clinic_id,  # Return human-readable ID for display
            "date_range": {
                "start": today.isoformat(),
                "end": end_date.isoformat(),
            },
            "surgeries": upcoming_surgeries,
            "total": len(upcoming_surgeries),
        }

    except Exception as e:
        print(f"[Dashboard API] Error fetching upcoming surgeries: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch upcoming surgeries: {str(e)}")
