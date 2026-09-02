/**
 * MCP Server — Web Search & Fetch (stdio transport)
 *
 * Web search and URL fetching MCP server. Demonstrates:
 * - Pluggable search providers (DuckDuckGo, Brave, Tavily, SerpAPI)
 * - HTML text extraction (strip tags, scripts, styles)
 * - JSON API fetching with custom headers
 * - Configurable timeouts and content length limits
 * - Structured stderr logging
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { webSearchTool } from "./tools/web-search.js";
import { fetchUrlTool } from "./tools/fetch-url.js";
import { extractTextTool } from "./tools/extract-text.js";
import { fetchJsonTool } from "./tools/fetch-json.js";
import { logger } from "./lib/logger.js";

const server = new McpServer({
  name: "web-search-fetch",
  version: "1.0.0",
});

// Register tools
server.tool(
  webSearchTool.name,
  webSearchTool.description,
  webSearchTool.schema,
  webSearchTool.handler
);

server.tool(
  fetchUrlTool.name,
  fetchUrlTool.description,
  fetchUrlTool.schema,
  fetchUrlTool.handler
);

server.tool(
  extractTextTool.name,
  extractTextTool.description,
  extractTextTool.schema,
  extractTextTool.handler
);

server.tool(
  fetchJsonTool.name,
  fetchJsonTool.description,
  fetchJsonTool.schema,
  fetchJsonTool.handler
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("MCP server started", { name: "web-search-fetch", version: "1.0.0" });
}

main().catch((error) => {
  logger.error("Fatal error", { error: error.message, stack: error.stack });
  process.exit(1);
});
