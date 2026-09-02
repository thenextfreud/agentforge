"""Unit tests for the streaming server.

Exercises the SSE formatter, connection manager (with cap enforcement),
and progress-tracking generator (including cancellation).
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.lib.streaming import (
    ConnectionManager,
    format_sse,
    is_cancelled,
    track_progress,
)


def test_format_sse_basic():
    frame = format_sse("progress", "halfway")
    assert "event: progress" in frame
    assert "data: halfway" in frame
    assert frame.endswith("\n\n")


def test_format_sse_with_id():
    frame = format_sse("update", "hello", id=42)
    assert "id: 42" in frame
    assert "event: update" in frame
    assert "data: hello" in frame


def test_format_sse_multiline_data():
    frame = format_sse("log", "line1\nline2")
    assert "data: line1" in frame
    assert "data: line2" in frame


def test_connection_manager_add_remove():
    async def scenario():
        mgr = ConnectionManager(max_connections=3)
        assert await mgr.add("c1") is True
        assert await mgr.add("c2") is True
        assert await mgr.count() == 2
        await mgr.remove("c1")
        assert await mgr.count() == 1

    asyncio.run(scenario())


def test_connection_manager_enforces_cap():
    async def scenario():
        mgr = ConnectionManager(max_connections=2)
        assert await mgr.add("a") is True
        assert await mgr.add("b") is True
        assert await mgr.add("c") is False  # over cap
        assert await mgr.count() == 2

    asyncio.run(scenario())


def test_connection_manager_remove_unknown_is_noop():
    async def scenario():
        mgr = ConnectionManager(max_connections=5)
        await mgr.remove("does-not-exist")  # should not raise
        assert await mgr.count() == 0

    asyncio.run(scenario())


def test_track_progress_yields_all_steps():
    calls: list[tuple[int, int, str]] = []

    async def report(progress, total, message):
        calls.append((progress, total, message))

    async def scenario():
        steps = []
        async for step in track_progress(5, report, sleep_per_step=0.001):
            steps.append(step)
        return steps

    steps = asyncio.run(scenario())
    assert steps == [1, 2, 3, 4, 5]
    assert len(calls) == 5
    assert calls[0] == (1, 5, "step 1/5")


def test_track_progress_with_none_reporter():
    async def scenario():
        steps = []
        async for step in track_progress(3, None, sleep_per_step=0.001):
            steps.append(step)
        return steps

    assert asyncio.run(scenario()) == [1, 2, 3]


def test_track_progress_cancellable():
    """Cancelling the task aborts the progress loop promptly."""
    seen: list[int] = []

    async def runner():
        async for step in track_progress(1000, None, sleep_per_step=0.01):
            seen.append(step)

    async def scenario():
        task = asyncio.create_task(runner())
        await asyncio.sleep(0.05)  # let a few steps run
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    asyncio.run(scenario())
    # Should have aborted well before 1000 steps.
    assert len(seen) < 1000


def test_is_cancelled():
    import anyio

    async def scenario():
        with anyio.CancelScope() as scope:
            assert is_cancelled(scope) is False
            scope.cancel()
            assert is_cancelled(scope) is True

    asyncio.run(scenario())
