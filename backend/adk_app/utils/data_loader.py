from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Any

from adk_app.utils.data_adapter import normalize_clinic, normalize_patient

BASE_DIR = Path(__file__).resolve().parents[2]
CLINIC_DIR = BASE_DIR / "data" / "clinic"
REVIEW_ROOT = BASE_DIR / "data" / "reviewed"


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
    Load and normalize patient records from the reviewed directory.
    Scans REVIEW_ROOT/{clinic_id}/{patient_id}/reviewed_patient.json
    """
    cache: Dict[str, dict] = {}
    if not REVIEW_ROOT.exists():
        return cache

    # Scan for all reviewed_patient.json files
    # Structure: REVIEW_ROOT / {clinic_id} / {patient_id} / reviewed_patient.json
    for path in REVIEW_ROOT.glob("**/reviewed_patient.json"):
        try:
            with path.open("r", encoding="utf-8") as f:
                payload = json.load(f)
                normalized = normalize_patient(payload)
                pid = normalized.get("patient_id")
                if pid:
                    # Store the path so we can write back to it
                    normalized["_file_path"] = str(path)
                    cache[pid] = normalized
        except Exception as exc:
            print(f"[DataLoader] Failed to load {path}: {exc}")

    return cache


def get_patient_data(patient_id: str) -> dict:
    patient = _load_patient_cache().get(patient_id)
    if not patient:
        raise ValueError(f"Patient '{patient_id}' not found in {REVIEW_ROOT}")
    return patient


def get_all_patients() -> List[dict]:
    """Return a summary list of all patients."""
    payload = _load_patient_cache()
    # Convert dict back to list for summary
    return list(payload.values())


def _save_patient_data(patient_id: str, updater_func) -> None:
    """Generic helper to load, update, and save patient data to its source file."""
    # Try to get from cache first
    cache = _load_patient_cache()
    patient = cache.get(patient_id)
    
    if patient and patient.get("_file_path"):
        # Use cached file path
        file_path = patient["_file_path"]
    else:
        # Cache miss - scan for the file directly
        if not REVIEW_ROOT.exists():
            raise ValueError(f"Patient '{patient_id}' not found - review directory doesn't exist")
        
        # Find the patient file by scanning
        found_files = list(REVIEW_ROOT.glob(f"*/{patient_id}/reviewed_patient.json"))
        if not found_files:
            raise ValueError(f"Patient '{patient_id}' not found in {REVIEW_ROOT}")
        
        file_path = str(found_files[0])
    
    path = Path(file_path)
    with path.open("r", encoding="utf-8") as f:
        payload = json.load(f)

    updater_func(payload)

    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    # Invalidate cache
    _load_patient_cache.cache_clear()


def save_patient_chat_history(patient_id: str, user_msg: str, bot_msg: str, suggestions: List[str] = None, blocks: List[dict] | None = None) -> None:
    """Append a chat turn to the patient's history and save to disk."""
    
    def _append_history(target: dict) -> None:
        if "chat_history" not in target or not isinstance(target.get("chat_history"), list):
            target["chat_history"] = []
        target["chat_history"].append({
            "role": "user",
            "text": user_msg,
            "timestamp": "now"
        })
        target["chat_history"].append({
            "role": "bot",
            "text": bot_msg,
            "blocks": blocks or [],
            "suggestions": suggestions or [],
            "timestamp": "now"
        })

    _save_patient_data(patient_id, _append_history)


def clear_patient_chat_history(patient_id: str) -> None:
    """Remove all stored chat history for the given patient."""
    
    def _clear_history(target: dict) -> None:
        target["chat_history"] = []

    _save_patient_data(patient_id, _clear_history)


def save_patient_module_content(patient_id: str, module_title: str, content: Dict[str, Any]) -> None:
    """Persist generated module content for a patient."""
    
    def _write_content(target: dict) -> None:
        module_map = target.get("module_content")
        if not isinstance(module_map, dict):
            module_map = {}
            target["module_content"] = module_map
        module_map[module_title] = content
        # Clean any legacy nested storage
        extra = target.get("extra")
        if isinstance(extra, dict) and "module_content" in extra:
            extra.pop("module_content", None)

    _save_patient_data(patient_id, _write_content)


def clear_patient_cache() -> None:
    """Invalidate the patient data cache."""
    _load_patient_cache.cache_clear()
