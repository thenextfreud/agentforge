"""``ingest_document`` tool — chunk, embed, and store a document."""

from typing import Annotated

from mcp.server.fastmcp import FastMCP
from pydantic import Field

from ..lib.chunker import Chunker
from ..lib.config import config
from ..lib.embeddings import get_embedder
from ..lib.errors import ToolError
from ..lib.logger import logger
from ..lib.vectorstore import StoredChunk, get_vector_store, new_document_id

# Module-level singletons so state persists across tool calls.
_chunker = Chunker(chunk_size=config.chunk_size, chunk_overlap=config.chunk_overlap)
_embedder = get_embedder()
_store = get_vector_store()


def register(mcp: FastMCP) -> None:
    """Register the ingest_document tool on the FastMCP server."""

    @mcp.tool()
    async def ingest_document(
        content: Annotated[str, Field(description="The full text content of the document to ingest")],
        document_id: Annotated[
            str | None,
            Field(default=None, description="Optional explicit document id. A UUID is generated when omitted."),
        ] = None,
        metadata: Annotated[
            dict[str, str] | None,
            Field(default=None, description="Optional metadata to attach to the document (e.g. source, title)"),
        ] = None,
    ) -> str:
        """Ingest a document: split it into overlapping chunks, generate embeddings,
        and store the vectors for later semantic search."""
        if not content or not content.strip():
            raise ToolError("INVALID_INPUT", "content must not be empty")

        doc_id = document_id or new_document_id()
        meta = metadata or {}

        chunks = _chunker.chunk(content)
        if not chunks:
            raise ToolError("CHUNK_ERROR", "document produced no chunks")

        logger.info(
            "ingesting document",
            {"document_id": doc_id, "chunks": len(chunks), "chars": len(content)},
        )

        embeddings = _embedder.embed([c.text for c in chunks])
        stored = [
            StoredChunk(
                document_id=doc_id,
                chunk_index=c.index,
                text=c.text,
                embedding=embeddings[i],
                metadata={
                    **meta,
                    "start_char": c.start_char,
                    "end_char": c.end_char,
                    "token_count": c.token_count,
                },
            )
            for i, c in enumerate(chunks)
        ]
        _store.add(doc_id, stored)

        return (
            f"Ingested document '{doc_id}': {len(chunks)} chunks, "
            f"{len(content)} chars. Provider={config.embedding_provider}, "
            f"store={config.vector_store}."
        )
