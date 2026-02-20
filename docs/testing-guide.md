# Mira - Cataract Surgery Counselling Platform

### Quick Testing Guide

---

## What is Mira?

Mira is an AI-powered platform that helps cataract surgery patients understand their diagnosis, treatment plan, and recovery process. Doctors upload patient records, and the system automatically extracts the data and generates personalized education content for each patient.

---

## 1. Doctor Portal

**URL:** https://cataract-assistant.ikites.ai/doctor/login

**Login Credentials:**
| Field    | Value              |
|----------|--------------------|
| Email    | deepika@gmail.com  |
| Password | deepika            |

### What you can do:

**Dashboard** - See an overview of your clinic's patients, today's activity, and quick statistics.

**Patient List** - View all registered patients with their current status. Use the search bar to find patients by name or ID.

**Register a New Patient** - Click "Register Patient" to add a new patient. Enter their first name, last name, and phone number. A patient ID is auto-generated.

**Upload Documents** - Open any patient and upload their EMR or biometry documents. The AI automatically extracts clinical data (diagnosis, eye measurements, IOL recommendations) from the uploaded files.

**Review Extracted Data** - After upload, review the AI-extracted data for accuracy. Edit any fields if needed, then save. Once saved, the patient can access their personalized portal.

**Clinic Configuration** - Update your clinic's medication protocols, surgical packages, lens inventory, and staff directory from the settings page.

---

## 2. Patient Portal

**URL:** https://cataract-assistant.ikites.ai/patient/garuda-clinic/login

**Login Credentials:**
| Field        | Value          |
|--------------|----------------|
| Phone Number | 666-666-6666   |

*Enter the phone number, click "Get OTP", then enter the 6-digit code shown on screen (test mode).*

### What patients see:

**9 Education Modules** - Personalized content covering the complete surgery journey:

| #  | Module                      | Description                                      |
|----|-----------------------------|--------------------------------------------------|
| 1  | My Diagnosis                | AI-generated summary of the patient's condition   |
| 2  | What is Cataract Surgery?   | How the procedure works, step by step             |
| 3  | What is an IOL?             | Explains intraocular lens types                   |
| 4  | My IOL Options              | The specific lens options offered to this patient  |
| 5  | Risks & Complications       | What to be aware of before surgery                |
| 6  | Before Surgery              | Pre-op medication checklist with progress tracking |
| 7  | Day of Surgery              | What to expect on surgery day                     |
| 8  | After Surgery               | Post-op medications and recovery timeline          |
| 9  | Costs & Insurance           | Package pricing and payment information           |

**AI Care Assistant** - A chatbot (bottom-right corner) that answers patient questions about their specific diagnosis, medications, and surgery. It uses the patient's actual clinical data to give personalized answers.

---

## Quick Test Flow

1. **Log in as Doctor** at the Doctor Portal URL above
2. Open an existing patient (or register a new one)
3. Upload a document and review the extracted data
4. **Log in as Patient** at the Patient Portal URL above
5. Browse the 9 education modules - notice "My Diagnosis" is personalized
6. Open the chatbot and ask a question like *"What type of lens was recommended for me?"*

---
