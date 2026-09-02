# Windsurf Setup

Windsurf (by Codeium) is an AI-native IDE with built-in MCP server support. This guide covers configuring your AgentForge MCP servers in Windsurf, using tools in Cascade (Windsurf's AI assistant), and troubleshooting common issues.

---

## Locating MCP Settings

Windsurf provides two ways to configure MCP servers: through the GUI settings panel or by editing the configuration file directly.

### Option A: GUI Settings (recommended)

1. Open Windsurf.
2. Navigate to **Settings > MCP Servers** (or `Windsurf > Settings > MCP Servers` on macOS).
3. Click **"Add Server"** or the **"+"** button.
4. Fill in the server details:
   - **Name:** A unique identifier for your server
   - **Transport:** stdio or SSE/HTTP
   - **Command:** The executable to run (for stdio)
   - **Args:** Command-line arguments (for stdio)
   - **URL:** The server endpoint (for SSE/HTTP)
   - **Environment variables:** Key-value pairs
5. Click **Save** and restart Windsurf.

### Option B: Configuration File

Windsurf stores MCP server configuration in a JSON file:

| OS | Path |
|---|---|
| **macOS** | `~/.codeium/windsurf/mcp_config.json` |
| **Windows** | `%USERPROFILE%\.codeium\windsurf\mcp_config.json` |
| **Linux** | `~/.codeium/windsurf/mcp_config.json` |

> **Note:** On some Windsurf versions, the file may be named `windsurf_config.json` and located in `~/.config/windsurf/`. Check both locations if you can't find it.

Create the file if it doesn't exist:

```bash
mkdir -p ~/.codeium/windsurf
touch ~/.codeium/windsurf/mcp_config.json
```

---

## Configuration Format

### stdio server

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

### Example: TypeScript stdio server

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

### Example: Python stdio server with environment variables

```json
{
  "mcpServers": {
    "rag-server": {
      "command": "uv",
      "args": ["run", "python", "/Users/me/projects/rag-server/main.py"],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "VECTOR_DB_URL": "http://localhost:6334"
      }
    }
  }
}
```

### Example: Remote SSE server

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

## Using MCP Tools in Cascade

Cascade is Windsurf's AI assistant. Once your MCP server is connected, Cascade can use your tools during conversations.

### Verifying the connection

1. Open the Cascade panel (usually on the right side of the IDE, or via `Cmd+L` / `Ctrl+L`).
2. Look for the **tools icon** or the **MCP servers indicator** in the Cascade UI.
3. Go to **Settings > MCP Servers** to see the status of each configured server. A green dot means connected; red means an error occurred.

### Using tools in conversation

1. Open Cascade and start a conversation.
2. Ask a question that requires your MCP tools. For example:
   - *"Read the file at /data/config.json and summarize its contents"* (filesystem server)
   - *"Find all orders with status 'pending' in the database"* (database server)
3. Cascade will automatically detect which MCP tools are relevant and call them.
4. You'll see the tool call and its result in the conversation flow.

### Tool approval

Windsurf Cascade asks for confirmation before executing MCP tool calls that have side effects (write, delete, modify). You can configure this:

- **Settings > Cascade > Tool Approval** — Choose between "Always ask," "Ask for write operations only," or "Auto-approve all."

> **Best practice:** Keep approval enabled for write operations. MCP tools can modify files, execute commands, or make API calls — always review what the agent is about to do.

---

## Troubleshooting

### Server not appearing in settings

**Solutions:**

1. **Restart Windsurf.** MCP config is loaded on startup. Fully quit and relaunch the application.

2. **Verify the config file path.** Check that the JSON file exists at the correct location for your OS (see the table above).

3. **Validate JSON syntax:**
   ```bash
   cat ~/.codeium/windsurf/mcp_config.json | python3 -m json.tool
   ```

4. **Check for GUI vs. file conflicts.** If you configured servers through the GUI and also have a config file, make sure there are no duplicate server names.

### Server shows error status

**Solutions:**

1. **Run the server command manually:**
   ```bash
   node /path/to/your/server/dist/index.js
   ```
   If it crashes, fix the error first.

2. **Check environment variables.** Missing required env vars (API keys, database URLs) will cause startup failures. Add them to the `env` field.

3. **Use absolute paths.** Windsurf may not inherit your shell's PATH. Use absolute paths for both the command and script:
   ```json
   {
     "command": "/usr/local/bin/node",
     "args": ["/Users/me/projects/server/dist/index.js"]
   }
   ```

4. **Check Windsurf logs.** Windsurf logs are located at:
   - macOS: `~/Library/Logs/Windsurf/`
   - Windows: `%APPDATA%\Windsurf\logs\`
   - Linux: `~/.config/Windsurf/logs/`

### Cascade can't see tools

**Solutions:**

1. **Verify the server exposes tools.** Check that your server registers tools (not just resources or prompts).

2. **Check for tool name uniqueness.** If two servers define a tool with the same name, one may be shadowed. Use descriptive, namespaced names.

3. **Restart the Cascade conversation.** Sometimes Cascade needs a new conversation to pick up newly registered tools. Close the current conversation and start a new one.

### Remote server connection issues

**Solutions:**

1. **Test the URL with curl:**
   ```bash
   curl -N https://your-server.example.com/sse
   ```
   You should see SSE event data streaming. If you get a connection error, the server isn't running or the URL is wrong.

2. **Check for authentication requirements.** If your remote server requires auth headers, Windsurf's config file may not support custom headers. Use a local stdio proxy or deploy the server without auth on a secured network.

3. **Verify SSE compatibility.** Windsurf supports both SSE and Streamable HTTP transports. If your server uses Streamable HTTP, make sure the URL points to the correct endpoint (e.g., `/mcp` rather than `/sse`).

### Performance issues

If Windsurf becomes slow after connecting an MCP server:

1. **Limit the number of tools.** Servers with too many tools can slow down Cascade's planning. Keep each server focused on a specific domain.

2. **Add timeouts to tool handlers.** Long-running tools block the conversation. Implement a timeout (e.g., 30 seconds) and return an error if the tool takes too long.

3. **Disable unused servers.** In Settings > MCP Servers, toggle off servers you don't need for the current session.
