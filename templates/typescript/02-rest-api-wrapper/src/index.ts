/**
 * MCP Server — REST API Wrapper (stdio transport)
 *
 * Wraps any external REST API as MCP tools. Demonstrates:
 * - Configurable base URL and API key authentication
 * - Request timeouts and retry with exponential backoff
 * - Pagination handling (cursor and offset)
 * - Rate-limit header tracking
 * - Generic REST tools (api_get, api_post, api_list)
 * - Concrete example: JSONPlaceholder API (get_post, get_user, list_posts, create_post)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { apiGetTool } from "./tools/api-get.js";
import { apiPostTool } from "./tools/api-post.js";
import { apiListTool } from "./tools/api-list.js";
import { getPostTool } from "./tools/get-post.js";
import { getUserTool } from "./tools/get-user.js";
import { listPostsTool } from "./tools/list-posts.js";
import { createPostTool } from "./tools/create-post.js";
import { logger } from "./lib/logger.js";

const server = new McpServer({
  name: "rest-api-wrapper",
  version: "1.0.0",
});

// --- Generic REST API tools ---

server.tool(
  apiGetTool.name,
  apiGetTool.description,
  apiGetTool.schema,
  apiGetTool.handler
);

server.tool(
  apiPostTool.name,
  apiPostTool.description,
  apiPostTool.schema,
  apiPostTool.handler
);

server.tool(
  apiListTool.name,
  apiListTool.description,
  apiListTool.schema,
  apiListTool.handler
);

// --- Concrete example: JSONPlaceholder API ---

server.tool(
  getPostTool.name,
  getPostTool.description,
  getPostTool.schema,
  getPostTool.handler
);

server.tool(
  getUserTool.name,
  getUserTool.description,
  getUserTool.schema,
  getUserTool.handler
);

server.tool(
  listPostsTool.name,
  listPostsTool.description,
  listPostsTool.schema,
  listPostsTool.handler
);

server.tool(
  createPostTool.name,
  createPostTool.description,
  createPostTool.schema,
  createPostTool.handler
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("MCP server started", { name: "rest-api-wrapper", version: "1.0.0" });
}

main().catch((error) => {
  logger.error("Fatal error", { error: error.message, stack: error.stack });
  process.exit(1);
});
