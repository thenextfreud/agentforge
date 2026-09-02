# Getting Started with AgentForge

## What is AgentForge?

AgentForge is a commercial starter kit for building production-grade AI agents and Model Context Protocol (MCP) servers. It provides a collection of battle-tested templates, reusable patterns, and deployment guides that take you from an empty directory to a fully functional, secure, and deployable MCP server in minutes. Whether you need a filesystem server, a database query agent, a RAG-powered knowledge assistant, or a custom HTTP API bridge, AgentForge gives you a curated starting point with best practices baked in.

Built on top of the official MCP specification, AgentForge supports both Node.js (TypeScript) and Python templates, multiple transport layers (stdio, SSE, Streamable HTTP), and seamless integration with every major MCP-compatible client — Claude Desktop, Cursor, Windsurf, VS Code with Continue, and more. Every template ships with input validation, security hardening, structured logging, and test scaffolding so you can ship with confidence rather than reinventing the plumbing each time.

---

## Prerequisites

Before you begin, make sure you have the following installed and configured:

| Requirement | Minimum Version | Notes |
|---|---|---|
| **Node.js** | 18.0+ | Required for all TypeScript templates and the AgentForge CLI |
| **Python** | 3.11+ | Required only if you plan to use Python templates |
| **pnpm** (recommended) | 8.0+ | Or npm/yarn — pnpm is used in examples |
| **uv** (Python only) | latest | Fast Python package manager used by Python templates |
| **An MCP-compatible client** | — | Claude Desktop, Cursor, Windsurf, or VS Code with Continue |

### Verify your environment

```bash
node --version    # v18.x or higher
python --version  # 3.11.x or higher (only needed for Python templates)
pnpm --version    # 8.x or higher
```

> **Tip:** If you only plan to use TypeScript templates, you can skip the Python and `uv` prerequisites entirely.

---

## Installation

You can start a new AgentForge project in one of two ways.

### Option A: Use the CLI (recommended)

The fastest way to get started is with the `agentforge` CLI, which scaffolds a new project with interactive prompts:

```bash
npx agentforge init my-mcp-server
```

The CLI will ask you to choose:

1. **Language** — TypeScript or Python
2. **Template** — `hello-world-stdio`, `filesystem`, `database`, `rag-knowledge`, `http-api`, or `custom`
3. **Transport** — stdio, SSE, or Streamable HTTP
4. **Package manager** — pnpm, npm, or yarn (TypeScript) / uv or pip (Python)

Once complete, navigate into your new project:

```bash
cd my-mcp-server
pnpm install   # or: uv sync
```

### Option B: Clone the repository

If you prefer to browse all templates before deciding, clone the full repository:

```bash
git clone https://github.com/your-org/agentforge.git
cd agentforge
pnpm install
```

Individual templates live under `templates/` and can be copied out as needed.

---

## Your First MCP Server in 5 Minutes

This walkthrough uses the `hello-world-stdio` template, which is the simplest way to understand how an MCP server works.

### Step 1: Scaffold the project

```bash
npx agentforge init hello-server --template hello-world-stdio
cd hello-server
pnpm install
```

### Step 2: Explore the structure

```
hello-server/
├── src/
│   └── index.ts        # Server entry point and tool definitions
├── package.json
├── tsconfig.json
└── README.md
```

Open `src/index.ts` — you'll see something like this:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "hello-server",
  version: "1.0.0",
});

// Register a tool
server.tool(
  "greet",
  "Greet a user by name",
  {
    name: z.string().describe("The name of the person to greet"),
  },
  async ({ name }) => {
    return {
      content: [
        {
          type: "text",
          text: `Hello, ${name}! Welcome to AgentForge.`,
        },
      ],
    };
  }
);

// Start the server on stdio
const transport = new StdioServerTransport();
await server.connect(transport);
```

### Step 3: Build the server

```bash
pnpm build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

### Step 4: Test it manually

You can run the server directly to verify it starts without errors:

```bash
node dist/index.js
```

The server will start and wait for JSON-RPC messages on stdin. Press `Ctrl+C` to stop it. For a more interactive test, use the AgentForge inspector:

```bash
npx agentforge inspect
```

This opens a web-based UI where you can call tools, view resources, and inspect the protocol traffic.

### Step 5: Run the tests

```bash
pnpm test
```

Every template ships with unit tests for its tool handlers. You should see all tests pass.

---

## Connecting to Claude Desktop

Now that you have a working MCP server, let's connect it to Claude Desktop so you can use your tools from within a chat.

### Locate the config file

Claude Desktop stores its MCP server configuration in a JSON file:

| OS | Path |
|---|---|
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Windows** | `%APPDATA%\Claude\claude_desktop_config.json` |
| **Linux** | `~/.config/Claude/claude_desktop_config.json` |

> If the file doesn't exist, create it. You may need to create the directory first.

### Add your server

Edit `claude_desktop_config.json` and add your server:

```json
{
  "mcpServers": {
    "hello-server": {
      "command": "node",
      "args": ["C:\\path\\to\\hello-server\\dist\\index.js"]
    }
  }
}
```

> **Important:** Use absolute paths. On Windows, double-escape backslashes in JSON (`\\`).

### Restart Claude Desktop

Fully quit Claude Desktop (not just close the window) and restart it. Open a new chat and you should see a **hammer/tool icon** indicating your MCP server is connected.

Try asking Claude: *"Use the greet tool to say hello to Alice."*

Claude will call your `greet` tool and respond with: *"Hello, Alice! Welcome to AgentForge."*

For more details and troubleshooting, see the [Claude Desktop setup guide](./client-configs/claude-desktop.md).

---

## Next Steps

Now that you have a working MCP server connected to a client, here are some recommended next steps:

### Learn the fundamentals

- [Understanding MCP Architecture](./patterns/mcp-architecture.md) — Deep dive into the protocol, transports, and request lifecycle
- [AI Agent Design Patterns](./patterns/agent-design.md) — ReAct, tool-use, RAG, multi-agent orchestration, and more

### Connect more clients

- [Claude Desktop](./client-configs/claude-desktop.md)
- [Cursor](./client-configs/cursor.md)
- [Windsurf](./client-configs/windsurf.md)
- [VS Code with Continue](./client-configs/vscode.md)

### Deploy your server

- [Docker](./deployment/docker.md) — Containerized deployment for any environment
- [Vercel](./deployment/vercel.md) — Serverless HTTP/SSE deployment
- [Railway](./deployment/railway.md) — Managed PaaS with custom domains
- [Fly.io](./deployment/flyio.md) — Global edge deployment with persistent volumes
- [Cloudflare Workers](./deployment/cloudflare-workers.md) — Edge deployment with Workers
- [Self-hosted with systemd](./deployment/self-hosted.md) — Full control on your own servers

### Build with confidence

- [Security Best Practices](./patterns/security.md) — Path traversal, SQL injection, OAuth, rate limiting
- [Testing MCP Servers](./patterns/testing.md) — Unit tests, integration tests, security boundary tests

### Explore more templates

Run `npx agentforge init` and explore the full template gallery:

| Template | Description |
|---|---|
| `filesystem` | Secure file read/write with path traversal protection |
| `database` | SQL query agent with injection prevention |
| `rag-knowledge` | Retrieval-augmented generation with vector search |
| `http-api` | Bridge external REST APIs as MCP tools |
| `custom` | Start from scratch with the full scaffold |
