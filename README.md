# AgentForge

> Production-ready templates for building [MCP servers](https://modelcontextprotocol.io/) and AI agents.
>
> [![npm version](https://img.shields.io/npm/v/@atlasforge/agentforge.svg)](https://www.npmjs.com/package/@atlasforge/agentforge)
> Landing page: https://thenextfreud.github.io/agentforge/

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
npx @atlasforge/agentforge init my-server
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
npx @atlasforge/agentforge init my-mcp-server

# Or clone a template directly
cd templates/typescript/01-hello-world-stdio
npm install
npm run dev
```

Each template has its own README with setup instructions, environment variables, and usage examples.

## Why?

The MCP spec is straightforward but the surrounding plumbing — transports, error handling, validation, deployment, client config — is tedious and repetitive. These templates handle all of that so you can focus on your tools.

## Articles

Building and testing these templates led to some writeups on browser automation and CI/CD:

- [I spent 4 hours uploading a file to a website with Chrome DevTools Protocol](https://dev.to/atlasforge_dev/i-spent-4-hours-uploading-a-file-to-a-website-with-chrome-devtools-protocol-3j53)
- [Gumroad's auth flow is hostile to automation — here's the exact chain that works](https://dev.to/atlasforge_dev/gumroads-auth-flow-is-hostile-to-automation-heres-the-exact-chain-that-works-49pe)
- [Why I couldn't publish on Medium with Chrome DevTools Protocol](https://dev.to/atlasforge_dev/why-i-couldnt-publish-on-medium-with-chrome-devtools-protocol-35cm)
- [I built 10 MCP server templates so you don't have to write the same boilerplate I did](https://dev.to/atlasforge_dev/i-built-10-mcp-server-templates-so-you-dont-have-to-write-the-same-boilerplate-i-did-2pdf)
- [I published an MCP server scaffolding CLI to npm — here's what broke and what I learned](https://dev.to/atlasforge_dev/i-published-an-mcp-server-scaffolding-cli-to-npm-heres-what-broke-and-what-i-learned-cel)

## Contributing

Contributions welcome. If you've built an MCP server pattern that isn't covered here, open a PR.

## License

MIT — use these templates for anything, personal or commercial. Attribution appreciated but not required.
