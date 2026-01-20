"""
Health check route.
"""
from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/healthz")
def health() -> dict:
    """Health check endpoint."""
    return {"status": "ok"}
