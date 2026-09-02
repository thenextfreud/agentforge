# Fly.io Deployment

Fly.io is a global deployment platform that runs containers close to users with persistent volumes, making it ideal for HTTP/SSE MCP servers that need low latency and local storage (filesystem and RAG templates).

---

## Prerequisites

- A [Fly.io](https://fly.io) account
- `flyctl` CLI installed:

  **macOS/Linux:**
  ```bash
  curl -L https://fly.io/install.sh | sh
  ```

  **Windows (PowerShell):**
  ```powershell
  iwr https://fly.io/install.ps1 -useb | iex
  ```

- Verify installation:
  ```bash
  flyctl version
  ```

---

## fly.toml Configuration

Every Fly.io app needs a `fly.toml` configuration file. AgentForge templates include a pre-configured `fly.toml` — here's a reference:

```toml
# fly.toml — AgentForge MCP server configuration
app = "my-mcp-server"
primary_region = "iad"

[build]
  # Use the included Dockerfile
  dockerfile = "Dockerfile"

[env]
  PORT = "3000"
  LOG_LEVEL = "info"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

  [http_service.concurrency]
    type = "requests"
    hard_limit = 250
    soft_limit = 200

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory = 512
```

### Key configuration options

| Field | Description |
|---|---|
| `app` | Your Fly.io app name (must be globally unique) |
| `primary_region` | Primary deployment region (e.g., `iad` for US East, `lhr` for London, `nrt` for Tokyo) |
| `[build]` | Build configuration — uses the included Dockerfile |
| `[env]` | Environment variables (non-secret values only) |
| `[http_service]` | HTTP service configuration |
| `internal_port` | The port your server listens on (must match `PORT` env var) |
| `force_https` | Automatically redirect HTTP to HTTPS |
| `auto_stop_machines` | Scale to zero when idle (saves cost, adds cold starts) |
| `auto_start_machines` | Start machines on incoming requests |
| `min_machines_running` | Minimum machines to keep running (0 for cost savings, 1+ for no cold starts) |
| `[[vm]]` | VM size configuration |

### Available regions

| Code | Region |
|---|---|
| `iad` | Washington, D.C. (US East) |
| `sfo` | San Francisco (US West) |
| `lhr` | London |
| `cdg` | Paris |
| `fra` | Frankfurt |
| `nrt` | Tokyo |
| `sin` | Singapore |
| `syd` | Sydney |

Run `flyctl platform regions` to see all available regions.

---

## Deploying with flyctl

### Step 1: Log in

```bash
flyctl auth login
```

This opens a browser to authenticate with Fly.io.

### Step 2: Create the app

From your project directory (where `fly.toml` and `Dockerfile` are located):

```bash
flyctl launch --no-deploy
```

This creates the app on Fly.io and generates/updates `fly.toml`. Answer the prompts:

- **App name:** Choose a unique name (or accept the suggested one)
- **Region:** Select your preferred region
- **PostgreSQL database:** No (unless your template needs one)
- **Redis:** No (unless needed)

### Step 3: Set environment secrets

Set sensitive environment variables as Fly.io secrets (never put secrets in `fly.toml`):

```bash
flyctl secrets set OPENAI_API_KEY=sk-your-key-here
flyctl secrets set DATABASE_URL=postgresql://user:pass@host:5432/db
flyctl secrets set API_KEY=your-mcp-auth-key
```

Verify your secrets:
```bash
flyctl secrets list
```

### Step 4: Deploy

```bash
flyctl deploy
```

Fly.io builds the Docker image, pushes it to its registry, and starts a machine in your configured region.

### Step 5: Verify the deployment

```bash
# Check the status
flyctl status

# View logs
flyctl logs

# Test the endpoint
curl https://my-mcp-server.fly.dev/health
```

Your MCP server is now available at:
```
https://my-mcp-server.fly.dev/sse
```
or
```
https://my-mcp-server.fly.dev/mcp
```

### Step 6: Connect your MCP client

```json
{
  "mcpServers": {
    "my-server": {
      "url": "https://my-mcp-server.fly.dev/sse",
      "transport": "sse"
    }
  }
}
```

---

## Persistent Volumes for Filesystem and RAG Templates

Fly.io supports persistent volumes that are attached to specific machines. This is essential for filesystem and RAG templates that need data to survive restarts.

### Creating a volume

```bash
flyctl volumes create mcp_data --size 1 --region iad
```

- `--size` is in GB (minimum 1 GB).
- `--region` should match your app's primary region.

### Mounting the volume in fly.toml

Add a `[[mounts]]` section to your `fly.toml`:

```toml
[[mounts]]
  source = "mcp_data"
  destination = "/data"
```

- `source` is the volume name.
- `destination` is the path inside the container where the volume is mounted.

### Complete fly.toml with volume

```toml
app = "my-mcp-server"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "3000"
  ALLOWED_DIRECTORIES = "/data"
  LOG_LEVEL = "info"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

  [http_service.concurrency]
    type = "requests"
    hard_limit = 250
    soft_limit = 200

[[mounts]]
  source = "mcp_data"
  destination = "/data"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory = 512
```

> **Note:** When using persistent volumes, set `auto_stop_machines = false` and `min_machines_running = 1`. Volumes are attached to specific machines — if the machine is stopped, the volume is detached and data becomes unavailable until the machine restarts.

### RAG template with volume

For RAG templates, mount the volume at the index directory:

```toml
[[mounts]]
  source = "rag_index"
  destination = "/app/index"
```

And set the environment variable:
```toml
[env]
  INDEX_DIR = "/app/index"
```

### Multi-region volumes

Fly.io volumes are region-specific. If you deploy to multiple regions, you need a volume in each region:

```bash
flyctl volumes create mcp_data --size 1 --region iad
flyctl volumes create mcp_data --size 1 --region lhr
```

> **Warning:** Volumes are not replicated across regions. Each region's volume is independent. For multi-region consistency, use an external database (PostgreSQL on Fly.io, Supabase, etc.) instead of local volumes.

---

## Environment Secrets

### Setting secrets

```bash
# Set individual secrets
flyctl secrets set OPENAI_API_KEY=sk-...
flyctl secrets set DATABASE_URL=postgresql://...

# Set multiple secrets at once
flyctl secrets set KEY1=value1 KEY2=value2 KEY3=value3
```

### Setting secrets from a file

```bash
flyctl secrets set --file .env
```

This reads key-value pairs from a `.env` file and sets them all as secrets.

### Listing and removing secrets

```bash
# List secret names (values are not shown)
flyctl secrets list

# Remove a secret
flyctl secrets unset OLD_KEY
```

### Non-secret environment variables

For non-sensitive values (log level, allowed directories, etc.), use the `[env]` section in `fly.toml`:

```toml
[env]
  LOG_LEVEL = "info"
  ALLOWED_DIRECTORIES = "/data"
  MAX_FILE_SIZE = "10485760"
```

These are committed to version control alongside `fly.toml`. Secrets set with `flyctl secrets set` override values in `[env]`.

---

## Custom Domains

### Adding a custom domain

```bash
flyctl certs create mcp.mydomain.com
```

Fly.io displays the DNS records to add:

| Type | Name | Value |
|---|---|---|
| A | `mcp` | `<fly-app-ipv4>` |
| AAAA | `mcp` | `<fly-app-ipv6>` |

Or use a CNAME:
| Type | Name | Value |
|---|---|---|
| CNAME | `mcp` | `my-mcp-server.fly.dev` |

### Verifying the certificate

```bash
flyctl certs show mcp.mydomain.com
```

Once the certificate is issued (usually within minutes), your server is accessible at `https://mcp.mydomain.com`.

---

## Scaling

### Vertical scaling (machine size)

```bash
flyctl scale vm shared-cpu-1x --memory 1024
```

Available VM sizes:

| Name | CPU | RAM |
|---|---|---|
| `shared-cpu-1x` | 1 shared | 256 MB (default) |
| `shared-cpu-1x` | 1 shared | Up to 2 GB |
| `shared-cpu-2x` | 2 shared | Up to 4 GB |
| `performance-1x` | 1 dedicated | Up to 8 GB |
| `performance-2x` | 2 dedicated | Up to 16 GB |

### Horizontal scaling (multiple machines)

```bash
flyctl scale count 3
```

This runs 3 machines across your configured regions. For multi-region scaling:

```bash
flyctl scale count 3 --region iad
flyctl scale count 2 --region lhr
```

---

## Troubleshooting

### Deployment fails

1. **Check build logs:**
   ```bash
   flyctl deploy --verbose
   ```

2. **Verify the Dockerfile** — Ensure it builds locally:
   ```bash
   docker build -t test .
   ```

3. **Check fly.toml syntax** — TOML is whitespace-sensitive. Validate the file.

### Server not responding

1. **Check machine status:**
   ```bash
   flyctl status
   ```

2. **Check logs:**
   ```bash
   flyctl logs
   ```

3. **Verify the port** — Your server must listen on the `internal_port` specified in `fly.toml` (default 3000). It must also read the `PORT` env var.

4. **Bind to 0.0.0.0** — Don't bind to `localhost`.

### Volume not mounting

1. **Check the volume exists:**
   ```bash
   flyctl volumes list
   ```

2. **Verify the mount path** — The `destination` in `fly.toml` must match what your server code expects.

3. **Ensure the machine is running** — Volumes are only attached to running machines. If `auto_stop_machines = true`, the volume is detached when the machine stops.

### High latency

1. **Check the region** — Choose a region close to your users: `flyctl platform regions`.
2. **Enable auto_start_machines** — This ensures machines start in the optimal region for each request.
3. **Consider multi-region deployment** — Deploy machines in multiple regions for global coverage.

### SSE connections dropping

Fly.io's proxy may close idle connections. Send keepalive pings from your server:

```typescript
// Send a comment every 15 seconds to keep SSE alive
setInterval(() => {
  res.write(": ping\n\n");
}, 15000);
```
