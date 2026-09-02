"""Structured logger that writes to stderr.

CRITICAL: MCP servers using stdio transport must NEVER write to stdout.
stdout is reserved for JSON-RPC messages. Any log output to stdout will
corrupt the protocol stream and break the client connection.

This logger writes JSON lines to stderr, which clients capture and display
in their debug/developer consoles.
"""

from __future__ import annotations

import json
import sys
from datetime import UTC, datetime
from typing import Any


LogLevel = str  # "debug" | "info" | "warn" | "error"


def _log(level: LogLevel, message: str, meta: dict[str, Any] | None = None) -> None:
    entry: dict[str, Any] = {
        "level": level,
        "message": message,
        "timestamp": datetime.now(UTC).isoformat(),
    }
    if meta:
        entry.update(meta)
    sys.stderr.write(json.dumps(entry, default=str) + "\n")
    sys.stderr.flush()


class Logger:
    def debug(self, msg: str, meta: dict[str, Any] | None = None) -> None:
        _log("debug", msg, meta)

    def info(self, msg: str, meta: dict[str, Any] | None = None) -> None:
        _log("info", msg, meta)

    def warn(self, msg: str, meta: dict[str, Any] | None = None) -> None:
        _log("warn", msg, meta)

    def error(self, msg: str, meta: dict[str, Any] | None = None) -> None:
        _log("error", msg, meta)


logger = Logger()
