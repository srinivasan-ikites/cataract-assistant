from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Any

from adk_app.utils.data_adapter import normalize_clinic, normalize_patient

BASE_DIR = Path(__file__).resolve().parents[2]
CLINIC_DIR = BASE_DIR / "data" / "clinic"
PATIENT_FILE = BASE_DIR / "data" / "patient" / "original_patient.json"


@lru_cache(maxsize=1)
def _load_clinic_cache() -> Dict[str, dict]:
    """
    Load and normalize clinic records from JSON files in the clinic directory.
    """
    cache: Dict[str, dict] = {}
    if not CLINIC_DIR.exists():
        return cache
    for path in CLINIC_DIR.glob("*.json"):
        with path.open("r", encoding="utf-8") as f:
            raw = json.load(f)
            normalized = normalize_clinic(raw)
            clinic_id = normalized.get("clinic_id")
            if clinic_id:
                cache[clinic_id] = normalized
    return cache


def get_clinic_data(clinic_id: str) -> dict:
    clinic = _load_clinic_cache().get(clinic_id)
    if not clinic:
        raise ValueError(f"Clinic '{clinic_id}' not found in {CLINIC_DIR}")
    return clinic


@lru_cache(maxsize=1)
def _load_patient_cache() -> Dict[str, dict]:
    """
    Load and normalize patient records. Supports:
    - New single-patient JSON (no 'patients' array)
    - Legacy multi-patient JSON with 'patients' array
    """
    if not PATIENT_FILE.exists():
        return {}
    with PATIENT_FILE.open("r", encoding="utf-8") as f:
        payload = json.load(f)

    cache: Dict[str, dict] = {}

    if isinstance(payload, dict) and "patients" in payload:
        # Legacy multi-patient file
        for patient in payload.get("patients", []):
            normalized = normalize_patient(patient)
            pid = normalized.get("patient_id")
            if pid:
                cache[pid] = normalized
    else:
        # New single-patient file
        normalized = normalize_patient(payload if isinstance(payload, dict) else {})
        pid = normalized.get("patient_id")
        if pid:
            cache[pid] = normalized

    return cache


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


def save_patient_chat_history(patient_id: str, user_msg: str, bot_msg: str, suggestions: List[str] = None, blocks: List[dict] | None = None) -> None:
    """Append a chat turn to the patient's history and save to disk."""
    if not PATIENT_FILE.exists():
        raise ValueError("Patient file not found.")

    with PATIENT_FILE.open("r", encoding="utf-8") as f:
        payload = json.load(f)

    def _append_history(target: dict) -> None:
        if "chat_history" not in target or not isinstance(target.get("chat_history"), list):
            target["chat_history"] = []
        target["chat_history"].append({
            "role": "user",
            "text": user_msg,
            "timestamp": "now"  # In production, use datetime.utcnow().isoformat()
        })
        target["chat_history"].append({
            "role": "bot",
            "text": bot_msg,
            "blocks": blocks or [],
            "suggestions": suggestions or [],
            "timestamp": "now"
        })

    # Legacy multi-patient structure (only if patients is a list)
    is_multi = isinstance(payload, dict) and isinstance(payload.get("patients"), list)
    if is_multi:
        if "sources" in payload:
            payload.pop("sources", None)
        patients = payload.get("patients") or []
        for p in patients:
            if not isinstance(p, dict):
                continue
            if p.get("patient_id") == patient_id:
                _append_history(p)
                break
        else:
            raise ValueError(f"Patient {patient_id} not found for saving history.")
    else:
        # Single patient structure
        if not isinstance(payload, dict):
            raise ValueError("Patient file is not a JSON object.")
        pid = payload.get("patient_identity", {}).get("patient_id")
        if pid != patient_id:
            raise ValueError(f"Patient {patient_id} not found for saving history.")
        _append_history(payload)

    with PATIENT_FILE.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    # Invalidate cache so next read gets fresh data
    _load_patient_cache.cache_clear()


def save_patient_module_content(patient_id: str, module_title: str, content: Dict[str, Any]) -> None:
    """
    Persist generated module content for a patient so we can reuse without re-calling the LLM.
    Content is stored under patient["module_content"][module_title].
    """
    if not PATIENT_FILE.exists():
        raise ValueError("Patient file not found.")

    with PATIENT_FILE.open("r", encoding="utf-8") as f:
        payload = json.load(f)

    def _write_content(target: dict) -> None:
        module_map = target.get("module_content")
        if not isinstance(module_map, dict):
            module_map = {}
            target["module_content"] = module_map
        module_map[module_title] = content
        # Clean any legacy nested storage to avoid confusion
        extra = target.get("extra")
        if isinstance(extra, dict) and "module_content" in extra:
            extra.pop("module_content", None)

    if isinstance(payload, dict) and "patients" in payload:
        # Legacy multi-patient structure
        patients = payload.get("patients", [])
        target_patient = None
        for p in patients:
            if p.get("patient_id") == patient_id:
                target_patient = p
                break
        if not target_patient:
            raise ValueError(f"Patient {patient_id} not found for saving module content.")
        _write_content(target_patient)
    else:
        # Single patient structure
        if not isinstance(payload, dict) or payload.get("patient_identity", {}).get("patient_id") != patient_id:
            raise ValueError(f"Patient {patient_id} not found for saving module content.")
        _write_content(payload)

    with PATIENT_FILE.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    # Invalidate cache so next read gets fresh data
    _load_patient_cache.cache_clear()
