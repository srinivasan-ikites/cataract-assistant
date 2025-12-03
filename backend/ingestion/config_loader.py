from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml
from pydantic import BaseModel, Field


class CrawlConfig(BaseModel):
    mode: Optional[str] = None
    follow_links: Optional[str] = None


class SourceConfig(BaseModel):
    id: str
    url: str
    type: str
    tags: List[str] = Field(default_factory=list)
    enabled: bool = True
    notes: Optional[str] = None
    crawl: Optional[CrawlConfig] = None
    source_name: Optional[str] = None
    language: Optional[str] = None
    snapshot_html: Optional[bool] = True


class IngestionConfig(BaseModel):
    defaults: Dict[str, Any] = Field(default_factory=dict)
    sources: List[SourceConfig]


def load_sources(config_path: Path) -> List[SourceConfig]:
    """Load and validate ingestion sources from YAML."""
    raw = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    config = IngestionConfig(**raw)

    merged: List[SourceConfig] = []
    defaults = config.defaults
    for entry in raw.get("sources", []):
        combined = {**defaults, **entry}
        merged.append(SourceConfig(**combined))

    # Preserve original order from YAML
    ordered_ids = [entry["id"] for entry in raw.get("sources", [])]
    ordered = sorted(merged, key=lambda s: ordered_ids.index(s.id))
    return ordered


