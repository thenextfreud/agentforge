"""Shared session state for the multi-tool toolkit.

This is the key pattern this template demonstrates: multiple tools share
state across calls within a logical session. A :class:`SessionState`
holds a key/value context, an analysis history, and generated reports.

State is keyed by ``session_id``. When a tool is invoked without a
session id, a default shared session is used so the tools work out of
the box for a single user. Pass an explicit ``session_id`` to isolate
state between users/agents.

This is an in-memory store. For multi-process deployments, back it with
Redis or a database.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from threading import Lock

from .config import config
from .logger import logger


@dataclass
class AnalysisResult:
    name: str
    summary: str
    metrics: dict[str, float] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)


@dataclass
class Report:
    title: str
    sections: list[dict] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)

    def render(self) -> str:
        lines = [f"# {self.title}", ""]
        for section in self.sections:
            lines.append(f"## {section.get('heading', 'Section')}")
            lines.append("")
            lines.append(str(section.get("body", "")))
            lines.append("")
        return "\n".join(lines)


@dataclass
class SessionState:
    session_id: str
    context: dict[str, str] = field(default_factory=dict)
    analyses: list[AnalysisResult] = field(default_factory=list)
    reports: list[Report] = field(default_factory=list)
    exports: list[dict] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    last_accessed: float = field(default_factory=time.time)

    def touch(self) -> None:
        self.last_accessed = time.time()


class StateStore:
    """Thread-safe in-memory store of :class:`SessionState` keyed by id."""

    DEFAULT_SESSION = "default"

    def __init__(self, session_ttl: int = 3600, max_context_items: int = 100) -> None:
        self._sessions: dict[str, SessionState] = {}
        self._lock = Lock()
        self._session_ttl = session_ttl
        self._max_context_items = max_context_items

    def _purge_expired(self) -> None:
        now = time.time()
        expired = [
            sid for sid, s in self._sessions.items()
            if sid != self.DEFAULT_SESSION and now - s.last_accessed > self._session_ttl
        ]
        for sid in expired:
            self._sessions.pop(sid, None)

    def get(self, session_id: str | None = None) -> SessionState:
        sid = session_id or self.DEFAULT_SESSION
        with self._lock:
            self._purge_expired()
            state = self._sessions.get(sid)
            if state is None:
                state = SessionState(session_id=sid)
                self._sessions[sid] = state
                logger.info("created session", {"session_id": sid})
            state.touch()
            return state

    def reset(self, session_id: str | None = None) -> str:
        sid = session_id or self.DEFAULT_SESSION
        with self._lock:
            self._sessions.pop(sid, None)
        logger.info("reset session", {"session_id": sid})
        return sid

    def set_context(self, session_id: str | None, key: str, value: str) -> None:
        state = self.get(session_id)
        with self._lock:
            if len(state.context) >= self._max_context_items and key not in state.context:
                # Evict the oldest insertion-order key (dict preserves order).
                oldest = next(iter(state.context))
                state.context.pop(oldest)
            state.context[key] = value

    def get_context_value(self, session_id: str | None, key: str) -> str | None:
        return self.get(session_id).context.get(key)

    def add_analysis(self, session_id: str | None, result: AnalysisResult) -> None:
        self.get(session_id).analyses.append(result)

    def add_report(self, session_id: str | None, report: Report) -> None:
        self.get(session_id).reports.append(report)

    def add_export(self, session_id: str | None, export: dict) -> None:
        self.get(session_id).exports.append(export)

    def list_sessions(self) -> list[str]:
        with self._lock:
            return list(self._sessions.keys())


# Module-level singleton shared by all tools.
store = StateStore(session_ttl=config.session_ttl, max_context_items=config.max_context_items)


def new_session_id() -> str:
    return uuid.uuid4().hex
