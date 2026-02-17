"""
Autonomous AI Agent Explorer.

An AI agent that autonomously navigates the web application using
Playwright, decides what to test, and reports bugs it discovers.

Architecture:
    Agent Loop:
    1. Take accessibility snapshot of current page
    2. Send snapshot + mission + memory to LLM
    3. LLM decides next action (click, fill, navigate, etc.)
    4. Execute action via Playwright
    5. Observe result (check for errors, crashes)
    6. Record findings
    7. Repeat until budget exhausted
"""

import json
import time
import traceback
from dataclasses import dataclass, field
from pathlib import Path

from google import genai
from playwright.async_api import Page


@dataclass
class Finding:
    """A bug or issue discovered by the agent."""
    severity: str  # high, medium, low
    type: str  # crash, error, ux_issue, visual, security
    description: str
    screenshot_path: str = ""
    steps_to_reproduce: list[str] = field(default_factory=list)
    page_url: str = ""


@dataclass
class ExplorationReport:
    """Final report from an exploration session."""
    mission: str
    total_actions: int = 0
    duration_seconds: float = 0
    findings: list[Finding] = field(default_factory=list)
    pages_visited: list[str] = field(default_factory=list)
    actions_log: list[str] = field(default_factory=list)
    error: str = ""


AGENT_SYSTEM_PROMPT = """You are an autonomous QA testing agent exploring a web application.
You control a browser via specific action commands.

YOUR MISSION: {mission}

CREDENTIALS (use if needed):
{credentials}

RULES:
1. Explore the application thoroughly — click buttons, fill forms, navigate pages
2. Try UNEXPECTED inputs to find edge cases and bugs
3. Look for: crashes, error messages, broken layouts, missing data, security issues
4. Keep track of what you've done to avoid loops
5. When you find something wrong, report it as a FINDING

AVAILABLE ACTIONS (respond with ONE per turn):
- CLICK: <selector> — Click an element (use text content or role)
- FILL: <selector> | <value> — Fill a text input with a value
- NAVIGATE: <url> — Navigate to a URL
- SCREENSHOT: <name> — Take a screenshot (for documenting issues)
- FINDING: <severity>|<type>|<description> — Report a bug/issue
  - severity: high, medium, low
  - type: crash, error, ux_issue, visual, security
- DONE: <summary> — End exploration with summary

RESPONSE FORMAT:
Think step-by-step about what you see and what to do next, then output your action.
Always start your action line with "ACTION:" followed by the command.

Example:
I see a login page with email and password fields. Let me try to log in.
ACTION: FILL: input[name="email"] | test@example.com

PAGES VISITED SO FAR:
{visited}

ACTIONS TAKEN SO FAR:
{actions}

FINDINGS SO FAR:
{findings}
"""


class ExplorerAgent:
    """
    Autonomous browser exploration agent.

    Uses an LLM to decide what actions to take while navigating
    a web application via Playwright.
    """

    def __init__(self, page: Page, api_key: str, model: str = "gemini-2.5-flash"):
        self.page = page
        self.client = genai.Client(api_key=api_key)
        self.model = model
        self.actions_log: list[str] = []
        self.pages_visited: list[str] = []
        self.findings: list[Finding] = []
        self.screenshots_dir = Path("tests/reports/screenshots")
        self.screenshots_dir.mkdir(parents=True, exist_ok=True)

    async def explore(
        self,
        start_url: str,
        mission: str,
        credentials: dict = None,
        max_actions: int = 30,
        timeout_minutes: float = 5,
    ) -> ExplorationReport:
        """
        Run an autonomous exploration session.

        Args:
            start_url: URL to start exploring from
            mission: High-level description of what to test
            credentials: Optional dict with login credentials
            max_actions: Maximum number of actions before stopping
            timeout_minutes: Maximum time in minutes

        Returns:
            ExplorationReport with findings and action log
        """
        report = ExplorationReport(mission=mission)
        start_time = time.time()
        deadline = start_time + (timeout_minutes * 60)

        # Navigate to start URL
        try:
            await self.page.goto(start_url, wait_until="networkidle", timeout=15000)
        except Exception as e:
            report.error = f"Failed to navigate to {start_url}: {e}"
            return report

        self.pages_visited.append(start_url)

        cred_text = ""
        if credentials:
            cred_text = "\n".join(f"  {k}: {v}" for k, v in credentials.items())

        action_count = 0

        while action_count < max_actions and time.time() < deadline:
            try:
                # 1. Get page state
                page_snapshot = await self._get_page_snapshot()
                current_url = self.page.url

                if current_url not in self.pages_visited:
                    self.pages_visited.append(current_url)

                # 2. Ask LLM what to do
                prompt = AGENT_SYSTEM_PROMPT.format(
                    mission=mission,
                    credentials=cred_text or "  None provided",
                    visited="\n".join(f"  - {u}" for u in self.pages_visited[-10:]),
                    actions="\n".join(f"  {i+1}. {a}" for i, a in enumerate(self.actions_log[-15:])),
                    findings="\n".join(
                        f"  [{f.severity}] {f.type}: {f.description}"
                        for f in self.findings
                    ) or "  None yet",
                )

                user_msg = f"CURRENT URL: {current_url}\n\nPAGE CONTENT:\n{page_snapshot}"

                response = self.client.models.generate_content(
                    model=self.model,
                    contents=[
                        {"role": "user", "parts": [{"text": prompt + "\n\n" + user_msg}]}
                    ],
                )

                action_text = response.text.strip()

                # 3. Parse and execute action
                action_line = self._extract_action(action_text)
                if not action_line:
                    self.actions_log.append(f"[No action parsed from LLM response]")
                    action_count += 1
                    continue

                executed = await self._execute_action(action_line)
                self.actions_log.append(executed)
                action_count += 1

                # Check if agent wants to stop
                if action_line.startswith("DONE:"):
                    break

                # 4. Check for errors after action
                await self._check_for_errors()

            except Exception as e:
                self.actions_log.append(f"[Agent error: {str(e)[:100]}]")
                action_count += 1

        report.total_actions = action_count
        report.duration_seconds = time.time() - start_time
        report.findings = self.findings
        report.pages_visited = self.pages_visited
        report.actions_log = self.actions_log

        return report

    async def _get_page_snapshot(self) -> str:
        """Get a text representation of the current page state."""
        try:
            # Use accessibility tree for a structured view
            snapshot = await self.page.accessibility.snapshot()
            if snapshot:
                return self._format_a11y_tree(snapshot, max_depth=4)
        except Exception:
            pass

        # Fallback: get visible text content
        try:
            text = await self.page.evaluate("""
                () => {
                    const elements = document.querySelectorAll(
                        'h1, h2, h3, h4, button, a, input, textarea, select, ' +
                        'label, p, span, td, th, li, [role]'
                    );
                    const items = [];
                    elements.forEach(el => {
                        const text = el.textContent?.trim().substring(0, 100);
                        const tag = el.tagName.toLowerCase();
                        const type = el.getAttribute('type') || '';
                        const name = el.getAttribute('name') || '';
                        const placeholder = el.getAttribute('placeholder') || '';
                        const role = el.getAttribute('role') || '';
                        if (text || placeholder) {
                            items.push(`<${tag}${type ? ' type='+type : ''}${name ? ' name='+name : ''}${role ? ' role='+role : ''}${placeholder ? ' placeholder="'+placeholder+'"' : ''}> ${text || ''}`);
                        }
                    });
                    return items.slice(0, 80).join('\\n');
                }
            """)
            return text or "[Empty page]"
        except Exception:
            return "[Could not read page content]"

    def _format_a11y_tree(self, node: dict, depth: int = 0, max_depth: int = 4) -> str:
        """Format accessibility tree node as indented text."""
        if depth > max_depth:
            return ""

        lines = []
        role = node.get("role", "")
        name = node.get("name", "")
        value = node.get("value", "")

        indent = "  " * depth
        parts = [role]
        if name:
            parts.append(f'"{name}"')
        if value:
            parts.append(f'value="{value}"')
        lines.append(f"{indent}{' '.join(parts)}")

        for child in node.get("children", []):
            lines.append(self._format_a11y_tree(child, depth + 1, max_depth))

        return "\n".join(lines)

    def _extract_action(self, llm_response: str) -> str:
        """Extract the ACTION: line from LLM response."""
        for line in llm_response.split("\n"):
            line = line.strip()
            if line.startswith("ACTION:"):
                return line[7:].strip()
        return ""

    async def _execute_action(self, action: str) -> str:
        """Execute a parsed action and return a description."""
        try:
            if action.startswith("CLICK:"):
                selector = action[6:].strip()
                await self.page.click(selector, timeout=5000)
                await self.page.wait_for_load_state("networkidle", timeout=10000)
                return f"Clicked: {selector}"

            elif action.startswith("FILL:"):
                parts = action[5:].strip().split("|", 1)
                if len(parts) == 2:
                    selector = parts[0].strip()
                    value = parts[1].strip()
                    await self.page.fill(selector, value, timeout=5000)
                    return f"Filled: {selector} with '{value[:30]}'"
                return f"[Invalid FILL format: {action[:50]}]"

            elif action.startswith("NAVIGATE:"):
                url = action[9:].strip()
                await self.page.goto(url, wait_until="networkidle", timeout=15000)
                return f"Navigated to: {url}"

            elif action.startswith("SCREENSHOT:"):
                name = action[11:].strip().replace(" ", "_")[:30]
                path = self.screenshots_dir / f"agent_{name}_{int(time.time())}.png"
                await self.page.screenshot(path=str(path), full_page=True)
                return f"Screenshot saved: {path.name}"

            elif action.startswith("FINDING:"):
                parts = action[8:].strip().split("|", 2)
                if len(parts) >= 3:
                    severity, ftype, desc = parts[0].strip(), parts[1].strip(), parts[2].strip()
                    # Take screenshot of the finding
                    ss_path = self.screenshots_dir / f"finding_{len(self.findings)}_{int(time.time())}.png"
                    await self.page.screenshot(path=str(ss_path), full_page=True)

                    self.findings.append(Finding(
                        severity=severity,
                        type=ftype,
                        description=desc,
                        screenshot_path=str(ss_path),
                        page_url=self.page.url,
                        steps_to_reproduce=list(self.actions_log[-5:]),
                    ))
                    return f"FINDING [{severity}]: {desc[:60]}"
                return f"[Invalid FINDING format: {action[:50]}]"

            elif action.startswith("DONE:"):
                return f"DONE: {action[5:].strip()[:100]}"

            else:
                return f"[Unknown action: {action[:50]}]"

        except Exception as e:
            return f"[Action failed: {str(e)[:100]}]"

    async def _check_for_errors(self):
        """Check the page for error indicators after an action."""
        try:
            # Check for JavaScript errors in console
            # Check for visible error messages
            error_text = await self.page.evaluate("""
                () => {
                    const errors = document.querySelectorAll(
                        '.error, [role="alert"], .text-red-500, .text-destructive, ' +
                        '.error-message, .toast-error'
                    );
                    return Array.from(errors)
                        .map(e => e.textContent?.trim())
                        .filter(t => t && t.length > 5)
                        .slice(0, 3)
                        .join(' | ');
                }
            """)

            if error_text and len(error_text) > 5:
                self.findings.append(Finding(
                    severity="medium",
                    type="error",
                    description=f"Error visible on page: {error_text[:200]}",
                    page_url=self.page.url,
                    steps_to_reproduce=list(self.actions_log[-3:]),
                ))

            # Check for blank/white screen (possible crash)
            body_text = await self.page.evaluate(
                "() => document.body?.innerText?.trim()?.length || 0"
            )
            if body_text == 0:
                title = await self.page.title()
                if "error" in title.lower() or not title:
                    self.findings.append(Finding(
                        severity="high",
                        type="crash",
                        description=f"Blank/crashed page at {self.page.url}",
                        page_url=self.page.url,
                        steps_to_reproduce=list(self.actions_log[-5:]),
                    ))

        except Exception:
            pass  # Error checking itself should never break the agent
