"""
API Routes aggregation.
"""
from fastapi import APIRouter

from .health import router as health_router
from .patient import router as patient_router
from .clinic import router as clinic_router
from .chat import router as chat_router
from .doctor import router as doctor_router

# Create the main API router
api_router = APIRouter()

# Include all route modules
api_router.include_router(health_router)
api_router.include_router(patient_router)
api_router.include_router(clinic_router)
api_router.include_router(chat_router)
api_router.include_router(doctor_router)

__all__ = ["api_router"]
