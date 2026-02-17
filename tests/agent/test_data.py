"""
Layer 4: Test data for full journey E2E test.

Contains complete, realistic clinical data:
- Clinic registration details
- Full clinic configuration (medications, packages, lenses, staff)
- 3 diverse patient profiles with different conditions
"""

import time

# Unique suffix per test run to avoid clinic name/email collisions
_suffix = str(int(time.time()))[-6:]

# ---------------------------------------------------------------------------
# Clinic Registration
# ---------------------------------------------------------------------------

CLINIC_REGISTRATION = {
    "clinic_name": f"ClearView Eye Center {_suffix}",
    "clinic_address": "123 Vision Boulevard",
    "clinic_city": "San Jose",
    "clinic_state": "California",
    "clinic_zip": "95110",
    "clinic_phone": "(408) 555-2020",
    "admin_name": "Dr. Meera Reddy",
    "admin_email": f"clearview{_suffix}@test.com",
    "admin_password": "clearview123",
}

# ---------------------------------------------------------------------------
# Full Clinic Configuration
# ---------------------------------------------------------------------------

CLINIC_CONFIG = {
    "clinic_profile": {
        "clinic_id": "",  # Will be set dynamically after registration
        "name": CLINIC_REGISTRATION["clinic_name"],
        "parent_organization": "ClearView Ophthalmology Group",
        "address": {
            "street": "123 Vision Boulevard",
            "city": "San Jose",
            "state": "California",
            "zip": "95110",
        },
        "contact_info": {
            "phone_main": "(408) 555-2020",
            "phone_surgical_coordinator": "(408) 555-2021",
            "fax": "(408) 555-2022",
            "emergency_hotline": "(408) 555-9999",
            "website": "https://clearvieweye.example.com",
        },
        "branding": {
            "logo_url": "",
            "primary_color_hex": "#1E3A5F",
        },
    },

    "staff_directory": [
        {
            "provider_id": "DR001",
            "name": "Dr. Meera Reddy",
            "role": "Surgeon",
            "specialty": "Cataract & Refractive Surgery",
            "qualifications": ["MD", "FACS", "Board Certified Ophthalmologist"],
            "experience_years": 15,
            "availability": {
                "surgery_days": ["Tuesday", "Thursday"],
                "consultation_days": ["Monday", "Wednesday", "Friday"],
                "consultation_hours": "9:00 AM - 5:00 PM",
            },
        },
        {
            "provider_id": "DR002",
            "name": "Dr. Anil Kapoor",
            "role": "Optometrist",
            "specialty": "Pre and Post-operative Care",
            "qualifications": ["OD", "FAAO"],
            "experience_years": 10,
            "availability": {
                "surgery_days": [],
                "consultation_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                "consultation_hours": "8:00 AM - 4:00 PM",
            },
        },
        {
            "provider_id": "ST001",
            "name": "Kavitha Nair",
            "role": "Patient Counselor",
            "specialty": "Surgical Coordination & Patient Education",
            "qualifications": ["Certified Ophthalmic Assistant"],
            "experience_years": 8,
            "availability": {
                "surgery_days": ["Tuesday", "Thursday"],
                "consultation_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                "consultation_hours": "8:30 AM - 5:30 PM",
            },
        },
    ],

    "surgical_packages": [
        {
            "package_id": "standard",
            "display_name": "Standard Package",
            "description": "Basic cataract removal with standard monofocal IOL. Covers pre-op assessment, surgery, and 3 post-op visits.",
            "price_cash": 3500,
            "includes_laser": False,
            "allowed_lens_codes": ["MONO_STD_ACRYSOF", "MONO_STD_CLAREON"],
            "insurance_coverage": "Most insurance plans cover standard cataract surgery",
            "fees_breakdown": {
                "physician_fee": 1500,
                "facility_fee": 1500,
                "total_estimated": 3500,
            },
            "notes": "Includes pre-op assessment, surgery, and 3 post-op visits",
        },
        {
            "package_id": "premium",
            "display_name": "Premium Package",
            "description": "Laser-assisted cataract surgery with premium or toric IOL. Includes femtosecond laser and ORA wavefront guidance.",
            "price_cash": 5500,
            "includes_laser": True,
            "allowed_lens_codes": ["MONO_PREM_CLAREON", "TORIC_ACRYSOF", "TORIC_CLAREON", "EDOF_VIVITY"],
            "insurance_coverage": "Insurance covers basic surgery; patient pays upgrade fee for premium lens",
            "fees_breakdown": {
                "physician_fee": 2000,
                "facility_fee": 2000,
                "total_estimated": 5500,
            },
            "notes": "Includes femtosecond laser, premium IOL, ORA guidance",
        },
        {
            "package_id": "advanced",
            "display_name": "Advanced Package",
            "description": "Full premium experience with multifocal or EDOF IOL for maximum spectacle independence.",
            "price_cash": 8000,
            "includes_laser": True,
            "allowed_lens_codes": ["MF_PANOPTIX", "MF_SYNERGY", "EDOF_VIVITY", "EDOF_TORIC_VIVITY", "MF_TORIC_PANOPTIX"],
            "insurance_coverage": "Insurance covers basic surgery; patient pays upgrade fee",
            "fees_breakdown": {
                "physician_fee": 3000,
                "facility_fee": 3000,
                "total_estimated": 8000,
            },
            "notes": "Includes femtosecond laser, premium IOL, ORA guidance, enhanced recovery protocol",
        },
    ],

    "lens_inventory": {
        "MONOFOCAL": {
            "display_name": "Standard Monofocal",
            "description": "Single focus lens providing clear vision at one distance (usually far). Most common and proven option.",
            "has_toric_variant": True,
            "models": [
                {
                    "manufacturer": "Alcon",
                    "model": "AcrySof IQ SN60WF",
                    "model_code": "MONO_STD_ACRYSOF",
                    "description": "Proven monofocal with blue-light filtering and aspheric optics",
                },
                {
                    "manufacturer": "Alcon",
                    "model": "Clareon SY60WF",
                    "model_code": "MONO_STD_CLAREON",
                    "description": "Next-gen monofocal with superior clarity and reduced glistening",
                },
                {
                    "manufacturer": "Alcon",
                    "model": "Clareon CNA0T0",
                    "model_code": "MONO_PREM_CLAREON",
                    "description": "Premium Clareon monofocal with enhanced optical quality",
                },
            ],
        },
        "MONOFOCAL_TORIC": {
            "display_name": "Monofocal Toric",
            "description": "Corrects astigmatism while providing clear single-focus vision. Reduces or eliminates the need for glasses at the chosen focal point.",
            "parent_category": "MONOFOCAL",
            "is_toric": True,
            "models": [
                {
                    "manufacturer": "Alcon",
                    "model": "AcrySof IQ Toric SN6AT",
                    "model_code": "TORIC_ACRYSOF",
                    "toric_range": "1.0D - 6.0D cylinder",
                    "description": "Astigmatism-correcting monofocal IOL with proven rotational stability",
                },
                {
                    "manufacturer": "Alcon",
                    "model": "Clareon Toric CNA3T",
                    "model_code": "TORIC_CLAREON",
                    "toric_range": "1.0D - 3.75D cylinder",
                    "description": "Premium toric with enhanced rotational stability and clarity",
                },
            ],
        },
        "EDOF": {
            "display_name": "Extended Depth of Focus",
            "description": "Provides continuous range of vision from distance to intermediate, with minimal halos and glare.",
            "has_toric_variant": True,
            "models": [
                {
                    "manufacturer": "Alcon",
                    "model": "AcrySof IQ Vivity DFT015",
                    "model_code": "EDOF_VIVITY",
                    "description": "Non-diffractive EDOF lens with X-WAVE technology for seamless distance-to-intermediate vision",
                },
            ],
        },
        "EDOF_TORIC": {
            "display_name": "EDOF Toric",
            "description": "Extended depth of focus with built-in astigmatism correction.",
            "parent_category": "EDOF",
            "is_toric": True,
            "models": [
                {
                    "manufacturer": "Alcon",
                    "model": "AcrySof IQ Vivity Toric DFT315",
                    "model_code": "EDOF_TORIC_VIVITY",
                    "toric_range": "1.0D - 3.75D cylinder",
                    "description": "EDOF with built-in astigmatism correction for extended vision range",
                },
            ],
        },
        "MULTIFOCAL": {
            "display_name": "Multifocal / Trifocal",
            "description": "Multiple focus points for distance, intermediate, and near vision. Best option for maximum spectacle independence.",
            "has_toric_variant": True,
            "models": [
                {
                    "manufacturer": "Alcon",
                    "model": "AcrySof IQ PanOptix TFNT00",
                    "model_code": "MF_PANOPTIX",
                    "description": "Trifocal IOL providing excellent near (40cm), intermediate (60cm), and distance vision",
                },
                {
                    "manufacturer": "Johnson & Johnson Vision",
                    "model": "TECNIS Synergy DFR00V",
                    "model_code": "MF_SYNERGY",
                    "description": "Combines EDOF and diffractive technology for continuous range of vision",
                },
            ],
        },
        "MULTIFOCAL_TORIC": {
            "display_name": "Multifocal Toric",
            "description": "Full range of vision with astigmatism correction for maximum glasses-free living.",
            "parent_category": "MULTIFOCAL",
            "is_toric": True,
            "models": [
                {
                    "manufacturer": "Alcon",
                    "model": "AcrySof IQ PanOptix Toric TFNT",
                    "model_code": "MF_TORIC_PANOPTIX",
                    "toric_range": "1.0D - 2.25D cylinder",
                    "description": "Trifocal with astigmatism correction",
                },
            ],
        },
        "LAL": {
            "display_name": "Light Adjustable Lens",
            "description": "Unique lens that can be precisely adjusted after surgery using UV light treatments to fine-tune your vision.",
            "has_toric_variant": False,
            "models": [
                {
                    "manufacturer": "RxSight",
                    "model": "RxSight LAL",
                    "model_code": "LAL_RXSIGHT",
                    "description": "Post-operatively adjustable IOL for fine-tuned customized vision",
                },
            ],
        },
    },

    "medications": {
        "pre_op": {
            "antibiotics": [
                "Moxifloxacin 0.5% (Vigamox) - 1 drop 4 times daily",
                "Besivance 0.6% - 1 drop 3 times daily",
            ],
            "frequencies": [
                "4 times daily for 3 days before surgery",
                "3 times daily for 3 days before surgery",
            ],
            "default_start_days_before_surgery": 3,
        },
        "post_op": {
            "antibiotics": [
                "Moxifloxacin 0.5% (Vigamox) - 1 drop 4 times daily for 1 week",
            ],
            "nsaids": [
                "Nepafenac 0.3% (Ilevro) - 1 drop daily for 4 weeks",
                "Ketorolac 0.5% (Acular LS) - 1 drop 4 times daily for 2 weeks",
            ],
            "steroids": [
                "Prednisolone acetate 1% (Pred Forte) - 1 drop 4 times daily, taper over 4 weeks",
                "Difluprednate 0.05% (Durezol) - 1 drop 4 times daily for 2 weeks, then twice daily for 2 weeks",
            ],
            "glaucoma_drops": [],
            "combination_drops": [],
            "dropless_option": {
                "available": True,
                "description": "Intracameral injection of antibiotics and steroids at the end of surgery, reducing the need for eye drops post-operatively.",
                "medications": [
                    "Moxifloxacin 500mcg/0.1mL intracameral",
                    "Triamcinolone acetonide 2mg/0.05mL intracameral",
                ],
            },
        },
        "frequency_options": [
            "4 times daily",
            "3 times daily",
            "2 times daily",
            "Once daily",
            "Every 2 hours",
            "As needed",
        ],
    },

    "standard_operating_procedures": {
        "procedure_codes": ["CPT 66984 - Standard Cataract Surgery", "CPT 66982 - Complex Cataract Surgery"],
        "risks_categorized": {
            "common_minor": [
                "Mild eye discomfort for 1-2 days",
                "Temporary blurry vision during healing",
                "Mild light sensitivity",
                "Slight itching or foreign body sensation",
            ],
            "rare_serious": [
                "Infection (endophthalmitis) - <0.1%",
                "Retinal detachment - <0.5%",
                "Posterior capsule opacity (secondary cataract) - 10-20% within 5 years",
                "Cystoid macular edema",
                "Intraocular pressure elevation",
                "IOL dislocation",
            ],
        },
    },
}


# ---------------------------------------------------------------------------
# 3 Diverse Patient Profiles
# ---------------------------------------------------------------------------

PATIENT_PROFILES = [
    # ----- Patient A: Rajesh Kumar (elderly, diabetic, standard monofocal) -----
    {
        "first_name": "Rajesh",
        "last_name": "Kumar",
        "phone": "9880010001",
        "chatbot_question": "Will my diabetes affect my cataract surgery recovery?",
        "expected_module_keywords": {
            "diagnosis": ["nuclear sclerosis", "grade III"],
            "iol_options": ["monofocal", "standard"],
            "medications": ["Moxifloxacin", "Prednisolone"],
        },
        "clinical_data": {
            "patient_identity": {
                "patient_id": "",
                "clinic_ref_id": "",
                "first_name": "Rajesh",
                "middle_name": "",
                "last_name": "Kumar",
                "dob": "1957-06-15",
                "gender": "Male",
            },
            "medical_profile": {
                "systemic_conditions": [
                    "Type 2 Diabetes Mellitus (controlled, HbA1c 7.2%)",
                    "Hypertension (on medication)",
                    "Hyperlipidemia",
                ],
                "medications_systemic": [
                    "Metformin 500mg twice daily",
                    "Lisinopril 10mg daily",
                    "Atorvastatin 20mg daily",
                    "Aspirin 81mg daily",
                ],
                "allergies": ["No known drug allergies"],
                "review_of_systems": [],
                "surgical_history": {
                    "non_ocular": ["Coronary stent placement 2019"],
                    "ocular": [],
                },
            },
            "clinical_context": {
                "od_right": {
                    "pathology": "Nuclear sclerosis Grade III with mild cortical changes. Early diabetic retinopathy (mild NPDR, no macular edema).",
                    "primary_cataract_type": "nuclear_sclerosis",
                    "visual_acuity": {"ucva": "20/80", "bcva": "20/50"},
                    "biometry": {
                        "iol_master": {
                            "source": "IOLMaster 700",
                            "axial_length_mm": 23.45,
                            "acd_mm": 3.15,
                            "wtw_mm": 11.7,
                            "cct_um": 548,
                            "flat_k_k1": 43.25,
                            "steep_k_k2": 43.75,
                            "astigmatism_power": 0.50,
                            "axis": 92,
                            "k_type": "Simulated K",
                        },
                        "pentacam_topography": {
                            "source": "",
                            "astigmatism_power": None,
                            "axis": None,
                            "cct_um": None,
                            "belin_ambrosio_score": None,
                        },
                    },
                },
                "os_left": {
                    "pathology": "Nuclear sclerosis Grade II. Mild NPDR, no macular edema.",
                    "primary_cataract_type": "nuclear_sclerosis",
                    "visual_acuity": {"ucva": "20/60", "bcva": "20/40"},
                    "biometry": {
                        "iol_master": {
                            "source": "IOLMaster 700",
                            "axial_length_mm": 23.52,
                            "acd_mm": 3.18,
                            "wtw_mm": 11.8,
                            "cct_um": 551,
                            "flat_k_k1": 43.50,
                            "steep_k_k2": 43.90,
                            "astigmatism_power": 0.40,
                            "axis": 88,
                            "k_type": "Simulated K",
                        },
                        "pentacam_topography": {
                            "source": "",
                            "astigmatism_power": None,
                            "axis": None,
                            "cct_um": None,
                            "belin_ambrosio_score": None,
                        },
                    },
                },
                "ocular_comorbidities": [
                    "Mild non-proliferative diabetic retinopathy (NPDR) OU",
                    "Dry eye syndrome",
                ],
                "clinical_alerts": [],
            },
            "lifestyle_profile": {
                "occupation": "Retired school teacher",
                "hobbies": ["Reading", "Gardening", "Playing with grandchildren"],
                "visual_goals": {
                    "primary_zone": "distance",
                    "spectacle_independence_desire": "low",
                },
                "personality_traits": {
                    "perfectionism_score": None,
                    "risk_tolerance": "low",
                },
                "symptoms_impact": {
                    "night_driving_difficulty": True,
                    "glare_halos": True,
                },
            },
            "surgical_plan": {
                "same_plan_both_eyes": True,
                "candidacy_profile": {
                    "od_right": {
                        "is_candidate_multifocal": False,
                        "is_candidate_edof": False,
                        "is_candidate_toric": False,
                        "is_candidate_lal": False,
                    },
                    "os_left": {
                        "is_candidate_multifocal": False,
                        "is_candidate_edof": False,
                        "is_candidate_toric": False,
                        "is_candidate_lal": False,
                    },
                },
                "offered_packages": ["standard"],
                "offered_packages_od": [],
                "offered_packages_os": [],
                "patient_selection": {
                    "selected_package_id": "standard",
                    "status": "confirmed",
                    "selection_date": "2026-02-10",
                },
                "patient_selection_od": {},
                "patient_selection_os": {},
                "operative_logistics": {
                    "od_right": {
                        "status": "scheduled",
                        "surgery_date": "2026-03-15",
                        "arrival_time": "6:30 AM",
                        "lens_order": {
                            "model_name": "AcrySof IQ SN60WF",
                            "model_code": "MONO_STD_ACRYSOF",
                            "power": "+21.0D",
                            "cylinder": "",
                            "axis_alignment": "",
                        },
                    },
                    "os_left": {
                        "status": "planned",
                        "surgery_date": "2026-04-12",
                        "arrival_time": "6:30 AM",
                        "lens_order": {
                            "model_name": "AcrySof IQ SN60WF",
                            "model_code": "MONO_STD_ACRYSOF",
                            "power": "+20.5D",
                            "cylinder": "",
                            "axis_alignment": "",
                        },
                    },
                },
            },
            "medications_plan": {
                "settings": {
                    "pre_op_protocol_type": "standard",
                    "post_op_protocol_type": "standard",
                    "glaucoma_meds_instruction": "",
                },
                "pre_op_schedule": {
                    "instruction": "Start eye drops 3 days before surgery. Note: Continue all diabetic and blood pressure medications as usual. Do NOT stop Aspirin.",
                    "medications": [
                        {"name": "Moxifloxacin 0.5% (Vigamox)", "frequency": "4 times daily", "duration": "3 days before surgery"},
                    ],
                },
                "post_op_schedule": {
                    "instruction": "Use eye drops as directed. Do not rub your eye. Wear the protective shield at night for 1 week.",
                    "medications": [
                        {"name": "Moxifloxacin 0.5% (Vigamox)", "frequency": "4 times daily", "duration": "1 week"},
                        {"name": "Prednisolone acetate 1% (Pred Forte)", "frequency": "4 times daily", "duration": "Taper over 4 weeks"},
                        {"name": "Nepafenac 0.3% (Ilevro)", "frequency": "Once daily", "duration": "4 weeks"},
                    ],
                },
            },
            "chat_history": [],
            "module_content": {},
        },
    },

    # ----- Patient B: Priya Sharma (middle-aged, high astigmatism, toric) -----
    {
        "first_name": "Priya",
        "last_name": "Sharma",
        "phone": "9880020002",
        "chatbot_question": "Why do I need a toric lens for my astigmatism, and how is it different from a regular lens?",
        "expected_module_keywords": {
            "diagnosis": ["cortical", "astigmatism"],
            "iol_options": ["toric", "astigmatism"],
            "medications": ["Moxifloxacin", "Durezol"],
        },
        "clinical_data": {
            "patient_identity": {
                "patient_id": "",
                "clinic_ref_id": "",
                "first_name": "Priya",
                "middle_name": "",
                "last_name": "Sharma",
                "dob": "1974-03-22",
                "gender": "Female",
            },
            "medical_profile": {
                "systemic_conditions": [],
                "medications_systemic": [],
                "allergies": ["Penicillin", "Latex"],
                "review_of_systems": [],
                "surgical_history": {
                    "non_ocular": [],
                    "ocular": ["LASIK right eye 2008 (corrected -3.50D myopia)"],
                },
            },
            "clinical_context": {
                "od_right": {
                    "pathology": "Cortical cataract with spoke-like opacities extending toward visual axis. Prior LASIK noted — keratometry adjusted for post-refractive calculations.",
                    "primary_cataract_type": "cortical",
                    "visual_acuity": {"ucva": "20/50", "bcva": "20/30"},
                    "biometry": {
                        "iol_master": {
                            "source": "IOLMaster 700",
                            "axial_length_mm": 25.10,
                            "acd_mm": 3.45,
                            "wtw_mm": 12.1,
                            "cct_um": 510,
                            "flat_k_k1": 41.00,
                            "steep_k_k2": 43.75,
                            "astigmatism_power": 2.75,
                            "axis": 175,
                            "k_type": "Adjusted K (post-LASIK)",
                        },
                        "pentacam_topography": {
                            "source": "Pentacam HR",
                            "astigmatism_power": 2.80,
                            "axis": 178,
                            "cct_um": 508,
                            "belin_ambrosio_score": None,
                        },
                    },
                },
                "os_left": {
                    "pathology": "Early cortical cataract, not visually significant. No prior LASIK on this eye.",
                    "primary_cataract_type": "cortical",
                    "visual_acuity": {"ucva": "20/25", "bcva": "20/20"},
                    "biometry": {
                        "iol_master": {
                            "source": "IOLMaster 700",
                            "axial_length_mm": 24.80,
                            "acd_mm": 3.40,
                            "wtw_mm": 12.0,
                            "cct_um": 535,
                            "flat_k_k1": 42.50,
                            "steep_k_k2": 43.25,
                            "astigmatism_power": 0.75,
                            "axis": 5,
                            "k_type": "Simulated K",
                        },
                        "pentacam_topography": {
                            "source": "",
                            "astigmatism_power": None,
                            "axis": None,
                            "cct_um": None,
                            "belin_ambrosio_score": None,
                        },
                    },
                },
                "ocular_comorbidities": [
                    "Post-LASIK cornea OD (2008)",
                    "Mild dry eye",
                ],
                "clinical_alerts": [],
            },
            "lifestyle_profile": {
                "occupation": "Corporate attorney",
                "hobbies": ["Tennis", "Driving", "Photography"],
                "visual_goals": {
                    "primary_zone": "distance",
                    "spectacle_independence_desire": "moderate",
                },
                "personality_traits": {
                    "perfectionism_score": None,
                    "risk_tolerance": "moderate",
                },
                "symptoms_impact": {
                    "night_driving_difficulty": True,
                    "glare_halos": True,
                },
            },
            "surgical_plan": {
                "same_plan_both_eyes": False,
                "candidacy_profile": {
                    "od_right": {
                        "is_candidate_multifocal": False,
                        "is_candidate_edof": False,
                        "is_candidate_toric": True,
                        "is_candidate_lal": False,
                    },
                    "os_left": {
                        "is_candidate_multifocal": False,
                        "is_candidate_edof": False,
                        "is_candidate_toric": False,
                        "is_candidate_lal": False,
                    },
                },
                "offered_packages": ["premium"],
                "offered_packages_od": ["premium"],
                "offered_packages_os": [],
                "patient_selection": {
                    "selected_package_id": "premium",
                    "status": "confirmed",
                    "selection_date": "2026-02-08",
                },
                "patient_selection_od": {
                    "selected_package_id": "premium",
                    "status": "confirmed",
                    "selection_date": "2026-02-08",
                },
                "patient_selection_os": {},
                "operative_logistics": {
                    "od_right": {
                        "status": "scheduled",
                        "surgery_date": "2026-03-20",
                        "arrival_time": "7:00 AM",
                        "lens_order": {
                            "model_name": "Clareon Toric CNA3T",
                            "model_code": "TORIC_CLAREON",
                            "power": "+19.0D",
                            "cylinder": "T4 (2.06D)",
                            "axis_alignment": "175 degrees",
                        },
                    },
                    "os_left": {
                        "status": "monitoring",
                        "surgery_date": "",
                        "arrival_time": "",
                        "lens_order": {},
                    },
                },
            },
            "medications_plan": {
                "settings": {
                    "pre_op_protocol_type": "standard",
                    "post_op_protocol_type": "standard",
                    "glaucoma_meds_instruction": "",
                },
                "pre_op_schedule": {
                    "instruction": "Start eye drops 3 days before surgery in the RIGHT eye only. NOTE: Patient has Penicillin allergy — Moxifloxacin is safe (fluoroquinolone, not penicillin-class).",
                    "medications": [
                        {"name": "Moxifloxacin 0.5% (Vigamox)", "frequency": "4 times daily", "duration": "3 days before surgery"},
                    ],
                },
                "post_op_schedule": {
                    "instruction": "Right eye only. Use drops as directed. Avoid rubbing or pressing on the eye — critical for toric lens stability.",
                    "medications": [
                        {"name": "Moxifloxacin 0.5% (Vigamox)", "frequency": "4 times daily", "duration": "1 week"},
                        {"name": "Difluprednate 0.05% (Durezol)", "frequency": "4 times daily for 2 weeks, then twice daily for 2 weeks", "duration": "4 weeks"},
                        {"name": "Ketorolac 0.5% (Acular LS)", "frequency": "4 times daily", "duration": "2 weeks"},
                    ],
                },
            },
            "chat_history": [],
            "module_content": {},
        },
    },

    # ----- Patient C: Amit Patel (young, multifocal, wants glasses-free) -----
    {
        "first_name": "Amit",
        "last_name": "Patel",
        "phone": "9880030003",
        "chatbot_question": "Can I get rid of my reading glasses completely with the multifocal lens? What are the trade-offs?",
        "expected_module_keywords": {
            "diagnosis": ["posterior subcapsular"],
            "iol_options": ["multifocal", "PanOptix"],
            "medications": ["Moxifloxacin", "Pred Forte"],
        },
        "clinical_data": {
            "patient_identity": {
                "patient_id": "",
                "clinic_ref_id": "",
                "first_name": "Amit",
                "middle_name": "",
                "last_name": "Patel",
                "dob": "1981-11-08",
                "gender": "Male",
            },
            "medical_profile": {
                "systemic_conditions": [
                    "Asthma (mild, well-controlled)",
                ],
                "medications_systemic": [
                    "Albuterol inhaler as needed",
                    "Montelukast 10mg daily",
                ],
                "allergies": ["Sulfonamide antibiotics", "Iodine contrast dye"],
                "review_of_systems": [],
                "surgical_history": {
                    "non_ocular": [],
                    "ocular": [],
                },
            },
            "clinical_context": {
                "od_right": {
                    "pathology": "Posterior subcapsular cataract (PSC) centrally located, significantly impacting near and intermediate vision. Likely steroid-related (history of inhaled corticosteroids).",
                    "primary_cataract_type": "posterior_subcapsular",
                    "visual_acuity": {"ucva": "20/40", "bcva": "20/30"},
                    "biometry": {
                        "iol_master": {
                            "source": "IOLMaster 700",
                            "axial_length_mm": 23.80,
                            "acd_mm": 3.52,
                            "wtw_mm": 11.9,
                            "cct_um": 540,
                            "flat_k_k1": 44.00,
                            "steep_k_k2": 45.25,
                            "astigmatism_power": 1.25,
                            "axis": 15,
                            "k_type": "Simulated K",
                        },
                        "pentacam_topography": {
                            "source": "Pentacam HR",
                            "astigmatism_power": 1.30,
                            "axis": 12,
                            "cct_um": 538,
                            "belin_ambrosio_score": None,
                        },
                    },
                },
                "os_left": {
                    "pathology": "Early posterior subcapsular cataract. Asymptomatic currently but expected to progress.",
                    "primary_cataract_type": "posterior_subcapsular",
                    "visual_acuity": {"ucva": "20/30", "bcva": "20/25"},
                    "biometry": {
                        "iol_master": {
                            "source": "IOLMaster 700",
                            "axial_length_mm": 23.75,
                            "acd_mm": 3.50,
                            "wtw_mm": 11.9,
                            "cct_um": 542,
                            "flat_k_k1": 44.25,
                            "steep_k_k2": 45.00,
                            "astigmatism_power": 0.75,
                            "axis": 170,
                            "k_type": "Simulated K",
                        },
                        "pentacam_topography": {
                            "source": "",
                            "astigmatism_power": None,
                            "axis": None,
                            "cct_um": None,
                            "belin_ambrosio_score": None,
                        },
                    },
                },
                "ocular_comorbidities": [],
                "clinical_alerts": [],
            },
            "lifestyle_profile": {
                "occupation": "Software engineer",
                "hobbies": ["Gaming", "Hiking", "Cycling"],
                "visual_goals": {
                    "primary_zone": "intermediate",
                    "spectacle_independence_desire": "high",
                },
                "personality_traits": {
                    "perfectionism_score": None,
                    "risk_tolerance": "high",
                },
                "symptoms_impact": {
                    "night_driving_difficulty": False,
                    "glare_halos": True,
                },
            },
            "surgical_plan": {
                "same_plan_both_eyes": True,
                "candidacy_profile": {
                    "od_right": {
                        "is_candidate_multifocal": True,
                        "is_candidate_edof": True,
                        "is_candidate_toric": False,
                        "is_candidate_lal": True,
                    },
                    "os_left": {
                        "is_candidate_multifocal": True,
                        "is_candidate_edof": True,
                        "is_candidate_toric": False,
                        "is_candidate_lal": True,
                    },
                },
                "offered_packages": ["advanced", "premium"],
                "offered_packages_od": [],
                "offered_packages_os": [],
                "patient_selection": {
                    "selected_package_id": "advanced",
                    "status": "confirmed",
                    "selection_date": "2026-02-12",
                },
                "patient_selection_od": {},
                "patient_selection_os": {},
                "operative_logistics": {
                    "od_right": {
                        "status": "scheduled",
                        "surgery_date": "2026-03-25",
                        "arrival_time": "6:00 AM",
                        "lens_order": {
                            "model_name": "AcrySof IQ PanOptix TFNT00",
                            "model_code": "MF_PANOPTIX",
                            "power": "+22.5D",
                            "cylinder": "",
                            "axis_alignment": "",
                        },
                    },
                    "os_left": {
                        "status": "planned",
                        "surgery_date": "2026-04-22",
                        "arrival_time": "6:00 AM",
                        "lens_order": {
                            "model_name": "AcrySof IQ PanOptix TFNT00",
                            "model_code": "MF_PANOPTIX",
                            "power": "+22.0D",
                            "cylinder": "",
                            "axis_alignment": "",
                        },
                    },
                },
            },
            "medications_plan": {
                "settings": {
                    "pre_op_protocol_type": "standard",
                    "post_op_protocol_type": "standard",
                    "glaucoma_meds_instruction": "",
                },
                "pre_op_schedule": {
                    "instruction": "Start eye drops 3 days before surgery. NOTE: Patient is allergic to Sulfonamide — avoid any sulfa-containing medications. Continue asthma medications as normal.",
                    "medications": [
                        {"name": "Moxifloxacin 0.5% (Vigamox)", "frequency": "4 times daily", "duration": "3 days before surgery"},
                    ],
                },
                "post_op_schedule": {
                    "instruction": "Use drops as directed. Expect some halos/glare for 4-8 weeks as your brain adapts to the multifocal lens (neuroadaptation). This is normal and improves over time.",
                    "medications": [
                        {"name": "Moxifloxacin 0.5% (Vigamox)", "frequency": "4 times daily", "duration": "1 week"},
                        {"name": "Prednisolone acetate 1% (Pred Forte)", "frequency": "4 times daily", "duration": "Taper over 4 weeks"},
                        {"name": "Nepafenac 0.3% (Ilevro)", "frequency": "Once daily", "duration": "4 weeks"},
                    ],
                },
            },
            "chat_history": [],
            "module_content": {},
        },
    },
]
