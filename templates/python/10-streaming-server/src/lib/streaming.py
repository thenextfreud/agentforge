"""SSE / streaming utilities for the streaming MCP server.

Provides:

* :class:`ConnectionManager` — tracks active connections and enforces a
  ``MAX_CONNECTIONS`` cap, so a runaway client can't exhaust the server.
* :func:`track_progress` — a helper that reports progress through the MCP
  ``Context`` while yielding intermediate results, enabling cancellation
  via ``anyio`` cancellation points.
* :func:`format_sse` — formats a Server-Sent Event frame (used by custom
  SSE endpoints if you need them alongside the MCP streamable transport).

The MCP Streamable HTTP transport itself handles SSE framing for tool
results; these utilities add connection management and progress reporting
on top.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

from anyio import CancelScope

from .config import config
from .logger import logger


@dataclass
class ConnectionInfo:
    connection_id: str
    created_at: float = field(default_factory=lambda: asyncio.get_event_loop().time())


class ConnectionManager:
    """Tracks active connections with a configurable max cap."""

    def __init__(self, max_connections: int = 100) -> None:
        self._max = max_connections
        self._connections: dict[str, ConnectionInfo] = {}
        self._lock = asyncio.Lock()

    async def add(self, connection_id: str) -> bool:
        async with self._lock:
            if len(self._connections) >= self._max:
                logger.warn("connection limit reached", {"active": len(self._connections), "max": self._max})
                return False
            self._connections[connection_id] = ConnectionInfo(connection_id=connection_id)
            logger.info("connection opened", {"connection_id": connection_id, "active": len(self._connections)})
            return True

    async def remove(self, connection_id: str) -> None:
        async with self._lock:
            removed = self._connections.pop(connection_id, None)
            if removed:
                logger.info("connection closed", {"connection_id": connection_id, "active": len(self._connections)})

    async def count(self) -> int:
        async with self._lock:
            return len(self._connections)


# Module-level singleton.
connection_manager = ConnectionManager(max_connections=config.max_connections)


async def track_progress(
    total_steps: int,
    report_progress: Any,
    *,
    step_label: str = "step",
    sleep_per_step: float = 0.05,
) -> AsyncIterator[int]:
    """Yield step indices while reporting progress to the MCP client.

    ``report_progress`` is FastMCP's ``ctx.report_progress`` callable
    (or any ``async (progress, total, message) -> None``). Each step is
    an ``anyio`` cancellation point, so a cancelled request aborts the
    loop promptly.
    """
    import anyio

    for step in range(1, total_steps + 1):
        # Cancellation point — if the client cancels, this raises.
        await anyio.sleep(sleep_per_step)
        if report_progress is not None:
            try:
                await report_progress(step, total_steps, f"{step_label} {step}/{total_steps}")
            except TypeError:
                # report_progress may be a sync callable in some contexts.
                report_progress(step, total_steps, f"{step_label} {step}/{total_steps}")
        yield step


def format_sse(event: str, data: str, id: int | None = None) -> str:
    """Format a Server-Sent Event frame.

    Used by custom SSE endpoints you might add alongside the MCP
    streamable transport (e.g. a public event feed).
    """
    lines: list[str] = []
    if id is not None:
        lines.append(f"id: {id}")
    lines.append(f"event: {event}")
    # Multi-line data must be split across `data:` lines per the SSE spec.
    for line in data.splitlines() or [""]:
        lines.append(f"data: {line}")
    lines.append("")
    lines.append("")
    return "\n".join(lines)


def is_cancelled(scope: CancelScope) -> bool:
    """Check whether a cancel scope has been cancelled."""
    return scope.cancel_called or scope.cancelled_caught
