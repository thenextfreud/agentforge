/**
 * RAG Agent — Entry point
 *
 * Receives a question from the command line, connects to a RAG MCP server,
 * retrieves relevant knowledge base chunks, and generates a cited answer.
 *
 * Usage:
 *   npx tsx src/index.ts "How does the authentication system work?"
 *   npx tsx src/index.ts "What are the supported API endpoints?" --multi-hop
 */

import { connectMcpServer } from "./tools.js";
import { runRagAgent } from "./agent.js";
import { logger } from "./lib/logger.js";

async function main() {
  // Check for --multi-hop flag
  const args = process.argv.slice(2);
  const multiHop = args.includes("--multi-hop");
  const question = args.filter((a) => !a.startsWith("--")).join(" ").trim();

  if (!question) {
    console.error("Usage: npx tsx src/index.ts <question> [--multi-hop]");
    console.error('Example: npx tsx src/index.ts "How does authentication work?"');
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    logger.error("OPENAI_API_KEY is not set. Copy .env.example to .env and add your key.");
    process.exit(1);
  }

  const maxChunks = parseInt(process.env.MAX_CHUNKS ?? "5", 10);

  logger.info("Starting RAG agent", { question, maxChunks, multiHop });

  const mcp = await connectMcpServer();

  try {
    const result = await runRagAgent(question, mcp, maxChunks, multiHop);

    // Log retrieval metadata to stderr
    logger.info("RAG retrieval summary", {
      searchRounds: result.searchRounds,
      searchQueries: result.searchQueries,
      chunksRetrieved: result.retrievedChunks.length,
      sources: result.retrievedChunks.map((c) => ({
        source: c.source,
        score: c.score,
        contentPreview: c.content.slice(0, 100),
      })),
    });

    // Print the answer with citations to stdout
    console.log("\n" + "=".repeat(60));
    console.log("ANSWER");
    console.log("=".repeat(60));
    console.log(result.answerWithCitations);
    console.log("=".repeat(60));
  } finally {
    await mcp.close();
  }
}

main().catch((error) => {
  logger.error("Fatal error", { error: error.message, stack: error.stack });
  process.exit(1);
});
