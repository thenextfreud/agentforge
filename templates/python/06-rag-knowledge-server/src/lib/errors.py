"""Error handling utilities for MCP tool responses.

MCP tools return content arrays. Errors should be structured so the AI
client can understand and act on them.

FastMCP converts a tool's return value into MCP content automatically:
a string becomes a single text block, and a raised exception becomes an
``isError`` response. This module provides:

* :class:`ToolError` — an exception carrying a structured ``code``/``message``
  pair so error responses are machine-readable.
* :func:`success` / :func:`failure` — helpers that build content lists
  (useful for manual construction and tests).
* :func:`wrap_handler` — wraps an async handler so it returns a list of
  :class:`TextContent` on success and raises :class:`ToolError` on failure.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from mcp.types import TextContent


class ToolError(Exception):
    """Structured tool error with a code and message.

    Raising this from a tool produces an MCP ``isError`` response whose
    text is formatted as ``Error [CODE]: message``.
    """

    def __init__(self, code: str, message: str, details: Any | None = None) -> None:
        self.code = code
        self.message = message
        self.details = details
        super().__init__(f"Error [{code}]: {message}")


def success(text: str) -> list[TextContent]:
    """Build a successful content list containing a single text block."""
    return [TextContent(type="text", text=text)]


def failure(code: str, message: str, details: Any | None = None) -> list[TextContent]:
    """Build an error content list (used for manual responses / tests)."""
    text = f"Error [{code}]: {message}"
    return [TextContent(type="text", text=text)]


def wrap_handler(
    handler: Callable[..., Awaitable[Any]],
) -> Callable[..., Awaitable[list[TextContent]]]:
    """Wrap an async handler so it returns a list of TextContent.

    The wrapped handler may return a string, a list of content blocks, or
    any value coercible to a string. Raised exceptions are converted into
    :class:`ToolError` so the MCP client receives an ``isError`` response.
    """

    async def wrapper(*args: Any, **kwargs: Any) -> list[TextContent]:
        try:
            result = await handler(*args, **kwargs)
        except ToolError:
            raise
        except Exception as err:  # noqa: BLE001 - intentional broad catch
            raise ToolError("TOOL_ERROR", str(err), details=repr(err)) from err

        if isinstance(result, list):
            return result
        if isinstance(result, TextContent):
            return [result]
        return [TextContent(type="text", text=str(result))]

    return wrapper
