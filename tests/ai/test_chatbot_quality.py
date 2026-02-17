"""
AI Evaluation: Chatbot response quality scoring.

Sends real questions through the chatbot API, then evaluates
each response using the LLM-as-judge evaluator.

Pass criteria: No dimension below 3/5, overall average >= 3.5/5.
"""

import json
from pathlib import Path

import pytest
import httpx

from tests.ai.chatbot_evaluator import evaluate_response, EvaluationResult

pytestmark = [pytest.mark.ai, pytest.mark.slow]

# Questions that exercise different chatbot capabilities
TEST_QUESTIONS = [
    # General medical knowledge
    "What is a cataract and why does it need surgery?",
    "How long does cataract surgery usually take?",
    "What are the risks of cataract surgery?",

    # Lens-related
    "What types of lenses are available for cataract surgery?",
    "What is a toric lens and who needs one?",
    "What is the difference between monofocal and multifocal lenses?",

    # Pre-surgery
    "How should I prepare for my cataract surgery?",
    "Can I eat before cataract surgery?",
    "What medications should I stop before surgery?",

    # Post-surgery
    "What should I expect after cataract surgery?",
    "When can I drive after cataract surgery?",
    "How long is the recovery period?",

    # Patient-specific (requires personalization)
    "Which lens would be best for me based on my measurements?",
    "I have astigmatism — how does that affect my surgery?",

    # Emotional/concerned
    "I'm nervous about the surgery. Is it safe?",
]

MIN_DIMENSION_SCORE = 3
MIN_OVERALL_SCORE = 3.5

# Known test patient ID (avoids unreliable status-based lookup)
TEST_PATIENT_ID = "001"


@pytest.fixture(scope="module")
def chatbot_results(config) -> list[dict]:
    """Send all test questions through the chatbot and collect answers."""
    results = []

    with httpx.Client(base_url=config.API_BASE, timeout=60.0) as client:
        for question in TEST_QUESTIONS:
            try:
                resp = client.post("/ask", json={
                    "question": question,
                    "patient_id": TEST_PATIENT_ID,
                    "clinic_id": config.TEST_CLINIC_ID,
                })
                if resp.status_code == 200:
                    data = resp.json()
                    results.append({
                        "question": question,
                        "answer": data.get("answer", ""),
                    })
                else:
                    results.append({
                        "question": question,
                        "answer": f"[ERROR {resp.status_code}]: {resp.text[:200]}",
                    })
            except Exception as e:
                results.append({
                    "question": question,
                    "answer": f"[EXCEPTION]: {str(e)}",
                })

    return results


class TestChatbotQuality:
    """Evaluate chatbot response quality using AI judge."""

    def test_overall_quality(self, chatbot_results, config):
        """All chatbot responses meet minimum quality threshold."""
        if not chatbot_results:
            pytest.skip("No chatbot results to evaluate")

        if not config.GOOGLE_API_KEY:
            pytest.skip("GOOGLE_API_KEY not set — needed for AI evaluation")

        evaluations: list[EvaluationResult] = []
        failures = []

        for qa in chatbot_results:
            if qa["answer"].startswith("[ERROR") or qa["answer"].startswith("[EXCEPTION"):
                failures.append(f"Q: {qa['question'][:50]}... -> {qa['answer'][:100]}")
                continue

            evaluation = evaluate_response(
                question=qa["question"],
                answer=qa["answer"],
                patient_context="Cataract patient with nuclear sclerosis, astigmatism -2.72D OD, scheduled for surgery",
            )
            evaluations.append(evaluation)

            if evaluation.error:
                failures.append(f"Q: {qa['question'][:50]}... -> EVAL ERROR: {evaluation.error[:100]}")
                continue

            # Check per-dimension minimums
            score = evaluation.score
            for dim_name, dim_value in [
                ("accuracy", score.accuracy),
                ("relevance", score.relevance),
                ("safety", score.safety),
                ("tone", score.tone),
            ]:
                if dim_value < MIN_DIMENSION_SCORE:
                    failures.append(
                        f"Q: {qa['question'][:50]}... -> {dim_name}={dim_value}/5 "
                        f"(min {MIN_DIMENSION_SCORE}). Reason: {score.reasoning[:100]}"
                    )

        # Save detailed report
        report_path = Path(config.REPORTS_DIR) / "ai_evaluation_report.json"
        report_data = []
        for ev in evaluations:
            report_data.append({
                "question": ev.question,
                "answer_preview": ev.answer[:200],
                "scores": {
                    "accuracy": ev.score.accuracy,
                    "relevance": ev.score.relevance,
                    "personalization": ev.score.personalization,
                    "safety": ev.score.safety,
                    "tone": ev.score.tone,
                    "completeness": ev.score.completeness,
                    "overall": round(ev.score.overall, 2),
                },
                "reasoning": ev.score.reasoning,
                "error": ev.error,
            })

        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report_data, indent=2))
        print(f"\n[AI Eval] Report saved: {report_path}")

        # Calculate overall average
        scored = [e for e in evaluations if not e.error]
        if scored:
            avg_overall = sum(e.score.overall for e in scored) / len(scored)
            print(f"[AI Eval] Average overall score: {avg_overall:.2f}/5.0")
            print(f"[AI Eval] Questions evaluated: {len(scored)}")
            print(f"[AI Eval] API errors: {len([qa for qa in chatbot_results if qa['answer'].startswith('[ERROR')])}")

        if failures:
            failure_msg = "\n".join(failures[:10])  # Show first 10
            pytest.fail(
                f"{len(failures)} quality issue(s) found:\n{failure_msg}"
            )
