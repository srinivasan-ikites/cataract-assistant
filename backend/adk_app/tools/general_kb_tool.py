from __future__ import annotations

from typing import List, Optional

from adk_app.services.embedding_service import embed_query
from adk_app.services.qdrant_service import QdrantSearchService

_qdrant_service: Optional[QdrantSearchService] = None

AAO_QA_BASE = "https://www.aao.org/eye-health/ask-ophthalmologist/categories"


def _ensure_qdrant_service() -> QdrantSearchService:
    global _qdrant_service
    if _qdrant_service is None:
        _qdrant_service = QdrantSearchService()
    return _qdrant_service


def _build_sources(hits: List[dict]) -> List[dict]:
    """Build deduplicated, clean source list from search hits.

    Rules:
    - Article chunks: show page_title as label with source_url link.
    - QA chunks: collapse all into one "AAO - Ask an Ophthalmologist" entry.
    - Deduplicate by source_url so each article appears once.
    - Max 3 sources to keep the UI clean.
    """
    sources: List[dict] = []
    seen_urls: set[str] = set()
    has_qa_source = False

    for hit in hits:
        metadata = hit.get("metadata", {})
        source_url = hit.get("source_url") or ""
        page_title = metadata.get("page_title") or ""

        # Skip if no URL at all
        if not source_url:
            continue

        # QA chunks: group under single entry
        is_qa = "/ask-ophthalmologist" in source_url
        if is_qa:
            if not has_qa_source:
                has_qa_source = True
                sources.append({
                    "section_title": "AAO – Ask an Ophthalmologist",
                    "source_url": AAO_QA_BASE,
                })
            continue

        # Article chunks: deduplicate by URL
        if source_url in seen_urls:
            continue
        seen_urls.add(source_url)

        # Use page_title for a clean display name
        label = page_title or "American Academy of Ophthalmology"
        sources.append({
            "section_title": label,
            "source_url": source_url,
        })

    # Limit to 3 sources max for clean UI
    return sources[:3]


def general_kb_search_tool(
    query: str,
    topics: Optional[List[str]] = None,
    limit: int = 5,
    vector: Optional[List[float]] = None,
) -> dict:
    """
    Search the General_KB vector store and return the top chunks.
    Returns a dict with context_text (str) and media (list).
    """
    print(f"[General KB] query='{query}' limit={limit} topics={topics} pre_embedded={bool(vector)}")

    if vector is None:
        vector = embed_query(query)

    hits = _ensure_qdrant_service().search(vector, limit=limit, topics=topics)

    if not hits:
        return {"context_text": "No relevant general knowledge chunks found.", "media": [], "sources": []}

    print(
        "[General KB] results count="
        f"{len(hits)} chunk_ids={[hit.get('chunk_id') for hit in hits]}"
    )

    sections: List[str] = []
    for idx, hit in enumerate(hits, start=1):
        metadata = hit.get("metadata", {})
        section_title = metadata.get("section_title") or metadata.get("page_title") or "Unknown section"
        score = hit.get("score", 0.0) or 0.0
        chunk_id = hit.get("chunk_id", "unknown")

        # Log chunk ID for debugging (visible in logs)
        print(f"[General KB] Chunk {idx} (ID: {chunk_id}): {section_title} | Score: {score:.4f}")

        # Provide clean text without citation tags - let LLM decide when to cite
        sections.append(f"Section: {section_title}\n{hit.get('text')}")

    sources = _build_sources(hits)

    return {
        "context_text": "\n\n".join(sections),
        "media": [],
        "sources": sources,
    }
