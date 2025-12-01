from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
from typing import Dict, List

from dotenv import load_dotenv
from openai import OpenAI

LOGGER = logging.getLogger("ingestion.embedder")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Embed chunked records with OpenAI.")
    parser.add_argument("--input", default="data/chunks/general_kb.jsonl", help="Chunk JSONL path")
    parser.add_argument("--output", default="data/embeddings/general_kb.jsonl", help="Embedding JSONL path")
    parser.add_argument("--model", default="text-embedding-3-small", help="OpenAI embedding model")
    parser.add_argument("--batch-size", type=int, default=32, help="Embedding batch size")
    parser.add_argument("--log-level", default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"])
    return parser.parse_args()


def load_chunks(path: Path) -> List[Dict]:
    chunks: List[Dict] = []
    with path.open("r", encoding="utf-8") as infile:
        for line in infile:
            line = line.strip()
            if not line:
                continue
            chunks.append(json.loads(line))
    return chunks


def save_embeddings(records: List[Dict], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as outfile:
        for record in records:
            outfile.write(json.dumps(record, ensure_ascii=False) + "\n")


def main() -> None:
    args = parse_args()
    logging.basicConfig(level=getattr(logging, args.log_level.upper()))
    load_dotenv()

    client = OpenAI()
    chunks = load_chunks(Path(args.input))
    LOGGER.info("Loaded %d chunks for embedding", len(chunks))
    if not chunks:
        LOGGER.warning("No chunks found; aborting embedding step.")
        return

    embeddings: List[Dict] = []
    batch_size = args.batch_size
    for start in range(0, len(chunks), batch_size):
        batch = chunks[start : start + batch_size]
        texts = [chunk["text"] for chunk in batch]
        response = client.embeddings.create(model=args.model, input=texts)
        for chunk, data in zip(batch, response.data):
            embeddings.append(
                {
                    "chunk_id": chunk["chunk_id"],
                    "record_id": chunk["record_id"],
                    "topic": chunk["topic"],
                    "source_id": chunk["source_id"],
                    "source_url": chunk["source_url"],
                    "language": chunk["language"],
                    "metadata": chunk["metadata"],
                    "chunk_index": chunk["chunk_index"],
                    "token_count": chunk["token_count"],
                    "text": chunk["text"],
                    "embedding": data.embedding,
                }
            )
        LOGGER.info(
            "Embedded %d/%d chunks",
            min(start + batch_size, len(chunks)),
            len(chunks),
        )

    save_embeddings(embeddings, Path(args.output))
    LOGGER.info("Saved embeddings to %s", args.output)


if __name__ == "__main__":
    main()



