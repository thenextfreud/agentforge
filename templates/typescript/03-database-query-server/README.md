# MCP Database Query Server (stdio)

Safe read-only SQL query MCP server for PostgreSQL. Execute SELECT queries, list tables, describe table schemas, and get row counts — all with read-only enforcement, table allow-lists, row caps, query timeouts, and SQL injection prevention.

## Features

- **Read-only enforcement** — only SELECT, SHOW, DESCRIBE, and EXPLAIN queries are allowed
- **Table allow-list** — restrict access to specific tables via `ALLOWED_TABLES`
- **Row cap** — maximum 1000 rows returned per query (configurable via `MAX_ROWS`)
- **Query timeout** — queries are killed after `QUERY_TIMEOUT_MS` (default 30s)
- **SQL injection prevention** — parameterized queries (`$1`, `$2`) and table name validation
- **Multiple statement rejection** — semicolons in the middle of queries are blocked
- **Connection pooling** — efficient PostgreSQL connection management

## Quick start

```bash
npm install
cp .env.example .env
# Edit .env with your DATABASE_URL
npm run dev
```

### Set up the example database

```bash
# Create the database
createdb example_db

# Run the migration
psql postgresql://postgres:postgres@localhost:5432/example_db -f migrations/001_init.sql
```

## Environment variables

| Variable            | Required | Default | Description                                              |
|---------------------|----------|---------|----------------------------------------------------------|
| `DATABASE_URL`      | Yes      | —       | PostgreSQL connection string                             |
| `ALLOWED_TABLES`    | No       | `*`     | Comma-separated table names, or `*` for all tables       |
| `MAX_ROWS`          | No       | `1000`  | Maximum rows returned per query                          |
| `QUERY_TIMEOUT_MS`  | No       | `30000` | Query timeout in milliseconds                            |

## Connect to Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "database-query": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/example_db",
        "ALLOWED_TABLES": "users,posts",
        "MAX_ROWS": "1000",
        "QUERY_TIMEOUT_MS": "30000"
      }
    }
  }
}
```

Or use `tsx` for development:

```json
{
  "mcpServers": {
    "database-query": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/src/index.ts"],
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/example_db"
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
    "database-query": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/example_db"
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
    "database-query": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/example_db"
      }
    }
  }
}
```

## Tools

### `query_sql`
Execute a read-only SQL query with parameterized values.

| Parameter | Type     | Required | Description                                                              |
|-----------|----------|----------|--------------------------------------------------------------------------|
| `sql`     | string   | Yes      | The SQL query (SELECT, SHOW, DESCRIBE, EXPLAIN). Use `$1`, `$2` for params |
| `params`  | array    | No       | Parameter values (strings, numbers, booleans, null)                     |

**Example:** `SELECT * FROM users WHERE id = $1` with `params: [1]`

### `list_tables`
List all accessible tables in the database.

No parameters.

### `describe_table`
Describe the column structure of a table.

| Parameter     | Type   | Required | Description                      |
|---------------|--------|----------|----------------------------------|
| `table_name`  | string | Yes      | The name of the table to describe |

### `get_row_count`
Get the total number of rows in a table.

| Parameter     | Type   | Required | Description                    |
|---------------|--------|----------|--------------------------------|
| `table_name`  | string | Yes      | The name of the table to count |

## Safety model

This server enforces multiple layers of safety:

1. **Read-only enforcement** — queries must start with `SELECT`, `SHOW`, `DESCRIBE`, `EXPLAIN`, or `WITH`. All DML/DDL keywords (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `CREATE`, `ALTER`, `TRUNCATE`, etc.) are rejected.

2. **Table allow-list** — when `ALLOWED_TABLES` is set to specific table names, queries referencing unlisted tables are rejected.

3. **Row cap** — every query is automatically wrapped with `LIMIT MAX_ROWS` to prevent returning excessive data.

4. **Query timeout** — `statement_timeout` is set at both the pool and query level to kill long-running queries.

5. **SQL injection prevention** — user-supplied values must be passed via parameterized queries (`$1`, `$2`). Table names are validated against a strict `^[a-zA-Z_][a-zA-Z0-9_]*$` pattern.

6. **Multiple statement rejection** — semicolons in the middle of a query are blocked to prevent statement stacking attacks.

## Project structure

```
03-database-query-server/
├── src/
│   ├── index.ts              # Server entry point, tool registration
│   ├── lib/
│   │   ├── logger.ts         # Structured stderr logger
│   │   ├── errors.ts         # Error handling utilities
│   │   ├── db.ts             # PostgreSQL connection pool
│   │   └── sql-safety.ts     # Query validation and safety checks
│   └── tools/
│       ├── query-sql.ts      # Execute read-only SQL queries
│       ├── list-tables.ts    # List accessible tables
│       ├── describe-table.ts # Describe table schema
│       └── get-row-count.ts  # Get table row count
├── migrations/
│   └── 001_init.sql          # Example migration (users, posts tables)
├── tests/
│   └── tools.test.ts         # Unit tests (SQL safety, error handling)
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

Tests cover SQL safety validation (read-only enforcement, table allow-lists, injection prevention, row limit enforcement) and error handling utilities. No database connection is required for tests.

## Docker

```bash
docker build -t mcp-database-query .
docker run -i -e DATABASE_URL=postgresql://host:5432/db mcp-database-query
```

## Migration

The included `migrations/001_init.sql` creates example `users` and `posts` tables with seed data:

```bash
psql "$DATABASE_URL" -f migrations/001_init.sql
```
