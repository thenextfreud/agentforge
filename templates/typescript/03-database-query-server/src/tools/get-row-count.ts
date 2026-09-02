import { z } from "zod";
import { wrapHandler } from "../lib/errors.js";
import { executeQuery, loadDbConfigFromEnv, loadAllowedTables, loadMaxRows } from "../lib/db.js";
import { isTableAllowed, validateTableName } from "../lib/sql-safety.js";

let _allowedTables: string[] | "*" | null = null;
let _maxRows: number | null = null;

function getConfig() {
  if (_allowedTables === null) _allowedTables = loadAllowedTables();
  if (_maxRows === null) _maxRows = loadMaxRows();
  return { allowedTables: _allowedTables, maxRows: _maxRows };
}

export const getRowCountTool = {
  name: "get_row_count",
  description: "Get the total number of rows in a table. Uses a COUNT(*) query. The table must be in the ALLOWED_TABLES list.",
  schema: {
    table_name: z.string().min(1).describe("The name of the table to count rows in"),
  },

  handler: wrapHandler(async (args: { table_name: string }) => {
    const db = loadDbConfigFromEnv();
    const { allowedTables } = getConfig();

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

    // Execute COUNT(*) — table name is validated to be a safe identifier
    const { rows } = await executeQuery(db, `SELECT COUNT(*)::int AS row_count FROM ${args.table_name}`);

    const output = {
      table_name: args.table_name,
      row_count: rows[0]?.row_count ?? 0,
    };

    return JSON.stringify(output, null, 2);
  }),
};
