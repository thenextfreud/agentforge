"""``get_context`` tool — read shared session context."""

import json
from typing import Annotated

from mcp.server.fastmcp import FastMCP
from pydantic import Field

from ..lib.state import store


def register(mcp: FastMCP) -> None:
    """Register the get_context tool."""

    @mcp.tool()
    async def get_context(
        key: Annotated[
            str | None,
            Field(default=None, description="Optional key to fetch. Omit to return the entire context."),
        ] = None,
        session_id: Annotated[
            str | None,
            Field(default=None, description="Optional session id. Defaults to the shared session."),
        ] = None,
    ) -> str:
        """Read shared session context.

        Pass a ``key`` to fetch a single value, or omit it to return the
        entire context map for the session.
        """
        state = store.get(session_id)
        if key is not None:
            value = state.context.get(key)
            if value is None:
                return f"Context key '{key}' is not set (session={state.session_id})."
            return json.dumps({"key": key, "value": value, "session": state.session_id}, indent=2)
        return json.dumps(
            {"context": state.context, "session": state.session_id, "item_count": len(state.context)},
            indent=2,
        )
