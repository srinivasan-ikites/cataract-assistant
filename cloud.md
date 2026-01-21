# Cataract Counsellor - Cloud Architecture & Database Design

> **Document Status**: Planning Phase
> **Last Updated**: January 2025
> **Database Choice**: Supabase (PostgreSQL)
> **Hosting**: GCP (existing) + Supabase (new)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Decisions](#2-architecture-decisions)
3. [User Roles & Hierarchy](#3-user-roles--hierarchy)
4. [URL Strategy & Access Methods](#4-url-strategy--access-methods)
5. [Business Logic & Workflows](#5-business-logic--workflows)
6. [Authentication Flows](#6-authentication-flows)
7. [Database Schema](#7-database-schema)
8. [API Endpoint Mapping](#8-api-endpoint-mapping)
9. [File Storage Strategy](#9-file-storage-strategy)
10. [Migration Plan](#10-migration-plan)
11. [Implementation Phases](#11-implementation-phases)
12. [Future Considerations](#12-future-considerations)

---

## 1. System Overview

### What We're Building

A multi-tenant SaaS platform for cataract surgery patient education and counselling.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CATARACT COUNSELLOR PLATFORM                          │
│                         (Your Company)                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   SUPER ADMIN LAYER                                                      │
│   └── Manages all clinics, subscriptions, platform settings              │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   CLINIC LAYER (Multi-tenant)                                            │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│   │   CLINIC A   │  │   CLINIC B   │  │   CLINIC C   │  ... N clinics   │
│   ├──────────────┤  ├──────────────┤  ├──────────────┤                  │
│   │ • Users      │  │ • Users      │  │ • Users      │                  │
│   │ • Patients   │  │ • Patients   │  │ • Patients   │                  │
│   │ • Config     │  │ • Config     │  │ • Config     │                  │
│   │ • Documents  │  │ • Documents  │  │ • Documents  │                  │
│   └──────────────┘  └──────────────┘  └──────────────┘                  │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   SHARED SERVICES                                                        │
│   ├── AI Extraction Engine (Gemini Vision)                               │
│   ├── AI Chat / Q&A (ADK Router + RAG)                                   │
│   ├── Module Content Generation                                          │
│   └── Vector Database (Qdrant)                                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Current State vs Target State

| Aspect | Current State | Target State |
|--------|---------------|--------------|
| Database | JSON files on filesystem | Supabase (PostgreSQL) |
| Authentication | None | Supabase Auth (OTP-based) |
| File Storage | Local filesystem | Supabase Storage / GCP Cloud Storage |
| Multi-tenancy | Single clinic hardcoded | Full multi-tenant |
| Patient Access | Direct access (no auth) | OTP login |
| Clinic User Access | None | Email/password login |

---

## 2. Architecture Decisions

### Confirmed Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Database | Supabase (PostgreSQL) | Built-in auth, RLS, storage, real-time |
| Clinic User Auth | Email + Password | Standard for B2B users |
| Patient Auth | Phone/Email OTP | Simpler for elderly patients, more secure than passwords |
| Session Duration | 7 days | Reduce login friction |
| Data Isolation | Per-clinic | Clinics cannot see each other's data |
| Patient Records | Per-clinic (not linked) | Same patient at different clinics = separate records |
| Doctor Multi-clinic | Separate accounts per clinic | Doctor at Clinic A and B has 2 different user accounts |
| Clinic Onboarding | Self-service | Minimal friction, just name to start |
| Document Storage | Per-clinic, per-patient folders | Organized isolation |
| Patient Document Access | View only (no download) | Doctor's view is priority |

### Deferred Decisions

| Decision | Status | Notes |
|----------|--------|-------|
| Audit Logging | Future Phase | Required but not priority |
| Subscription/Billing | Future Phase | Will add later |
| Patient Document Viewing | TBD | Need to decide if patients can view uploaded docs |
| Cross-clinic Referrals | Not planned | Each clinic is isolated |

---

## 3. User Roles & Hierarchy

### Role Definitions

```
PLATFORM LEVEL
├── super_admin
│   ├── Can manage all clinics
│   ├── Can view platform analytics
│   ├── Can create/suspend clinics
│   └── Cannot access patient medical data (privacy)

CLINIC LEVEL
├── clinic_admin
│   ├── Can manage clinic settings
│   ├── Can invite/remove clinic users
│   ├── Can manage clinic configuration (packages, lenses, etc.)
│   └── Full access to all patients in clinic

├── clinic_user (doctor/staff/counselor - no distinction)
│   ├── Can create/edit patients
│   ├── Can upload documents
│   ├── Can run extractions
│   ├── Can view/edit all patients in clinic
│   └── Cannot manage clinic settings

PATIENT LEVEL
├── patient
│   ├── Can view own data only
│   ├── Can access education modules
│   ├── Can use chat feature
│   └── Cannot edit medical data
```

### Permission Matrix

| Action | super_admin | clinic_admin | clinic_user | patient |
|--------|-------------|--------------|-------------|---------|
| Create clinic | ✅ | ❌ | ❌ | ❌ |
| Manage clinic settings | ❌ | ✅ | ❌ | ❌ |
| Invite clinic users | ❌ | ✅ | ❌ | ❌ |
| Create patient | ❌ | ✅ | ✅ | ❌ |
| Edit patient data | ❌ | ✅ | ✅ | ❌ |
| View patient data | ❌ | ✅ | ✅ | Own only |
| Upload documents | ❌ | ✅ | ✅ | ❌ |
| Run extraction | ❌ | ✅ | ✅ | ❌ |
| Access chat | ❌ | ✅ | ✅ | ✅ |
| View modules | ❌ | ✅ | ✅ | ✅ |

---

## 4. URL Strategy & Access Methods

### 4.0.1 URL Structure (Hybrid Approach)

```
https://app.cataractcounsellor.com/
│
├── PUBLIC ROUTES (No auth required)
│   ├── /                       → Landing page
│   ├── /login                  → Clinic user login
│   ├── /register               → New clinic registration
│   └── /patient/:clinicId/login → Patient login (clinic-specific)
│
├── CLINIC USER ROUTES (Auth required: clinic_admin, clinic_user)
│   ├── /doctor                 → Dashboard
│   ├── /doctor/patients        → Patient list
│   ├── /doctor/patients/:id    → Patient details/onboarding
│   ├── /doctor/settings        → Clinic settings
│   └── /doctor/team            → Team management (admin only)
│
├── PATIENT ROUTES (Auth required: patient)
│   ├── /patient/:clinicId/portal    → Patient education portal
│   ├── /patient/:clinicId/chat      → AI chat
│   └── /patient/:clinicId/modules   → Education modules
│
└── SUPER ADMIN ROUTES (Auth required: super_admin)
    ├── /admin                  → Admin dashboard
    ├── /admin/clinics          → All clinics list
    ├── /admin/clinics/pending  → Pending approvals
    └── /admin/clinics/:id      → Clinic details
```

### 4.0.2 Patient Access Method (Doctor Sends Link)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PATIENT ACCESS FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  DOCTOR                          SYSTEM                          PATIENT    │
│    │                               │                                │       │
│    │  1. Open patient record       │                                │       │
│    │  2. Click "Share with         │                                │       │
│    │     Patient" button           │                                │       │
│    │──────────────────────────────>│                                │       │
│    │                               │                                │       │
│    │                               │  3. Generate unique link:      │       │
│    │                               │     /patient/mclean/login      │       │
│    │                               │     ?ref=abc123                │       │
│    │                               │                                │       │
│    │                               │  4. Send SMS to patient:       │       │
│    │                               │     "Access your cataract      │       │
│    │                               │      surgery info: [link]"     │       │
│    │                               │───────────────────────────────>│       │
│    │                               │                                │       │
│    │  5. Show confirmation:        │                                │       │
│    │     "Link sent to patient"    │                                │       │
│    │<──────────────────────────────│                                │       │
│    │                               │                                │       │
│    │                               │                 6. Click link  │       │
│    │                               │<───────────────────────────────│       │
│    │                               │                                │       │
│    │                               │  7. Show login page with       │       │
│    │                               │     phone pre-filled           │       │
│    │                               │───────────────────────────────>│       │
│    │                               │                                │       │
│    │                               │              8. Confirm phone  │       │
│    │                               │                 Click "Send    │       │
│    │                               │                 OTP"           │       │
│    │                               │<───────────────────────────────│       │
│    │                               │                                │       │
│    │                               │  9. Send OTP via SMS           │       │
│    │                               │───────────────────────────────>│       │
│    │                               │                                │       │
│    │                               │              10. Enter OTP     │       │
│    │                               │<───────────────────────────────│       │
│    │                               │                                │       │
│    │                               │  11. Verify OTP                │       │
│    │                               │      Create/update auth user   │       │
│    │                               │      Link to patient record    │       │
│    │                               │      Create session (7 days)   │       │
│    │                               │                                │       │
│    │                               │  12. Redirect to patient       │       │
│    │                               │      portal                    │       │
│    │                               │───────────────────────────────>│       │
│    │                               │                                │       │
│    │                               │              13. View modules, │       │
│    │                               │                  use chat      │       │
│    │                               │                                │       │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Why this approach?**
- Secure: Patient must verify phone number with OTP
- Simple: Patient just clicks link and enters OTP (no passwords to remember)
- Trackable: Doctor knows exactly when link was sent
- Works for elderly: Minimal steps, familiar SMS flow

**Alternative access (returning patient):**
- Patient can also go directly to `/patient/:clinicId/login`
- Enter phone number → OTP → Access their data
- No need for doctor to send link again

---

## 5. Business Logic & Workflows

### 5.1 Patient Status Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PATIENT STATUS TRANSITIONS                           │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────┐
    │ PENDING  │  ← Patient created (no data yet)
    └────┬─────┘
         │
         │ Doctor uploads documents & runs extraction
         ▼
    ┌──────────┐
    │EXTRACTED │  ← Data extracted from documents
    └────┬─────┘
         │
         │ Doctor reviews data & clicks SAVE
         │ (This is the "review" step)
         ▼
    ┌──────────┐
    │ REVIEWED │  ← Doctor has reviewed & approved
    └────┬─────┘    ★ Patient can now access portal
         │
         │ Surgery date is set & confirmed
         ▼
    ┌───────────┐
    │ SCHEDULED │  ← Surgery scheduled
    └─────┬─────┘
          │
          │ Surgery completed
          ▼
    ┌───────────┐
    │ COMPLETED │  ← Surgery done, follow-up phase
    └─────┬─────┘
          │
          │ Patient no longer active
          ▼
    ┌──────────┐
    │ ARCHIVED │  ← Soft deleted / inactive
    └──────────┘
```

**Key Rule:** Patient can only access their portal after status = 'reviewed' or later.

### 5.2 Extraction & Re-extraction Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXTRACTION BEHAVIOR                                  │
└─────────────────────────────────────────────────────────────────────────────┘

FIRST EXTRACTION:
    Upload documents → Run extraction → Data saved to patient record

RE-EXTRACTION (new documents uploaded):
    Upload new documents → Run extraction → REPLACES existing extracted data

    Note: Doctor must review & save again after re-extraction
          Status resets to 'extracted' until saved
```

### 5.3 Module Content Regeneration

```
Module content is regenerated when:
  ✓ Doctor clicks SAVE on patient data

Module content is NOT regenerated when:
  ✗ Patient views modules
  ✗ Patient uses chat
  ✗ Time passes
```

### 5.4 Clinic Deletion (Soft Delete)

```
When super admin "deletes" a clinic:

1. clinic.status → 'deleted'
2. clinic.deleted_at → current timestamp
3. All clinic users cannot login
4. All patient data preserved but inaccessible
5. Clinic can be restored by super admin if needed
6. Clinic ID remains reserved (cannot be reused)
```

### 5.5 Duplicate Patient Detection

```
When creating a new patient:

1. System checks for existing patients with same:
   - First name + Last name + DOB

2. If match found:
   ┌─────────────────────────────────────────────┐
   │ ⚠️ Potential Duplicate Detected              │
   │                                             │
   │ A patient with similar details exists:      │
   │ • John Doe (DOB: 1955-03-15)               │
   │                                             │
   │ [Continue Anyway]  [Cancel]                 │
   └─────────────────────────────────────────────┘

3. User can choose to continue (create anyway) or cancel
```

---

## 6. Authentication Flows

### 5.1 Clinic User Authentication (Email + Password)

```
┌─────────────────────────────────────────────────────────────────┐
│                  CLINIC USER LOGIN FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User visits /doctor or /login                                │
│                    │                                             │
│                    ▼                                             │
│  2. Enter email + password                                       │
│                    │                                             │
│                    ▼                                             │
│  3. Supabase Auth validates credentials                          │
│                    │                                             │
│         ┌─────────┴─────────┐                                   │
│         ▼                   ▼                                    │
│     SUCCESS              FAILURE                                 │
│         │                   │                                    │
│         ▼                   ▼                                    │
│  4. Fetch user profile   Show error                              │
│     + clinic_id                                                  │
│         │                                                        │
│         ▼                                                        │
│  5. Redirect to /doctor/dashboard                                │
│     (clinic context loaded)                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Patient Authentication (OTP)

```
┌─────────────────────────────────────────────────────────────────┐
│                    PATIENT LOGIN FLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Patient visits /patient or scans QR code                     │
│                    │                                             │
│                    ▼                                             │
│  2. Enter phone number (primary) or email (fallback)             │
│                    │                                             │
│                    ▼                                             │
│  3. System sends 6-digit OTP via SMS/Email                       │
│                    │                                             │
│                    ▼                                             │
│  4. Patient enters OTP                                           │
│                    │                                             │
│         ┌─────────┴─────────┐                                   │
│         ▼                   ▼                                    │
│     VALID OTP          INVALID OTP                               │
│         │                   │                                    │
│         ▼                   ▼                                    │
│  5. Create session      Show error                               │
│     (7-day validity)    (allow retry)                            │
│         │                                                        │
│         ▼                                                        │
│  6. Fetch patient data                                           │
│     (may have multiple clinic records)                           │
│         │                                                        │
│         ▼                                                        │
│  7. If multiple clinics → show clinic selector                   │
│     If single clinic → direct to patient portal                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Clinic Onboarding Flow (With Manual Approval)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  CLINIC REGISTRATION & APPROVAL FLOW                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CLINIC                           SYSTEM                      SUPER ADMIN   │
│    │                                │                              │        │
│    │  1. Visit /register            │                              │        │
│    │───────────────────────────────>│                              │        │
│    │                                │                              │        │
│    │  2. Fill registration form:    │                              │        │
│    │     • Clinic name (required)   │                              │        │
│    │     • Admin name (required)    │                              │        │
│    │     • Admin email (required)   │                              │        │
│    │     • Phone number             │                              │        │
│    │     • Address (optional)       │                              │        │
│    │───────────────────────────────>│                              │        │
│    │                                │                              │        │
│    │                                │  3. Create records:          │        │
│    │                                │     • clinic (status=        │        │
│    │                                │       'pending')             │        │
│    │                                │     • user_profile (status=  │        │
│    │                                │       'pending_approval')    │        │
│    │                                │                              │        │
│    │  4. Show "Application          │                              │        │
│    │     Submitted - Pending        │                              │        │
│    │     Approval" message          │                              │        │
│    │<───────────────────────────────│                              │        │
│    │                                │                              │        │
│    │                                │  5. Send notification        │        │
│    │                                │     to super admin           │        │
│    │                                │─────────────────────────────>│        │
│    │                                │                              │        │
│    │                                │                    6. Review │        │
│    │                                │                       in     │        │
│    │                                │                    dashboard │        │
│    │                                │                              │        │
│    │                                │               ┌──────────────┴──────┐ │
│    │                                │               │                     │ │
│    │                                │            APPROVE              REJECT │
│    │                                │               │                     │ │
│    │                                │               ▼                     ▼ │
│    │                                │  7a. clinic.status='active'   7b. Send│
│    │                                │      user.status='invited'    rejection│
│    │                                │      Generate clinic_id       email   │
│    │                                │      (VIC-MCLEAN-001)               │ │
│    │                                │                              │        │
│    │  8. Receive approval email     │                              │        │
│    │     with "Set Password" link   │<─────────────────────────────│        │
│    │<───────────────────────────────│                              │        │
│    │                                │                              │        │
│    │  9. Click link, set password   │                              │        │
│    │───────────────────────────────>│                              │        │
│    │                                │                              │        │
│    │                                │  10. Create auth.users entry │        │
│    │                                │      user.status='active'    │        │
│    │                                │                              │        │
│    │  11. Redirect to clinic        │                              │        │
│    │      dashboard /doctor         │                              │        │
│    │<───────────────────────────────│                              │        │
│    │                                │                              │        │
│    │  12. Complete optional setup:  │                              │        │
│    │      • Clinic profile          │                              │        │
│    │      • Upload documents        │                              │        │
│    │      • Configure packages      │                              │        │
│    │      • Invite team members     │                              │        │
│    │                                │                              │        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.4 Team Member Invitation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      INVITE CLINIC USER FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CLINIC ADMIN                     SYSTEM                        NEW USER    │
│       │                             │                              │        │
│       │  1. Go to Settings > Team   │                              │        │
│       │  2. Click "Invite User"     │                              │        │
│       │  3. Enter:                  │                              │        │
│       │     • Name                  │                              │        │
│       │     • Email                 │                              │        │
│       │     • Role (admin/user)     │                              │        │
│       │────────────────────────────>│                              │        │
│       │                             │                              │        │
│       │                             │  4. Create user_profile      │        │
│       │                             │     (status='invited')       │        │
│       │                             │                              │        │
│       │                             │  5. Send invitation email    │        │
│       │                             │────────────────────────────────────>│ │
│       │                             │                              │        │
│       │                             │              6. Click link   │        │
│       │                             │<────────────────────────────────────│ │
│       │                             │                              │        │
│       │                             │  7. Show "Set Password" page │        │
│       │                             │────────────────────────────────────>│ │
│       │                             │                              │        │
│       │                             │              8. Set password │        │
│       │                             │<────────────────────────────────────│ │
│       │                             │                              │        │
│       │                             │  9. Create auth.users entry  │        │
│       │                             │     user.status='active'     │        │
│       │                             │                              │        │
│       │                             │  10. User can now login      │        │
│       │                             │────────────────────────────────────>│ │
│       │                             │                              │        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Database Schema

### 7.1 Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐
│     clinics     │       │   auth.users    │
├─────────────────┤       │   (Supabase)    │
│ id (PK)         │       ├─────────────────┤
│ clinic_id       │◄──┐   │ id (PK)         │
│ name            │   │   │ email           │
│ status          │   │   │ phone           │
│ settings        │   │   │ ...             │
│ created_at      │   │   └─────────────────┘
└─────────────────┘   │            │
        │             │            │
        │ 1:N         │            │
        ▼             │            ▼
┌─────────────────┐   │   ┌─────────────────┐
│  clinic_config  │   │   │   user_profiles │
├─────────────────┤   │   ├─────────────────┤
│ id (PK)         │   │   │ id (PK, FK)     │──► auth.users
│ clinic_id (FK)  │───┘   │ clinic_id (FK)  │───► clinics
│ packages        │       │ role            │
│ lens_inventory  │       │ name            │
│ medications     │       │ ...             │
│ sops            │       └─────────────────┘
└─────────────────┘
        │
        │
        │             ┌─────────────────┐
        │             │    patients     │
        │             ├─────────────────┤
        └────────────►│ id (PK)         │
                      │ clinic_id (FK)  │───► clinics
                      │ patient_id      │
                      │ auth_user_id    │───► auth.users (nullable)
                      │ identity        │
                      │ medical_profile │
                      │ clinical_context│
                      │ surgical_plan   │
                      │ ...             │
                      └─────────────────┘
                               │
                               │ 1:N
                               ▼
                      ┌─────────────────┐
                      │patient_documents│
                      ├─────────────────┤
                      │ id (PK)         │
                      │ patient_id (FK) │
                      │ file_path       │
                      │ file_type       │
                      │ extracted_data  │
                      │ uploaded_by     │
                      └─────────────────┘
```

### 7.2 Table Definitions

```sql
-- =====================================================
-- CLINICS
-- =====================================================
CREATE TABLE clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id TEXT UNIQUE NOT NULL,  -- Human-readable ID like "VIC-MCLEAN-001"
    name TEXT NOT NULL,

    -- Profile (can be filled later)
    address JSONB DEFAULT '{}',
    contact JSONB DEFAULT '{}',      -- {phone, email, website}

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'deleted')),

    -- Settings
    settings JSONB DEFAULT '{}',     -- {timezone, language, branding}

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ           -- Soft delete timestamp (NULL if not deleted)
);

-- =====================================================
-- CLINIC CONFIGURATION
-- Separate table for large config data
-- =====================================================
CREATE TABLE clinic_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE UNIQUE,

    -- Surgical packages (array of package objects)
    surgical_packages JSONB DEFAULT '[]',

    -- Lens inventory (array of lens objects)
    lens_inventory JSONB DEFAULT '[]',

    -- Medications by phase
    medications JSONB DEFAULT '{
        "pre_operative": [],
        "post_operative": [],
        "maintenance": []
    }',

    -- Standard operating procedures
    sops JSONB DEFAULT '{}',

    -- Staff directory
    staff_directory JSONB DEFAULT '[]',

    -- Timestamps
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- USER PROFILES
-- Links Supabase auth.users to our app data
-- =====================================================
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,

    -- Role
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'clinic_admin', 'clinic_user')),

    -- Profile
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    specialization TEXT,           -- For doctors

    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PATIENTS
-- =====================================================
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,

    -- Link to auth (nullable - patient may not have logged in yet)
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Clinic's internal patient ID
    patient_id TEXT NOT NULL,       -- e.g., "1245583"

    -- ===== ASSIGNMENT =====
    created_by UUID REFERENCES user_profiles(id),        -- Who created this patient
    assigned_doctor_id UUID REFERENCES user_profiles(id), -- Primary doctor assigned

    -- ===== IDENTITY =====
    first_name TEXT,
    middle_name TEXT,
    last_name TEXT,
    dob DATE,
    gender TEXT,
    contact JSONB DEFAULT '{}',     -- {phone, email, address}

    -- ===== MEDICAL DATA (JSONB for flexibility) =====
    medical_profile JSONB DEFAULT '{}',
    /*
    {
        "ocular_history": {...},
        "systemic_conditions": {...},
        "current_medications": [...],
        "allergies": [...],
        "family_history": {...}
    }
    */

    clinical_context JSONB DEFAULT '{}',
    /*
    {
        "diagnosis": {...},
        "current_vision": {...},
        "refraction": {...},
        "keratometry": {...},
        "biometry": {...},
        "additional_tests": {...}
    }
    */

    lifestyle_profile JSONB DEFAULT '{}',
    /*
    {
        "occupation": "...",
        "hobbies": [...],
        "driving_needs": {...},
        "digital_device_usage": {...},
        "spectacle_independence_priority": "..."
    }
    */

    surgical_plan JSONB DEFAULT '{}',
    /*
    {
        "candidacy_assessment": {...},
        "recommendations_by_doctor": {...},
        "operative_logistics": {...}
    }
    */

    medications_plan JSONB DEFAULT '{}',
    /*
    {
        "pre_operative": [...],
        "post_operative": [...],
        "current": [...]
    }
    */

    -- ===== AI GENERATED CONTENT =====
    module_content JSONB DEFAULT '{}',
    /*
    {
        "My Diagnosis": "...",
        "What is Cataract Surgery?": "...",
        ...
    }
    */

    chat_history JSONB DEFAULT '[]',
    /*
    [
        {"role": "user", "content": "...", "timestamp": "..."},
        {"role": "assistant", "content": "...", "timestamp": "..."}
    ]
    */

    -- ===== STATUS & METADATA =====
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Just created (no data yet)
        'extracted',    -- Data extracted from documents
        'reviewed',     -- Doctor reviewed & saved (patient can access portal)
        'scheduled',    -- Surgery scheduled
        'completed',    -- Surgery completed
        'archived'      -- Soft deleted / no longer active
    )),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    archived_at TIMESTAMPTZ,         -- Soft delete timestamp (NULL if not archived)

    -- Constraints
    UNIQUE(clinic_id, patient_id)
);

-- =====================================================
-- PATIENT DOCUMENTS
-- Uploaded files (EMR, biometry, consent forms, etc.)
-- =====================================================
CREATE TABLE patient_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,

    -- File info
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,        -- Storage path: clinics/{clinic_id}/patients/{patient_id}/{filename}
    file_type TEXT,                 -- 'emr', 'biometry', 'consent', 'other'
    file_size INTEGER,              -- Size in bytes
    mime_type TEXT,                 -- 'image/jpeg', 'application/pdf', etc.

    -- Extraction results
    extracted_data JSONB,           -- Raw extraction output
    extraction_status TEXT DEFAULT 'pending' CHECK (extraction_status IN (
        'pending',
        'processing',
        'completed',
        'failed'
    )),

    -- Metadata
    uploaded_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Clinics
CREATE INDEX idx_clinics_clinic_id ON clinics(clinic_id);
CREATE INDEX idx_clinics_status ON clinics(status);

-- User profiles
CREATE INDEX idx_user_profiles_clinic_id ON user_profiles(clinic_id);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);

-- Patients
CREATE INDEX idx_patients_clinic_id ON patients(clinic_id);
CREATE INDEX idx_patients_patient_id ON patients(patient_id);
CREATE INDEX idx_patients_auth_user_id ON patients(auth_user_id);
CREATE INDEX idx_patients_assigned_doctor ON patients(assigned_doctor_id);
CREATE INDEX idx_patients_status ON patients(status);
CREATE INDEX idx_patients_created_at ON patients(created_at DESC);

-- Patient documents
CREATE INDEX idx_patient_documents_patient_id ON patient_documents(patient_id);
CREATE INDEX idx_patient_documents_file_type ON patient_documents(file_type);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_documents ENABLE ROW LEVEL SECURITY;

-- Policy: Super admins can see all clinics
CREATE POLICY "Super admins can view all clinics" ON clinics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role = 'super_admin'
        )
    );

-- Policy: Clinic users can only see their own clinic
CREATE POLICY "Users can view own clinic" ON clinics
    FOR SELECT USING (
        id IN (
            SELECT clinic_id FROM user_profiles
            WHERE user_profiles.id = auth.uid()
        )
    );

-- Policy: Clinic users can only see patients in their clinic
CREATE POLICY "Users can view clinic patients" ON patients
    FOR SELECT USING (
        clinic_id IN (
            SELECT clinic_id FROM user_profiles
            WHERE user_profiles.id = auth.uid()
        )
    );

-- Policy: Patients can only see their own record
CREATE POLICY "Patients can view own record" ON patients
    FOR SELECT USING (auth_user_id = auth.uid());

-- (Additional policies would be added for INSERT, UPDATE, DELETE)
```

### 7.3 Comparison: Current JSON vs New Schema

| Current JSON Field | New Database Location |
|-------------------|----------------------|
| `patient_identity.*` | `patients.first_name`, `patients.last_name`, etc. + `patients.contact` |
| `medical_profile.*` | `patients.medical_profile` (JSONB) |
| `clinical_context.*` | `patients.clinical_context` (JSONB) |
| `lifestyle_profile.*` | `patients.lifestyle_profile` (JSONB) |
| `surgical_plan.*` | `patients.surgical_plan` (JSONB) |
| `current_medications.*` | `patients.medications_plan` (JSONB) |
| `module_content.*` | `patients.module_content` (JSONB) |
| `chat_history` | `patients.chat_history` (JSONB) |
| Uploaded files | `patient_documents` table + Supabase Storage |

---

## 8. API Endpoint Mapping

### 8.1 Current Endpoints → New Endpoints

| Current Endpoint | New Endpoint | Changes |
|-----------------|--------------|---------|
| `GET /patients` | `GET /api/clinics/{clinic_id}/patients` | Scoped to clinic |
| `GET /patients/{id}` | `GET /api/clinics/{clinic_id}/patients/{id}` | Scoped to clinic |
| `POST /doctor/upload-extract` | `POST /api/clinics/{clinic_id}/patients/{id}/extract` | Scoped to clinic |
| `PUT /doctor/reviewed/{id}` | `PUT /api/clinics/{clinic_id}/patients/{id}` | Scoped to clinic |
| `GET /clinics/{id}` | `GET /api/clinics/{clinic_id}` | No change |
| `POST /ask` | `POST /api/clinics/{clinic_id}/patients/{id}/chat` | Scoped to patient |
| `GET /module-content` | `GET /api/clinics/{clinic_id}/patients/{id}/modules/{module}` | Scoped to patient |

### 8.2 New Endpoints Required

```
AUTHENTICATION
├── POST /api/auth/register          # New clinic registration
├── POST /api/auth/login             # Clinic user login
├── POST /api/auth/otp/send          # Send OTP to patient
├── POST /api/auth/otp/verify        # Verify patient OTP
├── POST /api/auth/logout            # Logout
└── GET  /api/auth/me                # Get current user

CLINICS (Super Admin)
├── GET  /api/admin/clinics          # List all clinics
├── POST /api/admin/clinics          # Create clinic
├── PUT  /api/admin/clinics/{id}     # Update clinic
└── DELETE /api/admin/clinics/{id}   # Suspend clinic

CLINIC MANAGEMENT
├── GET  /api/clinics/{id}           # Get clinic details
├── PUT  /api/clinics/{id}           # Update clinic profile
├── GET  /api/clinics/{id}/config    # Get clinic config
├── PUT  /api/clinics/{id}/config    # Update clinic config
├── GET  /api/clinics/{id}/users     # List clinic users
├── POST /api/clinics/{id}/users     # Invite user
└── DELETE /api/clinics/{id}/users/{uid}  # Remove user

PATIENTS
├── GET  /api/clinics/{cid}/patients              # List patients
├── POST /api/clinics/{cid}/patients              # Create patient
├── GET  /api/clinics/{cid}/patients/{pid}        # Get patient
├── PUT  /api/clinics/{cid}/patients/{pid}        # Update patient
├── DELETE /api/clinics/{cid}/patients/{pid}      # Delete patient
├── POST /api/clinics/{cid}/patients/{pid}/extract    # Upload & extract
├── POST /api/clinics/{cid}/patients/{pid}/chat       # Chat message
├── GET  /api/clinics/{cid}/patients/{pid}/modules    # Get all modules
└── GET  /api/clinics/{cid}/patients/{pid}/modules/{m}  # Get specific module

PATIENT PORTAL (Patient's own view)
├── GET  /api/me/patient             # Get own patient data
├── POST /api/me/chat                # Send chat message
└── GET  /api/me/modules             # Get education modules
```

---

## 9. File Storage Strategy

### Storage Structure

```
supabase-storage/
└── clinic-documents/
    └── {clinic_id}/
        ├── clinic/
        │   ├── logo.png
        │   └── documents/
        │       ├── license.pdf
        │       └── accreditation.pdf
        └── patients/
            └── {patient_id}/
                ├── uploads/
                │   ├── emr_001.jpg
                │   ├── biometry_001.pdf
                │   └── consent_signed.pdf
                └── generated/
                    └── patient_summary.pdf
```

### Access Policies

| Path Pattern | Who Can Access |
|-------------|----------------|
| `{clinic_id}/clinic/*` | Clinic admins and users |
| `{clinic_id}/patients/{pid}/*` | Clinic users + that specific patient |
| All | Super admins (read-only) |

---

## 10. Migration Plan

### 10.1 Data to Migrate

| Source | Destination | Notes |
|--------|-------------|-------|
| `data/clinic/VIC-MCLEAN-001.json` | `clinics` + `clinic_config` tables | Split into two tables |
| `data/reviewed/VIC-MCLEAN-001/*.json` | `patients` table | One row per patient |
| `data/uploads/*` | Supabase Storage | Maintain folder structure |

### 10.2 Migration Script Outline

```python
# migration/migrate_to_supabase.py

async def migrate():
    # 1. Create clinic
    clinic = await create_clinic_from_json("data/clinic/VIC-MCLEAN-001.json")

    # 2. Create clinic config
    await create_clinic_config(clinic.id, clinic_data)

    # 3. Migrate patients
    for patient_file in glob("data/reviewed/VIC-MCLEAN-001/*.json"):
        patient_data = load_json(patient_file)
        await create_patient(clinic.id, patient_data)

    # 4. Migrate uploaded files
    for upload in glob("data/uploads/**/*"):
        await upload_to_storage(upload, clinic.id, patient_id)

    # 5. Create admin user
    await create_admin_user(clinic.id, admin_email)
```

---

## 11. Implementation Phases

### Phase 1: Foundation (Priority: HIGH)
> Goal: Set up Supabase and basic database structure

| # | Task | Subtasks | Status |
|---|------|----------|--------|
| 1.1 | Create Supabase Project | - Sign up for Supabase<br>- Create new project<br>- Note API keys and URLs | ⬜ |
| 1.2 | Set Up Database Schema | - Create all tables<br>- Add indexes<br>- Set up RLS policies | ⬜ |
| 1.3 | Configure Storage | - Create storage bucket<br>- Set up access policies | ⬜ |
| 1.4 | Backend: Supabase Client | - Install supabase-py<br>- Create connection module<br>- Test connection | ⬜ |
| 1.5 | Environment Configuration | - Add Supabase env vars<br>- Update Docker config<br>- Update GCP deployment | ⬜ |

### Phase 2: Clinic User Authentication (Priority: HIGH)
> Goal: Doctors/staff can log in

| # | Task | Subtasks | Status |
|---|------|----------|--------|
| 2.1 | Backend: Auth Endpoints | - Login endpoint<br>- Logout endpoint<br>- Get current user endpoint | ⬜ |
| 2.2 | Backend: Auth Middleware | - JWT validation<br>- Role extraction<br>- Clinic context injection | ⬜ |
| 2.3 | Frontend: Login Page | - Design login UI<br>- Implement login form<br>- Handle errors | ⬜ |
| 2.4 | Frontend: Auth State | - Create auth context<br>- Persist session<br>- Auto-refresh tokens | ⬜ |
| 2.5 | Frontend: Protected Routes | - Redirect if not logged in<br>- Show loading state | ⬜ |

### Phase 3: Data Migration (Priority: HIGH)
> Goal: Move existing data to Supabase

| # | Task | Subtasks | Status |
|---|------|----------|--------|
| 3.1 | Write Migration Scripts | - Clinic migration<br>- Patient migration<br>- File migration | ⬜ |
| 3.2 | Test Migration (Local) | - Run on test data<br>- Verify data integrity<br>- Fix issues | ⬜ |
| 3.3 | Run Production Migration | - Backup existing data<br>- Run migration<br>- Verify | ⬜ |
| 3.4 | Update API Endpoints | - Replace JSON file reads<br>- Use Supabase queries<br>- Test all endpoints | ⬜ |

### Phase 4: Multi-Tenancy (Priority: HIGH)
> Goal: Support multiple clinics

| # | Task | Subtasks | Status |
|---|------|----------|--------|
| 4.1 | Backend: Clinic Scoping | - Add clinic_id to all queries<br>- Validate clinic access<br>- Test isolation | ⬜ |
| 4.2 | Frontend: Clinic Context | - Load clinic on login<br>- Pass clinic_id in requests<br>- Show clinic name in UI | ⬜ |
| 4.3 | Clinic Onboarding Flow | - Registration page<br>- Clinic creation endpoint<br>- Admin user creation | ⬜ |
| 4.4 | Clinic Setup Wizard | - Profile form<br>- Config upload<br>- User invitation | ⬜ |

### Phase 5: Patient Authentication (Priority: MEDIUM)
> Goal: Patients can log in with OTP

| # | Task | Subtasks | Status |
|---|------|----------|--------|
| 5.1 | Set Up SMS Provider | - Choose provider (Twilio/Supabase)<br>- Configure credentials<br>- Test sending | ⬜ |
| 5.2 | Backend: OTP Endpoints | - Send OTP endpoint<br>- Verify OTP endpoint<br>- Link to patient record | ⬜ |
| 5.3 | Frontend: Patient Login | - Phone input UI<br>- OTP input UI<br>- Error handling | ⬜ |
| 5.4 | Patient Linking | - Link auth user to patient<br>- Handle multiple clinics<br>- Clinic selector UI | ⬜ |
| 5.5 | Patient Portal Auth | - Protect patient routes<br>- Load patient data<br>- Session management | ⬜ |

### Phase 6: File Storage Migration (Priority: MEDIUM)
> Goal: Move files to cloud storage

| # | Task | Subtasks | Status |
|---|------|----------|--------|
| 6.1 | Update Upload Endpoint | - Upload to Supabase Storage<br>- Generate signed URLs<br>- Update document records | ⬜ |
| 6.2 | Update File Retrieval | - Fetch from storage<br>- Handle permissions<br>- Cache if needed | ⬜ |
| 6.3 | Migrate Existing Files | - Upload all existing files<br>- Update database paths<br>- Verify integrity | ⬜ |
| 6.4 | Remove Local File Code | - Remove filesystem operations<br>- Clean up old code<br>- Test | ⬜ |

### Phase 7: Super Admin (Priority: LOW)
> Goal: Platform management for your company

| # | Task | Subtasks | Status |
|---|------|----------|--------|
| 7.1 | Super Admin Dashboard | - List all clinics<br>- Clinic status management<br>- Basic analytics | ⬜ |
| 7.2 | Clinic Management | - Create clinic manually<br>- Suspend/activate clinic<br>- View clinic details | ⬜ |

---

## 12. Future Considerations

### Priority: FUTURE (After core is complete)

| Feature | Description | Complexity |
|---------|-------------|------------|
| **Audit Logging** | Track who accessed/modified patient data | Medium |
| **Subscription/Billing** | Stripe integration, usage tracking | High |
| **Cross-Clinic Referrals** | Share patient data between clinics | High |
| **Advanced Analytics** | Dashboard with clinic/platform metrics | Medium |
| **Notification System** | Email/SMS notifications for appointments | Medium |
| **Backup/Export** | Allow clinics to export their data | Low |
| **API Rate Limiting** | Prevent abuse | Low |
| **Two-Factor Auth** | Additional security for clinic users | Low |

### Audit Log Schema (For Future)

```sql
-- To be implemented in future phase
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id),
    user_id UUID REFERENCES auth.users(id),

    action TEXT NOT NULL,           -- 'view', 'create', 'update', 'delete'
    resource_type TEXT NOT NULL,    -- 'patient', 'document', 'config'
    resource_id UUID,

    details JSONB,                  -- What changed
    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_clinic ON audit_logs(clinic_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
```

---

## Notes & Open Questions

### Resolved
- [x] Database choice: Supabase
- [x] User roles: super_admin, clinic_admin, clinic_user, patient
- [x] Patient auth: OTP-based
- [x] Data isolation: Per-clinic
- [x] Audit logging: Future phase
- [x] Session duration: 7 days for both clinic users and patients
- [x] SMS provider: Decide during implementation (likely Twilio or Supabase built-in)
- [x] Clinic onboarding: Self-service with manual approval by super admin

### Open Questions
- None - all questions resolved!

### All Decisions Log

#### Core Architecture
| Decision | Choice |
|----------|--------|
| Database | Supabase (PostgreSQL) |
| User Roles | super_admin, clinic_admin, clinic_user, patient |
| Clinic User Auth | Email + Password |
| Patient Auth | Phone/Email OTP (SMS primary, email fallback) |
| Session Duration | 7 days for all users |
| Data Isolation | Per-clinic (no sharing) |

#### User & Access Management
| Decision | Choice |
|----------|--------|
| Doctor-patient assignment | Single doctor per patient |
| Multiple clinic admins | No, one admin per clinic |
| Admin self-removal | Not allowed |
| Clinic user visibility | Full visibility (all users can see each other's profiles) |
| Super admin portal | Separate URL (/admin) |
| User removal handling | Deferred to future phase |

#### Clinic Management
| Decision | Choice |
|----------|--------|
| Clinic onboarding | Self-service with manual approval |
| Registration rejection | Can re-apply (not blocked) |
| Suspended clinic behavior | Users cannot login |
| Clinic deletion | Soft delete (hide but preserve data) |

#### Patient Management
| Decision | Choice |
|----------|--------|
| Patient document viewing | No - patients cannot see uploaded EMR images |
| Patient deletion | Archive only (soft delete) |
| Duplicate patients | Warn but allow |
| Multi-clinic patient access | Separate logins per clinic |

#### Data & Content
| Decision | Choice |
|----------|--------|
| Re-extraction behavior | Replace existing data |
| Module regeneration | Regenerate when doctor saves patient data |
| Review workflow | Yes - doctor must save (review) before patient can access |
| Chat history retention | Keep forever |
| Patient view tracking | Not needed for now |

#### Technical
| Decision | Choice |
|----------|--------|
| URL Strategy | Hybrid (single domain + clinic-specific patient URLs) |
| Patient Access Method | Doctor sends link → Patient verifies with OTP |
| OTP delivery | SMS primary, email fallback |
| Email notifications | Essential only (registration status, password reset) |
| Super Admin features | Core only (list, approve, suspend, delete) |
| Optional features | Moved to `cloud-future-features.md`

---

## Changelog

| Date | Changes |
|------|---------|
| Jan 2025 | Initial architecture document created |

