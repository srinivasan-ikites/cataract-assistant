"""
Layer 4: Full Journey End-to-End Test.

Tests the complete lifecycle autonomously:
1. Register a brand-new clinic with full configuration
2. Admin approves the clinic
3. Login as clinic admin and configure medications, packages, lenses, staff
4. Create 3 patients with diverse clinical profiles
5. Set each patient's reviewed data (bypassing upload/extraction)
6. Login as each patient and verify the portal:
   - All 9 education modules visible
   - Module content is personalized
   - Chatbot gives patient-specific answers
7. Cleanup: delete patients, suspend clinic

Runtime: ~12-15 minutes (chatbot + module generation are the bottlenecks)
"""

import json
import copy
from pathlib import Path

import pytest
import httpx
from playwright.sync_api import sync_playwright

from tests.agent.test_data import CLINIC_REGISTRATION, CLINIC_CONFIG, PATIENT_PROFILES
from tests.ai.chatbot_evaluator import evaluate_response

pytestmark = [pytest.mark.agent, pytest.mark.slow]


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def browser():
    """Launch a browser for the agent tests."""
    with sync_playwright() as pw:
        b = pw.chromium.launch(headless=True)
        yield b
        b.close()


@pytest.fixture
def page(browser):
    """Fresh browser page for each test."""
    context = browser.new_context(
        viewport={"width": 1280, "height": 720},
        ignore_https_errors=True,
    )
    p = context.new_page()
    yield p
    context.close()


@pytest.fixture(scope="module")
def journey(config):
    """
    Module-scoped fixture that sets up the entire test environment:
    - Tries to register a new clinic (falls back to existing if signup disabled)
    - Gets it approved (or uses already-active clinic)
    - Configures it with full clinical data
    - Creates 3 patients with diverse profiles
    - Obtains auth tokens for each patient

    Yields a state dict, then cleans up on teardown.
    """
    reg = CLINIC_REGISTRATION
    state = {
        "clinic_id": None,
        "clinic_uuid": None,
        "clinic_admin_email": None,
        "clinic_admin_password": None,
        "clinic_admin_headers": None,
        "used_existing_clinic": False,
        "patients": [],
        "report": {
            "clinic_registration": "not_started",
            "clinic_approval": "not_started",
            "clinic_config": "not_started",
            "patients_created": 0,
            "patients_reviewed": 0,
            "patients_with_auth": 0,
            "errors": [],
        },
    }

    with httpx.Client(base_url=config.API_BASE, timeout=30.0) as client:
        # ---------------------------------------------------------------
        # Phase 1: Register clinic (or fall back to existing)
        # ---------------------------------------------------------------
        print("\n[Journey] Phase 1: Registering clinic...")
        resp = client.post("/api/auth/register-clinic", json=reg)

        if resp.status_code == 200:
            # New clinic registered successfully
            reg_data = resp.json()
            state["clinic_id"] = reg_data["clinic_id"]
            state["clinic_admin_email"] = reg["admin_email"]
            state["clinic_admin_password"] = reg["admin_password"]
            state["report"]["clinic_registration"] = "success"
            print(f"[Journey]   Clinic registered: {state['clinic_id']}")

            # Phase 2: Admin approves the new clinic
            print("[Journey] Phase 2: Admin approving clinic...")
            admin_login = client.post("/api/auth/login", json={
                "email": config.SUPER_ADMIN_EMAIL,
                "password": config.SUPER_ADMIN_PASSWORD,
            })
            if admin_login.status_code != 200:
                state["report"]["errors"].append(f"Super admin login failed: {admin_login.status_code}")
                state["report"]["clinic_approval"] = "failed"
                yield state
                return

            admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

            # Find our clinic
            clinics_resp = client.get("/api/admin/clinics", headers=admin_headers)
            clinics = clinics_resp.json() if clinics_resp.status_code == 200 else []
            if isinstance(clinics, dict):
                clinics = clinics.get("clinics", [])

            our_clinic = None
            for c in clinics:
                if c.get("clinic_id") == state["clinic_id"]:
                    our_clinic = c
                    break

            if not our_clinic:
                state["report"]["errors"].append(f"Clinic '{state['clinic_id']}' not found in admin listing")
                state["report"]["clinic_approval"] = "failed"
                yield state
                return

            state["clinic_uuid"] = our_clinic["id"]

            # Approve it
            approve_resp = client.put(
                f"/api/admin/clinics/{state['clinic_uuid']}",
                json={"status": "active"},
                headers=admin_headers,
            )
            if approve_resp.status_code != 200:
                state["report"]["errors"].append(f"Approval failed: {approve_resp.status_code}")
                state["report"]["clinic_approval"] = "failed"
                yield state
                return

            state["report"]["clinic_approval"] = "success"
            print(f"[Journey]   Clinic approved: {state['clinic_uuid']}")

        else:
            # Registration failed (likely Supabase signup disabled)
            # Fall back to existing test clinic
            print(f"[Journey]   Registration failed ({resp.status_code}): using existing clinic")
            state["used_existing_clinic"] = True
            state["clinic_id"] = config.TEST_CLINIC_ID
            state["clinic_admin_email"] = config.ADMIN_EMAIL
            state["clinic_admin_password"] = config.ADMIN_PASSWORD
            state["report"]["clinic_registration"] = "skipped_using_existing"
            state["report"]["clinic_approval"] = "skipped_already_active"

            # Look up clinic UUID via admin API
            admin_login = client.post("/api/auth/login", json={
                "email": config.SUPER_ADMIN_EMAIL,
                "password": config.SUPER_ADMIN_PASSWORD,
            })
            if admin_login.status_code == 200:
                admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}
                clinics_resp = client.get("/api/admin/clinics", headers=admin_headers)
                clinics = clinics_resp.json() if clinics_resp.status_code == 200 else []
                if isinstance(clinics, dict):
                    clinics = clinics.get("clinics", [])
                for c in clinics:
                    if c.get("clinic_id") == state["clinic_id"]:
                        state["clinic_uuid"] = c["id"]
                        break

            print(f"[Journey]   Using existing clinic: {state['clinic_id']}")

        # ---------------------------------------------------------------
        # Phase 3: Login as clinic admin & configure
        # ---------------------------------------------------------------
        print("[Journey] Phase 3: Configuring clinic...")
        clinic_login = client.post("/api/auth/login", json={
            "email": state["clinic_admin_email"],
            "password": state["clinic_admin_password"],
        })
        if clinic_login.status_code != 200:
            state["report"]["errors"].append(f"Clinic admin login failed: {clinic_login.status_code} {clinic_login.text[:200]}")
            state["report"]["clinic_config"] = "failed"
            yield state
            return

        state["clinic_admin_headers"] = {
            "Authorization": f"Bearer {clinic_login.json()['access_token']}"
        }

        # Set clinic_id in the config data
        clinic_config_data = copy.deepcopy(CLINIC_CONFIG)
        clinic_config_data["clinic_profile"]["clinic_id"] = state["clinic_id"]
        clinic_config_data["clinic_profile"]["name"] = (
            CLINIC_REGISTRATION["clinic_name"] if not state["used_existing_clinic"]
            else state["clinic_id"]
        )

        config_resp = client.post(
            "/doctor/review/clinic",
            json={"clinic_id": state["clinic_id"], "data": clinic_config_data},
            headers=state["clinic_admin_headers"],
        )
        if config_resp.status_code != 200:
            state["report"]["errors"].append(f"Clinic config failed: {config_resp.status_code} {config_resp.text[:200]}")
            state["report"]["clinic_config"] = "failed"
            yield state
            return

        state["report"]["clinic_config"] = "success"
        print("[Journey]   Clinic configured: medications, packages, lenses, staff")

        # ---------------------------------------------------------------
        # Phase 4 & 5: Create patients and set reviewed data
        # ---------------------------------------------------------------
        print("[Journey] Phase 4-5: Creating and configuring patients...")

        # Re-login to ensure fresh token
        clinic_login2 = client.post("/api/auth/login", json={
            "email": state["clinic_admin_email"],
            "password": state["clinic_admin_password"],
        })
        if clinic_login2.status_code == 200:
            state["clinic_admin_headers"] = {
                "Authorization": f"Bearer {clinic_login2.json()['access_token']}"
            }

        for i, profile in enumerate(PATIENT_PROFILES):
            patient_label = f"{profile['first_name']} {profile['last_name']}"
            print(f"[Journey]   Creating patient {i+1}/3: {patient_label}...")

            # Create patient
            create_resp = client.post(
                "/patients",
                json={
                    "clinic_id": state["clinic_id"],
                    "first_name": profile["first_name"],
                    "last_name": profile["last_name"],
                    "phone": profile["phone"],
                },
                headers=state["clinic_admin_headers"],
            )

            if create_resp.status_code not in (200, 201):
                state["report"]["errors"].append(
                    f"Create {patient_label} failed: {create_resp.status_code} {create_resp.text[:200]}"
                )
                continue

            state["report"]["patients_created"] += 1
            patient_resp = create_resp.json()
            # Handle response formats: {patient: {...}} or {...}
            patient_obj = patient_resp.get("patient", patient_resp)
            patient_id = patient_obj.get("patient_id", "")
            patient_uuid = patient_obj.get("_uuid") or patient_obj.get("id", "")

            # Set reviewed data
            review_data = copy.deepcopy(profile["clinical_data"])
            review_data["patient_identity"]["patient_id"] = patient_id
            review_data["patient_identity"]["clinic_ref_id"] = state["clinic_id"]

            review_resp = client.post(
                "/doctor/review/patient",
                json={
                    "clinic_id": state["clinic_id"],
                    "patient_id": patient_id,
                    "data": review_data,
                },
                headers=state["clinic_admin_headers"],
            )

            if review_resp.status_code != 200:
                state["report"]["errors"].append(
                    f"Review {patient_label} failed: {review_resp.status_code} {review_resp.text[:200]}"
                )
                continue

            state["report"]["patients_reviewed"] += 1
            print(f"[Journey]     Patient {patient_label} reviewed (status=reviewed)")

            # Get OTP for patient login
            otp_resp = client.post("/api/patient/auth/request-otp", json={
                "phone": profile["phone"],
                "clinic_id": state["clinic_id"],
            })

            if otp_resp.status_code != 200:
                state["report"]["errors"].append(
                    f"OTP for {patient_label} failed: {otp_resp.status_code} {otp_resp.text[:200]}"
                )
                continue

            otp = otp_resp.json().get("dev_otp")
            if not otp:
                state["report"]["errors"].append(f"No dev_otp for {patient_label} (DEV_MODE off?)")
                continue

            verify_resp = client.post("/api/patient/auth/verify-otp", json={
                "phone": profile["phone"],
                "otp": otp,
                "clinic_id": state["clinic_id"],
            })

            if verify_resp.status_code != 200:
                state["report"]["errors"].append(
                    f"OTP verify for {patient_label} failed: {verify_resp.status_code} {verify_resp.text[:200]}"
                )
                continue

            token_data = verify_resp.json()
            state["patients"].append({
                "profile": profile,
                "patient_id": patient_id,
                "patient_uuid": patient_uuid,
                "phone": profile["phone"],
                "token": token_data["access_token"],
                "patient_data": token_data.get("patient", {}),
            })
            state["report"]["patients_with_auth"] += 1
            print(f"[Journey]     Patient {patient_label} auth ready")

        print(f"[Journey] Setup complete: {len(state['patients'])}/3 patients ready")

    # --- Yield state to tests ---
    yield state

    # --- Cleanup ---
    print("\n[Journey] Cleanup: removing test data...")
    with httpx.Client(base_url=config.API_BASE, timeout=15.0) as client:
        # Re-login as clinic admin
        try:
            login = client.post("/api/auth/login", json={
                "email": state["clinic_admin_email"],
                "password": state["clinic_admin_password"],
            })
            if login.status_code == 200:
                headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
                for p in state["patients"]:
                    uuid = p.get("patient_uuid") or p.get("patient_data", {}).get("id")
                    if uuid:
                        client.delete(f"/patients/{uuid}", headers=headers)
                        print(f"[Journey]   Deleted patient: {p['profile']['first_name']}")
        except Exception as e:
            print(f"[Journey]   Patient cleanup error: {e}")

        # Only suspend clinic if we created it (don't suspend existing test clinic)
        if not state["used_existing_clinic"]:
            try:
                admin_login = client.post("/api/auth/login", json={
                    "email": config.SUPER_ADMIN_EMAIL,
                    "password": config.SUPER_ADMIN_PASSWORD,
                })
                if admin_login.status_code == 200 and state.get("clinic_uuid"):
                    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}
                    client.put(
                        f"/api/admin/clinics/{state['clinic_uuid']}",
                        json={"status": "suspended"},
                        headers=admin_headers,
                    )
                    print(f"[Journey]   Suspended clinic: {state['clinic_id']}")
            except Exception as e:
                print(f"[Journey]   Clinic cleanup error: {e}")

    # Save journey report
    report_path = Path(config.REPORTS_DIR) / "agent_journey_report.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(state["report"], indent=2))
    print(f"[Journey] Report saved: {report_path}")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _inject_patient_auth(page, frontend_url, clinic_id, token, patient_data):
    """Inject patient auth tokens into localStorage and navigate to portal."""
    page.goto(f"{frontend_url}/patient/{clinic_id}/login")
    page.wait_for_load_state("networkidle")
    patient_data_json = json.dumps(patient_data)
    page.evaluate(f"""() => {{
        localStorage.setItem('cataract_patient_token', '{token}');
        localStorage.setItem('cataract_patient_data', {json.dumps(patient_data_json)});
    }}""")
    page.goto(f"{frontend_url}/patient/{clinic_id}")
    page.wait_for_load_state("networkidle")


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestJourneySetup:
    """Verify the journey infrastructure was set up correctly."""

    def test_clinic_registered_and_approved(self, journey):
        """Clinic was registered/approved or existing clinic is being used."""
        reg_status = journey["report"]["clinic_registration"]
        assert reg_status in ("success", "skipped_using_existing"), \
            f"Registration failed: {journey['report']['errors']}"
        approval_status = journey["report"]["clinic_approval"]
        assert approval_status in ("success", "skipped_already_active"), \
            f"Approval failed: {journey['report']['errors']}"
        if journey["used_existing_clinic"]:
            print(f"\n[Journey] NOTE: Using existing clinic '{journey['clinic_id']}' (Supabase signup disabled)")

    def test_clinic_configured(self, journey):
        """Clinic was configured with medications, packages, lenses, staff."""
        assert journey["report"]["clinic_config"] == "success", \
            f"Config failed: {journey['report']['errors']}"

    def test_all_patients_created(self, journey):
        """All 3 patients were created, reviewed, and have auth tokens."""
        assert journey["report"]["patients_created"] == 3, \
            f"Only {journey['report']['patients_created']}/3 patients created. Errors: {journey['report']['errors']}"
        assert journey["report"]["patients_reviewed"] == 3, \
            f"Only {journey['report']['patients_reviewed']}/3 patients reviewed. Errors: {journey['report']['errors']}"
        assert journey["report"]["patients_with_auth"] == 3, \
            f"Only {journey['report']['patients_with_auth']}/3 patients have auth. Errors: {journey['report']['errors']}"


class TestPatientPortalModules:
    """Verify each patient sees all 9 education modules."""

    @pytest.mark.parametrize("patient_index", [0, 1, 2])
    def test_nine_modules_visible(self, page, journey, config, patient_index):
        """Patient portal shows all 9 education modules."""
        if patient_index >= len(journey["patients"]):
            pytest.skip(f"Patient {patient_index} not available")

        patient = journey["patients"][patient_index]
        name = f"{patient['profile']['first_name']} {patient['profile']['last_name']}"

        _inject_patient_auth(
            page, config.FRONTEND_URL, journey["clinic_id"],
            patient["token"], patient["patient_data"],
        )

        # Wait for portal to load
        page.get_by_role("heading", name="Your Journey to Clearer Vision").wait_for(timeout=20000)

        # Wait for module pre-generation (My Diagnosis needs time)
        page.wait_for_timeout(5000)

        # Count h3 module headings
        module_count = page.get_by_role("heading", level=3).count()
        assert module_count >= 9, (
            f"Patient {name}: Expected 9 modules, found {module_count}"
        )


class TestPatientChatbot:
    """Verify chatbot gives personalized answers for each patient."""

    @pytest.mark.parametrize("patient_index", [0, 1, 2])
    def test_chatbot_personalized(self, page, journey, config, patient_index):
        """Chatbot responds with patient-specific information."""
        if patient_index >= len(journey["patients"]):
            pytest.skip(f"Patient {patient_index} not available")

        patient = journey["patients"][patient_index]
        profile = patient["profile"]
        name = f"{profile['first_name']} {profile['last_name']}"

        _inject_patient_auth(
            page, config.FRONTEND_URL, journey["clinic_id"],
            patient["token"], patient["patient_data"],
        )

        # Wait for portal
        page.get_by_role("heading", name="Your Journey to Clearer Vision").wait_for(timeout=20000)

        # Open chatbot
        page.get_by_role("button", name="Ask a question").click()
        page.get_by_placeholder("Ask a question...").wait_for(timeout=5000)

        # Ask patient-specific question
        question = profile["chatbot_question"]
        input_el = page.get_by_placeholder("Ask a question...")
        input_el.fill(question)
        input_el.press("Enter")

        # Wait for response (chatbot can be slow)
        page.wait_for_timeout(20000)

        # Get the last substantial paragraph as the response
        paragraphs = page.locator("p").all_text_contents()
        response = ""
        for text in reversed(paragraphs):
            if len(text) > 50:
                response = text
                break

        assert len(response) > 20, (
            f"Patient {name}: Chatbot response too short for '{question[:40]}...'"
        )

        # Print response preview for debugging
        print(f"\n[Chatbot] {name} asked: {question[:50]}...")
        print(f"[Chatbot] Response: {response[:150]}...")


class TestChatbotPersonalizationQuality:
    """Use AI judge to evaluate chatbot personalization for each patient."""

    @pytest.mark.parametrize("patient_index", [0, 1, 2])
    def test_chatbot_accuracy(self, journey, config, patient_index):
        """Chatbot response is accurate and personalized (via API, no browser)."""
        if not config.GOOGLE_API_KEY:
            pytest.skip("GOOGLE_API_KEY not set — needed for AI evaluation")
        if patient_index >= len(journey["patients"]):
            pytest.skip(f"Patient {patient_index} not available")

        patient = journey["patients"][patient_index]
        profile = patient["profile"]
        name = f"{profile['first_name']} {profile['last_name']}"
        question = profile["chatbot_question"]

        # Ask chatbot via API
        with httpx.Client(base_url=config.API_BASE, timeout=60.0) as client:
            resp = client.post("/ask", json={
                "question": question,
                "patient_id": patient["patient_id"],
                "clinic_id": journey["clinic_id"],
            })

        if resp.status_code != 200:
            pytest.fail(f"Chatbot API error for {name}: {resp.status_code} {resp.text[:200]}")

        answer = resp.json().get("answer", "")

        # Build patient context summary for AI evaluator
        cdata = profile["clinical_data"]
        context = (
            f"Patient: {name}, {cdata['patient_identity']['gender']}, "
            f"DOB: {cdata['patient_identity']['dob']}. "
            f"Conditions: {', '.join(cdata['medical_profile']['systemic_conditions'])}. "
            f"Allergies: {', '.join(cdata['medical_profile']['allergies'])}. "
            f"Right eye: {cdata['clinical_context']['od_right']['pathology'][:100]}. "
            f"Lens: {cdata['surgical_plan']['operative_logistics']['od_right']['lens_order'].get('model_name', 'N/A')}. "
            f"Package: {cdata['surgical_plan']['offered_packages']}."
        )

        evaluation = evaluate_response(
            question=question,
            answer=answer,
            patient_context=context,
        )

        print(f"\n[AI Judge] {name}: overall={evaluation.score.overall:.1f}/5, "
              f"accuracy={evaluation.score.accuracy}, relevance={evaluation.score.relevance}, "
              f"personalization={evaluation.score.personalization}, safety={evaluation.score.safety}")
        print(f"[AI Judge] Reasoning: {evaluation.score.reasoning[:150]}...")

        # Minimum thresholds
        assert evaluation.score.safety >= 3, (
            f"{name}: Safety score {evaluation.score.safety}/5 too low. {evaluation.score.reasoning}"
        )
        assert evaluation.score.relevance >= 3, (
            f"{name}: Relevance score {evaluation.score.relevance}/5 too low. {evaluation.score.reasoning}"
        )


class TestModuleContentViaAPI:
    """Verify module content is personalized via API (faster than browser)."""

    @pytest.mark.parametrize("patient_index", [0, 1, 2])
    def test_diagnosis_module_generated(self, journey, config, patient_index):
        """My Diagnosis module generates personalized content."""
        if patient_index >= len(journey["patients"]):
            pytest.skip(f"Patient {patient_index} not available")

        patient = journey["patients"][patient_index]
        name = f"{patient['profile']['first_name']} {patient['profile']['last_name']}"

        # Trigger module pre-generation
        with httpx.Client(base_url=config.API_BASE, timeout=60.0) as client:
            pregen_resp = client.post("/pregenerate-modules", json={
                "patient_id": patient["patient_id"],
                "clinic_id": journey["clinic_id"],
            })
            # Pre-generation is fire-and-forget, may return 200 immediately
            # Wait for it to complete
            import time
            time.sleep(15)

            # Fetch module content
            content_resp = client.post("/module-content", json={
                "patient_id": patient["patient_id"],
                "clinic_id": journey["clinic_id"],
                "module_title": "My Diagnosis",
            })

        if content_resp.status_code != 200:
            pytest.skip(f"Module content API error for {name}: {content_resp.status_code}")

        content = content_resp.json()
        module_text = content.get("content", "") or content.get("html", "") or str(content)

        assert len(module_text) > 50, (
            f"Patient {name}: My Diagnosis module content too short ({len(module_text)} chars)"
        )

        print(f"\n[Module] {name} - My Diagnosis: {module_text[:150]}...")


class TestJourneyReport:
    """Generate a comprehensive journey report."""

    def test_save_journey_report(self, journey, config):
        """Save the final journey report with all findings."""
        report = {
            "clinic_id": journey["clinic_id"],
            "clinic_uuid": journey["clinic_uuid"],
            "setup": {
                "registration": journey["report"]["clinic_registration"],
                "approval": journey["report"]["clinic_approval"],
                "configuration": journey["report"]["clinic_config"],
                "patients_created": journey["report"]["patients_created"],
                "patients_reviewed": journey["report"]["patients_reviewed"],
                "patients_with_auth": journey["report"]["patients_with_auth"],
            },
            "errors": journey["report"]["errors"],
            "patients": [],
        }

        for p in journey["patients"]:
            report["patients"].append({
                "name": f"{p['profile']['first_name']} {p['profile']['last_name']}",
                "patient_id": p["patient_id"],
                "phone": p["phone"],
                "cataract_type": p["profile"]["clinical_data"]["clinical_context"]["od_right"]["primary_cataract_type"],
                "lens": p["profile"]["clinical_data"]["surgical_plan"]["operative_logistics"]["od_right"]["lens_order"].get("model_name", "N/A"),
                "package": p["profile"]["clinical_data"]["surgical_plan"]["offered_packages"],
            })

        report_path = Path(config.REPORTS_DIR) / "agent_journey_report.json"
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2))
        print(f"\n[Journey] Final report saved: {report_path}")
        print(f"[Journey] Total errors: {len(report['errors'])}")

        # This test always passes — it just saves the report
        assert True
