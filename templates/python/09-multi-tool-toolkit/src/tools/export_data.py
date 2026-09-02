"""``export_data`` tool — serialize session state to a file.

Demonstrates tool composition: consumes analyses and reports produced by
``run_analysis`` and ``generate_report`` (stored in shared session state)
and writes them to disk in JSON or markdown format.
"""

import json
import os
from typing import Annotated, Literal

from mcp.server.fastmcp import FastMCP
from pydantic import Field

from ..lib.config import config
from ..lib.errors import ToolError
from ..lib.logger import logger
from ..lib.state import store


def register(mcp: FastMCP) -> None:
    """Register the export_data tool."""

    @mcp.tool()
    async def export_data(
        format: Annotated[
            Literal["json", "markdown"],
            Field(description="Export format: 'json' (full session) or 'markdown' (reports)"),
        ],
        session_id: Annotated[
            str | None, Field(default=None, description="Optional session id")
        ] = None,
        filename: Annotated[
            str | None,
            Field(default=None, description="Optional output filename. Defaults to session-based name."),
        ] = None,
    ) -> str:
        """Export the current session's analyses and reports to a file.

        ``json`` exports the full session (context, analyses, reports).
        ``markdown`` exports rendered reports. Files are written to
        ``EXPORT_DIR``.
        """
        state = store.get(session_id)

        if format == "markdown":
            if not state.reports:
                raise ToolError("NO_REPORTS", "no reports to export — run generate_report first")
            content = "\n\n---\n\n".join(report.render() for report in state.reports)
            ext = "md"
        else:
            content = json.dumps(
                {
                    "session": state.session_id,
                    "context": state.context,
                    "analyses": [
                        {"name": a.name, "summary": a.summary, "metrics": a.metrics}
                        for a in state.analyses
                    ],
                    "reports": [
                        {"title": r.title, "sections": r.sections} for r in state.reports
                    ],
                },
                indent=2,
            )
            ext = "json"

        os.makedirs(config.export_dir, exist_ok=True)
        fname = filename or f"export_{state.session_id}.{ext}"
        path = os.path.join(config.export_dir, fname)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(content)

        export_record = {"format": format, "path": path, "bytes": len(content.encode("utf-8"))}
        store.add_export(session_id, export_record)
        logger.info("exported session", {"path": path, "format": format})

        return json.dumps(
            {"exported": True, "path": path, "format": format, "bytes": export_record["bytes"]},
            indent=2,
        )
