/**
 * RAG Agent — Retrieval-Augmented Generation with citations.
 *
 * The agent:
 * 1. Receives a question from the user
 * 2. Searches a knowledge base via an MCP RAG server
 * 3. Retrieves relevant chunks with source metadata
 * 4. Generates an answer grounded in the retrieved context
 * 5. Formats citations referencing the source chunks
 *
 * Optionally, the agent can perform multiple search rounds if the
 * initial results are insufficient (multi-hop retrieval).
 */

import OpenAI from "openai";
import {
  McpClient,
  RetrievedChunk,
  formatChunksForContext,
  formatCitations,
} from "./tools.js";
import { logger } from "./lib/logger.js";

const RAG_SYSTEM_PROMPT = `You are a knowledgeable assistant that answers questions based on retrieved context from a knowledge base.

Instructions:
- Answer the question using ONLY the provided context chunks.
- Cite sources using [1], [2], [3], etc. matching the chunk numbers in the context.
- If the context doesn't contain enough information to answer, say so honestly.
- Do not make up information that isn't in the context.
- Be clear, accurate, and well-structured in your response.
- If multiple chunks contribute to the answer, cite all relevant sources.

Example:
Context:
[1] Source: docs/api.md
The API supports both REST and GraphQL endpoints.
[2] Source: docs/auth.md
Authentication uses OAuth 2.0 with bearer tokens.

Question: "What authentication method does the API use?"

Answer: The API uses OAuth 2.0 with bearer tokens for authentication [2]. It supports both REST and GraphQL endpoints [1].`;

const QUERY_REFINEMENT_PROMPT = `You are a search query optimizer. Given the user's question and any previously retrieved context, generate an improved search query that will find the most relevant information.

Return ONLY the search query, nothing else. Do not include explanations or formatting.`;

export interface RagResult {
  /** The final answer with inline citations */
  answer: string;
  /** The answer with appended source list */
  answerWithCitations: string;
  /** All chunks retrieved across all search rounds */
  retrievedChunks: RetrievedChunk[];
  /** The search queries used */
  searchQueries: string[];
  /** Number of search rounds performed */
  searchRounds: number;
}

/**
 * Generate an optimized search query from the user's question.
 *
 * This refines the user's natural language question into a
 * search-engine-friendly query.
 */
async function refineQuery(
  openai: OpenAI,
  model: string,
  question: string,
  previousContext?: string
): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: QUERY_REFINEMENT_PROMPT },
    {
      role: "user",
      content: previousContext
        ? `Previous context: ${previousContext.slice(0, 500)}\n\nQuestion: ${question}`
        : `Question: ${question}`,
    },
  ];

  const response = await openai.chat.completions.create({
    model,
    messages,
    temperature: 0,
    max_tokens: 100,
  });

  return response.choices[0]?.message?.content?.trim() ?? question;
}

/**
 * Generate an answer from the retrieved context.
 */
async function generateAnswer(
  openai: OpenAI,
  model: string,
  question: string,
  context: string
): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: RAG_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Context:\n${context}\n\nQuestion: ${question}`,
    },
  ];

  const response = await openai.chat.completions.create({
    model,
    messages,
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content ?? "I was unable to generate an answer.";
}

/**
 * Run the RAG agent.
 *
 * @param question - The user's question
 * @param mcp - The connected RAG MCP client
 * @param maxChunks - Maximum chunks to retrieve (default 5)
 * @param multiHop - Whether to perform multi-hop retrieval (default false)
 * @returns The answer with citations and retrieval metadata
 */
export async function runRagAgent(
  question: string,
  mcp: McpClient,
  maxChunks: number = 5,
  multiHop: boolean = false
): Promise<RagResult> {
  const openai = new OpenAI();
  const model = process.env.MODEL ?? "gpt-4o-mini";

  const allChunks: RetrievedChunk[] = [];
  const searchQueries: string[] = [];
  let searchRounds = 0;

  // Round 1: Refine the query and search
  const refinedQuery = await refineQuery(openai, model, question);
  searchQueries.push(refinedQuery);
  searchRounds++;

  logger.info("Search round 1", { originalQuestion: question, refinedQuery });

  const chunks1 = await mcp.search(refinedQuery, maxChunks);
  allChunks.push(...chunks1);

  // Optional: Multi-hop retrieval — if results are sparse, try a second query
  if (multiHop && allChunks.length < maxChunks) {
    logger.info("Performing multi-hop retrieval (insufficient results)", {
      found: allChunks.length,
      needed: maxChunks,
    });

    const existingContext = formatChunksForContext(allChunks);
    const refinedQuery2 = await refineQuery(openai, model, question, existingContext);
    searchQueries.push(refinedQuery2);
    searchRounds++;

    logger.info("Search round 2", { refinedQuery: refinedQuery2 });

    const chunks2 = await mcp.search(refinedQuery2, maxChunks - allChunks.length);

    // Deduplicate by content similarity
    for (const chunk of chunks2) {
      const isDuplicate = allChunks.some(
        (existing) => existing.content.slice(0, 100) === chunk.content.slice(0, 100)
      );
      if (!isDuplicate) {
        allChunks.push(chunk);
      }
    }
  }

  // Format chunks as context for the LLM
  const context = formatChunksForContext(allChunks);

  logger.info("Generating answer", {
    chunkCount: allChunks.length,
    contextLength: context.length,
  });

  // Generate the answer with citations
  const answer = await generateAnswer(openai, model, question, context);

  // Append formatted source list
  const citations = formatCitations(allChunks);
  const answerWithCitations = answer + citations;

  logger.info("RAG agent completed", {
    searchRounds,
    totalChunks: allChunks.length,
    answerLength: answer.length,
  });

  return {
    answer,
    answerWithCitations,
    retrievedChunks: allChunks,
    searchQueries,
    searchRounds,
  };
}
