"""
Supabase Data Loader - Replaces JSON-based data_loader.py

This module provides the same interface as data_loader.py but reads/writes
from Supabase instead of JSON files.

MongoDB comparison:
- This is like switching from file-based storage to using pymongo
- get_patient_data() is like db.patients.findOne()
- get_all_patients() is like db.patients.find()
"""

from __future__ import annotations

from typing import Dict, List, Any, Optional
from datetime import datetime

from adk_app.services.supabase_service import get_supabase_admin_client, SupabaseService


# =============================================================================
# PATIENT DATA FUNCTIONS
# =============================================================================

def get_patient_data(patient_id: str, clinic_id: str = None) -> dict:
    """
    Get full patient data by patient_id.

    Args:
        patient_id: The clinic's internal patient ID (e.g., "1245583")
        clinic_id: Optional clinic slug (e.g., "asa-clinic") to scope the search

    Returns:
        Patient data dict in the format expected by the frontend

    Raises:
        ValueError: If patient not found
    """
    print(f"[SupabaseDataLoader] Getting patient data for: {patient_id}, clinic: {clinic_id}")

    client = get_supabase_admin_client()
    if not client:
        raise ValueError("Database connection not available")

    try:
        # Build query
        query = client.table("patients").select("*, clinics(clinic_id, name)")

        if clinic_id:
            # First, look up the clinic UUID from the slug
            clinic_result = client.table("clinics").select("id").eq("clinic_id", clinic_id).single().execute()
            if clinic_result.data:
                clinic_uuid = clinic_result.data["id"]
                query = query.eq("clinic_id", clinic_uuid).eq("patient_id", patient_id)
                print(f"[SupabaseDataLoader] Using clinic_id filter: {clinic_id} -> {clinic_uuid}")
            else:
                print(f"[SupabaseDataLoader] Warning: Clinic '{clinic_id}' not found, querying by patient_id only")
                query = query.eq("patient_id", patient_id)
        else:
            # If no clinic_id, just search by patient_id (may return first match)
            print(f"[SupabaseDataLoader] Warning: No clinic_id provided, querying by patient_id only (may fail with duplicates)")
            query = query.eq("patient_id", patient_id)

        result = query.single().execute()
        patient = result.data

        if not patient:
            raise ValueError(f"Patient '{patient_id}' not found")

        print(f"[SupabaseDataLoader] Found patient: {patient.get('first_name')} {patient.get('last_name')}")

        # Transform to frontend-expected format
        return _transform_patient_for_frontend(patient)

    except Exception as e:
        error_msg = str(e)
        if "No rows" in error_msg or "0 rows" in error_msg:
            raise ValueError(f"Patient '{patient_id}' not found")
        print(f"[SupabaseDataLoader] Error getting patient: {e}")
        raise ValueError(f"Error fetching patient: {e}")


def get_patient_by_uuid(patient_uuid: str) -> dict:
    """
    Get patient data by UUID (database primary key).

    Args:
        patient_uuid: The patient's UUID in the database

    Returns:
        Patient data dict
    """
    print(f"[SupabaseDataLoader] Getting patient by UUID: {patient_uuid}")

    client = get_supabase_admin_client()
    if not client:
        raise ValueError("Database connection not available")

    try:
        result = client.table("patients").select("*, clinics(clinic_id, name)").eq("id", patient_uuid).single().execute()
        patient = result.data

        if not patient:
            raise ValueError(f"Patient with UUID '{patient_uuid}' not found")

        return _transform_patient_for_frontend(patient)

    except Exception as e:
        print(f"[SupabaseDataLoader] Error getting patient by UUID: {e}")
        raise ValueError(f"Error fetching patient: {e}")


def get_all_patients(clinic_id: str = None) -> List[dict]:
    """
    Get all patients, optionally filtered by clinic.

    Args:
        clinic_id: Optional clinic slug (e.g., "asa-clinic") to filter by

    Returns:
        List of patient summaries
    """
    print(f"[SupabaseDataLoader] Getting all patients" + (f" for clinic {clinic_id}" if clinic_id else ""))

    client = get_supabase_admin_client()
    if not client:
        return []

    try:
        query = client.table("patients").select("*, clinics(clinic_id, name)")

        if clinic_id:
            # First, look up the clinic UUID from the slug
            clinic_result = client.table("clinics").select("id").eq("clinic_id", clinic_id).single().execute()
            if clinic_result.data:
                clinic_uuid = clinic_result.data["id"]
                query = query.eq("clinic_id", clinic_uuid)
                print(f"[SupabaseDataLoader] Filtering by clinic: {clinic_id} -> {clinic_uuid}")
            else:
                print(f"[SupabaseDataLoader] Warning: Clinic '{clinic_id}' not found")
                return []

        # Exclude archived patients
        query = query.neq("status", "archived")

        # Order by created_at descending
        query = query.order("created_at", desc=True)

        result = query.execute()
        patients = result.data or []

        print(f"[SupabaseDataLoader] Found {len(patients)} patients")

        # Transform each patient
        return [_transform_patient_for_frontend(p) for p in patients]

    except Exception as e:
        print(f"[SupabaseDataLoader] Error getting all patients: {e}")
        return []


def _transform_patient_for_frontend(patient: dict) -> dict:
    """
    Transform database patient record to frontend-expected format.

    The frontend expects a specific structure based on the old JSON format.
    This function maps the database fields to that structure.
    """
    clinic_info = patient.get("clinics", {}) or {}

    # Build the frontend-expected structure
    transformed = {
        # Identity
        "patient_id": patient.get("patient_id"),
        "clinic_id": clinic_info.get("clinic_id"),
        "name": {
            "first": patient.get("first_name", ""),
            "last": patient.get("last_name", "")
        },
        "dob": patient.get("dob"),
        "gender": patient.get("gender"),

        # Medical data (stored as JSONB, return as-is)
        "medical_profile": patient.get("medical_profile", {}),
        "clinical_context": patient.get("clinical_context", {}),
        "lifestyle_profile": patient.get("lifestyle_profile", {}),

        # Surgical data (v2 schema - full object for new components)
        "surgical_plan": patient.get("surgical_plan", {}),

        # Legacy surgical fields (kept for backward compatibility, may be empty)
        "surgical_recommendations_by_doctor": patient.get("surgical_plan", {}).get("recommendations_by_doctor", {}),
        "candidacy_assessment": patient.get("surgical_plan", {}).get("candidacy_assessment", {}),

        # Medications
        "medications": patient.get("medications_plan", {}),

        # AI content
        "module_content": patient.get("module_content", {}),
        "chat_history": patient.get("chat_history", []),

        # Status
        "status": patient.get("status"),

        # Metadata (for internal use)
        "_uuid": patient.get("id"),
        "_clinic_uuid": patient.get("clinic_id"),
        "_created_at": patient.get("created_at"),
        "_updated_at": patient.get("updated_at"),
    }

    return transformed


# =============================================================================
# PATIENT CREATION FUNCTIONS
# =============================================================================

def get_next_patient_id(clinic_uuid: str) -> str:
    """
    Get the next patient ID for a clinic.

    Patient IDs are sequential per clinic: 001, 002, 003, etc.

    Args:
        clinic_uuid: The clinic's UUID in the database

    Returns:
        Next patient ID as zero-padded string (e.g., "001", "012", "123")
    """
    print(f"[SupabaseDataLoader] Getting next patient ID for clinic: {clinic_uuid}")

    client = get_supabase_admin_client()
    if not client:
        raise ValueError("Database connection not available")

    try:
        # Get all patient_ids for this clinic and find the max
        result = client.table("patients").select("patient_id").eq("clinic_id", clinic_uuid).execute()
        patients = result.data or []

        if not patients:
            return "001"

        # Extract numeric IDs and find max
        max_id = 0
        for p in patients:
            pid = p.get("patient_id", "0")
            try:
                num = int(pid)
                if num > max_id:
                    max_id = num
            except (ValueError, TypeError):
                # Skip non-numeric IDs
                continue

        next_id = max_id + 1
        # Zero-pad to 3 digits minimum, but allow larger numbers
        return str(next_id).zfill(3)

    except Exception as e:
        print(f"[SupabaseDataLoader] Error getting next patient ID: {e}")
        raise ValueError(f"Error generating patient ID: {e}")


def create_patient(clinic_uuid: str, first_name: str, last_name: str, phone: str,
                   dob: str = None, gender: str = None, email: str = None) -> dict:
    """
    Create a new patient record in Supabase.

    Args:
        clinic_uuid: The clinic's UUID in the database
        first_name: Patient's first name (required)
        last_name: Patient's last name (required)
        phone: Patient's phone number (required for OTP login)
        dob: Date of birth (optional, format: YYYY-MM-DD)
        gender: Gender (optional)
        email: Email address (optional)

    Returns:
        Created patient data in frontend-expected format

    Raises:
        ValueError: If required fields are missing or creation fails
    """
    print(f"[SupabaseDataLoader] Creating patient for clinic: {clinic_uuid}")

    if not first_name or not first_name.strip():
        raise ValueError("First name is required")
    if not last_name or not last_name.strip():
        raise ValueError("Last name is required")
    if not phone or not phone.strip():
        raise ValueError("Phone number is required")

    # Clean phone number (remove non-digits)
    clean_phone = ''.join(filter(str.isdigit, phone))
    if len(clean_phone) != 10:
        raise ValueError("Phone number must be 10 digits")

    client = get_supabase_admin_client()
    if not client:
        raise ValueError("Database connection not available")

    try:
        # Generate patient ID
        patient_id = get_next_patient_id(clinic_uuid)
        print(f"[SupabaseDataLoader] Generated patient ID: {patient_id}")

        # Check if phone number already exists for this clinic
        existing = client.table("patients").select("id").eq("clinic_id", clinic_uuid).eq("phone", clean_phone).execute()
        if existing.data:
            raise ValueError("A patient with this phone number already exists in this clinic")

        # Build patient record
        # Note: Don't set 'status' - let the database use its default value
        patient_data = {
            "patient_id": patient_id,
            "clinic_id": clinic_uuid,
            "first_name": first_name.strip(),
            "last_name": last_name.strip(),
            "phone": clean_phone,
            # Initialize empty JSON fields
            "medical_profile": {},
            "clinical_context": {},
            "lifestyle_profile": {},
            "surgical_plan": {},
            "medications_plan": {},
            "module_content": {},
            "chat_history": [],
        }

        # Add optional fields if provided
        if dob:
            patient_data["dob"] = dob
        if gender:
            patient_data["gender"] = gender
        if email:
            patient_data["email"] = email.strip()

        # Insert into database
        result = client.table("patients").insert(patient_data).execute()

        if not result.data:
            raise ValueError("Failed to create patient record")

        created_patient = result.data[0]
        print(f"[SupabaseDataLoader] Patient created: {patient_id} - {first_name} {last_name}")

        # Fetch with clinic info for proper transformation
        full_result = client.table("patients").select("*, clinics(clinic_id, name)").eq("id", created_patient["id"]).single().execute()

        return _transform_patient_for_frontend(full_result.data)

    except ValueError:
        raise
    except Exception as e:
        print(f"[SupabaseDataLoader] Error creating patient: {e}")
        raise ValueError(f"Error creating patient: {e}")


def update_patient_from_reviewed(clinic_id: str, patient_id: str, reviewed_data: dict) -> dict:
    """
    Update a patient record from reviewed/extracted data.

    This function syncs the doctor-reviewed patient data to Supabase.
    It preserves protected fields (phone, patient_id, clinic_id) and updates
    all other fields from the reviewed data.

    Args:
        clinic_id: The clinic slug (e.g., "mclean-eye-clinic")
        patient_id: The clinic's internal patient ID (e.g., "001")
        reviewed_data: The reviewed patient data containing:
            - patient_identity (name, dob, gender)
            - medical_profile (conditions, medications, allergies)
            - clinical_context (biometry, ocular data)
            - lifestyle_profile (hobbies, visual goals)
            - surgical_plan (doctor's recommendations)
            - medications_plan (pre/post-op meds)

    Returns:
        Updated patient data in frontend-expected format

    Raises:
        ValueError: If patient not found or update fails
    """
    print(f"[SupabaseDataLoader] Updating patient from reviewed data: {clinic_id}/{patient_id}")

    client = get_supabase_admin_client()
    if not client:
        raise ValueError("Database connection not available")

    try:
        # First, get the clinic UUID from the slug
        clinic_result = client.table("clinics").select("id").eq("clinic_id", clinic_id).single().execute()
        if not clinic_result.data:
            raise ValueError(f"Clinic '{clinic_id}' not found")
        clinic_uuid = clinic_result.data["id"]

        # Find the patient by clinic and patient_id
        patient_result = client.table("patients").select("*").eq("clinic_id", clinic_uuid).eq("patient_id", patient_id).single().execute()
        if not patient_result.data:
            raise ValueError(f"Patient '{patient_id}' not found in clinic '{clinic_id}'")

        existing_patient = patient_result.data
        patient_uuid = existing_patient["id"]

        # Build update payload from reviewed data
        update_data = {}

        # Extract patient_identity fields (name, dob, gender)
        identity = reviewed_data.get("patient_identity", {})
        if identity.get("first_name"):
            update_data["first_name"] = identity["first_name"]
        if identity.get("last_name"):
            update_data["last_name"] = identity["last_name"]
        if identity.get("dob"):
            update_data["dob"] = identity["dob"]
        if identity.get("gender"):
            update_data["gender"] = identity["gender"]

        # Update JSONB fields (replace entirely)
        if "medical_profile" in reviewed_data:
            update_data["medical_profile"] = reviewed_data["medical_profile"]
        if "clinical_context" in reviewed_data:
            update_data["clinical_context"] = reviewed_data["clinical_context"]
        if "lifestyle_profile" in reviewed_data:
            update_data["lifestyle_profile"] = reviewed_data["lifestyle_profile"]
        if "surgical_plan" in reviewed_data:
            update_data["surgical_plan"] = reviewed_data["surgical_plan"]
        if "medications_plan" in reviewed_data:
            update_data["medications_plan"] = reviewed_data["medications_plan"]

        # Preserve chat_history and module_content from existing data if not in reviewed
        # (these are updated separately via chat/module APIs)
        if "chat_history" not in reviewed_data and existing_patient.get("chat_history"):
            # Keep existing chat history
            pass
        elif "chat_history" in reviewed_data:
            update_data["chat_history"] = reviewed_data["chat_history"]

        if "module_content" not in reviewed_data and existing_patient.get("module_content"):
            # Keep existing module content
            pass
        elif "module_content" in reviewed_data:
            update_data["module_content"] = reviewed_data["module_content"]

        # Update status to 'reviewed' if it was 'pending' or 'new'
        current_status = existing_patient.get("status")
        if current_status in [None, "pending", "new"]:
            update_data["status"] = "reviewed"

        # Add timestamp
        update_data["updated_at"] = "now()"

        # Perform the update
        result = client.table("patients").update(update_data).eq("id", patient_uuid).execute()

        if not result.data:
            raise ValueError("Failed to update patient record")

        print(f"[SupabaseDataLoader] Patient updated successfully: {clinic_id}/{patient_id}")

        # Fetch updated patient with clinic info for proper transformation
        full_result = client.table("patients").select("*, clinics(clinic_id, name)").eq("id", patient_uuid).single().execute()

        return _transform_patient_for_frontend(full_result.data)

    except ValueError:
        raise
    except Exception as e:
        print(f"[SupabaseDataLoader] Error updating patient: {e}")
        raise ValueError(f"Error updating patient: {e}")


# =============================================================================
# PATIENT UPDATE FUNCTIONS
# =============================================================================

def save_patient_chat_history(patient_id: str, user_msg: str, bot_msg: str, suggestions: List[str] = None, blocks: List[dict] | None = None, clinic_id: str = None) -> None:
    """
    Append a chat turn to the patient's history.

    Args:
        patient_id: The clinic's internal patient ID
        user_msg: User's message
        bot_msg: Bot's response
        suggestions: Optional list of suggested follow-up questions
        blocks: Optional structured content blocks
        clinic_id: The clinic's slug ID (required for unique patient lookup)
    """
    print(f"[SupabaseDataLoader] Saving chat history for patient: {patient_id}, clinic: {clinic_id}")

    client = get_supabase_admin_client()
    if not client:
        raise ValueError("Database connection not available")

    try:
        # Build query - must include clinic_id for unique lookup
        query = client.table("patients").select("id, chat_history")

        if clinic_id:
            # First, look up the clinic UUID from the slug
            clinic_result = client.table("clinics").select("id").eq("clinic_id", clinic_id).single().execute()
            if clinic_result.data:
                clinic_uuid = clinic_result.data["id"]
                query = query.eq("clinic_id", clinic_uuid)
                print(f"[SupabaseDataLoader] Using clinic_id filter: {clinic_id} -> {clinic_uuid}")
            else:
                print(f"[SupabaseDataLoader] Warning: Clinic '{clinic_id}' not found")
        else:
            print(f"[SupabaseDataLoader] Warning: No clinic_id provided (may fail with duplicates)")

        result = query.eq("patient_id", patient_id).single().execute()
        patient = result.data

        if not patient:
            raise ValueError(f"Patient '{patient_id}' not found")

        # Get existing history or initialize
        chat_history = patient.get("chat_history") or []

        # Append new messages
        timestamp = datetime.utcnow().isoformat()
        chat_history.append({
            "role": "user",
            "text": user_msg,
            "timestamp": timestamp
        })
        chat_history.append({
            "role": "bot",
            "text": bot_msg,
            "blocks": blocks or [],
            "suggestions": suggestions or [],
            "timestamp": timestamp
        })

        # Update in database
        client.table("patients").update({
            "chat_history": chat_history,
            "updated_at": "now()"
        }).eq("id", patient["id"]).execute()

        print(f"[SupabaseDataLoader] Chat history saved (total messages: {len(chat_history)})")

    except Exception as e:
        print(f"[SupabaseDataLoader] Error saving chat history: {e}")
        raise ValueError(f"Error saving chat history: {e}")


def clear_patient_chat_history(patient_id: str, clinic_id: str = None) -> None:
    """
    Clear all chat history for a patient.

    Args:
        patient_id: The clinic's internal patient ID
        clinic_id: The clinic's slug ID (required for unique patient lookup)
    """
    print(f"[SupabaseDataLoader] Clearing chat history for patient: {patient_id}, clinic: {clinic_id}")

    client = get_supabase_admin_client()
    if not client:
        raise ValueError("Database connection not available")

    try:
        # First, find the patient with unique lookup
        query = client.table("patients").select("id")

        if clinic_id:
            # Look up the clinic UUID from the slug
            clinic_result = client.table("clinics").select("id").eq("clinic_id", clinic_id).single().execute()
            if clinic_result.data:
                clinic_uuid = clinic_result.data["id"]
                query = query.eq("clinic_id", clinic_uuid)
                print(f"[SupabaseDataLoader] Using clinic_id filter: {clinic_id} -> {clinic_uuid}")
            else:
                print(f"[SupabaseDataLoader] Warning: Clinic '{clinic_id}' not found")
        else:
            print(f"[SupabaseDataLoader] Warning: No clinic_id provided (may affect wrong patient)")

        patient_result = query.eq("patient_id", patient_id).single().execute()
        if not patient_result.data:
            raise ValueError(f"Patient '{patient_id}' not found")

        patient_uuid = patient_result.data["id"]

        # Update to empty array using UUID
        result = client.table("patients").update({
            "chat_history": [],
            "updated_at": "now()"
        }).eq("id", patient_uuid).execute()

        if not result.data:
            raise ValueError(f"Failed to clear chat history for patient '{patient_id}'")

        print(f"[SupabaseDataLoader] Chat history cleared")

    except Exception as e:
        print(f"[SupabaseDataLoader] Error clearing chat history: {e}")
        raise ValueError(f"Error clearing chat history: {e}")


def save_patient_module_content(patient_id: str, module_title: str, content: Dict[str, Any], clinic_id: str = None) -> None:
    """
    Save generated module content for a patient.

    Args:
        patient_id: The clinic's internal patient ID
        module_title: Module name (e.g., "My Diagnosis")
        content: Generated content for the module
        clinic_id: The clinic's slug ID (required for unique patient lookup)
    """
    print(f"[SupabaseDataLoader] Saving module content for patient: {patient_id}, clinic: {clinic_id}, module: {module_title}")

    client = get_supabase_admin_client()
    if not client:
        raise ValueError("Database connection not available")

    try:
        # Build query - must include clinic_id to uniquely identify patient
        query = client.table("patients").select("id, module_content, clinic_id")

        if clinic_id:
            # Get clinic UUID first
            clinic_result = client.table("clinics").select("id").eq("clinic_id", clinic_id).single().execute()
            if clinic_result.data:
                clinic_uuid = clinic_result.data["id"]
                query = query.eq("clinic_id", clinic_uuid)
                print(f"[SupabaseDataLoader] Using clinic_id filter: {clinic_id} -> {clinic_uuid}")
            else:
                print(f"[SupabaseDataLoader] Warning: Clinic '{clinic_id}' not found, querying by patient_id only")
        else:
            print(f"[SupabaseDataLoader] Warning: No clinic_id provided, querying by patient_id only (may fail with duplicates)")

        result = query.eq("patient_id", patient_id).single().execute()
        patient = result.data

        if not patient:
            raise ValueError(f"Patient '{patient_id}' not found")

        # Get existing content or initialize
        module_content = patient.get("module_content") or {}

        # Add/update the module
        module_content[module_title] = content

        # Update in database
        client.table("patients").update({
            "module_content": module_content,
            "updated_at": "now()"
        }).eq("id", patient["id"]).execute()

        print(f"[SupabaseDataLoader] Module content saved")

    except Exception as e:
        print(f"[SupabaseDataLoader] Error saving module content: {e}")
        raise ValueError(f"Error saving module content: {e}")


def update_patient_data(patient_id: str, updates: dict) -> dict:
    """
    Update patient data.

    Args:
        patient_id: The clinic's internal patient ID
        updates: Dictionary of fields to update

    Returns:
        Updated patient data
    """
    print(f"[SupabaseDataLoader] Updating patient: {patient_id}")

    client = get_supabase_admin_client()
    if not client:
        raise ValueError("Database connection not available")

    try:
        # Add updated_at timestamp
        updates["updated_at"] = "now()"

        result = client.table("patients").update(updates).eq("patient_id", patient_id).execute()

        if not result.data:
            raise ValueError(f"Patient '{patient_id}' not found")

        print(f"[SupabaseDataLoader] Patient updated")
        return _transform_patient_for_frontend(result.data[0])

    except Exception as e:
        print(f"[SupabaseDataLoader] Error updating patient: {e}")
        raise ValueError(f"Error updating patient: {e}")


# =============================================================================
# CLINIC DATA FUNCTIONS
# =============================================================================

def get_clinic_data(clinic_id: str) -> dict:
    """
    Get clinic data by clinic_id (human-readable ID like "VIC-MCLEAN-001").

    Args:
        clinic_id: The human-readable clinic ID

    Returns:
        Clinic data including config
    """
    print(f"[SupabaseDataLoader] Getting clinic data for: {clinic_id}")

    client = get_supabase_admin_client()
    if not client:
        raise ValueError("Database connection not available")

    try:
        # Get clinic with config
        result = client.table("clinics").select("*, clinic_config(*)").eq("clinic_id", clinic_id).single().execute()
        clinic = result.data

        if not clinic:
            raise ValueError(f"Clinic '{clinic_id}' not found")

        print(f"[SupabaseDataLoader] Found clinic: {clinic.get('name')}")

        # Transform to frontend-expected format
        return _transform_clinic_for_frontend(clinic)

    except Exception as e:
        error_msg = str(e)
        if "No rows" in error_msg or "0 rows" in error_msg:
            raise ValueError(f"Clinic '{clinic_id}' not found")
        print(f"[SupabaseDataLoader] Error getting clinic: {e}")
        raise ValueError(f"Error fetching clinic: {e}")


def _transform_clinic_for_frontend(clinic: dict) -> dict:
    """
    Transform database clinic record to frontend-expected format.
    """
    config = clinic.get("clinic_config") or [{}]
    # clinic_config is returned as array due to join, get first item
    if isinstance(config, list):
        config = config[0] if config else {}

    transformed = {
        "clinic_profile": {
            "clinic_id": clinic.get("clinic_id"),
            "name": clinic.get("name"),
            "address": clinic.get("address", {}),
            "contact_info": clinic.get("contact", {}),
            "branding": clinic.get("settings", {}).get("branding", {}),
            "parent_organization": clinic.get("settings", {}).get("parent_organization")
        },
        "staff_directory": config.get("staff_directory", []),
        "surgical_packages": config.get("surgical_packages", []),
        "lens_inventory": config.get("lens_inventory", {}),
        "medications": config.get("medications", {}),
        "standard_operating_procedures": config.get("sops", {}),

        # Metadata
        "_uuid": clinic.get("id"),
        "_status": clinic.get("status"),
    }

    return transformed


# =============================================================================
# CACHE FUNCTIONS (Compatibility with old interface)
# =============================================================================

def clear_patient_cache() -> None:
    """
    Clear patient cache - no-op for Supabase as we don't cache.

    Kept for compatibility with existing code.
    """
    print("[SupabaseDataLoader] clear_patient_cache called (no-op for Supabase)")
    pass


# =============================================================================
# CLINIC UPDATE FUNCTIONS
# =============================================================================

def update_clinic_from_reviewed(clinic_id: str, reviewed_data: dict) -> dict:
    """
    Update a clinic's configuration from reviewed data.

    This function syncs the clinic configuration to Supabase.
    It updates both the clinics table (profile info) and clinic_config table (configuration).

    Args:
        clinic_id: The clinic slug (e.g., "mclean-eye-clinic")
        reviewed_data: The reviewed clinic data containing:
            - clinic_profile (name, address, contact_info)
            - staff_directory
            - surgical_packages
            - lens_inventory
            - medications
            - billing_and_insurance
            - documents

    Returns:
        Updated clinic data in frontend-expected format

    Raises:
        ValueError: If clinic not found or update fails
    """
    print(f"[SupabaseDataLoader] Updating clinic from reviewed data: {clinic_id}")

    client = get_supabase_admin_client()
    if not client:
        raise ValueError("Database connection not available")

    try:
        # First, get the clinic UUID
        clinic_result = client.table("clinics").select("id, clinic_id, name").eq("clinic_id", clinic_id).single().execute()
        if not clinic_result.data:
            raise ValueError(f"Clinic '{clinic_id}' not found")

        clinic_uuid = clinic_result.data["id"]
        print(f"[SupabaseDataLoader] Found clinic UUID: {clinic_uuid}")

        # Extract clinic_profile data
        profile = reviewed_data.get("clinic_profile", {})

        # Build update for clinics table
        clinic_update = {}

        if profile.get("name"):
            clinic_update["name"] = profile["name"]

        if profile.get("address"):
            clinic_update["address"] = profile["address"]

        if profile.get("contact_info"):
            clinic_update["contact"] = profile["contact_info"]

        # Settings can include branding, parent_organization
        settings_update = {}
        if profile.get("branding"):
            settings_update["branding"] = profile["branding"]
        if profile.get("parent_organization"):
            settings_update["parent_organization"] = profile["parent_organization"]
        if settings_update:
            clinic_update["settings"] = settings_update

        # Update clinics table if we have data
        if clinic_update:
            # Add timestamp as ISO string (Supabase will parse it)
            clinic_update["updated_at"] = datetime.utcnow().isoformat()
            print(f"[SupabaseDataLoader] Updating clinics table with: {list(clinic_update.keys())}")
            clinic_result = client.table("clinics").update(clinic_update).eq("id", clinic_uuid).execute()
            print(f"[SupabaseDataLoader] Clinics update result: {clinic_result.data}")

        # Build update for clinic_config table
        # Note: Only these columns exist in clinic_config table:
        # surgical_packages, lens_inventory, medications, sops, staff_directory
        config_update = {}

        if "staff_directory" in reviewed_data:
            config_update["staff_directory"] = reviewed_data["staff_directory"]

        if "surgical_packages" in reviewed_data:
            config_update["surgical_packages"] = reviewed_data["surgical_packages"]

        if "lens_inventory" in reviewed_data:
            config_update["lens_inventory"] = reviewed_data["lens_inventory"]

        if "medications" in reviewed_data:
            config_update["medications"] = reviewed_data["medications"]

        if "standard_operating_procedures" in reviewed_data:
            config_update["sops"] = reviewed_data["standard_operating_procedures"]

        # Note: billing_and_insurance and documents are NOT stored in clinic_config
        # They would need separate columns added to the table if needed

        # Only proceed with clinic_config if we have data to save
        if not config_update:
            print(f"[SupabaseDataLoader] No config data to save, skipping clinic_config update")
        else:
            # Log what we're about to save
            print(f"[SupabaseDataLoader] Config data to save:")
            print(f"  - staff_directory: {len(config_update.get('staff_directory', []))} items")
            print(f"  - surgical_packages: {len(config_update.get('surgical_packages', []))} items")
            print(f"  - lens_inventory: {len(config_update.get('lens_inventory', {}))} categories")
            print(f"  - medications: {list(config_update.get('medications', {}).keys())}")

            # Check if clinic_config exists
            print(f"[SupabaseDataLoader] Checking clinic_config for clinic_id: {clinic_uuid}")
            config_result = client.table("clinic_config").select("id").eq("clinic_id", clinic_uuid).execute()
            print(f"[SupabaseDataLoader] clinic_config query result: {config_result.data}")

            if config_result.data and len(config_result.data) > 0:
                # Update existing config
                config_id = config_result.data[0]["id"]
                print(f"[SupabaseDataLoader] Updating existing clinic_config (id: {config_id}) with: {list(config_update.keys())}")
                try:
                    update_result = client.table("clinic_config").update(config_update).eq("id", config_id).execute()
                    print(f"[SupabaseDataLoader] Update result: {update_result.data}")
                    if not update_result.data:
                        print(f"[SupabaseDataLoader] WARNING: Update returned no data!")
                except Exception as update_err:
                    print(f"[SupabaseDataLoader] ERROR updating clinic_config: {update_err}")
                    raise
            else:
                # Insert new config
                config_update["clinic_id"] = clinic_uuid
                print(f"[SupabaseDataLoader] Inserting new clinic_config with: {list(config_update.keys())}")
                try:
                    insert_result = client.table("clinic_config").insert(config_update).execute()
                    print(f"[SupabaseDataLoader] Insert result: {insert_result.data}")
                    if not insert_result.data:
                        print(f"[SupabaseDataLoader] WARNING: Insert returned no data!")
                except Exception as insert_err:
                    print(f"[SupabaseDataLoader] ERROR inserting clinic_config: {insert_err}")
                    raise

        print(f"[SupabaseDataLoader] Clinic updated successfully: {clinic_id}")

        # Fetch and return updated clinic data
        return get_clinic_data(clinic_id)

    except ValueError:
        raise
    except Exception as e:
        print(f"[SupabaseDataLoader] Error updating clinic: {e}")
        raise ValueError(f"Error updating clinic: {e}")
