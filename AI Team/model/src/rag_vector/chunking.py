from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class TextChunk:
    chunk_id: str
    source: str
    index: int
    text: str


def chunk_text(text: str, source: str, chunk_size: int, chunk_overlap: int) -> Iterable[TextChunk]:
    text = " ".join(text.split())
    if not text:
        return []

    if chunk_overlap >= chunk_size:
        raise ValueError("chunk_overlap must be smaller than chunk_size")

    chunks: list[TextChunk] = []
    start = 0
    index = 0
    step = chunk_size - chunk_overlap

    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk = text[start:end].strip()
        if chunk:
            chunk_id = f"{source}::chunk::{index}"
            chunks.append(TextChunk(chunk_id=chunk_id, source=source, index=index, text=chunk))

        if end >= len(text):
            break

        start += step
        index += 1

    return chunks
