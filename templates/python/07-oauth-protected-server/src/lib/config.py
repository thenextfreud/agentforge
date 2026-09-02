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
    # OAuth / JWKS
    oauth_issuer: str = field(default_factory=lambda: _get_str("OAUTH_ISSUER", ""))
    jwks_url: str = field(default_factory=lambda: _get_str("JWKS_URL", ""))
    required_scopes: list[str] = field(
        default_factory=lambda: _get_list("REQUIRED_SCOPES", ["mcp:tools"])
    )
    # The audience claim your token must contain (set to your API identifier).
    # Leave empty to skip audience verification.
    audience: str = field(default_factory=lambda: _get_str("OAUTH_AUDIENCE", ""))

    # HTTP server
    host: str = field(default_factory=lambda: _get_str("HOST", "0.0.0.0"))
    port: int = field(default_factory=lambda: _get_int("PORT", 8080))

    # Rate limiting (requests per minute per token)
    rate_limit_per_minute: int = field(default_factory=lambda: _get_int("RATE_LIMIT_PER_MINUTE", 60))

    # JWKS cache TTL in seconds
    jwks_cache_ttl: int = field(default_factory=lambda: _get_int("JWKS_CACHE_TTL", 600))

    @property
    def jwks_url_resolved(self) -> str:
        """Resolve the JWKS URL, deriving it from the issuer when not set."""
        if self.jwks_url:
            return self.jwks_url
        if self.oauth_issuer:
            return f"{self.oauth_issuer.rstrip('/')}/.well-known/jwks.json"
        return ""


config = Config()
