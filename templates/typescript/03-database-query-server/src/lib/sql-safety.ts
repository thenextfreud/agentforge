/**
 * SQL safety validation module.
 *
 * Enforces read-only access by only allowing SELECT, SHOW, DESCRIBE,
 * and EXPLAIN statements. Prevents SQL injection by validating table
 * names against an allow-list and rejecting dangerous patterns.
 */

/** SQL keywords that are allowed in read-only mode. */
const ALLOWED_PREFIXES = ["select", "show", "describe", "explain", "with"];

/** SQL keywords that must never appear in a read-only query. */
const FORBIDDEN_KEYWORDS = [
  "insert",
  "update",
  "delete",
  "drop",
  "create",
  "alter",
  "truncate",
  "grant",
  "revoke",
  "merge",
  "call",
  "copy",
  "vacuum",
  "reindex",
  "refresh",
];

export interface SqlSafetyConfig {
  allowedTables: string[] | "*";
  maxRows: number;
}

export class SqlSafetyError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SqlSafetyError";
    this.code = code;
  }
}

/**
 * Extract table names referenced in a SQL query.
 * Looks for FROM and JOIN clauses.
 */
function extractTableNames(sql: string): string[] {
  const tables: string[] = [];
  // Match FROM and JOIN clauses with table names
  const patterns = [
    /\bfrom\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /\bjoin\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /\bupdate\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /\binto\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(sql)) !== null) {
      tables.push(match[1].toLowerCase());
    }
  }

  return [...new Set(tables)];
}

/**
 * Validate that a SQL query is safe to execute.
 *
 * Checks:
 * 1. Query is not empty
 * 2. Query starts with an allowed prefix (SELECT, SHOW, DESCRIBE, EXPLAIN, WITH)
 * 3. Query does not contain forbidden keywords (INSERT, UPDATE, DELETE, etc.)
 * 4. All referenced tables are in the allow-list
 * 5. Query does not contain multiple statements (semicolon separation)
 *
 * @throws SqlSafetyError if the query fails any safety check
 */
export function validateQuery(sql: string, config: SqlSafetyConfig): void {
  const trimmed = sql.trim();

  if (!trimmed) {
    throw new SqlSafetyError("EMPTY_QUERY", "SQL query is empty");
  }

  // Reject multiple statements (prevents statement stacking injection)
  // Allow trailing semicolon, but no semicolons in the middle
  const withoutTrailingSemicolon = trimmed.replace(/;\s*$/, "");
  if (withoutTrailingSemicolon.includes(";")) {
    throw new SqlSafetyError(
      "MULTIPLE_STATEMENTS",
      "Multiple SQL statements are not allowed"
    );
  }

  // Check for forbidden keywords (word-boundary match, case-insensitive)
  const lowerSql = trimmed.toLowerCase();
  for (const keyword of FORBIDDEN_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(lowerSql)) {
      throw new SqlSafetyError(
        "FORBIDDEN_KEYWORD",
        `Forbidden SQL keyword detected: "${keyword}". Only read-only queries (SELECT, SHOW, DESCRIBE, EXPLAIN) are allowed.`
      );
    }
  }

  // Check that the query starts with an allowed prefix
  const startsWithAllowed = ALLOWED_PREFIXES.some((prefix) =>
    lowerSql.startsWith(prefix)
  );

  if (!startsWithAllowed) {
    throw new SqlSafetyError(
      "NOT_READ_ONLY",
      `Query must start with one of: ${ALLOWED_PREFIXES.join(", ").toUpperCase()}. Only read-only queries are allowed.`
    );
  }

  // Validate table references against allow-list
  if (config.allowedTables !== "*") {
    const referencedTables = extractTableNames(trimmed);
    const allowedLower = config.allowedTables.map((t) => t.toLowerCase());

    for (const table of referencedTables) {
      if (!allowedLower.includes(table)) {
        throw new SqlSafetyError(
          "TABLE_NOT_ALLOWED",
          `Table "${table}" is not in the allowed list. Allowed tables: ${config.allowedTables.join(", ")}`
        );
      }
    }
  }
}

/**
 * Check if a table name is allowed by the configuration.
 */
export function isTableAllowed(tableName: string, config: SqlSafetyConfig): boolean {
  if (config.allowedTables === "*") return true;
  return config.allowedTables
    .map((t) => t.toLowerCase())
    .includes(tableName.toLowerCase());
}

/**
 * Validate that a table name is a safe identifier (no SQL injection).
 * Only allows alphanumeric and underscores.
 */
export function validateTableName(tableName: string): void {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
    throw new SqlSafetyError(
      "INVALID_TABLE_NAME",
      `Invalid table name: "${tableName}". Only alphanumeric characters and underscores are allowed.`
    );
  }
}

/**
 * Wrap a SELECT query with a LIMIT clause if not already present.
 * Ensures the row cap is always enforced.
 */
export function enforceRowLimit(sql: string, maxRows: number): string {
  const lowerSql = sql.toLowerCase().trim();

  // If query already has LIMIT, don't add another
  if (/\blimit\b/i.test(lowerSql)) {
    return sql;
  }

  // Remove trailing semicolon, add LIMIT, re-add semicolon
  const withoutSemicolon = sql.trim().replace(/;\s*$/, "");
  return `${withoutSemicolon} LIMIT ${maxRows};`;
}
