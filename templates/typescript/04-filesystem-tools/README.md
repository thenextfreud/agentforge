# MCP Filesystem Tools Server (stdio)

Sandboxed file operations MCP server. Read, write, list, search, and inspect files — all restricted to a single root directory with path traversal prevention, symlink escape detection, file size limits, and extension allow-lists.

## Features

- **Sandboxed root** — all operations are confined to `SANDBOX_ROOT`
- **Path traversal prevention** — `../` escapes are blocked
- **Symlink escape detection** — symlinks pointing outside the sandbox are rejected
- **File size limits** — configurable via `MAX_FILE_SIZE_MB` (default 10 MB)
- **Extension allow-list** — restrict file types via `ALLOWED_EXTENSIONS`
- **Read-only mode** — disable write operations via `READ_ONLY=true`

## Quick start

```bash
npm install
cp .env.example .env
# Edit .env to set your SANDBOX_ROOT
mkdir -p /tmp/sandbox
npm run dev
```

## Environment variables

| Variable              | Required | Default | Description                                              |
|-----------------------|----------|---------|----------------------------------------------------------|
| `SANDBOX_ROOT`        | Yes      | —       | Root directory of the sandbox                            |
| `ALLOWED_EXTENSIONS`  | No       | `*`     | Comma-separated extensions (e.g. `txt,md,json`) or `*`  |
| `MAX_FILE_SIZE_MB`    | No       | `10`    | Maximum file size for read/write operations              |
| `READ_ONLY`           | No       | `false` | If `true`, write operations are disabled                 |

## Connect to Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "filesystem-tools": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"],
      "env": {
        "SANDBOX_ROOT": "/tmp/sandbox",
        "ALLOWED_EXTENSIONS": "*",
        "MAX_FILE_SIZE_MB": "10",
        "READ_ONLY": "false"
      }
    }
  }
}
```

Or use `tsx` for development:

```json
{
  "mcpServers": {
    "filesystem-tools": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/src/index.ts"],
      "env": {
        "SANDBOX_ROOT": "/tmp/sandbox"
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
    "filesystem-tools": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"],
      "env": {
        "SANDBOX_ROOT": "/tmp/sandbox"
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
    "filesystem-tools": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"],
      "env": {
        "SANDBOX_ROOT": "/tmp/sandbox"
      }
    }
  }
}
```

## Tools

### `read_file`
Read the contents of a file within the sandbox.

| Parameter  | Type   | Required | Default  | Description                                |
|------------|--------|----------|----------|--------------------------------------------|
| `path`     | string | Yes      | —        | Path to the file (relative to sandbox root)|
| `encoding` | string | No       | `utf-8`  | Text encoding                              |

### `write_file`
Write content to a file within the sandbox. Creates parent directories if needed.

| Parameter | Type    | Required | Default | Description                                |
|-----------|---------|----------|---------|--------------------------------------------|
| `path`    | string  | Yes      | —       | Path to the file                           |
| `content` | string  | Yes      | —       | Content to write                           |
| `append`  | boolean | No       | `false` | Append instead of overwriting              |

### `list_directory`
List the contents of a directory within the sandbox.

| Parameter | Type   | Required | Default | Description                                |
|-----------|--------|----------|---------|--------------------------------------------|
| `path`    | string | No       | `.`     | Directory path (relative to sandbox root)  |

### `search_files`
Recursively search for files and directories by name pattern.

| Parameter   | Type   | Required | Default | Description                                        |
|-------------|--------|----------|---------|----------------------------------------------------|
| `pattern`   | string | Yes      | —       | Search pattern (case-insensitive substring match)  |
| `directory` | string | No       | `.`     | Directory to search in                             |

### `get_file_info`
Get detailed metadata about a file or directory.

| Parameter | Type   | Required | Description                                |
|-----------|--------|----------|--------------------------------------------|
| `path`    | string | Yes      | Path to the file or directory              |

## Security model

This server enforces multiple layers of security:

1. **Sandbox root** — all paths are resolved relative to `SANDBOX_ROOT`. No operation can access files outside this directory.

2. **Path traversal prevention** — paths containing `../` that resolve outside the sandbox root are rejected with a `PATH_TRAVERSAL` error.

3. **Symlink escape detection** — before any file operation, the server checks whether the path is a symlink. If the symlink target resolves outside the sandbox, the operation is rejected with a `SYMLINK_ESCAPE` error. Chained symlinks are checked recursively.

4. **File size limits** — files larger than `MAX_FILE_SIZE_MB` are rejected for both read and write operations.

5. **Extension allow-list** — when `ALLOWED_EXTENSIONS` is set to specific extensions, files with unlisted extensions are rejected.

6. **Read-only mode** — when `READ_ONLY=true`, the `write_file` tool is disabled entirely.

## Project structure

```
04-filesystem-tools/
├── src/
│   ├── index.ts              # Server entry point, tool registration
│   ├── lib/
│   │   ├── logger.ts         # Structured stderr logger
│   │   ├── errors.ts         # Error handling utilities
│   │   └── sandbox.ts        # Path validation and security checks
│   └── tools/
│       ├── read-file.ts      # Read file contents
│       ├── write-file.ts     # Write file contents
│       ├── list-directory.ts # List directory entries
│       ├── search-files.ts   # Recursive file search
│       └── get-file-info.ts  # File metadata
├── tests/
│   └── tools.test.ts         # Unit tests (path traversal, symlinks, extensions, size limits)
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

Tests cover path traversal prevention, symlink escape detection, extension allow-lists, file size limits, read-only mode, and error handling utilities. Tests create temporary directories and do not require any external setup.

## Docker

```bash
docker build -t mcp-filesystem-tools .
docker run -i -e SANDBOX_ROOT=/data -v /path/to/data:/data mcp-filesystem-tools
```
