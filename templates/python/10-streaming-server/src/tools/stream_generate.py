"""``stream_generate`` tool — generate a sequence of tokens with progress."""

import json
from typing import Annotated

from mcp.server.fastmcp import Context, FastMCP
from pydantic import Field

from ..lib.errors import ToolError
from ..lib.streaming import track_progress


def register(mcp: FastMCP) -> None:
    """Register the stream_generate tool."""

    @mcp.tool()
    async def stream_generate(
        prompt: Annotated[str, Field(description="The prompt to generate a response for")],
        max_tokens: Annotated[
            int,
            Field(default=20, ge=1, le=200, description="Maximum number of tokens to generate"),
        ] = 20,
        ctx: Context | None = None,
    ) -> str:
        """Generate a token sequence for the prompt, reporting progress per token.

        This is a *simulated* generator (no real LLM) that emits one
        pseudo-token per step and reports progress. Swap the body for a
        real streaming LLM call (e.g. an OpenAI stream) to ship it.
        """
        if not prompt or not prompt.strip():
            raise ToolError("INVALID_INPUT", "prompt must not be empty")

        tokens: list[str] = []
        # Pseudo-generation: split the prompt into words and echo them back
        # with light transformation, capped at max_tokens.
        words = prompt.split()

        async for step in track_progress(
            max_tokens,
            ctx.report_progress if ctx is not None else None,
            step_label="generating",
            sleep_per_step=0.03,
        ):
            idx = (step - 1) % max(len(words), 1)
            token = words[idx]
            tokens.append(token)
            if ctx is not None:
                await ctx.info(f"generated token {step}/{max_tokens}: {token}")

        return json.dumps(
            {"prompt": prompt, "tokens": tokens, "count": len(tokens)}, indent=2
        )
