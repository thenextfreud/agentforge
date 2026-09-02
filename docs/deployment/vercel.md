# Vercel Deployment

Vercel is an ideal platform for deploying HTTP/SSE MCP servers built with Next.js. AgentForge's HTTP templates are designed to work as Next.js API routes, making deployment a one-click experience.

---

## Deploying HTTP/SSE MCP Servers as Next.js API Routes

AgentForge's HTTP/SSE templates use Next.js's App Router with route handlers. The MCP server runs inside a Next.js API route, handling SSE or Streamable HTTP connections.

### Project structure

```
my-mcp-server/
├── app/
│   ├── api/
│   │   └── mcp/
│   │       └── route.ts    # MCP server endpoint
│   ├── page.tsx            # Landing page (optional)
│   └── layout.tsx
├── package.json
├── next.config.js
└── vercel.json
```

### The API route handler

```typescript
// app/api/mcp/route.ts
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export const maxDuration = 60; // seconds

export async function POST(request: Request) {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  
  const server = new McpServer({
    name: "my-mcp-server",
    version: "1.0.0",
  });

  server.tool("greet", "Greet a user", { name: z.string() }, async ({ name }) => ({
    content: [{ type: "text", text: `Hello, ${name}!` }],
  }));

  await server.connect(transport);

  return transport.handleRequest(request);
}

export async function GET(request: Request) {
  // Handle SSE if using SSE transport
  // Or return 405 for Streamable HTTP (which only uses POST)
  return new Response("Method not allowed", { status: 405 });
}
```

### Deploying with the Vercel CLI

1. **Install the Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Log in to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy from your project directory:**
   ```bash
   vercel
   ```

4. **Follow the prompts:**
   - Confirm the project settings
   - Select your Vercel team/account
   - Choose a project name (or accept the default)

5. **Deploy to production:**
   ```bash
   vercel --prod
   ```

Your MCP server will be available at:
```
https://your-project.vercel.app/api/mcp
```

### Deploying via Git integration

For automatic deployments on every push:

1. Push your project to GitHub, GitLab, or Bitbucket.
2. Go to [vercel.com](https://vercel.com) and click **"Add New" > "Project"**.
3. Import your repository.
4. Vercel will auto-detect Next.js — accept the default settings.
5. Click **Deploy**.

Every push to your `main` branch will trigger a production deployment. Pushes to other branches create preview deployments.

---

## Deploying the Landing Page

AgentForge templates include an optional landing page at `app/page.tsx`. This page displays your server's available tools, resources, and connection instructions.

### Customizing the landing page

Edit `app/page.tsx` to add your branding, documentation links, and usage instructions:

```tsx
// app/page.tsx
export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-4xl font-bold text-gray-900">
          My MCP Server
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          A custom MCP server providing tools for data analysis.
        </p>

        <h2 className="mt-8 text-2xl font-semibold">Available Tools</h2>
        <ul className="mt-4 space-y-2">
          <li><code>greet</code> — Greet a user by name</li>
          <li><code>analyze_data</code> — Analyze a dataset</li>
        </ul>

        <h2 className="mt-8 text-2xl font-semibold">Connect</h2>
        <pre className="mt-4 bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
{`{
  "mcpServers": {
    "my-server": {
      "url": "https://your-project.vercel.app/api/mcp",
      "transport": "streamable-http"
    }
  }
}`}
        </pre>
      </div>
    </div>
  );
}
```

The landing page deploys automatically alongside your API routes — no extra configuration needed.

---

## Environment Variable Configuration

### Setting environment variables in the Vercel dashboard

1. Go to your project on [vercel.com](https://vercel.com).
2. Navigate to **Settings > Environment Variables**.
3. Add each variable:

   | Key | Value | Environments |
   |---|---|---|
   | `OPENAI_API_KEY` | `sk-...` | Production, Preview |
   | `DATABASE_URL` | `postgresql://...` | Production |
   | `ALLOWED_DIRECTORIES` | `/data` | Production, Preview |

4. Click **Save**.
5. Redeploy for the changes to take effect: `vercel --prod`

### Setting environment variables via CLI

```bash
vercel env add OPENAI_API_KEY
vercel env add DATABASE_URL
```

You'll be prompted to enter the value and select the environments.

### Using a .env file locally

For local development, create a `.env.local` file:

```bash
# .env.local (do NOT commit this file)
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://localhost:5432/mydb
```

Next.js automatically loads `.env.local` during development.

### Environment variable reference

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | RAG templates | OpenAI API key for embeddings |
| `DATABASE_URL` | Database templates | PostgreSQL connection string |
| `ALLOWED_DIRECTORIES` | Filesystem templates | Comma-separated allowed paths |
| `API_KEY` | Optional | API key for authenticating MCP clients |
| `LOG_LEVEL` | No | `debug`, `info`, `warn`, or `error` (default: `info`) |

---

## Limitations

### No stdio support

Vercel is a serverless platform — it does not support long-running stdio processes. **stdio MCP servers cannot be deployed to Vercel.** Only HTTP/SSE and Streamable HTTP transports work on Vercel.

If your server uses stdio, either:
- Switch to the Streamable HTTP transport (AgentForge templates support this with a flag).
- Deploy to a platform that supports long-running processes (Railway, Fly.io, or self-hosted). See the [deployment guides](../deployment/) for alternatives.

### Function timeout limits

Vercel imposes timeout limits on serverless functions:

| Plan | Max Duration |
|---|---|
| Hobby (free) | 10 seconds |
| Pro | 60 seconds (configurable up to 300s) |
| Enterprise | 900 seconds (15 minutes) |

Set the timeout in your route handler:

```typescript
export const maxDuration = 60; // seconds — must be within your plan's limit
```

> **Impact on MCP:** Tool calls that take longer than the timeout will be killed. If your tools perform long-running operations (large database queries, file processing, LLM calls), consider:
> - Moving to a platform without timeout limits (Railway, Fly.io).
> - Breaking long operations into smaller chunks.
> - Using background jobs (e.g., Vercel's durable queues or an external queue like BullMQ).

### No persistent filesystem

Vercel serverless functions are stateless — the filesystem is ephemeral and reset on each invocation. **Filesystem and RAG templates that rely on local storage will not work on Vercel.**

For persistent storage on Vercel, use external services:
- **Database:** Vercel Postgres, Supabase, or Neon.
- **Vector store:** Pinecone, Qdrant Cloud, or Weaviate Cloud.
- **File storage:** Vercel Blob, S3, or Cloudflare R2.

### Cold starts

Serverless functions have cold start latency — the first request after a period of inactivity may take 1-3 seconds longer. For MCP servers, this means the first tool call after idle time may be slow.

To mitigate:
- Use Vercel's [Edge Functions](https://vercel.com/docs/functions/edge-functions) for lower cold start times (note: Edge Functions have different runtime constraints).
- Keep your function bundle small (fewer dependencies = faster cold starts).
- Use a cron job to keep the function warm (e.g., ping the endpoint every 5 minutes).

### Connection limits

Vercel has concurrency limits per function. If many MCP clients connect simultaneously, you may hit these limits. For high-traffic servers, consider a dedicated platform (Railway, Fly.io) or Vercel Enterprise with higher limits.

---

## Post-Deployment Checklist

- [ ] Verify the endpoint responds: `curl https://your-project.vercel.app/api/mcp`
- [ ] Test with an MCP client (Claude Desktop, Cursor, etc.)
- [ ] Set up environment variables in the Vercel dashboard
- [ ] Configure custom domain (optional): Settings > Domains
- [ ] Enable Vercel Analytics for traffic monitoring
- [ ] Set up deployment notifications (Slack, email) in Settings > Notifications
- [ ] Test the landing page at `https://your-project.vercel.app/`
