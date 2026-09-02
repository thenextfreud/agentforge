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


def _get_list(key: str, default: list[str]) -> list[str]:
    raw = os.environ.get(key)
    if raw is None or raw.strip() == "":
        return list(default)
    return [item.strip() for item in raw.split(",") if item.strip()]


@dataclass
class Config:
    host: str = field(default_factory=lambda: _get_str("HOST", "0.0.0.0"))
    port: int = field(default_factory=lambda: _get_int("PORT", 8080))
    cors_origins: list[str] = field(default_factory=lambda: _get_list("CORS_ORIGINS", ["*"]))
    max_connections: int = field(default_factory=lambda: _get_int("MAX_CONNECTIONS", 100))
    # Default step count for long-running operations.
    default_steps: int = field(default_factory=lambda: _get_int("DEFAULT_STEPS", 20))


config = Config()
