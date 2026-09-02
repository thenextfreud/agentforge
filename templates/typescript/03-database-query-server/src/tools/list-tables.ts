import { z } from "zod";
import { wrapHandler } from "../lib/errors.js";
import { executeQuery, loadDbConfigFromEnv, loadAllowedTables } from "../lib/db.js";
import { isTableAllowed, validateTableName } from "../lib/sql-safety.js";

let _allowedTables: string[] | "*" | null = null;

function getAllowedTables() {
  if (_allowedTables === null) _allowedTables = loadAllowedTables();
  return _allowedTables;
}

export const listTablesTool = {
  name: "list_tables",
  description: "List all tables in the PostgreSQL database that are accessible via this MCP server. Respects the ALLOWED_TABLES configuration.",
  schema: {},

  handler: wrapHandler(async () => {
    const db = loadDbConfigFromEnv();
    const allowedTables = getAllowedTables();

    // Query information_schema for all tables in the public schema
    const { rows } = await executeQuery(db, `
      SELECT
        table_name,
        (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name) AS column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    // Filter by allow-list if configured
    const filtered = allowedTables === "*"
      ? rows
      : rows.filter((row) => isTableAllowed(row.table_name as string, { allowedTables, maxRows: 0 }));

    const output = {
      table_count: filtered.length,
      tables: filtered,
      allow_list_active: allowedTables !== "*",
    };

    return JSON.stringify(output, null, 2);
  }),
};
