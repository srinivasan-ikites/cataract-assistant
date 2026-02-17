"""
Agent Test: Security-focused autonomous exploration.

The AI agent tries to break authentication, access other
patients' data, and find security vulnerabilities.
"""

import json
from pathlib import Path

import pytest
from playwright.async_api import async_playwright

from tests.agent.explorer_agent import ExplorerAgent

pytestmark = [pytest.mark.agent, pytest.mark.security, pytest.mark.slow]


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


class TestAgentSecurity:
    """Agent tries to find security vulnerabilities."""

    async def test_agent_security_exploration(self, browser_page, config):
        """
        Agent acts as a security tester trying to break the application.
        """
        api_key = config.GOOGLE_API_KEY
        if not api_key:
            pytest.skip("GOOGLE_API_KEY not set — needed for agent exploration")

        agent = ExplorerAgent(
            page=browser_page,
            api_key=api_key,
        )

        report = await agent.explore(
            start_url=f"{config.FRONTEND_URL}/doctor/{config.TEST_CLINIC_ID}/login",
            mission=(
                "You are a SECURITY TESTER. Your goal is to find security vulnerabilities. "
                "Try these attacks: "
                "1. Try to access the doctor portal pages WITHOUT logging in first — just navigate directly to URLs. "
                "2. Try to access the patient portal without OTP verification. "
                "3. Try entering SQL injection payloads in input fields: ' OR 1=1 --, etc. "
                "4. Try XSS payloads: <script>alert('xss')</script> in text fields. "
                "5. Try accessing URLs with different clinic IDs to see other clinics' data. "
                "6. Try entering very long strings (1000+ characters) in input fields. "
                "7. Check if error messages reveal internal server details. "
                "8. Try manipulating URL parameters to access unauthorized resources. "
                "Report EVERY security issue you find, even minor ones."
            ),
            credentials={
                "email": config.ADMIN_EMAIL,
                "password": config.ADMIN_PASSWORD,
                "note": "Only use these if needed to test authenticated areas",
            },
            max_actions=25,
            timeout_minutes=4,
        )

        # Save report
        report_path = Path(config.REPORTS_DIR) / "agent_security_report.json"
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
        print(f"\n[Agent Security] Report saved: {report_path}")
        print(f"[Agent Security] Actions: {report.total_actions}")
        print(f"[Agent Security] Findings: {len(report.findings)}")

        # Report high-severity security findings (but don't fail the test —
        # security findings need human review)
        security_findings = [f for f in report.findings if f.severity == "high"]
        if security_findings:
            print(f"\n{'='*60}")
            print(f"[SECURITY] {len(security_findings)} HIGH severity finding(s):")
            for f in security_findings:
                print(f"  [{f.type}] {f.description}")
            print(f"{'='*60}")
