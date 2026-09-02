# MCP Web Search & Fetch Server (stdio)

Web search and URL fetching MCP server. Search the web with pluggable providers (DuckDuckGo, Brave, Tavily, SerpAPI), fetch URLs and extract readable text, and fetch JSON from APIs.

## Features

- **Pluggable search providers** — DuckDuckGo (free, default), Brave Search, Tavily, SerpAPI
- **HTML text extraction** — strips scripts, styles, and tags; decodes entities; preserves line breaks
- **JSON fetching** — fetch URLs and parse as JSON with custom headers
- **Content length limits** — configurable via `MAX_CONTENT_LENGTH` (default 50000 chars)
- **Request timeouts** — configurable via `REQUEST_TIMEOUT_MS` (default 15000ms)
- **Metadata extraction** — extracts page titles and meta descriptions

## Quick start

```bash
npm install
cp .env.example .env
# Edit .env to configure your search provider
npm run dev
```

## Environment variables

| Variable              | Required | Default           | Description                                          |
|-----------------------|----------|-------------------|------------------------------------------------------|
| `SEARCH_PROVIDER`     | No       | `duckduckgo`      | Search provider: `duckduckgo`, `brave`, `tavily`, `serpapi` |
| `BRAVE_API_KEY`       | No*      | —                 | Required if `SEARCH_PROVIDER=brave`                 |
| `TAVILY_API_KEY`      | No*      | —                 | Required if `SEARCH_PROVIDER=tavily`                |
| `SERPAPI_KEY`         | No*      | —                 | Required if `SEARCH_PROVIDER=serpapi`               |
| `USER_AGENT`          | No       | `AgentForge-MCP/1.0` | User-Agent string for HTTP requests              |
| `MAX_CONTENT_LENGTH`  | No       | `50000`           | Maximum content length in characters                 |
| `REQUEST_TIMEOUT_MS`  | No       | `15000`           | Request timeout in milliseconds                      |

*API key is required only when the corresponding provider is selected.

## Connect to Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "web-search-fetch": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"],
      "env": {
        "SEARCH_PROVIDER": "duckduckgo",
        "MAX_CONTENT_LENGTH": "50000",
        "REQUEST_TIMEOUT_MS": "15000"
      }
    }
  }
}
```

With Brave Search:

```json
{
  "mcpServers": {
    "web-search-fetch": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"],
      "env": {
        "SEARCH_PROVIDER": "brave",
        "BRAVE_API_KEY": "your-brave-api-key"
      }
    }
  }
}
```

Or use `tsx` for development:

```json
{
  "mcpServers": {
    "web-search-fetch": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/src/index.ts"],
      "env": {
        "SEARCH_PROVIDER": "duckduckgo"
      }
    }
  }
}
```

## Connect to Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "web-search-fetch": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"],
      "env": {
        "SEARCH_PROVIDER": "duckduckgo"
      }
    }
  }
}
```

## Connect to Windsurf

Add to Windsurf MCP settings:

```json
{
  "mcpServers": {
    "web-search-fetch": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"],
      "env": {
        "SEARCH_PROVIDER": "duckduckgo"
      }
    }
  }
}
```

## Tools

### `web_search`
Search the web using the configured search provider.

| Parameter      | Type   | Required | Default | Description                              |
|----------------|--------|----------|---------|------------------------------------------|
| `query`        | string | Yes      | —       | The search query                         |
| `max_results`  | number | No       | 10      | Maximum results (max 20)                 |

Returns: provider name, query, result count, and array of `{ title, url, snippet }`.

### `fetch_url`
Fetch a URL and extract readable text content.

| Parameter     | Type   | Required | Default | Description                                      |
|---------------|--------|----------|---------|--------------------------------------------------|
| `url`         | string | Yes      | —       | The URL to fetch                                 |
| `max_length`  | number | No       | 50000   | Maximum content length (overrides env)           |

Returns: URL, status, content-type, title, meta description, and extracted text.

### `extract_text`
Extract readable text from an HTML string (no HTTP request).

| Parameter     | Type   | Required | Description                                      |
|---------------|--------|----------|--------------------------------------------------|
| `html`        | string | Yes      | The HTML string to extract text from             |
| `max_length`  | number | No       | Maximum content length (overrides env)           |

Returns: title, content length, truncated flag, and extracted text.

### `fetch_json`
Fetch a URL and parse the response as JSON.

| Parameter | Type   | Required | Description                          |
|-----------|--------|----------|--------------------------------------|
| `url`     | string | Yes      | The URL to fetch                     |
| `headers` | object | No       | Additional HTTP headers to send      |

Returns: URL, status, content-type, and parsed JSON data.

## Search providers

### DuckDuckGo (default, free)
No API key required. Uses the DuckDuckGo Instant Answer API. Provides instant answer results, related topics, and definitions. Best for quick lookups and factual queries.

### Brave Search
Requires `BRAVE_API_KEY`. Provides full web search results with titles, URLs, and snippets. Get an API key at [brave.com/search/api](https://brave.com/search/api/).

### Tavily
Requires `TAVILY_API_KEY`. AI-optimized search API that returns content-rich results. Get an API key at [tavily.com](https://tavily.com/).

### SerpAPI
Requires `SERPAPI_KEY`. Provides Google search results programmatically. Get an API key at [serpapi.com](https://serpapi.com/).

## Project structure

```
05-web-search-fetch/
├── src/
│   ├── index.ts                  # Server entry point, tool registration
│   ├── lib/
│   │   ├── logger.ts             # Structured stderr logger
│   │   ├── errors.ts             # Error handling utilities
│   │   ├── html-extractor.ts     # HTML text extraction utility
│   │   └── search/
│   │       ├── index.ts          # Provider factory
│   │       ├── types.ts          # Search provider interface
│   │       ├── duckduckgo.ts     # DuckDuckGo provider (free)
│   │       ├── brave.ts          # Brave Search provider
│   │       ├── tavily.ts         # Tavily provider
│   │       └── serpapi.ts        # SerpAPI provider
│   └── tools/
│       ├── web-search.ts         # Web search tool
│       ├── fetch-url.ts          # URL fetcher with text extraction
│       ├── extract-text.ts       # HTML text extraction tool
│       └── fetch-json.ts         # JSON API fetcher
├── tests/
│   └── tools.test.ts             # Unit tests (HTML extraction, error handling)
├── package.json
├── tsconfig.json
├── Dockerfile
├── .env.example
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

Tests cover HTML text extraction (tag stripping, entity decoding, truncation, script/style removal), metadata extraction (title, meta description), and error handling utilities. No network requests are made during tests.

## Docker

```bash
docker build -t mcp-web-search-fetch .
docker run -i -e SEARCH_PROVIDER=duckduckgo mcp-web-search-fetch
```

With Brave Search:

```bash
docker run -i -e SEARCH_PROVIDER=brave -e BRAVE_API_KEY=your-key mcp-web-search-fetch
```
