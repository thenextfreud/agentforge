"""``generate_report`` tool — compose a report from session analyses.

Demonstrates tool composition: consumes :class:`AnalysisResult` objects
produced by ``run_analysis`` (stored in shared session state) and builds
a :class:`Report`, which ``export_data`` can later serialize.
"""

import json
from typing import Annotated

from mcp.server.fastmcp import FastMCP
from pydantic import Field

from ..lib.errors import ToolError
from ..lib.state import Report, store


def register(mcp: FastMCP) -> None:
    """Register the generate_report tool."""

    @mcp.tool()
    async def generate_report(
        title: Annotated[str, Field(description="Report title")],
        session_id: Annotated[
            str | None, Field(default=None, description="Optional session id")
        ] = None,
    ) -> str:
        """Generate a markdown report from all analyses in the current session.

        Pulls every :class:`AnalysisResult` stored by ``run_analysis`` and
        renders them into sections. The report is stored in the session so
        ``export_data`` can serialize it.
        """
        state = store.get(session_id)
        if not state.analyses:
            raise ToolError(
                "NO_ANALYSES",
                "no analyses found — run run_analysis first to produce data for the report",
            )

        sections: list[dict] = [
            {
                "heading": "Overview",
                "body": f"This report covers {len(state.analyses)} analysis(es) for session '{state.session_id}'.",
            }
        ]
        for analysis in state.analyses:
            body_lines = [analysis.summary, "", "Metrics:"]
            for k, v in analysis.metrics.items():
                body_lines.append(f"- **{k}**: {v:.4f}" if isinstance(v, float) else f"- **{k}**: {v}")
            sections.append({"heading": analysis.name, "body": "\n".join(body_lines)})

        report = Report(title=title, sections=sections)
        store.add_report(session_id, report)

        return json.dumps(
            {
                "title": title,
                "session": state.session_id,
                "sections": len(sections),
                "analyses_included": len(state.analyses),
                "preview": report.render()[:500],
            },
            indent=2,
        )
