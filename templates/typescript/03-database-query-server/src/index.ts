/**
 * MCP Server — Database Query Server (stdio transport)
 *
 * Safe read-only SQL query MCP server for PostgreSQL. Demonstrates:
 * - Read-only enforcement (only SELECT/SHOW/DESCRIBE/EXPLAIN)
 * - Table allow-list (configurable via ALLOWED_TABLES env)
 * - Row cap (max 1000 rows, configurable via MAX_ROWS)
 * - Query timeout (configurable via QUERY_TIMEOUT_MS)
 * - SQL injection prevention via parameterized queries
 * - Connection pool management with graceful shutdown
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { querySqlTool } from "./tools/query-sql.js";
import { listTablesTool } from "./tools/list-tables.js";
import { describeTableTool } from "./tools/describe-table.js";
import { getRowCountTool } from "./tools/get-row-count.js";
import { closePool } from "./lib/db.js";
import { logger } from "./lib/logger.js";

const server = new McpServer({
  name: "database-query-server",
  version: "1.0.0",
});

// Register tools
server.tool(
  querySqlTool.name,
  querySqlTool.description,
  querySqlTool.schema,
  querySqlTool.handler
);

server.tool(
  listTablesTool.name,
  listTablesTool.description,
  listTablesTool.schema,
  listTablesTool.handler
);

server.tool(
  describeTableTool.name,
  describeTableTool.description,
  describeTableTool.schema,
  describeTableTool.handler
);

server.tool(
  getRowCountTool.name,
  getRowCountTool.description,
  getRowCountTool.schema,
  getRowCountTool.handler
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("MCP server started", { name: "database-query-server", version: "1.0.0" });

  // Graceful shutdown — close the database pool
  process.on("SIGINT", async () => {
    logger.info("Shutting down");
    await closePool();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    logger.info("Shutting down");
    await closePool();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error("Fatal error", { error: error.message, stack: error.stack });
  process.exit(1);
});
