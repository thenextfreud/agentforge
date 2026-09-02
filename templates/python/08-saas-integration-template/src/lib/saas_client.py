"""HTTP client for wrapping a SaaS API.

Encapsulates the patterns you reinvent for every SaaS integration:

- OAuth2 **client credentials** flow for server-to-server auth (cached token).
- **Retries** with exponential backoff and ``Retry-After`` header support.
- **Request IDs** propagated into every error so support is traceable.
- Centralized error normalization into :class:`SaaSError`.

The concrete example wraps a hypothetical "ProjectManager" SaaS API, but
the class is generic: point it at any REST API that issues bearer tokens
via client credentials.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Any

import httpx

from .config import config
from .logger import logger


class SaaSError(Exception):
    """Normalized SaaS API error with a request id for traceability."""

    def __init__(self, code: str, message: str, request_id: str, status: int = 0, details: Any | None = None) -> None:
        self.code = code
        self.message = message
        self.request_id = request_id
        self.status = status
        self.details = details
        super().__init__(f"[{code}] (request {request_id}) {message}")


@dataclass
class _TokenCache:
    access_token: str = ""
    expires_at: float = 0.0


class SaaSClient:
    """Authenticated HTTP client with retries and request IDs."""

    def __init__(
        self,
        base_url: str,
        client_id: str,
        client_secret: str,
        token_url: str,
        *,
        scope: str = "",
        max_retries: int = 3,
        timeout: float = 30.0,
        retry_base_delay: float = 1.0,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._client_id = client_id
        self._client_secret = client_secret
        self._token_url = token_url
        self._scope = scope
        self._max_retries = max_retries
        self._timeout = timeout
        self._retry_base_delay = retry_base_delay
        self._token = _TokenCache()
        self._http = httpx.AsyncClient(timeout=timeout)

    # --- Token management ----------------------------------------------------

    async def _fetch_token(self) -> None:
        if not self._client_id or not self._client_secret:
            raise SaaSError("NO_CREDENTIALS", "SAAS_CLIENT_ID and SAAS_CLIENT_SECRET are required", _new_request_id())
        data: dict[str, str] = {
            "grant_type": "client_credentials",
            "client_id": self._client_id,
            "client_secret": self._client_secret,
        }
        if self._scope:
            data["scope"] = self._scope
        try:
            resp = await self._http.post(self._token_url, data=data)
        except httpx.HTTPError as err:
            raise SaaSError("TOKEN_REQUEST_FAILED", str(err), _new_request_id()) from err
        if resp.status_code >= 400:
            raise SaaSError("TOKEN_REQUEST_FAILED", f"token endpoint returned {resp.status_code}: {resp.text}", _new_request_id(), status=resp.status_code)
        body = resp.json()
        self._token.access_token = body["access_token"]
        # Expire slightly early to avoid edge-case races.
        self._token.expires_at = time.time() + int(body.get("expires_in", 3600)) - 30
        logger.info("acquired saas access token", {"expires_in": body.get("expires_in")})

    async def _ensure_token(self) -> str:
        if not self._token.access_token or time.time() >= self._token.expires_at:
            await self._fetch_token()
        return self._token.access_token

    # --- Core request with retries ------------------------------------------

    async def request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json_body: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Perform an authenticated request with retries + backoff.

        Returns the parsed JSON body. Raises :class:`SaaSError` on failure.
        """
        url = f"{self._base_url}/{path.lstrip('/')}"
        last_error: SaaSError | None = None

        for attempt in range(self._max_retries + 1):
            request_id = _new_request_id()
            token = await self._ensure_token()
            headers = {
                "Authorization": f"Bearer {token}",
                "User-Agent": "AgentForge-MCP/1.0",
                "X-Request-Id": request_id,
                "Accept": "application/json",
            }
            logger.debug(
                "saas request",
                {"method": method, "url": url, "attempt": attempt, "request_id": request_id},
            )
            try:
                resp = await self._http.request(
                    method, url, params=params, json=json_body, headers=headers
                )
            except httpx.HTTPError as err:
                last_error = SaaSError("NETWORK_ERROR", str(err), request_id)
                logger.warn("saas network error", {"request_id": request_id, "error": str(err)})
            else:
                if 200 <= resp.status_code < 300:
                    return _parse_body(resp)
                # Build a normalized error with the request id.
                last_error = SaaSError(
                    code=_error_code(resp.status_code),
                    message=f"{resp.status_code} {resp.reason_phrase}: {resp.text}",
                    request_id=request_id,
                    status=resp.status_code,
                )
                # Non-retryable status codes: fail fast.
                if resp.status_code in (400, 401, 403, 404, 409, 422):
                    raise last_error
                # Retryable: 429, 5xx. Honor Retry-After when present.
                if attempt < self._max_retries:
                    delay = _retry_after(resp, self._retry_base_delay, attempt)
                    logger.warn(
                        "saas retryable error",
                        {"request_id": request_id, "status": resp.status_code, "delay": delay, "attempt": attempt},
                    )
                    await _sleep(delay)
                    continue
                raise last_error

            # Network error path: backoff and retry.
            if attempt < self._max_retries:
                delay = self._retry_base_delay * (2 ** attempt)
                logger.warn("saas retry after network error", {"delay": delay, "attempt": attempt})
                await _sleep(delay)
                continue
            raise last_error

        # Should be unreachable, but keep the type checker happy.
        raise last_error or SaaSError("UNKNOWN", "exhausted retries", _new_request_id())  # pragma: no cover

    # --- Convenience verbs ---------------------------------------------------

    async def get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        return await self.request("GET", path, params=params)

    async def post(self, path: str, json_body: dict[str, Any] | None = None) -> dict[str, Any]:
        return await self.request("POST", path, json_body=json_body)

    async def patch(self, path: str, json_body: dict[str, Any] | None = None) -> dict[str, Any]:
        return await self.request("PATCH", path, json_body=json_body)

    async def put(self, path: str, json_body: dict[str, Any] | None = None) -> dict[str, Any]:
        return await self.request("PUT", path, json_body=json_body)

    async def delete(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        return await self.request("DELETE", path, params=params)

    async def close(self) -> None:
        await self._http.aclose()


# --- Helpers -----------------------------------------------------------------

def _new_request_id() -> str:
    return uuid.uuid4().hex


def _error_code(status: int) -> str:
    return {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        422: "VALIDATION_ERROR",
        429: "RATE_LIMITED",
        500: "SERVER_ERROR",
        502: "BAD_GATEWAY",
        503: "SERVICE_UNAVAILABLE",
        504: "GATEWAY_TIMEOUT",
    }.get(status, f"HTTP_{status}")


def _retry_after(resp: httpx.Response, base_delay: float, attempt: int) -> float:
    """Determine the delay before the next retry.

    Honors a ``Retry-After`` header (seconds or HTTP-date) when present;
    otherwise falls back to exponential backoff.
    """
    header = resp.headers.get("Retry-After")
    if header:
        try:
            return float(header)
        except ValueError:
            # Could be an HTTP-date; fall through to backoff.
            pass
    return base_delay * (2 ** attempt)


async def _sleep(seconds: float) -> None:
    import anyio

    await anyio.sleep(seconds)


def _parse_body(resp: httpx.Response) -> dict[str, Any]:
    if not resp.content:
        return {}
    try:
        body = resp.json()
    except ValueError:
        return {"_raw": resp.text}
    return body if isinstance(body, dict) else {"_data": body}


# Module-level singleton client configured from env.
_client: SaaSClient | None = None


def get_client() -> SaaSClient:
    global _client
    if _client is None:
        _client = SaaSClient(
            base_url=config.saas_api_url,
            client_id=config.saas_client_id,
            client_secret=config.saas_client_secret,
            token_url=config.saas_token_url,
            scope=config.saas_api_scope,
            max_retries=config.max_retries,
            timeout=config.request_timeout,
            retry_base_delay=config.retry_base_delay,
        )
    return _client
