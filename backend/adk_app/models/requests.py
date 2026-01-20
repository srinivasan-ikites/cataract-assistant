"""
Pydantic request models for the Cataract Counsellor API.
"""
from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    """Request model for the /ask endpoint."""
    patient_id: str = Field(..., description="Patient identifier from patient JSON.")
    question: str = Field(..., description="User's natural language question.")


class ModuleContentRequest(BaseModel):
    """Request model for the /module-content endpoint."""
    patient_id: str
    module_title: str


class PreGenerateModulesRequest(BaseModel):
    """Request model for the /pregenerate-modules endpoint."""
    patient_id: str


class ReviewedPatientPayload(BaseModel):
    """Request model for saving reviewed patient data."""
    clinic_id: str
    patient_id: str
    data: dict


class ReviewedClinicPayload(BaseModel):
    """Request model for saving reviewed clinic data."""
    clinic_id: str
    data: dict
