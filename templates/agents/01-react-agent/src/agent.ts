/**
 * ReAct Agent — Reasoning + Acting loop.
 *
 * Implements the classic ReAct pattern:
 *   Thought → Action → Observation → Thought → ... → Final Answer
 *
 * The LLM reasons about the task in text, decides which MCP tool to call,
 * observes the result, and repeats until it produces a final answer
 * or hits the max iteration limit.
 */

import OpenAI from "openai";
import { McpClient, formatToolsForPrompt } from "./tools.js";
import { logger } from "./lib/logger.js";

const REACT_SYSTEM_PROMPT = `You are a ReAct (Reasoning + Acting) agent. You solve tasks by reasoning step-by-step and taking actions using the available tools.

You MUST use the following format for every response:

Thought: <your reasoning about what to do next>
Action: <the tool name to call>
Action Input: <a JSON object with the tool's arguments>

After you receive the observation, you continue:

Thought: <reasoning about the observation>
Action: <next tool or same tool with different args>
Action Input: <JSON arguments>

When you have enough information to answer the original task, respond with:

Thought: <your final reasoning>
Final Answer: <your complete answer to the task>

Rules:
- Always output exactly one Thought and one Action/Action Input pair, OR a Thought and Final Answer.
- Action Input must be valid JSON.
- Only use tools from the "Available Tools" list.
- If you cannot complete the task with the available tools, explain why in your Final Answer.
- Be concise in your thoughts but thorough in your reasoning.`;

export interface ReActStep {
  thought: string;
  action?: string;
  actionInput?: Record<string, unknown>;
  observation?: string;
  finalAnswer?: string;
}

export interface ReActResult {
  answer: string;
  steps: ReActStep[];
  iterations: number;
  completed: boolean;
}

/**
 * Parse the LLM response into a ReAct step.
 *
 * Extracts Thought, Action, Action Input, and/or Final Answer
 * from the model's text output.
 */
function parseReActResponse(response: string): {
  thought: string;
  action?: string;
  actionInput?: Record<string, unknown>;
  finalAnswer?: string;
} {
  // Extract Thought
  const thoughtMatch = response.match(/Thought:\s*(.*?)(?=\n(?:Action:|Final Answer:)|$)/s);
  const thought = thoughtMatch ? thoughtMatch[1].trim() : "";

  // Check for Final Answer
  const finalAnswerMatch = response.match(/Final Answer:\s*(.*?)$/s);
  if (finalAnswerMatch) {
    return {
      thought,
      finalAnswer: finalAnswerMatch[1].trim(),
    };
  }

  // Extract Action
  const actionMatch = response.match(/Action:\s*(.*?)(?=\nAction Input:|$)/s);
  const action = actionMatch ? actionMatch[1].trim() : undefined;

  // Extract Action Input (JSON)
  const actionInputMatch = response.match(/Action Input:\s*(.*?)(?=\n(?:Thought:|Action:|Final Answer:)|$)/s);
  let actionInput: Record<string, unknown> | undefined;
  if (actionInputMatch) {
    const rawInput = actionInputMatch[1].trim();
    try {
      actionInput = JSON.parse(rawInput);
    } catch {
      // If JSON parsing fails, try to use the raw string as a single argument
      actionInput = { input: rawInput };
      logger.warn("Failed to parse Action Input as JSON, using raw string", { rawInput });
    }
  }

  return { thought, action, actionInput };
}

/**
 * Run the ReAct loop for a given task.
 *
 * @param task - The task/question to solve
 * @param mcp - The connected MCP client with available tools
 * @param maxIterations - Maximum number of reasoning steps (default 10)
 * @returns The final answer and trace of all steps
 */
export async function runReActLoop(
  task: string,
  mcp: McpClient,
  maxIterations: number = 10
): Promise<ReActResult> {
  const openai = new OpenAI();
  const model = process.env.MODEL ?? "gpt-4o-mini";

  const toolsDescription = formatToolsForPrompt(mcp.tools);
  const systemPrompt = `${REACT_SYSTEM_PROMPT}\n\nAvailable Tools:\n${toolsDescription}`;

  // Build the conversation history
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: task },
  ];

  const steps: ReActStep[] = [];

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    logger.info("ReAct iteration", { iteration: iteration + 1, max: maxIterations });

    // Call the LLM
    const response = await openai.chat.completions.create({
      model,
      messages,
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content ?? "";
    logger.debug("LLM response", { iteration: iteration + 1, content });

    // Parse the response
    const parsed = parseReActResponse(content);

    // Check for Final Answer
    if (parsed.finalAnswer !== undefined) {
      const step: ReActStep = {
        thought: parsed.thought,
        finalAnswer: parsed.finalAnswer,
      };
      steps.push(step);

      logger.info("ReAct completed", { iterations: iteration + 1 });

      return {
        answer: parsed.finalAnswer,
        steps,
        iterations: iteration + 1,
        completed: true,
      };
    }

    // If no action was parsed, prompt the model to use the correct format
    if (!parsed.action) {
      logger.warn("No action or final answer parsed, prompting for format", {
        iteration: iteration + 1,
        content,
      });

      messages.push({ role: "assistant", content });
      messages.push({
        role: "user",
        content:
          'Your response did not follow the required format. Please respond with either:\nThought: ...\nAction: <tool name>\nAction Input: <json>\n\nor:\nThought: ...\nFinal Answer: <answer>',
      });
      continue;
    }

    // Validate that the action is a known tool
    const toolExists = mcp.tools.some((t) => t.name === parsed.action);
    if (!toolExists) {
      logger.warn("Unknown tool requested", { action: parsed.action });

      messages.push({ role: "assistant", content });
      messages.push({
        role: "user",
        content: `The tool "${parsed.action}" does not exist. Available tools: ${mcp.tools.map((t) => t.name).join(", ")}. Please use a valid tool name.`,
      });
      continue;
    }

    // Execute the tool via MCP
    const actionInput = parsed.actionInput ?? {};
    logger.info("Executing tool", { action: parsed.action, input: actionInput });

    let observation: string;
    try {
      observation = await mcp.callTool(parsed.action, actionInput);
    } catch (error) {
      const err = error as Error;
      observation = `Error calling tool: ${err.message}`;
      logger.error("Tool execution failed", { action: parsed.action, error: err.message });
    }

    const step: ReActStep = {
      thought: parsed.thought,
      action: parsed.action,
      actionInput,
      observation,
    };
    steps.push(step);

    logger.info("Tool result received", {
      action: parsed.action,
      resultLength: observation.length,
    });

    // Append the assistant response and the observation to the conversation
    messages.push({ role: "assistant", content });
    messages.push({
      role: "user",
      content: `Observation: ${observation}`,
    });
  }

  // Max iterations reached — ask for a final answer
  logger.warn("Max iterations reached, requesting final answer", { maxIterations });

  messages.push({
    role: "user",
    content:
      "You have reached the maximum number of reasoning steps. Based on what you know so far, provide your Final Answer now.",
  });

  const finalResponse = await openai.chat.completions.create({
    model,
    messages,
    temperature: 0,
  });

  const finalContent = finalResponse.choices[0]?.message?.content ?? "";
  const finalParsed = parseReActResponse(finalContent);

  const answer = finalParsed.finalAnswer ?? finalContent;

  return {
    answer,
    steps,
    iterations: maxIterations,
    completed: false,
  };
}
