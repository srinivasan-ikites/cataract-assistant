"""
E2E test: Cross-portal handoff.

Tests that a patient can access their portal and see their clinical data.
"""

import pytest
import httpx

pytestmark = [pytest.mark.e2e, pytest.mark.slow]


class TestDoctorToPatientHandoff:
    """Test the doctor -> patient data handoff."""

    def test_patient_sees_reviewed_data(self, page, config, patient_auth):
        """
        Integration: verify a patient can access their portal data.

        Uses the shared patient_auth fixture (avoids OTP rate limits)
        and verifies data via API.
        """
        token = patient_auth["token"]

        with httpx.Client(base_url=config.API_BASE, timeout=15.0) as client:
            # Get patient data via patient auth
            data_resp = client.get(
                "/api/patient/auth/me/data",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert data_resp.status_code == 200

            patient_data = data_resp.json()
            # Patient should have data populated
            assert patient_data is not None
            assert "name" in patient_data or "first_name" in patient_data
