# Cataract Counsellor - Complete System Documentation

> **Purpose**: This document contains everything needed to understand the codebase. Read this first before exploring any files.

---

## 1. Project Overview

### What This Project Does
A **multi-tenant SaaS platform** for cataract surgery patient education and counselling. It bridges the gap between patients and doctors by:
- Reducing repetitive explanations by doctors
- Providing patients 24/7 access to personalized information via a chatbot
- Managing patient data extraction from EMR documents

### The Three Portals

| Portal | URL | Users | Purpose |
|--------|-----|-------|---------|
| **Admin Portal** | `/admin` | Super admins | Approve/reject clinic registrations, platform management |
| **Doctor Portal** | `/doctor/:clinicId` | Doctors, staff | Manage patients, upload docs, review extracted data, configure clinic |
| **Patient Portal** | `/patient/:clinicId` | Patients | View 9 education modules, use AI chatbot |

### Tech Stack
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Backend**: Python 3 + FastAPI
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Storage**: Supabase Storage (patient documents bucket)
- **Vector DB**: Qdrant (for RAG knowledge base)
- **AI/LLM**: Google Gemini (extraction, chat, module generation)

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React)                                │
│                              localhost:3000                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  /admin          → AdminDashboard.tsx     (super admin clinic management)   │
│  /doctor/:id     → DoctorPortal.tsx       (patient list, onboarding)        │
│  /patient/:id    → App.tsx + modals       (9 modules + chatbot)             │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ HTTP/REST
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (FastAPI)                               │
│                              localhost:8000                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  /api/auth/*           → Clinic user login (Supabase JWT)                   │
│  /api/patient/auth/*   → Patient OTP login (custom JWT)                     │
│  /api/admin/*          → Super admin operations                             │
│  /patients/*           → Patient CRUD                                       │
│  /doctor/*             → Document upload, extraction, review                │
│  /clinics/*            → Clinic data and configuration                      │
│  /ask                  → RAG-based chat                                     │
│  /module-content       → Education module generation                        │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │  Supabase   │ │   Qdrant    │ │   Gemini    │
            │  (Postgres) │ │ (Vector DB) │ │    (LLM)    │
            └─────────────┘ └─────────────┘ └─────────────┘
```

---

## 3. Database Schema (Supabase)

### 3.1 `clinics` table
Stores clinic profile and status.

```sql
id (UUID PK)              -- Database primary key
clinic_id (TEXT UNIQUE)   -- Human-readable ID: "vision-forever", "mclean-eye-clinic"
name (TEXT)               -- Display name: "Vision Forever Eye Clinic"
address (JSONB)           -- {street, city, state, zip}
contact (JSONB)           -- {phone, email, website}
settings (JSONB)          -- {branding: {logo_url, primary_color}, timezone}
status (TEXT)             -- 'pending' | 'active' | 'suspended' | 'deleted'
created_at (TIMESTAMPTZ)
updated_at (TIMESTAMPTZ)
deleted_at (TIMESTAMPTZ)  -- For soft delete
```

**Status Flow**: `pending` → (admin approves) → `active` → (admin suspends) → `suspended`

### 3.2 `clinic_config` table
Stores clinic configuration (medications, packages, lenses, staff).

```sql
id (UUID PK)
clinic_id (UUID FK)           -- References clinics.id
surgical_packages (JSONB)     -- Array of packages
lens_inventory (JSONB)        -- Nested by category: {MONOFOCAL: {...}, TORIC: {...}}
medications (JSONB)           -- {pre_op: {...}, post_op: {...}, dropless_option: {...}}
staff_directory (JSONB)       -- Array of staff members
sops (JSONB)                  -- Standard operating procedures
updated_at (TIMESTAMPTZ)
```

**Example surgical_packages**:
```json
[{
  "package_id": "standard",
  "display_name": "Standard Package",
  "price_cash": 3500,
  "includes_laser": false,
  "allowed_lens_codes": ["MONO_STANDARD"]
}]
```

### 3.3 `user_profiles` table
Links Supabase auth.users to app-specific data.

```sql
id (UUID PK)              -- Same as auth.users.id (FK)
clinic_id (UUID FK)       -- References clinics.id (NULL for super_admin)
name (TEXT)
email (TEXT)
phone (TEXT)
role (TEXT)               -- 'super_admin' | 'clinic_admin' | 'clinic_user'
status (TEXT)             -- 'active' | 'invited' | 'suspended'
specialization (TEXT)     -- For doctors: "Cataract Surgeon"
created_at (TIMESTAMPTZ)
updated_at (TIMESTAMPTZ)
```

**Role Permissions**:
- `super_admin`: Platform-wide access, approves clinics, no clinic_id
- `clinic_admin`: Full clinic access, can invite users
- `clinic_user`: Can manage patients, upload docs, use all features except user management

### 3.4 `patients` table
Core patient data with JSONB fields for flexibility.

```sql
id (UUID PK)
clinic_id (UUID FK)           -- References clinics.id
patient_id (TEXT)             -- Auto-generated per clinic: "001", "002"
phone (TEXT)                  -- Required for OTP login (10 digits)
first_name (TEXT)
last_name (TEXT)
dob (DATE)
gender (TEXT)
email (TEXT)

-- Flexible JSONB fields
medical_profile (JSONB)       -- Ocular history, systemic conditions, allergies
clinical_context (JSONB)      -- Per-eye data (od_right, os_left), biometry, diagnosis
lifestyle_profile (JSONB)     -- Hobbies, visual priorities
surgical_plan (JSONB)         -- Candidacy, offered packages, operative logistics
medications_plan (JSONB)      -- Pre-op and post-op medications with progress tracking
module_content (JSONB)        -- Cached AI-generated education content
chat_history (JSONB)          -- Array of {role, text, timestamp, suggestions}

status (TEXT)                 -- 'pending'|'extracted'|'reviewed'|'scheduled'|'completed'|'archived'
created_at (TIMESTAMPTZ)
updated_at (TIMESTAMPTZ)

UNIQUE(clinic_id, patient_id)
```

**Patient Status Flow**:
```
pending → (doctor uploads docs) → extracted → (doctor reviews & saves) → reviewed → scheduled → completed → archived
```

**IMPORTANT**: Patient can only access portal when status = 'reviewed' or later.

### 3.5 `otp_requests` table
Stores OTP codes for patient login.

```sql
id (UUID PK)
phone (TEXT)              -- Patient's phone number
otp_code (TEXT)           -- 6-digit code
patient_id (UUID FK)      -- References patients.id
expires_at (TIMESTAMPTZ)  -- 5 minutes from creation
verified (BOOLEAN)        -- Set to true after successful verification
attempts (INTEGER)        -- Tracks failed attempts (max 3)
created_at (TIMESTAMPTZ)
```

### 3.6 `patient_documents` table
Tracks uploaded files.

```sql
id (UUID PK)
patient_id (UUID FK)
file_name (TEXT)
file_path (TEXT)          -- Storage path: clinics/{clinic_id}/patients/{patient_id}/{filename}
file_type (TEXT)          -- 'emr', 'biometry', 'consent', 'other'
file_size (INTEGER)
mime_type (TEXT)
extracted_data (JSONB)    -- Raw extraction output from Gemini Vision
extraction_status (TEXT)  -- 'pending' | 'processing' | 'completed' | 'failed'
uploaded_by (UUID FK)
created_at (TIMESTAMPTZ)
```

---

## 4. Authentication Flows

### 4.1 Clinic User Authentication (Email/Password + Supabase JWT)

**Login Flow**:
```
1. Frontend: POST /api/auth/login {email, password}

2. Backend (auth.py):
   - Calls Supabase: client.auth.sign_in_with_password(email, password)
   - Supabase validates credentials against auth.users table
   - Returns access_token (1 hour) + refresh_token (7 days)
   - Backend fetches user_profile with clinic data
   - Returns: {access_token, refresh_token, user: {id, email, name, role, clinic_id, clinic_name}}

3. Frontend:
   - Stores in localStorage: cataract_access_token, cataract_refresh_token, cataract_user
   - All subsequent API calls use: Authorization: Bearer <access_token>
```

**Token Validation (on every protected request)**:
```
1. Middleware extracts token from Authorization header
2. Validates with Supabase: client.auth.get_user(token)
3. Fetches user_profile with joined clinic data
4. Checks: user.status == 'active' AND clinic.status == 'active'
5. Returns AuthenticatedUser to route handler
```

**Token Refresh**:
```
- Frontend authFetch() detects 401 response
- Calls POST /api/auth/refresh with refresh_token
- Gets new access_token
- Retries original request
- If refresh fails: clears localStorage, dispatches 'auth-session-expired' event
```

**Key Files**:
- Backend: `backend/adk_app/api/routes/auth.py`
- Middleware: `backend/adk_app/api/middleware/auth.py`
- Frontend: `cataract-ui/services/api.ts` (authApi, authStorage, authFetch)
- Context: `cataract-ui/contexts/AuthContext.tsx`

### 4.2 Patient Authentication (Phone OTP + Custom JWT)

**Request OTP Flow**:
```
1. Frontend: POST /api/patient/auth/request-otp {phone: "1234567890", clinic_id: "vision-forever"}

2. Backend (patient_auth.py):
   - Validates phone (must be 10 digits)
   - Looks up clinic by clinic_id → gets clinic UUID
   - Checks clinic.status == 'active'
   - Finds patient by phone + clinic_uuid in patients table
   - Checks rate limit: max 3 OTPs in 10 minutes
   - Generates 6-digit OTP
   - Stores in otp_requests table with 5-minute expiration
   - In DEV_MODE: returns OTP in response for testing
   - Returns: {message, phone, expires_in_seconds, dev_otp?}
```

**Verify OTP Flow**:
```
1. Frontend: POST /api/patient/auth/verify-otp {phone, otp, clinic_id}

2. Backend:
   - Finds latest unverified, non-expired OTP for this phone
   - Checks attempts < 3
   - If OTP wrong: increments attempts, returns error with remaining attempts
   - If OTP correct:
     - Marks OTP as verified
     - Creates JWT (7-day expiry): {sub: patient_uuid, patient_id, clinic_id, type: "patient"}
     - Returns: {access_token, expires_in_days: 7, patient: {id, patient_id, name, clinic_id}}

3. Frontend:
   - Stores in localStorage: cataract_patient_token, cataract_patient_data
   - Uses token for: GET /api/patient/auth/me/data
```

**DEV_MODE Testing**:
- When `DEV_MODE=true` in backend .env
- OTP is returned in the request-otp response as `dev_otp`
- Frontend shows toast with OTP for easy testing

**Key Files**:
- Backend: `backend/adk_app/api/routes/patient_auth.py`
- Frontend: `cataract-ui/services/api.ts` (patientAuthApi, patientAuthStorage)
- Login UI: `cataract-ui/patient/PatientLogin.tsx`

---

## 5. Core User Flows

### 5.1 Admin Approves Clinic

```
1. New clinic registers via /doctor/register (ClinicRegistration.tsx)
   - POST /api/auth/register-clinic
   - Creates clinic (status='pending') + user_profile (status='active', role='clinic_admin')

2. Super admin logs in to /admin (AdminDashboard.tsx)
   - GET /api/admin/clinics?status_filter=pending

3. Admin reviews and approves
   - PUT /api/admin/clinics/{clinic_uuid} {status: 'active'}

4. Clinic admin can now log in and access their clinic
```

### 5.2 Doctor Onboards Patient

```
1. Doctor logs in to /doctor/:clinicId
   - GET /patients?clinic_id=xxx → shows patient list

2. Doctor registers new patient (RegisterPatientModal.tsx)
   - POST /patients {clinic_id, first_name, last_name, phone}
   - Auto-generates patient_id: "001", "002", etc.

3. Doctor opens patient → uploads documents (UploadPanel.tsx)
   - POST /doctor/uploads/patient (multipart form with files)
   - Files stored in Supabase Storage: clinics/{clinic_id}/patients/{patient_id}/
   - Gemini Vision extracts data from documents

4. Doctor reviews extracted data (PatientOnboarding.tsx)
   - GET /doctor/extractions/patient?clinic_id=x&patient_id=y
   - Doctor verifies/corrects data in form

5. Doctor saves reviewed data
   - POST /doctor/review/patient {clinic_id, patient_id, data}
   - Updates patients table with all JSONB fields
   - Sets status='reviewed' → Patient can now access portal
```

### 5.3 Patient Uses Portal

```
1. Patient receives link from clinic: /patient/vision-forever/login

2. Patient enters phone number
   - POST /api/patient/auth/request-otp {phone, clinic_id}
   - (In DEV: OTP shown on screen)

3. Patient enters OTP
   - POST /api/patient/auth/verify-otp {phone, otp, clinic_id}
   - Gets JWT token, stored in localStorage

4. Patient lands on portal (App.tsx)
   - GET /api/patient/auth/me/data → loads full patient data
   - Fire-and-forget: POST /pregenerate-modules (generates "My Diagnosis")

5. Patient views 9 education modules:
   - My Diagnosis (LLM-generated, personalized)
   - What is Cataract Surgery? (static)
   - What is an IOL? (static)
   - My IOL Options (from surgical_plan.offered_packages)
   - Risks & Complications (static)
   - Before Surgery (medication checklist with progress tracking)
   - Day of Surgery (static)
   - After Surgery (post-op medication tracking)
   - Costs & Insurance (from clinic packages)

6. Patient uses chatbot (FAQOverlay.tsx)
   - POST /ask {patient_id, question, clinic_id}
   - RAG pipeline retrieves context and generates answer
   - Chat history saved to patient.chat_history
```

---

## 6. RAG Pipeline (Chat)

**File**: `backend/adk_app/orchestration/pipeline.py`

```
User Question
     │
     ▼
┌─────────────────────────────────────────┐
│      PARALLEL EXECUTION (ThreadPool)     │
├──────────────────┬──────────────────────┤
│  Router LLM      │  Query Embedding     │
│  (classifies     │  (Gemini embeddings) │
│   question)      │                      │
└────────┬─────────┴──────────┬───────────┘
         │                    │
         ▼                    ▼
┌─────────────────────────────────────────┐
│           CONTEXT RETRIEVAL              │
├─────────────────────────────────────────┤
│ Router decides what context is needed:   │
│ - general: Search Qdrant KB              │
│ - clinic: Fetch clinic config            │
│ - patient: Fetch patient data            │
│ - mixed: Combination                     │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│           PROMPT BUILDING                │
│  Combines: question + context + history  │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│           MAIN LLM (Gemini)              │
│  Generates answer with structured output │
│  {answer, blocks[], suggestions[]}       │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│         SAVE TO CHAT HISTORY             │
│  Appends to patient.chat_history JSONB   │
└─────────────────────────────────────────┘
```

**Knowledge Base** (Qdrant):
- Collection: `cataract_general_kb`
- Contains: AAO articles, Q&A content about cataracts
- Ingestion: See `backend/ingestion/` scripts

---

## 7. Key Backend Files

### API Routes (`backend/adk_app/api/routes/`)

| File | Prefix | Purpose |
|------|--------|---------|
| `auth.py` | `/api/auth` | Clinic user login/logout/refresh, clinic registration |
| `patient_auth.py` | `/api/patient/auth` | Patient OTP login, get patient data |
| `admin.py` | `/api/admin` | Super admin: list/approve/suspend clinics |
| `patient.py` | `/patients` | Patient CRUD, chat history clear |
| `doctor.py` | `/doctor` | Upload docs, extraction, save reviewed data |
| `clinic.py` | `/clinics` | Get clinic config, medications, packages |
| `chat.py` | `/ask`, `/module-content` | RAG chat, module generation |
| `users.py` | `/api/users` | Clinic user management (invite, update, deactivate) |
| `dashboard.py` | `/dashboard` | Clinic dashboard statistics |
| `health.py` | `/healthz` | Health checks |

### Services (`backend/adk_app/services/`)

| File | Purpose |
|------|---------|
| `supabase_service.py` | Supabase client (regular + admin), CRUD operations |
| `chat_service.py` | Answer generation, follow-up suggestions |
| `extraction_service.py` | Gemini Vision document extraction |
| `embedding_service.py` | Query embeddings for RAG |
| `qdrant_service.py` | Vector DB search |
| `module_service.py` | Module content generation |

### Data Layer (`backend/adk_app/utils/`)

| File | Purpose |
|------|---------|
| `supabase_data_loader.py` | High-level patient/clinic data operations |

### Key Functions in `supabase_data_loader.py`:
```python
# Patient operations
get_patient_data(patient_id, clinic_id)      # Get patient by clinic's patient_id
get_patient_by_uuid(patient_uuid)            # Get patient by database UUID
get_all_patients(clinic_id)                  # List all patients for clinic
create_patient(clinic_uuid, first_name, ...) # Create new patient
update_patient_from_reviewed(clinic_id, patient_id, data)  # Save reviewed data

# Chat & modules
save_patient_chat_history(patient_id, user_msg, bot_msg, suggestions, blocks, clinic_id)
save_patient_module_content(patient_id, module_title, content, clinic_id)
clear_patient_chat_history(patient_id, clinic_id)

# Clinic operations
get_clinic_data(clinic_id)                   # Get clinic with config
update_clinic_from_reviewed(clinic_id, data) # Save clinic configuration
```

### Middleware (`backend/adk_app/api/middleware/auth.py`)

```python
# Dependencies for route protection
get_current_user(credentials)        # Validates JWT, returns AuthenticatedUser
require_clinic_user(user)            # Ensures clinic_admin or clinic_user role
require_clinic_admin(user)           # Ensures clinic_admin role
require_super_admin(user)            # Ensures super_admin role
validate_clinic_access(user, clinic_id)  # Ensures user can access specific clinic

# AuthenticatedUser dataclass contains:
# id, email, name, role, status, clinic_uuid, clinic_id, clinic_name, clinic_status
```

---

## 8. Key Frontend Files

### Main Structure (`cataract-ui/`)

```
cataract-ui/
├── App.tsx                    # Main app with routing
├── services/
│   └── api.ts                 # ALL API calls, auth storage, types
├── contexts/
│   └── AuthContext.tsx        # Clinic user auth state
├── doctor/
│   ├── DoctorPortal.tsx       # Main doctor dashboard
│   ├── LoginPage.tsx          # Clinic user login
│   ├── ClinicRegistration.tsx # Self-service clinic signup
│   ├── PatientList.tsx        # Patient table
│   ├── PatientOnboarding.tsx  # Patient data form (extraction review)
│   ├── ClinicSetup.tsx        # Clinic configuration (meds, packages, staff)
│   ├── AdminDashboard.tsx     # Super admin clinic management
│   └── UserManagement.tsx     # Clinic user invite/manage
├── patient/
│   ├── PatientLogin.tsx       # OTP login page
│   └── ClinicSelector.tsx     # Multi-clinic selection
├── components/
│   ├── FAQOverlay.tsx         # Chatbot interface
│   ├── Cube3D.tsx             # 3D module cards
│   ├── DiagnosisModal.tsx     # "My Diagnosis" module
│   ├── BeforeSurgeryModal.tsx # Pre-op medication tracking
│   ├── AfterSurgeryModal.tsx  # Post-op medication tracking
│   ├── IOLOptionsModal.tsx    # Patient's IOL options
│   └── [other modals]         # Surgery, IOL, Risks, etc.
└── types/
    └── index.ts               # TypeScript interfaces
```

### API Service (`cataract-ui/services/api.ts`)

**Auth Storage**:
```typescript
// Clinic users
authStorage.getAccessToken()
authStorage.setTokens(access, refresh, user)
authStorage.clearTokens()

// Patients
patientAuthStorage.getToken()
patientAuthStorage.setAuth(token, patient)
patientAuthStorage.clearAuth()
```

**Key API Functions**:
```typescript
// Auth
authApi.login(email, password)
authApi.logout()
authApi.getCurrentUser()
authApi.refreshToken()

// Patient auth
patientAuthApi.requestOTP(phone, clinicId)
patientAuthApi.verifyOTP(phone, otp, clinicId)
patientAuthApi.getMyData()
patientAuthApi.updateMedicationProgress(type, progress)

// Data operations
api.getPatients(clinicId)
api.createPatient(data)
api.getPatientDetails(id)
api.uploadPatientDocs(clinicId, patientId, files)
api.saveReviewedPatient(clinicId, patientId, data)
api.getDoctorContext(clinicId)  // medications, packages, staff

// Chat
api.askAgent(patientId, question, clinicId)
api.pregenerateModules(patientId, clinicId)

// Admin
adminApi.getClinics(statusFilter)
adminApi.updateClinic(clinicUuid, {status: 'active'})
```

---

## 9. The 9 Patient Education Modules

| # | Module | Source | Notes |
|---|--------|--------|-------|
| 1 | My Diagnosis | LLM-generated | Personalized based on clinical_context |
| 2 | What is Cataract Surgery? | Static | `SurgeryModal.tsx` |
| 3 | What is an IOL? | Static | `IOLModal.tsx` |
| 4 | My IOL Options | Patient data | From `surgical_plan.offered_packages` |
| 5 | Risks & Complications | Static | `RiskComplicationsModal.tsx` |
| 6 | Before Surgery | Patient data | Pre-op medications with progress tracking |
| 7 | Day of Surgery | Static | Timeline and expectations |
| 8 | After Surgery | Patient data | Post-op medications with progress tracking |
| 9 | Costs & Insurance | Clinic data | From `clinic_config.surgical_packages` |

**Module Content Storage**:
- LLM-generated content cached in `patient.module_content["My Diagnosis"]`
- Regenerated when diagnosis changes (detected by `has_diagnosis_changed()`)

---

## 10. Environment Variables

### Backend (`backend/.env`)

```bash
# Supabase
PROJECT_URL=https://xxxxx.supabase.co
ANON_PUBLIC_KEY=eyJ...            # For RLS-enforced operations
SERVICE_ROLE_KEY=eyJ...           # For admin operations (bypasses RLS)

# LLM
MODEL_PROVIDER=gemini             # or openai, claude
MODEL_NAME=gemini-1.5-flash
MODEL_TEMPERATURE=0.2
VISION_MODEL=gemini-1.5-flash     # For document extraction

# Vector DB
QDRANT_URL=https://xxx.qdrant.io
QDRANT_API_KEY=xxx

# Dev mode
DEV_MODE=true                     # Returns OTP in response for testing

# JWT (for patient auth)
JWT_SECRET=your-secret-key
```

### Frontend
API base URL configured in `cataract-ui/services/api.ts`:
```typescript
const API_BASE = 'http://localhost:8000';  // Development
// const API_BASE = 'https://cataract-assistant.ikites.ai/api';  // Production
```

---

## 11. Data Transformation

### Patient: Database → Frontend

The `_transform_patient_for_frontend()` function in `supabase_data_loader.py` maps:

```python
# Database columns → Frontend structure
patient.first_name + patient.last_name → name: {first, last}
patient.medical_profile (JSONB)        → medical_profile (as-is)
patient.clinical_context (JSONB)       → clinical_context (as-is)
patient.surgical_plan (JSONB)          → surgical_plan (as-is)
patient.medications_plan (JSONB)       → medications (as-is)
patient.module_content (JSONB)         → module_content (as-is)
patient.chat_history (JSONB)           → chat_history (as-is)

# Metadata (for internal use)
patient.id                             → _uuid
patient.clinic_id                      → _clinic_uuid
```

### Clinic: Database → Frontend

```python
# clinics table + clinic_config table → combined structure
clinic.clinic_id                       → clinic_profile.clinic_id
clinic.name                            → clinic_profile.name
clinic.address                         → clinic_profile.address
clinic_config.staff_directory          → staff_directory
clinic_config.surgical_packages        → surgical_packages
clinic_config.lens_inventory           → lens_inventory
clinic_config.medications              → medications
```

---

## 12. Common Patterns

### Clinic ID vs Clinic UUID
- `clinic_id`: Human-readable string like `"vision-forever"` - used in URLs, API params
- `clinic_uuid`: Database UUID - used for foreign keys, internal operations
- Always look up UUID from clinic_id before database operations

### Patient ID vs Patient UUID
- `patient_id`: Clinic's internal ID like `"001"` - auto-generated per clinic
- `patient_uuid`: Database UUID - used for joins, foreign keys
- Combination of `(clinic_id, patient_id)` is unique

### Auth Token Types
- **Clinic user token**: Supabase JWT (validated via `client.auth.get_user()`)
- **Patient token**: Custom JWT (validated via `jwt.decode()` with JWT_SECRET)
- Different storage keys: `cataract_access_token` vs `cataract_patient_token`

---

## 13. Testing Credentials

```
# Super Admin
Email: admin@cataract.com
Password: admin123

# Test Clinic (after registration)
Check README.md for current test credentials
```

---

## 14. Quick Reference: API Endpoints

### Public (No Auth)
```
POST /api/auth/login                    # Clinic user login
POST /api/auth/register-clinic          # Self-service clinic registration
POST /api/patient/auth/request-otp      # Request patient OTP
POST /api/patient/auth/verify-otp       # Verify patient OTP
GET  /clinics                           # List active clinics (for patient portal)
GET  /clinics/{clinic_id}               # Get clinic public info
```

### Clinic User Auth Required
```
GET  /api/auth/me                       # Get current user
POST /api/auth/logout                   # Logout
POST /api/auth/refresh                  # Refresh token

GET  /patients?clinic_id=xxx            # List patients
POST /patients                          # Create patient
GET  /patients/{id}                     # Get patient details

POST /doctor/uploads/patient            # Upload docs + extract
GET  /doctor/extractions/patient        # Get extracted data
POST /doctor/review/patient             # Save reviewed data
GET  /doctor/reviewed/patient           # Get saved data

GET  /clinics/{id}/doctor-context       # All clinic config
POST /doctor/review/clinic              # Save clinic config

GET  /api/users                         # List clinic users
POST /api/users                         # Invite user
PUT  /api/users/{id}                    # Update user
DELETE /api/users/{id}                  # Deactivate user
```

### Patient Auth Required
```
GET  /api/patient/auth/me               # Get patient profile
GET  /api/patient/auth/me/data          # Get full patient data
PUT  /api/patient/auth/me/medications   # Update medication progress
```

### Super Admin Auth Required
```
GET  /api/admin/clinics                 # List all clinics
GET  /api/admin/clinics/{uuid}          # Get clinic details
PUT  /api/admin/clinics/{uuid}          # Update clinic (approve/suspend)
GET  /api/admin/clinics/{uuid}/stats    # Get clinic statistics
GET  /api/admin/overview                # Platform overview
```

### No Auth (patient_id in body)
```
POST /ask                               # Chat with AI
POST /module-content                    # Get/generate module content
POST /pregenerate-modules               # Fire-and-forget module generation
```

---

## 15. Troubleshooting

### "Clinic not found" errors
- Check if using UUID instead of human-readable clinic_id
- Verify clinic exists and status is 'active'

### "Token expired" after login
- Frontend should auto-refresh via authFetch()
- If refresh fails, user is logged out
- Check refresh_token in localStorage

### Patient can't access portal
- Check patient.status is 'reviewed' or later
- Check clinic.status is 'active'
- Verify phone number matches exactly (10 digits)

### OTP not working
- Check DEV_MODE=true in backend .env
- Look for OTP in API response (dev_otp field)
- Check rate limiting (max 3 OTPs in 10 minutes)
- Verify phone exists in patients table for that clinic

---

## 16. File Locations Quick Reference

```
Backend Entry:     backend/adk_app/api/main.py
Auth Routes:       backend/adk_app/api/routes/auth.py
Patient Auth:      backend/adk_app/api/routes/patient_auth.py
Auth Middleware:   backend/adk_app/api/middleware/auth.py
Supabase Client:   backend/adk_app/services/supabase_service.py
Data Loader:       backend/adk_app/utils/supabase_data_loader.py
RAG Pipeline:      backend/adk_app/orchestration/pipeline.py
Chat Service:      backend/adk_app/services/chat_service.py

Frontend Entry:    cataract-ui/App.tsx
API Service:       cataract-ui/services/api.ts
Auth Context:      cataract-ui/contexts/AuthContext.tsx
Doctor Portal:     cataract-ui/doctor/DoctorPortal.tsx
Patient Login:     cataract-ui/patient/PatientLogin.tsx
Chatbot:           cataract-ui/components/FAQOverlay.tsx
```

---

## 17. Agent Development Workflow (MANDATORY)

> **This section defines how you MUST work when implementing features, fixing bugs, or making any code changes. Follow these phases in order. Do NOT skip phases.**

### Phase 1: PLAN — Understand before you act

Before writing ANY code:

1. **Read the issue/request carefully.** Identify exactly what is being asked.
2. **Read relevant source files.** Understand the existing code you'll be modifying.
3. **Read existing tests** for the area you're changing (`tests/api/`, `tests/e2e/`).
4. **If requirements are unclear or ambiguous**, post a comment on the issue asking for clarification. List specific questions. Do NOT guess — wait for a response.
5. **Determine the task type:**
   - **New feature**: You will write tests FIRST, then code (Phase 2 → 3).
   - **Bug fix**: You will write a test that reproduces the bug FIRST, then fix (Phase 2 → 3).
   - **Refactoring**: Run existing tests first to confirm they pass, then refactor, then re-run (Phase 3 → 4).

### Phase 2: TEST — Write tests BEFORE code (TDD)

**Before writing any new tests, CHECK if tests already exist for the endpoint/feature you're modifying:**
- Search `tests/api/` for the endpoint name (e.g., grep for `/ask` or `test_chat`)
- If adequate tests exist and behavior is NOT changing → **do NOT create duplicates**, skip to Phase 3
- If adequate tests exist but behavior IS changing → **update the existing tests** to match the new expected behavior (update assertions, add new test cases for new behavior)
- If no tests exist for this feature → **write new tests** following the patterns below

**For new features and bug fixes, ALWAYS write tests first.** This forces you to think through all scenarios before coding.

**What to test (think through ALL of these):**
- Happy path: Does it work with valid input?
- Edge cases: Empty input? Missing fields? Very long input?
- Error cases: Invalid auth? Wrong data type? Non-existent resource?
- Security: Can unauthorized users access it? SQL injection? XSS?

**Test file conventions (MUST follow these patterns):**

```python
# File location: tests/api/test_<feature>.py for API tests
# Use synchronous httpx — NOT async (no pytest-asyncio)
# Use class-based test organization

import pytest

pytestmark = pytest.mark.api  # Always mark with the appropriate layer

class TestFeatureName:
    """Tests for POST /endpoint"""

    def test_happy_path(self, http_client, config):
        """Description of what this tests."""
        response = http_client.post("/endpoint", json={...})
        assert response.status_code == 200
        data = response.json()
        assert "expected_field" in data

    def test_missing_required_field(self, http_client, config):
        """Missing required field returns 422."""
        response = http_client.post("/endpoint", json={})
        assert response.status_code == 422

    def test_unauthorized_access(self, http_client):
        """No auth token returns 401."""
        response = http_client.get("/endpoint")
        assert response.status_code in (401, 403)
```

**Available test fixtures** (defined in `tests/conftest.py`):
- `http_client` — synchronous httpx client pointing at localhost:8000
- `config` — test configuration (credentials, clinic IDs, URLs)
- `admin_auth` — clinic admin auth headers (for `/patients/*`, `/doctor/*`)
- `super_admin_auth` — super admin auth headers (for `/api/admin/*`)
- `test_patient_factory` — creates test patients with random phone numbers
- `api` — pre-authenticated convenience client (from `tests/api/conftest.py`)

**Test markers:**
- `pytest.mark.api` — backend API tests
- `pytest.mark.e2e` — browser tests
- `pytest.mark.security` — security tests
- `pytest.mark.slow` — tests that take >30 seconds

**IMPORTANT test rules:**
- Use **synchronous** httpx calls, NOT async
- Phone numbers must be **random per test run** (use `test_patient_factory`)
- Never hard-code patient phones — use `config.TEST_PATIENT_PHONE` or random
- Test clinic is `garuda-clinic` (NOT vision-forever)
- OTP rate limit: max 3 per phone per 10 minutes
- Backend returns 500 (not 401) for malformed JWT — accept both in tests
- For endpoints needing clinic access, use `admin_auth` (not `super_admin_auth`)
- For endpoints needing super admin, use `super_admin_auth`

### Phase 3: CODE — Write the minimum code to pass all tests

Now write the implementation:

1. Write the code to make your tests pass.
2. Follow existing patterns in the codebase (check similar files).
3. **Run the tests** to verify they pass:
   ```bash
   cd tests && python -m pytest tests/api/test_<your_file>.py -v
   ```
4. If tests fail, fix the code (not the tests) until they pass.
5. Also run related existing tests to ensure no regressions:
   ```bash
   cd tests && python -m pytest tests/api/ -v --timeout=120
   ```

**If existing tests break because of your intentional behavior change:**
- Find the specific test(s) that assert the old behavior
- Update the assertions in those existing tests to match the new expected behavior
- Do NOT delete the test and write a new one — modify it in place
- Add a brief comment explaining why the expected value changed, e.g.:
  ```python
  # Updated: /version now returns "timezone" field (added in issue #11)
  assert "timezone" in data
  ```

### Phase 4: REVIEW — Self-check before pushing

Before committing, verify:

1. **All tests pass** (both new and existing):
   ```bash
   cd tests && python -m pytest tests/api/ -v
   ```
2. **No security issues**: No hardcoded secrets, no SQL injection, no XSS vectors
3. **No unnecessary changes**: Only modify files directly related to the task
4. **Code follows existing patterns**: Check similar files in the codebase
5. **Python syntax is valid**:
   ```bash
   python -m compileall -q backend/adk_app/
   ```
6. **Frontend builds** (if you changed frontend files):
   ```bash
   cd cataract-ui && npm run build
   ```

### Summary: Phase order by task type

| Task Type | Phase 1 (Plan) | Phase 2 (Test) | Phase 3 (Code) | Phase 4 (Review) |
|-----------|----------------|----------------|-----------------|-------------------|
| New feature | Read issue + code | Write tests FIRST | Write code to pass tests | Run all tests + verify |
| Bug fix | Reproduce + understand | Write test that fails on the bug | Fix code so test passes | Run all tests + verify |
| Refactoring | Understand current code | Run existing tests (confirm pass) | Refactor code | Run existing tests (confirm still pass) |
| Test update | Read what changed | Update test expectations | N/A | Run all tests + verify |

---

## 18. Testing Infrastructure Reference

```
tests/
├── conftest.py              # Shared fixtures: auth, http_client, patient factory
├── pytest.ini               # Config: markers, timeout, verbosity
├── .env.test                # Test environment variables
├── api/                     # Layer 1: API tests (pytest + httpx, synchronous)
│   ├── conftest.py          # API-specific fixtures (authenticated client)
│   ├── test_auth.py         # Clinic user auth (login, refresh, logout)
│   ├── test_patient_auth.py # Patient OTP (request, verify, rate limit)
│   ├── test_patients.py     # Patient CRUD
│   ├── test_doctor.py       # Document upload, extraction, review
│   ├── test_chat.py         # RAG /ask endpoint
│   └── test_security.py     # Auth bypass, injection, IDOR
├── e2e/                     # Layer 2: Browser tests (playwright.sync_api)
│   ├── conftest.py          # Playwright fixtures, screenshot-on-fail
│   ├── pages/               # Page Object Models
│   └── test_*.py            # Doctor flow, patient flow, cross-portal
├── ai/                      # Layer 3: AI evaluation (LLM-as-judge)
└── agent/                   # Layer 4: Autonomous exploration
```

**Running tests:**
```bash
# All API tests
cd tests && python -m pytest tests/api/ -v

# Specific test file
cd tests && python -m pytest tests/api/test_auth.py -v

# Only security tests
cd tests && python -m pytest tests/api/ -v -m security

# With timeout
cd tests && python -m pytest tests/api/ -v --timeout=120
```

**Test credentials:**
- Super admin: `admin@cataract.com` / `admin` (role: super_admin, no clinic)
- Clinic admin: `deepika@gmail.com` / `deepika` (role: clinic_admin, garuda-clinic)
- Test clinic: `garuda-clinic` (active)
- Test patient phone: `6666666666`

---

*Last Updated: February 2026*
