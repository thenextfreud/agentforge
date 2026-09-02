/**
 * Multi-Agent Orchestration — Coordinator + Workers pattern.
 *
 * A coordinator agent receives a task, breaks it into subtasks,
 * assigns each subtask to the most appropriate specialist worker,
 * collects results, and synthesizes a final answer.
 *
 * Each worker agent has:
 * - Its own MCP server connection (own set of tools)
 * - Its own system prompt (specialized role)
 * - Its own LLM conversation session
 *
 * Architecture:
 *
 *     User Task
 *         │
 *         ▼
 *   ┌─────────────┐
 *   │ Coordinator │  ── breaks task into subtasks
 *   └──────┬──────┘
 *          │
 *     ┌────┼────┬────┐
 *     ▼    ▼    ▼    ▼
 *   ┌───┐┌───┐┌───┐┌───┐
 *   │ W1││ W2││ W3││...│  ── each worker uses its own MCP tools
 *   └───┘└───┘└───┘└───┘
 *     │    │    │    │
 *     └────┼────┴────┘
 *          │
 *          ▼
 *   ┌─────────────┐
 *   │ Coordinator │  ── synthesizes final answer
 *   └──────┬──────┘
 *          │
 *          ▼
 *     Final Answer
 */

import OpenAI from "openai";
import {
  McpConnectionManager,
  WorkerConfig,
  McpConnection,
  ToolCallResult,
} from "./tools.js";
import { logger } from "./lib/logger.js";

const COORDINATOR_SYSTEM_PROMPT = `You are a task coordinator. Your job is to break down complex tasks into subtasks and assign them to specialist worker agents.

Available workers:
{WORKERS}

Instructions:
1. Analyze the task and identify what subtasks are needed.
2. Assign each subtask to the most appropriate worker.
3. Provide clear, specific instructions for each subtask.

Respond in JSON format:
{
  "subtasks": [
    {
      "worker": "<worker id>",
      "task": "<specific instructions for this worker>"
    }
  ]
}

Rules:
- Only assign subtasks to workers from the available list.
- Be specific — each subtask should have clear, actionable instructions.
- If a task doesn't need any workers, return an empty subtasks array.
- You can assign multiple subtasks to the same worker if needed.
- Break complex tasks into smaller, well-defined subtasks.`;

const SYNTHESIS_SYSTEM_PROMPT = `You are a synthesis coordinator. You have received results from multiple specialist worker agents. Your job is to combine their findings into a single, coherent, comprehensive answer.

Instructions:
- Integrate information from all worker results.
- Resolve any contradictions by noting differing perspectives.
- Structure the answer clearly with sections if appropriate.
- Credit which worker contributed which information.
- If a worker returned an error or incomplete results, note it.
- Be comprehensive but not redundant.`;

export interface Subtask {
  worker: string;
  task: string;
}

export interface SubtaskResult {
  worker: string;
  workerName: string;
  task: string;
  result: string;
  success: boolean;
  toolCalls: number;
}

export interface MultiAgentResult {
  answer: string;
  subtasks: Subtask[];
  results: SubtaskResult[];
  workerCount: number;
}

/**
 * Run a single worker agent on a subtask.
 *
 * The worker uses its MCP tools via OpenAI's tool-calling API.
 */
async function runWorker(
  openai: OpenAI,
  model: string,
  config: WorkerConfig,
  task: string,
  mcp: McpConnection
): Promise<SubtaskResult> {
  logger.info(`Running worker: ${config.name}`, { task: task.slice(0, 100) });

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: config.systemPrompt },
    { role: "user", content: task },
  ];

  let toolCalls = 0;
  const maxIterations = 10;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const response = await openai.chat.completions.create({
      model,
      messages,
      tools: mcp.openaiTools,
      tool_choice: "auto",
      temperature: 0,
    });

    const assistantMessage = response.choices[0].message;

    // No tool calls — worker is done
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      const result = assistantMessage.content ?? "";

      logger.info(`Worker ${config.name} completed`, {
        iterations: iteration + 1,
        toolCalls,
        resultLength: result.length,
      });

      return {
        worker: config.id,
        workerName: config.name,
        task,
        result,
        success: true,
        toolCalls,
      };
    }

    // Execute tool calls
    messages.push(assistantMessage);

    for (const tc of assistantMessage.tool_calls) {
      const toolName = tc.function.name;
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(tc.function.arguments);
      } catch {
        args = {};
      }

      toolCalls++;
      logger.debug(`Worker ${config.name} calling tool`, { tool: toolName, args });

      const toolResult: ToolCallResult = await mcp.callTool(toolName, args);

      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: toolResult.success ? toolResult.output : `Error: ${toolResult.error}`,
      });
    }
  }

  // Max iterations — get a final response without tools
  logger.warn(`Worker ${config.name} hit max iterations, requesting summary`);

  const finalResponse = await openai.chat.completions.create({
    model,
    messages,
    tools: undefined,
    temperature: 0,
  });

  return {
    worker: config.id,
    workerName: config.name,
    task,
    result: finalResponse.choices[0]?.message?.content ?? "Worker did not produce a result.",
    success: true,
    toolCalls,
  };
}

/**
 * Run the multi-agent orchestration.
 *
 * @param task - The user's complex task
 * @param workerConfigs - Available worker configurations
 * @param connectionManager - MCP connection manager
 * @returns The synthesized answer and all subtask results
 */
export async function runMultiAgent(
  task: string,
  workerConfigs: WorkerConfig[],
  connectionManager: McpConnectionManager
): Promise<MultiAgentResult> {
  const openai = new OpenAI();
  const model = process.env.MODEL ?? "gpt-4o-mini";

  // --- Phase 1: Coordinator breaks down the task ---

  // Build the worker description for the coordinator prompt
  const workerDescriptions = workerConfigs
    .filter((w) => connectionManager.get(w.id))
    .map((w) => `- ${w.id}: ${w.name}. ${w.systemPrompt.split("\n")[0]}`)
    .join("\n");

  const coordinatorPrompt = COORDINATOR_SYSTEM_PROMPT.replace(
    "{WORKERS}",
    workerDescriptions || "No workers available."
  );

  logger.info("Coordinator analyzing task", { task: task.slice(0, 100) });

  const coordResponse = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: coordinatorPrompt },
      { role: "user", content: task },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  });

  // Parse the coordinator's subtask assignments
  let subtasks: Subtask[] = [];
  try {
    const parsed = JSON.parse(coordResponse.choices[0].message.content ?? "{}");
    subtasks = parsed.subtasks ?? [];
  } catch (error) {
    logger.error("Failed to parse coordinator response", {
      error: (error as Error).message,
      content: coordResponse.choices[0].message.content,
    });
  }

  logger.info("Coordinator assigned subtasks", {
    count: subtasks.length,
    assignments: subtasks.map((s) => ({ worker: s.worker, taskPreview: s.task.slice(0, 80) })),
  });

  if (subtasks.length === 0) {
    // No subtasks needed — coordinator answers directly
    return {
      answer: "The coordinator determined this task doesn't require specialist workers.",
      subtasks: [],
      results: [],
      workerCount: 0,
    };
  }

  // --- Phase 2: Workers execute subtasks in parallel ---

  logger.info("Dispatching subtasks to workers");

  const workerPromises = subtasks.map(async (subtask): Promise<SubtaskResult> => {
    const config = workerConfigs.find((w) => w.id === subtask.worker);
    const mcp = connectionManager.get(subtask.worker);

    if (!config || !mcp) {
      logger.warn("Worker not available for subtask", { worker: subtask.worker });
      return {
        worker: subtask.worker,
        workerName: config?.name ?? subtask.worker,
        task: subtask.task,
        result: `Worker ${subtask.worker} is not available.`,
        success: false,
        toolCalls: 0,
      };
    }

    try {
      return await runWorker(openai, model, config, subtask.task, mcp);
    } catch (error) {
      const err = error as Error;
      logger.error(`Worker ${config.name} failed`, { error: err.message });
      return {
        worker: subtask.worker,
        workerName: config.name,
        task: subtask.task,
        result: `Worker failed with error: ${err.message}`,
        success: false,
        toolCalls: 0,
      };
    }
  });

  const results = await Promise.all(workerPromises);

  logger.info("All workers completed", {
    resultCount: results.length,
    successes: results.filter((r) => r.success).length,
    failures: results.filter((r) => !r.success).length,
  });

  // --- Phase 3: Coordinator synthesizes final answer ---

  // Build the synthesis context from worker results
  const resultsContext = results
    .map(
      (r) =>
        `## ${r.workerName} (Worker: ${r.worker})\n**Task:** ${r.task}\n**Result:** ${r.result}\n`
    )
    .join("\n---\n\n");

  logger.info("Coordinator synthesizing final answer");

  const synthResponse = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYNTHESIS_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Original task: ${task}\n\nWorker results:\n${resultsContext}\n\nPlease synthesize a comprehensive final answer.`,
      },
    ],
    temperature: 0.3,
  });

  const answer = synthResponse.choices[0]?.message?.content ?? "Unable to synthesize a final answer.";

  logger.info("Multi-agent orchestration complete", {
    subtaskCount: subtasks.length,
    workerCount: new Set(subtasks.map((s) => s.worker)).size,
  });

  return {
    answer,
    subtasks,
    results,
    workerCount: new Set(subtasks.map((s) => s.worker)).size,
  };
}
