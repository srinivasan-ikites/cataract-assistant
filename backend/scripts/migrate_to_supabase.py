"""
Migration Script: JSON Files → Supabase

This script migrates existing JSON data to Supabase:
1. Clinic data → clinics + clinic_config tables
2. Patient data → patients table
3. (Optional) Files → Supabase Storage

Usage:
    cd backend
    python scripts/migrate_to_supabase.py

Prerequisites:
    - Supabase project set up with all tables created
    - .env file with Supabase credentials
    - At least one user created in auth.users (for created_by field)
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv
load_dotenv()

from supabase import create_client


# =============================================================================
# CONFIGURATION
# =============================================================================

# Paths
BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
CLINIC_DIR = DATA_DIR / "clinic"
REVIEWED_DIR = DATA_DIR / "reviewed"
UPLOADS_DIR = DATA_DIR / "uploads"

# Supabase
SUPABASE_URL = os.getenv("PROJECT_URL")
SUPABASE_KEY = os.getenv("SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("[Migration] ERROR: Missing Supabase credentials in .env")
    print("  Required: PROJECT_URL, SERVICE_ROLE_KEY")
    sys.exit(1)

# Initialize Supabase client with service role (bypasses RLS)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
print(f"[Migration] Connected to Supabase: {SUPABASE_URL}")


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def load_json(path: Path) -> dict:
    """Load a JSON file."""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_existing_clinic(clinic_id: str):
    """Check if clinic already exists."""
    try:
        result = supabase.table("clinics").select("id").eq("clinic_id", clinic_id).single().execute()
        return result.data
    except:
        return None


def get_existing_patient(clinic_uuid: str, patient_id: str):
    """Check if patient already exists."""
    try:
        result = supabase.table("patients").select("id").eq("clinic_id", clinic_uuid).eq("patient_id", patient_id).single().execute()
        return result.data
    except:
        return None


def get_first_clinic_user(clinic_uuid: str):
    """Get the first user for a clinic (to use as created_by)."""
    try:
        result = supabase.table("user_profiles").select("id").eq("clinic_id", clinic_uuid).limit(1).execute()
        if result.data:
            return result.data[0]["id"]
        return None
    except:
        return None


# =============================================================================
# MIGRATION: CLINIC
# =============================================================================

def migrate_clinic(clinic_id: str) -> str | None:
    """
    Migrate clinic data from JSON to Supabase.

    Returns the clinic UUID if successful.
    """
    print(f"\n{'='*60}")
    print(f"[Migration] Migrating clinic: {clinic_id}")
    print(f"{'='*60}")

    # Check if already exists
    existing = get_existing_clinic(clinic_id)
    if existing:
        print(f"[Migration] Clinic already exists with UUID: {existing['id']}")
        return existing["id"]

    # Load clinic data
    reviewed_clinic_path = REVIEWED_DIR / clinic_id / "reviewed_clinic.json"

    if not reviewed_clinic_path.exists():
        print(f"[Migration] ERROR: Clinic file not found: {reviewed_clinic_path}")
        return None

    clinic_data = load_json(reviewed_clinic_path)
    print(f"[Migration] Loaded clinic data from: {reviewed_clinic_path}")

    # Extract profile
    profile = clinic_data.get("clinic_profile", {})

    # Prepare clinics table data
    clinic_record = {
        "clinic_id": clinic_id,
        "name": profile.get("name", "Unknown Clinic"),
        "address": profile.get("address", {}),
        "contact": profile.get("contact_info", {}),
        "status": "active",
        "settings": {
            "branding": profile.get("branding", {}),
            "parent_organization": profile.get("parent_organization")
        }
    }

    print(f"[Migration] Inserting clinic: {clinic_record['name']}")

    # Insert clinic
    try:
        result = supabase.table("clinics").insert(clinic_record).execute()
        clinic_uuid = result.data[0]["id"]
        print(f"[Migration] ✓ Clinic created with UUID: {clinic_uuid}")
    except Exception as e:
        print(f"[Migration] ERROR inserting clinic: {e}")
        return None

    # Prepare clinic_config data
    config_record = {
        "clinic_id": clinic_uuid,
        "surgical_packages": clinic_data.get("surgical_packages", []),
        "lens_inventory": clinic_data.get("lens_inventory", {}),
        "medications": clinic_data.get("medications", {}),
        "sops": clinic_data.get("standard_operating_procedures", {}),
        "staff_directory": clinic_data.get("staff_directory", [])
    }

    print(f"[Migration] Inserting clinic config...")
    print(f"  - Surgical packages: {len(config_record['surgical_packages'])}")
    print(f"  - Staff members: {len(config_record['staff_directory'])}")

    # Insert clinic config
    try:
        supabase.table("clinic_config").insert(config_record).execute()
        print(f"[Migration] ✓ Clinic config created")
    except Exception as e:
        print(f"[Migration] ERROR inserting clinic config: {e}")
        # Don't fail the whole migration, clinic is still created

    return clinic_uuid


# =============================================================================
# MIGRATION: PATIENT
# =============================================================================

def migrate_patient(clinic_uuid: str, patient_dir: Path, created_by: str | None) -> str | None:
    """
    Migrate a single patient from JSON to Supabase.

    Returns the patient UUID if successful.
    """
    patient_id = patient_dir.name
    print(f"\n[Migration] Migrating patient: {patient_id}")

    # Check if already exists
    existing = get_existing_patient(clinic_uuid, patient_id)
    if existing:
        print(f"[Migration] Patient already exists with UUID: {existing['id']}")
        return existing["id"]

    # Load patient data
    patient_file = patient_dir / "reviewed_patient.json"

    if not patient_file.exists():
        print(f"[Migration] WARNING: Patient file not found: {patient_file}")
        return None

    patient_data = load_json(patient_file)
    print(f"[Migration] Loaded patient data from: {patient_file}")

    # Extract identity
    identity = patient_data.get("patient_identity", {})

    # Map JSON structure to database schema
    patient_record = {
        "clinic_id": clinic_uuid,
        "patient_id": patient_id,
        "created_by": created_by,
        "assigned_doctor_id": created_by,  # Assign to same user for now

        # Identity fields
        "first_name": identity.get("first_name"),
        "middle_name": identity.get("middle_name"),
        "last_name": identity.get("last_name"),
        "dob": identity.get("dob"),
        "gender": identity.get("gender"),
        "contact": {},  # Not in current data

        # JSONB fields - store the complex nested data
        "medical_profile": patient_data.get("medical_profile", {}),
        "clinical_context": patient_data.get("clinical_context", {}),
        "lifestyle_profile": patient_data.get("lifestyle_profile", {}),
        "surgical_plan": {
            "recommendations_by_doctor": patient_data.get("surgical_recommendations_by_doctor", {}),
            "candidacy_assessment": patient_data.get("candidacy_assessment", {})
        },
        "medications_plan": patient_data.get("medications", {}),

        # AI generated content
        "module_content": patient_data.get("module_content", {}),
        "chat_history": patient_data.get("chat_history", []),

        # Status - if module_content exists, consider it reviewed
        "status": "reviewed" if patient_data.get("module_content") else "extracted"
    }

    print(f"[Migration] Patient: {patient_record['first_name']} {patient_record['last_name']}")
    print(f"[Migration] DOB: {patient_record['dob']} | Gender: {patient_record['gender']}")
    print(f"[Migration] Status: {patient_record['status']}")

    # Insert patient
    try:
        result = supabase.table("patients").insert(patient_record).execute()
        patient_uuid = result.data[0]["id"]
        print(f"[Migration] ✓ Patient created with UUID: {patient_uuid}")
        return patient_uuid
    except Exception as e:
        print(f"[Migration] ERROR inserting patient: {e}")
        return None


def migrate_all_patients(clinic_uuid: str, clinic_id: str) -> int:
    """Migrate all patients for a clinic."""
    patients_dir = REVIEWED_DIR / clinic_id

    if not patients_dir.exists():
        print(f"[Migration] No patients directory found: {patients_dir}")
        return 0

    # Get a user to use as created_by
    created_by = get_first_clinic_user(clinic_uuid)
    if not created_by:
        print("[Migration] WARNING: No clinic user found, created_by will be null")

    # Find all patient directories (exclude reviewed_clinic.json)
    patient_dirs = [d for d in patients_dir.iterdir() if d.is_dir()]

    print(f"\n[Migration] Found {len(patient_dirs)} patient(s) to migrate")

    migrated = 0
    for patient_dir in patient_dirs:
        if migrate_patient(clinic_uuid, patient_dir, created_by):
            migrated += 1

    return migrated


# =============================================================================
# MAIN
# =============================================================================

def main():
    print("\n" + "="*60)
    print("  CATARACT COUNSELLOR - DATA MIGRATION TO SUPABASE")
    print("="*60)
    print(f"\nData directory: {DATA_DIR}")
    print(f"Supabase URL: {SUPABASE_URL}")

    # Find all clinics to migrate
    clinic_ids = []

    # Check reviewed directory for clinics
    if REVIEWED_DIR.exists():
        clinic_ids = [d.name for d in REVIEWED_DIR.iterdir() if d.is_dir()]

    if not clinic_ids:
        print("\n[Migration] No clinics found to migrate!")
        return

    print(f"\n[Migration] Found {len(clinic_ids)} clinic(s) to migrate: {clinic_ids}")

    # Migrate each clinic and its patients
    total_patients = 0
    for clinic_id in clinic_ids:
        clinic_uuid = migrate_clinic(clinic_id)

        if clinic_uuid:
            patients_migrated = migrate_all_patients(clinic_uuid, clinic_id)
            total_patients += patients_migrated

    # Summary
    print("\n" + "="*60)
    print("  MIGRATION COMPLETE")
    print("="*60)
    print(f"\n  Clinics migrated: {len(clinic_ids)}")
    print(f"  Patients migrated: {total_patients}")
    print("\n  Next steps:")
    print("  1. Verify data in Supabase dashboard")
    print("  2. Update backend API to read from Supabase")
    print("  3. (Optional) Migrate uploaded files to Supabase Storage")
    print()


if __name__ == "__main__":
    main()
