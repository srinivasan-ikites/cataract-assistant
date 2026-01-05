from __future__ import annotations
from copy import deepcopy
from typing import Any, Dict, List


"""
Adapters to normalize the new clinic/patient JSON structures into the
legacy shapes expected by the rest of the codebase.

This lets us migrate to the real data files without rewriting the entire
pipeline at once.
"""



def normalize_patient(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert the new single-patient schema into the legacy patient shape.

    Legacy expectations:
    - patient_id (str)
    - clinic_id (str)
    - name: {first, last}
    - dob (str)
    - chat_history (list)
    - Additional fields are kept under "extra" for transparency.
    """
    if not raw:
        return {}

    data = deepcopy(raw)

    identity = data.get("patient_identity", {}) or {}
    patient_id = identity.get("patient_id") or data.get("patient_id")
    clinic_id = identity.get("clinic_ref_id") or data.get("clinic_id")
    first_name = identity.get("first_name") or (data.get("name", {}).get("first") if isinstance(data.get("name"), dict) else None)
    last_name = identity.get("last_name") or (data.get("name", {}).get("last") if isinstance(data.get("name"), dict) else None)
    dob = identity.get("dob") or data.get("dob")

    # Ensure chat history exists and is a list
    chat_history = data.get("chat_history") or []
    if not isinstance(chat_history, list):
        chat_history = []

    # Extract module_content (prefer top-level, then nested under extra)
    module_content = data.get("module_content")
    if module_content is None and isinstance(data.get("extra"), dict):
        module_content = data.get("extra", {}).get("module_content")
    if not isinstance(module_content, dict):
        module_content = {}

    # Preserve existing "extra" if present for other fields, but remove nested module_content
    existing_extra = data.get("extra")
    if isinstance(existing_extra, dict) and "module_content" in existing_extra:
        existing_extra = {k: v for k, v in existing_extra.items() if k != "module_content"}
    if not isinstance(existing_extra, dict):
        existing_extra = {}

    # Keep the remaining patient record under extra (so the API/UI can access the full record)
    reserved_top_level = {
        "patient_identity", 
        "chat_history", 
        "module_content", 
        "extra", 
        "medications",
        "clinical_context",
        "surgical_recommendations_by_doctor",
        "lifestyle",
        "medical_history",
        "documents",
        # Legacy/Internal keys that shouldn't leak into 'extra'
        "patient_id",
        "clinic_id",
        "name",
        "dob",
        "_file_path"
    }
    remaining = {k: v for k, v in data.items() if k not in reserved_top_level}
    merged_extra = {**existing_extra, **remaining}

    normalized = {
        "patient_id": patient_id,
        "clinic_id": clinic_id,
        "name": {"first": first_name, "last": last_name},
        "dob": dob,
        "chat_history": chat_history,
        "module_content": module_content,
        # New reviewed schema fields
        "clinical_context": data.get("clinical_context"),
        "surgical_recommendations_by_doctor": data.get("surgical_recommendations_by_doctor"),
        "lifestyle": data.get("lifestyle"),
        "medical_history": data.get("medical_history"),
        "documents": data.get("documents"),
        "medications": data.get("medications"),
        # Reconstruct identity object for the schema
        "patient_identity": {
            **identity,
            "patient_id": patient_id,
            "clinic_ref_id": clinic_id,
            "first_name": first_name,
            "last_name": last_name,
            "dob": dob
        },
        # Preserve other fields under extra for transparency
        "extra": merged_extra,
    }
    return normalized


def denormalize_patient(normalized: Dict[str, Any]) -> Dict[str, Any]:
    """
    Remove legacy convenience fields and 'extra' debris before saving to disk.
    Ensures the JSON file stays aligned with the intended schema and keeps keys ordered.
    """
    if not normalized:
        return {}
    
    data = deepcopy(normalized)
    
    # Standard schema top-level keys in preferred order
    schema_keys = [
        "patient_identity",
        "medical_history",
        "clinical_context",
        "lifestyle",
        "surgical_recommendations_by_doctor",
        "medications",
        "documents",
        "chat_history",
        "module_content"
    ]
    
    # Build clean output
    clean_data = {}
    for key in schema_keys:
        if key in data:
            clean_data[key] = data[key]
            
    # Include anything truly 'extra' that isn't a schema key or a legacy convenience field
    legacy_keys = {"patient_id", "clinic_id", "name", "dob", "extra", "_file_path"}
    schema_keys_set = set(schema_keys)
    if "extra" in data and isinstance(data["extra"], dict):
        for k, v in data["extra"].items():
            if k not in schema_keys_set and k not in legacy_keys:
                clean_data[k] = v
                
    return clean_data


def normalize_clinic(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert the new clinic schema into a legacy-friendly shape.

    Legacy expectations:
    - clinic_id at top level
    - keep rest of the structure intact under "extra"
    """
    if not raw:
        return {}

    data = deepcopy(raw)
    clinic_profile = data.get("clinic_profile", {}) or {}
    clinic_id = clinic_profile.get("clinic_id")

    normalized = {
        "clinic_id": clinic_id,
        "extra": data,
    }
    return normalized


def wrap_patients(single_patient: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    The UI / API expects a list of patients. Wrap the normalized patient
    object into a list for compatibility with `/patients` endpoint.
    """
    if not single_patient:
        return []
    return [single_patient]
