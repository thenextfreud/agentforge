"""Webhook signature verification.

Verifies HMAC-SHA256 signatures on incoming webhooks so you can trust
the payload came from the SaaS provider. Two common header conventions
are supported:

* ``X-Webhook-Signature`` = ``<hex digest>``
* ``X-Webhook-Signature`` = ``sha256=<hex digest>``  (GitHub/Slack style)

The signed payload is the raw request body bytes (not the parsed JSON).
"""

from __future__ import annotations

import hashlib
import hmac
from dataclasses import dataclass

from .config import config
from .logger import logger


class WebhookVerificationError(Exception):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(f"[{code}] {message}")


@dataclass
class WebhookConfig:
    secret: str = ""


def _expected_signature(secret: str, body: bytes) -> str:
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


def _parse_header(header_value: str | None) -> str | None:
    if not header_value:
        return None
    value = header_value.strip()
    # Handle "sha256=<hex>" style.
    if "=" in value and not value.startswith("="):
        prefix, _, digest = value.partition("=")
        if prefix.lower() in ("sha256", "sha-256"):
            return digest.strip()
    return value


def verify_webhook(
    body: bytes,
    signature_header: str | None,
    *,
    secret: str | None = None,
) -> bool:
    """Verify a webhook signature. Raises on missing/invalid signatures.

    Returns ``True`` on success. The raw request ``body`` bytes must be
    passed — do not re-serialize parsed JSON, as key ordering may differ.
    """
    sec = secret if secret is not None else config.webhook_secret
    if not sec:
        raise WebhookVerificationError("NOT_CONFIGURED", "WEBHOOK_SECRET is not set")
    if not signature_header:
        raise WebhookVerificationError("MISSING_SIGNATURE", "X-Webhook-Signature header is missing")

    provided = _parse_header(signature_header)
    if not provided:
        raise WebhookVerificationError("MALFORMED_SIGNATURE", "signature header is malformed")

    expected = _expected_signature(sec, body)
    if not hmac.compare_digest(expected, provided):
        logger.warn("webhook signature mismatch", {})
        raise WebhookVerificationError("INVALID_SIGNATURE", "signature does not match payload")

    return True
