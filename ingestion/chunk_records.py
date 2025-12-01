from __future__ import annotations

import argparse
import json
import logging
import re
from pathlib import Path
from typing import Dict, List

import tiktoken
import yaml

LOGGER = logging.getLogger("ingestion.chunker")
SENTENCE_SPLIT_REGEX = re.compile(r"(?<=[.!?])\s+")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Chunk normalized records for embedding.")
    parser.add_argument("--input", default="data/normalized/records.jsonl", help="Path to normalized records JSONL")
    parser.add_argument("--config", default="config/chunker.yaml", help="Chunking configuration YAML")
    parser.add_argument("--log-level", default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"])
    return parser.parse_args()


def load_records(path: Path) -> List[Dict]:
    records: List[Dict] = []
    with path.open("r", encoding="utf-8") as infile:
        for line in infile:
            line = line.strip()
            if not line:
                continue
            records.append(json.loads(line))
    return records


def split_into_segments(text: str) -> List[str]:
    segments: List[str] = []
    paragraphs = [block.strip() for block in text.split("\n") if block.strip()]
    for block in paragraphs:
        if block.startswith("- "):
            segments.append(block)
            continue
        sentences = SENTENCE_SPLIT_REGEX.split(block)
        for sentence in sentences:
            sentence = sentence.strip()
            if sentence:
                segments.append(sentence)
    if not segments and text.strip():
        segments.append(text.strip())
    return segments


def chunk_record(
    record: Dict,
    encoding,
    chunk_size: int,
    overlap: int,
) -> List[Dict]:
    segments = split_into_segments(record["text"])
    if not segments:
        return []

    chunks: List[Dict] = []
    current_tokens: List[int] = []
    current_text_parts: List[str] = []

    def finalize_chunk():
        if not current_tokens:
            return None
        chunk_text = " ".join(current_text_parts).strip()
        if not chunk_text:
            return None
        chunk = {
            "record_id": record["record_id"],
            "record_type": record["record_type"],
            "topic": record["topic"],
            "source_id": record["source_id"],
            "source_url": record["source_url"],
            "language": record["language"],
            "metadata": record["metadata"],
            "text": chunk_text,
            "token_count": len(current_tokens),
        }
        return chunk

    for segment in segments:
        segment_tokens = encoding.encode(segment)
        if not segment_tokens:
            continue

        if current_tokens and (len(current_tokens) + len(segment_tokens)) > chunk_size:
            chunk = finalize_chunk()
            if chunk:
                chunks.append(chunk)
            if overlap > 0 and current_tokens:
                overlap_tokens = current_tokens[-overlap:]
                overlap_text = encoding.decode(overlap_tokens)
                current_tokens = overlap_tokens.copy()
                current_text_parts = [overlap_text]
            else:
                current_tokens = []
                current_text_parts = []

        current_tokens.extend(segment_tokens)
        current_text_parts.append(segment)

    chunk = finalize_chunk()
    if chunk:
        chunks.append(chunk)
    return chunks


def save_chunks(chunks: List[Dict], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as outfile:
        for chunk in chunks:
            outfile.write(json.dumps(chunk, ensure_ascii=False) + "\n")


def main() -> None:
    args = parse_args()
    logging.basicConfig(level=getattr(logging, args.log_level.upper()))

    config = yaml.safe_load(Path(args.config).read_text(encoding="utf-8"))
    chunk_size = config.get("chunk_size_tokens", 300)
    overlap = config.get("chunk_overlap_tokens", 60)
    output_path = Path(config.get("output_path", "data/chunks/general_kb.jsonl"))

    encoding = tiktoken.get_encoding("cl100k_base")
    records = load_records(Path(args.input))
    LOGGER.info("Loaded %d normalized records", len(records))

    all_chunks: List[Dict] = []
    for record in records:
        chunks = chunk_record(record, encoding, chunk_size, overlap)
        for idx, chunk in enumerate(chunks):
            chunk_id = f"{chunk['record_id']}_chunk_{idx}"
            chunk["chunk_id"] = chunk_id
            chunk["chunk_index"] = idx
        all_chunks.extend(chunks)

    save_chunks(all_chunks, output_path)
    LOGGER.info(
        "Chunking complete: %d records -> %d chunks (avg %.2f tokens)",
        len(records),
        len(all_chunks),
        (sum(chunk["token_count"] for chunk in all_chunks) / len(all_chunks)) if all_chunks else 0,
    )
    LOGGER.info("Chunks written to %s", output_path)


if __name__ == "__main__":
    main()



