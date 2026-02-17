"""
E2E test: Full patient portal journey.

Tests the complete flow:
1. Patient login via OTP
2. View education modules
3. Open chatbot and ask a question
"""

import json
import pytest
from tests.e2e.pages.patient_login_page import PatientLoginPage
from tests.e2e.pages.patient_portal_page import PatientPortalPage
from tests.e2e.pages.chatbot_page import ChatbotPage

pytestmark = pytest.mark.e2e


def _inject_patient_auth(page, config, patient_auth):
    """Inject patient auth tokens into localStorage and navigate to portal."""
    page.goto(f"{config.FRONTEND_URL}/patient/{config.TEST_CLINIC_ID}/login")
    page.wait_for_load_state("networkidle")
    token = patient_auth["token"]
    patient_data = json.dumps(patient_auth["patient_data"])
    page.evaluate(f"""() => {{
        localStorage.setItem('cataract_patient_token', '{token}');
        localStorage.setItem('cataract_patient_data', {json.dumps(patient_data)});
    }}""")
    page.goto(f"{config.FRONTEND_URL}/patient/{config.TEST_CLINIC_ID}")
    page.wait_for_load_state("networkidle")


class TestPatientLogin:
    """Test patient OTP login in the browser."""

    def test_patient_otp_login(self, page, config, patient_auth):
        """Patient can log in via OTP and see the portal."""
        login_page = PatientLoginPage(page)
        login_page.navigate(config.FRONTEND_URL, config.TEST_CLINIC_ID)

        # enter_phone clicks "Get OTP" → browser makes OTP request
        # In DEV_MODE, the OTP is displayed on the page
        login_page.enter_phone(patient_auth["phone"])

        # Read the dev OTP from the page notification
        page.wait_for_timeout(2000)
        otp = login_page.get_dev_otp_from_toast()
        if not otp:
            pytest.skip("Cannot read OTP from page (rate limited or DEV_MODE off)")

        login_page.enter_otp(otp)

        # Should land on the patient portal
        login_page.expect_portal()


class TestPatientPortal:
    """Test patient portal module interactions."""

    def test_modules_visible(self, page, config, patient_auth):
        """All education modules are visible after login."""
        _inject_patient_auth(page, config, patient_auth)

        portal = PatientPortalPage(page)
        portal.wait_for_portal()

        # Should see all 9 module headings
        module_count = portal.get_module_count()
        assert module_count >= 9, f"Expected 9 modules, found {module_count}"


class TestPatientChatbot:
    """Test chatbot interaction."""

    @pytest.mark.slow
    def test_chatbot_responds(self, page, config, patient_auth):
        """Patient can open chatbot, ask a question, and get a response."""
        _inject_patient_auth(page, config, patient_auth)

        portal = PatientPortalPage(page)
        portal.wait_for_portal()
        portal.open_chatbot()

        chatbot = ChatbotPage(page)
        chatbot.wait_for_chatbot()
        chatbot.send_message("What is a cataract?")
        chatbot.wait_for_response(timeout=45000)

        response_text = chatbot.get_last_response()
        assert len(response_text) > 20, "Chatbot response too short"
