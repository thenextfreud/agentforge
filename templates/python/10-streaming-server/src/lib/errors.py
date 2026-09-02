"""Error handling utilities for MCP tool responses.

Tools raise :class:`ToolError` to produce MCP ``isError`` responses.
"""

from __future__ import annotations

from typing import Any

from mcp.types import TextContent


class ToolError(Exception):
    """Structured tool error with a code and message."""

    def __init__(self, code: str, message: str, details: Any | None = None) -> None:
        self.code = code
        self.message = message
        self.details = details
        super().__init__(f"Error [{code}]: {message}")


def success(text: str) -> list[TextContent]:
    return [TextContent(type="text", text=text)]


def failure(code: str, message: str, details: Any | None = None) -> list[TextContent]:
    return [TextContent(type="text", text=f"Error [{code}]: {message}")]
