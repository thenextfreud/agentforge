/**
 * ReAct Agent — Entry point
 *
 * Receives a task from the command line, connects to an MCP server,
 * runs the ReAct loop, and prints the final answer to stdout.
 *
 * Usage:
 *   npx tsx src/index.ts "What is the weather in Tokyo?"
 *   npx tsx src/index.ts "Echo the message 'hello world' in uppercase"
 */

import { connectMcpServer } from "./tools.js";
import { runReActLoop } from "./agent.js";
import { logger } from "./lib/logger.js";

async function main() {
  // Get task from command line arguments
  const task = process.argv.slice(2).join(" ").trim();

  if (!task) {
    console.error("Usage: npx tsx src/index.ts <task>");
    console.error('Example: npx tsx src/index.ts "Echo the message hello in uppercase"');
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    logger.error("OPENAI_API_KEY is not set. Copy .env.example to .env and add your key.");
    process.exit(1);
  }

  const maxIterations = parseInt(process.env.MAX_ITERATIONS ?? "10", 10);

  logger.info("Starting ReAct agent", { task, maxIterations });

  // Connect to the MCP server
  const mcp = await connectMcpServer();

  try {
    // Run the ReAct loop
    const result = await runReActLoop(task, mcp, maxIterations);

    // Log the trace to stderr
    logger.info("ReAct agent finished", {
      completed: result.completed,
      iterations: result.iterations,
      steps: result.steps.length,
    });

    // Print the final answer to stdout
    console.log("\n" + "=".repeat(60));
    console.log("FINAL ANSWER");
    console.log("=".repeat(60));
    console.log(result.answer);
    console.log("=".repeat(60));

    // Print the reasoning trace to stderr (for debugging)
    logger.info("Reasoning trace", {
      trace: result.steps.map((s, i) => ({
        step: i + 1,
        thought: s.thought,
        action: s.action,
        actionInput: s.actionInput,
        observation: s.observation?.slice(0, 200),
        finalAnswer: s.finalAnswer,
      })),
    });
  } finally {
    await mcp.close();
  }
}

main().catch((error) => {
  logger.error("Fatal error", { error: error.message, stack: error.stack });
  process.exit(1);
});
