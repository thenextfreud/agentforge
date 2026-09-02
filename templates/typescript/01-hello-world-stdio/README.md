# MCP Hello World Server (stdio)

The minimum viable MCP server. Two tools (`echo`, `fetch_url`), stdio transport, Zod validation, structured stderr logging.

## Quick start

```bash
npm install
npm run dev
```

## Connect to Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hello-world": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"]
    }
  }
}
```

Or use `tsx` for development:

```json
{
  "mcpServers": {
    "hello-world": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/src/index.ts"]
    }
  }
}
```

## Connect to Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "hello-world": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"]
    }
  }
}
```

## Connect to Windsurf

Add to Windsurf MCP settings:

```json
{
  "mcpServers": {
    "hello-world": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"]
    }
  }
}
```

## Tools

### `echo`
Echo back a message. Useful for testing connectivity.

| Parameter   | Type    | Required | Description                        |
|-------------|---------|----------|------------------------------------|
| `message`   | string  | Yes      | The message to echo back           |
| `uppercase` | boolean | No       | Convert message to uppercase       |

### `fetch_url`
Fetch the content of a URL as plain text.

| Parameter    | Type    | Required | Default | Description                          |
|--------------|---------|----------|---------|--------------------------------------|
| `url`        | string  | Yes      | —       | The URL to fetch                     |
| `max_length` | number  | No       | 10000   | Maximum response length in characters|

## Project structure

```
01-hello-world-stdio/
├── src/
│   ├── index.ts          # Server entry point
│   ├── lib/
│   │   ├── logger.ts     # Structured stderr logger
│   │   └── errors.ts     # Error handling utilities
│   └── tools/
│       ├── echo.ts       # Echo tool
│       └── fetch-url.ts  # URL fetcher tool
├── tests/
│   └── tools.test.ts     # Unit tests
├── package.json
├── tsconfig.json
├── Dockerfile
└── README.md
```

## Building

```bash
npm run build    # Compile to dist/
npm start        # Run compiled version
```

## Testing

```bash
npm test
```

## Docker

```bash
docker build -t mcp-hello-world .
docker run -i mcp-hello-world
```
