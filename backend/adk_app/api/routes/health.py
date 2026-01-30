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


@router.get("/healthz/storage")
def storage_health() -> dict:
    """
    Supabase Storage health check.

    Tests storage connection by listing buckets.
    """
    try:
        client = get_supabase_admin_client()
        if not client:
            return {
                "status": "error",
                "message": "Supabase client not initialized"
            }

        # List all buckets
        buckets = client.storage.list_buckets()
        bucket_names = [b.name for b in buckets]

        # Check for patient-documents bucket
        patient_docs_exists = "patient-documents" in bucket_names

        # Try to list files in patient-documents if it exists
        files_count = 0
        if patient_docs_exists:
            try:
                files = client.storage.from_("patient-documents").list()
                files_count = len(files) if files else 0
            except Exception as list_err:
                print(f"[Storage Health] Error listing files: {list_err}")

        return {
            "status": "ok",
            "storage": "connected",
            "buckets": bucket_names,
            "patient_documents_bucket": {
                "exists": patient_docs_exists,
                "files_count": files_count if patient_docs_exists else "N/A"
            }
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "message": str(e),
            "type": type(e).__name__
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
