"""``list_resources`` and ``get_resource`` example protected tools."""

import json
from typing import Annotated

from mcp.server.fastmcp import FastMCP
from pydantic import Field

from ..lib.auth import AuthError
from ..lib.middleware import get_current_claims

# In-memory example "protected" resources. In a real server these would
# come from a database, with per-user authorization enforced here.
_RESOURCES: dict[str, dict] = {
    "project-alpha": {"id": "project-alpha", "name": "Project Alpha", "owner": "team-1"},
    "project-beta": {"id": "project-beta", "name": "Project Beta", "owner": "team-2"},
    "project-gamma": {"id": "project-gamma", "name": "Project Gamma", "owner": "team-1"},
}


def register(mcp: FastMCP) -> None:
    """Register the list_resources and get_resource tools."""

    @mcp.tool()
    async def list_resources() -> str:
        """List the protected resources visible to the authenticated principal."""
        claims = get_current_claims()
        # Example authorization: only show team-1 resources unless the
        # 'mcp:admin' scope is present.
        if "mcp:admin" in claims.scopes:
            visible = list(_RESOURCES.values())
        else:
            visible = [r for r in _RESOURCES.values() if r["owner"] == "team-1"]
        return json.dumps(
            {"principal": claims.sub, "resources": visible, "count": len(visible)}, indent=2
        )

    @mcp.tool()
    async def get_resource(
        resource_id: Annotated[str, Field(description="The id of the resource to fetch")],
    ) -> str:
        """Fetch a single protected resource by id."""
        claims = get_current_claims()
        resource = _RESOURCES.get(resource_id)
        if resource is None:
            raise AuthError("NOT_FOUND", f"resource '{resource_id}' not found", status=404)
        # Enforce per-resource authorization.
        if resource["owner"] != "team-1" and "mcp:admin" not in claims.scopes:
            raise AuthError("FORBIDDEN", f"principal '{claims.sub}' cannot access '{resource_id}'", status=403)
        return json.dumps({"principal": claims.sub, "resource": resource}, indent=2)
