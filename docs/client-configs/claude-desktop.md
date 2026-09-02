# Claude Desktop Setup

Claude Desktop has first-class support for MCP servers. This guide walks you through locating the configuration file, adding stdio and HTTP/SSE servers, and troubleshooting common issues.

---

## Locating the Configuration File

Claude Desktop reads MCP server configuration from a JSON file named `claude_desktop_config.json`. The location depends on your operating system:

| OS | Path |
|---|---|
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Windows** | `%APPDATA%\Claude\claude_desktop_config.json` |
| **Linux** | `~/.config/Claude/claude_desktop_config.json` |

### Quick access shortcuts

**macOS (Terminal):**
```bash
open ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Windows (PowerShell):**
```powershell
notepad "$env:APPDATA\Claude\claude_desktop_config.json"
```

**Linux:**
```bash
xdg-open ~/.config/Claude/claude_desktop_config.json
```

> If the file or directory doesn't exist, create it. Claude Desktop will read the file on next launch.

---

## stdio Server Configuration

stdio is the most common transport for local MCP servers. Claude Desktop spawns the server as a child process and communicates over standard input/output.

### Config format

```json
{
  "mcpServers": {
    "<server-name>": {
      "command": "<executable>",
      "args": ["<path-to-script>", "--flag", "value"],
      "env": {
        "API_KEY": "your-api-key"
      }
    }
  }
}
```

| Field | Required | Description |
|---|---|---|
| `command` | Yes | The executable to run (e.g., `node`, `python`, `npx`) |
| `args` | Yes | Array of command-line arguments passed to the command |
| `env` | No | Environment variables to set for the spawned process |

### Example: TypeScript server (compiled)

```json
{
  "mcpServers": {
    "my-fileserver": {
      "command": "node",
      "args": ["/Users/me/projects/my-fileserver/dist/index.js"]
    }
  }
}
```

### Example: TypeScript server (via npx, no build step)

```json
{
  "mcpServers": {
    "my-fileserver": {
      "command": "npx",
      "args": ["tsx", "/Users/me/projects/my-fileserver/src/index.ts"]
    }
  }
}
```

### Example: Python server

```json
{
  "mcpServers": {
    "my-python-server": {
      "command": "python",
      "args": ["/Users/me/projects/my-python-server/main.py"]
    }
  }
}
```

### Example: Python server with uv

```json
{
  "mcpServers": {
    "my-python-server": {
      "command": "uv",
      "args": ["run", "python", "/Users/me/projects/my-python-server/main.py"]
    }
  }
}
```

### Example: Server with environment variables

```json
{
  "mcpServers": {
    "database-server": {
      "command": "node",
      "args": ["/Users/me/projects/db-server/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://user:pass@localhost:5432/mydb",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

> **Windows paths:** In JSON, backslashes must be escaped. Use `"C:\\Users\\me\\project\\dist\\index.js"` or forward slashes `"C:/Users/me/project/dist/index.js"`.

---

## HTTP/SSE Server Configuration

For remote MCP servers (deployed to Vercel, Railway, Fly.io, etc.), Claude Desktop connects over HTTP. The MCP SDK supports both SSE (Server-Sent Events) and the newer Streamable HTTP transport.

### Config format

```json
{
  "mcpServers": {
    "<server-name>": {
      "url": "<https-endpoint-url>",
      "transport": "sse"
    }
  }
}
```

| Field | Required | Description |
|---|---|---|
| `url` | Yes | The full HTTPS URL of your deployed MCP server endpoint |
| `transport` | No | `"sse"` or `"streamable-http"`. Defaults to auto-detection. |
| `headers` | No | Custom HTTP headers (e.g., for authentication) |

### Example: SSE server

```json
{
  "mcpServers": {
    "remote-rag": {
      "url": "https://my-rag-server.vercel.app/sse",
      "transport": "sse"
    }
  }
}
```

### Example: Streamable HTTP server

```json
{
  "mcpServers": {
    "remote-api": {
      "url": "https://my-api-server.fly.dev/mcp",
      "transport": "streamable-http"
    }
  }
}
```

### Example: Authenticated remote server

```json
{
  "mcpServers": {
    "secure-server": {
      "url": "https://my-server.example.com/mcp",
      "transport": "streamable-http",
      "headers": {
        "Authorization": "Bearer your-oauth-token-here"
      }
    }
  }
}
```

> **Security note:** For OAuth-protected servers, avoid hardcoding long-lived tokens in the config file. Consider using a short-lived token or a local proxy that handles the OAuth flow. See [Security Best Practices](../patterns/security.md#oauth-20-for-remote-servers).

---

## Multiple Servers

You can configure multiple MCP servers in a single config file. They will all be available simultaneously:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "node",
      "args": ["/Users/me/projects/fs-server/dist/index.js"]
    },
    "database": {
      "command": "node",
      "args": ["/Users/me/projects/db-server/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://localhost:5432/mydb"
      }
    },
    "remote-rag": {
      "url": "https://my-rag.vercel.app/sse",
      "transport": "sse"
    }
  }
}
```

---

## Troubleshooting

### Server not appearing in Claude Desktop

**Symptom:** After restarting Claude Desktop, your server doesn't show up in the tools list (no hammer icon).

**Solutions:**

1. **Fully quit and restart Claude Desktop.** Closing the window is not enough — the app must be completely quit and relaunched. On macOS, use `Cmd+Q`. On Windows, right-click the tray icon and select "Quit."

2. **Verify the config file is valid JSON.** A syntax error in the config file will cause Claude Desktop to silently ignore all servers. Validate your JSON:

   ```bash
   # macOS/Linux
   cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | python3 -m json.tool

   # Windows
   Get-Content "$env:APPDATA\Claude\claude_desktop_config.json" | ConvertFrom-Json
   ```

3. **Check the config file path.** Make sure the file is in the exact location for your OS (see the table above). Claude Desktop will not read config from alternative locations.

4. **Verify the server starts manually.** Run the exact command from your config in a terminal:

   ```bash
   node /path/to/your/server/dist/index.js
   ```

   If it crashes or exits immediately, fix the error before reconnecting.

5. **Check for naming conflicts.** Each server in `mcpServers` must have a unique key. Duplicate names will cause one to be silently dropped.

### Connection errors

**Symptom:** The server appears but tools fail with "connection error" or "server disconnected."

**Solutions:**

1. **Check that the executable exists.** The `command` field must resolve to an actual executable on your `PATH` or an absolute path:

   ```bash
   which node       # macOS/Linux
   where node       # Windows
   ```

2. **Verify the script path is absolute.** Relative paths in `args` may not resolve correctly because Claude Desktop may not use your shell's working directory. Always use absolute paths.

3. **Check Node.js version.** MCP servers require Node.js 18+. Run `node --version` to confirm.

4. **For remote servers, verify the URL is reachable:**

   ```bash
   curl -I https://your-server.example.com/sse
   ```

   You should get an HTTP 200 or 405 response. A connection refused or DNS error means the server isn't running or the URL is wrong.

5. **Check for firewall or proxy issues.** Corporate firewalls may block SSE connections. Try connecting from a different network to rule this out.

### Debug logging

Claude Desktop can write detailed MCP logs that are invaluable for debugging.

**Enable debug logging:**

1. Quit Claude Desktop completely.
2. Set the environment variable before launching:

   **macOS (Terminal):**
   ```bash
   export CLAUDE_DEBUG=1
   open /Applications/Claude.app
   ```

   **Windows (PowerShell):**
   ```powershell
   $env:CLAUDE_DEBUG = "1"
   Start-Process "C:\Program Files\Claude\Claude.exe"
   ```

   **Linux:**
   ```bash
   CLAUDE_DEBUG=1 claude-desktop
   ```

3. Logs are written to:

   | OS | Log location |
   |---|---|
   | macOS | `~/Library/Logs/Claude/` |
   | Windows | `%APPDATA%\Claude\logs\` |
   | Linux | `~/.local/share/Claude/logs/` |

4. Look for files named `mcp-server-<server-name>.log` — these contain the stdout/stderr of your MCP server process.

**Alternatively, add logging to your server:**

If you can't find Claude's logs, add file-based logging to your server. Since stdio is used for protocol communication, you cannot use `console.log` — it will corrupt the protocol stream. Instead, write to a file:

```typescript
import { writeFileSync, appendFileSync } from "fs";

const LOG_FILE = "/tmp/mcp-debug.log";

function log(message: string) {
  appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${message}\n`);
}

log("Server starting...");
```

### Server crashes on startup

**Common causes:**

| Cause | Fix |
|---|---|
| Missing dependencies | Run `pnpm install` or `uv sync` in the project directory |
| Missing environment variables | Add them to the `env` field in the config |
| Wrong Node.js version | Install Node.js 18+ using nvm or download from nodejs.org |
| TypeScript not compiled | Run `pnpm build` before connecting |
| Port already in use (HTTP servers) | Change the port or stop the conflicting process |

### Tools not appearing despite server connected

If the server connects but individual tools don't appear:

1. Ensure your server actually registers tools using `server.tool()` (TypeScript) or `@mcp.tool()` (Python).
2. Check that tool names are unique across all connected servers. Claude Desktop may deduplicate by name.
3. Verify the tool's input schema is valid. Invalid Zod/Pydantic schemas can cause silent registration failures.
