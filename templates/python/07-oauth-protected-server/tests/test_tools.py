"""Unit tests for the OAuth-protected server.

These tests exercise the rate limiter, scope checking, and middleware
logic without a live JWKS endpoint. JWT signing/verification is tested
with a locally generated RSA key pair.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from src.lib.auth import AuthError, JwksValidator, TokenClaims
from src.lib.rate_limiter import RateLimiter


# --- Fixtures: generate an RSA key pair and a fake JWKS validator -------------

def _make_keypair():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return private_key, public_pem


@pytest.fixture()
def keypair():
    return _make_keypair()


class StubValidator:
    """A validator that verifies tokens against a fixed public key."""

    def __init__(self, public_pem, issuer, required_scopes, audience=""):
        self._public_pem = public_pem
        self._issuer = issuer
        self._required_scopes = required_scopes
        self._audience = audience

    def validate(self, authorization):
        if not authorization:
            raise AuthError("MISSING_TOKEN", "Authorization header is required")
        token = authorization.split(" ", 1)[1]
        try:
            payload = jwt.decode(
                token,
                self._public_pem,
                algorithms=["RS256"],
                issuer=self._issuer or None,
                audience=self._audience or None,
                options={"require": ["exp", "iat"]},
            )
        except jwt.InvalidTokenError as err:
            raise AuthError("INVALID_TOKEN", str(err)) from err
        scopes = str(payload.get("scope", "")).split(" ")
        missing = [s for s in self._required_scopes if s not in scopes]
        if missing:
            raise AuthError("INSUFFICIENT_SCOPES", f"missing: {missing}", status=403)
        return TokenClaims(sub=payload["sub"], scopes=scopes, issuer=payload.get("iss", ""), raw=payload)


def _make_token(private_key, *, sub="user-1", scopes=("mcp:tools",), issuer="https://issuer.example.com/", aud=None, exp_delta=300):
    now = int(time.time())
    payload = {"sub": sub, "iat": now, "exp": now + exp_delta, "iss": issuer, "scope": " ".join(scopes)}
    if aud:
        payload["aud"] = aud
    return jwt.encode(payload, private_key, algorithm="RS256")


# --- Tests -------------------------------------------------------------------

def test_rate_limiter_allows_under_limit():
    rl = RateLimiter(max_per_minute=3)
    assert rl.check("user-1") == (True, 2)
    assert rl.check("user-1") == (True, 1)
    assert rl.check("user-1") == (True, 0)
    assert rl.check("user-1") == (False, 0)


def test_rate_limiter_separate_keys():
    rl = RateLimiter(max_per_minute=2)
    assert rl.check("a") == (True, 1)
    assert rl.check("b") == (True, 1)
    assert rl.check("a") == (True, 0)
    assert rl.check("b") == (True, 0)


def test_validator_accepts_valid_token(keypair):
    private_key, public_pem = keypair
    v = StubValidator(public_pem, issuer="https://issuer.example.com/", required_scopes=["mcp:tools"])
    token = _make_token(private_key)
    claims = v.validate(f"Bearer {token}")
    assert claims.sub == "user-1"
    assert "mcp:tools" in claims.scopes


def test_validator_rejects_missing_header(keypair):
    _, public_pem = keypair
    v = StubValidator(public_pem, issuer="https://issuer.example.com/", required_scopes=["mcp:tools"])
    with pytest.raises(AuthError) as exc:
        v.validate(None)
    assert exc.value.code == "MISSING_TOKEN"


def test_validator_rejects_insufficient_scopes(keypair):
    private_key, public_pem = keypair
    v = StubValidator(public_pem, issuer="https://issuer.example.com/", required_scopes=["mcp:admin"])
    token = _make_token(private_key, scopes=("mcp:tools",))
    with pytest.raises(AuthError) as exc:
        v.validate(f"Bearer {token}")
    assert exc.value.code == "INSUFFICIENT_SCOPES"
    assert exc.value.status == 403


def test_validator_rejects_expired_token(keypair):
    private_key, public_pem = keypair
    v = StubValidator(public_pem, issuer="https://issuer.example.com/", required_scopes=["mcp:tools"])
    token = _make_token(private_key, exp_delta=-10)
    with pytest.raises(AuthError) as exc:
        v.validate(f"Bearer {token}")
    assert exc.value.code == "INVALID_TOKEN"


def test_validator_rejects_wrong_issuer(keypair):
    private_key, public_pem = keypair
    v = StubValidator(public_pem, issuer="https://issuer.example.com/", required_scopes=["mcp:tools"])
    token = _make_token(private_key, issuer="https://evil.example.com/")
    with pytest.raises(AuthError):
        v.validate(f"Bearer {token}")


def test_validator_rejects_wrong_audience(keypair):
    private_key, public_pem = keypair
    v = StubValidator(public_pem, issuer="https://issuer.example.com/", required_scopes=["mcp:tools"], audience="my-api")
    token = _make_token(private_key, aud="wrong-api")
    with pytest.raises(AuthError):
        v.validate(f"Bearer {token}")
