import { z } from "zod";
import { wrapHandler } from "../lib/errors.js";
import { executeQuery, loadDbConfigFromEnv, loadAllowedTables, loadMaxRows } from "../lib/db.js";
import { validateQuery, enforceRowLimit } from "../lib/sql-safety.js";

let _maxRows: number | null = null;
let _allowedTables: string[] | "*" | null = null;

function getConfig() {
  if (_maxRows === null) _maxRows = loadMaxRows();
  if (_allowedTables === null) _allowedTables = loadAllowedTables();
  return {
    db: loadDbConfigFromEnv(),
    maxRows: _maxRows,
    allowedTables: _allowedTables,
  };
}

export const querySqlTool = {
  name: "query_sql",
  description: "Execute a read-only SQL query (SELECT, SHOW, DESCRIBE, EXPLAIN) against the PostgreSQL database. Only read-only queries are allowed. Results are capped at MAX_ROWS (default 1000). Use $1, $2, etc. for parameterized values.",
  schema: {
    sql: z.string().min(1).describe("The SQL query to execute. Must be a read-only query (SELECT, SHOW, DESCRIBE, EXPLAIN). Use $1, $2 for parameters."),
    params: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().describe("Parameter values for the query (use $1, $2, ... in the SQL)"),
  },

  handler: wrapHandler(async (args: {
    sql: string;
    params?: (string | number | boolean | null)[];
  }) => {
    const { db, maxRows, allowedTables } = getConfig();

    // Validate the query for safety
    validateQuery(args.sql, { allowedTables, maxRows });

    // Enforce row limit
    const safeSql = enforceRowLimit(args.sql, maxRows);

    // Execute with parameters (prevents SQL injection)
    const { rows, rowCount } = await executeQuery(db, safeSql, args.params ?? []);

    const output = {
      row_count: rowCount,
      returned_rows: rows.length,
      max_rows: maxRows,
      truncated: rows.length >= maxRows,
      rows,
    };

    return JSON.stringify(output, null, 2);
  }),
};
