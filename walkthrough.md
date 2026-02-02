# Cataract Counsellor - Application Walkthrough

A quick guide for testing the application end-to-end.

---

## Visual Workflow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           APPLICATION WORKFLOW                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   STEP 1     │      │   STEP 2     │      │   STEP 3     │      │   STEP 4     │
│              │      │              │      │              │      │              │
│  Register    │ ───► │   Admin      │ ───► │   Setup      │ ───► │  Register    │
│   Clinic     │      │  Approves    │      │  Clinical    │      │   Patient    │
│              │      │   Clinic     │      │    Data      │      │              │
└──────────────┘      └──────────────┘      └──────────────┘      └──────────────┘
       │                                                                  │
       │                                                                  │
       ▼                                                                  ▼
┌──────────────┐                                                  ┌──────────────┐
│ Doctor       │                                                  │ Patient      │
│ Portal       │                                                  │ Portal       │
│ Login        │                                                  │ OTP Login    │
└──────────────┘                                                  └──────────────┘
                                                                         │
                                                                         ▼
                                                                  ┌──────────────┐
                                                                  │   STEP 5     │
                                                                  │              │
                                                                  │    Test      │
                                                                  │   Modules    │
                                                                  │  & Chatbot   │
                                                                  └──────────────┘
```

---

## Step 1: Admin Dashboard

### What is it?
The Admin Dashboard allows system administrators to approve or reject new clinic registrations.

### Login Credentials
| Field    | Value                    |
|----------|--------------------------|
| Email    | `admin@cataract.com`     |
| Password | `admin123`               |

### Admin Capabilities
- View all pending clinic registrations
- **Approve** clinics → Clinic becomes active
- **Reject** clinics → Clinic registration denied

---

## Step 2: Doctor Portal & Clinic Registration

### Accessing the Portal
1. Navigate to the **Doctor Portal**
2. You will be prompted to log in if not authenticated
3. Enter your credentials or create a new account

### Selecting a Clinic
- The **"List of Clinics"** view is for development/testing purposes
- Select your clinic from the list if it exists

### Registering a New Clinic
If no clinic exists:
1. Click **"Register a Clinic"**
2. Fill in the required fields:
   - Clinic Name
   - Address
   - Contact Information
   - *(Some fields are optional)*
3. Click **Submit**

> **Note:** New clinics require Admin approval before activation.

---

## Step 3: Clinic Approval Flow

Follow these steps to activate a newly registered clinic:

| Step | Action                                              |
|------|-----------------------------------------------------|
| 1    | **Log out** from the Doctor Portal                  |
| 2    | **Log in** to Admin Dashboard (see Step 1 credentials) |
| 3    | Find your clinic in the **Pending** list            |
| 4    | Click **"Approve"**                                 |
| 5    | **Log out** of Admin                                |
| 6    | **Log back in** to Doctor Portal                    |
| 7    | Your clinic should now be visible and active        |

---

## Step 4: Clinical Data Setup

> **IMPORTANT:** Complete this step before registering patients.

### Why is this critical?
The clinical data you enter here (medications, lens packages) will appear as options across all patient records.

### Setup Steps
1. Navigate to **"Clinical Data"** section
2. **Add Medications:**
   - Enter medication names and details
   - These will appear in patient prescription dropdowns
3. **Add Surgical Packages:**
   - Define lens categories and pricing
   - These will be selectable during patient consultation

### What this enables
- Consistent medication options across all patients
- Standardized surgical package selection
- Accurate pricing information in patient records

---

## Step 5: Patient Registration & Portal

### A. Register a Patient (Doctor Portal)

1. Go to the **"Patients"** tab
2. Click **"Register New Patient"**
3. **Upload Documents:**
   - Upload patient documents (prescriptions, reports)
   - Fields will auto-populate from the documents
4. **Review & Edit:**
   - Verify auto-filled information
   - Make corrections if needed
5. Click **"Save"**

### B. Access Patient Portal

1. **Log out** of Doctor Portal
2. Navigate to **Patient Portal**
3. Enter the **same phone number** used during registration
4. **OTP Verification:**

   > **Testing Note:** The OTP will display directly on screen (not sent via SMS). Copy and paste it to log in.

5. You are now logged in as the patient

---

## Step 6: Final Testing & Feedback

### Module Testing
Open and verify each module:
- [ ] Patient Information
- [ ] Diagnosis Details
- [ ] Surgical Recommendations
- [ ] Medication List
- [ ] Pre-operative Instructions
- [ ] Post-operative Care

### Chatbot Testing

> **Note:** There may be some latency (10-25 seconds per response). This is expected.

Test the chatbot by asking questions such as:
- "What is cataract surgery?"
- "What medications do I need to take?"
- "What are the risks of surgery?"
- "When can I resume normal activities?"

### Feedback Checklist
Please note any issues with:
- [ ] Accuracy of chatbot responses
- [ ] Missing or incorrect information
- [ ] Confusing user interface elements
- [ ] Any errors or unexpected behavior

---

## Quick Reference

### Portal URLs
| Portal         | Purpose                          |
|----------------|----------------------------------|
| Admin Portal   | Approve/reject clinic registrations |
| Doctor Portal  | Manage clinic & patient data     |
| Patient Portal | Patient education & chatbot      |

### Login Flow Summary
```
Doctor → Register Clinic → Admin Approves → Doctor Sets Up Data → Register Patient → Patient Logs In
```

---

## Need Help?

If you encounter any issues during testing, please document:
1. What you were trying to do
2. What happened instead
3. Any error messages displayed

---

*Thank you for testing the Cataract Counsellor application!*
