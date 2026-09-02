# Streaming MCP Server (Python, Streamable HTTP / SSE)

An MCP server for **web deployments** using the Streamable HTTP transport. Tools report progress for long operations, support cancellation, and a connection manager caps active sessions. CORS is configurable for browser-based clients.

Built with [FastMCP](https://modelcontextprotocol.io), Starlette, and uvicorn.

## Features

- **Streamable HTTP transport** — deploy as a web service (not stdio). MCP clients connect over HTTP; the server streams responses via SSE.
- **Progress reporting** — long tools call `ctx.report_progress(progress, total, message)` so clients see live updates.
- **Cancellation support** — long operations use `anyio` cancellation points, so a cancelled request aborts promptly.
- **Connection management** — a `ConnectionManager` tracks active connections and rejects new ones over `MAX_CONNECTIONS` with `503`.
- **CORS** — configurable allowed origins for browser-based MCP clients.
- **Health + introspection endpoints** — `/health` and `/connections` for liveness probes and ops.
- Pydantic input validation + structured stderr logging.

## Quick start

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

pip install -e ".[dev]"

cp .env.example .env
streaming-server
# → MCP endpoint at http://0.0.0.0:8080/mcp
# → health at        http://0.0.0.0:8080/health
# → connections at    http://0.0.0.0:8080/connections
```

## Connecting a client

This is a **remote** server. Clients connect over HTTP.

### Claude Desktop / Cursor (remote MCP)
```json
{
  "mcpServers": {
    "streaming": {
      "url": "http://localhost:8080/mcp"
    }
  }
}
```

### Programmatic client (Python)
```python
from mcp.client.streamable_http import streamablehttp_client

async with streamablehttp_client("http://localhost:8080/mcp") as (read, write, _):
    # ... use the MCP session; progress notifications arrive on `read` ...
    pass
```

### Browser-based client
Set `CORS_ORIGINS` to your frontend origin so the browser can connect:
```env
CORS_ORIGINS=https://app.example.com
```

## Tools

### `stream_search`
Search a small corpus, reporting progress as each item is evaluated.

| Parameter | Type   | Required | Description            |
|-----------|--------|----------|------------------------|
| `query`   | string | Yes      | The search query       |

### `stream_generate`
Generate a token sequence for a prompt, reporting progress per token. (Simulated — swap the body for a real streaming LLM call.)

| Parameter    | Type    | Required | Default | Description                          |
|--------------|---------|----------|---------|--------------------------------------|
| `prompt`     | string  | Yes      | —       | The prompt to generate for           |
| `max_tokens` | integer | No       | 20      | Maximum tokens to generate (1–200)   |

### `long_running_task`
Run a cancellable long-running task that reports progress. Each step is a cancellation point.

| Parameter   | Type    | Required | Default | Description                          |
|-------------|---------|----------|---------|--------------------------------------|
| `task_name` | string  | Yes      | —       | A name for the task                  |
| `steps`     | integer | No       | 20      | Number of steps (1–1000)             |

## Configuration (env)

| Variable          | Default     | Description                                        |
|-------------------|-------------|----------------------------------------------------|
| `HOST`            | `0.0.0.0`   | Bind address                                       |
| `PORT`            | `8080`      | HTTP port                                          |
| `CORS_ORIGINS`    | `*`         | Comma-separated allowed origins                    |
| `MAX_CONNECTIONS` | `100`       | Maximum simultaneous connections                   |
| `DEFAULT_STEPS`   | `20`        | Default step count for long operations             |

## How progress + cancellation work

1. A tool accepts a `ctx: Context` parameter; FastMCP injects it.
2. The tool calls `await ctx.report_progress(step, total, message)` — the client receives a progress notification.
3. Each step awaits `anyio.sleep(...)`, which is a cancellation point. If the client cancels the request, `anyio` raises `CancelledError` and the loop aborts promptly.
4. The `track_progress` async generator centralizes this pattern so every long tool behaves consistently.

## Connection management

`build_app()` wraps the FastMCP streamable HTTP app with:
- **CORS middleware** — allows configured origins, exposes the `Mcp-Session-Id` header.
- **Connection tracking** — every request to `/mcp` is counted; over `MAX_CONNECTIONS` the server returns `503`. `/health` and `/connections` are exempt.

## Project structure

```
10-streaming-server/
├── src/
│   ├── server.py              # Entry point — builds Starlette app with CORS + connections
│   ├── lib/
│   │   ├── logger.py          # Structured stderr logger
│   │   ├── errors.py          # ToolError + response helpers
│   │   ├── config.py          # Env-driven configuration
│   │   └── streaming.py       # ConnectionManager, track_progress, SSE formatter
│   └── tools/
│       ├── stream_search.py   # Progress-reporting search
│       ├── stream_generate.py # Token-by-token generation
│       └── long_running_task.py # Cancellable long operation
├── tests/
│   └── test_tools.py          # SSE, connection cap, progress, cancellation tests
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

Tests cover the SSE frame formatter, connection manager cap enforcement, the progress generator (including cancellation), and the cancel-scope helper.

## Docker

```bash
docker build -t streaming-server .
docker run -p 8080:8080 -e CORS_ORIGINS=https://app.example.com streaming-server
```

## Deployment notes

- **TLS**: terminate TLS at a reverse proxy (nginx, Caddy). The server listens on plain HTTP.
- **Scaling**: `MAX_CONNECTIONS` is per-process. For multiple workers, use a shared connection limiter (e.g. Redis-backed semaphore).
- **Real streaming LLM**: replace the body of `stream_generate` with an `httpx`-streamed OpenAI (or other) call, yielding tokens and calling `ctx.report_progress` per chunk.
- **Stateful sessions**: the Streamable HTTP transport tracks sessions via the `Mcp-Session-Id` header. Sticky routing is required when running multiple replicas.
