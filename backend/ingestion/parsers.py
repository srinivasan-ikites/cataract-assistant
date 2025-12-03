from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from typing import List, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup, NavigableString, Tag


def clean_text(value: str) -> str:
    """Collapse whitespace and trim."""
    return re.sub(r"\s+", " ", value).strip()


@dataclass
class LinkRef:
    text: str
    url: str


@dataclass
class MediaRef:
    type: str
    url: str
    alt: Optional[str] = None
    caption: Optional[str] = None


@dataclass
class ArticleSection:
    section_title: str
    order: int
    text: str
    links: List[LinkRef] = field(default_factory=list)
    media: List[MediaRef] = field(default_factory=list)
    anchor: Optional[str] = None


@dataclass
class ArticleDocument:
    title: str
    published_at: Optional[str]
    updated_at: Optional[str]
    sections: List[ArticleSection]


@dataclass
class QARecord:
    slug: str
    title: str
    question: str
    answer: str
    answer_links: List[LinkRef]
    answered_by: Optional[str]
    answered_by_url: Optional[str]
    answered_at: Optional[str]
    categories: List[str]
    canonical_url: Optional[str]


def load_article_metadata(soup: BeautifulSoup, default_url: str = "") -> ArticleDocument:
    """Extract article metadata and sections from a full HTML page."""
    ld_blocks: List[dict] = []
    for script in soup.find_all("script", type="application/ld+json"):
        text = script.string or script.get_text()
        if not text:
            continue
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            continue
        if isinstance(data, list):
            ld_blocks.extend(d for d in data if isinstance(d, dict))
        elif isinstance(data, dict):
            ld_blocks.append(data)

    article_ld = next((item for item in ld_blocks if "articleBody" in item), None)
    if not article_ld:
        raise ValueError("Unable to locate articleBody JSON-LD payload.")

    article_html = article_ld.get("articleBody", "")
    sections = split_article_sections(article_html, base_url=article_ld.get("url") or default_url)

    return ArticleDocument(
        title=article_ld.get("name") or (soup.title.string.strip() if soup.title else ""),
        published_at=article_ld.get("datePublished"),
        updated_at=article_ld.get("dateModified"),
        sections=sections,
    )


def split_article_sections(article_html: str, base_url: str) -> List[ArticleSection]:
    fragment = BeautifulSoup(article_html, "lxml")
    container = fragment.body or fragment
    buffer: List[str] = []
    sections: List[ArticleSection] = []
    current_title = "Overview"
    current_anchor: Optional[str] = None
    order = 1

    def flush() -> None:
        nonlocal buffer, sections, order, current_title, current_anchor
        if not buffer:
            return
        fragment_html = "".join(buffer)
        section_soup = BeautifulSoup(fragment_html, "lxml")
        text = render_section_text(section_soup)
        if not text:
            buffer = []
            return
        sections.append(
            ArticleSection(
                section_title=current_title or "Overview",
                order=order,
                text=text,
                links=collect_links(section_soup, base_url),
                media=collect_media(section_soup, base_url),
                anchor=current_anchor,
            )
        )
        order += 1
        buffer = []

    for node in container.contents:
        if isinstance(node, NavigableString):
            if node.strip():
                buffer.append(str(node))
            continue
        if not isinstance(node, Tag):
            continue
        if node.name in {"h1", "h2", "h3", "h4"}:
            flush()
            current_title = clean_text(node.get_text(" ", strip=True))
            if anchor := (node.get("id") or node.get("name")):
                current_anchor = anchor
            else:
                anchor_tag = node.find("a")
                current_anchor = anchor_tag.get("name") if anchor_tag else None
            continue
        buffer.append(str(node))

    flush()
    return sections


def render_section_text(section_soup: BeautifulSoup) -> str:
    blocks: List[str] = []
    container = section_soup.body or section_soup
    for child in container.contents:
        if isinstance(child, NavigableString):
            text = clean_text(str(child))
            if text:
                blocks.append(text)
            continue
        if not isinstance(child, Tag):
            continue
        if child.name in {"p", "div", "span"}:
            text = clean_text(child.get_text(" ", strip=True))
            if text:
                blocks.append(text)
        elif child.name in {"ul", "ol"}:
            for li in child.find_all("li", recursive=False):
                text = clean_text(li.get_text(" ", strip=True))
                if text:
                    blocks.append(f"- {text}")
        elif child.name == "blockquote":
            text = clean_text(child.get_text(" ", strip=True))
            if text:
                blocks.append(f"Quote: {text}")
        elif child.name in {"figure", "img"}:
            caption = child.find("figcaption").get_text(" ", strip=True) if child.name == "figure" and child.find("figcaption") else ""
            if caption:
                blocks.append(f"Figure: {caption}")
    return "\n\n".join(blocks).strip()


def collect_links(section_soup: BeautifulSoup, base_url: str) -> List[LinkRef]:
    seen = set()
    links: List[LinkRef] = []
    for anchor in section_soup.find_all("a", href=True):
        text = clean_text(anchor.get_text(" ", strip=True)) or anchor.get("title") or ""
        href = urljoin(base_url, anchor["href"]) if base_url else anchor["href"]
        key = (text, href)
        if not href or key in seen:
            continue
        seen.add(key)
        links.append(LinkRef(text=text, url=href))
    return links


def collect_media(section_soup: BeautifulSoup, base_url: str) -> List[MediaRef]:
    media: List[MediaRef] = []
    for img in section_soup.find_all("img"):
        src = img.get("src")
        if not src:
            continue
        caption = None
        figure = img.find_parent("figure")
        if figure and figure.find("figcaption"):
            caption = figure.find("figcaption").get_text(" ", strip=True)
        media.append(
            MediaRef(
                type="image",
                url=urljoin(base_url, src) if base_url else src,
                alt=img.get("alt"),
                caption=caption,
            )
        )
    for iframe in section_soup.find_all("iframe"):
        src = iframe.get("src")
        if not src:
            continue
        media.append(
            MediaRef(
                type="video",
                url=urljoin(base_url, src) if base_url else src,
                alt=iframe.get("title"),
            )
        )
    return media


def parse_qa_document(html: str, slug: str) -> QARecord:
    soup = BeautifulSoup(html, "lxml")
    container = soup.select_one("div.questionsDetail")
    if not container:
        raise ValueError("Unable to locate Q&A container.")
    canonical = None
    canonical_link = soup.find("link", rel="canonical")
    if canonical_link and canonical_link.has_attr("href"):
        canonical = canonical_link["href"]
    if not canonical:
        canonical = f"https://www.aao.org/eye-health/ask-ophthalmologist-q/{slug}"

    title = container.find("h1").get_text(" ", strip=True)
    question = extract_labeled_block(container, "Question")
    answer_html = extract_labeled_block_html(container, "Answer")
    answer_text = render_section_text(BeautifulSoup(answer_html, "lxml"))
    answer_links = collect_links(BeautifulSoup(answer_html, "lxml"), base_url=canonical or "")
    answered_by_link = container.select_one("div.meta.author a")
    answered_by = answered_by_link.get_text(" ", strip=True) if answered_by_link else None
    answered_by_url = answered_by_link["href"] if answered_by_link and answered_by_link.has_attr("href") else None
    answered_at_tag = container.select_one('[itemprop="datePublished"]')
    answered_at = answered_at_tag.get_text(" ", strip=True) if answered_at_tag else None
    categories = [clean_text(a.get_text(" ", strip=True)) for a in container.select("div.category a")] or []

    return QARecord(
        slug=slug,
        title=title,
        question=question,
        answer=answer_text,
        answer_links=answer_links,
        answered_by=answered_by,
        answered_by_url=answered_by_url,
        answered_at=answered_at,
        categories=categories,
        canonical_url=canonical,
    )


def extract_labeled_block(container: Tag, label: str) -> str:
    html = extract_labeled_block_html(container, label)
    soup = BeautifulSoup(html, "lxml")
    return render_section_text(soup)


def extract_labeled_block_html(container: Tag, label: str) -> str:
    for strong in container.find_all("strong"):
        strong_text = strong.get_text(" ", strip=True).lower()
        if not strong_text.startswith(label.lower()):
            continue
        parent = strong.parent
        # include siblings to capture paragraphs following the label
        fragments: List[str] = []
        for sibling in parent.contents:
            if sibling is strong:
                continue
            if isinstance(sibling, NavigableString):
                fragments.append(str(sibling))
            elif isinstance(sibling, Tag):
                fragments.append(str(sibling))
        if not fragments:
            continue
        return "".join(fragments)
    return ""


def article_document_to_dict(doc: ArticleDocument) -> dict:
    return {
        "title": doc.title,
        "published_at": doc.published_at,
        "updated_at": doc.updated_at,
        "sections": [
            {
                "section_title": section.section_title,
                "order": section.order,
                "text": section.text,
                "anchor": section.anchor,
                "links": [asdict(link) for link in section.links],
                "media": [asdict(media) for media in section.media],
            }
            for section in doc.sections
        ],
    }


def qa_record_to_dict(record: QARecord) -> dict:
    return {
        "slug": record.slug,
        "title": record.title,
        "question": record.question,
        "answer": record.answer,
        "answer_links": [asdict(link) for link in record.answer_links],
        "answered_by": record.answered_by,
        "answered_by_url": record.answered_by_url,
        "answered_at": record.answered_at,
        "categories": record.categories,
        "canonical_url": record.canonical_url,
    }

