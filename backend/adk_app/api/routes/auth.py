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
import time
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
    print(f"\n[Auth Login] Attempt for email: {request.email}")

    client = get_supabase_admin_client()
    if not client:
        print(f"[Auth Login] ERROR: Supabase client not available")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection not available"
        )

    try:
        # Authenticate with Supabase Auth
        # This checks the auth.users table (managed by Supabase)
        print(f"[Auth Login] Authenticating with Supabase...")
        auth_response = client.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password
        })

        # Get the session and user from response
        session = auth_response.session
        user = auth_response.user

        if not session or not user:
            print(f"[Auth Login] ERROR: No session/user returned from Supabase")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        print(f"[Auth Login] Auth successful for user ID: {user.id}")

        # Fetch the user's profile from our user_profiles table
        # This contains role, clinic_id, name, etc.
        print(f"[Auth Login] Fetching user profile...")
        profile_response = client.table("user_profiles").select(
            "*, clinics(id, clinic_id, name, status)"
        ).eq("id", user.id).single().execute()

        profile = profile_response.data

        # Check if user has a profile
        if not profile:
            print(f"[Auth Login] ERROR: No profile found for user {user.id}")
            print(f"[Auth Login] HINT: user_profiles table may be missing this user's record")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account not set up. Please contact your administrator."
            )

        print(f"[Auth Login] Profile found: {profile.get('name')} | Role: {profile.get('role')} | Status: {profile.get('status')}")

        # Check if user is active
        if profile.get("status") != "active":
            print(f"[Auth Login] ERROR: User status is '{profile.get('status')}' (not 'active')")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Account is {profile.get('status')}. Please contact your administrator."
            )

        # Check if clinic is active (for non-super-admins)
        clinic = profile.get("clinics")
        if profile.get("role") != "super_admin":
            if not clinic:
                print(f"[Auth Login] ERROR: User not associated with any clinic")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User not associated with any clinic"
                )
            print(f"[Auth Login] Clinic: {clinic.get('name')} | Status: {clinic.get('status')}")
            if clinic.get("status") != "active":
                print(f"[Auth Login] ERROR: Clinic status is '{clinic.get('status')}' (not 'active')")
                print(f"[Auth Login] HINT: Clinic needs to be approved by super admin first")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Clinic is {clinic.get('status')}. Please contact support."
                )

        print(f"[Auth Login] SUCCESS - User logged in: {profile.get('name')} ({profile.get('role')})")

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
            print(f"[Auth Login] ERROR: Invalid credentials for {request.email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        print(f"[Auth Login] ERROR: Unexpected error - {e}")
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
    print(f"\n{'='*60}")
    print(f"[Register Clinic] START - New registration request")
    print(f"[Register Clinic] Clinic Name: {request.clinic_name}")
    print(f"[Register Clinic] Admin Email: {request.admin_email}")
    print(f"[Register Clinic] Admin Name: {request.admin_name}")
    print(f"{'='*60}")

    client = get_supabase_admin_client()
    if not client:
        print("[Register Clinic] ERROR: Supabase client not available")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection not available"
        )

    try:
        # Step 1: Check if email already exists
        print(f"[Register Clinic] Step 1: Checking if email already exists...")
        existing_user = client.table("user_profiles").select("id").eq(
            "email", request.admin_email
        ).execute()

        if existing_user.data:
            print(f"[Register Clinic] ERROR: Email {request.admin_email} already exists in user_profiles")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists"
            )
        print(f"[Register Clinic] Step 1: OK - Email is available")

        # Step 2: Generate unique clinic_id (slug from name)
        # Format: "mclean-eye-clinic" (auto-generated from clinic name)
        print(f"[Register Clinic] Step 2: Generating clinic_id slug...")
        existing_slugs_result = client.table("clinics").select("clinic_id").execute()
        existing_slugs = [c["clinic_id"] for c in (existing_slugs_result.data or [])]
        clinic_id = generate_clinic_slug(request.clinic_name, existing_slugs)
        print(f"[Register Clinic] Step 2: OK - Generated clinic_id: {clinic_id}")

        # Step 3: Create the clinic record
        # Schema matches admin.py: clinic_id, name, address, contact, settings, status
        print(f"[Register Clinic] Step 3: Creating clinic record in database...")
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
            print(f"[Register Clinic] ERROR: Failed to insert clinic into database")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create clinic"
            )

        clinic_uuid = clinic_response.data[0]["id"]
        print(f"[Register Clinic] Step 3: OK - Clinic created with UUID: {clinic_uuid}")

        # Create empty clinic_config record (for packages, medications, etc.)
        print(f"[Register Clinic] Step 3b: Creating clinic_config record...")
        config_data = {
            "clinic_id": clinic_uuid,
            "surgical_packages": [],
            "lens_inventory": {},
            "medications": {},
            "sops": {},
            "staff_directory": [],
        }
        client.table("clinic_config").insert(config_data).execute()
        print(f"[Register Clinic] Step 3b: OK - clinic_config created")

        # Step 4: Create the admin user in Supabase Auth
        # Note: Supabase has rate limiting, so we retry with exponential backoff
        print(f"[Register Clinic] Step 4: Creating admin user in Supabase Auth...")
        print(f"[Register Clinic] Step 4: Email: {request.admin_email}")
        print(f"[Register Clinic] Step 4: Password length: {len(request.admin_password)} chars")

        max_retries = 3
        retry_delay = 2  # Start with 2 seconds
        auth_response = None
        last_error = None

        for attempt in range(max_retries):
            try:
                if attempt > 0:
                    print(f"[Register Clinic] Step 4: Retry attempt {attempt + 1}/{max_retries} after {retry_delay}s delay...")
                    time.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff

                auth_response = client.auth.admin.create_user({
                    "email": request.admin_email,
                    "password": request.admin_password,
                    "email_confirm": True,  # Auto-confirm email
                    "user_metadata": {
                        "name": request.admin_name,
                        "role": "clinic_admin",
                    }
                })

                if auth_response.user:
                    # Success!
                    break

            except Exception as auth_error:
                last_error = auth_error
                error_msg = str(auth_error)
                print(f"[Register Clinic] Step 4: Attempt {attempt + 1} failed: {error_msg}")

                # Don't retry for certain errors
                if "already been registered" in error_msg:
                    break  # No point retrying - email already exists

                # "User not allowed" means Supabase config issue - don't retry
                if "User not allowed" in error_msg:
                    print(f"[Register Clinic] Step 4: 'User not allowed' = Supabase Auth config issue")
                    print(f"[Register Clinic] Step 4: Check: Authentication > Providers > Email > Enable Signup")
                    print(f"[Register Clinic] Step 4: Also check: Authentication > Settings > CAPTCHA (should be OFF)")
                    break  # No point retrying - this is a config issue

                # For actual rate limiting errors, we should retry
                if "rate" in error_msg.lower():
                    if attempt < max_retries - 1:
                        print(f"[Register Clinic] Step 4: Appears to be rate limiting, will retry...")
                        continue

                # For other errors, don't retry
                break

        # Check if we succeeded
        if auth_response and auth_response.user:
            user_id = auth_response.user.id
            print(f"[Register Clinic] Step 4: OK - Auth user created with ID: {user_id}")
        else:
            # All retries failed
            print(f"[Register Clinic] ERROR in Step 4: Supabase Auth failed after {max_retries} attempts!")
            if last_error:
                print(f"[Register Clinic] Error type: {type(last_error).__name__}")
                print(f"[Register Clinic] Error message: {str(last_error)}")
                print(f"[Register Clinic] Full error: {repr(last_error)}")
            print(f"[Register Clinic] HINT: Check Supabase Dashboard > Authentication > Providers > Email")
            print(f"[Register Clinic] HINT: Ensure 'Enable Email Signup' is ON")
            print(f"[Register Clinic] HINT: Check Authentication > Settings > CAPTCHA is disabled")
            print(f"[Register Clinic] HINT: If error says 'rate', wait and try again")
            print(f"[Register Clinic] Rolling back clinic creation...")
            client.table("clinic_config").delete().eq("clinic_id", clinic_uuid).execute()
            client.table("clinics").delete().eq("id", clinic_uuid).execute()
            print(f"[Register Clinic] Rollback complete")

            error_msg = str(last_error) if last_error else "Unknown error"
            if "already been registered" in error_msg:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="An account with this email already exists"
                )
            if "User not allowed" in error_msg:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Registration is not enabled. Please check Supabase Authentication settings (Email provider must be enabled with signup allowed)."
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create admin user: {error_msg}"
            )

        # Step 5: Create the user_profile record
        print(f"[Register Clinic] Step 5: Creating user_profile record...")
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
            print(f"[Register Clinic] Step 5: OK - user_profile created")
        except Exception as profile_error:
            # Rollback: delete the auth user, clinic_config, and clinic
            print(f"[Register Clinic] ERROR in Step 5: Failed to create user_profile")
            print(f"[Register Clinic] Error: {str(profile_error)}")
            print(f"[Register Clinic] Rolling back...")
            client.auth.admin.delete_user(user_id)
            client.table("clinic_config").delete().eq("clinic_id", clinic_uuid).execute()
            client.table("clinics").delete().eq("id", clinic_uuid).execute()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user profile"
            )

        print(f"\n{'='*60}")
        print(f"[Register Clinic] SUCCESS!")
        print(f"[Register Clinic] Clinic ID: {clinic_id}")
        print(f"[Register Clinic] Admin Email: {request.admin_email}")
        print(f"[Register Clinic] Status: pending (awaiting approval)")
        print(f"{'='*60}\n")

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
