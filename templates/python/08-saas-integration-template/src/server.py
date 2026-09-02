"""MCP Server — SaaS Integration Template (stdio transport)

A template for wrapping any SaaS API as an MCP server. Demonstrates the
patterns you reinvent for every SaaS integration:

- OAuth2 **client credentials** flow for server-to-server auth (cached token)
- **Retries** with exponential backoff + ``Retry-After`` header support
- **Pagination** (cursor + page-based) normalized behind one interface
- **Request IDs** propagated into every error for traceability
- **Webhook signature verification** (HMAC-SHA256)
- Generic **CRUD** tools (list/get/create/update/delete)

The concrete example wraps a hypothetical "ProjectManager" SaaS API.
Built with FastMCP, Pydantic, httpx, and structured stderr logging.
"""

from __future__ import annotations

from mcp.server.fastmcp import FastMCP

from .lib.config import config
from .lib.logger import logger
from .tools import crud, webhook_tool

mcp = FastMCP(
    name="saas-integration-template",
    instructions=(
        "SaaS integration template wrapping a ProjectManager API. "
        "Use list_items, get_item, create_item, update_item, delete_item "
        "for CRUD, and verify_webhook to validate incoming webhook signatures."
    ),
)

crud.register(mcp)
webhook_tool.register(mcp)


def main() -> None:
    logger.info(
        "MCP server starting",
        {
            "name": "saas-integration-template",
            "version": "1.0.0",
            "saas_api_url": config.saas_api_url,
            "max_retries": config.max_retries,
        },
    )
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
