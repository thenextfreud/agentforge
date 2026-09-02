"""Generic CRUD tools wrapping the ProjectManager SaaS API.

Tools: ``list_items``, ``get_item``, ``create_item``, ``update_item``,
``delete_item``. These are the patterns you'd reinvent for any SaaS
integration — swap the ``/projects`` path for your resource.
"""

import json
from typing import Annotated

from mcp.server.fastmcp import FastMCP
from pydantic import Field

from ..lib.config import config
from ..lib.errors import ToolError
from ..lib.pagination import collect_all
from ..lib.saas_client import SaaSError, get_client

# The SaaS resource path these tools operate on.
RESOURCE_PATH = "/projects"


def register(mcp: FastMCP) -> None:
    """Register the CRUD tools on the FastMCP server."""

    @mcp.tool()
    async def list_items(
        page_size: Annotated[
            int,
            Field(default=50, ge=1, le=200, description="Number of items per page"),
        ] = 50,
        max_pages: Annotated[
            int,
            Field(default=10, ge=1, le=100, description="Maximum pages to fetch"),
        ] = 10,
    ) -> str:
        """List items (projects) from the SaaS API, paginating automatically."""
        client = get_client()
        try:
            items = await collect_all(
                client, RESOURCE_PATH, page_size=page_size, max_pages=max_pages
            )
        except SaaSError as err:
            raise ToolError(err.code, err.message, details={"request_id": err.request_id}) from err
        return json.dumps({"items": items, "count": len(items)}, indent=2)

    @mcp.tool()
    async def get_item(
        item_id: Annotated[str, Field(description="The id of the item to fetch")],
    ) -> str:
        """Fetch a single item (project) by id."""
        client = get_client()
        try:
            item = await client.get(f"{RESOURCE_PATH}/{item_id}")
        except SaaSError as err:
            raise ToolError(err.code, err.message, details={"request_id": err.request_id}) from err
        return json.dumps(item, indent=2)

    @mcp.tool()
    async def create_item(
        name: Annotated[str, Field(description="Name of the new item")],
        description: Annotated[
            str | None, Field(default=None, description="Optional description")
        ] = None,
        tags: Annotated[
            list[str] | None, Field(default=None, description="Optional list of tags")
        ] = None,
    ) -> str:
        """Create a new item (project) in the SaaS API."""
        client = get_client()
        body: dict = {"name": name}
        if description is not None:
            body["description"] = description
        if tags is not None:
            body["tags"] = tags
        try:
            created = await client.post(RESOURCE_PATH, json_body=body)
        except SaaSError as err:
            raise ToolError(err.code, err.message, details={"request_id": err.request_id}) from err
        return json.dumps({"created": created}, indent=2)

    @mcp.tool()
    async def update_item(
        item_id: Annotated[str, Field(description="The id of the item to update")],
        name: Annotated[str | None, Field(default=None, description="New name")] = None,
        description: Annotated[
            str | None, Field(default=None, description="New description")
        ] = None,
        tags: Annotated[list[str] | None, Field(default=None, description="New tags")] = None,
    ) -> str:
        """Update an existing item (project). Only provided fields are changed."""
        client = get_client()
        body: dict = {}
        if name is not None:
            body["name"] = name
        if description is not None:
            body["description"] = description
        if tags is not None:
            body["tags"] = tags
        if not body:
            raise ToolError("NO_FIELDS", "at least one field must be provided to update")
        try:
            updated = await client.patch(f"{RESOURCE_PATH}/{item_id}", json_body=body)
        except SaaSError as err:
            raise ToolError(err.code, err.message, details={"request_id": err.request_id}) from err
        return json.dumps({"updated": updated}, indent=2)

    @mcp.tool()
    async def delete_item(
        item_id: Annotated[str, Field(description="The id of the item to delete")],
    ) -> str:
        """Delete an item (project) by id."""
        client = get_client()
        try:
            await client.delete(f"{RESOURCE_PATH}/{item_id}")
        except SaaSError as err:
            raise ToolError(err.code, err.message, details={"request_id": err.request_id}) from err
        return f"Deleted item '{item_id}'."
