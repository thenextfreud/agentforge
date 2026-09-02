"""``verify_webhook`` tool — verify a SaaS webhook signature."""

import json
from typing import Annotated

from mcp.server.fastmcp import FastMCP
from pydantic import Field

from ..lib.errors import ToolError
from ..lib.webhooks import WebhookVerificationError, verify_webhook


def register(mcp: FastMCP) -> None:
    """Register the verify_webhook tool on the FastMCP server."""

    @mcp.tool()
    async def verify_webhook(
        body: Annotated[str, Field(description="The raw webhook request body (exact bytes as received)")],
        signature: Annotated[
            str,
            Field(description="The value of the X-Webhook-Signature header"),
        ],
    ) -> str:
        """Verify a webhook's HMAC-SHA256 signature against WEBHOOK_SECRET.

        Pass the raw request body (not re-serialized JSON) and the signature
        header value. Returns the parsed payload on success.
        """
        try:
            verify_webhook(body.encode("utf-8"), signature)
        except WebhookVerificationError as err:
            raise ToolError(err.code, err.message) from err
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            payload = body
        return json.dumps({"verified": True, "payload": payload}, indent=2)
