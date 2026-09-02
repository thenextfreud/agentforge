# Cursor Setup

Cursor is an AI-powered code editor with built-in support for MCP servers. Connecting your AgentForge MCP server to Cursor gives the Cursor chat agent access to your custom tools, resources, and prompts.

---

## Locating the Configuration File

Cursor stores MCP server configuration in a file named `mcp.json` inside the `.cursor` directory of your project (or your home directory for global configuration).

### Project-level config (recommended)

```
<your-project>/.cursor/mcp.json
```

This file only applies when Cursor has that project open. It's the recommended approach because it keeps MCP server configs version-controlled alongside your code.

### Global config

```
~/.cursor/mcp.json
```

A global config applies to all projects. This is useful for personal utility servers (like a filesystem server) that you want available everywhere.

### Creating the file

If it doesn't exist yet, create it:

```bash
mkdir -p .cursor
touch .cursor/mcp.json
```

> **Note:** On Windows, create the `.cursor` directory and `mcp.json` file using File Explorer or PowerShell:
> ```powershell
> New-Item -ItemType Directory -Force -Path ".cursor"
> New-Item -ItemType File -Path ".cursor\mcp.json"
> ```

---

## Configuration Format

The Cursor MCP config format is similar to Claude Desktop's:

```json
{
  "mcpServers": {
    "<server-name>": {
      "command": "<executable>",
      "args": ["<path-to-script>"],
      "env": {
        "KEY": "value"
      }
    }
  }
}
```

### Example: stdio server

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

### Example: Server with environment variables

```json
{
  "mcpServers": {
    "database-server": {
      "command": "node",
      "args": ["/Users/me/projects/db-server/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://user:pass@localhost:5432/mydb",
        "ALLOWED_DIRECTORIES": "/Users/me/data,/Users/me/projects"
      }
    }
  }
}
```

### Example: Python server

```json
{
  "mcpServers": {
    "rag-server": {
      "command": "uv",
      "args": ["run", "python", "/Users/me/projects/rag-server/main.py"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

### Example: Remote HTTP/SSE server

Cursor also supports remote MCP servers:

```json
{
  "mcpServers": {
    "remote-rag": {
      "url": "https://my-rag-server.vercel.app/sse"
    }
  }
}
```

### Example: Multiple servers

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
    "remote-api": {
      "url": "https://my-api.fly.dev/mcp"
    }
  }
}
```

---

## Using MCP Tools in Cursor Chat

Once your MCP server is configured and Cursor is restarted, the tools become available in the Cursor chat interface.

### Verifying the connection

1. **Open Cursor Settings** — Go to `Settings > Features > MCP` (or `Cursor > Settings > MCP` depending on version).
2. You should see your configured servers listed with a green status indicator.
3. If a server shows a red indicator, see the [Troubleshooting](#troubleshooting) section below.

### Using tools in chat

1. Open the Cursor chat panel (`Cmd+L` on macOS, `Ctrl+L` on Windows/Linux).
2. Ask a question that requires your MCP tools. For example:
   - *"List all files in the /data directory"* (filesystem server)
   - *"Query the users table for active accounts"* (database server)
   - *"Search the knowledge base for information about OAuth 2.0"* (RAG server)
3. Cursor will detect that a tool is needed, call the appropriate MCP tool, and use the result to formulate its response.

### Using tools in Composer / Agent mode

Cursor's Composer (agent mode) can also use MCP tools when performing multi-step tasks:

1. Open Composer (`Cmd+I` on macOS, `Ctrl+I` on Windows/Linux).
2. Describe a task that requires your tools.
3. The agent will plan the steps, call MCP tools as needed, and show you each tool call for approval.

> **Tip:** You can see which MCP tools are available by typing `@` in the chat input and looking for your server name in the tools list.

### Tool approval

By default, Cursor will ask for your approval before executing MCP tool calls that modify files or have side effects. You can configure this behavior in `Settings > Features > MCP`:

- **Auto-approve read-only tools** — Tools that only read data (no side effects) run without confirmation.
- **Always confirm** — Every tool call requires explicit approval.
- **Auto-approve all** — All tool calls run without confirmation (use with caution).

---

## Troubleshooting

### Server not appearing in Cursor settings

**Solutions:**

1. **Restart Cursor completely.** Close all Cursor windows and reopen. The MCP config is read on startup.

2. **Verify the config file location.** For project-level config, the file must be at `<project>/.cursor/mcp.json`. For global config, it must be at `~/.cursor/mcp.json`.

3. **Validate the JSON.** A syntax error will cause Cursor to ignore the entire file:

   ```bash
   cat .cursor/mcp.json | python3 -m json.tool
   ```

4. **Check for conflicting configs.** If you have both a project-level and global config, make sure there are no server name conflicts.

### Server shows red/error status

**Solutions:**

1. **Check the server command manually.** Run the exact command from your config in a terminal:

   ```bash
   node /path/to/your/server/dist/index.js
   ```

   If it exits immediately or throws an error, fix that first.

2. **Check environment variables.** If your server requires env vars (API keys, database URLs), make sure they're set in the `env` field of the config.

3. **Verify Node.js is on Cursor's PATH.** Cursor may use a different PATH than your terminal. Use an absolute path to the Node binary:

   ```json
   {
     "command": "/usr/local/bin/node",
     "args": ["/Users/me/projects/server/dist/index.js"]
   }
   ```

   On Windows:
   ```json
   {
     "command": "C:\\Program Files\\nodejs\\node.exe",
     "args": ["C:\\Users\\me\\projects\\server\\dist\\index.js"]
   }
   ```

4. **Check Cursor's MCP logs.** Cursor logs MCP-related errors to:
   - macOS: `~/Library/Application Support/Cursor/logs/`
   - Windows: `%APPDATA%\Cursor\logs\`
   - Linux: `~/.config/Cursor/logs/`

   Look for files containing "mcp" in the name.

### Tools not available in chat

**Solutions:**

1. **Ensure the server registers tools.** Not all MCP servers expose tools — some only expose resources or prompts. Verify your server calls `server.tool()` (TypeScript) or uses the `@mcp.tool()` decorator (Python).

2. **Check for tool name conflicts.** If two servers expose a tool with the same name, Cursor may only show one. Use unique, namespaced tool names (e.g., `fs_read_file` instead of `read_file`).

3. **Try the `@` mention.** In the chat input, type `@` and scroll through the available tools. If your server is listed but tools aren't showing, the server may have failed to register them.

### Remote server connection issues

**Solutions:**

1. **Verify the URL is accessible:**
   ```bash
   curl -I https://your-server.example.com/sse
   ```

2. **Check CORS settings.** Remote MCP servers must allow connections from Cursor. If you're using SSE, ensure the server sets appropriate CORS headers.

3. **Check authentication.** If your server requires auth, Cursor's MCP config currently doesn't support custom headers for remote servers. Consider using a local stdio proxy that adds the auth headers, or deploying the server without auth on a private network.

### Performance issues

If Cursor becomes slow after connecting an MCP server:

1. **Check the number of tools.** Servers with hundreds of tools can slow down the chat UI. Consider splitting into multiple focused servers.

2. **Check for long-running tool handlers.** Tools that take more than a few seconds to respond will make the chat feel unresponsive. Add timeouts to your tool handlers.

3. **Disable unused servers.** In `Settings > Features > MCP`, toggle off servers you don't need for the current task.
