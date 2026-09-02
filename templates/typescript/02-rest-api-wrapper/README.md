# MCP REST API Wrapper Server (stdio)

Wrap any external REST API as MCP tools. Includes generic REST operations (`api_get`, `api_post`, `api_list`) and a concrete example wrapping the [JSONPlaceholder](https://jsonplaceholder.typicode.com) API (`get_post`, `get_user`, `list_posts`, `create_post`).

## Features

- **Configurable base URL** — point at any REST API via `API_BASE_URL`
- **API key auth** — sent via configurable header (`API_KEY_HEADER`)
- **Request timeouts** — configurable via `REQUEST_TIMEOUT_MS`
- **Retry with exponential backoff** — 3 retries by default, retries on 429 and 5xx
- **Pagination** — cursor and offset-based pagination support
- **Rate-limit tracking** — parses `X-RateLimit-*` and `Retry-After` headers

## Quick start

```bash
npm install
cp .env.example .env
# Edit .env to point at your API
npm run dev
```

## Environment variables

| Variable              | Required | Default         | Description                                      |
|-----------------------|----------|-----------------|--------------------------------------------------|
| `API_BASE_URL`        | Yes      | —               | Base URL of the REST API to wrap                 |
| `API_KEY`             | No       | —               | API key sent in the auth header                  |
| `API_KEY_HEADER`      | No       | `Authorization` | Header name for the API key                      |
| `REQUEST_TIMEOUT_MS`  | No       | `10000`         | Request timeout in milliseconds                  |
| `MAX_RETRIES`         | No       | `3`             | Maximum retry attempts for failed requests       |

## Connect to Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "rest-api-wrapper": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"],
      "env": {
        "API_BASE_URL": "https://jsonplaceholder.typicode.com",
        "API_KEY": "",
        "REQUEST_TIMEOUT_MS": "10000",
        "MAX_RETRIES": "3"
      }
    }
  }
}
```

Or use `tsx` for development:

```json
{
  "mcpServers": {
    "rest-api-wrapper": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/src/index.ts"],
      "env": {
        "API_BASE_URL": "https://jsonplaceholder.typicode.com"
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
    "rest-api-wrapper": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"],
      "env": {
        "API_BASE_URL": "https://jsonplaceholder.typicode.com"
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
    "rest-api-wrapper": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"],
      "env": {
        "API_BASE_URL": "https://jsonplaceholder.typicode.com"
      }
    }
  }
}
```

## Tools

### Generic REST tools

#### `api_get`
Perform a GET request to any path on the configured API.

| Parameter | Type   | Required | Description                                              |
|-----------|--------|----------|----------------------------------------------------------|
| `path`    | string | Yes      | API path (e.g. `/posts/1`)                               |
| `params`  | object | No       | Query parameters as key-value pairs                      |
| `cursor`  | string | No       | Pagination cursor from a previous response               |
| `offset`  | number | No       | Offset for offset-based pagination                       |
| `limit`   | number | No       | Maximum number of results                                |

#### `api_post`
Perform a POST request with a JSON body.

| Parameter | Type   | Required | Description                          |
|-----------|--------|----------|--------------------------------------|
| `path`    | string | Yes      | API path                             |
| `body`    | object | Yes      | JSON body to send                    |
| `params`  | object | No       | Query parameters as key-value pairs  |

#### `api_list`
List resources with automatic pagination metadata.

| Parameter | Type   | Required | Description                                    |
|-----------|--------|----------|------------------------------------------------|
| `path`    | string | Yes      | API path to list                               |
| `limit`   | number | No       | Items per page (max 100)                       |
| `cursor`  | string | No       | Pagination cursor from previous response       |
| `offset`  | number | No       | Offset for offset-based pagination             |
| `params`  | object | No       | Additional query parameters                    |

### JSONPlaceholder example tools

#### `get_post`
Fetch a single post by ID.

| Parameter | Type   | Required | Description          |
|-----------|--------|----------|----------------------|
| `id`      | number | Yes      | The post ID to fetch |

#### `get_user`
Fetch a single user by ID.

| Parameter | Type   | Required | Description          |
|-----------|--------|----------|----------------------|
| `id`      | number | Yes      | The user ID to fetch |

#### `list_posts`
List posts with offset-based pagination.

| Parameter | Type   | Required | Default | Description                          |
|-----------|--------|----------|---------|--------------------------------------|
| `limit`   | number | No       | 10      | Posts per page (max 100)             |
| `offset`  | number | No       | 0       | Offset for pagination                |
| `user_id` | number | No       | —       | Filter posts by user ID              |

#### `create_post`
Create a new post (simulated — JSONPlaceholder is a mock API).

| Parameter | Type   | Required | Description                    |
|-----------|--------|----------|--------------------------------|
| `title`   | string | Yes      | Title of the post (max 200)    |
| `body`    | string | Yes      | Body content of the post       |
| `user_id` | number | Yes      | ID of the authoring user       |

## Project structure

```
02-rest-api-wrapper/
├── src/
│   ├── index.ts              # Server entry point, tool registration
│   ├── lib/
│   │   ├── logger.ts         # Structured stderr logger
│   │   ├── errors.ts         # Error handling utilities
│   │   ├── retry.ts          # Exponential backoff retry utility
│   │   └── api-client.ts     # HTTP client wrapper with auth, retry, rate-limit
│   └── tools/
│       ├── api-get.ts        # Generic GET tool
│       ├── api-post.ts       # Generic POST tool
│       ├── api-list.ts       # Generic list tool with pagination
│       ├── get-post.ts       # JSONPlaceholder: get post by ID
│       ├── get-user.ts       # JSONPlaceholder: get user by ID
│       ├── list-posts.ts     # JSONPlaceholder: list posts with pagination
│       └── create-post.ts    # JSONPlaceholder: create a post
├── tests/
│   └── tools.test.ts         # Unit tests
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

## Docker

```bash
docker build -t mcp-rest-api-wrapper .
docker run -i -e API_BASE_URL=https://jsonplaceholder.typicode.com mcp-rest-api-wrapper
```

## Wrapping your own API

1. Set `API_BASE_URL` to your API's base URL
2. Set `API_KEY` and `API_KEY_HEADER` if your API requires authentication
3. Use the generic tools (`api_get`, `api_post`, `api_list`) to interact with any endpoint
4. Optionally add concrete tools (like `get-post.ts`) for type-safe, documented endpoints
