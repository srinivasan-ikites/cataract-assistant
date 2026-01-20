"""
Schema loading and template filling utilities.
"""
from pathlib import Path
from typing import Any
import json

from fastapi import HTTPException

from .config import SCHEMA_DIR


def ensure_dir(path: Path) -> Path:
    """Ensure directory exists, creating it if necessary."""
    path.mkdir(parents=True, exist_ok=True)
    return path


def load_schema(schema_filename: str) -> dict:
    """Load a JSON schema file from the schemas directory."""
    schema_path = SCHEMA_DIR / schema_filename
    if not schema_path.exists():
        raise HTTPException(status_code=500, detail=f"Schema file not found: {schema_filename}")
    with open(schema_path, "r", encoding="utf-8") as f:
        return json.load(f)


def fill_from_schema(template: Any, data: Any) -> Any:
    """
    Recursively fill missing keys from a schema template while preserving provided data.
    - For dicts: ensure all template keys exist; keep extra keys from data.
    - For lists: if data provides a list, use it; otherwise fall back to template list.
    - For primitives: prefer data when present, else template default.
    """
    if isinstance(template, dict):
        result: dict = {}
        data_obj = data if isinstance(data, dict) else {}
        for key, tmpl_val in template.items():
            result[key] = fill_from_schema(tmpl_val, data_obj.get(key))
        # Preserve any extra keys present in data but not in template
        for key, val in data_obj.items():
            if key not in result:
                result[key] = val
        return result

    if isinstance(template, list):
        if isinstance(data, list):
            return data
        return template

    if data is None:
        return template
    return data


def apply_schema_template(schema_name: str, data: dict) -> dict:
    """Load schema template and fill any missing keys on the provided data."""
    schema = load_schema(schema_name)
    safe_data = data if isinstance(data, dict) else {}
    return fill_from_schema(schema, safe_data)


def read_json_or_404(path: Path, label: str) -> dict:
    """Read a JSON file or raise 404 if not found."""
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"{label} not found")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)
