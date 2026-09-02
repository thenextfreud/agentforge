/**
 * Tool-Use Agent — Entry point
 *
 * Receives a task from the command line, connects to an MCP server,
 * runs the tool-use agent with parallel execution, and prints the result.
 *
 * Usage:
 *   npx tsx src/index.ts "Echo 'hello' and echo 'world' — both at once"
 *   npx tsx src/index.ts "Fetch the content of https://example.com"
 */

import { connectMcpServer } from "./tools.js";
import { runToolUseAgent } from "./agent.js";
import { logger } from "./lib/logger.js";

async function main() {
  const task = process.argv.slice(2).join(" ").trim();

  if (!task) {
    console.error("Usage: npx tsx src/index.ts <task>");
    console.error('Example: npx tsx src/index.ts "Echo hello and echo world in parallel"');
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    logger.error("OPENAI_API_KEY is not set. Copy .env.example to .env and add your key.");
    process.exit(1);
  }

  logger.info("Starting tool-use agent", { task });

  const mcp = await connectMcpServer();

  try {
    const result = await runToolUseAgent(task, mcp);

    logger.info("Tool-use agent finished", {
      totalToolCalls: result.totalToolCalls,
      steps: result.steps.length,
    });

    // Print the final answer to stdout
    console.log("\n" + "=".repeat(60));
    console.log("RESULT");
    console.log("=".repeat(60));
    console.log(result.answer);
    console.log("=".repeat(60));

    // Log tool call trace to stderr
    logger.info("Tool call trace", {
      trace: result.steps.map((s, i) => ({
        step: i + 1,
        toolCalls: s.toolCalls.map((tc) => ({ name: tc.name, args: tc.args })),
        results: s.results.map((r) => ({
          tool: r.name,
          success: r.result.success,
          outputPreview: r.result.output.slice(0, 200),
        })),
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
