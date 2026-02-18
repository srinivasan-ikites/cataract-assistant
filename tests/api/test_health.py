"""
Tests for health check endpoints.

Covers:
- GET /ping
- GET /version
- GET /healthz
"""

import pytest

pytestmark = pytest.mark.api


class TestHealthEndpoints:
    """Tests for health check endpoints"""

    def test_ping(self, http_client):
        """Ping endpoint returns status and timestamp."""
        response = http_client.get("/ping")
        assert response.status_code == 200

        data = response.json()
        assert "status" in data
        assert data["status"] == 200
        assert "timestamp" in data

    def test_version(self, http_client):
        """Version endpoint returns app version and environment info."""
        response = http_client.get("/version")
        assert response.status_code == 200

        data = response.json()
        assert "version" in data
        assert "environment" in data
        assert data["environment"] == "production"
        assert "timezone" in data
        assert data["timezone"] == "UTC"
        assert "timestamp" in data

    def test_healthz(self, http_client):
        """Health check endpoint returns ok status."""
        response = http_client.get("/healthz")
        assert response.status_code == 200

        data = response.json()
        assert data["status"] == "ok"
