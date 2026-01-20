"""
Data normalization utilities for extracted patient/clinic data.
"""
from datetime import datetime


def normalize_date(date_str: str) -> str:
    """Normalize date to YYYY-MM-DD format."""
    if not date_str:
        return ""
    # Remove extra whitespace
    date_str = date_str.strip()
    # Try common formats
    for fmt in ["%Y-%m-%d", "%m/%d/%Y", "%Y/%m/%d", "%d-%m-%Y", "%m-%d-%Y"]:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return date_str  # Return as-is if no format matches


def normalize_extracted_data(data: dict) -> dict:
    """
    Post-process extracted data to ensure consistency (v2 schema support):
    - Standardize date formats to ISO 8601 (YYYY-MM-DD)
    - Normalize capitalization
    - Normalize pathology grading
    - Clean up whitespace

    Note: v2 schema separates extraction (clinical data) from doctor entry (surgical plan, medications)
    """
    # Normalize patient identity
    if "patient_identity" in data:
        identity = data["patient_identity"]
        if "dob" in identity:
            identity["dob"] = normalize_date(identity["dob"])
        if "gender" in identity and identity["gender"]:
            gender = str(identity["gender"]).strip()
            # Capitalize first letter
            identity["gender"] = gender.capitalize() if gender else ""

    # Normalize medical_profile (v2 schema)
    if "medical_profile" in data:
        profile = data["medical_profile"]

        # Capitalize systemic conditions
        if "systemic_conditions" in profile and isinstance(profile["systemic_conditions"], list):
            profile["systemic_conditions"] = [c.strip() for c in profile["systemic_conditions"] if c]

        # Capitalize medications_systemic
        if "medications_systemic" in profile and isinstance(profile["medications_systemic"], list):
            profile["medications_systemic"] = [m.strip() for m in profile["medications_systemic"] if m]

        # Capitalize allergies
        if "allergies" in profile and isinstance(profile["allergies"], list):
            profile["allergies"] = [a.strip() for a in profile["allergies"] if a]

    # Normalize clinical_context per-eye structure (v2 schema)
    if "clinical_context" in data:
        for eye_key in ["od_right", "os_left"]:
            if eye_key in data["clinical_context"]:
                eye_data = data["clinical_context"][eye_key]

                # Visual acuity - ensure strings (e.g., "20/40", "20/25")
                if "visual_acuity" in eye_data:
                    va = eye_data["visual_acuity"]
                    if "ucva" in va and va["ucva"]:
                        va["ucva"] = str(va["ucva"]).strip()
                    if "bcva" in va and va["bcva"]:
                        va["bcva"] = str(va["bcva"]).strip()

    # Normalize lifestyle_profile (v2 schema)
    if "lifestyle_profile" in data:
        lifestyle = data["lifestyle_profile"]

        # Capitalize hobbies
        if "hobbies" in lifestyle and isinstance(lifestyle["hobbies"], list):
            lifestyle["hobbies"] = [h.strip().capitalize() for h in lifestyle["hobbies"] if h]

        # Occupation - capitalize first letter
        if "occupation" in lifestyle and lifestyle["occupation"]:
            lifestyle["occupation"] = str(lifestyle["occupation"]).strip().capitalize()

    # Normalize surgical_plan dates (if present - added by doctor, not extraction)
    if "surgical_plan" in data:
        plan = data["surgical_plan"]

        # Normalize patient selection date
        if "patient_selection" in plan and "selection_date" in plan["patient_selection"]:
            plan["patient_selection"]["selection_date"] = normalize_date(plan["patient_selection"]["selection_date"])

        # Normalize operative logistics dates
        if "operative_logistics" in plan:
            for eye_key in ["od_right", "os_left"]:
                if eye_key in plan["operative_logistics"]:
                    logistics = plan["operative_logistics"][eye_key]
                    if "surgery_date" in logistics and logistics["surgery_date"]:
                        logistics["surgery_date"] = normalize_date(logistics["surgery_date"])

    return data
