from __future__ import annotations

import os
from functools import lru_cache
from typing import List

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()


@lru_cache(maxsize=1)
def _embedding_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY") or os.getenv("AZURE_OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("Embedding service requires OPENAI_API_KEY or AZURE_OPENAI_API_KEY.")
    return OpenAI()


def embed_query(
    text: str,
    model: str | None = None,
) -> List[float]:
    """Generate an embedding vector for the query."""
    model_name = model or os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
    client = _embedding_client()
    print(f"[EmbeddingService] Embedding text with model={model_name}")
    response = client.embeddings.create(model=model_name, input=text)
    vector = response.data[0].embedding
    print(f"[EmbeddingService] Generated vector of length {len(vector)}")
    return vector


