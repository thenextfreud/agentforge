"""``long_running_task`` tool — a long operation with progress + cancellation."""

import asyncio
import json
from typing import Annotated

from mcp.server.fastmcp import Context, FastMCP
from pydantic import Field

from ..lib.config import config
from ..lib.errors import ToolError
from ..lib.streaming import track_progress


def register(mcp: FastMCP) -> None:
    """Register the long_running_task tool."""

    @mcp.tool()
    async def long_running_task(
        task_name: Annotated[str, Field(description="A name for the task")],
        steps: Annotated[
            int,
            Field(default=20, ge=1, le=1000, description="Number of steps to perform"),
        ] = 20,
        ctx: Context | None = None,
    ) -> str:
        """Run a long-running task that reports progress and supports cancellation.

        Each step is a cancellation point: if the client cancels the
        request, the task aborts promptly. Use this as a template for
        real long operations (batch processing, indexing, etc.).
        """
        if not task_name or not task_name.strip():
            raise ToolError("INVALID_INPUT", "task_name must not be empty")

        completed = 0
        try:
            async for step in track_progress(
                steps,
                ctx.report_progress if ctx is not None else None,
                step_label=task_name,
                sleep_per_step=0.05,
            ):
                completed = step
                if ctx is not None and step % max(1, steps // 5) == 0:
                    await ctx.info(f"{task_name}: {step}/{steps} done")
        except asyncio.CancelledError:
            # Re-raise so the transport signals cancellation to the client.
            raise

        return json.dumps(
            {
                "task": task_name,
                "steps_requested": steps,
                "steps_completed": completed,
                "status": "completed",
            },
            indent=2,
        )
