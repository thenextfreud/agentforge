"""OAuth 2.0 authentication via JWKS validation.

Validates bearer tokens (JWTs) against the issuer's JSON Web Key Set.
Supports any OIDC-compliant provider: Auth0, Okta, Clerk, Cognito, etc.

Flow:
1. Extract the bearer token from the ``Authorization`` header.
2. Decode the JWT *without* verifying to read the ``kid`` header.
3. Fetch the matching signing key from the JWKS (cached with TTL).
4. Verify signature, ``iss``, ``aud`` (optional), and ``exp``.
5. Check the token's ``scope`` contains all :attr:`Config.required_scopes`.
6. Return a :class:`TokenClaims` object the tools can use (``sub``, scopes, …).
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

import httpx
import jwt
from jwt import PyJWKClient

from .config import config
from .logger import logger


@dataclass
class TokenClaims:
    sub: str
    scopes: list[str] = field(default_factory=list)
    issuer: str = ""
    audience: str | list[str] = ""
    raw: dict = field(default_factory=dict)

    @property
    def subject(self) -> str:
        return self.sub

    def has_scope(self, scope: str) -> bool:
        return scope in self.scopes


class AuthError(Exception):
    """Raised when a token is missing, invalid, or lacks required scopes."""

    def __init__(self, code: str, message: str, status: int = 401) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(f"[{code}] {message}")


class JwksValidator:
    """Validates JWT bearer tokens against a JWKS endpoint with caching."""

    def __init__(
        self,
        jwks_url: str,
        issuer: str,
        audience: str = "",
        required_scopes: list[str] | None = None,
        cache_ttl: int = 600,
    ) -> None:
        if not jwks_url:
            raise RuntimeError("JWKS_URL (or OAUTH_ISSUER) must be configured")
        self._jwks_url = jwks_url
        self._issuer = issuer
        self._audience = audience
        self._required_scopes = required_scopes or []
        self._cache_ttl = cache_ttl
        self._jwk_client = PyJWKClient(jwks_url, cache_keys=True, lifespan=cache_ttl)
        logger.info(
            "JWKS validator initialized",
            {"jwks_url": jwks_url, "issuer": issuer, "audience": audience or "(none)"},
        )

    def _extract_bearer(self, authorization: str | None) -> str:
        if not authorization:
            raise AuthError("MISSING_TOKEN", "Authorization header is required")
        parts = authorization.split(" ", 1)
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise AuthError("INVALID_HEADER", "Authorization header must be a Bearer token")
        token = parts[1].strip()
        if not token:
            raise AuthError("INVALID_HEADER", "Bearer token is empty")
        return token

    def _verify_scopes(self, claims: dict) -> list[str]:
        scope_str = claims.get("scope", "")
        if isinstance(scope_str, list):
            scopes = [str(s) for s in scope_str]
        else:
            scopes = [s for s in str(scope_str).split(" ") if s]
        # Some providers put scopes in "scp" (Auth0).
        if not scopes:
            scp = claims.get("scp", [])
            if isinstance(scp, list):
                scopes = [str(s) for s in scp]
            elif isinstance(scp, str):
                scopes = [s for s in scp.split(" ") if s]
        missing = [s for s in self._required_scopes if s not in scopes]
        if missing:
            raise AuthError(
                "INSUFFICIENT_SCOPES",
                f"token is missing required scopes: {', '.join(missing)}",
                status=403,
            )
        return scopes

    def validate(self, authorization: str | None) -> TokenClaims:
        """Validate a bearer token and return its claims.

        Raises :class:`AuthError` on any failure.
        """
        token = self._extract_bearer(authorization)

        # Decode the unverified header to find the key id, then fetch the key.
        try:
            signing_key = self._jwk_client.get_signing_key_from_jwt(token)
        except Exception as err:  # noqa: BLE001
            raise AuthError("INVALID_TOKEN", f"could not resolve signing key: {err}") from err

        decode_kwargs: dict = {
            "algorithms": ["RS256", "ES256"],
            "options": {"require": ["exp", "iat"]},
        }
        if self._issuer:
            decode_kwargs["issuer"] = self._issuer
        if self._audience:
            decode_kwargs["audience"] = self._audience

        try:
            payload = jwt.decode(token, signing_key.key, **decode_kwargs)
        except jwt.ExpiredSignatureError as err:
            raise AuthError("EXPIRED_TOKEN", "token has expired") from err
        except jwt.InvalidAudienceError as err:
            raise AuthError("INVALID_AUDIENCE", str(err), status=403) from err
        except jwt.InvalidIssuerError as err:
            raise AuthError("INVALID_ISSUER", str(err), status=403) from err
        except jwt.InvalidTokenError as err:
            raise AuthError("INVALID_TOKEN", str(err)) from err

        scopes = self._verify_scopes(payload)

        logger.debug(
            "token validated",
            {"sub": payload.get("sub"), "scopes": scopes},
        )
        return TokenClaims(
            sub=str(payload.get("sub", "")),
            scopes=scopes,
            issuer=str(payload.get("iss", "")),
            audience=payload.get("aud", ""),
            raw=payload,
        )


def get_validator() -> JwksValidator:
    """Build a JWKS validator from the current configuration."""
    return JwksValidator(
        jwks_url=config.jwks_url_resolved,
        issuer=config.oauth_issuer,
        audience=config.audience,
        required_scopes=config.required_scopes,
        cache_ttl=config.jwks_cache_ttl,
    )


# A simple in-memory introspection cache keyed by token hash, used to avoid
# re-validating the same token on every request within a short window.
class TokenIntrospectionCache:
    def __init__(self, ttl: int = 60) -> None:
        self._ttl = ttl
        self._cache: dict[str, tuple[float, TokenClaims]] = {}

    def get(self, token: str) -> TokenClaims | None:
        entry = self._cache.get(token)
        if not entry:
            return None
        expires_at, claims = entry
        if time.time() > expires_at:
            self._cache.pop(token, None)
            return None
        return claims

    def set(self, token: str, claims: TokenClaims) -> None:
        self._cache[token] = (time.time() + self._ttl, claims)


introspection_cache = TokenIntrospectionCache()


def introspect(authorization: str | None, validator: JwksValidator) -> TokenClaims:
    """Validate a token with a short-lived introspection cache."""
    if not authorization:
        raise AuthError("MISSING_TOKEN", "Authorization header is required")
    parts = authorization.split(" ", 1)
    token = parts[1].strip() if len(parts) == 2 else ""
    cached = introspection_cache.get(token)
    if cached:
        return cached
    claims = validator.validate(authorization)
    introspection_cache.set(token, claims)
    return claims


__all__ = [
    "AuthError",
    "JwksValidator",
    "TokenClaims",
    "TokenIntrospectionCache",
    "get_validator",
    "introspect",
    "introspection_cache",
]
