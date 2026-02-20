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


def configure_logging() -> None:
    """Configure root logging once with JSON formatter + optional Google Chat alerts."""
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

    # If Google Chat webhook is configured, add the alert handler
    webhook_url = os.getenv("GOOGLE_CHAT_WEBHOOK_URL", "").strip()
    if webhook_url:
        cooldown = int(os.getenv("ERROR_ALERT_COOLDOWN", "300"))
        chat_handler = GoogleChatHandler(webhook_url, cooldown)
        root.addHandler(chat_handler)

    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    configure_logging()
    return logging.getLogger(name)
