"""``search_knowledge`` tool — semantic search over ingested documents."""

import json
from typing import Annotated

from mcp.server.fastmcp import FastMCP
from pydantic import Field

from ..lib.config import config
from ..lib.embeddings import get_embedder
from ..lib.errors import ToolError
from ..lib.vectorstore import get_vector_store

_embedder = get_embedder()
_store = get_vector_store()


def register(mcp: FastMCP) -> None:
    """Register the search_knowledge tool on the FastMCP server."""

    @mcp.tool()
    async def search_knowledge(
        query: Annotated[str, Field(description="The natural-language query to search for")],
        top_k: Annotated[
            int,
            Field(default=5, ge=1, le=50, description="Maximum number of chunks to return"),
        ] = 5,
    ) -> str:
        """Search the knowledge base for chunks semantically similar to ``query``.
        Returns cited chunks with their document id, chunk index, and similarity score."""
        if not query or not query.strip():
            raise ToolError("INVALID_INPUT", "query must not be empty")

        query_embedding = _embedder.embed([query])[0]
        results = _store.search(query_embedding, top_k)

        if not results:
            return "No matching chunks found. Ingest documents first with ingest_document."

        payload = [
            {
                "document_id": r.document_id,
                "chunk_index": r.chunk_index,
                "score": round(r.score, 4),
                "text": r.text,
                "metadata": r.metadata,
            }
            for r in results
        ]
        return json.dumps({"query": query, "results": payload, "count": len(payload)}, indent=2)
