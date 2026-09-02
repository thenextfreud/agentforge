/**
 * Human-in-the-Loop Agent — Approval gates for sensitive operations.
 *
 * Uses OpenAI's native tool-calling API. Before executing any tool that
 * is classified as "risky" or "dangerous", the agent pauses and asks
 * for human approval via stdin. Safe tools are auto-approved (configurable).
 *
 * The agent loop:
 * 1. Model decides which tool to call
 * 2. Agent checks the tool's risk classification
 * 3. If safe + auto-approve enabled → execute immediately
 * 4. If risky → ask for approval (y/n/modified args)
 * 5. If dangerous → ask for approval, then ask again to confirm
 * 6. Feed the result (or denial) back to the model
 * 7. Repeat until the model produces a final answer
 */

import OpenAI from "openai";
import { McpClient, ToolCallResult, RiskLevel } from "./tools.js";
import { logger } from "./lib/logger.js";

const SYSTEM_PROMPT = `You are a helpful assistant with access to MCP tools. Some tools require human approval before execution.

Tool descriptions include a risk level prefix:
- [SAFE] — read-only operations, auto-approved
- [RISKY] — modifies state, requires human approval
- [DANGEROUS] — irreversible operations, requires double confirmation

Guidelines:
- Use tools to accomplish the user's task.
- If a tool is denied by the human operator, respect that decision and try an alternative approach.
- If all approaches are denied, explain to the user what you needed to do and why it was blocked.
- Be transparent about what you're trying to do before calling risky or dangerous tools.
- You can call multiple tools in a single response if appropriate.`;

export interface ApprovalStep {
  toolName: string;
  risk: RiskLevel;
  args: Record<string, unknown>;
  approved: boolean;
  modifiedArgs?: Record<string, unknown>;
  result: ToolCallResult;
}

export interface HumanInLoopResult {
  answer: string;
  steps: ApprovalStep[];
  totalToolCalls: number;
  approvedCalls: number;
  deniedCalls: number;
}

/**
 * Run the human-in-the-loop agent.
 *
 * @param task - The user's task
 * @param mcp - The connected MCP client with approval gates
 * @param maxIterations - Maximum tool-calling rounds (default 10)
 * @returns The final answer and approval trace
 */
export async function runHumanInLoopAgent(
  task: string,
  mcp: McpClient,
  maxIterations: number = 10
): Promise<HumanInLoopResult> {
  const openai = new OpenAI();
  const model = process.env.MODEL ?? "gpt-4o-mini";

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: task },
  ];

  const steps: ApprovalStep[] = [];
  let totalToolCalls = 0;
  let approvedCalls = 0;
  let deniedCalls = 0;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    logger.info("Agent iteration", { iteration: iteration + 1, max: maxIterations });

    const response = await openai.chat.completions.create({
      model,
      messages,
      tools: mcp.openaiTools,
      tool_choice: "auto",
      temperature: 0,
    });

    const assistantMessage = response.choices[0].message;

    // No tool calls — agent is done
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      const answer = assistantMessage.content ?? "";

      logger.info("Agent completed", {
        iterations: iteration + 1,
        totalToolCalls,
        approvedCalls,
        deniedCalls,
      });

      return {
        answer,
        steps,
        totalToolCalls,
        approvedCalls,
        deniedCalls,
      };
    }

    // Append assistant message with tool calls
    messages.push(assistantMessage);

    // Process each tool call through the approval gate
    for (const tc of assistantMessage.tool_calls) {
      const toolName = tc.function.name;
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(tc.function.arguments);
      } catch {
        args = {};
      }

      totalToolCalls++;

      // Find the tool's risk level
      const tool = mcp.tools.find((t) => t.name === toolName);
      const risk = tool?.risk ?? "risky";

      logger.info("Processing tool call through approval gate", {
        tool: toolName,
        risk,
        iteration: iteration + 1,
      });

      // Call through the approval gate
      const result = await mcp.callToolWithApproval(toolName, args);

      if (result.approved) {
        approvedCalls++;
      } else {
        deniedCalls++;
      }

      const step: ApprovalStep = {
        toolName,
        risk,
        args,
        approved: result.approved,
        result,
      };
      steps.push(step);

      // Feed the result back to the model
      const toolMessageContent = result.success
        ? result.output
        : result.approved
          ? `Error: ${result.error}`
          : `Tool call was DENIED by the human operator. Reason: ${result.output}`;

      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: toolMessageContent,
      });

      logger.info("Tool call processed", {
        tool: toolName,
        risk,
        approved: result.approved,
        success: result.success,
      });
    }
  }

  // Max iterations — get final answer without tools
  logger.warn("Max iterations reached, requesting final answer", { maxIterations });

  const finalResponse = await openai.chat.completions.create({
    model,
    messages,
    tools: undefined,
    temperature: 0,
  });

  const answer =
    finalResponse.choices[0]?.message?.content ??
    "I was unable to complete the task within the iteration limit.";

  return {
    answer,
    steps,
    totalToolCalls,
    approvedCalls,
    deniedCalls,
  };
}
