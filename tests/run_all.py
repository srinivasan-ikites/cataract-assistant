"""
Master Test Runner — Runs all 4 testing layers and generates unified report.

Usage:
    python tests/run_all.py              # Run all layers
    python tests/run_all.py --api        # Run only API tests
    python tests/run_all.py --e2e        # Run only E2E tests
    python tests/run_all.py --ai         # Run only AI evaluation
    python tests/run_all.py --agent      # Run only agent exploration
    python tests/run_all.py --fast       # Skip slow tests (agent + AI)
"""

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

TESTS_DIR = Path(__file__).parent
REPORTS_DIR = TESTS_DIR / "reports"
REPORTS_DIR.mkdir(exist_ok=True)


def run_layer(name: str, test_path: str, extra_args: list[str] = None) -> dict:
    """Run a test layer and return results."""
    print(f"\n{'='*60}")
    print(f"  LAYER: {name}")
    print(f"{'='*60}\n")

    html_report = REPORTS_DIR / f"{name}_report.html"
    cmd = [
        sys.executable, "-m", "pytest",
        str(TESTS_DIR / test_path),
        f"--html={html_report}",
        "--self-contained-html",
        "-v",
        "--tb=short",
    ]
    if extra_args:
        cmd.extend(extra_args)

    start = time.time()
    result = subprocess.run(cmd, capture_output=True, text=True)
    duration = time.time() - start

    # Parse pytest output for pass/fail counts
    output = result.stdout + result.stderr
    passed = output.count(" passed")
    failed = output.count(" failed")
    errors = output.count(" error")
    skipped = output.count(" skipped")

    print(output[-2000:] if len(output) > 2000 else output)

    return {
        "layer": name,
        "test_path": test_path,
        "exit_code": result.returncode,
        "duration_seconds": round(duration, 1),
        "passed": passed,
        "failed": failed,
        "errors": errors,
        "skipped": skipped,
        "html_report": str(html_report),
    }


def generate_summary(results: list[dict]) -> str:
    """Generate a unified summary report."""
    total_passed = sum(r["passed"] for r in results)
    total_failed = sum(r["failed"] for r in results)
    total_errors = sum(r["errors"] for r in results)
    total_duration = sum(r["duration_seconds"] for r in results)

    all_green = all(r["exit_code"] == 0 for r in results)

    lines = [
        "",
        "=" * 60,
        "  UNIFIED TEST REPORT",
        f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "=" * 60,
        "",
    ]

    for r in results:
        status = "PASS" if r["exit_code"] == 0 else "FAIL"
        icon = "[OK]" if status == "PASS" else "[!!]"
        lines.append(
            f"  {icon} {r['layer']:20s}  "
            f"passed={r['passed']}  failed={r['failed']}  "
            f"errors={r['errors']}  skipped={r['skipped']}  "
            f"({r['duration_seconds']}s)"
        )

    lines.extend([
        "",
        "-" * 60,
        f"  TOTAL: {total_passed} passed, {total_failed} failed, "
        f"{total_errors} errors  ({total_duration:.0f}s)",
        "",
        f"  STATUS: {'ALL TESTS PASSED' if all_green else 'SOME TESTS FAILED'}",
        "=" * 60,
        "",
        "  Reports saved to:",
    ])

    for r in results:
        lines.append(f"    - {r['html_report']}")

    # Check for JSON reports from AI/agent layers
    for json_file in REPORTS_DIR.glob("*.json"):
        lines.append(f"    - {json_file}")

    lines.append("")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Run automated tests")
    parser.add_argument("--api", action="store_true", help="Run API tests only")
    parser.add_argument("--e2e", action="store_true", help="Run E2E tests only")
    parser.add_argument("--ai", action="store_true", help="Run AI evaluation only")
    parser.add_argument("--agent", action="store_true", help="Run agent tests only")
    parser.add_argument("--fast", action="store_true", help="Skip slow tests")
    args = parser.parse_args()

    # If no specific layer selected, run all
    run_all = not (args.api or args.e2e or args.ai or args.agent)

    results = []

    if args.api or run_all:
        results.append(run_layer("api", "api/"))

    if args.e2e or run_all:
        results.append(run_layer("e2e", "e2e/"))

    if (args.ai or run_all) and not args.fast:
        results.append(run_layer("ai", "ai/"))

    if (args.agent or run_all) and not args.fast:
        results.append(run_layer("agent", "agent/"))

    # Generate and print summary
    summary = generate_summary(results)
    print(summary)

    # Save summary
    summary_path = REPORTS_DIR / "summary.txt"
    summary_path.write_text(summary)

    # Save JSON summary for programmatic access
    json_summary = {
        "timestamp": datetime.now().isoformat(),
        "layers": results,
        "overall_pass": all(r["exit_code"] == 0 for r in results),
    }
    json_path = REPORTS_DIR / "summary.json"
    json_path.write_text(json.dumps(json_summary, indent=2))

    # Exit with non-zero if any tests failed
    if any(r["exit_code"] != 0 for r in results):
        sys.exit(1)


if __name__ == "__main__":
    main()
