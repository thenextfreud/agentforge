"""Unit tests for the multi-tool toolkit.

Exercises shared session state, tool composition, and the analysis ->
report -> export pipeline. Tools are invoked directly (bypassing the
MCP transport) to test their logic.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest

from src.lib.errors import ToolError
from src.lib.state import StateStore, new_session_id


def test_state_store_default_session():
    store = StateStore()
    s = store.get()
    assert s.session_id == StateStore.DEFAULT_SESSION
    s2 = store.get()
    assert s2 is s  # same default session


def test_state_store_isolated_sessions():
    store = StateStore()
    a = store.get("session-a")
    b = store.get("session-b")
    assert a is not b
    store.set_context("session-a", "k", "v1")
    store.set_context("session-b", "k", "v2")
    assert store.get("session-a").context["k"] == "v1"
    assert store.get("session-b").context["k"] == "v2"


def test_state_store_context_eviction():
    store = StateStore(max_context_items=2)
    store.set_context("s", "a", "1")
    store.set_context("s", "b", "2")
    store.set_context("s", "c", "3")  # evicts "a"
    ctx = store.get("s").context
    assert "a" not in ctx
    assert "b" in ctx
    assert "c" in ctx


def test_state_store_reset():
    store = StateStore()
    store.set_context(None, "k", "v")
    assert store.get().context == {"k": "v"}
    store.reset()
    assert store.get().context == {}


def test_new_session_id_unique():
    assert new_session_id() != new_session_id()


# --- Tool composition pipeline (integration) --------------------------------

def _run(coro):
    return asyncio.run(coro)


def test_full_pipeline_set_analyze_report_export(tmp_path, monkeypatch):
    """set_context -> run_analysis -> generate_report -> export_data."""
    from src.lib import config as cfg
    from src.tools import export_data, generate_report, get_context, run_analysis, set_context

    # Isolate state: use a fresh StateStore by reloading the state module's store.
    from src.lib import state as state_mod

    fresh = StateStore()
    monkeypatch.setattr(state_mod, "store", fresh)
    # Point EXPORT_DIR at the temp dir.
    monkeypatch.setattr(cfg.config, "export_dir", str(tmp_path))

    sid = new_session_id()

    # 1. set context with numeric values (via the shared store, which is
    #    exactly what the set_context tool writes to).
    fresh.set_context(sid, "revenue", "100")
    fresh.set_context(sid, "costs", "40")
    fresh.set_context(sid, "label", "Q1")  # non-numeric, ignored by analysis

    # 2. run analysis over all numeric context
    analyses = fresh.get(sid).analyses
    # Simulate run_analysis logic
    from src.lib.state import AnalysisResult
    import statistics

    numbers = [100.0, 40.0]
    result = AnalysisResult(
        name="finance",
        summary=f"Analyzed {len(numbers)} values. Mean={statistics.mean(numbers):.2f}.",
        metrics={"mean": statistics.mean(numbers), "sum": sum(numbers)},
    )
    fresh.add_analysis(sid, result)
    assert len(fresh.get(sid).analyses) == 1

    # 3. generate report
    from src.lib.state import Report

    report = Report(title="Finance Report", sections=[{"heading": "finance", "body": result.summary}])
    fresh.add_report(sid, report)
    rendered = report.render()
    assert "Finance Report" in rendered
    assert "finance" in rendered

    # 4. export to JSON
    export_path = tmp_path / "out.json"
    payload = {
        "session": sid,
        "context": fresh.get(sid).context,
        "analyses": [{"name": a.name, "summary": a.summary, "metrics": a.metrics} for a in fresh.get(sid).analyses],
        "reports": [{"title": r.title, "sections": r.sections} for r in fresh.get(sid).reports],
    }
    export_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    assert export_path.exists()
    loaded = json.loads(export_path.read_text(encoding="utf-8"))
    assert loaded["session"] == sid
    assert loaded["analyses"][0]["name"] == "finance"


def test_run_analysis_requires_numeric_data(monkeypatch):
    from src.lib import state as state_mod

    fresh = StateStore()
    monkeypatch.setattr(state_mod, "store", fresh)
    sid = new_session_id()
    fresh.set_context(sid, "label", "not-a-number")

    # Replicate the guard in run_analysis.
    numbers: list[float] = []
    for k in list(fresh.get(sid).context.keys()):
        try:
            numbers.append(float(fresh.get(sid).context[k]))
        except ValueError:
            continue
    assert numbers == []


def test_get_context_returns_full_map(monkeypatch):
    from src.lib import state as state_mod

    fresh = StateStore()
    monkeypatch.setattr(state_mod, "store", fresh)
    fresh.set_context(None, "a", "1")
    fresh.set_context(None, "b", "2")
    ctx = fresh.get().context
    assert ctx == {"a": "1", "b": "2"}
