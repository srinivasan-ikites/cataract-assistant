"""
API Routes aggregation.
"""
from fastapi import APIRouter

from .health import router as health_router
from .patient import router as patient_router
from .clinic import router as clinic_router
from .chat import router as chat_router
from .doctor import router as doctor_router
from .auth import router as auth_router
from .admin import router as admin_router
from .users import router as users_router
from .patient_auth import router as patient_auth_router
from .dashboard import router as dashboard_router

# Create the main API router
api_router = APIRouter()

# Include all route modules
api_router.include_router(health_router)
api_router.include_router(patient_router)
api_router.include_router(clinic_router)
api_router.include_router(chat_router)
api_router.include_router(doctor_router)
api_router.include_router(auth_router)
api_router.include_router(admin_router)  # Super admin routes
api_router.include_router(users_router)  # Clinic user management
api_router.include_router(patient_auth_router)  # Patient OTP authentication
api_router.include_router(dashboard_router)  # Dashboard statistics

__all__ = ["api_router"]
