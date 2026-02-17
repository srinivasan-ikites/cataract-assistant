"""
Agent Test: Autonomous exploration of the Doctor Portal.

The AI agent is given a high-level mission and autonomously
navigates the doctor portal, trying to find bugs.
"""

import json
import os
from pathlib import Path

import pytest
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


class TestAgentDoctorPortal:
    """Agent autonomously explores the doctor portal."""

    async def test_agent_explores_doctor_portal(self, browser_page, config):
        """
        Agent explores the doctor portal: login, patient list,
        register patient, open patient details.
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
                "You are a doctor testing this clinic portal. "
                "1. Log in with the provided credentials. "
                "2. Look at the patient list. "
                "3. Try to register a new patient with first name 'AgentTest', last name 'Bot', phone '9990007001'. "
                "4. Open any patient's details to see their data. "
                "5. Look for anything broken: error messages, missing data, blank pages, broken buttons. "
                "6. Try some unexpected actions: click buttons rapidly, use very long text in fields. "
                "Report any issues you find."
            ),
            credentials={
                "email": config.ADMIN_EMAIL,
                "password": config.ADMIN_PASSWORD,
            },
            max_actions=30,
            timeout_minutes=4,
        )

        # Save report
        report_path = Path(config.REPORTS_DIR) / "agent_doctor_report.json"
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
        print(f"\n[Agent] Doctor portal report saved: {report_path}")
        print(f"[Agent] Actions taken: {report.total_actions}")
        print(f"[Agent] Pages visited: {len(report.pages_visited)}")
        print(f"[Agent] Findings: {len(report.findings)}")

        # Fail if any high-severity bugs found
        high_bugs = [f for f in report.findings if f.severity == "high"]
        if high_bugs:
            bug_desc = "\n".join(
                f"  [{b.type}] {b.description}" for b in high_bugs
            )
            pytest.fail(
                f"Agent found {len(high_bugs)} HIGH severity bug(s):\n{bug_desc}"
            )
