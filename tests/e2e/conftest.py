"""
E2E test fixtures for Playwright browser tests.

Provides:
- Browser and page fixtures (sync API)
- Patient auth token (session-scoped, avoids OTP rate limits)
- Automatic screenshot on failure
"""

import pytest
import httpx
from playwright.sync_api import sync_playwright


@pytest.fixture(scope="session")
def browser():
    """Launch a browser instance for the entire test session."""
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        yield browser
        browser.close()


@pytest.fixture
def page(browser, config):
    """Create a fresh browser page for each test."""
    context = browser.new_context(
        viewport={"width": 1280, "height": 720},
        ignore_https_errors=True,
    )
    page = context.new_page()
    yield page
    context.close()


@pytest.fixture(scope="session")
def patient_auth(config):
    """
    Session-scoped patient auth: request OTP + verify once for all tests.
    Returns dict with: token, phone, otp, patient_data.
    Only 1 OTP request per test session (avoids rate limits).
    """
    phone = config.TEST_PATIENT_PHONE
    with httpx.Client(base_url=config.API_BASE, timeout=15.0) as client:
        otp_resp = client.post("/api/patient/auth/request-otp", json={
            "phone": phone,
            "clinic_id": config.TEST_CLINIC_ID,
        })
        if otp_resp.status_code != 200:
            pytest.skip(f"Cannot request OTP for {phone}: {otp_resp.text}")

        otp = otp_resp.json().get("dev_otp")
        if not otp:
            pytest.skip("OTP not in response (DEV_MODE may be off)")

        verify_resp = client.post("/api/patient/auth/verify-otp", json={
            "phone": phone,
            "otp": otp,
            "clinic_id": config.TEST_CLINIC_ID,
        })
        if verify_resp.status_code != 200:
            pytest.skip(f"Cannot verify OTP: {verify_resp.text}")

        data = verify_resp.json()
        return {
            "token": data["access_token"],
            "phone": phone,
            "otp": otp,
            "patient_data": data.get("patient", {}),
        }


@pytest.fixture(autouse=True)
def screenshot_on_failure(request, page, config):
    """Automatically capture screenshot when a test fails."""
    yield
    if hasattr(request.node, "rep_call") and request.node.rep_call.failed:
        test_name = request.node.name.replace("[", "_").replace("]", "_")
        screenshot_path = config.SCREENSHOTS_DIR / f"{test_name}.png"
        page.screenshot(path=str(screenshot_path), full_page=True)


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """Store test result on the item for screenshot_on_failure fixture."""
    outcome = yield
    rep = outcome.get_result()
    setattr(item, f"rep_{rep.when}", rep)
