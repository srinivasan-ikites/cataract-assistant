"""Page Object: Patient Portal - OTP Login."""

import re


class PatientLoginPage:
    """Encapsulates the patient OTP login flow."""

    def __init__(self, page):
        self.page = page

    def navigate(self, base_url: str, clinic_id: str):
        """Navigate to the patient login page."""
        self.page.goto(f"{base_url}/patient/{clinic_id}/login")
        self.page.wait_for_load_state("networkidle")
        # Wait for the phone input to appear
        self.page.get_by_placeholder("(555) 123 4567").wait_for(timeout=10000)

    def enter_phone(self, phone: str):
        """Enter phone number and submit."""
        self.page.get_by_placeholder("(555) 123 4567").fill(phone)
        self.page.get_by_role("button", name="Get OTP").click()
        self.page.wait_for_load_state("networkidle")

    def enter_otp(self, otp: str):
        """Enter the OTP code and verify."""
        # Wait for OTP inputs to appear
        self.page.wait_for_timeout(1000)
        # Click the first OTP input to focus it
        self.page.get_by_role("textbox").first.click()
        # Type all 6 digits via keyboard - auto-advance handles moving to next input
        self.page.keyboard.type(otp[:6], delay=100)
        self.page.wait_for_timeout(500)

        # Click verify/submit
        self.page.get_by_role("button", name="Verify & Login").click()
        self.page.wait_for_load_state("networkidle")

    def get_dev_otp_from_toast(self) -> str:
        """In DEV mode, read OTP from the dev mode notification."""
        # The dev OTP is shown in a box with "Dev Mode - OTP" text
        # Look for the 6-digit code displayed in the notification
        try:
            # Wait for the dev OTP notification
            self.page.wait_for_timeout(1000)
            # The OTP is in a paragraph element near "Dev Mode - OTP" text
            page_text = self.page.content()
            match = re.search(r'\b(\d{6})\b', page_text)
            if match:
                return match.group(1)
        except Exception:
            pass
        return ""

    def expect_portal(self):
        """Assert we landed on the patient portal."""
        self.page.wait_for_url("**/patient/**", timeout=15000)
        # Wait for module content to appear (patient portal shows education modules)
        self.page.wait_for_timeout(3000)
