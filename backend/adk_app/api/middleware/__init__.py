"""
API Middleware package.

Provides authentication, authorization, and request context dependencies.
"""

from .auth import (
    AuthenticatedUser,
    get_current_user,
    get_current_user_optional,
    require_clinic_user,
    require_clinic_admin,
    require_super_admin,
)
from .request_context import RequestContextMiddleware
from .patient_token import decode_patient_token

__all__ = [
    "AuthenticatedUser",
    "get_current_user",
    "get_current_user_optional",
    "require_clinic_user",
    "require_clinic_admin",
    "require_super_admin",
    "RequestContextMiddleware",
    "decode_patient_token",
]
