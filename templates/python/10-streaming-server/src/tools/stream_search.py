"""``stream_search`` tool — simulated streaming search with progress."""

import asyncio
import json
from typing import Annotated

from mcp.server.fastmcp import Context, FastMCP
from pydantic import Field

from ..lib.errors import ToolError
from ..lib.streaming import track_progress

# A tiny in-memory "corpus" to search over.
_CORPUS: list[dict[str, str]] = [
    {"id": "1", "title": "Streamable HTTP transport", "body": "The streamable HTTP transport..."},
    {"id": "2", "title": "SSE basics", "body": "Server-Sent Events let a server push..."},
    {"id": "3", "title": "Progress reporting", "body": "Tools report progress via the MCP context..."},
    {"id": "4", "title": "Cancellation", "body": "Long operations can be cancelled mid-flight..."},
    {"id": "5", "title": "Connection management", "body": "A connection manager caps active sessions..."},
]


def register(mcp: FastMCP) -> None:
    """Register the stream_search tool."""

    @mcp.tool()
    async def stream_search(
        query: Annotated[str, Field(description="The search query")],
        ctx: Context,
    ) -> str:
        """Search the corpus, reporting progress as each result is evaluated.

        Demonstrates progress reporting via the MCP context. The client
        receives progress notifications while the tool runs.
        """
        if not query or not query.strip():
            raise ToolError("INVALID_INPUT", "query must not be empty")

        query_lower = query.lower()
        matches: list[dict[str, str]] = []

        async for step in track_progress(
            len(_CORPUS),
            ctx.report_progress,
            step_label="searching",
            sleep_per_step=0.02,
        ):
            item = _CORPUS[step - 1]
            if query_lower in item["title"].lower() or query_lower in item["body"].lower():
                matches.append(item)
                await ctx.info(f"match found: {item['title']}")

        return json.dumps(
            {"query": query, "matches": matches, "count": len(matches)}, indent=2
        )
