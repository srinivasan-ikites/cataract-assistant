"""
Shared test fixtures for all test layers.

Provides:
- Environment configuration loading
- HTTP client for API calls
- Auth token management (clinic user + patient)
- Test data creation and cleanup
"""

import os
import random
from pathlib import Path

import pytest
import httpx
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Load environment
# ---------------------------------------------------------------------------

# Try .env.test.local first (real credentials), fall back to .env.test
_tests_dir = Path(__file__).parent
_local_env = _tests_dir / ".env.test.local"
_default_env = _tests_dir / ".env.test"

if _local_env.exists():
    load_dotenv(_local_env)
else:
    load_dotenv(_default_env)

# Also load backend .env for API keys (GOOGLE_API_KEY etc.)
_backend_env = _tests_dir.parent / "backend" / ".env"
if _backend_env.exists():
    load_dotenv(_backend_env, override=False)  # Don't override test-specific vars


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

class TestConfig:
    """Central configuration for all tests."""
    API_BASE = os.getenv("API_BASE_URL", "http://localhost:8000")
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

    # Super admin (for /api/admin/* endpoints)
    SUPER_ADMIN_EMAIL = os.getenv("SUPER_ADMIN_EMAIL", "admin@cataract.com")
    SUPER_ADMIN_PASSWORD = os.getenv("SUPER_ADMIN_PASSWORD", "admin")

    # Clinic admin (for patient/doctor endpoints)
    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "deepika@gmail.com")
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "deepika")

    TEST_CLINIC_ID = os.getenv("TEST_CLINIC_ID", "garuda-clinic")
    TEST_PATIENT_PHONE = os.getenv("TEST_PATIENT_PHONE", "6666666666")
    PHONE_PREFIX = os.getenv("TEST_PATIENT_PHONE_PREFIX", "999000")
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")

    # Report paths
    REPORTS_DIR = _tests_dir / "reports"
    SCREENSHOTS_DIR = REPORTS_DIR / "screenshots"


@pytest.fixture(scope="session")
def config():
    """Provide test configuration to all tests."""
    return TestConfig()


# ---------------------------------------------------------------------------
# HTTP Client (synchronous — avoids event loop issues)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def http_client(config):
    """Synchronous HTTP client for API tests (session-scoped for efficiency)."""
    with httpx.Client(
        base_url=config.API_BASE,
        timeout=30.0,
        follow_redirects=True,
    ) as client:
        yield client


# ---------------------------------------------------------------------------
# Auth: Super admin login
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def super_admin_auth(http_client, config):
    """
    Login as super admin and return auth headers + user info.
    Used for /api/admin/* endpoints.
    """
    response = http_client.post("/api/auth/login", json={
        "email": config.SUPER_ADMIN_EMAIL,
        "password": config.SUPER_ADMIN_PASSWORD,
    })

    if response.status_code != 200:
        pytest.skip(
            f"Cannot login as super admin ({config.SUPER_ADMIN_EMAIL}): "
            f"{response.status_code} - {response.text}"
        )

    data = response.json()
    return {
        "headers": {"Authorization": f"Bearer {data['access_token']}"},
        "access_token": data["access_token"],
        "refresh_token": data["refresh_token"],
        "user": data["user"],
    }


# ---------------------------------------------------------------------------
# Auth: Clinic admin login
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def admin_auth(http_client, config):
    """
    Login as clinic admin and return auth headers + user info.
    Used for /patients/*, /doctor/*, and other clinic-scoped endpoints.

    Returns dict with:
        - headers: {"Authorization": "Bearer <token>"}
        - access_token: str
        - refresh_token: str
        - user: dict with id, email, name, role, clinic_id, clinic_name
    """
    response = http_client.post("/api/auth/login", json={
        "email": config.ADMIN_EMAIL,
        "password": config.ADMIN_PASSWORD,
    })

    if response.status_code != 200:
        pytest.skip(
            f"Cannot login as clinic admin ({config.ADMIN_EMAIL}): "
            f"{response.status_code} - {response.text}"
        )

    data = response.json()
    return {
        "headers": {"Authorization": f"Bearer {data['access_token']}"},
        "access_token": data["access_token"],
        "refresh_token": data["refresh_token"],
        "user": data["user"],
    }


# ---------------------------------------------------------------------------
# Test patient creation and cleanup
# ---------------------------------------------------------------------------

_created_patients = []  # Track patients to clean up


@pytest.fixture(scope="session")
def test_patient_factory(http_client, admin_auth, config):
    """
    Factory fixture to create test patients.

    Usage:
        patient = test_patient_factory("John", "Doe")
        # patient = {"patient_id": "001", "phone": "9990001001", ...}
    """
    counter = [0]

    def _create(first_name="Test", last_name="Patient"):
        counter[0] += 1
        # Generate unique 10-digit phone: 99 + random 4 digits + sequential 4 digits
        rand_part = random.randint(1000, 9999)
        phone = f"99{rand_part}{counter[0]:04d}"

        response = http_client.post(
            "/patients",
            json={
                "clinic_id": config.TEST_CLINIC_ID,
                "first_name": first_name,
                "last_name": last_name,
                "phone": phone,
            },
            headers=admin_auth["headers"],
        )

        if response.status_code not in (200, 201):
            pytest.fail(f"Failed to create test patient: {response.status_code} {response.text}")

        patient_data = response.json()
        _created_patients.append(patient_data)
        return {**patient_data, "phone": phone}

    return _create


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_patients(http_client, config):
    """Clean up test patients after all tests complete."""
    yield
    # Login fresh for cleanup (original token may have expired)
    login_resp = http_client.post("/api/auth/login", json={
        "email": config.ADMIN_EMAIL,
        "password": config.ADMIN_PASSWORD,
    })
    if login_resp.status_code != 200:
        return

    headers = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}
    for patient in _created_patients:
        try:
            patient_data = patient.get("patient") or patient
            patient_uuid = patient_data.get("_uuid") or patient_data.get("id")
            if patient_uuid:
                http_client.delete(
                    f"/patients/{patient_uuid}",
                    headers=headers,
                )
        except Exception:
            pass  # Best-effort cleanup


# ---------------------------------------------------------------------------
# Ensure report directories exist
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session", autouse=True)
def ensure_report_dirs(config):
    """Create report directories if they don't exist."""
    config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    config.SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
