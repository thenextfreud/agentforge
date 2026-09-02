# Self-Hosted with systemd

For maximum control over your MCP server deployment, self-hosting with systemd and Nginx provides a robust, production-grade setup. This guide covers creating systemd services, configuring Nginx as a reverse proxy, securing connections with Let's Encrypt, and managing processes.

---

## Prerequisites

- A Linux server (Ubuntu 22.04+, Debian 12+, or RHEL 9+ recommended)
- Root or sudo access
- Node.js 18+ installed (or Python 3.11+ for Python templates)
- Your AgentForge MCP server built and ready

### Prepare the server

```bash
# Update packages
sudo apt update && sudo apt upgrade -y   # Debian/Ubuntu
# or: sudo dnf update -y                  # RHEL/Fedora

# Install Node.js 20 (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Nginx
sudo apt install -y nginx

# Install Certbot for Let's Encrypt
sudo apt install -y certbot python3-certbot-nginx

# Create a dedicated user for the MCP server
sudo useradd --system --no-create-home --shell /bin/false mcp
```

---

## systemd Service File Template

systemd manages your MCP server as a background service, automatically starting it on boot and restarting it if it crashes.

### Basic service file

Create a service file at `/etc/systemd/system/mcp-server.service`:

```ini
[Unit]
Description=AgentForge MCP Server
Documentation=https://github.com/your-org/agentforge
After=network.target

[Service]
Type=simple
User=mcp
Group=mcp
WorkingDirectory=/opt/mcp-server

# Environment variables
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=LOG_LEVEL=info
EnvironmentFile=/opt/mcp-server/.env

# Start command
ExecStart=/usr/bin/node /opt/mcp-server/dist/index.js

# Restart policy
Restart=always
RestartSec=5
StartLimitInterval=60
StartLimitBurst=3

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=mcp-server

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/mcp-server/data
ReadOnlyPaths=/opt/mcp-server/dist
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_INET AF_INET6
RestrictNamespaces=true
LockPersonality=true
MemoryDenyWriteExecute=false
RestrictRealtime=true
RestrictSUIDSGID=true

# Resource limits
LimitNOFILE=65536
MemoryMax=512M
CPUQuota=100%

[Install]
WantedBy=multi-user.target
```

### Deploying your server

```bash
# Create the deployment directory
sudo mkdir -p /opt/mcp-server/data

# Copy your built server
sudo cp -r dist/ /opt/mcp-server/dist/
sudo cp package.json /opt/mcp-server/
sudo cp -r node_modules/ /opt/mcp-server/node_modules/

# Set ownership
sudo chown -R mcp:mcp /opt/mcp-server

# Create the .env file
sudo tee /opt/mcp-server/.env > /dev/null <<EOF
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
OPENAI_API_KEY=sk-your-key-here
ALLOWED_DIRECTORIES=/opt/mcp-server/data
EOF

sudo chown mcp:mcp /opt/mcp-server/.env
sudo chmod 600 /opt/mcp-server/.env  # Only owner can read
```

### Registering and starting the service

```bash
# Reload systemd to pick up the new service file
sudo systemctl daemon-reload

# Enable auto-start on boot
sudo systemctl enable mcp-server

# Start the service
sudo systemctl start mcp-server

# Check the status
sudo systemctl status mcp-server
```

### Managing the service

```bash
# Stop the server
sudo systemctl stop mcp-server

# Restart the server
sudo systemctl restart mcp-server

# View logs (real-time)
sudo journalctl -u mcp-server -f

# View logs (last 100 lines)
sudo journalctl -u mcp-server -n 100

# View logs (since boot)
sudo journalctl -u mcp-server -b

# View logs (specific time range)
sudo journalctl -u mcp-server --since "2024-01-01 12:00:00" --until "2024-01-01 14:00:00"
```

### Updating the server

```bash
# 1. Build the new version locally
pnpm build

# 2. Copy the new files to the server
scp -r dist/* user@server:/opt/mcp-server/dist/

# 3. Restart the service
sudo systemctl restart mcp-server

# 4. Verify it's running
sudo systemctl status mcp-server
```

### Python server service file

For Python templates, adjust the `ExecStart`:

```ini
[Service]
Type=simple
User=mcp
Group=mcp
WorkingDirectory=/opt/mcp-server
Environment=PYTHONUNBUFFERED=1
EnvironmentFile=/opt/mcp-server/.env
ExecStart=/opt/mcp-server/.venv/bin/python /opt/mcp-server/src/main.py
Restart=always
RestartSec=5
```

---

## Nginx Reverse Proxy for HTTP/SSE Servers

Nginx sits in front of your MCP server, handling TLS termination, request routing, and load balancing.

### Basic Nginx configuration

Create a configuration file at `/etc/nginx/sites-available/mcp-server`:

```nginx
server {
    listen 80;
    server_name mcp.mydomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name mcp.mydomain.com;

    # SSL certificates (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/mcp.mydomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mcp.mydomain.com/privkey.pem;

    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # MCP server proxy
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # WebSocket / SSE support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Pass client information
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE-specific: disable buffering and set long timeouts
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;

        # Allow large requests (if tools accept big payloads)
        client_max_body_size 10m;
    }

    # Health check endpoint (no proxy buffering)
    location /health {
        proxy_pass http://127.0.0.1:3000/health;
        access_log off;
    }
}
```

### Enabling the site

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/mcp-server /etc/nginx/sites-enabled/

# Test the configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### SSE-specific considerations

SSE (Server-Sent Events) requires special Nginx configuration to work properly:

```nginx
location /sse {
    proxy_pass http://127.0.0.1:3000/sse;
    proxy_http_version 1.1;

    # Critical for SSE: disable buffering
    proxy_buffering off;
    proxy_cache off;

    # Set Connection header to empty (not "upgrade")
    # SSE uses HTTP/1.1 keep-alive, not WebSocket upgrade
    proxy_set_header Connection "";

    # Long timeout for persistent connections
    proxy_read_timeout 86400s;

    # Pass headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

> **Key settings for SSE:**
> - `proxy_buffering off` — Nginx must not buffer responses; SSE events must be sent immediately.
> - `proxy_cache off` — Disable caching for SSE endpoints.
> - `proxy_read_timeout 86400s` — Keep the connection alive for up to 24 hours.
> - `proxy_set_header Connection ""` — Use HTTP/1.1 keep-alive, not WebSocket upgrade.

---

## SSL with Let's Encrypt

### Obtaining an SSL certificate

```bash
# Obtain and install the certificate
sudo certbot --nginx -d mcp.mydomain.com

# Follow the prompts:
# 1. Enter your email address
# 2. Agree to the terms of service
# 3. Choose whether to redirect HTTP to HTTPS (yes)
```

Certbot automatically modifies the Nginx configuration to include the SSL certificates and sets up the HTTP-to-HTTPS redirect.

### Auto-renewal

Certbot installs a systemd timer for automatic renewal. Verify it's active:

```bash
# Check the timer status
sudo systemctl status certbot.timer

# Test the renewal process
sudo certbot renew --dry-run
```

Certificates renew automatically every 60 days (before the 90-day expiration).

### Manual renewal

If auto-renewal fails, you can renew manually:

```bash
sudo certbot renew
sudo systemctl reload nginx
```

### Using multiple domains

If you have multiple MCP servers on different subdomains:

```bash
sudo certbot --nginx -d mcp.mydomain.com -d fs.mydomain.com -d db.mydomain.com
```

---

## Process Management

### Running multiple MCP servers

Create separate systemd service files for each server:

```bash
# /etc/systemd/system/mcp-filesystem.service
# /etc/systemd/system/mcp-database.service
# /etc/systemd/system/mcp-rag.service
```

Each with its own port, working directory, and environment file.

### Nginx configuration for multiple servers

```nginx
# Filesystem server
server {
    listen 443 ssl http2;
    server_name fs.mydomain.com;
    ssl_certificate /etc/letsencrypt/live/fs.mydomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fs.mydomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 86400s;
    }
}

# Database server
server {
    listen 443 ssl http2;
    server_name db.mydomain.com;
    ssl_certificate /etc/letsencrypt/live/db.mydomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/db.mydomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 86400s;
    }
}
```

### Single domain, multiple paths

Alternatively, route multiple servers under a single domain using path prefixes:

```nginx
server {
    listen 443 ssl http2;
    server_name mcp.mydomain.com;
    ssl_certificate /etc/letsencrypt/live/mcp.mydomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mcp.mydomain.com/privkey.pem;

    location /filesystem/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffering off;
        proxy_read_timeout 86400s;
    }

    location /database/ {
        proxy_pass http://127.0.0.1:3002/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffering off;
        proxy_read_timeout 86400s;
    }
}
```

### Log rotation

systemd's journal already handles log rotation, but if you're writing logs to files, set up `logrotate`:

```bash
# /etc/logrotate.d/mcp-server
/opt/mcp-server/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 mcp mcp
    sharedscripts
    postrotate
        systemctl reload mcp-server >/dev/null 2>&1 || true
    endscript
}
```

### Monitoring

#### Basic health monitoring with a cron job

```bash
# Add to crontab: crontab -e
*/5 * * * * curl -sf http://localhost:3000/health > /dev/null || systemctl restart mcp-server
```

#### Using systemd watchdog (advanced)

For more robust monitoring, enable systemd's built-in watchdog:

```ini
# In the [Service] section:
WatchdogSec=30
NotifyAccess=main
```

In your server code, send watchdog notifications:

```typescript
import { send } from "process";

// Notify systemd that the service is alive
setInterval(() => {
  if (typeof process.send === "function") {
    process.send("WATCHDOG=1");
  }
}, 15000);
```

### Firewall configuration

Only expose the ports you need. Use `ufw` (Ubuntu/Debian) or `firewalld` (RHEL):

```bash
# Using ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp       # SSH
sudo ufw allow 80/tcp       # HTTP (for Let's Encrypt)
sudo ufw allow 443/tcp      # HTTPS
sudo ufw enable

# Do NOT allow port 3000 — it should only be accessible via Nginx proxy
```

---

## Troubleshooting

### Service won't start

```bash
# Check the status
sudo systemctl status mcp-server

# View detailed logs
sudo journalctl -u mcp-server -n 50 --no-pager

# Common issues:
# 1. Wrong path in ExecStart — verify the file exists
# 2. Missing environment variables — check the .env file
# 3. Permission errors — ensure the mcp user owns the files
# 4. Port already in use — check with: sudo ss -tlnp | grep 3000
```

### 502 Bad Gateway (Nginx)

This means Nginx can't reach your MCP server:

1. **Verify the server is running:** `sudo systemctl status mcp-server`
2. **Check the port:** `curl http://localhost:3000/health`
3. **Verify Nginx config:** `sudo nginx -t`
4. **Check Nginx error logs:** `sudo tail -f /var/log/nginx/error.log`

### SSE connections dropping

1. **Check Nginx timeout settings** — Ensure `proxy_read_timeout` is set high enough.
2. **Verify `proxy_buffering off`** — Buffering will break SSE.
3. **Check the server's keepalive** — Your server must keep the connection alive with periodic events or comments.

### SSL certificate issues

```bash
# Check certificate status
sudo certbot certificates

# Test SSL configuration
sudo nginx -t
curl -vI https://mcp.mydomain.com
```
