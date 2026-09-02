/**
 * MCP client setup and OpenAI tool definition mapping.
 *
 * Connects to an MCP server via stdio transport, discovers available
 * tools, and maps them to OpenAI function-calling format. Supports
 * parallel execution of multiple tool calls.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type OpenAI from "openai";
import { logger } from "./lib/logger.js";

export interface McpToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpClient {
  tools: McpToolInfo[];
  /** OpenAI function definitions mapped from MCP tools */
  openaiTools: OpenAI.Chat.ChatCompletionTool[];
  /** Call a single MCP tool and return formatted result */
  callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult>;
  /** Call multiple MCP tools in parallel */
  callToolsParallel(
    calls: Array<{ id: string; name: string; args: Record<string, unknown> }>
  ): Promise<Map<string, ToolCallResult>>;
  close(): Promise<void>;
}

export interface ToolCallResult {
  success: boolean;
  output: string;
  error?: string;
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
 * Convert an MCP tool's JSON Schema input schema to an OpenAI-compatible
 * function parameters object.
 *
 * MCP tools use JSON Schema for their inputSchema. OpenAI's function
 * calling also uses JSON Schema, so this is mostly a pass-through with
 * some cleanup for edge cases.
 */
function mapSchemaToOpenAI(
  schema: Record<string, unknown>
): Record<string, unknown> {
  // OpenAI expects a JSON Schema object with "type": "object" at the top level
  // MCP tools typically already provide this, but we ensure it
  if (!schema || typeof schema !== "object") {
    return { type: "object", properties: {} };
  }

  // Deep clone to avoid mutating the original
  const mapped = JSON.parse(JSON.stringify(schema)) as Record<string, unknown>;

  // Ensure type is set
  if (!mapped.type) {
    mapped.type = "object";
  }

  // Ensure properties exists
  if (!mapped.properties) {
    mapped.properties = {};
  }

  return mapped;
}

/**
 * Map MCP tools to OpenAI function/tool definitions.
 */
function mapMcpToolsToOpenAI(tools: McpToolInfo[]): OpenAI.Chat.ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description || `MCP tool: ${tool.name}`,
      parameters: mapSchemaToOpenAI(tool.inputSchema),
    },
  }));
}

/**
 * Connect to an MCP server and discover its tools.
 */
export async function connectMcpServer(): Promise<McpClient> {
  const command = process.env.MCP_SERVER_COMMAND ?? "npx";
  const args = parseArgs(process.env.MCP_SERVER_ARGS);

  logger.info("Connecting to MCP server", { command, args });

  const transport = new StdioClientTransport({ command, args });

  const client = new Client(
    { name: "tool-use-agent", version: "1.0.0" },
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

  const openaiTools = mapMcpToolsToOpenAI(toolInfos);

  logger.info("MCP server connected", {
    toolCount: toolInfos.length,
    tools: toolInfos.map((t) => t.name),
  });

  /**
   * Format an MCP tool response into a ToolCallResult.
   */
  function formatToolResult(result: unknown): ToolCallResult {
    const res = result as {
      content?: Array<{ type: string; text?: string }>;
      isError?: boolean;
    };

    const textParts = (res.content ?? [])
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text as string);
    const output = textParts.join("\n");

    if (res.isError) {
      return { success: false, output, error: output };
    }

    return { success: true, output };
  }

  // Define callTool as a standalone function so it can be referenced
  // from callToolsParallel without `this` binding issues
  const callToolFn = async (
    name: string,
    args: Record<string, unknown>
  ): Promise<ToolCallResult> => {
    logger.debug("Calling MCP tool", { name, args });
    try {
      const result = await client.callTool({ name, arguments: args });
      return formatToolResult(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Tool execution failed", { name, error: err.message });
      return { success: false, output: err.message, error: err.message };
    }
  };

  return {
    tools: toolInfos,
    openaiTools,

    callTool: callToolFn,

    async callToolsParallel(
      calls: Array<{ id: string; name: string; args: Record<string, unknown> }>
    ): Promise<Map<string, ToolCallResult>> {
      logger.info("Executing tools in parallel", {
        count: calls.length,
        tools: calls.map((c) => c.name),
      });

      // Execute all tool calls concurrently
      const results = await Promise.all(
        calls.map(async (call) => {
          const result = await callToolFn(call.name, call.args);
          return { id: call.id, result };
        })
      );

      // Build a map of id -> result
      const resultMap = new Map<string, ToolCallResult>();
      for (const { id, result } of results) {
        resultMap.set(id, result);
      }

      return resultMap;
    },

    async close(): Promise<void> {
      logger.info("Closing MCP connection");
      await client.close();
    },
  };
}

/**
 * Convert a ToolCallResult to an OpenAI tool message format.
 *
 * This is used to feed tool results back into the chat completion
 * as "tool" role messages.
 */
export function formatToolResultForOpenAI(
  toolCallId: string,
  result: ToolCallResult
): OpenAI.Chat.ChatCompletionToolMessageParam {
  return {
    role: "tool",
    tool_call_id: toolCallId,
    content: result.success ? result.output : `Error: ${result.error}`,
  };
}
