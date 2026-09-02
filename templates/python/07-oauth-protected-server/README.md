# OAuth-Protected MCP Server (Python, Streamable HTTP)

A remote MCP server over Streamable HTTP, gated by OAuth 2.0 bearer-token validation via JWKS. Works with any OIDC provider — Auth0, Okta, Clerk, Cognito — and enforces scope-based authorization plus per-token rate limiting.

Built with [FastMCP](https://modelcontextprotocol.io), PyJWT, and Starlette.

## Features

- **JWKS validation** — verifies JWT signatures against the issuer's JSON Web Key Set (cached with TTL).
- **Token introspection caching** — short-lived cache avoids re-validating the same token on every request.
- **Scope-based authorization** — every token must contain the configured scopes; tools enforce per-resource rules.
- **Per-token rate limiting** — sliding-window limiter keyed by token subject.
- **Streamable HTTP transport** — deploy as a web service, not stdio.
- **Provider-agnostic** — configure an issuer URL and it works with Auth0, Okta, Clerk, or Cognito.
- **Pydantic input validation** + structured stderr logging.

## Quick start

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

pip install -e ".[dev]"

cp .env.example .env
# edit .env — set OAUTH_ISSUER (and optionally JWKS_URL, REQUIRED_SCOPES, OAUTH_AUDIENCE)

oauth-protected-server
# → serves MCP at http://0.0.0.0:8080/mcp
# → health check at http://0.0.0.0:8080/health (no auth)
```

## Provider configuration

### Auth0
```env
OAUTH_ISSUER=https://YOUR_DOMAIN/
OAUTH_AUDIENCE=https://YOUR_API_IDENTIFIER
REQUIRED_SCOPES=mcp:tools
```

### AWS Cognito
```env
OAUTH_ISSUER=https://cognito-idp.REGION.amazonaws.com/USER_POOL_ID
REQUIRED_SCOPES=mcp:tools
```

### Okta
```env
OAUTH_ISSUER=https://YOUR_OKTA_DOMAIN/oauth2/default
OAUTH_AUDIENCE=api://default
REQUIRED_SCOPES=mcp:tools
```

### Clerk
```env
OAUTH_ISSUER=https://YOUR_CLERK_DOMAIN
REQUIRED_SCOPES=mcp:tools
```

## Connecting a client

This is a **remote** server. Clients connect over HTTP with a bearer token.

### Claude Desktop / Cursor (remote MCP)
```json
{
  "mcpServers": {
    "oauth-protected": {
      "url": "http://localhost:8080/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_JWT>"
      }
    }
  }
}
```

### Programmatic client (Python)
```python
import httpx
from mcp.client.streamable_http import streamablehttp_client

headers = {"Authorization": "Bearer <YOUR_JWT>"}
async with streamablehttp_client("http://localhost:8080/mcp", headers=headers) as (read, write, _):
    # ... use the MCP session ...
    pass
```

## Tools

All tools require a valid bearer token with the configured scopes.

### `whoami`
Return the subject, issuer, and scopes of the authenticated principal. No parameters.

### `list_resources`
List protected resources visible to the principal. Principals with the `mcp:admin` scope see all resources; others see only their team's.

### `get_resource`
Fetch a single protected resource by id. Enforces per-resource authorization.

| Parameter     | Type   | Required | Description                       |
|---------------|--------|----------|-----------------------------------|
| `resource_id` | string | Yes      | The id of the resource to fetch   |

## Configuration (env)

| Variable               | Default       | Description                                              |
|------------------------|---------------|----------------------------------------------------------|
| `OAUTH_ISSUER`         | —             | OIDC issuer URL (used to verify `iss` and derive JWKS)   |
| `JWKS_URL`             | derived       | Explicit JWKS URL (defaults to `<issuer>/.well-known/jwks.json`) |
| `REQUIRED_SCOPES`      | `mcp:tools`   | Comma-separated scopes every token must contain         |
| `OAUTH_AUDIENCE`       | —             | Required `aud` claim (your API identifier); empty = skip |
| `HOST`                 | `0.0.0.0`     | Bind address                                            |
| `PORT`                 | `8080`        | HTTP port                                               |
| `RATE_LIMIT_PER_MINUTE`| `60`          | Max requests per minute per token subject               |
| `JWKS_CACHE_TTL`       | `600`         | JWKS key cache TTL in seconds                           |

## How auth works

1. Client sends `Authorization: Bearer <JWT>` on every request to `/mcp`.
2. `OAuthAuthMiddleware` extracts the token and calls `JwksValidator.validate`.
3. The validator resolves the signing key from the JWKS (cached), verifies signature, `iss`, `aud` (if set), and `exp`.
4. Required scopes are checked against the token's `scope` (or `scp` for Auth0).
5. The rate limiter checks the token subject's sliding window.
6. On success, claims are stored in a `ContextVar` and `scope["state"]`; tools read them via `get_current_claims()`.
7. On failure, a JSON error (`401`/`403`/`429`) is returned with a `WWW-Authenticate` header.

`/health` is exempt from authentication for liveness probes.

## Project structure

```
07-oauth-protected-server/
├── src/
│   ├── server.py              # Entry point — builds Starlette app with auth middleware
│   ├── lib/
│   │   ├── logger.py          # Structured stderr logger
│   │   ├── errors.py          # ToolError + response helpers
│   │   ├── config.py          # Env-driven configuration
│   │   ├── auth.py            # JWKS validation + introspection cache
│   │   ├── rate_limiter.py    # Per-token sliding-window limiter
│   │   └── middleware.py      # ASGI OAuth middleware + ContextVar claims
│   └── tools/
│       ├── whoami.py
│       └── resources.py
├── tests/
│   └── test_tools.py          # JWT + rate-limiter + scope tests
├── pyproject.toml
├── Dockerfile
├── .env.example
└── README.md
```

## Testing

```bash
pip install -e ".[dev]"
pytest
```

Tests generate a local RSA key pair and exercise token validation, scope enforcement, expiry, audience, and rate limiting — no live JWKS endpoint required.

## Docker

```bash
docker build -t oauth-protected-server .
docker run -p 8080:8080 -e OAUTH_ISSUER=https://your-issuer/ -e REQUIRED_SCOPES=mcp:tools oauth-protected-server
```

## Deployment notes

- **TLS**: terminate TLS at a reverse proxy (nginx, Caddy, App Gateway). The server listens on plain HTTP.
- **Multi-process rate limiting**: the in-memory limiter is per-process. For >1 worker, back it with Redis.
- **JWKS rotation**: the PyJWKClient caches keys for `JWKS_CACHE_TTL` seconds; rotate issuer keys with overlap to avoid validation gaps.
- **Audience**: always set `OAUTH_AUDIENCE` in production so tokens minted for other APIs are rejected.
