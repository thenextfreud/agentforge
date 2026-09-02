# Docker Deployment

Docker is the recommended way to deploy AgentForge MCP servers in production. Every AgentForge template includes a Dockerfile, and this guide covers building, running, and composing multi-server setups.

---

## Using the Included Dockerfiles

Each AgentForge template ships with a production-ready Dockerfile. Here's the typical structure (TypeScript example):

```dockerfile
# ---- Build stage ----
FROM node:20-slim AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src/ ./src/
RUN pnpm build

# ---- Runtime stage ----
FROM node:20-slim AS runtime
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod
COPY --from=builder /app/dist ./dist
USER node
CMD ["node", "dist/index.js"]
```

Key features of the included Dockerfiles:

- **Multi-stage builds** — Smaller final image (only production dependencies).
- **Non-root user** — The server runs as the `node` user for security.
- **Pinned base images** — `node:20-slim` for reproducibility.
- **Health checks** — Built-in `HEALTHCHECK` for HTTP/SSE servers.

### Python template Dockerfile

Python templates use a similar multi-stage approach:

```dockerfile
# ---- Build stage ----
FROM python:3.12-slim AS builder
WORKDIR /app
RUN pip install uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen

# ---- Runtime stage ----
FROM python:3.12-slim AS runtime
WORKDIR /app
RUN pip install uv
COPY --from=builder /app/.venv ./.venv
COPY src/ ./src/
CMD ["uv", "run", "python", "src/main.py"]
```

---

## Building and Running stdio Servers in Docker

stdio servers communicate over standard input/output. When running in Docker, the MCP client (e.g., Claude Desktop) spawns the Docker container as a child process.

### Build the image

```bash
docker build -t my-mcp-server:latest .
```

### Run the container (for testing)

```bash
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}' | \
  docker run --rm -i my-mcp-server:latest
```

The `-i` (interactive) flag keeps stdin open, which is required for stdio communication.

### Configure Claude Desktop to use the Docker container

```json
{
  "mcpServers": {
    "my-docker-server": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "--env-file",
        "/path/to/.env",
        "my-mcp-server:latest"
      ]
    }
  }
}
```

### Passing environment variables

Use `--env-file` to pass a `.env` file:

```bash
# .env
DATABASE_URL=postgresql://user:pass@db:5432/mydb
API_KEY=your-api-key
LOG_LEVEL=info
```

```json
{
  "mcpServers": {
    "my-docker-server": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "--env-file",
        "/Users/me/projects/my-server/.env",
        "my-mcp-server:latest"
      ]
    }
  }
}
```

Alternatively, pass individual variables with `-e`:

```json
{
  "mcpServers": {
    "my-docker-server": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-e", "DATABASE_URL=postgresql://localhost:5432/mydb",
        "my-mcp-server:latest"
      ]
    }
  }
}
```

---

## Building and Running HTTP/SSE Servers in Docker

HTTP/SSE servers listen on a network port, making them ideal for Docker deployments where the container runs as a long-lived service.

### Build the image

```bash
docker build -t my-http-server:latest .
```

### Run the container

```bash
docker run -d \
  --name my-mcp-server \
  -p 3000:3000 \
  -e PORT=3000 \
  -e API_KEY=your-api-key \
  my-http-server:latest
```

### Test the running server

```bash
# Health check
curl http://localhost:3000/health

# SSE endpoint
curl -N http://localhost:3000/sse
```

### Configure clients to connect

Point your MCP client to the container's exposed port:

```json
{
  "mcpServers": {
    "my-http-server": {
      "url": "http://localhost:3000/sse",
      "transport": "sse"
    }
  }
}
```

For remote deployments, use the server's public URL:

```json
{
  "mcpServers": {
    "my-http-server": {
      "url": "https://mcp.mydomain.com/sse",
      "transport": "sse"
    }
  }
}
```

---

## docker-compose for Multi-Server Setups

When running multiple MCP servers (e.g., a filesystem server, a database server, and a RAG server), `docker-compose` simplifies orchestration.

### Example docker-compose.yml

```yaml
version: "3.9"

services:
  filesystem-server:
    build: ./servers/filesystem
    ports:
      - "3001:3000"
    environment:
      - ALLOWED_DIRECTORIES=/data
    volumes:
      - fs-data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  database-server:
    build: ./servers/database
    ports:
      - "3002:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/mydb
      - ALLOWED_TABLES=users,orders,products
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  rag-server:
    build: ./servers/rag
    ports:
      - "3003:3000"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - VECTOR_DB_URL=http://qdrant:6334
      - EMBEDDING_MODEL=text-embedding-3-small
    depends_on:
      qdrant:
        condition: service_started
    volumes:
      - rag-index:/app/index
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=mydb
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - pg-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant-data:/qdrant/storage
    restart: unless-stopped

volumes:
  fs-data:
  pg-data:
  qdrant-data:
  rag-index:
```

### Running the compose stack

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# View logs for a specific service
docker-compose logs -f rag-server

# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes all data)
docker-compose down -v
```

### Using an .env file with docker-compose

Create a `.env` file in the same directory as `docker-compose.yml`:

```bash
# .env
OPENAI_API_KEY=sk-your-key-here
DATABASE_URL=postgresql://postgres:password@postgres:5432/mydb
```

Docker Compose automatically loads `.env` files. Reference variables with `${VAR_NAME}` syntax in the compose file (as shown in the `rag-server` service above).

---

## Environment Variable Passing

### Method 1: .env file (recommended)

```bash
docker run -d --env-file .env -p 3000:3000 my-mcp-server:latest
```

### Method 2: Individual -e flags

```bash
docker run -d \
  -e DATABASE_URL=postgresql://localhost:5432/mydb \
  -e API_KEY=secret \
  -p 3000:3000 \
  my-mcp-server:latest
```

### Method 3: Docker secrets (for sensitive values)

For production deployments, use Docker secrets to avoid exposing sensitive values in environment variables:

```yaml
# docker-compose.yml
services:
  database-server:
    build: ./servers/database
    environment:
      - DATABASE_URL_FILE=/run/secrets/db_url
    secrets:
      - db_url

secrets:
  db_url:
    file: ./secrets/db_url.txt
```

In your server code, read from the file:

```typescript
const dbUrl = process.env.DATABASE_URL_FILE
  ? readFileSync(process.env.DATABASE_URL_FILE, "utf-8").trim()
  : process.env.DATABASE_URL;
```

---

## Volume Mounting for Filesystem and Database Templates

### Filesystem server

The filesystem template needs access to the directories it serves. Mount them as volumes:

```bash
docker run -d \
  --name filesystem-server \
  -p 3001:3000 \
  -e ALLOWED_DIRECTORIES=/data,/projects \
  -v /Users/me/data:/data:ro \
  -v /Users/me/projects:/projects:ro \
  my-filesystem-server:latest
```

- `:ro` makes the mount read-only (recommended for safety).
- Remove `:ro` if the server needs write access.
- The `ALLOWED_DIRECTORIES` env var must match the container paths (`/data`, `/projects`), not the host paths.

### Database server with persistent storage

```bash
docker run -d \
  --name database-server \
  -p 3002:3000 \
  -e DATABASE_URL=postgresql://postgres:password@db:5432/mydb \
  my-database-server:latest
```

For the database itself (PostgreSQL, SQLite, etc.), use a named volume for persistence:

```yaml
services:
  database-server:
    build: ./servers/database
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/mydb
    depends_on:
      - postgres

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=mydb
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - pg-data:/var/lib/postgresql/data

volumes:
  pg-data:
```

### RAG server with persistent index

RAG servers need to persist their vector index between restarts:

```bash
docker run -d \
  --name rag-server \
  -p 3003:3000 \
  -e OPENAI_API_KEY=sk-... \
  -e VECTOR_DB_URL=http://qdrant:6334 \
  -v rag-index:/app/index \
  my-rag-server:latest
```

---

## Production Best Practices

### Use a reverse proxy

For HTTP/SSE servers exposed to the internet, put a reverse proxy (Nginx, Caddy, Traefik) in front:

```yaml
services:
  mcp-server:
    build: .
    expose:
      - "3000"
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - mcp-server
    restart: unless-stopped
```

### Resource limits

Set memory and CPU limits to prevent runaway containers:

```yaml
services:
  mcp-server:
    build: .
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "1.0"
    restart: unless-stopped
```

### Logging

Use a logging driver to prevent log files from growing unbounded:

```yaml
services:
  mcp-server:
    build: .
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    restart: unless-stopped
```

### Image tagging

Never use `:latest` in production. Tag images with semantic versions or Git SHAs:

```bash
docker build -t my-mcp-server:v1.2.3 .
docker build -t my-mcp-server:v1.2.3-$(git rev-parse --short HEAD) .
```
