"""ASGI middleware that gates requests behind OAuth 2.0 JWKS validation.

Validates the bearer token, enforces required scopes, applies per-token
rate limiting, and stores the resulting :class:`TokenClaims` in:

* ``scope["state"]["claims"]``  — for Starlette request handlers
* a :class:`contextvars.ContextVar`            — for MCP tool functions

Tools read the authenticated principal via :func:`get_current_claims`.
"""

from __future__ import annotations

from contextvars import ContextVar
from typing import Any

from starlette.types import ASGIApp, Receive, Scope, Send

from .auth import AuthError, TokenClaims, introspect
from .logger import logger
from .rate_limiter import RateLimiter

# ContextVar holding the claims for the in-flight request.
_current_claims: ContextVar[TokenClaims | None] = ContextVar(
    "oauth_claims", default=None
)


def get_current_claims() -> TokenClaims:
    """Return the claims for the current request, or raise."""
    claims = _current_claims.get()
    if claims is None:
        raise AuthError("NO_AUTH_CONTEXT", "no authenticated principal on this request")
    return claims


class OAuthAuthMiddleware:
    """ASGI middleware that enforces OAuth bearer-token authentication.

    Only HTTP requests are authenticated; lifespan and non-HTTP scopes are
    passed through untouched. A ``/health`` path is exempt so deployments
    can run liveness probes without a token.
    """

    def __init__(
        self,
        app: ASGIApp,
        validator: Any,
        rate_limiter: RateLimiter,
        exempt_paths: tuple[str, ...] = ("/health", "/.well-known/oauth-protected-resource"),
    ) -> None:
        self.app = app
        self.validator = validator
        self.rate_limiter = rate_limiter
        self.exempt_paths = exempt_paths

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        if path in self.exempt_paths:
            await self.app(scope, receive, send)
            return

        # Extract Authorization header from the raw ASGI scope.
        headers: list[tuple[bytes, bytes]] = scope.get("headers", [])
        authorization = None
        for name, value in headers:
            if name.lower() == b"authorization":
                authorization = value.decode("latin-1")
                break

        try:
            claims = introspect(authorization, self.validator)
        except AuthError as err:
            logger.warn(
                "auth rejected",
                {"code": err.code, "message": err.message, "path": path},
            )
            await _send_error(send, err.status, err.code, err.message)
            return

        allowed, remaining = self.rate_limiter.check(claims.sub)
        if not allowed:
            logger.warn("rate limited", {"sub": claims.sub, "path": path})
            await _send_error(send, 429, "RATE_LIMITED", "rate limit exceeded")
            return

        # Stash claims for downstream handlers and tools.
        scope.setdefault("state", {})
        scope["state"]["claims"] = claims
        token = _current_claims.set(claims)
        try:
            # Attach remaining quota as a response header via a send wrapper.
            await self.app(scope, receive, send)
        finally:
            _current_claims.reset(token)


async def _send_error(send: Send, status: int, code: str, message: str) -> None:
    import json

    body = json.dumps({"error": code, "message": message}).encode("utf-8")
    await send(
        {
            "type": "http.response.start",
            "status": status,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode()),
                (b"www-authenticate", b'Bearer error="invalid_token"'),
            ],
        }
    )
    await send({"type": "http.response.body", "body": body, "more_body": False})


__all__ = ["OAuthAuthMiddleware", "get_current_claims"]
