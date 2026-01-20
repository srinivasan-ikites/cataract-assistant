"""
FastAPI dependencies for the Cataract Counsellor API.
"""
from dataclasses import dataclass
import os

from adk_app.config import ModelConfig


@dataclass
class AgentRuntime:
    """Runtime configuration for the agent."""
    config: ModelConfig


def get_runtime() -> AgentRuntime:
    """Get the agent runtime configuration."""
    config = ModelConfig.from_env()
    router_provider = os.getenv("ROUTER_PROVIDER", config.provider)
    router_model = os.getenv("MODEL_PROVIDER", config.model)
    print(
        "[Model Config] provider="
        f"{config.provider} model={config.model} temperature={config.temperature}"
    )
    print(f"[Router Config] provider={router_provider} model={router_model}")
    return AgentRuntime(config=config)
