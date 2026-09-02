"""Structured logger that writes to stderr.

For HTTP transports (streamable-http, SSE) stdout is not strictly reserved
for JSON-RPC, but writing logs to stderr remains the safe, transport-
agnostic convention.
"""

from __future__ import annotations

import json
import sys
from datetime import UTC, datetime
from typing import Any


def _log(level: str, message: str, meta: dict[str, Any] | None = None) -> None:
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
