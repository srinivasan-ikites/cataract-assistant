"""
API-specific test fixtures.

Provides convenience helpers for API testing like
authenticated request helpers and response assertions.
"""

import pytest


@pytest.fixture
def api(http_client, admin_auth):
    """
    Convenience wrapper: pre-authenticated API client.

    Usage:
        response = api.get("/patients?clinic_id=garuda-clinic")
    """
    class AuthenticatedClient:
        def __init__(self, client, auth):
            self._client = client
            self._headers = auth["headers"]

        def get(self, url, **kwargs):
            kwargs.setdefault("headers", self._headers)
            return self._client.get(url, **kwargs)

        def post(self, url, **kwargs):
            kwargs.setdefault("headers", self._headers)
            return self._client.post(url, **kwargs)

        def put(self, url, **kwargs):
            kwargs.setdefault("headers", self._headers)
            return self._client.put(url, **kwargs)

        def delete(self, url, **kwargs):
            kwargs.setdefault("headers", self._headers)
            return self._client.delete(url, **kwargs)

    return AuthenticatedClient(http_client, admin_auth)
