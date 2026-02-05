"""
Patient token utilities for request context middleware.

This module provides a utility to decode patient JWT tokens
without raising errors (used for logging context extraction).
"""

from __future__ import annotations

import os
from typing import Optional

import jwt


JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")


def decode_patient_token(token: str) -> Optional[dict]:
    """
    Decode a patient JWT token without raising errors.

    Returns the payload if valid, None if invalid/expired.
    Used by request context middleware to extract patient info for logging.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        if payload.get("type") != "patient":
            return None
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
    except Exception:
        return None
