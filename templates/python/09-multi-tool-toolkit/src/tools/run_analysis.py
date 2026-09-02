"""``run_analysis`` tool — analyze the current session context.

Demonstrates tool composition: this tool reads context set by
``set_context`` and produces an :class:`AnalysisResult` stored in the
shared session, which ``generate_report`` and ``export_data`` can later
consume.
"""

import json
import statistics
from typing import Annotated

from mcp.server.fastmcp import FastMCP
from pydantic import Field

from ..lib.errors import ToolError
from ..lib.state import AnalysisResult, store


def _try_numbers(values: list[str]) -> list[float]:
    out: list[float] = []
    for v in values:
        try:
            out.append(float(v))
        except ValueError:
            continue
    return out


def register(mcp: FastMCP) -> None:
    """Register the run_analysis tool."""

    @mcp.tool()
    async def run_analysis(
        name: Annotated[str, Field(description="A name for this analysis")],
        keys: Annotated[
            list[str] | None,
            Field(default=None, description="Optional context keys whose numeric values to analyze. Defaults to all numeric values."),
        ] = None,
        session_id: Annotated[
            str | None, Field(default=None, description="Optional session id")
        ] = None,
    ) -> str:
        """Run a statistical analysis over numeric values in the session context.

        Reads context values (set via ``set_context``), extracts numbers,
        computes summary statistics, and stores the result so other tools
        (``generate_report``, ``export_data``) can use it.
        """
        state = store.get(session_id)
        candidate_keys = keys if keys else list(state.context.keys())
        if not candidate_keys:
            raise ToolError("NO_DATA", "no context keys available — set context with set_context first")

        numbers: list[float] = []
        for k in candidate_keys:
            raw = state.context.get(k)
            if raw is None:
                continue
            numbers.extend(_try_numbers([raw]))

        if not numbers:
            raise ToolError("NO_NUMERIC_DATA", f"no numeric values found in keys {candidate_keys}")

        metrics = {
            "count": float(len(numbers)),
            "sum": sum(numbers),
            "mean": statistics.mean(numbers),
            "median": statistics.median(numbers),
            "min": min(numbers),
            "max": max(numbers),
            "stdev": statistics.pstdev(numbers) if len(numbers) > 1 else 0.0,
        }
        summary = (
            f"Analyzed {len(numbers)} numeric value(s) from {len(candidate_keys)} key(s). "
            f"Mean={metrics['mean']:.4f}, Median={metrics['median']:.4f}, "
            f"Min={metrics['min']:.4f}, Max={metrics['max']:.4f}."
        )
        result = AnalysisResult(name=name, summary=summary, metrics=metrics)
        store.add_analysis(session_id, result)

        return json.dumps(
            {"analysis": name, "summary": summary, "metrics": metrics, "session": state.session_id},
            indent=2,
        )
