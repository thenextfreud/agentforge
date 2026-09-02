# SaaS Integration Template (Python, stdio)

A template for wrapping **any SaaS API** as an MCP server — the patterns you'd reinvent for every integration, ready to go. Includes OAuth2 client credentials auth, retries with exponential backoff + `Retry-After` support, cursor/page pagination, request IDs in errors, and webhook signature verification.

The concrete example wraps a hypothetical **"ProjectManager"** SaaS API with generic CRUD tools (`list_items`, `get_item`, `create_item`, `update_item`, `delete_item`). Swap the resource path and field names to wrap your own SaaS.

Built with [FastMCP](https://modelcontextprotocol.io), Pydantic, and httpx.

## Features

- **OAuth2 client credentials flow** — server-to-server auth with a cached access token (auto-refreshed before expiry).
- **Retries with exponential backoff** — configurable max retries; honors `Retry-After` headers (seconds or HTTP-date).
- **Pagination** — async generator that normalizes cursor-based *and* page-based APIs behind one interface.
- **Request IDs** — every request gets an `X-Request-Id`; every error includes it for traceability.
- **Webhook signature verification** — HMAC-SHA256 with `sha256=` prefix support (GitHub/Slack style).
- **Generic CRUD tools** — the five verbs every SaaS resource needs.
- **Pydantic input validation** + structured stderr logging.

## Quick start

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

pip install -e ".[dev]"

cp .env.example .env
# edit .env — set SAAS_API_URL, SAAS_CLIENT_ID, SAAS_CLIENT_SECRET, SAAS_TOKEN_URL, WEBHOOK_SECRET

saas-integration-server
```

## Connect to Claude Desktop / Cursor / Windsurf

```json
{
  "mcpServers": {
    "saas-integration": {
      "command": "saas-integration-server",
      "env": {
        "SAAS_API_URL": "https://api.projectmanager.example.com",
        "SAAS_CLIENT_ID": "your-client-id",
        "SAAS_CLIENT_SECRET": "your-client-secret",
        "SAAS_TOKEN_URL": "https://auth.projectmanager.example.com/oauth/token",
        "MAX_RETRIES": "3"
      }
    }
  }
}
```

Or run from source:

```json
{
  "mcpServers": {
    "saas-integration": {
      "command": "python",
      "args": ["-m", "src.server"],
      "cwd": "/absolute/path/to/08-saas-integration-template"
    }
  }
}
```

## Tools

### `list_items`
List items (projects), paginating automatically across cursor- or page-based endpoints.

| Parameter   | Type    | Required | Default | Description                       |
|-------------|---------|----------|---------|-----------------------------------|
| `page_size` | integer | No       | 50      | Items per page (1–200)            |
| `max_pages` | integer | No       | 10      | Maximum pages to fetch (1–100)    |

### `get_item`
Fetch a single item by id.

| Parameter | Type   | Required | Description                  |
|-----------|--------|----------|------------------------------|
| `item_id` | string | Yes      | The id of the item to fetch  |

### `create_item`
Create a new item.

| Parameter     | Type          | Required | Description                |
|---------------|---------------|----------|----------------------------|
| `name`        | string        | Yes      | Name of the new item       |
| `description` | string        | No       | Optional description       |
| `tags`        | array[string] | No       | Optional list of tags      |

### `update_item`
Update an existing item. Only provided fields are changed (PATCH semantics).

| Parameter     | Type          | Required | Description                  |
|---------------|---------------|----------|------------------------------|
| `item_id`     | string        | Yes      | The id of the item to update |
| `name`        | string        | No       | New name                     |
| `description` | string        | No       | New description              |
| `tags`        | array[string] | No       | New tags                     |

### `delete_item`
Delete an item by id.

| Parameter | Type   | Required | Description                  |
|-----------|--------|----------|------------------------------|
| `item_id` | string | Yes      | The id of the item to delete |

### `verify_webhook`
Verify a webhook's HMAC-SHA256 signature against `WEBHOOK_SECRET`. Pass the **raw** request body and the signature header value.

| Parameter  | Type   | Required | Description                                  |
|------------|--------|----------|----------------------------------------------|
| `body`     | string | Yes      | The raw webhook request body (exact bytes)   |
| `signature`| string | Yes      | The `X-Webhook-Signature` header value       |

## Configuration (env)

| Variable            | Default                                                  | Description                                  |
|---------------------|----------------------------------------------------------|----------------------------------------------|
| `SAAS_API_URL`      | `https://api.projectmanager.example.com`                 | SaaS API base URL                            |
| `SAAS_CLIENT_ID`    | —                                                        | OAuth2 client id                             |
| `SAAS_CLIENT_SECRET`| —                                                        | OAuth2 client secret                         |
| `SAAS_TOKEN_URL`    | `https://auth.projectmanager.example.com/oauth/token`    | OAuth2 token endpoint                        |
| `SAAS_API_SCOPE`    | —                                                        | Optional scope requested during token exchange |
| `WEBHOOK_SECRET`    | —                                                        | HMAC-SHA256 shared secret for webhooks       |
| `MAX_RETRIES`       | `3`                                                      | Max retry attempts for retryable errors      |
| `REQUEST_TIMEOUT`   | `30`                                                     | HTTP request timeout (seconds)               |
| `RETRY_BASE_DELAY`  | `1`                                                      | Base delay (seconds) for exponential backoff |
| `DEFAULT_PAGE_SIZE` | `50`                                                     | Default items per page                       |

## How it works

### Auth
`SaaSClient` performs the OAuth2 client credentials grant on first use and caches the access token, refreshing it 30s before expiry. Every request carries `Authorization: Bearer <token>` and an `X-Request-Id`.

### Retries
Retryable status codes (`429`, `5xx`) trigger a retry with exponential backoff (`base * 2^attempt`). If the response includes a `Retry-After` header (seconds), that value is used instead. Non-retryable codes (`400`, `401`, `403`, `404`, `409`, `422`) fail immediately with a normalized `SaaSError` carrying the request id.

### Pagination
`paginate()` is an async generator that auto-detects cursor-based (`next_cursor`/`after`) vs page-based (`total_pages`) responses and yields each page's items. `collect_all()` flattens them into a single list.

### Webhooks
`verify_webhook()` compares the provided signature against `HMAC-SHA256(WEBHOOK_SECRET, body)` using constant-time comparison. Supports both `<hex>` and `sha256=<hex>` header formats.

## Adapting to your SaaS

1. Set `RESOURCE_PATH` in `src/tools/crud.py` to your resource (e.g. `/tickets`).
2. Adjust the fields in `create_item` / `update_item` to match your API.
3. Update `SAAS_API_URL`, `SAAS_TOKEN_URL` in `.env`.
4. If your SaaS uses a different auth flow (API keys, basic auth), replace `_fetch_token` in `src/lib/saas_client.py`.

## Project structure

```
08-saas-integration-template/
├── src/
│   ├── server.py              # Entry point
│   ├── lib/
│   │   ├── logger.py          # Structured stderr logger
│   │   ├── errors.py          # ToolError + response helpers
│   │   ├── config.py          # Env-driven configuration
│   │   ├── saas_client.py     # HTTP client: auth, retries, request IDs
│   │   ├── pagination.py      # Cursor + page-based pagination
│   │   └── webhooks.py        # HMAC-SHA256 webhook verification
│   └── tools/
│       ├── crud.py            # list/get/create/update/delete tools
│       └── webhook_tool.py    # verify_webhook tool
├── tests/
│   └── test_tools.py          # Pagination, webhook, retry, error tests
├── pyproject.toml
├── Dockerfile
├── .env.example
└── README.md
```

## Testing

```bash
pip install -e ".[dev]"
pytest
```

Tests use a stubbed httpx transport to exercise retry behavior and error normalization without real network calls. Webhook and pagination tests are pure functions.

## Docker

```bash
docker build -t saas-integration-server .
docker run -i saas-integration-server
```
