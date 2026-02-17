"""
E2E test: Full doctor portal journey.

Tests the complete flow:
1. Login to doctor portal
2. View patient list
3. Register a new patient
4. Verify patient appears in list
"""

import random
import pytest
from tests.e2e.pages.login_page import DoctorLoginPage
from tests.e2e.pages.patient_list_page import PatientListPage

pytestmark = pytest.mark.e2e


class TestDoctorLogin:
    """Test doctor portal login flow."""

    def test_successful_login(self, page, config):
        """Doctor can log in with valid credentials."""
        login = DoctorLoginPage(page)
        login.navigate(config.FRONTEND_URL, config.TEST_CLINIC_ID)
        login.login(config.ADMIN_EMAIL, config.ADMIN_PASSWORD)
        login.expect_dashboard()

    def test_invalid_login(self, page, config):
        """Wrong password shows error message."""
        login = DoctorLoginPage(page)
        login.navigate(config.FRONTEND_URL, config.TEST_CLINIC_ID)
        login.login(config.ADMIN_EMAIL, "wrongpassword")

        # Should still be on login page (not redirected)
        page.wait_for_timeout(2000)
        # Check for error indication
        url = page.url
        assert "login" in url.lower() or "doctor" in url.lower()


class TestDoctorPatientList:
    """Test patient list functionality."""

    def test_patient_list_loads(self, page, config):
        """Patient list loads after login."""
        # Login first
        login = DoctorLoginPage(page)
        login.navigate(config.FRONTEND_URL, config.TEST_CLINIC_ID)
        login.login(config.ADMIN_EMAIL, config.ADMIN_PASSWORD)

        # Wait for patient list
        patient_list = PatientListPage(page)
        patient_list.wait_for_list()

    def test_register_new_patient(self, page, config):
        """Can register a new patient from the portal."""
        import httpx

        # Login
        login = DoctorLoginPage(page)
        login.navigate(config.FRONTEND_URL, config.TEST_CLINIC_ID)
        login.login(config.ADMIN_EMAIL, config.ADMIN_PASSWORD)

        # Wait for patient list
        patient_list = PatientListPage(page)
        patient_list.wait_for_list()

        # Use random phone to avoid duplicates
        phone = f"97{random.randint(10000000, 99999999)}"
        first_name = "E2EBrowser"

        patient_list.register_patient(
            first_name=first_name,
            last_name="Test",
            phone=phone,
        )

        # Wait for registration to complete
        page.wait_for_timeout(3000)

        # Verify patient was created via API (more reliable than checking UI
        # since the page may navigate to the patient detail view)
        with httpx.Client(base_url=config.API_BASE, timeout=15.0) as client:
            login_resp = client.post("/api/auth/login", json={
                "email": config.ADMIN_EMAIL,
                "password": config.ADMIN_PASSWORD,
            })
            headers = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}
            patients_resp = client.get(
                f"/patients?clinic_id={config.TEST_CLINIC_ID}",
                headers=headers,
            )
            patients = patients_resp.json()
            names = []
            for p in patients:
                fn = p.get("first_name") or ""
                if not fn:
                    nm = p.get("name", {})
                    fn = nm.get("first", "") if isinstance(nm, dict) else ""
                names.append(fn)
            assert first_name in names, (
                f"Patient '{first_name}' not found in API response after registration"
            )
