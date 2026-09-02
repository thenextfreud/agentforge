/**
 * Human-in-the-Loop Agent — Entry point
 *
 * Receives a task from the command line, connects to an MCP server,
 * runs the agent with human approval gates, and prints the result.
 *
 * The agent will pause and ask for approval before executing any tool
 * classified as "risky" or "dangerous". Safe tools are auto-approved
 * (unless AUTO_APPROVE_SAFE=false).
 *
 * Usage:
 *   npx tsx src/index.ts "Echo the message 'hello world'"
 *   npx tsx src/index.ts "Delete the file temp.txt"
 *   npx tsx src/index.ts "Write 'hello' to output.txt"
 */

import { connectMcpServer } from "./tools.js";
import { runHumanInLoopAgent } from "./agent.js";
import { logger } from "./lib/logger.js";

async function main() {
  const task = process.argv.slice(2).join(" ").trim();

  if (!task) {
    console.error("Usage: npx tsx src/index.ts <task>");
    console.error('Example: npx tsx src/index.ts "Echo the message hello"');
    console.error('Example: npx tsx src/index.ts "Delete the file temp.txt"');
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    logger.error("OPENAI_API_KEY is not set. Copy .env.example to .env and add your key.");
    process.exit(1);
  }

  logger.info("Starting human-in-the-loop agent", { task });

  const mcp = await connectMcpServer();

  // Print tool classification summary to stderr
  const safe = mcp.tools.filter((t) => t.risk === "safe").map((t) => t.name);
  const risky = mcp.tools.filter((t) => t.risk === "risky").map((t) => t.name);
  const dangerous = mcp.tools.filter((t) => t.risk === "dangerous").map((t) => t.name);

  logger.info("Tool risk classification", { safe, risky, dangerous });

  try {
    const result = await runHumanInLoopAgent(task, mcp);

    // Log approval trace to stderr
    logger.info("Approval trace", {
      totalToolCalls: result.totalToolCalls,
      approved: result.approvedCalls,
      denied: result.deniedCalls,
      steps: result.steps.map((s) => ({
        tool: s.toolName,
        risk: s.risk,
        approved: s.approved,
        success: s.result.success,
        outputPreview: s.result.output.slice(0, 200),
      })),
    });

    // Print the final answer to stdout
    console.log("\n" + "=".repeat(60));
    console.log("RESULT");
    console.log("=".repeat(60));
    console.log(result.answer);
    console.log("=".repeat(60));

    // Print approval summary
    console.log("\n--- Approval Summary ---\n");
    console.log(`Total tool calls: ${result.totalToolCalls}`);
    console.log(`Approved: ${result.approvedCalls}`);
    console.log(`Denied: ${result.deniedCalls}`);

    if (result.steps.length > 0) {
      console.log("\nDetails:");
      for (const step of result.steps) {
        const status = step.approved ? (step.result.success ? "✓ approved" : "✓ approved (error)") : "✗ denied";
        console.log(`  ${status} — ${step.toolName} [${step.risk}]`);
      }
    }
  } finally {
    await mcp.close();
  }
}

main().catch((error) => {
  logger.error("Fatal error", { error: error.message, stack: error.stack });
  process.exit(1);
});
