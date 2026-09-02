"""``whoami`` tool — return the authenticated principal."""

from mcp.server.fastmcp import FastMCP

from ..lib.auth import AuthError
from ..lib.middleware import get_current_claims


def register(mcp: FastMCP) -> None:
    """Register the whoami tool on the FastMCP server."""

    @mcp.tool()
    async def whoami() -> str:
        """Return the subject and scopes of the authenticated principal."""
        try:
            claims = get_current_claims()
        except AuthError as err:
            # Re-raise as a structured tool error so MCP returns isError.
            raise AuthError(err.code, err.message) from err
        return (
            f"Authenticated as subject '{claims.sub}'. "
            f"Issuer: {claims.issuer or '(unknown)'}. "
            f"Scopes: {', '.join(claims.scopes) or '(none)'}."
        )
