"""
Tests for health check endpoints.

Covers:
- GET /version (human-readable timestamp format)
- GET /ping
- GET /healthz
"""

import pytest
import re

pytestmark = pytest.mark.api


class TestVersion:
    """Tests for GET /version"""

    def test_version_returns_success(self, http_client):
        """Version endpoint returns 200 with expected fields."""
        response = http_client.get("/version")
        assert response.status_code == 200

        data = response.json()
        assert "version" in data
        assert "environment" in data
        assert "timezone" in data
        assert "timestamp" in data

    def test_version_timestamp_is_human_readable(self, http_client):
        """Version endpoint timestamp is in human-readable format."""
        response = http_client.get("/version")
        assert response.status_code == 200

        data = response.json()
        timestamp = data["timestamp"]

        # Should NOT be ISO format (contains 'T' and '+')
        assert 'T' not in timestamp, f"Timestamp should not be ISO format: {timestamp}"

        # Should be human-readable format like "February 18, 2026 at 7:29 AM UTC"
        # Pattern: Month DD, YYYY at HH:MM AM/PM UTC
        pattern = r'^[A-Z][a-z]+ \d{1,2}, \d{4} at \d{1,2}:\d{2} (AM|PM) UTC$'
        assert re.match(pattern, timestamp), f"Timestamp should match human-readable format: {timestamp}"

    def test_version_has_correct_structure(self, http_client):
        """Version endpoint returns all expected fields with correct types."""
        response = http_client.get("/version")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data["version"], str)
        assert isinstance(data["environment"], str)
        assert isinstance(data["timezone"], str)
        assert isinstance(data["timestamp"], str)


class TestPing:
    """Tests for GET /ping"""

    def test_ping_returns_success(self, http_client):
        """Ping endpoint returns 200 with status and timestamp."""
        response = http_client.get("/ping")
        assert response.status_code == 200

        data = response.json()
        assert "status" in data
        assert "timestamp" in data
        assert data["status"] == 200


class TestHealthz:
    """Tests for GET /healthz"""

    def test_healthz_returns_ok(self, http_client):
        """Healthz endpoint returns 200 with ok status."""
        response = http_client.get("/healthz")
        assert response.status_code == 200

        data = response.json()
        assert data["status"] == "ok"
