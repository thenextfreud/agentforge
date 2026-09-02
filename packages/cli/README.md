# AgentForge CLI

> Production-ready AI Agent + MCP Server starter kit — scaffold new projects from 15 battle-tested templates.

**Zero dependencies.** Pure Node.js. No external packages required.

## Quick start

```bash
# Scaffold a new project (interactive)
npx @atlasforge/agentforge init my-mcp-server

# Or run directly from this repo
node packages/cli/src/index.js init my-mcp-server
```

## Commands

### `agentforge init [project-name]`

Interactive scaffold command. Walks you through:

1. **Project name** — prompted if not provided as an argument
2. **Template category** — MCP Server (TypeScript), MCP Server (Python), or AI Agent (TypeScript)
3. **Template selection** — pick from the templates in your chosen category
4. **Scaffold** — copies all template files to `./project-name/`
5. **Next steps** — prints install/run instructions

```bash
# Provide name upfront
agentforge init my-server

# Or get prompted
agentforge init
```

The scaffold will:
- Create the target directory if it doesn't exist
- Copy all template files (excluding `node_modules`, `dist`, `.env`, `.git`)
- Update the project name in `package.json` or `pyproject.toml`
- Print next steps (install, dev, build commands)

### `agentforge list`

List all 15 available templates grouped by category.

```bash
agentforge list
```

### `agentforge info <template-id>`

Show detailed info about a specific template: description, tools, language, transport type, required environment variables, and next steps.

```bash
agentforge info ts-hello-world
```

### `agentforge --help`

Show the help message with all available commands.

### `agentforge --version`

Show the CLI version.

## Available Templates

### MCP Server Templates (10)

**TypeScript (5):**

| ID | Name | Transport | Description |
|----|------|-----------|-------------|
| `ts-hello-world` | Hello World (stdio) | stdio | Minimum viable MCP server with Zod validation |
| `ts-rest-api-wrapper` | REST API Wrapper | stdio | Wrap any REST API as MCP tools with auth & retries |
| `ts-database-query` | Database Query Server | stdio | Safe read-only SQL queries with table allow-lists |
| `ts-filesystem-tools` | Filesystem Tools | stdio | Sandboxed file operations with path traversal prevention |
| `ts-web-search-fetch` | Web Search & Fetch | stdio | Web search + URL fetching with text extraction |

**Python (5):**

| ID | Name | Transport | Description |
|----|------|-----------|-------------|
| `py-rag-knowledge` | RAG Knowledge Server | stdio | Chunk, embed, and vector search with citations |
| `py-oauth-protected` | OAuth Protected Server | http | Remote MCP server gated by OAuth 2.0 via JWKS |
| `py-saas-integration` | SaaS Integration Template | stdio | SaaS-wrapping patterns: retries, webhooks, pagination |
| `py-multi-tool-toolkit` | Multi-Tool Toolkit | stdio | Modular multi-tool server with shared state |
| `py-streaming-server` | Streaming Server | sse | SSE/Streamable HTTP transport for web deployments |

### AI Agent Templates (5)

| ID | Name | Description |
|----|------|-------------|
| `agent-react` | ReAct Agent | ReAct loop: reason, act, observe, repeat |
| `agent-tool-use` | Tool Use Agent | Structured tool calling with parallel execution |
| `agent-rag` | RAG Agent | Retrieval-augmented generation with citation |
| `agent-multi-agent` | Multi-Agent Orchestrator | Coordinator + worker agent orchestration |
| `agent-human-in-loop` | Human-in-the-Loop Agent | Approval gates for sensitive operations |

## Architecture

```
packages/cli/
├── package.json              # npm package config (name: "@atlasforge/agentforge")
├── README.md                 # this file
├── .gitignore
└── src/
    ├── index.js              # entry point, CLI argument parsing
    ├── commands/
    │   ├── init.js           # `agentforge init` — interactive scaffold
    │   ├── list.js           # `agentforge list` — list all templates
    │   └── info.js           # `agentforge info <id>` — template details
    └── lib/
        ├── templates.js      # template registry (all 15 templates)
        ├── scaffold.js       # copy template files to target directory
        └── prompts.js        # interactive prompts (readline-based)
```

## Requirements

- Node.js >= 18.0.0

## License

MIT license. See the project root for details.
