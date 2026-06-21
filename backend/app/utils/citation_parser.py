
from __future__ import annotations

import re

CITATION_PATTERN = re.compile(r"【引用来源[：:](.+?)】", re.DOTALL)


def parse_citations(text: str, card_ordinal: int) -> list[dict]:
    """Extract citation markers from AI response text.

    Returns list of dicts with:
        - ordinal: int, 1-based index within this card
        - source_name: str, the file name extracted from marker
        - char_position: int, start position in original text
    """
    refs = []
    for match in CITATION_PATTERN.finditer(text):
        refs.append({
            "ordinal": len(refs) + 1,
            "source_name": match.group(1).strip(),
            "char_position": match.start(),
        })
    return refs


def clean_markdown(text: str) -> str:
    """Remove all citation markers from text, keeping the surrounding content clean."""
    return CITATION_PATTERN.sub("", text).strip()


def truncate_title(text: str, max_len: int = 30) -> str:
    """Truncate text to create a session title."""
    text = text.strip().replace("\n", " ")
    return text[:max_len] + ("..." if len(text) > max_len else "")
