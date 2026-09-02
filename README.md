# AgentForge

> Production-ready templates for building [MCP servers](https://modelcontextprotocol.io/) and AI agents.

Stop writing boilerplate. Pick a template, run `npm install` (or `pip install`), and start building your actual logic.

## What's inside

### 10 MCP Server Templates

**TypeScript** (`templates/typescript/`):

| # | Template | What it teaches |
|---|----------|----------------|
| 1 | `hello-world-stdio` | Minimum viable server, stdio transport, Zod validation |
| 2 | `rest-api-wrapper` | Wrap any REST API as MCP tools — auth, retries, pagination |
| 3 | `database-query-server` | Safe read-only SQL with table allow-lists |
| 4 | `filesystem-tools` | Sandboxed file ops with path traversal prevention |
| 5 | `web-search-fetch` | Web search + URL fetching with readable text extraction |

**Python** (`templates/python/`):

| # | Template | What it teaches |
|---|----------|----------------|
| 6 | `rag-knowledge-server` | Chunk, embed, vector search with cited results |
| 7 | `oauth-protected-server` | Remote MCP server gated by OAuth 2.0 / JWKS |
| 8 | `saas-integration-template` | SaaS-wrapping: retries, webhooks, pagination |
| 9 | `multi-tool-toolkit` | Modular multi-tool server with shared state |
| 10 | `streaming-server` | SSE / Streamable HTTP transport for web deploys |

### 5 AI Agent Patterns (`templates/agents/`)

| # | Pattern | Description |
|---|---------|-------------|
| 1 | `react-agent` | ReAct loop: reason, act, observe, repeat |
| 2 | `tool-use-agent` | Structured tool calling with parallel execution |
| 3 | `rag-agent` | Retrieval-augmented generation with citations |
| 4 | `multi-agent` | Coordinator + worker agent orchestration |
| 5 | `human-in-loop` | Approval gates for sensitive operations |

### CLI Scaffolding

```bash
npx agentforge init my-server
```

Interactive template selection, language choice, instant project setup.

### Deployment Configs

Every template ships with configs for:
- Docker + docker-compose
- Cloudflare Workers
- Vercel (Next.js API routes)
- Railway / Fly.io
- Self-hosted systemd

### Client Integration Guides (`docs/`)

Setup instructions for Claude Desktop, Cursor, Windsurf, Claude Code, and VS Code (Continue).

## Quick start

```bash
# Scaffold a new project
npx agentforge init my-mcp-server

# Or clone a template directly
cd templates/typescript/01-hello-world-stdio
npm install
npm run dev
```

Each template has its own README with setup instructions, environment variables, and usage examples.

## Why?

The MCP spec is straightforward but the surrounding plumbing — transports, error handling, validation, deployment, client config — is tedious and repetitive. These templates handle all of that so you can focus on your tools.

## Contributing

Contributions welcome. If you've built an MCP server pattern that isn't covered here, open a PR.

## License

MIT — use these templates for anything, personal or commercial. Attribution appreciated but not required.
