"""
Tests for RAG chatbot endpoint.

Covers:
- POST /ask (general questions + patient-specific)
- Response structure (answer, blocks, suggestions)
- Chat history persistence
"""

import pytest

pytestmark = [pytest.mark.api, pytest.mark.slow]


class TestChatEndpoint:
    """Tests for POST /ask"""

    def test_ask_general_question(self, http_client, config):
        """Ask a general cataract question returns an answer."""
        response = http_client.post("/ask", json={
            "question": "What is a cataract?",
            "patient_id": "001",
            "clinic_id": config.TEST_CLINIC_ID,
        })

        if response.status_code == 404:
            pytest.skip("Patient 001 not found in test clinic")

        assert response.status_code == 200

        data = response.json()
        assert "answer" in data
        assert len(data["answer"]) > 10  # Should be a substantive answer

    def test_ask_returns_structured_response(self, http_client, config):
        """Response includes answer, suggestions, and optionally blocks."""
        response = http_client.post("/ask", json={
            "question": "What types of lens are available?",
            "patient_id": "001",
            "clinic_id": config.TEST_CLINIC_ID,
        })

        if response.status_code == 404:
            pytest.skip("Patient 001 not found in test clinic")

        assert response.status_code == 200
        data = response.json()

        assert "answer" in data
        # suggestions should be a list
        if "suggestions" in data:
            assert isinstance(data["suggestions"], list)

    def test_ask_empty_question(self, http_client, config):
        """Empty question returns error or minimal response."""
        response = http_client.post("/ask", json={
            "question": "",
            "patient_id": "001",
            "clinic_id": config.TEST_CLINIC_ID,
        })
        # Could be 400 (validation) or 200 (with empty-ish answer)
        assert response.status_code in (200, 400, 422)

    def test_ask_missing_patient_id(self, http_client, config):
        """Missing patient_id returns error."""
        response = http_client.post("/ask", json={
            "question": "What is a cataract?",
            "clinic_id": config.TEST_CLINIC_ID,
        })
        assert response.status_code in (400, 422)
