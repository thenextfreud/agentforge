# Testing MCP Servers

Testing is essential for production MCP servers. This guide covers unit testing, mocking MCP client connections, integration testing, and testing security boundaries.

---

## Unit Testing Tools

### Node.js built-in test runner

AgentForge TypeScript templates use Node.js's built-in test runner (`node:test`) — no external dependencies required:

```typescript
// tests/tools.test.ts
import { describe, it, beforeEach, mock } from "node:test";
import { strict as assert } from "node:assert";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Import the server factory (not the running server)
import { createServer } from "../src/index.js";

describe("greet tool", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createServer();
  });

  it("should greet a user by name", async () => {
    // Access the tool handler directly
    const tools = server.listTools();
    const greetTool = tools.find((t) => t.name === "greet");
    
    assert.ok(greetTool, "greet tool should exist");
    
    const result = await greetTool.handler({ name: "Alice" });
    
    assert.strictEqual(result.content[0].type, "text");
    assert.match(result.content[0].text, /Hello, Alice/);
  });

  it("should handle empty name gracefully", async () => {
    const tools = server.listTools();
    const greetTool = tools.find((t) => t.name === "greet");
    
    const result = await greetTool.handler({ name: "" });
    
    assert.strictEqual(result.content[0].type, "text");
    assert.match(result.content[0].text, /Hello, /);
  });
});
```

Run tests:

```bash
pnpm test
# or
node --test --import tsx tests/**/*.test.ts
```

### pytest (Python)

AgentForge Python templates use pytest:

```python
# tests/test_tools.py
import pytest
from src.server import create_server

@pytest.fixture
def server():
    return create_server()

@pytest.mark.asyncio
async def test_greet(server):
    result = await server.call_tool("greet", {"name": "Alice"})
    assert result.content[0].text == "Hello, Alice! Welcome to AgentForge."

@pytest.mark.asyncio
async def test_greet_empty_name(server):
    result = await server.call_tool("greet", {"name": ""})
    assert "Hello," in result.content[0].text

@pytest.mark.asyncio
async def test_greet_missing_name(server):
    with pytest.raises(ValueError):
        await server.call_tool("greet", {})
```

Run tests:

```bash
pytest
# or
uv run pytest
```

---

## Testing Tool Handlers in Isolation

The key to unit testing MCP tools is to extract the handler logic from the server registration so it can be tested independently.

### Pattern: Extract handler functions

```typescript
// src/tools/greet.ts
import { z } from "zod";

export const greetSchema = {
  name: z.string().describe("The name of the person to greet"),
};

export async function greetHandler({ name }: { name: string }) {
  return {
    content: [
      {
        type: "text" as const,
        text: `Hello, ${name}! Welcome to AgentForge.`,
      },
    ],
  };
}

// src/tools/read_file.ts
import { readFile } from "fs/promises";
import { resolve, normalize, sep } from "path";

export const readFileSchema = {
  path: z.string().describe("Path to the file"),
};

export async function readFileHandler(
  { path }: { path: string },
  allowedDirectories: string[]
) {
  const safePath = validatePath(path, allowedDirectories);
  const content = await readFile(safePath, "utf-8");
  return {
    content: [{ type: "text" as const, text: content }],
  };
}

function validatePath(requestedPath: string, allowedDirectories: string[]): string {
  const absolutePath = resolve(normalize(requestedPath));
  const isAllowed = allowedDirectories.some((dir) => {
    const resolvedDir = resolve(dir);
    return absolutePath === resolvedDir || absolutePath.startsWith(resolvedDir + sep);
  });
  if (!isAllowed) {
    throw new Error(`Access denied: ${requestedPath}`);
  }
  return absolutePath;
}
```

```typescript
// src/index.ts — registration
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { greetSchema, greetHandler } from "./tools/greet.js";
import { readFileSchema, readFileHandler } from "./tools/read_file.js";

const ALLOWED_DIRECTORIES = (process.env.ALLOWED_DIRECTORIES || "").split(",").filter(Boolean);

export function createServer(): McpServer {
  const server = new McpServer({ name: "my-server", version: "1.0.0" });

  server.tool("greet", "Greet a user", greetSchema, greetHandler);
  server.tool("read_file", "Read a file", readFileSchema, (args) =>
    readFileHandler(args, ALLOWED_DIRECTORIES)
  );

  return server;
}
```

### Testing the extracted handlers

```typescript
// tests/tools/greet.test.ts
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { greetHandler } from "../../src/tools/greet.js";

describe("greetHandler", () => {
  it("returns a greeting with the provided name", async () => {
    const result = await greetHandler({ name: "World" });
    assert.strictEqual(result.content[0].text, "Hello, World! Welcome to AgentForge.");
  });

  it("returns text content type", async () => {
    const result = await greetHandler({ name: "Test" });
    assert.strictEqual(result.content[0].type, "text");
  });

  it("handles special characters in name", async () => {
    const result = await greetHandler({ name: "O'Brien" });
    assert.match(result.content[0].text, /O'Brien/);
  });
});
```

```typescript
// tests/tools/read_file.test.ts
import { describe, it, beforeEach, afterEach } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { readFileHandler } from "../../src/tools/read_file.js";

describe("readFileHandler", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "mcp-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("reads a file within allowed directories", async () => {
    const filePath = join(tempDir, "test.txt");
    await writeFile(filePath, "Hello, World!");
    
    const result = await readFileHandler({ path: filePath }, [tempDir]);
    assert.strictEqual(result.content[0].text, "Hello, World!");
  });

  it("rejects paths outside allowed directories", async () => {
    const result = await readFileHandler(
      { path: "/etc/passwd" },
      [tempDir]
    );
    
    assert.ok(result.isError);
    assert.match(result.content[0].text, /Access denied/);
  });

  it("rejects path traversal attempts", async () => {
    const result = await readFileHandler(
      { path: join(tempDir, "..", "..", "etc", "passwd") },
      [tempDir]
    );
    
    assert.ok(result.isError);
    assert.match(result.content[0].text, /Access denied/);
  });
});
```

---

## Mocking MCP Client Connections

When testing server-level behavior (tool registration, capability negotiation), mock the MCP client to simulate real interactions.

### Mock client for testing

```typescript
// tests/helpers/mock-client.ts
import { strict as assert } from "node:assert";

export class MockMcpClient {
  private server: McpServer;
  private tools: Map<string, any> = new Map();

  constructor(server: McpServer) {
    this.server = server;
  }

  async initialize() {
    // Simulate the initialization handshake
    const tools = this.server.listTools();
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }
  }

  async listTools() {
    return Array.from(this.tools.keys());
  }

  async callTool(name: string, args: Record<string, unknown>) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool "${name}" not found`);
    }
    return await tool.handler(args);
  }

  async assertToolExists(name: string) {
    assert.ok(this.tools.has(name), `Tool "${name}" should be registered`);
  }

  async assertToolNotExists(name: string) {
    assert.ok(!this.tools.has(name), `Tool "${name}" should not be registered`);
  }
}
```

### Using the mock client

```typescript
// tests/server.test.ts
import { describe, it, beforeEach } from "node:test";
import { strict as assert } from "node:assert";
import { createServer } from "../src/index.js";
import { MockMcpClient } from "./helpers/mock-client.js";

describe("MCP Server", () => {
  let client: MockMcpClient;

  beforeEach(async () => {
    const server = createServer();
    client = new MockMcpClient(server);
    await client.initialize();
  });

  it("registers all expected tools", async () => {
    await client.assertToolExists("greet");
    await client.assertToolExists("read_file");
    await client.assertToolExists("list_files");
  });

  it("does not register internal tools", async () => {
    await client.assertToolNotExists("_internal_debug");
  });

  it("lists all tools", async () => {
    const tools = await client.listTools();
    assert.ok(tools.length > 0);
    assert.ok(tools.includes("greet"));
  });

  it("calls tools and returns results", async () => {
    const result = await client.callTool("greet", { name: "Test" });
    assert.strictEqual(result.content[0].type, "text");
    assert.match(result.content[0].text, /Hello, Test/);
  });

  it("throws for unknown tools", async () => {
    await assert.rejects(
      () => client.callTool("nonexistent", {}),
      /Tool "nonexistent" not found/
    );
  });
});
```

### Mocking external dependencies

```typescript
// tests/tools/weather.test.ts
import { describe, it, beforeEach, afterEach, mock } from "node:test";
import { strict as assert } from "node:assert";

// Mock the fetch function
const originalFetch = global.fetch;

describe("get_weather tool", () => {
  let fetchMock: any;

  beforeEach(() => {
    fetchMock = mock.fn((url: string) => {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          weather: [{ description: "sunny" }],
          main: { temp: 293.15 },
        }),
      });
    });
    global.fetch = fetchMock as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("fetches weather data from the API", async () => {
    const result = await weatherHandler({ city: "Tokyo" });
    
    assert.strictEqual(fetchMock.mock.calls.length, 1);
    assert.match(fetchMock.mock.calls[0].arguments[0], /Tokyo/);
    assert.match(result.content[0].text, /sunny/);
  });

  it("handles API errors gracefully", async () => {
    fetchMock.mock.mockImplementation(() =>
      Promise.resolve({ ok: false, status: 500 })
    );

    const result = await weatherHandler({ city: "Nowhere" });
    
    assert.ok(result.isError);
    assert.match(result.content[0].text, /500/);
  });

  it("handles network errors gracefully", async () => {
    fetchMock.mock.mockImplementation(() =>
      Promise.reject(new Error("Network error"))
    );

    const result = await weatherHandler({ city: "Tokyo" });
    
    assert.ok(result.isError);
    assert.match(result.content[0].text, /Network error/);
  });
});
```

---

## Integration Testing with a Real MCP Client

Integration tests verify that your server works correctly with a real MCP client over an actual transport.

### Testing over stdio

```typescript
// tests/integration/stdio.test.ts
import { describe, it, before, after } from "node:test";
import { strict as assert } from "node:assert";
import { spawn, ChildProcess } from "child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

describe("MCP Server integration (stdio)", () => {
  let client: Client;
  let transport: StdioClientTransport;
  let serverProcess: ChildProcess;

  before(async () => {
    // Spawn the server as a child process
    transport = new StdioClientTransport({
      command: "node",
      args: ["dist/index.js"],
      env: {
        ...process.env,
        ALLOWED_DIRECTORIES: "/tmp/test-data",
      },
    });

    client = new Client(
      { name: "test-client", version: "1.0.0" },
      { capabilities: {} }
    );

    await client.connect(transport);
  });

  after(async () => {
    await client.close();
  });

  it("completes the initialization handshake", () => {
    // If we got here, initialization succeeded
    assert.ok(client);
  });

  it("lists tools", async () => {
    const response = await client.listTools();
    assert.ok(response.tools.length > 0);
    assert.ok(response.tools.some((t) => t.name === "greet"));
  });

  it("calls a tool and receives a result", async () => {
    const response = await client.callTool({
      name: "greet",
      arguments: { name: "Integration" },
    });

    assert.ok(response.content);
    assert.strictEqual(response.content[0].type, "text");
    assert.match(response.content[0].text, /Hello, Integration/);
  });

  it("returns error for invalid tool name", async () => {
    await assert.rejects(
      () => client.callTool({ name: "nonexistent", arguments: {} }),
    );
  });
});
```

### Testing over HTTP/SSE

```typescript
// tests/integration/http.test.ts
import { describe, it, before, after } from "node:test";
import { strict as assert } from "node:assert";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

describe("MCP Server integration (SSE)", () => {
  let client: Client;

  before(async () => {
    // Assumes the server is running on localhost:3000
    const url = new URL("http://localhost:3000/sse");
    const transport = new SSEClientTransport(url);

    client = new Client(
      { name: "test-client", version: "1.0.0" },
      { capabilities: {} }
    );

    await client.connect(transport);
  });

  after(async () => {
    await client.close();
  });

  it("connects and lists tools", async () => {
    const response = await client.listTools();
    assert.ok(response.tools.length > 0);
  });

  it("calls a tool over HTTP", async () => {
    const response = await client.callTool({
      name: "greet",
      arguments: { name: "HTTP" },
    });

    assert.strictEqual(response.content[0].type, "text");
    assert.match(response.content[0].text, /Hello, HTTP/);
  });
});
```

### Running integration tests

```bash
# Start the server in the background
node dist/index.js &

# Run integration tests
node --test tests/integration/

# Stop the server
kill %1
```

Or use a test setup that starts and stops the server automatically:

```typescript
// tests/integration/setup.ts
import { spawn } from "child_process";

let serverProcess: ChildProcess;

export async function startServer() {
  serverProcess = spawn("node", ["dist/index.js"], {
    env: { ...process.env, PORT: "3999" },
    stdio: "pipe",
  });

  // Wait for the server to be ready
  await waitForServer("http://localhost:3999/health", 5000);
}

export async function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
  }
}

async function waitForServer(url: string, timeoutMs: number) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Server did not start within timeout");
}
```

---

## Testing Security Boundaries

Security tests verify that your server properly rejects malicious inputs. These tests should be part of every MCP server's test suite.

### Path traversal tests

```typescript
// tests/security/path-traversal.test.ts
import { describe, it, beforeEach, afterEach } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { readFileHandler } from "../../src/tools/read_file.js";

describe("Path traversal security", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "mcp-security-"));
    await writeFile(join(tempDir, "allowed.txt"), "allowed content");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const attackVectors = [
    { name: "relative path traversal", path: "../../../etc/passwd" },
    { name: "absolute path", path: "/etc/passwd" },
    { name: "double dot", path: join(tempDir, "..", "..", "etc", "passwd") },
    { name: "encoded dots", path: join(tempDir, "..%2F..%2Fetc%2Fpasswd") },
    { name: "null byte", path: join(tempDir, "allowed.txt\0/../../../etc/passwd") },
    { name: "UNC path (Windows)", path: "\\\\server\\share\\secret" },
  ];

  for (const vector of attackVectors) {
    it(`blocks ${vector.name}`, async () => {
      const result = await readFileHandler({ path: vector.path }, [tempDir]);
      assert.ok(result.isError, `Should block: ${vector.name}`);
      assert.match(result.content[0].text, /Access denied|Error/i);
    });
  }

  it("allows access to files within allowed directory", async () => {
    const result = await readFileHandler(
      { path: join(tempDir, "allowed.txt") },
      [tempDir]
    );
    assert.strictEqual(result.content[0].text, "allowed content");
  });
});
```

### SQL injection tests

```typescript
// tests/security/sql-injection.test.ts
import { describe, it, beforeEach, afterEach } from "node:test";
import { strict as assert } from "node:assert";
import { Pool } from "pg";
import { queryHandler } from "../../src/tools/query.js";

describe("SQL injection security", () => {
  let pool: Pool;

  beforeEach(async () => {
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    await pool.query("CREATE TABLE IF NOT EXISTS test_users (id SERIAL, name TEXT, email TEXT)");
    await pool.query("INSERT INTO test_users (name, email) VALUES ('Alice', 'alice@test.com')");
  });

  afterEach(async () => {
    await pool.query("DROP TABLE IF EXISTS test_users");
    await pool.end();
  });

  const injectionAttempts = [
    { name: "DROP TABLE", sql: "SELECT * FROM test_users; DROP TABLE test_users; --" },
    { name: "UNION attack", sql: "SELECT * FROM test_users UNION SELECT * FROM pg_user" },
    { name: "comment injection", sql: "SELECT * FROM test_users -- WHERE id = 1" },
    { name: "stacked queries", sql: "SELECT 1; INSERT INTO test_users VALUES ('hacker', 'hack@evil.com')" },
    { name: "time-based blind", sql: "SELECT * FROM test_users WHERE 1=1; WAITFOR DELAY '0:0:10'" },
  ];

  for (const attempt of injectionAttempts) {
    it(`blocks ${attempt.name}`, async () => {
      const result = await queryHandler({ sql: attempt.sql, params: [] });
      assert.ok(result.isError, `Should block: ${attempt.name}`);
    });
  }

  it("allows legitimate SELECT queries", async () => {
    const result = await queryHandler({ sql: "SELECT * FROM test_users", params: [] });
    assert.ok(!result.isError);
    const rows = JSON.parse(result.content[0].text);
    assert.ok(rows.length > 0);
  });

  it("uses parameterized queries correctly", async () => {
    const result = await queryHandler({
      sql: "SELECT * FROM test_users WHERE name = $1",
      params: ["Alice"],
    });
    assert.ok(!result.isError);
    const rows = JSON.parse(result.content[0].text);
    assert.strictEqual(rows[0].name, "Alice");
  });
});
```

### Authorization tests

```typescript
// tests/security/authorization.test.ts
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

describe("Authorization", () => {
  it("rejects requests without auth token", async () => {
    const response = await fetch("http://localhost:3000/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", id: 1 }),
    });
    assert.strictEqual(response.status, 401);
  });

  it("rejects invalid auth tokens", async () => {
    const response = await fetch("http://localhost:3000/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer invalid-token",
      },
      body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", id: 1 }),
    });
    assert.strictEqual(response.status, 401);
  });

  it("accepts valid auth tokens", async () => {
    const response = await fetch("http://localhost:3000/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer valid-test-token",
      },
      body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", id: 1 }),
    });
    assert.strictEqual(response.status, 200);
  });
});
```

---

## Test Organization and Best Practices

### Directory structure

```
tests/
├── unit/                    # Fast, isolated tests
│   ├── tools/
│   │   ├── greet.test.ts
│   │   ├── read_file.test.ts
│   │   └── query.test.ts
│   └── server.test.ts
├── integration/             # Slower tests with real transports
│   ├── stdio.test.ts
│   └── http.test.ts
├── security/                # Security boundary tests
│   ├── path-traversal.test.ts
│   ├── sql-injection.test.ts
│   └── authorization.test.ts
└── helpers/
    ├── mock-client.ts
    └── setup.ts
```

### Running tests selectively

```bash
# Run all tests
pnpm test

# Run only unit tests
node --test tests/unit/

# Run only security tests
node --test tests/security/

# Run a specific test file
node --test tests/unit/tools/greet.test.ts

# Run with verbose output
node --test --test-reporter=spec tests/
```

### CI/CD integration

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test
      - name: Security tests
        run: node --test tests/security/
```

### Best practices

1. **Test handlers, not the transport.** Extract handler logic and test it directly. Transport tests go in integration tests.
2. **Use temp directories for filesystem tests.** Never test against real system files. Always clean up in `afterEach`.
3. **Mock external services.** Don't make real API calls in unit tests. Use mock functions for `fetch`, database connections, etc.
4. **Test both success and failure paths.** Every tool should have tests for valid inputs, invalid inputs, and error conditions.
5. **Security tests are not optional.** Path traversal and SQL injection tests should run on every CI build.
6. **Keep unit tests fast.** Unit tests should complete in seconds. Slow operations (database, network) belong in integration tests.
7. **Test edge cases.** Empty strings, null values, very large inputs, Unicode characters, special characters.
8. **Snapshot test tool schemas.** Ensure tool definitions don't change unexpectedly:

```typescript
it("tool schema is stable", () => {
  const tools = server.listTools();
  const greetTool = tools.find((t) => t.name === "greet");
  assert.deepStrictEqual(greetTool.inputSchema, {
    type: "object",
    properties: {
      name: { type: "string", description: "The name of the person to greet" },
    },
    required: ["name"],
  });
});
```
