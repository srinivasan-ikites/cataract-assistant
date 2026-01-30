"""
Pydantic request models for the Cataract Counsellor API.
"""
from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    """Request model for the /ask endpoint."""
    patient_id: str = Field(..., description="Patient identifier from patient JSON.")
    question: str = Field(..., description="User's natural language question.")
    clinic_id: str = Field(None, description="Clinic identifier (required for unique patient lookup).")


class ModuleContentRequest(BaseModel):
    """Request model for the /module-content endpoint."""
    patient_id: str
    module_title: str
    clinic_id: str = Field(None, description="Clinic identifier (required for unique patient lookup).")


class PreGenerateModulesRequest(BaseModel):
    """Request model for the /pregenerate-modules endpoint."""
    patient_id: str
    clinic_id: str = Field(None, description="Clinic identifier (required for unique patient lookup).")


class ReviewedPatientPayload(BaseModel):
    """Request model for saving reviewed patient data."""
    clinic_id: str
    patient_id: str
    data: dict


class ReviewedClinicPayload(BaseModel):
    """Request model for saving reviewed clinic data."""
    clinic_id: str
    data: dict
