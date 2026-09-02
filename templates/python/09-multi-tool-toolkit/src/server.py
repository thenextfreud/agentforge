"""MCP Server — Multi-Tool Toolkit (stdio transport)

A modular multi-tool MCP server with shared state. Demonstrates:

- **Modular tool registration** — each tool lives in its own file under
  ``src/tools/`` and registers itself via a ``register(mcp)`` function.
- **Shared session state** — multiple tools read/write a common
  :class:`SessionState` (context, analyses, reports, exports) keyed by
  session id, so tools work together across calls.
- **Tool composition** — tools consume state produced by other tools
  (``run_analysis`` reads context from ``set_context``; ``generate_report``
  consumes analyses; ``export_data`` serializes reports).
- Pydantic input validation + structured stderr logging.

Built with FastMCP.
"""

from __future__ import annotations

from mcp.server.fastmcp import FastMCP

from .lib.logger import logger
from .tools import (
    export_data,
    generate_report,
    get_context,
    run_analysis,
    set_context,
)

mcp = FastMCP(
    name="multi-tool-toolkit",
    instructions=(
        "A multi-tool toolkit with shared session state. Typical flow: "
        "set_context to store values, run_analysis to compute statistics, "
        "generate_report to compose a report, export_data to save it. "
        "get_context reads the current context. Pass a session_id to "
        "isolate state between users."
    ),
)

# Register each tool module.
set_context.register(mcp)
get_context.register(mcp)
run_analysis.register(mcp)
generate_report.register(mcp)
export_data.register(mcp)


def main() -> None:
    logger.info(
        "MCP server starting",
        {"name": "multi-tool-toolkit", "version": "1.0.0"},
    )
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
