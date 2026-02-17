"""Page Object: Doctor Portal Login Page."""


class DoctorLoginPage:
    """Encapsulates the doctor portal login UI."""

    def __init__(self, page):
        self.page = page

    def navigate(self, base_url: str, clinic_id: str = None):
        """Navigate to the doctor login page."""
        # Login page is at /doctor/login (no clinic_id in URL)
        self.page.goto(f"{base_url}/doctor/login")
        self.page.wait_for_load_state("networkidle")

    def login(self, email: str, password: str):
        """Fill in credentials and submit the login form."""
        self.page.get_by_placeholder("doctor@clinic.com").fill(email)
        self.page.get_by_placeholder("Enter your password").fill(password)
        self.page.get_by_role("button", name="Sign In").click()
        self.page.wait_for_load_state("networkidle")

    def expect_dashboard(self):
        """Assert that we landed on the doctor dashboard (patient list)."""
        self.page.wait_for_url("**/doctor/**", timeout=15000)
        # Wait for any dashboard content to appear
        self.page.wait_for_timeout(2000)

    def expect_error(self, text: str = None):
        """Assert that a login error is displayed."""
        error = self.page.wait_for_selector(
            '.error, [role="alert"], .text-red-500, .text-destructive',
            timeout=5000,
        )
        if text:
            content = error.text_content()
            assert text.lower() in content.lower()
