"""Tool registry for the cataract counsellor agent."""


def build_all_tools():
    from adk_app.tools.orchestration_tool import build_orchestration_tool

    return [build_orchestration_tool()]

