"""
API Middleware package.

Provides authentication and authorization dependencies.
"""

from .auth import (
    AuthenticatedUser,
    get_current_user,
    get_current_user_optional,
    require_clinic_user,
    require_clinic_admin,
    require_super_admin,
)

__all__ = [
    "AuthenticatedUser",
    "get_current_user",
    "get_current_user_optional",
    "require_clinic_user",
    "require_clinic_admin",
    "require_super_admin",
]
