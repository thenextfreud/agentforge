# Multi-Tool Toolkit (Python, stdio)

A modular multi-tool MCP server with **shared session state** and **tool composition**. The pattern this template demonstrates: multiple tools live in separate files, share a common session state, and work together — one tool's output becomes another tool's input, all mediated by a `StateStore` rather than re-passing data through every call.

Built with [FastMCP](https://modelcontextprotocol.io) and Pydantic.

## Features

- **Modular tool registration** — each tool is its own module under `src/tools/` with a `register(mcp)` function. Add a tool by dropping in a file and calling `register` in `server.py`.
- **Shared session state** — a thread-safe `StateStore` holds context, analyses, reports, and exports keyed by `session_id`. Tools read/write it across calls.
- **Tool composition** — tools consume state produced by other tools:
  - `set_context` → stores values
  - `run_analysis` → reads context, computes statistics, stores an `AnalysisResult`
  - `generate_report` → reads analyses, builds a `Report`
  - `export_data` → reads reports/analyses, writes a file
- **Session isolation** — pass a `session_id` to keep state separate per user/agent; omit it for a shared default session.
- **Pydantic input validation** + structured stderr logging.

## Quick start

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

pip install -e ".[dev]"

cp .env.example .env
multi-tool-toolkit
```

## Connect to Claude Desktop / Cursor / Windsurf

```json
{
  "mcpServers": {
    "multi-tool-toolkit": {
      "command": "multi-tool-toolkit",
      "env": {
        "EXPORT_DIR": "/tmp/exports",
        "MAX_CONTEXT_ITEMS": "100"
      }
    }
  }
}
```

Or from source:

```json
{
  "mcpServers": {
    "multi-tool-toolkit": {
      "command": "python",
      "args": ["-m", "src.server"],
      "cwd": "/absolute/path/to/09-multi-tool-toolkit"
    }
  }
}
```

## Tools

### `set_context`
Store a key/value pair in shared session context.

| Parameter    | Type   | Required | Description                                      |
|--------------|--------|----------|--------------------------------------------------|
| `key`        | string | Yes      | Context key                                      |
| `value`      | string | Yes      | Context value                                    |
| `session_id` | string | No       | Session id (defaults to a shared session)        |

### `get_context`
Read shared session context.

| Parameter    | Type   | Required | Description                                           |
|--------------|--------|----------|-------------------------------------------------------|
| `key`        | string | No       | Fetch a single key; omit to return the whole context  |
| `session_id` | string | No       | Session id                                            |

### `run_analysis`
Run a statistical analysis over numeric values in the session context. Stores an `AnalysisResult` for later use by `generate_report` and `export_data`.

| Parameter    | Type           | Required | Description                                              |
|--------------|----------------|----------|----------------------------------------------------------|
| `name`       | string         | Yes      | A name for this analysis                                 |
| `keys`       | array[string]  | No       | Context keys to analyze; defaults to all numeric values  |
| `session_id` | string         | No       | Session id                                               |

### `generate_report`
Generate a markdown report from all analyses in the session. Stores a `Report` for `export_data`.

| Parameter    | Type   | Required | Description          |
|--------------|--------|----------|----------------------|
| `title`      | string | Yes      | Report title         |
| `session_id` | string | No       | Session id           |

### `export_data`
Export the session's analyses and reports to a file in `EXPORT_DIR`.

| Parameter    | Type              | Required | Description                              |
|--------------|-------------------|----------|------------------------------------------|
| `format`     | `"json"`\|`"markdown"` | Yes | Export format                            |
| `session_id` | string            | No       | Session id                               |
| `filename`   | string            | No       | Output filename (defaults to session id) |

## Typical flow

```
set_context(key="revenue", value="100")
set_context(key="costs", value="40")
run_analysis(name="finance")            # reads revenue + costs, computes stats
generate_report(title="Finance Report") # reads the analysis, builds a report
export_data(format="markdown")          # writes the report to EXPORT_DIR
```

All four calls share state via the same `session_id` (the default shared session unless you pass one).

## Configuration (env)

| Variable           | Default     | Description                                       |
|--------------------|-------------|---------------------------------------------------|
| `SESSION_TTL`      | `3600`      | Idle session TTL in seconds (then purged)         |
| `MAX_CONTEXT_ITEMS`| `100`       | Max context keys per session (oldest evicted)     |
| `EXPORT_DIR`       | `./exports` | Directory where `export_data` writes files        |

## The shared-state pattern

```
                 ┌────────────────────────┐
                 │       StateStore        │
                 │  (keyed by session_id)  │
                 └────────────────────────┘
                          ▲      ▲
            writes context│      │reads context
                          │      │
   set_context ───────────┘      └───────── run_analysis
                                                  │
                                  writes AnalysisResult
                                                  ▼
                                         generate_report
                                                  │
                                    writes Report │
                                                  ▼
                                           export_data
                                          (writes file)
```

Each tool is a thin layer over the `StateStore`. This keeps tools composable and testable — you can exercise the whole pipeline by driving the store directly.

## Project structure

```
09-multi-tool-toolkit/
├── src/
│   ├── server.py              # Entry point — registers all tool modules
│   ├── lib/
│   │   ├── logger.py          # Structured stderr logger
│   │   ├── errors.py          # ToolError + response helpers
│   │   ├── config.py          # Env-driven configuration
│   │   └── state.py           # StateStore + SessionState (shared state)
│   └── tools/
│       ├── set_context.py     # set_context tool
│       ├── get_context.py     # get_context tool
│       ├── run_analysis.py    # run_analysis tool
│       ├── generate_report.py # generate_report tool
│       └── export_data.py     # export_data tool
├── tests/
│   └── test_tools.py          # State + composition pipeline tests
├── pyproject.toml
├── Dockerfile
├── .env.example
└── README.md
```

## Adding a new tool

1. Create `src/tools/my_tool.py`:
   ```python
   from mcp.server.fastmcp import FastMCP
   from typing import Annotated
   from pydantic import Field
   from ..lib.state import store

   def register(mcp: FastMCP) -> None:
       @mcp.tool()
       async def my_tool(
           arg: Annotated[str, Field(description="...")] = "",
       ) -> str:
           """..."""
           state = store.get()
           ...
           return "result"
   ```
2. Import and register it in `src/server.py`:
   ```python
   from .tools import my_tool
   my_tool.register(mcp)
   ```

## Testing

```bash
pip install -e ".[dev]"
pytest
```

## Docker

```bash
docker build -t multi-tool-toolkit .
docker run -i multi-tool-toolkit
```

## Deployment notes

- The `StateStore` is in-memory and per-process. For multiple workers, back it with Redis or a shared database.
- Idle sessions are purged after `SESSION_TTL`. The default shared session is never purged.
- `export_data` writes to `EXPORT_DIR`; ensure the directory is writable (and mounted as a volume in Docker if you need persistence).
