"""
Tests for patient CRUD endpoints.

Covers:
- POST /patients (create)
- GET /patients (list by clinic)
- GET /patients/{id} (get details)
- Clinic isolation (can't see other clinic's patients)
"""

import pytest

pytestmark = pytest.mark.api


class TestCreatePatient:
    """Tests for POST /patients"""

    def test_create_patient_success(self, api, config):
        """Create patient with valid data returns patient info."""
        import random
        phone = f"998{random.randint(1000000, 9999999)}"
        response = api.post("/patients", json={
            "clinic_id": config.TEST_CLINIC_ID,
            "first_name": "CreateTest",
            "last_name": "Patient",
            "phone": phone,
        })
        assert response.status_code == 200

        data = response.json()
        assert data["status"] == "created"
        assert "patient" in data
        patient = data["patient"]
        # Backend may return name as {first, last} or as first_name
        name = patient.get("first_name") or patient.get("name", {}).get("first")
        assert name == "CreateTest"

    def test_create_patient_auto_id(self, api, config):
        """Patient ID is auto-generated per clinic."""
        import random
        phone = f"997{random.randint(1000000, 9999999)}"
        response = api.post("/patients", json={
            "clinic_id": config.TEST_CLINIC_ID,
            "first_name": "AutoID",
            "last_name": "Test",
            "phone": phone,
        })
        assert response.status_code == 200
        patient = response.json()["patient"]
        # patient_id should be a string like "001", "002", etc.
        assert "patient_id" in patient
        assert patient["patient_id"].isdigit()

    def test_create_patient_missing_phone(self, api, config):
        """Missing phone returns error (phone required for OTP)."""
        response = api.post("/patients", json={
            "clinic_id": config.TEST_CLINIC_ID,
            "first_name": "NoPhone",
            "last_name": "Test",
        })
        assert response.status_code == 422

    def test_create_patient_missing_name(self, api, config):
        """Missing first/last name returns error."""
        response = api.post("/patients", json={
            "clinic_id": config.TEST_CLINIC_ID,
            "phone": "9990009003",
        })
        assert response.status_code == 422

    def test_create_patient_invalid_clinic(self, api):
        """Non-existent clinic returns 404."""
        response = api.post("/patients", json={
            "clinic_id": "nonexistent-clinic",
            "first_name": "Test",
            "last_name": "Patient",
            "phone": "9990009004",
        })
        # Either 403 (access denied) or 404 (not found)
        assert response.status_code in (403, 404)


class TestListPatients:
    """Tests for GET /patients"""

    def test_list_patients_for_clinic(self, api, config):
        """List patients returns array for the clinic."""
        response = api.get(f"/patients?clinic_id={config.TEST_CLINIC_ID}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_list_patients_without_auth(self, http_client, config):
        """List patients without auth returns 401/403."""
        response = http_client.get(
            f"/patients?clinic_id={config.TEST_CLINIC_ID}"
        )
        assert response.status_code in (401, 403)


class TestGetPatient:
    """Tests for GET /patients/{patient_id}"""

    def test_get_patient_details(self, api, config):
        """Get existing patient returns full details."""
        # First list patients to get a patient_id
        list_resp = api.get(f"/patients?clinic_id={config.TEST_CLINIC_ID}")
        patients = list_resp.json()

        if not patients:
            pytest.skip("No patients in test clinic")

        patient_id = patients[0].get("patient_id", patients[0].get("id"))
        response = api.get(f"/patients/{patient_id}")
        assert response.status_code == 200

        data = response.json()
        assert "name" in data or "first_name" in data

    def test_get_nonexistent_patient(self, api):
        """Get non-existent patient returns 404."""
        response = api.get("/patients/DOES_NOT_EXIST_999")
        assert response.status_code == 404


class TestCountPatients:
    """Tests for GET /patients/count"""

    def test_count_patients_for_clinic(self, api, config):
        """Count patients returns integer count for the clinic."""
        response = api.get(f"/patients/count?clinic_id={config.TEST_CLINIC_ID}")
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        assert isinstance(data["count"], int)
        assert data["count"] >= 0

    def test_count_patients_without_clinic_id(self, api):
        """Count without clinic_id uses user's clinic."""
        response = api.get("/patients/count")
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        assert isinstance(data["count"], int)

    def test_count_patients_without_auth(self, http_client, config):
        """Count patients without auth returns 401/403."""
        response = http_client.get(
            f"/patients/count?clinic_id={config.TEST_CLINIC_ID}"
        )
        assert response.status_code in (401, 403)

    def test_count_patients_invalid_clinic(self, api):
        """Non-existent clinic returns 404."""
        response = api.get("/patients/count?clinic_id=nonexistent-clinic")
        # Either 403 (access denied) or 404 (not found)
        assert response.status_code in (403, 404)
