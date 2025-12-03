from __future__ import annotations

from google.adk.tools import FunctionTool

from adk_app.orchestration.pipeline import prepare_context


def orchestrate_context_tool(
    question: str,
    clinic_id: str | None = None,
    patient_id: str | None = None,
) -> dict:
    """Run the deterministic RAG pipeline and return prompt + context bundle."""
    package = prepare_context(question=question, clinic_id=clinic_id, patient_id=patient_id)
    return {
        "prompt": package.prompt,
        "router_summary": package.router_summary,
        "general_context": package.general_context,
        "clinic_context": package.clinic_context,
        "patient_context": package.patient_context,
    }


def build_orchestration_tool() -> FunctionTool:
    return FunctionTool(orchestrate_context_tool)



