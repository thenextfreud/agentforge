# Security Best Practices

Security is critical for MCP servers — they often have access to the filesystem, databases, APIs, and other sensitive resources. This guide covers the essential security practices for AgentForge MCP servers.

---

## Path Traversal Prevention

Filesystem MCP servers are vulnerable to path traversal attacks, where a malicious or confused AI model attempts to access files outside the allowed directories.

### The threat

An AI model (or an attacker via prompt injection) might try:

```
read_file({ path: "../../etc/passwd" })
read_file({ path: "/etc/shadow" })
read_file({ path: "C:\\Windows\\System32\\config\\SAM" })
read_file({ path: "/var/secrets/api-keys.txt" })
```

### Prevention: Canonical path resolution

Always resolve paths to their canonical (absolute, normalized) form and verify they're within allowed directories:

```typescript
import { resolve, normalize, sep } from "path";
import { statSync } from "fs";

function validatePath(requestedPath: string, allowedDirectories: string[]): string {
  // 1. Normalize the requested path (resolves .. and . components)
  const normalizedPath = normalize(requestedPath);

  // 2. Resolve to an absolute path
  const absolutePath = resolve(normalizedPath);

  // 3. Check if the path is within any allowed directory
  const isAllowed = allowedDirectories.some((dir) => {
    const resolvedDir = resolve(dir);
    // Ensure the path is within the directory (not just a prefix match)
    // e.g., /allowed is a prefix of /allowed-secret, but /allowed-secret is NOT inside /allowed
    const dirWithSep = resolvedDir.endsWith(sep) ? resolvedDir : resolvedDir + sep;
    return absolutePath === resolvedDir || absolutePath.startsWith(dirWithSep);
  });

  if (!isAllowed) {
    throw new Error(
      `Access denied: path "${requestedPath}" is outside allowed directories`
    );
  }

  // 4. Verify the path exists (optional, but prevents probing)
  try {
    statSync(absolutePath);
  } catch {
    throw new Error(`Path not found: ${absolutePath}`);
  }

  return absolutePath;
}
```

### Prevention: Symlink protection

Symlinks can escape the allowed directory. Resolve symlinks before checking:

```typescript
import { realpathSync } from "fs";

function validatePathWithSymlinks(requestedPath: string, allowedDirectories: string[]): string {
  const absolutePath = validatePath(requestedPath, allowedDirectories);
  
  // Resolve symlinks to their real paths
  const realPath = realpathSync(absolutePath);
  
  // Re-validate the real path
  const isAllowed = allowedDirectories.some((dir) => {
    const realDir = realpathSync(resolve(dir));
    return realPath === realDir || realPath.startsWith(realDir + sep);
  });

  if (!isAllowed) {
    throw new Error(`Access denied: symlink target is outside allowed directories`);
  }

  return realPath;
}
```

### Complete filesystem tool with protection

```typescript
import { z } from "zod";
import { readFile } from "fs/promises";

const ALLOWED_DIRECTORIES = (process.env.ALLOWED_DIRECTORIES || "")
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean);

server.tool(
  "read_file",
  "Read the contents of a file within allowed directories",
  { path: z.string().describe("Path to the file (must be within allowed directories)") },
  async ({ path }) => {
    try {
      const safePath = validatePathWithSymlinks(path, ALLOWED_DIRECTORIES);
      const content = await readFile(safePath, "utf-8");
      return { content: [{ type: "text", text: content }] };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : "Access denied"}` }],
      };
    }
  }
);
```

### Best practices

1. **Never trust user or model input for paths.** Always validate.
2. **Use an allowlist, not a blocklist.** Specify allowed directories, not blocked ones.
3. **Resolve symlinks.** Symlinks are a common bypass technique.
4. **Log access attempts.** Record all file access for auditing.
5. **Run as a non-root user.** Even if path validation fails, OS-level permissions provide defense in depth.

---

## SQL Injection Prevention

Database MCP servers must prevent SQL injection — a technique where malicious input manipulates SQL queries to access or modify unauthorized data.

### The threat

An AI model might try:

```
query_database({ sql: "SELECT * FROM users; DROP TABLE users; --" })
query_database({ sql: "SELECT * FROM users WHERE 1=1 OR 'a'='a'" })
query_database({ sql: "INSERT INTO admin_users VALUES ('attacker', 'admin')" })
```

### Prevention: Parameterized queries

Never concatenate user input into SQL strings. Use parameterized queries:

```typescript
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ✅ GOOD: Parameterized query
async function safeQuery(sql: string, params: unknown[]) {
  return await pool.query(sql, params);
}

// ❌ BAD: String concatenation
async function unsafeQuery(userInput: string) {
  return await pool.query(`SELECT * FROM users WHERE name = '${userInput}'`);
}
```

### Prevention: Query allowlisting

For MCP servers that accept raw SQL from the AI model, implement query allowlisting or restrictions:

```typescript
const FORBIDDEN_KEYWORDS = [
  "DROP", "TRUNCATE", "ALTER", "CREATE", "GRANT", "REVOKE",
  "EXEC", "EXECUTE", "MERGE", "CALL",
];

const ALLOWED_STATEMENTS = ["SELECT", "INSERT", "UPDATE", "DELETE"];

function validateQuery(sql: string): { allowed: boolean; reason?: string } {
  const upperSql = sql.toUpperCase().trim();

  // Check for forbidden keywords
  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (upperSql.includes(keyword)) {
      return { allowed: false, reason: `Forbidden keyword: ${keyword}` };
    }
  }

  // Check that the query starts with an allowed statement
  const startsWithAllowed = ALLOWED_STATEMENTS.some((stmt) =>
    upperSql.startsWith(stmt)
  );

  if (!startsWithAllowed) {
    return { allowed: false, reason: "Only SELECT, INSERT, UPDATE, and DELETE statements are allowed" };
  }

  // Check for multiple statements (semicolon injection)
  if (sql.includes(";") && !sql.trim().endsWith(";")) {
    return { allowed: false, reason: "Multiple statements are not allowed" };
  }

  return { allowed: true };
}
```

### Prevention: Table-level restrictions

Restrict which tables the server can access:

```typescript
const ALLOWED_TABLES = (process.env.ALLOWED_TABLES || "users,orders,products")
  .split(",")
  .map((t) => t.trim().toLowerCase());

function validateTables(sql: string): { allowed: boolean; reason?: string } {
  // Extract table names from the query (simplified — use a proper SQL parser in production)
  const tablePattern = /(?:FROM|JOIN|INTO|UPDATE)\s+(\w+)/gi;
  const tables: string[] = [];
  let match;
  while ((match = tablePattern.exec(sql)) !== null) {
    tables.push(match[1].toLowerCase());
  }

  for (const table of tables) {
    if (!ALLOWED_TABLES.includes(table)) {
      return { allowed: false, reason: `Access to table "${table}" is not allowed` };
    }
  }

  return { allowed: true };
}
```

### Prevention: Read-only database user

The most effective defense is to connect with a database user that has limited permissions:

```sql
-- Create a read-only user
CREATE USER mcp_readonly WITH PASSWORD 'secure-password';
GRANT CONNECT ON DATABASE mydb TO mcp_readonly;
GRANT USAGE ON SCHEMA public TO mcp_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO mcp_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO mcp_readonly;
```

```typescript
// Use the read-only user in your MCP server
const pool = new Pool({
  connectionString: "postgresql://mcp_readonly:password@localhost:5432/mydb",
});
```

### Complete database tool with protection

```typescript
server.tool(
  "query_database",
  "Execute a read-only SQL query against the database",
  {
    sql: z.string().min(1).describe("SQL query (SELECT only)"),
    params: z.array(z.any()).optional().describe("Query parameters"),
  },
  async ({ sql, params = [] }) => {
    // Validate the query
    const queryCheck = validateQuery(sql);
    if (!queryCheck.allowed) {
      return { isError: true, content: [{ type: "text", text: `Query rejected: ${queryCheck.reason}` }] };
    }

    const tableCheck = validateTables(sql);
    if (!tableCheck.allowed) {
      return { isError: true, content: [{ type: "text", text: `Query rejected: ${tableCheck.reason}` }] };
    }

    try {
      const result = await pool.query(sql, params);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result.rows, null, 2),
        }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: `Query error: ${error instanceof Error ? error.message : "Unknown error"}` }],
      };
    }
  }
);
```

---

## API Key Management

### Never hardcode API keys

```typescript
// ❌ BAD: Hardcoded key
const openai = new OpenAI({ apiKey: "sk-abc123..." });

// ✅ GOOD: Environment variable
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
```

### Use environment variables

```bash
# .env (never commit this file!)
OPENAI_API_KEY=sk-your-key-here
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

```typescript
// Validate required env vars at startup
const requiredEnvVars = ["OPENAI_API_KEY", "DATABASE_URL"] as const;

for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    console.error(`Missing required environment variable: ${varName}`);
    process.exit(1);
  }
}
```

### Use a secrets manager for production

For production deployments, use a secrets manager instead of `.env` files:

```typescript
// AWS Secrets Manager
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

async function getSecret(secretId: string): Promise<string> {
  const client = new SecretsManagerClient({ region: "us-east-1" });
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretId })
  );
  return response.SecretString!;
}

const apiKey = await getSecret("prod/mcp-server/openai-key");
```

### Git hygiene

```gitignore
# .gitignore
.env
.env.local
.env.production
*.pem
*.key
secrets/
```

```bash
# Verify no secrets are tracked
git log --all --diff-filter=D -- '*.env'
git secrets --scan
```

---

## OAuth 2.0 for Remote Servers

For MCP servers exposed to the internet, OAuth 2.0 provides authenticated, authorized access.

### Token validation middleware

```typescript
import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = createRemoteJWKSet(
  new URL("https://your-auth-domain/.well-known/jwks.json")
);

async function validateToken(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.slice(7);

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: "https://your-auth-domain",
      audience: "mcp-server",
    });
    return true;
  } catch {
    return false;
  }
}

// In your HTTP handler
export async function handleRequest(request: Request): Promise<Response> {
  if (!(await validateToken(request))) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Process the MCP request
  // ...
}
```

### MCP client configuration with OAuth

```json
{
  "mcpServers": {
    "secure-server": {
      "url": "https://mcp.mydomain.com/mcp",
      "transport": "streamable-http",
      "headers": {
        "Authorization": "Bearer your-oauth-token"
      }
    }
  }
}
```

> **Security note:** For production OAuth, use short-lived tokens and implement token refresh. Avoid hardcoding long-lived tokens in client config files. Consider using a local proxy that handles the OAuth flow and injects the token.

---

## Rate Limiting

Rate limiting prevents abuse and ensures fair resource usage.

### Token bucket implementation

```typescript
class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number,
    private refillRate: number, // tokens per second
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  consume(count: number = 1): boolean {
    this.refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

// Per-client rate limiting
const rateLimiters = new Map<string, TokenBucket>();

function getRateLimiter(clientId: string): TokenBucket {
  if (!rateLimiters.has(clientId)) {
    rateLimiters.set(clientId, new TokenBucket(60, 10)); // 60 tokens, 10/sec refill
  }
  return rateLimiters.get(clientId)!;
}
```

### Applying rate limits to tools

```typescript
server.tool(
  "expensive_operation",
  "Perform a computationally expensive operation",
  { input: z.string() },
  async ({ input }, extra) => {
    const clientId = extra.clientId || "anonymous";
    const limiter = getRateLimiter(clientId);

    if (!limiter.consume(1)) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: "Rate limit exceeded. Please wait and try again.",
        }],
      };
    }

    // Execute the operation
    const result = await performOperation(input);
    return { content: [{ type: "text", text: result }] };
  }
);
```

### HTTP-level rate limiting (for remote servers)

```typescript
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: { error: "Too many requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/mcp", limiter);
```

---

## Input Validation with Zod/Pydantic

### TypeScript (Zod)

```typescript
import { z } from "zod";

// Define schemas
const emailSchema = z.string().email();
const urlSchema = z.string().url();
const positiveIntSchema = z.number().int().positive();
const csvSchema = z.string().transform((s) => s.split(",").map((v) => v.trim()));

// Complex schema
const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().int().min(0).max(150).optional(),
  roles: z.array(z.enum(["admin", "user", "guest"])).default(["user"]),
});

server.tool(
  "create_user",
  "Create a new user account",
  createUserSchema.shape,
  async (input) => {
    // Input is fully validated and typed
    const user = await createUser(input);
    return { content: [{ type: "text", text: `Created user: ${user.email}` }] };
  }
);
```

### Python (Pydantic)

```python
from pydantic import BaseModel, EmailStr, Field
from mcp import Server

server = Server("my-server")

class CreateUserInput(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=100)
    age: int | None = Field(default=None, ge=0, le=150)
    roles: list[str] = Field(default=["user"])

@server.tool()
async def create_user(input: CreateUserInput) -> str:
    user = await create_user(input)
    return f"Created user: {user.email}"
```

### Validation best practices

1. **Validate everything.** Every tool input, every API parameter, every user-provided value.
2. **Use strict schemas.** Prefer `z.string().email()` over `z.string()`. Constrain ranges with `.min()` and `.max()`.
3. **Set defaults.** Use `.default()` for optional fields to reduce the chance of undefined values.
4. **Transform inputs.** Use `.transform()` to normalize data (e.g., trimming whitespace, parsing CSV).
5. **Reject early.** Validate before executing any business logic.

---

## Sandboxing Principles

### Principle 1: Least privilege

Give the server only the permissions it needs:

```typescript
// ❌ BAD: Full filesystem access
const ALLOWED_DIRECTORIES = ["/"];

// ✅ GOOD: Specific directories only
const ALLOWED_DIRECTORIES = ["/data/my-project"];
```

```sql
-- ❌ BAD: Superuser connection
GRANT ALL PRIVILEGES ON DATABASE mydb TO mcp_user;

-- ✅ GOOD: Minimal permissions
GRANT SELECT ON specific_table TO mcp_user;
```

### Principle 2: Defense in depth

Layer multiple security controls so that if one fails, others still protect:

1. **Input validation** (Zod/Pydantic schemas)
2. **Path validation** (canonical path resolution)
3. **OS-level permissions** (non-root user, file permissions)
4. **Network restrictions** (firewall, no outbound access unless needed)
5. **Rate limiting** (prevent abuse)
6. **Audit logging** (record all actions)

### Principle 3: Fail closed

When in doubt, deny access:

```typescript
function validatePath(path: string, allowedDirs: string[]): string {
  // If allowedDirs is empty, deny everything
  if (allowedDirs.length === 0) {
    throw new Error("No allowed directories configured");
  }

  // If validation fails for any reason, deny
  try {
    return validatePathWithSymlinks(path, allowedDirs);
  } catch {
    throw new Error("Access denied");
  }
}
```

### Principle 4: No secrets in error messages

```typescript
// ❌ BAD: Leaks the database URL
catch (error) {
  return { content: [{ type: "text", text: `Connection failed: ${error.message}` }] };
  // Error might contain: "connect ECONNREFUSED postgresql://user:password@..."
}

// ✅ GOOD: Generic error message
catch (error) {
  logger.error("Database connection failed", { error: error.message });
  return {
    isError: true,
    content: [{ type: "text", text: "Database connection failed. Please try again." }],
  };
}
```

### Principle 5: Audit logging

Log all sensitive operations for security auditing:

```typescript
import { appendFileSync } from "fs";

const AUDIT_LOG = process.env.AUDIT_LOG || "/var/log/mcp-audit.log";

function auditLog(action: string, details: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    ...details,
  };
  appendFileSync(AUDIT_LOG, JSON.stringify(entry) + "\n");
}

server.tool(
  "delete_file",
  "Delete a file",
  { path: z.string() },
  async ({ path }) => {
    auditLog("delete_file", { path, user: getCurrentUser() });
    await fs.unlink(path);
    return { content: [{ type: "text", text: `Deleted: ${path}` }] };
  }
);
```

---

## Security Checklist

- [ ] All file paths validated with canonical resolution and symlink checks
- [ ] All SQL queries use parameterized queries or an ORM
- [ ] Database user has minimal permissions (read-only if possible)
- [ ] No API keys or secrets hardcoded in source code
- [ ] `.env` file is in `.gitignore`
- [ ] Input validation on every tool (Zod/Pydantic)
- [ ] Rate limiting on expensive or external-facing tools
- [ ] OAuth 2.0 for remote servers
- [ ] Server runs as a non-root user
- [ ] Error messages don't leak sensitive information
- [ ] Audit logging for sensitive operations
- [ ] Dependencies are regularly updated (`pnpm audit` / `pip audit`)
- [ ] HTTPS enforced for all remote connections
- [ ] CORS configured correctly (not `*` in production)
