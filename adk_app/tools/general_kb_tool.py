from __future__ import annotations

from typing import List, Optional

from google.adk.tools import FunctionTool

from adk_app.services.embedding_service import embed_query
from adk_app.services.qdrant_service import QdrantSearchService
_qdrant_service: Optional[QdrantSearchService] = None


def _ensure_qdrant_service() -> QdrantSearchService:
    global _qdrant_service
    if _qdrant_service is None:
        _qdrant_service = QdrantSearchService()
    return _qdrant_service


def general_kb_search_tool(
    query: str,
    topics: Optional[List[str]] = None,
    limit: int = 5,
) -> str:
    """Search the General_KB vector store and return the top chunks."""
    print(f"[General KB] query='{query}' limit={limit} topics={topics}")
    vector = embed_query(query)
    hits = _ensure_qdrant_service().search(vector, limit=limit, topics=topics)

    if not hits:
        return "No relevant general knowledge chunks found."

    print(
        "[General KB] results count="
        f"{len(hits)} chunk_ids={[hit.get('chunk_id') for hit in hits]}"
    )

    sections: List[str] = ["General KB context:"]
    for idx, hit in enumerate(hits, start=1):
        metadata = hit.get("metadata", {})
        section_title = metadata.get("section_title") or metadata.get("page_title") or "Unknown section"
        score = hit.get("score", 0.0) or 0.0
        sections.append(
            f"[Chunk {idx}] {section_title}\n"
            f"Topic: {hit.get('topic')}\n"
            f"Score: {score:.4f}\n"
            f"Text: {hit.get('text')}\n"
            f"Source: {metadata.get('source_url','N/A')}"
        )
    return "\n\n".join(sections)


def build_general_kb_tool() -> FunctionTool:
    return FunctionTool(general_kb_search_tool)


