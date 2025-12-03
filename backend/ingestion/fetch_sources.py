from __future__ import annotations

import argparse
import logging
import html
import re
from pathlib import Path
from typing import Dict, List, Sequence
from urllib.parse import parse_qs, urlencode, urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup
from tenacity import retry, stop_after_attempt, wait_exponential
from tqdm import tqdm

from ingestion.config_loader import SourceConfig, load_sources

LOGGER = logging.getLogger("ingestion.fetcher")
POSTBACK_RE = re.compile(r"__doPostBack\('([^']+)','([^']*)'\)")
USER_AGENT = "CataractCounsellorIngestion/0.1 (+https://example.com)"
REQUEST_TIMEOUT = 30


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch configured AAO sources.")
    parser.add_argument(
        "--config",
        default="config/ingestion_sources.yaml",
        help="Path to ingestion config YAML",
    )
    parser.add_argument(
        "--output-dir",
        default="data/raw/html",
        help="Directory to store HTML snapshots",
    )
    parser.add_argument(
        "--only",
        nargs="+",
        help="Limit to a subset of source IDs",
    )
    parser.add_argument(
        "--qa-limit",
        type=int,
        default=0,
        help="Limit number of QA detail pages fetched from an index (0 = all)",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging verbosity",
    )
    return parser.parse_args()


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, max=10))
def fetch_html(session: requests.Session, url: str) -> str:
    response = session.get(url, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.text


def slugify_url(url: str) -> str:
    parsed = urlparse(url)
    slug = parsed.path.rstrip("/").split("/")[-1]
    return slug or parsed.netloc


def save_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def extract_qa_links(html: str, base_url: str) -> List[str]:
    soup = BeautifulSoup(html, "lxml")
    links = set()
    for anchor in soup.find_all("a", href=True):
        href = anchor["href"]
        if "/eye-health/ask-ophthalmologist-q/" not in href:
            continue
        absolute = urljoin(base_url, href)
        absolute = absolute.split("#")[0]
        links.add(absolute)
    return sorted(links)


def add_page_param(url: str, page: int) -> str:
    parsed = urlparse(url)
    query = parse_qs(parsed.query, keep_blank_values=True)
    query["page"] = [str(page)]
    new_query = urlencode(query, doseq=True)
    return urlunparse(parsed._replace(query=new_query))


def extract_form_fields(html_text: str) -> Dict[str, str]:
    soup = BeautifulSoup(html_text, "lxml")
    form = soup.find("form")
    fields: Dict[str, str] = {}
    if not form:
        return fields
    for input_tag in form.find_all("input"):
        name = input_tag.get("name")
        if not name:
            continue
        fields[name] = input_tag.get("value", "")
    return fields


def extract_pager_target(html_text: str) -> tuple[str | None, int]:
    soup = BeautifulSoup(html_text, "lxml")
    candidates = []
    for anchor in soup.find_all("a", href=True):
        href = html.unescape(anchor["href"])
        if "__doPostBack" not in href:
            continue
        match = POSTBACK_RE.search(href)
        if not match:
            continue
        target, arg = match.groups()
        arg = arg.strip()
        if not arg.isdigit():
            continue
        candidates.append((target, int(arg)))
    if not candidates:
        return (None, 1)
    preferred_target = candidates[0][0]
    max_page = max(num for tgt, num in candidates if tgt == preferred_target)
    return preferred_target, max_page


def fetch_article(session: requests.Session, source: SourceConfig, out_dir: Path) -> None:
    LOGGER.info("Fetching article %s", source.url)
    html = fetch_html(session, source.url)
    save_text(out_dir / "articles" / f"{source.id}.html", html)


def fetch_qa_index(
    session: requests.Session,
    source: SourceConfig,
    out_dir: Path,
    qa_limit: int,
) -> None:
    LOGGER.info("Fetching QA index %s", source.url)
    html = fetch_html(session, source.url)
    save_text(out_dir / "qa_index" / f"{source.id}.html", html)

    question_links = extract_qa_links(html, source.url)
    seen_links = set(question_links)
    LOGGER.info("Discovered %d QA links on initial page", len(question_links))

    pager_target, max_page = extract_pager_target(html)
    if pager_target:
        LOGGER.info("Detected pager target %s with %d pages", pager_target, max_page)
    else:
        LOGGER.info("No pager target detected; assuming single page.")

    form_fields = extract_form_fields(html)
    for page in range(2, max_page + 1):
        if not pager_target:
            break
        payload = dict(form_fields)
        payload["__EVENTTARGET"] = pager_target
        payload["__EVENTARGUMENT"] = str(page)
        try:
            response = session.post(source.url, data=payload, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
        except requests.HTTPError as exc:
            LOGGER.warning("Failed to fetch QA page %d (%s); stopping pagination.", page, exc)
            break
        page_html = response.text
        save_text(out_dir / "qa_index" / f"{source.id}_page_{page}.html", page_html)
        page_links = extract_qa_links(page_html, source.url)
        new_links = [link for link in page_links if link not in seen_links]
        if not new_links:
            LOGGER.info("No new QA links on page %d; stopping.", page)
            break
        LOGGER.info("Discovered %d additional QA links on page %d", len(new_links), page)
        question_links.extend(new_links)
        seen_links.update(new_links)
        form_fields = extract_form_fields(page_html)

    if not question_links:
        LOGGER.warning("No QA links discovered on %s", source.url)
        return

    limit = qa_limit if qa_limit and qa_limit > 0 else len(question_links)
    LOGGER.info("Fetching %s QA detail pages (limit=%s)", min(limit, len(question_links)), qa_limit)
    subset = question_links[:limit]
    for url in tqdm(subset, desc="QA detail pages", unit="page"):
        html = fetch_html(session, url)
        slug = slugify_url(url)
        save_text(out_dir / "qa" / f"{slug}.html", html)


def process_sources(
    sources: Sequence[SourceConfig],
    output_dir: Path,
    qa_limit: int,
) -> None:
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    for source in sources:
        if not source.enabled:
            LOGGER.info("Skipping disabled source %s", source.id)
            continue
        if source.type == "article":
            fetch_article(session, source, output_dir)
        elif source.type == "qa_index":
            fetch_qa_index(session, source, output_dir, qa_limit)
        else:
            LOGGER.warning("Unknown source type '%s' for %s", source.type, source.id)


def main() -> None:
    args = parse_args()
    logging.basicConfig(level=getattr(logging, args.log_level.upper()))

    config_path = Path(args.config)
    sources = load_sources(config_path)
    if args.only:
        allowed = set(args.only)
        sources = [s for s in sources if s.id in allowed]
        missing = allowed.difference({s.id for s in sources})
        if missing:
            raise ValueError(f"Unknown source IDs in --only: {', '.join(sorted(missing))}")

    output_dir = Path(args.output_dir)
    process_sources(sources, output_dir, qa_limit=args.qa_limit)


if __name__ == "__main__":
    main()


