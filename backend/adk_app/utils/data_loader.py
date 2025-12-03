from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Dict, List

BASE_DIR = Path(__file__).resolve().parents[2]
CLINIC_DIR = BASE_DIR / "data" / "clinic"
PATIENT_FILE = BASE_DIR / "data" / "patient" / "sample_patient.json"


@lru_cache(maxsize=1)
def _load_clinic_cache() -> Dict[str, dict]:
    cache: Dict[str, dict] = {}
    if not CLINIC_DIR.exists():
        return cache
    for path in CLINIC_DIR.glob("*.json"):
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
            clinic_id = data.get("clinic_id")
            if clinic_id:
                cache[clinic_id] = data
    return cache


def get_clinic_data(clinic_id: str) -> dict:
    clinic = _load_clinic_cache().get(clinic_id)
    if not clinic:
        raise ValueError(f"Clinic '{clinic_id}' not found in {CLINIC_DIR}")
    return clinic


@lru_cache(maxsize=1)
def _load_patient_cache() -> Dict[str, dict]:
    if not PATIENT_FILE.exists():
        return {}
    with PATIENT_FILE.open("r", encoding="utf-8") as f:
        payload = json.load(f)
    patients: List[dict] = payload.get("patients", [])
    return {patient["patient_id"]: patient for patient in patients if patient.get("patient_id")}


def get_patient_data(patient_id: str) -> dict:
    patient = _load_patient_cache().get(patient_id)
    if not patient:
        raise ValueError(f"Patient '{patient_id}' not found in {PATIENT_FILE}")
    return patient


def get_all_patients() -> List[dict]:
    """Return a summary list of all patients."""
    payload = _load_patient_cache()
    # Convert dict back to list for summary
    return list(payload.values())


def save_patient_chat_history(patient_id: str, user_msg: str, bot_msg: str, suggestions: List[str] = None) -> None:
    """Append a chat turn to the patient's history and save to disk."""
    if not PATIENT_FILE.exists():
        raise ValueError("Patient file not found.")

    # Reload fresh to avoid overwriting concurrent edits (simple file lock simulation)
    with PATIENT_FILE.open("r", encoding="utf-8") as f:
        payload = json.load(f)

    patients = payload.get("patients", [])
    target_patient = None
    for p in patients:
        if p.get("patient_id") == patient_id:
            target_patient = p
            break

    if not target_patient:
        raise ValueError(f"Patient {patient_id} not found for saving history.")

    if "chat_history" not in target_patient:
        target_patient["chat_history"] = []

    # Append new turn
    target_patient["chat_history"].append({
        "role": "user",
        "text": user_msg,
        "timestamp": "now" # In a real app, use datetime.utcnow().isoformat()
    })
    target_patient["chat_history"].append({
        "role": "bot",
        "text": bot_msg,
        "suggestions": suggestions or [],
        "timestamp": "now"
    })

    # Write back to disk
    with PATIENT_FILE.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    # Invalidate cache so next read gets fresh data
    _load_patient_cache.cache_clear()


