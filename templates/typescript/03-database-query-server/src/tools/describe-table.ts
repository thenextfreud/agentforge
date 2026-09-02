import { z } from "zod";
import { wrapHandler } from "../lib/errors.js";
import { executeQuery, loadDbConfigFromEnv, loadAllowedTables } from "../lib/db.js";
import { isTableAllowed, validateTableName } from "../lib/sql-safety.js";

let _allowedTables: string[] | "*" | null = null;

function getAllowedTables() {
  if (_allowedTables === null) _allowedTables = loadAllowedTables();
  return _allowedTables;
}

export const describeTableTool = {
  name: "describe_table",
  description: "Describe the structure of a table — column names, data types, nullable constraints, and defaults. The table must be in the ALLOWED_TABLES list.",
  schema: {
    table_name: z.string().min(1).describe("The name of the table to describe"),
  },

  handler: wrapHandler(async (args: { table_name: string }) => {
    const db = loadDbConfigFromEnv();
    const allowedTables = getAllowedTables();

    // Validate table name format (prevent SQL injection)
    validateTableName(args.table_name);

    // Check allow-list
    if (!isTableAllowed(args.table_name, { allowedTables, maxRows: 0 })) {
      throw new Error(
        `Table "${args.table_name}" is not in the allowed list. Allowed tables: ${
          allowedTables === "*" ? "all" : allowedTables.join(", ")
        }`
      );
    }

    // Query column information from information_schema
    // Using parameterized query for the table name
    const { rows } = await executeQuery(db, `
      SELECT
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default,
        ordinal_position
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position
    `, [args.table_name]);

    if (rows.length === 0) {
      throw new Error(`Table "${args.table_name}" not found in the public schema`);
    }

    const output = {
      table_name: args.table_name,
      column_count: rows.length,
      columns: rows,
    };

    return JSON.stringify(output, null, 2);
  }),
};
