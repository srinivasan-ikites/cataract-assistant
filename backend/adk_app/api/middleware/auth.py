"""
Authentication middleware and dependencies.

This module provides FastAPI dependencies for protecting routes:
- get_current_user: Validates JWT and returns user info
- require_clinic_user: Ensures user has clinic access
- require_clinic_admin: Ensures user is a clinic admin
- require_super_admin: Ensures user is a super admin

Usage in routes:
    from adk_app.api.middleware.auth import get_current_user, require_clinic_user

    @router.get("/patients")
    def get_patients(user: AuthenticatedUser = Depends(require_clinic_user)):
        # user.clinic_id is guaranteed to exist here
        return get_patients_for_clinic(user.clinic_id)

MongoDB comparison:
- In MongoDB/Express, you'd use middleware like passport.js or custom JWT validation
- In FastAPI, we use "Dependencies" which work similarly but are more type-safe
"""

from __future__ import annotations

from typing import Optional
from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from adk_app.services.supabase_service import get_supabase_admin_client


# =============================================================================
# SECURITY SCHEME
# =============================================================================

# This tells FastAPI to look for "Authorization: Bearer <token>" header
# It also adds the lock icon in Swagger UI
bearer_scheme = HTTPBearer(auto_error=False)


# =============================================================================
# USER DATA CLASS
# =============================================================================

@dataclass
class AuthenticatedUser:
    """
    Represents an authenticated user with all necessary context.

    This is what you get when you use Depends(get_current_user).
    """
    id: str                      # User's UUID (from auth.users)
    email: str                   # User's email
    name: str                    # User's display name
    role: str                    # 'super_admin', 'clinic_admin', or 'clinic_user'
    status: str                  # 'active', 'invited', 'suspended'
    clinic_uuid: Optional[str]   # Clinic's database UUID (for DB operations)
    clinic_id: Optional[str]     # Human-readable clinic ID like "VIC-MCLEAN-001" (for API/display)
    clinic_name: Optional[str]   # Clinic name (None for super_admin)
    clinic_status: Optional[str] # Clinic status (None for super_admin)

    def validate_clinic_access(self, requested_clinic_id: str) -> bool:
        """
        Check if this user has access to the requested clinic.

        For clinic users: must match their clinic_id
        For super admins: always allowed

        Usage:
            if not user.validate_clinic_access(clinic_id):
                raise HTTPException(403, "Access denied to this clinic")
        """
        if self.role == "super_admin":
            return True
        return self.clinic_id == requested_clinic_id


# =============================================================================
# CORE AUTHENTICATION DEPENDENCY
# =============================================================================

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)
) -> AuthenticatedUser:
    """
    Validate JWT token and return the authenticated user.

    This is the core authentication dependency. It:
    1. Extracts the token from Authorization header
    2. Validates the token with Supabase
    3. Fetches user profile and clinic info
    4. Returns an AuthenticatedUser object

    Raises:
        HTTPException 401: If token is missing, invalid, or expired
        HTTPException 403: If user account is not active
        HTTPException 503: If database is unavailable

    Usage:
        @router.get("/protected")
        def protected_route(user: AuthenticatedUser = Depends(get_current_user)):
            print(f"Request from {user.name} ({user.role})")
            return {"message": f"Hello {user.name}"}
    """

    # -------------------------------------------------------------------------
    # Step 1: Check if token is provided
    # -------------------------------------------------------------------------
    if not credentials:
        print("[Auth Middleware] No credentials provided in request")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid token.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = credentials.credentials
    print(f"[Auth Middleware] Token received: {token[:20]}...{token[-10:]}")

    # -------------------------------------------------------------------------
    # Step 2: Get Supabase client
    # -------------------------------------------------------------------------
    client = get_supabase_admin_client()
    if not client:
        print("[Auth Middleware] ERROR: Supabase client not available")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection not available"
        )

    # -------------------------------------------------------------------------
    # Step 3: Validate token with Supabase
    # -------------------------------------------------------------------------
    try:
        print("[Auth Middleware] Validating token with Supabase...")
        user_response = client.auth.get_user(token)
        auth_user = user_response.user

        if not auth_user:
            print("[Auth Middleware] Token validation failed: No user returned")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"}
            )

        print(f"[Auth Middleware] Token valid for user: {auth_user.email} (ID: {auth_user.id})")

    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        print(f"[Auth Middleware] Token validation error: {error_msg}")

        if "expired" in error_msg.lower() or "invalid" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired. Please login again.",
                headers={"WWW-Authenticate": "Bearer"}
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # -------------------------------------------------------------------------
    # Step 4: Fetch user profile from user_profiles table
    # -------------------------------------------------------------------------
    try:
        print(f"[Auth Middleware] Fetching user profile for ID: {auth_user.id}")

        # Query user_profiles with joined clinics data
        profile_response = client.table("user_profiles").select(
            "id, name, email, role, status, phone, specialization, "
            "clinics(id, clinic_id, name, status)"
        ).eq("id", auth_user.id).single().execute()

        profile = profile_response.data

        if not profile:
            print(f"[Auth Middleware] ERROR: No user_profile found for auth user {auth_user.id}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account not configured. Please contact your administrator."
            )

        print(f"[Auth Middleware] Profile found: {profile.get('name')} | Role: {profile.get('role')} | Status: {profile.get('status')}")

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Auth Middleware] Error fetching user profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching user profile"
        )

    # -------------------------------------------------------------------------
    # Step 5: Validate user status
    # -------------------------------------------------------------------------
    user_status = profile.get("status", "")

    if user_status != "active":
        print(f"[Auth Middleware] User account not active. Status: {user_status}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your account is {user_status}. Please contact your administrator."
        )

    # -------------------------------------------------------------------------
    # Step 6: Validate clinic (for non-super-admins)
    # -------------------------------------------------------------------------
    clinic = profile.get("clinics")
    role = profile.get("role", "")

    if role != "super_admin":
        if not clinic:
            print(f"[Auth Middleware] ERROR: Non-super-admin user has no clinic assigned")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is not associated with any clinic."
            )

        clinic_status = clinic.get("status", "")
        if clinic_status != "active":
            print(f"[Auth Middleware] Clinic not active. Status: {clinic_status}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Your clinic is {clinic_status}. Please contact support."
            )

        print(f"[Auth Middleware] Clinic: {clinic.get('name')} (ID: {clinic.get('id')}) | Status: {clinic_status}")
    else:
        print(f"[Auth Middleware] Super admin user - no clinic restriction")

    # -------------------------------------------------------------------------
    # Step 7: Build and return AuthenticatedUser
    # -------------------------------------------------------------------------
    authenticated_user = AuthenticatedUser(
        id=auth_user.id,
        email=auth_user.email,
        name=profile.get("name", ""),
        role=role,
        status=user_status,
        clinic_uuid=clinic.get("id") if clinic else None,        # Database UUID
        clinic_id=clinic.get("clinic_id") if clinic else None,   # Human-readable ID like "VIC-MCLEAN-001"
        clinic_name=clinic.get("name") if clinic else None,
        clinic_status=clinic.get("status") if clinic else None,
    )

    print(f"[Auth Middleware] ✓ Authentication successful: {authenticated_user.name} ({authenticated_user.role}) | Clinic: {authenticated_user.clinic_id}")

    return authenticated_user


# =============================================================================
# ROLE-BASED DEPENDENCIES
# =============================================================================

async def require_clinic_user(
    user: AuthenticatedUser = Depends(get_current_user)
) -> AuthenticatedUser:
    """
    Require the user to be a clinic_admin or clinic_user.

    This dependency ensures:
    - User is authenticated
    - User role is 'clinic_admin' or 'clinic_user'
    - User has an active clinic

    Use this for routes that any clinic staff can access.

    Usage:
        @router.get("/patients")
        def get_patients(user: AuthenticatedUser = Depends(require_clinic_user)):
            return get_patients_for_clinic(user.clinic_id)
    """
    allowed_roles = ["clinic_admin", "clinic_user"]

    if user.role not in allowed_roles:
        print(f"[Auth Middleware] Access denied: {user.role} not in {allowed_roles}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. This action requires clinic staff privileges."
        )

    if not user.clinic_id:
        print(f"[Auth Middleware] Access denied: No clinic_id for clinic user")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You are not associated with any clinic."
        )

    print(f"[Auth Middleware] ✓ Clinic user access granted: {user.name}")
    return user


async def require_clinic_admin(
    user: AuthenticatedUser = Depends(get_current_user)
) -> AuthenticatedUser:
    """
    Require the user to be a clinic_admin.

    This dependency ensures:
    - User is authenticated
    - User role is 'clinic_admin'

    Use this for routes that only clinic admins can access (e.g., team management).

    Usage:
        @router.post("/invite-user")
        def invite_user(user: AuthenticatedUser = Depends(require_clinic_admin)):
            # Only clinic admins can invite new users
            ...
    """
    if user.role != "clinic_admin":
        print(f"[Auth Middleware] Access denied: {user.role} is not clinic_admin")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. This action requires clinic administrator privileges."
        )

    print(f"[Auth Middleware] ✓ Clinic admin access granted: {user.name}")
    return user


async def require_super_admin(
    user: AuthenticatedUser = Depends(get_current_user)
) -> AuthenticatedUser:
    """
    Require the user to be a super_admin.

    This dependency ensures:
    - User is authenticated
    - User role is 'super_admin'

    Use this for platform management routes (e.g., clinic approval).

    Usage:
        @router.post("/admin/approve-clinic")
        def approve_clinic(user: AuthenticatedUser = Depends(require_super_admin)):
            # Only super admins can approve clinics
            ...
    """
    if user.role != "super_admin":
        print(f"[Auth Middleware] Access denied: {user.role} is not super_admin")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. This action requires platform administrator privileges."
        )

    print(f"[Auth Middleware] ✓ Super admin access granted: {user.name}")
    return user


# =============================================================================
# OPTIONAL AUTHENTICATION
# =============================================================================

async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)
) -> Optional[AuthenticatedUser]:
    """
    Get current user if token is provided, otherwise return None.

    Use this for routes that work for both authenticated and anonymous users,
    but may behave differently based on authentication status.

    Usage:
        @router.get("/public-data")
        def get_data(user: Optional[AuthenticatedUser] = Depends(get_current_user_optional)):
            if user:
                return {"data": "personalized for " + user.name}
            return {"data": "generic data"}
    """
    if not credentials:
        print("[Auth Middleware] No credentials provided - returning None (optional auth)")
        return None

    try:
        return await get_current_user(credentials)
    except HTTPException as e:
        print(f"[Auth Middleware] Optional auth failed: {e.detail} - returning None")
        return None


# =============================================================================
# CLINIC ACCESS VALIDATION
# =============================================================================

def validate_clinic_access(user: AuthenticatedUser, requested_clinic_id: str) -> None:
    """
    Validate that the user has access to the requested clinic.

    Raises HTTPException 403 if access is denied.

    Why this is important:
    - In multi-tenant SaaS, users should only access their own clinic's data
    - Without this check, a user could pass any clinic_id and access other clinics' data
    - Super admins bypass this check (they can access all clinics)

    Usage:
        @router.post("/uploads/patient")
        def upload(clinic_id: str, user: AuthenticatedUser = Depends(require_clinic_user)):
            validate_clinic_access(user, clinic_id)  # Raises 403 if not allowed
            # ... proceed with upload
    """
    if user.role == "super_admin":
        print(f"[Auth] Super admin access to clinic {requested_clinic_id} - allowed")
        return

    if user.clinic_id != requested_clinic_id:
        print(f"[Auth] ACCESS DENIED: User clinic {user.clinic_id} != requested {requested_clinic_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. You don't have permission to access clinic '{requested_clinic_id}'."
        )

    print(f"[Auth] Clinic access validated: {user.name} -> {requested_clinic_id}")
