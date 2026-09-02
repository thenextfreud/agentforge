/**
 * Multi-Agent Orchestration — Entry point
 *
 * Receives a complex task, sets up multiple worker agents with their
 * own MCP connections, runs the coordinator + workers pattern, and
 * prints the synthesized answer.
 *
 * Usage:
 *   npx tsx src/index.ts "Research the latest Node.js features, check our codebase for compatibility, and query the database for affected records"
 *   npx tsx src/index.ts "Find documentation about OAuth 2.0 and check if our API implementation matches"
 */

import { loadWorkerConfigs, McpConnectionManager } from "./tools.js";
import { runMultiAgent } from "./agent.js";
import { logger } from "./lib/logger.js";

async function main() {
  const task = process.argv.slice(2).join(" ").trim();

  if (!task) {
    console.error("Usage: npx tsx src/index.ts <task>");
    console.error('Example: npx tsx src/index.ts "Research X, analyze our code for Y, and query the database for Z"');
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    logger.error("OPENAI_API_KEY is not set. Copy .env.example to .env and add your key.");
    process.exit(1);
  }

  // Load worker configurations from environment
  const workerConfigs = loadWorkerConfigs();

  if (workerConfigs.length === 0) {
    logger.error(
      "No workers configured. Set MCP_SERVER_RESEARCH_COMMAND, MCP_SERVER_CODE_COMMAND, " +
        "and/or MCP_SERVER_DATA_COMMAND in your .env file."
    );
    process.exit(1);
  }

  logger.info("Starting multi-agent orchestration", {
    task,
    workerCount: workerConfigs.length,
    workers: workerConfigs.map((w) => w.name),
  });

  // Connect to all worker MCP servers
  const connectionManager = new McpConnectionManager();
  await connectionManager.connectAll(workerConfigs);

  const activeWorkers = connectionManager.getAll().size;
  if (activeWorkers === 0) {
    logger.error("Failed to connect to any worker MCP servers.");
    await connectionManager.closeAll();
    process.exit(1);
  }

  logger.info("Worker MCP connections established", { active: activeWorkers });

  try {
    const result = await runMultiAgent(task, workerConfigs, connectionManager);

    // Log orchestration trace to stderr
    logger.info("Orchestration trace", {
      subtaskCount: result.subtasks.length,
      workerCount: result.workerCount,
      subtasks: result.subtasks.map((s) => ({
        worker: s.worker,
        task: s.task,
      })),
      results: result.results.map((r) => ({
        worker: r.workerName,
        success: r.success,
        toolCalls: r.toolCalls,
        resultPreview: r.result.slice(0, 200),
      })),
    });

    // Print the final answer to stdout
    console.log("\n" + "=".repeat(60));
    console.log("COORDINATED ANSWER");
    console.log("=".repeat(60));
    console.log(result.answer);
    console.log("=".repeat(60));

    // Print worker contributions summary
    console.log("\n--- Worker Contributions ---\n");
    for (const r of result.results) {
      const status = r.success ? "✓" : "✗";
      console.log(`${status} ${r.workerName}: ${r.toolCalls} tool calls`);
      console.log(`  Task: ${r.task.slice(0, 100)}...`);
      console.log(`  Result: ${r.result.slice(0, 150)}...`);
      console.log();
    }
  } finally {
    await connectionManager.closeAll();
  }
}

main().catch((error) => {
  logger.error("Fatal error", { error: error.message, stack: error.stack });
  process.exit(1);
});
