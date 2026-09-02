"""``delete_document`` tool — remove a document and its chunks."""

from typing import Annotated

from mcp.server.fastmcp import FastMCP
from pydantic import Field

from ..lib.errors import ToolError
from ..lib.vectorstore import get_vector_store

_store = get_vector_store()


def register(mcp: FastMCP) -> None:
    """Register the delete_document tool on the FastMCP server."""

    @mcp.tool()
    async def delete_document(
        document_id: Annotated[str, Field(description="The id of the document to delete")],
    ) -> str:
        """Delete a document and all of its embedded chunks from the knowledge base."""
        if not document_id or not document_id.strip():
            raise ToolError("INVALID_INPUT", "document_id must not be empty")
        deleted = _store.delete(document_id)
        if not deleted:
            raise ToolError("NOT_FOUND", f"no document found with id '{document_id}'")
        return f"Deleted document '{document_id}'."
