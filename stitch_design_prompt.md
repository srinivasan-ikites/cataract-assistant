# Stitch UI Design Prompt: CataractOS Doctor Portal

Copy and paste the prompt below into Stitch to generate high-fidelity designs for the clinical workflow.

---

### **System Role & Context**
You are a world-class UI/UX Designer specializing in Healthcare Saas and high-precision medical interfaces. We are building **CataractOS**, a specialized "Operating System" for cataract surgeons and surgical coordinators.   

The goal is to move away from cluttered, "legacy" medical software and towards a workspace that feels like **Apple’s Pro apps** (Final Cut Pro, Xcode, or Studio Display interface): clean, razor-sharp, spacious, and non-fatiguing for the eyes.

### **The Problem & Value Prop**
Doctors currently spend hours manually entering data from messy EMR notes. 
**CataractOS** allows them to:
1. **Upload**: Drop photos of patient EMR notes, Biometry reports (IOL Master), and Consent forms.
2. **AI Extraction**: A Vision-LLM extracts clinical data into a structured schema.
3. **Review & Verify**: The doctor uses this UI to quickly verify the AI's "Intelligence" before publishing it to the Patient-facing mobile app.

### **Visual Aesthetic (The "Apple Studio" Style)**
- **Palette**: Pure White (`#FFFFFF`) and Apple Gray (`#FBFBFD`). Accent color is Apple Blue (`#0071E3`). 
- **Typography**: San Francisco style (Inter or System Sans). High contrast for data, low contrast for labels.
- **Borders**: Razor-thin `1px` borders (`#D2D2D7/30`). No heavy shadows.
- **Icons**: Lucide or SF Symbols style (Thin strokes, 1.5px to 2px).
- **Feel**: "Clinical Studio"—Spacious, professional, and ultra-smooth.

---

### **Screen 1: Patient Dashboard (The Fleet)**
- **Objective**: Manage a list of patients in different onboarding stages.
- **Key Elements**:
    - Sidebar: Dashboard, Clinic Setup, Catalog.
    - Stats Row: "Total Fleet", "Pending AI Review", "Ready for Surgery".
    - Patient Table: Columns for [Patient Name/ID], [DOB], [Onboarding Status: New, Extracted, Verified], [Last Activity].
    - Interaction: Clicking a row opens the "Intelligence Canvas."

### **Screen 2: Intelligence Canvas (The Core Workflow)**
This is the most critical screen. A split-view workspace.
- **Left Panel (Evidence Source)**:
    - Drag-and-drop zone for EMR images.
    - Gallery of uploaded docs with small thumbnails and "AI Analyzed" checkmarks.
    - A "Run AI Extraction" button that feels powerful.
- **Center/Right Panel (The Intelligence Board)**:
    - **Vertical Tab Navigation**: Identity, Medical History, Clinical Diagnosis, Lifestyle, Surgical Plan, Consents.
    - **Data Entry**: Fields that show AI-extracted data. 
    - **AI Feedback**: Fields not found by the AI should have a tiny, elegant "Amber Dot" indicating "Not Extracted - Manual Review Needed."
    - **Nested Logic**: 
        - **Biometry**: Side-by-side comparison for OD (Right Eye) and OS (Left Eye) measurements (Axial Length, Astigmatism).
        - **Surgical Plan**: A specialized card for "Lens Tier Selection" where one option is marked as "Patient's Choice."
        - **Implant Matrix**: Precise fields for Lens Model, Power, and Axis for both eyes.

### **Data Fields to Include (Schema)**
- **Identity**: First/Last Name, DOB, Gender, Occupation, Clinic ID.
- **Medical**: Ocular History, Systemic Conditions (Tags), Allergies (Red-tinted tags).
- **Clinical**: Pathology (e.g., "Nuclear Sclerosis"), Comorbidities, OD/OS Measurements.
- **Lifestyle**: Visual Priorities (Driving, Reading), Attitude toward glasses.
- **Surgical**: Surgeon ID, Decision Date, Lens Options (Package Name + Rationale), Selected Implants (Model, Power, Incision Axis).
- **Logistics**: Surgery Date, Arrival Time, Post-Op Visit Schedule.

---

### **Final Instruction for Stitch**
Generate a multi-screen prototype that emphasizes **clarity and white space**. The interface should feel like a high-precision tool for a surgeon—no unnecessary colors, no clutter, and 100% focused on clinical accuracy. Use smooth transitions between tabs and elegant micro-interactions for adding list items (like adding a new Allergy or Condition).

