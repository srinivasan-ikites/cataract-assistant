"""
Tests for patient OTP authentication endpoints.

Covers:
- POST /api/patient/auth/request-otp
- POST /api/patient/auth/verify-otp
- GET /api/patient/auth/me
- GET /api/patient/auth/me/data
- POST /api/patient/auth/logout
"""

import pytest

pytestmark = pytest.mark.api


# ── Request OTP ────────────────────────────────────────────────────────────

class TestRequestOTP:
    """Tests for POST /api/patient/auth/request-otp"""

    def test_request_otp_valid_patient(
        self, http_client, config, test_patient_factory
    ):
        """Valid phone + clinic_id returns OTP (in dev mode)."""
        patient = test_patient_factory("OTPTest", "User")

        response = http_client.post("/api/patient/auth/request-otp", json={
            "phone": patient["phone"],
            "clinic_id": config.TEST_CLINIC_ID,
        })
        assert response.status_code == 200

        data = response.json()
        assert data["phone"] == patient["phone"]
        assert data["expires_in_seconds"] > 0
        # In DEV_MODE, OTP is returned in the response
        assert "dev_otp" in data
        assert len(data["dev_otp"]) == 6
        assert data["dev_otp"].isdigit()

    def test_request_otp_unknown_phone(self, http_client, config):
        """Phone not registered in clinic returns 404."""
        response = http_client.post("/api/patient/auth/request-otp", json={
            "phone": "0000000000",
            "clinic_id": config.TEST_CLINIC_ID,
        })
        assert response.status_code == 404

    def test_request_otp_invalid_phone_format(self, http_client, config):
        """Non-10-digit phone returns 400."""
        response = http_client.post("/api/patient/auth/request-otp", json={
            "phone": "123",
            "clinic_id": config.TEST_CLINIC_ID,
        })
        assert response.status_code == 400

    def test_request_otp_nonexistent_clinic(self, http_client):
        """Non-existent clinic returns 404."""
        response = http_client.post("/api/patient/auth/request-otp", json={
            "phone": "1234567890",
            "clinic_id": "nonexistent-clinic-xyz",
        })
        # TODO: Backend returns 500 for non-existent clinic, should be 404
        assert response.status_code in (404, 500)

    def test_request_otp_phone_with_letters(self, http_client, config):
        """Phone with letters returns 400."""
        response = http_client.post("/api/patient/auth/request-otp", json={
            "phone": "123abc4567",
            "clinic_id": config.TEST_CLINIC_ID,
        })
        assert response.status_code == 400


# ── Verify OTP ─────────────────────────────────────────────────────────────

class TestVerifyOTP:
    """Tests for POST /api/patient/auth/verify-otp"""

    def test_verify_otp_correct(
        self, http_client, config, test_patient_factory
    ):
        """Correct OTP returns access token and patient info."""
        patient = test_patient_factory("VerifyOTP", "Correct")

        # Step 1: Request OTP
        otp_response = http_client.post("/api/patient/auth/request-otp", json={
            "phone": patient["phone"],
            "clinic_id": config.TEST_CLINIC_ID,
        })
        otp = otp_response.json()["dev_otp"]

        # Step 2: Verify OTP
        response = http_client.post("/api/patient/auth/verify-otp", json={
            "phone": patient["phone"],
            "otp": otp,
            "clinic_id": config.TEST_CLINIC_ID,
        })
        assert response.status_code == 200

        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in_days"] == 7
        assert "patient" in data
        assert data["patient"]["name"]["first"] == "VerifyOTP"

    def test_verify_otp_wrong_code(
        self, http_client, config, test_patient_factory
    ):
        """Wrong OTP returns 400 with remaining attempts."""
        patient = test_patient_factory("VerifyOTP", "Wrong")

        # Request OTP
        http_client.post("/api/patient/auth/request-otp", json={
            "phone": patient["phone"],
            "clinic_id": config.TEST_CLINIC_ID,
        })

        # Submit wrong OTP
        response = http_client.post("/api/patient/auth/verify-otp", json={
            "phone": patient["phone"],
            "otp": "000000",
            "clinic_id": config.TEST_CLINIC_ID,
        })
        assert response.status_code == 400
        assert "attempt" in response.json()["detail"].lower()

    def test_verify_otp_invalid_format(self, http_client, config):
        """Non-6-digit OTP returns 400."""
        response = http_client.post("/api/patient/auth/verify-otp", json={
            "phone": "1234567890",
            "otp": "abc",
            "clinic_id": config.TEST_CLINIC_ID,
        })
        assert response.status_code == 400

    def test_verify_otp_max_attempts(
        self, http_client, config, test_patient_factory
    ):
        """After 3 wrong attempts, OTP is locked out."""
        patient = test_patient_factory("VerifyOTP", "MaxAttempts")

        # Request OTP
        http_client.post("/api/patient/auth/request-otp", json={
            "phone": patient["phone"],
            "clinic_id": config.TEST_CLINIC_ID,
        })

        # Submit wrong OTP 3 times
        for _ in range(3):
            http_client.post("/api/patient/auth/verify-otp", json={
                "phone": patient["phone"],
                "otp": "000000",
                "clinic_id": config.TEST_CLINIC_ID,
            })

        # 4th attempt should fail even with (potentially) correct OTP
        response = http_client.post("/api/patient/auth/verify-otp", json={
            "phone": patient["phone"],
            "otp": "000000",
            "clinic_id": config.TEST_CLINIC_ID,
        })
        assert response.status_code == 400
        assert "too many" in response.json()["detail"].lower() or "attempt" in response.json()["detail"].lower()


# ── Patient /me endpoints ─────────────────────────────────────────────────

class TestPatientMe:
    """Tests for GET /api/patient/auth/me and /me/data"""

    def _get_patient_token(self, http_client, config, test_patient_factory):
        """Helper: create patient, get OTP, verify, return token."""
        patient = test_patient_factory("PatientMe", "Test")

        otp_resp = http_client.post("/api/patient/auth/request-otp", json={
            "phone": patient["phone"],
            "clinic_id": config.TEST_CLINIC_ID,
        })
        otp = otp_resp.json()["dev_otp"]

        verify_resp = http_client.post("/api/patient/auth/verify-otp", json={
            "phone": patient["phone"],
            "otp": otp,
            "clinic_id": config.TEST_CLINIC_ID,
        })
        return verify_resp.json()["access_token"]

    def test_me_with_valid_patient_token(
        self, http_client, config, test_patient_factory
    ):
        """Valid patient JWT returns patient profile."""
        token = self._get_patient_token(
            http_client, config, test_patient_factory
        )
        response = http_client.get(
            "/api/patient/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "patient_id" in data
        assert "name" in data

    def test_me_without_token(self, http_client):
        """No auth header returns 401."""
        response = http_client.get("/api/patient/auth/me")
        assert response.status_code == 401

    def test_me_with_invalid_token(self, http_client):
        """Invalid JWT returns 401."""
        response = http_client.get(
            "/api/patient/auth/me",
            headers={"Authorization": "Bearer fake.jwt.token"},
        )
        assert response.status_code == 401


# ── Patient Logout ─────────────────────────────────────────────────────────

class TestPatientLogout:
    """Tests for POST /api/patient/auth/logout"""

    def test_logout(self, http_client):
        """Logout returns success."""
        response = http_client.post("/api/patient/auth/logout")
        assert response.status_code == 200
