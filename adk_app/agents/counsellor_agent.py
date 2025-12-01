from __future__ import annotations

from typing import List

from google.adk.agents import Agent
from google.adk.models.lite_llm import LiteLlm

from adk_app.config import ModelConfig
from adk_app.tools import build_all_tools


def build_cataract_agent(config: ModelConfig, tools: List = None) -> Agent:
    """Create the primary cataract counsellor agent using Google ADK.

    Args:
        config: Model configuration (provider/model/temperature).
        tools: Optional list of ADK Tool instances the agent can invoke.

    Returns:
        Configured ADK `Agent` ready for orchestration.
    """

    instruction = (
        "You are a cataract counselling assistant. "
        "For every user turn call the orchestrate_context_tool to gather router decisions, "
        "retrieve the necessary knowledge bases, and receive a ready prompt block. "
        "Use that prompt text to craft your final answer, cite the provided context sections, "
        "and do not call other tools unless explicitly instructed for diagnostics. "
        "Always be empathetic and escalate emergencies when flagged."
    )

    description = (
        "Handles cataract FAQs, clinic-specific questions, and patient follow-ups using RAG tools."
    )

    agent_tools = tools or build_all_tools()

    if config.provider == "gemini":
        model_ref = config.model
    else:
        model_ref = LiteLlm(model=f"{config.provider}/{config.model}")

    return Agent(
        name="cataract_counsellor",
        model=model_ref,
        instruction=instruction,
        description=description,
        tools=agent_tools,
    )

