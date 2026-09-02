/**
 * PostgreSQL connection pool management.
 *
 * Provides a lazily-initialized connection pool with configurable
 * timeout, query execution, and graceful shutdown.
 */

import pg from "pg";
import { logger } from "./logger.js";

export interface DbConfig {
  connectionString: string;
  queryTimeoutMs: number;
}

let pool: pg.Pool | null = null;

/**
 * Get or create the connection pool.
 * The pool is created lazily on first use.
 */
export function getPool(config: DbConfig): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: config.connectionString,
      // Set statement_timeout at the pool level as a safety net
      statement_timeout: config.queryTimeoutMs,
      // Limit pool size
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: config.queryTimeoutMs,
    });

    pool.on("error", (err: Error) => {
      logger.error("Unexpected pool error", { error: err.message, stack: err.stack });
    });

    logger.info("Database pool created", {
      timeoutMs: config.queryTimeoutMs,
    });
  }
  return pool;
}

/**
 * Execute a read-only SQL query with parameters.
 * Returns the rows and row count.
 */
export async function executeQuery(
  config: DbConfig,
  sql: string,
  params: unknown[] = []
): Promise<{ rows: Record<string, unknown>[]; rowCount: number }> {
  const client = await getPool(config).connect();
  try {
    // Set statement_timeout for this query as an extra safety net
    await client.query(`SET statement_timeout = ${config.queryTimeoutMs}`);
    const result = await client.query(sql, params);
    return {
      rows: result.rows as Record<string, unknown>[],
      rowCount: result.rowCount ?? 0,
    };
  } finally {
    client.release();
  }
}

/**
 * Execute a query and return only the first row.
 */
export async function executeQueryOne(
  config: DbConfig,
  sql: string,
  params: unknown[] = []
): Promise<Record<string, unknown> | null> {
  const { rows } = await executeQuery(config, sql, params);
  return rows[0] ?? null;
}

/**
 * Gracefully close the connection pool.
 * Call this on server shutdown.
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info("Database pool closed");
  }
}

/**
 * Load database configuration from environment variables.
 */
export function loadDbConfigFromEnv(): DbConfig {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  return {
    connectionString,
    queryTimeoutMs: parseInt(process.env.QUERY_TIMEOUT_MS || "30000", 10),
  };
}

/**
 * Load the allowed tables list from environment.
 * Returns "*" if all tables are allowed, or an array of table names.
 */
export function loadAllowedTables(): string[] | "*" {
  const raw = process.env.ALLOWED_TABLES;
  if (!raw || raw.trim() === "*") {
    return "*";
  }
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Load the max rows setting from environment.
 */
export function loadMaxRows(): number {
  return parseInt(process.env.MAX_ROWS || "1000", 10);
}
