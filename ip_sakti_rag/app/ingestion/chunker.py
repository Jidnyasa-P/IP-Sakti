"""
Legal-aware chunking.

Statutes/regulations have real structure (Chapter -> Section -> Sub-section ->
Clause). Splitting on that structure, instead of a fixed sliding window, keeps
each chunk semantically self-contained (e.g. "Section 3(p)" stays whole) which
matters a lot for citation precision. Falls back to paragraph/window chunking
for unstructured text (notifications, guidance PDFs without clean numbering).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

# Matches "Section 3", "Section 3(p)", "Sec. 7", "Rule 158-B", "Article 5", "Clause (a)",
# and WIPO-treaty-style suffixed articles like "Article 3bis", "Article 9quinquies".
_SECTION_HEADER_RE = re.compile(
    r"^\s*(Section|Sec\.?|Rule|Article|Clause|Chapter|Regulation)\s+"
    r"([0-9]+(?:bis|ter|quater|quinquies|sexies|septies|octies)?[A-Za-z]?"
    r"(?:\([a-zA-Z0-9]+\))*(?:-[A-Za-z0-9]+)?)",
    re.MULTILINE,
)

# Indian Bare Acts/Rules/Regulations conventionally number each section as a bare
# leading number, e.g. "3. What are not inventions.—" or "158-B. Additional
# evidence..." — with no literal word "Section"/"Rule" in front of the number.
# This is the dominant real-world format (Patents Act, D&C Act, NBA Rules, etc.)
# so it must be tried, not just the explicit-word pattern above.
_BARE_NUMBERED_SECTION_RE = re.compile(
    r"^\s*(\d{1,4}[A-Z]?(?:-[A-Z])?)\.\s+[A-Z]",
    re.MULTILINE,
)


@dataclass
class RawChunk:
    section_label: str
    text: str
    order: int


def legal_aware_chunk(text: str, max_chars: int = 1400, overlap_chars: int = 150, bare_label: str = "Section") -> list[RawChunk]:
    text = _normalize_whitespace(text)

    explicit_matches = list(_SECTION_HEADER_RE.finditer(text))
    if len(explicit_matches) >= 3:
        return _split_on_structure(text, explicit_matches, max_chars, overlap_chars, label_from="explicit")

    bare_matches = list(_BARE_NUMBERED_SECTION_RE.finditer(text))
    if len(bare_matches) >= 3:
        return _split_on_structure(text, bare_matches, max_chars, overlap_chars, label_from="bare", bare_label=bare_label)

    return _split_on_paragraphs(text, max_chars, overlap_chars)


def _normalize_whitespace(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _split_on_structure(text: str, matches, max_chars: int, overlap_chars: int, label_from: str = "explicit", bare_label: str = "Section") -> list[RawChunk]:
    chunks: list[RawChunk] = []
    boundaries = [m.start() for m in matches] + [len(text)]

    for i, m in enumerate(matches):
        start = boundaries[i]
        end = boundaries[i + 1]
        segment = text[start:end].strip()
        if not segment:
            continue
        label = f"{m.group(1)} {m.group(2)}" if label_from == "explicit" else f"{bare_label} {m.group(1)}"
        # Further split very long sections so no single chunk overwhelms the LLM context.
        for j, sub in enumerate(_window_split(segment, max_chars, overlap_chars)):
            chunks.append(RawChunk(section_label=label if j == 0 else f"{label} (cont.)", text=sub, order=len(chunks)))
    return chunks


def _split_on_paragraphs(text: str, max_chars: int, overlap_chars: int) -> list[RawChunk]:
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[RawChunk] = []
    buffer = ""
    section_idx = 1

    for para in paragraphs:
        if len(buffer) + len(para) + 1 <= max_chars:
            buffer = f"{buffer}\n\n{para}".strip()
        else:
            if buffer:
                chunks.append(RawChunk(section_label=f"Paragraph block {section_idx}", text=buffer, order=len(chunks)))
                section_idx += 1
            for sub in _window_split(para, max_chars, overlap_chars):
                chunks.append(RawChunk(section_label=f"Paragraph block {section_idx}", text=sub, order=len(chunks)))
                section_idx += 1
            buffer = ""

    if buffer:
        chunks.append(RawChunk(section_label=f"Paragraph block {section_idx}", text=buffer, order=len(chunks)))
    return chunks


def _window_split(text: str, max_chars: int, overlap_chars: int) -> list[str]:
    if len(text) <= max_chars:
        return [text]
    windows = []
    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        windows.append(text[start:end].strip())
        if end == len(text):
            break
        start = end - overlap_chars
    return windows
