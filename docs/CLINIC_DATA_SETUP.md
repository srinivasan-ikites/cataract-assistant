# Clinic Data Setup - Documentation

## Overview

This document describes the clinic data management system implemented for the cataract surgery platform. It covers the data schema, UI components, API endpoints, and data flow.

---

## 1. Data Schema

### Location
- **Base clinic configs:** `backend/data/clinic/{clinic_id}.json`
- **Reviewed/saved configs:** `backend/data/reviewed/{clinic_id}/reviewed_clinic.json`
- **Schema reference:** `backend/adk_app/schemas/clinic_schema.json`

### Schema Structure

```json
{
  "clinic_profile": {
    "clinic_id": "string",
    "name": "string",
    "parent_organization": "string",
    "address": { "street", "city", "state", "zip" },
    "contact_info": { "phone_main", "phone_surgical_coordinator", "fax", "emergency_hotline", "website" },
    "branding": { "logo_url", "primary_color_hex" }
  },
  
  "staff_directory": [
    {
      "provider_id": "string",
      "name": "string",
      "role": "string (Surgeon|Optometrist|Counselor)",
      "specialty": "string",
      "qualifications": ["string"],
      "experience_years": "number",
      "availability": {
        "surgery_days": ["Monday", "Wednesday", ...],
        "consultation_days": ["Tuesday", "Thursday", ...],
        "consultation_hours": "string (e.g., 9am-5pm ET)"
      }
    }
  ],
  
  "surgical_packages": [
    {
      "package_id": "string (e.g., PKG_STD, PKG_TORIC)",
      "display_name": "string",
      "description": "string",
      "price_cash": "number",
      "includes_laser": "boolean",
      "allowed_lens_codes": ["MONOFOCAL", "TORIC", ...],
      "fees_breakdown": { "physician_fee", "facility_fee", "total_estimated" },
      "insurance_coverage": "string"
    }
  ],
  
  "lens_inventory": {
    "MONOFOCAL": {
      "display_name": "string",
      "description": "string",
      "has_toric_variant": "boolean",
      "models": [
        { "manufacturer", "model", "model_code", "description" }
      ]
    },
    "MONOFOCAL_TORIC": { ... },
    "EDOF": { ... },
    "EDOF_TORIC": { ... },
    "MULTIFOCAL": { ... },
    "MULTIFOCAL_TORIC": { ... },
    "LAL": { ... }
  },
  
  "medications": {
    "pre_op": {
      "antibiotics": [{ "id", "name" }],
      "frequencies": [{ "id", "name", "times_per_day" }],
      "default_start_days_before_surgery": "number"
    },
    "post_op": {
      "antibiotics": [{ "id", "name", "default_frequency", "default_weeks" }],
      "nsaids": [{ "id", "name", "default_frequency", "frequency_label", "default_weeks" }],
      "steroids": [{ "id", "name", "default_taper", "default_weeks" }],
      "glaucoma_drops": [{ "id", "name", "category" }],
      "combination_drops": [{ "id", "name", "components" }],
      "dropless_option": {
        "available": "boolean",
        "description": "string",
        "medications": ["string"]
      }
    },
    "frequency_options": [{ "id", "label", "times_per_day" }]
  },
  
  "standard_operating_procedures": {
    "procedure_codes": [{ "code", "description" }],
    "risks_categorized": {
      "common_minor": ["string"],
      "rare_serious": ["string"]
    }
  },
  
  "billing_and_insurance": {
    "payment_policy": "string",
    "post_op_refraction_fee": { "amount", "description" },
    "anesthesia_billing": "string",
    "accepted_insurance_notes": "string",
    "payment_methods": ["string"],
    "financing": {
      "available": "boolean",
      "providers": ["string"],
      "zero_interest_months": "number",
      "minimum_amount": "number"
    }
  },
  
  "documents": {
    "standard_forms": [
      { "doc_id", "name", "required", "required_if" }
    ]
  },
  
  "metadata": {
    "schema_version": "string",
    "created_at": "date",
    "updated_at": "date",
    "updated_by": "string"
  }
}
```

---

## 2. UI Components

### Main Component
- **File:** `cataract-ui/doctor/ClinicSetup.tsx`
- **Purpose:** Counselor interface for managing clinic configuration

### Tabs Structure
| Tab | Content |
|-----|---------|
| Profile | Clinic identity, contact info, document upload |
| Staff | Staff directory with availability scheduling |
| Packages | Surgical packages with preset quick-add |
| Lens Inventory | IOL categories and models (accordion) |
| Medications | Pre-op, post-op, glaucoma, combination drops (accordion) |
| Billing | Payment policies, financing options |
| Documents | Standard forms configuration |

### Supporting Components
- `cataract-ui/components/Toast.tsx` - Notification system
- `cataract-ui/components/ConfirmationModal.tsx` - Save confirmation with validation

### Features Implemented
1. **Toast Notifications** - Bottom-right, slide-in animations
2. **Save Validation** - Shows missing fields before save
3. **Accordion Sections** - Collapsible for medications & lens inventory
4. **Preset Packages** - Quick-add common surgery packages
5. **Staff Availability** - Day picker for surgery/consultation days
6. **Auto-scroll** - New items scroll into view

---

## 3. API Endpoints

### Backend: `backend/adk_app/api/app.py`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/clinics/{clinic_id}` | GET | Get clinic config (checks reviewed first, then base) |
| `/clinics/{clinic_id}/medications` | GET | Get medications section only |
| `/clinics/{clinic_id}/packages` | GET | Get surgical packages only |
| `/clinics/{clinic_id}/lens-inventory/{lens_code}` | GET | Get specific lens category |
| `/doctor/reviewed/clinic?clinic_id=X` | GET | Get reviewed clinic data |
| `/doctor/review/clinic` | POST | Save reviewed clinic data |

### Frontend API: `cataract-ui/services/api.ts`

```typescript
api.getClinicConfig(clinicId)        // Get base config
api.getReviewedClinic(clinicId)      // Get reviewed/saved config
api.saveReviewedClinic(clinicId, data) // Save clinic config
api.getClinicMedications(clinicId)   // Get medications
api.getClinicPackages(clinicId)      // Get packages
api.getClinicLensInventory(clinicId, lensCode) // Get lens inventory
```

---

## 4. Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLINIC DATA FLOW                            │
└─────────────────────────────────────────────────────────────────┘

1. INITIAL LOAD
   ┌──────────────┐     ┌──────────────────────┐
   │ ClinicSetup  │────▶│ api.getReviewedClinic│
   │   (UI)       │     │     (API call)       │
   └──────────────┘     └──────────┬───────────┘
                                   │
                        ┌──────────▼───────────┐
                        │  Check reviewed/     │
                        │  {clinic_id}/        │
                        │  reviewed_clinic.json│
                        └──────────┬───────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │ EXISTS             │                    │ NOT FOUND
              ▼                    │                    ▼
   ┌──────────────────┐            │         ┌──────────────────┐
   │ Load reviewed    │            │         │ api.getClinicConfig│
   │ data             │            │         │ (base config)    │
   └──────────────────┘            │         └──────────────────┘
                                   │
                                   ▼
                        ┌──────────────────┐
                        │ Populate UI with │
                        │ clinic data      │
                        └──────────────────┘

2. SAVE FLOW
   ┌──────────────┐     ┌──────────────────────┐
   │ User clicks  │────▶│ validateClinicData() │
   │ "Save"       │     │ (check missing)      │
   └──────────────┘     └──────────┬───────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │ HAS MISSING        │                    │ ALL COMPLETE
              ▼                    │                    ▼
   ┌──────────────────┐            │         ┌──────────────────┐
   │ Show Confirmation│            │         │ api.saveReviewed │
   │ Modal            │            │         │ Clinic()         │
   └────────┬─────────┘            │         └──────────────────┘
            │                      │
            │ User confirms        │
            ▼                      │
   ┌──────────────────┐            │
   │ api.saveReviewed │◀───────────┘
   │ Clinic()         │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────────────────────────────┐
   │ POST /doctor/review/clinic               │
   │ Saves to: reviewed/{clinic_id}/          │
   │           reviewed_clinic.json           │
   └──────────────────────────────────────────┘
```

---

## 5. Lens Inventory Categories

| Code | Display Name | Has Toric |
|------|--------------|-----------|
| MONOFOCAL | Standard Monofocal | Yes |
| MONOFOCAL_TORIC | Monofocal Toric | - |
| EDOF | Extended Depth of Focus | Yes |
| EDOF_TORIC | EDOF Toric | - |
| MULTIFOCAL | Multifocal / Trifocal | Yes |
| MULTIFOCAL_TORIC | Multifocal Toric | - |
| LAL | Light Adjustable Lens | No |

---

## 6. Preset Surgical Packages

The UI provides quick-add buttons for these standard packages:

| ID | Name | Price | Laser |
|----|------|-------|-------|
| PKG_STD | Standard Monofocal | $0 | No |
| PKG_LASER_LRI | Laser with LRI | $1,900 | Yes |
| PKG_TORIC | Toric (Astigmatism) | $1,800 | No |
| PKG_TORIC_LASER | Toric + Laser | $2,000 | Yes |
| PKG_EDOF | EDOF (Extended Depth) | $500 | No |
| PKG_MULTIFOCAL | Multifocal / Presbyopic | $3,000 | No |
| PKG_LAL | Light Adjustable Lens | $4,900 | Yes |

---

## 7. Key Files Reference

| Purpose | File Path |
|---------|-----------|
| Main UI | `cataract-ui/doctor/ClinicSetup.tsx` |
| Toast Component | `cataract-ui/components/Toast.tsx` |
| Confirmation Modal | `cataract-ui/components/ConfirmationModal.tsx` |
| API Service | `cataract-ui/services/api.ts` |
| Backend API | `backend/adk_app/api/app.py` |
| Sample Clinic Data | `backend/data/clinic/VIC-MCLEAN-001.json` |
| Schema Reference | `backend/adk_app/schemas/clinic_schema.json` |

---

## 8. Future Enhancements (Planned)

1. **Document Extraction** - AI-powered extraction from uploaded PDFs
2. **Branding Section** - Logo upload and color customization in UI
3. **SOPs Section** - Procedure codes and risks management in UI
4. **Version History** - Track changes over time
5. **Multi-clinic Support** - Clinic selection/switching

---

## 9. Doctor Context API (Phase 3)

### New Endpoint: `/clinics/{clinic_id}/doctor-context`

This endpoint provides all clinic configuration needed for the Doctor's View in a **single API call**, replacing multiple granular endpoints and eliminating hardcoded medication data.

### Response Structure

```json
{
  "status": "ok",
  "clinic_id": "VIC-MCLEAN-001",
  "medications": {
    "pre_op": {
      "antibiotics": [{ "id": 1, "name": "Moxifloxacin (Vigamox)" }, ...],
      "frequencies": [{ "id": 1, "name": "4 times a day", "times_per_day": 4 }, ...],
      "default_start_days": 3
    },
    "post_op": {
      "antibiotics": ["Moxifloxacin", "Ciprofloxacin", ...],
      "nsaids": [{ "name": "Ketorolac", "defaultFrequency": 4, "label": "4x Daily" }, ...],
      "steroids": ["Prednisolone Acetate 1% (Pred Forte)", ...],
      "glaucoma_drops": ["Latanoprost (Xalatan)", ...],
      "combination_drops": ["Pred-Gati-Nep", ...]
    },
    "dropless_option": {
      "available": true,
      "description": "Intracameral injection at time of surgery",
      "medications": ["Tri-Moxi", "Dexycu"]
    },
    "frequency_options": [{ "id": 1, "label": "4x Daily", "times_per_day": 4 }, ...]
  },
  "staff": [
    { "provider_id": "DOC-BAVEJA", "name": "Gitanjali Baveja, MD", "role": "Surgeon" },
    ...
  ],
  "surgical_packages": [...],
  "lens_categories": ["MONOFOCAL", "EDOF", "MULTIFOCAL", "LAL"],
  "lens_inventory": {...}
}
```

### Frontend Integration

```typescript
// Load clinic context in PatientOnboarding.tsx
const [clinicContext, setClinicContext] = useState<DoctorContextResponse | null>(null);

useEffect(() => {
  const loadData = async () => {
    const [patientResult, contextResult] = await Promise.all([
      api.getReviewedPatient(clinicId, patientId),
      api.getDoctorContext(clinicId)
    ]);
    setClinicContext(contextResult);
    // ... handle patient data
  };
  loadData();
}, [clinicId, patientId]);

// Use clinic context for dropdowns
const getAntibioticOptions = () => clinicContext?.medications?.pre_op?.antibiotics || [];
const getPostOpSteroids = () => clinicContext?.medications?.post_op?.steroids || [];
```

### Benefits

1. **Single Network Call**: Reduces multiple API calls to one
2. **PostgreSQL Ready**: Maps to a single optimized query when migrating to database
3. **No Hardcoding**: All medication/staff data comes from clinic configuration
4. **Cacheable**: Response can be cached per clinic

---

## 10. Loader Component

A beautiful, reusable loader component is available at `cataract-ui/components/Loader.tsx`.

### Usage

```tsx
import Loader, { PageLoader, InlineLoader, ButtonLoader, Skeleton } from '../components/Loader';

// Page-level loader (for loading entire views)
<PageLoader context="clinic" />
<PageLoader context="patient" />

// Custom loader
<Loader 
  size="lg" 
  variant="medical" 
  message="Loading data" 
  subMessage="Please wait..."
/>

// Button loader (for buttons in loading state)
{saving ? <ButtonLoader /> : <Save size={16} />}

// Skeleton loaders for content placeholders
<Skeleton width="w-full" height="h-4" />
<CardSkeleton />
<FormSkeleton rows={4} />
```

### Variants

| Variant | Description |
|---------|-------------|
| `default` | Dual rotating rings with eye icon |
| `medical` | Pulsing background with spinning gradient |
| `minimal` | Three orbiting dots |
| `pulse` | Expanding rings effect |

---

*Last Updated: January 2026*
