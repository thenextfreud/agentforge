/**
 * MCP Server — Hello World (stdio transport)
 *
 * The minimum viable MCP server. Demonstrates:
 * - stdio transport (for Claude Desktop, Cursor, Windsurf)
 * - Zod input validation
 * - Structured stderr logging (never stdout — stdout is reserved for JSON-RPC)
 * - Centralized error handling
 * - Tool registration pattern
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { echoTool } from "./tools/echo.js";
import { fetchUrlTool } from "./tools/fetch-url.js";
import { logger } from "./lib/logger.js";

const server = new McpServer({
  name: "hello-world",
  version: "1.0.0",
});

// Register tools
server.tool(
  echoTool.name,
  echoTool.description,
  echoTool.schema,
  echoTool.handler
);

server.tool(
  fetchUrlTool.name,
  fetchUrlTool.description,
  fetchUrlTool.schema,
  fetchUrlTool.handler
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("MCP server started", { name: "hello-world", version: "1.0.0" });
}

main().catch((error) => {
  logger.error("Fatal error", { error: error.message, stack: error.stack });
  process.exit(1);
});
