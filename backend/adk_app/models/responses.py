"""
Pydantic response models for the Cataract Counsellor API.
"""
from pydantic import BaseModel


class AskResponse(BaseModel):
    """Response model for the /ask endpoint."""
    answer: str
    blocks: list[dict] = []
    suggestions: list[str] = []
    router_summary: dict
    context_sources: dict
    media: list[dict] = []  # Media items (images/videos) from retrieved chunks
    sources: list[dict] = []  # Source URLs/links from retrieved chunks


class EyeDetails(BaseModel):
    """Per-eye condition details."""
    condition: str
    description: str


class ModuleContentResponse(BaseModel):
    """Response model for the /module-content endpoint."""
    title: str
    summary: str
    details: list[str] = []
    faqs: list[dict] = []
    videoScriptSuggestion: str | None = None
    botStarterPrompt: str | None = None
    checklist: list[str] = []
    timeline: list[dict] = []
    risks: list[dict] = []
    costBreakdown: list[dict] = []

    # Diagnosis module specific fields (LLM-generated)
    primary_diagnosis_type: str | None = None      # "Combined form of senile cataract"
    cataract_types: list[str] = []                 # ["Nuclear sclerosis", "Cortical"]
    eyes_same_condition: bool | None = None        # true if both eyes have same condition
    right_eye: EyeDetails | None = None            # Right eye details
    left_eye: EyeDetails | None = None             # Left eye details
    additional_conditions: list[str] = []          # ["Dry Eye Syndrome", "Myopia"]
