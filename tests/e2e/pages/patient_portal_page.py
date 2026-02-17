"""Page Object: Patient Portal - Module Grid + Interactions."""


class PatientPortalPage:
    """Encapsulates the patient education portal."""

    MODULE_NAMES = [
        "My Diagnosis",
        "What is Cataract Surgery?",
        "What is an IOL?",
        "My IOL Options",
        "Risks & Complications",
        "Before Surgery",
        "Day of Surgery",
        "After Surgery",
        "Costs & Insurance",
    ]

    def __init__(self, page):
        self.page = page

    def wait_for_portal(self):
        """Wait for the patient portal to fully load."""
        self.page.wait_for_load_state("networkidle")
        # Wait for the hero heading to appear
        self.page.get_by_role("heading", name="Your Journey to Clearer Vision").wait_for(
            timeout=15000
        )

    def get_module_count(self) -> int:
        """Count the number of visible education module cards."""
        # Each module has an h3 heading
        return self.page.get_by_role("heading", level=3).count()

    def click_module(self, module_name: str):
        """Click on a specific module by name."""
        self.page.get_by_role("heading", name=module_name).click()
        self.page.wait_for_load_state("networkidle")
        self.page.wait_for_timeout(1000)

    def is_module_visible(self, module_name: str) -> bool:
        """Check if a module with the given name is visible."""
        return self.page.get_by_role("heading", name=module_name).is_visible()

    def open_chatbot(self):
        """Open the chatbot/FAQ overlay."""
        self.page.get_by_role("button", name="Ask a question").click()
        # Wait for chatbot input to appear
        self.page.get_by_placeholder("Ask a question...").wait_for(timeout=5000)

    def close_modal(self):
        """Close any open modal."""
        # Try pressing Escape to close modals
        self.page.keyboard.press("Escape")
        self.page.wait_for_timeout(500)
