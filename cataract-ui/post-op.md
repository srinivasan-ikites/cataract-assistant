# Post-Op Medication Module Tracker

## Phase 1: Foundation
- [x] Create `medications.ts` with categories and clinical rules.
- [x] Update `patient_schema.json` with structured `post_op` object.

## Phase 2: Doctor Portal (PatientOnboarding.tsx)
- [x] Integrate `POST_OP` constants into `PatientOnboarding.tsx`.
- [x] Implement toggles for **Dropless** and **Combination Drop**.
- [x] Create **Antibiotic** and **NSAID** selection with clinical overrides.
- [x] Build **Steroid Tapering** week-by-week configurator.
- [x] Add **Glaucoma** resumption tracker.

## Phase 3: Patient UI (AfterSurgeryModal.tsx)
- [x] Create `AfterSurgeryModal.tsx`.
- [x] Implement logic for "Days post-surgery" and "Current Week Taper".
- [x] Build daily checklist UI with dose-specific tracking.
- [x] Integrate with `DetailModal.tsx` for automatic routing.
- [x] Support Dropless and Combination special instructions.

## Phase 4: Verification
- [x] Verify Tapering transitions (Week 1 -> Week 2).
- [x] Test Dropless Surgery UI override.
- [x] Verify Sulfa Allergy alert for Neomycin.
- [x] Confirm medication checkmark persistence (Firestore sync).
