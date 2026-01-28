"""
Clinic routes for clinic configuration and data.

Updated to use Supabase instead of JSON files.

Note: Basic clinic routes are public (Patient UI needs them).
The /doctor-context endpoint requires authentication.
"""
from fastapi import APIRouter, Depends, HTTPException

# Use Supabase data loader instead of JSON-based one
from adk_app.utils.supabase_data_loader import get_clinic_data
# Authentication middleware
from adk_app.api.middleware.auth import (
    AuthenticatedUser,
    require_clinic_user,
    validate_clinic_access,
)

router = APIRouter(prefix="/clinics", tags=["Clinics"])


def _get_clinic_with_reviewed(clinic_id: str) -> dict:
    """
    Get clinic data from Supabase.

    Previously read from JSON files, now fetches from database.
    """
    print(f"[Clinic API] Getting clinic data for: {clinic_id}")
    try:
        clinic = get_clinic_data(clinic_id)
        print(f"[Clinic API] Found clinic: {clinic.get('clinic_profile', {}).get('name')}")
        return clinic
    except ValueError as err:
        print(f"[Clinic API] Clinic not found: {err}")
        raise HTTPException(status_code=404, detail=str(err))


@router.get("/{clinic_id}")
def get_clinic(clinic_id: str) -> dict:
    """
    Return full details for a specific clinic.
    Priority: reviewed clinic data > base clinic data
    """
    return _get_clinic_with_reviewed(clinic_id)


@router.get("/{clinic_id}/medications")
def get_clinic_medications(clinic_id: str) -> dict:
    """Get medications configuration for a clinic."""
    clinic_data = _get_clinic_with_reviewed(clinic_id)
    medications = clinic_data.get("medications", {})
    return {"status": "ok", "medications": medications}


@router.get("/{clinic_id}/packages")
def get_clinic_packages(clinic_id: str) -> dict:
    """Get surgical packages for a clinic."""
    clinic_data = _get_clinic_with_reviewed(clinic_id)
    packages = clinic_data.get("surgical_packages", [])
    return {"status": "ok", "packages": packages}


@router.get("/{clinic_id}/lens-inventory")
def get_clinic_lens_inventory(clinic_id: str, category: str = None) -> dict:
    """
    Get lens inventory for a clinic.
    Optionally filter by category (e.g., MONOFOCAL, EDOF, MULTIFOCAL)
    """
    clinic_data = _get_clinic_with_reviewed(clinic_id)
    inventory = clinic_data.get("lens_inventory", {})

    if category:
        # Return specific category
        cat_data = inventory.get(category, {})
        return {"status": "ok", "category": category, "data": cat_data}

    return {"status": "ok", "lens_inventory": inventory}


@router.get("/{clinic_id}/doctor-context")
def get_doctor_context(
    clinic_id: str,
    user: AuthenticatedUser = Depends(require_clinic_user),  # AUTHENTICATION REQUIRED
) -> dict:
    """
    Get all clinic configuration needed for the Doctor's View in a single call.
    This provides medications, packages, staff, and lens inventory in one request,
    optimizing for frontend performance and making future PostgreSQL migration easier.

    Requires authentication. User can only access their own clinic's context.
    """
    # Validate clinic access - doctors can only access their own clinic's config
    validate_clinic_access(user, clinic_id)

    clinic_data = _get_clinic_with_reviewed(clinic_id)

    # Extract medications configuration
    raw_meds = clinic_data.get("medications", {})

    # Transform pre-op antibiotics to the format expected by frontend
    pre_op_antibiotics = []
    for i, ab in enumerate(raw_meds.get("pre_op", {}).get("antibiotics", [])):
        if isinstance(ab, dict):
            pre_op_antibiotics.append({
                "id": ab.get("id", i + 1),
                "name": ab.get("name", "")
            })
        elif isinstance(ab, str):
            pre_op_antibiotics.append({"id": i + 1, "name": ab})

    # Transform pre-op frequencies
    pre_op_frequencies = []
    for i, freq in enumerate(raw_meds.get("pre_op", {}).get("frequencies", [])):
        if isinstance(freq, dict):
            pre_op_frequencies.append({
                "id": freq.get("id", i + 1),
                "name": freq.get("name", ""),
                "times_per_day": freq.get("times_per_day", 4)
            })
        elif isinstance(freq, str):
            pre_op_frequencies.append({"id": i + 1, "name": freq, "times_per_day": 4})

    # Transform post-op antibiotics - preserve full object structure
    post_op_antibiotics = []
    for i, ab in enumerate(raw_meds.get("post_op", {}).get("antibiotics", [])):
        if isinstance(ab, dict):
            post_op_antibiotics.append({
                "id": ab.get("id", i + 1),
                "name": ab.get("name", ""),
                "default_frequency": ab.get("default_frequency", 4),
                "default_weeks": ab.get("default_weeks", 1),
                "allergy_note": ab.get("allergy_note", "")
            })
        elif isinstance(ab, str):
            post_op_antibiotics.append({
                "id": i + 1,
                "name": ab,
                "default_frequency": 4,
                "default_weeks": 1
            })

    # Transform NSAIDs with frequency info
    post_op_nsaids = []
    for i, nsaid in enumerate(raw_meds.get("post_op", {}).get("nsaids", [])):
        if isinstance(nsaid, dict):
            post_op_nsaids.append({
                "id": nsaid.get("id", i + 1),
                "name": nsaid.get("name", ""),
                "default_frequency": nsaid.get("default_frequency", 4),
                "frequency_label": nsaid.get("frequency_label", "4x Daily"),
                "default_weeks": nsaid.get("default_weeks", 4),
                "variable_frequency": nsaid.get("variable_frequency", False)
            })
        elif isinstance(nsaid, str):
            post_op_nsaids.append({
                "id": i + 1,
                "name": nsaid,
                "default_frequency": 4,
                "frequency_label": "4x Daily",
                "default_weeks": 4,
                "variable_frequency": False
            })

    # Transform steroids - preserve full object structure with taper info
    post_op_steroids = []
    for i, steroid in enumerate(raw_meds.get("post_op", {}).get("steroids", [])):
        if isinstance(steroid, dict):
            post_op_steroids.append({
                "id": steroid.get("id", i + 1),
                "name": steroid.get("name", ""),
                "default_taper": steroid.get("default_taper", [4, 3, 2, 1]),
                "default_weeks": steroid.get("default_weeks", 4)
            })
        elif isinstance(steroid, str):
            post_op_steroids.append({
                "id": i + 1,
                "name": steroid,
                "default_taper": [4, 3, 2, 1],
                "default_weeks": 4
            })

    # Transform glaucoma drops - preserve full object structure
    glaucoma_drops = []
    for i, drop in enumerate(raw_meds.get("post_op", {}).get("glaucoma_drops", [])):
        if isinstance(drop, dict):
            glaucoma_drops.append({
                "id": drop.get("id", i + 1),
                "name": drop.get("name", ""),
                "category": drop.get("category", "")
            })
        elif isinstance(drop, str):
            glaucoma_drops.append({
                "id": i + 1,
                "name": drop,
                "category": ""
            })

    # Transform combination drops - preserve full object structure
    combo_drops = []
    for i, combo in enumerate(raw_meds.get("post_op", {}).get("combination_drops", [])):
        if isinstance(combo, dict):
            combo_drops.append({
                "id": combo.get("id", i + 1),
                "name": combo.get("name", ""),
                "components": combo.get("components", [])
            })
        elif isinstance(combo, str):
            combo_drops.append({
                "id": i + 1,
                "name": combo,
                "components": []
            })

    # Dropless option
    dropless = raw_meds.get("post_op", {}).get("dropless_option", {})
    dropless_option = {
        "available": dropless.get("available", False),
        "description": dropless.get("description", ""),
        "medications": dropless.get("medications", [])
    }

    # Frequency options for general use
    frequency_options = []
    for i, opt in enumerate(raw_meds.get("frequency_options", [])):
        if isinstance(opt, dict):
            frequency_options.append({
                "id": opt.get("id", i + 1),
                "label": opt.get("label", ""),
                "times_per_day": opt.get("times_per_day", 4)
            })

    # Build medications response
    medications = {
        "pre_op": {
            "antibiotics": pre_op_antibiotics,
            "frequencies": pre_op_frequencies,
            "default_start_days": raw_meds.get("pre_op", {}).get("default_start_days_before_surgery", 3)
        },
        "post_op": {
            "antibiotics": post_op_antibiotics,
            "nsaids": post_op_nsaids,
            "steroids": post_op_steroids,
            "glaucoma_drops": glaucoma_drops,
            "combination_drops": combo_drops
        },
        "dropless_option": dropless_option,
        "frequency_options": frequency_options
    }

    # Extract staff directory
    staff = []
    for member in clinic_data.get("staff_directory", []):
        staff.append({
            "provider_id": member.get("provider_id", ""),
            "name": member.get("name", ""),
            "role": member.get("role", ""),
            "specialty": member.get("specialty", "")
        })

    # Extract surgical packages
    packages = []
    for pkg in clinic_data.get("surgical_packages", []):
        packages.append({
            "package_id": pkg.get("package_id", ""),
            "display_name": pkg.get("display_name", pkg.get("name", "")),
            "description": pkg.get("description", ""),
            "price_cash": pkg.get("price_cash", 0),
            "includes_laser": pkg.get("includes_laser", False),
            "allowed_lens_codes": pkg.get("allowed_lens_codes", [])
        })

    # Extract lens inventory categories
    lens_inventory = clinic_data.get("lens_inventory", {})
    lens_categories = list(lens_inventory.keys())

    return {
        "status": "ok",
        "clinic_id": clinic_id,
        "medications": medications,
        "staff": staff,
        "surgical_packages": packages,
        "lens_categories": lens_categories,
        "lens_inventory": lens_inventory
    }
