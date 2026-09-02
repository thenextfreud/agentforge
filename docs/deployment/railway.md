# Railway Deployment

Railway is a managed deployment platform that supports long-running processes, Dockerfiles, and custom domains — making it an excellent choice for deploying HTTP/SSE MCP servers.

---

## Deploying HTTP/SSE MCP Servers

### Option A: Deploy from a Git repository

1. **Push your AgentForge project to GitHub** (or GitLab/Bitbucket).

2. **Go to [railway.app](https://railway.app)** and click **"Start a New Project"**.

3. **Select "Deploy from GitHub repo"** and choose your repository.

4. **Railway auto-detects the framework.** If your project includes a `Dockerfile`, Railway will use it. If it detects Node.js/Next.js, it will use the Nixpacks builder.

5. **Set the start command** if not auto-detected:
   ```
   node dist/index.js
   ```

6. **Add environment variables** (see [Environment Variables](#environment-variables) below).

7. **Click Deploy.** Railway builds and starts your server.

8. Once deployed, Railway assigns a URL like `my-mcp-server-production.up.railway.app`. Your MCP endpoint will be at:
   ```
   https://my-mcp-server-production.up.railway.app/sse
   ```
   or
   ```
   https://my-mcp-server-production.up.railway.app/mcp
   ```

### Option B: Deploy with the Railway CLI

1. **Install the Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Log in:**
   ```bash
   railway login
   ```

3. **Link your project** (from your project directory):
   ```bash
   railway link
   ```
   Select or create a new project.

4. **Deploy:**
   ```bash
   railway up
   ```

5. **Open the deployed app:**
   ```bash
   railway open
   ```

---

## Using Railway's Dockerfile Deployment

If your AgentForge template includes a Dockerfile (all templates do), Railway can build and run it directly.

### Ensure your Dockerfile exposes the correct port

AgentForge HTTP templates read the `PORT` environment variable. Railway automatically sets `PORT` and expects your container to listen on it.

```dockerfile
# The CMD in your Dockerfile should use the PORT env var
CMD ["node", "dist/index.js"]
```

In your server code:
```typescript
const port = parseInt(process.env.PORT || "3000", 10);
server.listen(port, "0.0.0.0");
```

> **Important:** Always bind to `0.0.0.0` (not `localhost` or `127.0.0.1`) so Railway's proxy can reach your server.

### Configure Railway to use the Dockerfile

If Railway doesn't auto-detect the Dockerfile:

1. Go to your service **Settings**.
2. Under **Build**, set the **Builder** to **Dockerfile**.
3. Set the **Dockerfile path** to `./Dockerfile`.
4. Set the **Custom start command** if needed (usually not required if your Dockerfile has a `CMD`).

### Multi-service setup with docker-compose

Railway supports deploying `docker-compose.yml` files. Each service in the compose file becomes a separate Railway service:

```yaml
# docker-compose.yml
services:
  mcp-server:
    build: .
    ports:
      - "${PORT}:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=mydb
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - pg-data:/var/lib/postgresql/data

volumes:
  pg-data:
```

To deploy:
1. Go to Railway > New Project > Deploy from GitHub repo.
2. Railway detects the `docker-compose.yml` and creates a service for each entry.
3. Set the environment variables for each service in the Railway dashboard.

---

## Environment Variables

### Setting environment variables in the dashboard

1. Go to your project on [railway.app](https://railway.app).
2. Click on your service.
3. Go to the **Variables** tab.
4. Click **"New Variable"** and add each key-value pair:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | `postgresql://...` |
   | `OPENAI_API_KEY` | `sk-...` |
   | `ALLOWED_DIRECTORIES` | `/data` |
   | `LOG_LEVEL` | `info` |

5. The service automatically redeploys when you add or change variables.

### Setting environment variables via CLI

```bash
# Set a variable
railway variables set DATABASE_URL=postgresql://...

# Set multiple variables
railway variables set KEY1=value1 KEY2=value2

# View current variables
railway variables
```

### Referencing other services' variables

Railway allows you to reference variables from other services in the same project. For example, if you have a PostgreSQL service, you can reference its connection string:

1. Go to your MCP server service > **Variables** tab.
2. Click **"New Variable"**.
3. Set the key to `DATABASE_URL`.
4. For the value, click **"Reference"** and select the PostgreSQL service's `DATABASE_URL` (or construct it from individual variables like `PGHOST`, `PGUSER`, etc.).

This ensures that if the database service's URL changes (e.g., during maintenance), your MCP server automatically picks up the new value.

### Using Railway's built-in database services

Railway offers one-click provisioning of databases:

1. In your project, click **"New" > "Database"**.
2. Select PostgreSQL, Redis, MongoDB, etc.
3. Railway provisions the database and sets connection variables automatically.
4. Reference these variables in your MCP server service.

---

## Custom Domain Setup

### Adding a custom domain

1. Go to your project on Railway.
2. Click on your MCP server service.
3. Go to the **Settings** tab.
4. Scroll to **Networking** > **Domains**.
5. Click **"Generate Domain"** for a free `.up.railway.app` subdomain, or **"Custom Domain"** to use your own.

### Configuring a custom domain

1. Click **"Custom Domain"** and enter your domain (e.g., `mcp.mydomain.com`).
2. Railway displays the DNS records you need to add:

   | Type | Name | Value |
   |---|---|---|
   | CNAME | `mcp` | `my-mcp-server-production.up.railway.app` |

3. Add the CNAME record in your DNS provider's dashboard (Cloudflare, Route53, Namecheap, etc.).

4. Wait for DNS propagation (usually 5-30 minutes).

5. Railway automatically provisions an SSL certificate via Let's Encrypt. Once the certificate is ready, your server is accessible at `https://mcp.mydomain.com`.

### Connecting clients to your custom domain

```json
{
  "mcpServers": {
    "my-server": {
      "url": "https://mcp.mydomain.com/sse",
      "transport": "sse"
    }
  }
}
```

---

## Persistent Volumes

For filesystem and RAG templates that need persistent storage, Railway supports volumes:

1. Go to your service > **Settings** > **Volumes**.
2. Click **"Add Volume"**.
3. Set the mount path (e.g., `/data` for filesystem servers, `/app/index` for RAG servers).
4. Set the size (minimum 1 GB).

The volume persists across redeployments. Your server code should reference the mount path:

```typescript
const dataDir = process.env.DATA_DIR || "/data";
```

---

## Health Checks

Railway supports health checks to determine if your service is running correctly:

1. Go to your service > **Settings** > **Health**.
2. Set the **Health Check Path** (e.g., `/health`).
3. Railway will periodically ping this endpoint. If it returns non-200, Railway marks the service as unhealthy.

Ensure your server has a health endpoint:

```typescript
// For Express-based servers
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});
```

---

## Troubleshooting

### Server won't start

1. **Check the build logs** — Go to the service > **Deployments** tab and click on the latest deployment to view build logs.
2. **Check the runtime logs** — Go to the service > **Logs** tab for runtime errors.
3. **Verify the start command** — Ensure the CMD in your Dockerfile or the Railway start command is correct.
4. **Check environment variables** — Missing required variables will cause startup failures.

### Connection refused

1. **Verify the port** — Your server must listen on `process.env.PORT`. Railway sets this automatically.
2. **Bind to 0.0.0.0** — Don't bind to `localhost` or `127.0.0.1`.
3. **Check the URL** — Use the Railway-provided domain or your custom domain, not the internal IP.

### SSE connections dropping

Railway's proxy may timeout long-lived SSE connections. To mitigate:

1. **Send keepalive pings** — Your server should send SSE comments (`: ping\n\n`) every 15 seconds to keep the connection alive.
2. **Check the timeout setting** — Go to Settings > Networking and adjust the request timeout if available.

### High costs

Railway charges based on resource usage. To keep costs down:

1. **Use the hobby plan** for development ($5/month includes 500 hours).
2. **Scale down** — Set the min replicas to 0 so the service scales to zero when not in use (note: this introduces cold starts).
3. **Monitor usage** — Check the **Usage** tab regularly.
