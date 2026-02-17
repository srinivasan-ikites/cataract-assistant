"""Page Object: Doctor Portal - Patient List."""


class PatientListPage:
    """Encapsulates the patient list table in doctor portal."""

    def __init__(self, page):
        self.page = page

    def wait_for_list(self):
        """Wait for the patient list to load."""
        self.page.wait_for_load_state("networkidle")
        # Wait for the patient table to appear
        self.page.locator("table").wait_for(timeout=10000)

    def get_patient_count(self) -> int:
        """Return the number of patients in the list."""
        return self.page.locator("tbody tr").count()

    def click_register_patient(self):
        """Click the register/add patient button."""
        self.page.get_by_role("button", name="Register Patient").first.click()

    def register_patient(self, first_name: str, last_name: str, phone: str):
        """Fill in the register patient modal and submit."""
        self.click_register_patient()
        # Wait for the modal to appear
        self.page.get_by_placeholder("Enter first name").wait_for(timeout=5000)

        # Fill the form fields
        self.page.get_by_placeholder("Enter first name").fill(first_name)
        self.page.get_by_placeholder("Enter last name").fill(last_name)
        self.page.get_by_placeholder("(555) 123 4567").fill(phone)

        # Click the Register Patient button inside the modal (second one on page)
        self.page.get_by_role("button", name="Register Patient").nth(1).click()
        self.page.wait_for_load_state("networkidle")

    def click_patient(self, patient_name: str = None, index: int = 0):
        """Click on a patient row to open their details."""
        if patient_name:
            self.page.locator("tbody tr").filter(has_text=patient_name).first.click()
        else:
            self.page.locator("tbody tr").nth(index).click()
        self.page.wait_for_load_state("networkidle")
