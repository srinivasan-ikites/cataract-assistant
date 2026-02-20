from __future__ import annotations

import hashlib
import json
import logging
import os
import sys
import time
import threading
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Any

_CONFIGURED = False


class JsonFormatter(logging.Formatter):
    """Render log records as single-line JSON objects."""

    _RESERVED = {
        "name",
        "msg",
        "args",
        "levelname",
        "levelno",
        "pathname",
        "filename",
        "module",
        "exc_info",
        "exc_text",
        "stack_info",
        "lineno",
        "funcName",
        "created",
        "msecs",
        "relativeCreated",
        "thread",
        "threadName",
        "processName",
        "process",
    }

    def format(self, record: logging.LogRecord) -> str:
        log: dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key not in self._RESERVED and not key.startswith("_"):
                log[key] = value
        if record.exc_info:
            log["exception"] = self.formatException(record.exc_info)
        return json.dumps(log, ensure_ascii=False)


# ── Google Chat Handler ────────────────────────────────────────────────


class GoogleChatHandler(logging.Handler):
    """
    Logging handler that sends ERROR-level logs to Google Chat via webhook.

    Features:
    - Only fires on ERROR and above (ignores INFO, WARNING, DEBUG)
    - Deduplication: same error won't re-alert within the cooldown period
    - Non-blocking: sends alerts in a background thread so it never slows down requests
    - Graceful failure: if the webhook call fails, it logs to stderr and moves on
    """

    def __init__(self, webhook_url: str, cooldown: int = 300):
        super().__init__(level=logging.ERROR)
        self.webhook_url = webhook_url
        self.cooldown = cooldown
        self._last_alert: dict[str, float] = {}
        self._lock = threading.Lock()

    def _fingerprint(self, record: logging.LogRecord) -> str:
        """Create a short hash to identify duplicate errors."""
        msg = record.getMessage()
        path = getattr(record, "path", "")
        error = getattr(record, "error", "")
        raw = f"{msg}|{path}|{error}"
        return hashlib.md5(raw.encode()).hexdigest()[:12]

    def _should_alert(self, fingerprint: str) -> bool:
        """Check cooldown — returns True if this error should trigger an alert."""
        now = time.time()
        with self._lock:
            last = self._last_alert.get(fingerprint, 0)
            if now - last > self.cooldown:
                self._last_alert[fingerprint] = now
                return True
        return False

    def _send(self, record: logging.LogRecord) -> None:
        """Build and POST the Google Chat card message (runs in background thread)."""
        ts = datetime.now(timezone.utc).strftime("%b %d, %Y at %I:%M %p UTC")
        message = record.getMessage()
        request_id = getattr(record, "request_id", "N/A")
        method = getattr(record, "method", "")
        path = getattr(record, "path", "")
        endpoint = f"{method} {path}".strip() or "N/A"
        status = getattr(record, "status", 500)
        duration = getattr(record, "duration_ms", "")
        error_detail = getattr(record, "error", "")
        user = getattr(record, "user", None) or getattr(record, "patient_id", None) or "anonymous"
        clinic = getattr(record, "clinic", "")

        widgets = [
            {"keyValue": {"topLabel": "Endpoint", "content": str(endpoint)}},
            {"keyValue": {"topLabel": "Message", "content": str(message)[:500]}},
        ]
        if error_detail:
            widgets.append({"keyValue": {"topLabel": "Error", "content": str(error_detail)[:500]}})
        widgets.append({"keyValue": {"topLabel": "User", "content": str(user)}})
        if clinic:
            widgets.append({"keyValue": {"topLabel": "Clinic", "content": str(clinic)}})
        if duration:
            widgets.append({"keyValue": {"topLabel": "Duration", "content": f"{duration}ms"}})
        widgets.append({"keyValue": {"topLabel": "Time (UTC)", "content": ts}})

        card = {
            "cards": [{
                "header": {
                    "title": "Production Error",
                    "subtitle": f"REQ-{request_id} | HTTP {status}",
                },
                "sections": [{"widgets": widgets}],
            }]
        }

        # Add stack trace if present
        if record.exc_info:
            trace = self.format(record) if self.formatter else logging.Formatter().formatException(record.exc_info)
            card["cards"][0]["sections"].append({
                "widgets": [{"textParagraph": {"text": f"<b>Stack Trace</b>\n<pre>{trace[:1500]}</pre>"}}]
            })

        payload = json.dumps(card).encode("utf-8")
        req = urllib.request.Request(
            self.webhook_url,
            data=payload,
            headers={"Content-Type": "application/json; charset=UTF-8"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=10):
                pass
        except Exception as exc:
            # Print to stderr so it doesn't trigger another alert loop
            print(f"[GoogleChatHandler] Failed to send alert: {exc}", file=sys.stderr)

    def emit(self, record: logging.LogRecord) -> None:
        """Called by the logging framework for every ERROR+ log."""
        fp = self._fingerprint(record)
        if not self._should_alert(fp):
            return
        # Send in background thread so it never blocks the request
        thread = threading.Thread(target=self._send, args=(record,), daemon=True)
        thread.start()


# ── GitHub Issue Handler ───────────────────────────────────────────────


class GitHubIssueHandler(logging.Handler):
    """
    Logging handler that creates GitHub issues for production errors.

    When an ERROR is logged, this handler:
    1. Checks if an open issue already exists for this error (by title match)
    2. If not, creates a new issue with the "agent" label
    3. The "agent" label triggers the Claude Code workflow to auto-fix the bug

    Flow: Error → GitHub Issue (with "agent" label) → Claude Agent → PR

    Features:
    - Deduplication: checks for existing open issues before creating
    - Cooldown: won't create issues for the same error within the cooldown window
    - Non-blocking: runs in background thread
    - Skips test errors (from /healthz/test-error)
    """

    def __init__(self, token: str, repo: str, cooldown: int = 600):
        super().__init__(level=logging.ERROR)
        self.token = token
        self.repo = repo  # "owner/repo" format
        self.cooldown = cooldown
        self._last_created: dict[str, float] = {}
        self._lock = threading.Lock()

    def _fingerprint(self, record: logging.LogRecord) -> str:
        """Create a fingerprint to identify duplicate errors."""
        path = getattr(record, "path", "")
        error = getattr(record, "error", "")
        raw = f"{path}|{error}"
        return hashlib.md5(raw.encode()).hexdigest()[:12]

    def _should_create(self, fingerprint: str) -> bool:
        """Check cooldown — returns True if enough time has passed."""
        now = time.time()
        with self._lock:
            last = self._last_created.get(fingerprint, 0)
            if now - last > self.cooldown:
                self._last_created[fingerprint] = now
                return True
        return False

    def _github_api(self, method: str, endpoint: str, data: dict | None = None) -> dict | list | None:
        """Make a GitHub API request."""
        url = f"https://api.github.com/repos/{self.repo}/{endpoint}"
        body = json.dumps(data).encode("utf-8") if data else None
        req = urllib.request.Request(
            url,
            data=body,
            headers={
                "Authorization": f"Bearer {self.token}",
                "Accept": "application/vnd.github+json",
                "Content-Type": "application/json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            method=method,
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            print(f"[GitHubIssueHandler] API error: {exc}", file=sys.stderr)
            return None

    def _issue_exists(self, title: str) -> bool:
        """Check if an open issue with this title already exists."""
        # Search for open issues with matching title
        search_url = f"https://api.github.com/search/issues?q={urllib.request.quote(title)}+repo:{self.repo}+state:open+label:agent"
        req = urllib.request.Request(
            search_url,
            headers={
                "Authorization": f"Bearer {self.token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                # Check if any open issue has a very similar title
                for issue in result.get("items", []):
                    if issue.get("title", "").strip() == title.strip():
                        return True
        except Exception:
            pass
        return False

    def _create_issue(self, record: logging.LogRecord) -> None:
        """Build and create a GitHub issue from the error (runs in background thread)."""
        method = getattr(record, "method", "")
        path = getattr(record, "path", "")
        endpoint = f"{method} {path}".strip() or "Unknown endpoint"
        error_detail = getattr(record, "error", record.getMessage())
        request_id = getattr(record, "request_id", "N/A")
        status = getattr(record, "status", 500)
        user = getattr(record, "user", None) or getattr(record, "patient_id", None) or "anonymous"
        clinic = getattr(record, "clinic", "")
        duration = getattr(record, "duration_ms", "")
        ts = datetime.now(timezone.utc).strftime("%b %d, %Y at %I:%M %p UTC")

        # Build issue title
        short_error = str(error_detail)[:80].split("\n")[0]
        title = f"[Production Error] {endpoint}: {short_error}"

        # Skip if an open issue with this title already exists
        if self._issue_exists(title):
            print(f"[GitHubIssueHandler] Issue already exists: {title[:60]}...", file=sys.stderr)
            return

        # Build issue body with full context for Claude to investigate
        stack_trace = ""
        if record.exc_info:
            try:
                stack_trace = logging.Formatter().formatException(record.exc_info)
            except Exception:
                pass

        body = f"""## Production Error — Auto-generated

An error occurred in production that needs investigation and fixing.

### Error Details

| Field | Value |
|-------|-------|
| **Endpoint** | `{endpoint}` |
| **HTTP Status** | {status} |
| **Error** | {error_detail} |
| **Request ID** | `{request_id}` |
| **User** | {user} |
| **Clinic** | {clinic or 'N/A'} |
| **Duration** | {duration}ms |
| **Time (UTC)** | {ts} |

"""
        if stack_trace:
            body += f"""### Stack Trace

```
{stack_trace[:3000]}
```

"""

        body += """### Instructions

1. Look at the stack trace and error message above
2. Find the relevant source file and understand the root cause
3. Write a test that reproduces this error (if possible)
4. Fix the bug
5. Verify the fix by running existing tests

> This issue was auto-created by the production error monitoring system.
"""

        # Create the issue with the "agent" label
        result = self._github_api("POST", "issues", {
            "title": title,
            "body": body,
            "labels": ["agent"],
        })

        if result and result.get("number"):
            print(f"[GitHubIssueHandler] Created issue #{result['number']}: {title[:60]}...", file=sys.stderr)
        else:
            print(f"[GitHubIssueHandler] Failed to create issue: {title[:60]}...", file=sys.stderr)

    def emit(self, record: logging.LogRecord) -> None:
        """Called by the logging framework for every ERROR+ log."""
        # Skip test errors — don't create issues for deliberate test triggers
        error_msg = getattr(record, "error", "") or record.getMessage()
        if "TEST ERROR" in str(error_msg) or "TEST ALERT" in str(error_msg):
            return

        fp = self._fingerprint(record)
        if not self._should_create(fp):
            return
        # Create issue in background thread
        thread = threading.Thread(target=self._create_issue, args=(record,), daemon=True)
        thread.start()


# ── Configure Logging ──────────────────────────────────────────────────


def configure_logging() -> None:
    """Configure root logging once with JSON formatter + optional alert handlers."""
    global _CONFIGURED
    if _CONFIGURED:
        return

    level = os.getenv("LOG_LEVEL", "INFO").upper()
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers.clear()
    root.addHandler(handler)

    # Google Chat alerts
    webhook_url = os.getenv("GOOGLE_CHAT_WEBHOOK_URL", "").strip()
    if webhook_url:
        cooldown = int(os.getenv("ERROR_ALERT_COOLDOWN", "300"))
        chat_handler = GoogleChatHandler(webhook_url, cooldown)
        root.addHandler(chat_handler)

    # GitHub issue auto-creation
    gh_token = os.getenv("GITHUB_TOKEN", "").strip()
    gh_repo = os.getenv("GITHUB_REPO", "").strip()
    if gh_token and gh_repo:
        gh_cooldown = int(os.getenv("GITHUB_ISSUE_COOLDOWN", "600"))
        github_handler = GitHubIssueHandler(gh_token, gh_repo, gh_cooldown)
        root.addHandler(github_handler)

    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    configure_logging()
    return logging.getLogger(name)
