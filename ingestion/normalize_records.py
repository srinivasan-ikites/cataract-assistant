from __future__ import annotations

import argparse
import hashlib
import json
import logging
import unicodedata
from pathlib import Path
from typing import Dict, Iterable, List

from ingestion.topic_classifier import load_topic_classifier

LOGGER = logging.getLogger("ingestion.normalizer")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Normalize parsed records and assign topics.")
    parser.add_argument("--articles", default="data/processed/articles.jsonl", help="Path to parsed article sections JSONL")
    parser.add_argument("--qa", default="data/processed/qa.jsonl", help="Path to parsed QA JSONL")
    parser.add_argument("--output", default="data/normalized/records.jsonl", help="Destination JSONL file")
    parser.add_argument("--topic-config", default="config/topic_rules.yaml", help="Topic rules YAML path")
    parser.add_argument("--log-level", default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"])
    return parser.parse_args()


def normalize_text(value: str) -> str:
    if value is None:
        return ""
    text = unicodedata.normalize("NFKC", value)
    replacements = {
        "“": '"',
        "”": '"',
        "‘": "'",
        "’": "'",
        "–": "-",
        "—": "-",
        "\r\n": "\n",
        "\r": "\n",
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    lines = [line.strip() for line in text.split("\n")]
    text = "\n".join(line for line in lines if line)
    text = text.strip()
    return text


def make_record_id(*parts: str) -> str:
    joined = "|".join(parts)
    return hashlib.sha1(joined.encode("utf-8")).hexdigest()


def load_jsonl(path: Path) -> Iterable[Dict]:
    if not path.exists():
        LOGGER.warning("Input %s not found, skipping.", path)
        return []
    with path.open("r", encoding="utf-8") as infile:
        for line in infile:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def normalize_articles(records: Iterable[Dict], classifier) -> List[Dict]:
    normalized: List[Dict] = []
    for record in records:
        text = normalize_text(record.get("text", ""))
        topic = classifier.classify_article(
            record.get("section_title", ""),
            text,
            record.get("source_tags"),
        )
        record_id = make_record_id(record.get("source_id", ""), "section", str(record.get("order", "")))
        normalized.append(
            {
                "record_id": record_id,
                "record_type": record["record_type"],
                "topic": topic,
                "text": text,
                "source_id": record.get("source_id"),
                "source_url": record.get("source_url"),
                "language": record.get("language", "en"),
                "metadata": {
                    "page_title": record.get("page_title"),
                    "section_title": record.get("section_title"),
                    "anchor": record.get("anchor"),
                    "published_at": record.get("published_at"),
                    "updated_at": record.get("updated_at"),
                    "links": record.get("links", []),
                    "media": record.get("media", []),
                },
            }
        )
    return normalized


def normalize_qa(records: Iterable[Dict], classifier) -> List[Dict]:
    normalized: List[Dict] = []
    for record in records:
        text = normalize_text(record.get("answer", ""))
        combined = " ".join(filter(None, [record.get("question", ""), record.get("answer", "")]))
        topic = classifier.classify_qa(record.get("categories", []), combined)
        record_id = make_record_id("qa", record.get("slug", ""))
        normalized.append(
            {
                "record_id": record_id,
                "record_type": record["record_type"],
                "topic": topic,
                "text": text,
                "source_id": record.get("slug"),
                "source_url": record.get("source_url"),
                "language": record.get("language", "en"),
                "metadata": {
                    "question": normalize_text(record.get("question", "")),
                    "answered_by": record.get("answered_by"),
                    "answered_at": record.get("answered_at"),
                    "categories": record.get("categories", []),
                    "links": record.get("answer_links", []),
                },
            }
        )
    return normalized


def write_jsonl(records: List[Dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as outfile:
        for record in records:
            outfile.write(json.dumps(record, ensure_ascii=False) + "\n")


def main() -> None:
    args = parse_args()
    logging.basicConfig(level=getattr(logging, args.log_level.upper()))
    classifier = load_topic_classifier(Path(args.topic_config))

    article_records = list(load_jsonl(Path(args.articles)))
    qa_records = list(load_jsonl(Path(args.qa)))

    normalized_articles = normalize_articles(article_records, classifier)
    normalized_qas = normalize_qa(qa_records, classifier)
    combined = normalized_articles + normalized_qas
    LOGGER.info("Normalized %d article sections and %d QA entries.", len(normalized_articles), len(normalized_qas))
    write_jsonl(combined, Path(args.output))
    LOGGER.info("Wrote %d normalized records to %s", len(combined), args.output)


if __name__ == "__main__":
    main()

