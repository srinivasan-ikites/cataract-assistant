#!/usr/bin/env python3
"""
Log Watcher — Monitors Docker container logs for errors and sends alerts to Google Chat.

Runs alongside the Docker containers on the host machine. Tails the backend
container's stdout in real-time, parses JSON log lines, and sends formatted
error alerts to a Google Chat webhook.

Features:
- Real-time log tailing via `docker logs -f`
- JSON log parsing with fallback for non-JSON lines
- Deduplication: same error won't re-alert within the cooldown window
- Rich Google Chat card messages with error context
- Graceful shutdown on Ctrl+C

Usage:
    # Set the webhook URL and run
    export GOOGLE_CHAT_WEBHOOK_URL='https://chat.googleapis.com/v1/spaces/...'
    python scripts/log_watcher.py

    # Or pass options directly
    python scripts/log_watcher.py --container cataract-assistant-backend-1 --cooldown 300

Environment variables:
    GOOGLE_CHAT_WEBHOOK_URL  — Google Chat incoming webhook URL (required)
    WATCH_CONTAINER          — Docker container name (default: cataract-assistant-backend-1)
    ERROR_COOLDOWN           — Seconds before re-alerting same error (default: 300)
"""

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error
from collections import defaultdict
from datetime import datetime, timezone


class LogWatcher:
    def __init__(self, container: str, webhook_url: str, cooldown: int = 300):
        self.container = container
        self.webhook_url = webhook_url
        self.cooldown = cooldown
        self.last_alert: dict[str, float] = defaultdict(float)

    # ── Deduplication ──────────────────────────────────────────────

    def _fingerprint(self, entry: dict) -> str:
        """Create a short hash from the error's distinguishing fields."""
        msg = entry.get("message", "")
        path = entry.get("path", "")
        error = entry.get("error", "")
        exc = (entry.get("exception") or "")[:200]
        raw = f"{msg}|{path}|{error}|{exc}"
        return hashlib.md5(raw.encode()).hexdigest()[:12]

    def _should_alert(self, fingerprint: str) -> bool:
        """Return True if enough time has elapsed since the last alert for this fingerprint."""
        now = time.time()
        if now - self.last_alert[fingerprint] > self.cooldown:
            self.last_alert[fingerprint] = now
            return True
        return False

    # ── Google Chat ────────────────────────────────────────────────

    def _send_alert(self, entry: dict) -> None:
        """Post a formatted card message to Google Chat."""
        ts = entry.get("ts", datetime.now(timezone.utc).isoformat())
        message = entry.get("message", "Unknown error")
        request_id = entry.get("request_id", "N/A")
        method = entry.get("method", "")
        path = entry.get("path", "")
        endpoint = f"{method} {path}".strip() or "N/A"
        status = entry.get("status", "500")
        duration = entry.get("duration_ms", "")
        error_detail = entry.get("error", "")
        user = entry.get("user") or entry.get("patient_id") or "anonymous"
        clinic = entry.get("clinic", "")
        exception = entry.get("exception", "")

        # Build widgets for the card
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
        widgets.append({"keyValue": {"topLabel": "Time (UTC)", "content": str(ts)}})

        card = {
            "cards": [
                {
                    "header": {
                        "title": "Production Error",
                        "subtitle": f"REQ-{request_id} | HTTP {status}",
                    },
                    "sections": [{"widgets": widgets}],
                }
            ]
        }

        # Add stack trace section if present
        if exception:
            truncated = exception[:1500]
            card["cards"][0]["sections"].append(
                {
                    "widgets": [
                        {
                            "textParagraph": {
                                "text": f"<b>Stack Trace</b>\n<pre>{truncated}</pre>"
                            }
                        }
                    ]
                }
            )

        payload = json.dumps(card).encode("utf-8")
        req = urllib.request.Request(
            self.webhook_url,
            data=payload,
            headers={"Content-Type": "application/json; charset=UTF-8"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    print(f"[WATCHER] Alert sent for REQ-{request_id}")
                else:
                    print(f"[WATCHER] Webhook responded {resp.status}")
        except urllib.error.URLError as exc:
            print(f"[WATCHER] Failed to send alert: {exc}")

    # ── Log Parsing ────────────────────────────────────────────────

    def _parse_line(self, line: str) -> dict | None:
        """Parse a log line and return the dict if it's an ERROR, else None."""
        line = line.strip()
        if not line:
            return None

        # Try JSON first (our structured logger output)
        try:
            entry = json.loads(line)
            if entry.get("level", "").upper() == "ERROR":
                return entry
            return None
        except json.JSONDecodeError:
            pass

        # Fallback: detect error keywords in non-JSON lines
        upper = line.upper()
        if "ERROR" in upper or "EXCEPTION" in upper or "TRACEBACK" in upper:
            return {
                "level": "ERROR",
                "message": line[:500],
                "ts": datetime.now(timezone.utc).isoformat(),
            }

        return None

    # ── Main Loop ──────────────────────────────────────────────────

    def watch(self) -> None:
        print(f"[WATCHER] Monitoring container: {self.container}")
        print(f"[WATCHER] Error cooldown: {self.cooldown}s per unique error")
        print(f"[WATCHER] Webhook: ...{self.webhook_url[-30:]}")
        print(f"[WATCHER] Waiting for errors...\n")

        process = subprocess.Popen(
            ["docker", "logs", "-f", "--tail", "0", self.container],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )

        try:
            for line in process.stdout:  # type: ignore[union-attr]
                entry = self._parse_line(line)
                if entry is None:
                    continue

                fp = self._fingerprint(entry)
                if not self._should_alert(fp):
                    print(f"[WATCHER] Suppressed duplicate ({fp}): {entry.get('message', '')[:80]}")
                    continue

                self._send_alert(entry)

        except KeyboardInterrupt:
            print("\n[WATCHER] Shutting down...")
        finally:
            process.terminate()
            process.wait(timeout=5)


# ── CLI ────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Watch Docker logs and alert on errors via Google Chat")
    parser.add_argument(
        "--container",
        default=os.getenv("WATCH_CONTAINER", "cataract-assistant-backend-1"),
        help="Docker container name to monitor (default: cataract-assistant-backend-1)",
    )
    parser.add_argument(
        "--webhook",
        default=os.getenv("GOOGLE_CHAT_WEBHOOK_URL", ""),
        help="Google Chat incoming webhook URL",
    )
    parser.add_argument(
        "--cooldown",
        type=int,
        default=int(os.getenv("ERROR_COOLDOWN", "300")),
        help="Seconds before re-alerting the same error (default: 300)",
    )
    args = parser.parse_args()

    if not args.webhook:
        print("[WATCHER] ERROR: No webhook URL provided.")
        print("[WATCHER] Set GOOGLE_CHAT_WEBHOOK_URL or use --webhook")
        sys.exit(1)

    watcher = LogWatcher(args.container, args.webhook, args.cooldown)
    watcher.watch()


if __name__ == "__main__":
    main()
