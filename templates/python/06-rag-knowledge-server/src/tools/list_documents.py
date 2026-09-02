"""``list_documents`` tool — list all ingested documents."""

import json

from mcp.server.fastmcp import FastMCP

from ..lib.vectorstore import get_vector_store

_store = get_vector_store()


def register(mcp: FastMCP) -> None:
    """Register the list_documents tool on the FastMCP server."""

    @mcp.tool()
    async def list_documents() -> str:
        """List all documents currently stored in the knowledge base."""
        docs = _store.list_documents()
        if not docs:
            return "No documents ingested yet."
        return json.dumps({"documents": docs, "count": len(docs)}, indent=2)
