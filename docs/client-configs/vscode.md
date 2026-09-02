# VS Code (Continue Extension) Setup

[Continue](https://continue.dev) is an open-source AI coding assistant extension for VS Code and JetBrains IDEs. It supports MCP servers as tool providers, giving the Continue assistant access to your custom tools directly within VS Code.

---

## Prerequisites

- **VS Code** 1.85+ installed
- **Continue extension** installed from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Continue.continue)
- Your AgentForge MCP server built and ready (`pnpm build` or `uv sync`)

### Install Continue

1. Open VS Code.
2. Go to the Extensions panel (`Ctrl+Shift+X` / `Cmd+Shift+X`).
3. Search for "Continue" and click **Install**.
4. Reload VS Code if prompted.

---

## Locating the Configuration File

Continue stores its configuration in a JSON file at:

| OS | Path |
|---|---|
| **macOS** | `~/.continue/config.json` |
| **Windows** | `%USERPROFILE%\.continue\config.json` |
| **Linux** | `~/.continue/config.json` |

> **Note:** On some Continue versions, the config may be at `~/.continue/config.yaml` or `~/.continue/config.ts`. The MCP server configuration is added to the `config.json` variant. If you're using `config.yaml` or `config.ts`, refer to Continue's documentation for the equivalent syntax.

### Creating the file

If it doesn't exist:

```bash
mkdir -p ~/.continue
touch ~/.continue/config.json
```

> You can also open the config file from within VS Code by clicking the Continue icon in the sidebar and selecting **Settings** (gear icon) > **Open config file**.

---

## Configuration Format

Continue uses an `mcpServers` key in the config file, similar to Claude Desktop:

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

> If you already have other Continue config keys (like `models`, `tabAutocompleteModel`, etc.), add `mcpServers` alongside them — don't replace the entire file.

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
        "LOG_LEVEL": "info"
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

### Example: Full config with other Continue settings

```json
{
  "models": [
    {
      "title": "Claude 3.5 Sonnet",
      "provider": "anthropic",
      "model": "claude-3-5-sonnet-20241022",
      "apiKey": "your-anthropic-key"
    }
  ],
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
    }
  }
}
```

---

## Using MCP Tools in Continue

Once configured, your MCP tools are available to the Continue assistant in the VS Code chat sidebar.

### Verifying the connection

1. Click the **Continue icon** in the VS Code sidebar to open the chat panel.
2. Look for a **tools indicator** or check **Settings > MCP** within the Continue panel.
3. You should see your configured servers listed with their status.

### Using tools in chat

1. Type a message in the Continue chat input that requires your MCP tools. For example:
   - *"Read the file /data/config.json and tell me what database it's configured for"* (filesystem server)
   - *"Search the codebase for all uses of the deprecated API"* (RAG server)
2. Continue will detect that an MCP tool is needed, call it, and use the result to answer your question.
3. The tool call and response will be visible in the chat flow.

### Using tools in inline edit

Continue's inline edit feature (`Cmd+I` / `Ctrl+I`) can also leverage MCP tools:

1. Select code or place your cursor where you want to edit.
2. Press `Cmd+I` (macOS) or `Ctrl+I` (Windows/Linux).
3. Describe what you want. If the task requires MCP tools (e.g., querying a database for context), Continue will call them.

### Tool approval

Continue shows a confirmation prompt before executing MCP tool calls with side effects. You can configure this in the Continue settings:

- **Always confirm** — Every tool call requires approval (default for write operations).
- **Auto-approve read-only** — Read-only tools run without confirmation.
- **Auto-approve all** — All tools run without confirmation (use with caution in production).

---

## Troubleshooting

### Server not appearing in Continue

**Solutions:**

1. **Reload VS Code.** After editing the config, reload the window (`Cmd+Shift+P` > "Developer: Reload Window") or restart VS Code entirely.

2. **Verify the config file location.** Ensure the file is at `~/.continue/config.json` (not in a project-local `.continue` directory — Continue reads from the home directory).

3. **Validate JSON syntax:**
   ```bash
   cat ~/.continue/config.json | python3 -m json.tool
   ```

4. **Check for config format conflicts.** If you have a `config.yaml` or `config.ts` file alongside `config.json`, Continue may be reading the wrong one. Remove or rename the unused file.

### Server shows error / disconnected

**Solutions:**

1. **Run the server command manually:**
   ```bash
   node /path/to/your/server/dist/index.js
   ```
   Fix any errors that appear.

2. **Check environment variables.** Missing env vars are the most common cause of startup failures. Ensure all required variables are in the `env` field.

3. **Use absolute paths.** VS Code may not inherit your shell's PATH. Use absolute paths for the command and script:
   ```json
   {
     "command": "/usr/local/bin/node",
     "args": ["/Users/me/projects/server/dist/index.js"]
   }
   ```

4. **Check Node.js version.** MCP servers require Node.js 18+. Run `node --version` in a terminal.

5. **Check Continue's logs.** Continue logs are available in:
   - macOS: `~/Library/Logs/Continue/`
   - Windows: `%APPDATA%\Continue\logs\`
   - Linux: `~/.config/Continue/logs/`

### Tools not available in chat

**Solutions:**

1. **Verify the server registers tools.** Check that your server calls `server.tool()` (TypeScript) or uses `@mcp.tool()` (Python).

2. **Check for tool name conflicts.** Unique, namespaced tool names prevent conflicts between multiple servers.

3. **Start a new chat session.** Continue may cache the tool list from the start of a session. Start a new conversation to pick up newly registered tools.

4. **Check the Continue version.** MCP support was added in Continue v0.8+. Update the extension if you're on an older version.

### Remote server issues

**Solutions:**

1. **Test the endpoint:**
   ```bash
   curl -N https://your-server.example.com/sse
   ```

2. **Check CORS.** The server must allow requests from the Continue extension's origin. If you're getting CORS errors, configure your server to send `Access-Control-Allow-Origin` headers.

3. **Verify transport type.** Continue supports both SSE and Streamable HTTP. Make sure the URL points to the correct endpoint for your transport.

### Performance issues

If VS Code becomes slow after connecting an MCP server:

1. **Reduce tool count.** Each registered tool adds to Continue's context. Keep servers focused.

2. **Add timeouts.** Tools that hang will block the chat. Implement a 30-second timeout in your tool handlers.

3. **Disable unused servers.** Comment out or remove servers you don't need from the config file.
