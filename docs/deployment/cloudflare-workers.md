# Cloudflare Workers Deployment

Cloudflare Workers run your code on Cloudflare's global edge network in 300+ cities. This guide covers wrapping an MCP server as a Cloudflare Worker, configuring `wrangler.toml`, and understanding the platform's limitations.

---

## Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up)
- `wrangler` CLI installed:

  ```bash
  npm install -g wrangler
  # or use npx without installing:
  npx wrangler --version
  ```

- Log in to Cloudflare:
  ```bash
  wrangler login
  ```

---

## Wrapping an MCP Server as a Worker

Cloudflare Workers use the Fetch API — they receive a `Request` and return a `Response`. AgentForge's HTTP templates can be adapted to run as Workers by wrapping the MCP server's request handler in a Fetch event listener.

### Project structure

```
my-mcp-worker/
├── src/
│   └── index.ts        # Worker entry point
├── wrangler.toml       # Cloudflare configuration
├── package.json
└── tsconfig.json
```

### Worker entry point

```typescript
// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Define your tools
function createServer(): McpServer {
  const server = new McpServer({
    name: "my-mcp-worker",
    version: "1.0.0",
  });

  server.tool(
    "greet",
    "Greet a user by name",
    { name: z.string().describe("The name of the person to greet") },
    async ({ name }) => ({
      content: [{ type: "text", text: `Hello, ${name}!` }],
    })
  );

  server.tool(
    "get_weather",
    "Get the current weather for a city",
    { city: z.string().describe("City name") },
    async ({ city }) => {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${env.WEATHER_API_KEY}`
      );
      const data = await response.json();
      return {
        content: [{
          type: "text",
          text: `Weather in ${city}: ${data.weather[0].description}, ${Math.round(data.main.temp - 273.15)}°C`,
        }],
      };
    }
  );

  return server;
}

// Cloudflare Worker fetch handler
export default {
  async fetch(request: Request, env: Record<string, string>): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // MCP endpoint — handle POST for Streamable HTTP
    if (url.pathname === "/mcp") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }

      const server = createServer();

      // Use the Streamable HTTP transport adapted for Workers
      // Note: Workers don't have Node.js stdio, so we use HTTP-only transports
      const { handleRequest } = await import("./mcp-handler");

      return handleRequest(request, server, env);
    }

    return new Response("Not found", { status: 404 });
  },
};
```

### MCP handler for Workers

Since Cloudflare Workers don't support Node.js-specific APIs (no `http` module, no `net` module), you need to adapt the MCP transport to work with the Fetch API:

```typescript
// src/mcp-handler.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export async function handleRequest(
  request: Request,
  server: McpServer,
  env: Record<string, string>
): Promise<Response> {
  const body = await request.json();

  // Process the JSON-RPC request
  const result = await server.handleRequest(body);

  return new Response(JSON.stringify(result), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
```

> **Note:** The MCP SDK is evolving to provide first-class Worker support. Check the latest SDK documentation for the recommended integration pattern. The above is a simplified example — production deployments should use the SDK's built-in HTTP transport when available.

### Handling CORS

MCP clients may connect from browsers or extensions, so CORS headers are important:

```typescript
function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

// Handle preflight requests
if (request.method === "OPTIONS") {
  return new Response(null, { headers: corsHeaders() });
}
```

---

## Example wrangler.toml

```toml
# wrangler.toml
name = "my-mcp-server"
main = "src/index.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

# Environment variables (non-secret)
[vars]
LOG_LEVEL = "info"
ALLOWED_ORIGINS = "*"

# Secret environment variables (set via `wrangler secret put`)
# WEATHER_API_KEY = ... (set with: wrangler secret put WEATHER_API_KEY)

# Optional: custom domain
# [[routes]]
# pattern = "mcp.mydomain.com/*"
# custom_domain = true

# Optional: KV namespace for key-value storage
# [[kv_namespaces]]
# binding = "MCP_KV"
# id = "your-kv-namespace-id"

# Optional: Durable Objects for stateful connections
# [[durable_objects.bindings]]
# name = "MCP_SESSIONS"
# class_name = "McpSession"

# Optional: R2 bucket for object storage
# [[r2_buckets]]
# binding = "MCP_STORAGE"
# bucket_name = "my-mcp-storage"

# Worker limits
[limits]
cpu_ms = 50  # max CPU time per request in milliseconds
```

### Key configuration options

| Field | Description |
|---|---|
| `name` | Worker name (becomes part of the URL: `name.subdomain.workers.dev`) |
| `main` | Entry point file |
| `compatibility_date` | Date for compatibility behavior (use a recent date) |
| `compatibility_flags` | Enable `nodejs_compat` for Node.js API support |
| `[vars]` | Non-secret environment variables |
| `[[routes]]` | Custom domain routing |
| `[[kv_namespaces]]` | KV namespace bindings (key-value storage) |
| `[[r2_buckets]]` | R2 bucket bindings (S3-compatible object storage) |
| `[[durable_objects.bindings]]` | Durable Objects for stateful logic |
| `[limits]` | CPU and memory limits |

---

## Environment Secrets

### Setting secrets

Secrets are encrypted and not visible in `wrangler.toml`:

```bash
wrangler secret put OPENAI_API_KEY
# You'll be prompted to enter the value

wrangler secret put DATABASE_URL
```

### Listing secrets

```bash
wrangler secret list
```

This shows secret names (not values).

### Deleting secrets

```bash
wrangler secret delete OLD_KEY
```

### Accessing secrets in code

Secrets and `[vars]` are both available on the `env` object passed to your Worker:

```typescript
export default {
  async fetch(request: Request, env: Record<string, string>): Promise<Response> {
    const apiKey = env.OPENAI_API_KEY;  // from `wrangler secret put`
    const logLevel = env.LOG_LEVEL;     // from [vars] in wrangler.toml
    // ...
  },
};
```

---

## Deploying

### Deploy to production

```bash
wrangler deploy
```

Your Worker is deployed to:
```
https://my-mcp-server.<your-subdomain>.workers.dev
```

### Test the deployment

```bash
# Health check
curl https://my-mcp-server.your-subdomain.workers.dev/health

# MCP endpoint
curl -X POST https://my-mcp-server.your-subdomain.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'
```

### Connect your MCP client

```json
{
  "mcpServers": {
    "my-worker": {
      "url": "https://my-mcp-server.your-subdomain.workers.dev/mcp",
      "transport": "streamable-http"
    }
  }
}
```

### Local development

```bash
wrangler dev
```

This starts a local development server at `http://localhost:8787` with your secrets and vars loaded.

---

## Using Cloudflare Storage Instead of a Filesystem

Since Workers don't have a persistent filesystem, use Cloudflare's storage options:

### KV (key-value store) — for simple data

```typescript
// Store data
await env.MCP_KV.put("key", JSON.stringify(value));

// Retrieve data
const value = await env.MCP_KV.get("key");
```

### R2 (S3-compatible object storage) — for files

```typescript
// Store a file
await env.MCP_STORAGE.put("documents/report.pdf", fileData);

// Retrieve a file
const object = await env.MCP_STORAGE.get("documents/report.pdf");
const data = await object.arrayBuffer();
```

### Durable Objects — for stateful sessions

Durable Objects are useful for maintaining MCP session state across requests:

```typescript
export class McpSession {
  state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    // Handle session-specific requests
    // State persists across requests within the same session
  }
}
```

---

## Limitations

### No stdio support

Cloudflare Workers are HTTP-only — there is no standard input/output. **stdio MCP servers cannot be deployed to Workers.** Only HTTP-based transports (Streamable HTTP, and limited SSE) work on Workers.

### No persistent filesystem

Workers have an ephemeral filesystem. Any files written during a request are lost when the request completes. **Filesystem templates cannot use local storage on Workers.**

Alternatives:
- **R2** for object/file storage (S3-compatible).
- **KV** for simple key-value data.
- **Durable Objects** for stateful sessions.

### CPU time limits

| Plan | CPU Time Limit |
|---|---|
| Free | 10 ms per request |
| Paid | 50 ms per request (default), up to 30,000 ms with `limits.cpu_ms` |

> **Impact:** Tool calls that perform heavy computation (large data processing, complex calculations) may exceed the CPU time limit. Move heavy work to an external service or use Cloudflare's Durable Objects with extended limits.

### No long-lived connections (SSE challenges)

Workers are designed for short-lived request-response cycles. While Cloudflare has added some support for streaming responses, long-lived SSE connections may be terminated after a timeout:

- **Free plan:** SSE connections may be cut after ~30 seconds.
- **Paid plan:** Longer timeouts, but still not ideal for persistent SSE.

**Recommendation:** Use the **Streamable HTTP** transport instead of SSE for Workers. Streamable HTTP uses individual POST requests for each interaction, which fits the Worker model perfectly.

### No Node.js APIs (without compatibility flags)

Workers run on the V8 isolate runtime, not Node.js. Without the `nodejs_compat` flag, many Node.js APIs (`fs`, `path`, `crypto`, `http`) are unavailable. Enable the flag in `wrangler.toml`:

```toml
compatibility_flags = ["nodejs_compat"]
```

Even with this flag, not all Node.js APIs are fully supported. Test your server thoroughly on Workers before deploying to production.

### Memory limits

| Plan | Memory Limit |
|---|---|
| Free | 128 MB |
| Paid | 128 MB |

Large responses or in-memory data processing may hit this limit. For memory-intensive operations, use external storage (R2, KV) and stream responses.

---

## When to Choose Workers vs. Other Platforms

| Requirement | Recommended Platform |
|---|---|
| Ultra-low latency globally | Cloudflare Workers |
| Persistent filesystem | Fly.io, Railway, or self-hosted |
| Long-lived SSE connections | Fly.io, Railway, or Vercel |
| Heavy computation | Fly.io or Railway |
| Simple HTTP tools, global edge | Cloudflare Workers |
| Cost-sensitive (free tier) | Cloudflare Workers (free tier) or Vercel |

Workers excel at lightweight, stateless MCP servers that need global edge deployment — think API bridge tools, simple data lookups, and read-only query servers. For anything requiring persistent state, heavy computation, or long-lived connections, consider Fly.io or Railway instead.
