"""
Patient routes for the patient UI.
"""
from fastapi import APIRouter, HTTPException

from adk_app.utils.data_loader import (
    get_patient_data,
    get_all_patients,
    clear_patient_chat_history,
)

router = APIRouter(prefix="/patients", tags=["Patients"])


@router.get("")
def list_patients() -> list[dict]:
    """Return a list of all patients for the selection screen."""
    return get_all_patients()


@router.get("/{patient_id}")
def get_patient(patient_id: str) -> dict:
    """Return full details for a specific patient, including chat history."""
    try:
        return get_patient_data(patient_id)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err))


@router.post("/{patient_id}/chat/clear")
def clear_patient_chat(patient_id: str) -> dict:
    """
    Clear stored chat history for a patient in the JSON file.
    Does not remove any other patient data.
    """
    try:
        clear_patient_chat_history(patient_id)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err))
    return {"status": "ok"}
