#!/usr/bin/env python
"""Utility to profile the cataract counsellor pipeline end-to-end."""

from __future__ import annotations

import argparse
import json
import sys
import textwrap
from collections import defaultdict
from functools import wraps
from time import perf_counter
from typing import Dict, List, Tuple

import litellm

from adk_app.config import ModelConfig
from adk_app.orchestration import pipeline as pipeline_module
from adk_app.services import qdrant_service
from adk_app.tools import context_tools, general_kb_tool
from adk_app.utils import data_loader

litellm.drop_params = True

SYSTEM_INSTRUCTION = (
    "You are a cataract counselling assistant. For every user turn call the "
    "orchestrate_context_tool to gather router decisions, retrieve the necessary "
    "knowledge bases, and receive a ready prompt block. Use that prompt text to craft "
    "your final answer, cite the provided context sections, and do not call other tools "
    "unless explicitly instructed for diagnostics. Always be empathetic and escalate "
    "emergencies when flagged."
)

PRINT_ORDER = [
    "patient_json_initial_ms",
    "patient_json_context_ms",
    "router_llm_ms",
    "general_kb_tool_ms",
    "embedding_ms",
    "qdrant_query_ms",
    "clinic_context_ms",
    "patient_context_ms",
    "prompt_builder_ms",
    "orchestration_total_ms",
    "final_llm_api_ms",
    "end_to_end_ms",
]


class LatencyProbe:
    """Monkey patches the pipeline to track fine-grained timings."""

    def __init__(self) -> None:
        self.timings: defaultdict[str, float] = defaultdict(float)
        self._installed = False
        self._patient_lookup_pending = False

    def install(self) -> None:
        if self._installed:
            return
        self._installed = True
        self._patch_pipeline_functions()
        self._patch_general_kb_dependencies()

    def reset(self, needs_patient_lookup: bool) -> None:
        self.timings.clear()
        self._patient_lookup_pending = needs_patient_lookup

    def _record(self, key: str, seconds: float) -> None:
        self.timings[key] += seconds * 1000.0

    def _wrap(self, func, label: str):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start = perf_counter()
            result = func(*args, **kwargs)
            self._record(label, perf_counter() - start)
            return result

        return wrapper

    def _patch_pipeline_functions(self) -> None:
        pipeline_module.router_tool = self._wrap(
            pipeline_module.router_tool, "router_llm_ms"
        )
        pipeline_module.general_kb_search_tool = self._wrap(
            pipeline_module.general_kb_search_tool, "general_kb_tool_ms"
        )
        pipeline_module.clinic_context_tool = self._wrap(
            pipeline_module.clinic_context_tool, "clinic_context_ms"
        )
        pipeline_module.patient_context_tool = self._wrap(
            pipeline_module.patient_context_tool, "patient_context_ms"
        )
        pipeline_module.build_prompt_block = self._wrap(
            pipeline_module.build_prompt_block, "prompt_builder_ms"
        )
        self._patch_patient_loader()

    def _patch_general_kb_dependencies(self) -> None:
        general_kb_tool.embed_query = self._wrap(
            general_kb_tool.embed_query, "embedding_ms"
        )

        original_search = qdrant_service.QdrantSearchService.search

        @wraps(original_search)
        def search_wrapper(service, *args, **kwargs):
            start = perf_counter()
            result = original_search(service, *args, **kwargs)
            self._record("qdrant_query_ms", perf_counter() - start)
            return result

        qdrant_service.QdrantSearchService.search = search_wrapper

    def _patch_patient_loader(self) -> None:
        original_loader = data_loader.get_patient_data

        @wraps(original_loader)
        def loader_wrapper(patient_id: str):
            start = perf_counter()
            result = original_loader(patient_id)
            elapsed = perf_counter() - start
            key = (
                "patient_json_initial_ms"
                if self._patient_lookup_pending
                else "patient_json_context_ms"
            )
            self._record(key, elapsed)
            self._patient_lookup_pending = False
            return result

        data_loader.get_patient_data = loader_wrapper
        pipeline_module.get_patient_data = loader_wrapper
        context_tools.get_patient_data = loader_wrapper


def call_final_llm(prompt: str, config: ModelConfig) -> Tuple[str, float]:
    """Call the final response LLM and return (text, duration_ms)."""
    if not prompt:
        return "", 0.0

    start = perf_counter()
    if config.provider == "gemini":
        from google import genai
        from google.genai import types as genai_types

        client = genai.Client()
        response = client.models.generate_content(
            model=config.model,
            contents=[
                genai_types.Content(
                    role="user", parts=[genai_types.Part.from_text(text=prompt)]
                )
            ],
        )
        text_output = response.text or ""
    else:
        model_name = f"{config.provider}/{config.model}"
        completion = litellm.completion(
            model=model_name,
            messages=[
                {"role": "system", "content": SYSTEM_INSTRUCTION},
                {"role": "user", "content": prompt},
            ],
            temperature=config.temperature,
        )
        text_output = _extract_litellm_text(completion)

    duration_ms = (perf_counter() - start) * 1000.0
    return text_output.strip(), duration_ms


def _extract_litellm_text(response) -> str:
    choices = response.get("choices") if isinstance(response, dict) else None
    if not choices:
        return ""
    message = choices[0].get("message", {})
    content = message.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(item.get("text", "") for item in content if isinstance(item, dict))
    return ""


def format_metrics(metrics: Dict[str, float]) -> List[str]:
    lines: List[str] = []
    if not metrics:
        return lines
    width = max(len(key) for key in metrics)

    def emit(key: str) -> None:
        if key in metrics:
            lines.append(f"  {key.rjust(width)} : {metrics[key]:9.2f}")

    for ordered_key in PRINT_ORDER:
        emit(ordered_key)

    remaining = sorted(set(metrics.keys()) - set(PRINT_ORDER))
    for key in remaining:
        emit(key)
    return lines


def aggregate_metrics(all_metrics: List[Dict[str, float]]) -> Dict[str, float]:
    combined: defaultdict[str, float] = defaultdict(float)
    count: defaultdict[str, int] = defaultdict(int)
    for metric in all_metrics:
        for key, value in metric.items():
            combined[key] += value
            count[key] += 1
    return {key: combined[key] / count[key] for key in combined}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Measure detailed latency for the cataract ADK agent."
    )
    parser.add_argument(
        "--question",
        required=False,
        default="Will my toric lens be covered and what night drops do I use?",
        help="User question to replay through the pipeline.",
    )
    parser.add_argument(
        "--patient-id",
        required=False,
        default="pt_1001",
        help="Patient identifier (optional).",
    )
    parser.add_argument(
        "--clinic-id",
        required=False,
        help="Clinic identifier (optional, auto-derived from patient if possible).",
    )
    parser.add_argument(
        "--iterations",
        type=int,
        default=1,
        help="Number of times to repeat the measurement.",
    )
    parser.add_argument(
        "--cold-cache",
        action="store_true",
        help="Clear clinic/patient caches before each iteration.",
    )
    parser.add_argument(
        "--skip-final-llm",
        action="store_true",
        help="Skip the final response model call (useful when API keys are unavailable).",
    )
    return parser.parse_args()


def maybe_clear_caches() -> None:
    if hasattr(data_loader._load_patient_cache, "cache_clear"):
        data_loader._load_patient_cache.cache_clear()
    if hasattr(data_loader._load_clinic_cache, "cache_clear"):
        data_loader._load_clinic_cache.cache_clear()


def main() -> None:
    args = parse_args()
    config = ModelConfig.from_env()
    probe = LatencyProbe()
    probe.install()

    summaries = []
    for iteration in range(1, args.iterations + 1):
        if args.cold_cache:
            maybe_clear_caches()

        probe.reset(needs_patient_lookup=bool(args.patient_id))
        start = perf_counter()
        try:
            package = pipeline_module.prepare_context(
                question=args.question,
                clinic_id=args.clinic_id,
                patient_id=args.patient_id,
            )
        except Exception as exc:
            print(f"[measure_latency] Pipeline execution failed: {exc}")
            sys.exit(1)
        orchestration_ms = (perf_counter() - start) * 1000.0
        metrics = dict(probe.timings)
        metrics["orchestration_total_ms"] = orchestration_ms

        final_answer = ""
        final_error = None
        if args.skip_final_llm:
            metrics["final_llm_api_ms"] = 0.0
        else:
            try:
                final_answer, final_ms = call_final_llm(package.prompt, config)
                metrics["final_llm_api_ms"] = final_ms
            except Exception as exc:
                final_error = str(exc)
                metrics["final_llm_api_ms"] = 0.0

        metrics["end_to_end_ms"] = metrics.get("orchestration_total_ms", 0.0) + metrics.get(
            "final_llm_api_ms", 0.0
        )

        summaries.append(
            {
                "iteration": iteration,
                "metrics": metrics,
                "router_summary": package.router_summary,
                "final_answer": final_answer,
                "final_error": final_error,
            }
        )

    for summary in summaries:
        print(f"\n=== Iteration {summary['iteration']}/{args.iterations} ===")
        print(f"Question   : {args.question}")
        print(f"Patient ID : {args.patient_id or 'N/A'}")
        print(f"Clinic ID  : {args.clinic_id or 'auto'}")
        print("Router decision:")
        print(json.dumps(summary["router_summary"], indent=2))
        print("\nLatency breakdown (ms):")
        for line in format_metrics(summary["metrics"]):
            print(line)
        if summary["final_error"]:
            print(f"\nFinal LLM call failed: {summary['final_error']}")
        elif not args.skip_final_llm:
            preview = textwrap.shorten(summary["final_answer"], width=240, placeholder="...")
            print(f"\nFinal LLM answer preview: {preview or '[empty response]'}")

    if len(summaries) > 1:
        aggregate = aggregate_metrics([item["metrics"] for item in summaries])
        print("\n=== Average across iterations ===")
        for line in format_metrics(aggregate):
            print(line)


if __name__ == "__main__":
    main()

