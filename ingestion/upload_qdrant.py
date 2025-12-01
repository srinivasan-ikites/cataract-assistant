from __future__ import annotations

import argparse
import json
import logging
import os
from pathlib import Path
from typing import Dict, List
from uuid import uuid5, NAMESPACE_URL

from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.http import models as rest

LOGGER = logging.getLogger("ingestion.qdrant")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Upload embeddings to Qdrant.")
    parser.add_argument("--input", default="data/embeddings/general_kb.jsonl", help="Embeddings JSONL path")
    parser.add_argument("--collection", default="cataract_general_kb", help="Qdrant collection name")
    parser.add_argument("--vectors-limit", type=int, default=100, help="Batch size for upserts")
    parser.add_argument("--recreate", action="store_true", help="Recreate collection before upload")
    parser.add_argument("--log-level", default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"])
    return parser.parse_args()


def load_embeddings(path: Path) -> List[Dict]:
    records: List[Dict] = []
    with path.open("r", encoding="utf-8") as infile:
        for line in infile:
            line = line.strip()
            if not line:
                continue
            records.append(json.loads(line))
    return records


def ensure_collection(client: QdrantClient, collection: str, vector_size: int, recreate: bool) -> None:
    if recreate:
        LOGGER.info("Recreating collection %s", collection)
        client.recreate_collection(
            collection_name=collection,
            vectors_config=rest.VectorParams(size=vector_size, distance=rest.Distance.COSINE),
        )
    else:
        collections = [c.name for c in client.get_collections().collections]
        if collection not in collections:
            LOGGER.info("Creating collection %s", collection)
            client.recreate_collection(
                collection_name=collection,
                vectors_config=rest.VectorParams(size=vector_size, distance=rest.Distance.COSINE),
            )
        else:
            LOGGER.info("Collection %s already exists; using existing configuration.", collection)


def main() -> None:
    args = parse_args()
    logging.basicConfig(level=getattr(logging, args.log_level.upper()))
    load_dotenv()

    qdrant_url = os.getenv("QDRANT_URL")
    qdrant_api_key = os.getenv("QDRANT_API_KEY")
    if not qdrant_url or not qdrant_api_key:
        raise ValueError("QDRANT_URL and QDRANT_API_KEY must be set in the environment.")

    embeddings = load_embeddings(Path(args.input))
    if not embeddings:
        LOGGER.warning("No embeddings found; aborting upload.")
        return

    vector_size = len(embeddings[0]["embedding"])
    client = QdrantClient(url=qdrant_url, api_key=qdrant_api_key, timeout=60)
    ensure_collection(client, args.collection, vector_size, args.recreate)

    batch_size = args.vectors_limit
    for start in range(0, len(embeddings), batch_size):
        batch = embeddings[start : start + batch_size]
        client.upsert(
            collection_name=args.collection,
            points=rest.Batch(
                ids=[str(uuid5(NAMESPACE_URL, item["chunk_id"])) for item in batch],
                vectors=[item["embedding"] for item in batch],
                payloads=[
                    {
                        "record_id": item["record_id"],
                        "topic": item["topic"],
                        "source_id": item["source_id"],
                        "source_url": item["source_url"],
                        "language": item["language"],
                        "metadata": item["metadata"],
                        "chunk_index": item["chunk_index"],
                        "token_count": item["token_count"],
                        "text": item["text"],
                    }
                    for item in batch
                ],
            ),
        )
        LOGGER.info(
            "Upserted %d/%d vectors into %s",
            min(start + batch_size, len(embeddings)),
            len(embeddings),
            args.collection,
        )

    LOGGER.info("Qdrant upload complete.")


if __name__ == "__main__":
    main()

