# Supabase Integration Documentation

## Overview

This document describes the migration from JSON file-based storage to Supabase (PostgreSQL) for the Cataract Counsellor application. The goal is to build a multi-tenant SaaS platform where multiple clinics can use the system independently.

**Date Started:** January 2026
**Current Status:** Phases 1-3 Complete, Phases 4-5 Pending

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
├─────────────────────┬───────────────────────────────────────────┤
│  Doctor Portal      │  Patient UI                               │
│  (localhost:5173)   │  (localhost:3000)                         │
│  - Login/Auth       │  - View education modules                 │
│  - Patient mgmt     │  - Chat with AI assistant                 │
│  - Data review      │  - (Future: OTP login)                    │
└─────────┬───────────┴───────────────────┬───────────────────────┘
          │                               │
          ▼                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (FastAPI)                            │
│                     localhost:8000                               │
├─────────────────────────────────────────────────────────────────┤
│  /api/auth/*     - Authentication (login, logout, me, refresh)  │
│  /patients/*     - Patient data CRUD                            │
│  /clinics/*      - Clinic configuration                         │
│  /doctor/*       - Upload, extraction, review                   │
│  /ask            - AI chat                                      │
│  /module-content - Education modules                            │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE                                    │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL Database:                                            │
│  - clinics          (clinic profiles)                           │
│  - clinic_config    (medications, packages, SOPs)               │
│  - user_profiles    (doctors, staff)                            │
│  - patients         (patient data + JSONB fields)               │
│  - patient_documents (file references)                          │
│                                                                  │
│  Auth:                                                           │
│  - auth.users       (managed by Supabase)                       │
│                                                                  │
│  Storage:                                                        │
│  - clinic-documents (uploaded files bucket)                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Foundation (Supabase Setup) ✅

### What Was Done
1. Created Supabase project and obtained credentials
2. Created database tables with proper relationships
3. Set up Row Level Security (RLS) policies
4. Created storage bucket for documents
5. Created Python Supabase client service

### Environment Variables (.env)
```
PROJECT_URL=https://your-project.supabase.co
ANON_PUBLIC_KEY=eyJ...
SERVICE_ROLE_KEY=eyJ...
```

### Database Schema

#### `clinics` table
```sql
CREATE TABLE clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id VARCHAR(50) UNIQUE NOT NULL,  -- Human-readable ID like "VIC-MCLEAN-001"
    name VARCHAR(255) NOT NULL,
    address JSONB DEFAULT '{}',
    contact JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `clinic_config` table
```sql
CREATE TABLE clinic_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    surgical_packages JSONB DEFAULT '[]',
    lens_inventory JSONB DEFAULT '{}',
    medications JSONB DEFAULT '{}',
    sops JSONB DEFAULT '{}',
    staff_directory JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `user_profiles` table
```sql
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES clinics(id),
    name VARCHAR(255),
    role VARCHAR(50) NOT NULL,  -- 'super_admin', 'clinic_admin', 'clinic_user'
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `patients` table
```sql
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    patient_id VARCHAR(50) NOT NULL,  -- Clinic's internal ID like "1245583"
    created_by UUID REFERENCES auth.users(id),
    assigned_doctor_id UUID REFERENCES auth.users(id),

    -- Identity
    first_name VARCHAR(100),
    middle_name VARCHAR(100),
    last_name VARCHAR(100),
    dob DATE,
    gender VARCHAR(20),
    contact JSONB DEFAULT '{}',

    -- Medical data (JSONB for flexibility)
    medical_profile JSONB DEFAULT '{}',
    clinical_context JSONB DEFAULT '{}',
    lifestyle_profile JSONB DEFAULT '{}',
    surgical_plan JSONB DEFAULT '{}',
    medications_plan JSONB DEFAULT '{}',

    -- AI-generated content
    module_content JSONB DEFAULT '{}',
    chat_history JSONB DEFAULT '[]',

    -- Status
    status VARCHAR(20) DEFAULT 'new',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(clinic_id, patient_id)
);
```

### Files Created

| File | Purpose |
|------|---------|
| `backend/adk_app/services/supabase_service.py` | Supabase client initialization and CRUD operations |
| `backend/adk_app/services/__init__.py` | Export supabase functions |

### Key Functions in `supabase_service.py`

```python
# Initialize on app startup
init_supabase_client()

# Get client instances
get_supabase_client()       # For client-side operations (respects RLS)
get_supabase_admin_client() # For server-side operations (bypasses RLS)

# SupabaseService class with CRUD methods
SupabaseService.get_clinic(clinic_id)
SupabaseService.get_patient(patient_id, clinic_id)
SupabaseService.create_patient(data)
SupabaseService.update_patient(patient_id, data)
# ... and more
```

---

## Phase 2: Clinic User Authentication ✅

### What Was Done
1. Created authentication API endpoints
2. Created auth middleware for protected routes
3. Created frontend login page and auth context
4. Integrated auth into Doctor Portal

### Authentication Flow

```
┌──────────┐    1. POST /api/auth/login     ┌──────────┐
│          │    {email, password}           │          │
│ Frontend │ ─────────────────────────────► │ Backend  │
│          │                                │          │
│          │ ◄───────────────────────────── │          │
│          │    {access_token,              │          │
│          │     refresh_token,             │          │
│          │     user: {...}}               │          │
└──────────┘                                └──────────┘
     │                                           │
     │ Store in localStorage                     │ Validate with
     │                                           │ Supabase Auth
     ▼                                           ▼
┌──────────┐                                ┌──────────┐
│ Browser  │                                │ Supabase │
│ Storage  │                                │ Auth     │
└──────────┘                                └──────────┘
```

### Token Lifecycle

1. **Access Token**: Short-lived (~1 hour), used for API requests
2. **Refresh Token**: Long-lived (~7 days), used to get new access token
3. **Auto-refresh**: When access token expires, frontend automatically uses refresh token

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/login` | POST | Authenticate with email/password |
| `/api/auth/logout` | POST | Sign out (clears server session) |
| `/api/auth/me` | GET | Get current user profile |
| `/api/auth/refresh` | POST | Refresh expired access token |

### Files Created/Modified

| File | Purpose |
|------|---------|
| `backend/adk_app/api/routes/auth.py` | Auth API endpoints |
| `backend/adk_app/api/middleware/auth.py` | Auth middleware dependencies |
| `cataract-ui/services/api.ts` | Added `authApi` and `authStorage` |
| `cataract-ui/contexts/AuthContext.tsx` | React context for auth state |
| `cataract-ui/doctor/LoginPage.tsx` | Login UI component |
| `cataract-ui/doctor/DoctorPortal.tsx` | Added auth wrapper |

### Auth Middleware Usage

```python
from adk_app.api.middleware.auth import require_clinic_user, require_clinic_admin

# Protect an endpoint - require any authenticated clinic user
@router.get("/patients")
async def list_patients(user: AuthenticatedUser = Depends(require_clinic_user)):
    # user.clinic_id is available here
    pass

# Require admin role
@router.post("/settings")
async def update_settings(user: AuthenticatedUser = Depends(require_clinic_admin)):
    pass
```

### Frontend Auth Usage

```typescript
// In any component
import { useAuth } from '../contexts/AuthContext';

const MyComponent = () => {
    const { user, isAuthenticated, login, logout } = useAuth();

    if (!isAuthenticated) {
        return <LoginPage />;
    }

    return <div>Welcome, {user.name}!</div>;
};
```

---

## Phase 3: Data Migration & API Updates ✅

### What Was Done
1. Created migration script to move JSON data to Supabase
2. Created new Supabase data loader (replaces JSON-based one)
3. Updated all API routes to use Supabase
4. Migrated existing clinic and patient data

### Migration Script

**Location:** `backend/scripts/migrate_to_supabase.py`

**Usage:**
```bash
cd backend
python scripts/migrate_to_supabase.py
```

**What it does:**
1. Reads from `backend/data/reviewed/{clinic_id}/` directory
2. Migrates `reviewed_clinic.json` → `clinics` + `clinic_config` tables
3. Migrates `{patient_id}/reviewed_patient.json` → `patients` table
4. Preserves all JSONB data (medical_profile, chat_history, etc.)

### Data Loader Replacement

**Old:** `backend/adk_app/utils/data_loader.py` (JSON files)
**New:** `backend/adk_app/utils/supabase_data_loader.py` (Supabase)

### Key Functions in `supabase_data_loader.py`

```python
# Patient functions
get_patient_data(patient_id, clinic_id=None)  # Get single patient
get_patient_by_uuid(patient_uuid)             # Get by database UUID
get_all_patients(clinic_id=None)              # List all patients
save_patient_chat_history(patient_id, user_msg, bot_msg, suggestions, blocks)
clear_patient_chat_history(patient_id)
save_patient_module_content(patient_id, module_title, content)
update_patient_data(patient_id, updates)

# Clinic functions
get_clinic_data(clinic_id)                    # Get clinic with config

# Cache (no-op for Supabase, kept for compatibility)
clear_patient_cache()
```

### Files Updated to Use Supabase

| File | Functions Changed |
|------|-------------------|
| `api/routes/patient.py` | `get_patient_data`, `get_all_patients`, `clear_patient_chat_history` |
| `api/routes/clinic.py` | `get_clinic_data` |
| `api/routes/doctor.py` | `get_patient_data`, `clear_patient_cache` |
| `api/routes/chat.py` | `get_patient_data`, `save_patient_chat_history` |
| `services/module_service.py` | `get_clinic_data`, `save_patient_module_content`, etc. |
| `orchestration/pipeline.py` | `get_patient_data`, `get_clinic_data` |
| `tools/context_tools.py` | `get_clinic_data`, `get_patient_data` |

### Data Transformation

The `_transform_patient_for_frontend()` function maps database columns to the frontend-expected format:

```python
# Database column → Frontend field
patient.first_name + patient.last_name → name: {first, last}
patient.medical_profile → medical_profile (JSONB, as-is)
patient.surgical_plan.recommendations_by_doctor → surgical_recommendations_by_doctor
patient.chat_history → chat_history (JSONB array)
patient.module_content → module_content (JSONB object)

# Metadata fields (prefixed with _)
patient.id → _uuid
patient.clinic_id → _clinic_uuid
```

---

## Current Data Flow

### Doctor Portal Flow

```
1. Doctor logs in
   └── POST /api/auth/login → Returns access_token + user info

2. Doctor Portal loads
   └── GET /api/auth/me → Validates token, returns user with clinic_id

3. Patient list loads
   └── GET /patients → Returns all patients for the clinic

4. Doctor clicks patient
   ├── GET /doctor/reviewed/patient?clinic_id=X&patient_id=Y
   └── GET /clinics/{clinic_id}/doctor-context → Medications, packages, etc.

5. Doctor saves patient data
   └── POST /doctor/review/patient → Saves to Supabase patients table
```

### Patient UI Flow

```
1. App loads (no auth yet)
   └── GET /patients → Returns all patients

2. Picks first patient
   └── GET /patients/{patient_id} → Full patient data

3. Patient asks question
   └── POST /ask → AI generates answer, saves to chat_history

4. Patient views module
   └── POST /module-content → Returns/generates education content
```

---

## Important Notes

### Clinic ID Types

There are TWO types of clinic identifiers:

| Type | Example | Used In |
|------|---------|---------|
| `clinic_id` (human-readable) | `"VIC-MCLEAN-001"` | API endpoints, frontend |
| `id` (UUID) | `"b3de6e8f-4988-..."` | Database foreign keys |

The auth endpoints return `clinic_id` (human-readable) to the frontend.

### JSONB Fields

Complex nested data is stored as JSONB in PostgreSQL:
- `medical_profile` - Allergies, conditions, medications
- `clinical_context` - Diagnosis, biometry, alerts
- `lifestyle_profile` - Occupation, hobbies, expectations
- `surgical_plan` - Doctor's recommendations
- `medications_plan` - Pre-op and post-op medications
- `module_content` - AI-generated education content
- `chat_history` - Conversation history with AI

### Row Level Security (RLS)

RLS policies ensure data isolation between clinics:
- Users can only see patients in their clinic
- Admin users have broader access
- Service role key bypasses RLS (used for migrations)

---

## Testing Endpoints

### Health Checks

```bash
# Check Supabase connection
curl http://localhost:8000/healthz/supabase

# Check auth (requires token)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/healthz/auth-test
```

### Auth Flow Test

```bash
# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "doctor@clinic.com", "password": "your-password"}'

# Get current user
curl http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer ACCESS_TOKEN"

# Refresh token
curl -X POST http://localhost:8000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "REFRESH_TOKEN"}'
```

---

## Phase 4: Multi-Tenancy (In Progress)

### 4.1 Clinic-Scoped API ✅

All doctor routes now require authentication and validate clinic access:
- Users can only access their own clinic's data
- Super admins can access any clinic
- Frontend sends JWT token with all protected requests

**Files Changed:**
- `middleware/auth.py` - Added `validate_clinic_access()`, `clinic_uuid`, `clinic_id` to `AuthenticatedUser`
- `routes/doctor.py` - All endpoints now require auth
- `routes/clinic.py` - `/doctor-context` requires auth
- `services/api.ts` - Added `authFetch()` helper

### 4.2 Clinic Management API ✅

Super admin endpoints for managing clinics:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/clinics` | GET | List all clinics |
| `/api/admin/clinics` | POST | Create new clinic |
| `/api/admin/clinics/{uuid}` | GET | Get clinic details |
| `/api/admin/clinics/{uuid}` | PUT | Update clinic |
| `/api/admin/clinics/{uuid}/stats` | GET | Get clinic statistics |
| `/api/admin/overview` | GET | Platform-wide stats |

**Testing Admin API (requires super_admin role):**
```bash
# List all clinics
curl -H "Authorization: Bearer TOKEN" http://localhost:8000/api/admin/clinics

# Create a new clinic
curl -X POST -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"clinic_id": "CLINIC-002", "name": "New Clinic"}' \
  http://localhost:8000/api/admin/clinics

# Get platform overview
curl -H "Authorization: Bearer TOKEN" http://localhost:8000/api/admin/overview
```

### 4.3-4.6 (Pending)
- [ ] User Management API (invite users, assign roles)
- [ ] Frontend - Clinic Settings page
- [ ] Frontend - User Management page
- [ ] New Clinic Registration flow (self-service)

---

## Phase 5: Patient Authentication (Pending)

- [ ] OTP-based login for patients
- [ ] Patient can only see their own data
- [ ] SMS/Email OTP delivery
- [ ] Patient session management

---

## Troubleshooting

### Common Issues

**1. "Clinic not found" errors**
- Check if using UUID instead of human-readable clinic_id
- Verify clinic exists in `clinics` table

**2. "Token expired" after login**
- Clear localStorage and log in again
- Check if refresh token flow is working

**3. Patient data not loading**
- Check browser console for API errors
- Verify patient exists in Supabase `patients` table
- Check the `clinic_id` foreign key is correct

### Debug Logging

The backend includes print statements for debugging:
```
[Auth /me] Received authorization header: Bearer eyJ...
[Auth /me] Token valid for user: doctor@clinic.com
[SupabaseDataLoader] Getting patient data for: 1245583
[SupabaseDataLoader] Found patient: Robert Thompson
```

---

## File Structure Summary

```
backend/
├── adk_app/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── auth.py          # Auth endpoints
│   │   │   ├── patient.py       # Patient CRUD
│   │   │   ├── clinic.py        # Clinic data
│   │   │   ├── doctor.py        # Upload/review
│   │   │   └── chat.py          # AI chat
│   │   └── middleware/
│   │       └── auth.py          # Auth dependencies
│   ├── services/
│   │   └── supabase_service.py  # Supabase client
│   └── utils/
│       └── supabase_data_loader.py  # Data access layer
├── scripts/
│   └── migrate_to_supabase.py   # Migration script
└── .env                          # Supabase credentials

cataract-ui/
├── contexts/
│   └── AuthContext.tsx          # Auth state management
├── doctor/
│   ├── DoctorPortal.tsx         # Main doctor app
│   └── LoginPage.tsx            # Login form
└── services/
    └── api.ts                   # API client + auth helpers
```
