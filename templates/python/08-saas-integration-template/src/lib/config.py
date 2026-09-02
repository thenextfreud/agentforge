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
    # SaaS API
    saas_api_url: str = field(default_factory=lambda: _get_str("SAAS_API_URL", "https://api.projectmanager.example.com"))
    saas_client_id: str = field(default_factory=lambda: _get_str("SAAS_CLIENT_ID", ""))
    saas_client_secret: str = field(default_factory=lambda: _get_str("SAAS_CLIENT_SECRET", ""))
    saas_token_url: str = field(
        default_factory=lambda: _get_str("SAAS_TOKEN_URL", "https://auth.projectmanager.example.com/oauth/token")
    )
    saas_api_scope: str = field(default_factory=lambda: _get_str("SAAS_API_SCOPE", ""))

    # Webhook signature verification
    webhook_secret: str = field(default_factory=lambda: _get_str("WEBHOOK_SECRET", ""))

    # HTTP client tuning
    max_retries: int = field(default_factory=lambda: _get_int("MAX_RETRIES", 3))
    request_timeout: float = field(default_factory=lambda: float(_get_int("REQUEST_TIMEOUT", 30)))
    retry_base_delay: float = field(default_factory=lambda: float(_get_int("RETRY_BASE_DELAY", 1)))

    # Page size default for list endpoints
    default_page_size: int = field(default_factory=lambda: _get_int("DEFAULT_PAGE_SIZE", 50))


config = Config()
