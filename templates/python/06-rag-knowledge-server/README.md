# RAG Knowledge Server (Python, stdio)

A Retrieval-Augmented Generation MCP server. Ingest documents, chunk them, generate embeddings, store vectors, and run semantic search with cited, scored results. Built with [FastMCP](https://modelcontextprotocol.io) (the official Python MCP SDK), Pydantic validation, and structured stderr logging.

## Features

- **Document chunking** — recursive character splitter with configurable chunk size + overlap.
- **Pluggable embeddings** — local (`sentence-transformers`) or OpenAI API.
- **Pluggable vector storage** — in-memory (cosine similarity) or persistent ChromaDB.
- **Cited results** — every search hit includes document id, chunk index, similarity score, and source metadata.
- **Pydantic input validation** — every tool argument is validated.
- **Structured stderr logging** — stdout is reserved for JSON-RPC, never polluted.

## Quick start

```bash
# 1. Create a virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# 2. Install the server (base, no optional deps — uses in-memory store)
pip install -e .

# 3. (Optional) install an embedding provider + vector store
pip install -e ".[local,chroma]"   # sentence-transformers + chromadb
# or
pip install -e ".[openai]"         # OpenAI embeddings

# 4. Configure
cp .env.example .env
# edit .env — set EMBEDDING_PROVIDER, VECTOR_STORE, OPENAI_API_KEY, etc.

# 5. Run
rag-knowledge-server
```

With only the base install (`pip install -e .`), the server uses the **local** embedding provider and **memory** vector store. The local provider requires `sentence-transformers`; install it with `pip install -e ".[local]"` before ingesting documents.

## Connect to Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "rag-knowledge": {
      "command": "rag-knowledge-server",
      "env": {
        "EMBEDDING_PROVIDER": "local",
        "VECTOR_STORE": "memory",
        "CHUNK_SIZE": "512",
        "CHUNK_OVERLAP": "50"
      }
    }
  }
}
```

Or run directly from source:

```json
{
  "mcpServers": {
    "rag-knowledge": {
      "command": "python",
      "args": ["-m", "src.server"],
      "cwd": "/absolute/path/to/06-rag-knowledge-server"
    }
  }
}
```

## Connect to Cursor / Windsurf

Add the same server entry to `.cursor/mcp.json` (Cursor) or Windsurf's MCP settings.

## Tools

### `ingest_document`
Ingest a document: split into overlapping chunks, generate embeddings, store vectors.

| Parameter     | Type                | Required | Description                                      |
|---------------|---------------------|----------|--------------------------------------------------|
| `content`     | string              | Yes      | The full text content of the document to ingest  |
| `document_id` | string              | No       | Explicit document id (UUID generated if omitted) |
| `metadata`    | object (string map) | No       | Metadata to attach (e.g. source, title)          |

### `search_knowledge`
Semantic search over ingested documents. Returns cited chunks with similarity scores.

| Parameter | Type    | Required | Default | Description                          |
|-----------|---------|----------|---------|--------------------------------------|
| `query`   | string  | Yes      | —       | The natural-language query           |
| `top_k`   | integer | No       | 5       | Maximum chunks to return (1–50)      |

### `list_documents`
List all documents currently stored in the knowledge base. Takes no parameters.

### `delete_document`
Delete a document and all of its embedded chunks.

| Parameter     | Type   | Required | Description                       |
|---------------|--------|----------|-----------------------------------|
| `document_id` | string | Yes      | The id of the document to delete  |

## Configuration (env)

| Variable                 | Default                  | Description                                      |
|--------------------------|--------------------------|--------------------------------------------------|
| `EMBEDDING_PROVIDER`     | `local`                  | `local` (sentence-transformers) or `openai`      |
| `OPENAI_API_KEY`         | —                        | Required when `EMBEDDING_PROVIDER=openai`        |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | OpenAI embedding model                           |
| `LOCAL_EMBEDDING_MODEL`  | `all-MiniLM-L6-v2`       | sentence-transformers model name                 |
| `CHUNK_SIZE`             | `512`                    | Max characters per chunk                         |
| `CHUNK_OVERLAP`          | `50`                     | Overlap characters between chunks                |
| `VECTOR_STORE`           | `memory`                 | `memory` or `chroma`                             |
| `CHROMA_PERSIST_DIR`     | `./chroma_data`          | ChromaDB persistence directory                   |
| `DEFAULT_TOP_K`          | `5`                      | Default result count for search                  |

## Project structure

```
06-rag-knowledge-server/
├── src/
│   ├── server.py              # Server entry point
│   ├── lib/
│   │   ├── logger.py          # Structured stderr logger
│   │   ├── errors.py          # ToolError + response helpers
│   │   ├── config.py          # Env-driven configuration
│   │   ├── chunker.py         # Document chunking
│   │   ├── embeddings.py      # Pluggable embedding providers
│   │   └── vectorstore.py     # In-memory + ChromaDB backends
│   └── tools/
│       ├── ingest_document.py
│       ├── search_knowledge.py
│       ├── list_documents.py
│       └── delete_document.py
├── tests/
│   └── test_tools.py          # Unit tests
├── pyproject.toml
├── Dockerfile
├── .env.example
└── README.md
```

## Testing

```bash
pip install -e ".[dev]"
pytest
```

## Docker

```bash
docker build -t rag-knowledge-server .
# stdio transport — run interactively
docker run -i rag-knowledge-server
```

## Deployment notes

- **In-memory store** resets on every restart. Use `VECTOR_STORE=chroma` for persistence.
- **Local embeddings** download the model on first run (~90 MB for MiniLM). In Docker, the model is baked into the image during `pip install ".[local]"` only if you trigger a download; consider pre-downloading in the Dockerfile for offline use.
- **OpenAI embeddings** require `OPENAI_API_KEY` and network egress on every ingest/search.
