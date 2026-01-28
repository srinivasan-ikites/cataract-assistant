"""
User Management routes for clinic administrators.

These endpoints allow clinic admins to:
- View users in their clinic
- Invite new users (doctors, staff)
- Update user roles
- Deactivate/reactivate users

Why separate from admin.py?
- admin.py is for super_admin (platform-wide operations)
- users.py is for clinic_admin (clinic-level operations)
- Different permission levels and use cases
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, EmailStr

from fastapi import APIRouter, Depends, HTTPException, status

from adk_app.api.middleware.auth import (
    AuthenticatedUser,
    require_clinic_admin,
    require_clinic_user,
)
from adk_app.services.supabase_service import get_supabase_admin_client

router = APIRouter(prefix="/api/users", tags=["User Management"])


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class InviteUserRequest(BaseModel):
    """Request body for inviting a new user to the clinic."""
    email: EmailStr = Field(..., description="Email address for the new user")
    name: str = Field(..., description="Display name")
    role: str = Field(..., description="Role: 'clinic_admin' or 'clinic_user'")
    password: str = Field(..., min_length=8, description="Initial password (min 8 chars)")
    phone: Optional[str] = Field(None, description="Phone number")
    specialization: Optional[str] = Field(None, description="Medical specialization")


class UpdateUserRequest(BaseModel):
    """Request body for updating a user."""
    name: Optional[str] = None
    role: Optional[str] = Field(None, description="Role: 'clinic_admin' or 'clinic_user'")
    phone: Optional[str] = None
    specialization: Optional[str] = None
    status: Optional[str] = Field(None, description="Status: 'active', 'suspended'")


class UserResponse(BaseModel):
    """Response for a single user."""
    id: str
    email: str
    name: str
    role: str
    status: str
    phone: Optional[str]
    specialization: Optional[str]
    created_at: str


class UserListResponse(BaseModel):
    """Response for listing users."""
    status: str = "ok"
    clinic_id: str
    clinic_name: str
    total: int
    users: List[dict]


# =============================================================================
# USER MANAGEMENT ENDPOINTS
# =============================================================================

@router.get("", response_model=UserListResponse)
async def list_clinic_users(
    user: AuthenticatedUser = Depends(require_clinic_user),
    status_filter: Optional[str] = None,
) -> UserListResponse:
    """
    List all users in the current clinic.

    Any clinic user can view the user list (useful for seeing colleagues).
    Returns users in the same clinic as the authenticated user.
    """
    print(f"[Users API] List users requested by {user.email} for clinic {user.clinic_id}")

    client = get_supabase_admin_client()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection not available"
        )

    try:
        # Build query - filter by user's clinic
        query = client.table("user_profiles").select("*").eq("clinic_id", user.clinic_uuid)

        if status_filter:
            query = query.eq("status", status_filter)

        query = query.order("created_at", desc=True)

        result = query.execute()
        users = result.data or []

        print(f"[Users API] Found {len(users)} users in clinic {user.clinic_id}")

        return UserListResponse(
            status="ok",
            clinic_id=user.clinic_id,
            clinic_name=user.clinic_name or "",
            total=len(users),
            users=users
        )

    except Exception as e:
        print(f"[Users API] Error listing users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list users: {str(e)}"
        )


@router.post("")
async def invite_user(
    request: InviteUserRequest,
    user: AuthenticatedUser = Depends(require_clinic_admin),
) -> dict:
    """
    Invite a new user to the clinic.

    Clinic Admin only - creates a new auth user and user_profile.

    The new user will be able to login immediately with the provided password.
    They should be instructed to change their password on first login.

    Roles:
    - clinic_admin: Can manage users, full access to clinic data
    - clinic_user: Can view/edit patients, limited admin access
    """
    print(f"[Users API] Invite user '{request.email}' requested by {user.email}")

    # Validate role
    if request.role not in ["clinic_admin", "clinic_user"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be 'clinic_admin' or 'clinic_user'"
        )

    client = get_supabase_admin_client()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection not available"
        )

    try:
        # Check if email already exists in user_profiles
        existing = client.table("user_profiles").select("id").eq("email", request.email).execute()
        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A user with email '{request.email}' already exists"
            )

        # Create auth user in Supabase Auth
        print(f"[Users API] Creating auth user for {request.email}")
        auth_response = client.auth.admin.create_user({
            "email": request.email,
            "password": request.password,
            "email_confirm": True,  # Auto-confirm email
        })

        if not auth_response.user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create auth user"
            )

        auth_user = auth_response.user
        print(f"[Users API] Created auth user: {auth_user.id}")

        # Create user_profile
        profile_data = {
            "id": auth_user.id,
            "email": request.email,
            "name": request.name,
            "role": request.role,
            "clinic_id": user.clinic_uuid,  # Assign to current user's clinic
            "phone": request.phone,
            "specialization": request.specialization,
            "status": "active",
        }

        profile_result = client.table("user_profiles").insert(profile_data).execute()

        if not profile_result.data:
            # Rollback: delete auth user if profile creation fails
            print(f"[Users API] Profile creation failed, rolling back auth user")
            client.auth.admin.delete_user(auth_user.id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user profile"
            )

        new_user = profile_result.data[0]
        print(f"[Users API] Created user profile for {request.email} in clinic {user.clinic_id}")

        return {
            "status": "ok",
            "message": f"User '{request.email}' invited successfully",
            "user": {
                "id": new_user["id"],
                "email": new_user["email"],
                "name": new_user["name"],
                "role": new_user["role"],
                "status": new_user["status"],
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Users API] Error inviting user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to invite user: {str(e)}"
        )


@router.get("/{user_id}")
async def get_user_details(
    user_id: str,
    user: AuthenticatedUser = Depends(require_clinic_user),
) -> dict:
    """
    Get details for a specific user in the clinic.

    Any clinic user can view user details (for collaboration).
    Can only view users in the same clinic.
    """
    print(f"[Users API] Get user {user_id} requested by {user.email}")

    client = get_supabase_admin_client()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection not available"
        )

    try:
        # Get user - must be in same clinic
        result = client.table("user_profiles").select("*").eq("id", user_id).eq("clinic_id", user.clinic_uuid).single().execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found or not in your clinic"
            )

        return {
            "status": "ok",
            "user": result.data
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Users API] Error getting user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user: {str(e)}"
        )


@router.put("/{user_id}")
async def update_user(
    user_id: str,
    request: UpdateUserRequest,
    user: AuthenticatedUser = Depends(require_clinic_admin),
) -> dict:
    """
    Update a user's information.

    Clinic Admin only - can update name, role, phone, specialization, status.

    Status can be:
    - active: Normal access
    - suspended: Cannot login

    Note: Cannot change a user's email (they would need to be re-invited).
    Note: Cannot update yourself to prevent accidental lockout.
    """
    print(f"[Users API] Update user {user_id} requested by {user.email}")

    # Prevent self-modification of role/status
    if user_id == user.id and (request.role or request.status):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own role or status. Ask another admin."
        )

    client = get_supabase_admin_client()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection not available"
        )

    try:
        # Verify user exists and is in same clinic
        existing = client.table("user_profiles").select("id, clinic_id").eq("id", user_id).single().execute()

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        if existing.data["clinic_id"] != user.clinic_uuid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot modify users from other clinics"
            )

        # Build update data
        update_data = {}
        if request.name is not None:
            update_data["name"] = request.name
        if request.role is not None:
            if request.role not in ["clinic_admin", "clinic_user"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Role must be 'clinic_admin' or 'clinic_user'"
                )
            update_data["role"] = request.role
        if request.phone is not None:
            update_data["phone"] = request.phone
        if request.specialization is not None:
            update_data["specialization"] = request.specialization
        if request.status is not None:
            if request.status not in ["active", "suspended"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Status must be 'active' or 'suspended'"
                )
            update_data["status"] = request.status

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )

        update_data["updated_at"] = datetime.utcnow().isoformat()

        # Update
        result = client.table("user_profiles").update(update_data).eq("id", user_id).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update user"
            )

        updated_user = result.data[0]
        print(f"[Users API] Updated user {user_id}: {list(update_data.keys())}")

        return {
            "status": "ok",
            "message": "User updated successfully",
            "user": updated_user
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Users API] Error updating user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user: {str(e)}"
        )


@router.delete("/{user_id}")
async def deactivate_user(
    user_id: str,
    user: AuthenticatedUser = Depends(require_clinic_admin),
) -> dict:
    """
    Deactivate a user (soft delete).

    Clinic Admin only - sets user status to 'suspended'.
    The user will no longer be able to login.

    Note: This doesn't delete the auth user or data, just prevents access.
    Note: Cannot deactivate yourself.
    """
    print(f"[Users API] Deactivate user {user_id} requested by {user.email}")

    if user_id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate yourself. Ask another admin."
        )

    client = get_supabase_admin_client()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection not available"
        )

    try:
        # Verify user exists and is in same clinic
        existing = client.table("user_profiles").select("id, email, clinic_id").eq("id", user_id).single().execute()

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        if existing.data["clinic_id"] != user.clinic_uuid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot modify users from other clinics"
            )

        # Update status to suspended
        result = client.table("user_profiles").update({
            "status": "suspended",
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", user_id).execute()

        print(f"[Users API] Deactivated user {existing.data['email']}")

        return {
            "status": "ok",
            "message": f"User '{existing.data['email']}' has been deactivated"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Users API] Error deactivating user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to deactivate user: {str(e)}"
        )


@router.post("/{user_id}/reactivate")
async def reactivate_user(
    user_id: str,
    user: AuthenticatedUser = Depends(require_clinic_admin),
) -> dict:
    """
    Reactivate a suspended user.

    Clinic Admin only - sets user status back to 'active'.
    """
    print(f"[Users API] Reactivate user {user_id} requested by {user.email}")

    client = get_supabase_admin_client()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection not available"
        )

    try:
        # Verify user exists and is in same clinic
        existing = client.table("user_profiles").select("id, email, clinic_id, status").eq("id", user_id).single().execute()

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        if existing.data["clinic_id"] != user.clinic_uuid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot modify users from other clinics"
            )

        if existing.data["status"] == "active":
            return {
                "status": "ok",
                "message": "User is already active"
            }

        # Update status to active
        result = client.table("user_profiles").update({
            "status": "active",
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", user_id).execute()

        print(f"[Users API] Reactivated user {existing.data['email']}")

        return {
            "status": "ok",
            "message": f"User '{existing.data['email']}' has been reactivated"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Users API] Error reactivating user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reactivate user: {str(e)}"
        )
