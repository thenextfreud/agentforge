# MCP Transports Explained: stdio, SSE, and Streamable HTTP

One of the first decisions you make when building an MCP server is which transport to use. The spec defines three, and the choice affects everything from how you deploy to how you debug. This guide covers when to use each, with practical examples.

## The three transports

| Transport | Use case | Connection | Direction |
|-----------|----------|------------|-----------|
| **stdio** | Local servers, CLI tools | Process stdin/stdout | Bidirectional |
| **SSE** | Web-deployed servers (deprecated) | HTTP + Server-Sent Events | Bidirectional over 2 connections |
| **Streamable HTTP** | Web-deployed servers (current) | Single HTTP endpoint | Bidirectional over 1 connection |

## stdio: The default choice

Most MCP servers run locally. Your AI client (Claude Desktop, Cursor) spawns your server as a child process and communicates over stdin/stdout. This is the simplest and most reliable transport.

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  { name: "my-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

**When to use stdio:**
- Local development tools
- Servers that access local resources (filesystem, local databases)
- CLI tools that don't need network access
- Anything that runs on the user's machine

**The critical rule:** Never use `console.log()`. stdout is the protocol channel — any stray output will corrupt the message stream. Use `console.error()` (stderr) for all logging:

```typescript
// WRONG — breaks the protocol
console.log("Server started");

// RIGHT — stderr is safe
console.error("[my-server] Server started");
```

## SSE: The legacy web transport

Server-Sent Events (SSE) was the original way to run MCP servers over HTTP. The server opens two connections: one for the client to send messages (POST), and one for the server to push messages back (SSE stream).

```typescript
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

// Set up two routes:
// GET /sse — the SSE stream (server → client)
// POST /messages — client → server messages
```

**SSE is deprecated.** The MCP spec moved to Streamable HTTP in 2025. If you're building a new web-deployed server, use Streamable HTTP instead. If you have an existing SSE server, plan to migrate.

## Streamable HTTP: The current web transport

Streamable HTTP consolidates everything into a single endpoint. The client POSTs JSON-RPC messages, and the server can respond either with a plain JSON response (for simple requests) or upgrade to an SSE stream (for long-running operations).

```python
from mcp.server import Server
from mcp.server.streamable_http import StreamableHTTPServerTransport

server = Server("my-server")

async def handle_streamable_http(scope, receive, send):
    transport = StreamableHTTPServerTransport()
    await transport.handle_request(scope, receive, send)

# Run with an ASGI server (uvicorn, hypercorn)
```

**When to use Streamable HTTP:**
- Servers deployed to the web (Vercel, Railway, Fly.io, Cloudflare Workers)
- Servers that need OAuth authentication
- Servers accessed by multiple clients simultaneously
- Servers behind a load balancer

**Key advantage:** Unlike stdio, the server doesn't need to be installed locally. Clients connect over HTTP, which means you can share a single MCP server across teams, add authentication, and scale horizontally.

## Practical decision guide

```
Is your server local-only (filesystem, local DB, CLI)?
  → Use stdio
  
Does your server need to be accessed over the web?
  → Use Streamable HTTP
  
Are you wrapping a SaaS API that needs OAuth?
  → Use Streamable HTTP with OAuth middleware
  
Are you building a prototype or learning MCP?
  → Start with stdio, migrate later if needed
```

## Migrating from stdio to Streamable HTTP

One of the nice things about MCP is that the transport is decoupled from your tool logic. Your tools, handlers, and schemas stay the same — only the transport layer changes.

```typescript
// Your tool definitions and handlers don't change
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [/* same as before */],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // same logic as before
});

// Only the transport changes:
// Before (stdio):
const transport = new StdioServerTransport();

// After (Streamable HTTP):
const transport = new StreamableHTTPServerTransport({ /* config */ });
```

This is why the AgentForge templates separate transport setup from tool logic — it makes migration trivial.

## Debugging transport issues

**stdio:** If your server isn't showing up in the client, check:
1. Is the path in your client config correct?
2. Does `node path/to/server.js` run without errors?
3. Are you accidentally writing to stdout?
4. Check the client's MCP logs (Claude Desktop: `~/Library/Logs/Claude/`)

**Streamable HTTP:** If connections fail:
1. Is the server actually listening on the expected port?
2. Are CORS headers set correctly?
3. Is your OAuth token valid?
4. Check that the endpoint returns the right content type

## Client configuration examples

### stdio (Claude Desktop)
```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["/path/to/dist/index.js"]
    }
  }
}
```

### Streamable HTTP (Cursor)
```json
{
  "mcpServers": {
    "my-server": {
      "url": "https://my-server.example.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```

## Key takeaways

1. **Start with stdio.** It's the simplest, most compatible, and works everywhere.
2. **Move to Streamable HTTP when you need web deployment.** SSE is deprecated.
3. **Never log to stdout in stdio mode.** This is the #1 source of mysterious bugs.
4. **Transport is decoupled from tool logic.** Migrating is a one-line change.
5. **Streamable HTTP enables auth, scaling, and sharing.** Use it for production web servers.

---

*The [AgentForge templates](https://github.com/thenextfreud/agentforge) include working examples of both stdio and Streamable HTTP transports, with deployment configs for Docker, Vercel, Railway, Fly.io, and Cloudflare Workers.*
