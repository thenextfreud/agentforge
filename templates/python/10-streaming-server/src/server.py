"""MCP Server — Streaming Server (Streamable HTTP / SSE transport)

An MCP server for web deployments using the Streamable HTTP transport.
Demonstrates:

- **Streamable HTTP transport** — deploy as a web service (not stdio).
- **Progress reporting** — long tools report progress via the MCP context.
- **Cancellation support** — long operations abort promptly when cancelled.
- **Connection management** — a ``ConnectionManager`` caps active connections.
- **CORS** — configurable allowed origins for browser-based clients.
- Pydantic input validation + structured stderr logging.

Built with FastMCP, Starlette, and uvicorn.
"""

from __future__ import annotations

import json
import uuid

from mcp.server.fastmcp import FastMCP
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from .lib.config import config
from .lib.logger import logger
from .lib.streaming import connection_manager
from .tools import long_running_task, stream_generate, stream_search

mcp = FastMCP(
    name="streaming-server",
    instructions=(
        "Streaming MCP server over Streamable HTTP. Tools report progress "
        "for long operations and support cancellation. Use stream_search "
        "for a progress-reporting search, stream_generate for token-by-token "
        "generation, and long_running_task for a cancellable long operation."
    ),
    host=config.host,
    port=config.port,
    streamable_http_path="/mcp",
    # Streamable HTTP supports both SSE streaming and JSON responses.
    json_response=False,
)

# Register tools
stream_search.register(mcp)
stream_generate.register(mcp)
long_running_task.register(mcp)


# --- Health + connection info endpoints (no auth) ---------------------------
@mcp.custom_route("/health", methods=["GET"])
async def health_check(request: Request) -> JSONResponse:
    return JSONResponse({"status": "ok", "service": "streaming-server"})


@mcp.custom_route("/connections", methods=["GET"])
async def connections_info(request: Request) -> JSONResponse:
    count = await connection_manager.count()
    return JSONResponse({"active_connections": count, "max": config.max_connections})


def build_app():
    """Build the Starlette ASGI app with CORS middleware + connection tracking.

    Wraps the FastMCP streamable HTTP app with:
    - CORS middleware (configurable origins)
    - connection tracking middleware that enforces MAX_CONNECTIONS
    """
    base_app = mcp.streamable_http_app()

    # Add CORS middleware by reconstructing the Starlette app's middleware stack.
    cors = CORSMiddleware(
        base_app,
        allow_origins=config.cors_origins,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["Mcp-Session-Id"],
    )

    async def connection_scope_middleware(scope, receive, send):
        if scope["type"] not in ("http", "websocket"):
            await cors(scope, receive, send)
            return
        path = scope.get("path", "")
        # Skip connection accounting for trivial endpoints.
        if path in ("/health", "/connections"):
            await cors(scope, receive, send)
            return
        connection_id = uuid.uuid4().hex
        accepted = await connection_manager.add(connection_id)
        if not accepted:
            response = JSONResponse(
                {"error": "MAX_CONNECTIONS", "message": "server is at max connections"},
                status_code=503,
            )
            await response(scope, receive, send)
            return
        try:
            await cors(scope, receive, send)
        finally:
            await connection_manager.remove(connection_id)

    return connection_scope_middleware


def main() -> None:
    import uvicorn

    logger.info(
        "MCP server starting (streamable-http)",
        {
            "name": "streaming-server",
            "version": "1.0.0",
            "host": config.host,
            "port": config.port,
            "cors_origins": config.cors_origins,
            "max_connections": config.max_connections,
        },
    )
    app = build_app()
    uvicorn.run(app, host=config.host, port=config.port, log_level="info")


if __name__ == "__main__":
    main()
