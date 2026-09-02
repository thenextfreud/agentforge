# Building Your First MCP Server: A Practical Guide

The Model Context Protocol (MCP) is becoming the standard way to connect AI assistants to external tools and data sources. But the spec is dense, and most examples are either too simple (a single echo tool) or too complex (full production servers with auth, streaming, and deployment).

This guide bridges that gap. We'll build a real, useful MCP server — one that wraps a REST API — and cover the patterns that matter: input validation, error handling, logging, and client configuration.

## What we're building

A simple MCP server that wraps the JSONPlaceholder API (a free fake REST API for testing). It will expose three tools:

- `list-posts` — Get a paginated list of posts
- `get-post` — Get a single post by ID
- `create-post` — Create a new post

## Prerequisites

- Node.js 18+
- An MCP-compatible client (Claude Desktop, Cursor, Windsurf, etc.)

## Step 1: Project setup

```bash
mkdir my-mcp-server && cd my-mcp-server
npm init -y
npm install @modelcontextprotocol/sdk zod
npm install -D typescript @types/node tsx
npx tsc --init
```

Set your `tsconfig.json` to target ES2022 with Node module resolution:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

## Step 2: The server skeleton

Create `src/index.ts`:

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "jsonplaceholder-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// We'll add tools here in the next steps

const transport = new StdioServerTransport();
await server.connect(transport);
```

This is the minimum viable server. It runs over stdio (the standard transport for local MCP servers) and doesn't do anything yet. Let's add tools.

## Step 3: Defining tools

MCP tools are defined with a name, description, and input schema (using Zod for validation):

```typescript
import { z } from "zod";

const ListPostsSchema = z.object({
  limit: z.number().min(1).max(100).default(10).optional(),
  offset: z.number().min(0).default(0).optional(),
});

const GetPostSchema = z.object({
  id: z.number().int().positive(),
});

const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  userId: z.number().int().positive(),
});
```

Now register them with the server:

```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list-posts",
      description: "Get a paginated list of posts from JSONPlaceholder",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", minimum: 1, maximum: 100, default: 10 },
          offset: { type: "number", minimum: 0, default: 0 },
        },
      },
    },
    {
      name: "get-post",
      description: "Get a single post by ID",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "number" },
        },
        required: ["id"],
      },
    },
    {
      name: "create-post",
      description: "Create a new post",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          body: { type: "string" },
          userId: { type: "number" },
        },
        required: ["title", "body", "userId"],
      },
    },
  ],
}));
```

## Step 4: Handling tool calls

The `CallToolRequestSchema` handler is where your tools actually execute:

```typescript
const API_BASE = "https://jsonplaceholder.typicode.com";

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list-posts": {
        const { limit = 10, offset = 0 } = ListPostsSchema.parse(args);
        const res = await fetch(
          `${API_BASE}/posts?_limit=${limit}&_start=${offset}`
        );
        const posts = await res.json();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(posts, null, 2),
            },
          ],
        };
      }

      case "get-post": {
        const { id } = GetPostSchema.parse(args);
        const res = await fetch(`${API_BASE}/posts/${id}`);
        if (!res.ok) {
          return {
            content: [{ type: "text", text: `Post ${id} not found` }],
            isError: true,
          };
        }
        const post = await res.json();
        return {
          content: [
            { type: "text", text: JSON.stringify(post, null, 2) },
          ],
        };
      }

      case "create-post": {
        const input = CreatePostSchema.parse(args);
        const res = await fetch(`${API_BASE}/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const created = await res.json();
        return {
          content: [
            {
              type: "text",
              text: `Created post with ID ${created.id}\n${JSON.stringify(created, null, 2)}`,
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});
```

## Step 5: Error handling patterns

The code above has basic error handling, but production servers need more. Here are the patterns that matter:

**Structured errors.** Don't just catch and stringify. Return meaningful error types:

```typescript
class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public isRetryable: boolean
  ) {
    super(message);
  }
}

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new ApiError(
      `API returned ${res.status}`,
      res.status,
      res.status >= 500
    );
  }
  return res;
}
```

**Logging to stderr.** MCP servers communicate over stdout, so `console.log` will break the protocol. Always use `console.error` (stderr) for logging:

```typescript
function log(message: string, ...args: unknown[]) {
  console.error(`[my-server] ${message}`, ...args);
}
```

## Step 6: Connecting to a client

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "jsonplaceholder": {
      "command": "node",
      "args": ["path/to/your/dist/index.js"]
    }
  }
}
```

### Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "jsonplaceholder": {
      "command": "npx",
      "args": ["tsx", "path/to/your/src/index.ts"]
    }
  }
}
```

Restart your client and you should see the tools available. Try asking: "List the first 5 posts from JSONPlaceholder" — the AI will call your `list-posts` tool.

## What's next?

This server works, but production servers need more:

- **Retries with exponential backoff** for flaky APIs
- **Rate limiting** to avoid hammering upstream services
- **Authentication** (API keys, OAuth) for protected endpoints
- **Pagination handling** that returns cursors, not just offsets
- **SSE transport** for web-based deployments instead of stdio

These patterns are all implemented in the [AgentForge templates](https://github.com/thenextfreud/agentforge) — free, MIT-licensed, ready to clone and modify.

## Key takeaways

1. **Start with stdio.** It's the simplest transport and works with all major clients. Move to SSE/HTTP only when you need web deployment.
2. **Validate everything.** Zod schemas protect against malformed input from the AI model.
3. **Use stderr for logging.** stdout is the protocol channel — never pollute it.
4. **Return structured errors.** `isError: true` with a clear message helps the AI recover and retry.
5. **Keep tools focused.** One tool = one action. Don't build a "do-everything" tool.

---

*The full code from this guide and 9 more templates (RAG, OAuth, streaming, database, filesystem, and more) are available at [github.com/thenextfreud/agentforge](https://github.com/thenextfreud/agentforge). MIT licensed, free to use.*
