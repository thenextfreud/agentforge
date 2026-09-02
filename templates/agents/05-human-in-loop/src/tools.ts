/**
 * MCP client setup with human-in-the-loop approval gates.
 *
 * Connects to an MCP server, discovers tools, and classifies them by
 * risk level. Before executing risky or dangerous tools, the agent
 * pauses and asks for human approval via stdin.
 *
 * Tool risk classification:
 * - SAFE: read-only operations (search, query, list, get, read)
 * - RISKY: operations that modify state (write, create, update, insert)
 * - DANGEROUS: irreversible operations (delete, drop, execute, remove)
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as readline from "readline";
import type OpenAI from "openai";
import { logger } from "./lib/logger.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RiskLevel = "safe" | "risky" | "dangerous";

export interface McpToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  risk: RiskLevel;
}

export interface ToolCallResult {
  success: boolean;
  output: string;
  error?: string;
  approved: boolean;
  risk: RiskLevel;
}

export interface McpClient {
  tools: McpToolInfo[];
  openaiTools: OpenAI.Chat.ChatCompletionTool[];
  callToolWithApproval(
    name: string,
    args: Record<string, unknown>
  ): Promise<ToolCallResult>;
  close(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Tool risk classification
// ---------------------------------------------------------------------------

/**
 * Patterns that indicate dangerous (irreversible) operations.
 */
const DANGEROUS_PATTERNS = [
  /delete/i,
  /drop/i,
  /remove/i,
  /destroy/i,
  /execute/i,
  /exec/i,
  /rm\b/i,
  /purge/i,
  /wipe/i,
  /truncate/i,
  /reset/i,
  /force/i,
  /overwrite/i,
];

/**
 * Patterns that indicate risky (state-modifying) operations.
 */
const RISKY_PATTERNS = [
  /write/i,
  /create/i,
  /update/i,
  /insert/i,
  /upsert/i,
  /modify/i,
  /set/i,
  /put/i,
  /post/i,
  /patch/i,
  /move/i,
  /rename/i,
  /copy/i,
  /upload/i,
  /publish/i,
  /deploy/i,
  /send/i,
  /email/i,
  /grant/i,
  /revoke/i,
];

/**
 * Patterns that indicate safe (read-only) operations.
 */
const SAFE_PATTERNS = [
  /read/i,
  /get/i,
  /list/i,
  /search/i,
  /query/i,
  /fetch/i,
  /find/i,
  /show/i,
  /describe/i,
  /inspect/i,
  /view/i,
  /check/i,
  /count/i,
  /stats/i,
  /info/i,
  /status/i,
  /health/i,
  /echo/i,
  /ping/i,
];

/**
 * Classify a tool's risk level based on its name and description.
 *
 * @returns The risk level: "safe", "risky", or "dangerous"
 */
export function classifyTool(name: string, description: string): RiskLevel {
  const text = `${name} ${description}`.toLowerCase();

  // Check dangerous patterns first (highest priority)
  if (DANGEROUS_PATTERNS.some((p) => p.test(text))) {
    return "dangerous";
  }

  // Check risky patterns
  if (RISKY_PATTERNS.some((p) => p.test(text))) {
    return "risky";
  }

  // Check safe patterns
  if (SAFE_PATTERNS.some((p) => p.test(text))) {
    return "safe";
  }

  // Default to risky for unknown tools (better safe than sorry)
  return "risky";
}

// ---------------------------------------------------------------------------
// Human approval interface
// ---------------------------------------------------------------------------

/**
 * Create a readline interface for stdin approval prompts.
 */
function createApprovalInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stderr, // Use stderr so stdout stays clean for agent output
  });
}

/**
 * Ask for human approval before executing a tool.
 *
 * @returns The user's response: "approve", "deny", or modified args as JSON
 */
export async function requestApproval(
  toolName: string,
  risk: RiskLevel,
  args: Record<string, unknown>,
  description: string
): Promise<{ approved: boolean; modifiedArgs?: Record<string, unknown> }> {
  const rl = createApprovalInterface();

  const riskLabel = risk === "dangerous" ? "⚠️  DANGEROUS" : risk === "risky" ? "⚡ RISKY" : "SAFE";
  const warning =
    risk === "dangerous"
      ? "\n  ⚠️  WARNING: This operation may be IRREVERSIBLE. Please review carefully."
      : "";

  const prompt = `
┌─────────────────────────────────────────────────────────────────┐
│  TOOL APPROVAL REQUIRED                                         │
│                                                                 │
│  Tool: ${toolName.padEnd(52)}│
│  Risk: ${riskLabel.padEnd(52)}│
│  Description: ${description.slice(0, 49).padEnd(49)}│
│                                                                 │
│  Arguments:                                                     │
│  ${JSON.stringify(args, null, 2).split("\n").join("\n  ").slice(0, 500)}${warning}
│                                                                 │
│  Options:                                                       │
│    y / yes   — Approve and execute                              │
│    n / no    — Deny (skip this tool call)                       │
│    {"key":"value"} — Modify args (provide new JSON)             │
└─────────────────────────────────────────────────────────────────┘
Approve? [y/n/JSON]: `;

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();

      const trimmed = answer.trim().toLowerCase();

      if (trimmed === "y" || trimmed === "yes") {
        resolve({ approved: true });
      } else if (trimmed === "n" || trimmed === "no" || trimmed === "") {
        resolve({ approved: false });
      } else {
        // Try to parse as modified JSON args
        try {
          const modifiedArgs = JSON.parse(trimmed);
          resolve({ approved: true, modifiedArgs });
        } catch {
          // Not valid JSON — treat as denial
          logger.warn("Approval response not recognized, denying", { answer: trimmed });
          resolve({ approved: false });
        }
      }
    });
  });
}

// ---------------------------------------------------------------------------
// MCP client setup
// ---------------------------------------------------------------------------

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
      description: `[${tool.risk.toUpperCase()}] ${tool.description}`,
      parameters: tool.inputSchema ?? { type: "object", properties: {} },
    },
  }));
}

/**
 * Connect to an MCP server with human-in-the-loop approval gates.
 */
export async function connectMcpServer(): Promise<McpClient> {
  const command = process.env.MCP_SERVER_COMMAND ?? "npx";
  const args = parseArgs(process.env.MCP_SERVER_ARGS);
  const autoApproveSafe = process.env.AUTO_APPROVE_SAFE !== "false";

  logger.info("Connecting to MCP server", { command, args, autoApproveSafe });

  const transport = new StdioClientTransport({ command, args });

  const client = new Client(
    { name: "human-in-loop-agent", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);

  // Discover and classify tools
  const { tools } = await client.listTools();

  const toolInfos: McpToolInfo[] = (tools ?? []).map((t) => ({
    name: t.name,
    description: t.description ?? "",
    inputSchema: t.inputSchema as Record<string, unknown>,
    risk: classifyTool(t.name, t.description ?? ""),
  }));

  const openaiTools = mapMcpToolsToOpenAI(toolInfos);

  logger.info("MCP server connected — tools classified", {
    toolCount: toolInfos.length,
    safe: toolInfos.filter((t) => t.risk === "safe").map((t) => t.name),
    risky: toolInfos.filter((t) => t.risk === "risky").map((t) => t.name),
    dangerous: toolInfos.filter((t) => t.risk === "dangerous").map((t) => t.name),
    autoApproveSafe,
  });

  return {
    tools: toolInfos,
    openaiTools,

    async callToolWithApproval(
      name: string,
      args: Record<string, unknown>
    ): Promise<ToolCallResult> {
      const tool = toolInfos.find((t) => t.name === name);
      const risk = tool?.risk ?? "risky";
      const description = tool?.description ?? "Unknown tool";

      logger.info("Tool call requested", { name, risk, args });

      // Auto-approve safe tools if configured
      if (risk === "safe" && autoApproveSafe) {
        logger.info("Auto-approving safe tool", { name });
        return executeTool(client, name, args, risk, true);
      }

      // Request human approval for risky and dangerous tools
      const approval = await requestApproval(name, risk, args, description);

      if (!approval.approved) {
        logger.info("Tool call denied by human", { name, risk });
        return {
          success: false,
          output: `Tool call "${name}" was denied by the human operator.`,
          error: "Denied by human operator",
          approved: false,
          risk,
        };
      }

      // Use modified args if provided
      const finalArgs = approval.modifiedArgs ?? args;
      if (approval.modifiedArgs) {
        logger.info("Tool args modified by human", { name, originalArgs: args, modifiedArgs: finalArgs });
      }

      // For dangerous tools, ask for a second confirmation
      if (risk === "dangerous") {
        const confirmApproval = await requestApproval(
          name,
          risk,
          finalArgs,
          `CONFIRM: ${description}`
        );

        if (!confirmApproval.approved) {
          logger.info("Dangerous tool call denied at confirmation step", { name });
          return {
            success: false,
            output: `Dangerous tool call "${name}" was denied at the confirmation step.`,
            error: "Denied at confirmation step",
            approved: false,
            risk,
          };
        }
      }

      return executeTool(client, name, finalArgs, risk, true);
    },

    async close(): Promise<void> {
      logger.info("Closing MCP connection");
      await client.close();
    },
  };
}

/**
 * Execute a tool call on the MCP server.
 */
async function executeTool(
  client: Client,
  name: string,
  args: Record<string, unknown>,
  risk: RiskLevel,
  approved: boolean
): Promise<ToolCallResult> {
  logger.debug("Executing tool", { name, args, risk });

  try {
    const result = (await client.callTool({
      name,
      arguments: args,
    })) as { content?: Array<{ type: string; text?: string }>; isError?: boolean };

    const textParts = (result.content ?? [])
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text as string);
    const output = textParts.join("\n");

    if (result.isError) {
      return { success: false, output, error: output, approved, risk };
    }

    return { success: true, output, approved, risk };
  } catch (error) {
    const err = error as Error;
    logger.error("Tool execution failed", { name, error: err.message });
    return { success: false, output: err.message, error: err.message, approved, risk };
  }
}
