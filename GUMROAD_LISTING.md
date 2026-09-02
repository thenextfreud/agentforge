# AgentForge — Gumroad Listing

## Product Name
AgentForge: MCP Server + AI Agent Starter Kit

## Tagline
Ship MCP servers and AI agents in minutes, not days. 15 production-ready templates in TypeScript + Python.

## Price
$49.00 USD (one-time)

## Description

### Ship production-ready MCP servers and AI agents in minutes, not days.

AgentForge is the most comprehensive MCP Server and AI Agent starter kit available. 15 runnable templates, a CLI scaffolding tool, deployment configs for every major platform, and client integration guides — all production-tested and ready to use.

### What you get

**10 MCP Server Templates** (TypeScript + Python):

| # | Template | Language | Transport | Tools |
|---|----------|----------|-----------|-------|
| 1 | Hello World (stdio) | TypeScript | stdio | echo, fetch_url |
| 2 | REST API Wrapper | TypeScript | stdio | api_get, api_post, api_list, get_post, get_user, list_posts, create_post |
| 3 | Database Query Server | TypeScript | stdio | query_sql, list_tables, describe_table, get_row_count |
| 4 | Filesystem Tools | TypeScript | stdio | read_file, write_file, list_directory, search_files, get_file_info |
| 5 | Web Search & Fetch | TypeScript | stdio | web_search, fetch_url, extract_text, fetch_json |
| 6 | RAG Knowledge Server | Python | stdio | ingest_document, search_knowledge, list_documents, delete_document |
| 7 | OAuth Protected Server | Python | Streamable HTTP | whoami, list_resources, get_resource |
| 8 | SaaS Integration Template | Python | stdio | list_items, get_item, create_item, update_item, delete_item, verify_webhook |
| 9 | Multi-Tool Toolkit | Python | stdio | set_context, get_context, run_analysis, generate_report, export_data |
| 10 | Streaming Server | Python | SSE/HTTP | stream_search, stream_generate, long_running_task |

**5 AI Agent Patterns** (TypeScript):

| # | Pattern | Description |
|---|---------|-------------|
| 1 | ReAct Agent | Classic Reasoning + Acting loop with tool calling |
| 2 | Tool-Use Agent | OpenAI native function calling with parallel execution |
| 3 | RAG Agent | Retrieval-augmented generation with citations |
| 4 | Multi-Agent | Coordinator + worker orchestration with parallel execution |
| 5 | Human-in-Loop | Approval gates for sensitive operations with risk classification |

**CLI Scaffolding Tool** (`npx @atlasforge/agentforge init`):
- Interactive template selection
- Instant project scaffolding
- Zero dependencies (pure Node.js)
- List and inspect all templates

**Deployment Configs**:
- Docker + docker-compose
- Vercel (Next.js API routes)
- Railway
- Fly.io
- Cloudflare Workers
- Self-hosted (systemd + Nginx)

**Client Integration Guides**:
- Claude Desktop
- Cursor
- Windsurf
- VS Code (Continue)
- Claude Code (CLI)

**Comprehensive Documentation**:
- Getting started guide
- MCP architecture explained
- Agent design patterns guide
- Security best practices
- Testing guide
- Per-platform deployment guides

### Why AgentForge?

**Saves 40+ hours of boilerplate.** At $49, that's just over $1 per hour saved. Every MCP server needs the same plumbing: transport setup, input validation, error handling, structured logging, client config. AgentForge ships all of it, production-tested, so you can focus on the part only you can build — the actual tool logic.

**Real patterns, not hello world tutorials.** Each template solves a real problem: wrapping REST APIs with retries and pagination, safe database queries with SQL injection prevention, sandboxed filesystem operations with path traversal detection, RAG with cited results, OAuth-protected remote servers.

**Dual-language.** TypeScript and Python. Use whichever your team prefers. The most critical patterns are available in both languages.

**Production-tested.** 143 tests across all templates. Every server compiles, runs, and connects to real MCP clients. No broken examples, no missing dependencies.

**Lifetime updates.** MCP and AI agent patterns are evolving fast. Your purchase includes all future updates — new templates, new patterns, new deployment targets — at no additional cost.

**Commercial license.** Use AgentForge in unlimited personal and client projects. Build SaaS products, internal tools, client deliverables — no restrictions. (Redistribution of the templates themselves is not permitted.)

### Who is this for?

- **Developers building MCP servers** for Claude, Cursor, Windsurf, or any MCP-compatible client
- **Teams building AI agents** that need production-ready patterns, not research prototypes
- **Indie hackers** who want to ship AI tools fast without reinventing the plumbing
- **Agencies** who need a reusable foundation for client MCP/agent projects
- **Anyone who wants to skip 40 hours of boilerplate** and start on the actual product

### Requirements

- Node.js 18+ (for TypeScript templates and CLI)
- Python 3.11+ (for Python templates)
- An MCP-compatible client (Claude Desktop, Cursor, Windsurf, etc.)
- OpenAI API key (for AI agent patterns only — MCP servers don't need one)

### FAQ

**What is MCP?**
Model Context Protocol is an open standard that lets AI assistants like Claude securely call external tools and access data sources. It's becoming the standard way to connect AI to real-world systems.

**Is there a free version?**
No. AgentForge is a premium kit. The quality, comprehensiveness, and lifetime updates justify the price — it saves you 40+ hours of work.

**Can I use this for client projects?**
Yes. The commercial license allows unlimited use in personal and client projects.

**Do I get updates?**
Yes, lifetime updates are included. As MCP and AI agent patterns evolve, you get the latest templates at no extra cost.

**What's the difference between this and free MCP examples?**
Free examples are hello-world tutorials. AgentForge templates are production-ready: they include auth, rate limiting, retries, pagination, security (path traversal prevention, SQL injection prevention), structured logging, tests, Dockerfiles, and deployment guides. Each template is a real server you can deploy today.

## What's included in the download

```
agentforge/
├── templates/
│   ├── typescript/     # 5 MCP server templates (TS)
│   ├── python/         # 5 MCP server templates (Python)
│   └── agents/         # 5 AI agent patterns (TS)
├── packages/
│   └── cli/            # AgentForge CLI (npx @atlasforge/agentforge init)
├── docs/               # Comprehensive documentation
│   ├── getting-started.md
│   ├── client-configs/ # Claude, Cursor, Windsurf, VS Code guides
│   ├── deployment/     # Docker, Vercel, Railway, Fly.io, CF Workers, systemd
│   └── patterns/       # MCP architecture, agent design, security, testing
├── landing/            # Next.js landing page (deploy to Vercel)
├── README.md
└── LICENSE
```

## Refund policy

14-day money-back guarantee. If AgentForge doesn't work as described, contact support for a full refund.
