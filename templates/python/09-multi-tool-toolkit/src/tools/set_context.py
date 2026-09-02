"""``set_context`` tool — store a key/value pair in shared session state."""

from typing import Annotated

from mcp.server.fastmcp import FastMCP
from pydantic import Field

from ..lib.errors import ToolError
from ..lib.state import store


def register(mcp: FastMCP) -> None:
    """Register the set_context tool."""

    @mcp.tool()
    async def set_context(
        key: Annotated[str, Field(description="Context key to set")],
        value: Annotated[str, Field(description="Context value to store")],
        session_id: Annotated[
            str | None,
            Field(default=None, description="Optional session id. Defaults to a shared session."),
        ] = None,
    ) -> str:
        """Store a key/value pair in shared session context.

        Subsequent tool calls in the same session can read this context.
        Use this to share configuration, parameters, or intermediate
        results across tools without passing them through every call.
        """
        if not key:
            raise ToolError("INVALID_INPUT", "key must not be empty")
        store.set_context(session_id, key, value)
        sid = session_id or store.DEFAULT_SESSION
        return f"Set context '{key}' (session={sid})."
