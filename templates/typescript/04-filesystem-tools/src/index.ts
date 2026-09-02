/**
 * MCP Server — Filesystem Tools (stdio transport)
 *
 * Sandboxed file operations MCP server. Demonstrates:
 * - Sandboxed to a single allowed root directory (SANDBOX_ROOT)
 * - Path traversal prevention (no ../ escapes)
 * - Symlink escape detection (symlinks pointing outside sandbox are rejected)
 * - File size limits (MAX_FILE_SIZE_MB)
 * - File extension allow-list (ALLOWED_EXTENSIONS)
 * - Read-only mode (READ_ONLY env)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileTool } from "./tools/read-file.js";
import { writeFileTool } from "./tools/write-file.js";
import { listDirectoryTool } from "./tools/list-directory.js";
import { searchFilesTool } from "./tools/search-files.js";
import { getFileInfoTool } from "./tools/get-file-info.js";
import { logger } from "./lib/logger.js";

const server = new McpServer({
  name: "filesystem-tools",
  version: "1.0.0",
});

// Register tools
server.tool(
  readFileTool.name,
  readFileTool.description,
  readFileTool.schema,
  readFileTool.handler
);

server.tool(
  writeFileTool.name,
  writeFileTool.description,
  writeFileTool.schema,
  writeFileTool.handler
);

server.tool(
  listDirectoryTool.name,
  listDirectoryTool.description,
  listDirectoryTool.schema,
  listDirectoryTool.handler
);

server.tool(
  searchFilesTool.name,
  searchFilesTool.description,
  searchFilesTool.schema,
  searchFilesTool.handler
);

server.tool(
  getFileInfoTool.name,
  getFileInfoTool.description,
  getFileInfoTool.schema,
  getFileInfoTool.handler
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("MCP server started", { name: "filesystem-tools", version: "1.0.0" });
}

main().catch((error) => {
  logger.error("Fatal error", { error: error.message, stack: error.stack });
  process.exit(1);
});
