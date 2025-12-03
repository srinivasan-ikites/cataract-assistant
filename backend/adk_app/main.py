from __future__ import annotations

import asyncio
import sys
from typing import Iterable

from google.adk.runners import InMemoryRunner

from adk_app.agents import build_cataract_agent
from adk_app.config import ModelConfig
from adk_app.telemetry.logger import configure_logging, get_logger

logger = get_logger(__name__)


def bootstrap_agent():
    configure_logging()
    config = ModelConfig.from_env()
    agent = build_cataract_agent(config=config)
    logger.info(
        "agent.initialized",
        extra={
            "provider": config.provider,
            "model": config.model,
            "temperature": config.temperature,
        },
    )
    return agent


async def _run_turn(
    runner: InMemoryRunner,
    message: str,
    user_id: str,
    session_id: str,
) -> None:
    await runner.run_debug(
        message,
        user_id=user_id,
        session_id=session_id,
        verbose=True,
    )


async def main(messages: Iterable[str] | None = None) -> None:
    agent = bootstrap_agent()
    app_name = "agents"
    runner = InMemoryRunner(agent=agent, app_name=app_name)
    user_id = "local_cli_user"
    session_id = f"{app_name}_session"

    async def interactive_loop():
        print("Enter 'exit' to quit.")
        while True:
            try:
                query = input("User> ").strip()
            except EOFError:
                break
            if not query:
                continue
            if query.lower() in {"exit", "quit"}:
                break
            await _run_turn(runner, query, user_id, session_id)

    if messages is not None:
        for msg in messages:
            print(f"User> {msg}")
            await _run_turn(runner, msg, user_id, session_id)
    elif sys.stdin.isatty():
        await interactive_loop()
    else:
        sample_prompts = [
            "What drops should I use tonight after my surgery?",
            "Does Bayview clinic cover premium lenses with insurance?",
        ]
        for msg in sample_prompts:
            print(f"User> {msg}")
            await _run_turn(runner, msg, user_id, session_id)


if __name__ == "__main__":
    cli_messages: list[str] | None = sys.argv[1:] or None
    try:
        asyncio.run(main(messages=cli_messages))
    except KeyboardInterrupt:
        print("\nSession terminated by user.")

