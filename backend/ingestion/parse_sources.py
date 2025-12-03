from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
from typing import Sequence

from bs4 import BeautifulSoup

from ingestion.config_loader import SourceConfig, load_sources
from ingestion.parsers import (
    article_document_to_dict,
    load_article_metadata,
    parse_qa_document,
    qa_record_to_dict,
)

LOGGER = logging.getLogger("ingestion.parser")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Parse AAO HTML snapshots into structured records.")
    parser.add_argument("--config", default="config/ingestion_sources.yaml", help="Path to ingestion config YAML")
    parser.add_argument("--html-dir", default="data/raw/html", help="Directory containing downloaded HTML snapshots")
    parser.add_argument("--output-dir", default="data/processed", help="Directory for structured JSONL outputs")
    parser.add_argument("--only", nargs="+", help="Limit article parsing to specific source IDs")
    parser.add_argument("--qa-limit", type=int, default=0, help="Limit number of QA detail files to parse (0 = all)")
    parser.add_argument("--log-level", default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"])
    return parser.parse_args()


def parse_article_sources(sources: Sequence[SourceConfig], html_root: Path, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as outfile:
        for source in sources:
            if source.type != "article" or not source.enabled:
                continue
            html_path = html_root / "articles" / f"{source.id}.html"
            if not html_path.exists():
                LOGGER.warning("Missing HTML snapshot for %s at %s", source.id, html_path)
                continue
            html = html_path.read_text(encoding="utf-8", errors="ignore")
            soup = BeautifulSoup(html, "lxml")
            try:
                document = load_article_metadata(soup, default_url=source.url)
            except ValueError as exc:
                LOGGER.error("Failed parsing article %s: %s", source.id, exc)
                continue
            doc_dict = article_document_to_dict(document)
            for section in document.sections:
                record = {
                    "record_type": "article_section",
                    "source_id": source.id,
                    "source_url": source.url,
                    "source_tags": source.tags,
                    "page_title": doc_dict["title"],
                    "published_at": doc_dict["published_at"],
                    "updated_at": doc_dict["updated_at"],
                    "section_title": section.section_title,
                    "order": section.order,
                    "anchor": section.anchor,
                    "text": section.text,
                    "links": [link.__dict__ for link in section.links],
                    "media": [media.__dict__ for media in section.media],
                    "language": source.language or "en",
                    "html_path": str(html_path),
                }
                outfile.write(json.dumps(record, ensure_ascii=False) + "\n")


def parse_qa_files(html_root: Path, output_path: Path, limit: int) -> None:
    qa_dir = html_root / "qa"
    if not qa_dir.exists():
        LOGGER.warning("QA directory %s does not exist, skipping.", qa_dir)
        return
    files = sorted(qa_dir.glob("*.html"))
    if limit and limit > 0:
        files = files[:limit]
    if not files:
        LOGGER.info("No QA detail files to parse.")
        return
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as outfile:
        for html_path in files:
            html = html_path.read_text(encoding="utf-8", errors="ignore")
            slug = html_path.stem
            try:
                record = parse_qa_document(html, slug=slug)
            except ValueError as exc:
                LOGGER.error("Failed parsing QA %s: %s", html_path, exc)
                continue
            data = qa_record_to_dict(record)
            canonical = data.get("canonical_url") or f"https://www.aao.org/eye-health/ask-ophthalmologist-q/{slug}"
            payload = {
                "record_type": "qa",
                "slug": data["slug"],
                "title": data["title"],
                "question": data["question"],
                "answer": data["answer"],
                "answer_links": data["answer_links"],
                "answered_by": data["answered_by"],
                "answered_by_url": data["answered_by_url"],
                "answered_at": data["answered_at"],
                "categories": data["categories"],
                "source_url": canonical,
                "language": "en",
                "html_path": str(html_path),
            }
            outfile.write(json.dumps(payload, ensure_ascii=False) + "\n")


def main() -> None:
    args = parse_args()
    logging.basicConfig(level=getattr(logging, args.log_level.upper()))

    sources = load_sources(Path(args.config))
    if args.only:
        allowed = set(args.only)
        sources = [s for s in sources if s.id in allowed]

    html_root = Path(args.html_dir)
    output_dir = Path(args.output_dir)
    parse_article_sources(sources, html_root, output_dir / "articles.jsonl")
    parse_qa_files(html_root, output_dir / "qa.jsonl", limit=args.qa_limit)


if __name__ == "__main__":
    main()

