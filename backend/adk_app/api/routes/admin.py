"""
Admin routes for platform management (Super Admin only).

These endpoints allow super admins to:
- Manage clinics (create, view, update)
- View platform statistics
- Monitor system health

All routes require super_admin role.

Why separate admin routes?
- Clear separation of concerns
- Easy to audit admin actions
- Different security requirements than clinic routes
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException, status

from adk_app.api.middleware.auth import (
    AuthenticatedUser,
    require_super_admin,
)
from adk_app.services.supabase_service import get_supabase_admin_client
from adk_app.utils.supabase_data_loader import get_login_activity

router = APIRouter(prefix="/api/admin", tags=["Admin"])


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class CreateClinicRequest(BaseModel):
    """Request body for creating a new clinic."""
    clinic_id: str = Field(..., description="Human-readable clinic ID like 'VIC-MCLEAN-001'")
    name: str = Field(..., description="Clinic display name")
    address: Optional[dict] = Field(default={}, description="Address object")
    contact: Optional[dict] = Field(default={}, description="Contact information")
    settings: Optional[dict] = Field(default={}, description="Clinic settings")


class UpdateClinicRequest(BaseModel):
    """Request body for updating a clinic."""
    name: Optional[str] = None
    address: Optional[dict] = None
    contact: Optional[dict] = None
    settings: Optional[dict] = None
    status: Optional[str] = Field(None, description="active, suspended, or inactive")


class ClinicResponse(BaseModel):
    """Response for a single clinic."""
    id: str
    clinic_id: str
    name: str
    address: dict
    contact: dict
    settings: dict
    status: str
    created_at: str
    updated_at: str


class ClinicListResponse(BaseModel):
    """Response for listing clinics."""
    status: str = "ok"
    total: int
    clinics: List[dict]


class ClinicStatsResponse(BaseModel):
    """Response for clinic statistics."""
    status: str = "ok"
    clinic_id: str
    clinic_name: str
    stats: dict


# =============================================================================
# CLINIC MANAGEMENT ENDPOINTS
# =============================================================================

@router.get("/clinics", response_model=ClinicListResponse)
async def list_all_clinics(
    user: AuthenticatedUser = Depends(require_super_admin),
    status_filter: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> ClinicListResponse:
    """
    List all clinics in the system.

    Super Admin only - returns all clinics with basic info.

    Query params:
    - status_filter: Filter by status (active, suspended, inactive)
    - limit: Max results (default 100)
    - offset: Pagination offset
    """
    print(f"[Admin API] List clinics requested by {user.email}")

    client = get_supabase_admin_client()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection not available"
        )

    try:
        # Build query
        query = client.table("clinics").select("*")

        if status_filter:
            query = query.eq("status", status_filter)

        query = query.order("created_at", desc=True)
        query = query.range(offset, offset + limit - 1)

        result = query.execute()
        clinics = result.data or []

        # Get total count
        count_query = client.table("clinics").select("id", count="exact")
        if status_filter:
            count_query = count_query.eq("status", status_filter)
        count_result = count_query.execute()
        total = count_result.count or len(clinics)

        print(f"[Admin API] Found {len(clinics)} clinics (total: {total})")

        return ClinicListResponse(
            status="ok",
            total=total,
            clinics=clinics
        )

    except Exception as e:
        print(f"[Admin API] Error listing clinics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list clinics: {str(e)}"
        )


@router.post("/clinics", response_model=ClinicResponse)
async def create_clinic(
    request: CreateClinicRequest,
    user: AuthenticatedUser = Depends(require_super_admin),
) -> dict:
    """
    Create a new clinic.

    Super Admin only - creates a new clinic in the system.

    The clinic_id must be unique and follow the pattern like 'VIC-MCLEAN-001'.
    This ID is used in URLs and API calls.
    """
    print(f"[Admin API] Create clinic '{request.clinic_id}' requested by {user.email}")

    client = get_supabase_admin_client()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection not available"
        )

    try:
        # Check if clinic_id already exists
        existing = client.table("clinics").select("id").eq("clinic_id", request.clinic_id).execute()
        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Clinic with ID '{request.clinic_id}' already exists"
            )

        # Create the clinic
        clinic_data = {
            "clinic_id": request.clinic_id,
            "name": request.name,
            "address": request.address or {},
            "contact": request.contact or {},
            "settings": request.settings or {},
            "status": "active",
        }

        result = client.table("clinics").insert(clinic_data).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create clinic"
            )

        clinic = result.data[0]
        print(f"[Admin API] Created clinic: {clinic['clinic_id']} (UUID: {clinic['id']})")

        # Also create empty clinic_config
        config_data = {
            "clinic_id": clinic["id"],
            "surgical_packages": [],
            "lens_inventory": {},
            "medications": {},
            "sops": {},
            "staff_directory": [],
        }
        client.table("clinic_config").insert(config_data).execute()
        print(f"[Admin API] Created clinic_config for {clinic['clinic_id']}")

        return clinic

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Admin API] Error creating clinic: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create clinic: {str(e)}"
        )


@router.get("/clinics/{clinic_uuid}")
async def get_clinic_details(
    clinic_uuid: str,
    user: AuthenticatedUser = Depends(require_super_admin),
) -> dict:
    """
    Get detailed information about a specific clinic.

    Super Admin only - returns full clinic data including config.

    Note: Use the clinic's UUID (not the human-readable clinic_id).
    """
    print(f"[Admin API] Get clinic {clinic_uuid} requested by {user.email}")

    client = get_supabase_admin_client()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection not available"
        )

    try:
        # Get clinic with config
        result = client.table("clinics").select(
            "*, clinic_config(*)"
        ).eq("id", clinic_uuid).single().execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Clinic not found: {clinic_uuid}"
            )

        clinic = result.data
        print(f"[Admin API] Found clinic: {clinic['name']} ({clinic['clinic_id']})")

        return {
            "status": "ok",
            "clinic": clinic
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Admin API] Error getting clinic: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get clinic: {str(e)}"
        )


@router.put("/clinics/{clinic_uuid}")
async def update_clinic(
    clinic_uuid: str,
    request: UpdateClinicRequest,
    user: AuthenticatedUser = Depends(require_super_admin),
) -> dict:
    """
    Update a clinic's information.

    Super Admin only - can update name, address, contact, settings, and status.

    Status can be:
    - active: Normal operation
    - suspended: Temporarily disabled (users can't login)
    - inactive: Permanently disabled
    """
    print(f"[Admin API] Update clinic {clinic_uuid} requested by {user.email}")

    client = get_supabase_admin_client()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection not available"
        )

    try:
        # Build update data (only include non-None fields)
        update_data = {}
        if request.name is not None:
            update_data["name"] = request.name
        if request.address is not None:
            update_data["address"] = request.address
        if request.contact is not None:
            update_data["contact"] = request.contact
        if request.settings is not None:
            update_data["settings"] = request.settings
        if request.status is not None:
            if request.status not in ["active", "suspended", "inactive"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Status must be 'active', 'suspended', or 'inactive'"
                )
            update_data["status"] = request.status

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )

        # Add updated_at timestamp
        update_data["updated_at"] = datetime.utcnow().isoformat()

        # Update the clinic
        result = client.table("clinics").update(update_data).eq("id", clinic_uuid).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Clinic not found: {clinic_uuid}"
            )

        clinic = result.data[0]
        print(f"[Admin API] Updated clinic: {clinic['name']} - fields: {list(update_data.keys())}")

        return {
            "status": "ok",
            "clinic": clinic
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Admin API] Error updating clinic: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update clinic: {str(e)}"
        )


@router.get("/clinics/{clinic_uuid}/stats")
async def get_clinic_stats(
    clinic_uuid: str,
    user: AuthenticatedUser = Depends(require_super_admin),
) -> dict:
    """
    Get statistics for a specific clinic.

    Super Admin only - returns counts of patients, users, etc.

    Useful for monitoring clinic activity and usage.
    """
    print(f"[Admin API] Get stats for clinic {clinic_uuid} requested by {user.email}")

    client = get_supabase_admin_client()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection not available"
        )

    try:
        # Get clinic basic info
        clinic_result = client.table("clinics").select("id, clinic_id, name").eq("id", clinic_uuid).single().execute()

        if not clinic_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Clinic not found: {clinic_uuid}"
            )

        clinic = clinic_result.data

        # Count patients
        patients_result = client.table("patients").select("id", count="exact").eq("clinic_id", clinic_uuid).execute()
        patient_count = patients_result.count or 0

        # Count patients by status
        status_counts = {}
        for patient_status in ["new", "in_progress", "reviewed", "archived"]:
            status_result = client.table("patients").select("id", count="exact").eq("clinic_id", clinic_uuid).eq("status", patient_status).execute()
            status_counts[patient_status] = status_result.count or 0

        # Count users
        users_result = client.table("user_profiles").select("id", count="exact").eq("clinic_id", clinic_uuid).execute()
        user_count = users_result.count or 0

        # Count active users
        active_users_result = client.table("user_profiles").select("id", count="exact").eq("clinic_id", clinic_uuid).eq("status", "active").execute()
        active_user_count = active_users_result.count or 0

        stats = {
            "patients": {
                "total": patient_count,
                "by_status": status_counts
            },
            "users": {
                "total": user_count,
                "active": active_user_count
            }
        }

        print(f"[Admin API] Stats for {clinic['clinic_id']}: {patient_count} patients, {user_count} users")

        return {
            "status": "ok",
            "clinic_id": clinic["clinic_id"],
            "clinic_name": clinic["name"],
            "stats": stats
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Admin API] Error getting clinic stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get clinic stats: {str(e)}"
        )


# =============================================================================
# PLATFORM OVERVIEW
# =============================================================================

@router.get("/overview")
async def get_platform_overview(
    user: AuthenticatedUser = Depends(require_super_admin),
) -> dict:
    """
    Get platform-wide overview statistics.

    Super Admin only - returns high-level stats about the entire platform.

    Useful for dashboard widgets and monitoring.
    """
    print(f"[Admin API] Platform overview requested by {user.email}")

    client = get_supabase_admin_client()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection not available"
        )

    try:
        # Count clinics
        clinics_result = client.table("clinics").select("id", count="exact").execute()
        clinic_count = clinics_result.count or 0

        # Count active clinics
        active_clinics_result = client.table("clinics").select("id", count="exact").eq("status", "active").execute()
        active_clinic_count = active_clinics_result.count or 0

        # Count total patients
        patients_result = client.table("patients").select("id", count="exact").execute()
        patient_count = patients_result.count or 0

        # Count total users
        users_result = client.table("user_profiles").select("id", count="exact").execute()
        user_count = users_result.count or 0

        overview = {
            "clinics": {
                "total": clinic_count,
                "active": active_clinic_count
            },
            "patients": {
                "total": patient_count
            },
            "users": {
                "total": user_count
            }
        }

        print(f"[Admin API] Platform overview: {clinic_count} clinics, {patient_count} patients, {user_count} users")

        return {
            "status": "ok",
            "overview": overview
        }

    except Exception as e:
        print(f"[Admin API] Error getting platform overview: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get platform overview: {str(e)}"
        )


# ── Login Activity ─────────────────────────────────────────────────────


@router.get("/login-activity")
async def list_login_activity(
    limit: int = 100,
    user: AuthenticatedUser = Depends(require_super_admin),
):
    """Fetch recent login activity across all clinics."""
    activity = get_login_activity(limit=limit)
    return {"status": "ok", "activity": activity, "count": len(activity)}
