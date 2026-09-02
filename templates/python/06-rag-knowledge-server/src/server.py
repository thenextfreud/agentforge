"""MCP Server — RAG Knowledge Server (stdio transport)

A Retrieval-Augmented Generation MCP server. Demonstrates:
- stdio transport (for Claude Desktop, Cursor, Windsurf)
- Pydantic input validation (equivalent of Zod)
- Structured stderr logging (never stdout — stdout is reserved for JSON-RPC)
- Document chunking with configurable size + overlap
- Pluggable embeddings (local sentence-transformers or OpenAI)
- Pluggable vector storage (in-memory or ChromaDB)
- Cited chunk results with similarity scores
"""

from __future__ import annotations

from mcp.server.fastmcp import FastMCP

from .lib.config import config
from .lib.logger import logger
from .tools import (
    delete_document,
    ingest_document,
    list_documents,
    search_knowledge,
)

mcp = FastMCP(
    name="rag-knowledge-server",
    instructions=(
        "RAG knowledge server. Ingest documents with ingest_document, then "
        "search them semantically with search_knowledge. Use list_documents "
        "to see what's stored and delete_document to remove one."
    ),
)

# Register tools
ingest_document.register(mcp)
search_knowledge.register(mcp)
list_documents.register(mcp)
delete_document.register(mcp)


def main() -> None:
    logger.info(
        "MCP server starting",
        {
            "name": "rag-knowledge-server",
            "version": "1.0.0",
            "embedding_provider": config.embedding_provider,
            "vector_store": config.vector_store,
            "chunk_size": config.chunk_size,
            "chunk_overlap": config.chunk_overlap,
        },
    )
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
