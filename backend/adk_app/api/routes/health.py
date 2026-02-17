"""
Health check route.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends

from adk_app.services.supabase_service import get_supabase_admin_client
from adk_app.api.middleware.auth import (
    AuthenticatedUser,
    get_current_user,
    require_clinic_user,
)

router = APIRouter(tags=["Health"])


@router.get("/ping")
def ping() -> dict:
    """Ping endpoint with status and timestamp."""
    return {
        "status": 200,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/version")
def version() -> dict:
    """Version endpoint returning app version and environment."""
    return {
        "version": "1.0.0",
        "environment": "development"
    }


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


@router.get("/healthz/test-error")
def test_error() -> dict:
    """Temporary test endpoint to trigger a 500 error for New Relic alert testing. REMOVE AFTER TESTING."""
    raise RuntimeError("TEST ERROR: This is a deliberate 500 error to verify New Relic alerting pipeline")


@router.get("/healthz/storage-debug")
def storage_debug() -> dict:
    """
    Debug endpoint to list all files in patient-documents bucket.

    This helps diagnose storage upload issues.
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
        bucket_info = []
        for b in buckets:
            bucket_info.append({
                "name": b.name,
                "id": b.id,
                "public": b.public,
                "created_at": str(b.created_at) if b.created_at else None,
            })

        # List root level of patient-documents bucket
        root_files = []
        subfolders = []
        all_files = []
        try:
            root_items = client.storage.from_("patient-documents").list(path="")
            print(f"[Storage Debug] Root items: {root_items}")
            for item in root_items or []:
                if isinstance(item, dict):
                    item_id = item.get("id")
                    item_name = item.get("name")
                else:
                    item_id = getattr(item, "id", None)
                    item_name = getattr(item, "name", None)

                if item_id:
                    root_files.append(item_name)
                else:
                    # It's a folder, try to list its contents
                    subfolders.append(item_name)
                    try:
                        # List subfolder contents (clinic_id level)
                        subfolder_items = client.storage.from_("patient-documents").list(path=item_name)
                        for sub_item in subfolder_items or []:
                            sub_name = sub_item.get("name") if isinstance(sub_item, dict) else getattr(sub_item, "name", None)
                            sub_id = sub_item.get("id") if isinstance(sub_item, dict) else getattr(sub_item, "id", None)
                            if sub_id:
                                all_files.append(f"{item_name}/{sub_name}")
                            else:
                                # It's another subfolder (patient_id level)
                                try:
                                    patient_items = client.storage.from_("patient-documents").list(path=f"{item_name}/{sub_name}")
                                    for p_item in patient_items or []:
                                        p_name = p_item.get("name") if isinstance(p_item, dict) else getattr(p_item, "name", None)
                                        p_id = p_item.get("id") if isinstance(p_item, dict) else getattr(p_item, "id", None)
                                        if p_id:
                                            all_files.append(f"{item_name}/{sub_name}/{p_name}")
                                except Exception as pe:
                                    print(f"[Storage Debug] Error listing patient folder: {pe}")
                    except Exception as se:
                        print(f"[Storage Debug] Error listing subfolder {item_name}: {se}")
        except Exception as list_err:
            print(f"[Storage Debug] Error listing root: {list_err}")
            import traceback
            traceback.print_exc()

        return {
            "status": "ok",
            "buckets": bucket_info,
            "patient_documents": {
                "root_files": root_files,
                "subfolders": subfolders,
                "all_files": all_files[:50],  # Limit to 50 files
                "total_files": len(all_files),
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
