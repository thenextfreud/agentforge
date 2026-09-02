/**
 * MCP client setup for RAG (Retrieval-Augmented Generation).
 *
 * Connects to a RAG MCP server, discovers its search/query tool,
 * and provides a clean interface for retrieving knowledge base chunks
 * with metadata for citation.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { logger } from "./lib/logger.js";

/**
 * A retrieved chunk from the knowledge base.
 */
export interface RetrievedChunk {
  /** The text content of the chunk */
  content: string;
  /** Source identifier (filename, URL, document title, etc.) */
  source: string;
  /** Chunk index or position within the source */
  chunkIndex?: number;
  /** Relevance score (0-1, higher is more relevant) */
  score?: number;
  /** Any additional metadata from the MCP server */
  metadata?: Record<string, unknown>;
}

export interface McpClient {
  /** The name of the search tool discovered on the server */
  searchToolName: string;
  /** All tools available on the MCP server */
  toolNames: string[];
  /** Search the knowledge base for relevant chunks */
  search(query: string, maxChunks: number): Promise<RetrievedChunk[]>;
  close(): Promise<void>;
}

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
 * Common names for search/query tools across different RAG MCP servers.
 * Used to auto-discover the search tool if the name isn't standard.
 */
const SEARCH_TOOL_NAMES = ["search", "query", "retrieve", "search_documents", "vector_search", "rag_search"];

/**
 * Connect to a RAG MCP server and discover its search tool.
 */
export async function connectMcpServer(): Promise<McpClient> {
  const command = process.env.MCP_SERVER_COMMAND ?? "python";
  const args = parseArgs(process.env.MCP_SERVER_ARGS);

  logger.info("Connecting to RAG MCP server", { command, args });

  const transport = new StdioClientTransport({ command, args });

  const client = new Client(
    { name: "rag-agent", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);

  // Discover available tools
  const { tools } = await client.listTools();
  const toolNames = (tools ?? []).map((t) => t.name);

  logger.info("MCP server connected", { toolCount: toolNames.length, tools: toolNames });

  // Find the search tool — try common names, fall back to first tool
  let searchToolName = SEARCH_TOOL_NAMES.find((name) => toolNames.includes(name));

  if (!searchToolName) {
    if (toolNames.length === 0) {
      throw new Error("No tools found on the MCP server. Expected a RAG server with a search/query tool.");
    }
    searchToolName = toolNames[0];
    logger.warn("No standard search tool name found, using first available tool", {
      searchToolName,
      availableTools: toolNames,
    });
  }

  logger.info("Search tool selected", { searchToolName });

  /**
   * Parse the MCP search tool response into RetrievedChunk objects.
   *
   * RAG MCP servers may return results in various formats. This function
   * handles the most common formats:
   * - Array of chunk objects with content + metadata
   * - Text content with structured formatting
   * - JSON string in text content
   */
  function parseSearchResult(result: unknown): RetrievedChunk[] {
    const res = result as {
      content?: Array<{ type: string; text?: string }>;
    };

    const textParts = (res.content ?? [])
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text as string);
    const rawOutput = textParts.join("\n");

    // Try to parse as JSON first (structured response)
    try {
      const parsed = JSON.parse(rawOutput);

      // Format: { results: [{ content, source, score, ... }] }
      if (Array.isArray(parsed)) {
        return parsed.map(parseChunkObject);
      }

      if (parsed.results && Array.isArray(parsed.results)) {
        return parsed.results.map(parseChunkObject);
      }

      if (parsed.chunks && Array.isArray(parsed.chunks)) {
        return parsed.chunks.map(parseChunkObject);
      }

      // Single chunk object
      if (parsed.content || parsed.text) {
        return [parseChunkObject(parsed)];
      }
    } catch {
      // Not JSON — fall through to text parsing
    }

    // Format: text with separators between chunks
    // Try to split on common chunk delimiters
    const chunkDelimiter = /\n---\n|\n===\n|\n{3,}/;
    const chunks = rawOutput.split(chunkDelimiter).filter((s) => s.trim().length > 0);

    return chunks.map((chunk, index) => {
      // Try to extract source from the chunk text
      const sourceMatch = chunk.match(/\[source:\s*(.*?)\]/i) || chunk.match(/source:\s*(.*?)(\n|$)/i);
      const source = sourceMatch ? sourceMatch[1].trim() : `chunk-${index + 1}`;

      return {
        content: chunk.trim(),
        source,
        chunkIndex: index,
      };
    });
  }

  /**
   * Parse a single chunk object from various JSON formats.
   */
  function parseChunkObject(obj: Record<string, unknown>): RetrievedChunk {
    return {
      content: (obj.content as string) ?? (obj.text as string) ?? (obj.chunk as string) ?? JSON.stringify(obj),
      source: (obj.source as string) ?? (obj.filename as string) ?? (obj.document as string) ?? (obj.title as string) ?? "unknown",
      chunkIndex: obj.chunkIndex as number | undefined ?? obj.index as number | undefined,
      score: obj.score as number | undefined ?? obj.relevance as number | undefined,
      metadata: obj.metadata as Record<string, unknown> | undefined,
    };
  }

  return {
    searchToolName,
    toolNames,

    async search(query: string, maxChunks: number): Promise<RetrievedChunk[]> {
      logger.info("Searching knowledge base", { query, maxChunks });

      // Try common parameter names for the search query and limit
      const args: Record<string, unknown> = {
        query,
        max_results: maxChunks,
        max_chunks: maxChunks,
        limit: maxChunks,
        top_k: maxChunks,
      };

      let result: unknown;
      try {
        result = await client.callTool({
          name: searchToolName,
          arguments: args,
        });
      } catch (error) {
        // If the call fails, try with just the query (minimal args)
        logger.warn("Search with full args failed, retrying with query only", { error: (error as Error).message });
        result = await client.callTool({
          name: searchToolName,
          arguments: { query },
        });
      }

      const chunks = parseSearchResult(result);

      // Limit to maxChunks
      const limited = chunks.slice(0, maxChunks);

      logger.info("Retrieved chunks", {
        count: limited.length,
        sources: limited.map((c) => c.source),
      });

      return limited;
    },

    async close(): Promise<void> {
      logger.info("Closing MCP connection");
      await client.close();
    },
  };
}

/**
 * Format retrieved chunks into a context string for the LLM prompt.
 *
 * Each chunk is numbered and includes its source for citation reference.
 */
export function formatChunksForContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return "No relevant information found in the knowledge base.";
  }

  return chunks
    .map((chunk, index) => {
      const scoreStr = chunk.score !== undefined ? ` (relevance: ${(chunk.score * 100).toFixed(0)}%)` : "";
      return `[${index + 1}] Source: ${chunk.source}${scoreStr}\n${chunk.content}`;
    })
    .join("\n\n---\n\n");
}

/**
 * Format citations for the final answer.
 */
export function formatCitations(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";

  const citations = chunks
    .map((chunk, index) => {
      const scoreStr = chunk.score !== undefined ? ` — relevance: ${(chunk.score * 100).toFixed(0)}%` : "";
      return `[${index + 1}] ${chunk.source}${scoreStr}`;
    })
    .join("\n");

  return `\n\n---\nSources:\n${citations}`;
}
