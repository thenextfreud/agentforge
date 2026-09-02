"""Document chunking utilities.

Splits raw text into overlapping chunks so embeddings capture local
context without losing boundary information. Two strategies are
supported:

* ``simple``  — recursive character split (default, no dependencies)
* ``tokens``  — approximate token-aware split using whitespace heuristics

The simple strategy is dependency-free and deterministic, which keeps the
template runnable out of the box. Swap in a tokenizer (tiktoken, HF
tokenizers) by subclassing :class:`Chunker` if you need exact token counts.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Chunk:
    index: int
    text: str
    start_char: int
    end_char: int
    token_count: int


class Chunker:
    """Recursive character chunker with overlap."""

    def __init__(self, chunk_size: int = 512, chunk_overlap: int = 50) -> None:
        if chunk_size <= 0:
            raise ValueError("chunk_size must be positive")
        if chunk_overlap < 0:
            raise ValueError("chunk_overlap cannot be negative")
        if chunk_overlap >= chunk_size:
            raise ValueError("chunk_overlap must be smaller than chunk_size")
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def _split_recursive(self, text: str, separators: tuple[str, ...]) -> list[str]:
        """Split ``text`` using the first separator that produces chunks
        within ``chunk_size``; otherwise fall back to the next separator."""
        if len(text) <= self.chunk_size:
            return [text] if text.strip() else []

        for sep in separators:
            if sep and sep in text:
                parts = text.split(sep)
                merged: list[str] = []
                buffer = ""
                for part in parts:
                    candidate = f"{buffer}{sep}{part}" if buffer else part
                    if len(candidate) <= self.chunk_size:
                        buffer = candidate
                    else:
                        if buffer:
                            merged.append(buffer)
                        buffer = part
                if buffer:
                    merged.append(buffer)
                if merged:
                    return merged
        # Hard split — no separator worked
        return [text[i : i + self.chunk_size] for i in range(0, len(text), self.chunk_size)]

    def chunk(self, text: str) -> list[Chunk]:
        """Split ``text`` into overlapping :class:`Chunk` objects."""
        if not text or not text.strip():
            return []

        separators: tuple[str, ...] = ("\n\n", "\n", ". ", " ", "")
        pieces = self._split_recursive(text, separators)

        # Apply overlap by sliding a window across the pieces.
        chunks: list[Chunk] = []
        step = max(1, self.chunk_size - self.chunk_overlap)
        flat = text
        cursor = 0
        idx = 0

        # Build chunks from pieces with overlap by re-joining pieces.
        i = 0
        while i < len(pieces):
            current = pieces[i]
            # Grow the chunk while it fits and there are more pieces.
            j = i + 1
            while j < len(pieces) and len(current) + len(pieces[j]) + 1 <= self.chunk_size:
                current = f"{current}\n{pieces[j]}"
                j += 1
            start = flat.find(current, cursor)
            if start == -1:
                start = cursor
            end = start + len(current)
            chunks.append(
                Chunk(
                    index=idx,
                    text=current,
                    start_char=start,
                    end_char=end,
                    token_count=len(current.split()),
                )
            )
            idx += 1
            cursor = end
            # Advance by step-sized piece progress to create overlap.
            if j == i:  # single oversized piece
                i += 1
            else:
                # Move forward but keep overlap by stepping back one piece
                # when possible.
                advance = max(1, j - i - 1) if self.chunk_overlap > 0 else (j - i)
                i += advance
        return chunks
