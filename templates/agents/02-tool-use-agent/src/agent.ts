/**
 * Tool-Use Agent — Structured tool calling with parallel execution.
 *
 * Uses OpenAI's native function/tool calling API (not text-based ReAct
 * parsing). The model decides which tools to call and with what arguments,
 * and the agent executes them — potentially multiple in parallel.
 *
 * Key differences from the ReAct agent:
 * - No text parsing of "Thought/Action" — uses structured API fields
 * - Supports parallel tool calls (multiple tools in one response)
 * - Cleaner, more reliable tool selection
 * - Less transparent reasoning (no explicit "Thought" steps)
 */

import OpenAI from "openai";
import {
  McpClient,
  formatToolResultForOpenAI,
  ToolCallResult,
} from "./tools.js";
import { logger } from "./lib/logger.js";

const SYSTEM_PROMPT = `You are a helpful assistant with access to MCP tools. You can call multiple tools in a single response when appropriate.

Guidelines:
- Call tools when you need information or need to take action.
- You may call multiple tools in parallel if the calls are independent.
- After receiving tool results, synthesize them into a clear, helpful response.
- If a tool returns an error, try to understand why and adjust your approach.
- Be concise but thorough in your responses.`;

export interface ToolUseStep {
  /** The tool calls the model requested in this turn */
  toolCalls: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
  }>;
  /** The results of each tool call */
  results: Array<{
    id: string;
    name: string;
    result: ToolCallResult;
  }>;
}

export interface ToolUseResult {
  answer: string;
  steps: ToolUseStep[];
  totalToolCalls: number;
}

/**
 * Run the tool-use agent loop.
 *
 * @param task - The user's question or task
 * @param mcp - The connected MCP client with tools
 * @param maxIterations - Maximum number of tool-calling rounds (default 10)
 * @returns The final answer and trace of tool calls
 */
export async function runToolUseAgent(
  task: string,
  mcp: McpClient,
  maxIterations: number = 10
): Promise<ToolUseResult> {
  const openai = new OpenAI();
  const model = process.env.MODEL ?? "gpt-4o-mini";

  // Build the conversation with tool definitions
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: task },
  ];

  const steps: ToolUseStep[] = [];
  let totalToolCalls = 0;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    logger.info("Tool-use iteration", { iteration: iteration + 1, max: maxIterations });

    // Call the LLM with tool definitions
    const response = await openai.chat.completions.create({
      model,
      messages,
      tools: mcp.openaiTools,
      tool_choice: "auto",
      temperature: 0,
    });

    const choice = response.choices[0];
    const assistantMessage = choice.message;

    // If no tool calls, the model is done — return the text response
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      const answer = assistantMessage.content ?? "";

      logger.info("Agent completed (no more tool calls)", {
        iterations: iteration + 1,
        totalToolCalls,
      });

      return {
        answer,
        steps,
        totalToolCalls,
      };
    }

    // Append the assistant message (with tool calls) to the conversation
    messages.push(assistantMessage);

    // Extract tool calls
    const toolCalls = assistantMessage.tool_calls.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      args: JSON.parse(tc.function.arguments) as Record<string, unknown>,
    }));

    totalToolCalls += toolCalls.length;

    logger.info("Model requested tool calls", {
      count: toolCalls.length,
      tools: toolCalls.map((tc) => tc.name),
      parallel: toolCalls.length > 1,
    });

    // Execute tool calls — in parallel if multiple
    const callSpecs = toolCalls.map((tc) => ({
      id: tc.id,
      name: tc.name,
      args: tc.args,
    }));

    const resultMap = await mcp.callToolsParallel(callSpecs);

    // Build results array and append tool messages to conversation
    const results: ToolUseStep["results"] = [];
    for (const tc of toolCalls) {
      const result = resultMap.get(tc.id) ?? {
        success: false,
        output: "No result returned",
        error: "No result returned",
      };

      results.push({ id: tc.id, name: tc.name, result });

      // Append the tool result to the conversation
      messages.push(formatToolResultForOpenAI(tc.id, result));

      logger.debug("Tool result", {
        tool: tc.name,
        success: result.success,
        outputLength: result.output.length,
      });
    }

    steps.push({ toolCalls, results });
  }

  // Max iterations reached — get a final answer without tools
  logger.warn("Max iterations reached, requesting final answer", { maxIterations });

  const finalResponse = await openai.chat.completions.create({
    model,
    messages,
    tools: undefined,
    temperature: 0,
  });

  const answer = finalResponse.choices[0]?.message?.content ?? "I was unable to complete the task within the iteration limit.";

  return {
    answer,
    steps,
    totalToolCalls,
  };
}
