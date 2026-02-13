from __future__ import annotations

import os
from typing import List, Optional

from dotenv import load_dotenv
from qdrant_client import QdrantClient

load_dotenv()


TOPIC_EXPANSIONS = {
    "GENERAL": set(),
    "SURGERY": {"SURGERY_EXPECT", "SURGERY_RISKS", "SURGERY_COSTS", "TREATMENT_OVERVIEW"},
    "POST_OP": {"SURGERY_EXPECT", "SURGERY_RISKS"},
    "RECOVERY": {"SURGERY_EXPECT", "SURGERY_RISKS"},
    "LENSES": {"TREATMENT_OVERVIEW", "BASICS", "OTHER"},
    "INSURANCE": {"SURGERY_COSTS", "BASICS"},
}


def _expand_topics(topics: Optional[List[str]]) -> Optional[set[str]]:
    if not topics:
        return None
    expanded: set[str] = set()
    for topic in topics:
        if not topic:
            continue
        normalized = topic.upper()
        if normalized == "GENERAL":
            return None
        expanded.add(normalized)
        for alias in TOPIC_EXPANSIONS.get(normalized, ()):
            expanded.add(alias)
    return expanded or None


# Global singleton
_QDRANT_CLIENT = None

def init_qdrant_client():
    """Explicitly initialize the Qdrant client at startup."""
    global _QDRANT_CLIENT
    if _QDRANT_CLIENT is not None:
        return

    import time
    from qdrant_client import QdrantClient
    
    t_start = time.perf_counter()
    url = os.getenv("QDRANT_URL")
    api_key = os.getenv("QDRANT_API_KEY")
    
    if not url or not api_key:
        print("[Qdrant] Missing credentials, skipping init.")
        return

    print(f"[Qdrant] Initializing global client connecting to {url}...")
    _QDRANT_CLIENT = QdrantClient(
        url=url,
        api_key=api_key,
        prefer_grpc=False,
    )
    print(f"[Qdrant] Global client ready. Init time: {(time.perf_counter() - t_start)*1000:.1f} ms")


class QdrantSearchService:
    """Wrapper around Qdrant client for similarity search."""

    def __init__(self) -> None:
        global _QDRANT_CLIENT
        
        # Ensure we have a client
        if _QDRANT_CLIENT is None:
            print("[Qdrant] Global client not found, initializing now (lazy load)...")
            init_qdrant_client()
        
        self._client = _QDRANT_CLIENT
        self.collection = os.getenv("QDRANT_COLLECTION", "cataract_general_kb")
        # print(f"[Qdrant] Using collection={self.collection}")

    def search(
        self,
        vector: List[float],
        limit: int = 5,
        topics: Optional[List[str]] = None,
    ) -> List[dict]:
        import time
        t_start = time.perf_counter()
        allowed_topics = _expand_topics(topics)
        request_limit = limit * 3 if allowed_topics else limit
        
        if not self._client:
             print("[Qdrant] Error: Client not initialized.")
             return []

        response = self._client.query_points(
            collection_name=self.collection,
            query=vector,
            limit=request_limit,
            with_payload=True,
            with_vectors=False,
        )
        print(f"####### timing qdrant.search_query_ms={(time.perf_counter() - t_start)*1000:.1f}")
        points = response.points or []
        hits = []
        for idx, point in enumerate(points):
            payload = point.payload or {}
            point_topic = (payload.get("topic") or "").upper()
            if allowed_topics and point_topic not in allowed_topics:
                # Allow fuzzy containment so SURGERY matches SURGERY_EXPECT, etc.
                if not any(
                    point_topic.startswith(topic) or topic in point_topic for topic in allowed_topics
                ):
                    continue
            hits.append(
                {
                    "chunk_id": payload.get("chunk_id", point.id),
                    "text": payload.get("text"),
                    "topic": payload.get("topic"),
                    "source_url": payload.get("source_url"),
                    "source_id": payload.get("source_id"),
                    "score": point.score,
                    "metadata": payload.get("metadata", {}),
                }
            )
            if len(hits) >= limit:
                break
        return hits

