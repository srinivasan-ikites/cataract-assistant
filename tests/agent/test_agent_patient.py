"""
Agent Test: Autonomous exploration of the Patient Portal.

The AI agent logs in as a patient via OTP and explores
the education modules and chatbot.
"""

import json
from pathlib import Path

import pytest
import httpx
from playwright.async_api import async_playwright

from tests.agent.explorer_agent import ExplorerAgent

pytestmark = [pytest.mark.agent, pytest.mark.slow]


@pytest.fixture(scope="module")
async def browser_page():
    """Create a browser page for agent exploration."""
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 720},
        )
        page = await context.new_page()
        yield page
        await context.close()
        await browser.close()


@pytest.fixture(scope="module")
async def patient_otp(config) -> dict:
    """Get a patient phone + OTP for agent to use."""
    async with httpx.AsyncClient(base_url=config.API_BASE, timeout=15.0) as client:
        login_resp = await client.post("/api/auth/login", json={
            "email": config.ADMIN_EMAIL,
            "password": config.ADMIN_PASSWORD,
        })
        if login_resp.status_code != 200:
            pytest.skip("Cannot login as admin")

        headers = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}
        patients_resp = await client.get(
            f"/patients?clinic_id={config.TEST_CLINIC_ID}",
            headers=headers,
        )
        patients = patients_resp.json()
        reviewed = [
            p for p in patients
            if p.get("status") in ("reviewed", "scheduled")
            and p.get("phone")
        ]
        if not reviewed:
            pytest.skip("No reviewed patients for agent test")

        phone = reviewed[0]["phone"]
        otp_resp = await client.post("/api/patient/auth/request-otp", json={
            "phone": phone,
            "clinic_id": config.TEST_CLINIC_ID,
        })
        otp = otp_resp.json().get("dev_otp", "")
        if not otp:
            pytest.skip("No OTP returned (DEV_MODE off?)")

        return {"phone": phone, "otp": otp}


class TestAgentPatientPortal:
    """Agent autonomously explores the patient portal."""

    async def test_agent_explores_patient_portal(
        self, browser_page, config, patient_otp
    ):
        """
        Agent logs in as patient and explores modules + chatbot.
        """
        api_key = config.GOOGLE_API_KEY
        if not api_key:
            pytest.skip("GOOGLE_API_KEY not set — needed for agent exploration")

        agent = ExplorerAgent(
            page=browser_page,
            api_key=api_key,
        )

        report = await agent.explore(
            start_url=f"{config.FRONTEND_URL}/patient/{config.TEST_CLINIC_ID}/login",
            mission=(
                "You are a cataract surgery patient testing this education portal. "
                f"1. Enter phone number: {patient_otp['phone']} "
                f"2. Enter OTP code: {patient_otp['otp']} "
                "3. After logging in, you should see education modules about your surgery. "
                "4. Click on each module to explore it (My Diagnosis, IOL Options, etc.). "
                "5. Open the chatbot and ask 2-3 questions about your surgery. "
                "6. Check if the chatbot gives personalized answers about your condition. "
                "7. Try asking the chatbot something off-topic or tricky. "
                "8. Look for anything broken: error messages, blank content, slow loading. "
                "Report any issues you find."
            ),
            credentials={
                "phone": patient_otp["phone"],
                "otp": patient_otp["otp"],
            },
            max_actions=35,
            timeout_minutes=5,
        )

        # Save report
        report_path = Path(config.REPORTS_DIR) / "agent_patient_report.json"
        report_data = {
            "mission": report.mission,
            "total_actions": report.total_actions,
            "duration_seconds": round(report.duration_seconds, 1),
            "pages_visited": report.pages_visited,
            "actions_log": report.actions_log,
            "findings": [
                {
                    "severity": f.severity,
                    "type": f.type,
                    "description": f.description,
                    "screenshot": f.screenshot_path,
                    "page_url": f.page_url,
                    "steps": f.steps_to_reproduce,
                }
                for f in report.findings
            ],
        }
        report_path.write_text(json.dumps(report_data, indent=2))
        print(f"\n[Agent] Patient portal report saved: {report_path}")
        print(f"[Agent] Actions: {report.total_actions}")
        print(f"[Agent] Findings: {len(report.findings)}")

        high_bugs = [f for f in report.findings if f.severity == "high"]
        if high_bugs:
            bug_desc = "\n".join(f"  [{b.type}] {b.description}" for b in high_bugs)
            pytest.fail(
                f"Agent found {len(high_bugs)} HIGH severity bug(s):\n{bug_desc}"
            )
