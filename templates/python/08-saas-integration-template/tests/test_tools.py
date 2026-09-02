"""Unit tests for the SaaS integration template.

Exercises pagination parsing, webhook verification, retry/backoff
helpers, and error normalization — without any real network calls.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
import pytest

from src.lib.pagination import _extract_items, _next_cursor, _total_pages
from src.lib.saas_client import (
    SaaSError,
    _error_code,
    _new_request_id,
    _parse_body,
    _retry_after,
)
from src.lib.webhooks import WebhookVerificationError, verify_webhook


# --- Pagination parsing ------------------------------------------------------

def test_extract_items_data_key():
    assert _extract_items({"data": [{"id": 1}, {"id": 2}]}) == [{"id": 1}, {"id": 2}]


def test_extract_items_results_key():
    assert _extract_items({"results": [{"id": 9}]}) == [{"id": 9}]


def test_extract_items_list_response():
    assert _extract_items([{"id": 1}]) == [{"id": 1}]


def test_next_cursor_top_level():
    assert _next_cursor({"next_cursor": "abc"}) == "abc"


def test_next_cursor_nested():
    assert _next_cursor({"pagination": {"next": "xyz"}}) == "xyz"


def test_next_cursor_none():
    assert _next_cursor({"data": []}) is None


def test_total_pages_top_level():
    assert _total_pages({"total_pages": 7}) == 7


def test_total_pages_nested():
    assert _total_pages({"meta": {"pages": 3}}) == 3


def test_total_pages_missing():
    assert _total_pages({"data": []}) is None


# --- Webhook verification ----------------------------------------------------

def test_webhook_valid_signature():
    secret = "s3cr3t"
    body = b'{"event":"created","id":1}'
    sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    assert verify_webhook(body, sig, secret=secret) is True


def test_webhook_sha256_prefixed_signature():
    secret = "s3cr3t"
    body = b'{"event":"created"}'
    sig = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    assert verify_webhook(body, sig, secret=secret) is True


def test_webhook_invalid_signature():
    with pytest.raises(WebhookVerificationError) as exc:
        verify_webhook(b'{"x":1}', "deadbeef", secret="s3cr3t")
    assert exc.value.code == "INVALID_SIGNATURE"


def test_webhook_missing_signature():
    with pytest.raises(WebhookVerificationError) as exc:
        verify_webhook(b'{"x":1}', None, secret="s3cr3t")
    assert exc.value.code == "MISSING_SIGNATURE"


def test_webhook_no_secret_configured():
    with pytest.raises(WebhookVerificationError) as exc:
        verify_webhook(b'{"x":1}', "abc", secret="")
    assert exc.value.code == "NOT_CONFIGURED"


# --- Retry / error helpers ---------------------------------------------------

def test_retry_after_header_seconds():
    resp = httpx.Response(429, headers={"Retry-After": "5"})
    assert _retry_after(resp, base_delay=1.0, attempt=0) == 5.0


def test_retry_after_exponential_backoff():
    resp = httpx.Response(503)
    assert _retry_after(resp, base_delay=1.0, attempt=0) == 1.0
    assert _retry_after(resp, base_delay=1.0, attempt=1) == 2.0
    assert _retry_after(resp, base_delay=1.0, attempt=2) == 4.0


def test_error_code_mapping():
    assert _error_code(404) == "NOT_FOUND"
    assert _error_code(429) == "RATE_LIMITED"
    assert _error_code(503) == "SERVICE_UNAVAILABLE"
    assert _error_code(418) == "HTTP_418"


def test_new_request_id_unique():
    a = _new_request_id()
    b = _new_request_id()
    assert a != b
    assert len(a) == 32


def test_parse_body_json():
    resp = httpx.Response(200, content=b'{"id": 1}', headers={"content-type": "application/json"})
    assert _parse_body(resp) == {"id": 1}


def test_parse_body_empty():
    resp = httpx.Response(204)
    assert _parse_body(resp) == {}


def test_saas_error_carries_request_id():
    err = SaaSError("NOT_FOUND", "missing", "req-123", status=404)
    assert err.request_id == "req-123"
    assert "req-123" in str(err)
    assert err.code == "NOT_FOUND"


# --- SaaSClient retry behavior with a stubbed transport ----------------------

class StubTransport(httpx.AsyncBaseTransport):
    """Returns a sequence of canned responses, recording requests."""

    def __init__(self, responses: list[httpx.Response]):
        self._responses = list(responses)
        self.requests: list[httpx.Request] = []

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if not self._responses:
            raise AssertionError("no more stub responses")
        return self._responses.pop(0)


def test_client_retries_on_503_then_succeeds(monkeypatch):
    from src.lib import saas_client as mod

    async def scenario():
        # Stub the token fetch by pre-seeding the token cache via a fake token endpoint.
        good_token = httpx.Response(200, content=b'{"access_token":"tok","expires_in":3600}', headers={"content-type": "application/json"})
        r1 = httpx.Response(503, content=b'{"error":"down"}')
        r2 = httpx.Response(200, content=b'{"id":"proj-1","name":"Alpha"}', headers={"content-type": "application/json"})

        transport = StubTransport([good_token, r1, r2])
        http = httpx.AsyncClient(transport=transport, timeout=5)

        client = mod.SaaSClient(
            base_url="https://api.example.com",
            client_id="id",
            client_secret="sec",
            token_url="https://auth.example.com/token",
            max_retries=3,
            retry_base_delay=0.01,
        )
        client._http = http

        body = await client.get("/projects/1")
        await http.aclose()
        return body, transport

    monkeypatch.setattr(mod, "_sleep", lambda s: asyncio.sleep(0))
    body, transport = asyncio.run(scenario())
    assert body["id"] == "proj-1"
    # token call + 503 + 200 = 3 requests
    assert len(transport.requests) == 3


def test_client_does_not_retry_on_404(monkeypatch):
    from src.lib import saas_client as mod

    async def scenario():
        good_token = httpx.Response(200, content=b'{"access_token":"tok","expires_in":3600}', headers={"content-type": "application/json"})
        not_found = httpx.Response(404, content=b'{"error":"not found"}')

        transport = StubTransport([good_token, not_found])
        http = httpx.AsyncClient(transport=transport, timeout=5)

        client = mod.SaaSClient(
            base_url="https://api.example.com",
            client_id="id",
            client_secret="sec",
            token_url="https://auth.example.com/token",
            max_retries=3,
            retry_base_delay=0.01,
        )
        client._http = http

        try:
            await client.get("/projects/missing")
        except SaaSError as err:
            await http.aclose()
            return err, transport
        await http.aclose()
        return None, transport

    monkeypatch.setattr(mod, "_sleep", lambda s: asyncio.sleep(0))
    err, transport = asyncio.run(scenario())
    assert err is not None
    assert err.code == "NOT_FOUND"
    # token call + single 404 = 2 requests (no retry)
    assert len(transport.requests) == 2
