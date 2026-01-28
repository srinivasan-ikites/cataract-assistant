"""
Supabase client service for database and storage operations.

This module provides a singleton Supabase client that can be used
throughout the application for:
- Database operations (CRUD on tables)
- Storage operations (file uploads/downloads)
- Auth operations (user management)

MongoDB Comparison:
- Instead of `db.collection.find()`, we use `client.table("name").select()`
- Instead of `db.collection.insert_one()`, we use `client.table("name").insert()`
- Foreign keys are enforced at the database level (unlike MongoDB references)
"""

from __future__ import annotations

import os
from typing import Optional, Any

from dotenv import load_dotenv

load_dotenv()

# Global singleton clients
_SUPABASE_CLIENT = None
_SUPABASE_ADMIN_CLIENT = None


def init_supabase_client():
    """
    Initialize the Supabase client at startup.

    We create TWO clients:
    1. Regular client (using anon key) - respects Row Level Security (RLS)
    2. Admin client (using service role key) - bypasses RLS for admin operations

    MongoDB Comparison:
    - MongoDB doesn't have RLS, so you'd have one client
    - Here, the admin client is like having direct database access
    - The regular client is like having access through an API with permissions
    """
    global _SUPABASE_CLIENT, _SUPABASE_ADMIN_CLIENT

    if _SUPABASE_CLIENT is not None:
        return

    import time
    from supabase import create_client, Client

    t_start = time.perf_counter()

    # Get credentials from environment
    url = os.getenv("PROJECT_URL")
    anon_key = os.getenv("ANON_PUBLIC_KEY")
    service_key = os.getenv("SERVICE_ROLE_KEY")

    if not url:
        print("[Supabase] Missing PROJECT_URL, skipping init.")
        return

    if not anon_key:
        print("[Supabase] Missing ANON_PUBLIC_KEY, skipping init.")
        return

    print(f"[Supabase] Initializing clients connecting to {url}...")

    # Regular client - respects RLS policies
    _SUPABASE_CLIENT = create_client(url, anon_key)

    # Admin client - bypasses RLS (use carefully!)
    if service_key:
        _SUPABASE_ADMIN_CLIENT = create_client(url, service_key)
        print(f"[Supabase] Admin client initialized (service role)")
    else:
        print("[Supabase] Warning: SERVICE_ROLE_KEY not set, admin client not available")

    print(f"[Supabase] Clients ready. Init time: {(time.perf_counter() - t_start)*1000:.1f} ms")


def get_supabase_client():
    """
    Get the regular Supabase client (respects RLS).
    Use this for normal operations where user context matters.
    """
    global _SUPABASE_CLIENT

    if _SUPABASE_CLIENT is None:
        print("[Supabase] Client not found, initializing now (lazy load)...")
        init_supabase_client()

    return _SUPABASE_CLIENT


def get_supabase_admin_client():
    """
    Get the admin Supabase client (bypasses RLS).
    Use this for:
    - Backend-to-backend operations
    - Migrations
    - Admin operations that need to access all data

    WARNING: This client can access ALL data regardless of RLS policies.
    """
    global _SUPABASE_ADMIN_CLIENT

    if _SUPABASE_ADMIN_CLIENT is None:
        print("[Supabase] Admin client not found, initializing now (lazy load)...")
        init_supabase_client()

    return _SUPABASE_ADMIN_CLIENT


class SupabaseService:
    """
    High-level service wrapper for Supabase operations.

    MongoDB Comparison:
    - This is like creating a repository/DAO pattern on top of pymongo
    - Methods here abstract away the Supabase query syntax

    Example usage:
        service = SupabaseService()

        # Get all patients for a clinic
        patients = service.get_patients_by_clinic(clinic_id)

        # Get a single patient
        patient = service.get_patient(patient_id)

        # Create a new patient
        new_patient = service.create_patient(clinic_id, patient_data)
    """

    def __init__(self, use_admin: bool = False):
        """
        Initialize the service.

        Args:
            use_admin: If True, use admin client (bypasses RLS).
                      Default False for safety.
        """
        if use_admin:
            self._client = get_supabase_admin_client()
        else:
            self._client = get_supabase_client()

    @property
    def client(self):
        """Direct access to the Supabase client for advanced operations."""
        return self._client

    # =========================================================================
    # CLINIC OPERATIONS
    # =========================================================================

    def get_clinic_by_id(self, clinic_uuid: str) -> Optional[dict]:
        """
        Get a clinic by its UUID.

        MongoDB equivalent: db.clinics.findOne({ _id: ObjectId(clinic_uuid) })
        """
        if not self._client:
            return None

        response = self._client.table("clinics").select("*").eq("id", clinic_uuid).single().execute()
        return response.data

    def get_clinic_by_clinic_id(self, clinic_id: str) -> Optional[dict]:
        """
        Get a clinic by its human-readable clinic_id (e.g., "VIC-MCLEAN-001").

        MongoDB equivalent: db.clinics.findOne({ clinic_id: "VIC-MCLEAN-001" })
        """
        if not self._client:
            return None

        response = self._client.table("clinics").select("*").eq("clinic_id", clinic_id).single().execute()
        return response.data

    def get_all_clinics(self, status: Optional[str] = None) -> list[dict]:
        """
        Get all clinics, optionally filtered by status.

        MongoDB equivalent: db.clinics.find({ status: "active" })
        """
        if not self._client:
            return []

        query = self._client.table("clinics").select("*")
        if status:
            query = query.eq("status", status)

        response = query.execute()
        return response.data or []

    def create_clinic(self, clinic_data: dict) -> Optional[dict]:
        """
        Create a new clinic.

        MongoDB equivalent: db.clinics.insertOne(clinic_data)
        """
        if not self._client:
            return None

        response = self._client.table("clinics").insert(clinic_data).execute()
        return response.data[0] if response.data else None

    def update_clinic(self, clinic_uuid: str, updates: dict) -> Optional[dict]:
        """
        Update a clinic.

        MongoDB equivalent: db.clinics.updateOne({ _id: ObjectId(id) }, { $set: updates })
        """
        if not self._client:
            return None

        response = self._client.table("clinics").update(updates).eq("id", clinic_uuid).execute()
        return response.data[0] if response.data else None

    # =========================================================================
    # CLINIC CONFIG OPERATIONS
    # =========================================================================

    def get_clinic_config(self, clinic_uuid: str) -> Optional[dict]:
        """Get clinic configuration."""
        if not self._client:
            return None

        response = self._client.table("clinic_config").select("*").eq("clinic_id", clinic_uuid).single().execute()
        return response.data

    def upsert_clinic_config(self, clinic_uuid: str, config_data: dict) -> Optional[dict]:
        """
        Create or update clinic configuration.

        MongoDB equivalent: db.clinic_config.updateOne(
            { clinic_id: id },
            { $set: config_data },
            { upsert: true }
        )
        """
        if not self._client:
            return None

        config_data["clinic_id"] = clinic_uuid
        response = self._client.table("clinic_config").upsert(config_data).execute()
        return response.data[0] if response.data else None

    # =========================================================================
    # PATIENT OPERATIONS
    # =========================================================================

    def get_patients_by_clinic(
        self,
        clinic_uuid: str,
        status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> list[dict]:
        """
        Get all patients for a clinic.

        MongoDB equivalent:
            db.patients.find({ clinic_id: id, status: "reviewed" })
                       .skip(offset).limit(limit)
        """
        if not self._client:
            return []

        query = self._client.table("patients").select("*").eq("clinic_id", clinic_uuid)

        if status:
            query = query.eq("status", status)

        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)

        response = query.execute()
        return response.data or []

    def get_patient(self, patient_uuid: str) -> Optional[dict]:
        """
        Get a single patient by UUID.

        MongoDB equivalent: db.patients.findOne({ _id: ObjectId(patient_uuid) })
        """
        if not self._client:
            return None

        response = self._client.table("patients").select("*").eq("id", patient_uuid).single().execute()
        return response.data

    def get_patient_by_patient_id(self, clinic_uuid: str, patient_id: str) -> Optional[dict]:
        """
        Get a patient by clinic's internal patient_id.

        MongoDB equivalent: db.patients.findOne({ clinic_id: id, patient_id: "1245583" })
        """
        if not self._client:
            return None

        response = (
            self._client.table("patients")
            .select("*")
            .eq("clinic_id", clinic_uuid)
            .eq("patient_id", patient_id)
            .single()
            .execute()
        )
        return response.data

    def create_patient(self, patient_data: dict) -> Optional[dict]:
        """
        Create a new patient.

        MongoDB equivalent: db.patients.insertOne(patient_data)
        """
        if not self._client:
            return None

        response = self._client.table("patients").insert(patient_data).execute()
        return response.data[0] if response.data else None

    def update_patient(self, patient_uuid: str, updates: dict) -> Optional[dict]:
        """
        Update a patient record.

        MongoDB equivalent: db.patients.updateOne({ _id: ObjectId(id) }, { $set: updates })
        """
        if not self._client:
            return None

        # Always update the updated_at timestamp
        updates["updated_at"] = "now()"

        response = self._client.table("patients").update(updates).eq("id", patient_uuid).execute()
        return response.data[0] if response.data else None

    def archive_patient(self, patient_uuid: str) -> Optional[dict]:
        """
        Soft delete a patient by archiving.

        MongoDB equivalent: db.patients.updateOne(
            { _id: ObjectId(id) },
            { $set: { status: "archived", archived_at: new Date() } }
        )
        """
        return self.update_patient(patient_uuid, {
            "status": "archived",
            "archived_at": "now()"
        })

    # =========================================================================
    # PATIENT DOCUMENTS OPERATIONS
    # =========================================================================

    def get_patient_documents(self, patient_uuid: str) -> list[dict]:
        """Get all documents for a patient."""
        if not self._client:
            return []

        response = (
            self._client.table("patient_documents")
            .select("*")
            .eq("patient_id", patient_uuid)
            .order("created_at", desc=True)
            .execute()
        )
        return response.data or []

    def create_patient_document(self, document_data: dict) -> Optional[dict]:
        """Create a new patient document record."""
        if not self._client:
            return None

        response = self._client.table("patient_documents").insert(document_data).execute()
        return response.data[0] if response.data else None

    def update_patient_document(self, document_uuid: str, updates: dict) -> Optional[dict]:
        """Update a patient document record."""
        if not self._client:
            return None

        response = self._client.table("patient_documents").update(updates).eq("id", document_uuid).execute()
        return response.data[0] if response.data else None

    # =========================================================================
    # STORAGE OPERATIONS
    # =========================================================================

    def upload_file(
        self,
        bucket: str,
        path: str,
        file_data: bytes,
        content_type: str = "application/octet-stream"
    ) -> Optional[str]:
        """
        Upload a file to Supabase Storage.

        Args:
            bucket: Storage bucket name (e.g., "clinic-documents")
            path: File path within bucket (e.g., "VIC-MCLEAN-001/patients/123/uploads/emr.jpg")
            file_data: File content as bytes
            content_type: MIME type of the file

        Returns:
            The file path if successful, None otherwise

        MongoDB comparison: There's no equivalent - you'd use GridFS or external storage
        """
        if not self._client:
            return None

        try:
            response = self._client.storage.from_(bucket).upload(
                path,
                file_data,
                {"content-type": content_type}
            )
            return path
        except Exception as e:
            print(f"[Supabase] Storage upload error: {e}")
            return None

    def get_file_url(self, bucket: str, path: str, expires_in: int = 3600) -> Optional[str]:
        """
        Get a signed URL for a file (temporary access).

        Args:
            bucket: Storage bucket name
            path: File path within bucket
            expires_in: URL validity in seconds (default 1 hour)

        Returns:
            Signed URL string
        """
        if not self._client:
            return None

        try:
            response = self._client.storage.from_(bucket).create_signed_url(path, expires_in)
            return response.get("signedURL")
        except Exception as e:
            print(f"[Supabase] Get signed URL error: {e}")
            return None

    def delete_file(self, bucket: str, paths: list[str]) -> bool:
        """
        Delete files from storage.

        Args:
            bucket: Storage bucket name
            paths: List of file paths to delete

        Returns:
            True if successful
        """
        if not self._client:
            return False

        try:
            self._client.storage.from_(bucket).remove(paths)
            return True
        except Exception as e:
            print(f"[Supabase] Storage delete error: {e}")
            return False

    # =========================================================================
    # USER PROFILE OPERATIONS
    # =========================================================================

    def get_user_profile(self, user_uuid: str) -> Optional[dict]:
        """Get a user profile by auth user ID."""
        if not self._client:
            return None

        response = self._client.table("user_profiles").select("*").eq("id", user_uuid).single().execute()
        return response.data

    def get_clinic_users(self, clinic_uuid: str) -> list[dict]:
        """Get all users for a clinic."""
        if not self._client:
            return []

        response = (
            self._client.table("user_profiles")
            .select("*")
            .eq("clinic_id", clinic_uuid)
            .execute()
        )
        return response.data or []

    def create_user_profile(self, profile_data: dict) -> Optional[dict]:
        """Create a new user profile."""
        if not self._client:
            return None

        response = self._client.table("user_profiles").insert(profile_data).execute()
        return response.data[0] if response.data else None

    def update_user_profile(self, user_uuid: str, updates: dict) -> Optional[dict]:
        """Update a user profile."""
        if not self._client:
            return None

        updates["updated_at"] = "now()"
        response = self._client.table("user_profiles").update(updates).eq("id", user_uuid).execute()
        return response.data[0] if response.data else None
