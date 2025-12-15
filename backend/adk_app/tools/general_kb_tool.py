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
) -> dict:
    """
    Search the General_KB vector store and return the top chunks.
    Returns a dict with context_text (str) and media (list).
    """
    print(f"[General KB] query='{query}' limit={limit} topics={topics}")
    vector = embed_query(query)
    hits = _ensure_qdrant_service().search(vector, limit=limit, topics=topics)

    if not hits:
        return {"context_text": "No relevant general knowledge chunks found.", "media": []}

    print(
        "[General KB] results count="
        f"{len(hits)} chunk_ids={[hit.get('chunk_id') for hit in hits]}"
    )

    sections: List[str] = []
    sources: List[dict] = []
    seen_sources: set[str] = set()
    for idx, hit in enumerate(hits, start=1):
        metadata = hit.get("metadata", {})
        print(f"metadata: {metadata}")
        section_title = metadata.get("section_title") or metadata.get("page_title") or "Unknown section"
        score = hit.get("score", 0.0) or 0.0
        chunk_id = hit.get("chunk_id", "unknown")
        
        # Log chunk ID for debugging (visible in logs)
        print(f"[General KB] Chunk {idx} (ID: {chunk_id}): {section_title} | Score: {score:.4f}")
        
        # Provide clean text without citation tags - let LLM decide when to cite
        sections.append(f"Section: {section_title}\n{hit.get('text')}")

        # Collect source URLs/links for frontend display
        links = metadata.get("links") or []
        source_url = metadata.get("source_url") or metadata.get("page_url") or (links[0].get("url") if links else None)
        # Skip if nothing to show
        if not source_url and (not section_title or section_title == "Unknown section"):
            continue
        key = f"{section_title}|{source_url or ''}"
        if key in seen_sources:
            continue
        seen_sources.add(key)
        sources.append(
            {
                "section_title": section_title if section_title != "Unknown section" else (metadata.get("page_title") or "Source"),
                "source_url": source_url,
                "links": links,
            }
        )

    return {
        "context_text": "\n\n".join(sections),
        "media": [],  # Media not used for now
        "sources": sources,
    }


def build_general_kb_tool() -> FunctionTool:
    return FunctionTool(general_kb_search_tool)

