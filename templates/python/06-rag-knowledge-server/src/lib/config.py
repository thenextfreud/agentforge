"""Configuration loaded from environment variables via python-dotenv.

Centralizes every tunable knob so the rest of the codebase never reads
``os.environ`` directly.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field

from dotenv import load_dotenv

load_dotenv()


def _get_int(key: str, default: int) -> int:
    raw = os.environ.get(key)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _get_str(key: str, default: str) -> str:
    raw = os.environ.get(key)
    return default if raw is None or raw.strip() == "" else raw.strip()


@dataclass
class Config:
    # Embedding provider: "local" (sentence-transformers) or "openai"
    embedding_provider: str = field(
        default_factory=lambda: _get_str("EMBEDDING_PROVIDER", "local")
    )
    openai_api_key: str = field(default_factory=lambda: _get_str("OPENAI_API_KEY", ""))
    openai_embedding_model: str = field(
        default_factory=lambda: _get_str("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
    )
    local_embedding_model: str = field(
        default_factory=lambda: _get_str("LOCAL_EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    )

    # Chunking
    chunk_size: int = field(default_factory=lambda: _get_int("CHUNK_SIZE", 512))
    chunk_overlap: int = field(default_factory=lambda: _get_int("CHUNK_OVERLAP", 50))

    # Vector store: "memory" or "chroma"
    vector_store: str = field(default_factory=lambda: _get_str("VECTOR_STORE", "memory"))
    chroma_persist_dir: str = field(
        default_factory=lambda: _get_str("CHROMA_PERSIST_DIR", "./chroma_data")
    )

    # Search
    default_top_k: int = field(default_factory=lambda: _get_int("DEFAULT_TOP_K", 5))

    @property
    def embedding_dimensions(self) -> int:
        """Best-effort dimension hint for the configured embedding model."""
        if self.embedding_provider == "openai":
            return 1536  # text-embedding-3-small
        return 384  # all-MiniLM-L6-v2


config = Config()
