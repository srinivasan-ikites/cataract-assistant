"""
Authentication routes for clinic users (admin, doctors, staff).

This module handles:
- Login (email + password)
- Logout
- Get current user profile

How it works:
1. User sends email + password to /login
2. Supabase validates credentials and returns JWT tokens
3. Frontend stores tokens and sends them with future requests
4. /me endpoint returns user profile + clinic info

MongoDB comparison:
- In MongoDB, you'd manually hash passwords and create JWTs
- Supabase handles all of this automatically via auth.users table
"""

import re
from fastapi import APIRouter, HTTPException, status, Header
from pydantic import BaseModel, EmailStr

from adk_app.services.supabase_service import get_supabase_admin_client


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def generate_clinic_slug(name: str, existing_slugs: list[str] = None) -> str:
    """
    Generate a URL-safe slug from clinic name.

    Examples:
        "McLean Eye Clinic" -> "mclean-eye-clinic"
        "Dr. Smith's Office" -> "dr-smiths-office"
        "ABC Eye Center (Main)" -> "abc-eye-center-main"

    If slug already exists, appends a number: "mclean-eye-clinic-2"
    """
    if not name:
        raise ValueError("Clinic name is required")

    # Convert to lowercase
    slug = name.lower()

    # Remove special characters except spaces and hyphens
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)

    # Replace spaces with hyphens
    slug = re.sub(r"\s+", "-", slug)

    # Remove consecutive hyphens
    slug = re.sub(r"-+", "-", slug)

    # Remove leading/trailing hyphens
    slug = slug.strip("-")

    if not slug:
        raise ValueError("Could not generate valid slug from clinic name")

    # Check for uniqueness
    if existing_slugs:
        base_slug = slug
        counter = 2
        while slug in existing_slugs:
            slug = f"{base_slug}-{counter}"
            counter += 1

    return slug

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class LoginRequest(BaseModel):
    """Login request body."""
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    """Login response with tokens and user info."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


class UserProfileResponse(BaseModel):
    """Current user profile response."""
    id: str
    email: str
    name: str
    role: str
    clinic_id: str | None
    clinic_name: str | None
    status: str


class MessageResponse(BaseModel):
    """Simple message response."""
    message: str


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """
    Authenticate a clinic user with email and password.

    This endpoint:
    1. Validates credentials against Supabase Auth
    2. Returns JWT tokens (access + refresh)
    3. Returns basic user info

    The frontend should:
    1. Store the access_token
    2. Include it in the Authorization header for future requests
    3. Use refresh_token to get new access_token when it expires

    MongoDB comparison:
    - You'd do: db.users.findOne({email, password: hash(password)})
    - Then manually create a JWT
    - Supabase does both automatically
    """
    client = get_supabase_admin_client()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection not available"
        )

    try:
        # Authenticate with Supabase Auth
        # This checks the auth.users table (managed by Supabase)
        auth_response = client.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password
        })

        # Get the session and user from response
        session = auth_response.session
        user = auth_response.user

        if not session or not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        # Fetch the user's profile from our user_profiles table
        # This contains role, clinic_id, name, etc.
        profile_response = client.table("user_profiles").select(
            "*, clinics(id, clinic_id, name, status)"
        ).eq("id", user.id).single().execute()

        profile = profile_response.data

        # Check if user has a profile
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account not set up. Please contact your administrator."
            )

        # Check if user is active
        if profile.get("status") != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Account is {profile.get('status')}. Please contact your administrator."
            )

        # Check if clinic is active (for non-super-admins)
        clinic = profile.get("clinics")
        if profile.get("role") != "super_admin":
            if not clinic:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User not associated with any clinic"
                )
            if clinic.get("status") != "active":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Clinic is {clinic.get('status')}. Please contact support."
                )

        return LoginResponse(
            access_token=session.access_token,
            refresh_token=session.refresh_token,
            expires_in=session.expires_in,
            user={
                "id": user.id,
                "email": user.email,
                "name": profile.get("name"),
                "role": profile.get("role"),
                "clinic_id": clinic.get("clinic_id") if clinic else None,
                "clinic_name": clinic.get("name") if clinic else None,
            }
        )

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        error_message = str(e)
        # Handle specific Supabase auth errors
        if "Invalid login credentials" in error_message:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        print(f"[Auth] Login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during login"
        )


@router.post("/logout", response_model=MessageResponse)
async def logout():
    """
    Logout the current user.

    Note: Since JWTs are stateless, we can't truly "invalidate" a token
    on the server side. The frontend should:
    1. Remove the stored tokens
    2. Optionally call this endpoint to sign out from Supabase

    For true session invalidation, you'd need a token blacklist (future feature).
    """
    # In a stateless JWT system, logout is mainly a frontend concern
    # But we can still call Supabase to invalidate the refresh token
    client = get_supabase_admin_client()
    if client:
        try:
            client.auth.sign_out()
        except Exception as e:
            print(f"[Auth] Logout error (non-critical): {e}")

    return MessageResponse(message="Logged out successfully")


@router.get("/me", response_model=UserProfileResponse)
async def get_current_user(authorization: str | None = Header(None, alias="Authorization")):
    """
    Get the current logged-in user's profile.

    This endpoint:
    1. Validates the JWT token from the Authorization header
    2. Fetches the user's profile from user_profiles table
    3. Returns user info including clinic details

    Usage:
    - Frontend calls this on app load to check if user is still logged in
    - Also used to get user's role and clinic context

    Note: In Phase 2.2, we'll create middleware to handle this automatically.
    For now, we manually extract the token.
    """
    print(f"[Auth /me] Received authorization header: {authorization[:30] if authorization else 'None'}...")

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = authorization.replace("Bearer ", "")
    print(f"[Auth /me] Token extracted: {token[:20]}...{token[-10:]}")

    client = get_supabase_admin_client()
    if not client:
        print("[Auth /me] ERROR: Supabase client not available")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection not available"
        )

    try:
        # Verify the token and get user
        # Supabase validates the JWT signature and expiration
        print("[Auth /me] Validating token with Supabase...")
        user_response = client.auth.get_user(token)
        user = user_response.user

        if not user:
            print("[Auth /me] Token validation failed - no user returned")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )

        print(f"[Auth /me] Token valid for user: {user.email} (ID: {user.id})")

        # Fetch user profile with clinic info
        print(f"[Auth /me] Fetching user profile...")
        profile_response = client.table("user_profiles").select(
            "*, clinics(id, clinic_id, name, status)"
        ).eq("id", user.id).single().execute()

        profile = profile_response.data

        if not profile:
            print(f"[Auth /me] ERROR: No profile found for user {user.id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found"
            )

        clinic = profile.get("clinics")
        print(f"[Auth /me] Profile found: {profile.get('name')} | Clinic: {clinic.get('name') if clinic else 'None'}")

        return UserProfileResponse(
            id=user.id,
            email=user.email,
            name=profile.get("name", ""),
            role=profile.get("role", ""),
            clinic_id=clinic.get("clinic_id") if clinic else None,
            clinic_name=clinic.get("name") if clinic else None,
            status=profile.get("status", "")
        )

    except HTTPException:
        raise
    except Exception as e:
        error_message = str(e)
        print(f"[Auth /me] ERROR: {error_message}")
        if "Invalid" in error_message or "expired" in error_message.lower():
            print("[Auth /me] Token appears to be invalid or expired")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        print(f"[Auth /me] Unexpected error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while fetching user profile"
        )


# =============================================================================
# CLINIC REGISTRATION (Self-Service)
# =============================================================================

class ClinicRegistrationRequest(BaseModel):
    """
    Request body for new clinic registration.

    This creates both:
    1. A new clinic (in 'pending' status)
    2. The first admin user for that clinic
    """
    # Clinic details
    clinic_name: str
    clinic_address: str | None = None
    clinic_city: str | None = None
    clinic_state: str | None = None
    clinic_zip: str | None = None
    clinic_phone: str | None = None

    # Admin user details
    admin_name: str
    admin_email: EmailStr
    admin_password: str  # Minimum 6 characters (Supabase requirement)


class ClinicRegistrationResponse(BaseModel):
    """Response after successful clinic registration."""
    message: str
    clinic_id: str
    clinic_name: str
    admin_email: str
    status: str  # Will be "pending" until approved


@router.post("/register-clinic", response_model=ClinicRegistrationResponse)
async def register_clinic(request: ClinicRegistrationRequest):
    """
    Self-service clinic registration.

    This endpoint allows new clinics to sign up for the platform.

    What it does:
    1. Generates a unique clinic_id (e.g., "CLINIC-00001")
    2. Creates the clinic record with status="pending"
    3. Creates the admin user in Supabase Auth
    4. Creates the user_profile linking admin to clinic

    Why "pending" status?
    - Gives super admins control to verify/approve new clinics
    - Prevents unauthorized access until approved
    - Can be changed to "active" for auto-approval if desired

    After registration:
    - Super admin reviews and approves the clinic
    - Once approved, admin can login and start using the platform
    """
    client = get_supabase_admin_client()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection not available"
        )

    try:
        # Step 1: Check if email already exists
        existing_user = client.table("user_profiles").select("id").eq(
            "email", request.admin_email
        ).execute()

        if existing_user.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists"
            )

        # Step 2: Generate unique clinic_id (slug from name)
        # Format: "mclean-eye-clinic" (auto-generated from clinic name)
        existing_slugs_result = client.table("clinics").select("clinic_id").execute()
        existing_slugs = [c["clinic_id"] for c in (existing_slugs_result.data or [])]
        clinic_id = generate_clinic_slug(request.clinic_name, existing_slugs)

        # Step 3: Create the clinic record
        # Schema matches admin.py: clinic_id, name, address, contact, settings, status
        clinic_data = {
            "clinic_id": clinic_id,
            "name": request.clinic_name,
            "status": "pending",  # Requires super admin approval
            "address": {
                "street": request.clinic_address,
                "city": request.clinic_city,
                "state": request.clinic_state,
                "zip": request.clinic_zip,
            },
            "contact": {
                "phone": request.clinic_phone,
            },
            "settings": {},
        }

        clinic_response = client.table("clinics").insert(clinic_data).execute()

        if not clinic_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create clinic"
            )

        clinic_uuid = clinic_response.data[0]["id"]

        # Create empty clinic_config record (for packages, medications, etc.)
        config_data = {
            "clinic_id": clinic_uuid,
            "surgical_packages": [],
            "lens_inventory": {},
            "medications": {},
            "sops": {},
            "staff_directory": [],
        }
        client.table("clinic_config").insert(config_data).execute()

        # Step 4: Create the admin user in Supabase Auth
        try:
            auth_response = client.auth.admin.create_user({
                "email": request.admin_email,
                "password": request.admin_password,
                "email_confirm": True,  # Auto-confirm email
                "user_metadata": {
                    "name": request.admin_name,
                    "role": "clinic_admin",
                }
            })

            if not auth_response.user:
                # Rollback: delete the clinic_config and clinic
                client.table("clinic_config").delete().eq("clinic_id", clinic_uuid).execute()
                client.table("clinics").delete().eq("id", clinic_uuid).execute()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create admin user"
                )

            user_id = auth_response.user.id

        except Exception as auth_error:
            # Rollback: delete the clinic_config and clinic
            client.table("clinic_config").delete().eq("clinic_id", clinic_uuid).execute()
            client.table("clinics").delete().eq("id", clinic_uuid).execute()
            error_msg = str(auth_error)
            if "already been registered" in error_msg:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="An account with this email already exists"
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create admin user: {error_msg}"
            )

        # Step 5: Create the user_profile record
        profile_data = {
            "id": user_id,
            "email": request.admin_email,
            "name": request.admin_name,
            "role": "clinic_admin",
            "clinic_id": clinic_uuid,
            "status": "active",  # User is active, but clinic is pending
        }

        try:
            client.table("user_profiles").insert(profile_data).execute()
        except Exception as profile_error:
            # Rollback: delete the auth user, clinic_config, and clinic
            client.auth.admin.delete_user(user_id)
            client.table("clinic_config").delete().eq("clinic_id", clinic_uuid).execute()
            client.table("clinics").delete().eq("id", clinic_uuid).execute()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user profile"
            )

        return ClinicRegistrationResponse(
            message="Clinic registered successfully. Awaiting approval from administrator.",
            clinic_id=clinic_id,
            clinic_name=request.clinic_name,
            admin_email=request.admin_email,
            status="pending"
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Auth] Registration error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during registration"
        )


class RefreshRequest(BaseModel):
    """Refresh token request body."""
    refresh_token: str


@router.post("/refresh", response_model=LoginResponse)
async def refresh_token_endpoint(request: RefreshRequest):
    """
    Refresh an expired access token using a refresh token.

    JWTs have a short expiration (usually 1 hour). When the access_token
    expires, the frontend can use the refresh_token to get a new one
    without requiring the user to login again.

    The refresh_token has a longer expiration (7 days in our case).
    """
    refresh_token = request.refresh_token
    client = get_supabase_admin_client()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection not available"
        )

    try:
        # Use refresh token to get new session
        auth_response = client.auth.refresh_session(refresh_token)

        session = auth_response.session
        user = auth_response.user

        if not session or not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )

        # Fetch user profile
        profile_response = client.table("user_profiles").select(
            "*, clinics(id, clinic_id, name, status)"
        ).eq("id", user.id).single().execute()

        profile = profile_response.data
        clinic = profile.get("clinics") if profile else None

        return LoginResponse(
            access_token=session.access_token,
            refresh_token=session.refresh_token,
            expires_in=session.expires_in,
            user={
                "id": user.id,
                "email": user.email,
                "name": profile.get("name") if profile else None,
                "role": profile.get("role") if profile else None,
                "clinic_id": clinic.get("clinic_id") if clinic else None,
                "clinic_name": clinic.get("name") if clinic else None,
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Auth] Refresh token error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
