# Understanding MCP Architecture

The Model Context Protocol (MCP) is an open standard that defines how AI applications communicate with external tools, data sources, and services. This guide provides a deep dive into the protocol's architecture, transports, lifecycle, and error handling patterns.

---

## What is the Model Context Protocol?

The Model Context Protocol (MCP) is a JSON-RPC 2.0-based protocol that standardizes the connection between AI applications (clients) and external capabilities (servers). It was introduced by Anthropic in 2024 to solve a fundamental problem: every AI application that needed tool use, data access, or custom capabilities previously required bespoke integration code. MCP provides a universal, well-specified interface so that any MCP-compatible client (Claude Desktop, Cursor, Windsurf, VS Code with Continue) can connect to any MCP server.

### The client-server model

MCP follows a client-server architecture:

```
┌──────────────┐       JSON-RPC       ┌──────────────┐
│              │ ◄──────────────────► │              │
│  MCP Client  │   (stdio / HTTP)     │  MCP Server  │
│  (Claude,    │                      │  (Your code) │
│   Cursor)    │                      │              │
└──────────────┘                      └──────────────┘
```

- **MCP Client** — The AI application (e.g., Claude Desktop). It discovers what the server offers, calls tools on behalf of the AI model, and presents results back to the user.
- **MCP Server** — Your AgentForge application. It exposes capabilities (tools, resources, prompts) and handles requests from the client.

### Protocol versioning

MCP uses a protocol version string (e.g., `2024-11-05`) negotiated during the initialization handshake. Both client and server must agree on a version before communication proceeds. AgentForge templates target the latest stable protocol version and are updated as new versions are released.

---

## Tools vs Resources vs Prompts

MCP servers expose three types of capabilities. Understanding the distinction is critical for designing effective servers.

### Tools

Tools are executable functions that the AI model can call to perform actions or retrieve dynamic data. They are the most commonly used capability.

- **Invoked by:** The AI model (via the client) when it decides an action is needed.
- **Can have side effects:** Yes — tools can write files, query databases, make API calls, etc.
- **Return type:** Content blocks (text, images, embedded resources).
- **Defined by:** A name, description, and a JSON Schema for input parameters.

```typescript
server.tool(
  "create_file",
  "Create a new file with the given content",
  {
    path: z.string().describe("Absolute path for the new file"),
    content: z.string().describe("File contents"),
  },
  async ({ path, content }) => {
    writeFileSync(path, content);
    return {
      content: [{ type: "text", text: `Created ${path}` }],
    };
  }
);
```

**When to use tools:** Any time the AI needs to take an action (create, update, delete, query, compute, fetch) or retrieve data that can't be statically provided.

### Resources

Resources are static or semi-static data that the AI can read. Think of them as files or documents the AI can reference.

- **Accessed by:** The client (typically at the user's request or when the AI needs context).
- **No side effects:** Resources are read-only.
- **Return type:** Content (text or binary).
- **Defined by:** A URI, name, description, and MIME type.

```typescript
server.resource(
  "config",
  "config://app/settings",
  { description: "Application configuration", mimeType: "application/json" },
  () => ({
    contents: [{
      uri: "config://app/settings",
      mimeType: "application/json",
      text: JSON.stringify(appConfig, null, 2),
    }],
  })
);
```

**When to use resources:** Configuration files, documentation, schemas, templates, or any reference data that provides context but doesn't need to be "called" as a function.

### Prompts

Prompts are pre-defined prompt templates that users can invoke. They provide structured ways to interact with the AI.

- **Invoked by:** The user (via the client's UI) selecting a prompt from a menu.
- **Can include:** Dynamic parameters, tool/resource references, and instructions.
- **Return type:** Messages to be sent to the AI model.

```typescript
server.prompt(
  "code-review",
  "Review code for best practices",
  { language: z.string().describe("Programming language"), code: z.string() },
  ({ language, code }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Review this ${language} code for best practices, potential bugs, and improvements:\n\n${code}`,
      },
    }],
  })
);
```

**When to use prompts:** Common workflows that users perform repeatedly (code review, data analysis, document summarization) where you want to provide a structured starting point.

### Summary

| Capability | Invoked By | Side Effects | Use Case |
|---|---|---|---|
| **Tools** | AI model | Yes | Actions, queries, computations |
| **Resources** | User / AI | No | Reference data, context |
| **Prompts** | User | No | Structured workflows, templates |

---

## stdio vs SSE vs Streamable HTTP Transports

MCP supports multiple transport layers. The transport determines how messages are physically sent between client and server.

### stdio

**How it works:** The client spawns the server as a child process. Communication happens over the process's standard input (stdin) and standard output (stdout). Messages are newline-delimited JSON-RPC.

```
Client (parent process)
  │
  ├── stdin  ──►  Server (child process)
  │
  └── stdout ◄──  Server (child process)
```

**Characteristics:**
- ✅ Simplest to set up — no network configuration needed.
- ✅ Zero latency — communication is in-process pipes.
- ✅ Secure by default — no network exposure.
- ❌ Local only — the server must run on the same machine as the client.
- ❌ One client per server process.
- ❌ No support for HTTP-based features (webhooks, OAuth callbacks).

**When to use stdio:** Local development, personal tools, filesystem servers, and any scenario where the client and server are on the same machine. This is the default for Claude Desktop.

### SSE (Server-Sent Events)

**How it works:** The server runs as an HTTP service. The client opens a long-lived SSE connection to receive server-to-client messages, and sends client-to-server messages via HTTP POST requests.

```
Client                          Server
  │                               │
  ├── GET /sse ──────────────────►│  (open SSE stream)
  │◄─────── events ──────────────│  (server → client)
  │                               │
  ├── POST /messages ────────────►│  (client → server)
  │                               │
```

**Characteristics:**
- ✅ Works over the network — server can be remote.
- ✅ Supports multiple clients.
- ✅ Works with standard HTTP infrastructure (proxies, load balancers).
- ❌ Requires a persistent connection — can be problematic with proxies that timeout.
- ❌ Two endpoints — slightly more complex than Streamable HTTP.
- ❌ SSE is unidirectional (server → client); client messages use separate POST requests.

**When to use SSE:** Remote deployments where you need real-time server-to-client streaming, or when deploying to platforms that support long-lived HTTP connections (Fly.io, Railway, self-hosted with Nginx).

### Streamable HTTP

**How it works:** The newest transport, Streamable HTTP uses a single endpoint for all communication. Each client request is an HTTP POST, and the server can respond with either a single JSON response or an SSE stream (for streaming results).

```
Client                          Server
  │                               │
  ├── POST /mcp ─────────────────►│  (JSON-RPC request)
  │◄─── JSON response ───────────│  (or SSE stream)
  │                               │
```

**Characteristics:**
- ✅ Single endpoint — simpler than SSE.
- ✅ Works over the network.
- ✅ Supports multiple clients.
- ✅ Stateless-friendly — better for serverless platforms.
- ✅ Can optionally stream responses via SSE.
- ✅ Better through proxies and CDNs.
- ❌ Newer — not all clients support it yet (check your client's documentation).

**When to use Streamable HTTP:** Remote deployments, especially on serverless platforms (Vercel, Cloudflare Workers) where long-lived SSE connections are problematic. This is the recommended transport for new HTTP-based servers.

---

## When to Use Each Transport

| Scenario | Recommended Transport |
|---|---|
| Local development with Claude Desktop | **stdio** |
| Personal filesystem server | **stdio** |
| Remote server on Vercel | **Streamable HTTP** |
| Remote server on Cloudflare Workers | **Streamable HTTP** |
| Remote server on Fly.io / Railway | **SSE** or **Streamable HTTP** |
| Self-hosted with Nginx | **SSE** or **Streamable HTTP** |
| Serverless (short-lived) | **Streamable HTTP** |
| Multiple clients connecting simultaneously | **SSE** or **Streamable HTTP** |
| Need maximum compatibility with all clients | **stdio** (local) or **SSE** (remote) |

> **AgentForge tip:** All AgentForge templates support multiple transports. You can switch between them with a configuration flag or environment variable — no code changes needed.

---

## Request/Response Lifecycle

Understanding the MCP request/response lifecycle helps with debugging and building robust servers.

### 1. Initialization handshake

Every MCP connection begins with an initialization handshake:

```
Client                                          Server
  │                                               │
  │── initialize ────────────────────────────────►│
  │   { protocolVersion, capabilities, clientInfo }│
  │                                               │
  │◄── initialize result ────────────────────────│
  │   { protocolVersion, capabilities, serverInfo }│
  │                                               │
  │── notifications/initialized ────────────────►│
  │                                               │
```

**Client sends `initialize`:**
```json
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "roots": { "listChanged": true },
      "sampling": {}
    },
    "clientInfo": {
      "name": "claude-desktop",
      "version": "1.0.0"
    }
  },
  "id": 1
}
```

**Server responds:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": { "listChanged": true },
      "resources": { "subscribe": true },
      "prompts": {}
    },
    "serverInfo": {
      "name": "my-mcp-server",
      "version": "1.0.0"
    }
  },
  "id": 1
}
```

**Client sends `notifications/initialized`:**
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/initialized"
}
```

### 2. Capability discovery

After initialization, the client discovers what the server offers:

```
Client                                          Server
  │                                               │
  │── tools/list ────────────────────────────────►│
  │◄── [tool definitions] ───────────────────────│
  │                                               │
  │── resources/list ────────────────────────────►│
  │◄── [resource definitions] ───────────────────│
  │                                               │
  │── prompts/list ──────────────────────────────►│
  │◄── [prompt definitions] ─────────────────────│
  │                                               │
```

### 3. Tool invocation

When the AI model decides to call a tool:

```
Client                                          Server
  │                                               │
  │── tools/call ────────────────────────────────►│
  │   { name: "read_file", args: { path: "/data" } }│
  │                                               │
  │◄── tool result ──────────────────────────────│
  │   { content: [{ type: "text", text: "..." }] } │
  │                                               │
```

**Client sends `tools/call`:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "read_file",
    "arguments": { "path": "/data/config.json" }
  },
  "id": 2
}
```

**Server responds:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      { "type": "text", "text": "{ \"database\": \"postgres\" }" }
    ]
  },
  "id": 2
}
```

### 4. Notifications

Either side can send notifications (messages without an `id` that don't expect a response):

- `notifications/initialized` — Client confirms initialization is complete.
- `notifications/tools/list_changed` — Server tells the client its tool list has changed (client should re-fetch).
- `notifications/resources/list_changed` — Server tells the client its resource list has changed.
- `notifications/resources/updated` — Server tells the client a specific resource has been updated.

### 5. Shutdown

For stdio, the client closes the connection by terminating the child process. For HTTP transports, the client sends a `shutdown` request or simply closes the HTTP connection.

---

## Error Handling Patterns

MCP uses JSON-RPC 2.0 error codes. Proper error handling ensures the AI model can understand what went wrong and take corrective action.

### Standard error codes

| Code | Meaning | When to use |
|---|---|---|
| `-32700` | Parse error | Invalid JSON received |
| `-32600` | Invalid request | The JSON is valid but not a valid request object |
| `-32601` | Method not found | The requested method doesn't exist or isn't available |
| `-32602` | Invalid params | Required parameters are missing or invalid |
| `-32603` | Internal error | An unexpected error occurred on the server |

### Tool execution errors

When a tool call fails, return an error result (not a JSON-RPC error). This lets the AI model understand the failure and potentially retry or try a different approach:

```typescript
server.tool(
  "read_file",
  "Read a file",
  { path: z.string() },
  async ({ path }) => {
    try {
      const content = readFileSync(path, "utf-8");
      return {
        content: [{ type: "text", text: content }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Error reading file: ${error instanceof Error ? error.message : "Unknown error"}`,
        }],
      };
    }
  }
);
```

> **Key distinction:** Use `isError: true` for tool-level errors (file not found, permission denied, invalid input). Use JSON-RPC error responses for protocol-level errors (unknown method, malformed request).

### Input validation errors

Validate all inputs with Zod (TypeScript) or Pydantic (Python). The MCP SDK automatically returns validation errors to the client when the schema doesn't match:

```typescript
server.tool(
  "query_database",
  "Execute a SQL query",
  {
    sql: z.string().min(1).describe("SQL query to execute"),
    limit: z.number().int().positive().max(1000).default(100).describe("Max rows to return"),
  },
  async ({ sql, limit }) => {
    // Input is already validated by Zod
    const results = await db.query(sql, limit);
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    };
  }
);
```

If the client sends invalid input, the SDK returns a `-32602` (Invalid params) error automatically.

### Graceful degradation

Design tools to degrade gracefully rather than crashing:

```typescript
server.tool(
  "fetch_weather",
  "Get weather for a city",
  { city: z.string() },
  async ({ city }) => {
    try {
      const response = await fetch(`https://api.weather.example.com?q=${encodeURIComponent(city)}`);
      
      if (!response.ok) {
        return {
          isError: true,
          content: [{
            type: "text",
            text: `Weather service returned HTTP ${response.status}. The service may be temporarily unavailable.`,
          }],
        };
      }

      const data = await response.json();
      return {
        content: [{ type: "text", text: `Weather: ${data.description}, ${data.temp}°C` }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Failed to fetch weather: ${error instanceof Error ? error.message : "Network error"}. Please try again.`,
        }],
      };
    }
  }
);
```

### Error handling best practices

1. **Never crash the server** — Catch all errors in tool handlers and return them as `isError: true` results.
2. **Provide actionable messages** — Tell the AI what went wrong and what it can do instead. "File not found at /data/config.json. Use the list_files tool to see available files." is better than "ENOENT".
3. **Log errors server-side** — Use structured logging to record errors for debugging, even when returning user-friendly messages to the client.
4. **Validate before executing** — Use schema validation to catch invalid inputs before they reach your business logic.
5. **Use timeouts** — Wrap external calls (APIs, database queries) in timeouts to prevent hanging.
6. **Don't leak sensitive information** — Error messages should not include stack traces, file paths, or internal details in production.

```typescript
import { setTimeout } from "timers/promises";

server.tool(
  "fetch_api",
  "Fetch data from an external API",
  { url: z.string().url() },
  async ({ url }) => {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const data = await response.json();
      return { content: [{ type: "text", text: JSON.stringify(data) }] };
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        return {
          isError: true,
          content: [{ type: "text", text: "The request timed out after 10 seconds. The API may be slow or unresponsive." }],
        };
      }
      // Log the full error internally
      console.error("fetch_api error:", error);
      // Return a safe message
      return {
        isError: true,
        content: [{ type: "text", text: "Failed to fetch data from the API. Please try again later." }],
      };
    }
  }
);
```
