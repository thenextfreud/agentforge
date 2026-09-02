# Time & Timezone MCP Server

A practical, ready-to-run example MCP server. No external API keys needed — uses built-in JavaScript `Intl` APIs.

## Tools

- **get-current-time** — Get current time in any timezone (defaults to UTC)
- **convert-time** — Convert a time between two timezones
- **get-timezone-info** — Get name, UTC offset, and current time for a timezone
- **list-timezones** — List common IANA timezones

## Quick start

```bash
cd examples/time-server
npm install
npm run dev    # development mode with hot reload
npm run build  # compile to dist/
npm start      # run compiled server
```

## Connect to Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "time-server": {
      "command": "node",
      "args": ["/absolute/path/to/examples/time-server/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop and try:
- "What time is it in Tokyo?"
- "Convert 3pm EST to Berlin time"
- "What's the UTC offset for India?"

## What this example teaches

- Tool registration with Zod input validation
- Error handling with `isError` responses
- Working with `Intl.DateTimeFormat` for timezone-safe formatting
- Clean code structure (schemas → helpers → server → handlers)
- stdio transport setup
