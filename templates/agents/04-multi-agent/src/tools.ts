/**
 * MCP client management for multi-agent orchestration.
 *
 * Manages multiple MCP server connections — one per worker agent.
 * Each worker gets its own MCP client with its own set of tools.
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

export interface ToolCallResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface McpConnection {
  tools: McpToolInfo[];
  openaiTools: OpenAI.Chat.ChatCompletionTool[];
  callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult>;
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
 * Map MCP tools to OpenAI function/tool definitions.
 */
function mapMcpToolsToOpenAI(tools: McpToolInfo[]): OpenAI.Chat.ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description || `MCP tool: ${tool.name}`,
      parameters: (tool.inputSchema as Record<string, unknown>) ?? {
        type: "object",
        properties: {},
      },
    },
  }));
}

/**
 * Connect to a single MCP server and return a connection handle.
 */
export async function connectMcpServer(
  name: string,
  command: string,
  args: string[]
): Promise<McpConnection> {
  logger.info(`Connecting to MCP server for worker: ${name}`, { command, args });

  const transport = new StdioClientTransport({ command, args });

  const client = new Client(
    { name: `multi-agent-${name}`, version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);

  const { tools } = await client.listTools();

  const toolInfos: McpToolInfo[] = (tools ?? []).map((t) => ({
    name: t.name,
    description: t.description ?? "",
    inputSchema: t.inputSchema as Record<string, unknown>,
  }));

  const openaiTools = mapMcpToolsToOpenAI(toolInfos);

  logger.info(`MCP server connected for worker: ${name}`, {
    toolCount: toolInfos.length,
    tools: toolInfos.map((t) => t.name),
  });

  return {
    tools: toolInfos,
    openaiTools,

    async callTool(toolName: string, args: Record<string, unknown>): Promise<ToolCallResult> {
      logger.debug(`Worker ${name} calling tool`, { tool: toolName, args });
      try {
        const result = (await client.callTool({
          name: toolName,
          arguments: args,
        })) as { content?: Array<{ type: string; text?: string }>; isError?: boolean };

        const textParts = (result.content ?? [])
          .filter((c) => c.type === "text" && c.text)
          .map((c) => c.text as string);
        const output = textParts.join("\n");

        if (result.isError) {
          return { success: false, output, error: output };
        }
        return { success: true, output };
      } catch (error) {
        const err = error as Error;
        logger.error(`Worker ${name} tool call failed`, { tool: toolName, error: err.message });
        return { success: false, output: err.message, error: err.message };
      }
    },

    async close(): Promise<void> {
      logger.info(`Closing MCP connection for worker: ${name}`);
      await client.close();
    },
  };
}

/**
 * Worker agent configuration.
 */
export interface WorkerConfig {
  /** Unique identifier for this worker */
  id: string;
  /** Human-readable name */
  name: string;
  /** System prompt defining the worker's role and expertise */
  systemPrompt: string;
  /** MCP server command (from env) */
  mcpCommand: string;
  /** MCP server args (from env) */
  mcpArgs: string[];
}

/**
 * Load worker configurations from environment variables.
 *
 * Looks for MCP_SERVER_<WORKER_ID>_COMMAND and MCP_SERVER_<WORKER_ID>_ARGS
 * for each predefined worker. Workers without MCP config are skipped.
 */
export function loadWorkerConfigs(): WorkerConfig[] {
  const workerDefs: Array<{
    id: string;
    name: string;
    systemPrompt: string;
  }> = [
    {
      id: "RESEARCH",
      name: "Research Agent",
      systemPrompt: `You are a research specialist. Your job is to search for information, analyze findings, and provide well-structured summaries.

Use your web search and URL fetching tools to find relevant information. Always cite your sources (URLs). Be thorough but concise. If you cannot find enough information, say so clearly.`,
    },
    {
      id: "CODE",
      name: "Code Agent",
      systemPrompt: `You are a code and file system specialist. Your job is to read, write, and analyze files and code.

Use your filesystem tools to explore directories, read files, and understand code structure. Provide clear analysis of what you find. When asked to make changes, explain what you would do.`,
    },
    {
      id: "DATA",
      name: "Data Agent",
      systemPrompt: `You are a data analysis specialist. Your job is to query databases, analyze results, and provide insights.

Use your database query tools to retrieve and analyze data. Present findings in a clear, structured format with relevant numbers and trends. If a query fails, try alternative approaches.`,
    },
  ];

  const configs: WorkerConfig[] = [];

  for (const def of workerDefs) {
    const command = process.env[`MCP_SERVER_${def.id}_COMMAND`];
    const args = parseArgs(process.env[`MCP_SERVER_${def.id}_ARGS`]);

    if (!command) {
      logger.info(`Worker ${def.name} skipped — no MCP_SERVER_${def.id}_COMMAND configured`);
      continue;
    }

    configs.push({
      id: def.id,
      name: def.name,
      systemPrompt: def.systemPrompt,
      mcpCommand: command,
      mcpArgs: args,
    });
  }

  logger.info("Worker configurations loaded", {
    count: configs.length,
    workers: configs.map((c) => c.name),
  });

  return configs;
}

/**
 * Manage all MCP connections for workers.
 */
export class McpConnectionManager {
  private connections: Map<string, McpConnection> = new Map();

  /**
   * Connect to all worker MCP servers.
   */
  async connectAll(configs: WorkerConfig[]): Promise<void> {
    for (const config of configs) {
      try {
        const conn = await connectMcpServer(config.id, config.mcpCommand, config.mcpArgs);
        this.connections.set(config.id, conn);
      } catch (error) {
        logger.error(`Failed to connect MCP server for worker ${config.name}`, {
          error: (error as Error).message,
        });
      }
    }
  }

  /**
   * Get the MCP connection for a specific worker.
   */
  get(workerId: string): McpConnection | undefined {
    return this.connections.get(workerId);
  }

  /**
   * Get all active connections.
   */
  getAll(): Map<string, McpConnection> {
    return this.connections;
  }

  /**
   * Close all MCP connections.
   */
  async closeAll(): Promise<void> {
    const closePromises: Promise<void>[] = [];
    for (const [, conn] of this.connections) {
      closePromises.push(conn.close());
    }
    await Promise.all(closePromises);
    this.connections.clear();
    logger.info("All MCP connections closed");
  }
}
