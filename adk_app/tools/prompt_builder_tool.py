from __future__ import annotations

from google.adk.tools import FunctionTool

from adk_app.prompting.prompt_builder import build_prompt_block
def prompt_builder_tool(
    question: str,
    router_output: str,
    general_context: str | None = None,
    clinic_context: str | None = None,
    patient_context: str | None = None,
) -> str:
    """Assemble a structured prompt block from router and context outputs."""
    return build_prompt_block(
        question=question,
        router_output=router_output,
        general_context=general_context,
        clinic_context=clinic_context,
        patient_context=patient_context,
    )


def build_prompt_builder_tool() -> FunctionTool:
    return FunctionTool(prompt_builder_tool)



