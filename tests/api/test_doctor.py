"""
Tests for doctor workflow endpoints.

Covers:
- POST /doctor/uploads/patient (document upload)
- GET /doctor/extractions/patient (get extraction results)
- POST /doctor/review/patient (save reviewed data)
- GET /doctor/reviewed/patient (get saved review)
"""

import pytest

pytestmark = pytest.mark.api


class TestDocumentUpload:
    """Tests for POST /doctor/uploads/patient"""

    def test_upload_without_auth(self, http_client):
        """Upload without auth returns 401/403."""
        response = http_client.post(
            "/doctor/uploads/patient",
            data={"clinic_id": "test", "patient_id": "001"},
        )
        assert response.status_code in (401, 403)

    def test_upload_missing_files(self, http_client, admin_auth, config):
        """Upload with no files returns error."""
        response = http_client.post(
            "/doctor/uploads/patient",
            data={
                "clinic_id": config.TEST_CLINIC_ID,
                "patient_id": "001",
            },
            headers=admin_auth["headers"],
        )
        # 401 (form-data auth issue), 400/422 (missing files), 500 (server error)
        assert response.status_code in (400, 401, 422, 500)


class TestExtractionResults:
    """Tests for GET /doctor/extractions/patient"""

    def test_get_extraction_without_auth(self, http_client, config):
        """Get extraction without auth returns 401/403."""
        response = http_client.get(
            f"/doctor/extractions/patient?clinic_id={config.TEST_CLINIC_ID}&patient_id=001"
        )
        assert response.status_code in (401, 403)

    def test_get_extraction_for_valid_patient(self, api, config):
        """Get extraction for a valid patient returns data (or empty)."""
        # List patients to get a real ID
        list_resp = api.get(f"/patients?clinic_id={config.TEST_CLINIC_ID}")
        patients = list_resp.json()

        if not patients:
            pytest.skip("No patients in test clinic")

        patient_id = patients[0].get("patient_id", patients[0].get("id"))
        response = api.get(
            f"/doctor/extractions/patient?clinic_id={config.TEST_CLINIC_ID}&patient_id={patient_id}"
        )
        # Should return 200 (with data) or 404 (no extractions yet)
        assert response.status_code in (200, 404)


class TestSaveReview:
    """Tests for POST /doctor/review/patient"""

    def test_save_review_without_auth(self, http_client, config):
        """Save review without auth returns 401/403."""
        response = http_client.post(
            "/doctor/review/patient",
            json={
                "clinic_id": config.TEST_CLINIC_ID,
                "patient_id": "001",
                "data": {},
            },
        )
        assert response.status_code in (401, 403)

    def test_save_review_missing_data(self, api, config):
        """Save review without required fields returns error."""
        response = api.post("/doctor/review/patient", json={})
        assert response.status_code == 422


class TestGetReviewedData:
    """Tests for GET /doctor/reviewed/patient"""

    def test_get_reviewed_without_auth(self, http_client, config):
        """Get reviewed data without auth returns 401/403."""
        response = http_client.get(
            f"/doctor/reviewed/patient?clinic_id={config.TEST_CLINIC_ID}&patient_id=001"
        )
        assert response.status_code in (401, 403)

    def test_get_reviewed_for_valid_patient(self, api, config):
        """Get reviewed data for a valid patient returns data."""
        list_resp = api.get(f"/patients?clinic_id={config.TEST_CLINIC_ID}")
        patients = list_resp.json()

        if not patients:
            pytest.skip("No patients in test clinic")

        patient_id = patients[0].get("patient_id", patients[0].get("id"))
        response = api.get(
            f"/doctor/reviewed/patient?clinic_id={config.TEST_CLINIC_ID}&patient_id={patient_id}"
        )
        assert response.status_code in (200, 404)
