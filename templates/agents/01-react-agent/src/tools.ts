/**
 * MCP client setup and tool management.
 *
 * Connects to an MCP server via stdio transport, discovers available
 * tools, and provides a clean interface for the agent to call them.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { logger } from "./lib/logger.js";

export interface McpToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpToolResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

export interface McpClient {
  tools: McpToolInfo[];
  callTool(name: string, args: Record<string, unknown>): Promise<string>;
  close(): Promise<void>;
}

/**
 * Parse a comma-separated env var into an array of command arguments.
 */
function parseArgs(env: string | undefined): string[] {
  if (!env) return [];
  return env
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Connect to an MCP server and discover its tools.
 *
 * Reads connection config from environment variables:
 * - MCP_SERVER_COMMAND: the command to run (e.g. "npx", "node")
 * - MCP_SERVER_ARGS: comma-separated args (e.g. "tsx,path/to/server.ts")
 */
export async function connectMcpServer(): Promise<McpClient> {
  const command = process.env.MCP_SERVER_COMMAND ?? "npx";
  const args = parseArgs(process.env.MCP_SERVER_ARGS);

  logger.info("Connecting to MCP server", { command, args });

  const transport = new StdioClientTransport({ command, args });

  const client = new Client(
    { name: "react-agent", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);

  // Discover available tools
  const { tools } = await client.listTools();

  const toolInfos: McpToolInfo[] = (tools ?? []).map((t) => ({
    name: t.name,
    description: t.description ?? "",
    inputSchema: t.inputSchema as Record<string, unknown>,
  }));

  logger.info("MCP server connected", {
    toolCount: toolInfos.length,
    tools: toolInfos.map((t) => t.name),
  });

  return {
    tools: toolInfos,

    async callTool(name: string, args: Record<string, unknown>): Promise<string> {
      logger.debug("Calling MCP tool", { name, args });
      const result = (await client.callTool({
        name,
        arguments: args,
      })) as McpToolResult;

      // Extract text from the content array
      const textParts = (result.content ?? [])
        .filter((c) => c.type === "text" && c.text)
        .map((c) => c.text as string);
      const output = textParts.join("\n");

      if (result.isError) {
        logger.warn("MCP tool returned error", { name, output });
      }

      return output;
    },

    async close(): Promise<void> {
      logger.info("Closing MCP connection");
      await client.close();
    },
  };
}

/**
 * Format the tool list into a human-readable description for the ReAct prompt.
 */
export function formatToolsForPrompt(tools: McpToolInfo[]): string {
  if (tools.length === 0) {
    return "No tools available.";
  }

  return tools
    .map((t) => {
      const schema = t.inputSchema as { properties?: Record<string, { type?: string; description?: string }>; required?: string[] };
      const props = schema?.properties ?? {};
      const required = schema?.required ?? [];
      const paramList = Object.entries(props)
        .map(([key, val]) => {
          const req = required.includes(key) ? "required" : "optional";
          const type = val.type ?? "any";
          const desc = val.description ? ` — ${val.description}` : "";
          return `    ${key} (${type}, ${req})${desc}`;
        })
        .join("\n");
      return `- ${t.name}: ${t.description}\n  Parameters:\n${paramList}`;
    })
    .join("\n\n");
}
