"""Page Object: Doctor Portal - Patient Onboarding (Upload + Review)."""

from pathlib import Path


class OnboardingPage:
    """Encapsulates the patient onboarding/review page."""

    def __init__(self, page):
        self.page = page

    def wait_for_page(self):
        """Wait for the onboarding page to load."""
        self.page.wait_for_load_state("networkidle")

    def is_upload_sidebar_visible(self) -> bool:
        """Check if the upload sidebar is visible."""
        sidebar = self.page.query_selector(
            '[data-testid="upload-panel"], .upload-panel, '
            'text=Upload, text=Drop files'
        )
        return sidebar is not None and sidebar.is_visible()

    def upload_files(self, file_paths: list[str]):
        """Upload files via the file input."""
        file_input = self.page.query_selector('input[type="file"]')
        if file_input:
            file_input.set_input_files(file_paths)
            self.page.wait_for_load_state("networkidle")

    def wait_for_extraction(self, timeout: int = 60000):
        """Wait for document extraction to complete."""
        self.page.wait_for_selector(
            'text=Extraction complete, text=Review, text=extracted',
            timeout=timeout,
        )

    def save_review(self):
        """Click the save/submit review button."""
        self.page.click(
            'button:has-text("Save"), button:has-text("Submit"), '
            'button:has-text("Approve")'
        )
        self.page.wait_for_load_state("networkidle")

    def get_patient_status(self) -> str:
        """Try to read the patient's current status from the page."""
        status_el = self.page.query_selector(
            '[data-testid="patient-status"], .patient-status, .status-badge'
        )
        if status_el:
            return (status_el.text_content()).strip().lower()
        return ""
