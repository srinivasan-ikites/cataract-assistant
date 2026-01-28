"""
Health check route.
"""
from fastapi import APIRouter, Depends

from adk_app.services.supabase_service import get_supabase_admin_client
from adk_app.api.middleware.auth import (
    AuthenticatedUser,
    get_current_user,
    require_clinic_user,
)

router = APIRouter(tags=["Health"])


@router.get("/healthz")
def health() -> dict:
    """Health check endpoint."""
    return {"status": "ok"}


@router.get("/healthz/supabase")
def supabase_health() -> dict:
    """
    Supabase connection health check.

    Tests the database connection by querying the clinics table.
    Returns connection status and clinic count.
    """
    try:
        client = get_supabase_admin_client()
        if not client:
            return {
                "status": "error",
                "message": "Supabase client not initialized"
            }

        # Test query - count clinics
        response = client.table("clinics").select("id", count="exact").execute()
        clinic_count = response.count if response.count is not None else len(response.data or [])

        return {
            "status": "ok",
            "database": "connected",
            "clinic_count": clinic_count
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }


@router.get("/healthz/auth-test")
def auth_test(user: AuthenticatedUser = Depends(get_current_user)):
    """
    Test endpoint to verify authentication middleware.

    Requires a valid JWT token in the Authorization header.
    Returns the authenticated user's info.

    Usage:
        curl http://localhost:8000/healthz/auth-test \
            -H "Authorization: Bearer <your_access_token>"
    """
    print(f"[Auth Test] Authenticated user: {user.name} ({user.email})")
    print(f"[Auth Test] Role: {user.role} | Clinic: {user.clinic_name}")

    return {
        "status": "authenticated",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "clinic_id": user.clinic_id,
            "clinic_name": user.clinic_name,
        }
    }


@router.get("/healthz/clinic-test")
def clinic_access_test(user: AuthenticatedUser = Depends(require_clinic_user)):
    """
    Test endpoint to verify clinic user access.

    Requires:
    - Valid JWT token
    - User must be clinic_admin or clinic_user

    Usage:
        curl http://localhost:8000/healthz/clinic-test \
            -H "Authorization: Bearer <your_access_token>"
    """
    print(f"[Clinic Test] Clinic user verified: {user.name}")
    print(f"[Clinic Test] Clinic: {user.clinic_name} (ID: {user.clinic_id})")

    return {
        "status": "clinic_access_granted",
        "user": user.name,
        "role": user.role,
        "clinic": {
            "id": user.clinic_id,
            "name": user.clinic_name,
        }
    }
