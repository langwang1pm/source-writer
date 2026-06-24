from __future__ import annotations

import re
from typing import Iterator

CITATION_PATTERN = re.compile(r"【引用来源[：:](.+?)】", re.DOTALL)

SOURCE_REF_PATTERN = re.compile(
    r"([0-9a-fA-F\-]+)~~~([0-9a-fA-F\-]+)"
)


def parse_source_pairs(source_text: str) -> Iterator[tuple[str, str]]:
    for match in SOURCE_REF_PATTERN.finditer(source_text):
        yield match.group(1), match.group(2)


def parse_citations(text: str, card_ordinal: int) -> list[dict]:
    refs: list[dict] = []
    seen_pairs: set[tuple[str, str]] = set()
    for match in CITATION_PATTERN.finditer(text):
        source_text = match.group(1).strip()
        start_pos = match.start()
        marker_pairs: list[tuple[str, str]] = []
        for doc_id, chunk_id in parse_source_pairs(source_text):
            pair = (doc_id, chunk_id)
            if pair not in seen_pairs:
                seen_pairs.add(pair)
                marker_pairs.append(pair)
        if marker_pairs:
            for doc_id, chunk_id in marker_pairs:
                refs.append({
                    "ordinal": len(refs) + 1,
                    "source_name": f"{doc_id}~~~{chunk_id}",
                    "char_position": start_pos,
                    "dify_document_id": doc_id,
                    "chunk_id": chunk_id,
                })
        else:
            first_pair = next(parse_source_pairs(source_text), None)
            if first_pair:
                doc_id, chunk_id = first_pair
                existing = next(
                    (r for r in refs if r["dify_document_id"] == doc_id and r["chunk_id"] == chunk_id),
                    None,
                )
                if existing:
                    refs.append({
                        "ordinal": existing["ordinal"],
                        "source_name": f"{doc_id}~~~{chunk_id}",
                        "char_position": start_pos,
                        "dify_document_id": doc_id,
                        "chunk_id": chunk_id,
                    })
    return refs


def clean_markdown(text: str) -> str:
    return CITATION_PATTERN.sub("", text).strip()


def truncate_title(text: str, max_len: int = 30) -> str:
    text = text.strip().replace("\n", " ")
    return text[:max_len] + ("..." if len(text) > max_len else "")


HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)(?:\s+#*)?$", re.MULTILINE)


def extract_title_from_content(content: str | None) -> str:
    """Extract a readable title from Dify segment markdown content.

    Looks for the first Markdown heading (any level # to ######) and returns its text.
    Falls back to the first non-empty line, truncated to 80 chars.
    Returns empty string if content is empty.
    """
    if not content:
        return ""
    match = HEADING_RE.search(content)
    if match:
        return match.group(2).strip()
    for line in content.split("\n"):
        line = line.strip()
        if line:
            return line[:80] + ("..." if len(line) > 80 else "")
    return ""
