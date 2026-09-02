"""Configuration loaded from environment variables via python-dotenv."""

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
    session_ttl: int = field(default_factory=lambda: _get_int("SESSION_TTL", 3600))
    max_context_items: int = field(default_factory=lambda: _get_int("MAX_CONTEXT_ITEMS", 100))
    export_dir: str = field(default_factory=lambda: _get_str("EXPORT_DIR", "./exports"))


config = Config()
