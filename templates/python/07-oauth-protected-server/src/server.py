"""MCP Server — OAuth-Protected Server (Streamable HTTP transport)

A remote MCP server gated by OAuth 2.0 via JWKS validation. Demonstrates:
- Streamable HTTP transport (for web deployments, not stdio)
- JWT bearer-token validation against a JWKS endpoint (Auth0, Okta, Clerk, Cognito)
- Scope-based authorization
- Per-token sliding-window rate limiting
- Token introspection caching
- Pydantic input validation
- Structured stderr logging
"""

from __future__ import annotations

import json

from mcp.server.fastmcp import FastMCP
from starlette.requests import Request
from starlette.responses import JSONResponse

from .lib.auth import get_validator
from .lib.config import config
from .lib.logger import logger
from .lib.middleware import OAuthAuthMiddleware
from .lib.rate_limiter import RateLimiter
from .tools import resources, whoami

mcp = FastMCP(
    name="oauth-protected-server",
    instructions=(
        "OAuth-protected MCP server. All tools require a valid bearer token "
        "with the configured scopes. Use whoami to inspect the current principal."
    ),
    host=config.host,
    port=config.port,
    streamable_http_path="/mcp",
)

# Register tools
whoami.register(mcp)
resources.register(mcp)


# --- Health check (exempt from auth) -----------------------------------------
@mcp.custom_route("/health", methods=["GET"])
async def health_check(request: Request) -> JSONResponse:
    return JSONResponse({"status": "ok", "service": "oauth-protected-server"})


def build_app():
    """Build the Starlette ASGI app with OAuth middleware wrapping the MCP app."""
    base_app = mcp.streamable_http_app()
    validator = get_validator()
    rate_limiter = RateLimiter(max_per_minute=config.rate_limit_per_minute)
    return OAuthAuthMiddleware(base_app, validator, rate_limiter)


def main() -> None:
    import uvicorn

    logger.info(
        "MCP server starting (streamable-http)",
        {
            "name": "oauth-protected-server",
            "version": "1.0.0",
            "host": config.host,
            "port": config.port,
            "issuer": config.oauth_issuer or "(none)",
            "jwks_url": config.jwks_url_resolved,
            "required_scopes": config.required_scopes,
            "rate_limit_per_minute": config.rate_limit_per_minute,
        },
    )
    app = build_app()
    uvicorn.run(app, host=config.host, port=config.port, log_level="info")


if __name__ == "__main__":
    main()
